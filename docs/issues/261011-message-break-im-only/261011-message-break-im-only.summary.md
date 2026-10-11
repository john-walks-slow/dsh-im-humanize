# message_break 只在 IM 投递回合可用（261011）— 总结

## 改了什么

`src/channels/shared/message-break.mjs`：

- 引导从全局 `systemPrompt.section` 改为按回合渲染的 `systemPrompt.context`：只有 `outboundArtifactRegistry.hasActiveConsumer(assembly.agent.session)` 为真的回合才拿到分段指引，其余返回空串。
- 新增 `ctx.tools.guard()`：非 IM 投递回合调用 `message_break` 会在执行前被拒，理由为「this turn has no IM delivery consumer」；其它工具不受影响。
- 能力要求改为 `tools.register + tools.guard + systemPrompt.context`（缺一即 installer 返回 false，不静默降级）。
- 工具描述里「has no effect」→「is refused」，与行为一致。

判据复用 `dsh_im_return_file` 的同一个概念（artifact registry 的按回合消费者 = 「本回合有 IM 渠道在投递」），两个工具从此同构。

## 边界

- 每机器人 `messageBreak=false` 时模型仍会看到引导（工具层拿不到 per-bot 设置），但断点不生效——属独立话题。
- `no_reply.mjs` / `im-send-tool.mjs` 仍是全局 section + 同样措辞，同类问题未在本单处理。

## 验证

- `test/message-break.test.mjs` **21/21**（含 3 个新增：context 按所有权渲染、guard 拒绝非 IM 回合、缺 `tools.guard` 时不安装）。
- `test/host.test.mjs` + `test/humanize-bridge.test.mjs` **27/27**。
- `npm run build` 成功；`node scripts/verify-package.mjs` → `Verified dsh-im package artifacts.`；打包产物 `lib/index.js` 已含新 guard 文案。
- 判据安全性逐条核实（见 troubleshoot「判据为什么安全」）。
