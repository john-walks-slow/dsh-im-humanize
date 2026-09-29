# 任务目标：Telegram 渠道长连接保活与请求重试机制增强

## 1. 背景与排查发现
上一轮在与 Telegram 交互时，出现了一条回复未能成功投递到 Telegram 的现象。
排查发现：
1. **未触发超时逻辑**：
   - 用户原本配置了 `deferredDelivery`（超时延迟交付，在 `harness-reply-timeout` 10 分钟没有进展时生效）。
   - 但在上前回合中，由于 Agent 在前台连续执行了 40+ 步工具调用（持续跑测试与构建，耗时约 34 分钟），每次工具返回都推进了 Harness 会话序列号，导致 `lastProgressAt` 被不断刷新，因此客户端判定会话持续活跃，**完全没有触发 10 分钟超时**，未进入 `deferredDelivery` 队列。
2. **长静默导致连接失效**：
   - 由于关闭了工具进度气泡（`progressStatus: false`），且私聊 draft 流在长达 34 分钟的工具调用期间没有任何输出。
   - 对 Telegram 侧而言，有半个多小时没有任何网络数据交互。
   - 当任务执行完毕，准备调用 Telegram API（如 `sendMessage` / `sendVoice` 或 Rich Draft 的最终结算）投递最终消息时，底层 HTTP 连接（走本地 Clash 7890 代理或 HTTPS Agent）因超长空闲已被远端/代理切断，或者遇到了 `ECONNRESET` / `ETIMEDOUT` / socket hang up 等瞬时网络错误。
   - 最终导致这条完成的文本回复没能投递给用户。

## 2. 改进需求
在 `/root/projects/dsh-im-humanize` 中增强 Telegram 渠道（及相关的 API 通信）：
1. **请求重试机制**：
   - 在 `telegram-api.mjs`（或相关请求封装处）完善对瞬态网络异常（`ECONNRESET`、`ETIMEDOUT`、`UND_ERR_SOCKET`、`fetch failed` 等网络层错误）的自动重试逻辑（可带有限重试与简短退避），避免单次网络抖动或过期连接重用失败直接丢弃消息。
   - 注意不要重试 4xx 业务错误（除非 429 速率限制）。
2. **连接池与 Keep-Alive 保活配置**：
   - 检查 `fetch` / dispatcher / Agent 的 keep-alive 与 timeout 设置，确保长时间空闲后的请求能够安全使用新连接而不是尝试向已死连接写入。
3. **Draft / Typing 阶段性心跳保活（可选/推荐）**：
   - 在流式接收/长时间工具调用等待中，如果处于 private chat 模式，可考虑周期性刷新 draft 或发送 typing action（例如每 1-2 分钟维持一次与 Telegram 的轻量交互），一方面让 Telegram 保持长连接活跃，另一方面也向用户侧表明正在处理。
4. **测试与质量要求**：
   - 运行项目现有测试（`pnpm test`），确保所有现有测试通过。
   - 针对重试与保活机制编写或更新单测。
   - 按照项目的规范输出简洁的实施与验证报告。
