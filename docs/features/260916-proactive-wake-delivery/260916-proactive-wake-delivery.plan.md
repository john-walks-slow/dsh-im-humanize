# 主动回回合自动投递 · 实施计划

- **日期**：2026-09-16
- **范围**：dsh-im-humanize fork（上游 xmanrui/dsh-im v4.13.0）；配套 dsh-proactive（leak 移除）
- **类型**：功能扩展

## 背景

「agent 主动发起」的回合——proactive 唤醒、定时任务、后台子代理完成通知——其可见回复从不投递到 IM 渠道：

1. dsh-im 正常回复链按 `promptRpcId` 请求级认领回合，这些回合的 framing 消息无入站 IM 消息可认领；
2. 私聊双向同步按 origin 门控，只镜像「Web/CLI 直接用户输入」，plugin/其他来源被排除。

先试过「send_im 工具 + prompt 引导」：实测 yu/luna/rev 三个 agent 在唤醒回合都**不主动调 send_im**（惯性直接输出文本），靠提示词约束模型不可靠。改为**机制自动投递**。

## 方案

### 主方案：主动回合自动投递绑定私聊（不依赖双向同步）

`session-sync-coordinator.mjs`：

- 来源判定扩展（`userInputOrigin`）：
  - `source.kind === 'plugin'`（任意 plugin）或 `source.kind === 'subagent-settled'`（后台子代理完成通知）→ `wake`；
  - 其余维持原判：`user`+`rpcId` → `im`/`dsh`，其他 → `other`。
- `assistant/message` 累计：`origin ∈ {dsh, wake}`。
- `turn/end` 拆分：
  - `dsh` 路径不变（`[DSH 助手]` 前缀 + 双向同步镜像收件人）；
  - `wake` 路径——现查 `listSessionConversations(sessionId)`，把正文**原文（无前缀）**投递到当前绑定该 session 的每一条私聊，经 `deliveryService.send(botId, target, text)`（draft 路由 → `sendProactiveText`）。
  - 非 completed / 无正文 / 查询失败不投递。

投递目标 = `listSessionConversations`（既有后端）：反查 channel `state.sessions` 里 `value === sessionId` 的私聊 key，只认 `direct:`/`p2p:` 私聊、排除群聊，**不依赖双向同步开关**。

### 边界（三条）

1. **只投绑定私聊**：不投群聊、不投未绑定；用户在那个私聊里正和该 agent 对话，主动说话即推送，语义自洽，无差别轰炸可控。
2. **自动投了就不再 send_im**：主动回合模型「直接说」即可自动投；`send_im` 降级为「显式投到非绑定的指定目标」，工具描述与 system prompt 同步改写。
3. **精确排除已认领回合**：只有 `im`（bridge 认领）与 `dsh`（双向同步镜像）之外的主动回合才自动投，不重复。

### 配套：proactive 闹钟 prompt 与 dsh-proactive

- heartbeat prompt 删除 send_im 引导语，恢复原语 + 明确「不需要说话就 `no_reply`」。
- dsh-proactive 移除「leak」计算（旧假设「可见文本=要发送内容」已不成立；主动回合文本只是自我意识，自动投递才送达）。见源码 `observer.ts`/`scheduler.ts`/`wake.ts`。

## 不做

- 不改群聊投递（主动投递仅限绑定私聊）。
- 不改双向同步（sessionSync）语义。
- 不改 dsh-proactive 的唤醒驱动/预算（leak 移除除外）。
- 不给主动投递加前缀或开关（受「已绑定私聊」天然门控）。