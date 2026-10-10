# 合并上游 4.38.0：P1 盘点

- 日期：2026-10-10
- worktree：`.worktrees/merge-upstream-4.38`（分支 `merge-upstream-4.38`）
- 目标：`v4.38.0`（`9353109`）
- 方法：re-baseline（B 方案）——以 `v4.38.0` 为新基线，把 `f434ca0..main` 的 humanize delta 三方应用上去

## 1. 结论摘要

1. **上游 4.38.0 声明的 DSH 兼容版本是 `0.2.0-rc.2`，与本机一致**；fork 目前还写着 0.1.x（已过期）。合并不需要先升宿主 dsh。
2. 机械冲突面 **97 个源文件**（fork 在这 97 个文件上的改动量为 +6163 / −626 行），另有 2 个 `lib/` 构建产物与 2 个 lock 文件按重建处理。
3. 105 个 fork 改动文件上游未改动 → 可整份采用 fork 版本，无冲突。
4. 上游 4.38.0 **已包含 43fd516**（本次移植的 return-file 修复），重放时只保留 fork 的 `as` 呈现模式。
5. **真正的工作量不在机械冲突，而在四个结构性集成点**（见 §4）。
6. 可精简项见 §5：最确定的是删掉 fork 独有、上游并不使用的 `pnpm-lock.yaml`。

## 2. 分类清单

| 类别 | 数量 | 处理方式 |
| --- | --- | --- |
| ① fork 改、上游未改 | 105 | 整份采用 fork 版本（上游内容 == 4.21.2 内容） |
| ② 双方都改（真冲突） | 97 源文件 + 2 lock + 2 `lib/` | 逐文件三方解冲突；lock 重装、`lib/` 重建 |
| ③ fork 新增文件 | 96（其中 40 是 docs/、26 是 fork 独有测试） | 直接带过去；测试需适配新基线 |
| ④ 上游新增 | 443 个文件变更中的其余部分（新增 email/matrix 渠道、desktop-panel 集成、`locale/`、thinking-traces 等） | 随新基线自动获得 |

②中 97 个源文件的分布：`src/channels/**` 30、`plugin-src/host/**` 19、`plugin-src/client/**` 20、`test/**` 26、`package.json`/`README*`/`CHANGELOG.md`/`scripts/verify-package.mjs` 少数。

## 3. 高风险集成点（非机械冲突）

### 3.1 客户端设置 UI 被上游重构
上游新增 `plugin-src/client/bot-general-settings.js`、`bot-settings-tabs.js`、`panel-error-boundary.js`、`plugin-page.js`，并把各渠道面板搬进 tab 结构；fork 的人化设置（`humanize-settings.js`、`channels/shared/humanize-fields.js`、`bot-send-delay.js`）挂在**旧的**设置面板上。二十个 `plugin-src/client/channels/*/{api,index}.js` 属于双向改动，冲突会集中在「面板如何注册/挂载」这一层。
→ 处理原则：以上游新面板框架为准，把人化字段重新挂进去；不要为了少改而保留旧框架。

### 3.2 i18n 双轨
上游同时存在 `src/channels/shared/i18n*.mjs`（按渠道拆分，新增 diagnostics/image-input/matrix/email/permission 模块）与 `locale/{zh,en}.json`；fork 的 humanize 文案混在 `i18n.mjs`、`i18n-en/*`、`plugin-src/client/i18n.js` 里。②中只有 `i18n-en/shared-b.mjs` 是直接冲突，但**真正的风险是文案 key 静默丢失**（不冲突 ≠ 不丢）。
→ 处理原则：解冲突后逐 key 对比 `i18n` 集合，humanize 新增 key 必须全在。

### 3.3 上游 session-sync 演进 vs fork 的 wake/reclaim 扩展
`plugin-src/host/session-sync-coordinator.mjs` 是上游文件（fork 大幅改造）：上游 4.38 新增 `source.kind === 'schedule'` 的定时轮投递，fork 加的是 wake 轮 + reclaim/no_reply 静默语义。两者都要保留，且 fork 的改动需要向上游新结构迁移。
→ 关联：本次 return-file 修复让 GUI/wake 轮不再有产物通道，若后续要让 wake/schedule 轮也能投附件，需在合并后的新结构上单独做。

### 3.4 Telegram 分段/思考留痕
上游 4.38 有「长答案拆分」「思考过程留痕 + 展开开关（`thinking-traces`）」与私聊占位消息流程（#276）；fork 有模型驱动的 `message_break` 分段流式与 `segmented-streaming`。两套分段机制并存会造成「一条回复被拆两次」。
→ 需决策：保留哪一套（建议：保留 fork 的模型驱动分段用于 IM 人化，关闭/不启用上游的长答案拆分的重叠部分；或反之，废弃 fork 的 `segmented-streaming`）。这是本次合并最需要产品判断的一处。

## 4. 可精简候选（历史包袱）

| 候选 | 证据 | 建议 |
| --- | --- | --- |
| `pnpm-lock.yaml` | fork 新增（+1846 行），上游用 `package-lock.json`；两份 lock 并存 | **删**，统一到上游的 package-lock |
| `package.json` 的 `dsh.dshReleases` | fork 仍声明 0.1.2-alpha.4…0.1.5-alpha.1，实际跑在 0.2.0-rc.2 | 直接采用上游的 0.2.0-rc.2 声明 |
| 上游 `locale/*.json` 与 fork i18n 并存 | 两套 UI 文案来源 | 评估：humanize 文案是否并入 `locale/`，或维持 i18n-en 体系 |
| `message_break` / `segmented-streaming` vs 上游长答案拆分 | 两套分段机制 | 见 §3.4，二选一 |
| `new-message-policy.mjs` + 各 bridge 的排队逻辑（fork 独有） | 已验证与上游 4.34 的「per-bot queue and steer message modes」**职责重叠**：fork 定义 `ON_NEW_MESSAGE_MODES = interrupt\|queue\|steer`；上游 4.38 有 `src/channels/shared/busy-message-dispatcher.mjs`（`BusyMessageDispatcher` + `normalizeBusyMessageMode`）与 `bot-workspace-store` 的 `busyMessageModes` 每 bot 配置 | **建议删掉 fork 的实现，改用上游 `busyMessageModes`**（需核对语义差异：fork 的 `interrupt` 默认值 vs 上游的 queue/steer 两态） |
| `progress-status` 相关改动 | fork 的状态表情/进度上报 vs 上游 `status-reaction.mjs` 演进 + thinking-traces | 待评估：合并后重跑 `test/channels/shared/progress-status.test.mjs`，据结果决定保留范围 |
| docs 树（docs/features 24 篇 + docs/issues 30 篇） | 全是 fork 独有，无冲突 | 不动（可选后续归档） |

## 5. DSH API 缺口核对（已完成的初查）

- 上游 4.38.0 `package.json`：`dsh.dsh` 声明 = `0.2.0-rc.2`，`dshReleases["0.2.0-rc.2"] = compatible`；本机 dsh = `0.2.0-rc.2`。**无缺口风险**。
- 本机已核对存在：`ctx.tools.register/restrict/guard`、`ctx.systemPrompt.section/context`、`agent/inbox/claimed`、`agent.ctx`、`AssembleContext.agent`。
- 待 P2 逐项核对（上游新代码用到、本机未验证的）：desktop-panel 集成的宿主补丁接口、`locale/` 加载、email/matrix 渠道所需的宿主能力（本机未配置这些渠道，可先不启用）。

## 6. 下一步（P2 分批计划）

按「先合框架、再合渠道、最后合人化」的顺序分批提交，每批跑对应测试：

1. **P2-a 元数据与构建骨架**：`package.json`（取上游 + fork 名/版本）、删 `pnpm-lock.yaml`、`.gitignore`、`scripts/verify-package.mjs`、README/CHANGELOG。
2. **P2-b 共享层**：`src/channels/shared/*`（harness-client、text-harness-bridge、session-sync-registry、status-reaction、i18n、semantic/artifact、bot-workspace-store、control-command、injected-context）。
3. **P2-c host 层**：`plugin-src/host/**`（含 session-sync-coordinator、delivery-*、各渠道 production/rpc）。
4. **P2-d 渠道层**：telegram / feishu / qq / wecom / weixin / whatsapp / dingtalk / slack / discord 的 runtime 与 bridge。
5. **P2-e 客户端层**：`plugin-src/client/**`（设置面板框架 + 人化字段重新挂载 + i18n）。
6. **P2-f 人化模块**：`send-delay`、`typing-session`、`message-break`、`no-reply`、`im-send-tool`、`humanize-*`、`voice-format`。
7. **P2-g 测试与人化测试适配** → `npm run build` → 验证计划（见 plan.md）。

每批提交后运行该层的测试文件；跨层测试（`host.test.mjs`、`management-rpc.test.mjs`）放到 P2-g 统一跑。
