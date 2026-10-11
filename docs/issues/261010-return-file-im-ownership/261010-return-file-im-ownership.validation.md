# return-file-im-ownership 用户验证

## 验证说明

- 验证对象：移植上游 `43fd516` 后，`dsh_im_return_file` 只在存在活跃 IM 投递消费者的回合里受引导/可用；非 IM 会话不再出现该引导，误调会被明确拒绝。
- 环境/前置条件：已 `npm run build` 重建 `lib/`；**需要重启 dsh 后新构建才生效**（link 部署，重启需用户书面同意）。
- 建议验证渠道：Telegram（已有可用 bot）+ DSH Web GUI。

## 验证项

| 验证步骤 | 预期结果 | 实际结果 | 状态 | 备注/证据 |
| -------- | -------- | -------- | ---- | --------- |
| 1. 在 Telegram 私聊里让 Agent 交付一个已存在的图片或文件（例如「把 assets/logo-plugin-phone.png 发给我」） | 照常收到**原生图片/文件附件**，与修复前一致 | | 待验证 | 回归项：IM 回合的消费者绑定仍成立 |
| 2. 在 DSH Web GUI（非 IM 会话）里让 Agent 交付一个文件（例如「把 README.md 给我」） | Agent **不再调用 `dsh_im_return_file`**，改用 `present` 工具或正文 markdown 文件链接交付 | | 待验证 | 核心修复项 |
| 3. 在 Web GUI 里显式要求 Agent 用 `dsh_im_return_file` 提交文件 | 工具返回 `artifact-consumer-required` 错误并提示改用 host present 工具；不产生「已排队」的成功假象 | | 待验证 | 硬拒绝兜底 |

## 验证结论

待验证。

## 待跟进

- IM 绑定会话的「GUI 输入」回合（session-sync 的 `dsh` origin）与 wake 回合仍无产物通道：这些回合会被判为无消费者，Agent 改用 `present`；文本投递照旧。此前这些回合调用 `dsh_im_return_file` 也是静默丢弃，本修复把静默失败变为显式拒绝。若希望这些回合也能投递附件，需要单独做「session-sync 认领产物」的需求。
