# 拟人化设置逐 bot 级配置（全部设置，不只发送延迟）

日期：2026-09-09。基线：dsh-im-humanize fork（@xmanrui/dsh-im v4.13.0，`5f53d1e`）。

## 背景

原始方案（260908 plan §4.2 第 5 条）明确"不把 streaming/messageBreak/onNewMessage/typingIndicator/typingBurst 做成 per-bot UI（数据模型天然支持，v1 只开 sendDelay）"。现用户要求开放全部设置。

**后端已就绪**（无需改动）：
- `humanize-override.mjs`：`validateHumanizeOverrideSection` / `normalizeHumanizeOverride` 已校验全部 8 键（streaming, messageBreak, statusReaction, replyQuote, onNewMessage, typingIndicator, typingBurst, sendDelay）。
- `send-delay.mjs`：`mergeHumanizeSettings` 逐键替换。
- `humanize-provider.mjs`：`createHumanizeProvider` 合并全局 + per-bot。
- `BotWorkspaceStore.setHumanize` / `humanizeFor` / `decorateStatus`：per-bot 段读写已通。

**缺口在 UI 和快照投射**：
- `withHumanizeDefaults`（bot-workspace-store.mjs:1170）：只投射 `humanizeDefaults.sendDelay`，不投射其余全局默认值。
- 10 个 api.js normalizer：只透传 `humanizeDefaults.sendDelay`。
- `BotSendDelayEditor`：只暴露 sendDelay 字段，其余覆盖键保存时保留但不可编辑。
- 10 个渠道卡片挂载点：只传 `sendDelayDefaults`，不传完整 `humanizeDefaults`。

## 设计：逐项覆盖（per-key override）

每个设置行有独立的「自定义」checkbox。勾选时该设置的值控件激活、值写入覆盖段；未勾选时跟随全局（显示全局当前值作只读提示）。保存只写被勾选的键（或 null 清除全部）。

优点：匹配数据模型（逐键替换）、用户只改需要的项、sendDelay 仅在自定义时需完整填写。

### UI 结构

```
┌─ 拟人化 [跟随全局 / 已覆盖 N 项] ▾ ──────────┐
│  ☐ 自定义  流式回复        [☑ 开启]           │
│     (跟随全局: 开)                              │
│  ☐ 自定义  分步消息        [☑ 开启]           │
│     (跟随全局: 开)                              │
│  ☐ 自定义  状态表情回应    [☑ 开启]           │
│     (跟随全局: 开)                              │
│  ☐ 自定义  回复引用         [☑ 开启]           │
│     (跟随全局: 开)                              │
│  ☐ 自定义  新消息行为      [select]            │
│     (跟随全局: interrupt)                       │
│  ☐ 自定义  输入状态指示    [select]            │
│     (跟随全局: burst)                           │
│  ☐ 自定义  断续节奏        [4 number fields]   │
│     (跟随全局: 3000–6000/1500–4000)             │
│  ☐ 自定义  发送延迟        [full sendDelay form]│
│     (跟随全局: 未启用)                          │
│  [保存]  已保存/错误提示                        │
└────────────────────────────────────────────────┘
```

- 折叠标题改为「拟人化」（原「发送延迟」）。
- 状态标签：无覆盖 →「跟随全局」；有覆盖 →「已覆盖 N 项」。
- 保存逻辑：收集所有勾选「自定义」的键 → 若有键则保存部分段（只含自定义键）；若无键且有现存覆盖 → 保存 null 清除；若无键且无覆盖 → 保存按钮禁用。
- sendDelay 自定义时：预填全局 sendDelay 作起点，完整保存（`requireCompleteSendDelay` 仍生效）。
- typingBurst 自定义时：4 个 number 字段（毫秒），仅当 typingIndicator 不为 off 时有意义但独立保存。
- 渠道能力提示（无 typing 渠道「仅延迟生效、封顶 5s」）保留。

## 改动清单

### 1. 快照投射完整默认值

**`src/channels/shared/bot-workspace-store.mjs`** — `withHumanizeDefaults`：
- 改为投射完整的全局 humanize 设置对象（`normalizeHumanizeSettings(settings)`）作为 `humanizeDefaults`，而非只投射 `sendDelay`。
- 保持容错：source 异常时回退到不发 `humanizeDefaults`。

### 2. 客户端 normalizer 透传完整 humanizeDefaults

**10 个 api.js 文件**（token-api.js, telegram/api.js, discord/api.js, qq/api.js, weixin/api.js, wecom/api.js, dingtalk/api.js, feishu/api.js, whatsapp/api.js, slack/api.js）：
- 将 `isRecord(source.humanizeDefaults?.sendDelay)` 模式改为 `isRecord(source.humanizeDefaults)`，透传完整 `humanizeDefaults` 对象。

### 3. 逐 bot 编辑器演化

**`plugin-src/client/channels/shared/bot-send-delay.js`**：
- 组件重命名 `BotSendDelayEditor` → `BotHumanizeEditor`；保留 `BotSendDelayEditor` 作废弃别名 re-export。
- 新增 `humanizeDefaults` prop（完整全局设置对象，替代 `sendDelayDefaults`）。
- per-key 覆盖 UI：8 个设置各带「自定义」checkbox + 值控件。
- draft state：追踪每个设置的 custom 状态 + 值。
- 保存：收集 custom 键 → 构建 payload（sendDelay 用现有 `validateDraft` + `inheritSendDelayBase`）。
- 状态标签：「跟随全局」/「已覆盖 N 项」。
- 兼容旧 prop `sendDelayDefaults`（deprecated，从 `humanizeDefaults?.sendDelay` 推导）。

### 4. 渠道卡片挂载更新

**10 个挂载点**（token-channel.js + 9 个渠道 index.js）：
- `sendDelayDefaults: account.humanizeDefaults?.sendDelay ?? null` → `humanizeDefaults: account.humanizeDefaults ?? null`。
- 组件名 `BotSendDelayEditor` → `BotHumanizeEditor`（或通过别名兼容）。

### 5. verify-package manifest

**`scripts/verify-package.mjs`**：
- `['bot-send-delay.js', botSendDelaySource, { checkbox: N, switch: 0 }]` 更新 N。
- 文件名保持 `bot-send-delay.js`（避免改 verify 引用路径），或更新为 `bot-humanize.js` 并同步所有引用。

### 6. 全局面板提示文案

**`plugin-src/client/humanize-settings.js`**：
- 底部「按机器人单独覆盖发送延迟」提示 →「按机器人单独覆盖拟人化设置」。

### 7. 测试

**`test/client-humanize-ui.test.mjs`**：
- 现有 `BotSendDelayEditor` 测试适配新组件名/props。
- 新增：per-key 覆盖只保存被勾选的键；typingIndicator per-bot 覆盖；清除全部。

### 8. README

- 更新拟人化章节：per-bot 覆盖从「仅发送延迟」改为「全部设置」。

## 不做

- 不改后端校验/合并逻辑（已就绪）。
- 不改 RPC 端点/payload 格式（`bot.humanize.set` 已接受 `{botId, humanize}` 任意键组合）。
- 不改 `messageBreak` 工具注册闸门（仍全局）。
- 不改 office 渠道。
