# 验证要求：Telegram Threads 模式首条消息服务通知过滤

- **Issue 日期**：2026-09-24
- **问题**：Telegram 开启 threads/topics 模式后发送首条消息，秒回“目前支持文字、图片和文件消息。”

---

## 1. 自动化测试验证

| 验证项 | 测试命令 / 路径 | 预期结果 | 实测状态 |
| :--- | :--- | :--- | :--- |
| 服务消息拦截单测 | `node --test --test-name-pattern="Telegram ignores forum topic creation" test/channels/telegram/telegram.test.mjs` | PASS（`forum_topic_created`、`pinned_message` 等返回 `null`） | 通过 |
| 话题下非显式 reply 引用修复 | 同上单测子断言 | PASS（包含 service message 作为 `reply_to_message` 时正常提取正文，但 `replyTo` 为 `undefined`） | 通过 |
| 构建打包验证 | `npm run build` | 正常输出 `lib/client.js` 与 `lib/index.js` | 通过 |

---

## 2. 用户实机验证建议

| 验证项 | 验证步骤 | 预期表现 |
| :--- | :--- | :--- |
| Telegram Threads 模式新话题发首条消息 | 1. 确保 DSH 重启或热重载最新 `lib/index.js`。<br>2. 在开启 Topics / Threads 模式的 Bot 私聊或超级群中，点击创建新话题（New Topic）并发送一句话（例如“你好”）。 | Bot **不再**回复“目前支持文字、图片和文件消息。”，而是直接回复正常的 AI 思考与回答。 |
| 普通私聊 / 群聊文本与多媒体 | 正常发送文字、图片、文件消息。 | 一切功能与此前保持完全一致。 |
