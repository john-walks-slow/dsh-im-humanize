# 检视报告：拟人化逐 bot 全量覆盖 + 两面板共享字段模块

- 检视对象：工作区未提交改动（基线 `5f53d1e`），重点为任务 B 的三个客户端文件，顺带覆盖任务 A 遗留改动
- 检视人：Reviewer 子代理（只检视、未运行任何测试/构建/git 写操作；测试状态采信变更说明中的陈述）
- 日期：2026-09-10

## 概要

任务 B 的共享化重构是彻底且方向正确的：字段布局、提示文案、预设、上限常量、校验器全部收敛到 `humanize-fields.js` 单一来源，两面板在 bundle 中确认引用同一份实现，用户投诉的「详略度和格式不一样」已被结构性消除。未发现阻塞级正确性缺陷；草稿/校验/保存状态机无丢编辑路径，bundle 无 Node API 泄入，verify-package 计数口径两侧自洽。存在 4 项建议修改（隐藏的校验错误、错误不随编辑清除、新 UI 的 i18n 缺口/误译、测试缺口）与若干备忘项。

## 需求对齐

**任务 B（格式统一）——达成。**

- 共享彻底性核实：`HUMANIZE_SETTING_META`（label/hint/options）、`SHIPPED_HUMANIZE_DEFAULTS`、`SEND_DELAY_PRESETS`、`draftFromConfig`/`burstDraftFrom`、`FieldError` + 4 个 parser + `validateSendDelayDraft`/`validateBurstDraft`、`FieldErrorText`/`NumberField`/`SendDelayPresetSelect`/`TypingBurstFields`/`SendDelayFields` 全部只在 `plugin-src/client/channels/shared/humanize-fields.js` 存在一处；`humanize-settings.js` 与 `bot-send-delay.js` 均从该模块 import 渲染。lib/client.js 中 `SHIPPED_HUMANIZE_DEFAULTS`/`SEND_DELAY_PRESETS` 各只出现一次，两处 `applyPreset`（全局 16024 行附近、per-bot 4794 行附近）与共享 `SendDelayPresetSelect`（4377 行附近）引用同一份常量——两界面不会再漂移的论断在产物层面成立。
- 两面板残留的差异均为**有意的包装语义差**（全局=直接编辑；per-bot=跟随全局门 + 覆盖徽标 + 渠道能力注释；全局的断续节奏仍在 `<details>` 折叠区内）——字段本体一致，符合设计意图。
- 声明的行为变化均已落地且与 per-bot 对齐：全局面板发送延迟/断续节奏改为字符串草稿 + 保存时统一校验（`FieldError` 就地显示）；成功后 `adoptSettings(updated)` 重置草稿。顺带修复了两处旧文案缺陷（残留「整体替换」语义、断续节奏跟随全局提示硬编码出厂值），与 summary 陈述一致。
- 文档：CHANGELOG/README/README.en 更新到位。注意 CHANGELOG 中「逐 bot 编辑器从 810 行降到 419 行」的 810 是**未提交的任务 A 中间态**行数，相对基线 commit 实为 522→419（见 N4）；「全局面板 590→273」准确。

**任务 A（逐 bot 全量覆盖）——达成，与计划有一处已知的实现偏离。**

- 后端投影：`withHumanizeDefaults` 现投影完整 `normalizeHumanizeSettings(settings)`（bot-workspace-store.mjs:1174-1185），容错路径（source 异常/非对象→原样返回）保留；7 个渠道 api.js + token-api.js 整对象直通 `humanizeDefaults`；7 个挂载点换 `BotHumanizeEditor` + `humanizeDefaults` prop。覆盖 telegram/discord/slack（经 token-api/token-channel 共享路径）与 office 之外的全部渠道，与计划「不做 office」一致。
- 保存链路：`updateHumanize` 仍以 `sendDelayBase: humanizeSendDelayBase()` 调 `validateHumanizeOverrideSection`（bot-workspace-store.mjs:1762-1765），`requireCompleteSendDelay` + `inheritSendDelayBase` 约束未动；共享表单总是携带全部子字段，天然满足完整性。
- **计划偏离**：plan.md §3 的 UI 草图与改动清单写的是「8 个设置各带『自定义』checkbox + 值控件」，实现改为 6 个标量项用三态 select（''=跟随全局）、仅 typingBurst/sendDelay 用 checkbox 门控。这是合理的简化（select 本身即三态，减少一行一控件的冗余），summary 已按实现描述，但 plan 文档未回写（见 N5）。
- 兼容别名 `BotSendDelayEditor` 保留且 `sendDelayDefaults→humanizeDefaults` 投影正确（`??` 仅跳过 null/undefined，双 prop 时 humanizeDefaults 优先）；仓库内已无调用方，纯外部兼容。

## 重点专项核查（按变更说明要求的八个关注点）

1. **两界面是否真的不会再漂移** —— 是。除上述单一来源证据外，上限常量、错误文案、预设 config 均无第二副本；两面板仅剩的本地文案是包装语义（跟随全局门、徽标、能力注释、全局的渠道封顶提示）。注意 `SHIPPED_HUMANIZE_DEFAULTS` 与 `HUMANIZE_SETTING_META.options` 仍是 `src/channels/shared/humanize-settings.mjs` / `humanize-override.mjs` 中真值的**手工镜像**（浏览器安全约束所致），当前逐键比对一致，但无测试锁定（见 S4）。
2. **草稿/校验/保存状态机竞态与丢编辑** —— 未发现丢编辑路径。per-bot：dirty 门控的 re-sync useEffect（bot-send-delay.js:182-185）在 15s 轮询重建快照时保留草稿（test 7 覆盖）；保存序列核实为 `onSave`（botAction）在 resolve 前已 `setModel` 刷新快照 → 编辑器 `setDirty(false)` 触发 effect 依赖变化 → 用**已保存**的新快照重 derive，时序正确；保存失败（服务端拒绝）时 dirty 保持 true、草稿保留。全局：`rpcCall` 来自插件 `apply()` 闭包（plugin-src/client/index.js:424），identity 稳定，加载 effect 只跑一次；无轮询、无 dirty 门需求；草稿仅在加载/保存成功时重置。组件卸载（切走页签）丢草稿为既有约定，与重构前一致。
3. **draftFromConfig 回落逻辑** —— 安全。整对象缺失 `activityBoost`/`maxTotalMs` 时回落 `DEFAULT_SEND_DELAY_CONFIG`（readCap 30s / gapCap 10s），与服务端 `normalizeRange` 的 `defaultTotalMs`（30_000/10_000）一致；正常链路（humanize.get、normalizeHumanizeOverride、withHumanizeDefaults）产出的 config 均经 normalize 必然完整，回落仅防御手改磁盘。部分字段缺失的 activityBoost 会预填 0，但该输入经 store 不可达（见 N7）。
4. **三态 select 取值/回填边界** —— 正确。`deriveDraft`：key 存在→'true'/'false'/枚举值，缺失→''；快照经 `normalizeHumanizeOverride` 保证布尔/枚举合法性；`buildPayload` 逆映射正确；「清除覆盖」标签条件（`!draftHasCustom && hasOverride`）与禁用条件（`!dirty && !hasOverride`）组合出的四个象限均行为合理（含 test 3 的全清→null 用例）。无覆盖但草稿改回全跟随时按钮可用并发 null（无害 no-op，见 N6）。
5. **React 无 hooks 纯组件受控性** —— 成立。共享 5 组件全部纯 props（`{draft, busy, errors, onField}`），无内部状态；所有 input/select 绑定 value+onChange；`errorOf` 返回 null 以支持 `||` 组合的写法成立（React 渲染 null 无输出）。`onField` 契约（数字=字符串、checkbox=布尔）两调用方均正确透传进 draft。boolean map 的 `key`、options map 的 `key` 均已提供。
6. **bundle 安全** —— 通过。`humanize-fields.js` 仅 import `send-delay.mjs`（零 import）与 `typing-session.mjs`（零 import）；lib/client.js 中无 `node:fs`/`node:path`，全部 `require(` 命中均为 esbuild 外置的 react/react-dom；`humanize-settings.mjs`（node:fs）只被 host 侧文件 import（grep 证实 plugin-src/client 无引用）。
7. **verify-package 计数与 map 字面量** —— 自洽。源侧：5 个审计文件字面量实测 1/2/2/2/1（checkbox）合计 8，与清单一致；`clientSources` 经 `readSourceTree` 递归包含新建的 humanize-fields.js，杂散字面量检查覆盖它。bundle 侧：lib/client.js `type:'checkbox'` 字面量实测 8，与期望和相等。**map 单字面量渲染 4 次不放大 bundle 计数**：esbuild 只落一份回调代码，React 运行时渲染多份 DOM，而审计两侧（源码 regex 与 bundle 字符串 regex）数的都是**代码字面量**而非 DOM 节点，口径一致成立。该审计不能发现「循环渲染克隆出的 checkbox 面」，但这一盲区重构前后等同，审计目标（防杂散 checkable）未削弱。
8. **测试覆盖缺口** —— 存在，见 S4 清单。

## 阻塞问题

无。

## 建议修改

| ID | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| S1 | plugin-src/client/humanize-settings.js:244-251（`<details>` 折叠区）+ :120-134（save 校验分支） | 断续节奏字段在默认折叠的 `<details>` 内。当 `validateBurstDraft` 抛错时只设置 `fieldErrors`，不设 `saveError`：用户点「保存」后**无任何可见反馈**（错误文本藏在折叠区里），像是保存失灵。触发路径：展开高级参数→填非法值→收起→保存；或磁盘/RPC 写入 >30s 的 burst 值后任何一次保存（叠加 N1 场景）。 | 校验失败时联动展开折叠区（如 `open: ['burstOnMin','burstOnMax','burstOffMin','burstOffMax'].some(k => fieldErrors?.[k]) || undefined`），或对隐藏在折叠区内的字段错误额外设置一条 saveError 横幅提示「高级参数有误」。 |
| S2 | plugin-src/client/humanize-settings.js:97-118（updateField/updateSdField/updateBurstField/applyPreset） | 校验失败后，用户修改字段**不会清除**就地错误（三个 update 与 applyPreset 只重置 `saveSucceeded`）；错误文案滞留到下一次点保存。per-bot 编辑器每次 `beginChange()` 都清 `fieldErrors`（bot-send-delay.js:187-191）。这正是本次重构要消除的「两界面行为不一致」类别，只是发生在错误清除时序而非布局上。 | 三个 update helper 与 applyPreset 中一并 `setFieldErrors(null)`（或仅清除对应 field 的条目），与 per-bot 的 beginChange 语义对齐。 |
| S3 | plugin-src/client/channels/shared/bot-send-delay.js:284-287（'开启'/'关闭' 选项）、:331/:359（aria-label）、:334（'断续节奏'）、:151-153（'开'/'关'）；plugin-src/client/channels/shared/humanize-fields.js:42 | 新增 UI 字符串的 i18n 缺口与误译：字典无 '开启'、'开'、'关'、'断续节奏'、'自定义断续节奏'、'自定义发送延迟'，EN 用户看到中英混排；且既有词条 `'关闭': 'Close'`（i18n.js:396，本意为对话框关闭按钮）会把三态下拉里的布尔「关闭」选项误译为 "Close"（typingIndicator 的 off 选项同病，属继承自旧代码的问题，本次新 UI 放大了暴露面）。 | 为新选项文案补词条；'关闭' 与对话框按钮共用一个 exact-match 键导致语义冲突，建议改用不冲突的选项文案（如布尔三态直接用 '开'/'关' 并补 `'开': 'On'`、`'关': 'Off'` 词条，'关闭' 留给对话框），同步补 aria-label 与 '断续节奏' 词条。 |
| S4 | test/client-humanize-ui.test.mjs（现有 8 用例之外） | 覆盖缺口：(a) 全局面板校验失败路径（FieldError 就地显示 + 不发 humanize.set）——验证文档把它列为手测项 2 但无自动化；(b) per-bot typingBurst 自定义保存（`validateBurstDraft` 经 buildPayload 的整条路径，含毫秒 round-trip）；(c) 探索预设应用（任一面板）；(d) `BotSendDelayEditor` 废弃别名的 sendDelayDefaults 投影；(e) 全局面板 payload.typingBurst round-trip（test 1 只断言了 typingIndicator）；(f) **镜像锁定测试**：断言 `SHIPPED_HUMANIZE_DEFAULTS` deep-equal `DEFAULT_HUMANIZE_SETTINGS`、`HUMANIZE_SETTING_META` 的 options 集合等于 humanize-override.mjs 的合法值表——这是防止浏览器镜像静默漂移的最廉价护栏，与本次「单一来源」目标直接呼应。 | 按上述清单补测，优先 (a)(b)(f)。 |

## 非阻塞问题

| ID | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| N1 | plugin-src/client/channels/shared/humanize-fields.js:31（TYPING_BURST_MAX_MS=30000）vs src/channels/shared/typing-session.mjs:28（BURST_MS_ABSOLUTE_MAX=60_000） | UI 校验上限（30s）严于服务端（60s）。旧全局面板无保存时校验，>30s 的值可正常保存；现在磁盘/RPC 写入 (30s,60s] 的 burst 值会阻塞该面板**任何**保存（含无关字段改动），且错误还可能被 S1 的折叠区隐藏。 | 二选一：将 UI 上限对齐 60s（改一个常量）；或维持 30s 但在 `burstDraftFrom` 预填时钳制到上限内并在 hint 标注 UI 上限。与 S1 一并处理体验最佳。 |
| N2 | humanize-settings.js:112-118 / bot-send-delay.js:210-218（applyPreset 与 presetKey） | `presetKey` 保存/重置草稿后不清空；且受控 select 重选同一 option 不触发 onChange——用户套用预设、手改字段后想**重新**套用同一预设时点击无效，须先切到别的项。为两面板共有的既有模式，重构时原样搬入共享模块。 | 保存成功（adoptSettings）后 `setPresetKey('')`；或预设 select 改为非受控 + onChange 后复位。 |
| N3 | bot-send-delay.js:301-302（enumLabel 拼接） | `跟随全局 (打断重发 (interrupt))` 双层括号，观感差。 | 拼接前剥掉 option label 的括注，或跟随全局行只显示裸值 `interrupt`。 |
| N4 | CHANGELOG.md / summary.md | 「逐 bot 编辑器从 810 行降到 419 行」：810 是未提交的任务 A 中间态；相对基线 commit 实为 522→419。文档口径与 git 基线不符。 | 提交前把行数口径改为 522→419（或注明口径为任务 A 完成态）。 |
| N5 | docs/features/260909-humanize-per-bot-all/260909-humanize-per-bot-all.plan.md §3/改动清单 | plan 的 UI 草图仍画「8 个设置各带自定义 checkbox」，实现是 6 标量三态 select + 2 checkbox 门；plan 未回写，后续读者会按旧设计理解。 | 在 plan §3 补一段「实施调整」说明三态 select 取代 per-key checkbox 的原因。 |
| N6 | bot-send-delay.js:395-397（按钮禁用/标签条件） | 无现存覆盖且用户把所有项改回跟随全局（dirty=true、draftHasCustom=false、hasOverride=false）时按钮可用、标签「保存」，点击发 null 的 no-op 保存并显示「已保存」。无害但语义含糊。 | 禁用条件改为 `busy \|\| (!draftHasCustom && !hasOverride)`，或该象限下也标注「清除覆盖」。 |
| N7 | humanize-fields.js:165-178（draftFromConfig） | activityBoost 仅整对象缺失时回落出厂默认；若对象存在但缺个别子字段（当前经 store 不可达——所有链路都过 normalize），会预填 "0"。`burstDraftFrom` 是逐字段回落的更防御写法，两处风格不一致。 | 备忘即可；如要统一，把 activityBoost 改为逐字段 `?? DEFAULT` 回落。 |
| N8 | bot-send-delay.js:60-62（ALL_KEYS）/ buildPayload | 编辑器保存只回写已知的 8 键：未来后端新增第 9 个覆盖键后，从本编辑器保存会静默丢弃磁盘上该键。旧编辑器的 `rest` 保留清单同样是硬编码，非回归，但新数据流（整段过 deriveDraft）使该限制从「保留清单」变为「全量白名单」。 | 备忘：后续加键时需同步 ALL_KEYS/HUMANIZE_SETTING_META/SHIPPED 镜像与 verify 清单（本次改动已把四处同步的代价集中化，S4(f) 的镜像测试可再兜一层）。 |

## 准入结论

**结论**：`条件准入`

**说明**：无阻塞问题——共享化彻底、状态机无丢编辑、bundle 安全、审计口径自洽，核心诉求（两界面同构不漂移）已结构性达成。S1/S2 是重构目标本身（两面板行为一致）的收尾缺口，S3 是新 UI 的 EN 可见缺陷，三者均为小改动，建议随本次提交一并处理；S4 可紧随其后补齐。处理后无需重新走全量检视，S1-S3 修复示意即可。
