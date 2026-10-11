# progressStatus 过程进度提示开关 · 用户验证

## 验证说明

- 验证对象：拟人化新开关 `progressStatus`（默认开启），关闭后禁用 IM 渠道的"正在处理…/正在使用工具…/正在整理结果…"占位与中间进度气泡
- 环境/前置条件：dsh web GUI（http://127.0.0.1:4175）；至少一个渠道已配置机器人（推荐 Telegram 私聊）；`humanize.json` 中 `progressStatus: false`（或面板关闭）；本 fork 构建产物已加载（需重启 dsh 使新插件代码生效）
- 自动化已覆盖（无需手动验证）：
  - 设置链路：normalize/validate/override 白名单、resolver 输出 —— `test/humanize-settings.test.mjs`
  - 懒建流：editable-message-stream lazy（首条 update 建消息、finish 未建流时新发、cancel 无残留）—— `test/channels/shared/progress-status.test.mjs`
  - Telegram lazy：rich-draft 跳过初态、regular 延迟占位 + finish 新发 —— 同上
  - 桥接 onUpdate 过滤：progressStatus=false 丢弃 tool/status、messageBreak+progressStatus 跳过占位流 —— 同上
  - verify-package 审计计数、客户端 UI 字段渲染 —— `test/client-humanize-ui.test.mjs`

## 验证项

| 验证步骤 | 预期结果 | 实际结果 | 状态 | 备注/证据 |
| --- | --- | --- | --- | --- |
| 1. Telegram 私聊（streaming=on, messageBreak=on, progressStatus=off）：发一条需要工具调用的问题（如"帮我搜一下今天的新闻"） | 全程不出现"正在处理…""正在使用工具…""正在整理结果…"气泡；仅"正在输入"指示器 → 回复分段逐条发出，无顶部占位气泡残留 | | 待验证 | |
| 2. Telegram 私聊（streaming=on, messageBreak=off, progressStatus=off）：发一条会触发工具的问题 | 无"正在处理…"占位气泡；首条真实文本到达时才出现消息并逐字流式追加；工具调用期间无中间进度文案 | | 待验证 | |
| 3. 切回 progressStatus=on（面板或 humanize.json），同一问题重发 | 恢复旧行为：先出"正在处理…"占位 → 工具调用时编辑为"正在使用{name}…" → "正在整理结果…" → 最终回复覆盖 | | 待验证 | |
| 4. 设置面板：设置 → IM机器人 → 拟人化设置 → 全局，与某 Telegram bot 卡片的「拟人化」折叠面板 | 两处均有"过程进度提示 (progressStatus)"开关；逐 bot 可选"跟随全局/开启/关闭"，徽标计数包含此项 | | 待验证 | |
| 5. 逐 bot 关闭 progressStatus、全局保持开启，对该 bot 发消息 | 该 bot 无进度气泡；其他未覆盖 bot 仍按全局显示进度 | | 待验证 | |

## 验证结论

待验证。

## 待跟进

- 飞书卡片初始文案（`已连接 DeepSeek Harness，正在思考…`）为启动期构造参数，本次仅抑制逐回合进度文案，卡片初始问候保留（首条文本流入即覆盖）。若用户反馈飞书初始文案仍需关闭，后续可把 initialText 改为逐回合传入。
- 钉钉错误恢复路径（dingtalk-bridge.mjs fallback card.start）仍用 `CARD_INITIAL_TEXT`；该路径为异常重试，非主流程，保留原样。
- **R1（检视残留·真机确认）**：企微懒开流仅在客户端提供 `replyStreamNonBlocking` 时启用；若某企微客户端无该方法且 progressStatus=false，仍会以空内容 eager 开流（无"正在思考中…"文案，但可能出现空白气泡）。降级安全。
- **R2（检视残留·真机确认）**：Telegram 懒建流引入"sendRichMessage 创建 → editMessageText 编辑"新组合；若自定义网关不支持编辑 sendRichMessage 所建消息，首条之后编辑失败会停留在首段，finish 退化 #sendPlain 仍送达。降级安全。验证项 2 顺带覆盖此路径。
