# 主动回合自动投递 · 实施总结

- **日期**：2026-09-16
- **范围**：dsh-im-humanize fork（上游 xmanrui/dsh-im v4.13.0）；配套 dsh-proactive（leak 移除）
- **状态**：已实施、已构建、已检视
- **计划**：[260916-proactive-wake-delivery.plan.md](./260916-proactive-wake-delivery.plan.md)
- **验证**：[260916-proactive-wake-delivery.validation.md](./260916-proactive-wake-delivery.validation.md)

## 结论

「agent 主动发起」的回合（proactive 唤醒、定时任务、后台子代理完成通知）的可见回复，最终由 **session-sync-coordinator 自动投递到当前 session 绑定的私聊**，原文无前缀，**不依赖双向同步开关**。`send_im` 工具降级为「显式投到非绑定目标」的补充手段。

演进：初版「依赖双向同步的自动投递」→ stash；「send_im 工具 + prompt 引导」→ 实测三个 agent 都不主动调 send_im，不可靠；最终「自动投递绑定私聊（方案 A'）」。

## 变更文件

### dsh-im-humanize（本 fork）

| 文件 | 变更 |
| --- | --- |
| `plugin-src/host/session-sync-coordinator.mjs` | 来源判定加 `plugin`（任意）+ `subagent-settled` → `wake`；`turn/end` 拆分——dsh 路径不变，wake 路径现查 `listSessionConversations` 后经 `deliveryService.send` 投递原文（无前缀） |
| `plugin-src/host/delivery-adapter.mjs` | 新增 `listSessionConversations(sessionId)`：反查 `state.sessions` 绑定该 session 的私聊，仅 `direct:`/`p2p:` 私聊，构造 `{botId, target}` |
| `plugin-src/host/delivery-service.mjs` | 新增 `listSessionConversations(sessionId)`：聚合所有 adapter，`draftTargetObject` 校验 target |
| `plugin-src/host/index.mjs` | `resolveBoundTargets` 闭包传入 `installImSendTool` |
| `src/channels/shared/im-send-tool.mjs`（新） | `send_im` 工具：`text` 必填、`botId`/`targetId` 可选；描述/system prompt 降级为「主动回合已自动投递，仅需显式投非绑定目标时用」 |
| `test/session-sync-coordinator.test.mjs` | +4 用例（proactive wake / subagent-settled 投绑定私聊原文、no-reply/failed/外来 plugin 不投、lookup 失败不投）；现有 mock 补 `listSessionConversations`+`send` |
| `test/im-send-tool.test.mjs` | 7 用例（显式投递、错误码、置空自动找绑定、无绑定/无会话报错、半显式拒绝、安装注册） |
| `test/delivery-adapter.test.mjs` | +2 用例（绑定私聊反查排除群聊、state 读取失败跳过） |
| `test/delivery-service.test.mjs` | +1 用例（聚合 + target 校验） |
| `lib/index.js` | 重建（host bundle） |

### dsh-proactive（配套）

| 文件 | 变更 |
| --- | --- |
| `observer.ts` / `scheduler.ts` / `wake.ts` | 移除「leak」计算（`no_reply` 后有可见文本不再记 leak、不再 warn/charge） |
| `config.ts` | 默认值 `maxDeliveriesPerDay` 20→50、`maxWakeupsPerHour` 4→60 |
| `test/observer.test.ts` | 3 处 leak 断言改为「普通 reply、无 leak note」 |

## 闹钟 prompt

三个 heartbeat（yu/luna/rev）prompt 已恢复原语，删除 send_im 引导语，明确「不需要说话就 `no_reply` 安静结束」。

## 测试与构建

- `session-sync-coordinator` 8/8、`im-send-tool` 7/7、delivery 层 +3 全绿。
- 全量 2301 pass / 7 fail（+9 为新增用例；7 fail 为既有环境 flake：discord/feishu/device-auth + 1 个 `host.test.mjs` 缺 `progressStatus` 期望的遗留漂移，均与本次改动无关）。
- dsh-proactive `observer` 测试 24/24 绿，typecheck 通过，lib 已重建。

## 生效条件

需重启 dsh 加载 dsh-im 与 dsh-proactive 的新构建产物（restart-dsh 流程：先单独端口验证，重启线上前征得用户书面同意）。