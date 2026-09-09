# 状态 Reaction 与回复引用全局开关 — 用户验证要求

对应实施：`260909-humanize-status-reaction-reply-quote.summary.md`。
自动化测试已覆盖门控逻辑（statusReaction 三处收口 NOOP 化、replyQuote 三渠道归一化/发送层剥离、WhatsApp 已读回执保留、设置管线六处键名单、UI 渲染/保存、基线零新增 cancelled）。以下为需**实机/真机验证**的场景（自动化测试用 mock socket/API，无法验证平台真实渲染与 webhook 语义）。

## 必验证场景

| # | 场景 | 预期 | 实测结果 | 状态 |
|---|------|------|---------|------|
| 1 | Telegram 私聊，默认设置（两项都开）发一条消息 | 收到 👀 表情 → 回复时以「回复你」的引用样式出现 → 回复成功后 👀 消失变 👍 | | |
| 2 | 全局关闭 statusReaction，Telegram 私聊发消息 | 全程无任何表情，回复正常送达 | | |
| 3 | 全局关闭 replyQuote，Telegram 私聊发消息 | 回复无「回复你」引用头，以普通消息发出；**话题群**发消息时回复仍在正确 topic（messageThreadId 路由不受影响） | | |
| 4 | 两项都关，Telegram 群聊被 @ 发消息 | 无表情、无引用头，回复送达 | | |
| 5 | 在 workspaces.json 给某 bot 手写 `humanize: { statusReaction: false }`，该 bot 发消息 | 仅该 bot 停发表情；其他 bot 仍默认有表情 | | |
| 6 | 面板切换某项后**不重启** Host，下一条消息即生效 | 设置面板保存后，下一条消息行为已变（无需重启 dsh/Host） | | |

## 可选验证（如启用 Discord/WhatsApp 渠道）

- Discord：关闭 replyQuote 后回复无 message_reference 引用头；Thread 内回复仍归到该 Thread（结构不变）。
- WhatsApp：关闭 replyQuote 后回复无 quoted 气泡；**已读回执（蓝勾）仍正常**（这是发送层门控的关键验证点——若误在归一化层剥 quoted 会连坐丢已读）。

## 不需验证

- QQ/企微/微信：无出站引用机制，replyQuote 对其是 no-op（自动化测试已确认）。
- Slack/飞书/钉钉的 replyQuote：明确不在范围内（线程/话题/webhook 是会话结构）；statusReaction 对钉钉/飞书的 OnIt/DONE 表情门控已在自动化测试覆盖。

## 回归红线（自动化已确认，无需实机）

- 清代理环境全量 `npm test`：2472 tests / 0 fail / 200 cancelled（与基线逐文件一致、零新增）。
- `npm run build` + `verify-package.mjs` 通过。
