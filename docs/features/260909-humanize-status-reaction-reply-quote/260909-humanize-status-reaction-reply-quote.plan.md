# 状态 Reaction 与回复引用全局开关 专项方案

日期：2026-09-09。实施基线：dsh-im-humanize fork（上游 xmanrui/dsh-im v4.13.0）。

用户诉求（原话）：「telegram 渠道的 reaction（点赞、眼睛）、回复时的引用，能不能关掉？」——裁定为**加全局配置开关**（拟人化设置体系），默认保持现状（开）。

## 1. 需求与用户路径

### 1.1 两个新设置键

| 键 | 类型 | 默认 | 语义 |
|---|---|---|---|
| `statusReaction` | boolean | `true` | 关闭后，六渠道的「状态表情回应」（处理中/成功/失败）全部停发 |
| `replyQuote` | boolean | `true` | 关闭后，机器人回复不再以「回复/引用」形式指向用户消息（仅视觉引用头；会话结构不变，见 §2.2） |

进入现有拟人化设置体系，与 `streaming`/`messageBreak`/`typingIndicator` 同级：

- **全局**：`~/.dsh/integrations/dsh-im/humanize.json`（`HumanizeSettingsStore`）
- **每机器人覆盖**：`workspaces.json` 的 `humanize` 节（数据模型支持手改；UI 不加每机器人编辑器——与 streaming/messageBreak/typingIndicator 现状一致，只有 sendDelay 有 per-bot UI）
- **渠道子对象优先**：`config[channel][key]` > 显式 dsh-config > store（`humanizeDefaults(channelName)` 既有优先级链，自动获得）
- **生效时机**：下一条消息起（桥接/运行时逐消息读 provider，无需重启）

### 1.2 用户路径

1. 「设置 → IM 机器人 → 通用设置 → 拟人化设置」面板新增两个开关：
   - **状态 Reaction (statusReaction)**：hint 说明六渠道表情反馈的范围；
   - **回复引用 (replyQuote)**：hint 说明只影响 Telegram/Discord/WhatsApp 的引用样式，不影响话题/Thread 归组。
2. 关闭 → 保存 → 下一条消息起生效。
3. 渠道行为：Telegram 回复不再出现 👀→👍/👎 表情与「回复你」引用头；消息正常发送。

## 2. 语义界定（本方案的概念基石）

### 2.1 statusReaction 覆盖范围（六渠道，逐一核实）

| 渠道 | 现状表情 | 门控点 |
|---|---|---|
| Telegram | 👀 → 👍/👎（descriptor `reactions`） | 共享桥接 `accept()` |
| Slack | 👀 → ✅/❌ | 同上 |
| Discord | 👀 → ✅/❌ | 同上 |
| WhatsApp | 👀 → ✅/❌ | 同上 |
| 飞书 | OnIt → DONE/ERROR（`#beginReaction`） | 飞书桥接 `#beginReaction` |
| 钉钉 | 🤔 thinking → DONE/ERROR（`#startStatusReaction`） | 钉钉桥接 `#startStatusReaction` |

**不受影响**：入站引用语义解析（`replyTo` 字段的模型可见内容）、WhatsApp 已读回执、typing 指示器、流式呈现、消息编辑。`statusReaction=false` 只停发**出站表情**——`beginStatusReaction` 传 `reactions: undefined` 即返回 `NOOP_REACTION`（`status-reaction.mjs:43-49` 既有守卫），下游 `success()/error()/clear()` 全部安全空转，无需逐调用点判断。

### 2.2 replyQuote 覆盖范围：「视觉引用头」vs「会话结构/路由」

九渠道出站「指向用户消息」的机制逐一核实：

| 渠道 | 机制 | 性质 | 处置 |
|---|---|---|---|
| Telegram | `reply_parameters: { message_id }`（首段 + 图片/文件） | 纯视觉引用 | **受开关控制** |
| Discord | message_reference（DM、已有 Thread 内回复、频道兜底回复） | 纯视觉引用 | **受开关控制** |
| WhatsApp | Baileys `quoted`（首条文本 + 产物发送） | 视觉引用（但 `quoted.key` 另用于已读标记） | **受开关控制**（只丢发送引用，保留已读） |
| Slack | `thread_ts` 线程路由 | 会话结构 | 不变 |
| 飞书 | `replyTo` + `reply_in_thread`（话题锚定、thread_id 注册、`#anchorTopicReply`） | 会话结构 | 不变 |
| 钉钉 | sessionWebhook 回复路由 | 会话结构 | 不变 |
| 微信/QQ/企微 | 无出站引用机制（被动回复/无 quote 字段） | — | 不变 |

**界定原则**：开关只消除「回复消息顶部的引用样式」；线程/话题归组、消息路由、@提及逻辑一概不动。理由：结构性行为承载会话锚定（飞书话题、Discord Thread、Slack 线程），关闭它们会破坏群聊多会话管理，与「关掉引用显示」的用户意图不符。

### 2.3 WhatsApp 特殊性（已读回执耦合，已核实）

`whatsapp-runtime.mjs:631-636` `sendTyping(target)` 在发 composing presence 前用 `target.quoted.key` 调 `readMessages`（蓝勾）。因此 **WhatsApp 不能在归一化层剥 `quoted`**（会连带丢已读），必须在发送层门控：`#sendTextMessage`（`:474`，已有 `quote` 选项参数）与 `#sendArtifact`（`:599`）丢 `quoted`，`sendTyping` 原样保留。

## 3. 现状盘点（代码事实，已逐一核实）

### 3.1 状态 Reaction 生命周期

- **共享桥接**（telegram/slack/discord/whatsapp 四渠道 bridge 均为 descriptor 薄封装）：`text-harness-bridge.mjs:277-287` `accept()` 内 `beginStatusReaction({ adapter: this.#bot, target, reactions: this.#descriptor.reactions, ... })`；`target` 仅 direct/addressed 消息非空（群聊未 @ 不发）。emoji 集合在各渠道 bridge descriptor（如 `telegram-bridge.mjs:9`）。
- **飞书**：`bridge.mjs:915` 消息入口唯一调用 `#beginReaction(messageId)`（`:4936-4945`，内部 `beginStatusReaction` + `{processing:'OnIt', success:'DONE', error:'ERROR'}`），`processingReaction` 贯穿批处理/交互/回调全部路径（`#finishReaction`/`#removeProcessingReaction` 容忍 NOOP）。
- **钉钉**：`dingtalk-bridge.mjs:1011-1032` `#startStatusReaction`（能力检查后 attach `DINGTALK_THINKING_REACTION_NAME`），`:1034-1063` `#finishStatusReaction`（recall thinking → 加终态）。`#enqueueMessage`/`#process` 的 `statusReaction` 参数已有 null 容忍（能力检查不通过时即返回 null）。
- **API 层**：`telegram-api.mjs:210 setMessageReaction`、`slack-api.mjs:297/311`、`discord-api.mjs:245/260`、`whatsapp-runtime.mjs:550-566`、`feishu-channel.mjs:521/531`、`dingtalk-api.mjs:463 changeReaction`。

### 3.2 回复引用现状（受控三渠道）

- **Telegram**：`telegram-runtime.mjs:279-284` `normalizeTelegramUpdate` 构造 `replyTarget: { chatId, chatType, replyToMessageId: messageId, messageThreadId }`；出站全部读 `target.replyToMessageId`——`sendText:403`、`#sendPlain:518`、`#sendRich:552`、`sendFile:448`、`sendImage:458`（均首段引用，`index === 0`）；`telegram-api.mjs:203-204/229-230/287-291` 组装 `reply_parameters`（`allow_sending_without_reply: true` 已兜底）。`messageThreadId`（话题路由）独立字段，不受影响。
- **Discord**：`discord-runtime.mjs:326-329` `normalizeDiscordMessage` 构造 `replyTarget: { channelId, replyToMessageId }`；`:107-113` `withConversationRoute` 重建 replyTarget 时**仅在源字段存在时**复制 `replyToMessageId`（归一化层剥除后自动传播）；群聊 Thread 创建流程（`:360-414`）用 `startThreadFromMessage`，`fromSourceMessage: true` 路径本就不带引用；`sendText:436`/`sendFile:453` 首段引用。
- **WhatsApp**：`whatsapp-runtime.mjs:336` `replyTarget: { jid, quoted: message, selfChat }`；`#sendTextMessage:488` `quote && !edit && target.quoted`；`#sendArtifact:599`；`sendTyping:632-633` 已读标记（**保留**）。

### 3.3 设置链路（现状，新键照搬 typingIndicator 先例）

store → `plugin-src/host/index.mjs:32-39 HUMANIZE_CONFIG_KEYS` 转发 + `:157-165 humanizeDefaults(channelName)`（渠道子对象 > 显式 config > store 活读）→ 各渠道 production `createHumanizeProvider`（`humanize-provider.mjs:25-37`，`getSettings()` 每次全量 normalize + per-bot 顶层键替换合并 `mergeHumanizeSettings`）→ runtime `#humanize` → 桥接 `resolveHumanizeSettings`（`humanize-resolver.mjs:18-36`，逐回合读取）。typingIndicator 先例：`text-harness-bridge.mjs:883` `humanize.typingIndicator !== 'off'` 门控。

RPC 边界：`plugin-src/host/humanize-rpc.mjs:18-25 SETTABLE_KEYS` 顶层键白名单 → `validateHumanizeUpdate`（`humanize-settings.mjs:67-100`，未知键拒绝）。每机器人：`humanize-override.mjs:38-50`（宽容修复）/`:90-141`（严格校验，`:133` 键白名单）。

### 3.4 UI 现状

- **全局面板** `plugin-src/client/humanize-settings.js`：`HumanizeSettingsPanel`（`h()` hyperscript），挂载 `plugin-src/client/index.js:339`；加载 `humanize.get`、整体保存 `humanize.set`（`:256` 全量 settings 对象，无客户端键白名单副本）；现有 4 个 checkbox（流式回复/分步消息/启用发送延迟/活跃响应），`updateField(field, value)` 模式（`:159-162`）。开关渲染惯例：`label.dim-humanizeField` = fieldRow(checkbox + fieldName) + fieldHint；`h()`（`plugin-src/client/i18n.js:1173`）自动本地化字符串子节点——**新中文文案需在 i18n.js EN 词典补英文**。
- **每机器人编辑器** `plugin-src/client/channels/shared/bot-send-delay.js`：唯一共享组件 `BotSendDelayEditor`（九渠道复用），只编辑 sendDelay；`OVERRIDE_KEYS`（`:45`，5 个非 sendDelay 键）是**保存时回传保留白名单**——新键必须加入，否则每机器人保存 sendDelay 会静默丢弃手改的 `statusReaction`/`replyQuote`。7 处渠道卡片挂载（token-channel 共享 telegram/discord/slack + wecom/qq/whatsapp/dingtalk/weixin/feishu）。**本次不加每机器人 UI 控件**（与 streaming/messageBreak/typingIndicator 现状一致——它们也只有全局面板），仅数据模型支持覆盖。
- **checkbox 审计**：`scripts/verify-package.mjs:157` `humanize-settings.js: { checkbox: 4 }`——全局面板加 2 个 checkbox 后须同步为 6；`:158` `bot-send-delay.js: { checkbox: 2 }` 不变（不加编辑器控件）。`test/client-humanize-ui.test.mjs:429-430` 编辑器 checkbox 数量断言（2）不变，全局面板用例（`:58-117`）需扩展。

### 3.5 测试基线与本机环境（已实测核实，实施红线依据）

**预置 cancelled（非本功能引入，红线 = 零新增）**：本机（Node v22.23.2）全量 `npm test` 有 **200 个 `cancelledByParent`**（"Promise resolution is still pending but the event loop has already resolved"），根因是既有桥接测试 fixture 缺 keep-alive：首个依赖 unref'd 定时器 / `AbortSignal.timeout`（Node 内部 timer 为 unref）的测试排干事件循环，node:test 连锁取消整个文件尾部。分布（逐文件与上一个特性的 worktree 基线对照一致）：wecom/bridge 52、qq/bridge 49、discord 29、telegram 24、slack 16、feishu/plugin-host 12、weixin 9、feishu-runtime 3、dingtalk-runtime 3、status-reaction 2 等。**已验证的最小复现**：`await new Promise(r => { const t = setTimeout(r, 50); t.unref(); })` 在 node:test 下必挂。**新测试约定（260908 已确立）**：凡涉及 unref'd 定时器/AbortSignal.timeout 的用例必须以 `withKeepAlive`（ref'd interval 包裹，见 `test/humanize-bridge.test.mjs:35`）包裹，本功能全部新用例遵守。
- `npm run check` 因此 exit 1 属**预置状态**（cancelled 计入非零退出码），非本功能的完成标准缺陷；完成标准改为「cancelled 集合与基线逐一对照零新增」。
- 修复 200 个 cancelled 已在 260908 review 立项建议，本方案不扩scope。

**本机 shell 代理环境污染**：本环境继承 `HTTP(S)_PROXY=127.0.0.1:7890` + `NODE_USE_ENV_PROXY=1`，全量跑会额外产生 2 个真实 fail：`feishu-proxy.test.mjs`（"Feishu verification uses the SDK HTTP client through HTTPS_PROXY"）与 `lark-sdk-handshake-patch.test.mjs`（"patched real SDK survives handshake timeout…"）——**两者在清掉代理变量后单独运行均全绿**（已验证）。本功能验证一律在清掉代理变量的 shell 中跑：`env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u NODE_USE_ENV_PROXY npm test`。

**构建链**：`lib/` 是 esbuild bundle（`plugin-src/client/build.mjs` → `lib/client.js`，`plugin-src/host/build.mjs` → `lib/index.js`），verify-package 校验的是 bundle——**改任何 plugin-src/src 后必须 `npm run build`**。无 lint；`npm run check` = build + test + verify-package 是唯一门禁。

## 4. 实现方案

### 4.1 设置层（键名单六处同步）

1. `src/channels/shared/humanize-settings.mjs`：
   - `DEFAULT_HUMANIZE_SETTINGS` 增加 `statusReaction: true, replyQuote: true`；
   - `normalizeHumanizeSettings`：`typeof partial.statusReaction === 'boolean'` 才覆盖（宽容修复，与 streaming 同模式）；
   - `validateHumanizeUpdate`：两键非 boolean 拒绝（`field` 路径 `statusReaction`/`replyQuote`）；`known` 集合自动随 DEFAULT 扩展。
2. `src/channels/shared/humanize-resolver.mjs`：`resolveHumanizeSettings` 输出增加两键（`typeof source.x === 'boolean' ? source.x : true`，构造回退 true）。
3. `src/channels/shared/humanize-override.mjs`：`normalizeHumanizeOverride` 保留 boolean 键；`validateHumanizeOverrideSection` 校验 + `:133` 白名单加两键。
4. `plugin-src/host/index.mjs`：`HUMANIZE_CONFIG_KEYS` 加 `'statusReaction', 'replyQuote'`（渠道子对象优先/顶层转发/humanizeDefaults 全链路自动获得）。
5. `plugin-src/host/humanize-rpc.mjs`：`SETTABLE_KEYS` 加两键（面板全量保存需要放行）。
6. `plugin-src/client/channels/shared/bot-send-delay.js`：`OVERRIDE_KEYS` 加两键（回传保留，UI 不新增控件）。

### 4.2 statusReaction 门控（三处收口）

1. **共享桥接** `text-harness-bridge.mjs` `accept()`（`:277` 前）：
   ```js
   const humanize = this.#humanizeSettings();
   const statusReaction = beginStatusReaction({
     ...
     reactions: humanize.statusReaction === false ? undefined : this.#descriptor.reactions,
     ...
   });
   ```
   一处覆盖 telegram/slack/discord/whatsapp。`#humanizeSettings()` 是同步纯函数，每条入站消息调用一次成本可忽略。
2. **飞书** `bridge.mjs` `#beginReaction`（`:4936`）：`reactions: this.#humanizeSettings().statusReaction === false ? undefined : { processing: 'OnIt', success: 'DONE', error: 'ERROR' }`——返回 NOOP，`:915` 起全部下游路径安全空转。
3. **钉钉** `dingtalk-bridge.mjs` `#startStatusReaction`（`:1011`）：能力检查之后加 `if (this.#humanizeSettings().statusReaction === false) return null;`——`#enqueueMessage`/`#process`/`#finishStatusReaction` 均已有 null 容忍。

### 4.3 replyQuote 门控（三渠道各一处语义正确的收口）

1. **Telegram（归一化层）**：`normalizeTelegramUpdate` options 增加 `replyQuote = true`；为 false 时 `replyTarget` 省略 `replyToMessageId`（`messageThreadId` 保留）。`telegram-runtime.mjs` `#poll`（`:993`）调用处逐消息解析：
   ```js
   const replyQuote = this.#humanize?.getSettings()?.replyQuote !== false;
   ```
   覆盖全部出站路径（文本/富文本/图片/文件/流式收尾/连接测试回退目标）。
2. **Discord（归一化层）**：`normalizeDiscordMessage` options 增加 `replyQuote = true`；为 false 时 `replyTarget` 省略 `replyToMessageId`。运行时 `#acceptMessage` 的**两处**归一化调用都透传：`:849` 预检（拒绝通知的引用也随之消失）与 `:873` 主路径（`resolveDiscordMessageRoute` → 内部 `:345` 转发该选项）；`withConversationRoute`（`:109`）按「源字段存在才复制」自动传播。Thread 创建/路由不变。
3. **WhatsApp（发送层）**：`WhatsappBotClient` 构造 options 增加 `humanize = null`（`whatsapp-runtime.mjs:802-806` 构造处传 `this.#humanize`）；私有 `#replyQuoteEnabled()` 活读 provider；`#sendTextMessage` 的引用条件改为 `quote && this.#replyQuoteEnabled() && !edit && target.quoted`；`#sendArtifact` 的 options 改为 `...(this.#replyQuoteEnabled() && target.quoted ? { quoted: target.quoted } : {})`。`sendTyping` 已读标记原样保留。

### 4.4 UI（全局面板）

`plugin-src/client/humanize-settings.js` 面板在「分步消息 (message_break)」（L321）之后、「新消息行为」下拉之前新增两个字段（沿用 `label.dim-humanizeField` + fieldRow + fieldHint 结构，`updateField` 模式）：

- **状态 Reaction**：`h('input', { type: 'checkbox', checked: settings.statusReaction !== false, onChange: (e) => updateField('statusReaction', e.target.checked) })`；hint：「机器人用表情回应标记任务状态（处理中/成功/失败）。支持 Telegram、Discord、WhatsApp、Slack、飞书、钉钉。」
- **回复引用**：同构；hint：「机器人回复时引用你的消息。仅影响 Telegram、Discord、WhatsApp 的引用样式；话题、Thread 归组不受影响。」

配套：`plugin-src/client/i18n.js` EN 词典补两组 label/hint 翻译；`scripts/verify-package.mjs:157` checkbox 计数 `4 → 6`。每机器人编辑器不加控件（§3.4），`OVERRIDE_KEYS` 仅加键保回传。

### 4.5 测试

一律在清掉代理变量的 shell 运行（§3.5）；新用例遵守 `withKeepAlive` 约定。

1. **设置层**（`test/humanize-settings.test.mjs`：默认值断言 L25-32 加两键、validate 用例 L48-57 加非 boolean 拒绝、RPC 合并 L100-125；`test/humanize-override.test.mjs`：normalize/validate 新键用例（L81-138）、九渠道 RPC 循环 bad 列表 L312-317 加 `{ statusReaction: 'no' }`、兄弟键保留；`test/host.test.mjs` L295-365 humanizeDefaults 新键优先级）。
2. **statusReaction 门控**（`test/channels/shared/text-harness-bridge.test.mjs`：humanize provider 传 `statusReaction:false` → addReaction 零调用、回复正常送达；默认/true → 表情照发（回归）。钉钉 `test/channels/dingtalk/dingtalk-bridge.test.mjs`（L1195 旁）与飞书 `test/channels/feishu/bridge.test.mjs`（L410 旁）补同样断言；`test/channels/shared/status-reaction.test.mjs` 纯单测不动）。
3. **replyQuote 门控**（`test/channels/telegram/telegram.test.mjs` L371-397/L401-424/L1050-1096 旁：`replyQuote:false` → sendMessage/sendPhoto/sendDocument 无 `reply_parameters`、`messageThreadId` 仍在、replyTarget 形状断言；`true` 保持现状；`test/channels/discord/discord.test.mjs` L249/L706-711 旁：无 `message_reference`、Thread 流程不受影响；`test/channels/whatsapp/whatsapp.test.mjs` L856-867/L926 旁：`quoted` 不进发送 options、`readMessages` 仍调用）。
4. **UI**（`test/client-humanize-ui.test.mjs` L58-117：面板渲染两个新 checkbox、勾选状态来自 settings、保存 payload 含新键；L429-430 编辑器 checkbox 数量断言不变）。
5. **回归红线**：全量 `node --test` 与本机基线（§3.5）逐一对照——**fail 0（清代理环境）+ cancelled 集合零新增**。

### 4.6 文档与发布

- `CHANGELOG.md` Unreleased/Added 中英双语条目，含**同版本升级说明**：`humanize.set` payload 是完整对象，新客户端写旧宿主会被 `SETTABLE_KEYS` 整体拒绝（保存失败报错，非部分成功）——客户端与宿主需同版本；旧宿主读新 humanize.json 安全（normalize 忽略未知键）。
- `README.md` L44-96「本 Fork 的改动（拟人化）」与 `README.en.md` 同构节补两开关条目（默认值与渠道差异）。
- 改动 plugin-src/src 后执行 `npm run build` 重新生成 `lib/`（verify-package 校验 bundle）。
- 本方案目录 `docs/features/260909-humanize-status-reaction-reply-quote/`（plan + summary + validation，如走检视流程加 review）。

## 5. 兼容性与边界

- **默认 true = 升级无感**：现有部署行为不变；旧 `humanize.json`/`workspaces.json` 无新键，normalize 补默认。
- **每机器人覆盖即时生效**：provider 逐消息活读，改 workspaces.json 下一条消息生效。
- **通道无关性**：两键对无该行为的渠道是no-op（QQ/企微/微信无引用机制；Slack/飞书/钉钉结构性行为明确不在范围内）。
- **不引入新 RPC 端点**：复用 `humanize.get/set` 与 `bot.humanize.set`。
- **不改变入站语义**：用户引用机器人消息的 `replyTo` 解析、`recoverAssistantTextByTimestamp` 均不受影响。

## 6. 验收标准

1. 清代理变量环境全量 `node --test`：fail 0、cancelled 集合与基线（§3.5 分布）**逐一对照零新增**（`npm run check` exit 1 属预置 cancelled，非本功能缺陷）。
2. `npm run build` 后 `node scripts/verify-package.mjs` 通过（checkbox 清单 4→6 同步后）。
3. 手动验收（Telegram 实机）：
   - 默认：👀→👍 表情与回复引用照旧（回归）；
   - 全局关闭 statusReaction：无任何表情，回复正常；
   - 全局关闭 replyQuote：回复无引用头，话题群消息仍在正确 topic；
   - 每机器人 humanize 节手改 `{"statusReaction": false}`：仅该机器人停发表情；
   - 面板保存后无需重启，下一条消息生效。
