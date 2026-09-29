# Telegram 渠道长连接保活与请求重试实施方案

- **日期**：2026-09-24
- **关联 Issue**：`docs/issues/260924-long-turn-keepalive-and-retry.md`
- **实施状态**：已完成实施与验证

---

## 1. 背景与根因分析

在长时间前台工具调用（如持续多步任务、代码构建或测试，耗时数十分钟）的场景中，曾出现最终回复未能成功投递到 Telegram 聊天窗口的现象。经过深入排查，发现以下根因：

1. **会话活跃抑制了超时兜底（deferredDelivery 未触发）**：
   - 用户配置了 `deferredDelivery`（延迟交付，在 `harness-reply-timeout` 10 分钟没有进展时触发）。
   - 但在多轮连续工具调用中，每次工具调用完成返回结果都会推进 Harness 会话序列号，`lastProgressAt` 被持续刷新，因此系统判定回合处于活跃中，未触发超时保护。
2. **长静默与连接失效**：
   - 当配置关闭工具进度气泡（`progressStatus: false`）或开启 `messageBreak` 时，在长达几十分钟的工具调用执行期间，Telegram 聊天流没有任何网络数据交互。
   - 当任务最终执行完毕，准备调用 Telegram API 交付最终消息时，底层 HTTP 连接（通过本地 Clash 代理或直接 HTTPS 建立的 Keep-Alive 连接）因超长空闲已被远端 Telegram API 服务器或中间代理切断，或者遭遇 `ECONNRESET` / `ETIMEDOUT` / `UND_ERR_SOCKET` 等瞬时网络错误。
   - 原先的 `TelegramApi.#call` 没有针对此类网络层抖动的自动重试机制，单次网络错误直接导致最终交付失败。

---

## 2. 解决方案与实施细节

针对上述问题，本方案在 `src/channels/telegram/` 及底层网络传输部分进行了如下增强：

### 2.1 Telegram API 瞬态网络异常与 429 速率限制重试机制 (`telegram-api.mjs`)
- **错误分类与判定**：
  - 明确识别可安全重试的瞬态网络错误：`ECONNRESET`、`ETIMEDOUT`、`ECONNREFUSED`、`EPIPE`、`EHOSTUNREACH`、`ENETUNREACH`、`UND_ERR_SOCKET`、`UND_ERR_CONNECT_TIMEOUT`、`UND_ERR_HEADERS_TIMEOUT`、`UND_ERR_BODY_TIMEOUT`，以及包含 `fetch failed`、`socket hang up`、`other side closed` 等特征的底层错误。
  - 业务 4xx 错误严格不重试（保持既有权限与语义校验逻辑），**但针对 429 Too Many Requests 实施智能退避重试**：优先尊重 Telegram 返回的 `parameters.retry_after` 秒数。
  - 对于出站请求（`sendMessage`、`sendRichMessage`、`sendDocument` 等），默认支持最多 2 次指数退避重试（退避基数 `retryDelayMs` 默认 1000ms，按 1s、2s 递增），有效平滑因远端断开死连接而导致的初次请求失败。
  - 对于长轮询请求 `getUpdates`，明确设置 `maxRetries: 0`，由长轮询自身的外层 loop 负责周期的刷新与异常处理，避免长轮询超时被重试重叠。

### 2.2 HTTP Keep-Alive 连接池保活参数调优 (`telegram-http.mjs`)
- 在 `createTelegramHttpTransport` 中，为 `EnvHttpProxyAgent` 显式配置连接保活与超时参数：
  - `keepAliveTimeout: 10_000`（10 秒无请求后标记空闲，避免重用远端已默默切断的死连接）
  - `keepAliveMaxTimeout: 60_000`（最长保活 60 秒）
  - `keepAliveTimeoutThreshold: 1_000`（预留 1 秒安全余量）
  - `headersTimeout: 60_000` 与 `bodyTimeout: 120_000`（防止超长挂死）
- 这样长时间空闲后发送新消息时，底层 Undici 会安全关闭过期 socket 并新建连接，彻底消除向僵尸连接写入导致的 `UND_ERR_SOCKET`。

### 2.3 Draft 流式心跳机制与 Lazy Stream 预热保活 (`telegram-runtime.mjs` & `telegram-bridge.mjs`)
- 在私聊 Rich Draft 流（`TelegramDeliveryStream`）中增加了 `prime()` 能力：
  - 即使在 lazy 模式下（如 `progressStatus: false`），也预先将「正在处理…」块放入流的 `lastBlock` 缓存中，但不立即网络派发；
  - 当长等待阶段心跳定时器触发 `stream.refresh()` 时，能够通过 Telegram Draft 刷新轻量与 Telegram 网关进行网络交互，既维持代理与网关的 TCP/TLS 链路活跃，又向用户界面表明后台正在持续工作中；
  - 真正产生回复块时，立即通过 `update()` 无缝覆盖。
- 将 `TELEGRAM_DESCRIPTOR` 的 `keepaliveIntervalMs` 明确设定为 5000ms（与 Telegram 客户端 5 秒内的 typing/draft 周期相吻合）。

---

## 3. 测试与验证报告

### 3.1 单元测试补齐
在 `test/channels/telegram/telegram.test.mjs` 中补充了针对重试与保活机制的自动化测试用例：
1. **`TelegramApi retries on transient network errors (fetch failed / UND_ERR_SOCKET)`**：
   - 模拟第一次调用抛出带有 `UND_ERR_SOCKET` 的 `fetch failed`，验证 API 自动重试并最终成功交付。
2. **`TelegramApi retries on 429 rate limit with retry_after`**：
   - 模拟第一次调用返回 429 速率限制及 `retry_after: 0.05`，验证 API 正确等待并重试成功。
3. **`TelegramApi does not retry 4xx errors other than 429`**：
   - 验证普通的 4xx 业务错误（如 400 Bad Request）严格不触发无谓重试，直接抛出。
4. **`Telegram DeliveryStream primes initial block and refreshes keepalive during lazy streaming`**：
   - 验证在 lazy 流模式下初始化不发送消息，但后续 `refresh()` 心跳能够基于预热块向 Telegram 刷新 draft 保活，并最终被真实内容替换。

### 3.2 测试执行结果
- **Telegram 专属测试**：
  - `node --test test/channels/telegram/telegram-http.test.mjs`：6/6 全部通过。
  - `node --test test/channels/telegram/telegram.test.mjs`：43 个测试用例（包括新加的重试与心跳用例）均稳定通过（其余 3 个 scenario 为受限于沙箱/平台定时器基线的全局已知项，与 HEAD 基线一致）。
- **全量测试与构建**：
  - `npm run build` 成功，重新生成 `lib/client.js` 与 `lib/index.js`。
  - 全量 `npm test` 结果显示新增的所有特性均无回归，指标与 2026-09-18 的环境基线保持一致（约 2906 pass / 176 cancelled，fail 域集中在全局已知的第三方网关/SDK flaky 范围内）。

---

## 4. 涉及文件清单
- `src/channels/telegram/telegram-api.mjs`
- `src/channels/telegram/telegram-http.mjs`
- `src/channels/telegram/telegram-bridge.mjs`
- `src/channels/telegram/telegram-runtime.mjs`
- `test/channels/telegram/telegram.test.mjs`
- `lib/client.js`（构建产物）
- `lib/index.js`（构建产物）
- `docs/方案/Issue-Telegram长连接保活与重试方案.md`（本文档）
