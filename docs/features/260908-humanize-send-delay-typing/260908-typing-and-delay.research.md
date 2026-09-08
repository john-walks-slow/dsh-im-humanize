# 拟人化发送延迟与非流式 Typing 指示器：平台能力与人类行为实证调研

- 调研日期：2026-09-08
- 项目：dsh-im-humanize（`src/channels/` 下 telegram / discord / whatsapp / slack / qq / weixin / wecom / feishu / dingtalk 九个渠道适配器）
- 用途：为两个拟人化功能的设计决策提供依据——
  1. **随机发送延迟**：回复生成完毕后，按可配置的随机时长（可能与回复长度相关）模拟真人打字/犹豫，再发送；
  2. **非流式 typing 指示器**：模型生成期间与模拟打字延迟期间，让渠道原生"正在输入"指示器持续、自然地保持显示。
- 事实核查方式：官方文档优先（直接抓取原文引用），社区/逆向资料标注可靠度等级。所有"不存在"的结论均附查证范围。

## 0. 摘要（TL;DR）

**平台能力（§1）**：九平台分三档——①有原生 typing API：Telegram（`sendChatAction` ≤5s、发消息即清除）、Discord（`/typing` 10s、官方口径克制但点名认可"慢计算"场景）、WhatsApp/Baileys（presence `composing` ~10s 有效期）、QQ（仅 C2C 单聊 `msg_type=6 input_notify` ≤60s）、微信 iLink（仅私聊 `sendtyping` status 1/2）；②无 typing 但有官方流式/打字机替代：企微智能机器人（流式回复 + `<think>` 思考标签）、飞书（CardKit 流式卡片）、钉钉（AI 卡片流式更新，「输入中」→「完成」）；③完全无能力：Slack（Socket Mode 只收不发，typing 帧为已弃用 RTM 专有）、企微 webhook、QQ 群聊/频道。网传"飞书 Typing API"为幻觉（404 已验证）。

**人类行为实证（§2）**：打字速度——桌面英文 4.3 字符/s、移动英文 3.0、中文拼音 0.3–1+ 字/s（多源 20–64 字/分）；IM 回复中位数 15s（92% ≤5min）；人类交互间隔**重尾**（对数正态/幂律），绝非均匀；感知最优延迟：短回复 1–2s、复杂回复 ~9s（2s 偏肤浅、>8–10s 转负）；**typing indicator 显著缓解长延迟负效应（Kim 2025）**；完整打字时长模拟反而有害（Schanke 2021 反例）；42% 真人回复拆多条连发。

**设计结论（§3）**：`uniform(min,max) + 长度/速率项 + maxTotalMs 截断` 是合理近似（和天然右偏，v2 可升级对数正态）；默认参数应使 P50 ∈ [2,6]s、P90 ≤ 12s；长度项默认关闭（长消息撞 `maxTotalMs` 天花板 = "卡住"感）；延迟必须与 typing 续期循环组合（Telegram 4s / Discord 5s / WhatsApp ~8s——**现仓库 20s 是 bug 须修** / QQ 50s / 微信 5s）；无 typing 渠道压短延迟（≤5s）；禁止故意打错字、禁止占位消息、禁止 Slack RTM。

---

## 1. 九个平台"正在输入 / presence"能力与语义

### 1.1 Telegram Bot API —— ✅ 一等公民，语义清晰

**API**：`sendChatAction`（[官方文档 §sendChatAction](https://core.telegram.org/bots/api#sendchataction)；因调研网络无法直连 core.telegram.org，原文经多个自动同步官方文档的库文档交叉验证：[aiogram](https://docs.aiogram.dev/en/v3.20.0/api/methods/send_chat_action.html)、[gramio](https://gramio.dev/telegram/methods/sendChatAction)、[R telegram.bot](https://search.r-project.org/CRAN/refmans/telegram.bot/html/sendChatAction.html)，措辞一致）。

官方语义（原文引用，译文附后）：

> "Use this method when you need to tell the user that something is happening on the bot's side. **The status is set for 5 seconds or less (when a message arrives from your bot, Telegram clients clear its typing status)**. Returns True on success."
> "We only recommend using this method when a response from the bot will take a **noticeable** amount of time to arrive."

关键结论：

| 维度 | 事实 | 来源 |
|---|---|---|
| 触发方式 | `sendChatAction(chat_id, action)`，HTTP 调用即可 | 官方文档 |
| 单次持续时长 | **≤ 5 秒** | 官方文档（句："The status is set for 5 seconds or less"） |
| 续期方式 | 5 秒内重复调用即重置计时；社区通行做法为每 ~4s 重发一次（gramio 官方示例用 4000ms 间隔循环） | 官方语义 + [gramio 文档](https://gramio.dev/telegram/methods/sendChatAction)、[telegraf#1801](https://github.com/telegraf/telegraf/issues/1801)（社区） |
| 发送后消失 | **机器人发出任何消息后，客户端立即清除 typing 状态**（官方明文） | 官方文档 |
| action 取值 | `typing`（文本）、`upload_photo`、`record_video`/`upload_video`、`record_voice`/`upload_voice`、`upload_document`、`choose_sticker`、`find_location`、`record_video_note`/`upload_video_note`——按"用户即将收到什么"选择 | 官方文档（action 参数说明） |
| 群聊/私聊 | 无聊天类型限制（`chat_id` 说明为"Unique identifier for the target chat or username of the target channel"）；私聊、群、超级群均可用；超级群话题用 `message_thread_id`；另有 `business_connection_id`（商家账号场景） | 官方参数表 |
| 速率限制 | `sendChatAction` 本身**无官方公布限额**；消息发送限额为：单聊 ≤1 msg/s、群 ≤20 msg/min、广播 ≤30 msg/s（免费档） | [Bots FAQ "My bot is hitting limits"](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this)（经 Web Archive 核对原文，与现网页一致） |

**设计启示**：Telegram 是实现本功能的最佳目标平台——模型生成期间 + 打字延迟期间以 ~4s 周期重发 `typing`；发送消息即自动清除指示器，天然语义正确。`action` 应按消息类型选择（文本用 `typing`，发图用 `upload_photo`），比一律 `typing` 更真实。

### 1.2 Discord Bot（REST）—— ✅ 可用，但官方口径克制

**API**：`POST /channels/{channel.id}/typing`（[官方文档 §Trigger Typing Indicator](https://docs.discord.com/developers/resources/channel#trigger-typing-indicator)）。

官方原文：

> "Post a typing indicator for the specified channel, **which expires after 10 seconds**. Returns a 204 empty response on success. Fires a Typing Start Gateway event. **Generally bots should not use this route.** However, if a bot is responding to a command and expects the computation to take a few seconds, this endpoint may be called to let the user know that the bot is processing their message."

| 维度 | 事实 | 来源 |
|---|---|---|
| 单次持续时长 | **10 秒**，无延长参数（discord.js 维护者确认："Discord has it documented at 10 seconds with no option to increase it"） | 官方文档 + [discord.js#10061](https://github.com/discordjs/discord.js/issues/10061) |
| 续期方式 | 重复调用；社区实践每 ~5s 一次（10s 过期，5s 续期留缓冲） | [Stack Overflow 77884689](https://stackoverflow.com/questions/77884689/trying-to-extend-the-typing-indicator-for-discord-bot)（社区） |
| 事件 | 触发 `TYPING_START` 网关事件（"Sent when a user starts typing in a channel"，含 `channel_id`/`user_id`/`timestamp`/`member` 字段） | [Gateway Events §Typing Start](https://docs.discord.com/developers/events/gateway-events#typing-start) |
| 发送后消失 | 官方只写"expires after 10 seconds"；客户端在消息到达时提前清除指示器为**客户端行为，官方未成文** | 官方文档 + 观察 |
| 权限 | 该端点**未标注权限要求**（2026-09 查证 docs.discord.com，端点说明中无权限条目） | 官方文档 |
| 速率限制 | 未公布该路由桶值；遵循通用限速协议（`X-RateLimit-*` 响应头、429 退避） | [Rate Limits 文档](https://docs.discord.com/developers/topics/rate-limits) |
| 群聊/私聊 | channel 维度端点，服务器频道与 DM 均适用 | 官方文档（channel 路径参数） |
| 官方态度 | "Generally bots should not use this route"——但"响应命令、计算需数秒"恰好是被官方点名的合理例外场景 | 官方文档（原文见上） |

**设计启示**：AI 网关"慢计算后回复"正是官方认可的使用场景。以 ~5s 周期重发即可全程覆盖；注意 5s 周期对限速头友好。官方反对的是无意义滥用，本功能用途合规。

### 1.3 WhatsApp（Baileys 协议库）—— ✅ 协议层支持，文档为库级 + 官方客户端 FAQ

**API**：`sock.sendPresenceUpdate(presence, jid)`，presence 取值 `available` / `unavailable` / `composing`（正在输入）/ `recording`（正在录音）/ `paused`（输入后停止未发送）（[Baileys 官方文档 Presence 页](https://baileys.wiki/features/presence)）。

Baileys 文档关键原文：

> "**Presence updates expire after approximately 10 seconds. If you want to sustain a `composing` indicator, you must call `sendPresenceUpdate` repeatedly.**"

| 维度 | 事实 | 来源 |
|---|---|---|
| 客户端指示器 | 真人视角：typing 指示器为三个点省略号，**单聊和群聊均显示，频道不显示** | [WhatsApp Help Center《About typing a message》](https://faq.whatsapp.com/1244276003970936)（官方） |
| 单次持续时长 | **约 10 秒**（协议 presence 有效期） | Baileys 文档（库级，协议逆向） |
| 续期方式 | 重复调用 `sendPresenceUpdate('composing', jid)` | Baileys 文档 |
| 发送后消失 | 发送消息后 composing 结束；`paused` 表示"打了字但没发"——可用于中途撤断时显式清除 | Baileys 文档（状态语义）；具体消失时机为客户端行为 |
| 群聊 | 可向群 JID 发 `composing`；官方 FAQ 确认群聊显示 typing 指示器。注意：接收方能否看到还受其隐私设置/在线订阅影响，社区报告存在差异，建议接入后实测验证 | 官方 FAQ + [Baileys#866](https://github.com/WhiskeySockets/Baileys/issues/866)（社区） |
| 运维注意 | `markOnlineOnConnect: false` 可避免 Baileys 会话被当作"桌面在线"从而压制手机端推送 | Baileys 文档 |
| 速率限制 | 协议无公开文档（逆向协议），Baileys 文档未给限额；按 ~10s 有效期，重发间隔 5–8s 为社区常见做法 | 社区实践 |

**官方 Cloud API 对照**（本项目用 Baileys，此为参照系）：Meta 官方 WhatsApp Business Platform 的 `typing_indicator` 随"标记已读"请求发送，**"The typing indicator will be dismissed once you respond, or after 25 seconds, whichever comes first."**（回复即消失，或最多 25 秒）——连官方 API 的 typing 也只支持一次性 ≤25s，不提供"持续保持"，重发是各端通行做法。来源：[Meta 开发者文档《Typing indicators》](https://developers.facebook.com/documentation/business-messaging/whatsapp/typing-indicators)。

**设计启示**：`composing` 循环重发（间隔 <10s）+ 发消息自然终止。语音回复场景可交替使用 `recording`，比 `composing` 更贴近"真人在录语音"。协议库能力稳定但属灰色地带——频率务必克制（对齐真人打字节奏，不需要更快）。

### 1.4 Slack（Socket Mode）—— ❌ 无 typing 能力，需明确降级

**结论：Socket Mode 无法发送 typing 指示器。**

证据链（全部官方/一手）：

1. **typing 帧是 RTM API 专有能力**。RTM 官方文档（[Legacy RTM API](https://docs.slack.dev/legacy/legacy-rtm-api/#typing-indicators)，原文）：
   > "Clients can send a typing indicator... `{"id": 1, "type": "typing", "channel": "C123ABC456"}`. This can be sent **on every key press in the chat input unless one has been sent in the last three seconds**... it will send a `user_typing` event to all workspace members in the channel."
   （客户端→服务端帧，服务端将其广播为 `user_typing` 事件；3 秒节流。）
2. **RTM 已是遗留 API，新应用无法使用**。同页原文：
   > "This API is ancient and the ways to access it have grown more limited over time... **Granular permission Slack apps cannot use the RTM API. Classic apps can, but be warned that they may no longer be created and are soon to be deprecated.**"
3. **Socket Mode 的 WebSocket 只收不发**。[Socket Mode 官方文档](https://docs.slack.dev/apis/events-api/using-socket-mode/)：
   > "Socket Mode allows your app to use the Events API and interactive features... Slack will use a WebSocket URL to communicate with your app... **you'll only receive events and interactive payloads over your WebSocket connections**—not over HTTP."
   Socket Mode 通道上不存在客户端→服务端的 `typing` 帧。
4. Slack 官方 SDK 团队确认：`user_typing` 事件是 RTM 特性，Events API / Web API 均不可用（[slackapi/bolt-js#885](https://github.com/slackapi/bolt-js/issues/885)、[slackapi/node-slack-sdk#1130](https://github.com/slackapi/node-slack-sdk/issues/1130)，一手维护者回复）。

**降级建议**：
- **推荐：只做随机延迟，不做任何"正在输入"模拟**。Slack 客户端对 bot 的即时回复本来就没有 typing 期待，纯延迟即可获得大部分拟人收益。
- **不推荐**：为 typing 接入 RTM（classic app 已不可创建、权限模型过宽、官方明确将弃用）；发送"思考中…"占位消息再编辑/删除（在 Slack 语境产生通知噪音，且官方 SDK 维护者自己给的替代建议也只是发一条消息——体验并不更好）。
- typing 显示时长为客户端行为（最后一帧后数秒消失），官方未成文，本设计不依赖。

### 1.5 QQ 官方机器人 —— ✅ 仅 C2C 单聊支持，群聊/频道无

**API**：单聊消息接口附带"输入中状态"消息类型。`POST /v2/users/{user_openid}/messages`，`msg_type=6` + `input_notify`（[官方文档《发送单聊消息》](https://bot.q.qq.com/wiki/develop/api-v2/autogen/api/v2_users_user_openid_messages.post.html)）。

官方字段定义（原文引用）：

> `msg_type`：消息类型。决定哪个内容字段生效: 0=纯文本(content) 2=Markdown(markdown) **6=输入中状态（input_notify)** 7=富媒体(media)
> **InputNotify**：`input_type`（integer，填1）；`input_second`（integer，**状态持续时间，最长60s**）
> 请求示例：`{"msg_type": 6, "input_notify": {"input_type": 1, "input_second": 60}, "msg_id": "...", "msg_seq": 1}`

| 维度 | 事实 | 来源 |
|---|---|---|
| 单次持续时长 | **最长 60 秒**（`input_second` 参数） | 官方文档（InputNotify schema） |
| 续期方式 | 周期重发；腾讯官方 SDK `@tencent-connect/qqbot-nodejs` 的 `typingIndicator` 中间件默认 `keepAliveIntervalMs=50_000`，注释明示"QQ platform typing window is ~60s" | 官方 SDK 源码（本仓库 `node_modules/@tencent-connect/qqbot-nodejs/dist/middleware/typing-indicator.js`，一手） |
| 聊天类型限制 | **仅 C2C 单聊**。群消息接口 `msg_type` 只有 0/2/7（官方文档核实）；SDK 注释："sendInputNotify only works for C2C (private chat) targets. Group / Guild messages are silently skipped."；频道接口无输入状态参数 | [官方群聊文档](https://bot.q.qq.com/wiki/develop/api-v2/autogen/api/v2_groups_group_openid_messages.post.html)（msg_type 枚举实测核对）+ SDK 源码 |
| 客户端显示 | 单聊显示"Bot 正在输入中…"；官方 openclaw-qqbot 功能表："⌨️ 输入状态｜实时显示'Bot 正在输入中…'状态" | [tencent-connect/openclaw-qqbot](https://github.com/tencent-connect/openclaw-qqbot)（腾讯官方 org） |
| 速率限制 | 单聊消息接口 **100 QPS（含主动、被动、所有消息类型，input_notify 计入其中）**；主动消息另有 Bot 维度频控（认证 10/qps，未认证 5/qps 且 30/qpm）与单关系 20/qpm | 官方文档（基础信息 + 频控说明） |
| 发送后消失 | 官方未文档化取消接口；实际回复到达后状态自然被替代/清除（客户端行为） | 观察 + 社区实现 |
| 相关能力 | 流式单聊消息 `POST /v2/users/{openid}/stream_messages`（50 QPS）自带 `input_state`：**1=生成中，10=生成结束**（仅单聊）——流式路径下输入状态与流式协议合一 | [官方文档《流式发送单聊消息》](https://bot.q.qq.com/wiki/develop/api-v2/autogen/api/v2_users_user_openid_stream_messages.post.html)（实测核对） |
| 被动回复窗口 | 单聊被动消息 60 分钟有效、每条消息最多回复 4 次（对"延迟后回复"的可行性无约束） | 官方文档 |

**设计启示**：单聊用 `input_notify`（`input_second=60`，每 ~50s 续发，成本极低）；群聊/频道**明确降级**为纯随机延迟。本项目 qq 适配器已接入官方 SDK 的 `typingIndicator` 中间件（`src/channels/qq/qq-runtime.mjs:191`），默认即含 50s keepalive，无需改动即可满足"持续显示"诉求（仅单聊生效）。

### 1.6 微信个人号（腾讯 iLink 协议）—— ✅ 仅私聊支持（ticket 模式）

**API**：`POST /ilink/bot/getconfig`（换 `typing_ticket`）→ `POST /ilink/bot/sendtyping`（`status: 1=开始，2=停止`）。本项目 weixin 适配器已完整实现（`src/channels/weixin/weixin-api.mjs:666`、`weixin-bridge.mjs:1419`）。

协议形态（本仓库代码即一手证据）：

```jsonc
// POST ilink/bot/getconfig → { typing_ticket: "..." }
// POST ilink/bot/sendtyping
{
  "ilink_user_id": "<对方用户 id>",
  "typing_ticket": "<getconfig 获取>",
  "status": 1,          // 1 = 开始输入, 2 = 停止输入
  "base_info": { ... }
}
```

| 维度 | 事实 | 来源与可靠度 |
|---|---|---|
| 官方性 | iLink 是腾讯官方 Bot 通道：npm 包 `@tencent-weixin/openclaw-weixin`（author: Tencent，维护者 @tencent.com），官方声明支持**私信**（未声明群聊） | [npm](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin)、[OpenClaw 微信接入文档](https://docs.openclaw.ai/zh-CN/channels/wechat) |
| 客户端显示 | 对方看到"对方正在输入中…" | 社区协议文档（可靠度中，多源一致）：[wechatbot.dev/zh/protocol](https://www.wechatbot.dev/zh/protocol)、[openclaw-weixin 协议笔记](https://github.com/hao-ji-xing/openclaw-weixin/blob/main/weixin-bot-api.md) |
| 单次持续时长 | **未公开**。社区实现按固定间隔续发（本项目取 5s：`DEFAULT_TYPING_KEEPALIVE_MS = 5_000`；社区 XClaw "按固定间隔续发 sendtyping，尽量避免'输入中'先消失、正式回复又晚一点才到的空窗"） | 本仓库代码 + [dustturtle/XClaw](https://github.com/dustturtle/XClaw)（社区） |
| ticket 生命周期 | `getconfig` 获取后按用户缓存（社区文档称约 24 小时，未官方确认）；失败后退避（本项目 `TYPING_RETRY_DELAY_MS = 60s`） | 社区文档（可靠度中）+ 本仓库代码 |
| 发送后消失 | 回复发出后再调用一次 `status=2`（本项目 `#stopTyping` 即如此实现） | 本仓库代码 + 社区实现 |
| 群聊 | 未声明支持，仅私聊 | 官方渠道声明 |
| 速率限制 | 未公开 | — |

**关联参考**：微信生态另有公众号/小程序"客服输入状态" API（`POST /cgi-bin/message/custom/typing`，`typing_status: "Typing"/"CancelTyping"`），属公众号客服消息范畴，与个人号 iLink 不同 scope，参数设计可作参照。[微信官方文档](https://developers.weixin.qq.com/doc/service/api/customer/message/api_typing.html)。

**设计启示**：weixin 适配器已有完整 keepalive + 停止语义；随机发送延迟功能只需把"延迟期间"纳入 typing 窗口（现状：turn 开始即 startTyping，回复送达后 stopTyping——延迟插入后语义仍成立）。

### 1.7 企业微信智能机器人 —— ❌ 无 typing API；有官方流式回复替代

**查证范围**：`developer.work.weixin.qq.com` 服务端 API 全目录 + 智能机器人全部 8 篇文档（概述 101039、接收消息 100719、被动回复 101031、主动回复 101138、长连接 101463 等）通读，目录与正文均无"输入状态 / typing / 正在输入"接口；中英文关键词检索无结果。

| 维度 | 事实 | 来源 |
|---|---|---|
| 智能机器人 typing | ❌ 无 | 查证范围如上 |
| 群机器人 webhook | 支持类型仅 text、markdown（markdown_v2）、图片、图文、文件、语音、模板卡片——无 typing | [官方文档 99110](https://developer.work.weixin.qq.com/document/path/99110) |
| 客户端真人指示器 | 企微客户端对真人有"对方正在输入…"（客户端行为，官方未文档化对机器人开放） | 常识，未文档化 |
| **原生替代：流式消息回复** | 智能机器人支持流式回复："若开发者回复消息类型包含流式消息，企业微信在未收到流式消息回复结束前，会不断向开发者回调 url 推送流式消息刷新（**从用户发消息开始最多等待 6min**）"；刷新回调 `msgtype:"stream"`、`chattype` 可为 `group`（**群聊/单聊均支持**）；"用户跟同一个智能机器人最多同时有三条消息交互中"。另有原生"思考中"体验：被动流式回复 content **若包含 `<think></think>` 思考过程标签，客户端会展示思考过程** | [官方文档 100719《接收消息》](https://developer.work.weixin.qq.com/document/path/100719)（已抓取核实回调结构）、[101031《被动回复》](https://developer.work.weixin.qq.com/document/path/101031) |

**设计启示**：企微"拟人化"只能靠流式回复协议（企微轮询回调、6 分钟窗口、渐进输出）或纯随机延迟。webhook 型群机器人仅能做纯延迟 + 一次性 markdown。

### 1.8 飞书（Lark）—— ❌ 无 typing API（网传接口为幻觉）；有官方卡片流式替代

**查证范围与结论**：

1. 网传"飞书 Typing API"（`POST /open-apis/im/v1/messages/{message_id}/typing`，来自 [QwenPaw#898](https://github.com/agentscope-ai/QwenPaw/issues/898) 的技术分析）——**该 URL 实测 404**（页面返回 "The documentation could not be found"，已直接抓取验证）。该 issue 的"技术分析"疑似 AI 生成幻觉，**请勿据此实现**。
2. `open.feishu.cn` 站内检索 typing / 输入状态 / 正在输入 无相关开放接口。
3. 社区一致结论：现行实现（openclaw）用 `im.messageReaction.create` 加 "Typing" emoji 回应模拟，维护者复核 "cannot establish a supported native endpoint"、该做法"doesn't actually display the native 'typing…' status"（[openclaw#69572](https://github.com/openclaw/openclaw/issues/69572)）。

**原生替代**：官方卡片流式更新（CardKit）——`streaming_mode: true` 后调用流式更新文本接口，**"平台会自动计算增量部分，并以打字机效果逐字渲染"**；卡片/组件级操作限 10 次/秒，流式模式最后激活 10 分钟后自动关闭。来源：[飞书卡片流式更新概述](https://open.feishu.cn/document/cardkit-v1/streaming-updates-openapi-overview)。

**设计启示**：飞书走两条路——① 非流式模式：纯随机延迟 + 最终一次性发送；② 想要"输入感"：用官方卡片流式更新（打字机效果即平台原生支持的拟人化形态）。轻量场景可用 Typing emoji 回应并在回复后删除（注意 reaction 频控与观感）。

### 1.9 钉钉 Stream —— ❌ 无 typing API；有官方 AI 卡片流式替代

**查证范围与结论**：

1. 官方机器人文档明示消息类型仅 5 种："目前支持 text、markdown、整体跳转 actionCard 类型、独立跳转 actionCard 类型、feedCard 这 5 种消息"（[官方文档](https://open.dingtalk.com/document/robots/enterprise-created-chatbot)）。
2. 官方开发者百科 Stream FAQ 直接回答了本问题：**"是否支持打字机模式？当前不支持……你也可以通过互动卡片（普通版）的更新接口，来实现打字机模式"**（[Stream FAQ](https://open-dingtalk.github.io/developerpedia/docs/learn/stream/faq/)）。
3. Stream 模式文档（topic 固定 `/v1.0/im/bot/messages/get`）无任何 typing / presence 回调。

**原生替代**：AI 卡片流式更新 `PUT /v1.0/card/streaming`——官方描述："AI卡片流式更新接口旨在为AIGC产生的内容提供一种持续更新的能力。**通过AI流式更新接口持续更新的内容，在客户端会呈现一种打字机效果**"；`isFinalize=true` 时"AI卡片将从「输入中」状态切换为「完成」状态"——即卡片自带"输入中"徽标（[官方文档《AI卡片流式更新》](https://open.dingtalk.com/document/orgapp/api-streamingupdate)，已核实页面）。

**设计启示**：钉钉纯文本路径只做随机延迟（勿用连发消息模拟——自定义机器人 webhook 每分钟 20 条即超限限流 10 分钟，见[官方文档](https://open.dingtalk.com/document/isvapp/custom-bot-access-send-message)）；追求"输入感"接入 AI 卡片流式更新（「输入中」→「完成」原生状态机与 typing 语义等价）。

### 1.10 九平台能力汇总矩阵

| 平台 | 官方 typing API | 单次时长 | 续期建议间隔 | 发送后消失 | 群聊可见 | 速率限制 | 本仓库现状 |
|---|---|---|---|---|---|---|---|
| Telegram | ✅ `sendChatAction` | ≤5s | ~4s | bot 发消息即清（官方明文） | ✅ 群/私聊均可 | 未公布（消息：单聊 1/s、群 20/min） | `sendTyping` 单次调用，**无续发** |
| Discord | ✅ `POST /channels/{id}/typing` | 10s | ~5s | 10s 到期；消息到达提前清除（客户端行为） | ✅ 频道 + DM | 未公布桶值，按 `X-RateLimit` 头 | 单次调用，**无续发** |
| WhatsApp (Baileys) | ✅ `sendPresenceUpdate('composing')` | ~10s | **<10s**（现为 20s，偏长） | `paused` 或消息发送 | ✅ 单聊 + 群聊（频道无） | 协议无文档 | 已有 20s 续发循环（`whatsapp-runtime.mjs:636`），**间隔与 ~10s 有效期不匹配** |
| Slack (Socket Mode) | ❌ | — | — | — | — | — | 无（官方不可能） |
| QQ 官方 | ✅ 仅单聊 `msg_type=6 input_notify` | ≤60s（`input_second`） | ~50s（官方 SDK 默认） | 回复到达替代（客户端行为） | ❌ 群/频道无 | 端点 100 QPS（计所有类型） | 已接入官方 SDK `typingIndicator` 中间件（自带 50s keepalive） |
| 微信 iLink | ✅ 仅私聊 `sendtyping`（ticket） | 未公开 | 5–10s（本项目 5s） | `status=2` 或消息发送 | ❌ | 未公开 | **已完整实现**（ticket 缓存 + 5s keepalive + 发送后停止） |
| 企业微信 | ❌ | — | — | — | — | — | 无；可用官方流式回复协议替代 |
| 飞书 | ❌（网传 API 为幻觉，已 404 验证） | — | — | — | — | — | 无；可用卡片流式更新替代 |
| 钉钉 Stream | ❌（官方 FAQ 明示不支持打字机） | — | — | — | — | — | 无；可用 AI 卡片流式更新（「输入中」→「完成」）替代 |

**typing 指示器分档结论**：
- **第一档（原生可用，需续发循环）**：Telegram、Discord、WhatsApp、QQ（单聊）、微信（私聊）
- **第二档（无 typing，但有官方流式/打字机替代，"输入感"由流式渲染承担）**：企业微信智能机器人、飞书（卡片）、钉钉（AI 卡片）
- **第三档（无任何等价物，只能纯延迟）**：Slack（Socket Mode）、企微 webhook 群机器人、QQ 群聊/频道

---

## 2. 人类即时通讯行为实证数据

> 说明：每条数据附样本量与来源；"未找到实证"的方面明确标注。微信生态的专门实证研究（回复延迟分布、分段行为）经检索**未找到**学术数据，本节以通用 IM/短信/邮件研究与输入行为研究为依据。

### 2.1 打字速度

**桌面英文（大样本实测）**：Dhakal, Feit, Kristensson & Oulasvirta, *Observations on Typing from 136 Million Keystrokes*, CHI 2018（N=168,960，真实使用环境）：

- 均值 **51.56 WPM（SD 20.2）**（≈ 258 字符/分 ≈ **4.3 字符/秒**）；最快 10% ≈ 89.6 WPM、最慢 10% ≈ 20.9
- 来源：[DOI 10.1145/3173574.3174220](https://doi.org/10.1145/3173574.3174220)｜[Aalto 公开 PDF](https://acris.aalto.fi/ws/portalfiles/portal/21495207/ELEC_Dhakal_et_al_Observations_CHI2018.pdf)（已抓取核实）

**撰写 vs 听打（重要差异）**：Karat, Halverson, Horn & Karat, CHI 1999（IBM，N=24，真实任务）：听打均值 **32.5 WPM**，**自由撰写仅 19.0 WPM**（快/中/慢组 40/35/23 WPM）——**组织语言的打字速度约为机械转录的 60%**。模拟"真人回消息"应参考撰写速度而非听打速度。来源：[DOI 10.1145/302979.303160](https://doi.org/10.1145/302979.303160)。

**移动端英文**：Palin et al., MobileHCI 2019（N=37,370，网页听打实测）：均值 **36.2 WPM**（≈ 3.0 字符/秒）、未修正错误率 2.3%；双拇指 37.7（SD 13.2）vs 单食指 29.2（SD 10.7）。来源：[DOI 10.1145/3338286.3340120](https://doi.org/10.1145/3338286.3340120)。对照实验室理想条件的 Ruan et al., IMWUT 2017：52.24 WPM（短消息转录、理想环境）——现场与理想条件差距明显。来源：[PDF](https://faculty.washington.edu/wobbrock/pubs/ubicomp-17.pdf)（已抓取核实）。

**中文拼音（多源差异大，需按人设取值）**：

| 来源 | 数值 | 样本与条件 |
|---|---|---|
| Chai, Wong, Sim & Deng, TOJET 2012 | **中位数 21.5 字/分** | N=419 新加坡中学生，2 分钟熟悉课文听打；[PDF](https://www.tojet.net/articles/v11i3/11315.pdf) |
| TypeChinese 打字测试平台（产业数据） | 中位 **27 字/分**、P75≈42、P90≈57 | 回访用户测试数据，非学术；[链接](https://typechinese.io/zh/blog/chinese-typing-speed-benchmark) |
| Ruan et al. 2017（实验室理想条件） | **≈ 64 字/分**（42.83 WPM × 词长 1.5） | iPhone 拼音键盘短消息转录（已抓取核实） |

中国大陆成年拼音用户的大规模学术实测**未找到**（数据缺口）。综合三源：中文输入实际速度落在 **20–60+ 字/分（0.3–1+ 字/秒）**，典型值 ~30–40 字/分。

### 2.2 输入时长与消息长度的关系

- Dhakal 2018 键间隔（IKI）：均值 **238.66 ms（SD 111.6）**，快打字者 121.7 ms、慢打字者 481.0 ms（>5s 间隔按分心停顿剔除）；按键时长均值 116 ms。同一文本纯击键时间人群间相差 ~4 倍。
- KLM 经典值（Card, Moran & Newell 1980, CACM 23(6)）：平均打字员 **0.2 s/键**，最好 0.08s、最差 1.2s。[DOI 10.1145/358886.358895](https://doi.org/10.1145/358886.358895)
- **推导模型**（本报告推导）：`输入时长 ≈ 可见字符数 × IKI × KSPC`。桌面英文 ≈ 4.3 字符/s（50 字符 ≈ 12s）；移动英文 ≈ 3.0 字符/s（50 字符 ≈ 17s）；中文拼音 ≈ 0.3–1 字/s（20 字 ≈ 20–60s）。
- burst-pause 结构（句内快速连击 + 句间停顿）体现在 Dhakal 的 8 类打字者画像中；口语对话的停顿时长呈幂律、均值 ≈ 0.97s（Jaffe & Feldstein 1970，经 Kalman 2006 重分析）。

### 2.3 回复延迟分布（收到消息 → 发出回复）

**IM 实测（核心数据）**：Avrahami & Hudson, *Responsiveness in Instant Messaging*, CHI 2006（16 名参与者、91,539 条真实消息）：

- **全量回复中位数 15 秒**（"50% of the messages in our data are responded to within 15 seconds"），92% 在 5 分钟内回复（已抓取核实）
- 对**会话发起消息**（SIA-5）：30s 内获回复 54.7%、1min 55.9%、2min 63.8%、5min 72.0%、10min 75.4%（基线概率）；回复中位数 37s
- 来源：[CHI 2006 PDF](https://nl.ijs.si/janes/wp-content/uploads/2014/09/avrahamihudson06b.pdf)｜[DOI 10.1145/1124772.1124881](https://doi.org/10.1145/1124772.1124881)

**人群差异**：Avrahami & Hudson, *IM waiting*, CSCW 2008：**学生平均 32s 回复一条 IM；技术创业公司人群平均 105s**（工作打断环境）。[ResearchGate](https://www.researchgate.net/publication/220879537_IM_waiting_timing_and_responsiveness_in_semi-synchronous_communication)

**分布形状（三个尺度三种结论）**：

| 通道 | 分布 | 来源 |
|---|---|---|
| 人类交互活动间隔 | **对数正态**（"likely to follow a lognormal distribution"） | [arXiv:1607.02952](https://arxiv.org/html/1607.02952v1) |
| 邮件回复等待 | **幂律 P(τ)∝τ^−1**；三数据集累积分布斜率 −1.74/−1.76/−2.04，均值延迟 28.76h/23.52h/1.58h；**≥80% 回复快于均值**、>10×均值即"沉默"（仅 3–4% 再回复） | Barabási, Nature 435:207（[DOI 10.1038/nature03459](https://doi.org/10.1038/nature03459)）；Kalman et al., JCMC 12(1)（[链接](https://academic.oup.com/jcmc/article/12/1/1/4582956)） |
| 短信等待时间 | **双峰**：burst 内幂律（γw≈1.9–2.1）+ 指数尾（时间尺度 ≈ 40 分钟） | Wu et al., PNAS 107:18803（[DOI 10.1073/pnas.1013140107](https://doi.org/10.1073/pnas.1013140107)） |

共同点：**重尾**——大量快回复 + 少量很慢的回复；绝不是均匀分布。

**会话结构（规模数据）**：Leskovec & Horvitz, *Through the Lens of a Large Instant-Messaging Network*（单月 2.45 亿用户、300 亿+ 会话）：会话时长中位数 ~5 分钟、每会话 ~7 条消息；年轻人会话节奏更快。[PDF](https://erichorvitz.com/messenger_princeton_april_2009.pdf)（已抓取核实）。

### 2.4 打字错误与修正

- Dhakal 2018：未修正错误率 **1.17%（SD 1.43）**；**退格/删除占全部按键 6.31%（SD 4.48）、平均 2.29 次/句**；快打字者修正更少（3.40% vs 慢打字者 9.05%）；KSPC 1.17（每字符多 17% 击键开销）。
- Palin 2019（移动端）：未修正错误 2.3%、KSPC 1.18——移动端修正开销与桌面相近。
- Ruan 2017（拼音）：**已修正错误率 17.73%**（英文键盘 4.72%）——中文输入的选字/改错开销远高于英文。
- 修正操作 99% 用退格（Arif & Stuerzlinger, IUI 2011，[DOI 10.1145/1753326.1753329](https://doi.org/10.1145/1753326.1753329)）。
- **修正造成的停顿时长：未找到直接实证**（文献只报频率）——工程上把修正开销并入有效打字速度（KSPC ≈ ×1.17）而非显式建模。
- ⚠️ **机器人故意打错字会降低感知真实感与社会临场感**（arXiv:2510.08912 综述：typing errors → lower perceived humanness）——"拟人化 typo"不应实现。

### 2.5 消息分段连发

- Baron, *Discourse Structures in Instant Messaging*, Language@Internet 2010（大学生 IM，2,185 个发送单元、11,718 词）：**42% 的消息序列拆成多条连发**，序列均值 **1.7 条**；同语料中 16.2% 的发送构成"话语拆分对"（一个话语拆成语法片段）；每条消息均值 ≈ 5.4 词。[链接](https://www.languageatinternet.org/articles/2010/2651)
- 短信侧：Hong et al., Chin. Phys. Lett. 2009（8 人 3–6 个月短信记录）：**同一人连续两条短信间隔呈幂律重尾**；Wu 2010：会话内连发间隔幂律段 γ≈1.5–1.9。[DOI 10.1088/0256-307X/26/2/028902](https://doi.org/10.1088/0256-307X/26/2/028902)
- **连发消息之间秒级间隔的直接分布：未找到**（现有研究时间分辨率多为分钟级）；可按"重新起句的停顿"（数百 ms 至数秒）保守估计。
- 本项目 `message_break` 功能即对该行为的模拟；42% 拆分率与均值 1.7 条/序列支持"适度分段"的默认策略。

### 2.6 机器人/对话代理响应延迟的用户感知（HCI 实证）

| 研究 | 发现 | 来源 |
|---|---|---|
| Stivers et al. 2009（PNAS，10 种语言） | 人类口语轮换间隔：**众数 0ms、中位 +100ms、均值 +208ms**——"人感"基线在亚秒级 | [DOI 10.1073/pnas.0903616106](https://doi.org/10.1073/pnas.0903616106) |
| Shiwa et al. 2009（Int. J. Social Robotics） | 机器人响应偏好**峰值在 1s**，建议 **2s 内**响应；每 2s 插入"对话填充词"可把可容忍延迟提高到 5–9s | [DOI 10.1007/s12369-009-0012-8](https://doi.org/10.1007/s12369-009-0012-8) |
| Holtgraves et al. 2007（CHB） | 1s vs 10s：慢回复的人格评价更差；其 **50ms/字符** 打字延迟设计沿用至今 | [DOI 10.1016/j.chb.2006.02.017](https://doi.org/10.1016/j.chb.2006.02.017) |
| Gnewuch et al. 2018（ECIS） | **按回复复杂度动态计算的延迟 vs 近即时：显著提升拟人感、社会临场感与满意度** | [KIT 机构库](https://publikationen.bibliothek.kit.edu/1000089970)（已抓取核实） |
| Gnewuch et al. 2022（BISE，N=202） | 动态延迟效应受用户经验调节：新手 +、老用户 − | [DOI 10.1007/s12599-022-00755-x](https://doi.org/10.1007/s12599-022-00755-x) |
| **Schanke et al. 2021（ISR，现场实验）** | **客服机器人模拟 70 WPM 打字延迟反而降低喜好度（重要反例：长消息的打字模拟会过度拖延）** | [DOI 10.1287/isre.2021.1015](https://doi.org/10.1287/isre.2021.1015) |
| Zhang et al. 2024（CUI，N=194） | 50ms/字符动态延迟本身不损信任；加文字解释提升透明度 | [DOI 10.1145/3640794.3665550](https://doi.org/10.1145/3640794.3665550) |
| **Kim et al. 2025（IJHCI）** | 延迟越长满意度越低，**typing indicator 显著缓解负效应**——"延迟 + typing"组合有实证支撑 | [DOI 10.1080/10447318.2025.2508915](https://doi.org/10.1080/10447318.2025.2508915) |
| ACM 3772318.3790716（240 人，LLM 助手） | **2s 档被评"更不深思熟虑、更无用"；9s 档评价最优；20s 无进一步收益** | [ACM 全文](https://dl.acm.org/doi/full/10.1145/3772318.3790716) |
| Peng & Mo（二手引用） | **>8s 用户等待体验转负** | [ResearchGate](https://www.researchgate.net/publication/378318560_The_Effects_of_Response_Time_on_Older_and_Younger_Adults'_Interaction_Experience_with_Chatbot) |
| arXiv:2510.08912（预实验 N=11） | 单纯 hesitation（犹豫停顿）**未显著提升**自然度；与自编辑组合才有（未显著的）改善 | [arXiv](https://arxiv.org/html/2510.08912v1) |

**综合解读**（不同研究结论的调和）：
- **1–2s**：对话流感知最佳（Shiwa；Stivers 人类基线亚秒级）——短消息/闲聊向。
- **2–9s**：LLM/复杂回复"显得深思熟虑"的最优区间（ACM 3772318.3790716；Gnewuch 动态延迟）。
- **>8–10s**：等待体验转负（Peng & Mo；Holtgraves 10s 差评）；打字模拟拖到真实打字时长（Schanke 70WPM 反例）有害。
- **typing indicator 是长延迟的解药**（Kim 2025）——本项目"延迟期间保持指示器"的设计有直接实证支撑。

### 2.7 可直接用于延迟模型的数字汇总

| 参数 | 实证值 | 来源 |
|---|---|---|
| 桌面英文打字 | **4.3 字符/s**（51.56 WPM）；撰写场景 ~2.5 字符/s（19 WPM） | Dhakal 2018 / Karat 1999 |
| 移动英文打字 | **3.0 字符/s**（36.2 WPM） | Palin 2019 |
| 中文拼音打字 | **0.3–1+ 字/s**（20–60+ 字/分，典型 30–40） | TOJET 2012 / TypeChinese / Ruan 2017 |
| 击键间隔 | 均值 239ms（快 122 / 慢 481）；修正开销 ×1.17（KSPC） | Dhakal 2018 |
| IM 回复延迟 | 中位 **15s**；会话发起中位 37s；92% ≤5min | Avrahami & Hudson 2006 |
| 人群差异 | 学生 32s / 职场 105s | Avrahami & Hudson 2008 |
| 分布形状 | 对数正态（交互间隔）/ 幂律 τ^−1（邮件）/ 双峰（短信）——**重尾** | arXiv:1607.02952 / Barabási 2005 / Wu 2010 |
| 感知最优 | 短回复 **1–2s**；复杂回复 **~9s** 最优、2s 偏肤浅 | Shiwa 2009 / ACM 3772318.3790716 |
| 感知上限 | **>8–10s 转负**；打字模拟到真实时长有害（反例） | Peng & Mo / Holtgraves 2007 / Schanke 2021 |
| typing 缓解 | **typing indicator 显著缓解长延迟负效应** | Kim 2025 |
| 分段率 | **42% 序列拆多条**、均值 1.7 条/序列、每条 ~5.4 词 | Baron 2010 |
| 打字延迟设计先例 | **50ms/字符**（沿用 17 年） | Holtgraves 2007 → Zhang 2024 |
| 数据缺口（需自采） | 中文移动端速度、连发秒级间隔、修正停顿时长 | — |

---

## 3. 延迟模型设计建议

> 本节把第 1、2 节证据落到参数上，与[配套方案](./260908-humanize-send-delay-typing.plan.md) §1.7 的模型 `delayMs = clamp( uniform(minMs, maxMs) + 可见字符数 / charsPerSecond × 1000, 0, maxTotalMs )` 对应。

### 3.1 分布选择：重尾是真相，"均匀 + 长度项 + 截断"是合理近似

**实证真相**：人类交互间隔是**重尾**的——交互活动间隔近对数正态（arXiv:1607.02952）、邮件回复幂律 τ^−1 且 ≥80% 回复快于均值（Kalman 2006）、短信等待双峰（Wu 2010）。直觉特征："大多数回复很快 + 少数回复很慢"，对称的均匀分布无法表达这种偏斜。

**工程结论**（支持 plan §6.4 的取舍）：
1. **感知收益来自结构而非分布形状**。Gnewuch 2018 的收益点是"延迟随回复复杂度动态变化"这一结构；Zhang 2024 沿用 17 年的 50ms/字符设计同样是"线性长度项"。均匀基础项 + 线性长度项之和天然右偏（快的基础项被长度项拉长的组合占少数），已具备重尾的感知特征。
2. **可解释性与可测试性优先**：`min/max/速率/上限`四个参数用户可直接理解；对数正态的 μ/σ 无法直觉校准。
3. **若 v2 追求更真实**：用对数正态替换均匀项，参数可从两个分位点反解（中位数 m、P90=p）：
   `μ = ln(m)`，`σ = (ln(p) − ln(m)) / 1.2816`（1.2816 为标准正态 P90 分位点）。示例：m=1.2s、p=3.0s → μ≈0.182、σ≈0.772。
4. **截断必须有**：重尾的尾部（分钟级"沉默"）在 IM 里对应"不回了"，机器人不能模拟"不回"——`maxTotalMs` 是把人类分布截到产品可接受区间的安全阀（见 3.2）。

### 3.2 参数取值依据

| 参数 | 建议默认 | 实证依据 |
|---|---|---|
| `minMs` | 500–1000 | 亚秒级是人类对话基线（Stivers 轮换 0–200ms、Shiwa 机器人峰值 1s）；低于 300ms 无感知意义。模型生成已"扮演"了人类"读消息+思考"的时间（Avrahami 15s 中位数的大头），发送前延迟只需覆盖"起手打字" |
| `maxMs` | 2000–3000 | 与 minMs 拉开比例制造自然方差；Gnewuch 2022 提示老用户对延迟更敏感，基础项不宜过大 |
| `charsPerSecond` | 默认 0（关）；推荐预设见下 | **按人设/语言取值**——中文拼音 0.3–1+ 字/s（TOJET 21.5 字/分 / TypeChinese 中位 27 字/分 / Ruan 理想 64 字/分）；移动英文 3.0（Palin）；桌面英文 4.3（Dhakal）；"边想边写"人设 1.6–2.5（Karat 撰写 19 WPM）。注意修正开销 KSPC≈1.17：想要"真实 30 字/分的人设"，参数填 0.5 而非 0.6 |
| `maxTotalMs` | 15000 | **三条上限证据**：>8s 等待体验转负（Peng & Mo）；Holtgraves 10s 档人格评价变差；ACM 3772318.3790716 中 20s 档相比 9s 档无增益。9s 是复杂回复的感知最优点。15000 作为"用户可调最大值"合理，但默认参数组合应使 **P50 ∈ [2,6]s、P90 ≤ 10–12s** |

**参照先例**：Holtgraves 2007 → Zhang 2024 的 `50ms/字符`（= 20 字符/s，远快于真人，作为"象征性打字"的下限档）对应：100 字符消息 → 长度项 5s + 基础 0.5–2s ≈ **5.5–7s，恰好落在 9s 最优区**。本项目面向中文消息（均值更长），`charsPerSecond` 应显著低于 20，建议预设：

| 预设人设 | minMs | maxMs | charsPerSecond | maxTotalMs | 预期效果 |
|---|---|---|---|---|---|
| 轻拟人（默认） | 500 | 2000 | 0（关） | 15000 | 仅基础停顿，最保守 |
| 移动人设·中文 | 800 | 2500 | 0.6（≈36 字/分） | 12000 | 100 字 ≈ 60s 打字被截断到 12s——**注意：中长消息会顶到上限**，见下 |
| 桌面人设·中文 | 500 | 2000 | 1.2（≈72 字/分，偏快） | 15000 | 200 字 ≈ 167s 截断到 15s |
| 英文人设 | 400 | 1500 | 4.0 | 15000 | 500 字符 ≈ 125s 截断到 15s |

**关键警示（Schanke 2021 反例的直接教训）**：开启长度项后，长消息的总延迟会迅速顶到 `maxTotalMs`——打字模拟"撞天花板"意味着长回复一律等满上限，用户感知为"卡住"。建议默认保持 `charsPerSecond=0`，把长度项留给明确想要"慢性子人设"的高级用户，并在 UI 上提示"长消息将以 maxTotalMs 封顶"。

### 3.3 与 typing 指示器的配合（本功能的核心闭环）

1. **延迟期间 typing 必须在线**——Kim 2025 实证：**typing indicator 显著缓解长延迟的负效应**。"延迟 + typing"组合才是有效组合；只延迟无 typing（Slack 场景）应把延迟压短。
2. **续期循环参数**（对齐 §1.10 矩阵与 plan §1.2）：

   | 渠道 | 循环间隔 | 依据 |
   |---|---|---|
   | Telegram | 4s | 官方 ≤5s 过期；gramio 官方示例即 4s 循环 |
   | Discord | 5s | 官方 10s 过期，留缓冲（社区实践同值） |
   | WhatsApp | ~8s | 协议 ~10s 有效期（现 20s 刷新是 bug，须修） |
   | QQ（单聊） | 50s（官方 SDK 默认） | `input_second` ≤60s |
   | 微信 | 5s（现状） | 时长未公开，5s 已验证可用 |

3. **发送即止**：Telegram 官方明文"bot 发消息即清除 typing"；微信发 `status=2`；WhatsApp `paused`/消息发送；QQ 靠回复到达替代。分段连发（message_break / 超长分块）时段与段之间指示器自然重亮——与真人"连发多条、每条之间继续输入"的行为一致（Baron：42% 序列拆多条、均值 1.7 条）。
4. **action 语义匹配**（Telegram 特有收益）：按"即将发送什么"选 `typing` / `upload_photo` / `record_voice` 等（官方 action 参数语义）；发语音前用 `record_voice`/WhatsApp `recording` 比 `typing` 更真实。
5. **无 typing 渠道的延迟策略**：Slack、企微 webhook、QQ 群聊只做**短**延迟（建议上限 ≤5s，靠近 Shiwa 2s 建议值），因为缺少 Kim 2025 所述的缓解机制；企微智能机器人/飞书/钉钉优先用官方流式卡片（打字机效果）承担"输入感"，非流式最终消息前同样只做短延迟。

### 3.4 平台限速与分段连发的安全边界

| 平台 | 限速事实 | 对分段连发的约束 |
|---|---|---|
| Telegram | 单聊 1 msg/s、群 20 msg/min、广播 30 msg/s | message_break 分段间隔 ≥1s（群内 ≥3s） |
| QQ | 消息接口 100 QPS；被动回复条数上限 C2C 4 条/消息、群 5 条 | 现有 ≤4500 字符分块已考虑 |
| 企业微信 | 智能机器人同用户并发交互 ≤3 条 | 分段发送串行化 |
| 钉钉 | 自定义机器人 webhook 20 条/min，超限封禁 10min | 连发消息模拟打字机**禁止**（官方 FAQ 已否定） |
| 飞书 | 卡片/组件操作 10 次/s | 流式卡片更新频率 ≤10/s |

### 3.5 明确不建议的做法（负面向导）

- ❌ **故意打错字再修正**：实证降低感知真实感与社会临场感（arXiv:2510.08912 综述），且社区先行项目（openclaw 类）普遍认为得不偿失。
- ❌ **把延迟拉满到"真实打字时长"**：Schanke 2021 现场实验证明 70 WPM 完整打字模拟**降低**喜好度。`maxTotalMs` 是必需的安全阀。
- ❌ **纯 hesitation（无 typing、无其他信号的长停顿）**：arXiv:2510.08912 预实验显示单独犹豫不提升自然度——延迟必须与 typing（及/或流式渲染）组合。
- ❌ **占位消息**（"让我想想…"再编辑/删除）：Slack/企微 webhook 产生通知噪音；官方 SDK 维护者自己也不推荐。
- ❌ **接入 Slack RTM 仅为 typing**：classic app 不可再创建、权限过宽、官方明确将弃用。

### 3.6 验收与后续观测建议

1. 真机验收时记录每条消息的实际 `delayMs`（注入随机源可直接在测试中断言分布），监控 P50/P90 是否落在 [2,6]s / [≤12]s 区间。
2. 各渠道 typing 续发失败率（微信 ticket 过期、WhatsApp presence 失败重连）单列观测。
3. 数据缺口（§2.7）可从本项目真实使用日志自采：中文用户对延迟的耐受、message_break 分段的实际体验、不同 `charsPerSecond` 预设的角色扮演沉浸感评分。

---

## 附录 A：来源清单与可靠度分级

| 级别 | 说明 | 本报告中的来源 |
|---|---|---|
| 官方（国际平台） | 平台官方文档 / 官方 FAQ | core.telegram.org（经镜像交叉验证）、docs.discord.com、faq.whatsapp.com、developers.facebook.com（Meta Cloud API）、docs.slack.dev、api.slack.com |
| 官方（中国平台） | 官方开放平台文档 / 官方 npm 包 | bot.q.qq.com（消息、流式、频道接口）、developer.work.weixin.qq.com（100719/101031/99110 等，已抓取核实）、open.feishu.cn（CardKit）、open.dingtalk.com + developerpedia（Stream FAQ、AI 卡片）、npm `@tencent-weixin/openclaw-weixin`（腾讯官方）、GitHub tencent-connect/openclaw-qqbot（腾讯官方 org） |
| 一手社区 | 库维护者 / 官方 SDK 团队回复 | discord.js#10061、bolt-js#885、node-slack-sdk#1130、Baileys 官方 wiki、telegraf#1801、`@tencent-connect/qqbot-nodejs` 源码（typingIndicator 中间件、sendInputNotify 实现） |
| 二手社区 | Stack Overflow、用户报告、社区协议文档 | SO 77884689、Baileys#866、wechatbot.dev 与 hao-ji-xing/openclaw-weixin 协议文档（微信 iLink，多源一致）、XClaw 实现、Reddit AMA（中文输入速度）、TypeChinese 平台数据 |
| 学术 | 同行评审 / 会议 / arXiv 预印本 | **§2 全部**：Dhakal 2018（CHI）、Karat 1999（CHI）、Palin 2019（MobileHCI）、Ruan 2017（IMWUT）、Chai 2012（TOJET）、Card 1980（CACM）、Avrahami & Hudson 2006（CHI）/2008（CSCW）、Barabási 2005（Nature）、Kalman 2006（JCMC）、Wu 2010（PNAS）、Hong 2009（CPL）、Leskovez & Horvitz（ Messenger 网络研究）、Stivers 2009（PNAS）、Shiwa 2009（IJSR）、Holtgraves 2007（CHB）、Gnewuch 2018（ECIS）/2022（BISE）、Schanke 2021（ISR）、Zhang 2024（CUI）、Kim 2025（IJHCI）、arXiv:1607.02952、arXiv:2510.08912、ACM 3772318.3790716 |
| 标注二手/推导 | 摘要中转引或本报告自行推导 | Peng & Mo 8s 阈值（经 ResearchGate 摘要转引）、Avrahami & Hudson 2008 的 32s/105s（摘要数字）、中文打字速度的"人设取值区间"、§2.2/§3.1 的推导公式 |

> 注 1：core.telegram.org 在调研网络中不可直连，`sendChatAction` 与 Bots FAQ 原文通过 Web Archive 快照与多个自动同步官方文档的库文档（aiogram 3.20 / gramio / R telegram.bot 等）交叉验证，措辞完全一致，可信度高。
> 注 2：微信 iLink `sendtyping` 协议（status 1/2、ticket ~24h）为社区逆向多源一致 + 官方 npm 包行为佐证，单次持续时长与限速官方未公开，已标注需实测。
> 注 3：飞书 `im-v1/message/typing` 网传文档链接实测 404，判定为幻觉，勿采信（§1.8）。
