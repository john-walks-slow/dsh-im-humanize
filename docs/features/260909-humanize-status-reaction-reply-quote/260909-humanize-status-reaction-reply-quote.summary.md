# 状态 Reaction 与回复引用全局开关 — 实施总结

日期：2026-09-09。分支：`feat/status-reaction-reply-quote`（worktree `dsh-im-humanize-reaction-reply-quote`，基线 commit `16032be`）。
对应计划：`260909-humanize-status-reaction-reply-quote.plan.md`。调研报告：`260909-client-test-baseline.research.md`。

## 背景

原始诉求：「telegram 渠道的 reaction（点赞、眼睛）、回复时的引用，能不能关掉？」
裁定为**加全局配置开关**（拟人化设置体系），默认保持现状（开），对所有带该行为的渠道生效。用户明确要求在单独 worktree 开发。

## 落地内容

新增两个全局拟人化设置键：

| 键 | 默认 | 关闭后 |
|---|---|---|
| `statusReaction` | `true` | 六渠道（Telegram/Slack/Discord/WhatsApp/飞书/钉钉）不再发送处理中/成功/失败表情，回复照常送达 |
| `replyQuote` | `true` | Telegram/Discord/WhatsApp 回复不再以「回复/引用」形式指向用户消息（仅视觉引用头） |

### 语义边界（设计基石）

- statusReaction 只停发出站表情，入站引用语义解析、WhatsApp 已读回执、typing 指示器、流式呈现、消息编辑全部不受影响。靠共享 `beginStatusReaction()` 既有 NOOP_REACTION 守卫惰性化全部 success/error/clear，无需逐调用点判断。
- replyQuote 只消除「回复顶部的引用样式」。Slack 线程、飞书话题锚定、Discord Thread、钉钉 webhook 路由是会话结构，不动——关闭会破坏群聊归组，与「关掉引用显示」的用户意图不符。
- WhatsApp `quoted` 字段同时用于已读回执（`sendTyping` 用 `target.quoted.key` 调 `readMessages`），因此必须在**发送层**门控（`#sendTextMessage`/`#sendArtifact`），不能在归一化层剥 `quoted`。

### 改动清单（29 个文件）

**设置层（键名单六处同步）**：`humanize-settings.mjs`（DEFAULT/normalize/validate）、`humanize-resolver.mjs`、`humanize-override.mjs`（normalize/validate + unknown-key 白名单）、`plugin-src/host/index.mjs`（HUMANIZE_CONFIG_KEYS）、`plugin-src/host/humanize-rpc.mjs`（SETTABLE_KEYS）、`plugin-src/client/channels/shared/bot-send-delay.js`（OVERRIDE_KEYS，仅回传白名单，无每机器人 UI 控件）。

**statusReaction 门控（3 处收口）**：`text-harness-bridge.mjs` accept()、`feishu/bridge.mjs` `#beginReaction`、`dingtalk-bridge.mjs` `#startStatusReaction`（早退 null，`#finishStatusReaction` 已有 null 守卫）。

**replyQuote 门控（3 渠道）**：`telegram-runtime.mjs`（normalize 加 replyQuote 选项，`#poll` 逐消息注入）、`discord-runtime.mjs`（normalize + `#acceptMessage` preflight 与主 route 两处注入）、`whatsapp-runtime.mjs`（`WhatsappBotClient` 构造注入 humanize + `#replyQuote()` helper，`#sendTextMessage`/`#sendArtifact` 发送层门控）。

**UI**：`humanize-settings.js`（全局面板在 messageBreak 与 onNewMessage 之间加两个 checkbox）、`i18n.js`（EN 词典两组 label/hint 翻译）、`scripts/verify-package.mjs`（checkbox 清单 4→6，bot-send-delay.js 保持 2）。

**构建产物**：`lib/client.js`、`lib/index.js` 已 `npm run build` 重新生成；`verify-package.mjs` 通过。

**测试（9 个文件，+7 新用例 + 基线同步）**：`humanize-settings.test.mjs`（defaults deepEqual + malformed 校验 + RPC set + resolver + provider per-bot 覆盖）、`humanize-override.test.mjs`（normalize/validate + 九渠道 RPC 循环 bad 列表）、`host.test.mjs`（humanizeDefaults 键清单 + 优先级链）、`humanize-bridge.test.mjs`（statusReaction=false 共享桥接零表情 + 默认生命周期回归，withKeepAlive）、`feishu/bridge.test.mjs`、`dingtalk/dingtalk-bridge.test.mjs`、`telegram/telegram.test.mjs`、`discord/discord.test.mjs`、`whatsapp/whatsapp.test.mjs`（replyQuote=false 归一化剥离 + 端到端发送链 + 已读回执保留）、`client-humanize-ui.test.mjs`（全局面板两 checkbox 渲染/勾选/保存 payload + 兄弟键保留）。

## 兼容性

- **默认 true = 升级无感**：现有部署行为不变；旧 `humanize.json`/`workspaces.json` 无新键，normalize 补默认。
- **每机器人覆盖即时生效**：provider 逐消息活读，改 workspaces.json 下一条消息生效，无需重启。
- **通道无关性**：两键对无该行为的渠道是 no-op（QQ/企微/微信无引用机制；Slack/飞书/钉钉结构性行为明确不在范围内）。
- **不引入新 RPC 端点**：复用 `humanize.get/set` 与 `bot.humanize.set`。
- **RPC 兼容**：`humanize.set` payload 是完整对象，新客户端写旧宿主会被 `SETTABLE_KEYS` 整体拒绝（保存报错，非部分成功）——客户端与宿主需同版本；旧宿主读新 humanize.json 安全（normalize 忽略未知键，但 SETTABLE_KEYS 在旧宿主不认新键，故需同版本升级）。CHANGELOG 已注明。

## 测试与门禁状态

- **本机基线（与上一特性 review 一致）**：全量 `npm test` 有 **200 个预置 `cancelledByParent`**（既有桥接测试 fixture 缺 keep-alive，根因是 `unref()` 定时器 / `AbortSignal.timeout` 让 node:test 提前排空事件循环；非本功能引入），`npm run check` 因此 exit 1 属预置状态。
- **本次实测**（清代理环境 `env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u NODE_USE_ENV_PROXY npm test`）：2472 tests / 2271 pass / **0 fail / 200 cancelled**——测试数 +7（全部新用例），fail 0（基线 2 个代理污染失败在清代理环境消失），**cancelled 逐文件分布与基线完全一致、零新增**。
- `npm run build` ✓；`node scripts/verify-package.mjs` ✓。
- 测试约定（260908 已确立）：凡涉及 unref'd 定时器/AbortSignal.timeout 的用例必须 `withKeepAlive` 包裹。本次新用例遵守。两条 telegram/discord 端到端用例特意放在各自文件预置挂起点之前，确保实际执行而非被级联取消。

修复 200 个预置 cancelled 测试属独立项（已在 260908 review 立项建议），本方案不扩scope。

## 关键决策记录

- **不加每机器人 UI 控件**：与 streaming/messageBreak/typingIndicator 现状一致（只有 sendDelay 有 per-bot 编辑器），但数据模型支持 per-bot 覆盖；OVERRIDE_KEYS 必须加新键以免每机器人保存 sendDelay 时静默丢掉手改值（隐藏坑）。
- **WhatsApp 在发送层门控而非归一化层**：`quoted` 兼用已读回执；归一化层剥会连坐 readMessages + addressed 判定。
- **Slack/飞书/DingTalk replyQuote 不实现**：replyQuote=false 剥掉的是「视觉引用头」，这三者的 threadTs/replyTo/sessionWebhook 是会话结构，剥掉等于破坏会话管理或无法回复；属语义决策，需产品确认时另行设计。
