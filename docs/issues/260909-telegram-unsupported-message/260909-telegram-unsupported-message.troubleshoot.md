# Telegram 必现「不支持的消息」+ 流式不生效

- 日期：2026-09-09
- 渠道：Telegram（@mimitchi_ref_bot / @mimitchi_yui_bot，私聊）
- 触发条件：streaming=true、messageBreak=true（humanize.json 当前配置）
- 客户端：Telegram X

## 1. 根因

**Telegram X 客户端不支持 Bot API 10.1（2026-05-08）引入的 Rich Message / Rich Draft 内容类型。**

上游 dsh-im v4.13（fork 基线）对**每一条 Telegram 回复默认都走 Rich 路径**：

- 私聊流式：`sendRichMessageDraft`（30 秒临时草稿预览）逐步更新 → `sendRichMessage` 持久化最终消息；
- 群聊/Topic：`sendMessage` 占位 + `editMessageText(rich_message)`；
- `toTelegramRichMarkdown` = 模型 Markdown 原文 + HTML 实体转义，`rich_message: { markdown }`。

这些都是 Telegram 官方客户端能渲染的 Rich 内容；Telegram X 没有实现 Rich Message 渲染，于是把这些消息渲染成占位符「不支持的消息」。

**这不是 fork 的破坏**：fork 对 telegram 发送链路只改了 ~26 行（typing action 加参数、descriptor 加 typing 配置），`#sendRich` / `openDeliveryStream` / `toTelegramRichMarkdown` 与上游 v4.13 逐字节一致。换官方客户端即可消除。

## 2. 现象与根因的关联

| 现象 | 关联 |
|------|------|
| 必现「不支持的消息」 | 每轮回复的 Rich 草稿 + Rich 终稿在 Telegram X 里都渲染为「不支持的消息」；message_break 的分段是普通 `sendMessage`，所以分段能正常显示 |
| 流式不生效 | 流式 UI 就是 Rich Draft 预览。Telegram X 渲染不了 Draft → 草稿气泡一直是「不支持的消息」、看不到逐字更新 → 看起来流式停了。API 层面草稿其实一直在更新 |

实证（用 ref bot 直连 Bot API，对私聊 6110538394 发的 5 条测试消息，API 全部 `ok:true`）：

| # | 方法 | Telegram X 显示 |
|---|------|-----------------|
| A | `sendMessage` | ✅ 正常 |
| B | `sendRichMessage`（标题/加粗/代码/列表） | ❌ 不支持的消息 |
| C | `sendRichMessageDraft`（2 帧） | ❌ 不支持的消息 |
| D | `sendRichMessage`（含 GFM 表格 block） | ❌ 不支持的消息 |
| E | `sendRichMessage`（含 `$$` 公式，未成 math block） | ❌ 不支持的消息 |

服务端对 B/D 返回了 `rich_message.blocks`（paragraph/table…），证明 API 已正确解析；问题纯在客户端渲染能力。

## 3. 修复路径

### 路径 A（推荐，零代码、立即生效）

换用 **Telegram 官方客户端**（Telegram for Android / iOS / Desktop / Web）。官方客户端是 Rich Message 渲染的参考实现，Draft 预览也一并支持。换上去后「不支持的消息」和「流式不生效」应同时消失。

> Telegram X 是实验性客户端，更新远慢于官方、长期缺失大量新内容类型，Rich Message 很可能永远不会进入。继续用 X 还会撞到未来其它新消息类型同样的坑。

### 路径 B（若需保留 Telegram X / 兼容旧客户端）

在 fork 增加 per-bot（或 per-channel）的 **`telegramPlainDelivery`** 开关，开启后 telegram 交付绕开 Rich 路径，全部降级为普通文字：

- `openDeliveryStream`（私聊）改用 `sendMessage` 占位 + `editMessageText(text)`（不再用 `sendRichMessageDraft`）；
- `#sendRich` / `#editRich` 在该开关下把 `block.format` 当作 `plain` 处理 → 走 `#sendPlain` / `editMessageText(text)`；
- 群聊占位同理用 `editMessageText(text)`，不带 `rich_message`。

这是 additive、受开关门控的小改动，不影响默认（Rich）行为。代价：失去 Markdown 结构化呈现（标题/表格/代码块回退为纯文本），但能保证可读性。

实现前需确认：用户是否打算保留 Telegram X（决定要不要做路径 B）。

## 4. 置信度

~95%。根因由「五条测试消息中仅普通 `sendMessage` 在该客户端可显示，三条 Rich + 一条 Draft 全部不可显示」这一可直接复现的实测证据支撑，且与 Bot API 10.1 changelog、上游 dsh-im v4.13 代码、fork diff 一致。剩余 ~5% 不确定性：未在官方客户端上亲测 B/C/D 确认可渲染（但官方是参考实现，预期可渲染）。

## 5. 验收标准

- 路径 A：用户换官方客户端后，向 bot 发任意消息，回复以 Rich 格式正常渲染（标题/加粗/代码/表格可见），草稿逐字更新可见（流式生效），无「不支持的消息」。
- 路径 B（若实施）：开启 `telegramPlainDelivery` 后，在 Telegram X 上回复以纯文本可读，流式占位逐字更新可见，无「不支持的消息」；关闭该开关后行为回到 Rich（官方客户端不受影响）。
