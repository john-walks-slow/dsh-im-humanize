# return-file-im-ownership 实施总结

- 日期：2026-10-10
- 类型：问题修复（移植上游修复）
- 上游来源：xmanrui/dsh-im `43fd516`（issue #286 / PR #290）
- 检视结论：准入（[review](261010-return-file-im-ownership.review.md)）

## 做了什么

移植上游「require active IM ownership for file returns」到本 fork，并保留 humanize 定制：

- `OutboundArtifactRegistry` 引入「活跃 IM 投递消费者」判定：`#consumerForTurn()` / `hasActiveConsumer()` / `observeClaimedMessage()` / `#bindConsumer()`；`observeSessionEvent()` 支持 logger，turn/end 丢弃无人认领的产物并**仅在实际丢弃时**告警。
- `stage()` 准入 + 快照后复检：无消费者直接 `artifact-consumer-required`，竞态下删除已复制快照，不留孤儿文件。
- 引导文案由全局 `systemPrompt.section` 改为 `systemPrompt.context`，仅在 `hasActiveConsumer(assembly.agent.session)` 为真时贡献文本；工具描述明确「Requires an active IM delivery consumer; in Web, Desktop, or CLI conversations use the host present tool」。
- `harness-client.mjs`：只有传了 `onArtifact` 的 ask 才登记消费者。
- fork 定制保留：`as` 呈现模式（auto/file/image/animation/voice）、音频 MIME 映射、引导文案里的 `as` 说明句。

## 影响面

| 路径 | 修复前 | 修复后 |
| --- | --- | --- |
| IM 渠道 ask 回合 | 正常投递 | 不变 |
| Web/GUI/CLI 会话 | 引导误调 → 文件静默丢弃 | 无引导，误调显式报错并提示用 `present` |
| IM 绑定会话的 GUI 输入（`dsh` origin）/ wake 回合 | 同上（静默丢弃） | 显式拒绝；文本投递不变 |

## 验证证据

- 新增/改写用例：`test/outbound-artifact-consumer.test.mjs`（7 条快照竞态）、`test/outbound-artifact-prompt.test.mjs`（引导仅在受认领回合出现）、`test/outbound-artifact.test.mjs`（准入拒绝 + installer 契约）。
- 实跑（本机，未跑全量）：
  - `node --test test/outbound-artifact.test.mjs test/outbound-artifact-consumer.test.mjs test/outbound-artifact-prompt.test.mjs` → 42/42 pass
  - `node --test test/artifact-delivery.test.mjs test/channels/shared/harness-control.test.mjs test/channels/shared/text-harness-bridge.test.mjs` → 99/99 pass
  - `node --test test/channels/feishu/harness-client.test.mjs` → 24/24 pass
  - `node --test --test-concurrency=1 test/channels/dingtalk/dingtalk-bridge.test.mjs test/channels/feishu/bridge.test.mjs` → 353/353 pass
  - telegram/qq/wecom/weixin/whatsapp 批次：163 pass / 4 fail / 102 cancelled —— 在**未打补丁的 HEAD worktree 上跑同一批次得到逐条一致的失败集合**（106 条 `not ok` 完全一致），确认为本机既有环境噪声，非本次回归。
- `npm run build` 已重建 `lib/index.js`（`lib/client.js` 无变更）。

## 后续

1. **需要重启 dsh** 才能让新构建生效（link 部署直接加载 `lib/`）；重启需用户书面同意。
2. 用户实机验证见 [validation](261010-return-file-im-ownership.validation.md)（IM 附件回归 + Web 会话改用 present）。
3. 未纳入本次范围：`message_break` / `no_reply` / `send_im` 的同类「仅 IM 会话」门控（用户选择另开需求）。
4. 未纳入本次范围：让 session-sync 的 `dsh`/`wake` 回合也能认领产物（当前这些回合的附件此前也是静默丢弃）。
5. 待办：单独 worktree 合并上游 4.38（fork 与上游 4.21.2 相差 82 个提交、444 个文件；fork 侧 diverged 196 个文件）。
