# 检视报告 — no_reply 轮次被误报为 MODEL_EMPTY_REPLY（260918）

## 概要

检视范围：`src/channels/shared/harness-client.mjs`、`src/channels/shared/text-harness-bridge.mjs`、`src/channels/{qq,dingtalk,wecom,weixin,wecom-app,feishu}/*-bridge.mjs`、`plugin-src/host/session-sync-coordinator.mjs` 与对应测试。

整体评价：核心契约 `ask() 返回 '' = 主动静默` 与 session-sync 双 flag 设计严谨，所有 13 个文件改动与 4 个新测试一致；troubleshoot 文档与代码注释清楚。但飞书「原生流式路径」与「分步直推路径」存在两处 silent 分支缺失/无效，会让流式卡片与已直推的 step 消息在 no_reply 后残留在用户 IM 上；与设计意图「narrated text stays silent」冲突。

## 需求对齐

需求「no_reply 显式静默不该算报错」已满足：
- `tracker.noReply` 已在 completed 分支返回 `''`，跳过 `model-empty-response` 抛错（`harness-client.mjs:1661-1668`）。
- 7 个 bridge 静默分支均新增，artifacts=0 时返回中性结果或清理流式占位。
- `session-sync-coordinator.mjs` 双 flag 正确区分「wake reclaim 软约定」与「任意 origin 的 no_reply」语义；新测试覆盖 wake / dsh 两条路径。
- 测试新增覆盖 harness-reply-tracker（+2）、harness-control（+2）、session-sync-coordinator（+2），全部通过。
- 全量测试定向运行 44/44 pass；现存 feishu / lark SDK flaky（2 fail + 多 cancelled）与本变更无关。

## 阻塞问题

无。

## 建议修改

| ID | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| S1 | `src/channels/feishu/bridge.mjs:5564-5570`（与 `feishu-channel.mjs:288-303`） | 原生流式路径的 silent 分支调用 `controller.setContent('')`。`feishu-channel.mjs` 第 294 行有 `if (visible === '') return;` 的早退——空内容视作「重放快照」，不会写卡也不会关闭卡。因此先前 `setContent(progressText)` 推送的草稿（包含 `正在生成…` 占位或已直推文本）原封不动残留为用户可见的卡片，与「Close the card quietly with empty content」的注释意图不符。 | 在 `feishu-channel.mjs` 的 controller 暴露 `abort()` / `recall()`（复用现有 `this.#recall(card.messageId)`），或在 bridge 的 silent 分支改为调 controller 上新增的方法把活动卡片撤回/清空；最简方案是给 controller 增加 `abort: () => enqueue(async () => cards.forEach(c => this.#recall(c.messageId)))`。测试上需补一条：tool 流推送一次 progress 后再调 no_reply，断言卡片被撤回。 |
| S2 | `src/channels/feishu/bridge.mjs:4998-5349`（`#answerWithStepPush`） | 分步直推模式（`humanize.stepPush === true`）完全没有 silent 分支。当模型在 step push 模式下调用 no_reply 且之前已直推工具/笔记 step 时，`pendingStep.text`（最终步骤缓冲）或 `#sendStepMessage` 已发出的步骤消息不会被回收——用户会看到完整的步骤记录加 `completed` 状态卡。 | 在 `markAskComplete()` 之后、line 5216 之前加一道 silent 分支：当 `tracker.noReply` 可达（需 `askInWorkspaceSession` 透出该信号，目前 `completed.answer === ''` + `completedArtifacts.length === 0` 已是等价判定）且 `pendingStep` 为空、buffer/已发送步骤也需撤回时，直接 stop watchdog + `recallPendingHeartbeats` + 返回 `{ receipt: null, artifactSendErrors: 0, textDeliveryErrors: 0 }`。 |
| S3 | `src/channels/shared/text-harness-bridge.mjs:1121-1125` | silent 分支调用 `stream.cancel()` 而非 `stream.finish('')`。`editable-message-stream.mjs:119-128` 明确「no removal API exists here」——`cancel` 不会删除已写出的占位/草稿，IM 端（主要是 Telegram）会留下「正在处理…」占位或已推送片段。design intent 是「narrated text stays silent」，但 draft 实际仍可见。 | 短期：在 `editable-message-stream.mjs` 增加 `dispose()`（调底层 `bot.deleteMessage(providerMessageId)`，仅在 caller 提供 `delete` 时启用），silent 分支改调 `stream.dispose?.()`。中期：把 silent 约定与「彻底撤回占位」契约化在 editable-message-stream 接口中。 |
| S4 | `src/channels/shared/harness-client.mjs:1658-1674` | `deliverArtifacts()` → `tracker.noReply` → `return ''` 的链路使 no_reply + stopRequested 组合下 artifacts 被静默丢弃：第 1658-1660 行在 stopRequested 时把 `artifactCount` 置 0 并跳过 deliver，但 no_reply 提前 return，artifacts 注册表里的产物从未被取走，仅在 `finally` 里 `outboundArtifactRegistry.discard(sessionId, tracker.turn)` 回收。模型产物（已 `dsh_im_return_file` 出来的文件）会丢失，用户既看不到消息也拿不到文件。 | 调整顺序或在 stopRequested 分支保留 `deliverArtifacts()`：将第 1661-1668 行的 `if (tracker.noReply) return '';` 移到 `deliverArtifacts` 调用之前，并在 stopRequested + no_reply 时也允许把已注册的 artifacts 投递（保持现有 stop 文本拒绝抛错的语义）。或者为 stopRequested 引入「artifact-only」的静默分支显式返回。 |
| S5 | `src/channels/qq/qq-bridge.mjs:1343-1346` 等 | silent 分支未更新 `messagesReplied` 与 `lastReplyAt`，且 `batchInputs`/`queue` 清理路径依赖 `enqueue` 的 finally；目前 `batchSettled` 已在 line 1332 置位，但 `preAsk` 控制器的清理与 read delay 的 typing session 复位是否完整未在 silent 分支单独校验。silent 是显式路径，建议补一行单测覆盖：`applyReadDelay` 后调用 silent，断言 typing 关闭 / preAsk controller 已 delete。 | 在 silent 分支显式 `preAsk?.abort(new DOMException('silent close', 'AbortError'))`、`typingSession?.stop?.()`，并加 1 个单测验证 silent 路径下 read-delay controller 不残留。 |
| S6 | `src/channels/dingtalk/dingtalk-bridge.mjs:1597-1605` | `cardStream.finish('')` 仅在 `cardStarted` 时关闭卡片；silent 分支未对 `statusReaction` 之外的状态（如 `rememberOutboundMessage`、turnEnds 时间戳）做收尾。troubleshoot 未点明，但与非 silent 路径对比，silent 路径跳过 `this.#state.rememberOutboundMessage?.(...)` —— 如果产品逻辑后续依赖该记录，会出现 dsh 镜像轮次无对应 outbound message。 | silent 分支显式 `await this.#state.rememberOutboundMessage?.({ conversationKey: key, text: '', sentAt: Date.now(), completedAt: Date.now(), providerMessageIds: [] })`，或注释明示「silent turn 不入 outbound history」。 |
| S7 | `src/channels/feishu/bridge.mjs:5461 / 5645` | 两处 silent 分支返回 `{ receipt: null, artifactSendErrors: 0, textDeliveryErrors: 0 }`。外层 `processInboundReply` 解构这个返回（line 1688-1701）后 `this.#status.messagesReplied += 1; this.#status.lastReplyAt = ...; this.#status.lastError = null;`——silent turn 也会被记为「已回复」。与 session-sync 的「dsh mirror 静默」思路类似，建议至少 `lastReplyAt` 不被改写。 | 在外层 1688-1707 加 `if (receipt !== null) { messagesReplied++; lastReplyAt = ... }`，或在 bridge 静默返回值里加 `{ silent: true }` 标记供调用方分支。 |

## 非阻塞问题

| ID | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| N1 | `plugin-src/host/session-sync-coordinator.mjs:152-154` | `tool/call` 与 `tool/code-dispatch-start` 的 silent/reclaimed 判定只看 `name`，未校验 `event.data?.turn === state.turn` 之外的来源合法性（除 turn 比较外）。如果 dsh 轮次里因 misconfig 把 no_reply 的 tool/call 投到了别人 reply key，coordinator 当前不会标记 silent。 | 已有 turn 校验即可，但可考虑加一则单测：错配 turn + tool/call no_reply 不会把别人的 turn 静音。 |
| N2 | `src/channels/shared/harness-client.mjs:670-675` | `tool/result` 的 `toolName` 查找走「callId → #toolNames → #lastToolName」fallback。若 harness 把 `tool/result` 排在 `tool/call` 之前到达（例如合并上报），`#lastToolName` 仍是上一次的 `MESSAGE_BREAK_TOOL`/`NO_REPLY_TOOL`，可能误抑制。属现有逻辑，不是本次引入，但值得记一笔。 | 后续若出现「progress 误抑制」类问题，考虑把 #toolNames 改为「callId → toolName map + LRU」，并在 tool/call 缺失时显式警告。 |
| N3 | `src/channels/feishu/bridge.mjs:5564` 与 `src/channels/feishu/bridge.mjs:5460 / 5644` 三处 | 三处 silent 判定都使用 `!String(answer ?? '').trim() && artifacts.length === 0`，与 `text-harness-bridge` 用 `cleanText(answer)` 不一致；功能等价，但 `cleanText` 已是统一 helper，建议改用 helper 以减少未来分叉。 | 把 silent 判定抽到 `src/channels/shared/answer-empty.mjs` 或 `harness-client.mjs` 顶部统一 helper。 |
| N4 | `docs/issues/260918-no-reply-empty-reply-error/260918-no-reply-empty-reply-error.troubleshoot.md:39` | troubleshoot 文档明确 `feishu 原生流式路径 → setContent('')`，但 `setContent('')` 在 `feishu-channel.mjs:294` 实际是 no-op。文档与实现不一致，会误导后续维护者。 | 修正 troubleshoot，或在 silent 分支真正实现「关闭卡片」后再保留文档现状（前者更稳妥）。 |
| N5 | `src/channels/office/office-job-executor.mjs:228-242` | 模型在 Office Job 里也能调用 no_reply，`resultMarkdown` 会是空字符串并照实上报。troubleshoot 明确「不面向聊天用户，不改」，但「空 resultMarkdown + status=completed」会让调度方误判成功且无产物。建议至少给 transport 端打个 tag（如 `silent: true`）便于上游过滤。 | 在 `completeJob` payload 加 `{ silent: true }`，上层 transport 决定是否要补一条「已完成（无产物）」记录。 |
| N6 | `src/channels/shared/harness-client.mjs:1658-1674` | `tracker.noReply` 在 `deliverArtifacts()` 之后才被检查，artifacts 已投递；同时也意味着 silent 路径下 artifacts 的错误处理沿用了普通路径——例如某个 artifact 失败时只在 console.warn 打印，bridge 不会感知。 | 把 deliverArtifacts 的失败统计回写到 tracker，让 bridge 可决定 silent turn 是否仍要回报「部分 artifact 失败」。属后续增强，非阻塞。 |
| N7 | `src/channels/shared/harness-client.mjs:632-633` | `tool/call` 收到 `no_reply` 时，`#toolNames.set(callId, 'no_reply')` 和 `#lastToolName = 'no_reply'` 被写入。后续如果另一个工具的 `tool/result` 走 `#lastToolName` fallback，会被误抑制。属既有逻辑但本次把 `no_reply` 加进 map 之后影响面更大。 | 复现/回归测试覆盖：no_reply 后再来一条普通 tool/call 的 tool/result，断言进度正常上报。 |

## 准入结论

**结论**：`条件准入`

**说明**：核心契约、测试覆盖、coordinator 双 flag 设计扎实；定向 44/44 测试 pass；全量 flaky 基线（2 fail + 多 cancelled）与本次无关。无阻塞问题。

但建议在合并前至少处理 **S1**（feishu 原生流式路径的卡片残留）和 **S4**（no_reply + stopRequested 时 artifacts 丢失），否则实际场景下用户会看到：
1. 飞书原生流式卡片在 no_reply 后仍带着「正在生成…」或已直推文本，对应 `MODEL_EMPTY_REPLY` 的修复语义未真正闭环；
2. 用户 /stop 命中 no_reply turn 时模型已 `dsh_im_return_file` 出来的产物被静默丢弃，与 troubleshoot 第 44 行的承诺不一致。

其余 S2/S3/S5/S6/S7 可在后续 PR 处理；非阻塞项可记入 backlog。

— 检视完成

## Maintainer 复核（检视后处置）

| ID | 处置 | 说明 |
| --- | ---- | ---- |
| S1 | **已修复**（方案与建议不同） | 检视所述机制有误：`setContent('')` 经 `String('') \|\| '…'`（feishu-channel.mjs:289）变为写 '…'，`visible === ''` 早退不会触发；且 `lastContent` 在早退前已更新（:291-292），markdown 回调返回后的终稿 enqueue（:307-323）无条件收卡——卡片不会残留「正在生成…」，但会残留 '…' 占位。按检视的真实诉求改为**真撤回**：`feishu-channel.mjs` controller 新增 `abort()`（撤回本轮全部流式卡片并置 aborted 标志，终稿 enqueue 跳过），bridge 静默分支改调 `controller.abort?.()`。新增 channel 层用例「aborts a silent turn by recalling every stream card」（recalls=[om-stream]、settings=0）。 |
| S4 | **已修复** | ask() finished 分支重排为：stop+保留文本 → 照旧返回文本（既有 stop-partial-answer 语义）；stopRequested → 抛 `turn-stopped`（保留「已中断」反馈，不再被 no_reply 静默吞掉）；之后才轮到 `tracker.noReply → return ''`（非 stop 轮静默胜过叙述文本不变）。新增 2 用例：stop+no_reply+无文本 → `turn-stopped`；stop+no_reply+有文本 → 文本照返。 |
| S2 | 后续 PR | step-push 直推的步骤消息属过程可见记录，no_reply 只承诺「最终答复静默」，步骤残留 + completed 收卡可接受；如需回收需给 `#sendStepMessage` 补撤回链路，涉及面大。 |
| S3 | 后续 PR | editable-message-stream.mjs:119-128 明示无移除 API；`dispose()`（deleteMessage）涉及 Telegram 删除权限与 48h 限制，单独评估。 |
| S5/S6/S7 | 后续 PR | 状态统计口径类建议（messagesReplied/lastReplyAt/rememberOutboundMessage），不影响正确性；统一在「状态统计与静默轮」专项处理。 |
| N1–N7 | 记录 | N4 已随 S1 修复同步更新 troubleshoot 文档；其余记入 backlog（N2/N7 为既有 fallback 逻辑，N3 判定 helper 统一、N5 office tag、N6 artifact 失败回传为增强）。 |

复核后定向测试：feishu-channel + harness-control + harness-reply-tracker + session-sync-coordinator + no-reply + message-failure 共 115/115 pass；`npm run build` 已重跑。

— 复核完成