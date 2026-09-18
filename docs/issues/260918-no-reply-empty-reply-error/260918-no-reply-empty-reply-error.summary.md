# no_reply 轮次被误报为 MODEL_EMPTY_REPLY（260918）修复总结

## 问题

模型在 IM 发起的轮次中显式调用 `no_reply`（静默结束）后，用户在 IM 收到失败通知：

> 模型没有返回可显示的内容。请重试；若持续发生，请切换模型。
> 错误码：MODEL_EMPTY_REPLY；参考号：MF-CB981031

根因：`HarnessClient.ask()` 把「completed + 无文本 + 无 artifacts」一律当作故障抛 `model-empty-response`，不感知 `no_reply` 的显式静默语义。

## 修复

约定 `ask()` 返回 `''` 且无 artifacts = 主动静默完成（此前该组合不可能出现，无歧义）：

1. **harness-client.mjs**：`HarnessReplyTracker` 记录 `no_reply` 调用（`noReply` getter），call/result 均跳过进度上报；`ask()` completed 分支按优先序返回：stop+保留文本 → stop 抛 `turn-stopped` → no_reply 静默返回 `''`（artifacts 已照常投递）→ 文本 → artifacts → 抛空回复错。无 no_reply 的真空回复仍抛错，保留故障可见性。
2. **7 个 bridge 静默分支**（answer 空且无 artifacts → 不发送、安静收尾）：text-harness-bridge、qq、dingtalk、wecom、weixin、wecom-app、feishu（纯文本/文本兜底 return 中性结果；原生流式路径 `controller.abort()` 撤回全部流式卡片）。
3. **session-sync-coordinator**：双 flag——`no_reply` 任意 origin 静音（wake/dsh 镜像整轮不投递）；`proactive_reclaim` 保持 wake-only 语义（dsh 来源轮 reclaim 必 misfire，回答照投，既有用例锁定）。
4. **feishu-channel.mjs**：controller 新增 `abort()`——撤回本轮全部流式卡片并跳过终稿写入，静默轮不留占位卡。

## 测试

- 新增 10 用例 + feishu channel 1 用例 + coordinator 2 用例：harness-reply-tracker（no_reply 置位与进度抑制）、harness-control（静默返回 ''、叙述文本抑制、stop+no_reply 优先级×2）、session-sync-coordinator（no_reply wake 静音、dsh 镜像静音保留用户回显）、feishu-channel（abort 撤卡）。
- 定向 115/115 pass；全量 3086 tests / 2880 pass / 2 fail / 203 cancelled，与预存 flaky 基线（3074/2868/2/203）一致，无回归。
- 检视：reviewer 条件准入，S1（feishu 卡片残留→真撤回）与 S4（stop+no_reply artifacts/反馈丢失→stop 优先）已修复并复核，详见 review.md。

## 文档

- `260918-no-reply-empty-reply-error.troubleshoot.md`：根因链、修复设计、边界确认。
- `260918-no-reply-empty-reply-error.review.md`：检视报告 + maintainer 复核处置。
- `260918-no-reply-empty-reply-error.validation.md`：用户验证项（需重启 dsh 后真机验证）。

## 生效

需重启 dsh（link 部署）。重启线上实例须先征得用户同意。
