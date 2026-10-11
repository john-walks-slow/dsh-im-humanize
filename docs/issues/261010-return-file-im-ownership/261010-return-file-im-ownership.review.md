# 检视报告

## 概要

检视范围为移植上游 `43fd516`（PR #290 / issue #286：`fix(outbound): require active IM ownership for file returns`）至 fork 仓库 `@johnnren/dsh-im-humanize` 的未提交修改，涵盖 `src/channels/shared/semantic/artifact.mjs`、`src/channels/shared/harness-client.mjs`、相关单元测试改造及新增测试。
整体评价：**实现规范、边界缜密、测试覆盖全面**。移植完整保留了 fork 特有的 `as` 呈现模式及提示词说明，且严谨处理了 prompt 组装时序与文件复制/哈希过程中的生命周期竞态，准入条件完备。

## 需求对齐

- **满足需求**：完全对齐。原问题中「Agent 在非 IM 会话（Web/CLI）中因全局 prompt 引导误调 `dsh_im_return_file` 导致文件静默丢失」被彻底阻断：
  1. 提示词引导从全局 `systemPrompt.section` 改为动态 `systemPrompt.context`，非活跃 IM 回合为空串，不注入引导文案；
  2. 工具描述明确标示需要活跃 IM consumer，引导 Web/CLI 使用宿主 `present` 工具；
  3. 工具执行入口（`stage()`）增加首尾两次消费者活跃校验，无消费者时显式抛出 `artifact-consumer-required` 错误；
  4. 渠道客户端在没有 `onArtifact` 回调时不注册消费者。
- **与计划/spec 差异**：无偏差。fork 特有的 `as` 呈现模式定义及提示词中的 `as` 说明句均已妥善保留并合入新的 context 生成函数。

## 阻塞问题

无

| ID  | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| - | - | 无 | - |

## 建议修改

无

| ID  | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| - | - | 无 | - |

## 非阻塞问题

| ID  | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| N-01 | [artifact.mjs:327-332](src/channels/shared/semantic/artifact.mjs#L327-L332) | `observeClaimedMessage()` 中对 turn 进行了 `this.#currentTurn(session) !== turn` 的严格相等校验。在极端情况下，若 `turn/start` 事件因事件队列处理滞后于 `agent/inbox/claimed` 事件到达，`#currentTurn(session)` 可能尚停留在旧回合导致跳过绑定（但随后的 `user/message` 事件仍会保底绑定）。 | 当前 DSH 核心时序保证了 `turn/start` 先于 `agent/inbox/claimed` 派发，且 `user/message` 事件有保底绑定，现有逻辑安全；后续若重构可留意该偶发时序依赖。 |
| N-02 | [artifact.mjs:364](src/channels/shared/semantic/artifact.mjs#L364) | `turn/end` 时将 `#openTurns` 设为 `null` 而非 `delete`，旨在防止 stale session snapshot 重新打开该回合。但随后的 `#currentTurn()` 判断逻辑若遇到未包含 turn 字段的事件，依赖 session snapshot 的 fallback。 | 代码中 `this.#openTurns.has(sessionId)` 保证了 `null` 值被优先读取并返回，避免了 snapshot 回落，设计契合预期，逻辑自洽。 |

## 准入结论

**结论**：`准入`

**说明**：代码架构与实现清晰，生命周期管控严谨（具备二次校验及快照异常 unlink 防孤儿机制），充分覆盖并发与竞态边界，fork 特有能力（`as` 模式）完整保留，新增及改造测试断言精准，无遗留或次生问题。
