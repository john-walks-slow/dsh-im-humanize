# Code Review: 状态 Reaction 与回复引用全局开关

**检视日期**：2026-09-09  
**Worktree**：`/root/projects/dsh-im-humanize-reaction-reply-quote`（分支 `feat/status-reaction-reply-quote`，基线 `16032be`，未提交）  
**计划文档**：同目录 `.plan.md`  
**结论**：**准入**

---

## 0. 检视范围与方法

本审阅在 worktree 内用 `git diff HEAD` 逐文件审查全部 30 个变更文件（含构建产物），对照计划文档的语义界定、门控点、键名单、测试覆盖与回归红线进行逐项核实。清代理环境（`env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u NODE_USE_ENV_PROXY`）实测全量 `npm test` 与 `verify-package`。

---

## 1. 设置层——键名单六处同步 ✅

计划 §4.1 要求六处同步。逐一核实：

| # | 文件 | 键名 | 核实结果 |
|---|---|---|---|
| 1 | `src/channels/shared/humanize-settings.mjs` | `statusReaction`/`replyQuote` | `DEFAULT_HUMANIZE_SETTINGS` 加两键 `true`（:35-36）；`normalizeHumanizeSettings` boolean lenient 归一（:54-59）；`validateHumanizeUpdate` 严格拒绝非 boolean（:86-91）；`known` 集合随 DEFAULT 自动扩展（无硬编码白名单遗漏） ✅ |
| 2 | `src/channels/shared/humanize-resolver.mjs` | 同 | `resolveHumanizeSettings` 输出加两键 `typeof source.x === 'boolean' ? source.x : true`（:35-36），缺省回退 `true` ✅ |
| 3 | `src/channels/shared/humanize-override.mjs` | 同 | `normalizeHumanizeOverride` boolean 宽容保留（:40-41）；`validateHumanizeOverrideSection` 校验分支（:107-118）；unknown-key 白名单数组补两键（:144） ✅ |
| 4 | `plugin-src/host/index.mjs` | `HUMANIZE_CONFIG_KEYS` | 数组加两键（:37-38），渠道子对象优先 / 顶层转发 / `humanizeDefaults` 全链路自动获得 ✅ |
| 5 | `plugin-src/host/humanize-rpc.mjs` | `SETTABLE_KEYS` | `Set` 加两键（:25-26），顶层 shape gate 放行面板全量保存 ✅ |
| 6 | `plugin-src/client/channels/shared/bot-send-delay.js` | `OVERRIDE_KEYS` | 数组加两键（:45），保存 sendDelay 时回传保留白名单，防止静默丢值 ✅ |

**优先级链完整性**：`host.test.mjs` 验证了 `humanizeDefaults(channel)` 对全部九渠道 + office 返回含两键的完整对象（:66-98），并通过 RPC `humanize.set` 验证了 live store 更新后下一条消息生效（:351-367）。`createHumanizeProvider` 经 `mergeHumanizeSettings`（top-level key replacement）→ `normalizeHumanizeSettings` 链路正确合并 per-bot 覆盖与全局默认（`humanize-settings.test.mjs:176-193` 验证 `bot_b` 的 `statusReaction: false` 替换默认 `true`，`replyQuote` 缺省继承 `true`）。

---

## 2. statusReaction 门控——三处收口 ✅

计划 §4.2 要求三处门控。逐一核实：

### 2.1 共享桥接 `text-harness-bridge.mjs` `accept()`（:277-288）

```js
reactions: this.#humanizeSettings().statusReaction === false
  ? undefined
  : this.#descriptor.reactions,
```

`#humanizeSettings()`（:462-469）调用 `resolveHumanizeSettings`，逐回合活读 provider。当 `statusReaction === false` 时 `reactions` 为 `undefined`，`beginStatusReaction`（`status-reaction.mjs:46`）因 `reactions?.processing` 非 string 返回 `NOOP_REACTION`（:3-8，`success()`/`error()`/`clear()` 均为空函数体）。下游 `void processing.then(() => statusReaction.success(), () => statusReaction.error())`（:292-295）安全空转。

**覆盖范围**：Telegram / Slack / Discord / WhatsApp 四渠道（均为 descriptor 薄封装）。✅

### 2.2 飞书 `bridge.mjs` `#beginReaction`（:4936-4945）

```js
reactions: this.#humanizeSettings().statusReaction === false
  ? undefined
  : { processing: 'OnIt', success: 'DONE', error: 'ERROR' },
```

同理返回 `NOOP_REACTION`。`:915` 起的 `processingReaction` 贯穿批处理/交互/回调路径，`#finishReaction` / `#removeProcessingReaction` 均容忍 NOOP（既有逻辑）。✅

### 2.3 钉钉 `dingtalk-bridge.mjs` `#startStatusReaction`（:1011-1012）

```js
if (this.#humanizeSettings().statusReaction === false) return null;
```

能力检查之前 early return `null`。`#finishStatusReaction`（:1035-1036）已有 `if (!reaction || reaction.terminal) return;` null 守卫，所有调用点（:637/:644/:720/:723/:771/:774/:1215/:1218/:1569）均安全。✅

**惰性化完整性**：计划 §2.1 声称靠 `beginStatusReaction` 既有 NOOP 守卫惰性化全部 success/error/clear，已核实 `status-reaction.mjs` 的 NOOP_REACTION 对象冻结且方法体为空函数，三处门控点均正确利用此机制。

---

## 3. replyQuote 门控——三渠道各一处 ✅

计划 §4.3 要求三渠道语义正确的收口。逐一核实：

### 3.1 Telegram（归一化层）

- `normalizeTelegramUpdate`（:224）options 加 `replyQuote = true`（:228-232 注释清晰说明"outbound only"）
- `false` 时 `replyTarget` 省略 `replyToMessageId`（:287：`...(replyQuote === false ? {} : { replyToMessageId: messageId })`），保留 `chatId` / `chatType` / `messageThreadId`
- `#poll`（:1004）逐消息注入 `replyQuote: this.#humanize?.getSettings()?.replyQuote !== false`
- **全部出站路径**覆盖验证：`grep` 确认 10 处 `replyToMessageId` 引用全部读 `target.replyToMessageId`（sendText:408 / sendFile:453 / sendImage:463 / #sendPlain:523,691 / #sendRich:557,576,735），归一化层剥除后自动传播。:646 的 `replyToMessageId: undefined` 是既有不引用路径，独立于此功能。

**测试**（`telegram.test.mjs:402-444`）：验证 `Object.hasOwn(unquoted.replyTarget, 'replyToMessageId') === false`（"absent, not merely falsy"）、`messageThreadId === 300` 保留、`reactionTarget` 不受影响、端到端 `TelegramBotClient.sendText` 无 `replyToMessageId`。✅

### 3.2 Discord（归一化层）

- `normalizeDiscordMessage`（:296）options 加 `replyQuote = true`（:297-299 注释）
- `false` 时 `replyTarget` 省略 `replyToMessageId`（:331：`...(replyQuote === false ? {} : { replyToMessageId: String(message.id) })`）
- `resolveDiscordMessageRoute`（:341）透传 `replyQuote`（:347 参数声明，:354 条件 spread `...(replyQuote === undefined ? {} : { replyQuote })`）
- `#acceptMessage` **两处**注入（:854-856 preflight normalize + :885 主 route resolve），均用 `this.#humanize?.getSettings()?.replyQuote !== false`
- `withConversationRoute`（:109-110）按"源字段存在才复制"传播：`!fromSourceMessage && normalized.replyTarget?.replyToMessageId ? { replyToMessageId: ... } : {}`——归一化层剥除后自动不复制。Thread 创建/路由路径（:358-414，`fromSourceMessage: true`）本就不带引用，不受影响。

**测试**（`discord.test.mjs:104-144`）：验证 `Object.hasOwn(unquoted.replyTarget, 'replyToMessageId') === false`、`channelId` 保留、`reactionTarget` 不受影响、端到端 `DiscordApi.createMessage` 的 JSON body 无 `message_reference`。✅

### 3.3 WhatsApp（发送层——计划 §2.3 已读回执耦合的特殊处置）

- `WhatsappBotClient` 构造加 `humanize = null` 选项（:459, :464），`#humanize` 私有字段（:448）
- `#replyQuote()` helper（:465-470）：`return this.#humanize?.getSettings()?.replyQuote !== false;`，注释清晰说明"为什么在发送层而非归一化层门控"
- `#sendTextMessage`（:500-505）：引用条件改为 `quote && !edit && this.#replyQuote() && target.quoted`
- `#sendArtifact`（:615）：改为 `...(this.#replyQuote() && target.quoted ? { quoted: target.quoted } : {})`
- `sendTyping`（:647-652）**原样保留**：`target.quoted?.key` 用于 `readMessages` 蓝勾，不门控 `#replyQuote()`
- runtime `#start`（:822）构造 BotClient 时注入 `humanize: this.#humanize`

**关键设计正确性**：WhatsApp 不能在归一化层剥 `quoted`（会连带丢已读回执），必须在发送层门控。`target.quoted` 仍保留在 message shape 中（归一化不变），只是发送时不作为 `quoted` 参数传入 Baileys `sendMessage`。`sendTyping` 的 `readMessages` 调用完全独立于 `#replyQuote()`。

**测试**（`whatsapp.test.mjs:936-998`）：端到端验证全部 `sendMessage` 调用 `options.quoted === undefined`、文本回复与文件产物均送达、`readMessages` 仍被调用且 key 来自入站消息。✅

---

## 4. UI / i18n ✅

### 4.1 全局面板（`plugin-src/client/humanize-settings.js`）

在 `messageBreak` 字段（:320）之后、`onNewMessage` 下拉之前新增两个 checkbox（:323-348），结构沿用 `label.dim-humanizeField` → `fieldRow(checkbox + fieldName)` + `fieldHint`，`updateField(field, value)` 模式。`checked: settings.statusReaction !== false` / `settings.replyQuote !== false`——与现有 checkbox 一致的 `!== false` 语义（缺省为 true）。

### 4.2 i18n（`plugin-src/client/i18n.js`）

EN 词典补四条翻译（:1011-1014）：
- `'状态表情回应'` → `'Status emoji reactions'`
- hint → 英文翻译
- `'回复引用'` → `'Reply quotes'`
- hint → 英文翻译（明确列出 Telegram/Discord/WhatsApp + 话题/Thread 不受影响）

`h()` hyperscript 自动本地化字符串子节点，四条文案均覆盖。

### 4.3 verify-package（`scripts/verify-package.mjs`）

`humanize-settings.js` checkbox 计数 `4 → 6`（:157），`bot-send-delay.js` 保持 `2`（:158 不变，不加编辑器控件）。实测通过。

### 4.4 每机器人 UI

按计划 §3.4 不加每机器人 UI 控件（与 `streaming`/`messageBreak`/`typingIndicator` 一致），仅数据模型支持覆盖。`OVERRIDE_KEYS` 加两键防止保存 sendDelay 时静默丢值——此为关键集成点，已在 `client-humanize-ui.test.mjs:205-249` 测试中验证。

---

## 5. 测试覆盖 ✅

### 5.1 设置层

| 文件 | 新增用例 |
|---|---|
| `humanize-settings.test.mjs` | `deepEqual` 默认值含两键（:29-30）；malformed 归一化（:41-42 → 默认 true）；`validateHumanizeUpdate` 拒绝非 boolean（:43-44）；RPC `humanize.set` 合并（:125-132）；`resolveHumanizeSettings` provider 输出 vs 缺省回退（:151-159, :176-193）；`createHumanizeProvider` per-bot 覆盖（:190-193） |
| `humanize-override.test.mjs` | `normalizeHumanizeOverride` 保留 boolean / 丢弃非 boolean（:87-98）；`validateHumanizeOverrideSection` 接受 + 拒绝（:108-111, :129-131）；九渠道 RPC 循环 bad 列表含 `{ statusReaction: 'no' }` / `{ replyQuote: 'yes' }`（:328-329）；保存断言含新键（:317） |
| `host.test.mjs` | `humanizeDefaults` 九渠道键清单含两键（:66-98）；优先级链新键（:351-367） |

### 5.2 statusReaction 门控

| 文件 | 新增用例 |
|---|---|
| `humanize-bridge.test.mjs` | `statusReaction=false` 共享桥接零 emoji + 回复送达（:649-667）；`withKeepAlive` 包裹；默认生命周期回归（processing 👀 → terminal 👍/👎 + remove）（:669-688） |
| `feishu/bridge.test.mjs` | `statusReaction=false` 飞书零 emoji（add/remove 均空）+ 回复送达（:792-853） |
| `dingtalk/dingtalk-bridge.test.mjs` | `statusReaction=false` 钉钉零 reaction + `messagesReplied=1` + `reactionsAdded=0` + `reactionsRemoved=0`（:1262-1295） |

### 5.3 replyQuote 门控

| 文件 | 新增用例 |
|---|---|
| `telegram/telegram.test.mjs` | 归一化 `Object.hasOwn` 断言 + `messageThreadId` 保留 + `reactionTarget` 不受影响 + 端到端 `sendText` 无 `replyToMessageId`（:402-444） |
| `discord/discord.test.mjs` | 归一化 `Object.hasOwn` 断言 + `channelId` 保留 + `reactionTarget` 不受影响 + 端到端 `createMessage` body 无 `message_reference`（:104-144） |
| `whatsapp/whatsapp.test.mjs` | 全部 `sendMessage` 调用 `options.quoted === undefined` + 文本/产物送达 + `readMessages` 仍调用且 key 来自入站（:936-998） |

### 5.4 UI

| 文件 | 新增用例 |
|---|---|
| `client-humanize-ui.test.mjs` | 全局面板两 checkbox 渲染 / 勾选状态 / `onChange` 轮转 / 保存 payload 含 `statusReaction: false` + `replyQuote: true`（:107-139）；编辑器兄弟键保留测试加 `statusReaction` / `replyQuote`（:209-210, :247-249） |

### 5.5 测试质量评价

- **`withKeepAlive` 约定遵守**：`humanize-bridge.test.mjs` 两个新用例均以 `withKeepAlive` 包裹（:649, :669），符合 260908 确立的 unref'd timer / `AbortSignal.timeout` 用例约定
- **`Object.hasOwn` 断言**：Telegram / Discord 测试均用 `Object.hasOwn(obj, key) === false` 而非 `=== undefined`，正确区分"键不存在"与"键存在但值为 undefined"
- **端到端覆盖**：三个 replyQuote 测试均不限于归一化层，而是穿透到 API mock 层验证 wire-level 行为（Telegram `sendMessage` payload、Discord `createMessage` body JSON、WhatsApp `sendMessage` options）
- **回归测试**：`humanize-bridge.test.mjs` 的默认生命周期回归用例验证了 `statusReaction` 默认（true）时 processing → terminal 完整 emoji 链

---

## 6. 构建产物 ✅

`lib/client.js`（88 行变更）与 `lib/index.js`（264 行变更）已 `npm run build` 重新生成。`grep` 确认两文件分别含 7 处和 13 处 `statusReaction`/`replyQuote` 引用。`verify-package` 通过（含 checkbox 计数 6 同步）。

---

## 7. 文档 ✅

- `CHANGELOG.md`：Unreleased/Added 中英双语条目，含同版本升级说明（`SETTABLE_KEYS` 整体拒绝 + 客户端/宿主同版本要求）
- `README.md` / `README.en.md`：拟人化改动节补两开关条目，默认值与渠道差异说明完整

---

## 8. 回归红线 ✅

| 指标 | 实测 | 基线 | 判定 |
|---|---|---|---|
| 总测试数 | 2472 | 2472 | — |
| Pass | 2271 | 2271 | — |
| **Fail** | **0** | **0** | ✅ 零 fail |
| Cancelled | 200 | 200 | ✅ 零新增 |
| Skipped | 1 | 1 | — |

200 个 `cancelledByParent` 均为既有桥接 fixture 缺 keep-alive 的预置状态（计划 §3.5 已界定根因），逐文件分布与基线一致。`npm run check` exit 1 属预置 cancelled（非零退出码计入），非本功能缺陷。

清代理环境运行：`env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u NODE_USE_ENV_PROXY`，排除了 2 个代理环境污染 fail（`feishu-proxy` / `lark-sdk-handshake-patch`）。

---

## 9. 逐项检查清单

| 检查项 | 结果 |
|---|---|
| 计划语义界定（§2）一致性 | ✅ statusReaction 仅停发出站表情，NOOP 惰性化全部 success/error/clear；replyQuote 只消除视觉引用头，结构性行为（Slack 线程 / 飞书话题 / 钉钉 webhook）不动；WhatsApp 已读回执耦合在发送层门控 |
| 门控点正确性（§4.2 三处 + §4.3 三渠道） | ✅ 六处门控逐一核实，均逐消息活读 provider，`=== false` 严格判断 |
| 键名单六处完整性（§4.1） | ✅ 六处全部同步，无遗漏 |
| 每机器人数据模型支持覆盖 + OVERRIDE_KEYS | ✅ 数据模型支持，OVERRIDE_KEYS 加两键，无 per-bot UI（与 streaming/messageBreak/typingIndicator 一致） |
| UI 渲染 / 勾选 / 保存 payload | ✅ 两 checkbox 渲染、`!== false` 勾选语义、保存 payload 含两键 |
| i18n EN 词典 | ✅ 四条翻译覆盖 |
| verify-package checkbox 4→6 | ✅ |
| 测试覆盖（设置 / 门控 / UI / 回归） | ✅ 全面，含 `withKeepAlive`、`Object.hasOwn`、端到端 wire-level |
| 构建产物重新生成 | ✅ lib/client.js + lib/index.js |
| 回归红线（零 fail / 零新增 cancelled） | ✅ 2472/2271/0/200 |
| 文档（CHANGELOG / README） | ✅ 中英双语 |
| 兼容性（默认 true = 升级无感） | ✅ 旧 humanize.json / workspaces.json 无新键，normalize 补默认 true |

---

## 10. 发现的问题

**无阻塞问题。**

以下为非阻塞观察（不影响准入）：

1. **Telegram 端到端测试仅覆盖 `sendText`**：计划 §4.5 提到 `sendMessage/sendPhoto/sendDocument` 三条出站路径，实际测试仅验证 `sendText`。但 `grep` 确认全部 10 处 `replyToMessageId` 引用均读 `target.replyToMessageId`，归一化层剥除后自动传播到所有路径，机制一致性使单路径验证充分。非阻塞——已有测试覆盖了核心路径。

2. **`resolveDiscordMessageRoute` 的 `replyQuote` 条件 spread**：`...(replyQuote === undefined ? {} : { replyQuote })` 在未传 `replyQuote` 时回退到 `normalizeDiscordMessage` 默认值 `true`。这一行为正确但略隐晦——直接传 `replyQuote` 亦可（`normalizeDiscordMessage` 对 `undefined` 也有默认值 `true`）。当前写法是安全的防御模式，非问题。

---

## 11. 结论

**准入。**

全部检查项通过：六处键名单同步、六处门控点语义正确、UI/i18n/verify-package 同步、测试覆盖全面（含 `withKeepAlive` 约定、`Object.hasOwn` 断言、端到端 wire-level 验证）、构建产物已重新生成、回归红线零新增（2472/2271/0/200 与基线逐项一致）、文档完整。实现与计划文档的语义界定完全一致，无偏差。
