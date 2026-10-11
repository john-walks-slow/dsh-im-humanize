# 用户验证要求：260923-preset-persona-prefix-error

## 1. 验证目标

验证在 DSH 0.1.5-rc.3 环境下，IM（Telegram 等渠道）机器人收到用户消息后能够正常处理并回复，不再抛出 `INTERNAL_UNKNOWN` / `MF-5CADC159` 类似错误。

## 2. 自动化已验证项（已通过）

- [x] RPC 接口 `session/selectModel` 触发 `session-300d309e-df84-446d-b191-93e2a5fc1c91`（luna / `agent` preset）成功挂载并返回 `ok: true`
- [x] RPC 接口 `session/selectModel` 触发 `session-6327b967-b071-429d-9acb-ca5f218ce1f4`（ami / `yuyu` preset）成功挂载并返回 `ok: true`
- [x] RPC 接口 `session/selectModel` 触发 `session-f12231a3-7bca-49ce-ba57-f3613915ec63`（yu / `roleplay` preset）成功挂载并返回 `ok: true`

## 3. 实机验证步骤（请用户操作）

| 步骤 | 操作 | 预期结果 | 用户实际结果 |
|---|---|---|---|
| 1 | 在 Telegram 中向 **Luna** 机器人（或之前报错的机器人）发送任意一条消息（例如“你好”或“测试一下”） | 机器人正常显示打字状态，并输出正常回复，不再提示“最近一条消息处理失败：任务未完成，暂时无法确定原因” | 待用户确认 |
