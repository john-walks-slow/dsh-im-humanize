# proactive 唤醒投递 · 实施计划（send_im 工具方案）

- **日期**：2026-09-16
- **范围**：dsh-im-humanize fork（上游 xmanrui/dsh-im v4.13.0）
- **类型**：功能扩展

## 背景

dsh-proactive 定时唤醒绑定会话后，唤醒回合的可见回复从不投递到 IM 渠道：

1. dsh-proactive 只负责唤醒+分析+压缩，自身不投递；
2. dsh-im 正常回复链按 `promptRpcId` 请求级认领回合，唤醒 framing 消息 `source.kind='plugin'` 无 rpcId，无人认领；
3. 私聊双向同步按 origin 门控，plugin 来源被设计文档明确排除。

旧 dsh-wechat 插件的 `send_wechat` 工具（模型在唤醒回合自行调用）承担过这一生态位。本方案复刻并强化该生态位为通用 `send_im` 工具。

## 方案

### 主方案：`send_im` 模型工具（botId/targetId 可省略）

`src/channels/shared/im-send-tool.mjs`：

- `createImSendToolDefinition({ send, resolveBoundTargets })`：
  - 参数 `text` 必填；`botId`/`targetId` **可选**。
  - 显式路径：`botId` + `targetId` 都填 → `send(botId, targetId, text)`。
  - 自动路径：两者都空 → 用 `exec.agent.session.id`（当前会话）调 `resolveBoundTargets(sessionId)` 找到绑定私聊，逐个投递；无会话上下文或未绑定则报错（提示显式填 botId/targetId）。
  - 失败 throw `send_im failed (code): message`。
- `installImSendTool(ctx, { send, resolveBoundTargets })`：注册工具 + systemPrompt section（name `dsh-im:send-im`，order 117）。
- 描述与提示：**仅当本会话默认静默（无 IM 双向同步、无渠道可见输出）时使用**；正常 IM 会话与已开同步的会话直接说话即可（dsh-im 上下文增强会注入 channel/sender 标签，模型据此判断是否处于 IM 回合）。

### 后端：绑定私聊反查 `listSessionConversations`

`delivery-adapter.mjs` + `delivery-service.mjs`：

- adapter 新增 `listSessionConversations(sessionId)`：遍历该 channel 所有 bot，反查 `state.snapshot().sessions` 里 `value === sessionId` 的私聊 key，用 `privateDeliverySuggestionFromConversationKey(channel, key)` 构造 target（只认 `direct:`/`p2p:` 私聊，排除群聊），返回 `[{ botId, target: { kind, route } }]`。
- delivery-service 新增 `listSessionConversations(sessionId)`：聚合所有 adapter，返回 `[{ channel, botId, target }]`。
- 发送复用 `adapter.sendText`（→ `coreController.sendProactiveText`），不依赖双向同步开关。

### 暂缓：wake 回合自动投递（方案 A）

初版「双向同步扩展 origin 投递 wake 回合」已 stash（`proactive-wake-delivery 暂缓`）。后续如需「wake 回合自动投递（无需模型调 send_im）」，再基于 `listSessionConversations` 实现：wake 回合结束时由 coordinator 自动投到绑定私聊（无前缀）。本次不启用。

## 不做

- 不改群聊投递（自动路径仅投绑定私聊）。
- 不改双向同步（sessionSync）语义。
- 不做 send_im 的「双投防呆」运行时校验（靠上下文增强标签 + 工具描述约束）。
- 不改 dsh-proactive 本身。
