# 拟人化两阶段发送 — 代码评审（review）

日期：2026-09-08 ｜ 基线：`51a0bc3`（工作区未提交改动，85 个文件：69 M + 16 新增）｜ 计划：r5（`260908-humanize-send-delay-typing.plan.md`）

**结论：有条件通过（需修复 4 个缺陷后方可合入）。** 架构与计划高度吻合：两阶段模型、supersede 管线、整段替换数据模型、九渠道接线、断链修复全部落地，78 个新测试全部通过，`enabled=false` 红线总体守住了。但存在 2 个功能正确性 bug（typing-session 预中止 ReferenceError、微信 pause 后 resume 断链）、1 个 UI 状态 bug（per-bot 编辑器草稿被 15s 轮询周期性重置）、1 个平台安全缺失（钉钉段间隔无 3s 频控下限），以及若干计划符合度偏差（微信短档 vs 计划长档、全局面板参数面大幅缩水、`idle` 语义从"最近活动"改为"最近回合结束"）。另有 1 个重要事实必须指出：**`npm run check` 当前不通过**（exit 1），原因是 200 个预置 cancelled 测试（基线同样不通过，非本次引入，但计划的完成标准 §4.3 客观上未满足）。

---

## 1. 阻塞级问题（合入前必须修复）

### 1.1 `typing-session.mjs:304` — `start()` 引用未定义标识符 `stop`，预中止信号下抛 ReferenceError

```js
if (signal?.aborted) {
  stop();          // ← ReferenceError: stop is not defined
  return;
}
```

`stop` 不是词法作用域内的任何变量（会话对象属性不会成为标识符）。已实测复现：向 `createTypingSession` 传入已 abort 的 signal 调 `start()` → 抛 `ReferenceError: stop is not defined`，且会话卡在 `running=true`、`isActive()===true` 的僵尸态（无定时器、无监听器）。

- 触发窗口：桥接 signal（插件停机）恰好在 `applyReadDelay` resolve 与 `start()` 之间的微任务边界 abort。共享桥接里 `await typingSession.start()` 的异常会落入 `#process` 的 `this.#signal?.aborted` 分支被吞掉，损害有限；
- **QQ 桥接放大为进程级风险**：`qq-bridge.mjs:1169` 的 `typingSession.start()` **未 await**（对比共享桥接 `text-harness-bridge.mjs:893` 有 await），ReferenceError 成为未处理拒绝——本仓库 plugin-src/host 无 `unhandledRejection` 处理器，Node 默认行为是进程崩溃。
- 修复：改为 `stopSession()`；QQ 侧改为 `await typingSession.start()`（或至少 `.catch()`）。

### 1.2 微信 pause 后 resume 断链 — pending 交互后输入指示器整回合死亡

新增的 `#pauseTypingForPending()`（`weixin-bridge.mjs:1656`）只做 `#clearTypingTimer()`，**保留** `#typingTarget`；而恢复路径 `onInteractionResolved → #resumeTyping → #startTyping` 命中预置早退分支 `if (this.#typingTarget === target) return true;`（`weixin-bridge.mjs:1529`）——**不重新调度 keepalive 定时器**（`#scheduleTyping` 只在完整路径执行）。结果：pending 提问/审批一旦出现，微信"正在输入"在暂停后永久熄灭（本回合内所有 `onUpdate`/`sendSegment` 触发的 `#resumeTyping` 同样早退，救不回来），直到回合结束 `#stopTyping()` 清空 target、下一回合才恢复。

计划 §4.1.6 的原意是"修复现状微信 pending 期间 scheduleTyping 定时器仍在跳"——修过了头：从"暂停失效"变成"暂停后无法恢复"。新测试 `humanize-standalone-bridges.test.mjs` 只覆盖微信 delay+supersede，没有 pending 用例（QQ 的 pause/resume 测试通过是因为 QQ 走共享 typing-session），该缺口恰好掩盖了此 bug。修复建议：`#resumeTyping` 在 target 匹配时也重挂定时器（如 `#scheduleTyping(this.#typingGeneration)`），并补微信 pending 用例。

### 1.3 per-bot 编辑器草稿被 15 秒轮询周期性重置（九渠道全量受影响）

`BotSendDelayEditor`（`bot-send-delay.js:137-140`）：

```js
React.useEffect(() => {
  setMode(current ? 'override' : 'follow');
  setDraft(draftFromConfig(current ?? DEFAULT_SEND_DELAY_CONFIG));
}, [current]);
```

`token-channel.js` 每 15 秒 `loadStatus({silent:true})` 刷新快照；只要机器人**已存在覆盖**，`normalizeHumanizeOverride` 每次都产生新对象身份 → `current` 身份变化 → effect 每 15 秒触发一次，把用户**未保存的模式切换（如刚点了"跟随全局"）和正在编辑的字段值整体回滚**。同库的 `ContextEnhancementEditor` 明确有防回归约定（`context-enhancement.js:192`："A mounted dialog owns its draft; status refreshes must not replace unsaved edits"），新编辑器没有遵循。保存后快照刷新的意图是对的，但需要脏状态守卫（dirty 时不重置 / 按值比较 / 仅在非编辑态 resync）。`client-humanize-ui.test.mjs` 未模拟轮询刷新，故未测出。

### 1.4 钉钉 message_break 段间隔缺少 ≥3s 频控下限 — 平台封禁风险

计划 §1.10 / §4.1 明确要求："钉钉 webhook 20 条/min → 段间 ≥3s……实现为各桥接 `minSegmentGapMs` 下限与随机段间隔取 max"。实现中 Telegram 通过 `TELEGRAM_DESCRIPTOR.minSegmentGapMs = 1000` 落地了，但 **`dingtalk-bridge.mjs` 的 `sendSegment` 调 `applySegmentGap` 时没有传任何 `minSegmentGapMs`**。默认 segmentGap 为 0.5–2s 随机（平均 ~1.25s ≈ 48 条/min），加上收尾消息轻松突破 20 条/min webhook 限速——按计划调研该渠道超限封禁 10 分钟。注意这不是"回归"而是"计划要求的安全护栏缺失"，且钉钉桥接自己的新测试没有覆盖段间隔频控。修复：钉钉 `sendSegment` 传 `minSegmentGapMs: 3000`（建议同时为 descriptor 常量化）。

---

## 2. 计划符合度偏差（应逐项裁决：改实现 or 改计划）

### 2.1 微信阅读延迟被封顶 5s（计划：长档）— 且与客户端能力提示自相矛盾

计划 §6.2 档位表明确：微信 = **长档**（有票据 typing，§1.9 把微信列进"有原生 typing 的渠道执行完整配置延迟"）。实现却传 `channelCapMs: SHORT_DELAY_CAP_MS`（`weixin-bridge.mjs:935-939`，注释理由："ticket-based; a long dead silence would look broken"）。该理由同样适用于被划为长档的 TG/DC/WA（它们的延迟期同样完全静默，靠随后 typing"解释"整段等待），不足以构成偏离依据。更糟的是客户端微信卡传 `TYPING_CAPABILITY.full`（`weixin/index.js:282`），不显示"封顶 5 秒"提示——用户设 30s 全局延迟，微信端被静默截到 5s 且无任何 UI 说明。要么按计划放开微信为长档，要么（若确有票据时效顾虑）把微信客户端提示改为短档说明并在计划中记录裁决。

### 2.2 全局面板参数面大幅缩水（计划 §7.1 的"参数空间刻意丰富"未交付 UI）

计划 §1（用户明确希望探索不同配置）+ §7.1 要求全局面板包含：阅读速度（charsPerSecond）、单回合封顶（maxTotalMs）、闲置加成两子参数、分段打字速度、分段封顶、折叠的 burst 四参数（亮相/灭相 min/max）、探索预设下拉。实现只交付：启用开关 + 阅读延迟 min/max + 分段间隔 min/max + 输入状态三选（`humanize-settings.js`）。约 10 个计划内参数只能手改 `humanize.json`（README 已如实说明这一点，算诚实降级，但与"UI 折叠分组、README 参数手册 + 预设降低上手成本"的批准方案不符）。per-bot 编辑器同理（见 2.3）。这是本次最大的功能性缩水，建议要么补齐字段，要么把缩水决定回写计划留痕。

### 2.3 per-bot 编辑器未"预填全局默认"，且写回对象缺省字段回落到出厂默认而非全局值

计划 §5.2/§7.2："override 态显示同字段组（**预填全局默认作编辑起点**，完整配置整体保存）"。实现：

- 编辑器根本不接收全局设置，无覆盖时预填 `DEFAULT_SEND_DELAY_CONFIG`（出厂值 1–6s）。用户全局已设 30–60s，打开某机器人覆盖，看到的是 1–6s——直接保存会得到一个基于出厂值的覆盖，极易设错。
- 提交的 `readDelay` 只含 `{minMs, maxMs}`，`normalizeSendDelayConfig` 会把 `charsPerSecond=0 / maxTotalMs=30000 / idleBoost={10min,×2}` 用**出厂默认**补齐——不是继承全局面板值。若全局 maxTotalMs=60000，per-bot 覆盖静默降到 30000。
- 校验没有复用共享 `validateSendDelayConfig`（计划 §7.2），是编辑器内自写的一套 `parseSeconds`（行为等价，但双份维护）。

### 2.4 idle 加成语义偏离：`lastActivityAt`（入站+出站取大）→ `#turnEnds`（最近回合结束）

计划 §5.3："会话最近活动 = 该会话最近一次**入站或出站**消息时间（桥接维护 lastActivityAt，取两个方向较大者）"。实现为六个桥接各自的 `#turnEnds`（回合 finally 时间戳）：入站消息不更新、主动投递不更新、fast command 不更新。多数场景等价，但"用户隔 30 分钟连发两条消息（间隔 5s）"时，第二条按计划应判定为"人已在线"（无加成）、按实现同样无加成（回合刚结束）——这个例子恰好一致；不一致的是"bot 主动投递后 30s 用户回复"：计划语义 idle=30s（不加成），实现可能命中数小时前的 turnEnd（加成）。语义可辩护（"人刚说完话"），但与批准的计算公式不符，应回写计划或改实现。另注意 superseded 回合的 finally 也写 `#turnEnds`（无出站也算"活动"，语义混杂）。

### 2.5 其余符合度偏差（小项，列表）

| # | 项 | 计划 | 实现 |
|---|---|---|---|
| a | 钉钉/企微 `streaming=false` 一次性发送 | §4.1.7 | 代码已实现（企微 `#sendImmediate` 被动优先 ✓ 钉钉跳过卡片 ✓），但**零测试**（计划 §8.1 明确要求"企微断言 #sendImmediate 被动路径"） |
| b | `messageBreak` 构造默认对齐 `true` | §4.1.7 | 未做——六桥接仍是 `messageBreak = false`，与 `DEFAULT_HUMANIZE_SETTINGS.messageBreak=true` 漂移依旧（生产路径经 provider 不受影响，仅测试/嵌入式受影响） |
| c | 陈旧注释清理 | §4.1.7 | `message-break.mjs` 头部"streaming is automatically disabled (mutually exclusive)"未清（2a29d25 起已可共存）；且**新代码里又复制了一份**过时注释——`text-harness-bridge.mjs` 阶段②处"Streaming is skipped when streaming=false or messageBreak=true (mutually exclusive)"与紧随其后的 `if (humanize.streaming)` 自相矛盾 |
| d | 段间 `restartOn` 顺序 | §6.2"restartOn → sleep → send" | 实现为 sleep → send → restartOn。间隙覆盖效果等价（上一段的 restartOn 恰好覆盖下一段间隙），但**最后一段之后的 trailing restartOn 会在无后续消息时重新点亮指示器**：TG/DC 无取消 API，stop() 后平台残余继续亮 ~5–10s 才熄灭（"打完了字却没发消息"）；若答案恰好在 break 点结束（remaining text 为空、无收尾消息），观感缺陷成真。WeChat 的 `#resumeTyping` 在段后同样有此模式 |
| e | Telegram 附件 action 匹配 | §4.1.6/§8.1 | 代码已实现（`telegram-api.mjs` action 白名单 + `onArtifact → restartOn('upload_photo'/'upload_document')`），但无桥接级测试（仅 typing-session 单测验证 action 透传） |
| f | WhatsApp burst 协议不稳回退 | §8.3.3 判据 | 无任何自动/半自动回退机制（默认 burst + 显式 paused 高频翻转）。按计划措辞属真机验收判据，可接受，但需在验收清单中保留 |
| g | 测试缺口（对照 §8.1 清单） | — | 未覆盖：queue/steer 不取代；旁路发送不灭会话；**batch × supersede**（fail 保留 /send 重试——任务描述点名的语义）；微信块间 resumeTyping/段间隔/pending 暂停；QQ 50s 续期只有参数断言（55s/50s）无时序断言；多 target 键控（typing-session 单测无） |

### 2.6 符合度良好的部分（抽核确认）

- **supersede 管线**：pre-ask 控制器覆盖 延迟+开流+图片staging（共享桥接/QQ/wecom/dingtalk/feishu ✓；微信 staging 在窗口外，见 §3.2）；相位标记同步切换；interrupt 无条件 abort + fireAndForgetStop；`code='superseded'` 六桥接静默分支齐全；batch 语义 superseded→fail()（保留 /send 重试）、turn-stopped→complete 在共享桥接与 QQ 均正确；
- **残余感知 burst 状态机**：无取消 API 渠道在 ON→OFF 切换时补发最终刷新并以 `可见灭相+darkResidualMs` 计时（TG 4s/5s、DC 5s/10s），有 stopTyping 渠道（WA）灭相起点显式 paused、residual=0——与计划 §6.3 数学一致；灭相从最后一次 sendTyping 起算的要求经"最终刷新"达成；
- **数据模型**：全局 `humanize.json` 六键 + 原子写（tmp+rename+0o600）✓；`workspaces.json` humanize 段文档版本保持 3、entry 级容错、段空不落盘 ✓；整段替换语义（`mergeHumanizeSettings` 顶层键替换）✓；`bot.humanize.set` 九渠道再导出 ✓；`humanizeFor` 冻结副本（浅拷贝，嵌套对象未深拷——与 contextEnhancementFor 同水位，resolver 会再归一，可接受）；
- **断链修复**：`channelConfig` 六键转发 + 渠道子对象优先 + `humanizeDefaults` 活访问器 ✓；whatsapp/slack production 补组装 ✓（host.test.mjs 断言九渠道）；`humanize-rpc.mjs` dshHome 修复 ✓；
- **QQ 中间件替换**：SDK `typingIndicator` 中间件移除（含 predicate/evaluateInboundAccess 清理），自管会话 55s/50s，群聊不启动 ✓；`messageBreakHandler` 作用域 ReferenceError 基线修复（外提为 `let`）✓；
- **回归红线**：`enabled=false` 时 `applyReadDelay/applySegmentGap` 立即 skip，命令/审批/错误/deferred/主动投递路径全部在延迟之前返回；既有顺序断言测试按计划钉 `typingIndicator:'off'`（text-harness-bridge / whatsapp streaming）✓；基线 4 个失败测试被修复，cancelled 零新增（见 §4）。typing 默认 `'burst'` 的独立行为变化与 §8.2 声明一致；
- **秒↔毫秒换算**：`parseSeconds`（×1000 取整）与 `secondsOf`（÷1000）往返无损；`min(...,maxTotalMs)` 与 `channelCapMs` 的次序正确（渠道封顶最后生效）；频控下限在 `computeSegmentGapMs` 中 `max(capped, floor)` 优先于封顶 ✓。

---

## 3. 正确性细察（按任务要求的专项）

### 3.1 supersede 竞态

- 共享桥接在 openStream 与 staging 之间设了显式 `preAsk.signal.aborted` 复查 + staging 使用 `preAskSignal`，sleep resolve 到控制器删除之间为同步微任务链，无交错窗口——JS 单线程下完备；
- `#interruptAndResend` 先 abort 再链队（新 #process 在旧任务 settle 后执行），无双跑；
- **残余竞态（低危，记录即可）**：`#process` 开头 `await markSeen`（磁盘写）期间控制器尚未创建，此窗口内 interrupt/`/stop` 的 `abortPreAsk` 返回 false → "当前聊天没有正在运行的任务"，随后消息照常延迟处理。窗口为毫秒级。类似地微信 `#startTyping`（网络 I/O）与企微 `replyStream` 在控制器删除之后执行，落在其中的 interrupt 退回旧行为（双回复）——计划 §1.8 要求窗口覆盖到 openStream，企微未完全做到（其 staging 在窗口内 ✓，开流在外）。
- **微信 staging 完全在窗口外**（`promptContentForInboundMessage` 用 `this.#signal` 且控制器已删）——图片消息 staging 期间 interrupt 仍会双回复，六桥接中唯一未兑现"staging 入窗"的。

### 3.2 timer 泄漏 / unref / 事件循环

- `abortableSleep` 与 typing-session 定时器均 unref + abort 清理 ✓；会话 stop() 幂等（`if (!running)` 早退）✓；
- `#turnEnds` / `#preAskControllers` 六桥接各一份 Map：后者每回合清理 ✓，**前者只增不减**（连 `remove()` 也不清），长寿命多会话场景为无界缓增（每会话一个 number，量级小，但与 `#queues` 一样属无界 Map，建议顺手治理或在 remove 时清理）；
- QQ `typingSession.start()` 未 await（见 §1.1）；`sendSegment` 内 `typingSession?.restartOn()` / weixin `#resumeTyping` 在 onUpdate 里 fire-and-forget——`#startTyping` 内部有 catch、`restartOn` 内部 `fire` 有 catch，无未处理拒绝（除 §1.1 的 start 路径）。

### 3.3 abort 信号传播

- `AbortSignal.any([bridgeSignal, preAskSignal])` 组合正确；停机时落入 `#signal?.aborted` 静默分支（与 superseded 分支区分正确：superseded 判据是 `preAsk.signal.aborted` 而非 error.code，对 staging 抛出的任意 AbortError 形态均稳健）✓；
- 段间隔用 `this.#signal`（post-ask，正确——supersede 窗口已闭）；typing 会话绑定 `this.#signal`（停机自动清理 + WA 显式 paused）✓。

### 3.4 UI 状态同步

- 保存 → `botAction` → 返回快照 `normalizeSnapshot` → `setModel` → 编辑器 `useEffect([current])` resync：链路正确（但被 §1.3 的轮询问题劫持）；
- 全局面板 save 发送整个 settings（含未在 UI 暴露的 charsPerSecond 等），服务端按顶层键合并，未暴露字段不丢 ✓。注意 `HumanizeSettingsStore.update` 是**顶层键粒度**合并：`humanize.set({sendDelay:{enabled:true}})` 会把 readDelay/segmentGap 重置为出厂默认（`validateSendDelayConfig` 的注释"the global store merges partial updates"有误导性）——当前 UI 总是发完整对象所以无实害，但 RPC 契约上是个坑，建议文档化或改为 sendDelay 深合并。

---

## 4. 测试与门禁状态（重要事实）

- **新增 78 测试全部通过**（send-delay 16 / typing-session 14 / humanize-bridge 9 / humanize-override 14 / humanize-settings 6 / client-humanize-ui 6 / qq-humanize 5 / standalone-bridges 8）；`verify-package.mjs` 通过；host.test.mjs 传播回归（含 whatsapp/slack）已按计划落地；
- **`npm test` exit 1 → `npm run check` exit 1**：TAP 汇总写 `fail 0` 但有 **200 个 `cancelledByParent`**（"Promise resolution is still pending but the event loop has already resolved"），node:test 将 cancelled 计入非零退出码。**经基线 worktree 对照：基线同为 200 个 cancelled、分布逐文件一致、另有 4 个真实 fail（本次修复）**——即该问题为预置测试基建缺陷（wecom 52 / qq 49 / discord 29 / telegram 24 / slack 16 / feishu 12 / weixin 9……的桥接测试整个文件因首个测试排干事件循环而连锁取消），**非本次引入、零新增**。新测试用 `withKeepAlive`（ref'd interval）规避了同类问题——这个模式正是旧测试缺的。但必须明确：**计划 §4.3 "npm run check 通过"当前不成立**，且 200 个被取消的测试里包含大量桥接回归资产（QQ/wecom/telegram/discord/slack 的既有桥接测试实际没有在断言任何东西）。建议本次顺手修复（给既有桥接测试 fixture 加 keep-alive）或单独立项，至少在 summary/validation 文档中如实记录门禁状态。

---

## 5. 次要问题与风格（不阻塞）

1. **缩进错位**：`telegram-bridge.mjs`、`discord-bridge.mjs`、`whatsapp-bridge.mjs` 的 descriptor 中新增 `typing:` 行后，`reactions:` 行被多缩进 2 空格（`    reactions:`）；`qq-runtime.mjs` 桥接构造处 `humanize: this.#humanize,` 同样多缩进 2 空格。纯格式，建议顺手修。
2. `visibleLength`：代码围栏内容保留后仍会被后续 `[`*_~>#]+` 剥离（代码块内的星号/反引号被误删）——v1 启发式可接受，注释已声明，仅记录。
3. `whatsapp/streaming.test.mjs` 新注释称 burst 顺序"covered by ... the bridge burst-order test below"，但 humanize-bridge.test.mjs 并无桥接级 burst 顺序用例（只有 typing-session 单测）——注释轻微失实。
4. 飞书 `#answerWithStepPush` 的 messageBreakHandler 仍用构造快照 `this.#messageBreak` 而非本回合 `humanize.messageBreak`（`#answerWithStream` 纯文本路径已改 live）——同一桥接两条路径 live 语义不一致。
5. `#idleMsFor` 首条消息 idle=0（不加成）符合直觉，但计划公式没有这条特例——文档级差异，随 §2.4 一并裁决。
6. `humanizeFor` 的浅拷贝注释说"Returns a copy"但嵌套对象共享引用——消费端 resolver 会再归一，无实害，注释可更精确。
7. README（中英）+ CHANGELOG 已更新且质量不错：两阶段模型、supersede、排队累积、封顶 5s、渠道能力差异、配置文件全参数说明均有；缺计划 §5.1 的"探索预设"（与 §2.2 同源）。

---

## 6. 修复清单（按优先级）

| 优先级 | 项 | 动作 |
|---|---|---|
| P0 | §1.1 | `typing-session.mjs:304` `stop()` → `stopSession()`；`qq-bridge.mjs:1169` `start()` 加 await/catch；补"预中止 signal 下 start() 不抛且会话非 active"单测 |
| P0 | §1.2 | 微信 `#resumeTyping` 在 target 匹配时重挂 keepalive 定时器；补微信 pending 暂停/恢复用例 |
| P0 | §1.3 | `BotSendDelayEditor` 增加脏状态守卫（对齐 ContextEnhancementEditor 约定）；补"轮询刷新不清未保存草稿"UI 测试 |
| P0 | §1.4 | 钉钉 `sendSegment` 传 `minSegmentGapMs: 3000`；补频控下限断言 |
| P1 | §2.1 | 裁决微信档位：改长档（按计划）或改客户端提示+计划留痕 |
| P1 | §4 | `npm run check` 门禁：修复或立项修复 200 个 cancelled 测试；summary/validation 如实记录 |
| P1 | §2.3 | per-bot 编辑器预填全局设置（需把全局 humanize 传入 AccountCard）或至少在 hint 说明"按出厂默认预填" |
| P2 | §2.2 | 全局面板参数面（charsPerSecond/maxTotalMs/idleBoost/typingBurst/预设）补齐或计划留痕缩水 |
| P2 | §2.5a/e/g | 补 wecom/dingtalk streaming=false、TG 附件 action、batch×supersede、queue/steer 不取代、旁路不灭会话等用例 |
| P2 | §2.5b/c | messageBreak 构造默认对齐 true；清理两处"mutually exclusive"陈旧注释 |
| P3 | §5 | 缩进、注释失实、飞书 stepPush live 语义、`#turnEnds` 无界、全局 RPC sendDelay 顶层键替换的文档化 |

## 7. 验证方式（供复核）

- `node --test test/humanize-*.test.mjs test/send-delay.test.mjs test/typing-session.test.mjs test/channels/qq/humanize.test.mjs test/channels/shared/humanize-standalone-bridges.test.mjs test/client-humanize-ui.test.mjs` → 78 pass / 0 fail；
- §1.1 复现：`createTypingSession({sendTyping: async()=>{}, signal: AbortSignal.abort()}).start()` → ReferenceError（已实测）；
- §4 基线对照：`git worktree add` 至 `51a0bc3` + symlink node_modules + `npm run build` + `npm test` → 2371 tests / 4 fail / 200 cancelled（与变更树 2450 / 0 / 200 逐一 diff：cancelled 集合变更树零新增、4 个 base-only 已修复）；
- `npm run check` → exit 1（build ✓ → test exit 1 中断，verify-package 单独运行 ✓）。
