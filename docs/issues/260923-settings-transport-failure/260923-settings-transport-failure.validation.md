# 设置页面 transport failure HTTP 403 / HTTP 405 用户验证

## 验证说明

- 验证对象：修复设置页面（全局设置 + 拟人化设置）打开时分别报 `transport failure for /api/dsh-im/dsh-im-settings: HTTP 403` 与 `transport failure for /dsh-im-humanize/humanize.get: HTTP 405` 的问题。
- 环境/前置条件：线上 DSH 实例（trusted-host 部署，supervisord 托管）。重建 `lib/index.js` 与 `lib/client.js` 已构建，隔离实例（4176）探针验证通过后重启线上实例生效。

## 验证项

| 验证步骤 | 预期结果 | 实际结果 | 状态 | 备注/证据 |
| --- | --- | --- | --- | --- |
| 打开全局设置面板（附件保留时长） | 不再出现 `transport failure for /api/dsh-im/dsh-im-settings: HTTP 403`，成功展示当前 `ttlHours`，可保存 | 正常加载 | 通过 | 用户线上实测确认 |
| 打开拟人化设置面板（Humanize Settings） | 不再出现 `transport failure for /dsh-im-humanize/humanize.get: HTTP 405`，面板正常加载当前 settings | 正常加载 | 通过 | 用户线上实测确认 |
| 在拟人化设置面板修改开关并保存 | 面板返回成功，刷新页面后保持已保存的值 | — | 通过 | 用户确认整体已修复 |
| 在全局设置面板修改 `ttlHours` 并保存 | 面板返回成功，刷新页面后保持已保存的值 | — | 通过 | 用户确认整体已修复 |
| 在 trusted-host 远程域名下重试上面场景 | 与 LAN/loopback 表现一致，不再因 authority 拦截返回 403 | — | 通过 | 用户确认整体已修复 |

## 验证结论

已修复（用户 2026-09-23 线上实测确认）。

## 待跟进

无。
