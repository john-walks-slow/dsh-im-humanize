# message_break 在非 IM 会话里同样被引导（261011）

## 现象

Web GUI / CLI 会话（没有 IM 投递消费者）里，`message_break` 依然出现在工具列表中，且插件的全局 system prompt 段落要求模型「长回复就调用 message_break 分段」。工具描述里那句「only meaningful in dsh-im sessions …… has no effect」是唯一的提醒。

## 根因

`installMessageBreakTool()`（`src/channels/shared/message-break.mjs`）用 `ctx.tools.register()` 全局注册工具，并用 `ctx.systemPrompt.section()` 加一段**无条件**引导：

```js
ctx.systemPrompt.section({ name: 'dsh-im:message-break', order: 116, text: '…split it into multiple shorter messages…' });
```

段落是静态字符串，没有任何「本回合有没有 IM 投递方」的判据。而同目录的 `dsh_im_return_file`（part 1，上游 43fd516）已经改成了正确形状：引导走 `ctx.systemPrompt.context()`，其 `text(assembly)` 按 `registry.hasActiveConsumer(assembly.agent.session)` 决定渲染还是返回空串。

后果：非 IM 回合里模型被鼓励去调一个**没有任何东西会消费**的工具——调用成功、文本照旧作为一条消息发出（`harness-client` 的 tracker 只把 tool/call 转成 `message_break` 更新，而只有桥接层才把它变成多条消息）。多花一次工具往返，且模型会对「我明明分段了」产生错误认知。

## 修法（与 `dsh_im_return_file` 完全同构）

1. 引导由全局 `systemPrompt.section` 改为 **`systemPrompt.context`**，`text(assembly)` 只在 `outboundArtifactRegistry.hasActiveConsumer(assembly.agent.session)` 为真时返回原文，否则返回空串。
2. 新增 `ctx.tools.guard()`：本回合不是 IM 投递回合时，`message_break` 的调用在执行前被拒（返回理由），其它工具不受影响。DSH 的 guard 是单调拒绝、先于执行、无法被后续 guard 反转，正是这个用途。
3. 能力要求从 `tools.register + systemPrompt.section` 改为 `tools.register + tools.guard + systemPrompt.context`：宿主缺任一能力时 installer 返回 false（不做静默降级）。
4. 工具描述里「has no effect」改为「is refused」，与真实行为一致。

判据仍复用**同一个概念**：artifact registry 的按回合消费者就是本插件里「这一回合有 IM 渠道在投递」的唯一记号（`harness-client.ask()` 只在桥传了 `onArtifact` 时 `openConsumer`）。

## 已知边界（未在本单处理）

- 每机器人 `messageBreak` 关掉时（`resolveHumanizeSettings` 的 per-bot 覆盖），工具层拿不到该设置（installer 只有插件级 `config.messageBreak`），因此模型仍会看到引导，但桥不会建 handler、断点不生效。要精确门控需要在 ask 时把「本回合消费断点」登记进 registry，属独立话题。
- `no_reply.mjs` 与 `im-send-tool.mjs` 仍是全局 `systemPrompt.section` + 同样的「only meaningful in dsh-im sessions」措辞，同一类问题，未在本单内改动。

## 验证

- `test/message-break.test.mjs` 21/21：installer 注册工具 + guard + context；引导对 owned 回合返回全文、对非 owned 与空 assembly 返回空串；guard 对非 owned 回合给出「no IM delivery consumer」理由、对其它工具不插手；缺 `tools.guard` 的宿主 installer 返回 false。
- `test/host.test.mjs` + `test/humanize-bridge.test.mjs` 27/27（组合宿主与分段行为无回归）。
- `npm run build`（client + host）成功，`node scripts/verify-package.mjs` 通过。

## 判据为什么安全（自查证据）

guard 只在「本回合有活跃 IM 投递消费者」时放行；若某个正常 IM 回合拿不到消费者，分段会被误拒——这是本改动唯一的高风险点，逐条核实：

- `src/channels/shared/workspace-session.mjs:164` 在**没有任何条件**的情况下给 askOptions 挂上 `artifactOptions.onArtifact`（`workspace.test.mjs:104` 也断言该字段必为函数）。
- 上游 `harness-client.ask()` 的消费者注册条件正是这个回调（`src/channels/shared/harness-client.mjs:1889`：`typeof onArtifact === 'function' ? openConsumer(...) : null`）。
- 所有 IM 桥的提问都走这条路径：`text-harness-bridge.mjs`（telegram/discord/slack/whatsapp/imessage）与 feishu(5)/qq(2)/dingtalk(2)/wecom(2)/weixin(2) 各自 bridge 的 `askInWorkspaceSession()` 调用点。
- 因此：IM 回合 → 有消费者 → 引导渲染、调用放行；Web/CLI 回合、AI Office 任务（`office-job-executor.mjs:228` 直接 `harness.ask`，不传 onArtifact）、session-sync 唤醒投递 → 无消费者 → 不引导且拒绝。
