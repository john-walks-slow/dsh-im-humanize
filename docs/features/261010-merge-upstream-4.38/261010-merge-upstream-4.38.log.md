# 合并进度日志（rebase-upstream-4.38）

工作分支：`rebase-upstream-4.38`（基于 `v4.38.0`），worktree `.worktrees/merge-upstream-4.38`。
基线：上游 `v4.38.0` = `9353109`；fork 侧 delta 取 `f434ca0..main`。

## 批次进度

| 批次 | 内容 | 状态 |
| --- | --- | --- |
| P2-a | 元数据与构建骨架（package.json 身份/dsh 声明、删 pnpm-lock、.gitignore、README×2、CHANGELOG、AGENTS.md、cordis.patch.yml） | ✅ 完成 |
| P2-b | 共享层 `src/channels/shared/**` | ✅ 完成 |
| P2-c | host 层 `plugin-src/host/**` | ✅ 完成 |
| P2-d | 渠道层 `src/channels/<渠道>/**` | ✅ 完成 |
| P2-e | 客户端层 `plugin-src/client/**` + `scripts/verify-package.mjs`（含 R3 简化） | ✅ 完成 |
| P2-f1 | R2：人化设置字段声明式化（一张表派生全部默认值/宽松读/严格校验 + 两个面板） | ✅ 完成 |
| P2-f2 | 收敛 `onNewMessage` → `busyMessageMode`：per-bot 复用 `busyMessageModes`、`interrupt` 补成 dispatcher 第三态、删除 `new-message-policy.mjs` | ✅ 完成 |
| P2-g | 测试适配 + `npm run build` + 分层验证 | 待办 |

## 批次记录

### P2-a（元数据骨架）

- `package.json`：采用上游 4.38 结构，仅替换 fork 身份——`name` = `@johnnren/dsh-im-humanize`、`version` = `4.38.0-humanize.1`、`description`（base 改为 4.38.0）、`author`；`dsh.dsh` / `dshReleases` 直接采用上游的 `0.2.0-rc.2`（fork 旧的 0.1.x 声明作废）。
- **删除 `contributors` 字段**：上游 4.38 以 `.all-contributorsrc`（47 人）为唯一来源并生成中英文 README 名单；fork 的 package.json 里那份 14 人列表是重复且必然漂移的第二来源，故不再保留。
- **不再引入 `pnpm-lock.yaml`**：上游用 `package-lock.json`，fork 的 pnpm lock 是历史包袱（用户已批准删除）。
- `.gitignore`：上游版本 + `.mnemon/`、`.worktrees/`。
- `README.md` / `README.en.md`：上游 4.38 正文 + 重新插入 fork 的「本 Fork 的改动（拟人化）」/「This fork」章节与 GIF 呈现差异段落。
- `CHANGELOG.md`：上游 4.38 正文 + fork 的 `[Unreleased]` 拟人化条目块。
- `AGENTS.md`：fork 独有文件，整份带入并把基线改为 4.38.0。
- `cordis.patch.yml`：整份带入（仅把 bundle patch 的 id/name 换为 fork 包名）。
- `scripts/verify-package.mjs`：**暂留上游原版**，fork 的加固改动与 R3（删计数清单）一起在 P2-e 落地。

### P2-b（共享层 `src/channels/shared/**`）

工具：`/tmp/p2-apply.sh`，逐文件判定「仅 fork 改 → 整份取 main」「双方都改 → `git diff f434ca0..main | git apply --3way --index`」。本层 18 个文件：11 个整份套用、2 个三路干净落地（`control-command`、`i18n-en/shared-b`）、5 个需人工裁决（`bot-workspace-store`、`harness-client`、`injected-context`、`semantic/artifact`、`text-harness-bridge`）。

裁决记录：

1. **`injected-context.mjs` → 采用上游**（`kind: \`plugin:${plugin}\``）。fork 的 `e7928c4f`（09-28）与上游的 `d41fc71a`（09-23）各自修同一个 v4 问题：fork 用裸名 `kind: 'dsh-im'`，上游用 `plugin:dsh-im`。依据：① `dsh-session-format-v3-to-v4` 的 `producerKind()` 对未知第三方 producer 一律回落到 `plugin:<name>`；② 同生态的 `dsh-proactive` 在 `lib/framing.js` 明确使用 `"plugin:" + PROACTIVE_PLUGIN`，注释写着「exactly like the released v3-to-v4 migration rewrites historical rows」；③ 只有 `RELEASED_SAME_NAME_PRODUCERS` 白名单内的第一方 producer 才保留裸名。两者都能通过 v4 校验（只要 `kind !== 'plugin'`），但 `plugin:` 才是第三方 producer 的规范形态。fork 侧 `session-sync-coordinator` 本就同时兼容两种写法，不受影响。注释合并保留了双方的解释。
2. **`semantic/artifact.mjs` → 采用 fork 的 `as` 呈现模式文案**（`auto|file|image|animation|voice`），上游 4.38 已含 `43fd516` 的 consumer 门控，正文其余部分自动合并。
3. **`harness-client.mjs` → 双向合并终局判定逻辑**。上游的 `finalAnswer`（`finalAnswerOnly` 选项，供 QQ 等拆分长答案的渠道）、`artifactHandoffError`、「本轮处理已结束，没有文本回复。」兜底，与 fork 的 `tracker.noReply`（no_reply 静默退场）与 `turnStoppedError(stopReason)` 全部保留，顺序按 fork 的语义优先级重排：`stop+answer → stop 抛出 → noReply 静默 → finalAnswer → 产物 → handoff 错误 → 兜底文案 → 抛错`。关键是 noReply 必须早于 `finalAnswer`，否则模型「先叙述后 no_reply」的文本会漏出去。
4. **`bot-workspace-store.mjs` → 四处处处取并集**（上游 `busyMessageMode` + fork `humanize`）：`decorateStatus`、`#freshIncarnation` 清理判据、`#persist` 形参、`createWorkspaceAwareController` 选项。R1（统一 per-bot 存储）合并后单独做，此处只保证两条链路并存可用。
5. **`text-harness-bridge.mjs` → 结构性手工重建**（3 路合并把两侧的流式/分段实现交错成了语法上正确但语义错误的形状）。原则：**以 fork 的结构为骨架**（它多出 humanize 实时设置、message_break 分段、typingSession、preAsk 可中断相位、send-delay、keepalive 复用），把上游 4.38 的新增能力重新植入：
   - 上游 `thinkingTraces`/`openThinkingStream` 合并进 fork 的 `openReplyStream()`（thinking 优先，其次 `openDeliveryStream`，再次 `openStream`）；`thinkingMode` 判定与 `progressMode: 'all'` / `reasoning` / `sendThinking` / `sendToolTrace` 一并恢复。
   - `deferImages: true` 与「`content` 回落到 `cleanText(message.content)`」采用上游写法（图片字节改走 `askOptions.images`，邮件渠道的 header 装饰不再丢失）。**这是本批唯一一处会改变行为、且被测试证伪过的改动**：漏掉 `deferImages` 时 `test/image-bridge.test.mjs` 失败（桥收到空 content）。
   - 忙碌消息路由改为**混合**：`resolveNewMessagePolicy` 只决定 `interrupt`（保留 fork 默认行为），`queue` / `steer` 交给上游 `BusyMessageDispatcher`（拿到排队回执、`canAutomaticallySteer` 门控与 `waitForIdle` 记账）。fork 因此废弃的 `#steerOrEnqueue` 与 `trySteer` 引用一并删除。P2-f 需把 `onNewMessage` 收敛进 `busyMessageModes` 并把 `interrupt` 补成 `BusyMessageDispatcher` 的第三态。
   - 上游 `clear-command`、`controlTextOf`、`MAX_DELIVERY_ATTEMPTS`/`#deliveryAttempts`、`messageFailureDiagnostic`、matrix 产物文案、`waitForIdle→whenIdle` 随三方合并自然落地。

验证（worktree 内 `node --test`，`node_modules` 以符号链接借主仓库）：
`injected-context` + `harness-reply-tracker` + `busy-message-dispatcher` + `artifact-delivery` + `outbound-artifact-consumer` + `outbound-artifact-prompt` + `qq-final-answer` = **88/88 pass**；
`image-bridge` + `workspace` + `default-workspace` + `session-bind-command` + `agent-preset-session-lifecycle` + `model-session-lifecycle` = **110 pass / 1 skip / 0 fail**。
`image-input.test.mjs` 在本机跑不了（缺可选依赖 `sharp@0.35.5`），在纯净 `v4.38.0` checkout 上同样失败，**非回归**。

### P2-c（host 层 `plugin-src/host/**`）

21 个文件：3 个整份套用（`humanize-rpc`、`channels/shared/humanize-bot-rpc`、`channels/shared/humanize-provider`）、8 个三路干净落地（含 `index.mjs`）、10 个需人工裁决。

裁决记录：

1. **`channels/*/rpc.mjs`（dingtalk / qq / slack / wecom / weixin / whatsapp / feishu / shared）→ 纯并集**：上游的 `setBusyMessageMode` 与 fork 的 `setHumanize` 端点同处一张映射表，两者并存。`feishu/rpc.mjs` 另有一处 source 投影同样取并集。
2. **`channels/feishu/production.mjs` → 并集**：上游的 `validateAccessPolicyForBot`（禁止把机器人自己的 Open ID 填进用户白名单）与 fork 的 `humanizeDefaults` 是相邻但无关的两个控制器选项。
3. **`delivery-adapter.mjs` / `delivery-service.mjs` → 并集**：上游新增 `describeSessionSyncApprovalTarget` + `presentSessionSyncApproval`（把 Host 正在等待的审批同步到一个已绑定的私聊），fork 新增 `listSessionConversations`（按普通会话绑定而非 session-sync 开关找出该 Session 的私聊，供 wake/静默轮次投递）。两条链路互不相干，三路合并仅在相邻行处粘连，按方法边界重新切开。
4. **`inbound-ttl-rpc.mjs` → 并集**：保留上游新增的 image-input RPC 复用（`/dsh-im-settings` 同时承载 inbound-ttl 与 image-input 端点），同时保留 fork 的 `resolveRpcAuthority(options.authority ?? options.config?.rpcAuthority)`。
   ⚠️ 这是**有意保留的 fork 分歧**：fork 的 `0291fe21`（fix: settings panels transport failure HTTP 403/405）把这里的 `{ authority: 'loopback' }` 改成可配置，因为 Web 设置面板经局域网/隧道访问时会被 loopback 判定挡掉。上游 4.38 又把它写死回 `loopback`，并新增了断言 loopback-only 的测试。按 fork 需求保留可配置（默认 `trusted-host`，仍受 Harness 的 Host/Origin 信任检查约束）。该测试需在 P2-g 按 fork 语义改写。
5. **`session-sync-coordinator.mjs` → 并集**：上游新增 `if (source?.kind === 'schedule') return 'dsh'`（upstream #292「把定时任务的回答同步到 IM」），fork 的新规则是「任何非 `user` 的 kind 都归 `wake`」。`schedule` 必须**先**判为 `dsh`——上游的 `dsh` 路径才是建立 recipients 并抑制内部 reminder 文案的那条路径，交给 fork 的 `wake` 路径会破坏该特性。因此 `schedule` 特判置于通用规则之前。

验证（worktree 内 `node --test`；本批起 worktree 拥有独立 `node_modules`，按 P2-a 后的 `package.json` + 上游 `package-lock.json` 安装）：
`host` + `host-session-coordinator` + `session-sync-coordinator` + `delivery-service` + `delivery-adapter` + `delivery-rpc` + `delivery-http` + `inbound-ttl` + `rpc-authority` + `management-rpc` + `access-policy-host` = **103 pass / 8 fail**；`plugin-src/host/index.mjs` 动态导入通过。

8 个失败**全部是 fork 分歧导致的测试待适配，没有代码缺陷**：

| 失败 | 原因 | 处置 |
| --- | --- | --- |
| `session-sync-coordinator` ×6 | 上游测试的 delivery service 桩只有 2 个方法，fork 的构造器契约要求 4 个（`listSessionConversations`、`send`）。已实测：给桩补齐后 6 个用例通过 | P2-g 合并两侧测试文件 |
| `management-rpc` ×1 | 断言 inbound-ttl 恒为 loopback-only，与 fork 的 `0291fe21` 相悖 | P2-g 按 fork 语义改写 |
| `host.test` ×1 | fixture 深比较转发给渠道的配置，不认识 fork 的 humanize 键 | P2-g 更新 fixture 期望 |

### P2-d（渠道层 `src/channels/<渠道>/**`）— 进行中

21 个文件：16 个整份套用、12 个三路干净落地、8 个需人工裁决（本批已修完 3 个）。

**通用裁决模式（其余 5 个渠道 bridge 同构）**：上游 4.38 把「忙碌消息」路由收进 `BusyMessageDispatcher`（`queue`/`steer` 两态 + 自动 steer 资格门控 + 排队回执 + `waitForIdle` 记账），fork 则在各 bridge 里用 `resolveNewMessagePolicy` 实现三态（默认 `interrupt`）。与 `text-harness-bridge` 一致处理为**混合**：`resolveNewMessagePolicy` 只决定 `interrupt`（走 fork 的 `#abortPreAskPhase` + `fireAndForgetStop` + `#enqueueMessage`），`queue`/`steer` 交给上游的 `#busyMessages.dispatch`，`mode: policy ?? busyMessageMode`。各 bridge 的 `#onNewMessage`/`#humanizeSettings`/`#abortPreAskPhase`/`#boundSession`/`#busyMessages` 字段在三路合并中都已就位。各 bridge 原有的 `#steerOrEnqueue`/`trySteer` 随之废弃（改用上游 dispatcher 的 steer）。

已修完：

1. **`telegram/telegram-api.mjs`** → 取 fork 的重试循环（`maxRetries=2`，网络错误指数退避 + 429 `retry_after`），并补回上游在该方法里的唯一改进 `new Error(..., { cause })`。**删除 fork 在 fetch catch 里额外加的 `if (signal?.aborted) throw abortReason(signal);`**：AbortError 本就不在 `RETRIABLE_NETWORK_CODES` 里，该行不解决重试问题，却会短路上游的「派发后中断 ⇒ `deliveryOutcome='unknown'`」判定（`telegram-aborted-after-dispatch`），使 `rich-message.test.mjs` 的 3 个用例失败。改后 2 个通过。
   ⚠️ 剩余 1 个失败：`Telegram only treats the explicit unchanged-content rejection as success` 的 `429 + "message is not modified"` 子用例断言 `calls.length === 3`，fork 的 429 重试把它变成 5。语义断言（`deliveryOutcome === 'sent'`）仍成立，只是调用次数变了——保留 fork 的重试，P2-g 调整该断言。
2. **`qq/qq-runtime.mjs`** → 取 fork 的「移除 SDK `typingIndicator` 中间件」（其 50s keepalive 在本集成里是死代码，fork 自管 typing session），同时**保留上游新增的 `connection-error` 导入与诊断调用**（`006f9747`，fork 侧没有这行，若不补回则 `extractConnectionEvidence` 等成为未定义引用）。
3. **`telegram/telegram-runtime.mjs`** → `openDeliveryStream` **删除 fork 的私聊 Rich Draft 分支**，公开聊天与群聊统一走可编辑占位消息流程（保留 fork 的 `lazy` 支持与 markdown 首帧用 `sendRichMessage` 创建）。理由：上游 `a372b747` 修 #276——Rich Draft 会在 Android 上占住输入框，导致整个回合 `/stop`、`/steer` 和普通追加消息都发不出去；fork 的 `48c1b845` 引入的 draft 方案正是该 bug 的来源，被上游的修复取代。`randomInt`/`splitMessageText` 导入随之消失（已确认无残留引用）。上游的 thinking-traces / `telegramMessageUnchanged` 等新增已在三路合并中落地。

4. **`qq/qq-bridge.mjs`（4 处人工）** → imports 取并集（补 `qq-mention` 的 `isQqMessageAddressed`/`normalizeQqMentions`）；`accept()` 末段按混合模式重写（见文首「通用裁决模式」）；pre-ask 相位取 fork 版并给 staging 补 `deferImages: true`；`askOptions` 里**同时**保留上游的 `finalAnswerOnly: true` 与 fork 的 `onUpdate: messageBreakHandler ? async (update) => { …工具失败收集…; await messageBreakHandler.handleUpdate(update); } : (update) => { …同上… }`。fork 的 `#steerOrEnqueue` 与 `trySteer` 导入随之删除（全文已确认无残留引用）。
5. **`wecom/wecom-bridge.mjs`（2 处）** → 同上混合模式；第二处取 fork 的 pre-ask 内容相位并补 `deferImages: true`（上游那一版的同段代码只是在 pre-ask 之外重复构造一遍）。`trySteer` 导入删除。
6. **`weixin/weixin-bridge.mjs`（1 处）** → 同上混合模式；`#steerOrEnqueue` 与 `trySteer` 删除。
7. **`feishu/bridge.mjs`（8 处，最大）**：
   - 路由段同混合模式；`trySteer` 删除。
   - `#answerWithStream` 的三处交错冲突（3 路把两套控制流拼成了语法正确、语义错误的混合体）**改为整方法重建**：以 fork 结构为骨架（pre-ask 阅读延迟 → `#answerWithStepPush` 分流 → `#preparePrompt` 构造 → 纯文本路径的 message_break / 流式卡路径），重新植入上游能力。脚本化转换（`/tmp/feishu-rebuild.mjs`，逐条打印替换计数以便发现静默 no-op）：`markAskComplete(sessionId)` 打通 `prompt.onAskComplete`；3 个 ask 点返回并消费 `sessionId`；3 处 `sourceGuidance` 换 `prompt.sourceGuidance` 并补 `prepareContent`；3 处 `#interactionAskOptions` 补 `message.images`（`deferImages` 后图片走 `askOptions.images`，不补会丢图）；4 处补 `#maybeSendVoiceReply`。
   - **`#preparePrompt` 增加可选 `{ signal }`**（默认 `this.#signal`），调用点传 `preAskSignal`：既落地上游「话题锚点 + `deferImages`」的重构，又保住 fork「图片 staging 在 pre-ask 窗口内、可被新消息取代」的语义。
   - **`onUpdate` 头部顺序：message_break 处理器先于 `liveCot` 分支**。分步直推的 live-CoT 分支会 `return` 掉一切，若排在前面，`messageBreakHandler` 永远收不到更新；顺序调整后消费（返回 `null`）→ 直接清 `pendingStep` 并返回，改写（返回新 update）→ 交给 CoT 卡片渲染。
   - `#answerWithStream` 里 `markAskComplete` 定义在 `try` 之外、`prompt` 定义在 `try` 之内，闭包捕获不到 → 运行期 `ReferenceError: prompt is not defined`（被安全失败文案吞成 INTERNAL_UNKNOWN）。修复：`let prompt;` 提到 `try` 之前，`try` 内改赋值。（这正是「整方法重建」时空出来的坑，`node --check` 查不出，只有跑测试才暴露。）
8. **`dingtalk/dingtalk-bridge.mjs`** → 混合模式（`mode: policy ?? busyMessageMode`，该渠道 `accept()` 有上游传入的 `busyMessageMode`）；删除已无引用的 `trySteer` 导入。

验证（worktree 内逐目录跑，括号内为合并前 fork 基线）：

| 目录 | tests | pass | fail | cancelled | 结论 |
| --- | --- | --- | --- | --- | --- |
| feishu | 452 | 452 | 0 | 0 | `bridge.test.mjs` **320/320**；`live-cot`+`feishu-channel`+`voice`+`voice-bridge`+`message-utils` 132/132 |
| dingtalk | 243 | 239 | 0 | 4 | 基线 244/240/0/4，等价 |
| weixin | 179 | 170 | 0 | 9 | 基线 169/160/0/9，+10 全过 |
| wecom | 108 | 56 | 0 | 52 | 基线 108/56/0/52，逐项一致 |
| qq | 155 | 101 | 2 | 52 | 基线 149/99/0/50；2 个 fail 见 P2-g ① |
| wecom-app | 20 | 20 | 0 | 0 | 一致 |
| telegram | 169 | 138 | 2 | 29 | 基线 141/137/4/0，fail 由 4 降到 2；29 cancelled 在纯净 `v4.38.0` 上完全相同（环境噪声） |
| whatsapp | 45 | 44 | 1 | 0 | 基线 43/43/0/0，见 P2-g ② |
| email / imessage / matrix / office | 81/11/64/15 | 全 pass | 0 | 0/0/6/0 | 一致 |
| discord / slack | 44/27 | 14/10 | 0 | 30/17 | 基线 34/5/29、26/10/16，同域噪声 |
| shared | 582 | 501 | 1 | 80 | 基线 415/412/1/2；唯一 testCodeFailure 与基线同名同因（`startup.test.mjs` 的 composed-host 用例，路由数 14≠13），80 个 cancelled 全是 `cancelledByParent` |

**关于大规模 `cancelledByParent`**：错误文案固定为 `Promise resolution is still pending but the event loop has already resolved`，根因是 `AbortSignal.timeout()` 的定时器在 Node 里是 unref 的——当挂起 Promise 只能靠它落定时，事件循环先排空，node:test 于是把该用例及同文件后续用例全部标成 `cancelledByParent`。合并前 fork 的 `qq/bridge`（50）、`wecom/bridge`（52）已经是同一现象，属既有环境/测试写法问题，非本次合并引入。

### P2-f（R2 声明式字段表 + 收敛 `onNewMessage` 到 `busyMessageMode`）— 勘察结论与设计

#### 勘察：字段知识目前散落在 9 处（这就是 R2 的动机）

host 侧：
1. `src/channels/shared/humanize-settings.mjs` — `DEFAULT_HUMANIZE_SETTINGS`（9 键）、`normalizeHumanizeSettings`（宽松：逐键 `typeof === 'boolean'` 判断 + 逐个 normalize 调用）、`validateHumanizeUpdate`（严格：逐键 if + 未知键集合）。
2. `src/channels/shared/humanize-override.mjs` — `normalizeHumanizeOverride`（per-bot 宽松：**又抄了一遍**逐键判断与 `ON_NEW_MESSAGE_VALUES`/`TYPING_INDICATOR_VALUES` 字面量数组）、`validateHumanizeOverrideSection`（per-bot 严格：**第三次**逐键 if + 未知键白名单数组）。
3. `src/channels/shared/humanize-resolver.mjs` — `resolveHumanizeSettings`：默认值与逐键 `typeof` 兜底**第四次**（注释里自己写着「all normalizers are idempotent」）。
4. `src/channels/shared/message-mode.mjs` — `busyMessageMode` 的 enum/校验（上游侧，独立一套）。

client 侧：
5. `plugin-src/client/channels/shared/humanize-fields.js` — `HUMANIZE_SETTING_META`（label/hint/options）、`SHIPPED_HUMANIZE_DEFAULTS`（**第五次**列默认值，注释自陈「kept local to avoid pulling Node APIs into the browser bundle」）。
6. `plugin-src/client/humanize-settings.js` — `BOOLEAN_SETTING_KEYS` 数组 + 手写渲染。
7. `plugin-src/client/channels/shared/bot-send-delay.js` — `BOOLEAN_KEYS`/`ENUM_KEYS`/`ALL_KEYS` 三个数组 + 手写渲染。

结构性字段（`sendDelay`、`typingBurst`）的 normalize/validate 已经各自收敛在 `send-delay.mjs`/`typing-session.mjs` 里，是「按字段表调用」的天然接缝。

#### 设计（选定方案）

1. **新增 `src/channels/shared/humanize-schema.mjs`（browser-safe，无 Node API）**：一张 `HUMANIZE_FIELDS` 表，每项声明 `{ key, kind: 'boolean'|'enum'|'shape', default, values?, label, hint, perBot, render: 'toggle'|'select'|'group' }`；`kind:'shape'` 项带 `{ normalize, validate }`（指向 `send-delay.mjs` / `typing-session.mjs` 的既有函数）。表内**只引用值，不引用函数式默认**，避免冻结问题。
2. 由该表派生（同一模块内）：`DEFAULT_HUMANIZE_SETTINGS`、`HUMANIZE_KEYS`、`normalizeHumanizeSettings`（宽松全量）、`normalizeHumanizeOverride`（宽松 per-bot，保留「只留出现且合法的键、空则 null」语义）、`validateHumanizeSettings`（严格，支持 `{ scope: 'global'|'bot', fieldPrefix, sendDelayBase }`）。`humanize-settings.mjs` 只保留文件 store + RPC handler，`humanize-override.mjs` 只保留 `SET_HUMANIZE_ENDPOINT` 与 `inheritSendDelayBase`，两个面板改为遍历表。presentation 字段（label/hint）进 schema 是刻意的：host 忽略它们，客户端因此不再需要第二张表。
3. **`onNewMessage` → `busyMessageMode` 收敛为同一个概念**（用户已批准的方向）：
   - 取值 `interrupt | queue | steer`，默认 `interrupt`（保住 fork 现行默认；上游默认是 queue）。
   - **全局默认**：humanize 设置里的字段改名为 `busyMessageMode`，全局面板的「新消息行为」下拉保留（文案与 i18n key `新消息行为` 同步改）。
   - **per-bot**：直接复用上游既有存储位 `workspaces.json.busyMessageModes[botId]`（`src/channels/shared/bot-workspace-store.mjs`），**删除** per-bot humanize section 里的 `onNewMessage`，避免一个行为两个旋钮。
   - 生效顺序：per-bot 显式值 → 否则全局 humanize `busyMessageMode` → 否则 `interrupt`。
   - `busyMessageModeFor(botId)` 现在把「未设置」归一成 `'queue'`（`bot-workspace-store.mjs:557`），这会挡住全局回落，需要改成「未设置返回 undefined」，并让**客户端快照**（`:1382` 的 `busyMessageMode: this.busyMessageModeFor(bot.botId)`）返回**生效值**（客户端已能读到全局 humanize 设置，卡片上显示生效值 + 标明来源）。
4. **`interrupt` 成为 `BusyMessageDispatcher` 的第三态**（用户已批准的方向），把 7 个 bridge 里手写的那 15 行收敛到一处：dispatcher 已有 `harness`/`state`/`control`/`signal`/`logger`，足以自己算 `state.sessionFor(key)` → `harness.workspaceSession(sessionId)` 并 `stopActiveTurn`；只新增一个 `abortPreAsk` 回调参数（bridge 传 `() => this.#abortPreAskPhase(key)`）。`SUPERSEDED_STOP_REASON` 与 `isSupersededStop` 迁到 `message-mode.mjs`（属 interrupt 语义），然后**删除 `new-message-policy.mjs`**（`trySteer` 已在 P2-d 后无调用者；steer 走上游 `steerMessage`；`resolveNewMessagePolicy` 被 dispatcher 的 mode 分支取代；`fireAndForgetStop` 内联进 dispatcher）。
5. 客户端 per-bot 的「消息处理方式」下拉（`plugin-src/client/bot-general-settings.js:84-91`，上游的 `排队`/`插话` 两项）扩成三项，补 `打断`，并把说明文案改为按三态切换。该文件是 R2 之后**唯一**的 per-bot 非拟人化 humanize 控件。

#### 风险与取舍记录

- 不迁移旧 per-bot `humanize.onNewMessage`：4.38 是 re-baseline 的首个版本，AGENTS 明确「上线前不考虑兼容性/旧版迁移」；宁可在本机验证时把该键手工清掉。
- 全局面板的「新消息行为」与新命名的 `busyMessageMode` 是同一概念的两个层级，README 需同步写清优先级。
- 严格校验的错误 `field` 前缀要分域（全局 `streaming` vs per-bot `humanize.streaming`），否则 `management-rpc`/`humanize-*` 既有断言会漂。

#### 实施记录（P2-f1 / P2-f2）

**P2-f1（字段表）**：新增 `src/channels/shared/humanize-schema.mjs`（browser-safe，无 Node API）。表项 `{ key, kind: 'boolean'|'enum'|'shape', control, default, values?, options?, perBot, label?, hint?, normalize/validate/requireComplete? }`，由它派生 `HUMANIZE_KEYS`、`PER_BOT_HUMANIZE_KEYS`、`DEFAULT_HUMANIZE_SETTINGS`、`normalizeHumanizeField/Settings/Override`、`validateHumanizeSettings(value, { scope, sendDelayBase })`。删除的重复清单：host 的 `HUMANIZE_CONFIG_KEYS`、`humanize-rpc.mjs` 的 `SETTABLE_KEYS`、resolver 的第四份默认值、客户端 `HUMANIZE_SETTING_META`/`SHIPPED_HUMANIZE_DEFAULTS`/`BOOLEAN_SETTING_KEYS`/`BOOLEAN_KEYS`+`ENUM_KEYS`。

- **接口面保持稳定**：`humanize-settings.mjs` 与 `humanize-override.mjs` 退化为「store+RPC 处理器」/「端点」+ 再导出（`normalizeHumanizeOverride`、`validateHumanizeOverrideSection`、`validateHumanizeUpdate`、`DEFAULT_HUMANIZE_SETTINGS` 等），14 处 import 与 fork 既有测试因此零改动。
- **行为修正**：`resolveHumanizeSettings` 改为表驱动，snapshot 缺失时回落到**表内默认值**（此前 `messageBreak` 回落到 `false`，与出厂默认 `true` 不一致）。仅影响「无 provider 且不传 snapshot」的直接构造。
- **`perBot` 语义**：宽松读 per-bot 段时「键缺失」与「键等于默认值」必须区分，故 per-bot 读取不做修复（非法值丢弃、继续继承全局），与严格校验同一判据。
- 客户端两个面板改为遍历表；全局面板的标量字段顺序即表序，因此「输入状态指示」上移到了发送延迟之前（有意的版式统一）。
- **顺带修掉一个合并缺陷**：`BotWorkspaceStore.setHumanize` 把 humanize 当作 `#persist` 的第 7 个位置参数，而合并后的签名第 7 位是 `busyMessageModes`（humanize 是第 8 位）——per-bot 拟人化段会写进 `busyMessageModes`，两个设置互相污染。定位方式：跑 fork 的 `humanize-override.test.mjs`，`disk.humanize` 缺失。已改为 7 个 `undefined` + humanize 并加注释说明位置。
- **坑（值得记住）**：上游 `test/client-ui.test.mjs` 的「每个中文串都有英文投影」用例用正则 `(['"\`])(...)\1` 提取字符串，注释里的引号也会被当成字符串起始；客户端源码注释里写一个 ASCII 撇号（`schema's`、`bot's`）就会把后面的代码吞进一个「字符串」，于是报出一条莫名其妙的未翻译项。本批踩了两次，改写注释后恢复。

**P2-f2（模式收敛）**：

1. `message-mode.mjs` 成为模式词汇的唯一出处：`BUSY_MESSAGE_MODES`（interrupt/queue/steer）、`DEFAULT_BUSY_MESSAGE_MODE='interrupt'`、`normalizeBusyMessageMode`（宽松，回落默认）、`storedBusyMessageMode`（严格读，未设置返回 **undefined**）、`validateBusyMessageMode`、`SUPERSEDED_STOP_REASON`/`isSupersededStop`（从 `new-message-policy.mjs` 迁入）。
2. schema 里字段改名 `onNewMessage` → `busyMessageMode`，`perBot: false`（per-bot 走 `workspaces.json.busyMessageModes`），标签改「消息处理方式（全局默认）」。
3. **优先级一处解析**：`BotWorkspaceStore.effectiveBusyMessageModeFor(botId)` = 机器人自选 → 全局人化设置 → `interrupt`；`busyMessageModeFor` 保留为「原始读」（未设置 undefined）。`decorateStatus` 与 `currentBusyMessageMode` 都走 effective，所以客户端卡片显示的就是 dispatcher 真正会执行的值。全局值经 `busyMessageModeDefaults` 访问器在**每个 production.mjs 的 store 构造处**注入（10 个文件各 1 行，与同文件里已有的 `config.humanizeDefaults?.(channel)` 同一来源）。
4. `interrupt` 成为 `BusyMessageDispatcher` 的第三态：新增 `abortPreAsk` 回调，dispatcher 自己算 `state.sessionFor(key)` → `harness.workspaceSession()` → `stopActiveTurn({reason:'superseded'})`（fire-and-forget），并保留 `isQueued()` 门控（无在途回合不打断）与 `pendingInteraction()` 早退（等交互一律排队）。**interrupt 绕过 `#tails` 串行链**（要抢占，不能排在别的路由决定后面），queue/steer 的语义不变。
5. 6 个 bridge（`text-harness-bridge`、qq、dingtalk、feishu、wecom、weixin）删掉手写的 policy 块 + `#interruptAndResend`/`#boundSession` + `resolveNewMessagePolicy` 调用，改为给 dispatcher 传 `abortPreAsk`；`mode` 直接来自 `harness.currentBusyMessageMode()`（accept 的 `busyMessageMode` 快照）。**`new-message-policy.mjs` 已删除**（`trySteer` 在 P2-d 后已无调用者）。
6. **顺带清掉死管线**：`onNewMessage` 这条「配置 → runtime 构造快照 → bridge 构造快照 → resolver」的通道在 f2 后无任何读取者，故从 9 个 runtime、8 个 `humanizationOptions` 与 6 个 bridge 构造器里整体移除（否则会留下一个看似能配、实际不生效的旋钮）。
7. 客户端：per-bot「消息处理方式」下拉补第三项「打断」（三项：打断/排队/插话），说明文案按当前模式三态切换；i18n 字典同步（新增 `打断`/`打断当前生成，直接处理新消息`/`消息处理方式（全局默认）` + 新 hint，删除 `新消息行为` 及三条已死的 `跟随全局 (${...})` 模板投影）。
8. README×2 同步：速览表行改为 `busyMessageMode`，正文写清「全局默认 + 每机器人可单独覆盖 + 生效优先级」，per-bot 覆盖清单里去掉「新消息行为」（它已移到通用设置）。

**P2-f 的偏离记录**：设计稿写「由 `humanize-schema.mjs` 派生 + 各消费者改 import」，实际改为在两个旧模块里**再导出**派生 API（14 处 import 与 fork 测试零改动、单一出处不变）；设计稿提到的「客户端卡片标明来源（per-bot / 全局）」未实现——收敛后 per-bot 一旦设置就是显式值，未设置时显示全局值本身即准确行为，再加一个来源标注只增加界面噪音与快照字段。两处偏离都写在这里备查。

**P2-f 实测**：`npm run build`（client+host）与 `node scripts/verify-package.mjs` 通过。fork 侧 `humanize-settings`+`humanize-override`+`client-humanize-ui` 预跑 **29/29**（f1 后），f2 后 6 个用例因改名/移位的**预期差异**待 P2-g 适配（见下）；上游侧回归集 141 个用例中 3 个失败（组成的 host 路由数与 inbound-TTL loopback 为既有项，另有 1 个是默认值从 queue 变 interrupt 的预期差异）。

## i18n 并集核对（P2 源码阶段的收尾验证）

字典以中文原文为 key，所以「并集」的正确判据不是 key 数量相等，而是**代码里用到的 key 都能查到译文**。两侧都跑了一遍：

- host 侧（`src/channels/shared/i18n-en/*.mjs` 为译文表）：合并树 `t()` 字面量 917 个、译文 key 1265 个、无译文 22 个；fork main 对应为 785 / 1070 / 23。缺的 22 个几乎全在 `src/channels/weixin/connection-error.mjs` 的诊断文案（另有 `_{text}_`、`QQ机器人`、`{label}（{id}）` 等模板件），**合并后比 main 还少一个**（上游补了一条译文），无回归、无新增缺口。
- client 侧（`plugin-src/client/i18n.js`）：合并树 1302 个 key、`localizeText()` 直接字面量 0 个缺口；fork main 为 1143 个 key、1 个缺口（`诊断信息`，既有问题）。
- 反向核对（main 有、合并树没有的 key）：client 侧仅 6 个，全部是上游 4.38 **改过措辞**的旧串（`群聊以话题方式回复` → `被 @ 时以话题方式回复`；`…不显示、实时卡片或逐步消息` → `…不显示、原生直播、实时卡片或逐步消息`；另 4 个飞书话题/来源字段旧文案）。已逐个 grep 确认**在合并后的代码里没有任何引用**，属正常废弃，不是丢 key。

## P2-g 待办（测试适配，逐条已定位）

> **前提**：当前 worktree 的 `test/` 树**整棵都还是上游 v4.38.0 的**（`grep -rln humanize test/` 在合并树里为空，而 fork main 有 17 个含 humanize 的测试文件）。也就是说本批观察到的「上游测试期望 vs fork 实现」的差异，绝大多数会在 P2-g 把 `test/` 按同一套 re-baseline 流程跑一遍后消失或改写。P2-g 第一步：`/tmp/p2-apply.sh test`（再单独处理 `test/browser/`）。

1. `test/channels/qq/runtime.test.mjs` 是上游版：断言 `bot.middlewares[2].name === 'typing-middleware'`、`options.keepAlive`、`predicate(...)`。合并后代码取 fork 的「不装 SDK typingIndicator 中间件、由 bridge 自管 typing session」，且全 `src/` 已无 `typingMiddleware` 引用。→ 用 fork 版测试替换该文件（并把上游新增的非中间件用例并进来）。
2. `test/channels/whatsapp/streaming.test.mjs` 的 `typing remains active while generating` 断言：上游 4.38 给 `WhatsappBotClient` 补了公开 `stopTyping()`（配 `#stopTyping`/'paused'），而 fork 的 `text-harness-bridge` 里本就有「首个可见回复分片到达即 `typingSession?.stop()`」的意图代码——过去因为渠道没有 `stopTyping` 而退化成 `stopTyping: null`（静默无效），现在真正生效，于是对应位置出现了 'paused'。→ 按新语义调整该断言（保留上游 `stopTyping`）。
3. `test/channels/feishu/session-sync.test.mjs` 13 个用例的桩只有上游的两个方法，fork 的 `createSessionSyncCoordinator` 要求 4 个（多 `listSessionConversations`、`send`）→ 报 `Session sync requires a complete delivery service`。补桩即可（P2-c 已在 host 侧实测过同因同解）。
4. 仓库级替身 `rich-message.test.mjs` 的 `429 + "message is not modified"` 子用例断言 `calls.length === 3`（fork 的 429 重试使其为 5，语义断言仍成立）。
5. `test/channels/dingtalk/client-api.test.mjs` 的端点快照是上游版，合并后多出 fork 的 `setHumanize: 'bot.humanize.set'` → 并集（P2-g 跑 `test/` 重放后应自然由 fork 版覆盖，仍在此记账）。

6. **默认模式从 queue 变 `interrupt`（P2-f2 的有意变更）**：以下上游 4.38 测试断言的是上游默认值，需按 fork 语义改写——`test/message-mode-settings.test.mjs`（17 例：`busyMessageModeFor` 未设置返回 undefined、`currentBusyMessageMode` 返回 interrupt、payload 允许 `interrupt`）、`test/channels/shared/context-enhancement-production.test.mjs`（13 例：`currentBusyMessageMode()` 期望值）、`test/bot-general-settings.test.mjs`（1 例：初始值 `interrupt` + 三个选项）、`test/client-delivery-settings.test.mjs`（1 例：同因）。改写时保持「断言的是 fork 文档化的行为」这一原则。
7. **`test/humanize-bridge.test.mjs` 的 artifact 用例**：fork part 1（`224c3606`）把 `stage()` 改成「必须有活跃消费者」，该用例直接 `outboundArtifactRegistry.stage(...)` 而没有开消费者 → 现在抛 `artifact-consumer-required`。**main 上同因同失败**（P2-f2 期间实测确认），属 part 1 的测试缺口，需补上消费者再断言。
8. **fork 侧因 f2 需改写的用例**（改名与移位，非回归）：`test/humanize-settings.test.mjs`（默认表、`resolveHumanizeSettings` 期望值）、`test/humanize-override.test.mjs`（per-bot 段不再含 `onNewMessage`，字段路径 `humanize.onNewMessage` 变为「未知键」）、`test/client-humanize-ui.test.mjs`（per-bot 编辑器只保存自定义键的期望值）、`test/humanize-bridge.test.mjs` 的 queue/steer 两例（模式改由 `harness.currentBusyMessageMode()` 驱动，不再来自 humanize 设置）。`test/new-message-policy.test.mjs` 随模块删除。
9. **建议补测**：`BusyMessageDispatcher` 的 `interrupt` 第三态（抢占、`abortPreAsk` 调用、`stopActiveTurn` 带 `reason:'superseded'`、等交互时不打断），以及 `effectiveBusyMessageModeFor` 的三级回落。
10. **可选（测试健壮性）**：让 `test/client-ui.test.mjs` 的中文串提取先剥掉注释再匹配，从根上消除「注释里的撇号吞代码」这类假失败（本批踩了两次，见 P2-f 实施记录的坑）。

### P2-e（客户端层 `plugin-src/client/**` + `scripts/verify-package.mjs`，含 R3）

24 个文件：5 个整份套用、10 个三路干净落地、9 个需人工裁决。

1. **各渠道 `channels/*/api.js`（dingtalk/qq/wecom/weixin/whatsapp）与 `channels/shared/token-api.js`** → 同构的两处并集：端点表同时保留 `setBusyMessageMode: 'bot.message-mode.set'` 与 `setHumanize: SET_HUMANIZE_ENDPOINT`；`normalizeBotSnapshot` 同时保留 `busyMessageMode`、`contextEnhancement`、上游的 `thinkingTraces`（token-api）与 fork 的 `...(Object.hasOwn(value,'humanize') ? { humanize: normalizeHumanizeOverride(value.humanize) } : {})`。脚本化落地（`/tmp/p2e-fix.cjs`，第一遍 dry-run 只打印每文件替换计数与残留标记数，确认 1/1/0 后才 `--write`）。
2. **`channels/feishu/api.js`** → imports 取并集（fork 的 `humanize-override` + 上游新增的 `normalizeFeishuStepCardPanels`/`normalizeFeishuVoiceConfig`/`normalizeSlashPanelConfig`，三个模块的导出都已确认存在）；端点与 normalize 同上。
3. **`channels/shared/token-channel.js`** → `AccountCard` 形参取并集：fork 的 `onHumanizeSave` + 上游新增的 `rpcCall`、`reload`（调用点与函数体都已同时使用三者）。
4. **`client/index.js`** → 采用上游重构后的结构（`panelDependencies` 常量 + `IMPanelErrorBoundary` + `setSettingsVisible` 客户端服务），并把 fork 的 `humanizeRpcCall` 补进 `panelDependencies`。上游那份依赖表本身已是 fork 的超集（多 email/matrix），只需补一项。
5. **R3（`scripts/verify-package.mjs`）**：删除每文件 `{ checkbox, switch }` 计数清单与逐文件比对，只保留两种断言——① 白名单**文件**之外不得出现 `type:'checkbox'` / `role:'switch'`（对「所有客户端源码去掉白名单文件后的并集」做匹配）；② 打包产物里的可勾选控件总数必须等于白名单文件计数之和（计数在验证时**求和得出**，不再手写）。白名单补入上游 4.38 新增的两个合法带开关文件：`bot-general-settings.js`（分步卡片面板）与 `channels/telegram/thinking-traces.js`（思考过程留痕）。另修正 `undici` 的锁定版本：上游 `package.json` 钉的是 `7.29.1`，脚本里还写着 `7.29.0`。

验证：`node plugin-src/client/build.mjs` 与 `plugin-src/host/build.mjs` 均成功（esbuild 对缺失具名导出会直接报错，等于把整棵 client/host 的导入-导出面验了一遍）；`node scripts/verify-package.mjs` 通过（`Verified dsh-im package artifacts.`）；`test/client-delivery-settings` + `bot-general-settings` + `bot-alias(-ui)` **55/55**；discord/slack/telegram/whatsapp `client-ui` + feishu/weixin `client-api` **31/31**；dingtalk/qq/wecom 的 `client-api`+`client-ui`+`client-lifecycle` 34 个用例中 1 个失败，即上面 P2-g ⑤ 的端点快照。生成物 `lib/client.js`、`lib/index.js` 已还原到 HEAD——它们是构建产物，留到 P2-g 全部源码落地后统一重建一次。

## 待决问题（P2-f 时处理）

1. **`interrupt` 模式**：上游 `busyMessageModes` 只有 `queue` / `steer` 两态，fork 的 `onNewMessage` 默认值是 `interrupt`（新消息取消在途回合 + 静默退场）。删除 `new-message-policy.mjs` 后，若仍要 `interrupt`，需要以「在上游 `BusyMessageDispatcher` 上补第三态」的小补丁方式实现，而不是恢复整个平行模块。P2-f 前需明确取舍。
2. README 里「新消息行为 `onNewMessage` … 上游仅 queue」的表述、以及「修复的缺陷（上游 bug）」里针对 v4.13.0 的历史条目，在 P2-f 落地后需同步更新（避免用户文档与实现不符）。
3. `progress-status` 相关断言与上游 `status-reaction` / thinking-traces 的关系，留到 P2-g 跑测试后再定保留范围。
