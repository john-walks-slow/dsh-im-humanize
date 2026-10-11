# dsh_im_return_file 在非 IM 会话（Web/GUI）里被当成交付入口

- 日期：2026-10-10
- 现象来源：用户实机报告 —— Agent 在非 IM 会话里需要交付文件/图片时反复调用 `dsh_im_return_file`
- 上游对应：xmanrui/dsh-im `43fd516`（fix(outbound): require active IM ownership for file returns，issue #286 / PR #290），fork 基线 4.21.2 早于该提交

## 现象

在 DSH Web GUI 这类**没有 IM 绑定**的会话里，模型仍然把 `dsh_im_return_file` 当作「把文件交给用户」的手段，调用后只拿到一条「Registered ... for IM delivery」的成功结果，而文件**永远不会到达任何地方**（用户看不到、也没有失败提示）。

## 根因链

1. `installOutboundArtifactTool()`（`src/channels/shared/semantic/artifact.mjs`）在 Host 启动时**全局**注册 `dsh_im_return_file`，并用 `ctx.systemPrompt.section()` 全局写入引导文案：
   > When the user asks to receive a file or generated image, call dsh_im_return_file with its path.
   该文案出现在**每一个**会话的系统提示里（Web/GUI/CLI 一样），上游当初的设计意图是「首个 IM Turn 即可用，不设开关」。
2. 产物真正被取走的路径只有一条：`HarnessClient.ask()` 里 `onArtifact` → `outboundArtifactRegistry.take()`（`src/channels/shared/harness-client.mjs`）。只有渠道 bridge 的 ask 会传 `onArtifact`；GUI 直接 `session.prompt`、session-sync 的 `dsh`/`wake` 投递都没有产物通道。
3. `OutboundArtifactRegistry.stage()` 只校验「有活跃 Session + Turn」，**不校验本回合是否存在可取走产物的消费者**，因此在 Web 会话里注册成功、提交进 `#turns`，随后无人 claim，最终被 `discard()` 静默回收。
4. `session-sync-coordinator` 只投递**文本**（`assistant/message`），从不 take 产物，所以即便是 IM 绑定会话，只要该回合是 GUI 输入（`origin === 'dsh'`）或 wake 回合，产物同样是静默黑洞。

## 修复设计（移植上游 43fd516，保留 fork 的 `as` 呈现模式）

核心：**「有能力交付的消费者」= 本会话本回合存在活跃的 IM 消费绑定**，引导文案与工具准入都以此为准。

1. **消费者判定**（`OutboundArtifactRegistry`）
   - 新增 `#consumerForTurn(sessionId, turn)`：consumer 未释放、`consumer.turn === turn`、且仍登记在 `#consumersByPrompt` 里才算活跃。
   - 新增 `hasActiveConsumer(session)`：当前回合是否有活跃消费者（供提示词判定）。
   - 新增 `observeClaimedMessage(session, message, turn)`：监听 `agent/inbox/claimed`，在 **prompt 组装之前**把 consumer 绑到回合（首个 `user/message` 事件来得太晚，赶不上第一步的提示词组装）。
   - `observeSessionEvent()` 增加 `#currentTurn()` / turn-end 清理：轮次结束时若无人认领，丢弃并告警（仅在实际丢弃了产物时 warning）。
2. **准入**（`stage()`）
   - 无活跃消费者 → 抛 `artifact-consumer-required`，消息含「not queued」与「use the host present tool」。
   - 快照复制/哈希完成后**再校验一次**消费者（复制期间可能被 abort / dispose / turn-end / 换回合），失败时删掉快照，保证不留孤儿文件。
3. **提示面**
   - 引导从全局 `systemPrompt.section` 改为 `systemPrompt.context`，`text: (assembly) => registry.hasActiveConsumer(assembly?.agent?.session) ? <原文案> : ''`——非 IM 回合贡献空串（渲染时丢弃），模型看不到「调 dsh_im_return_file」的指令。
   - 工具描述改写：明确「Requires an active IM delivery consumer; in Web, Desktop, or CLI conversations use the host present tool if available」。
4. **消费者登记面**（`harness-client.mjs`）
   - 只有传了 `onArtifact` 的 ask 才 `openConsumer()`（否则登记一个永远无人认领的消费者，反而让 Web/GUI 回合看起来「可交付」）。

## 影响面

- IM 渠道正常回合（bridge ask + onArtifact）：行为不变，产物照旧投递。
- Web/GUI 会话、IM 绑定会话的 GUI 输入回合与 wake 回合：引导不再出现，误调会得到明确报错而不是静默黑洞（这些路径此前也**从未真正投递过**产物，属把静默失败改为显式失败）。
- fork 特有：`as` 呈现模式（auto/file/image/animation/voice）与音频 MIME 映射保持不变；新的提示词函数里保留 `as` 的说明句。

## 测试

- 新增 `test/outbound-artifact-consumer.test.mjs`（7 条竞态：abort / 释放 consumer / dispose / clear / turn-end / 换回合 / 换 consumer，断言快照被清理）。
- 新增 `test/outbound-artifact-prompt.test.mjs`（引导只在被认领的当前回合出现）。
- `test/outbound-artifact.test.mjs` 改 fixture 增加 consumer；补 `artifact-consumer-required` 拒绝用例与 installer 契约用例。
- 渠道 `committedArtifact()` 辅助函数统一补 consumer 绑定（feishu/qq/wecom/weixin/whatsapp/dingtalk/telegram/text-harness-bridge/artifact-delivery）。
