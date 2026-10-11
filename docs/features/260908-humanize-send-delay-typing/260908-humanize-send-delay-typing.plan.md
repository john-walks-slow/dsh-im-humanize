# 拟人化发送延迟（按机器人配置）与非流式 Typing 指示器 专项方案

日期：2026-09-08（r5，auto_human 已批准实施）。演进：r2 两阶段模型（用户语义澄清）；r3 参数空间扩充（用户补充）；r4 采纳 cross-check（残余感知灭相、supersede 静默分支、WA 统一会话）；r5 并入 auto_human 裁定（supersede 无条件生效不受 enabled 门控、burst 灭相从最后一次 sendTyping 起算、WA burst 协议不稳回退、流式早停判据具体化）。实施基线：dsh-im-humanize fork（上游 xmanrui/dsh-im v4.13.0，`2a29d25`）。

配套调研：[260908-typing-and-delay.research.md](./260908-typing-and-delay.research.md)（九平台 typing/presence API 语义与人类即时通讯行为实证数据）。

## 0. 两阶段拟人模型（本方案的概念基石，用户澄清）

一条助手回复的拟人化由**两个连续阶段**构成，各自由独立机制模拟：

| 阶段 | 模拟什么 | 表现 | 机制 |
|---|---|---|---|
| **① 阅读延迟**（read delay） | 真人"过了一段时间才读到消息" | **完全静默**：无 typing 指示器、无已读回执 | 随机延迟插在**回合开始（harness ask 之前）**：`（uniform(min,max) + 可选·用户消息阅读耗时 + 可选·闲置加成）`，封顶 `maxTotalMs` |
| **② 编写阶段**（compose） | 真人"已读后在打字、思考" | typing 指示器亮起（**断续节奏**），生成完成后立即发送 | typing 会话在延迟结束后启动，覆盖整个生成期；message_break 分段间用 `segmentGap` 模拟"正在打下一条"（可选按分段长度折算打字耗时） |

推论（较 r1 的模型变化）：

- 阅读延迟与**回复长度无关**（r1 的 charsPerSecond 按回复长度折算被 r2 语义否定）；但与**用户消息长度**可选相关（r3：读一条长消息确实更久——`readDelay.charsPerSecond` 按入站消息可见长度折算，默认 0 关闭）。
- **闲置加成**（r3）：会话闲置越久，"人不在手机旁"的概率越高——闲置 ≥ 阈值时延迟 ×`multiplier`（实证锚点：会话发起消息回复中位 37s vs 整体 15s ≈ 2.5×，调研 §2.3；默认闲置 ≥10min ×2）。
- 阅读延迟在**流式与非流式模式都生效**（它发生在 ask 之前，与呈现方式无关）——r1 只覆盖非流式，r2 起统一。
- message_break 分段/超长分块的段间隔属于**编写阶段内的小停顿**，独立配置 `segmentGap`（可选用打字速度按分段长度折算），指示器在段间重新亮起。
- WhatsApp 已读回执随 typing 起点出现（`sendTyping` 标记 quoted 消息已读——非引用回复无已读，README 措辞注意）——"读到消息 → 开始输入"的时序天然正确。
- interrupt 在阅读延迟窗口内应**取代**旧任务（人拿起手机读了新消息，自然不再回旧的）：跳过旧回合的 ask 与发送，与现状"打断生成中回合 = 静默丢弃"语义一致且更省算力。

## 1. 最终决定

1. 新增**按机器人（per-bot）配置的发送延迟** `sendDelay`（语义 = 阅读延迟）：Harness 处理消息**之前**先静默等待 `（uniform(readDelay.minMs, maxMs) + 可选·入站消息长度/阅读速度 + 可选·闲置加成）`，封顶 `readDelay.maxTotalMs`；延迟期间不启动 typing、不触发已读；延迟结束后进入编写阶段（typing + 生成 + 立即发送）。流式/非流式模式均生效。message_break 分段与微信/QQ 超长分块的段间停顿用独立的 `segmentGap`（可选按分段长度/打字速度折算，指示器段间重亮）。命令回复、错误提示、审批/提问、产物文件、超时补发、主动投递不延迟。**参数空间刻意丰富**（用户明确希望探索不同配置）：阅读延迟 6 参数（min/max/阅读速度/封顶/闲置加成 2 子参数）+ `enabled` 开关 + 分段间隔 4 参数 + typing 三档与 burst 4 参数（§10 计数同口径：阅读延迟 6 + enabled = 7 项）。
2. typing 指示器改为**编写阶段指示器**：阅读延迟结束后启动、覆盖整个生成期、消息发出/回合终止即止。Telegram 4s / Discord 5s 续期循环（新共享 `typing-session.mjs`）；修复 WhatsApp 20s 刷新 > ~10s presence 有效期的 bug（改 8s）；微信 5s keepalive 沿用（起点移到延迟后）；QQ 用自管会话替换 SDK 中间件（起点随延迟，见 §6.3）。会话生命周期**绑定回合**（`#process` finally 统一清理），不依赖某次发送停止——消除旁路发送误停与 `/stop` 后"永远在输入"残留。
3. typing 指示器支持**断续节奏**（burst）：`typingIndicator: 'off' | 'continuous' | 'burst'`（默认 `'burst'`，对应用户"打字、思考的断续"语义）。**cross-check 修正**：灭相若只是"停止发送"，会被平台指示器残余覆盖吃掉（Telegram 最后一次动作后再亮 5s、Discord/WA ~10s——灭相 1–2.5s 数学上完全不可见）。r4 设计为**残余感知灭相**：灭相时长 = 用户配置的"可见灭相" + 渠道 `darkResidualMs`（TG 5000 / DC 10000 / WA 0——WA 有显式 `'paused'` presence，灭相即刻可见）；即用户配置"可见灭相 1.5–4s"，模块自动补足平台残余。这正是真人在各平台的形态：TG 上停打 >5s 指示器才熄灭。burst 参数为 `typingBurst { onMinMs, onMaxMs, offMinMs, offMaxMs }`（**可见**亮/灭时长；默认亮相 3000–6000、可见灭相 1500–4000）。TG/DC/WA 支持 burst（WA 经显式 paused）；微信 v1 仅 continuous（票据型）；QQ 自管会话后 v1 先 continuous（input_second 可精确设亮相时长，burst 列 v2）；Slack/飞书/钉钉/企微无 API。
4. Slack、飞书、钉钉、企业微信没有 bot 可用的 typing API（调研证实）——**明确降级**：只做阅读延迟（短档封顶，见 §1.8），等待期可见反馈沿用现状（状态 emoji / 流式卡片 / `<think>` 块）。
5. **per-bot 配置沿用 contextEnhancement 模式**存入各渠道 `workspaces.json` 新 `humanize` 段（`humanizeFor`/`setHumanize`/`decorateStatus`/`createWorkspaceAwareController` 自动获得 `updateHumanize`/共享 RPC `bot.humanize.set`）；全局默认在现有 `humanize.json`。桥接层经 `{ botId, getSettings }` provider **每回合同步读取**，改动即时生效。
6. **修复现有全局拟人化设置的断链 bug**（前置必做）：实测证实 `streaming`/`messageBreak`/`onNewMessage` 从未到达渠道 runtime，且断链有两层——`channelConfig()` 丢弃顶层合并键；WhatsApp/Slack production 模块没有 humanization 组装代码（§3.4）。修复：`channelConfig` 显式转发全局键（渠道子对象同名键优先）+ **全部 8 个 production 文件**组装 provider。
7. 顺带接通 `dingtalk`/`wecom` 桥接里赋值但从未读取的 `#streaming` 死字段：全局关闭流式时走"一次性发送"路径（钉钉 `#send`；企微复用 `#sendImmediate` 被动优先结构），九渠道非流式语义一致。
8. **interrupt × pre-ask 窗口 = 取代语义**（cross-check 修正 + auto_human 裁定）：桥接维护每会话"当前任务 AbortController"，**覆盖整个 pre-ask 窗口**（阅读延迟 + 图片内容 staging + openStream，即 ask 尚未发出），**无条件生效、不受 `sendDelay.enabled` 门控**（auto_human 裁定：interrupt 落在内容准备/开流窗口的双回复是独立于延迟功能的现存 bug，只给开延迟的用户修不合逻辑——`enabled=false` 时窗口仅剩 staging/openStream，仍被覆盖）。interrupt 分支**无条件 abort 队首控制器** + 照旧 `fireAndForgetStop`（无活动回合时 `stopActiveTurn` 已验证优雅 no-op、不发 RPC）；被 abort 任务抛 `code='superseded'` 的 AbortError → **六个桥接的 catch 新增静默分支**（清 reaction、不发送、不写错误日志）——通用分支会发"处理失败"提示，与静默语义矛盾。"延迟中→已 ask"相位标记在 sleep resolve 的同一微任务链内同步切换。**微信/QQ 的 prompt markSeen 前移到延迟之前**（防供应商重投二次处理）。queue/steer 不变；`/stop` **同样 abort pre-ask 控制器**（"在它开始前停掉这个回合"，/help 输出同步说明）。
9. **渠道延迟档位**（调研：typing 显著缓解长延迟负效应，Kim 2025）：有原生 typing 的渠道（Telegram/Discord/WhatsApp/微信/QQ 单聊）执行完整配置延迟——阅读延迟虽静默，但随后的编写阶段有指示器"解释"整段等待；无 typing 渠道（Slack/飞书/钉钉/企微/QQ 群聊）阅读延迟**封顶 5000ms**（全程无缓解信号）。共享桥接按 `bot.sendTyping` 存在性自动判档（Slack 短档），QQ 按 kind（C2C 长档/群短档），飞书/钉钉/企微固定短档。
10. 分段/分块间隔尊重平台频控：Telegram 段间 ≥1s（单聊 1 msg/s）、钉钉 webhook 20 条/min → 段间 ≥3s、企微并发 ≤3 条（已串行）；实现为各桥接 `minSegmentGapMs` 下限与随机段间隔取 max。钉钉禁连发模拟打字机（超限封禁 10min，官方 FAQ 否定）。
11. 钉钉/企微/飞书/Slack 等待期反馈保持现状不新增占位消息；QQ 群聊无 typing 属平台限制（`sendInputNotify` 仅 C2C）。

## 2. 需求背景与用户路径

### 2.1 背景

本 fork 定位"角色扮演沉浸体验"。用户（角色扮演 bot 运营者）的核心诉求：

- 机器人回复"太快"穿帮：消息一到、瞬间回复。HCI 实证：按回复复杂度动态计算的延迟显著提升感知人性与社会临场感（Gnewuch 2018，调研 §2.6）。
- 关闭流式后生成期间无反馈：Telegram typing 5s 消失、Discord 10s 消失，长静默后消息突然出现。"持续 typing + 延迟 + 消息"组合才有效（arXiv:2510.08912：单独犹豫无益）；typing 显著缓解长等待负效应（Kim 2025）。

**拟真时序**（用户澄清的两阶段模型）：真人收发消息 = 隔一段时间才读到（静默）→ 读到后打字/思考（指示器断续）→ 发出。机器人按同构时序呈现即为本方案的沉浸内核。

### 2.2 目标用户路径（配置侧）

1. 「设置 → IM机器人 → 通用设置 → 拟人化设置」新增"发送延迟（全局默认）"区块：启用开关 + "阅读延迟"字段组（最短/最长、阅读速度、封顶、闲置加成）+ "分段间隔"字段组（最短/最长、打字速度、封顶）+ "输入指示器"选择（关闭/持续/断续，默认断续；断续高级节奏参数折叠）+ 探索预设下拉。保存对全部机器人生效。
2. 给某机器人单独调（如"慢性子"人设）：该渠道页 → 机器人卡片 → "发送延迟"折叠编辑器 → 覆盖全局默认，保存即时生效。
3. 关闭覆盖 → 回落全局默认。

### 2.3 目标用户路径（对话侧）

```
用户发消息
 → [① 阅读延迟] 完全静默（无指示器、无已读）——"真人还没看到消息"
 → [② 编写阶段] typing 指示器断续亮起（TG/DC/WA burst；微信/QQ 持续）
    → 模型生成（长思考期间指示器全程在线，不再 5–10s 消失）
    → 生成完成，立即发送（真人打完即发）
[message_break / 超长分块] → 每条分段独立小停顿（segmentGap），指示器段间重亮
[interrupt 新消息到达且仍在 ①] → 旧消息被"取代"：静默跳过，直接处理新消息
```

## 3. 现状盘点（代码事实）

### 3.1 渠道 × 呈现 × typing 能力矩阵（已逐一核实）

| 渠道 | 桥接 | 回复呈现 | 生成期反馈 | typing 能力 | 现状问题 |
|---|---|---|---|---|---|
| Telegram | 共享 `TextHarnessBridge` | 私聊 Rich Draft / 群聊占位消息编辑（流式）；非流式一次性发送 | 流式模式立即出现"正在处理…"占位；非流式模式无 | `sendChatAction` ≤5s（官方），发送即清除 | **一次性调用，5s 后消失**；非流式长生成全程静默 |
| Discord | 共享 | 消息编辑流式（1900 字符限制） | 流式模式首 token 前无占位 | `POST /channels/{id}/typing` 10s（官方） | **一次性调用，10s 后消失**；首 token 前也静默 |
| WhatsApp | 共享 | 每秒编辑同一条消息（Baileys） | 👀 reaction + 消息编辑 | presence `composing`，协议有效期 **~10s** | **现有刷新周期 20s > 有效期**（`whatsapp-runtime.mjs:635`），指示器间隙熄灭 |
| Slack | 共享 | 官方流式消息 API | 👀 reaction + 流式 | **无**（Socket Mode 只收不发；typing 帧为已弃用 RTM 专有） | 无 typing 可做，明确降级 |
| 微信 weixin | 自有桥接 | 一次性发送，>1800 字符分块 | iLink typing ticket，5s keepalive，60s 失败退避；**typing 在消息受理时（ask 前）即启动** | 原生"对方正在输入"（`ilink/bot/sendtyping`，status 1/2 + ticket≈24h） | 已是全项目最完善实现；r2 需把起点移到阅读延迟后 |
| QQ | 自有桥接 | 私聊单条 Markdown（≤4500 字符分块，被动回复条数 c2c 4 / 群 5） | SDK `typingIndicator` 中间件，C2C only——**cross-check 发现其 50s keepalive 在本集成中实际是死的**（SDK emit await handler，runtime onMessage 不 await 任务，`await next()` 立即返回、定时器被 clear）：现状 = 受理时单次 ≤60s 指示器、零续期 | `sendInputNotify`（仅 C2C，平台限制；官方 API `msg_type=6 input_notify{input_type:1, input_second≤60}`，100 QPS 含在内；SDK 公开 `bot.sendTyping(target, durationSec)` 包装，已核实） | 群聊无反馈；现状续期缺失；r2 替换为自管会话（起点随延迟）顺带修复续期 |
| 企业微信 wecom | 自有桥接 | 原生流式（`<think>` 块 + 流式帧） | 流式模式有"正在思考中…" | **无** bot typing API | `#streaming` 死字段：关闭流式设置无效 |
| 钉钉 dingtalk | 自有桥接 | AI Card 流式 / webhook 文本 | 🤔 reaction + 卡片"正在思考…" | **无** bot typing API | `#streaming` 死字段，同上 |
| 飞书 feishu | 自有桥接 | 流式卡片 / 非流式 `#sendAnswerText`；step-push 逐条富文本 | OnIt/DONE/ERROR reaction + 卡片 | **无** bot typing API（网传 API 实测 404 证伪） | 非流式模式生成期只有 reaction |

### 3.2 回合处理路径与延迟插入点（已逐一核实）

- **共享桥接（telegram/discord/slack/whatsapp）**：`text-harness-bridge.mjs` `#process`——L770 一次性 `sendTyping`（受理即发）→ L777 流式分支（`openDeliveryStream`/`openStream`）→ L825 `askInWorkspaceSession` → L884–933 最终发送（`stream.finish` 或 `sendDelivery`/`sendText`）；message_break 分段经 L803 `sendSegment` 即发。**阅读延迟插入点 = `#process` 开头（L770 之前），一个插入点覆盖 4 渠道**。
- **微信**：`weixin-bridge.mjs` 受理即 `#startTyping`（L333 附近）→ ask（finally 中 `#stopTyping` L944-948）→ L968 `#send`（L1354：分块循环发送）；分段 L899；补发 L735。
- **QQ**：`qq-bridge.mjs` L1197 `sendMarkdownReply`；分段 L1101；补发 L771。
- **企微**：`wecom-bridge.mjs` L1486–1505 流式收尾 / `#sendImmediate` L1255（被动优先：replyStream 单帧 + `sendMessage` 余块 + `#sendActive` L1511 主动兜底，命令路径在用）。
- **钉钉**：`dingtalk-bridge.mjs` L1423 `#send`（webhook 单条）；卡片流 L1341–1353 无条件开启。
- **飞书**：`bridge.mjs` L4233 流式卡片 vs L4279 `#sendAnswerText`（非流式）；step-push L3823 逐条 post（自带 250ms 队列间隔）。
- 各桥接都有**按会话串行队列**（`#queues` promise 链）：阅读延迟/段间隔只阻塞同一会话的后续消息，不跨会话、不乱序。

### 3.3 per-bot 配置基础设施（可直接复用，已核实）

- `BotWorkspaceStore`（`workspaces.json`，v3 + 原子写 + per-bot 队列）：`contextEnhancementFor`/`setContextEnhancement`/`decorateStatus` 投影进 status 快照、`createWorkspaceAwareController` 全渠道免费获得 `updateContextEnhancement`。
- 共享 RPC 端点模式：`bot.context-enhancement.set`（payload `{botId, config}`，九渠道再导出）；校验器为浏览器安全共享模块，客户端 import 同一模块。
- 桥接侧同步读取模式：production 把 `{botId, getSettings: () => workspaces.contextEnhancementFor(botId)}` 传入 runtime/bridge，消息时刻同步取值。
- 客户端编辑器模式：`ContextEnhancementEditor`（折叠/草稿/保存），挂每个渠道 AccountCard；i18n `h()` + `EN` 字典。

### 3.4 现有全局拟人化设置的断链（实测复现，必须修复）

`activateChannels`（`plugin-src/host/index.mjs:121-126`）把 store 值合并到**顶层** config，但 `channelConfig()`（L29-35）只转发 `config[channel]` 子对象 + `rpcAuthority` + `deliveryService`——顶层键被丢弃。实测（stub 全部 10 渠道 apply + `humanize.json{streaming:false, messageBreak:true, onNewMessage:'steer'}`）：**所有渠道三个键全为 undefined**。唯一消费者是 `installMessageBreakTool` 注册闸门（L134/140）。

断链第二层：**WhatsApp 与 Slack 的 production 模块（`plugin-src/host/channels/whatsapp|slack/production.mjs`）连 humanization 组装代码都没有**——其余 6 处（`shared/production.mjs:57-64` 覆盖 telegram/discord，及 qq/weixin/wecom/dingtalk/feishu）都组装传入 Runtime，而这两家的 Runtime 明明接受并转发（`whatsapp-runtime.mjs:703-705→823-825`、`slack-runtime.mjs:440-442→542-544`）。

连带问题：

- `streaming=false` 只被 `TextHarnessBridge`（L777）和飞书（L4233）消费；微信/QQ/钉钉/企微的 `#streaming` 是死字段（`weixin-bridge.mjs:378`、`qq-bridge.mjs:492`、`dingtalk-bridge.mjs:545`、`wecom-bridge.mjs:611`）。
- 设置在桥接构造时快照，改设置需重启。
- `humanize-rpc.mjs:35-37` `dshHome` 计算后未使用（路径硬编码 `homedir()`）。
- 默认值漂移：`DEFAULT_HUMANIZE_SETTINGS.messageBreak=true` vs 构造签名 `messageBreak=false`。
- 陈旧注释：`text-harness-bridge.mjs:774-776`、`weixin-bridge.mjs:333-334`、`message-break.mjs:10-11` 仍宣称 streaming 与 messageBreak 互斥（`2a29d25` 已改可共存）。
- humanize 相关**零测试**。

### 3.5 平台 typing 语义要点（调研摘要）

- Telegram：`sendChatAction` ≤5s，bot 发消息客户端即清除；无该接口专属限速；`action` 按消息类型可选（`typing`/`upload_photo`/`upload_document`…）。
- Discord：`/typing` 10s 过期；官方"bots 一般不该用"但点名认可"响应命令、计算需数秒"例外；~5s 续期。
- WhatsApp（Baileys）：presence ~10s 过期需重复维持；`sendTyping` 顺带标记引用消息已读（r2 语义下已读时序天然正确）；官方 Cloud API 参照 25s 上限。
- Slack：Socket Mode 无法发 typing（RTM 专有已遗留化）。
- QQ：`msg_type=6 input_notify`（`input_second≤60s`）仅 C2C；SDK 中间件 50s keepalive；消息接口 100 QPS（input_notify 计入）；被动回复条数 C2C 4 / 群 5、被动窗口 60min。
- 微信：iLink `sendtyping` status 1/2 + ticket（≈24h），仅私聊；5s keepalive 已验证。
- 企微/飞书/钉钉：无 bot typing API；官方"输入感"替代：企微流式回复（6min 窗口）、飞书卡片流式（10 ops/s）、钉钉 AI 卡片流式。

## 4. 范围与完成标准

### 4.1 必须实现

1. **共享延迟模块** `src/channels/shared/send-delay.mjs`（浏览器安全，host/client 共用）：
   - `DEFAULT_SEND_DELAY_CONFIG`、`normalizeSendDelayConfig`（宽容归一，读盘/合并）、`validateSendDelayConfig`（严格校验，RPC，抛带 code 类型化错误）、`computeReadDelayMs({ readDelay, userTextLength, idleMs, random })`（uniform + 阅读项 + 闲置加成 + 封顶）、`computeSegmentGapMs({ segmentGap, segmentLength, random })`（uniform + 打字项 + 封顶）、`visibleLength(text)`（入站消息与分段的可见长度，v1 启发式：剥离 Markdown 链接保留锚文本/代码围栏/标记、折叠空白）、`mergeHumanizeSettings(global, perBot)`。
   - 约束：`0 ≤ readDelay.minMs ≤ readDelay.maxMs ≤ 300_000`（92% 真人回复 ≤5min，调研 §2.7）；`readDelay.charsPerSecond ≥ 0`；`readDelay.maxTotalMs ≤ 300_000`；`idleBoost.afterMs ≥ 0`、`idleBoost.multiplier ∈ [1, 10]`；`0 ≤ segmentGap.minMs ≤ segmentGap.maxMs ≤ 30_000`；`segmentGap.charsPerSecond ≥ 0`；`segmentGap.maxTotalMs ≤ 30_000`；归一强制 min ≤ max、maxTotalMs ≥ maxMs。渠道频控下限 `minSegmentGapMs` 在计算后取 max（频控优先于封顶，平台安全第一）。
2. **全局默认**：`humanize.json` 增 `sendDelay`（默认 disabled）、`typingIndicator`（`'off'|'continuous'|'burst'`，默认 `'burst'`）与 `typingBurst`（可见亮/灭四参数，默认 3000/6000/1500/4000）；`HumanizeSettingsStore` 归一化扩展；`validHumanizePayload` allowlist 增键；`#persist` 改原子写（tmp + rename + 0o600）。
3. **per-bot 覆盖**：`BotWorkspaceStore` 增 `humanize` 段（`humanizeFor`/`setHumanize`/`decorateStatus` 投影 `account.humanize`；可选段、文档版本保持 3、entry 级损坏隔离对齐 contextEnhancement，见 §5.2）；`createWorkspaceAwareController` 增 `updateHumanize`；共享 RPC `bot.humanize.set`（共享模块 + 九渠道再导出）。
4. **阅读延迟与段间隔接入**：
   - 共享 `TextHarnessBridge`：构造参数增 `humanize` provider（`{botId, getSettings}`）；`#process` 开头读生效设置 → 非旁路（正常助手回合）时 sleep 阅读延迟（abort-aware；入参=用户消息可见长度 + 会话闲置时长）→ **延迟后才 `sendTyping` 启动会话** → 原有流式/ask/发送流程不变；message_break `sendSegment` 内应用段间隔（先 `sendTyping` 重亮 → sleep(段间隔, ≥`minSegmentGapMs`) → send）。最终发送不再有额外延迟（生成完即发）。桥接维护每会话 `lastActivityAt`（入站+出站取大）供闲置加成判定。
   - 微信/QQ/企微/钉钉/飞书五个自有桥接：同样在回合开头（`startTyping`/ask 之前）插入阅读延迟（入参同上）；微信 `#startTyping` 起点移到延迟后、块间 `#resumeTyping` + 段间隔；QQ 块间段间隔；企微/钉钉/飞书非流式分支段间隔。
   - 延迟 sleep 必须可中断：`AbortSignal.any([桥接 signal, 会话取代信号])` + 定时器清理；中断走 abort 分支无未处理拒绝。
5. **interrupt × 阅读延迟取代语义**（cross-check 修正）：桥接维护每会话"当前任务 AbortController"，**覆盖整个 pre-ask 窗口**（阅读延迟 + 图片内容 staging + openStream），相位标记在 sleep resolve 的同一微任务链内同步切换；interrupt 分支**无条件 abort 队首控制器**（无活动回合时 fireAndForgetStop 已验证优雅 no-op，不需检测）+ 照旧 stopActiveTurn；被 abort 任务抛 `code='superseded'` 的 AbortError，**六个桥接的 catch 新增静默分支**（清 reaction、不发送、不写错误）——通用分支会发"处理失败"提示，与静默语义矛盾；顺带修复既有竞态（interrupt 落在内容准备/开流窗口 → 双回复）。微信/QQ 的 prompt markSeen 前移到延迟之前（防供应商重投二次处理）。`/stop` 同样 abort 延迟控制器（"开始前停掉"）。queue/steer 不变。
6. **typing 会话（编写阶段指示器）**：
   - 新共享模块 `src/channels/shared/typing-session.mjs`：`createTypingSession({ sendTyping, stopTyping?, refreshMs, darkResidualMs, logger, signal, mode, burst })`——`start()` 立即发一次并起 unref 定时器；`mode='continuous'` 周期续期；`mode='burst'` 状态机：亮相随机 `burst.onMinMs..onMaxMs`（期内按 refreshMs 续期）→ 灭相 `可见灭相随机 offMinMs..offMaxMs + darkResidualMs`（有 `stopTyping` 的渠道在灭相起点显式停发，darkResidualMs=0；无取消 API 的渠道静默等待残余）→ 循环；`pause()`/`resume()` 供 pending 交互挂起；`restartOn()` 供分段间重启亮相；失败限频日志不中断；`stop()` 清理；signal abort 自动清理；按 target 键控。burst 参数取全局 `typingBurst`（可见语义，模块内加残余）。
   - **会话生命周期绑定回合**：`#process` 中阅读延迟完成后 `start()`，`#process` finally 中 `stop()`——不与具体发送挂钩（旁路发送 L557/L576-623/L625/L634 不误灭；`/stop` 终止回合 L973-983 无残留）。
   - Telegram `refreshMs=4000`（darkResidual 5000）、Discord `refreshMs=5000`（darkResidual 10000）：会话定时器在**共享桥接层**（新构造参数 `typingRefreshMs`/`darkResidualMs`，telegram/discord production 传入；适配器 `sendTyping(target, action?)` 保持无状态单次调用）。
   - **WhatsApp 统一走共享会话**（cross-check 修正）：适配器新增公开 `stopTyping(target)`（Baileys presence `'paused'`，灭相/回合终止显式停发），`sendTyping` 保持单次 `'composing'`；**删除 runtime 内部 20s 循环**（既修 20s>10s 有效期 bug，也修"无发送的回合终止 → composing 无限续跑"的现存 bug——现状 `#stopTyping` 私有且只在发送路径/close 调用）；桥接层会话 `refreshMs=8000`、`darkResidualMs=0`（显式 paused 即刻可见灭相）。
   - **QQ 现状修正与替换**（cross-check 发现）：SDK `typingIndicator` 中间件的 50s keepalive 在本集成中**实际是死的**——SDK emit 会 await handler（`QQBot.js` L188-196），而 `qq-runtime.mjs` L232-242 的 onMessage 不 await 桥接任务，`await next()` 立即返回、定时器随即 clear。现状 QQ C2C = 受理时单次 ≤60s 指示器、零续期。替换为自管会话（runtime 暴露 `sendTyping(replyTarget)` 包装 SDK `bot.sendTyping(target, durationSec)`，C2C only，50s 续期，起点随阅读延迟）**顺带修复续期缺失**，加回归断言。
   - **Telegram action 匹配（已确认纳入）**：`sendTyping(target, action)` 可选参数；附件发送前以 `upload_photo`/`upload_document` 重启会话。
   - **pending 交互/审批挂起时会话暂停**（cross-check 建议，"人在等对方回答，不在打字"）：桥接检测到 pending question/approval 时 `pause()`，恢复后 `resume()`；修复现状微信 pending 期间 scheduleTyping 定时器仍在跳的问题。
   - 微信：`#startTyping` 移到延迟后（compose 起点）；burst 不做（票据 1/2 频繁切换有未知限速风险），仅 continuous。
   - `typingIndicator='off'`：不启动任何会话/循环，指示器彻底关闭（比现状更彻底——现状在受理时会单次触发亮 5–10s；显式选 off 的用户不想要指示器，属文档化的行为变化，§8.2 红线明示）；`'continuous'`：全程常亮；`'burst'`（默认）：断续。
7. **断链修复与流式一致性**：
   - `channelConfig` 转发 `streaming`/`messageBreak`/`onNewMessage`/`sendDelay`/`typingIndicator` + `humanizeDefaults`（store 活访问器）；**渠道子对象同名键 > 全局默认**（`channel.streaming ?? config.streaming`，host 测试固化）。
   - production 组装 provider——**全部 8 个文件**：shared、whatsapp、slack（断链第二层）、qq、weixin、wecom、dingtalk、feishu；共享 helper `createHumanizeProvider({ defaults, workspaces, botId })`。
   - 钉钉/企微接通 `#streaming`：false 时不开卡片流走一次性发送（钉钉 `#send`+reaction；企微 `#sendImmediate` 被动优先，主动仅兜底）；微信/QQ 死字段删除或标注。
   - 清理陈旧注释（含 `message-break.mjs` 头部）与默认值漂移（`messageBreak` 构造默认对齐 `true`）；修 `humanize-rpc.mjs` `dshHome`。
8. **客户端 UI**：
   - 拟人化面板增"发送延迟（全局默认）"区块：启用 + 阅读延迟 min/max + 分段间隔 min/max（秒）；"输入指示器"三选（关闭/持续/断续）；hint：两阶段语义说明、**"排队消息的延迟会累积"**、短档渠道封顶 5s 说明；保存走现有 `humanize.set`；"按机器人覆盖请在各渠道机器人卡片设置"指引。
   - 新共享组件 `BotSendDelayEditor`（折叠、跟随全局/覆盖切换、校验、保存调 `bot.humanize.set` 后刷新快照），挂九渠道 AccountCard；渠道能力提示（无 typing 渠道"仅延迟生效、封顶 5s"）。
   - 新文案补 `EN` 字典。
9. **文档**：README（中英）拟人化章节重写（两阶段模型）；CHANGELOG。

### 4.2 明确不做

1. 不为 Slack/飞书/钉钉/企微引入任何 typing/占位消息模拟（无 API 或通知噪音）。
2. 不给 QQ 群聊造 typing（平台限制）。
3. 延迟不作用于：命令回复、错误/停止提示、审批/提问交互、产物文件、超时补发（deferred）、主动投递。**已知缺口明示**：deferred 补发是拟人化漏汤最明显处，本期不做（异常恢复路径，加延迟进一步推迟用户已等的答案），文档记录。
4. 不做按**回复**长度的延迟项（r2 语义否定——回复长度的编写耗时由生成时长天然体现）；阅读项（用户消息长度）与分段打字项（分段长度）已纳入（r3）。不做 elapsed 感知"打字预算"；不做微信/QQ 的 burst（票据型 API 风险）；不做 WhatsApp 已读回执独立延迟（已读随 typing 起点已正确）。
5. 不把 `streaming`/`messageBreak`/`onNewMessage`/`typingIndicator` 做成 per-bot UI（数据模型天然支持，v1 只开 `sendDelay`；`messageBreak` 工具注册仍是全局闸门）。
6. 不改 office 渠道；不引入新依赖；不改 RPC 通道命名与 authority。
7. 流式 `stream.finish` 无额外延迟（生成完即发）；step-push 中间输出不延迟。

### 4.3 完成标准

- **延迟**：开启后流式/非流式均先静默 `readDelay` 再处理；`enabled=false` 时延迟路径零回归（§8.2）。
- **typing**：编写阶段（延迟结束→发送/回合终止）指示器在线——TG/DC 默认断续（残余感知灭相**肉眼可见**）、可切持续/关闭；WhatsApp composing 持续无间隙熄灭、burst 经 `'paused'` 显式灭；微信/QQ 起点=延迟结束；回合终止（含 `/stop`、含无发送路径）无残留（现状 WA/QQ bug 修复验证）；旁路发送不灭；pending 交互期间暂停。
- **interrupt 取代**：延迟窗口内 interrupt 新消息 → 旧回合静默跳过（无生成、无发送、无"处理失败"提示、无双回复），新消息立即处理；`/stop` abort 延迟窗口内回合；无未处理拒绝。
- **传播修复**：五个全局键对新回合即时生效（含 WhatsApp/Slack）；host 回归覆盖九渠道。
- per-bot 覆盖保存即生效；删除回落全局。
- `/stop`、interrupt/queue/steer、插件停机：不未处理拒绝、不乱序、不丢消息（取代语义除外——它是明确设计行为）；串行语义保持。
- `npm run check` 通过。

## 5. 数据模型与生效规则

### 5.1 全局默认（`~/.dsh/integrations/dsh-im/humanize.json`）

```json
{
  "streaming": true,
  "messageBreak": true,
  "onNewMessage": "interrupt",
  "typingIndicator": "burst",
  "typingBurst": { "onMinMs": 3000, "onMaxMs": 6000, "offMinMs": 1500, "offMaxMs": 4000 },
  "sendDelay": {
    "enabled": false,
    "readDelay": {
      "minMs": 1000,
      "maxMs": 6000,
      "charsPerSecond": 0,
      "maxTotalMs": 30000,
      "idleBoost": { "afterMs": 600000, "multiplier": 2 }
    },
    "segmentGap": {
      "minMs": 500,
      "maxMs": 2000,
      "charsPerSecond": 0,
      "maxTotalMs": 10000
    }
  }
}
```

- `typingIndicator`：`'off'` | `'continuous'` | `'burst'`（默认 `'burst'`；旧布尔值归一：`true`→`'burst'`、`false`→`'off'`，保持"开启即拟真"语义）；`typingBurst` 四参数仅 burst 模式生效（**可见**亮/灭时长语义——TG/DC 上实际灭相 = 配置值 + 平台残余 5–10s，正是真人形态；全局层，不做 per-bot）。
- `readDelay` 默认 1–6s：中位 ~3.5s 低于 8s 负面阈值（Peng & Mo）；真人文档级延迟（中位 15s、发起会话 37s、92% ≤5min，调研 §2.3）由预设/自定义覆盖（上限 300s）。
- `readDelay.charsPerSecond`（**阅读速度**，按入站用户消息可见长度折算）：默认 0 关闭；建议值——中文默读 ≈5–10 字/s（300–600 字/分）、英文 ≈15–25 字符/s（200–300 wpm）；值越小"读得越仔细"。
- `readDelay.idleBoost`（**闲置加成**）：会话最近活动距今 ≥`afterMs`（默认 10min）→ 整个阅读延迟 ×`multiplier`（默认 2；实证锚点：会话发起消息回复中位 37s ≈ 整体 15s 的 2.5×，调研 §2.3）；仍受 `maxTotalMs` 封顶；`multiplier: 1` 即关闭。
- `segmentGap.charsPerSecond`（**分段打字速度**，按下一分段长度折算）：默认 0 关闭；建议参考 Holtgraves 2007→Zhang 2024 的 50ms/字符先例（=20 字符/s，"象征性打字"）；中文真人级 1–2 字/s 会长顶封顶（Schanke 教训），慎用。
- README 附参数手册 + 探索预设（轻拟人默认 / 慢性子人设 / 沉浸角色扮演：长读延迟+闲置加成+分段打字 / 即刻应答仅分段节奏）。

### 5.2 per-bot 覆盖（各渠道 `~/.dsh/integrations/dsh-<channel>/workspaces.json`）

```json
{
  "version": 3,
  "workspaces": { "telegram_ab12…": "/abs/path" },
  "humanize": {
    "telegram_ab12…": {
      "sendDelay": {
        "enabled": true,
        "readDelay": { "minMs": 3000, "maxMs": 20000, "charsPerSecond": 8, "maxTotalMs": 60000, "idleBoost": { "afterMs": 300000, "multiplier": 3 } },
        "segmentGap": { "minMs": 800, "maxMs": 3000, "charsPerSecond": 20, "maxTotalMs": 8000 }
      }
    }
  }
}
```

文档版本**保持 3**：`humanize` 与 `contextEnhancement` 同为可选段（`normalizeDocument` 接受 v1/v2/v3，entry 级容错，无效条目丢弃不污染全文，段空不落盘）。生效规则（`mergeHumanizeSettings`）：per-bot 键覆盖全局键；`sendDelay` 对象**整体替换**（不深合并）；缺失回落全局。per-bot 对象经 RPC 保存时校验+归一为**完整对象**（UI 预填全局默认作编辑起点）；关闭某子项用中性值（`idleBoost.multiplier: 1`、`charsPerSecond: 0`）而非省略键——手工编辑的部分对象读取时按默认补全（README 说明）。`humanizeFor(botId)` 返回冻结副本。`typingIndicator`/`typingBurst` 为全局设置，v1 不做 per-bot（数据模型天然支持，后续开放）。

### 5.3 延迟计算

- **阅读延迟**（每回合独立，随机源可注入）：
  ```
  baseMs     = readDelay.minMs + random() * (maxMs - minMs)
  readingMs  = charsPerSecond > 0 ? visibleLength(用户消息原文) / charsPerSecond * 1000 : 0
  idleMult   = (会话最近活动距今 ≥ idleBoost.afterMs) ? idleBoost.multiplier : 1
  readDelayMs = min((baseMs + readingMs) * idleMult, readDelay.maxTotalMs)
  ```
  - 长度取**入站用户消息原文**的可见长度（contextEnhancement 增强前的用户输入；图片/文件消息长度按 0 计，仅基础项）。
  - 会话最近活动 = 该会话最近一次入站或出站消息时间（桥接维护 `lastActivityAt`，取两个方向较大者）。
- **分段间隔**（每段独立）：
  ```
  baseMs   = segmentGap.minMs + random() * (maxMs - minMs)
  typingMs = charsPerSecond > 0 ? visibleLength(下一分段) / charsPerSecond * 1000 : 0
  gapMs    = max( min(baseMs + typingMs, segmentGap.maxTotalMs), minSegmentGapMs 渠道频控下限 )
  ```
  （频控下限优先于封顶——平台安全第一。）
- 仅 `enabled === true` 且该回合属于"正常助手回复"时执行；阅读延迟插在 ask 之前（流式/非流式均生效）。

## 6. 架构设计

### 6.1 设置流（修复后）

```
humanize.json ──(store 活访问器)──┐
                                  ├─ production 组装 provider：
workspaces.json humanize 段 ──────┘   humanize = { botId, getSettings }
                                          │（每回合 #process 同步调用）
runtime 构造（保留构造快照作回退）──→ bridge #process:
     settings = getSettings() ?? 构造快照
     streaming / messageBreak / onNewMessage / sendDelay / typingIndicator 以 settings 为准
```

- `channelConfig` 带五个全局默认键 + `humanizeDefaults` 访问器，渠道子对象同名键优先；production 与 `workspaces.humanizeFor(botId)` 合成 provider（`createHumanizeProvider` helper，8 文件复用）。
- RPC `humanize.set`（全局）与 `bot.humanize.set`（per-bot）更新各自 store，下一次 `getSettings()` 立即生效。

### 6.2 延迟执行点（按桥接）

| 桥接 | 阅读延迟插入位置 | 段间隔位置 | 延迟档位 | typing（compose 阶段） |
|---|---|---|---|---|
| 共享（tg/dc/slack/wa） | `#process` 开头（L770 `sendTyping` 之前） | `sendSegment` 回调：会话 `restartOn()` 重亮 → sleep(段间隔, ≥`minSegmentGapMs`) → send | tg/dc/wa 长档；Slack 短档（无 `sendTyping` 自动判档） | tg/dc/wa 桥接层共享会话（burst 残余感知/continuous）；slack 无 |
| 微信 | 回合开头（`#startTyping` 移到延迟后） | 块间 `#resumeTyping` + sleep | 长档 | 票据 keepalive（continuous only） |
| QQ | 回合开头（自管会话替换中间件，起点随延迟；C2C only） | 块间 sleep | C2C 长档 / 群短档 | 自管 input-notify 会话（continuous only，50s 续期） |
| 企微 | 回合开头（`#streaming=false` 时走 `#sendImmediate` 被动优先） | 余块 `sendMessage` 间 sleep | 短档 | 无（明确降级） |
| 钉钉 | 回合开头（非流式分支 `#send`） | message_break 段间 sleep 且 ≥3s（webhook 20 条/min） | 短档 | reaction 🤔 已覆盖 |
| 飞书 | 回合开头（非流式分支 `#sendAnswerText`） | —（step-push 不延迟） | 短档 | OnIt reaction 已覆盖 |

共享辅助：`applyReadDelay({ settings, tier, signal, logger })` 与 `applySegmentGap({ settings, tier, minSegmentGapMs, signal, logger })`，abort-aware sleep；测试假时钟。档位常量 `SHORT_DELAY_CAP_MS = 5000`。

### 6.3 typing 会话（编写阶段）

- `createTypingSession({ sendTyping, stopTyping?, refreshMs, darkResidualMs, logger, signal, mode, burst })`：`start()` 立即一次 + 定时器（unref）；`continuous` 周期续期；`burst` **残余感知状态机**：亮相随机 `burst.onMinMs..onMaxMs`（期内按 refreshMs 续期）→ 灭相 `随机 offMinMs..offMaxMs + darkResidualMs`（有 `stopTyping` 的渠道灭相起点显式停发、darkResidualMs=0；无取消 API 的渠道静默等待平台残余耗尽）→ 循环。burst 参数取全局 `typingBurst`（**可见**亮/灭时长语义，残余由模块按渠道自动补足，用户无需理解平台有效期）。失败限频日志；`stop()`/abort 清理；按 target 键控；`pause()`/`resume()`（pending 交互）；`restartOn(action?)`（分段间/附件前重启亮相）。
- **残余感知的必要性**（cross-check 数学验证）：平台指示器在最后一次动作后仍亮到过期（TG +5s、DC +10s、WA ~10s）——若灭相只是"停止发送"，可见灭相 1–2.5s 会被残余完全吞掉（DC/WA 灭相 100% 不可见、burst≡continuous；TG 仅偶发 ≤1.5s 闪烁）。残余感知让用户配置的可见灭相真实呈现；且"TG 上停打 >5s 才熄灭"正是真人在该平台的形态。
- **灭相计时从最后一次 `sendTyping` 起算**（auto_human 实现细化）：灭相起点 = 亮相内**最后一次 sendTyping 的时刻**（亮相→灭相切换时若距上次刷新已 >0，先补发一次最终刷新再进灭相），resume 定时 = lastSend + darkResidualMs + 可见灭相——否则刷新相位错位会使实际熄灭比配置虚涨最多一个 refreshMs（TG +4s / DC +5s）。**单测断言"实际熄灭区间"**（最后一次点亮到下次发送之间）而非仅相位时长。
- 周期与残余：Telegram refresh 4000 / residual 5000；Discord refresh 5000 / residual 10000；WhatsApp refresh 8000 / residual 0（显式 `'paused'`）；QQ refresh 50000（v1 continuous）；微信 5000（现状票据 keepalive）。
- **生命周期绑定回合**：阅读延迟完成后 `start()`，`#process` finally `stop()`（TG/DC/WA/QQ 均经桥接统一触达——**WA 删除 runtime 内部循环**，适配器新增公开 `stopTyping(target)`（`'paused'`），修复现状"无发送的回合终止 → composing 无限续跑"bug）；不与具体发送挂钩（旁路发送不误灭；`/stop` 终止回合无残留）。
- **pending 交互/审批挂起 → `pause()`**（"人在等对方回答，不在打字"；修复现状微信 pending 期间指示器仍跳）。
- message_break 段间：`sendSegment` 回调内先 `restartOn()`（重启亮相）→ sleep(段间隔, ≥`minSegmentGapMs`) → send——**统一经会话 API**，不裸调适配器（裸调会绕穿 burst 相位追踪；WA 的裸 sendTyping 还会重启已删的循环逻辑）。真人"连发多条、每条之间继续输入"（Baron 2010：42% 拆多条）。
- 流式模式早停（auto_human 判据具体化）：**首次成功流式更新后 `stop()`**——TG 官方明文 bot 发任何消息（含占位编辑）即清 typing，流式编辑 + 续期并存是双重信号/闪烁；占位消息即"开始说话"，指示器应让位。按渠道验收确认（占位编辑出现后指示器确实消失）。
- 附件发送不停止会话；Telegram 附件前以 `restartOn('upload_photo'/'upload_document')` 重启（action 匹配）。
- burst 支持矩阵：TG/DC ✓（残余感知灭相）；WA ✓（显式 paused，无残余问题）；QQ v1 continuous（`input_second` 可精确设亮相时长，burst 列 v2）；微信 ✗ v1（票据 status 1/2 频繁切换限速未知）；其余渠道无 API。

### 6.4 已否决的备选（证据见调研 §2、§3）

- **按回复长度延迟（charsPerSecond 折算回复长度）**：r1 模型，r2 语义否定——回复长度的编写耗时由生成时长天然体现；r3 已把长度项放到语义正确的位置：阅读项按**用户消息**长度（读入站消息）、分段项按**分段**长度（打下一段）。
- **elapsed 感知打字预算**：语义复杂化，否决（同 r1）。
- **对数正态分布**：人类间隔确实重尾（arXiv:1607.02952），但感知收益来自结构而非形状，μ/σ 不可解释；均匀区间可解释可测试。v2 可从分位点反解（`μ=ln(m)`、`σ=(ln(p)−ln(m))/1.2816`）。
- **故意打错字**：实证降低感知真实感（arXiv:2510.08912），不做。
- **打字模拟拉满真实时长**：降低喜好度（Schanke 2021）——r2 模型天然规避（指示器只覆盖实际生成期，不人为拉长）。
- **占位消息 / Slack RTM / 钉钉连发打字机**：通知噪音 / 已遗留 / 超限封禁，均不做。

### 6.5 并发与生命周期

- **阅读延迟在每会话串行队列内**：同会话新消息排队；跨会话无影响、不乱序。
- **interrupt 取代语义**（§1.8）：队首任务处于 pre-ask 窗口时被 interrupt → abort → 静默跳过（不 ask 不发送，`code='superseded'` 静默分支）。与现状"打断生成中回合 = 静默丢弃"一致且省一次生成；顺带修复既有"interrupt 落在内容准备/开流窗口 → 双回复"竞态。queue：排队等旧回合完成；steer：无活动回合可转 → 转排队（现状 fallback 一致）。**群聊注意**：B 用户的 interrupt 消息会取代 A 用户仍在延迟期的待回复消息（与现状打断生成中回合的多用户行为一致，文档明示）。
- **interrupt 感知放大**：编写阶段（已 ask）被打断时旧答案不发送（现状即如此）；r2 无 r1 的"延迟窗口旧答案仍发出"问题（发送无延迟）。
- **queue 模式排队累积**：连续多条消息（queue 策略下逐条排队）最坏累积 n×(readDelay+生成+段间隔)，与"真人逐条回"一致；`/batch` 批量输入合并为单条消息只延迟一次；UI hint 明示。v2 候选：活跃会话 idle-gap 感知（第 2..n 条排队消息已"人在线"，阅读延迟递减）。
- `/stop`：终止 harness 回合（现状）+ **abort 阅读延迟控制器**（"在它开始前停掉这个回合"——cross-check 修正，比 no-op 语义更正确）；/help 输出同步说明。
- 插件停机：signal abort → sleep 立即结束 → 现有 abort 分支；typing 会话 stop()/abort 清理。
- **微信 contextToken**（cross-check 更正）：token 在 accept 时从入站消息捕获（`weixin-bridge.mjs` L421-427、L815），并非 ask 时获取——r1（生成+延迟）与 r2（延迟+生成）收信→发送总时长相同，无新鲜度差异。真实风险方向相反：高延迟配置（≤300s）+ 长生成把发送推离收信很远，iLink context_token 有效期未知——微信档 README 提示 + 真机验收观测（验收项 4）；QQ 被动回复 60min 窗口对延迟+生成绰绰有余。
- **取代语义的行为边界**（auto_human 裁定）：pre-ask 控制器与 supersede **无条件生效**（不受 `sendDelay.enabled` 门控）——`enabled=false` 时延迟为零，但 interrupt 落在内容准备/开流窗口的**双回复竞态（现存 bug）仍被修复为静默取代**；§8.2 红线相应表述"唯一例外"。

### 6.6 无 typing 渠道的明确降级

Slack（👀 reaction）、飞书（OnIt reaction + 非流式文本）、钉钉（🤔 + 非流式文本）、企微（非流式无可见反馈，现状即如此）、QQ 群聊（平台限制）。这些渠道阅读延迟封顶 5s（§1.9）；UI 明示"该平台无原生正在输入指示"。

## 7. 客户端 UI 设计

1. **全局默认（拟人化面板）**："发送延迟（全局默认）"区块——启用 checkbox；"阅读延迟"字段组：最短/最长（秒）、阅读速度（字/秒，0 关闭，hint 注明按用户消息长度折算）、单回合封顶（秒）、闲置加成（闲置 ≥ __ 分钟 → 延迟 × __）；"分段间隔"字段组：最短/最长（秒）、打字速度（字/秒，0 关闭）、封顶（秒）；并排"输入指示器"三选（关闭/持续显示/断续拟真，默认断续拟真）+ 折叠"断续节奏高级参数"（亮相最短/最长、灭相最短/最长毫秒）；hint：两阶段语义、排队累积、短档渠道封顶 5s；保存走 `humanize.set`；"按机器人覆盖请在各渠道的机器人卡片中设置"指引 + 探索预设下拉（轻拟人/慢性子/沉浸角色扮演/即刻应答，填入字段供微调）。
2. **per-bot 编辑器（`BotSendDelayEditor`）**：折叠"发送延迟"；"跟随全局默认 / 覆盖"切换；覆盖态显示同字段组（预填全局默认作起点，完整配置整体保存）；保存调 `bot.humanize.set`；渠道能力提示。校验复用共享 `validateSendDelayConfig`，错误就地展示。
3. 无 typing 渠道不隐藏不禁用（延迟仍有效，封顶 5s）。

## 8. 测试与验收

### 8.1 单元/集成测试（node:test）

- `test/send-delay.test.mjs`：归一化/严格校验边界（min>max、负数、超上限、multiplier 范围）；`computeReadDelayMs`（注入固定 random：uniform 上下界、阅读项按用户消息长度、闲置加成阈值边界与倍率、封顶交互——加成后超 cap 截断）、`computeSegmentGapMs`（uniform、打字项、封顶、频控下限优先于封顶）、`visibleLength`、`mergeHumanizeSettings`（key 覆盖、对象整体替换、缺省回落）、`typingIndicator` 旧布尔归一与 `typingBurst` 参数归一。
- `test/typing-session.test.mjs`：立即首发、continuous 周期、burst **残余感知**状态机（随机源注入、自定义 burst 参数、darkResidualMs 补足——TG 配置下灭相时长=可见+5000、有 stopTyping 的渠道 darkResidual=0 且灭相起点调 stopTyping）、pause/resume（pending）、restartOn、失败限频容忍、stop/abort 清理、多 target 键控。
- `test/humanize-settings.test.mjs`（新增）：store 读写、sendDelay/typingIndicator 归一、原子写、RPC allowlist。
- `test/channels/shared/text-harness-bridge.test.mjs` 扩展：
  - 既有顺序断言 `'typing','open','update:处理中','finish:…','file:…'` 不回归——**固定 `typingIndicator:'off'` 运行**（cross-check：默认 burst 下它靠"首发同步+续期 timer 未触发"的脆弱耦合通过，须显式关闭）；另加假时钟下的 burst 顺序测试。
  - 阅读延迟：`#process` 开头 sleep 预期 readDelayMs；阅读项按入站消息长度、闲置加成按 `lastActivityAt` 判定；**延迟期间无 `sendTyping` 调用**（指示器起点在延迟后）；延迟后 typing 会话启动；流式模式同样延迟。
  - burst/continuous/off 三模式：`sendTyping`/`stopTyping` 调用序列匹配残余感知亮/灭节奏。
  - interrupt 取代：延迟窗口内新消息（interrupt）→ 旧任务无 ask 无发送、无"处理失败"提示（superseded 静默分支）、新消息立即处理；queue/steer 不取代；`/stop` abort 延迟控制器。**六个桥接各自加 supersede 回归**（无 supersede 的桥接 + 延迟 = interrupt 双回复回归）。
  - 旁路发送不灭会话；`/stop` 分支（L973-983）会话停止无残留。
  - message_break 段间隔 + `restartOn()` 重亮；abort 无未处理拒绝。
  - provider 活更新：改 store 下一回合生效；per-bot 覆盖优先。
- 渠道专项：telegram action 匹配（附件前 `upload_photo`/`upload_document`）；whatsapp 共享会话 8s 刷新 + burst `paused` 显式灭相 + 回合终止（无发送路径）无 composing 残留 + `off` 不启会话 + runtime 内部循环已删；weixin typing 起点=延迟后、块间 resumeTyping + 段间隔、ticket 复用不回归、pending 期间 typing 暂停；qq 自管会话替换中间件（C2C 起点随延迟 + **续期真实生效**回归断言——现状 keepalive 是死的）；dingtalk/wecom `streaming=false` 走一次性发送（企微断言 `#sendImmediate` 被动路径）；feishu 非流式延迟。
- 传播回归：`test/host.test.mjs`——每渠道（含 whatsapp/slack）apply 收到五个全局键与 `humanizeDefaults` 访问器、渠道子对象键优先。
- RPC/客户端：`bot.humanize.set` payload 校验；`BotSendDelayEditor` 渲染/校验/保存；全局面板新控件渲染与保存。

### 8.2 回归红线

- **sendDelay 路径**：`enabled=false`（默认）时所有渠道行为、消息顺序、现有测试逐字节不变。**唯一例外**（auto_human 裁定）：pre-ask 控制器与 supersede 无条件生效——interrupt 落在内容准备/开流窗口时，现状的**双回复 bug**（旧回合照常 ask 并发送 + 新消息再回复）被修复为静默取代；这是严格改善，逐字节一致性只在该 bug 处打破，host/bridge 回归测试固化此例外。
- **typing 是独立行为变化**（`typingIndicator` 默认 `'burst'`）：不受 `sendDelay.enabled` 影响，单独验收；`'off'` = 现状关闭单次触发也移除（现状受理即发一次，r2 起点移到延迟后——`enabled=false && typingIndicator='off'` 时与现状差异=指示器不再受理即亮，需在红线中明示：推荐组合为 `burst`/`continuous`，`off` 保留给明确不想要指示器的用户）。
- 流式收尾顺序不变；流式路径除回合开头延迟外无新增延迟。
- deferred delivery、主动投递、审批/提问、产物文件、命令路径零改动。
- typing 失败不影响回复发送（best-effort，限频日志）。

### 8.3 真机验收（清单随实现交付）

1. Telegram（私聊+群）：阅读延迟期完全无指示器；延迟结束指示器断续亮起；长生成（≥60s）全程断续在线（**可见灭相**：配置 2s 可见灭 → 实际熄灭 ~7s = 2s+5s 残余，肉眼看真断续）；消息到达即消失；附件前短暂 `upload_photo`/`upload_document`；4s 续期无限速告警。
2. Discord：同上（5s 续期；可见灭相 2s → 实际熄灭 ~12s = 2s+10s 残余）。
3. WhatsApp：阅读延迟期无 presence/已读；延迟结束已读回执+composing 出现（注：`sendTyping` 只标记 quoted 消息已读，非引用回复无已读——README 措辞注意）；>60s 生成 composing 持续（8s 续期）；burst 灭相经显式 `'paused'` 即刻可见；**无发送的回合终止（/stop）无 composing 残留**（现状 bug 修复验证）；**burst 回退判据**：composing/paused 每 5–10s 反复翻转若引发协议不稳（presence 失败/告警/账号信号），WA 渠道级强制退化 continuous（逆向协议灰色地带，同 Discord 限速回退模式）。
4. 微信：阅读延迟期无"正在输入"；延迟结束出现；块间重现；延迟上限场景（如 60s）+ 长生成消息仍正常发出（iLink context_token 有效期观测点）；pending 提问期间指示器暂停。
5. QQ（C2C）：自管会话起点=延迟结束；**50s 续期真实生效**（现状 keepalive 死——长生成 >60s 观察指示器不消失）；群聊无变化。
6. 钉钉/企微：全局关流式后一次性发送 + 延迟生效（企微验证 `#sendImmediate` 被动路径 6min 窗口内收尾）；补查企微主动消息频控口径。
7. 设置面板：全局与 per-bot 保存不重启即时生效；覆盖删除回落；三档 `typingIndicator` 切换生效；burst 节奏参数调整可观察变化。
8. interrupt 场景：延迟窗口内新消息 → 旧消息静默跳过（无"处理失败"提示、无双回复）新消息立即回复（记录体感）；群聊 B 用户 interrupt 取代 A 用户延迟中消息（记录体感）；`/stop` 在延迟窗口内直接终止该回合；延迟分布观测：默认参数 P50 ∈ [2,6]s；typing 续发失败率单列日志；Telegram 5min 生成 → 续期调用无限速异常 + 指示器可见性抽样录屏。

## 9. 实施顺序（供实施阶段拆分）

1. 共享模块：`send-delay.mjs` + `typing-session.mjs` + 单测。
2. 断链修复：`channelConfig` 转发 + `createHumanizeProvider` helper + 8 个 production 文件（含 whatsapp/slack 补组装）+ 死字段/注释清理 + host 回归测试反转。
3. `BotWorkspaceStore` `humanize` 段 + 共享 RPC + per-bot 校验链。
4. 共享桥接：阅读延迟（含 interrupt 取代）+ 段间隔 + typing 会话（三模式、action 匹配）+ 测试。
5. WhatsApp 适配器 `stopTyping`（`'paused'`）+ 删 runtime 内部循环 + 统一桥接层共享会话（8s 续期 + burst 显式灭相）+ `typingIndicator` 贯穿。
6. 五个自有桥接（含微信 typing 起点迁移、QQ 中间件替换为自管会话、钉钉/企微 `#streaming` 接通、企微 `#sendImmediate`）+ 各自测试（六桥接 supersede 回归）。
7. 客户端 UI（全局区块 + `BotSendDelayEditor` ×9）+ i18n + UI 测试。
8. README（中英）+ CHANGELOG + 真机验收清单执行。

## 10. 风险与开放问题

- **参数面刻意丰富（用户明确要求探索空间）**：阅读延迟 7 参数 + 分段间隔 4 参数 + burst 4 参数是有意为之，非过度设计——全部有默认值（关闭即无痕），UI 折叠分组、README 参数手册 + 预设降低上手成本；校验器保证任意组合安全（封顶/频控兜底）。
- **burst 断续的观感风险**（cross-check 修正方向）：原 r2 担心"灭相被误读为停了"，实际数学验证方向相反——灭相若不感知平台残余则**完全不可见**（TG 残余 5s/DC 10s/WA 10s 吞掉 ≤2.5s 灭相）。r4 残余感知设计已解决可见性；剩余观感风险是**灭相偏长**（TG 可见灭 2s → 实际熄灭 7s；DC 2s → 12s——这正是真人在各平台的形态，但用户可能预期"更快的闪烁"）。真机验收项 1/2 录屏定夺；观感不佳则调大默认 `typingBurst.off*`（更稀疏的思考停顿）或默认降 `'continuous'`。
- **发现并顺带修复的三个现存 bug**（cross-check 贡献）：① WhatsApp 20s 刷新 > ~10s presence 有效期（指示器间隙熄灭）；② WhatsApp 无发送的回合终止 → composing 无限续跑（`#stopTyping` 私有且只在发送路径调用）；③ QQ 中间件 50s keepalive 从未生效（SDK emit await handler + runtime 不 await 任务）→ 现状 QQ 长生成 >60s 指示器消失。均写入测试回归。
- **QQ 中间件替换**：SDK 已核实暴露按目标的 `bot.sendTyping(target, durationSec)`（C2C only，内部即 `msg_type=6` input-notify，中间件本身就是循环调用它）——自管会话方案**可行无妥协**：runtime 暴露 `sendTyping(replyTarget)` 包装，桥接以 50s 续期会话调用，起点随阅读延迟。
- **Discord 官方口径**：本场景属被点名例外，续期克制（5s）；异常限速则退化只做延迟。
- **企微非流式路径**：`#sendImmediate` 被动优先规避主动频控；实施前补查频控口径，异常则回退 `#sendActive` 主路径并记录。
- **`workspaces.json` 可选段**：版本保持 3，无破坏性迁移（entry 级容错）。
- **messageBreak 工具全局闸门**：v1 per-bot 只开 `sendDelay`；后续开放 per-bot `messageBreak` 需惰性注册策略。
- 已决策（对齐确认 + cross-check 修正采纳）：全局默认 + per-bot 覆盖；typing 默认 `'burst'`（残余感知灭相修复可见性后保留 burst 默认——用户"断续"语义的直接实现，真机验收若观感差可调）；钉钉/企微死字段本期接通；Telegram action 匹配纳入本期；burst 残余感知灭相（r4）；supersede 静默分支 + pre-ask 全窗口控制器 + `/stop` abort 延迟（r4）；WA 统一共享会话 + 公开 stopTyping（r4）；QQ 中间件替换定案（SDK `bot.sendTyping` 已核实，无 fallback）（r4）；微信/QQ markSeen 前移（r4）。
- 开放问题（auto_human 定夺）：burst 可见灭相节奏默认值（现 1.5–4s 可见 + 平台残余）；中文移动端打字速度等数据缺口是否自采日志；queue 模式第 2..n 条排队消息是否做 idle-gap 递减（v2 候选）。
- cross-check 已解决原开放项：灭相可见性（残余感知设计）；supersede 竞态（JS 事件循环下不可达，相位标记同步切换即可）；群聊 supersede（与现状一致，文档明示）。
