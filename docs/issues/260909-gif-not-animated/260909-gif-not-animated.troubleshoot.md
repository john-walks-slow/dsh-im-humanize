# 通过 `dsh_im_return_file` 返回 GIF 在 Telegram / 微信渠道不动图

- 日期：2026-09-09
- 渠道：Telegram、微信（weixin / iLink bot）
- 触发条件：Agent 调 `dsh_im_return_file` 返回一个 `.gif` 文件（如 blobcat 系列动图表情）
- 现象：Telegram 和微信客户端收到后都是**静态图**，不动。
- 关联代码：`src/channels/shared/semantic/artifact-delivery.mjs`、`src/channels/telegram/telegram-runtime.mjs`、`src/channels/telegram/telegram-api.mjs`、`src/channels/weixin/weixin-api.mjs`

## 1. 根因

GIF 在共享投递层被 `mediaType.startsWith('image/')` 判定为“图片”，统一走各渠道的 `sendImage`。但 `sendImage` 选用的**原生图片消息类型**在这两个渠道都**不会播放 GIF 动画**——两条根因互相独立：

### 1.1 Telegram：`sendImage` 调的是 `sendPhoto`，而 `sendPhoto` 对 GIF 只渲染静态首帧

`telegram-runtime.mjs`：

```js
sendImage(target, file) {
  return this.#api.sendPhoto({ chatId, file, replyToMessageId, messageThreadId, signal });
}
sendFile(target, file) {
  return this.#api.sendDocument({ chatId, file, ... });
}
```

`telegram-api.mjs` 只有 `sendPhoto`（field=`photo`）和 `sendDocument`（field=`document`）两个媒体方法，**没有 `sendAnimation`**。

Telegram Bot API 的语义（官方文档 + Stack Overflow / 多个社区帖一致）：

- `sendPhoto`：发送“照片”，Telegram 服务端会按照片处理，**GIF 被剥离动画，只显示静态首帧**（即便返回 `ok:true`）。
- `sendAnimation`：发送“动画”（GIF 或无声 H.264），**才会播放动画**。
- `sendDocument`：以文件发送；Telegram 客户端识别 `.gif` 文档并**内联播放动画**（呈现为文件样式）。

→ dsh-im 把 GIF 路由到 `sendPhoto`，必然静态。

### 1.2 微信（weixin / iLink bot）：协议只有 `image_item` 图片消息，没有“表情/贴纸”消息类型

`weixin-api.mjs#sendImage` 发送 `item_list: [{ type: 2, image_item: { media, mid_size } }]`（`MessageItemType.IMAGE = 2`），CDN 上传字节原样保真、`no_need_thumb: true`。

两个事实叠加：

1. **微信图片消息对 GIF 只显示静态首帧**。微信生态里能动的“表情”是独立的消息类型（公众号/客服 API 的 `msg_type: 47` 表情消息，靠 `md5 + len` 命中表情库），不是图片消息。
2. **iLink bot 协议根本不提供表情/贴纸消息类型**。参考实现 `Tencent/openclaw-weixin` 的 `src/api/types.ts`：

   ```ts
   export const MessageItemType = {
     NONE: 0, TEXT: 1, IMAGE: 2, VOICE: 3, FILE: 4,
     VIDEO: 5, TOOL_CALL_START: 11, TOOL_CALL_RESULT: 12,
   } as const;
   ```

   只有 文本/图片/语音/文件/视频/工具调用，**没有 emoji/sticker 项**。公众号那条 `type 47` 表情链路在 iLink 协议里不存在。

→ 即便字节原样上传、客户端拿到完整 GIF，图片消息这条链路在微信里就是静态首帧；且 iLink 协议没有可切换的动图链路。

## 2. 现象与根因的关联

| 现象 | 关联 |
|------|------|
| Telegram 收到 GIF 是静态 | `sendImage → sendPhoto`，Telegram 把 GIF 当照片剥离动画 |
| 微信收到 GIF 是静态 | `image_item` 图片消息对 GIF 只渲染首帧；协议无表情消息类型可走 |
| 字节没被转码/损坏 | 不是文件问题——`artifact-delivery.mjs` 直传 `file.bytes`，CDN 也只做传输加密；问题在“图片消息”这个呈现类型本身 |
| `sendFile`（文件）路径没走到 | 共享层对 `image/*` 一律优先 `sendImage`，只在 `sendImage` 被明确拒绝时才降级 `sendFile`；GIF 不会被拒绝，所以不会自动落到文件路径 |

## 3. 修复路径

### 3.1 Telegram（可彻底修复，置信度高）

在 telegram 适配层把 GIF 路由到 `sendAnimation`：

1. `telegram-api.mjs` 新增 `sendAnimation({ chatId, file, replyToMessageId, messageThreadId, signal })`，结构与 `sendPhoto` 一致，multipart 字段名用 `animation`。
2. `telegram-runtime.mjs#sendImage` 内部按 `mediaType` 分流：`image/gif`（以及若以后要支持 `image/webp` 动图、无声 mp4 缩略）→ `sendAnimation`；其余 `image/*` 仍走 `sendPhoto`。

理由：这是 Telegram Bot API 官方为 GIF 设计的呈现类型，发送后就是内联动画气泡（非文件卡片），体验最自然；也符合 dsh-im“渠道原生适配”边界（协议选择留在渠道层，共享层只管 image/* 优先）。

备选（更省事但体验降级）：在 `sendImage` 里对 `image/gif` 改调 `sendDocument`。Telegram 对 `.gif` 文档会内联播放动画，但呈现带文件下载条/保存动作，不如 `sendAnimation` 干净。

### 3.2 微信 weixin（iLink 协议内不可修复）

iLink bot 协议不提供表情消息类型，**在不动上游协议的前提下无法让微信渠道动图**。可选项只有“换呈现、不换协议”的降级：

- 现状（`sendImage` → `image_item`）：静态首帧，inline 显示。
- 改走 `sendFile` → `file_item`：微信以文件卡片呈现，用户**点开**后微信图片查看器**可能**播放 GIF 动画（未实测；即便能动也是“点开才动”，不是聊天气泡内联）。

建议：**不在 weixin 渠道强求 GIF 动图**。若贴纸场景需要动图，应：
- 在 dsh-stickers / 贴纸描述里对微信渠道把 GIF 标注为“静态预览”，或
- 让模型在微信渠道发 GIF 时改用文件（`dsh_im_return_file` 仍是图片路径，但 weixin 适配层对 `image/gif` 直接走 `sendFile`），把“inline 静态首帧”换成“点开可动”，并实测确认。

这是协议层限制，不是 dsh-im 的 bug；上游 openclaw-weixin 同样受此约束（其 issues 也无 GIF 动图相关反馈，因为大家都默认微信图片消息就是这样）。

## 4. 置信度

- Telegram 根因：**95%+**。代码实锤（`sendImage→sendPhoto`、无 `sendAnimation`）+ Telegram Bot API 官方语义 + 多个独立社区帖一致。
- 微信根因：**90%**。用户实测已确认 iLink 渠道 GIF 不动；外部证据（微信图片消息对 GIF 静态、需 type 47 表情消息）+ openclaw-weixin types 证实协议无表情消息类型。剩 10% 不确定性在“改走 `sendFile` 点开能否播放”这一点未实测。

## 5. 验收标准

- Telegram：`dsh_im_return_file` 传一个 `.gif` → 官方 Telegram 客户端收到后**内联播放动画**，无文件卡片。回归用例覆盖 `image/gif → sendAnimation` 与 `image/png → sendPhoto` 两条分流。
- 微信：明确“不修复 inline 动图”，改为记录该限制；若采纳 3.2 的 `sendFile` 降级，验收标准为“点开文件后微信图片查看器播放 GIF 动画”（需真机确认；若不播则回退现状并记为协议限制）。
- 非回归：非 `image/gif` 的图片（PNG/JPEG/WebP 静态图）在两个渠道行为不变，仍走 `sendPhoto` / `image_item`。

## 6. 未覆盖 / 待实测

- QQ 渠道（用户未测）：QQ 官方富媒体文档把 gif 列入图片支持并写“发送后直接展示图片”，但“直接展示”是否含动画未明。鉴于微信的教训，**不建议凭文档断言 QQ 能动**，需真机发一张 `.gif` 确认。若 QQ 同样不动，根因可能也是“图片消息不播放 GIF”，需要查 QQ 是否有对应的动图消息类型。
- 企业微信（wecom）：独立渠道，`uploadMedia(type:'image')`，历史上 WeCom 图片格式约束更严，GIF 大概率被拒→降级文件卡片；不在本次修复范围。
