# 设置页面 transport failure（HTTP 403 / HTTP 405）修复总结

## 背景

设置页面两个面板同时报传输错误：

- 全局设置（附件保留时长）：`transport failure for /api/dsh-im/dsh-im-settings: HTTP 403`
- 拟人化设置：`transport failure for /dsh-im-humanize/humanize.get: HTTP 405`

诊断记录见 [260923-settings-transport-failure.troubleshoot.md](./260923-settings-transport-failure.troubleshoot.md)，用户验证见 [260923-settings-transport-failure.validation.md](./260923-settings-transport-failure.validation.md)。

## 根因

1. **inbound-ttl（403）**：`installInboundTtlRpc` 硬编码 `{ authority: 'loopback' }`，不读 `config.rpcAuthority`。trusted-host 部署下非环回 Host/Origin 的请求被 `registerManagementRpc` 的 loopback 守卫直接 403。这正是 upstream 提交 4d458de（"humanize RPC channel honors config.rpcAuthority (HTTP 403 fix)"）修过 humanize 通道的同一类问题，但 inbound-ttl 通道当时漏掉了。
2. **humanize（405）**：upstream v4.21.2 合并时所有通道 RPC 统一迁移到 `registerManagementRpc` / `callManagementRpc`（走 `/api/dsh-im/...` POST 路由），humanize 通道被遗漏：
   - 客户端仍用 `ctx.connection.rpc.call('/dsh-im-humanize', ...)`，浏览器直接向 `POST /dsh-im-humanize/humanize.get` 发请求，非 `/api` 路径被拒 → 405；
   - 服务端仍调用不存在的 `ctx.connection.rpc.handle`，注册静默失效。

## 修复

| 文件 | 改动 |
| --- | --- |
| `plugin-src/host/inbound-ttl-rpc.mjs` | authority 改为 `resolveRpcAuthority(options.authority ?? options.config?.rpcAuthority)`，跟随部署配置 |
| `plugin-src/host/humanize-rpc.mjs` | 注册迁移到 `registerManagementRpc`（Host Connection Fetch 路由），authority 同样跟随 `config.rpcAuthority`；不可用时优雅降级并返回 `dispose` |
| `plugin-src/client/index.js` | `humanizeRpcCall` 改走 `callManagementRpc`，与其余全部通道一致 |
| `test/management-rpc.test.mjs` | inbound-ttl 按新语义断言（trusted-host 放行 / loopback 拒绝）；新增 humanize 走 management RPC 的集成测试 |
| `test/host.test.mjs` | humanize RPC 夹具从 `connection.rpc.handle` 迁移到 `connection.fetch.register`，改用完整 HTTP envelope 调用 |
| `lib/index.js` / `lib/client.js` | 重新构建 |

## 验证

- 针对性测试 79/79 通过；全量 `npm test` 2880/3087（3 fail / 203 cancelled），失败集全部落在预存 flaky 域（device auth、lark SDK gateway、Discord），与基线一致，无回归。
- 隔离实例（4176，共享 DSH_HOME）探针实测：`settings.inbound-ttl.get` 与 `humanize.get` 均 200 返回正确 JSON。
- 线上实例重启后用户实测确认两个面板恢复正常（"great fixed"）。
