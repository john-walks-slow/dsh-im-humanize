# Changelog

本文件记录 dsh-im 各正式版本的重要变化。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [1.1.0] - 2026-08-23

### Added

- 新增 Harness 结果文件的原生交付能力，支持通过钉钉、Discord、飞书、QQ、Slack、Telegram、企业微信、微信和 WhatsApp 返回文件。
- 新增统一的结果文件快照、交付回执、失败分类与消息 ID 追踪。

### Changed

- 压缩机器人连接元数据布局，并统一各频道卡片的反馈样式。
- 将 Agent Preset 使用说明移入可访问的帮助提示。

### Fixed

- 改进微信对 Harness 访问失败、回环地址拒绝和健康检查错误的提示。

## [1.0.2] - 2026-08-22

### Fixed

- 飞书 REST 请求和 WebSocket 连接现在都会遵循系统代理设置。

## [1.0.1] - 2026-08-22

### Fixed

- 改进微信对 Harness 健康检查失败的分类和安全提示。

## [1.0.0] - 2026-08-22

### Added

- 新增 `/presetlist` 与 `/preset` 聊天命令，可查看和切换 Agent Preset，并支持恢复跟随 Host 默认值。

## [0.19.0] - 2026-08-22

### Added

- Telegram 启动时注册命令菜单和菜单按钮。
- 飞书新增群聊响应模式配置和群消息权限授权流程。

## [0.18.0] - 2026-08-22

### Added

- 支持为每个机器人独立选择 Agent Preset，并完成创建、持久化和会话启动生命周期。

## [0.17.1] - 2026-08-21

### Fixed

- 当模型不支持图片输入时，各频道会返回更明确的提示。

## [0.17.0] - 2026-08-21

### Added

- 飞书新增持久化 Session 关注、完成推送和菜单入口。
- 飞书 Session 列表支持关注按钮、归档标记和 `/archived on|off` 切换。

### Fixed

- 改进飞书关注完成消息的可靠交付和重连补偿。

## [0.16.0] - 2026-08-21

### Added

- 飞书新增交互式菜单卡片、Session/工作区列表卡片和一键回调修复。

### Fixed

- 改进飞书交互卡片回调的可靠性。

## [0.15.0] - 2026-08-21

### Changed

- 将 AI Office 连接器标记为实验性功能。

### Fixed

- 改进微信机器人激活失败的分类和提示。

## [0.14.0] - 2026-08-21

### Added

- 新增 AI Office 连接器，并支持在 Harness 中执行 Office 任务。
- 加强 Telegram 私聊访问控制。

### Changed

- 更新插件品牌、README 视觉和 AI Office 配置示例。

## [0.13.0] - 2026-08-20

### Added

- 支持通过编号选择模型。

### Changed

- 完善机器人交互、多机器人能力和频道配置文档。
- 加强发布包检查，避免捆绑 DSH 运行时包。

## [0.12.0] - 2026-08-20

### Added

- 新增模型查看、模型切换、停止和引导当前 Turn 的聊天命令。

### Changed

- 改进 npm 安装文档、包元数据和项目徽章。

## [0.11.0] - 2026-08-19

### Added

- 建立统一 IM 插件的首个保留标签版本，集中管理飞书、微信、钉钉、企业微信、QQ、Slack、Telegram、Discord 和 WhatsApp。
- 支持多机器人、工作区切换、Session 列表与绑定、Harness 交互和审批、图片输入及连接测试。
- 支持按 Harness 默认 Agent Preset 创建 IM Session。

### Changed

- 完成双语 README、插件品牌、深色主题和紧凑机器人卡片。
- 改进 npm 发布包结构，保留 CLI 入口并避免安装脚本拦截。

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
