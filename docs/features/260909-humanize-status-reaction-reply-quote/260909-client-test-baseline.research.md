# dsh-im-humanize 客户端 UI 与测试基线摸底报告（statusReaction / replyQuote 新增设置前置调研）

仓库：`/root/projects/dsh-im-humanize`（`@xmanrui/dsh-im` v4.13.0 fork）。纯 Node.js ESM (.mjs)，客户端为无框架 hyperscript 风格（`h()` 来自 `plugin-src/client/i18n.js:1173`，包裹 `React.createElement` 并做中→英本地化），测试 node:test + react-test-renderer。

---

## A. 全局拟人化设置面板（plugin-src/client/humanize-settings.js，共 564 行）

### A1. 组件结构与加载/保存流

- **组件**：`HumanizeSettingsPanel({ rpcCall })`（L119）。挂载点在 `plugin-src/client/index.js:339`（`h(HumanizeSettingsPanel, { rpcCall: rpcCalls.humanizeRpcCall })`，与 `GlobalSettingsPanel` 并列于「通用设置」栈）；`humanizeRpcCall` 定义于 index.js L424-425：
  ```js
  const humanizeRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(HUMANIZE_RPC_CHANNEL, endpoint, payload, signal);
  ```
- **状态**（L120-127）：`phase`('loading'/'ready'/'error')、`loadError`、`settings`、`saveError`、`saveSucceeded`、`isSaving`、`mounted`/`saving` ref。
- **RPC 包装**：`invoke`（L129-132）→ `unwrapRpcResult`（L109-117）：`{ok:true}→value`，`{ok:false}→throw Error(error.message)`（带 `error.code`）。
- **加载**：`loadSettings`（L134-147）调 `HUMANIZE_ENDPOINTS.get`（`humanize.get`），payload `{}`；mount 时 AbortController（L149-157）。loading/error（带「重试」按钮）/空 三种降级视图 L269-288。
- **保存**：`save`（L249-267）：
  ```js
  const updated = await invoke(HUMANIZE_ENDPOINTS.set, settings);  // 整个 settings 对象作为 payload
  setSettings(updated); setSaveSucceeded(true);
  ```
  即 `humanize.set` 的 payload 是**完整 settings 对象**（不是增量），服务端返回合并+normalize 后的对象回填。失败时 `saveError` 展示。
- **字段更新**：`updateField(field, value)`（L159-162）`setSettings(prev => ({...prev, [field]: value}))`；sendDelay 专用 `updateSendDelayMs`（L165-176，秒→ms）、`updateSendDelayRate`（L179-190）、`updateActivityBoost/updateActivitySeconds/updateActivityMinutes/updateActivityEnabled`（L194-218）、`updateTypingBurstMs`（L221-229）；预设 `SEND_DELAY_PRESETS`（L50-87，轻拟人/慢性子/沉浸角色扮演/即刻应答）+ `applyPreset`（L232-247）。

### A2. 各现有开关的渲染（label.dim-humanizeField 结构）

| 开关 | 行号 | 形式 | 关键代码 |
| --- | --- | --- | --- |
| streaming 流式回复 | L297-308 | checkbox | `checked: settings.streaming, onChange: (e) => updateField('streaming', e.target.checked)`；名称 `.dim-humanizeFieldName`，说明 `.dim-humanizeFieldHint` |
| messageBreak 分步消息 | L310-321 | checkbox | `checked: settings.messageBreak`，label `'分步消息 (message_break)'` |
| onNewMessage 新消息行为 | L323-335 | select | `value: settings.onNewMessage` + `ON_NEW_MESSAGE_OPTIONS`（L15-19：interrupt/queue/steer） |
| sendDelay 发送延迟 | L337-491 | 预设下拉+checkbox+多个 number 输入 | enabled checkbox L352-368（`settings.sendDelay?.enabled === true`）；阅读延迟区间 L369-384；阅读速度/封顶 L385-403；活跃响应 checkbox L404-414 + 四窗口 L415-451；分段间隔/速度 L452-489；渠道封顶提示 L490-491 |
| typingIndicator 输入状态指示 | L493-505 | select | `value: settings.typingIndicator` + `TYPING_INDICATOR_OPTIONS`（L21-25：off/continuous/burst） |
| typingBurst 断续节奏高级参数 | L506-542 | `<details>` 折叠 + 4 个 ms 输入 | `msInputValue(settings.typingBurst?.onMinMs)` 等 |

保存按钮与错误展示（L546-561）：`h('button', { className: 'dim-deliveryButton dim-humanizeSave', 'data-kind': 'primary', disabled: isSaving, onClick: () => void save() }, isSaving ? '保存中…' : '保存')`；成功 `h('span', { className: 'dim-humanizeStatus', 'data-tone': 'success', role: 'status' }, '已保存')`；失败 `data-tone: 'error', role: 'alert'` 展示 `saveError`（来自 `unwrapRpcResult` 抛出的 message，即宿主 `validateHumanizeUpdate` 的英文报错文本）。

### A3. 常量三处（实际四处）重复定义

`humanize-settings.js` 顶部注释（L5-7）：*"These constants are duplicated in plugin-src/host/humanize-rpc.mjs and src/channels/shared/humanize-settings.mjs to avoid importing Node.js built-ins into the browser bundle."*

| 文件 | 行号 | 定义的常量 |
| --- | --- | --- |
| `plugin-src/client/humanize-settings.js` | L8-13 | `HUMANIZE_RPC_CHANNEL = '/dsh-im-humanize'`、`HUMANIZE_SETTINGS_TAB_ID = 'humanize-settings'`、`HUMANIZE_ENDPOINTS = { get: 'humanize.get', set: 'humanize.set' }` |
| `plugin-src/host/humanize-rpc.mjs` | L3-12 re-export；**L18-25 `SETTABLE_KEYS`**（客户端可写键白名单：streaming/messageBreak/onNewMessage/sendDelay/typingIndicator/typingBurst）；L27-39 `validHumanizePayload`（set 时 `keys.every(key => SETTABLE_KEYS.has(key))`，否则 `bad-request`） |
| `src/channels/shared/humanize-settings.mjs` | L23-28 RPC channel/endpoints；**L30-37 `DEFAULT_HUMANIZE_SETTINGS`**（默认值，streaming:true、messageBreak:true、onNewMessage:'interrupt'）；L46-59 `normalizeHumanizeSettings`（宽容修复）；L67-100 `validateHumanizeUpdate`（严格校验 + **L94-99 未知键拒绝** `Unknown humanization setting: ${key}`） |
| （第 4 处）`plugin-src/host/index.mjs` | **L32-39 `HUMANIZE_CONFIG_KEYS`**（dsh-config 优先级链的键清单）；L153-165 `humanizeDefaults(channelName)` 访问器（`sub[key] ?? explicitHumanize[key] ?? live[key]`） |
| （第 5 处，桥接侧）`src/channels/shared/humanize-resolver.mjs` | L18-36 `resolveHumanizeSettings` —— **显式按键白名单产出** streaming/messageBreak/onNewMessage/sendDelay/typingIndicator/typingBurst；桥每回合调用（`text-harness-bridge.mjs` `#humanizeSettings()` L460-467）。**新键不加这里，桥永远看不到** |

**新增设置键必须同步的位置（全局侧）**：① `DEFAULT_HUMANIZE_SETTINGS` ② `normalizeHumanizeSettings` ③ `validateHumanizeUpdate`（含未知键清单）④ `SETTABLE_KEYS`（humanize-rpc.mjs）⑤ `HUMANIZE_CONFIG_KEYS`（host/index.mjs）⑥ `resolveHumanizeSettings`（humanize-resolver.mjs）。

### A4. 两个新布尔开关的插入建议

- 位置：紧跟 messageBreak 开关（L321）之后、onNewMessage 下拉之前，作为同级 `h('label', { className: 'dim-humanizeField' }, ...)`，完全复用 `fieldRow(checkbox+fieldName) + fieldHint` 结构，`checked: settings.statusReaction !== false`（默认 true）、`onChange: (e) => updateField('statusReaction', e.target.checked)`。注意 `updateField` 对缺失键直接写入，normalize 端保证默认。
- 保存无需改 `save()`——payload 是整个 settings；但必须先扩 `SETTABLE_KEYS` + `validateHumanizeUpdate` + `DEFAULT_HUMANIZE_SETTINGS`，否则宿主直接拒绝（bad-request / invalid-humanize-settings）。
- **`scripts/verify-package.mjs` L157 复选框清单必须同步**：`['humanize-settings.js', …, { checkbox: 4, switch: 0 }]` → 6（现状 4 个 checkbox：streaming、messageBreak、sendDelay.enabled、activityBoost.enabled）。`npm run check` 会因清单过期而失败。
- **`plugin-src/client/i18n.js` EN 词典**（L8 起，约 1040 条中→英映射）需为新的中文 label/hint 补英文（`h()` 会自动 localize 字符串子节点与 aria-label/title/placeholder/alt，见 L1160-1184）。
- CSS 类 `.dim-humanizeField` 等已在 `plugin-src/client/styles.js` L583-590 定义，无需新增。

---

## B. 每机器人 humanize 覆盖编辑器

### B1. 共享编辑器与所有挂载点

**唯一的编辑器组件是 `BotSendDelayEditor`**（`plugin-src/client/channels/shared/bot-send-delay.js` L245-522），九渠道全部复用。它**只编辑 sendDelay**；其余键仅"透传保留"：

```js
// bot-send-delay.js L45
const OVERRIDE_KEYS = ['streaming', 'messageBreak', 'onNewMessage', 'typingIndicator', 'typingBurst'];
```

各渠道挂载位置（`h(BotSendDelayEditor, { humanize, sendDelayDefaults, capability, disabled, onSave: onHumanizeSave })`）：

| 渠道 | 挂载行 | capability | onHumanizeSave 接线行 |
| --- | --- | --- | --- |
| telegram/discord/slack（经 `shared/token-channel.js`） | token-channel.js L144-150 | full / full / none（discord/index.js L11、telegram L11、slack L110 `typingCapability`） | token-channel.js L373-378（`botAction(account,'humanize',endpoints.setHumanize,{botId,humanize})`） |
| wecom | wecom/index.js L238-244 | none | L565-570 |
| qq | qq/index.js L239-245 | c2cOnly | L534-539 |
| whatsapp | whatsapp/index.js L261-267 | full | L542-547 |
| dingtalk | dingtalk/index.js L312-318 | none | L364（转发）+ L950-952（`saveBotSetting(account,'humanize',DINGTALK_ENDPOINTS.setHumanize,{humanize})`） |
| weixin | weixin/index.js L280-286 | full | L333（转发）+ L774-776 |
| feishu | feishu/index.js L618-624 | none | L722（转发）+ L1498-1500 |

endpoint 常量：`SET_HUMANIZE_ENDPOINT = 'bot.humanize.set'`（`src/channels/shared/humanize-override.mjs` L27），每个渠道 api.js 从宿主模块 re-import（wecom/api.js L6+L22、qq L6+22、whatsapp L6+22、weixin L6+21、dingtalk L6+22、feishu L14+33、shared/token-api.js L6+38）。

### B2. 编辑器渲染与保存 payload

- **模式**：follow（跟随全局）/ override（自定义覆盖）radio（L361-379）。follow 无覆盖时保存按钮禁用（L512 `disabled: busy || (mode === 'follow' && !current)`）。
- **override 模式字段**（L381-505）：启用 checkbox（L382-392）、阅读延迟区间（L393-413）、高级 NumberField（阅读速度/封顶，L414-426）、活跃响应 checkbox + 4 窗口（L427-463）、分段间隔/速度/封顶（L466-499）、覆盖语义与渠道能力提示（L500-505）。**当前没有任何 per-bot 布尔/下拉 UI**——streaming/messageBreak/onNewMessage/typingIndicator 只在全局面板可改。
- **保存**（`save()` L294-338）：
  - follow：`await onSave(null)` —— 清除整段覆盖（服务端 `setHumanize(botId, null)`）。
  - override：`payload = validateDraft(draft)`（L146-204，秒/分钟→ms、区间校验、FieldError），然后：
    ```js
    // L321-330
    const rest = {};
    for (const key of OVERRIDE_KEYS) {
      if (humanize && typeof humanize === 'object' && humanize[key] !== undefined) rest[key] = humanize[key];
    }
    await onSave({ ...rest, sendDelay: payload });
    ```
    即 payload = **保留的兄弟键 + 完整 sendDelay**。"humanize 节至少一个键"由服务端 `validateHumanizeOverrideSection` 强制（humanize-override.mjs L137-139：`'humanize section must set at least one key (or be null to clear).'`）。
- **sendDelayDefaults 预填**：`draftFromConfig(current ?? defaults ?? DEFAULT_SEND_DELAY_CONFIG)`（L256-257）；`defaults` 来自快照级 `account.humanizeDefaults?.sendDelay`（宿主 `bot-workspace-store.mjs` L1166-1181 `withHumanizeDefaults` 注入，客户端各 api.js normalizeSnapshot 只保留 `humanizeDefaults.sendDelay`，如 token-api.js L105-107、wecom/api.js L142-144）。干净草稿才会被 15s 轮询 re-sync（L267-271 dirty 守卫）。

### B3. 新增两个布尔键到每机器人编辑器需要改的文件

1. `src/channels/shared/humanize-override.mjs`：`normalizeHumanizeOverride`（L41-48 增 `if (typeof value.statusReaction === 'boolean') out.statusReaction = ...` 同理 replyQuote）、`validateHumanizeOverrideSection`（L96-119 增布尔校验 + **L132-136 未知键数组**加入两个新键）。
2. `plugin-src/client/channels/shared/bot-send-delay.js`：`OVERRIDE_KEYS`（L45）加入 `'statusReaction','replyQuote'`（否则保存 sendDelay 时会把已有覆盖静默丢掉）；若要在编辑器里放两个新 checkbox，则在 L382-392 附近加（注意 L23-25 注释：checkbox 数量被 verify-package 审计）。
3. `scripts/verify-package.mjs` L158：`['bot-send-delay.js', …, { checkbox: 2, switch: 0 }]` → 4（若在编辑器加两个 checkbox）。
4. **渠道 index.js 均不需要改**（它们只传 `humanize`/`onSave`，编辑器集中改动自动生效）；只有当选择"另立独立组件"而非扩展 BotSendDelayEditor 时，才需要改 7 个挂载点（token-channel.js + wecom/qq/whatsapp/dingtalk/weixin/feishu 的 index.js）。
5. `plugin-src/client/i18n.js`：新中文文案的英文映射。

### B4. normalizeHumanizeOverride 的导入与"未知键拒绝"

- 各渠道 client api.js 的 `import { normalizeHumanizeOverride, SET_HUMANIZE_ENDPOINT } from '../../../../src/channels/shared/humanize-override.mjs'` 是**对宿主共享模块的直接 import**（该模块头注释 L10-12 明确"Browser-safe module: imported by the workspace store, the host RPC layer, and the client bundle"）。normalizeBot 处 `...(Object.hasOwn(value, 'humanize') ? { humanize: normalizeHumanizeOverride(value.humanize) } : {})`：
  - wecom/api.js L109-111、qq L100-102、whatsapp L100-102、weixin L134-136、dingtalk L191-193、feishu L218-220、shared/token-api.js L70-72。
- **客户端不做未知键拒绝**——`normalizeHumanizeOverride` 是宽容修复（丢弃非法/未知键，L38-50）。严格拒绝在宿主侧两处：
  - `plugin-src/host/channels/shared/humanize-bot-rpc.mjs` L8-20 `validHumanizeSectionPayload`（RPC 顶层形状 gate，内部调 validateHumanizeOverrideSection）；
  - `src/channels/shared/bot-workspace-store.mjs` L790-793（`BotWorkspaceStore.setHumanize`）与 L1757-1791（`createWorkspaceAwareController.updateHumanize`，L1762 传入 `sendDelayBase` 继承全局）。
- 结论：**客户端 api.js 因新键零改动**（共享 import 自动生效）；需要动的是 bot-send-delay.js 的 OVERRIDE_KEYS/UI 与宿主 humanize-override.mjs。

---

## C. 测试基线

### C1. humanize 设置相关测试

| 文件 | 覆盖点 |
| --- | --- |
| `test/humanize-settings.test.mjs`（197 行，6 测试） | L23-45 默认值+normalize 宽容（含 legacy typingIndicator 布尔映射）；L47-72 validate 严格（未知键 `unknownKey`→`invalid-humanize-settings`、类型错、null）；L74-98 原子持久化+0600 权限；L100-125 RPC set 拒绝坏值/部分更新合并/get；L127-147 `resolveHumanizeSettings` live provider 优先；L149-197 `createHumanizeProvider` 全局默认×per-bot 节合并 |
| `test/humanize-override.test.mjs`（366 行） | L81-103 normalize 修复丢弃；L105-138 validate 部分节+sendDelay 完整性+未知键（`humanize.unknown`）+空节拒绝；L140-220 sendDelay 子字段继承全局 base；L221-264 BotWorkspaceStore 持久化/清除/随 bot 删除；L266-280 旧文件不迁移；**L282-340 九渠道循环**（`for (const [channel, createHandler, endpoints] of CHANNELS)`）逐渠道验证 setHumanize RPC 保存/校验/装饰/清除；L350+ provider 链路 |
| `test/client-humanize-ui.test.mjs`（440 行） | L58-117 全局面板渲染+编辑后 `humanize.set` payload 断言（ms 换算、activityBoost 嵌套位置回归）；L119-181 编辑器完整 sendDelay 保存；L183-232 兄弟键保留+follow 清除；L234-272 区间校验；L274-286 无 typing 提示；L288-336 token 快照 normalize 携带 humanize（含坏值修复）；L338-396 草稿脏守卫（15s 轮询）；L398-440 全局默认预填（**L429-430 `assert.equal(checkboxes.length, 2)`** —— 编辑器 checkbox 数量断言，加开关要改） |
| `test/humanize-bridge.test.mjs`（615 行） | 两阶段管线：read delay 先于 typing/ask（L127）、activity fast reply（L156）、禁用时 legacy 流程（L199）、supersede（L220）、/stop（L247）、streaming 早停（L274）、queue/steer（L304/340）、分段 gap（L479）、交互暂停（L523）、错误熄灭（L574）、无 typing API 渠道（L594）。注意 DESCRIPTOR L27 `reactions: undefined`——本文件不测 reaction |
| `test/channels/qq/humanize.test.mjs` | QQ 专属：C2C 延迟/typing（L102）、群聊不 typing（L136）、supersede（L166）、/stop（L194）、交互暂停（L227） |
| `test/channels/shared/humanize-standalone-bridges.test.mjs` | weixin/dingtalk/wecom/feishu 四个非 TextHarnessBridge 渠道的延迟/typing/streaming=false（L113-516） |
| `test/host.test.mjs` L295-365 | `humanizeDefaults` 渠道优先级（store < 顶层 dsh-config < 渠道子对象）+ 面板写 RPC 后 live 生效 + 坏写拒绝 |
| 其他 | `test/send-delay.test.mjs`（normalize/validate/compute/merge L129）、`test/typing-session.test.mjs`、`test/new-message-policy.test.mjs`、`test/message-break.test.mjs` |

### C2. 状态 Reaction 相关测试（statusReaction=false 需要加用例的位置）

**实现侧（供对照）**：reaction 由 `src/channels/shared/status-reaction.mjs` `beginStatusReaction()`（L34-107，NOOP 降级 L43-49）驱动，三个启动点：
1. `src/channels/shared/text-harness-bridge.mjs` **L277-287**（telegram/discord/slack/whatsapp 四个 TextHarnessBridge 子类；descriptor.reactions：telegram 👀/👍/👎、discord 👀/✅/❌、whatsapp 👀/✅/❌、slack eyes/white_check_mark/x）
2. `src/channels/feishu/bridge.mjs` **L4934-4943 `#beginReaction`**（OnIt/DONE/ERROR）
3. `src/channels/dingtalk/dingtalk-bridge.mjs` **L634 / L1011 `#startStatusReaction`**（原生 thinking→done 流）
qq/wecom/weixin 无 addReaction（beginStatusReaction 自动 NOOP）。

**测试文件与位置**：
- `test/channels/shared/status-reaction.test.mjs`（3 测试：顺序替换 L5、超时吸收 L35、首终态胜出 L58）——纯单测，gate 不在此层则不用改。
- `test/channels/shared/text-harness-bridge.test.mjs`：L209-296（reaction 不阻塞队列/success 替换）、L432-465（abort 清除）——**statusReaction=false 的桥级新用例加这里**（构造 `humanize: { getSettings: () => ({ statusReaction: false, ... }) }` 断言 addReaction 零调用）。
- `test/channels/telegram/telegram.test.mjs` **L309-370**：`Telegram API and bot client set and clear one reaction on the source message`（setMessageReaction API + TelegramBotClient.addReaction/removeReaction adapter 断言）。
- `test/channels/whatsapp/whatsapp.test.mjs`：L864-867（桥级 reactionSends `['👀','']`）、**L981-1021**（client addReaction/removeReaction 对 full source key）、L1023-1039（上层硬超时）、L1434-1437（另一流程）。
- `test/channels/discord/discord.test.mjs` **L1108-1133**（client addReaction/removeReaction）。
- `test/channels/slack/slack.test.mjs` **L188-243**（API reactions.add/remove + client adapter）。
- `test/channels/feishu/feishu-channel.test.mjs` L285（channel.addReaction）、`test/channels/feishu/bridge.test.mjs` L410-452、L616-618、L693-706。
- `test/channels/dingtalk/dingtalk-bridge.test.mjs` **L1195-1259**（thinking→done 替换、reactionsAdded/Removed 计数）、L1264+（recall 流）。
- 另有 `test/channels/dingtalk/dingtalk-api.test.mjs`、`test/channels/feishu/feishu-channel.test.mjs` 的 API 级 reaction。

### C3. 回复引用相关测试（replyQuote=false 需要加用例的位置）

**实现侧（供对照）**：各渠道 replyTarget 形状与引用机制：
- telegram：`telegram-runtime.mjs` L279-284 `replyTarget: { chatId, chatType, replyToMessageId: messageId, messageThreadId }` → sendMessage 带 `reply_parameters`（首段引用、后续段不引用，见 telegram.test.mjs L393-395）；文件产物同样带 reply_parameters（L417-421）。
- discord：`discord-runtime.mjs` L107-111/L150-151 `replyTarget: { channelId, replyToMessageId }` → `message_reference`。
- whatsapp：`whatsapp-runtime.mjs` L336 `replyTarget: { jid, quoted: message, selfChat }` → `#sendTextMessage` L473-489 `{ ...(quote && !edit && target.quoted ? { quoted: target.quoted } : {}) }`（**已有内部 `quote = true` 选项**）；文件发送 L599 同样带 quoted；sendTyping 还用 quoted.key 标记已读（L632-634）。
- slack：`slack-runtime.mjs` L193-196 `replyTarget: { …, threadTs }` → 线程回复（注意 threadTs 同时承担会话路由 conversationId，**剥掉会破坏线程语义**，replyQuote 在 slack 的对应物需设计裁决）。
- feishu：`feishu-channel.mjs` sendText/sendFile 的 `{ replyTo }` 选项（L276-311、L365-381、L484-503）。
- qq：`replyTarget: { scope, targetId, msgId }`；wecom/weixin：纯会话目标，无引用语义。
- 共享桥发送点：`text-harness-bridge.mjs` L388（`send: (text) => this.#bot.sendText(normalized.replyTarget, text)`）、L478、L621、L757、L1272、L1556。

**测试位置**：
- `test/channels/telegram/telegram.test.mjs`：**L371-397**（4000 边界 + `calls[0].replyToMessageId === 44`、`calls[1].replyToMessageId === undefined`、threadId）；L401-424（sendDocument `reply_parameters` JSON 断言）；L426+（sendPhoto 同）；**L1050-1096**（normalize 断言 `replyTarget`/`reactionTarget`/`connectionTestTarget` 形状，L1050 `privateMessage.reactionTarget`、L1065 `replyTarget.chatType`、L1088-1091 topic replyTarget）。
- `test/channels/whatsapp/whatsapp.test.mjs`：L856（`textSends[0].options.quoted === inbound`）、L863（`textSends[1].options.quoted === undefined`）、L926（文件 `fileCall.options.quoted === inbound`）；L427-476（入站 quotedMessage 快照——那是另一个特性 reply-reference）。
- `test/channels/discord/discord.test.mjs`：L249（`payload.message_reference.message_id`）、L706-711（replyTarget 形状断言）、L788-1034（Thread 路由与降级，`route.replyTarget`）。
- `test/channels/slack/slack.test.mjs`：L299（thread_ts body）、L885-918（`replyTarget.threadTs`）。
- `test/channels/feishu/feishu-channel.test.mjs`：大量 `{ replyTo: 'om_user' }` 断言（L106/143/206/242/258/305/337/384-471）。
- `test/reply-reference.test.mjs`（10 测试）是**入站**引用（把用户引用的上文注入 prompt），与出站 replyQuote 是不同特性，但命名相近，改动时注意区分。

### C4. 测试怎么跑

`package.json` scripts：
```json
"build": "node plugin-src/client/build.mjs && node plugin-src/host/build.mjs",
"test": "node --test test/*.test.mjs test/channels/*/*.test.mjs",
"check": "npm run build && npm test && node scripts/verify-package.mjs"
```
- 测试规模：`test/*.test.mjs` 68 个 + `test/channels/*/*.test.mjs` 97 个。
- **无 eslint/prettier**；`scripts/verify-package.mjs` 是发布门禁：除 checkbox 清单（L150-179）外还检查 legacy 入口、marker、渠道 RPC 前缀等。
- 单文件运行：`node --test test/humanize-settings.test.mjs`。

---

## D. 文档与发布惯例

### D1. docs/features/ 目录惯例

现有唯一 feature 目录：`docs/features/260908-humanize-send-delay-typing/`，命名 **yymmdd-{name}**，内含 6 个文件（后缀即类型）：
- `{yymmdd}-{name}.research.md` —— 平台能力与实证调研（每平台一节 + 汇总矩阵 + 人类行为数据）。
- `{yymmdd}-{name}.plan.md` —— 编号章节 §0-§10+：两阶段模型（概念基石）→ 最终决定 → 需求背景与用户路径 → 现状盘点（代码事实）→ 范围与完成标准（必须实现/明确不做/完成标准）→ 数据模型与生效规则（全局 humanize.json §5.1 / per-bot workspaces.json §5.2）→ 架构设计 → 客户端 UI 设计 → 测试与验收（单元/回归红线/真机验收）→ 实施顺序 → 风险与开放问题。文档内用 `§行号` 引用自身。
- `{yymmdd}-{name}.review.md` —— 代码评审：阻塞级问题 → 计划符合度偏差（逐项裁决）→ 正确性细察 → 测试与门禁状态 → 次要问题 → 修复清单（按优先级）→ 验证方式。
- `{yymmdd}-{name}.summary.md` —— 实施总结：交付内容（模块/渠道/客户端/测试分组）→ 关键发现与修复 → 验证与回归 → 用户验证 → 检视修复闭环（P0/P1/P2）。
- `{yymmdd}-{name}.validation.md` —— 用户验证：验证说明（对象/环境前置）→ 验证项**表格**（验证步骤 | 预期结果 | 实际结果 | 状态 | 备注/证据）→ 验证结论 → 待跟进。
- 另有增量评审 `{yymmdd}-{topic}.review.md`（如 `260908-humanize-activity-boost.review.md`）。
- **新功能目录建议**：`docs/features/260910-humanize-status-reaction-reply-quote/`（按当天日期），配 plan/summary/validation（+review 如走检视流程）。

### D2. CHANGELOG.md 格式

- 头部说明遵循 Keep a Changelog 1.1.0 + SemVer，**中英双语**。
- 结构：`## [Unreleased]` → `### Added / 新增`、`### Fixed / 修复`（也有 breaking 标注：`**breaking（配置）**：…`）。
- 每个条目 = **一段中文 + 紧随一段英文**（两段平行翻译，非逐行对照）。当前 Unreleased 已有发送延迟/输入状态/活跃响应等条目——新开关应追加到 Unreleased/Added。
- 已发布版本示例 `## [4.13.0] - 2026-09-06`。

### D3. 用户文档同步点

- `README.md` **L44-96 `## 本 Fork 的改动（拟人化）`**：逐项列出 streaming/messageBreak/onNewMessage（L50-58）、发送延迟（L60-77）、输入状态指示（L79-91）。新增两个开关需在此节补条目（含默认值与渠道差异说明）。
- `README.en.md` **L43 起**同结构的英文节，需同步。
- `docs/` 下**没有**其他拟人化用户文档（grep "拟人化|humanize" 仅命中 feature 目录与 README）；docs/ 其余是访问模式/上下文增强/超时补发等独立文档。
- 上游同步说明段（README L93-95）提到 message_break/streaming 依赖 fork 的 HarnessReplyTracker 扩展——新增开关不涉及。

### D4. 版本与发布方式（向后兼容注意）

- `package.json`：`"version": "4.13.0"`，`"name": "@xmanrui/dsh-im"`，`"bin": { "dsh-im": "bin/dsh-im.mjs" }`（install/uninstall 引导器，从 github:xmanrui/dsh-im 或本地安装）。
- 发布产物：`files` 含 `lib`（esbuild bundle：`plugin-src/client/build.mjs` → `lib/client.js`，`plugin-src/host/build.mjs` → `lib/index.js`）+ `plugin-src` + `src` 源码。**改任何 plugin-src/src 后必须 `npm run build` 重新生成 lib/**，verify-package 校验的是 lib bundle。
- `dsh.compatibility.dsh`: `"0.1.2-alpha.4 || 0.1.2-alpha.5 || 0.1.2-rc.1 || 0.1.3-alpha.1"`。
- 向后兼容语义（对新设置键）：
  - 旧版插件读新版写出的 humanize.json：`normalizeHumanizeSettings` 只拷贝已知键，未知键被忽略 → **读侧安全**。
  - 新版客户端写旧版宿主：`SETTABLE_KEYS`/`validateHumanizeUpdate` 拒绝 → `bad-request`/`invalid-humanize-settings`，面板会显示报错（整对象 payload 意味着**任何一个新键都会让保存失败**，不是部分成功）——CHANGELOG 需说明"客户端与宿主需同版本"。
  - 两键默认 true → 行为与现状一致，零回归红线（参照 send-delay 的 `enabled=false` 惯例）。

---

## 客户端与测试改动点清单草案（新增 statusReaction / replyQuote：全局 + 每机器人）

### ① 常量/宿主数据模型（客户端可见行为的根）
1. `src/channels/shared/humanize-settings.mjs`：`DEFAULT_HUMANIZE_SETTINGS`（L30-37，+`statusReaction: true, replyQuote: true`）、`normalizeHumanizeSettings`（L46-59，布尔宽容）、`validateHumanizeUpdate`（L67-100，布尔严格 + 未知键清单 L94 已由 DEFAULT 键集派生，无需单列）。
2. `plugin-src/host/humanize-rpc.mjs`：`SETTABLE_KEYS`（L18-25）加两键 —— **客户端可写白名单**。
3. `plugin-src/host/index.mjs`：`HUMANIZE_CONFIG_KEYS`（L32-39）加两键（dsh-config 优先级链 humanizeDefaults L157-165）。
4. `src/channels/shared/humanize-resolver.mjs`：`resolveHumanizeSettings`（L18-36）加两键输出 —— 桥每回合读取的入口。
5. `src/channels/shared/humanize-override.mjs`：`normalizeHumanizeOverride`（L41-48）、`validateHumanizeOverrideSection`（L96-136，含未知键数组 L133）加两键。

### ② 全局面板 UI（1 个文件 + 2 个配套）
6. `plugin-src/client/humanize-settings.js`：L321 后插两个 `label.dim-humanizeField` checkbox（中文文案 + hint），`updateField('statusReaction'|'replyQuote', e.target.checked)`；`save()` 不用改。
7. `plugin-src/client/i18n.js`：EN 词典补 2 组 label/hint 翻译（含 aria-label 若有）。
8. `scripts/verify-package.mjs` L157：`humanize-settings.js` checkbox 4 → 6。

### ③ 每机器人编辑器（1 个文件 + 1 个配套）
9. `plugin-src/client/channels/shared/bot-send-delay.js`：`OVERRIDE_KEYS`（L45）加 `'statusReaction','replyQuote'`（保兄弟键）；编辑器内加两个 checkbox（L382 附近）或独立小节；文件头注释 L23-25 提醒 checkbox 审计。
10. `scripts/verify-package.mjs` L158：`bot-send-delay.js` checkbox 2 → 4。
11. **渠道 index.js 全部不用改**（共享编辑器）；仅当另立组件时改 7 处挂载（token-channel.js L144、wecom L238、qq L239、whatsapp L261、dingtalk L312、weixin L280、feishu L618）。

### ④ 行为生效点（宿主桥，供实施参考——非客户端但决定开关语义）
12. statusReaction：`src/channels/shared/text-harness-bridge.mjs` L277-287（accept 时 gate beginStatusReaction，需在 accept 里读 `#humanizeSettings()`）、`src/channels/feishu/bridge.mjs` L4934、`src/channels/dingtalk/dingtalk-bridge.mjs` L634。
13. replyQuote：发送点 gate（telegram `replyToMessageId`、discord `replyToMessageId`、whatsapp `quoted`、feishu `replyTo`；slack threadTs 是路由语义需设计裁决；qq msgId 需核实是否引用语义）——集中在 text-harness-bridge 的 `sendText(message.replyTarget, …)` 调用点（L388/478/621/757/1272/1556）或各 runtime。

### ⑤ 测试新增/调整
14. `test/humanize-settings.test.mjs`：默认值断言（L25-32 加两键）、validate 用例（L48-57 加 `statusReaction: 'yes'` 拒绝、未知键已覆盖）、RPC 合并（L100-125）。
15. `test/humanize-override.test.mjs`：normalize/validate 新键用例（L81-138）、九渠道 RPC 循环的 bad 列表（L312-317）可加 `{ statusReaction: 'no' }`。
16. `test/client-humanize-ui.test.mjs`：全局面板渲染 + set payload 断言（L58-117 扩展）；编辑器兄弟键保留断言（L183-232 加 `statusReaction: false` 保留）；**L429-430 checkbox 数量 2 → 4**。
17. `test/host.test.mjs` L295-365：humanizeDefaults 新键优先级断言。
18. reaction 关闭新用例：`test/channels/shared/text-harness-bridge.test.mjs`（humanize provider 传 `statusReaction:false` → addReaction 零调用）、`test/channels/dingtalk/dingtalk-bridge.test.mjs`（L1195 旁）、`test/channels/feishu/bridge.test.mjs`（L410 旁）。
19. 引用关闭新用例：`test/humanize-bridge.test.mjs`（recordedBot 记录 target 断言无引用字段）、`test/channels/telegram/telegram.test.mjs`（L371 旁：replyQuote=false → 无 reply_parameters）、`test/channels/whatsapp/whatsapp.test.mjs`（L856 旁）、`test/channels/discord/discord.test.mjs`（L249 旁）、`test/channels/feishu/feishu-channel.test.mjs`。
20. 运行门禁：`npm run check`（build + 全量 test + verify-package）。

### ⑥ 文档
21. `docs/features/260910-humanize-status-reaction-reply-quote/`：plan + summary + validation（表格格式），必要时 review。
22. `README.md` L44-96 与 `README.en.md` L43+ 的 fork 改动节补两开关条目。
23. `CHANGELOG.md` Unreleased/Added 追加中英双语条目（含"客户端与宿主需同版本升级"的兼容说明）。
