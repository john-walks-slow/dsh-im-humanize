# Issue #85：Telegram 长轮询与发送连接竞争修复方案

日期：2026-08-30。代码基线：v4.0.1 / `92ec91b`。状态：待实施。

需求来源：[Issue #85](https://github.com/xmanrui/dsh-im/issues/85)。本文记录风险分析后的最终实施方案和验收要求；其中列出的测试均为待补测试，不能视为已经通过。

## 1. 结论

本问题不通过增大发送超时、关闭 keep-alive 或重试最终消息解决。最终方案是：

- 每个 Telegram Runtime 创建一个私有、代理感知的 Undici dispatcher。
- 同一 Bot 的长轮询、普通消息、富消息、草稿、文件上传和文件下载共用该 dispatcher。
- 每个 Telegram Bot 对同一来源最多使用 4 条连接；一条长轮询最多占用其中一条，至少保留三条并发发送能力。
- `fetch`、dispatcher 和 `FormData` 使用同一个固定版本的 `undici` 实现。
- Runtime 明确拥有并释放 dispatcher，不修改进程全局 dispatcher。
- 不增加发送重试，不修改现有超时和 `CHANNEL_DELIVERY_UNCERTAIN` 语义。

这个方案只增加一个 Telegram 专用 HTTP 工厂、一个 Runtime 生命周期资源和一个 `FormData` 注入点，不引入通用 Transport 框架、双连接池或用户配置项。

## 2. 根因边界

### 2.1 已确认的错误链路

当前 Telegram Runtime 只创建一个 `TelegramApi`，长轮询和所有出站调用都通过它使用默认全局 `fetch`：

1. Runtime 启动 `getUpdates(timeout: 25)` 长轮询。
2. 收到消息后，`bridge.accept()` 以异步方式继续处理，poller 会立即进入下一次长轮询。
3. 发送消息、草稿、正在输入状态、文件上传等操作因此会与下一次长轮询并发。
4. 如果宿主进程的全局 dispatcher、代理或连接路径把这些请求串行化，发送调用会排在长轮询后面。
5. 普通发送默认 15 秒超时，而长轮询可持续 25 秒，发送先发生超时。
6. Telegram API 将超时标记为 `deliveryOutcome = unknown`，共享错误链最终转换为 `CHANNEL_DELIVERY_UNCERTAIN`。

因此，`CHANNEL_DELIVERY_UNCERTAIN` 是发送结果确实无法确认时的正确下游表现，不应通过改错误分类掩盖。

### 2.2 Issue 中不能直接当成根因的部分

“Node 默认 Undici 只有一条 HTTP/1.1 连接”并不是正常默认配置。Undici 默认 Agent 会为同一来源使用 Pool，并可在已有连接繁忙时建立新连接。独立 Agent 能改善报告环境中的表现，说明问题位于 HTTP 传输路径，但不能单独证明默认连接池固定为一条连接。

更准确的工程根因是：

> dsh-im 明知 Telegram 长轮询与出站请求会并发，却让两类请求共同依赖进程中可变、不可控的全局 HTTP 传输策略。

实际触发因素可能是宿主安装过自定义全局 dispatcher、代理连接池受限、连接器异常，或特定网络路径发生串行化。修复目标不是猜测报告环境的唯一配置，而是让 Telegram 的并发能力不再依赖该全局状态。

## 3. 范围与非目标

| 项目 | 决定 |
| --- | --- |
| 修复范围 | Telegram Bot API、Telegram 文件上传和平台文件下载 |
| dispatcher 作用域 | 每个 Telegram Runtime / Bot 一个私有实例 |
| 同源连接数 | 固定 4 条，不新增用户设置 |
| 代理 | 支持 `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY` 及对应小写变量 |
| 全局 dispatcher | 不读取、不替换、不修改 |
| 发送超时 | 保持现有默认值 |
| 长轮询超时 | 保持现有 25 秒及现有超时余量 |
| 发送重试 | 不新增，防止消息重复 |
| 错误分类 | 保持现有 uncertain 语义 |
| 双连接池 | 不做；一个 4 连接池已经能隔离全局状态并满足并发 |
| 通用 Transport 抽象 | 不做；只增加 Telegram 专用工厂函数 |
| UI 和配置迁移 | 不涉及 |

## 4. HTTP 实现

### 4.1 固定同一份 Undici 实现

增加精确版本运行时依赖 `undici@7.29.0`。该版本要求 Node `>=20.18.1`，低于项目当前的 Node `>=22.19` 下限。

不能采用以下组合：

```js
globalThis.fetch(url, { dispatcher: npmUndiciAgent });
```

也不能把全局 `FormData` 直接交给 `undici.fetch()`。Undici 明确要求 `fetch` 与 `FormData` 来自同一个实现；混用不同版本或不同实现创建的 Web API 对象可能抛错，文件上传是最容易受影响的路径。

### 4.2 新增 Telegram 专用工厂

新增 `src/channels/telegram/telegram-http.mjs`，只提供一个小型工厂函数：

```js
import {
  EnvHttpProxyAgent,
  FormData as UndiciFormData,
  fetch as undiciFetch,
} from 'undici';

const TELEGRAM_HTTP_CONNECTIONS = 4;

export function createTelegramHttpTransport() {
  const dispatcher = new EnvHttpProxyAgent({
    connections: TELEGRAM_HTTP_CONNECTIONS,
  });

  return {
    fetchImpl: (url, options = {}) => undiciFetch(url, {
      ...options,
      dispatcher,
    }),
    FormDataImpl: UndiciFormData,
    destroy: () => dispatcher.destroy(),
  };
}
```

约束：

- `dispatcher` 必须在展开 `options` 后写入，调用方不能意外覆盖 Runtime 所拥有的 dispatcher。
- 不调用 `setGlobalDispatcher()`。
- 不设置 `keepAliveTimeout` 或 `keepAliveMaxTimeout`；Issue 建议中的 `30`、`60` 在 Undici 中是毫秒，不是秒，而且本问题不需要靠调整它们解决。
- transport 不记录请求 URL；Telegram Token 位于 URL path 中。
- `destroy()` 由资源所有者调用，transport 本身不实现重试或超时。

### 4.3 为什么使用 EnvHttpProxyAgent

裸 `Agent` 会绕过宿主通过标准代理环境变量表达的网络策略。`EnvHttpProxyAgent` 会读取：

- `HTTP_PROXY` / `http_proxy`
- `HTTPS_PROXY` / `https_proxy`
- `NO_PROXY` / `no_proxy`

没有代理变量时直接连接；存在代理变量时复用 Undici 已有代理机制，不在项目内自行解析代理地址或实现 CONNECT。

任意通过代码安装的全局 dispatcher、拦截器或自定义 connector 不会自动继承。这是有意的隔离边界，否则会重新引入 Issue #85 的全局耦合。特殊嵌入环境通过现有 `createApi`、`fetchImpl` 以及新增的 `createHttpTransport` 注入点覆盖，不新增用户界面配置。

## 5. TelegramApi 调整

修改 `src/channels/telegram/telegram-api.mjs`：

1. 构造函数增加 `FormDataImpl = globalThis.FormData`。
2. 校验 `FormDataImpl` 可构造并保存为私有字段。
3. `#sendArtifact()` 使用注入的实现创建 multipart body。
4. 直接构造 `new TelegramApi({ token })` 时仍使用全局 `fetch + FormData`，保持已有调用兼容。
5. Runtime 注入时使用 `undici.fetch + undici.FormData`，保证实现匹配。

示意：

```js
constructor({
  token,
  fetchImpl = fetch,
  FormDataImpl = FormData,
  baseUrl = DEFAULT_BASE_URL,
  fileUploadTimeoutMs = DEFAULT_FILE_UPLOAD_TIMEOUT_MS,
}) {
  // 现有校验保持不变
  this.#fetch = fetchImpl;
  this.#FormDataImpl = FormDataImpl;
}

async #sendArtifact(/* ... */) {
  const payload = new this.#FormDataImpl();
  // 沿用现有 append 和错误映射
}
```

不改变请求 payload、超时、redirect 策略、文件大小处理和 provider 错误映射。

## 6. TelegramRuntime 调整

### 6.1 创建和注入

修改 `src/channels/telegram/telegram-runtime.mjs`：

- 增加 `#createHttpTransport` 和 `#httpTransport`。
- 构造函数默认 `createHttpTransport = createTelegramHttpTransport`，作为生命周期测试和特殊嵌入环境的最小注入点。
- `#start()` 在 Harness 就绪后创建 transport，并复用现有 `createApi`：

```js
const transport = this.#createHttpTransport();
this.#httpTransport = transport;

const api = this.#createApi({
  token: this.#token,
  fetchImpl: transport.fetchImpl,
  FormDataImpl: transport.FormDataImpl,
});
this.#api = api;
```

transport 必须在调用 `createApi` 前登记到 Runtime；这样 `createApi` 或随后任意启动步骤抛错时，统一的 `stop()` 都能释放它。

### 6.2 正常停止顺序

`stop()` 按以下顺序执行：

1. 捕获当前 `pollTask`、bridge 和 transport。
2. 立即把 `#httpTransport` 清空，防止重复销毁或旧周期销毁新周期资源。
3. abort 当前 Runtime 的 `AbortController`。
4. 清空 `#abortController`、`#pollTask`、`#api`、`#bridge`。
5. 沿用现有有界等待，等待 poll 和 bridge 退出。
6. 调用捕获的 `transport.destroy()`。
7. transport 清理失败只记录脱敏 warning，不覆盖原始启动或运行错误，也不让 `stop()` 失败。
8. 最后进入 `idle`。

这里使用 `destroy()` 而不是 `close()`：停止 Runtime 本身就是取消语义，`close()` 可能继续等待尚未返回的 25 秒长轮询。先 abort、再有界等待、最后 destroy，可以保留现有清理窗口，又不会让停止过程无限挂起。

### 6.3 启动失败和竞态

以下路径全部复用同一清理逻辑：

- `getMe` 失败。
- Token 身份不匹配。
- Webhook 已配置。
- 命令菜单以外的启动步骤失败。
- transport 或 `createApi` 创建失败。
- 启动过程中外部调用 `stop()`。
- 重连时先停止旧 Runtime，再创建新 transport。

异步回调必须捕获本次启动使用的 controller 和 transport，并在操作字段前比较身份。旧 poll 或旧清理任务不能销毁重启后新建的 transport。

### 6.4 poll 意外终止

非主动 abort 导致 poll 退出时：

1. 立即把状态标记为 `failed`，保留原始错误。
2. 停止接受新的发送测试。
3. 给已开始的 bridge 工作保留现有有界清理窗口。
4. 随后 abort 本启动周期并销毁它拥有的 transport。
5. 清理过程不能把 `failed` 状态覆盖成 `idle`；后续由现有连接 supervisor 触发重建。

这部分可提取一个 Runtime 私有清理函数复用，但不新增公共生命周期抽象。

## 7. Token 检查的一致性

`inspectTelegramToken()` 是接入机器人前的 `getMe` 调用。如果 Runtime 使用环境代理，而 Token 检查仍使用另一套全局网络策略，可能出现检查和运行行为不一致。

调整规则：

- 调用者显式传入 `fetchImpl` 时继续使用它，函数不拥有也不释放该 fetch 的资源。
- 未传入 `fetchImpl` 时，临时创建 `createTelegramHttpTransport()`。
- 使用其 `fetchImpl` 和 `FormDataImpl` 创建一次性 `TelegramApi`。
- 无论成功或失败，都在 `finally` 中销毁临时 transport。
- 不能把 Bot Token 或完整请求 URL写入错误和日志。

Token 检查不与已运行 Bot 共享 dispatcher，避免短生命周期检查错误地关闭 Runtime 连接。

## 8. 依赖、构建和文档改动

| 文件 | 计划改动 |
| --- | --- |
| `package.json` | 增加精确运行时依赖 `undici: 7.29.0` |
| `package-lock.json` | 更新锁文件 |
| `src/channels/telegram/telegram-http.mjs` | 新增 Telegram 专用 transport 工厂 |
| `src/channels/telegram/telegram-api.mjs` | 增加匹配的 `FormDataImpl` 注入和一次性 Token 检查 transport |
| `src/channels/telegram/telegram-runtime.mjs` | 创建、持有并释放私有 transport |
| `plugin-src/host/build.mjs` | 把 `undici` 加入 `externalRuntimePackages`，不打入 Host bundle |
| `scripts/verify-package.mjs` | 校验 `undici` 为精确直接依赖，并验证 bundle 外置约束 |
| `THIRD_PARTY_NOTICES.md` | 增加 Undici 许可信息 |
| `README.md`、`README.en.md` | 简述 Telegram 私有连接池及标准代理变量支持 |
| `CHANGELOG.md` | 记录 Issue #85 修复、网络策略边界和无自动重试 |
| `lib/index.js` | 通过现有构建命令重新生成，不手工编辑 |

## 9. 自动化测试方案

新增 `test/channels/telegram/telegram-http.test.mjs`，并在现有 `test/channels/telegram/telegram.test.mjs` 补充 API 和 Runtime 测试。所有网络测试只使用本地 server，不访问真实 Telegram。

### 9.1 核心回归：长轮询不能阻塞发送

测试步骤：

1. 启动本地 HTTP Server。
2. 构造使用真实 Telegram transport 的 `TelegramApi`，把 `baseUrl` 指向本地 server。
3. server 收到 `/getUpdates` 后记录事件并保持响应未完成。
4. 确认长轮询已经开始后调用 `sendChatAction`。
5. server 立即响应发送请求。
6. 断言 `sendChatAction` 在释放 `/getUpdates` 前已经完成。
7. 最后释放长轮询并清理 server 和 transport。

断言依据是 Promise 和服务端事件的先后顺序，不使用“必须在 500ms 内完成”之类容易抖动的性能阈值；只保留一个较宽的失败截止时间防止测试挂死。

### 9.2 连接容量

同时阻塞：

- 1 个 `getUpdates`。
- 3 个短 API 请求。

断言四个请求都已经到达 server，再统一释放。这证明长轮询占用一条连接时仍有三条独立发送连接。

不要求第 5 个请求必须排队，避免测试绑定 Undici 不必要的内部调度细节。

### 9.3 全局 dispatcher 隔离

在独立子进程中：

1. 把全局 dispatcher 设置为 `connections: 1`。
2. 通过全局 fetch 发起一个不会立即返回的请求，占住全局连接。
3. 创建 Telegram 私有 transport。
4. 断言 Telegram 请求仍然到达并完成。

该测试必须使用子进程，不能在主测试进程中修改全局 dispatcher 后依赖恢复，以免并行测试互相污染。

### 9.4 代理与 NO_PROXY

使用独立子进程、本地目标 server 和本地 HTTP 代理：

- 设置 `HTTP_PROXY` 后，请求必须经过代理。
- 设置 `NO_PROXY` 匹配目标地址后，请求必须直连。
- transport 销毁后代理侧连接最终关闭。
- 测试环境变量不泄漏到其他测试。

不在测试中实现企业 TLS 中间人或连接池；只验证项目选择的标准代理语义。

### 9.5 真实 multipart 上传

不能只保留 fake fetch 对 `FormData` 字段的检查。新增通过真实 `undici.fetch` 发往本地 server 的集成测试：

- `sendDocument` 的 `Content-Type` 含合法 multipart boundary。
- 正确包含 `chat_id`、`message_thread_id` 和 `reply_parameters`。
- 文件名、媒体类型和二进制内容正确。
- `sendPhoto` 覆盖相同路径。
- 请求能够完成，不出现跨实现 `FormData` 错误。

现有注入 fake fetch 的单元测试继续保留，用于检查 API payload；新测试只补真实序列化和传输风险。

### 9.6 Runtime 生命周期

通过 `createHttpTransport` 注入带计数器的 fake transport，覆盖：

| 场景 | 必须断言 |
| --- | --- |
| 正常 `start → stop` | transport 只销毁一次 |
| 连续两次 `stop()` | 不重复销毁、不抛错 |
| `getMe` 失败 | 已创建 transport 被销毁 |
| Bot 身份不匹配 | transport 被销毁，原错误保留 |
| Webhook 已配置 | transport 被销毁，原错误保留 |
| `createApi` 抛错 | transport 仍被销毁 |
| 启动期间调用 `stop()` | 启动被取消，无未处理 rejection |
| `start → stop → start` | 旧 transport 在新周期前销毁，两者互不影响 |
| poll 非主动失败 | 状态保持 `failed`，对应 transport 最终销毁 |
| 两个 Runtime 并存 | 停止其中一个不会销毁另一个的 transport |

测试不能通过读取活跃句柄数量推测资源是否释放；应直接验证注入资源的所有权和调用次数。

### 9.7 Token 检查生命周期

- 默认路径成功时销毁一次临时 transport。
- `getMe` 失败时仍销毁一次。
- 显式传入 `fetchImpl` 时不创建默认 transport。
- Token 检查和 Runtime 使用独立资源，关闭前者不影响后者。

### 9.8 错误语义和重复投递

保留并加强现有超时测试：

- transport timeout 继续映射为 `telegram-timeout`。
- `deliveryOutcome` 继续为 `unknown`。
- 上层继续得到 `CHANNEL_DELIVERY_UNCERTAIN`。
- 一次发送只调用一次 fetch。
- 不自动重试 `sendMessage`、`sendRichMessage`、`editMessageText` 或文件上传。
- 不改变现有 15 秒发送超时和 120 秒文件上传超时。

### 9.9 Token 泄漏

分别模拟：

- 连接失败。
- 代理失败。
- poll 失败。
- 文件上传失败。
- dispatcher 销毁失败。

检查 error message、stack、cause 的安全格式和 logger 参数序列化结果，均不能包含完整 Bot Token 或 `/bot<token>/...` URL。

### 9.10 发布包和 Node 版本

至少执行：

```text
Node 22.19：npm run check
Node 24：npm run check
npm pack
在空临时目录安装生成的 tarball
导入发布包 lib/index.js
通过发布包执行一次本地 Telegram transport 请求
```

发布包 smoke test 用于发现：

- `undici` 未声明为运行时依赖。
- `undici` 被错误打入 Host bundle。
- lockfile 与清单版本不一致。
- 生成文件没有更新。
- 源码环境能运行、干净安装后却无法解析依赖。

## 10. 风险与闭环

| 风险 | 等级 | 方案内处理 | 验证方式 |
| --- | --- | --- | --- |
| 私有 Agent 绕过代理 | 高 | 使用 `EnvHttpProxyAgent` | 代理与 `NO_PROXY` 子进程测试 |
| 不继承自定义全局 dispatcher | 中 | 明确隔离边界，保留注入点，不偷偷回退全局 | 自定义 transport 注入测试和文档 |
| Node 内置 fetch 与 npm Agent 不兼容 | 高 | fetch、dispatcher、FormData 全部来自同一固定依赖 | Node 22/24 与真实 multipart 测试 |
| 固定 4 连接仍可能排队 | 中 | 一条 poll + 三条发送；不无限开连接 | 一加三并发屏障测试 |
| 多 Bot 增加 socket 上限 | 低 | 每 Bot 固定最多 4 条且按需建立 | 双 Runtime 所有权测试 |
| 启动失败泄漏 dispatcher | 中 | 创建后立即登记，所有失败统一清理 | 各启动失败测试 |
| stop/start 销毁错代资源 | 中 | 捕获本周期资源并做身份比较 | 启停竞态和重启测试 |
| destroy 导致在途发送 uncertain | 中 | 先 abort 和有界等待；只在停止或运行周期失败时 destroy | 停止期间在途请求测试 |
| 自动重试产生重复消息 | 高 | 本期明确不增加重试 | fetch 调用次数断言 |
| Token 出现在 Undici 诊断中 | 高 | 不记录 URL，增加日志脱敏验收 | 多错误路径 Token 泄漏测试 |
| 修改全局 dispatcher 的测试污染套件 | 中 | 使用独立子进程 | 并行运行完整测试套件 |
| 外部代理本身只允许单路并发 | 残余 | 应用无法绕过外部基础设施限制，保持明确超时和诊断 | 文档说明；不承诺代码内解决 |

## 11. 明确不采用的替代方案

### 11.1 只增加测试、不调整设计

测试只能暴露问题，不能消除代理绕过、跨 Undici 实现混用和生命周期泄漏，因此不足以作为最终方案。

### 11.2 增大发送超时

只会延迟失败；如果请求仍排在长轮询后面，无法保证任何固定值足够，还会让用户更晚看到错误。

### 11.3 自动重试最终发送

超时发生在请求结果未知的阶段，Telegram 可能已经收到消息。盲目重试会产生重复消息或重复文件。

### 11.4 `Connection: close`

会牺牲所有请求的连接复用，增加 TLS 建连成本，不能表达清晰的资源所有权，也不能可靠继承代理策略。

### 11.5 等待 bridge 完成后再继续 poll

会破坏当前交互能力：Harness 等待用户回答时，Telegram 必须继续拉取下一条 update 才能收到答案。

### 11.6 poll 和 send 分成两套连接池

会增加两份代理配置、生命周期和测试面。一个 4 连接的私有 dispatcher 已经保证长轮询不会独占所有连接，没有必要增加第二套资源。

### 11.7 修改全局 dispatcher

会影响其他 IM 渠道、更新检查和宿主自身网络调用，并可能覆盖宿主已有代理或安全策略，风险明显大于局部修复。

## 12. 实施顺序

1. 增加并外置固定版本的 `undici` 依赖，更新清单、锁文件、校验器和第三方声明。
2. 新增 Telegram HTTP 工厂及其直接并发、代理和全局隔离测试。
3. 为 `TelegramApi` 增加匹配的 `FormDataImpl`，补真实 multipart 测试。
4. 在 Runtime 中接入 transport 所有权和正常停止清理，补启动失败和重启测试。
5. 处理 poll 非主动失败的有界清理和代际竞态测试。
6. 让默认 Token 检查使用一次性同策略 transport，补成功和失败清理测试。
7. 运行 Telegram 现有测试，确认错误分类和交互轮询行为没有变化。
8. 更新中英文文档和 changelog，通过 Node 22.19、Node 24、`npm run check` 与发布包 smoke test。

## 13. 验收标准

以下条件全部满足才能认为 Issue #85 已彻底修复：

- `getUpdates` 被无限期阻塞时，短 Telegram API 请求仍能在释放 poll 前完成。
- 一条 poll 与三条并发发送可以同时到达服务端。
- 即使全局 dispatcher 被限制为一条连接，Telegram 私有 transport 仍可正常请求。
- 标准代理和 `NO_PROXY` 行为正确。
- 文档、图片上传使用真实 multipart 成功，不存在混用 `FormData`。
- 正常停止、启动失败、重连和 poll 崩溃均不泄漏或误销毁 transport。
- 现有 Harness 交互场景继续在原 Turn 未结束时拉取回答 update。
- 现有 timeout、unknown delivery 和 `CHANNEL_DELIVERY_UNCERTAIN` 语义保持不变。
- 没有新增最终消息重试或重复投递。
- 任何日志和错误中都没有完整 Telegram Token。
- Node 22.19、Node 24、完整测试、构建校验和干净发布包安装全部通过。

## 14. 参考资料

- [Issue #85](https://github.com/xmanrui/dsh-im/issues/85)
- [Undici Agent](https://github.com/nodejs/undici/blob/main/docs/docs/api/Agent.md)
- [Undici EnvHttpProxyAgent v7.29.0](https://github.com/nodejs/undici/blob/v7.29.0/docs/docs/api/EnvHttpProxyAgent.md)
- [Undici Fetch v7.29.0](https://github.com/nodejs/undici/blob/v7.29.0/docs/docs/api/Fetch.md)
- [Undici v7.29.0 package.json](https://github.com/nodejs/undici/blob/v7.29.0/package.json)
- [Node.js fetch 自定义 dispatcher](https://nodejs.org/dist/latest/docs/api/globals.html#custom-dispatcher)
