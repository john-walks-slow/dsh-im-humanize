# 诊断报告：设置页面 transport failure HTTP 403 / HTTP 405 问题排查

## 1. 现象描述

用户在 Web GUI 打开设置页面时，界面提示两个网络传输错误：
1. `transport failure for /api/dsh-im/dsh-im-settings: HTTP 403`
2. `transport failure for /dsh-im-humanize/humanize.get: HTTP 405`
点击“重试”依然复现。

---

## 2. 根因分析 (Root Cause Analysis)

### 2.1 报错 1：`/api/dsh-im/dsh-im-settings: HTTP 403`

- **涉及模块**：`plugin-src/host/inbound-ttl-rpc.mjs` 中的 `installInboundTtlRpc` 与全局附件设置（Inbound TTL）。
- **根本原因**：
  在 `plugin-src/host/inbound-ttl-rpc.mjs` 中，RPC 注册硬编码了 `{ authority: 'loopback' }`：
  ```javascript
  return registerManagementRpc(ctx,
    INBOUND_TTL_RPC_CHANNEL,
    createInboundTtlRpcHandler({ ...runtime, logger }),
    { authority: 'loopback' },
  );
  ```
  而在 `plugin-src/management-rpc.mjs` 的安全守卫中：
  ```javascript
  if (policy === 'loopback' && !isLoopbackRequest(request)) return new Response('forbidden', { status: 403 });
  ```
  用户当前是通过远程域名（如 `--trusted-host dsh.johnnren.qzz.io`）或局域网 IP 访问 DSH Web GUI，请求中的 `Host` 头不是 `127.0.0.1` 或 `localhost`。因此，`isLoopbackRequest` 返回 `false`，安全守卫直接拦截并返回 **HTTP 403 Forbidden**。
  虽然 `cordis.patch.yml` 中已为插件显式配置了 `rpcAuthority: trusted-host`，但 `installInboundTtlRpc` 没有读取该配置，硬编码覆盖了 loopback 策略。

### 2.2 报错 2：`/dsh-im-humanize/humanize.get: HTTP 405`

- **涉及模块**：`plugin-src/client/index.js`（`humanizeRpcCall`）与 `plugin-src/host/humanize-rpc.mjs`（`installHumanizeRpc`）。
- **根本原因**：
  在 upstream 4.21.2 重构中，上游统一将所有 RPC 迁移为 `registerManagementRpc` / `callManagementRpc`，即走 `/api/dsh-im/...` POST 路由。
  但在合并 upstream 时，属于 fork 特有功能的拟人化设置（humanize）遗漏了该迁移：
  1. **客户端（`plugin-src/client/index.js:480`）**：
     仍然使用旧的直接调用方式：
     ```javascript
     const humanizeRpcCall = (endpoint, payload, signal) =>
       ctx.connection.rpc.call(HUMANIZE_RPC_CHANNEL, endpoint, payload, signal);
     ```
     其中 `HUMANIZE_RPC_CHANNEL = '/dsh-im-humanize'`。在 DSH 客户端中，这会直接向浏览器发送 `POST /dsh-im-humanize/humanize.get` 请求。
     但 DSH Host 仅在 `/api/...` 下暴露 HTTP 端点，未认领的根路径 POST 请求被静态服务器等拦截，返回 **HTTP 405 Method Not Allowed**。
  2. **服务端（`plugin-src/host/humanize-rpc.mjs:64-77`）**：
     仍然尝试调用 `ctx.connection.rpc.handle(HUMANIZE_RPC_CHANNEL, ...)`，而 DSH Host 的 `connection.rpc` 并不存在 `handle` 方法，导致服务端的 RPC 实际上也未挂载成功。

---

## 3. 现象与根因的关联 (Symptom-Cause Mapping)

| 报错现象 | 对应调用链 | 拦截点 | 根因 |
|---|---|---|---|
| `transport failure for /api/dsh-im/dsh-im-settings: HTTP 403` | 客户端 `GlobalSettingsPanel` 加载 `settings.inbound-ttl.get` | `registerManagementRpc` 中的 `policy === 'loopback'` 校验 | `installInboundTtlRpc` 硬编码 `{ authority: 'loopback' }`，拒绝来自 trusted-host 的请求 |
| `transport failure for /dsh-im-humanize/humanize.get: HTTP 405` | 客户端 `HumanizeSettingsPanel` 加载 `humanize.get` | Web 服务器非 `/api` 路径的 POST 请求 | 客户端未走 `callManagementRpc`（直接请求 `/dsh-im-humanize/humanize.get`），服务端未用 `registerManagementRpc` 注册 |

两个报错完美吻合，无任何未解释现象。

---

## 4. 修复路径 (Fix Plan)

属于典型的单点接口适配修复（3A 类）：

### 4.1 修复 `inbound-ttl-rpc.mjs`
允许 `installInboundTtlRpc` 尊重传入的 `authority` 或 `config.rpcAuthority`（在未指定时回落到 `resolveRpcAuthority(options.authority ?? options.config?.rpcAuthority)`）：
```javascript
export function installInboundTtlRpc(ctx, options = {}) {
  const runtime = options.runtime ?? getInboundTtlRuntime(ctx, options.config);
  const logger = typeof ctx?.logger === 'function'
    ? ctx.logger('dsh-im:inbound-ttl') : (ctx?.logger ?? null);
  const authority = resolveRpcAuthority(options.authority ?? options.config?.rpcAuthority);
  return registerManagementRpc(ctx,
    INBOUND_TTL_RPC_CHANNEL,
    createInboundTtlRpcHandler({ ...runtime, logger }),
    { authority },
  );
}
```
并在 `test/management-rpc.test.mjs` / `test/inbound-ttl.test.mjs` 中更新或补充相应测试用例。

### 4.2 修复 `humanize-rpc.mjs` 与客户端挂载
1. **服务端（`plugin-src/host/humanize-rpc.mjs`）**：
   引入 `registerManagementRpc`，移除对 `ctx.connection.rpc.handle` 的无效判断，使用 `registerManagementRpc` 注册：
   ```javascript
   import { registerManagementRpc } from '../management-rpc.mjs';
   ...
   const dispose = registerManagementRpc(
     ctx,
     HUMANIZE_RPC_CHANNEL,
     (endpoint, payload, signal) => {
       if (!validHumanizePayload(endpoint, payload)) {
         return Promise.resolve({
           ok: false,
           error: { code: 'bad-request', message: 'Invalid humanization request.' },
         });
       }
       return handler(endpoint, payload, signal);
     },
     { authority: resolveRpcAuthority(authority ?? config.rpcAuthority) },
   );
   ```
2. **客户端（`plugin-src/client/index.js`）**：
   将 `humanizeRpcCall` 统一接入 `callManagementRpc`：
   ```javascript
   const humanizeRpcCall = (endpoint, payload, signal) =>
     callManagementRpc(ctx.connection, HUMANIZE_RPC_CHANNEL, endpoint, payload, signal);
   ```
3. **重新打包（`npm run build`）**：
   更新 `lib/index.js` 和 `lib/client.js`。

---

## 5. 置信度 (Confidence Level)

**确信度：99%**
- 代码路径、请求 URL、HTTP 状态码（403/405）完全与 DSH 规范及源码匹配；
- 其它所有正常工作的 IM 渠道（Feishu, Telegram, QQ 等）均采用此标准模式。

---

## 6. 验收标准 (Acceptance Criteria)

1. **单元测试与集成测试**：
   - 现有的 `management-rpc.test.mjs` 及 humanize 测试用例通过；
   - 增加针对 `inbound-ttl` 在 `rpcAuthority: 'trusted-host'` 下放行的测试；
   - 增加针对 `humanize` 通过 `callManagementRpc` 和 `registerManagementRpc` 交互的测试。
2. **构建产物验证**：
   - `npm run build` 成功无报错，生成更新后的 `lib/client.js` 和 `lib/index.js`。
3. **真实环境验证**：
   - 重启/重载后，在设置页面中切换至“全局设置”和“拟人化设置”，不再出现 HTTP 403 和 HTTP 405 报错，能够正常加载并保存配置。
