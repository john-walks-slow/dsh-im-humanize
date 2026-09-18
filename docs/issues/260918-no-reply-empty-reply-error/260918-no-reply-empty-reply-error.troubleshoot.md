# no_reply 轮次被误报为 MODEL_EMPTY_REPLY

- 日期：2026-09-18
- 现象来源：用户实机报告（IM 内收到失败通知）

## 现象

模型在 IM 发起的轮次中显式调用 `no_reply` 工具（静默结束，不回复）后，用户收到失败通知：

```
模型没有返回可显示的内容。请重试；若持续发生，请切换模型。

错误码：MODEL_EMPTY_REPLY；参考号：MF-CB981031
```

## 根因链

1. `no_reply` 工具（`src/channels/shared/no-reply.mjs`）执行 `exec.concludeTurn()`，机械性结束轮次，不产生任何可见文本。
2. `HarnessReplyTracker`（`src/channels/shared/harness-client.mjs`）不感知 `no_reply`：turn/end reason 为 `completed`、`tracker.answer` 为空、无 artifacts。
3. `HarnessClient.ask()` 对「completed + 无文本 + 无 artifacts」一律 `throw harnessTurnError(reason)` → `HarnessTurnError('model-empty-response')`（harness-client.mjs ~L1651）。
4. bridge 侧 `classifyMessageFailure` 将其归类为 `MODEL_EMPTY_REPLY` 并把失败文案发给用户。

即：**no_reply 的显式静默语义从未进入 ask 流程的判定**，被当作「模型空回复故障」。该错误仅出现在 IM 入站消息路径（wake 轮由 session-sync-coordinator 投递，无文本时本就不投、也不发失败文案）。

## 修复设计

约定：`ask()` 返回 `''` 且无 artifacts = 主动静默完成（此前该组合不可能出现：completed 无文本必抛错，'' 必有 artifacts），以此作为 bridge 侧的静默信号。

1. **harness-client.mjs**
   - `HarnessReplyTracker` 记录 `no_reply` tool/call（`noReply` getter），并对 call/result 抑制进度上报（同 `message_break` 先例）。
   - `ask()`：completed 轮若 `tracker.noReply` → 返回 `''`（artifacts 已在 `deliverArtifacts()` 投递，不受影响）。no_reply 优先于轮内叙述文本（与 dsh-proactive reclaim「reclaim 胜过叙述文本」的既有软约定一致）；无 no_reply 的真空回复仍抛 `model-empty-response`。
   - **stop 优先级**：已接受的 `/stop` 胜过 no_reply——stopRequested 且无保留文本时仍抛 `turn-stopped`（保留「已中断」反馈，review S4）；stopRequested 且有部分文本时照旧返回文本（既有 stop-partial-answer 语义）。完整优先序：stop+文本 → stop 抛错 → no_reply 静默 → 文本 → artifacts → 抛空回复错。
2. **各 bridge**：`answer` 为空且无 artifacts → 静默完成：不发送任何文本/失败文案，安静收尾（清理状态反应、取消/关闭已打开的流式占位）。
   - text-harness-bridge：`statusReaction.clear()` + `stream.cancel()`（与 superseded 路径同款）。
   - qq：`stream.cancel()`（seen 已在 pre-ask 前标记）。
   - dingtalk：`cardStream.finish('')` 静默收卡 + 状态反应 clear。
   - wecom：流为懒打开/预打开两态；已打开则 `replyStream(frame, streamId, '', true)` 收帧。
   - weixin：无占位，直接 return（seen 已标记）。
   - wecom-app：`finishStream` 收客户端流。
   - feishu：纯文本路径与文本兜底路径直接 return 中性结果 `{ receipt: null, artifactSendErrors: 0, textDeliveryErrors: 0 }`（调用方解构该形状）；原生流式路径调用 `controller.abort()`——channel 侧新增的静默收尾：撤回本轮全部流式卡片（含占位卡）并跳过终稿分段写入（review S1：`setContent('')` 会被 `String('') || '…'` 变成写入 '…' 占位，不是真撤回）。
3. **session-sync-coordinator**：`no_reply` 单独静音（wake 与 dsh 镜像轮次均不投递含叙述文本的整轮内容）；`proactive_reclaim` 保持既有语义——仅 wake 轮静音（dsh 来源轮次中该工具并未提供、调用必然 misfire，回答必须照常投递，见既有用例「Session sync still delivers dsh-origin replies that misfire the reclaim tool」）。

## 边界确认

- `dsh_im_return_file` + `no_reply`：artifacts 在 ask() 内照常投递；bridge 侧因 `artifacts.length > 0` 走原文件完成路径。
- `/stop` 与 no_reply 并存：已接受的 `/stop` 胜过 no_reply——无保留文本时仍抛 `turn-stopped`（保留「已中断」反馈），有部分文本时照旧返回文本（既有 stop-partial-answer 语义，review S4）。
- office-job-executor 直连 `harness.ask`：headless 任务，`''` 作为 resultMarkdown 如实上报，不面向聊天用户，不改。
- 无 no_reply 的真实空回复（模型故障）：仍抛 `model-empty-response` → 用户仍收到 MODEL_EMPTY_REPLY 提示（保留故障可见性）。
