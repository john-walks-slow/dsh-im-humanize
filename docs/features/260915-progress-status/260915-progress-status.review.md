# 检视报告

## 概要

检视范围：`dsh-im-humanize` fork（上游 xmanrui/dsh-im v4.13.0）相对 HEAD `710a1df` 的 working tree 改动 + 两个未跟踪文件（`docs/features/260915-progress-status/`、`test/channels/shared/progress-status.test.mjs`），即新增拟人化开关 `progressStatus`（boolean，默认 `true`）以禁用 IM 渠道过程进度气泡的完整实现。整体评价：设计目标达成、设置链路贯通且与既有 `statusReaction`/`streaming`/`messageBreak` 语义边界清晰；共享桥接的懒建流实现正确且向下游一致传递 `lazy`；自有桥接的进度抑制点选取合理。存在一处需真机验证的企微空内容流式行为、一处 Telegram 首段渲染退化、以及若干取消/并发边界与测试覆盖建议，均不构成准入阻塞。

## 需求对齐

- 设置键 `progressStatus`（默认 `true`）在 9 处贯通：`humanize-settings.mjs`（DEFAULT/normalize/validate/头注释）、`humanize-override.mjs`（normalize/validate/键白名单）、`humanize-resolver.mjs`、`plugin-src/host/index.mjs`（HUMANIZE_CONFIG_KEYS）、`plugin-src/host/humanize-rpc.mjs`（SETTABLE_KEYS）、`plugin-src/client/channels/shared/humanize-fields.js`（META + SHIPPED_DEFAULTS）、`plugin-src/client/humanize-settings.js`（BOOLEAN_SETTING_KEYS）、`plugin-src/client/channels/shared/bot-send-delay.js`（BOOLEAN_KEYS）、`plugin-src/client/i18n.js`（EN 翻译）。键名、默认值、校验、白名单四处一致，与计划 §3.1 完全吻合。
- 共享桥接（Telegram/WhatsApp/Discord/Slack）行为符合计划 §3.2/§3.3：`progressStatus=false` 时 `onUpdate` 丢弃 `tool`/`status`（保留 `text`/`assistant-message`）；`messageBreak` 同为 true 时 `skipPlaceholderStream` 跳过整条占位流（消除占位气泡 + 分段内容重复）；纯流式时以 `{ lazy: true }` 开流。懒建流在 `editable-message-stream`、`telegram-runtime.openDeliveryStream`、`slack-runtime.createSlackMessageStream` 三处实现，WhatsApp/Discord 通过 `openStream(target, { lazy })` 透传。
- 自有桥接（飞书/钉钉/企微）行为符合计划 §3.4：抑制 `tool`/`status` 的 `controller.setContent`/`cardStream.push`/`streamThinkingText` 更新；钉钉卡片初始文案取 `…`，企微初态取 `''`。
- QQ/微信/AI Office 未改动，与计划 §4 取舍一致。
- `lib/client.js`、`lib/index.js` 已由 `npm run build` 重新生成（构建产物含 `progressStatus` 与 `lazy` 标记，时间戳 09-15 02:23）。
- 与计划无实质性偏离。唯一一处与计划字面略有出入但可接受：计划 §3.3 称 Slack "首条 update 建流并设 `appended` 为首段全文"——实现中 `appended` 仍以空串起步、由 `appendLatest` 在首条追加后置为首段全文，语义等价。

## 阻塞问题

无。

## 建议修改

| ID  | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| S1  | `src/channels/wecom/wecom-bridge.mjs:1495-1503`（`progressStatus=false` 时以 `streamContent('')` 即空串开启 `replyStream`） | 企微未采用懒建流（与 Telegram/Slack/WhatsApp/Discord 不一致），而是在 `streamThinkingText=''` 下仍然 eager 调用 `this.#client.replyStream(frame, streamId, '', false)`。`this.#client` 为外部企微 SDK，本仓不可见。若该 SDK 拒绝空内容，则 `streamStarted` 保持 false、`onUpdate` 提前 return、最终答案退化为 `#sendActive` 一次性发送（`streaming=true` 被静默忽略）；若 SDK 接受空内容，企微可能仍渲染一个空白/加载态流式气泡，使"关闭后不发送占位气泡"的语义在企微上未完全达成。 | 需真机验证 `replyStream` 对空内容的实际行为。若空内容被拒或产生可见空白气泡，建议对企微同样采用懒开流：将 `replyStream` 的首次调用推迟到首个非空 `preview`（`streamContent(streamThinkingText, streamAnswerText)` 非空）到达时再发起，与共享桥接的 lazy 模式对齐；或在 `progressStatus=false` 时直接跳过初始 `replyStream`、仅在首个非空 `preview` 时开流。 |
| S2  | `src/channels/telegram/telegram-runtime.mjs:725-730`（懒建流首条 `update` 经 `ensureMessage(block.text)` → `this.#api.sendMessage({ text })`） | `sendMessage` 为纯文本发送（无 `richMessage`/`parse_mode`），而首条 `block` 来自桥接 `createTextDeliveryBlock(progress, 'markdown')`（text 更新 format 为 `markdown`）。因此懒模式下首条消息以纯文本发出，Telegram 会将 markdown 语法（如 `**bold**`、`[link](url)`）按字面渲染，直到下一条 `editMessageText`（`richMessage`）约 800ms 后改写为富文本。eager 模式下占位为 `'正在处理…'`（纯文本），首条真实文本直接以富文本 `edit` 上屏，用户从不见裸 markdown——lazy 引入了一段"裸 markdown"过渡窗口。 | 在 `ensureMessage` 中按 `block.format` 分流：`format === 'plain'` 走现有 `sendMessage`；否则用 `sendRichMessage({ richMessage: { markdown: toTelegramRichMarkdown(block.text) } })` 创建，取回 `message_id` 后续 `editMessageText` 改写。需确认 `editMessageText` 可编辑 `sendRichMessage` 所建消息（eager 模式已用 `editMessageText(richMessage)` 编辑 plain 占位，应同构）。 |
| S3  | `src/channels/shared/editable-message-stream.mjs:119-124`（`cancel()` 不 `await inFlight`）与 `src/channels/slack/slack-runtime.mjs:338-346` | 懒建流引入了"取消时创建仍在途"的新窗口：`schedule` 的 timer 触发后 `inFlight = ensureCreated(next)` / `ensureStarted()` 进行中，若此时 `cancel()` 被调用（`cancel` 只置 `closed`、清 timer，不 `await inFlight`），创建仍会完成，留下一条带首段文本的孤儿消息（editable-stream）或一条空白流式消息且永不被 `stopStream`（Slack）。可达路径：桥接 `this.#signal?.aborted`（渠道关闭）于 ask 期间命中、或 WhatsApp 运行时 `stop()` 经 `#streams` 取消。`/stop` 与错误路径安全（`finish` 先 `await inFlight`），supersede 安全（pre-ask 阶段尚无 update）。该窗口窄（单次 create/sendMessage 延迟），但属 lazy 新增类别。 | 在 `cancel()` 中先置 `closed`，再 `await inFlight?.catch(() => undefined)` 后做后续清理；或于 `ensureCreated`/`ensureStarted` 在 `await` 返回后复查 `closed`，若已关闭则对已建消息执行 `edit` 收尾（editable-stream）或 `stopStream`（Slack）。至少在文档/注释中标注此窗口。 |
| S4  | `test/channels/shared/progress-status.test.mjs`（整体） | 9 用例覆盖了 lazy editable-stream、Telegram lazy（rich-draft + regular）、桥接 onUpdate 过滤、messageBreak 跳过占位流、default-true 仍流式 tool 进度，但未覆盖：(a) Slack lazy 路径（`ensureStarted` 延迟、`finish` 未建流走 `postMessage`、`cancel` 未建流不 `stopStream`、`messageId` getter 返回 `undefined`）；(b) WhatsApp/Discord `openStream(target, { lazy })` 透传（仅测了抽象 editable-stream，未测渠道包装）；(c) 飞书/钉钉/企微 `progressStatus=false` 的 onUpdate 过滤；(d) `assistant-message` 在 `progressStatus=false` 下的保留语义。Slack lazy 是本次自定义逻辑最多、最易回归的路径，缺测风险最高。 | 至少为 Slack lazy 补 3 个用例：open 时不 `startStream`、首条 update 后 `ts` 与 `providerMessageIds` 就位、`finish` 未建流时 `postMessage` 并收集 ts；补 1 个 `assistant-message` 保留断言；自有桥接的 onUpdate 过滤各补 1 个最小用例。 |
| S5  | `src/channels/telegram/telegram-runtime.mjs:759`（`openStream`） | Telegram 的 `openStream(target)` 未像 WhatsApp/Discord 那样接收 `{ lazy }` 选项。实际不可达（Telegram 暴露 `openDeliveryStream`，桥接优先走它，`openStream` 为死代码），但破坏了"`openStream`/`openDeliveryStream` 统一接受 `lazy`"的接口一致性，未来若移除 `openDeliveryStream` 或被测试直接调用会静默退化为 eager。 | 让 `openStream(target, { lazy = false } = {})` 接收并透传 `lazy` 至 `createEditableMessageStream`，与其余渠道签名一致；或若确认永远不可达则删除该方法以免误导。 |

## 非阻塞问题

| ID  | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| N1  | `src/channels/shared/text-harness-bridge.mjs:859-860` 与各自有桥接读取点（feishu `bridge.mjs:4408`、wecom `wecom-bridge.mjs:1436`、dingtalk `dingtalk-bridge.mjs:1375`） | `progressStatus` 在共享桥接于回合开始前一次性解析（`suppressProgress`/`skipPlaceholderStream` 闭包捕获），在自有桥接于各自位置读取。语义一致（"下一条消息起"生效），但读取时点不统一：共享桥接在 pre-ask 之前，飞书在 `markdown` 回调内、企微/钉钉在 read delay 之前。当前均早于首条 update，无行为差异，但若日后某渠道在 update 期间重读设置会造成不一致。 | 保持现状即可；如日后引入 per-update 重读，需统一为"回合级快照"。 |
| N2  | `src/channels/shared/editable-message-stream.mjs:62-64`（`next === lastSent ? undefined : (created ? edit : ensureCreated)`） | 懒模式下 `lastSent` 初始为 `''`。首条 update 经 `splitMessageText` 后 `next` 为首段；若首段恰好为空（被 trim/limit 切空，极端输入）会 `?? (lazy ? '' : initialText)` 回到 `''`，与 `lastSent` 相等而跳过创建——后续 update 正常创建。属合理降级，仅记录。 | 无需改动；极端空输入下行为可接受。 |
| N3  | `plugin-src/client/channels/shared/humanize-fields.js`（`progressStatus` hint："支持所有聊天渠道（AI Office 任务进度不受影响）"） | QQ/微信本就无过程气泡（未改动），hint 的"支持所有聊天渠道"对这两个渠道是"无操作"语义，表述略宽。 | 可改为"支持所有具备过程气泡的聊天渠道"或保持现状（用户层面无害）。 |
| N4  | `src/channels/slack/slack-runtime.mjs:257-265`（`appendLatest` 顶部 `if (ts === null) return;`） | 懒模式下 `schedule` 总先 `await ensureStarted()` 再 `appendLatest`，故该守卫在正常路径不可达；仅在异常路径（`ensureStarted` 抛错被 catch 置 `broken=true` 后 `schedule` 早退）下冗余生效。防御性无害。 | 无需改动；可加注释说明为防御性守卫。 |
| N5  | `src/channels/feishu/bridge.mjs:4424-4425` 过滤保留 `assistant-message` | 飞书流式卡模式下保留 `assistant-message` 帧会经 `#progressText` 以 `_{text}_` 斜体渲染 canonical 步骤文本（pre-existing 行为）。与共享桥接一致（保留），但飞书流式卡路径无 `messageBreakHandler`，`message_break` 帧在 `progressStatus=false` 下被过滤丢弃（previously 以 `_{text}_` 显示分段）——文本仍由后续 `text` update 承载，无内容损失。 | 无需改动；记录此既有行为未变。 |

## 准入结论

**结论**：`条件准入`

**说明**：无阻塞问题，设置链路、共享桥接懒建流、自有桥接进度抑制均正确且与计划吻合，构建产物已同步。存在 5 项建议修改，其中 S1（企微空内容流式行为，需真机验证）与 S2（Telegram 首段裸 markdown 渲染）建议在合并前或首个真机验证迭代中处理，S3/S4/S5 可作为后续迭代跟进。建议合并后优先安排企微真机验证以确认 S1 的实际表现。

---

# 复核（针对 S1–S5 + N3 修复）

日期：2026-09-15。复核范围：仅 S1–S5 + N3 的修复改动 + 构建产物同步，未重新检视未改动部分。

## 修复核实

| ID | 核实结论 | 证据 |
| --- | --- | --- |
| S1 企微懒开流 | **通过（主路径）** | `wecom-bridge.mjs:1494-1503` 定义 `lazyStream = streaming && progressStatus===false && typeof replyStreamNonBlocking==='function'`；`!lazyStream` 时才 eager `openStream(streamContent(thinking))`；onUpdate 接线条件改为 `(streaming && nonBlocking) || messageBreakHandler`（不再依赖 `streamStarted`）；体内先算 `preview`，`!streamStarted && lazyStream` 时由首个非空 `preview` 经 `openStream(preview)` 开流并 `return`（开流即携带内容，不重复 `replyStreamNonBlocking`）。lib/index.js 已含对应混淆码（`R=...progressStatus===!1&&typeof...replyStreamNonBlocking...`、`if(!m){if(!R)return;await P(he);return}`）。finish 路径 `streamStarted && streamChunks.length>0` 未变，懒未开流时自然走 `#sendActive`，与 streaming-off 一致。 |
| S2 Telegram 富文本创建 | **通过（含真机验证项）** | `telegram-runtime.mjs:707-722` `ensureMessage(text, format='plain')` 按 `format==='markdown'` 分流至 `api.sendRichMessage({richMessage:{markdown:toTelegramRichMarkdown(text)}})`，plain 保持 `sendMessage`；懒首条 `update` 传 `block.format`（`telegram-runtime.mjs:728`）；eager 占位 `ensureMessage(t('正在处理…'))` 默认 plain。lib/index.js 已含 `sendRichMessage` 调用与 `richMessage:{markdown:r.markdown}` 分支。消除首段裸 markdown 窗口。 |
| S3 取消竞态 | **通过（Slack 实修 / editable 标注持平）** | Slack `cancel()`（`slack-runtime.mjs:342-348`）改为 `Promise.resolve(inFlight).catch().then(() => { if (ts!==null) stopStream(...) })`——懒 startStream 在途时落定后补 stopStream，关闭孤儿空流窗口；lib 已含 `Promise.resolve(g).catch(()=>{}).then(()=>{i!==null&&...stopStream...})`。editable `cancel()`（`editable-message-stream.mjs:121-128`）加 `inFlight?.catch(()=>undefined)` 抑制未处理拒绝并注释标注"孤儿窗口与 eager 占位持平、无删除 API"——理由成立（eager 取消时在途 edit 同样留部分文本，无 removal API），可接受。 |
| S4 测试 | **通过** | `progress-status.test.mjs` 由 9 增至 15 用例：Slack lazy ×3（open 不 startStream + 首条 update 建 stream 并 append / finish 未建流走 postMessage / cancel 无 stopStream）、WhatsApp lazy 透传、Discord lazy 透传、`assistant-message` 在 `progressStatus=false` 下保留。覆盖了 S1–S3 最易回归路径。 |
| S5 openStream 签名 | **通过** | `telegram-runtime.mjs:759` `openStream(target, { lazy = false } = {})` 透传 `lazy` 至 `createEditableMessageStream`，与 WhatsApp/Discord/Slack 签名一致。 |
| N3 hint 措辞 | **通过** | `humanize-fields.js` hint 改为"适用于所有具备过程气泡的聊天渠道（QQ/微信本就无中间进度；AI Office 任务进度不受影响）"，i18n EN 同步；README/README.en/CHANGELOG 增 `progressStatus` 行与说明；README 顺带纠正 streaming 与 message_break "互斥"的过时表述为"可与 message_break 同时开启"（与代码实际一致）。 |

## 残留观察（非阻塞）

| ID | 位置 | 观察 | 建议 |
| --- | --- | --- | --- |
| R1 | `wecom-bridge.mjs:1494` `lazyStream` 仅在 `replyStreamNonBlocking` 可用时启用 | 当 `streaming=true && progressStatus=false && replyStreamNonBlocking` 不可用时，`lazyStream=false` → 仍 eager `openStream(streamContent(''))`（空内容开流）。此为 S1 原问题的残余子分支：比修复前好（无 '正在思考中…' 文案），但仍可能产生空白/加载态气泡，且 `streaming=true` 不会自动退化为一次性发送。实际可达性取决于企微客户端是否总随 `replyStream` 提供 `replyStreamNonBlocking`。 | 真机验证时确认该子分支；若存在无 `replyStreamNonBlocking` 的企微客户端变体，可将 `lazyStream` 条件放宽为 `streaming && progressStatus===false`，并在 finish 路径对"懒未开流"统一走 `#sendActive`（当前 finish 已能处理 `streamStarted=false`）。 |
| R2 | `telegram-runtime.mjs:707-722` `sendRichMessage` 创建后由 `editMessageText(richMessage)` 编辑 | S2 引入了"sendRichMessage 创建 → editMessageText 编辑"的新组合。既有代码只有"sendMessage 创建 → editMessageText 编辑"与"sendRichMessage 一次性终发（不再编辑）"两种先例，无 sendRichMessage-后-编辑先例。若该自定义 Telegram 网关不支持编辑 sendRichMessage 所建消息，则首条之后的 edit 会 warn 失败、消息停在首段，finish 走 `#editRich` 失败再退化为 `#sendPlain`（仍能送达）。降级安全，但 markdown 懒流式体验受损。该路径未在测试覆盖（现有 Telegram lazy 测试用 `finish` 无 update 或私聊 draft 路径）。 | 建议在真机/真实网关验证 editMessageText 能否编辑 sendRichMessage 所建消息；若不能，可回退为首条仍用 sendMessage、仅接受首段短暂裸 markdown，或在 edit 失败时回退为 sendMessage 重发+edit。 |

## 复核结论

**结论**：`通过`

**说明**：S1–S5 + N3 全部落实到位，源码与 lib 构建产物（02:48 重生成、含全部修复标记）一致，测试由 9 增至 15 且据报全绿。Slack 取消竞态获实质修复；editable 取消按"无删除 API + 与 eager 持平"理由标注，可接受。残留 R1（企微无 nonBlocking 子分支）与 R2（Telegram sendRichMessage-后-编辑未见真机/测试先例）均为非阻塞观察项，降级路径安全，建议在首个真机验证迭代中确认即可。修复质量达标，可进入下一阶段。
