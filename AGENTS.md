# dsh-im-humanize AGENTS.md

## 目标

xmanrui/dsh-im（npm 上游 `@xmanrui/dsh-im`，当前基线 4.21.2）的本地 humanize fork，包名 `@johnnren/dsh-im-humanize`。**不发 npm**，本地部署：web profile 中 `"@xmanrui/dsh-im": "link:/root/projects/dsh-im-humanize"`，dsh 直接加载本仓库构建产物（lib/）。核心定制：静默双工具（no_reply + 配合 dsh-proactive 的 reclaim 软约定）、session-sync 双向投递、多 channel IM 接入。

## 地图

- `plugin-src/host/` — host 侧插件源码；`build.mjs` esbuild 打包到 `lib/index.js`。关键文件：`session-sync-coordinator.mjs`（DSH↔IM 双向同步与 wake 投递）、`delivery-*`（投递服务）、`inbound-ttl-*`、`harness-connection.mjs`
- `plugin-src/client/` — web client bundle
- `src/channels/` — 各 IM channel 适配（telegram/feishu/qq/discord/dingtalk/slack/wecom/weixin/whatsapp/imessage…）与 `shared/`（`harness-client.mjs`、`no-reply.mjs`、`im-send-tool.mjs`、`message-break.mjs` 等）
- `test/` — node --test 测试（含 `test/channels/*/`）

## 开发与调试

- 构建：`npm run build`（client + host → `lib/`）；改 host/client 源码后必须重新 build
- 测试：`npm test` 全量；`node --test test/<file>.test.mjs` 单文件（推荐先孤立跑）
- **全量测试基线（预存 flaky，勿重复排查）**：全量 `npm test` 存在真定时器 flaky——集中在 device auth、lark SDK gateway、Discord/Dingtalk API 用例；典型表现为**个位数 fail + 约 200 个 cancelled**，且失败集每次运行略有不同。2026-09-18 实测基线：3074 tests / 2868 pass / 2 fail / 203 cancelled。
- 判定回归的标准方法：① `git stash` 后跑全量做基线对比（fail/cancelled 数与失败域一致即无回归）；② 或孤立跑目标 test 文件（flaky 不复现）。
- 改动生效：build 后需重启 dsh（link 部署无复制步骤；重启线上实例前须征得用户书面同意）。

## 规范

- `session-sync-coordinator` 直测时 origin 必须显式传参（`'dsh'`/`'wake'`）；生产路径 origin 由 `userInputOrigin` 从 `user/message` 的 `source.kind` 推导（plugin/subagent-settled → wake）。
- dsh-proactive 的 reclaim 工具名是**软约定**（`proactive_reclaim`，兼容旧名 `proactive_silence`）：humanize 只按 tool/call 事件里的名字识别，零硬依赖；wake 轮次含 reclaim 调用则整轮不投递文本。
- 上游同步：merge upstream 时注意 `package.json` 包名（fork 不回发 npm）与本地 humanize 定制冲突。
