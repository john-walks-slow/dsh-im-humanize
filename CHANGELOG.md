# Changelog / 更新日志

本文件记录 dsh-im 各正式版本的重要变化。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

This file records the notable changes in each dsh-im release. Its format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and its versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added / 新增

- WhatsApp 新增仅自己、指定联系人和开放响应三种访问模式；旧机器人和新接入机器人均默认仅响应账号自聊。
  Added Only me, Selected contacts, and Open responses access modes for WhatsApp; existing and newly linked bots now default to self-chat only.

## [1.1.0] - 2026-08-23

### Added / 新增

- 新增 Harness 结果文件的原生交付能力，支持通过钉钉、Discord、飞书、QQ、Slack、Telegram、企业微信、微信和 WhatsApp 返回文件。
  Added native delivery of Harness result files through DingTalk, Discord, Feishu, QQ, Slack, Telegram, WeCom, Weixin, and WhatsApp.
- 新增统一的结果文件快照、交付回执、失败分类与消息 ID 追踪。
  Added unified result-file snapshots, delivery receipts, failure classifications, and message ID tracking.

### Changed / 变更

- 压缩机器人连接元数据布局，并统一各频道卡片的反馈样式。
  Compacted bot connection metadata and unified feedback styling across channel cards.
- 将 Agent Preset 使用说明移入可访问的帮助提示。
  Moved Agent Preset guidance into an accessible help tooltip.

### Fixed / 修复

- 改进微信对 Harness 访问失败、回环地址拒绝和健康检查错误的提示。
  Improved Weixin messages for Harness access failures, loopback denials, and health-check errors.

## [1.0.2] - 2026-08-22

### Fixed / 修复

- 飞书 REST 请求和 WebSocket 连接现在都会遵循系统代理设置。
  Feishu REST requests and WebSocket connections now honor system proxy settings.

## [1.0.1] - 2026-08-22

### Fixed / 修复

- 改进微信对 Harness 健康检查失败的分类和安全提示。
  Improved the classification and safe messaging of Harness health-check failures in Weixin.

## [1.0.0] - 2026-08-22

### Added / 新增

- 新增 `/presetlist` 与 `/preset` 聊天命令，可查看和切换 Agent Preset，并支持恢复跟随 Host 默认值。
  Added `/presetlist` and `/preset` chat commands for viewing and switching Agent Presets, including returning to the Host default.

## [0.19.0] - 2026-08-22

### Added / 新增

- Telegram 启动时注册命令菜单和菜单按钮。
  Telegram now registers its command menu and menu button when the bot starts.
- 飞书新增群聊响应模式配置和群消息权限授权流程。
  Added configurable group response modes and group-message permission authorization for Feishu.

## [0.18.0] - 2026-08-22

### Added / 新增

- 支持为每个机器人独立选择 Agent Preset，并完成创建、持久化和会话启动生命周期。
  Added per-bot Agent Preset selection across bot creation, persistence, and session startup.

## [0.17.1] - 2026-08-21

### Fixed / 修复

- 当模型不支持图片输入时，各频道会返回更明确的提示。
  Channels now provide clearer feedback when a model does not support image input.

## [0.17.0] - 2026-08-21

### Added / 新增

- 飞书新增持久化 Session 关注、完成推送和菜单入口。
  Added persistent Session watches, completion notifications, and a watch menu entry for Feishu.
- 飞书 Session 列表支持关注按钮、归档标记和 `/archived on|off` 切换。
  Feishu Session lists now include watch buttons, archived badges, and the `/archived on|off` toggle.

### Fixed / 修复

- 改进飞书关注完成消息的可靠交付和重连补偿。
  Improved reliable delivery and reconnect compensation for Feishu watch completions.

## [0.16.0] - 2026-08-21

### Added / 新增

- 飞书新增交互式菜单卡片、Session/工作区列表卡片和一键回调修复。
  Added interactive menu cards, Session and workspace list cards, and one-click callback repair for Feishu.

### Fixed / 修复

- 改进飞书交互卡片回调的可靠性。
  Improved the reliability of Feishu interactive-card callbacks.

## [0.15.0] - 2026-08-21

### Changed / 变更

- 将 AI Office 连接器标记为实验性功能。
  Marked the AI Office connector as experimental.

### Fixed / 修复

- 改进微信机器人激活失败的分类和提示。
  Improved classification and messaging for Weixin bot activation failures.

## [0.14.0] - 2026-08-21

### Added / 新增

- 新增 AI Office 连接器，并支持在 Harness 中执行 Office 任务。
  Added the AI Office connector and support for executing Office jobs in Harness.
- 加强 Telegram 私聊访问控制。
  Strengthened access control for Telegram private chats.

### Changed / 变更

- 更新插件品牌、README 视觉和 AI Office 配置示例。
  Updated plugin branding, README visuals, and the AI Office configuration example.

## [0.13.0] - 2026-08-20

### Added / 新增

- 支持通过编号选择模型。
  Added model selection by list number.

### Changed / 变更

- 完善机器人交互、多机器人能力和频道配置文档。
  Expanded documentation for bot interactions, multi-bot support, and channel setup.
- 加强发布包检查，避免捆绑 DSH 运行时包。
  Strengthened package verification to prevent bundling DSH runtime packages.

## [0.12.0] - 2026-08-20

### Added / 新增

- 新增模型查看、模型切换、停止和引导当前 Turn 的聊天命令。
  Added chat commands for listing and switching models, stopping work, and steering the active Turn.

### Changed / 变更

- 改进 npm 安装文档、包元数据和项目徽章。
  Improved npm installation documentation, package metadata, and project badges.

## [0.11.0] - 2026-08-19

### Added / 新增

- 建立统一 IM 插件的首个保留标签版本，集中管理飞书、微信、钉钉、企业微信、QQ、Slack、Telegram、Discord 和 WhatsApp。
  Established the first retained tag of the unified IM plugin, covering Feishu, Weixin, DingTalk, WeCom, QQ, Slack, Telegram, Discord, and WhatsApp.
- 支持多机器人、工作区切换、Session 列表与绑定、Harness 交互和审批、图片输入及连接测试。
  Added multi-bot support, workspace switching, Session listing and binding, Harness interactions and approvals, image input, and connection tests.
- 支持按 Harness 默认 Agent Preset 创建 IM Session。
  Added IM Session creation using the Harness default Agent Preset.

### Changed / 变更

- 完成双语 README、插件品牌、深色主题和紧凑机器人卡片。
  Added a bilingual README, plugin branding, dark-theme support, and compact bot cards.
- 改进 npm 发布包结构，保留 CLI 入口并避免安装脚本拦截。
  Improved npm package contents to preserve the CLI entry point and avoid install-script blocking.

[Unreleased]: https://github.com/xmanrui/dsh-im/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/xmanrui/dsh-im/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/xmanrui/dsh-im/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/xmanrui/dsh-im/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/xmanrui/dsh-im/compare/v0.19.0...v1.0.0
[0.19.0]: https://github.com/xmanrui/dsh-im/compare/v0.18.0...v0.19.0
[0.18.0]: https://github.com/xmanrui/dsh-im/compare/v0.17.1...v0.18.0
[0.17.1]: https://github.com/xmanrui/dsh-im/compare/v0.17.0...v0.17.1
[0.17.0]: https://github.com/xmanrui/dsh-im/compare/v0.16.0...v0.17.0
[0.16.0]: https://github.com/xmanrui/dsh-im/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/xmanrui/dsh-im/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/xmanrui/dsh-im/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/xmanrui/dsh-im/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/xmanrui/dsh-im/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/xmanrui/dsh-im/releases/tag/v0.11.0
