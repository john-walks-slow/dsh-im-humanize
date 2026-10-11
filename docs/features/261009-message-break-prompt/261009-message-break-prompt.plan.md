# message_break 提示词修正：明确「先写后断」

日期：2026-10-09
状态：已确认（用户在会话中 review 了修改方案后回复 go）

## 问题

IM 里观察到模型经常这样用 `message_break`：调完一批工具 → 调 `message_break`（此时还没写任何新文本）→ 开始写一段话 → 再调工具。
结果是这一段话**不会立刻作为独立消息发出**，要等到下一个断点或回合结束才被 flush，用户侧看起来就是"中间那句话迟迟不来"。

## 源码核实结论（2026-10-09）

语义是**尾随定界符（trailing delimiter）**，不是"新消息的开头标记"：

- `src/channels/shared/harness-client.mjs:636` 的 `tool/call` 分支：收到 `message_break` 时取 `#segmentText()`（= 自上一个断点以来累积的文本），推 `{type:'message_break', text}`，然后 `#textAtLastBreak = #latestText` 推进断点。
- `src/channels/shared/message-break.mjs:87` 的 `handleUpdate`：`rawText.trim()` 为空则**什么都不发**（静默丢弃），只把 `breakCount` 加一；非空才 `sendSegment(text)`。
- 因此"先断后写"的后果：断点落空（no-op，白占 20 段配额），随后写的文本属于"新段"，只在下一个断点或回合末（`remainingText`）才发送。**文本不会丢，只会迟到。**
- 提示词有两个面，写法不一致：
  - 工具描述 `message-break.mjs:25`：写对了 —— "The text you wrote before each break is sent as a separate message; text after the last break becomes the final message"，但没写"必须先写再断"、也没说空断点是 no-op。
  - system prompt 段落 `message-break.mjs:62`（order 116，经 `plugin-src/host/index.mjs:224/234` 全局注册，是模型逐字当指令读的那份）：写成 "Each segment **between** message_break calls becomes a separate chat message"，把断点描述成分段之间的分隔符，且**完全漏掉**了工具描述里的那条关键规则。这是误用的主要来源。
- 该提示词文本只存在于 `src/channels/shared/message-break.mjs:25` 与 `:62`（另一处是构建产物 `lib/index.js`）。
- 现有测试 `test/message-break.test.mjs:11/18` 只对 description/section 做 `match(/Do not use when the user message does not come from dsh-im/)`，保留该尾句即可不破坏既有断言。

## 实施内容

1. `src/channels/shared/message-break.mjs`
   - `createMessageBreakToolDefinition().description`：补"先写这一段的文本，再调本工具；自上一个断点以来的内容会在调用时立即作为独立消息发出；不要在开始写之前调用（空断点不发送任何内容，其后的文本会等到下一个断点）"。保留既有首句（非 dsh-im 会话无意义）与尾句（`Do not use when the user message does not come from dsh-im`）。
   - `installMessageBreakTool` 的 system prompt 段落：与工具描述统一为同一套"先写后断 + 尾随定界符 + 最后一个断点之后是收尾消息"表述，去掉 "Each segment between message_break calls" 这种歧义措辞；同样保留尾句。
   - 模块头注释补一句"break 是尾随定界符，空断点是 no-op"，供后续维护者对齐语义。
   - `handleUpdate`：断点文本为空时打一次 `logger.warn`（每回合最多一条），给这次修正提供可观测性（能不能观察到误用率下降）。语义不变。
2. `test/message-break.test.mjs`：新增断言，把"先写后断"的规则钉在 description 与 section 上（防措辞回归）；新增空断点触发 warn 的用例。
3. `npm run build` → `lib/index.js`（link 部署，改完必须重启 dsh 才生效，重启需用户书面同意）。

## 不做的事

- 不改运行时语义（不引入"空断点=为下一段预开消息"或"遇到真实工具调用就 flush"这类兼容性改动）：尾随定界符是干净且 canonical 的语义，问题出在提示词。
- 不改 README 的功能描述（用户文档层面 `message_break` 已说明清楚；本次只影响模型侧措辞）。

## 验证

- `node --test test/message-break.test.mjs` 孤立跑通。
- 重启 dsh 后，在 IM 里让模型做一次"工具 → 分段说话 → 工具"的长回复，观察中间那句话是否在断点处立即到达。

## 风险

- 提示词变长，模型对段落切分的积极性可能略降；但规则更明确，预期整体更符合预期行为。
- 空断点 warn 是无副作用日志，不影响投递。
