# 分段流式（message_break × streaming）· 实施小结

日期：2026-10-09。计划：[261009-segmented-streaming.plan.md](261009-segmented-streaming.plan.md)；检视：[261009-segmented-streaming.review.md](261009-segmented-streaming.review.md)；用户验证：[261009-segmented-streaming.validation.md](261009-segmented-streaming.validation.md)。

## 起因

用户配置 `streaming=true` + `messageBreak=true` + `progressStatus=false`，反馈「好像没能流式」。核实：共享桥 `text-harness-bridge.mjs` 在 messageBreak 开启时直接丢弃 `text` 帧（原 L1073–1076），`progressStatus=false` 又丢弃 `tool/status`，于是流载体整轮收不到任何帧、草稿气泡从不创建——不是故障，而是当时设计（分步消息压制流式文本）的净效果。

用户选定方案：**分段 + 每段流式**。

## 改动

| 文件 | 内容 |
|---|---|
| `src/channels/shared/text-harness-bridge.mjs` | 开流抽成 `openReplyStream()`；新增 `finishSegment()`（结算当前段并落回执）/ `sendSegmentAsText()`；`sendSegment` 在流式下改为「结算当前段 → 重开新载体 → 重新武装心跳与输入状态」；删除 messageBreak 丢弃 `text` 的逻辑；尾部新增 `tailAlreadyDelivered` 判别；回执汇总全部分段；心跳抽成幂等 `startKeepalive()` |
| `src/channels/shared/message-break.mjs` | 头注释改写；新增 `segmentsCover(fullAnswer)`（与 `remainingText` 同一原始前缀规则 + 剩余为空，只有尾部可证明为空才抑制发送） |
| `plugin-src/client/channels/shared/humanize-fields.js`、`plugin-src/client/i18n.js` | 分步消息 hint 文案与中英词条同步 |
| `README.md`、`README.en.md` | 流式回复 / 分步消息 / 过程进度提示三处说明与速览表同步 |
| 测试 | 新增 `test/channels/shared/segmented-streaming.test.mjs`（11 例）；`progress-status.test.mjs` 一条用例升级；`message-break.test.mjs` 新增 `segmentsCover` 两例；`text-harness-bridge.test.mjs` 修正两处陈旧 tick |

关键设计点（详见计划 §3.3）：

- **只有「尾部可证明为空」才抑制发送**：`segmentsCover(baseAnswer) && !carrierStreamedText && !segmentDeliveryFailed`。前缀失配（canonical 改写、段尾空白）一律照旧发送整条——宁可重复也不丢内容。
- **不确定性不补发**：分段 `finish` 抛错先经 `channelDeliveryFailure()` 分类，只有 401/403/429 这类确定失败才 `sendText` 补发；其余按 `channel-delivery-uncertain` 处理（可能已落库，重复的伤害大于丢失）。
- **一段没确认送达就让尾部兜底**：`segmentDeliveryFailed` 会关闭尾部抑制，避免「最后一段发送失败 + 回复正好停在断点」时整轮静默。

## 验证

自动化（本次改动面，全部绿）：

- `progress-status` / `segmented-streaming` / `text-harness-bridge` / `message-break` / `humanize-bridge` / `humanize-standalone-bridges` / `humanize-settings` / `humanize-override` / `client-humanize-ui` / `client-ui` / `typing-session` = **209/209**。
- `test/channels/telegram/*.test.mjs` = 137/141；4 条失败在 HEAD 上同样失败（`git worktree` 复现确认），与本次无关。
- `npm run build` + `node scripts/verify-package.mjs` 通过；`lib/index.js` 冒烟 import 通过；未跑全量。

顺手修掉的既有问题：`text-harness-bridge.test.mjs` 两条 Telegram 草稿心跳用例自 48c1b84（keepalive 间隔改 5000ms）起就红，本轮改为 tick 5000ms。

**待用户实机验证**（需先重启 dsh）：见 [validation](261009-segmented-streaming.validation.md)。

## 检视结论

第 1 轮：**不准入**（阻塞 B1：客户端 i18n 词典未同步）。整改后第 2 轮：**条件准入**，唯一待办 R1（段间「正在输入」的 `restartOn()` 因 `stop()` 已把 `running` 置 false 而失效）已在本轮改为带 pending 判定的 `typingSession.start()`，并补了覆盖用例；R2/R3、N1/N6/N9 一并处理。

## 遗留

- Slack / Discord / WhatsApp 的分段轮转未实机验证（结构与 Telegram 一致，首轮验收只看 Telegram）。
- 共享桥默认 `progressMode:'latest'`（每 300ms 只投最后一条更新）：极端情况下 `message_break` 会被同批次的后续事件挤掉，该段随尾部消息发出（不丢内容，但草稿会跳变）。
- qq / 钉钉 / 企微的自建桥仍保留「正好停在断点会重复发整条」的旧缺陷（本次不改共享 helper 语义，避免把它们推入「发送空消息」路径）。
- 最终消息 `finish` 抛错后仍无条件回退 `sendText`（既有行为，影响所有渠道，本次不动）。
- Telegram X 客户端渲染不了 Rich Message，实机验收必须用官方客户端。
