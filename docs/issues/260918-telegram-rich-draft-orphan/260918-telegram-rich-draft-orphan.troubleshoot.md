# 260918 Telegram 私聊回复重复两条（draft 残留 + rich 终稿）根因分析

## 现象

yu（mimitchi_yui_bot，私聊 direct:6110538394）19:31 对「今天就玩！」（turn 42）的回复在 Telegram 中出现**两条**，文本逐字相同，仅换行渲染不同：

- 第一条：段落间为空行（`\n\n` 原样保留）——未渲染形态
- 第二条：段落间单换行（`\n`）——markdown 渲染后形态（段落塌缩）

## 证据链

### 确认的事实

1. session 日志（/tmp/yu-session.jsonl）turn 42 只有一个 turn、一个 step、一份 assistant 文本（含 `\n\n`），19:31:03 正常 completed。无第二个 turn。
2. 该回复走的是 **IM 回复流式路径**（非 wake）：user 消息 source.kind=user + rpcId=telegram-*，经 `consumeDshImInputOrigin` 判定 origin='im'，session-sync 协调器对 'im' origin **不投递任何内容**；wake 路径（source.kind∈{plugin,subagent-settled}）与 dsh 镜像路径（带 `[DSH 助手]` 前缀）均与两条无前缀消息不符 → 协调器排除。
3. host 侧仅有的其他发送入口（dshIm.send RPC、proactive）本 turn 无调用；turn 42 无任何 tool call。
4. 私聊回复流：`openDeliveryStream` private 分支 = **Rich Draft 流**——streaming 期间每次 update 调 `sendRichMessageDraft`（同一 draft_id），finish 时 `#sendRich` → `sendRichMessage` 持久化唯一最终消息。
5. `toTelegramRichMarkdown`/`splitTelegramRichMarkdown` 只做实体转义，**不改换行**；`\n\n`→`\n` 的塌缩发生在 Telegram 服务端渲染（GFM 段落块）。`#call` 无重试；`TelegramDeliveryStream` 保证 finish/fail 互斥、update 错误吞掉。
6. 官方 Bot API 10.2（2026-07-14）语义：`sendRichMessageDraft` = **ephemeral 30 秒临时预览**，"disappear after a short time or if the bot sends a message"；bot 必须 `sendRichMessage` 持久化唯一最终消息；无显式清除 draft 的 API。
7. 穷尽静态分析：当前代码（= 19:31 运行版，20:44 提交仅改 no_reply 静默轮）**单次回复流不存在任何能先发 plain 全文、再发 rich 全文的路径**。桥接 finish 失败兜底走 `sendDelivery`（仍是 rich）；`#sendRich` 的 plain 兜底只在确定性失败后触发且不会再发 rich；fail 路径只发错误文案。

### 结论

第一条 = turn 42 的 **Rich Draft 预览残留**（最后一次 draft 更新已携带完整文本，以未渲染/预览形态呈现，故 `\n\n` 可见）；第二条 = finish 的 `sendRichMessage` 唯一最终消息（渲染后段落塌缩）。

设计上 draft 应在"bot 发消息"时消失——本次未被清除（孤儿 draft），以可见形态持久存在。dsh-im 侧无双重发送；孤儿成因在 Telegram 服务端对 draft 的清除/提交环节（偶发，功能自 08-24 上线以来用户首次观察到，与偶发特征一致；上游 draft 生命周期近期连续修过 #199/#175/"stop live drafts" 等，属活跃雷区）。

### 未决点（置信度 ~85%，触发原因待实机日志）

- 为什么该次 draft 未被最终消息清除：服务端偶发 bug / 竞态（最后一条 draft 更新与最终消息的服务端处理顺序）/ 其他契约缺口，无法远程取证（bot 不能读聊天历史，回执不落盘，插件 console 未进 /var/log/dsh.log）。

## 待用户零成本验证

1. 长按/引用第一条：能否正常回复、复制消息链接？（draft 残留可能缺正常 message id 行为）
2. 重启 Telegram 客户端或重开会话后第一条是否仍存在？（若消失 → 客户端态 draft；若仍在 → 服务端已提交）
3. 两条出现时间：19:31 同时出现，还是先后？（可滚动到当天时间分隔符确认）

## 修复路径（候选）

- A（推荐，根治且最小）：私聊停用 Rich Draft 流，`openDeliveryStream` private 分支回落到普通占位编辑路径（sendMessage 占位 + editMessageText 原位收敛）。消除整类 ephemeral 工件，行为与群聊一致。代价：失去打字预览 UX。理由：draft 生命周期 4 天内已引发 #199、PR-175、260918 no_reply 三轮修复，是不可控缺陷源；符合"够少而不是够多"。
- B（保守）：保留 draft，仅加投递调试日志（draft 更新/finish/降级各打一条到 stderr），重建并重启 dsh 后由用户触发复现，抓孤儿现场后定向上报上游。
- C：A + B 结合：先落日志观察，确认后再裁剪 draft。

## 验收标准

- 私聊回复在 Telegram 中始终恰好一条持久消息；不再出现未渲染换行形态的重复条目。
- （选 B/C）日志能完整记录每次 draft 更新与最终发送的方法/回执。
