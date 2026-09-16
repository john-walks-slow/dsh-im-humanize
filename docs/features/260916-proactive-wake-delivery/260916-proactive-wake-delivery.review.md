# 检视报告

- **日期**：2026-09-16
- **检视对象**：唤醒回合同步投递（session-sync-coordinator origin 扩展）+ `send_im` 模型工具（未提交工作树改动）
- **范围排除**：`src/channels/shared/message-break.mjs`、`test/message-break.test.mjs`（他人未提交改动，不检视；但其对构建产物的影响见 S1）

## 概要

实现与计划（plan.md A/B 两案）高度一致，代码质量良好：origin 门控扩展最小化且局部化，wake 路径与 dsh 镜像路径职责拆分清晰，`send_im` 工具完全复刻 message-break 工具的既有模式（定义/安装器/order 117 顺延）。核心事件形状已对照宿主权威源码核实（`@deepseek-ai/dsh-agent-loop` 的 `source.plugin` 字段、`turn/end` reason `{kind:'completed'}`、`turn/start → step/start → user/message(append) → assistant/message → turn/end` 顺序、dsh-proactive `framing.ts` 的 `plugin: "dsh-proactive"`），无运行时阻塞问题。主要风险集中在构建产物：混入了他人未提交的 message-break 文案与 pnpm/npm 环境漂移。

## 需求对齐

| 项 | 结论 |
| --- | --- |
| A. 唤醒回合投递 | ✅ `WAKE_SYNC_PLUGINS` 白名单（coordinator:27）、`source.kind==='plugin'` 判 wake/other（:31-33）、assistant 正文累计条件扩为 `{dsh, wake}`（:150）、turn/end 拆分——dsh 路径原样保留 `[DSH 助手]` 前缀，wake 路径现查 `listSessionSyncTargets` 投递原文无前缀（:159-182），非 completed/无正文/查询失败跳过。与计划逐条对应 |
| B. `send_im` 工具 | ✅ 工具定义（botId/targetId/text 必填、失败 throw `send_im failed (code): msg`、signal 透传）、安装器（section `dsh-im:send-im` order 117）、host/index.mjs 两处注册点均按 `config.imSendTool !== false` 门控（默认开）。工具描述与 system prompt 均含「仅默认静默会话使用」约束 |
| 文档 | ✅ README fork 表 2 行、方案 §8.2 矩阵 plugin 行 + §8.3 新节，语义与实现一致（含 WAKE_SYNC_PLUGINS 扩展性说明） |
| 偏差 | ⚠️ Changes 描述称测试覆盖「查询失败不投递」，实际测试中 `listSessionSyncTargets` 从不抛错，该 catch 分支无覆盖（见 S3） |

**关键正确性核实**（对照宿主与 dsh-proactive 源码，非臆测）：

1. 字段名 `source.plugin`：`dsh-agent-loop` RuntimeContextProjection 构造 `source: { kind: "plugin", plugin: SOURCE }`；dsh-proactive `framing.ts`/`compact.ts` 用 `plugin: PROACTIVE_PLUGIN`（= `'dsh-proactive'`），与白名单值一致。仓内既有测试 fixture 用 `pluginId`（test/history-command.test.mjs:266 等）系陈旧写法，不影响本判定（未改动、不在范围）。
2. 事件顺序：agent-loop `turn()` 先 append 被认领的 inbox 消息（含 wake framing，设 origin='wake'）、再 append runtime-context 快照（system-prompt 插件，origin='other'）；coordinator 的 first-wins 语义下快照不会抢占 origin。
3. 无双投递：桥接回复链按 `promptRpcId` 认领（harness-client:432,586），wake framing 无 rpcId 无人认领，同步投递是唯一出口。
4. `复制调用参数` UI 真实存在（delivery-settings.js:548，复制 `{botId, targetId}` JSON），工具描述引用准确。

## 阻塞问题

无。

## 建议修改

| ID | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| S1 | lib/index.js（含 :168 附近） | 构建产物混入他人未提交改动：`npm run build` 在含 message-break 描述修改的工作树上执行，产物中出现 2 处 `"Do not use when the user message does not come from dsh-im"`（源文本在 src/channels/shared/message-break.mjs 的未提交改动里）。本次提交会使产物包含源码不在同一提交内的文本，造成源码-产物漂移；若对方改动最终不落地，产物将永久携带死文案 | 与 message-break 改动协调提交顺序：待其先行提交后再重建 lib/；或本次提交前在仅含本变更的工作树上重建产物 |
| S2 | lib/client.js、pnpm-lock.yaml（未跟踪） | 构建环境漂移：仓库以 npm 管理（package-lock.json 已跟踪），本次重建在 pnpm 下执行——client.js 的 diff 全部是 semver 模块路径注释 `node_modules/semver/...` → `node_modules/.pnpm/...` 的噪音（过滤后无任何实质变更），并引入未跟踪 pnpm-lock.yaml。提交后未来 npm 重建会把路径翻回来，造成反复 churn | 统一包管理器后重建：用 npm 重建使 client.js 恢复零 diff（首选）；或正式迁移 pnpm（提交 pnpm-lock.yaml、移除 package-lock.json）并在提交说明中写明 |
| S3 | test/session-sync-coordinator.test.mjs:209 | 「wake 查询失败不投递」分支未测：该用例的 `listSessionSyncTargets` 永不抛错，coordinator 新增的 catch/logFailure/return 路径（:175-181）无覆盖，与 Changes 描述不符 | 在该用例中追加一组 session：lookup 抛错 + 有正文 + completed，断言 sends 为空（约 6 行） |

## 非阻塞问题

| ID | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| N1 | src/channels/shared/im-send-tool.mjs:18,29 | 工具描述硬编码中文 UI 标签「复制调用参数」，而客户端有 i18n（英文环境显示 "Copy call parameters"，i18n.js:839）；英文部署下模型所见标签与用户界面文案不一致 | 可接受（描述目的是让模型识别用户粘贴的 `{botId, targetId}` JSON，中英任一均可匹配）；如要修，去掉中文括注或经 `setImHostLanguage` 取词 |
| N2 | plugin-src/host/index.mjs:180-182 | `imSend` 闭包与 apply() 中 `dshIm.provide` 的 send 闭包（:107-109）逐字重复（两处都是对 `deliveryService.send` 的必要绑定包装，因作用域不同而各自存在） | 可在 apply 中定义一次并传入 activateChannels 复用；现状可读性尚可，备忘 |
| N3 | README.md:64 | `imSendTool` 行未说明配置入口：该键不在 HUMANIZE_CONFIG_KEYS/拟人化面板中，只能通过插件 config 关闭，与表中其他面板可调项读法不同，用户会去面板里找 | 说明中补一句「经 dsh-im 插件配置关闭（`imSendTool: false`），非面板项」 |
| N4 | PROACTIVE_DELIVERY.md | 既有《主动投递使用指南》列举了 HTTP / `ctx.dshIm.send()` / RPC 三种调用方，未提 `send_im` 模型工具这一新调用方 | 可加一小节或交叉引用；feature 文档已覆盖，不强制 |
| N5 | 设计层面（im-send-tool） | 「仅静默会话使用」约束纯靠 prompt：模型在已开同步的唤醒回合（或正常 IM 会话）误用 send_im 会造成双投递（同步原文 + 工具消息各一条） | 计划已明确接受此权衡；若线上出现实际误用，可在 execute 内检测当前会话是否已有同步目标/绑定并拒绝，作为后续迭代项 |

## 准入结论

**结论**：`条件准入`

**说明**：功能实现正确、与计划及设计文档一致，核心事件形状已对照宿主与 dsh-proactive 源码逐项核实，无阻塞问题。建议合并前处理 S1/S2（构建产物混入他人改动与 pnpm/npm 环境漂移——影响提交干净度而非运行行为，S1 需协调 message-break 改动的提交顺序）并顺手补 S3 测试。

# 复核（针对 S1–S3 处理）

日期：2026-09-16。复核范围：仅 S1–S3 的处置，未重新检视未改动部分。

| ID | 处置 | 证据 |
| --- | --- | --- |
| S2 产物 pnpm 噪音 | **已修复** | 本功能改动全在 host 侧，client bundle 无实质变更；`git checkout -- lib/client.js` 还原后 client.js 恢复零 diff（此前 42 行 diff 全部为 `node_modules/semver` → `node_modules/.pnpm` 路径噪音）。lib/index.js 经查无 `.pnpm` 路径（`grep -c '\.pnpm/' lib/index.js` = 0），不受影响。pnpm-lock.yaml 保持未跟踪、不提交。 |
| S3 lookup 失败无覆盖 | **已修复** | `test/session-sync-coordinator.test.mjs` 追加用例「Session sync stays silent when the wake target lookup itself fails」：`listSessionSyncTargets` 抛错 + 有正文 + completed，断言 `sends` 为空且 warn 含 `ignored Session sync wake lookup failure`。coordinator + im-send-tool 共 11/11 全绿。 |
| S1 产物含他人未提交文案 | **延期至提交时协调** | message-break 改动非本会话所属（勿动），且线上 dsh 从本工作树加载产物——若现在 stash 重建会使线上暂时丢失该文案。处置：提交本功能前与用户协调——(a) message-break 改动先行单独提交后重建 lib/ 再提交本功能；或 (b) 本功能连同该文案一并提交（用户确认归属后）。不阻塞实机验证与重启生效。 |

## 复核结论

**结论**：`通过（S1 延期至提交时协调）`

**说明**：S2/S3 已落实并验证；S1 为提交顺序协调事项，不涉及运行行为，随提交步骤处理。可进入实机验证。
