# 打断静默化（interrupt supersede）· 实施总结

日期：2026-10-09。计划：[261009-silent-interrupt.plan.md](261009-silent-interrupt.plan.md) ｜ 检视：[.review.md](261009-silent-interrupt.review.md)（条件准入）｜ 验收：[.validation.md](261009-silent-interrupt.validation.md)

## 用户诉求

`onNewMessage=interrupt`（新消息打断正在生成的旧回合）时，Telegram 会多发一条「已停止。」气泡；用户希望**感知不到这次打断**。

## 根因

打断走 `#interruptAndResend` → `fireAndForgetStop` → `stopActiveTurn`，只置 `ownership.stopRequested`；旧回合的 `ask()` 随即以 `turn-stopped` 收敛，而所有桥的 `turn-stopped` 分支都会发提示（`text-harness-bridge.mjs:1382` 等）。既有静默只覆盖「阅读延迟窗口内」的 preAsk 取代，`sendDelay.enabled=false` 时该窗口几乎不存在，因此打断稳定落在 Harness 阶段并触发提示。`/stop` 与 interrupt 产生同一个错误，无法靠错误码区分。

## 方案

给停止带上**来源原因**（而不是改变「是否停止」的判定）：

- `new-message-policy.mjs`：`SUPERSEDED_STOP_REASON='superseded'`、`isSupersededStop(error)`；`fireAndForgetStop` 透传 `reason`。
- `harness-client.mjs`：`stopActiveTurn` 从 options 剥出 `reason`（不进入 RPC 参数），停止被接受时写入 `ownership.stopReason`；`turnStoppedError(reason)` 把原因落到 `error.stopReason`。
- 各桥 interrupt 调用点传 reason；`turn-stopped` 分支按 `isSupersededStop(error)` 分流：superseded 不发提示，显式 `/stop` 保持原反馈。
- 渠道收尾：共享桥（Telegram/Discord/Slack/WhatsApp）`stream.cancel()`；QQ 跳过 `sendText`（保留 markSeen 与批量 complete）；企微发送空内容关闭 stream；钉钉无卡片取消 API，改为用 `lastCardText` 定稿卡片；飞书/微信/企微应用本就无文案。

## 验证

- 构建：`npm run build` ✅
- 受影响用例（全部与 HEAD 基线逐文件对比，无回归）：
  - `test/channels/shared/harness-control.test.mjs` 25/25（+2 用例）
  - `test/channels/shared/text-harness-bridge.test.mjs` 59/59（+1）
  - `test/humanize-bridge.test.mjs` 17/17（+1：Harness 阶段打断端到端）
  - `test/channels/qq/bridge.test.mjs` 新增用例孤立跑 ✅（该文件整体在本机存在与 HEAD 一致的 cancelledByParent 现象）
  - `test/channels/wecom/bridge.test.mjs` 新增子用例 ✅（同上）
  - `test/channels/dingtalk/dingtalk-bridge.test.mjs` 卡片相关 5/5（含 +1 superseded 用例）
  - 其余：`humanize-standalone-bridges` 12/12、`send-delay` 18/18、`progress-status` 15/15、`feishu/bridge` 247/247、`weixin-bridge` 54/54、telegram rich-message 26/27 与 telegram.test 47/50（该 4 条在 HEAD 基线上同样失败）
- 未跑全量（按项目规范，先划范围）。

## 检视结论

第一轮 `不准入`：钉钉调用了不存在的 `cardStream.cancel()`（会让卡片永久停在流式态）。已按建议改为用最后内容定稿并补回归用例；第二轮 `条件准入`，无阻塞项。

## 已知边界

- 旧回合若已产生部分回答，仍会作为正常回复送出（与 `/stop` 一致）。
- 群聊/非私聊渠道的占位消息无法删除，打断后可能留下已推送的部分内容；本次只保证不再新增「打断提示」。
- **待实机确认**：Telegram 私聊的 30 秒 Rich Draft 在新路径下不再靠 finish 顺带清除，是否出现「幽灵预览」残留（见 validation.md 验证项 2）。

## 生效方式

`lib/` 已重建；link 部署下需**重启 dsh** 才生效（重启线上实例前需用户书面同意）。

## 已知未处理

- QQ 桥的 `let stream = null`（`:1115`）及其 `stream?.cancel?.()` 是既有死代码，非本次引入；为控制 diff 与上游合并摩擦未清理。
