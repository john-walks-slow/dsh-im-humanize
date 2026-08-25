# Changelog / 更新日志

本文件记录 dsh-im 各正式版本的重要变化。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

This file records the notable changes in each dsh-im release. Its format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and its versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.6.0] - 2026-08-25

### Added / 新增

- 飞书、钉钉、Slack、Telegram、Discord 和 WhatsApp 现在会通过消息 Reaction 显示任务正在处理、成功或失败；Reaction 调用采用限时的尽力而为机制，不会阻塞正常回复。Slack App Manifest 同步加入 `reactions:write`，已有 App 需要重新授权或安装后再连接机器人。
  Feishu, DingTalk, Slack, Telegram, Discord, and WhatsApp now use message reactions to show processing, success, or failure. Reaction calls are time-bounded and best-effort, so they never block normal replies. The Slack App Manifest now includes `reactions:write`; existing Apps must be re-authorized or reinstalled before reconnecting the bot.

### Fixed / 修复

- 当交互答案提交或后续交互问题发送失败时，消息会保留失败 Reaction，不再被外层处理流程覆盖为成功状态。
  When submitting an interaction answer or presenting a follow-up interaction question fails, the message now retains its failure reaction instead of being overwritten as successful by the outer processing flow.

## [2.5.0] - 2026-08-25

### Added / 新增

- 插件设置页的 DSH-IM 品牌标题现在支持悬停或键盘聚焦显示当前插件版本。
  The DSH-IM brand heading in plugin settings now displays the current plugin version on hover or keyboard focus.
- 九种内置聊天渠道新增结构化消息失败报告：会针对 Harness 连接、模型、会话、输入和渠道投递等故障给出可执行的中英文提示，并附带错误码与参考号；机器人设置卡片也会显示最近一次消息处理失败。
  Added structured message failure reporting across all nine built-in chat channels, with actionable bilingual guidance for Harness connectivity, model, Session, input, and channel-delivery failures, plus an error code and reference ID; bot cards also show the latest message-processing failure.
- 微信机器人现在会在 Harness 处理消息期间显示“正在输入”，并在最终回复、交互问题、错误或任务停止前自动取消；输入状态接口不可用时仍会正常发送最终回答。
  WeChat bots now show a typing indicator while Harness processes a message and automatically cancel it before final replies, interaction questions, errors, or stopped turns; final answers still work when the typing API is unavailable.

## [2.4.0] - 2026-08-25

### Added / 新增

- 九种内置聊天渠道新增 `/version` 命令，可直接查看当前运行的 dsh-im 插件版本；该命令不会连接 Harness、创建 Session 或调用模型。
  Added a `/version` command across all nine built-in chat channels for displaying the running dsh-im plugin version without contacting Harness, creating a Session, or invoking the model.

### Changed / 变更

- 飞书原“修复卡片按钮”操作已更名为“补全权限”，并会同时增量申请读取用户消息内图片或文件所需的 `im:message:readonly`、上传机器人图片或文件所需的 `im:resource`，以及卡片回调；缺权提示会引导用户私聊执行 `/repair`，或在插件页面点击“补全权限”。界面会说明各自用途，并明确确认页只展示应用当前缺少的配置。
  The former Feishu **Repair card buttons** action is now **Complete permissions**. It incrementally requests `im:message:readonly` for reading images or files in user messages, `im:resource` for uploading bot-sent images or files, and the card callback. The UI explains each purpose and that the confirmation page shows only the app's currently missing items.
- 飞书 `/repair` 不再额外区分管理员和普通用户；所有通过当前机器人渠道访问策略的私聊用户都能发起修复，包括使用 `*` 开放访问的手动绑定机器人。
  Feishu `/repair` no longer defines a separate administrator role. Any direct-message user admitted by the current bot's channel access policy can start repair, including manually bound bots configured with `*` access.
- 飞书私聊重复发送普通 `/repair` 时会作废仍在等待授权的旧一次性链接并生成新链接，避免错误账号打开链接后继续复用已消耗的授权码；查询、二维码、验证和取消命令不会意外重启流程，已提交的平台更新也不会并发执行。
  Repeating bare `/repair` in a Feishu direct chat now invalidates a still-pending one-time authorization link and generates a fresh one, avoiding reuse after the link was opened under the wrong account. Status, QR, verify, and cancel commands do not restart the flow, and a platform update that has already been submitted is never duplicated concurrently.

## [2.3.0] - 2026-08-25

### Added / 新增

- 九种内置聊天渠道新增私聊批量输入命令：使用 `/batch` 暂存最多 10 条纯文字消息，使用 `/send` 按原顺序合并为一次 Harness 输入，或使用 `/cancel` 放弃当前批次；提交失败时会保留内容以便重试。
  Added private-chat batch input commands to all nine built-in chat channels: `/batch` collects up to 10 text-only messages, `/send` submits them in order as one Harness input, and `/cancel` discards the batch; failed submissions retain their content for retry.

## [2.2.1] - 2026-08-25

### Fixed / 修复

- WhatsApp 开放响应模式现在会处理已绑定账号自己在群聊中发出的消息，包括只有自己的群；出站文本消息会在发送前预留消息 ID，避免机器人回复的本地回显再次触发 Harness。
  WhatsApp Open responses now handles group messages sent by the linked account, including owner-only groups; outbound text message IDs are reserved before sending so local reply echoes cannot trigger Harness again.

## [2.2.0] - 2026-08-25

### Added / 新增

- 所有聊天渠道新增 `/reasoninglist`、`/reasonings` 和 `/reasoning` 命令，可查看当前模型支持的推理等级、切换指定等级或恢复模型默认值；`/model` 也支持在切换模型时同时指定推理等级。
  Added `/reasoninglist`, `/reasonings`, and `/reasoning` commands across all chat channels for listing the current model's reasoning efforts, selecting an effort, or restoring the model default; `/model` can also select a reasoning effort while switching models.

### Fixed / 修复

- 当浏览器使用不兼容的回环地址访问 Web 设置页并触发 RPC 403 时，插件现在会提供保留当前端口的 `localhost` 恢复入口，避免各 IM 渠道配置页面持续请求失败。
  When an incompatible loopback address causes RPC 403 responses in the Web settings UI, the plugin now offers a `localhost` recovery link that preserves the current port, preventing persistent request failures across IM channel settings.
- 微信长回复现在在桥接层和运行时统一按腾讯 iLink 的 1,800 字符限制分段发送，避免超长回复被平台拒绝或截断。
  Long WeChat replies are now split consistently at Tencent iLink's 1,800-character limit across the bridge and runtime, preventing oversized replies from being rejected or truncated.
- Telegram Bot API 无法连接时会给出明确的代理诊断提示，并补充 Node 环境代理、`HTTPS_PROXY` 和 `NO_PROXY` 的中英文配置说明。
  Telegram Bot API connection failures now provide actionable proxy diagnostics, with bilingual setup guidance for Node environment proxy support, `HTTPS_PROXY`, and `NO_PROXY`.

## [2.1.0] - 2026-08-24

### Added / 新增

- 飞书 `/m` 菜单升级为交互式助手中心，集中提供会话、工作区、Agent Preset 和模型下拉切换，以及新会话、任务停止、上下文压缩、补充指令、关注管理和归档显示控制。
  The Feishu `/m` menu is now an interactive assistant center with dropdowns for sessions, workspaces, Agent Presets, and models, plus controls for new sessions, task stopping, context compaction, steering, watch management, and archived-session visibility.

### Changed / 变更

- 飞书菜单按设置、会话和任务控制重新组织；`/m` 会发送一张新菜单卡片，卡片内的导航和配置操作会尽量原位刷新，减少聊天中的重复卡片。
  The Feishu menu is reorganized around settings, sessions, and task controls; `/m` sends a new menu card, while navigation and configuration actions refresh it in place whenever possible to reduce duplicate cards in chat.

### Fixed / 修复

- 加固飞书卡片回调的字段兼容、串行执行、重试去重、并发上限和超时降级，避免快速或重复点击造成重复操作、状态错乱或 Host 请求堆积。
  Hardened Feishu card callbacks with payload compatibility, serialized execution, retry deduplication, concurrency limits, and timeout fallbacks, preventing rapid or repeated clicks from duplicating actions, corrupting state, or exhausting Host requests.
- 改进飞书 Session 关注完成事件的基线、重连补偿和并发处理，避免错过完成通知、重复推送或阻塞无关 Session。
  Improved baselining, reconnect compensation, and concurrent handling for Feishu Session-watch completion events, preventing missed notifications, duplicate deliveries, and blocking between unrelated Sessions.
- 修复飞书 WebSocket 在握手阶段关闭时的清理竞态，并阻止任务或交互尚未结束时误建新 Session。
  Fixed the Feishu WebSocket cleanup race when closing during the handshake, and prevented new Sessions from being created while a task or interaction is still pending.

## [2.0.1] - 2026-08-24

### Fixed / 修复

- 机器人卡片的操作区域现在会在空间不足时自动换行，避免英文或其他较长本地化文案把操作按钮挤出可视区域。
  Bot-card actions now wrap when space is limited, preventing English or other longer localized labels from pushing actions out of view.
- 一个 IM 渠道激活失败时，Host 现在会记录错误并继续依次激活其他渠道，避免单个渠道的本地配置或初始化故障阻断其余渠道。
  When one IM channel fails to activate, the Host now logs the error and continues activating the remaining channels in order, so a channel-local configuration or initialization failure cannot block the others.

## [2.0.0] - 2026-08-24

### Added / 新增

- Discord 服务器文字和公告频道首次 @ 机器人后会创建原生 Thread；后续消息、流式回答和结果文件都留在该 Thread，并在重启、事件重放和并发创建时保持同一会话。
  The first bot mention in a Discord server text or announcement channel now creates a native Thread; follow-up messages, streamed replies, and result files stay in that Thread, with stable routing across restarts, event replays, and concurrent creation attempts.
- Telegram 新增原生 Rich Message：私聊使用可更新 Draft 并持久化唯一最终消息，群聊和 Topic 原位完成占位消息，同时保留 Markdown 结构、长内容拆分和确定性纯文本降级。
  Added native Telegram Rich Messages: private chats update a Draft and persist one final message, while groups and Topics finalize their placeholder in place, preserving Markdown structure, long-content splitting, and deterministic plain-text fallback.
- 新增机器人聊天消息的英文支持：Host 配置 `language: en`（或环境变量 `DSH_IM_LANGUAGE=en`）后，各渠道发送给用户的提示、命令帮助和交互消息会切换为英文；未设置或未收录的文案仍以中文原样输出，不影响现有中文用户。
  Added English support for bot chat messages: with `language: en` in the Host config (or the `DSH_IM_LANGUAGE=en` environment variable), prompts, command help, and interaction messages sent by every channel switch to English; unset or untranslated text is still sent verbatim in Chinese, so existing Chinese users are unaffected.

### Changed / 变更

- **重大变更：** Discord 服务器父频道中的任务现在默认迁移到机器人创建的 Public Thread。部署方需要启用 **Message Content Intent**，并授予 **Create Public Threads**、**Send Messages in Threads**、**Send Messages** 和 **Read Message History**；文件交付还需要 **Attach Files**。
  **Breaking:** Discord tasks started in server parent channels now move into bot-created Public Threads by default. Deployments must enable **Message Content Intent** and grant **Create Public Threads**, **Send Messages in Threads**, **Send Messages**, and **Read Message History**; file delivery also requires **Attach Files**.
- Harness 助手增量和最终回答现在保留 Markdown 呈现意图，Telegram 交付回执会记录 Rich、纯文本降级、失败或不确定终态，并避免重复最终消息。
  Harness assistant updates and final replies now preserve Markdown presentation intent; Telegram delivery receipts record Rich delivery, plain-text fallback, failure, or uncertain terminal outcomes without duplicating final messages.
- 统一各渠道共用的英文文案到共享词典，消除同名键在不同渠道词典中的重复定义。
  Consolidated English copy shared across channels into the shared dictionaries, removing duplicate keys that were defined in multiple channel dictionaries.

### Fixed / 修复

- 最终文本交付明确失败时会向渠道上层报告安全错误，同时仍然完成已登记结果文件的交付，不会重复运行 Prompt。
  Definite final-text delivery failures now surface a safe channel-level error while registered result files still settle, without rerunning the Prompt.
- 收紧 Host 语言值识别并修复 Discord、Slack、Telegram 等渠道的英文消息边界，未知语言继续可靠回退为中文。
  Hardened Host language-value recognition and English-message handling in Discord, Slack, Telegram, and other channels, while unknown languages continue to fall back reliably to Chinese.

## [1.5.0] - 2026-08-24

### Added / 新增

- Harness 返回的图片现在会在九个内置 IM 渠道中优先使用原生图片消息呈现；渠道不支持或明确拒绝图片发送时自动回退为文件附件。
  Images returned by Harness now prefer native image messages across all nine built-in IM channels, with automatic file-attachment fallback when a channel does not support or definitively rejects image delivery.

### Changed / 变更

- 统一结果文件与图片的发送、交付回执、失败提示和资源释放，并在发送结果不确定时避免补发文件造成重复消息。
  Unified result-file and image sending, delivery receipts, failure notices, and resource cleanup, while avoiding duplicate file fallback when an image delivery result is uncertain.

## [1.4.0] - 2026-08-24

### Added / 新增

- QQ 最终回答现在支持 Markdown；长回答会尽量按代码块和 GFM 表格边界切分，平台拒绝 Markdown 时自动回退为纯文本。
  QQ final answers now support Markdown; long answers are split around code blocks and GFM tables where possible, with automatic plain-text fallback when QQ rejects Markdown.

### Changed / 变更

- QQ 私聊把进度和最终答案收束在一个回复气泡中，群聊只发送最终答案；工具失败会附在最终回答中，避免成功工具和状态消息刷屏。
  QQ private chats keep progress and the final answer in one reply bubble, while group chats send only the final answer; tool failures are appended to the final response without spamming successful tool or status messages.
- 长 QQ 回答使用唯一消息序号并避开被动回复额度，降低重复去重和超额发送失败。
  Long QQ answers use unique message sequence numbers and avoid passive-reply quotas, reducing duplicate suppression and over-quota delivery failures.

## [1.3.0] - 2026-08-23

### Added / 新增

- 九个内置 IM 渠道现在都能接收普通文件，并把文件随同用户消息安全地交给当前 Harness Session。
  All nine built-in IM channels can now receive ordinary files and safely pass them with the user message to the active Harness Session.

### Changed / 变更

- 统一入站文件的提前下载、工作区暂存、路径保护、失败提示和 Turn 结束清理，并继续由各消息平台决定文件类型、数量和大小限制。
  Unified inbound-file prefetching, workspace staging, path protection, failure messages, and end-of-Turn cleanup, while leaving file type, count, and size limits to each messaging platform.

## [1.2.0] - 2026-08-23

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

[Unreleased]: https://github.com/xmanrui/dsh-im/compare/v2.6.0...HEAD
[2.6.0]: https://github.com/xmanrui/dsh-im/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/xmanrui/dsh-im/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/xmanrui/dsh-im/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/xmanrui/dsh-im/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/xmanrui/dsh-im/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/xmanrui/dsh-im/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/xmanrui/dsh-im/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/xmanrui/dsh-im/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/xmanrui/dsh-im/compare/v1.5.0...v2.0.0
[1.5.0]: https://github.com/xmanrui/dsh-im/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/xmanrui/dsh-im/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/xmanrui/dsh-im/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/xmanrui/dsh-im/compare/v1.1.0...v1.2.0
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
