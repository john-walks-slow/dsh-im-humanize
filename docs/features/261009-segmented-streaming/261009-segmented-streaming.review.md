# 检视报告 · 分段流式（message_break × streaming）

日期：2026-10-09　范围：`261009-segmented-streaming` 未提交改动（工作区）
基线：`main@48c1b84`；对照计划 `261009-segmented-streaming.plan.md`

> 本文件含两轮检视：第 1 轮（原始改动）与**第 2 轮复审（见文末「复审」节，2026-10-09 16:55）**。第 1 轮的结论与证据按时间原样保留；当前生效的准入结论以文末复审节为准。

## 概要

本次改动把「messageBreak 压制流式」改为「分段 + 每段流式」：断点处结算当前载体并重开新载体，尾部在最后一条流中定稿，并对「回复正好停在断点」新增 `tailAlreadyDelivered` 判别以避免重复发送整条回答。核心改造（`openReplyStream` / `finishSegment` / 轮转 / 回执汇总）逻辑自洽、可读，生命周期基本正确，`lib/` 构建产物已同步（已在 `lib/index.js` 中核实到新增日志字符串，`lib/client.js` 已含新 hint）。

发现 1 个阻塞问题（客户端 i18n 词典未同步，会让既有测试变红且英文界面回退中文），其余为建议/非阻塞项。

## 检视范围与方法

- 逐行核对：`src/channels/shared/text-harness-bridge.mjs`（diff 全量）、`src/channels/shared/message-break.mjs`、`plugin-src/client/channels/shared/humanize-fields.js`、`README.md` / `README.en.md`、`test/channels/shared/segmented-streaming.test.mjs` 与 3 个被改测试。
- 上游链路核实（判断语义是否成立）：`src/channels/shared/harness-client.mjs`（`#commitText` L544-556、`#segmentText` L558-566、`consumeAll` L568-686、`AssistantTextAccumulator` L362-399、`progressMode` 过滤 L1440/1640-1642）、`src/channels/shared/editable-message-stream.mjs`、`src/channels/telegram/telegram-runtime.mjs`（`openDeliveryStream` L890-984、`TelegramDeliveryStream` L428-545）、`src/channels/slack/slack-runtime.mjs` L231-300、`src/channels/shared/semantic/artifact-delivery.mjs`、`src/channels/shared/semantic/delivery.mjs`（`providerMessageIdsFor`）、`src/channels/shared/message-failure.mjs`（`channelDeliveryFailure` L217-229）。
- 已核实的关键事实（用于判定，非推断）：
  1. 共享桥走默认 `progressMode: 'latest'`，每个 300ms 批次只投最后一条更新，且 `assistant-message` 被过滤 → `onUpdate` 只会收到 `text`/`tool`/`status`/`message_break`（`harness-client.mjs:1640-1642`）。
  2. `text` 帧与 `message_break.text` 都是「上一个断点之后的相对文本」（`#commitText` L550-555、`#segmentText` L559-566）→ 转发进流与 `finish(segmentText)` 的语义一致，不产生半截内容。
  3. `AssistantTextAccumulator` 对每个 step 的文本做 `trim()`，step 之间以 `\n\n` 拼接，`tracker.answer` 再整体 `trim()`（L384-397、L524）→ 分段快照不会以空白结尾（对 S1 的判定很关键）。
  4. `lib/` 已重建（16:37），包含本次新增日志字符串与新 hint；`text-harness-bridge.test.mjs` 两处 `tick(4_000)→tick(5_000)` 与 `telegram-bridge.mjs:10` 的 `keepaliveIntervalMs: 5000`（HEAD 已提交）一致，HEAD 变红的说法成立。
  5. `plugin-src/client/i18n.js:1092` 仍是旧 hint 的词典项，新 hint（`humanize-fields.js:59`）**不在**词典中；`test/client-ui.test.mjs:1209-1227` 会遍历 `plugin-src/client/**` 的所有含汉字的字符串并断言都有英文投影。→ 见 B1。

## 需求对齐

- 需求（P1 分段 + 每段流式）已实现：`onUpdate` 删除了 messageBreak 丢弃 `text` 的逻辑（原 L1073-1076），断点处 `finishSegment` + `openReplyStream` 轮转，尾部在最后一条流中 `finish`。P2/P4/P5 语义未变，P3 通过 `tailAlreadyDelivered` 修掉了「正好停在断点会重复发整条」的旧缺陷（该修复对 `streaming=false` 路径同样生效）。
- 与计划的偏差：
  - 计划 §3.3 的判别式实现为 4 项合取，其中第 4 项在 fallback 分支恒真（S1），实际生效的只有 `!carrierStreamedText && prefixMatches`。
  - 计划 §3.5.3 / 验证清单第 4 条声称「用户回答后重开的流是干净对象，流式自然恢复」，但实现里只有**发生 message_break 轮转**才会新建载体；交互后若不再有断点，仍是同一个 `#previewStopped` 载体，其 `update()` 直接丢弃（`telegram-runtime.mjs:489`），直到最终 `finish` 才出现内容（S6）。
  - 文档/文案：README 与设置 hint 已同步；**客户端 i18n 词典未同步（B1）**。
- 过度设计/范围外：未发现明显过度设计；未擅自放宽 `progressMode`（计划 §3.5.5 的取舍合理）。`isVoicePresentation`（`text-harness-bridge.mjs:56,1314`）属同仓另一 agent 的语音改动，落在本次同样修改的文件中（N4）。

## 阻塞问题

| ID | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| B1 | `plugin-src/client/channels/shared/humanize-fields.js:59`；`plugin-src/client/i18n.js:1092`；约束测试 `test/client-ui.test.mjs:1209-1227` | 分步消息 hint 文案改了，但客户端 i18n 词典仍是旧键「…可与流式回复同时开启。」，新串（「…与「流式回复」同时开启时，每段各自逐字流式，断点处定稿为一条消息。」）在词典中不存在。后果有两处：① `test/client-ui.test.mjs` 的 `every shipped Chinese client string has an English projection` 会收集 `plugin-src/client/**` 中所有含汉字的字符串并断言英文投影，新串查不到 → 该用例变红（本次「已跑测试」列表里没有这个文件，`client-humanize-ui` 是另一个文件且不含该校验）；② 英文界面下该 hint 会原样显示中文（`localizeText` → 词典未命中 → 回退原串；`translateDynamic` 只覆盖数字/「跟随全局(…)」等模式，不覆盖此串）。 | 在 `plugin-src/client/i18n.js:1092` 用新串替换旧的键并补英文（建议保留原键亦可，但会留下死键）；英文建议：`The AI calls the message_break tool to insert breakpoints, sending each segment as a separate message. With streaming replies also on, each segment streams word by word and is finalized as its own message at the break.`。改完请单独重跑 `node --test test/client-ui.test.mjs` 复核（本次检视不执行测试）。 |

## 建议修改

| ID | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| S1 | `src/channels/shared/text-harness-bridge.mjs:1224-1227`；`src/channels/shared/message-break.mjs:125-136,148-153` | `tailAlreadyDelivered` 的第 4 项 `cleanText(visibleAnswer) === cleanText(baseAnswer)` 在 `remainingText` 走 fallback 时**恒为真**（fallback 返回的就是 `fullAnswer` 本身，`message-break.mjs:135`），因此该判别实际退化为 `hasBreaks && !carrierStreamedText && prefixMatches(baseAnswer)`。而 `prefixMatches` 用 **trim** 比较，比 `remainingText` 决定 fallback 用的 **未 trim** `startsWith` 更宽松：凡是「已发分段带尾空白、定稿回答无该空白」的输入，都会同时满足「走 fallback（剩余文本可能未被分段覆盖）」与「prefixMatches 为真」。此时唯一防线是 `carrierStreamedText`，而它在**根本没有载体**（`streaming=false` 的 P4 路径、iMessage 等无流载体渠道、轮转后 `openReplyStream()` 失败返回 null）或**尾部 text 帧被 `'latest'` 批处理吞掉**（计划 §8.1，progressStatus=false 时 tool/status 帧占满 `slice(-1)`）时必然为 false → 理论上会静默丢弃尾部内容。**可达性说明（重要）**：我按当前 `harness-client` 的产出逐条推演，`#segmentText()` 是 `#latestText`（每 step 已 trim）的后缀快照，因此已发前缀不会以空白结尾；而字符级改写造成的错配会让 `prefixMatches` 同时为假——即**在当前上游契约下我未能构造出真实可达的内容丢失路径**（重复方向则可达，见 N2/计划 §3.3 已接受）。但该守卫依赖上游「分段快照与定稿回答的差异只能是前缀」这一**未文档化不变量**，且 `message-break.mjs:148-153` 的注释本身声称支持「raw 分段带尾空白」，两者自相矛盾。 | 把判别改为「有正面证据表明分段已覆盖整条回答」，而不是从帧投递反推：例如在 handler 增加 `segmentsCover(fullAnswer)`（`cleanText(sentText) === cleanText(fullAnswer)`，或在未 trim 前缀成立时要求 `fullAnswer.substring(sentText.length).trim() === ''`），`tailAlreadyDelivered` 改为 `hasBreaks && !carrierStreamedText && handler.segmentsCover(baseAnswer)`；并补一条回归用例：`message_break` 文本为 `'第一段\n\n'`、定稿回答 `'第一段第二段'`（`streaming=false`）时**必须**发出第二段，同时保证现有 P3 用例（回答 `'第一段'`）仍然不重复发送。若团队判定该输入不可达，也建议补一条用例把该不变量钉住并写进注释。 |
| S2 | `src/channels/shared/text-harness-bridge.mjs:1091-1110`（心跳启动条件）、`:1162-1166`（`onInteraction` 内 `stopKeepalive()`）、`:898-928`（`openReplyStream` 不启动心跳） | keepalive 只在回合开始处按「**首个**载体」是否 `keepalive===true` 启动一次，之后靠闭包读可变的 `stream` 跟随轮转（这点是对的）。两个缺口：① 首个 `openReplyStream()` 返回 null（开流瞬时失败/无载体）而后续轮转成功打开 keepalive 载体（Telegram 私聊 Rich Draft）时，全程没有心跳；② 交互卡片到来时 `stopKeepalive()` 是单向的（`:1164`），此后即便发生轮转打开了新的 keepalive 载体，也不会再有心跳，长工具调用期间草稿可能过期。 | 把心跳启动抽成 `startKeepalive(active)`（内部保留 `stream?.refresh?.()` 的可变读取），在 `openReplyStream()` 拿到载体后按 `active.keepalive === true && typeof active.refresh === 'function'` 调用（幂等：已存在计时器则先清）；`onInteraction` 的暂停语义保持不变（可用一个 `previewPaused` 标记在交互期间不重启）。 |
| S3 | `src/channels/shared/text-harness-bridge.mjs:1156-1159`（首个 text 帧后 `typingSession.stop()`）、`:899-900`（`openReplyStream` 未重置 `firstStreamReplySent`）、对照文本分段路径 `:1059` | 流式分支里打字指示器在**首个**文本帧后停止且不再恢复（`firstStreamReplySent` 只置真、轮转不清零）。改造前 messageBreak 模式文本帧被丢弃，打字指示器会亮满整轮；改造后段与段之间的长静默（如断点后模型继续调用工具）既没有 typing、新草稿又是 lazy 未创建（`telegram-runtime.mjs:912-913` 注释），用户侧没有任何活动信号。 | 轮转时恢复活动信号：`openReplyStream()` 内 `firstStreamReplySent = false`，并在 `sendSegment` 的流式分支（`:1049-1052`）重置载体后调用 `typingSession?.restartOn?.()`（或在打开新载体且尚未收到任何帧时 `resume()`），让「新载体的首个文本帧」再次负责关闭 typing。该改动属体验层面，建议按实机观感决定是否采用。 |
| S4 | `src/channels/shared/text-harness-bridge.mjs:942-972`（`finishSegment` 的 try/catch 与 `deliveryOutcome==='failed'` 分支）、对照 `src/channels/shared/message-failure.mjs:217-229` | 计划 §3.5.2 声明「确定性失败才回补，`'unknown'` 不回补（防重复）」，但实现只对 `result.deliveryOutcome === 'failed'` 做了区分；`finish()` **抛错**时一律 `cancel()` + `sendSegmentAsText()` 补发（`:952-960`）。本仓约定是「抛出的投递错误默认按不确定处理」（`channelDeliveryFailure(error, { uncertain = true })` → `channel-delivery-uncertain`，`deferred-delivery-coordinator.mjs:167` 即按此判定），Telegram 侧 `sendRichMessage` 超时也可能在服务端已落库后抛错 → 该分段被重复发送。 | 在 catch 中先分类：`const failure = channelDeliveryFailure(error)`，仅当 `status === 401/403/429` 或 `code !== 'channel-delivery-uncertain'` 时补发文本；`channel-delivery-uncertain` 只记 warning（与 `'unknown'` 同策略）。测试用例 6（`onFinish → throw`）需相应改为「抛出一个被判定为确定失败的错误」才继续断言补发。 |
| S5 | `test/channels/shared/segmented-streaming.test.mjs:48-79`（`streamBot` 只实现 `openStream`） | 7 个新用例全部走 `openStream` 分支，而本特性的主验收场景是 Telegram 私聊 **Rich Draft = `openDeliveryStream`**：`semanticStream=true` 时 `finishSegment` 走 `active.finish(createTextDeliveryBlock(segmentText,'markdown'))`、尾部走 `createTextDeliveryBlock(visibleAnswer, answerFormat)`，这些块路径与 `semanticStream` 在轮转时的重算逻辑**零覆盖**；现存唯一 messageBreak 用例是 `test/humanize-bridge.test.mjs:490`（`streaming=false`）。 | 在 `streamBot` 增加 `openDeliveryStream`（记录 `finish:<block.text>` 并返回 `providerMessageIds`）或复用 `TelegramBotClient` stub，补 2 条用例：① `messageBreak+streaming` 私聊断点轮转 → 断言 `finish` 收到的是块且文本为分段文本；② 轮转后 `openDeliveryStream` 抛错 → 断言退化为文本路径且内容不丢。 |
| S6 | `text-harness-bridge.mjs:1162-1166`；计划 §3.5.3 与 §7 验证清单第 4 条 | 「用户回答后流式自然恢复」的说法与实现不符：`onInteraction` 只对**当前**载体调用 `stopPreview()`，而载体只有在 message_break 轮转时才会更换；交互后若模型不再调用 message_break，`stream.update()` 仍被 `#previewStopped` 丢弃，用户要等最终 `finish` 才看到内容。 | 文档侧：把 §3.5.3 与验证清单第 4 条改为「仅在交互后再次发生 message_break 轮转时才会出现新的流式载体」，避免实机验收时误判为缺陷；若要真正实现 P7 的「干净载体」，需在 `onInteractionResolved` 后主动轮转（本次不建议，属于新行为）。 |

## 非阻塞问题

| ID | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| N1 | `text-harness-bridge.mjs:961`（先 push 再判 `failed`）、`:1205-1208` | 被拒/失败的分段也会把载体与结果里的 `providerMessageIds` 记入 `segmentReceipts`，随后并入回合回执；Telegram 群聊路径同一 true 消息 id 会被 `providerMessageIdsFor(active)` 与 `providerMessageIdsFor(result)` 各取一次（`telegram-runtime.mjs:947,972-984`），回执出现重复 id。当前无消费方（各 channel runtime 均忽略 `accept()` 返回值、`plugin-src` 也没有读 `providerMessageIds`），影响仅为数据噪声。 | 把 push 挪到 `failed` 判定之后，或在汇总时对 id 去重（`[...new Set(...)]`）。 |
| N2 | `text-harness-bridge.mjs:1231-1236,1266-1272`；计划 §8.4 | 只有分段交付（`tailAlreadyDelivered` 或尾部为空）时 `textReceipt` 为 null：`delivery.userVisible` 随之为 false，`#status.messagesReplied` 不计数、`clearLastMessageFailure` 不执行，`deliveryOutcome` 也不聚合分段结果（分段失败只 warning）。与既有「全部文本已作为分段发出」路径一致，且成功反应由 promise 决议驱动（`:306-309`），不会漏 👍。 | 保持现状即可，建议在计划「已知取舍」里补一句：仅分段交付的回合不计入 `messagesReplied`。 |
| N3 | `src/channels/qq/qq-bridge.mjs:1249`、`src/channels/feishu/bridge.mjs:5093,5417`、`src/channels/dingtalk/dingtalk-bridge.mjs:1530` | `remainingText` 的对外语义未改，这 3 个自建桥在「回复正好停在断点」时仍会把整条回答再发一遍（本次只用 `tailAlreadyDelivered` 在共享桥内规避，计划 §8.5 已记录）。 | 无需本次处理；建议在 README 或计划里明确「分段流式/去重目前只覆盖共享桥的 5 个渠道」，避免用户按渠道推断。 |
| N4 | `text-harness-bridge.mjs:56,1314` | `isVoicePresentation` 的 import 与 `onArtifact` 改写属于同仓另一 agent 的「Telegram 语音消息」改动，却落在本次也修改的同一文件内。若按 hunk 提交（`commit-own-changes`），需确认这条 hunk 的归属，避免单方提交漏带（import 缺失会使桥启动即抛错）或误带。 | 提交前明确该 hunk 归属；或在计划/提交说明里记录「依赖 artifact-delivery.mjs 的 `isVoicePresentation`」。 |
| N5 | `harness-client.mjs:1640-1642`；计划 §8.1 | `'latest'` 批处理每批只投最后一条，断点后紧跟 tool/status 的批次会吞掉 `message_break`：此时该段文本随尾部一起由最终消息发出（内容不丢），但草稿会先显示相对文本再被最终消息覆盖（视觉跳变）。本次接受。 | 保持；若实机频发，可评估把该轮 `progressMode` 切到 `'all'` 或为共享桥单独实现「断点不丢」的批处理保留策略。 |
| N6 | `text-harness-bridge.mjs:1049-1067` | 流式分支 `return` 早于 `segmentsSent += 1`；若后续轮转失败落入文本分支，该段的拟人化分段间隔（`applySegmentGap`）会被跳过（因为 `segmentsSent === 0`）。 | 可在轮转成功时也递增一个「已交付分段数」用于间隔判定，或直接视为可接受并注释说明。 |

## 准入结论

**结论**：`不准入`

**说明**：功能实现与设计基本达成需求（P1–P5 语义正确、轮转与回执逻辑自洽、`lib/` 已重建），但 B1 使仓库既有测试 `test/client-ui.test.mjs`（i18n 全量覆盖断言）变红，且英文界面该 hint 会回退成中文——这属于「必须修复」的交付面缺陷（修复量为 1 行词典项 + 1 条英文文案）。

- 修复 B1 并单独重跑 `node --test test/client-ui.test.mjs`（本次检视不执行测试）后即可准入；S1–S6 可在合并前或紧随的迭代中处理，其中 S1（把 `tailAlreadyDelivered` 换成显式「分段覆盖整条回答」判定 + 回归用例）建议优先，因为它把一条静默内容丢失的理论通道换成可验证不变量；S4（不确定结果不该补发）与 S5（主验收路径 `openDeliveryStream` 零覆盖）建议同步处理。

---

# 复审（第 2 轮）

日期：2026-10-09 16:55　对象：第 1 轮 B1 / S1–S6 的修复（同一工作区，仍未提交）
方法：只读静态核对（diff + 调用链推演 + 构建产物与词典一致性检查）；**未执行任何测试**，也未修改源码。第 1 轮结论与证据保持原样。

## 复审概要

B1、S1、S2、S4、S5、N1 的修复均已落实且方向正确，其中 S1 的语义收紧（`segmentsCover` 沿用 `remainingText` 的原始前缀规则）**彻底移除了第 1 轮指出的「fallback 分支下第 4 条件恒真」隐患**——抑制现在只在「尾部可证明为空」时发生。`lib/` 已在 16:52 重建，含本轮全部改动（`lib/index.js` 出现 `unable to finalize a message_break segment (${...code})` 新模板、`lib/client.js` 含新中英 hint 且旧英文串已消失）。

本轮发现 1 项「修复未生效」需要处理（S3：`typingSession` 在首个流式帧后已 `stop()`，`restartOn()` 因 `running === false` 直接返回 → 段间「正在输入」实际未恢复，但代码注释与计划已声明会恢复），另有 2 项残留风险与 3 项非阻塞项；无阻塞问题。

## 逐项复核

| 轮次项 | 状态 | 证据与说明 |
| --- | --- | --- |
| B1 i18n | ✅ 已修复 | `plugin-src/client/i18n.js:1092` 已换成新串并补英文投影，旧键已删除（无死键）。新串已出现在 `lib/client.js`，旧英文串已消失。既满足 `test/client-ui.test.mjs:1209-1227` 的「每个中文串都要有英文投影」约束，也修掉了英文界面回退中文的问题。 |
| S1 `tailAlreadyDelivered` | ✅ 已修复（语义收紧，方向正确） | `message-break.mjs:144-152` 新增 `segmentsCover(fullAnswer)`：`breakCount>0 && sentText` 非空 + `fullAnswer.startsWith(sentText)`（与 `remainingText` 完全相同、**未 trim** 的规则）+ 剩余部分 `trim() === ''`。`text-harness-bridge.mjs:1239-1240` 的判别改为 `segmentsCover(baseAnswer) === true && !carrierStreamedText`。逐条推演确认：抑制仅在「尾部只剩余空白」时成立，凡前缀失配（段尾空白、canonical 改写）一律走 finish/sendText 整条发出 → 第 1 轮的静默丢失通道关闭。注释也不再声称支持 raw 尾空白，自相矛盾已消除。 |
| S1 副作用（需知悉） | ℹ️ 已接受 | 语义收紧后，「段尾空白 + 回复正好停在断点」不再抑制，会重复发送该段（`segmented-streaming.test.mjs:227-248` 明确断言 `finish:第一段第二段`）。与计划 §3.3「宁可重复也不丢」一致；且按 `harness-client.mjs:384-397` 的每-step `trim()` + 后缀快照，该输入在当前上游不可达，代价仅理论性。计划 §6 已同步为「不抑制」，图文一致。 |
| S2 keepalive | ✅ 已修复 | `text-harness-bridge.mjs:825-849` 抽出幂等 `startKeepalive(carrier)`（`keepaliveTimer !== null` 即返回，不叠计时器；闭包仍读可变 `stream`）；初始点 `:1130` 与轮转点 `:1087` 均调用 → 覆盖「首个载体开流失败、后续轮转成功」与「交互 drain 后下一次轮转重新武装」两种情况。 |
| S3 typing | ❌ **修复未生效** | 见下 R1。 |
| S4 不确定结果不补发 | ✅ 已修复 | `:970-983` catch 内改用 `channelDeliveryFailure(error)` 分类，仅 `code !== 'channel-delivery-uncertain'` 才 `sendSegmentAsText`。可达性核实：`telegram-api.mjs:581-583` 会写入 `error.status = response.status`（403/429 可被识别为确定失败），网络超时/无 status → uncertain → 不补发。测试补了「普通抛错不补发」与「403 才补发」两条，与实现一致。 |
| S5 语义载体覆盖 | 🟡 基本完成 | 新增 `semanticStreamBot()` 与用例（`segmented-streaming.test.mjs:84-113,250-270`），断言轮转后 `update/finish` 收到 markdown 块（即 `semanticStream` 重算正确）。仍缺第 1 轮建议的「轮转后 `openDeliveryStream` 抛错 → 退化为文本路径且内容不丢」用例（夹具无「开流失败」开关）→ 见 N9。 |
| N1 回执 | ✅ 已修复（部分） | `segmentReceipts.push` 已移到确定性失败判定之后（`:984`），失败/不确定载体不再进回执。Telegram 群聊路径同一 message id 被 `providerMessageIdsFor(active)` 与 `providerMessageIdsFor(result)` 各取一次导致的 id 重复仍在（既有行为，无消费方）。 |
| N6 分段间隔 | ✅ 已修复 | 轮转分支补 `segmentsSent += 1`（`:1082`），后续落回文本路径的分段能拿到 `applySegmentGap`。 |
| S6 / 计划 P7 措辞 | ✅ 已修复 | 计划 §3.5.3、P7 表格已改为「只有发生轮转才新建干净载体」；`text-harness-bridge.mjs:1182-1186` 实现与之一致。仅 §7 验证清单第 4 条残留旧措辞（N10）。 |

## 第 2 轮：建议修改

| ID | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| R1 | `src/channels/shared/text-harness-bridge.mjs:1086-1091`；`src/channels/shared/typing-session.mjs:282-292,332-336`；`:1176-1179` | S3 的实现无效：首个进流帧（text 或 progressStatus 开启时的 tool 帧）就会执行 `typingSession?.stop()`（`:1176-1179`），而 `stopSession()` 把 `running = false` 且不可逆；轮转分支随后调用的 `restartOn()` 首行即 `if (!running \|\| paused) return`（`typing-session.mjs:332-336`）→ **直接返回，段间打字指示器不会恢复**（`firstStreamReplySent = false` 只让后续帧再调一次同为空操作的 `stop()`）。因此当前行为与改造前一致，但 `:1086-1089` 的注释「keep the composing indicator alive」与计划 §3.5.3 / P7 表格「轮转会重开…输入状态」都成了不实声明。另：该分支无测试覆盖（所有夹具 `typingIndicator: 'off'` → `typingSession` 为 `null`，两种情况都不可见）。补充说明：Telegram 私聊（keepalive 载体）的心跳顺带每 5s 调 `sendTyping`，会在一定程度上掩盖该缺口；群聊与 Slack/Discord/WhatsApp 无心跳，缺口可见。 | 二选一：① 真正重启会话——把 `await typingSession?.restartOn()` 换成「未运行则启动」的形式，例如给 typing session 增加 `ensureStarted()`（`if (!running) { running = true; paused = false; await startOnPhase() }`），或桥内用 `if (typingSession && !typingSession.isActive() && !this.#pendingInteractions.has(conversationKey) && !this.#approvals.hasPending(conversationKey)) await typingSession.start()`（注意不要无脑用 `start()`：它会把 `paused` 置回 false，可能在提问卡片挂起期间点亮输入状态）；② 若判定「草稿本身就是活动信号」，则删掉这两行并同步修正注释与计划措辞，避免留死代码与假声明。无论哪种，建议补一条 `typingIndicator` 非 off 的流式轮转用例。 |
| R2 | `src/channels/shared/message-break.mjs:104-114`；`text-harness-bridge.mjs:1239-1240` | 残留的静默丢失通道：`segmentsCover` 只判断「文本上已覆盖」，不判断分段是否真的送达；`handleUpdate` 里 `sentText += rawText` 先于 `sendSegment`，且 `sendSegment` 抛错只 `logger.warn` 不上报。于是「最后一段结算失败（不确定失败且实际未落库，或文本路径 `sendText` 抛错）+ 回复正好停在断点」时，最终消息被抑制 → 该轮用户收不到任何内容。HEAD 下这种情形会由最终消息兜底重发整条（重复但内容可见），S1 的抑制逻辑移除了这个意外兜底。触发条件很窄（需分段发送失败且回复停在断点），但方向是「静默丢失」。 | 让 `sendSegment` 的失败可被感知：`handleUpdate` 中把 `sendSegment` 的异常/`false` 记为 `undelivered = true`，`segmentsCover` 在其为真时返回 false（宁可重复也不静默）；若团队判定过度设计（AGENTS.md「不做失败降级」倾向），至少在计划 §8 记录这条已知取舍。 |
| R3 | `src/channels/shared/text-harness-bridge.mjs:974-976` | `finishSegment` 的 catch 里 warning 文案固定为 `…; sending it as text:`，但 `channel-delivery-uncertain` 分支并不补发 → 日志与实际行为不符，排障时容易误判为「已补发」。 | 文案按分支区分（例如 uncertain 时写 `not re-sending (outcome uncertain)`，确定失败时写 `sending it as text`）。 |

## 第 2 轮：非阻塞问题

| ID | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| N7 | `text-harness-bridge.mjs:1253-1261`（尾部 `finish` 失败回退） | 分段路径已按「不确定不补发」分类（S4），但**最终一条**流的 `finish` 抛错时仍无条件 `cancel` 后走 `!streamFinished` 分支 `sendDelivery/sendText(visibleAnswer)` → 与分段路径策略不一致，超时后可能把最终消息重复发一遍。 | 若要与 S4 统一，可在该 catch 同样用 `channelDeliveryFailure(error)` 分类；否则至少在注释里说明「最终消息的重复优先于丢失」是有意选择。 |
| N8 | `text-harness-bridge.mjs:1086-1090` + 计划 §3.5.3 | 见 R1 的事实性不一致；此外 `stopKeepalive()` 在 `onInteraction` 处仍是一次性关闭（`:1184`），仅靠轮转重新武装——计划已明示，符合预期。 | 随 R1 一并处理文档/注释。 |
| N9 | `test/channels/shared/segmented-streaming.test.mjs:84-113` | `semanticStreamBot` 无「开流失败」开关，第 1 轮 S5 建议的「轮转后 `openDeliveryStream` 抛错 → 检验退化为文本路径且内容不丢」仍未覆盖（这条路径对应 `openReplyStream()` 的两个 return null 分支）。 | 给夹具加 `onOpen` 返回值/抛错开关，补 1 条用例。 |
| N10 | 计划 §7 验证清单第 4 条 | 仍写「回答后后续分段正常流式」，与已修正的 §3.5.3 不一致（只有再发生 `message_break` 轮转才会出现新载体）。 | 同步为「回答后若模型再次调用 message_break，则新分段照常流式」。 |

## 复审结论

**结论**：`条件准入`

**说明**：第 1 轮的阻塞项 B1 已修复且经静态核对成立（词典新串+英文投影齐备，构建产物已同步），S1 的收紧使「尾部可证明为空才抑制」成为可验证不变量，第 1 轮的静默丢失通道关闭；S2/S4/N1/N6 修复到位，S5 基本达成。本轮无阻塞问题。

- 合并前建议处理 R1（`typingSession` 重启无效：要么真正实现、要么删除死代码并修正注释与计划），它是本轮唯一「声明与实现不符」的点；R2（分段发送失败 + 回复停在断点时的静默丢失）建议至少记录为已知取舍或按「宁可重复」加固；R3/N7/N9/N10 属清理与文档同步，可在后续迭代处理。
- 实机验收口径请按已修正的 P7/§3.5.3 执行：**只有再次发生 `message_break` 轮转才会新建干净载体并恢复流式**。
