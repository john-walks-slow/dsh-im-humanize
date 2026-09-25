# 修复总结：Telegram Threads 模式系统服务消息过滤

- **Issue 日期**：2026-09-24
- **修复涉及模块**：
  - `src/channels/telegram/telegram-runtime.mjs`
  - `test/channels/telegram/telegram.test.mjs`
  - `lib/index.js` (build 产物)
  - `lib/client.js` (build 产物)

---

## 1. 根因回顾

在 Telegram 启用 Threads / Topics 模式下创建话题并发送首条消息时，Telegram API 会先后推送两条 Updates：
1. 包含 `forum_topic_created` 结构体的系统服务消息（无任何文本正文和媒体附件）。
2. 用户输入的真实业务文本消息。

先前代码未识别 Telegram 服务消息，导致第 1 条无文本的服务消息被送入通用的 Bridge 处理管线，触发了“无文字、图片、文件、引用”的类型拦截报错；紧接着第 2 条文本到达时又正常输出回答。

---

## 2. 实施变更

1. **服务消息枚举与判定**：
   在 `src/channels/telegram/telegram-runtime.mjs` 中定义 `TELEGRAM_SERVICE_MESSAGE_FIELDS`，涵盖话题生命周期（`forum_topic_created`, `forum_topic_edited`, `forum_topic_closed`, `forum_topic_reopened`, `general_forum_topic_hidden`, `general_forum_topic_unhidden`）及会话管理等各类 Telegram 系统事件，并提供 `isTelegramServiceMessage(message)` 判定。
2. **入站标准化层过滤**：
   在 `normalizeTelegramUpdate` 中，遇到服务消息直接返回 `null`，轮询器静默更新 offset cursor 并跳过投递。
3. **话题引用解耦**：
   在 `telegramReplyReference` 中，当 `reply_to_message` 指向服务消息（Telegram 话题机制将话题根消息作为伪 reply 挂载）且无用户 quote 时，不将其作为上下文引用提取。
4. **单测覆盖与构建**：
   在 `test/channels/telegram/telegram.test.mjs` 中补充了服务消息过滤及话题内首条消息引用行为测试，并通过 `npm run build` 生成最新产物。
