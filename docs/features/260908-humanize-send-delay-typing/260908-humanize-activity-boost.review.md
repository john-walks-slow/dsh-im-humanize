# r6 活跃响应（activityBoost 替代 idleBoost）代码检视报告

## 概要

本检视覆盖从 `readDelay.idleBoost`（闲置加成）到 `readDelay.activityBoost`（活跃响应）的全局语义替换，涉及 24 个文件、~1018 行新增 / ~489 行删除。核心逻辑在 `src/channels/shared/send-delay.mjs`，桥接层 6 个 `#idleMsFor` 统一 null 语义，客户端全局面板与 per-bot 编辑器同步更新，配置继承/校验/归一化对齐，文档与测试配套。

**结论：有条件通过（条件见 §0 阻塞问题）。**

---

## 0 阻塞问题

**无。** 未发现数据损坏、逻辑错误、安全缺陷或导致生产环境行为异常的缺陷。

---

## 1 曲线正确性（B1）

### 1.1 `activityBaseDelayMs` 四段曲线

| 区间 | idleMs 条件 | 返回 | 用户直觉 |
|------|------------|------|----------|
| 秒回 | idle < fastWindowMs (60s) | `min(fastReplyMs, minMs)` | ≈1 秒回 |
| 线性回升 | fastWindowMs ≤ idle < minWindowMs (120s) | `fastMs + (minMs - fastMs) × progress` | 1–2 分钟回升 |
| 下限 | minWindowMs ≤ idle < fullWindowMs (300s) | `minMs` | 2–5 分钟取下限 |
| 完整区间 | idle ≥ fullWindowMs 或 null | `null` → uniform(minMs, maxMs) | >5 分钟完整随机 |

全部通过已验证（`node -e` 曲线验证 + 测试断言）。边界值：
- `idle=0` → `fastMs` ✓
- `idle=60000` (fastWindow) → `fastMs` ✓
- `idle=90000` (mid-ramp) → 3000 (5k→1k 半程) ✓
- `idle=120000` (minWindow) → 5000 (minMs) ✓
- `idle=300000` (fullWindow) → `null` ✓
- `idle=null` → `null`（首条消息不加速）✓
- `idle=-5000` → `fastMs`（负值 clamp 到 0）✓

### 1.2 `fastMs = min(fastReplyMs, minMs)` 截断

当 `fastReplyMs > minMs` 时，活跃响应基础延迟也不会高于阅读延迟下限（"活跃响应只缩短"）。测试已在 `activity boost stays out of the way` 用例中覆盖。✓

### 1.3 阅读项叠加

`readingMs = length / charsPerSecond × 1000` 在 `baseMs` 之上叠加，受 `maxTotalMs` 与 `channelCapMs` 封顶。与旧 idleBoost 行为一致，仅乘数项变为活跃曲线。✓

---

## 2 验证/归一化一致性（B2）

### 2.1 严格校验（`validateSendDelayConfig`）

- `activityBoost` 必须为对象（非空非数组）
- `enabled` 必须为布尔（非 undefined 时）
- `fastReplyMs` 上限 60s；三个窗口上限 1 天
- 三窗齐全时检查 `fastWindowMs ≤ minWindowMs ≤ fullWindowMs`
- 校验只在字段 present 时执行（全局 store 支持部分更新）

### 2.2 宽容归一化（`normalizeActivityBoost`）

- `enabled` 默认 `true`（`source.enabled !== false`）
- 负值 clamp 到 0，超出上限 clamp 到上限
- **乱序窗口排序修复**（`sort((a,b) => a-b)`），而非拒绝
- 旧 `idleBoost` 键被忽略（不读取）→ 回落新默认值

**一致性评估**：校验"三窗齐全才判序"与归一化"排序修复"的分离是合理的——校验用于 RPC/UI 写入（拒绝明显错误），归一化用于磁盘读取（修复合并冲突）。旧 `afterMs` 同样无 min 下限检查，模式一致。

### 2.3 配置覆盖（`inheritSendDelayBase`）

`humanize-override.mjs` 的 `inheritSendDelayBase` 对 `activityBoost` 做子字段级合并：

```js
activityBoost: {
  ...base.readDelay?.activityBoost,
  ...config.readDelay?.activityBoost,
}
```

- 当 override 只写 `{fastReplyMs: 500}` 时，其余字段继承 base ✓
- 当 base 和 override 均无 activityBoost 时，两分支均不进入，顶层 `readDelay` 保持无 activityBoost，后续 `normalizeSendDelayConfig` 用默认值补齐 ✓
- 测试已覆盖部分子字段合并场景 ✓

---

## 3 回归风险（B3）

### 3.1 `idleMs` 语义变化（核心风险）

| 旧语义 | 新语义 |
|--------|--------|
| 默认 `idleMs = 0` | 默认 `idleMs = null` |
| `0` = "没闲置" → 无 idleBoost | `null` = "无记录" → 完整随机区间 |
| 有记录时返回 `≥0` 毫秒 | 有记录时返回 `≥0` 毫秒 |
| `idleBoost` 阈值制：超过 afterMs 才 ×N | 连续曲线：从 fastMs 到 uniform |

**影响**：6 个桥接的 `#idleMsFor` 统一改为"无记录返回 `null`"（之前返回 `0`）。所有调用站点已更新：

| 文件 | 状态 |
|------|------|
| `qq-bridge.mjs` | ✅ 已改 |
| `weixin-bridge.mjs` | ✅ 已改 |
| `dingtalk-bridge.mjs` | ✅ 已改 |
| `wecom-bridge.mjs` | ✅ 已改 |
| `feishu/bridge.mjs` | ✅ 已改 |
| `text-harness-bridge.mjs` | ✅ 已改 |

**第三方桥接风险**：若有外部桥接调用 `computeReadDelayMs` 或 `applyReadDelay` 且传入了 `idleMs=0`（旧默认），现在 idleMs=0 意味着"刚聊完天"（秒回区间），而非"无闲置"。这是预期的语义反转，但需注意。

### 3.2 旧 idleBoost 配置迁移

磁盘上的 `idleBoost` 键在归一化时被忽略，回落新 `activityBoost` 默认值。CHANGELOG 标记为 breaking 并给出迁移指引。链路：

```
配置加载 → normalizeHumanizeOverride → normalizeSendDelayConfig
  → `source.readDelay?.activityBoost` 为 undefined
  → 使用 DEFAULT_READ_DELAY.activityBoost（默认启用，1s/1min/2min/5min）
```

### 3.3 全局面板"顺手修复"

旧全局面板将 idleBoost 写入 `sendDelay.idleBoost`（顶层），而非 `sendDelay.readDelay.idleBoost`——该字段从未生效。新 panel 写入 `sendDelay.readDelay.activityBoost`，新增 UI 测试断言该写入路径。✓

### 3.4 全量回归测试

- 55 个人性化套件测试全绿 ✓
- 2266/2468 通过（200 预置 cancelled + 1 预置 DingTalk 时序抖动 + 1 skipped，均非本改动引入，通过 stash 回退验证确认）✓
- `verify-package.mjs` 通过 ✓
- `npm run build` 通过，lib/ 产出与 source 一致 ✓

---

## 4 客户端 UI 一致性（B4）

### 4.1 全局面板（`humanize-settings.js`）

- 新增启用 checkbox（`type: 'checkbox'`, aria-label `'启用活跃响应'`）
- 新增三个分钟窗口输入 + 一个秒级快速回复输入
- 秒输入 `step=0.5`，分钟输入 `step=1`（默认值均为整数分钟，无实际问题）
- `activityBoostOf(settings)` 当 `settings.sendDelay.readDelay.activityBoost` 缺失时回落 `ACTIVITY_BOOST_DEFAULTS`
- ✅ 写入路径：`updateActivityBoost` → `prev.sendDelay.readDelay.activityBoost[field]`（校验正确）

### 4.2 Per-bot 编辑器（`bot-send-delay.js`）

- 新增 `actOn`/`actFast`/`actFastWin`/`actMinWin`/`actFullWin` 五个草稿字段
- `validateDraft` 在窗口不递增时报错（`actFastWin > actMinWin || actMinWin > actFullWin`）
- `draftFromConfig` 回退 `DEFAULT_SEND_DELAY_CONFIG.readDelay.activityBoost` 当配置缺失时
- ✅ 保存时写入完整 `activityBoost`（5 字段）

### 4.3 `verify-package.mjs` checkbox 清单

| 文件 | 旧计数 | 新计数 | 实际 |
|------|--------|--------|------|
| `humanize-settings.js` | 3 | 4 | 4（streaming, messageBreak, sendDelay.enabled, activityBoost.enabled）|
| `bot-send-delay.js` | 1 | 2 | 2（sendDelay.enabled, actOn）|

✅ 通过。

### 4.4 i18n

新增 `'秒'`/`'分钟'` 独立键（翻译为 `'s'`/`'min'`），用于面板的 `aria-hidden` 分隔符和标签。grep 确认无键冲突。✓

---

## 5 测试覆盖分析（B5）

### 5.1 新增/修改测试

| 文件 | 增量 | 覆盖 |
|------|------|------|
| `send-delay.test.mjs` | +2 tests（18→20） | 曲线四段 + null/禁用/越下限截断 + 乱序修复 + 旧键忽略 + channelCap 与活跃共存 |
| `humanize-override.test.mjs` | 修改继承用例 | activityBoost 子字段合并 + 部分覆盖 |
| `humanize-bridge.test.mjs` | +1 test（13→14） | 首条消息完整区间、随后消息秒回快于下限 |
| `client-humanize-ui.test.mjs` | 修改 5 处 fixture | 活跃面板渲染 + 写入位置断言 + 单选定位器避让新 checkbox |

### 5.2 测试覆盖缺口

| 场景 | 现有覆盖 | 建议 |
|------|---------|------|
| 三个窗口相等（degenerate） | 隐式（排序后相等，ramp 分母为 1） | 可接受（归一化保证不崩） |
| `fastReplyMs > minMs` 截断 | 已覆盖（`clamped` 用例） | ✅ |
| 部分继承（手写 path / 混用） | 部分覆盖于 override 测试 | 已覆盖 `partialBoost` 用例 |
| 全局面板初始保存不含 activityBoost | 隐式（host 归一化补齐） | 可接受 |
| `idleBoost` 旧键完全忽略 | 已覆盖（`legacy` 用例） | ✅ |

**结论**：覆盖充分，无实质性缺口。

---

## 6 文档准确性（B6）

| 文件 | 准确性 | 备注 |
|------|--------|------|
| `CHANGELOG.md` | ✅ | idleBoost deprecated + activityBoost 新增，breaking 标记 |
| `README.md` / `README.en.md` | ✅ | activityBoost 描述准确，默认值列齐 |
| `summary.md` | ✅ | 新增"活跃响应改造"章节，设计/兼容性/测试完整 |
| `validation.md` | ✅ | 新增 4 项活跃响应验证场景 |
| 前次 `review.md` | 不涉及 | 未修改 |

### 6.1 文本小瑕疵

- `text-harness-bridge.mjs` 的 JSDoc（第 735–738 行）仍写 "for the sendDelay idle boost"，应改为 "activity boost" 或 "activity curve"。内联注释（第 740 行）已正确写 "activity boost"。

---

## 7 非阻塞建议

### P4-1: `activityBaseDelayMs` 重复归一化

`computeReadDelayMs` 已归一化 `cfg`，但 `activityBaseDelayMs` 内部再次调用 `normalizeSendDelayConfig`。虽保证幂等，但每次调用多一次对象构造。建议：将 `activityBaseDelayMs` 改为接受已归一化的 `cfg`（或内联到 `computeReadDelayMs` 中）。

### P4-2: `activityBaseDelayMs` 未使用的 `random` 参数

函数签名接受 `random` 但从未使用（曲线是确定性的）。建议移除。

### P4-3: `text-harness-bridge.mjs` JSDoc 措辞更新

`(for the sendDelay idle boost)` → `(for the sendDelay activity boost)`

### P4-4: `minutesInputValue` / `minutesOf` 精度与 step 不匹配

`Math.round(ms / 6000) / 10` 可产生 0.5 步长（如 30000ms → 0.5 分钟），但 HTML `<input step=1>` 暗示整数分钟。默认值均为整数分钟，无实际影响。建议将 step 改为 `0.5` 或保持分钟输入为整数。

---

## 8 最终结论

| 维度 | 评分 | 说明 |
|------|------|------|
| 曲线正确性 | ✅ 通过 | 四段曲线与边界值全部验证，无偏差 |
| 校验/归一化一致性 | ✅ 通过 | 严格校验 + 宽容归一化合理分离，乱序修复与旧键忽略正确 |
| 回归风险 | ✅ 低风险 | 6 桥接统一更新，旧 idleBoost 键被忽略，pre-existing 测试失败无关 |
| 客户端 UI | ✅ 通过 | 面板与编辑器字段完整，写入路径正确，verify-package 通过 |
| 测试覆盖 | ✅ 充分 | 曲线/边界/禁用/null/legacy 全部覆盖，UI 写入位置断言 |
| 文档准确性 | ✅ 通过 | 仅有 1 处 JSDoc 措辞未更新（P4-3） |

**结论：有条件通过。** 无阻塞问题，4 项 P4 非阻塞建议不影响功能正确性，可根据维护节奏择机处理。