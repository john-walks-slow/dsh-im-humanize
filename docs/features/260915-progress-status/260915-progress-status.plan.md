# 过程进度提示开关（progressStatus）· 实施计划

日期：2026-09-15。基线：dsh-im-humanize fork（上游 xmanrui/dsh-im v4.13.0）。

用户诉求（原话）：「telegram 渠道会有『正在处理，正在整理消息』之类的气泡。这有点影响拟人，加一个开关支持禁用这些。」——裁定为**加全局拟人化开关 `progressStatus`**（默认 `true` 兼容现状）。

## 1. 问题根因（已逐一核实代码事实）

### 1.1 三类「过程进度」气泡

| 来源 | 文本 | 触发点 |
|---|---|---|
| 流式占位初态 | `正在处理…` / `正在思考中…` / `已连接 DeepSeek Harness，正在思考…` / `正在生成…` | 流式通道（openDeliveryStream/openStream）开启时立即发出的占位消息 |
| 工具调用进度 | `正在使用{name}…` / `_正在搜索网络并整理信息…_` | HarnessClient 下发 `{type:'tool'}` 时桥接 onUpdate 编辑占位消息 |
| 工具结果进度 | `正在整理结果…` | HarnessClient `tool/result` 下发 `{type:'status'}` 时编辑占位消息 |

### 1.2 各渠道表现

| 渠道 | 桥接 | 占位机制 | 进度文案门控点 |
|---|---|---|---|
| Telegram | 共享 TextHarnessBridge | 私聊 Rich Draft / 群聊占位消息（sendMessage 后 edit） | `openDeliveryStream`（runtime:696/700）+ onUpdate（bridge:1008） |
| WhatsApp | 共享 | createEditableMessageStream（create 初始 '正在处理…'） | openStream（runtime:514）+ onUpdate（bridge:1008） |
| Discord | 共享 | createEditableMessageStream | openStream（runtime:481）+ onUpdate（bridge:1008） |
| Slack | 共享 | createSlackMessageStream（startStream 立即建消息） | openStream（runtime:370）+ onUpdate（bridge:1008） |
| 飞书 | 自有 | VerifiedFeishuChannel 流式卡（初始 `已连接…正在思考…`） | bridge `#progressText`（:4927）→ `controller.setContent`（:4421） |
| 钉钉 | 自有 | createDingTalkCardStream（初始 `CARD_INITIAL_TEXT`） | bridge `progressText`（:416）→ `cardStream.push`（:1484） |
| 企微 | 自有 | replyStreamNonBlocking（初始 `正在思考中…`） | bridge `thinkingProgressText`（:368）→ streamThinkingText（:1545） |
| QQ | 自有 | 无流式占位；仅透出 `update.error` | 已天然无过程气泡，无需改动 |
| 微信 | 自有 | 非流式一次性交付 | 已天然无过程气泡，无需改动 |
| AI Office | 自有 | job 执行器进度展示（office-job-executor:304） | **本特性不动**：任务进度是 AI Office 产品核心 UX，非拟人聊天场景 |

## 2. 新设置键

| 键 | 类型 | 默认 | 语义 |
|---|---|---|---|
| `progressStatus` | boolean | `true` | 关闭后：不发占位气泡与中间进度文案；流式文本仍正常逐字显示；messageBreak 模式下连带跳过占位流（消除"占位气泡 + 分段消息"的内容重复） |

接入既有拟人化设置体系（与 `statusReaction`/`replyQuote` 同级）：
- 全局 `~/.dsh/integrations/dsh-im/humanize.json`
- 每机器人覆盖 `workspaces.json` 的 `humanize` 节（数据模型 + UI 全开放）
- 生效时机：下一条消息起（桥接逐回合活读 provider）

## 3. 实施点

### 3.1 设置链路（progressStatus 键贯通）
1. `src/channels/shared/humanize-settings.mjs`：DEFAULT_HUMANIZE_SETTINGS + normalizeHumanizeSettings + validateHumanizeUpdate + 头注释
2. `src/channels/shared/humanize-override.mjs`：normalizeHumanizeOverride + validateHumanizeOverrideSection（含键白名单数组）
3. `src/channels/shared/humanize-resolver.mjs`：resolver 输出
4. `plugin-src/host/index.mjs`：HUMANIZE_CONFIG_KEYS 转发
5. `plugin-src/host/humanize-rpc.mjs`：SETTABLE_KEYS 白名单
6. `plugin-src/client/channels/shared/humanize-fields.js`：HUMANIZE_SETTING_META（label/hint）+ SHIPPED_HUMANIZE_DEFAULTS
7. `plugin-src/client/humanize-settings.js`：全局面板 BOOLEAN_SETTING_KEYS（自动渲染 checkbox）
8. `plugin-src/client/channels/shared/bot-send-delay.js`：逐 bot 编辑器 BOOLEAN_KEYS（自动渲染三态 + 自动写入 payload）
9. `plugin-src/client/i18n.js`：英文翻译

### 3.2 共享桥接层（Telegram/WhatsApp/Discord/Slack）
`src/channels/shared/text-harness-bridge.mjs`：
- **流开启（:905-926）**：
  - `progressStatus===false && messageBreak` → 不开流（分段由 messageBreakHandler 直发；尾段走 `!streamFinished` 的 sendDelivery/sendText 既有路径，消除占位气泡 + 内容重复）
  - `progressStatus===false && !messageBreak && streaming` → 以 `{ lazy: true }` 开流
- **onUpdate（:1008）**：`progressStatus===false` 时丢弃 `tool`/`status` 更新（仅保留 `text`/`assistant-message`）

### 3.3 懒建流（消除占位初态，保留流式文本）
- `src/channels/shared/editable-message-stream.mjs`：新增 `lazy` 选项——`start()` 不建消息；首条 `update`/`finish` 用真实文本 `create` 建消息，后续 `edit`。WhatsApp/Discord 共用。
- `src/channels/telegram/telegram-runtime.mjs` `openDeliveryStream(target, { lazy })`：
  - 私聊 Rich Draft：lazy 时跳过初态 `stream.update('正在处理…')`（draft 在首条真实更新时自然创建）
  - 群聊占位：lazy 时延迟 `sendMessage` 占位；首条 `update` 用真实文本建消息；`finish` 在无占位时改走 `#sendRich` 新发
- `src/channels/slack/slack-runtime.mjs` `createSlackMessageStream({ ..., lazy })`：lazy 时延迟 `startStream`；首条 `update` 建流并设 `appended` 为首段全文；`finish` 在未建流时走 sendText

### 3.4 自有桥接渠道（飞书/钉钉/企微）
- `src/channels/feishu/bridge.mjs` onUpdate（:4419）：`progressStatus===false` 时跳过 `tool`/`status` 的 `controller.setContent`（仅文本透出）
- `src/channels/dingtalk/dingtalk-bridge.mjs`：onUpdate（:1484）跳过 `tool`/`status` 的 `cardStream.push`；卡片初始文本改按 `progressStatus` 取 `…` 或 `CARD_INITIAL_TEXT`
- `src/channels/wecom/wecom-bridge.mjs`：初态 `streamThinkingText`（:1380）按 `progressStatus` 取 `''` 或 `正在思考中…`；onUpdate（:1545）`else` 分支在 disabled 时不更新

## 4. 取舍与边界

- **AI Office 不受影响**：任务进度展示是该产品核心 UX。
- **QQ/微信已天然无过程气泡**：不改。
- **飞书卡片初始文案**：`VerifiedFeishuChannel` 的 `initialText` 为启动期构造参数（runtime:302 一次设置），非逐回合；本次仅抑制逐回合进度文案，卡片初始 `已连接…正在思考…` 保留（首条文本流入即被覆盖，非持续性气泡）。
- **流式文本本身保留**：`progressStatus` 只管"过程进度"，不管"逐字流式"——后者由 `streaming` 控制。
- **statusReaction 不受影响**：表情回应（处理中/成功/失败 emoji）由 `statusReaction` 独立控制，本特性只管文字气泡。

## 5. 测试

- 设置链路：override/settings/resolver 新键白名单、normalize、per-bot merge
- 桥接：progressStatus=false → onUpdate 不透出 tool/status；messageBreak 模式不开流
- 懒建流：editable-message-stream lazy（首条 update 建消息、finish 未建流时新发、cancel 未建流时无残留）
- Telegram：lazy rich-draft（跳过初态）+ lazy regular（延迟占位、finish 新发）
- 客户端 UI：META 含 progressStatus、全局面板 + per-bot 编辑器自动渲染、verify-package 计数不变（无新 checkbox 字面量）
- 运行基线：`env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u NODE_USE_ENV_PROXY`；cancelled 基线零新增
