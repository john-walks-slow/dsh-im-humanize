# 修复 Telegram GIF 不动图 — 实施摘要

- 日期：2026-09-09
- 关联诊断：[`260909-gif-not-animated.troubleshoot.md`](./260909-gif-not-animated.troubleshoot.md)
- 关联验证：[`260909-gif-not-animated.validation.md`](./260909-gif-not-animated.validation.md)
- 渠道：Telegram（修复）；微信 weixin（定性为协议限制，不修复）

## 背景

用户实测：通过 `dsh_im_return_file` 返回 `.gif`（blobcat 系列），Telegram 和微信客户端都只显示静态首帧，不动。

## 根因（详见诊断文档）

- **Telegram**：`TelegramBotClient.sendImage` 调 `sendPhoto`，而 Telegram Bot API 的 `sendPhoto` 对 GIF **剥离动画、只留静态首帧**；GIF 要动必须走 `sendAnimation`。`telegram-api.mjs` 原本只有 `sendPhoto`/`sendDocument`，没有 `sendAnimation`。
- **微信 weixin**：iLink bot 协议只有图片消息 `image_item`，微信对图片消息里的 GIF 只渲染静态首帧；能动的“表情消息”是公众号 API 的 `msg_type: 47`，iLink 协议不提供。协议层限制，不可修。

## 实施

仅修 Telegram，改动 ~19 行生产代码（< 50 行、风险可控，按 workflow-implement-review 跳过正式 reviewer）：

1. `src/channels/telegram/telegram-api.mjs`：新增 `sendAnimation({ chatId, file, replyToMessageId, messageThreadId, signal })`，结构与 `sendPhoto` 一致，multipart 字段名 `animation`，调 Bot API `sendAnimation`。
2. `src/channels/telegram/telegram-runtime.mjs`：`TelegramBotClient.sendImage` 按 `mediaType` 分流——`image/gif` → `sendAnimation`，其余图片 → `sendPhoto`（不变）。

未改动共享层 `artifact-delivery.mjs`：GIF 仍是 `image/*`、仍优先 `sendImage`，只是渠道层 `sendImage` 内部把 GIF 路由到正确的原生消息类型。符合 dsh-im“渠道原生适配”边界。

## 测试

`test/channels/telegram/telegram.test.mjs` 新增两条用例：

- `Telegram API uploads a GIF animation through the native animation method`：断言 `sendAnimation` POST 到 `/sendAnimation`、multipart 字段 `animation`、Content-Type `image/gif`、reply/thread 参数保真。
- `Telegram bot client routes GIF artifacts through sendAnimation and other images through sendPhoto`：断言 GIF → `sendAnimation`、PNG → `sendPhoto`，且两者都携带 chatId/reply/thread/signal。

`node --test test/channels/telegram/telegram.test.mjs`：0 fail（24 个 cancelled 为既有轮询类长跑用例被进程退出取消，非本次引入）。既有 `routes images through sendPhoto` 用例仍通过，PNG 回归无影响。

`node plugin-src/host/build.mjs` 重建 `lib/index.js` 成功，`sendAnimation` 与 `image/gif` 分流已烘焙进产物。

## 已知限制 / 待跟进

- **QQ 渠道**：用户未实测。官方文档把 gif 列入图片支持并写“发送后直接展示图片”，但微信的教训说明“文档支持 gif”不等于“图片消息播放动画”。需真机发 `.gif` 确认；若同样静态，再查 QQ 是否有对应动图消息类型。
- **微信 weixin**：协议限制，不修。降级可选项（把 `image/gif` 改走 `sendFile`，用户点开由微信图片查看器决定是否播放）未实现，待真机评估后再决定。
- **动画 WebP**：`image/webp` 仍走 `sendPhoto` → 静态。Telegram `sendAnimation` 官方只覆盖 GIF/无声 H.264，不含 WebP；若需要可单独评估。

## 可复用经验（pitfall）

> 在 IM 渠道适配层，`image/*` ≠ “都能用图片消息发”。“图片消息”在多数平台对 GIF 只渲染静态首帧；动图往往需要**独立的消息类型**（Telegram 的 `sendAnimation`、微信的表情消息 type 47）。新增渠道或新增图片格式时，必须按格式核对“该平台该消息类型是否播放该格式动画”，不能假设图片消息 = 动图可播。
