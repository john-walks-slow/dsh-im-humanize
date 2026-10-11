# gif-not-animated 用户验证

## 验证说明

- 验证对象：Telegram 渠道通过 `dsh_im_return_file` 返回 `.gif` 后，官方 Telegram 客户端是否**内联播放动画**（而非静态首帧）。
- 环境/前置条件：
  - 已重建 `lib/index.js`（host bundle，2026-09-09），需**重启 dsh web 进程**让 Telegram 渠道重新加载插件（host 代码不走 HMR，不重启不会生效）。
  - 一个已绑定 Telegram 的 DSH 会话。
  - 一张真实的多帧 `.gif`（如 blobcat 系列），文件名保留 `.gif` 扩展名。
  - 官方 Telegram 客户端（非 Telegram X；此前 Telegram X 还有 Rich Message 渲染问题，见 `260909-telegram-unsupported-message`）。
- 不在本次验证范围：
  - 微信 weixin 渠道：iLink 协议无表情消息类型，GIF 经图片消息必然静态，**已定性为协议限制、不修复**。
  - QQ 渠道：未实测，是否同样存在“图片消息不播 GIF”待用户真机确认（见底部待跟进）。

## 验证项

| 验证步骤 | 预期结果 | 实际结果 | 状态 | 备注/证据 |
| -------- | -------- | -------- | ------ | --------- |
| 1. 重启 dsh web 进程，确认 Telegram 渠道 `connected`/`healthy`。 | 渠道状态正常，无启动错误。 | | 待验证 | |
| 2. 在 DSH 会话中让 Agent 调 `dsh_im_return_file` 返回一张 `.gif`（如 blobcat）。 | Telegram 收到一条**动画气泡**，内联循环播放，无文件下载卡片。 | | 待验证 | |
| 3. 同一会话再让 Agent 返回一张 `.png`/`.jpg` 静态图。 | 仍为普通图片气泡（走 `sendPhoto`），行为不变。 | | 待验证 | 回归保护 |
| 4. （可选）观察发送 GIF 期间的 typing 指示器。 | 当前仍显示 `upload_photo`（非 `upload_video`），属已知降级，不影响动画结果。 | | 待验证 | 若介意可后续单独优化 |

## 验证结论

待验证。

## 待跟进

- **QQ 渠道 GIF 是否动**：用户尚未实测。建议按步骤 2 同样在 QQ 渠道发一张 `.gif`。若 QQ 也静态，说明 QQ 官方富媒体 `file_type=1` 图片消息同样不播 GIF，需另查 QQ 是否有对应动图消息类型（可能也要类似 `sendAnimation` 式适配，或降级为文件）。
- **微信 weixin**：已定为协议限制。若用户希望“点开文件可播放”的降级体验，可单独评估把 `image/gif` 改走 `sendFile`（文件卡片，点开由微信图片查看器决定是否播放 GIF），需真机确认。
- **动画 WebP**：`image/webp` 动图仍走 `sendPhoto` → 静态（Telegram `sendAnimation` 官方只覆盖 GIF/无声 H.264，不含 WebP）。若后续需要可单独评估。
