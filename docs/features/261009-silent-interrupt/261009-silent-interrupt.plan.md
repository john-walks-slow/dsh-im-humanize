# 打断静默化（interrupt supersede）· 实施计划

日期：2026-10-09。基线：`@johnnren/dsh-im-humanize` 4.21.2-humanize.3（HEAD `0a4e28b`）。

用户诉求（原话）：

> 现在就是不是有一个选项可以发第二句话的时候把第一句话打断嘛。但现在打断的时候，我是希望那个用户感知不到那个打断的，但现在的话，telegram 它就会发一条"已中断。"不希望有那一条

线上配置 `~/.dsh/integrations/dsh-im/humanize.json`：`streaming=true`、`messageBreak=true`、`onNewMessage=interrupt`、`progressStatus=false`、`statusReaction=false`、`sendDelay.enabled=false`。

---

## 1. 现状核实（源码事实，非推断）

### 1.1 那条提示的实际文案

用户口中的"已中断。"在代码里是 **`已停止。`**（`src/channels/shared/text-harness-bridge.mjs:1382`，i18n key `已停止。`→`Stopped.`）。全仓库（含构建产物 `lib/index.js` 的反解码）不存在 `已中断。` 字面量；含"中断"的宿主文案只有"任务被意外中断，本次未完成。请重试。"（异常失败路径）。因此本次要消除的是 interrupt 触发的 `已停止。` 气泡。

### 1.2 interrupt 的完整链路（当前行为）

| 步骤 | 位置 | 事实 |
|---|---|---|
| ① 新消息到达，判定策略 | `text-harness-bridge.mjs:461-469` | `resolveNewMessagePolicy` 返回 `interrupt` → `#interruptAndResend` |
| ② 打断重发 | `text-harness-bridge.mjs:535-564` | 先 `#abortPreAskPhase(key)`，再把新回合串到旧回合队列之后，再 `fireAndForgetStop({session, control:{owner,key}})` |
| ③ 发起 stop | `new-message-policy.mjs:59-65` | 调 `session.stopActiveTurn(control, {signal})`（fire-and-forget） |
| ④ 标记 stop | `harness-client.mjs:1292-1330` | 找到该 owner+key 的活动 ownership，置 `ownership.stopRequested = true` |
| ⑤ 旧回合收敛 | `harness-client.mjs:1653-1666` | `stopRequested` 为真 → 直接 `throw turnStoppedError()`（`code='turn-stopped'`，`harness-client.mjs:237-241`） |
| ⑥ 发提示 | `text-harness-bridge.mjs:1366-1388` | `catch` 里 `turnStopped` 分支 → `await stream.finish(t('已停止。'))` |

`已停止。` 是**持久消息**：Telegram 私聊走 Rich Draft 流，`finish` = `#sendRich` → `sendRichMessage`（`telegram-runtime.mjs:904-911`），草稿被提交成一条真实消息；群聊走占位消息 `finish` 发送新消息（`telegram-runtime.mjs:951-981`）。这就是用户看到的那一条。

### 1.3 为什么只有"阅读延迟窗口内"被静默了

`#abortPreAskPhase`（`text-harness-bridge.mjs:768-775`）只在该会话的 preAsk controller **仍在 map 里**时生效——它在镜像暂存结束的 `finally` 里就被删除（`1000-1067`）。用户 `sendDelay.enabled=false`，阅读延迟阶段几乎不存在，所以打断几乎总是落在"回合已进 Harness"之后，走 ④→⑥，于是必然出现 `已停止。`。

已有测试 `test/humanize-bridge.test.mjs:220-245` 覆盖的是阅读延迟窗口内的取代（静默），未覆盖 Harness 阶段。

### 1.4 发出「打断提示」的渠道清单

| 渠道 | 位置 | 提示形态 |
|---|---|---|
| Telegram / Discord / Slack / WhatsApp（共享桥） | `text-harness-bridge.mjs:1382` | `stream.finish('已停止。')` |
| QQ | `qq-bridge.mjs:1418-1430` | `sendText('已停止。')` |
| 钉钉 | `dingtalk-bridge.mjs:1676-1680` | `cardStream.finish('已停止。')` |
| 企业微信 | `wecom-bridge.mjs:1707-1719` | `replyStream(… '已停止。')` |
| 飞书 | `bridge.mjs:1427-1433` | 无文案（仅撤回处理中表情）——已静默 |
| 微信 / 企业微信应用 | `weixin-bridge.mjs:1117-1120`、`wecom-app-bridge.mjs:717-720` | 无文案——已静默 |

`/stop` 走的是另一条路（`control-command.mjs:65-90` → `stopActiveTurn`），产生同样的 `turn-stopped`。**现有设计明确要求 `/stop` 保留"已停止。"反馈**（`docs/issues/260918-no-reply-empty-reply-error/*` 的 S4）。因此不能简单删掉这条提示，必须区分两种 stop 来源。

---

## 2. 目标行为

1. **interrupt（新消息打断旧回合）**：旧回合**完全静默**——不发任何提示气泡、不清空新回合内容；新消息照常接管。旧回合已定稿的分段消息（message_break）与已产生的部分回答不受影响。
2. **显式 `/stop`**：行为不变，仍反馈 `已停止。`/`已请求停止当前任务。`。
3. 其余失败路径（网络、模型、空回复等）不变。

---

## 3. 方案设计

### 3.1 核心：给 stop 带上"来源原因"

不改动"是否停止"的判定，只让**停止原因**随 ownership 传到错误对象上，由各桥在发提示前判断：

1. `new-message-policy.mjs`
   - 新增 `export const SUPERSEDED_STOP_REASON = 'superseded';`
   - `fireAndForgetStop({ session, control, signal, reason, logger })` 把 `reason` 一并传进 `stopActiveTurn`。
2. `harness-client.mjs`
   - `stopActiveTurn(sessionId, control, options = {})`：解构出 `reason`，其余（`signal`）原样转给 `#refreshControlOwnership`/`rpc`（避免把 `reason` 透传进 RPC 参数）；停止被接受时把 `ownership.stopReason = reason` 与 `stopRequested = true` 同 tick 写入。
   - `turnStoppedError(reason)` 增加 `error.stopReason = reason`；两处抛错点（`1666`、`1708`）改用 `ownership?.stopReason`。
3. 各桥的 interrupt 调用点补 `reason: SUPERSEDED_STOP_REASON`：
   `text-harness-bridge.mjs:557`、`feishu/bridge.mjs:1266`、`qq-bridge.mjs:728`、`dingtalk-bridge.mjs:884`、`wecom-bridge.mjs:1088`、`weixin-bridge.mjs:581`。
4. 各桥的 `turn-stopped` 分支：`error.stopReason === 'superseded'` 时**跳过提示**，其余清理动作（撤回表情、`stream.cancel()`、`markSeen`、批量输入 complete）保留。
   - 共享桥：新增 `isSupersededStop(error)`（放 `new-message-policy.mjs`，与 reason 常量同处）判断，`1382` 的 `stream.finish('已停止。')` 改为走"静默 cancel"分支（与既有 preAsk supersede 分支一致的收尾：`statusReaction.clear()` + `stream?.cancel?.()`）。
   - QQ / 钉钉 / 企微：同判断，跳过各自的 `已停止。` 发送/定稿。
   - 飞书 / 微信 / 企微应用：无文案，无需改动（判断加了也无害，为一致性可选加）。

### 3.2 载体收尾的取舍（重要）

- **Telegram 私聊**：载体是 30 秒 ephemeral Rich Draft；`cancel()` 不发任何网络请求，草稿会自然过期或被子后续新草稿覆盖 → 用户感知不到打断。（依据：`docs/issues/260918-telegram-rich-draft-orphan` 已确认"无显式清除 draft 的 API"，draft 生命周期短。）
- **Telegram 群聊 / Discord / Slack / WhatsApp**：`cancel()` 会留下已创建的占位/部分消息，不做删除（`editable-message-stream.mjs:119-128` 注释明确"无 removal API"）。这与**现有 preAsk supersede 分支的收尾语义完全一致**，不引入新的问题类别；且 messageBreak 开启时正文已在断点定稿成独立消息，残留的只是尾部未定稿内容。
- 不采用"把 `已停止。` 换成更短文案"的方案：用户的诉求是**感知不到**，换文案只是换了个可见标记。

### 3.3 实施修订（检视后）

钉钉 AI 卡片流 `createDingTalkCardStream` **没有 `cancel()`**（`dingtalk-card-stream.mjs:234-241` 的冻结对象只有 `start/push/finish/providerMessageIds`），仅 `cancel()` 会让卡片永远停在流式态（比原「已停止。」更显眼）。因此钉钉改为：桥内留存最后一次 `push` 的卡片文本（`lastCardText`），superseded 时 `cardStream.finish(lastCardText)`——卡片按最后内容正常收尾，不出现「已停止。」。企微同理改为发送空内容关闭 stream。

**渠道差异（需知情）**：共享桥（Telegram 私聊/群聊、Discord、Slack、WhatsApp）superseded 时只是 `stream.cancel()`（丢弃未定稿的尾部，草稿过期/被新载体覆盖）；钉钉因无取消 API，改为**用最后内容定稿**（卡片保留打断前的部分内容，正常退出流式态）。两者都不新增「打断提示」，但遗留物的可见性不同。

### 3.4 备选方案与放弃原因

- **桥本地标记（`#supersededKeys`）+ 在 catch 里判断**：能顺带覆盖"stop 未被接受、Harness 自己报 interrupted"的竞态，但标记与回合的配对存在串台风险（旧回合已正常结束 → 标记残留 → 误静默后续真实失败）。放弃，改用错误对象携带原因（精确且无状态残留）。
- **直接删除 `已停止。` 分支**：会一并抹掉 `/stop` 的既有反馈，违反既有设计。放弃。

---

## 4. 改动清单

| 文件 | 改动 |
|---|---|
| `src/channels/shared/new-message-policy.mjs` | `SUPERSEDED_STOP_REASON`、`isSupersededStop()`、`fireAndForgetStop` 透传 reason |
| `src/channels/shared/harness-client.mjs` | `stopActiveTurn` 记录 `ownership.stopReason`；`turnStoppedError(reason)`；两处抛错点带上 reason |
| `src/channels/shared/text-harness-bridge.mjs` | interrupt 传 reason；`turn-stopped` 分支按 reason 分流（静默 cancel） |
| `src/channels/feishu/bridge.mjs`、`qq/qq-bridge.mjs`、`dingtalk/dingtalk-bridge.mjs`、`wecom/wecom-bridge.mjs`、`weixin/weixin-bridge.mjs` | interrupt 传 reason；有文案的渠道按 reason 跳过提示 |
| `README.md` | interrupt 说明补一句"旧回合静默取消，不出现『已停止。』提示" |
| `test/…` | 见 §5 |

## 5. 测试计划（先划范围，只跑受影响文件）

1. `test/channels/shared/harness-control.test.mjs`：`stopActiveTurn` 带 reason 时，`ask` 以 `turn-stopped` 拒绝且 `error.stopReason === 'superseded'`；不带 reason 时 `stopReason` 为 undefined。
2. `test/channels/shared/text-harness-bridge.test.mjs`：现有 `a stopped shared-channel turn closes an opened stream…`（`:1310`）保持通过（无 reason → 仍 `finish('已停止。')`）；新增 `turn-stopped + stopReason='superseded'` → `finished` 为空、`cancelled === 1`、无 sendText。
3. `test/humanize-bridge.test.mjs`：新增"回合已进 Harness 后被新消息打断 → 不发任何文本、旧回合静默、新回合正常回答"的端到端（fake harness 在 `stopActiveTurn` 被调用时以 `turn-stopped(superseded)` 收敛）。
4. 渠道粒度：QQ / 钉钉 / 企微各补 1 条"superseded 不发提示"的用例（复用现有 `已停止。` 用例的 fixture；`test/channels/qq/bridge.test.mjs:1185`、`wecom/bridge.test.mjs:606` 附近）。
5. 执行：仅跑上述 4 个文件 + telegram 相关（`test/channels/telegram/*`），不无差别全量。

## 6. 风险与开放决策

- **R1（竞态）**：打断到达时 `stopActiveTurn` 未被接受（回合已结束/尚未登记 ownership）→ 不置 reason，旧回合按原路径收敛，不会误静默。
- **R2（竞态）**：stop 未被接受、Harness 自己以 interrupted 结束 → 仍会发"任务被意外中断…"。概率极低，本方案不处理（见 §3.4）。如需一并静默，需要桥本地标记，请用户裁决。
- **R3（残留载体）**：Discord/Slack/群聊可能留下占位消息（与既有 preAsk supersede 行为一致）。若用户希望进一步处理，需要各渠道单独评估删除 API。
- **R4（范围）**：本次一并修 QQ/钉钉/企微；若用户希望只改 Telegram，可缩小改动半径。
