# 合并上游 xmanrui/dsh-im 4.38.0（re-baseline）计划

- 日期：2026-10-10
- worktree：`/root/projects/dsh-im-humanize/.worktrees/merge-upstream-4.38`，分支 `merge-upstream-4.38`
- 目标版本：`v4.38.0`（= `9353109`；`upstream/main` 当前为 `bbafc99`，比 4.38.0 多一个 i18n 后缀修复）
- 状态：**P2 源码解冲突（批 a–f2）+ P3 测试适配 + P4 构建已完成**，逐批记录见 [log](261010-merge-upstream-4.38.log.md)；整棵 `test/` 已按同一条 re-baseline 规则重放并逐条适配（249 文件 / 4187 用例 / 3989 通过 / 5 个既有失败），`npm run build` 与 `verify-package` 通过。待用户书面确认后执行 P7（合并回 main、发布 `4.38.0-humanize.1`），P6 的实机验收（Telegram 流式/分段/语音/附件、Feishu 卡片、Web GUI 不调用 `dsh_im_return_file`）待重启 dsh 后由用户确认。
- 策略：已确认采用 B（re-baseline），并要求在重放过程中同步评估可精简的历史包袱

## 目标

把 fork `@johnnren/dsh-im-humanize` 的基线从上游 4.21.2 升到 4.38.0，完整保留 humanize 定制（拟人发送、message_break 流式分段、状态表情、引用回复、per-bot 覆盖、no_reply/reclaim 软约定、session-sync 双向投递、语音气泡、return-file IM 归属等），并保持 npm pre-release 可发布。

## 现状核实（git 事实，已实测）

| 事实 | 数据 |
| --- | --- |
| 上游基线（fork 上次合并的第二父提交） | `f434ca0`（chore(release): v4.21.2，2026-09-17） |
| 上游当前 v4.21.2 标签指向 | `34a370b`（**同日期同 message，不同 hash**） |
| `f434ca0` 是否在上游历史中 | **否** |
| `git merge-base main upstream/main` | `7d8f7b6`（release: prepare dsh-im 0.2.2，2026-08-16） |
| 上游 v4.21.2→v4.38.0 | 155 个非 merge 提交、443 个文件 |
| fork 相对 4.21.2 的自有改动 | `git diff f434ca0..main` = 205 个文件 |
| `git merge upstream/main` 的冲突面（已在 worktree 实测） | **270 个文件**（212 `.mjs`、37 `.js`、92 test、82 src、72 plugin-src、7 i18n、8+5 docs md、2 png） |
| fork delta ∩ 上游 delta（正确 base 下的真实冲突面） | **100 个文件** |

**关键发现：上游历史被重写过**（`f434ca0` 与其等价提交 `34a370b` 并存，前者不在上游历史里）。因此 git 把两边的合并基点退回到 0.2.2，直接 merge 会产生约 170 个**由错误基点制造的伪冲突**。

## 策略选择

### A. `git merge v4.38.0`（保留 fork 既有 merge 惯例）
- 优点：不重写 fork 历史；与上次 `7994e75 Merge upstream v4.21.2` 的做法一致。
- 缺点：270 个冲突文件，其中约 170 个是上面那条伪冲突；每个文件的三方基点都是 0.2.2 时代内容，人工判断成本高、易解错。

### B. re-baseline：以 v4.38.0 为新基线，重新应用 humanize delta（推荐）
```
git switch -c rebase-upstream-4.38 v4.38.0        # 全新基线
git diff --binary f434ca0..main -- <paths> > humanize.patch
git apply --3way humanize.patch                    # 以 4.21.2 内容为真实基点做三方合并
```
- 优点：冲突面收敛到 **100 个**真实冲突；基线干净线性（v4.38.0 + humanize），后续每次上游/本地改动都不再有巨大的历史噪声；天然的「fork 讲了什么」清单。
- 缺点：fork 的 main 历史被重写（若要 push 到 origin 需 force-push；origin 是自有 fork，无协作者）。需要处理 43fd516 已被上游包含的问题。
- 需排除路径：`lib/`、`worker/`、`plugin-src/client/**.js`（构建产物）、`package-lock.json`/`pnpm-lock.yaml`（以重装结果为准）、`.gitignore`、`package.json` 的 version 字段（fork 版本号方案不同）。

**推荐 B**，理由：伪冲突占比 63%，A 的人工成本里有大半花在辨认「这冲突根本不该存在」。

## 执行阶段

- **P0 准备**：worktree 已建；`node_modules` 用 symlink 复用主工作区（或 `pnpm install --frozen-lockfile`）；`acquire-port` 留给 e2e。
- **P1 分类**：把 205 个 fork delta 文件分成四类——① 上游未改（直接套用，无冲突）；② 上游已改（三方解冲突，100 个）；③ 构建产物（不套用，改由 `npm run build` 生成）；④ fork 独有文件（直接新增）。
- **P2 源码解冲突**（按模块分批提交，每批一个 commit）：
  1. `src/channels/shared/*`（humanize-*、send-delay、typing-session、text-harness-bridge、message-break、no-reply、im-send-tool、session-sync-*、semantic/artifact）
  2. 各渠道 bridge（telegram/feishu/qq/wecom/weixin/whatsapp/dingtalk/slack/discord/imessage）
  3. `plugin-src/host/*`、`plugin-src/client/*`（源码部分）
  4. `src/channels/shared/i18n*.mjs`、`plugin-src/client/i18n.js`（**key 集合取并集**，逐一核对 humanize 新增 key 不丢）
- **P3 测试**：上游新增/改写的测试取上游版本；fork 独有测试（`humanize-*.test.mjs`、`send-delay`、`typing-session`、`message-break`、`no-reply`、`session-sync-coordinator`、`segmented-streaming`、`progress-status` 等）重新适配到新基线。
- **P4 构建**：`npm run build` 重新生成 `lib/index.js`、`lib/client.js`；构建产物冲突**一律不手解**。
- **P5 元数据**：`package.json` 取上游依赖（`undici` 7.29.0→7.29.1、新增 `@matrix-org/olm`/`imapflow`/`mailparser`/`nodemailer` 等）但保留 fork 的 `name`/`version`/`description`/`author`/keywords 与 `link` 相关字段；`README*`/`CHANGELOG` 保留 humanize 段落。
- **P6 验证**：见下。
- **P7 交付**：合并回 main（`worktree-dev` 的 `merge-to-main.sh`，需用户同意）；发布 `4.38.0-humanize.1`（npm-publish 技能）。

## 需要专门决策的点

1. **43fd516 已在上游 4.38.0 中**：本次已移植到 4.21.2 基线上；re-baseline 时该 patch 会冲突，应**采用上游实现**，仅保留 fork 的 `as` 呈现模式与其提示词说明句（即 `docs/issues/261010-return-file-im-ownership/` 记录的内容在上游版本上重放）。
2. **DSH 宿主版本**：✅ 已核实无风险——上游 4.38.0 声明 `dsh.dsh = 0.2.0-rc.2`（`dshReleases["0.2.0-rc.2"] = compatible`），与本机 dsh 版本一致；fork 目前写的 0.1.x 声明直接换成上游的。
3. **fork 的 0.2 适配 vs 上游**：fork 已按 0.2 的 agent preset 声明式写法迁移；上游 4.38.0 是否有同名迁移需核对，避免两套共存。
4. 是否接受 fork `main` 历史重写（B 方案的前提）。

## 验证计划

1. `npm run build` 成功，`node scripts/verify-package.mjs` 通过。
2. 上游 4.38.0 的新增/改动测试：按模块分批跑（**不跑全量**），失败集与「纯 upstream v4.38.0 checkout」的失败集逐条比对，确认无 fork 引入的回归。
3. fork 定制测试：`humanize-*`、`send-delay`、`typing-session`、`segmented-streaming`、`message-break`、`no-reply`、`session-sync-coordinator`、`im-send-tool`、`outbound-artifact*`、`artifact-delivery` 全绿。
4. 用户实机：Telegram 私聊（流式草稿 + message_break 分段 + 语音气泡 + 文件附件）、Feishu 卡片、以及 Web GUI 非 IM 会话不使用 `dsh_im_return_file`。

## 风险与回退

- 风险：0.2.0-rc.2 宿主 API 缺口（最高风险项）、i18n key 丢失、humanize 与上游对同一函数的两种改法（如 streaming/进度上报）语义冲突。
- 回退：所有工作在独立 worktree 与分支内，main 不受影响；每阶段独立 commit，可逐段丢弃。
