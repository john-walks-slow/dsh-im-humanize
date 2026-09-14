# progressStatus 过程进度提示开关 · 实施总结

- **日期**：2026-09-15
- **范围**：dsh-im-humanize fork（上游 xmanrui/dsh-im v4.13.0）
- **状态**：已实施、已检视（条件准入→复核通过）、已构建、已提交
- **计划**：[260915-progress-status.plan.md](./260915-progress-status.plan.md)
- **检视**：[260915-progress-status.review.md](./260915-progress-status.review.md)（含复核段）
- **验证**：[260915-progress-status.validation.md](./260915-progress-status.validation.md)

## 需求

Telegram 等渠道在处理任务时会显示"正在处理…""正在使用工具…""正在整理结果…"等中间状态气泡，影响拟人感。新增拟人化开关 `progressStatus`（默认开启）支持禁用这些过程提示。

## 方案要点

1. **设置链路**：`progressStatus` 布尔键贯通 9 处（DEFAULT/normalize/validate、override 白名单、resolver、host 转发、RPC SETTABLE_KEYS、客户端 META/DEFAULTS、全局面板与逐 bot 编辑器 BOOLEAN_KEYS、i18n）。默认 `true`，行为与上游完全一致。
2. **共享桥接**（Telegram/WhatsApp/Discord/Slack，`text-harness-bridge.mjs`）：`progressStatus=false` 时 onUpdate 丢弃 tool/status 更新（保留 text/assistant-message）；`messageBreak` 同开则跳过占位流（消除占位气泡 + 分段内容重复，主人当前配置的主路径）；纯流式以 `{ lazy: true }` 开流。
3. **懒建流**：`editable-message-stream.mjs`（WhatsApp/Discord 共用）、`telegram-runtime.openDeliveryStream`（私聊跳过初态 draft；群聊延迟占位、首条真实文本建消息、markdown 走 sendRichMessage 富文本创建）、`slack-runtime.createSlackMessageStream`（延迟 startStream）。
4. **自有桥接**：飞书 onUpdate 跳过 tool/status 的 setContent；钉钉跳过 cardStream.push、卡片初始文案按开关取 `…`；企微 thinking 初态按开关置空 + 懒开流（首个非空 preview 才 replyStream）。
5. **不动**：QQ/微信（本无中间进度）、AI Office（任务进度为核心 UX）。

## 检视与修复

首轮条件准入（无阻塞），5 项建议修改全部落实：

| ID | 问题 | 修复 |
| --- | --- | --- |
| S1 | 企微空内容 eager 开流 | 懒开流：首个非空 preview 才开流 |
| S2 | Telegram 懒首条裸 markdown | ensureMessage 按 format 分流 sendRichMessage |
| S3 | cancel 与懒 create 竞态 | Slack cancel 待 inFlight 落定后补 stopStream；editable 注释标注（与 eager 孤儿占位持平） |
| S4 | 测试缺口 | 补 Slack lazy×3、WhatsApp/Discord 透传、assistant-message 保留 |
| S5 | telegram openStream 不接 lazy | 签名统一 `(target, { lazy = false } = {})` |

N3 顺带修正（hint 措辞精确化）。残留 R1/R2（企微无 nonBlocking 子分支、Telegram sendRich→edit 新组合）降级路径安全，见验证文档"待跟进"。

## 测试与构建

- 新增 `test/channels/shared/progress-status.test.mjs` 15 用例全绿（lazy editable-stream、telegram lazy、slack lazy、whatsapp/discord 透传、桥接 onUpdate 过滤、messageBreak 跳占位流、assistant-message 保留、默认 true 行为）。
- 相关回归 506 tests / 0 fail（146 cancelled 为既有基线）；`npm run build` + `verify-package` 通过。

## 后续

- 生产 `~/.dsh/integrations/dsh-im/humanize.json` 已设 `progressStatus: false`；需重启 dsh 加载新插件代码后生效。
- 真机验证项见验证文档（Telegram 主路径 + R2 富文本编辑组合）。
