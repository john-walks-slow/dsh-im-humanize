# 拟人化设置逐 bot 全量覆盖 + 面板格式统一 · 总结

- 日期：2026-09-10（任务 B 重构）/ 2026-09-09（任务 A 计划）
- 状态：已实施，待用户验证 / 提交
- 计划：[260909-humanize-per-bot-all.plan.md](./260909-humanize-per-bot-all.plan.md)
- 检视：[260909-humanize-per-bot-all.review.md](./260909-humanize-per-bot-all.review.md)
- 验证：[260909-humanize-per-bot-all.validation.md](./260909-humanize-per-bot-all.validation.md)

## 背景与诉求

1. **任务 A**：「拟人化设置整体（而不只是发送延迟），都要支持逐 bot 级的配置」。后端逐键替换模型（`humanize` 段存在的 key 覆盖全局、缺失的继承）早已存在，本次把 UI 从 sendDelay-only 开放到全部 8 项。
2. **任务 B**（用户验收反馈）：「全局设置和 perbot 设置的详略度和格式咋不一样…这应该可以复用吧」。两面板此前是两套独立实现：全局是密集单行活跃曲线 + 长提示；per-bot 是精简提示 + NumberField 网格，且 per-bot 残留旧「整体替换」文案、断续节奏「跟随全局」提示硬编码出厂默认而非解析后的全局值。

## 实现

### 任务 A：逐 bot 全量覆盖（8 项）

- `src/channels/shared/bot-workspace-store.mjs`：`withHumanizeDefaults` 投影完整 `normalizeHumanizeSettings(settings)`（原来只带 sendDelay）。
- 7 个渠道 `api.js` normalizer：`humanizeDefaults` 整对象直通（原来是只挑 sendDelay 的重投影）。
- 7 个挂载点（token/qq/weixin/wecom/dingtalk/feishu/whatsapp）：`BotSendDelayEditor` → `BotHumanizeEditor`，prop `sendDelayDefaults` → `humanizeDefaults`。
- `BotHumanizeEditor`（bot-send-delay.js）：布尔 4 项三态 select、枚举 2 项三态 select、typingBurst/sendDelay 「自定义」checkbox 门控；`deriveDraft`/`buildPayload` 只写自定义 key（或 null 清除）；`countOverrides` 徽标「已覆盖 N 项」。

### 任务 B：共享字段模块（格式统一）

- **新建 `plugin-src/client/channels/shared/humanize-fields.js`（564 行）**，单一来源：
  - `HUMANIZE_SETTING_META`（6 标量项 label/hint/options）、`SHIPPED_HUMANIZE_DEFAULTS`（8 项出厂默认镜像）、`resolvedHumanizeDefaults()`；
  - `SEND_DELAY_PRESETS`（4 探索预设）+ `SendDelayPresetSelect`；
  - `draftFromConfig`/`burstDraftFrom`（wire ms → 字符串草稿，cap/activityBoost 缺失回落出厂默认）；
  - `FieldError` + `parseSeconds/parseMinutes/parseRate/parseMs` + `validateSendDelayDraft`/`validateBurstDraft`（全部范围与交叉校验）；
  - 纯 props 组件 `FieldErrorText`/`NumberField`/`TypingBurstFields`/`SendDelayFields`（无 hooks，`{draft, busy, errors, onField}`）。
- `bot-send-delay.js` 重写为薄包装（810→419 行）：三态门 + 覆盖徽标 + 渠道能力注释是仅有的 per-bot 特有 UI；修复两处旧文案 bug（残留「整体替换」语义 → 「自定义项保存后固定为本页值；未自定义项继续跟随全局设置变化。」；断续节奏「跟随全局」提示从硬编码出厂值改为解析后的全局值）。
- `humanize-settings.js` 重写（590→273 行）：RPC 外壳保留；sendDelay/typingBurst 改为字符串草稿 + **保存时统一校验**（原来无校验、依赖服务端拒绝），错误就地显示；成功后 `adoptSettings(updated)` 重置草稿；标量布尔/枚举从 META 渲染。行为与 per-bot 编辑器完全对齐。
- `scripts/verify-package.mjs`：审计清单同步（humanize-settings 6→1、bot-send-delay 4→2、新增 humanize-fields 2；注意审计按**源码字面量**计数——布尔开关 map 单字面量渲染 4 次，bundle 产物中同为 1 处字面量，两侧计数口径一致）。

### 关键设计决策

- **共享彻底性**：字段布局、提示文案、预设、上限常量、校验错误全部只在 humanize-fields.js 存在一处；两面板的差别只剩包装语义（全局=直接编辑值；per-bot=跟随全局/自定义门）。后续任何字段增删只改共享模块 + verify-package 清单。
- **浏览器安全**：共享模块只 import browser-safe 的 send-delay.mjs / typing-session.mjs；全量默认值在客户端镜像（SHIPPED_HUMANIZE_DEFAULTS），不拉入 humanize-settings.mjs 的 node:fs。
- **受控组件无 hooks**：共享组件纯 props 驱动，状态机留在各面板（全局：useState 草稿 + 保存时校验；per-bot：draft + dirty 门控 re-sync useEffect 保草稿）。

## 验证与测试

- `npm run build` ✅；`node scripts/verify-package.mjs` ✅
- `node --test test/client-humanize-ui.test.mjs`：8/8 ✅（含新增的全局面板保存时校验、per-key 只写自定义项、草稿跨轮询保留、全局默认预填覆盖）
- 相关 10 个测试文件（override/settings/send-delay/bridge/standalone-bridges/qq/telegram-ui/discord-ui/dingtalk-ui/feishu-api）：0 fail
- 全量 `npm test`：2474 tests，2267 pass，6 fail + 200 cancelled —— 全部为改动前已存在的网络依赖用例（Discord API / device auth / SDK gateway；`git stash` 基线验证一致）

## 已知取舍

- 全局面板发送延迟/断续节奏从「输入即生效到 state」改为「保存时校验」：非法值不再依赖服务端拒绝后才报错，而是保存前就地拦截——与 per-bot 一致，属预期行为变化。
- per-bot sendDelay 覆盖仍要求完整（宿主 `requireCompleteSendDelay`）：共享表单总是携带全部子字段，天然满足。
