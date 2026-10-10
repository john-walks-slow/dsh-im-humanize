# 合并进度日志（rebase-upstream-4.38）

工作分支：`rebase-upstream-4.38`（基于 `v4.38.0`），worktree `.worktrees/merge-upstream-4.38`。
基线：上游 `v4.38.0` = `9353109`；fork 侧 delta 取 `f434ca0..main`。

## 批次进度

| 批次 | 内容 | 状态 |
| --- | --- | --- |
| P2-a | 元数据与构建骨架（package.json 身份/dsh 声明、删 pnpm-lock、.gitignore、README×2、CHANGELOG、AGENTS.md、cordis.patch.yml） | ✅ 完成 |
| P2-b | 共享层 `src/channels/shared/**` | ✅ 完成 |
| P2-c | host 层 `plugin-src/host/**` | 待办 |
| P2-d | 渠道层 `src/channels/<渠道>/**` | 待办 |
| P2-e | 客户端层 `plugin-src/client/**` + `scripts/verify-package.mjs`（含 R3 简化） | 待办 |
| P2-f | R2：人化设置字段声明式化（并落地删除 `new-message-policy`，改用上游 `busyMessageModes`） | 待办 |
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

## 待决问题（P2-f 时处理）

1. **`interrupt` 模式**：上游 `busyMessageModes` 只有 `queue` / `steer` 两态，fork 的 `onNewMessage` 默认值是 `interrupt`（新消息取消在途回合 + 静默退场）。删除 `new-message-policy.mjs` 后，若仍要 `interrupt`，需要以「在上游 `BusyMessageDispatcher` 上补第三态」的小补丁方式实现，而不是恢复整个平行模块。P2-f 前需明确取舍。
2. README 里「新消息行为 `onNewMessage` … 上游仅 queue」的表述、以及「修复的缺陷（上游 bug）」里针对 v4.13.0 的历史条目，在 P2-f 落地后需同步更新（避免用户文档与实现不符）。
3. `progress-status` 相关断言与上游 `status-reaction` / thinking-traces 的关系，留到 P2-g 跑测试后再定保留范围。
