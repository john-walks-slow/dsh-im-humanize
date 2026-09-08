# 260908 拟人化发送延迟与输入状态 — 实施总结

状态：实施完成 + 检视修复完成（P0×4 / P1×3 / P2 测试缺口全部闭环），待用户验证（见 `260908-humanize-send-delay-typing.validation.md`）。
计划：`260908-humanize-send-delay-typing.plan.md`（r5，auto_human 批准）；检视：`260908-humanize-send-delay-typing.review.md`（有条件通过 → 修复记录见文末"检视修复"）。

## 交付内容

### 1. 两阶段模型（核心语义）

- **阶段① 阅读延迟**（"过了一段时间才读到消息"）：回合开头、harness ask 之前的静默期。`uniform(minMs,maxMs)` + 可选用户消息长度阅读项（`charsPerSecond`）+ 可选闲置加成（`idleBoost.afterMs/multiplier`），受 `maxTotalMs` 与 `channelCapMs` 封顶；无输入状态接口渠道封顶 `SHORT_DELAY_CAP_MS=5000`。
- **阶段② compose**：延迟结束后开始。输入状态指示（off/continuous/burst）与分段间隔（`segmentGap`，"正在打下一条"）属于此阶段。
- **supersede 语义**：pre-ask AbortController 覆盖 延迟 + 图片 staging + 流打开，无条件生效（不依赖 sendDelay.enabled）。被取代回合 `code='superseded'` → 静默（无生成、无发送、无失败提示、无双回复）。interrupt 分支先 abort 再入队新回合；`/stop` 在 stopActiveTurn 失败时回退 abortPreAsk。与批量输入交互：superseded → `fail()`（保留 `/send` 重试），turn-stopped → `complete()`。

### 2. 共享模块（src/channels/shared/）

| 模块 | 职责 |
| --- | --- |
| `send-delay.mjs`（新） | 默认配置、normalize/validate/requireComplete、`applyReadDelay`/`applySegmentGap`/`abortableSleep`、`SHORT_DELAY_CAP_MS`、全局/按机器人合并 |
| `typing-session.mjs`（新） | `createTypingSession`（start/pause/resume/restartOn/stop），burst 模式实际暗间隔 |
| `humanize-resolver.mjs`（新） | `resolveHumanizeSettings`：provider 活读取 + 构造器快照回退 |
| `humanize-override.mjs`（新） | 按机器人覆盖段 normalize/strict-validate、`bot.humanize.set` 端点 |
| `humanize-settings.mjs` | 全局 store + `humanize.get/set` RPC handler + strict validate |
| `text-harness-bridge.mjs` | TG/DC/Slack/WA 共享桥接：两阶段管线 + supersede + batch 语义 + 流式首轮成功后早停 |
| `workspace-session.mjs` / `batch-input.mjs` / `control-command.mjs` | `askInWorkspaceSession`、batch complete/fail、`abortPreAsk` 选项与 `/stop` 回退文案 |
| `bot-workspace-store.mjs` | workspaces.json `humanize` 段持久化（整段替换语义）+ `decorateStatus` 每机器人 `humanize` + `updateHumanize` |

### 3. 渠道接入（九渠道，office 除外）

| 渠道 | 接入方式 | typing 能力 |
| --- | --- | --- |
| Telegram / Discord / Slack / WhatsApp | 共享桥接（WA stopTyping 公开化、删除内部循环） | TG/DC/WA 三档全支持；Slack 无 API → 封顶 5s |
| 微信 | 自有桥接同构接入：markSeen 前移至延迟前、票据起点=延迟结束、`#pauseTypingForPending` | 票据型，断续受限 → continuous-only |
| QQ | 自有桥接 + 移除 SDK typingIndicator 中间件（原本失效：SDK await 处理器而 runtime 不 await），桥内自管理 C2C 会话 55s/50s 续期 | 仅私聊（C2C）；群聊封顶 5s |
| 企业微信 / 钉钉 / 飞书 | 自有桥接同构接入；钉钉/企微接通 `#streaming`（false 时一次性发送） | 无 API → 封顶 5s |

### 4. 客户端

- **全局面板**（`humanize-settings.js`）：发送延迟区块**全参数面**（启用 + 阅读延迟 min/max + 阅读速度字/秒 + 单回合封顶 + 闲置加成 闲置≥分钟→延迟×N + 分段间隔 min/max + 分段打字速度/封顶）+ 折叠的"断续节奏高级参数"（亮/灭 on/off 四档毫秒）+ **探索预设**下拉（轻拟人/慢性子/沉浸角色扮演/即刻应答，一键填充全参数）+ 输入状态三选 + 两阶段/累积/封顶提示 + 按机器人覆盖指引。
- **BotSendDelayEditor**（新，`channels/shared/bot-send-delay.js`）：折叠行 + 跟随全局/自定义覆盖 + **全字段草稿**（10 字段：enabled/readMin/readMax/readCps/readCap/idleAfter/idleMult/gapMin/gapMax/gapCps/gapCap）+ **预填当前生效全局值**（`sendDelayDefaults` 快照级透传，非出厂默认）+ **脏状态守卫**（未保存草稿在 15s 轮询刷新下保留，对齐 ContextEnhancementEditor 约定）+ 秒↔毫秒换算 + 范围校验（min≤max、封顶≥上限、cps≤1000、闲置≤1440 分钟、倍数≤10）+ 保存时**保留其他覆盖键**（整段替换语义）+ 渠道能力提示。挂载九渠道机器人卡片。
- **API 层**：`bot.humanize.set` 端点 + 快照 `humanize`（按机器人）与 `humanizeDefaults.sendDelay`（快照级，供编辑器预填）透传（token-api + 六个自有渠道 api.js）。
- **i18n**：新增 EN 字典条目 + `translateDynamic` 插值模式（`请填写X。`/`X不能超过 N 秒。`/`已覆盖 a–b 秒`）。
- **verify-package.mjs**：checkable-input 清单改为按审计源文件动态求和（新增字段只需更新清单一处）。

### 5. 测试（全部新增/适配）

- 单元：`send-delay.test.mjs`（16）、`typing-session.test.mjs`（15，含预中止 signal start() 不抛）、`humanize-settings.test.mjs`（6）、`humanize-override.test.mjs`（15，含全局基继承）。
- 共享桥接：`humanize-bridge.test.mjs`（13：延迟顺序、禁用零变化、supersede、`/stop`、流式早停、段间隔+restartOn、交互暂停/恢复、错误回合熄灭、无 typing 封顶、queue/steer 不取代、附件 action 重启、batch×supersede 回退 collecting）。
- 自有渠道：`test/channels/qq/humanize.test.mjs`（5）、`test/channels/shared/humanize-standalone-bridges.test.mjs`（12：weixin 延迟/supersede/pending 暂停恢复、dingtalk 延迟/频控下限 3s/一次性发送/supersede、wecom 延迟/一次性发送/supersede、feishu 延迟/supersede）。
- UI：`test/client-humanize-ui.test.mjs`（8：全局面板、编辑器完整保存/保留键/清除、校验、能力提示、快照 humanize+humanizeDefaults 透传、轮询刷新不清草稿、全局预填）。
- 测试约定：凡涉及 unref'd 定时器的测试必须 `withKeepAlive` 包裹，否则事件循环提前排空。

## 关键发现与修复（副产物）

1. **QQ `messageBreakHandler` ReferenceError（基线缺陷）**：内层 try 里的 `const` 声明在外层被引用 → 任何成功回合启用 message_break 即抛错并误报"任务未完成"。此前的 4 个"基线失败"实为该缺陷。修复后全仓 0 失败。
2. **supersede × batch 死锁**：原实现只让 turn-stopped 完成批次，superseded 批次卡死在 submitting → 改为 superseded 也走 `fail()`（保留重试）。
3. **QQ SDK typing 中间件失效**：SDK 等待处理器返回而 runtime 不 await 任务 → keepalive 从不执行。整段移除，桥内自管理。
4. **verify-package checkable 清单**：从硬编码计数（新增 checkbox 必然炸构建）改为源文件动态求和。

## 验证与回归

- 全量 `node --test`：2462 tests，fail=0，cancelled=200（discord/feishu/qq 等桥接测试因 fixture 缺 keep-alive 被连锁取消，worktree 基线对照：基线同为 200 个、分布逐文件一致、另有 4 个真实失败已由本次修复——零新增；node --test 将 cancelled 计入非零退出码，故 `npm run check` exit 1 属**预置测试基建问题**，非本功能引入。修复建议：给既有桥接测试 fixture 补 `withKeepAlive`（本次新测试均已遵守该约定），建议单独立项）。
- `node scripts/verify-package.mjs`：通过。`npm run build`：产出 lib/。
- 回归红线：`sendDelay.enabled=false` 时除 supersede 双回复修复外零行为变化（共享桥接与五个自有桥接均有禁用路径测试锁定）。
- 已知缺口（计划 §4.2 明示）：deferred 补发不做延迟（异常恢复路径）；不做按回复长度延迟项；不做微信/QQ burst；`typingIndicator`/`streaming` 等不做 per-bot UI（数据模型已支持，v1 只开 sendDelay）。

## 用户验证

见 `260908-humanize-send-delay-typing.validation.md`（16 项，覆盖静默体感、supersede、断续节奏、渠道封顶、按机器人覆盖、排队累积、idleBoost、英文界面）。

## 检视修复（review.md 有条件通过 → 闭环）

检视结论：4 个 P0 缺陷 + 3 个 P1 + 若干 P2/P3。全部 P0/P1 与 P2 测试缺口已修复；P2/P3 非阻塞项按裁决记录如下。

### P0（全部修复）

| # | 缺陷 | 修复 | 测试 |
| --- | --- | --- | --- |
| 1 | `typing-session.mjs` 预中止 signal 下 `start()` 调用不存在的 `stop()` → ReferenceError，会话僵尸（QQ 未 await start 会崩进程） | `stopSession()` + QQ 桥接 `await typingSession.start()` | `typing-session.test.mjs` 预中止 start() 不抛且非 active |
| 2 | 微信 `#resumeTyping` 在 target 匹配时经 `#startTyping` 早退，不重挂 keepalive → pending 交互后指示灯熄灭至回合结束 | `#refreshTyping()`（立即补发 status:1 + 重挂循环；失败弃 target/ticket 走全量重启并设重试退避）；`#pauseTypingForPending` 显式 `#typingPaused` 标记，**仅暂停态恢复补发**——活态冗余 resume（每次流式更新/带外通知）保持 no-op，不产生额外 status:1 | 独立桥接 weixin pending 暂停/恢复重挂用例 + 既有"out-of-band race"回归（该回归曾捕获初版修复引入的冗余补发缺陷） |
| 3 | `BotSendDelayEditor` 的 `useEffect([current])` 在 15s 轮询新对象身份下回滚未保存草稿 | `dirty` 状态守卫（保存成功后重新同步），对齐 ContextEnhancementDialog 约定 | UI 测试"轮询刷新不清未保存草稿"（含模式切换存活 + 保存后重同步） |
| 4 | 钉钉 webhook 默认分段间隔 0.5–2s ≈ 48 条/分钟，超 20 条/分钟平台频控（封禁 10 分钟） | `DINGTALK_MIN_SEGMENT_GAP_MS=3000` 传入 `applySegmentGap` | 独立桥接钉钉分段间隔 ≥2900ms 断言 |

### P1（全部修复）

- **微信档位矛盾**（§2.1）：host 端移除 `channelCapMs: SHORT_DELAY_CAP_MS`，微信改长档（有票据指示可解释全程等待，与客户端 TYPING_CAPABILITY.full 一致）。
- **per-bot 预填与写回继承**（§2.3）：host `validateHumanizeOverrideSection(value, {sendDelayBase})` 写时继承未显式给出的 sendDelay 子字段（显式键优先）；`createWorkspaceAwareController` 快照投影 `humanizeDefaults.sendDelay`（九渠道 production 接线）；客户端快照级透传 + 编辑器 `sendDelayDefaults` 预填。用户自定义全局（如 30–60s）后，per-bot 覆盖不再静默回落出厂默认。
- **全局面板参数面**（§2.2）：补齐 charsPerSecond/maxTotalMs/idleBoost/typingBurst 四档毫秒 + 四个探索预设（计划 §7.1/§5.1）。

### P2 测试缺口（全部补齐）

queue/steer 不取代（顺序 + 双回复）、batch×supersede（superseded → fail() 回 collecting，/send 可重试）、企微/钉钉 streaming=false（企微无占位流 + 单发 finish=true；钉钉不开卡片 + webhook 单发）、附件 action 重启（upload_photo/upload_document，经真实 artifact registry）。

### P2/P3 已裁决不实施（留痕）

- 段间 `restartOn` 顺序（§2.5d）：**已修**为 restartOn → sleep → send（三桥接），消除最后一段后的 trailing glow（TG/DC 无取消 API 残留 5–10s）。
- `messageBreak` 构造默认 `true` 对齐（§2.5b）：六桥接仍默认 false（生产经 provider 不受影响），留待后续统一。
- 两处"mutually exclusive"陈旧注释（§2.5c）：留待后续清理。
- `#turnEnds` 无界增长（§5.3）：单 key 一条时间戳，量级可忽略。
- 飞书 `#answerWithStepPush` 用构造快照 `this.#messageBreak` 而非本回合设置（§2.5 尾）：与流式路径 live 语义不一致，留待后续统一。
- 微信图片 staging 在 pre-ask 窗口外、企微 replyStream 在窗口外（§3.1/§3.2）：低风险（需图片 + 长延迟 + 精确时机竞争），留痕不修。
- idle 语义 = 上一回合结束时间（计划公式为 lastActivityAt）：实现更保守（接受，已裁决）。
- 全局 RPC `sendDelay` 顶层键整段替换（`humanize.set({sendDelay: 部分字段})` 会重置其余子字段为出厂默认）：当前 UI 恒发完整对象故无实害，RPC 契约层面已在 `validateSendDelayConfig` 注释与本节留痕。
- whatsapp/streaming.test.mjs burst 顺序注释轻微失实、`humanizeFor` 浅拷贝注释精确化：留待后续。

### 检视期间引入又修复的回归（留痕）

微信 `#resumeTyping` 初版修复（匹配 target 一律 `#refreshTyping()`）被既有用例"Weixin restarts typing when an out-of-band notice races an in-flight keepalive"捕获：活态指示下的冗余 resume 会额外补发 status:1（每次流式更新都会命中）。终版以显式 `#typingPaused` 标记区分"暂停后恢复"（补发）与"活态冗余"（no-op），两个语义均有测试锁定。
