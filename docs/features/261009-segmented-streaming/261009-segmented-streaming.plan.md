# 分段流式（message_break × streaming）· 实施计划

日期：2026-10-09。基线：dsh-im-humanize fork（`@johnnren/dsh-im-humanize` 4.21.2-humanize 线）。

用户诉求（原话）：「telegram 流式支持吗？为什么现在好像没能流式（我设置的过程 off, messagebreak on, 流式 on）」，随后选定方案 **b**：

> 做成「分段 + 每段流式」——AI 调用 `message_break` 时，把当前流式载体结算成一条真实消息，然后为下一段重开一个新流。

## 1. 现状核实（源码事实，非推断）

### 1.1 为什么现在看不到流式

线上配置 `~/.dsh/integrations/dsh-im/humanize.json`：`streaming=true`、`messageBreak=true`、`progressStatus=false`。

通用桥 `src/channels/shared/text-harness-bridge.mjs`（1891 行，`#process` = L789–1347）中：

| 位置 | 事实 |
|---|---|
| L890 | `lazyStream = suppressProgress \|\| humanize.messageBreak` → messageBreak 开启时**永懒开流**（不发「正在处理…」占位） |
| L944–966 | 仅当 `humanize.streaming` 为真时开流；L948 `openDeliveryStream`（Telegram 私聊 Rich Draft / 群聊占位消息），L958 `openStream` 兜底 |
| **L1073–1076** | **`if (humanize.messageBreak && update.type === 'text') return;`** —— 只要 messageBreak 开关为真，`text` 帧一律不进流（与本轮是否真的调用了工具无关） |
| L1080–1083 | `progressStatus=false` 时再丢弃 `tool`/`status` 帧 |
| L987–1009 | `createMessageBreakHandler({ sendSegment })`：断点处把该段文本用 `bot.sendText` 当独立消息发出；流只承载尾部 |

再叠加 `HarnessClient` 的下发策略（`src/channels/shared/harness-client.mjs`）：

- L544–556 `#commitText`：推送的 `text` 是**上一断点之后的相对文本**；
- L1633–1649：共享桥未传 `progressMode` → 默认 `'latest'`，每 300ms 轮询**只投最后一条更新**，且 `assistant-message` 被直接过滤掉。

**结论：`text` 被 L1076 丢、`tool/status` 被 progressStatus 丢 ⇒ 流载体整轮收不到任何帧 ⇒ 草稿气泡从不创建，视觉上完全没有流式。这不是故障，是当前设计的净效果。**

### 1.2 渠道覆盖（决定改动半径）

| 渠道 | 桥 | 流载体 | 备注 |
|---|---|---|---|
| Telegram | 共享桥 | 私聊 = Rich Draft（**短生命周期**，`keepalive:true`，telegram-runtime.mjs:902–909）；群聊 = 可编辑占位消息（L915–981） | 唯一实现 `openDeliveryStream` 的渠道（telegram-runtime.mjs:888） |
| Slack | 共享桥 | 原生 `chat.startStream/appendStream/stopStream`（slack-runtime.mjs:231–352） | 无 keepalive |
| Discord | 共享桥 | `createEditableMessageStream`（discord-runtime.mjs:484） | 可编辑真消息 |
| WhatsApp | 共享桥 | `createEditableMessageStream`（whatsapp-runtime.mjs:514） | 可编辑真消息 |
| iMessage | 共享桥 | 无流载体 | `messageBreak` 走 sendText 分段（现状即正确） |
| 飞书/钉钉/企微/QQ/微信 | **自建桥**，不走通用桥 | 卡片/帧/分块 | 本次不改（见 §4） |

### 1.3 现有测试事实

- 不存在「messageBreak 开启时 text 不进流」的断言用例。
- `test/channels/shared/progress-status.test.mjs:193` 断言 `progressStatus=false` 时 **text 仍进流**（messageBreak 关闭场景，语义不变）。
- `test/channels/shared/progress-status.test.mjs:220` 「progressStatus=false + messageBreak=true opens lazy stream」只断言 `open:{"lazy":true}` 与 onUpdate 已接线，**未断言 text 是否进流** → 本特性改完后该用例可自然升级为断言 text 进流。
- `test/humanize-bridge.test.mjs:479–517` 覆盖 `streaming=false + messageBreak=true` 的分段发送（该路径保持不变）。

## 2. 目标行为（用户路径）

前提：`streaming=true` 且 `messageBreak=true`（两者同时开启的新语义：**分段 + 每段流式**）。

| # | 场景 | 期望 |
|---|---|---|
| P1 | 长回复，模型在段落间调用 `message_break` | 第 1 段逐字流式（草稿/占位）→ 断点处该段**定稿为一条真实消息** → 第 2 段在新流中逐字流式 → … → 尾部在最后一条流中流式并定稿 → 用户看到 N 条顺序消息 |
| P2 | 整轮没有调用 `message_break` | 与现在完全一致：单条流式消息 |
| P3 | 回复以 `message_break` 结尾（断点后无内容） | 最后一段定稿后不开空流、不发空消息 |
| P4 | `streaming=false` + `messageBreak=true` | 行为不变：分段整条发送 + 拟人停顿（`applySegmentGap`） |
| P5 | `streaming=true` + `messageBreak=false` | 行为不变：单条流式消息 |
| P6 | 群聊 / Topic（Telegram） | 每段定稿为一条群消息，下一段新开占位消息 |
| P7 | 中途出现提问/审批卡片 | 当前流被 drain（沿用 `stopPreview`，并把心跳停掉）；用户回答后模型若再次调用 `message_break`，轮转会重开心跳与输入状态，新分段照常流式；若不再有断点，该轮仍由已被 preview-stop 的旧载体服务，直到最终 `finish`（与改造前一致） |
| P8 | 用户 /stop 或打断 | 已定稿的分段保留；当前段以 `已停止。` 定稿（沿用 L1265–1274） |
| P9 | 某段结算失败 | 记录 warning；若为确定性失败则降级用 `sendText` 补发该段，不丢内容 |

## 3. 方案设计

### 3.1 状态改造（`#process` 内）

```js
let stream = null;              // 当前段的活动载体（可被轮转替换）
let semanticStream = false;     // 随载体一起重置
let segmentReceipts = [];       // 已定稿分段的回执（providerMessageIds 汇总用）
```

新增两个局部函数（放在 pre-ask 开流处附近，闭包共享上面三个变量）：

- `openReplyStream()`：封装 L946–965 的开流分支（`openDeliveryStream` → `openStream` → 失败返回 null），每次调用重算 `semanticStream`；`lazyStream` 语义不变（messageBreak 下始终懒开）。
- `finishSegment(text)`：`stream.finish(...)` → 收 `segmentReceipts` → `stream = null`；失败处理见 §3.5。

### 3.2 断点轮转（核心变更）

`createMessageBreakHandler` 的 `sendSegment` 回调（L987–1009）分支：

```js
sendSegment: async (segmentText) => {
  if (stream) {                       // 流式开启：结算当前段，重开新段
    await finishSegment(segmentText);
    stream = await openReplyStream();
    startKeepalive(stream);           // 新载体重新武装心跳（幂等）
    firstStreamReplySent = false;     // 新载体还没有内容
    await typingSession?.restartOn(); // 段间长静默仍有「正在输入」
    return;
  }
  ...已有路径：typingSession.restartOn() + applySegmentGap() + bot.sendText()
}
```

同时删除 L1073–1076 的 `text` 丢弃：messageBreak 模式下 **`text` 帧正常进流**（`#commitText` 已保证是断点后的相对文本）。`tool/status` 仍受 `progressStatus` 门控（L1080–1083 不动）。

心跳改造：把原先内联的心跳启动抽成幂等的 `startKeepalive(carrier)`（已有 timer 则不重复起），既修掉「首个载体开流失败、后续轮转才成功 → 全程无心跳」，也让交互卡片 drain 掉心跳后，下一次轮转能重新武装。

### 3.3 尾部结算（L1147–1203）

- `visibleAnswer` 计算不变（`remainingText`）。
- **「回复正好停在断点」的判别**（实现时核实出的关键细节）：`remainingText` 在「已发送前缀 == 完整回答」时会走 `|| fullAnswer` 兜底，返回**整条回答**而不是空串（`src/channels/shared/message-break.mjs:124–135`）。直接按「visibleAnswer 为空」判断会把整条回答重复发一遍。判别条件为：

  ```js
  const tailAlreadyDelivered = handler.segmentsCover(baseAnswer) && !carrierStreamedText;
  ```
  - `segmentsCover(fullAnswer)`（新增于 `message-break.mjs`）：用**与 `remainingText` 完全相同的原始前缀规则**判断「已发分段覆盖了整条回答」，即 `startsWith(sentText)` 且剩余部分 `trim()` 为空。**只有这种情况下才抑制发送**——此时尾部可证明为空，不可能丢内容；前缀失配（canonical 改写、段尾空白）一律照旧发送整条，宁可重复也不丢。
  - `carrierStreamedText`：每次 `openReplyStream()` 清零，转发 `text` 帧时置真。若当前载体确实流式输出过内容（例如 canonical 改写把尾部删掉），则不算「已交付」，走正常 finish 路径，绝不静默丢弃用户已看到的内容。
- 若 `stream` 且（`tailAlreadyDelivered` 或尾部为空）→ `stream.cancel?.(); stream = null;`，不发空消息、不发重复消息；`!streamFinished` 分支同步跳过发送（该轮 `textReceipt` 为 null，与既有「全部文本已作为分段发出」路径一致）。
- 若 `stream` 且尾部非空且非 `tailAlreadyDelivered` → `stream.finish(visibleAnswer)`，回执 **并入** `segmentReceipts`，最终 `textReceipt.providerMessageIds` 为全部段之和。

### 3.4 关键代码点

| 文件:行 | 改动 |
|---|---|
| `src/channels/shared/text-harness-bridge.mjs` 状态声明 | 新增 `segmentReceipts` 与 `carrierStreamedText` |
| 同文件 `openReplyStream/openReplyStream 调用点` | 原 L944–966 的开流分支抽成 `openReplyStream()`（行为等价，供轮转复用；每次清零 `carrierStreamedText`） |
| 同文件 `sendSegment` | 增加「有流则 `finishSegment()` 结算 + 重开」分支；新增 `finishSegment()` / `sendSegmentAsText()` |
| 同文件 onUpdate | **删除** messageBreak 丢弃 text 的逻辑；转发 `text` 帧时置 `carrierStreamedText = true` |
| 同文件 尾部结算 | `tailAlreadyDelivered` 判别 + 回执汇总 + 空尾/重复尾 `cancel` |
| 同文件 keepalive | 心跳改为 `stream?.refresh?.()`，容忍轮转间隙的 null |
| `src/channels/shared/message-break.mjs` | 头注释改写；新增 `segmentsCover(fullAnswer)`（handler 其余逻辑不动） |
| `src/channels/shared/text-harness-bridge.mjs` keepalive | 启动逻辑抽成幂等 `startKeepalive(carrier)`；轮转后重新武装；心跳内改用 `stream?.refresh?.()` |
| `plugin-src/client/i18n.js` | 同步新 hint 的中英词条（否则 `test/client-ui.test.mjs` 的「每个中文串都要有英文投影」校验会红，英文界面会回退成中文） |
| `test/channels/shared/text-harness-bridge.test.mjs` | 修掉两处**陈旧 tick**：Telegram 的 keepalive 间隔在 48c1b84 已改为 5000ms，而这两个用例仍 tick 4000ms（HEAD 上本就红，见 §6） |

### 3.5 边界与决策

1. **不加新开关**：`streaming × messageBreak` 四象限中，唯一变化的是 `true × true`（P1）。理由：这是 message_break 语义的自然补全，加开关只会再增一组组合。
2. **结算失败**：`finishSegment` 分为两类——载体返回 `deliveryOutcome==='failed'`（确定性失败）时才用 `bot.sendText(segmentText)` 补发；`finish()` **抛错**先经 `channelDeliveryFailure()` 分类，只有 401/403/429 这类确定性失败才补发，其余按 `channel-delivery-uncertain` 处理（消息可能已落库，重复发送的伤害大于丢失，遵仓库「未确认不要立即重试」的既有约定）。
3. **`stopPreview` 与轮转**：交互卡片到来时 `stopKeepalive()` + `stopPreview()` 只对**当前**载体生效；此后只有发生 `message_break` 轮转才会新建干净载体（并重新武装心跳与输入状态）。若不再有断点，该轮由被 preview-stop 的旧载体服务直到最终 `finish`——与改造前一致，不要按「交互后一定恢复流式」验收。
4. **不回退上游**：上游 `messageBreakHandler` 只有「分段直发」一种语义；本改动是 fork 独立性的一部分，README 已声明该能力属 fork 扩展。
5. **`progressMode` 不动**：仍为默认 `'latest'`。已知残余风险见 §8.1，本次不为它引入抖动（改成 `'all'` 会放大 Telegram 编辑频率）。

## 4. 覆盖范围

**生效**：走共享桥的 5 个渠道（Telegram / Slack / Discord / WhatsApp / iMessage）。其中 iMessage 无流载体 → 自动落回既有分段路径。Telegram 是唯一有 Rich Draft 的渠道，也是本次验收对象。

**不生效（本次明确不做）**：飞书、钉钉、企微、QQ、微信（自建桥，各自有卡片/帧载体与独立的 messageBreak 实现）。其中钉钉目前把 text 推进卡片**并**发分段消息（存在重复），属独立缺陷，另行处理。

## 5. 文案与文档

| 位置 | 现状 | 改为 |
|---|---|---|
| `plugin-src/client/channels/shared/humanize-fields.js:57–59` | 分步消息 hint「可与流式回复同时开启」 | 说明两者同时开启时的实际行为：**每段都会流式输出，断点处定稿为一条消息** |
| `plugin-src/client/i18n.js` | 旧 hint 的中英词条 | 同步新串 + 英文投影（`test/client-ui.test.mjs` 会遍历校验） |
| `README.md:61–62` 设置表 | 同上 | 同上 |
| `README.md:77` 流式回复段 | 「可与 message_break 同时开启」 | 补一句分段流式语义 |
| `README.md:88` 过程进度段 | 「关闭此项会连带跳过占位流（分段直接逐条发送…）」 | 更新为分段流式下的实际表现 |
| `src/channels/shared/message-break.mjs:9–11` | 「streaming is automatically disabled (mutually exclusive)」 | 改为「流式开启时每段各占一条流；流式关闭时退化为整条发送」 |

README 面向用户的配置说明必须同步（AGENTS.md 文档规范）。

## 6. 测试方案

新增 `test/channels/shared/segmented-streaming.test.mjs`（9 个用例，自带 `streamBot()` / `semanticStreamBot()` 夹具，记录 `open/update/finish/cancel/text` 事件并给每条载体一个 id）：

1. `messageBreak=true + streaming=true`：`text` 帧进入流（回归 §1.1 的丢弃行为），`progressStatus=false` 仍丢弃 tool 进度。
2. 断点轮转（`openStream` 型载体）：`open → update:第一段 → finish:第一段 → open → update:第二段 → finish:第二段`，且回执 `providerMessageIds = [segment-1, final-1, segment-2, final-2]`。
3. 断点轮转（`openDeliveryStream` 语义载体）：`update/finish` 收到 `markdown` 块，`semanticStream` 在轮转后仍正确判定。
4. 以断点结尾（P3）：最后一条载体 `cancel`，不出现空的 `finish`；该轮 `textReceipt` 为 null。
5. 段尾空白导致原始前缀失配时**不抑制**（宁可重复也不丢尾巴）：最终 `finish` 的负载包含完整回答。
6. `streaming=false + messageBreak=true`：保持 `text:第一段` / `text:第二段`，无 `open:`（回归）。
7. 分段结算抛错（不确定）→ `cancel`，**不补发**（防重复）。
8. 分段结算抛错 403（确定失败）→ `cancel` + `text:<段文本>` 补发。
9. 分段结算返回 `deliveryOutcome:'failed'` → `text:<段文本>` 补发。

同步升级/修复：

- `test/channels/shared/progress-status.test.mjs:220`：由「只断言 lazy 开流」升级为「断言 messageBreak 模式下 text 进流」。
- `test/message-break.test.mjs`：新增 `segmentsCover` 的两个用例（触发/不触发边界；原始空白失配不得抑制）。
- `test/channels/shared/text-harness-bridge.test.mjs`：两处 `tick(4_000)` → `tick(5_000)`（Telegram keepalive 间隔在 48c1b84 改为 5000ms，这两条用例自那时起在 HEAD 上就是红的——已用 `git worktree` 在 HEAD 上复现确认，非本次引入）。

**已跑（本次改动面）**：`progress-status` / `segmented-streaming` / `text-harness-bridge` / `message-break` / `humanize-bridge` / `humanize-standalone-bridges` / `humanize-settings` / `humanize-override` / `client-humanize-ui` / `client-ui` = 192/192 绿；`test/channels/telegram/*.test.mjs` = 137/141，4 条失败在 HEAD 上同样失败（`Telegram distinguishes pre-dispatch abort…` + 3 条 `poll batch retains its settings`），与本次无关。未跑全量。

## 7. 验证要求（用户实机）

Telegram 官方客户端（Telegram X 渲染不了 Rich Message，见 `docs/issues/260909-telegram-unsupported-message/`）：

1. 私聊长回复（模型会调用 message_break）：逐段出现「草稿逐字增长 → 定稿为真实消息 → 下一条草稿」的节奏；段间的计算空档里有「正在输入」。
2. 群聊/Topic：每段一条群消息。
3. 以断点结尾的回复：不出现空气泡、不出现把整段重复一遍的收尾消息。
4. 过程中触发 ask_user_question：卡片不被草稿遮挡；回答后**只有再次发生 message_break 轮转**才会新建干净载体并恢复流式与「正在输入」（没有断点就仍是被 drain 的旧载体，与改造前一致）。
5. 关闭 streaming 后回到整条分段发送（P4）。

## 8. 风险与开放问题

1. **`'latest'` 批处理可能吞断点**：若同一 300ms 批次内 `message_break` 之后紧跟另一条非 text 更新（如新 tool call），桥只会收到后者 → 该断点未处理。后果：该段文本随尾部一起由最终消息发出（`remainingText` 前缀失配时回退全文），**内容不丢**，但会出现「草稿跳变」。本次接受；若实机频发再评估改 `progressMode:'all'`。
2. **Slack/Discord/WhatsApp 轮转未实测**：载体语义允许（stop/新建），但首轮实机验收只在 Telegram 进行；若发现异常，可按渠道把 `sendSegment` 回退到「直发分段」。
3. **Telegram 私聊草稿跳变**：定稿发真实消息后立即新开草稿，用户可能看到底部的轻微跳动；这是「分段」本身的代价，验证时确认可接受。
4. **回执语义**：分段回执并入最终 `textReceipt` 后，`deliveryOutcome` 仍以**最后一次结算**为准（分段失败单独 warning），不做多段聚合判定——保持简单。轮次正好停在断点时该轮 `textReceipt` 为 null（与既有「全部文本已作为分段发出」路径一致）。
5. **其他渠道的同类边角缺陷不在本次范围**：`remainingText` 在前缀完全匹配但无剩余文本时返回整条回答，会让 qq/钉钉/企微（各自桥）在「正好停在断点」时重复发送。本次只在共享桥内用 `tailAlreadyDelivered` 规避，未改共享 helper 的对外语义（改它会把这 3 个渠道推入「发送空消息」的新路径）。
6. **未改的既有行为**：最终消息 `finish` 抛错后仍无条件回退 `sendText(visibleAnswer)`（共享桥 L1253 附近），与本轮给分段引入的「不确定不补发」策略不一致；它属既有行为、影响所有渠道，本次不动。
7. **段间「正在输入」的实现**：轮转分支用 `typingSession.start()`（`running=false` 时才生效，`running=true` 时是 no-op，因此不会把暂停态重新点亮），并在有 pending 提问/审批时跳过；`restartOn()` 因 `stop()` 已把 `running` 置 false 而无效（首轮检视发现）。
