# 故障排查：Telegram 开启 Threads 模式后首条消息秒回“目前支持文字、图片和文件消息”

- **Issue 日期**：2026-09-24
- **问题分支**：`main`
- **问题归属**：`src/channels/telegram/telegram-runtime.mjs`

---

## 1. 现象描述

用户在 Telegram 开启 Threads 模式（Threaded Mode / Topics）后向 Bot 发送第一句话，观察到以下现象：
1. Bot 几乎瞬时返回一条提示：`目前支持文字、图片和文件消息。`
2. 随后又正常收到了大模型的完整回答。

---

## 2. 根因分析 (Root Cause)

### 2.1 Telegram 协议行为
Telegram Bot API 规范中，当在开启话题的私聊或超级群组中创建新 Topic / 发送第一条消息时，客户端会先后推送两条 Updates：
1. **服务消息（Service Message）Update**：
   - 携带 `forum_topic_created` 结构体（包含 Topic 名称、图标颜色等元数据）。
   - 该消息作为系统服务通知，**不包含用户文本正文（`text` / `caption` 均为 `undefined`）**，也不包含图片或附件。
2. **业务文本消息 Update**：
   - 随后紧跟一条普通文本消息，包含用户实际输入的文字内容。

### 2.2 本地处理逻辑缺陷
在 `src/channels/telegram/telegram-runtime.mjs` 的 `normalizeTelegramUpdate(update)` 中：
1. 目前仅校验了 `update_id`、`chat.id`、`from.id`、`message_id` 以及 `chat.type`。
2. **未对 Telegram Service Messages 做任何识别或过滤**。
3. 当收到 `forum_topic_created` 服务消息时：
   - 私聊中 `direct = true`，自动判定为 `addressed = true`；
   - 解析出 `content: ""`，`plainText: false`，`images: []`，`files: []`，并生成标准化消息对象进入 Bridge。
4. 进入 `src/channels/shared/text-harness-bridge.mjs` 的通用消息接收守卫：
   ```javascript
   const hasImages = hasInboundImages(message);
   const hasFiles = hasInboundFiles(message);
   const hasReply = hasReplyReference(message);
   if (!text && !hasImages && !hasFiles && !hasReply) {
     await this.#bot.sendText(target, t('目前支持文字、图片和文件消息。'));
     return;
   }
   ```
5. 因内容全空，触发类型不支持拦截，立即向对应 Target 发送了错误提示。
6. 紧接着第二条携带真实文本的 Update 到达，正常交给大模型处理，生成了后续的正常回答。

---

## 3. 修复方案 (Fix Strategy)

### 3.1 修复原则
系统服务消息（Service Messages）本质上是群组或会话的状态事件，不属于用户对 Bot 的输入意图，应当在渠道输入规范化层（Inbound Normalizer）被静默丢弃，同时正常步进 Update Cursor。

### 3.2 实施步骤
1. 在 `src/channels/telegram/telegram-runtime.mjs` 中定义 `TELEGRAM_SERVICE_MESSAGE_FIELDS` 列表及判断函数 `isTelegramServiceMessage(message)`：
   - 话题相关：`forum_topic_created`, `forum_topic_edited`, `forum_topic_closed`, `forum_topic_reopened`, `general_forum_topic_hidden`, `general_forum_topic_unhidden` 等；
   - 会话状态相关：`pinned_message`, `new_chat_members`, `left_chat_member`, `new_chat_title`, `new_chat_photo`, `delete_chat_photo`, `group_chat_created`, `supergroup_chat_created`, `channel_chat_created`, `message_auto_delete_timer_changed`, `migrate_to_chat_id`, `migrate_from_chat_id`, `write_access_allowed`, `boost_added`, `chat_background_set` 等。
2. 在 `normalizeTelegramUpdate(update)` 开头检查：若 `isTelegramServiceMessage(message)` 为 `true`，直接返回 `null`。
3. 增加对应单元测试用例，覆盖 `forum_topic_created` 及典型服务消息的过滤断言。

---

## 4. 置信度与影响评估

- **置信度**：>99%（协议与源码逻辑完全吻合，可稳定复现与排除）。
- **影响范围**：仅过滤非会话输入的系统通知事件，不影响任何正常用户文字、图片、文件、语音或贴纸消息。

---

## 5. 验收标准

1. 单元测试：`normalizeTelegramUpdate` 遇到包含 `forum_topic_created` 或其他系统服务字段的消息时返回 `null`。
2. 现有 Telegram 测试用例全部保持通过。
3. 构建打包（`npm run build`）成功。
