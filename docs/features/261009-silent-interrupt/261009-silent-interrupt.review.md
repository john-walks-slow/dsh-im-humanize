# 检视报告（第二轮） · 打断静默化（interrupt supersede）

检视对象：`docs/features/261009-silent-interrupt/261009-silent-interrupt.plan.md` 对应的未提交工作区改动（15 个文件；`lib/index.js` 为 esbuild 构建产物，已确认与 `src/` 一致，不单独检视）。本轮为第一轮「不准入」后的复审。

## 概要

第一轮阻塞项 B1（钉钉调用不存在的 `cardStream.cancel()`）已按建议 (a) 正确修复：桥内留存最后一次推送到卡片的文本，superseded 时用该文本 `finish` 收尾，卡片不再残留在流式态。S1/S2 已落实，N1/N2/N3 已处理，N4/N5 按「记录/不改」处置且理由成立。**本轮无阻塞问题**；仅剩 2 项建议修改（1 项文档交叉引用、1 项实机验证依赖）与若干非阻塞记录。

## 需求对齐

- 目标 1（interrupt 静默）：共享桥 ✅、QQ ✅、企微 ✅、**钉钉 ✅（本轮修复）**、飞书/微信（本就无文案）✅。
- 目标 2（`/stop` 保留「已停止。」）：✅ `control-command.mjs:77` 不传 reason → `error.stopReason` undefined → 各桥照旧提示；既有 4 处断言仍然通过。
- 目标 3（其余失败路径不变）：✅ 非 `turn-stopped` 分支未改动；钉钉卡片 `finish` 失败仍由卡片流自身的 `fail('finish')` → `failAiCard` 兜底收尾，未新增悬挂态。
- 计划一致性：计划 §3.3「实施修订（检视后）」已记录钉钉/企微的收尾方式；§5.4 承诺的 QQ/钉钉/企微三条渠道用例现已齐备。

## 第一轮问题复核

| 第一轮 ID | 状态 | 复核证据 |
| --- | --- | --- |
| B1（阻塞）钉钉 `cardStream.cancel()` 不存在 | ✅ 已修复 | `dingtalk-bridge.mjs:1407-1410` 新增 `lastCardText`；`:1530` 在 `start` 前初始化；`:1584-1585` 在**每次真正推送**时同步记录（受 `progressStatus` 过滤后，与卡片实际内容一致）；`:1687-1696` superseded → `finish(lastCardText)`。全仓已无 `cardStream.*cancel` 调用（grep 为空）。 |
| S1 钉钉 superseded 用例缺失 | ✅ 已修复 | `test/channels/dingtalk/dingtalk-bridge.test.mjs:1825`：断言 `finishAiCard` 恰好 1 次、文案等于最后推送内容、不含「已停止」、无「已停止」文本发送。该用例在旧实现（no-op cancel）下会因 `finish` 次数为 0 而失败，确为有效回归护栏。 |
| S2 README 过度承诺 | ✅ 已修复 | `README.md:80` 改为「不再发送"已停止。"之类的提示……旧回合已定稿的分段消息、已产生的部分回答与已存在的流式载体不受影响」；`:101` 的 supersede 段落口径一致。 |
| S3 Telegram 私聊幽灵草稿（建议修改） | ⏳ 已转为验证项 | 落为 `validation.md` 验证项 2，需真机确认，见下 V1。 |
| N1 `stopReason` 总被定义 | ✅ 已按可选分支处置 | 用例更名为 `...leaves the stop reason undefined for a plain stop`（`test/channels/shared/harness-control.test.mjs`）。 |
| N2 `'superseded'` 双语义载体 | ✅ 已处理 | `new-message-policy.mjs:11-22` 注释显式区分 preAsk 的 `code='superseded'`，并指明只用 `isSupersededStop` 判 stop reason。 |
| N3 stopActiveTurn「首个原因胜出」 | ✅ 已处理 | `harness-client.mjs:1300-1301` 补注释说明。 |
| N4 部分回答仍会投递 | ✅ 已记录 | `validation.md`「已知边界」第 1 条。 |
| N5 QQ `stream` 死代码 | ✅ 记录不改（理由成立） | 非本次引入；删除会扩大 diff 并增加上游合并摩擦。 |
| N6 构建/重启提醒 | ✅ 已记录 | `validation.md`「需先让新构建生效」段。 |

## 阻塞问题

无。

## 建议修改

| ID  | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| R2-1 | `docs/features/261009-silent-interrupt/261009-silent-interrupt.plan.md:119` | 交叉引用失效：R2 写「本方案不处理（见 §3.3）」，但本轮在 §3.3 位置插入了「实施修订（检视后）」，原「备选方案与放弃原因」已顺延为 §3.4。读者按引用跳转会读到不相关章节。 | 把 R2 的引用改为「见 §3.4」（或直接写章节名）。顺手核一遍计划内其余 `§x.y` 引用是否仍指向正确章节。 |
| R2-2 | `docs/features/261009-silent-interrupt/261009-silent-interrupt.validation.md`（验证项 2） | 用户主场景（Telegram 私聊）的「幽灵草稿」尚未在真机确认：改动前 `finish('已停止。')` 会以 `sendRichMessage` 顺带清掉 30 秒 Rich Draft，改动后只走 `cancel()`（`telegram-runtime.mjs:540-542`，仅置位、不发请求），旧草稿清除改为依赖服务端语义（新回合使用**新的随机 `draftId`**，是否必然替换旧草稿在本仓库未被验证）。若残留可见，「感知不到打断」的用户诉求在这一条上未被证明达成。 | 合并后按 `validation.md` 验证项 2 在真机私聊实测一次并回填结果；若出现可见的幽灵预览，需要为取消路径补一次显式清理动作（例如发送一次空 draft）而非只 `cancel()`。这是交付前的验收依赖，不是代码缺陷。 |

## 非阻塞问题

| ID  | 位置 | 问题 | 建议 |
| --- | ---- | ---- | ---- |
| N7 | `src/channels/dingtalk/dingtalk-bridge.mjs:1693` | `lastCardText || t(CARD_INITIAL_TEXT)` 的回退分支实际不可达：进入该分支时 `cardStarted` 必为真（`:1687` 已提前 return），而 `lastCardText` 已在 `:1530` 被赋为 `initialCardText`（`t('…')` 或 `CARD_INITIAL_TEXT`，恒非空），后续 `progressText()` 也恒返回非空字符串。属用不到的防御性代码。 | 可简化为 `await cardStream.finish(lastCardText)`；若刻意保留以表达「卡片刚建即被取代」的兜底意图，建议加一行注释说明不可达，避免后续被误读为必要分支。 |
| N8 | `src/channels/dingtalk/dingtalk-bridge.mjs:1694` | 钉钉 superseded 卡片会以「最后一次卡片内容」定稿，因此当用户开启 `progressStatus=false` 时，卡片最终呈现的是**打断前的部分模型文本**（`progressText` 对 `type==='text'` 原样返回）；而 Telegram/Discord 等共享桥走 `cancel()` 语义。同为「静默」，钉钉会把半截回答固化成卡片正文，其他渠道不会。这是「无 cancel API」的必然取舍，但属渠道间行为差异。 | 无需改动，建议在 `validation.md` 或计划 §3.3 补一句说明该差异，便于日后排查「钉钉卡片为什么留了半句话」。 |
| N9 | 共享桥 / 钉钉 superseded 分支的提示抑制 | 与第一轮 N4 同源：抑制的只是「已停止。」提示，旧回合已产生的部分回答、已定稿分段、不可删除的流式载体仍可见。当前实现与计划 §2.1、README:101 口径一致。 | 无需改动；保持 `validation.md`「已知边界」的措辞，验收时按此解释用户观感。 |

## 准入结论

**结论**：`条件准入`

**说明**：第一轮阻塞项 B1 已正确修复且有有效回归护栏（钉钉用例在旧实现下必然失败），全量检查未发现新增阻塞问题；建议修改项仅 2 条（一处计划文档交叉引用 R2-1、一项真机验证依赖 R2-2），不构成合并障碍。合并可继续，但 R2-2（Telegram 私聊幽灵草稿）须在交付用户验收时按 `validation.md` 实测回填，才能判定「用户感知不到打断」这一原始诉求完整达成。
