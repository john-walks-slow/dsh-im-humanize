# 合并进度日志（rebase-upstream-4.38）

工作分支：`rebase-upstream-4.38`（基于 `v4.38.0`），worktree `.worktrees/merge-upstream-4.38`。
基线：上游 `v4.38.0` = `9353109`；fork 侧 delta 取 `f434ca0..main`。

## 批次进度

| 批次 | 内容 | 状态 |
| --- | --- | --- |
| P2-a | 元数据与构建骨架（package.json 身份/dsh 声明、删 pnpm-lock、.gitignore、README×2、CHANGELOG、AGENTS.md、cordis.patch.yml） | ✅ 完成 |
| P2-b | 共享层 `src/channels/shared/**` | 待办 |
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

## 待决问题（P2-f 时处理）

1. **`interrupt` 模式**：上游 `busyMessageModes` 只有 `queue` / `steer` 两态，fork 的 `onNewMessage` 默认值是 `interrupt`（新消息取消在途回合 + 静默退场）。删除 `new-message-policy.mjs` 后，若仍要 `interrupt`，需要以「在上游 `BusyMessageDispatcher` 上补第三态」的小补丁方式实现，而不是恢复整个平行模块。P2-f 前需明确取舍。
2. README 里「新消息行为 `onNewMessage` … 上游仅 queue」的表述、以及「修复的缺陷（上游 bug）」里针对 v4.13.0 的历史条目，在 P2-f 落地后需同步更新（避免用户文档与实现不符）。
3. `progress-status` 相关断言与上游 `status-reaction` / thinking-traces 的关系，留到 P2-g 跑测试后再定保留范围。
