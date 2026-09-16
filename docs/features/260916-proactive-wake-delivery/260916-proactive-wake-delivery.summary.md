# proactive 唤醒投递 · 实施总结（send_im 工具方案）

- **日期**：2026-09-16
- **范围**：dsh-im-humanize fork（上游 xmanrui/dsh-im v4.13.0）
- **状态**：已实施、已构建（方案 A 已 stash 暂缓）
- **计划**：[260916-proactive-wake-delivery.plan.md](./260916-proactive-wake-delivery.plan.md)
- **验证**：[260916-proactive-wake-delivery.validation.md](./260916-proactive-wake-delivery.validation.md)

## 结论

proactive 唤醒等「默认静默」回合的投递，最终采用 **`send_im` 模型工具**方案，不依赖双向同步开关。初版「唤醒回合经双向同步 coordinator 自动投递」已按用户反馈 stash 暂缓。

## 变更文件

| 文件 | 变更 |
| --- | --- |
| `src/channels/shared/im-send-tool.mjs`（新，128 行） | `send_im` 工具：`text` 必填、`botId`/`targetId` 可选；置空时用 `exec.agent.session.id` 反查绑定私聊自动投递，无会话/未绑定报错；提示词明确「仅非 dsh-im 发起的回合使用，dsh-im 发起的回合直接输出文本」 |
| `plugin-src/host/delivery-adapter.mjs` | 新增 `listSessionConversations(sessionId)`：反查 `state.sessions` 里绑定该 session 的私聊，仅 `direct:`/`p2p:` 私聊，构造 `{botId, target}` |
| `plugin-src/host/delivery-service.mjs` | 新增 `listSessionConversations(sessionId)`：聚合所有 adapter，标注 channel，`draftTargetObject` 校验 target |
| `plugin-src/host/index.mjs` | `resolveBoundTargets` 闭包包 `deliveryService.listSessionConversations`，两处注册点传入 `installImSendTool` |
| `test/im-send-tool.test.mjs` | 7 用例（显式投递、错误码、置空自动找绑定、无绑定/无会话报错、半显式拒绝、安装注册） |
| `test/delivery-adapter.test.mjs` | +2 用例（绑定私聊反查排除群聊、state 读取失败跳过） |
| `test/delivery-service.test.mjs` | +1 用例（聚合 + target 校验） |
| `lib/index.js` | 重建（host bundle） |
| `README.md` | fork 差异表 send_im 行更新（botId/targetId 可省略自动找绑定），删除「唤醒回合同步投递」行 |
| `docs/方案/…双向同步方案.md` | §8.2 矩阵 plugin 行改「默认忽略」；§8.3 重写为 send_im 工具方案 |

## 暂缓（stash `proactive-wake-delivery 暂缓`）

`plugin-src/host/session-sync-coordinator.mjs` 与 `test/session-sync-coordinator.test.mjs` 的 wake 改动（初版「唤醒回合经双向同步 coordinator 自动投递」）。后续如需无模型参与的自动投递，可基于 `listSessionConversations` 在 wake 回合结束时自动投绑定私聊。

## 测试与构建

- `im-send-tool` 7/7、`delivery-adapter` +2、`delivery-service` +1 全绿；相关回归 45/46。
- 唯一失败：`test/host.test.mjs` 缺 `progressStatus` 期望键——260915 progressStatus 功能的遗留测试漂移，与本次改动无关（未触碰 humanize/host.test）。

## 生效条件

需重启 dsh 加载新构建产物（restart-dsh 流程：先单独端口验证，重启线上前征得用户书面同意）。
