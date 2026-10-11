# Telegram 语音投递（语音消息而非音频文件）· 实施计划

- **日期**：2026-10-09
- **范围**：dsh-im-humanize fork，`src/channels/telegram/` + `src/channels/shared/semantic/artifact-delivery.mjs`
- **类型**：缺陷修复 + 小功能扩展
- **触发**：用户反馈「agent 发语音时，希望显示为语音消息（圆形气泡）而不是音频文件」

## 背景与根因

### 现状链路

1. Agent 生成音频（如 fish-tts 输出 `.mp3`/`.opus`），调用 `dsh_im_return_file`，可选 `as: 'voice'`。
2. `artifact.mjs#stage` 记录 `as`，`artifact-delivery.mjs#sendMaterializedArtifact` 按模式分发：
   - `as: 'voice'` → 调 `sendVoice`；`auto` → 仅当 `.ogg`/`.opus` 才当语音候选，否则落 `sendFile`。
3. `text-harness-bridge.mjs#deliverArtifacts` 把 `bot.sendVoice` 透传给投递层。
4. Telegram 侧：`TelegramRuntime.sendVoice()`（telegram-runtime.mjs:653）→ `this.#api.sendVoice(...)`。

### 根因（源码已核实）

- **`TelegramApi` 根本没有 `sendVoice` 方法**：telegram-api.mjs 只实现 `sendDocument` / `sendPhoto` / `sendAnimation`（各走私有 `#sendArtifact`）。因此 `#api.sendVoice` 为 `undefined`，调用抛 `TypeError`。
- 该 `TypeError` 被 `artifact-delivery.mjs` 第 83–88 行捕获（非 abort、非 `artifact-delivery-uncertain`），**静默降级到 `sendFile` → `sendDocument`**，用户看到的就是「音频文件」。
- 次因一：`auto` 模式的语音候选只认 `.ogg`/`.opus`；fish-audio 技能推荐输出 `.mp3`，即使不写 `as` 也永远进不了语音分支。
- 次因二：`sendChatAction` 动作白名单（telegram-api.mjs:463）不含任何 voice 动作，`text-harness-bridge.mjs:1230` 传的 `record_voice` 被静默改写为 `typing`。

### 平台事实（core.telegram.org/bots/api `sendVoice`，2026-10-09 实抓）

- `sendVoice` 要求音频为 **.OGG(OPUS)、.MP3 或 .M4A**；其他格式「may be sent as Audio or Document」。
- `duration` 为可选参数，服务端会自行分析；无需 ffprobe。
- 单条语音上限 50MB。
- `sendChatAction` 支持 `record_voice` / `upload_voice`。

## 方案

### 1. TelegramApi 实现 `sendVoice`

telegram-api.mjs：新增 `sendVoice({chatId, file, replyToMessageId, messageThreadId, signal})`，复用 `#sendArtifact('sendVoice', 'voice', 'voice', {...})`，与 `sendDocument` 完全同构（multipart 上传、错误映射、超时/中止复用现有逻辑）。

### 2. 语音格式规整（新增 `src/channels/telegram/voice-format.mjs`）

- `isTelegramVoiceReady(file)`：`.ogg/.opus/.mp3/.m4a`（按扩展名或 `audio/ogg|opus|mpeg|mp4` 媒体类型判定）。
- `prepareTelegramVoiceFile(file, { signal })`：
  - 已就绪 → 原样返回；
  - 其他音频（`.wav`、`.aac`、`.flac`…）→ 调 `ffmpeg` 转码为 OGG/OPUS，返回新的 `{ fileName: <base>.ogg, mediaType: 'audio/ogg', bytes, ... }`；
  - 非音频 → 抛错，交由投递层既有的「失败 → 降级 document」路径处理。
  - 实现走 stdin/stdout 管道（`ffmpeg -i pipe:0 -vn -c:a libopus -b:a 32k -f ogg pipe:1`），不落临时文件、无需清理；带 `signal` 中止与超时（60s）杀进程；输出上限 50MB（Telegram 语音上限）。
  - ffmpeg 缺失/转码失败 → 抛错（不自行降级，保持既有语义）。
- 已在容器实测：`cat t.wav | ffmpeg -i pipe:0 -c:a libopus -f ogg pipe:1` 正常（48KB wav → 4.8KB opus，1.0s）。

### 3. TelegramRuntime.sendVoice 前置规整

telegram-runtime.mjs#sendVoice：`await prepareTelegramVoiceFile(file, { signal: this.#signal })` 后再调 `api.sendVoice`。已就绪文件（ogg/opus/mp3/m4a）零额外开销，测试无需注入 ffmpeg。

### 4. auto 模式语音推断放宽

artifact-delivery.mjs `isVoiceCandidate`：由「仅 ogg/opus」放宽为 `mediaType.startsWith('audio/')`（含扩展名兜底）。

- 只有实现了 `sendVoice` 的渠道才受影响；当前全仓仅 Telegram 实现（其他渠道 `sendVoice` 为 `undefined`，分支不进入），因此行为变化实际只发生在 Telegram。
- 语义：该 fork 的 agent 音频绝大多数是 TTS 语音；想要「音频文件」时可用 `as: 'file'` 显式覆盖。
- 同步更新 `text-harness-bridge.mjs` 的 typing 提示判定（同一谓词），使上传期显示 `record_voice`。

### 5. sendChatAction 白名单补 voice 动作

telegram-api.mjs:463 白名单加入 `record_voice`、`upload_voice`。

### 6. 配套技能文档（仓库外，本地）

`~/.agents/skills/fish-audio/SKILL.md` 的「结合 IM 投递语音」小节补一句：想要语音气泡时传 `as: "voice"`（mp3/opus 均可，wav 会被自动转码）。

## 测试

- `test/channels/telegram/voice-format.test.mjs`（新）：就绪判定矩阵；已就绪文件直通（不调 ffmpeg）；注入假 runner 验证转码参数与产物元数据；非音频拒绝；转码失败/超时/中止路径。
- `test/channels/telegram/telegram.test.mjs`：`TelegramApi.sendVoice` 打 `sendVoice` 端点、字段名为 `voice`、复用 reply/thread 上下文（对齐既有 `sendDocument` 用例）；bot client `sendVoice` 委托转发（对齐 `sendImage` 用例）。
- `test/artifact-delivery.test.mjs`：auto 模式 `.mp3` → 走 `sendVoice`。
- 不真跑 Telegram API：全部走假 fetch / 假 api。

## 不做

- 不实现 `sendAudio` / `as: 'audio'`（音乐播放器样式）；本次只解决语音气泡。
- 不改其他渠道的语音投递语义。
- 不改 `sendVoice` 的时长/波形参数（Telegram 服务端自行分析）。
- 不为转码失败新增降级策略（沿用既有「失败 → 提示 + document 兜底」）。

## 验证要求（用户实机）

在 Telegram 私聊让 agent 用 fish-tts 生成一段 mp3 语音并投递（带 `as: 'voice'`、以及不带 `as` 各一次），确认：

1. 收到的是**语音气泡**（圆形、可点播放），不是文件附件；
2. 若用 `.wav` 生成，同样呈现为语音气泡（走转码）；
3. 发送过程中 typing 指示为「正在录音/上传语音」而非「正在输入」。
