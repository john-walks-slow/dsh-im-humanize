<h1><img src="assets/logo-icon.png" alt="dsh-im logo" width="40" align="absmiddle" style="vertical-align: middle;"> dsh-im</h1>

---

<div align="center">
  <p><strong>让聊天机器人轻松接入 DeepSeek Harness</strong></p>
  <p><strong>Connect IM bots to DeepSeek Harness with ease</strong></p>

  <p>
    <img src="https://dsh-im-random-badge.xmanrui-dsh-im.workers.dev" alt="滑动变祖器：今天是梁子或今天是梁圣（随机）">
    <a href="LICENSE"><img src="https://img.shields.io/github/license/xmanrui/dsh-im" alt="MIT 许可证"></a>
    <img src="https://img.shields.io/badge/agent-DeepSeek%20Harness-5865f2" alt="DeepSeek Harness">
    <a href="https://dshfind.com/zh/plugins/xmanrui/dsh-im?ref=badge"><img src="https://dshfind.com/api/badge/xmanrui/dsh-im?lang=zh" alt="dshfind"></a>
    <a href="https://dshfind.com/zh/plugins/xmanrui/dsh-im"><img src="https://img.shields.io/badge/dshfind-%E5%88%86%E7%B1%BB%E7%AC%AC%E4%B8%80-d97706" alt="dshfind: 分类第一"></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/%E5%BE%AE%E4%BF%A1-07C160?logo=wechat&amp;logoColor=white" alt="微信">
    <img src="https://img.shields.io/badge/%E9%A3%9E%E4%B9%A6-3370FF?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTcuMiA0LjVoNy42YzEuMiAwIDIuMS41NSAyLjcgMS41OCAxLjA1IDEuOCAxLjU1IDMuNDUgMS41OCA0Ljk1LTIuMDQtLjYyLTQuMi0uMTUtNi4yMiAxLjQ1QzExLjMgOS43IDkuNDIgNy4wNCA3LjIgNC41WiIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0xMC44IDEzLjU1YzMuMy0yLjkzIDUuNzItNC4yNCA5LjQ3LTIuNTItMS4yIDEuNDUtMi4yNyA0LjE4LTMuODYgNS40My0xLjY3IDEuMzEtMy45LjUtNS42MS0uNjR2LTIuMjdaIi8%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTQuNCA4LjM1YzMuNDcgMy42MSA3LjI1IDYuMSAxMC4zMyA1LjcgMS4wNi0uMTQgMi4yLS43MiAzLjQtMS43Mi0xLjA0IDIuNjUtMi42IDQuOC01LjA2IDYtMi40NiAxLjItNS41Ni41Mi03LjQyLS43MkEyLjc2IDIuNzYgMCAwIDEgNC40IDE1LjNWOC4zNVoiLz48L3N2Zz4%3D" alt="飞书">
    <img src="https://img.shields.io/badge/%E9%92%89%E9%92%89-1677FF?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTM3LjA1IDIyLjc4M2MtNi43NTgtNS4yMTYtMTQuMzc4LTEyLjEyOC0yMi43My0xOS41MzgtLjY1NS0uNTg1LTEuMjQyLS4zNTQtMS41MzYuNDItMS44OCA0Ljk3My0uMDU4IDkuMzg2IDIuODg5IDExLjkzMnM3LjM2OCA0LjkxMiAxMC4wNTggNi4xNTVjLjEwNS4wNDkuMDEzLjIwMy0uMDkzLjE2My00Ljk1My0yLjE4Mi04LjM5Ny0zLjc2NS0xMy4wNy03LjM2OC0uNDk3LS4zODgtMS4wMS0uMjQyLTEuMDcuNTIxLS4zODQgNC43NDggMi42NTcgOC40ODMgNi4wNTggOS43NDUgMi4xLjc4MSA0LjM5OCAxLjIxMiA2LjUzIDEuNDc0LjEwOS4wMTUuMDg0LjE3OC0uMDI3LjE3OC0yLjc0Ny4wMS02LjA1OC0uNjU0LTguOTM1LTEuNzUxLS42MDYtLjIzMy0uODE4LjI1LS43MjIuNjMzLjQ5MSAyLjAwOCAyLjk3NCA1LjA3NiA2LjkyNiA1LjczYTEyIDEyIDAgMCAwIDIuMjI4LjExNWMuMTY0IDAgLjIwOC4wODkuMTU0LjIxN3EtMi42ODUgNC42LTIuODAzIDQuNzk3Yy0uMDkxLjE1Mi0uMDM2LjI3NS4xNTYuMjc1aDMuNTQzYy4xNjQgMCAuMjY0LjEwNi4xOC4yNDZsLTQuOTU4IDguMTk2Yy0uMTkxLjMyOC4wMzUuNTY1LjM5NS4zMDFzMTUuMjEyLTExLjEzMyAxNS42MzYtMTEuNDQ4Yy4xOTUtLjE0Mi4xNDgtLjMyNy0uMTI0LS4zMjdoLTMuMThjLS4yMDYgMC0uMjUyLS4xNC0uMTExLS4yOC4xNC0uMTQxIDMuNjAyLTMuNTk0IDQuODM3LTQuODg4IDEuMjgzLTEuMzUgMS45MzgtMy44MjUtLjIzMS01LjQ5OCIvPjwvc3ZnPg%3D%3D" alt="钉钉">
    <img src="https://img.shields.io/badge/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1-3370FF?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIuMzUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE3LjcgMTQuNWMxLjA1LTEuMTIgMS42NS0yLjUyIDEuNjUtNC4wMyAwLTMuODItMy41OC02LjkyLTgtNi45MnMtOCAzLjEtOCA2LjkyIDMuNTggNi45MiA4IDYuOTJjMS4xNyAwIDIuMjgtLjIyIDMuMjgtLjYyIi8%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTE2LjEgMTUuMTVjLjctLjcgMS44My0uNyAyLjUzIDBzLjcgMS44MyAwIDIuNTMtMS44My43LTIuNTMgMC0uNy0xLjgzIDAtMi41M1pNMTkuMjUgMTMuNDVhMS4zNiAxLjM2IDAgMSAxIDEuOTIgMS45MiAxLjM2IDEuMzYgMCAwIDEtMS45Mi0xLjkyWk0xOS41NSAxOC4wNWExLjE2IDEuMTYgMCAxIDEgMS42NCAxLjY0IDEuMTYgMS4xNiAwIDAgMS0xLjY0LTEuNjRaTTE1LjI1IDE4Ljc1YS45Mi45MiAwIDEgMSAxLjMgMS4zLjkyLjkyIDAgMCAxLTEuMy0xLjNaIi8%2BPC9zdmc%2B" alt="企业微信">
    <img src="https://img.shields.io/badge/QQ-1EBAFC?logo=qq&amp;logoColor=white" alt="QQ">
    <img src="https://img.shields.io/badge/Slack-4A154B?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTYgMTVhMiAyIDAgMSAxLTItMmgydjJabTEgMGEyIDIgMCAxIDEgNCAwdjVhMiAyIDAgMSAxLTQgMHYtNVptMi04YTIgMiAwIDEgMSAyLTJ2Mkg5Wm0wIDFhMiAyIDAgMSAxIDAgNEg0YTIgMiAwIDEgMSAwLTRoNVptOCAyYTIgMiAwIDEgMSAyIDJoLTJ2LTJabS0xIDBhMiAyIDAgMSAxLTQgMFY1YTIgMiAwIDEgMSA0IDB2NVptLTIgOGEyIDIgMCAxIDEtMiAydi0yaDJabTAtMWEyIDIgMCAxIDEgMC00aDVhMiAyIDAgMSAxIDAgNGgtNVoiLz48L3N2Zz4%3D" alt="Slack">
    <img src="https://img.shields.io/badge/Telegram-26A5E4?logo=telegram&amp;logoColor=white" alt="Telegram">
    <img src="https://img.shields.io/badge/Discord-5865F2?logo=discord&amp;logoColor=white" alt="Discord">
    <img src="https://img.shields.io/badge/WhatsApp-25D366?logo=whatsapp&amp;logoColor=white" alt="WhatsApp">
  </p>

  <p><strong>简体中文</strong> · <a href="README.en.md">English</a></p>
</div>

---

## 简介

通过扫码、App Manifest 或已有机器人凭据把 IM 机器人接入 DeepSeek Harness。一个插件、一个设置入口，统一管理飞书、微信、钉钉、企业微信、QQ、Slack、Telegram、Discord 和 WhatsApp 机器人。支持切换工作区和重新绑定会话。

Connect IM bots to DeepSeek Harness by scanning a QR code, using an App Manifest, or entering existing bot credentials. One plugin and one settings entry provide unified management for Feishu, WeChat, DingTalk, WeCom, QQ, Slack, Telegram, Discord, and WhatsApp bots. It also supports switching workspaces and rebinding sessions.

## 界面

![IM机器人页面](docs/images/imbot.png)

## 当前内置渠道

- 飞书：扫码创建机器人，或使用已有 App ID + App Secret 绑定机器人，使用长连接收发消息；
- 微信：扫码绑定微信机器人，使用腾讯 iLink 长轮询收发消息；
- 钉钉：扫码创建机器人，或使用已有 Client ID + Client Secret 绑定机器人，使用钉钉 Stream 长连接收消息，并通过 AI Card 流式显示 Harness 回答。
- 企业微信：使用企业微信 App 扫码创建智能机器人，或使用已有 Bot ID + Secret 绑定机器人，通过官方 WebSocket 长连接收消息，原生显示“正在思考中”、工具执行进度和流式回答。
- QQ：使用手机 QQ 扫码创建机器人，或使用已有 AppID + AppSecret 绑定机器人，通过 WebSocket 长连接收消息；私聊支持原生“正在输入”和流式回答，群聊在机器人被 @ 后回复。
- Slack：使用预置 App Manifest 辅助创建并配置应用，再填写 Bot Token（`xoxb-`）与 App Token（`xapp-`），通过 Socket Mode 长连接收消息；私聊直接回复，频道仅在机器人被 @ 时响应，并优先使用 Slack 官方流式消息 API 显示 Harness 回答。
- Telegram：使用 @BotFather 生成的 Bot Token 接入机器人，通过官方 Bot API 长轮询收消息；私聊直接回复，群聊仅在机器人被提及或收到对机器人消息的回复时响应，并通过编辑消息流式显示 Harness 回答。
- Discord：使用 Developer Portal 生成的 Bot Token 接入机器人，通过 Gateway v10 长连接收消息；私信直接回复，服务器频道仅在机器人被提及时响应，并通过编辑消息流式显示 Harness 回答。
- WhatsApp：使用手机 WhatsApp 扫码关联设备，通过 WhatsApp Web 长连接收消息；收到消息后显示已读和“正在输入”，再发送 Harness 的最终回答。

其他 IM 平台可继续按同一渠道适配器结构接入。

九个内置渠道均支持把 JPEG、PNG、WebP 图片，以及以图片文件方式发送的 GIF，连同可选文字说明发送给 Harness；单张图片上限为 5 MB，单条消息中的图片总大小上限为 20 MB。

## 安装

推荐从 npm 安装已发布的稳定版本：

```sh
dsh plugin --profile web add -w @xmanrui/dsh-im
```

重启 `dsh web`，然后打开「设置 → 插件 → IM机器人」。

如需试用尚未发布到 npm 的最新代码，可以改用 GitHub 源安装器：

```sh
npx -y github:xmanrui/dsh-im install
```

GitHub 源安装会直接拉取并构建 Git 依赖；pnpm 10 及以上版本可能要求先在 profile 的 `pnpm-workspace.yaml` 中允许该依赖执行构建脚本。普通用户建议优先使用 npm 稳定版。GitHub 安装器会用 `dsh-im` 替换 profile 中直接安装的 `dsh-feishu`、`dsh-weixin` 和 `dsh-dingtalk`，但不删除任何渠道数据；原有渠道凭据和扫码绑定会继续使用。

飞书、QQ、钉钉和企业微信页面都提供两种入口：带二维码图标的蓝色「扫码接入机器人」按钮走平台官方扫码流程，右侧带钥匙图标的白色描边「手动接入」按钮连接已经创建的机器人应用。飞书和 QQ 分别填写 App ID + App Secret、AppID + AppSecret；钉钉填写官方 Client ID + Client Secret；企业微信填写官方 Bot ID + Secret。Secret 只提交给本机 Harness Host，并写入受保护的凭据存储；状态接口和机器人列表不会回传 Secret。

Telegram 和 Discord 没有官方扫码创建机器人流程，因此页面只显示带钥匙图标的「手动接入」入口，并只要求 Bot Token。Telegram Token 由 @BotFather 生成；若该机器人已经配置 Webhook，需要先由原服务移除 Webhook，Bot API 长轮询才能接管消息。Discord Token 来自 Developer Portal 的 Bot 页面；还需把机器人邀请到目标服务器，并授予查看频道、发送消息和读取历史消息权限。本插件只读取私信和明确提及机器人的服务器消息，因此不要求 Message Content 特权 Intent。

Slack 页面提供 Manifest 辅助创建与双 Token 接入。点击「开始接入」，复制页面提供的 App Manifest，再打开 Slack 创建页并选择 **From a manifest**；创建后在 **Basic Information → App-Level Tokens** 生成包含 `connections:write` 的 App Token，并在 **OAuth & Permissions** 将应用安装到工作区以取得 Bot Token。插件会验证两个 Token，再通过 Socket Mode 建立连接；Slack 没有官方扫码创建机器人流程。图片读取使用 Manifest 中的 `files:read`；升级前已安装的 Slack App 需要重新安装或重新授权，才能获得该权限。两个 Token 只提交到本机 Harness Host 并写入受保护的凭据存储，状态接口和机器人列表不会回传 Token。

WhatsApp 页面只显示「扫码接入机器人」。打开手机 WhatsApp 的「设置 → 已关联设备 → 关联设备」，扫描 Harness 页面中的二维码即可，不需要 Meta 控制台、Cloud API、Webhook、Phone Number ID 或 Access Token。关联设备状态只保存在本机 `~/.dsh/integrations/dsh-whatsapp/auth`，浏览器只会收到一次性二维码和脱敏后的账号状态。个人账号可在 WhatsApp 的「给自己发消息」会话中直接使用；插件按消息 ID 过滤自己的回复，避免形成回复循环。

建议为机器人准备独立 WhatsApp 号码。关联个人常用账号会让发给该账号的私聊消息成为 Harness 输入；群聊只有明确提及该账号或回复该账号消息时才会触发。请只把机器人号码开放给可信联系人，并在不再使用时同时从 Harness 和手机「已关联设备」中移除。

钉钉扫码接入时，请使用已加入企业/组织且有权创建机器人的钉钉账号扫描页面二维码，再在钉钉授权页点击「一键创建新机器人」。若提示“该账号还未加入组织”，请先创建组织或换用已加入组织的账号后重新扫码。插件不设置本机二次批准流程，钉钉中的机器人可见范围就是入站访问范围，请只开放给信任的组织、群或成员。图片下载不会新增独立权限，但依赖机器人已有的“企业内机器人发送消息权限”；手动绑定的已有应用若未开启该权限，可以收到图片回调，但无法换取临时下载地址。

企业微信扫码接入时，请使用已加入企业且具有机器人创建或管理权限的企业微信账号，并在手机端确认创建智能机器人。扫码创建的是企业微信智能机器人，不是让插件直接登录个人微信账号。无论扫码还是凭据绑定，企业微信中的机器人可见范围就是入站访问范围，请只开放给信任的企业成员和群聊。

QQ 扫码接入使用腾讯 QQBot v2 官方流程。默认腾讯授权页会把接入方显示为“第三方机器人”；扫码成功后创建的是 QQ 开放平台机器人，并不是让插件直接控制个人 QQ 账号。扫码绑定只接受扫码者的消息；手动凭据无法识别扫码人，因此使用 QQ 开放平台中的机器人可见范围作为入站访问范围。

飞书扫码绑定会把扫码者作为允许使用者；手动凭据同样无法识别扫码人，因此使用飞书应用的可见范围作为入站访问范围。请在飞书开放平台中只向信任的租户、群或成员开放应用。读取用户发送的图片需要租户权限 `im:message:readonly`；新扫码创建的应用会申请该权限，升级前已存在的应用需要在飞书开放平台手动添加权限、发布版本并完成必要的管理员审批。

每个机器人维护独立的 Harness 工作区。新接入机器人会把 Harness Host 进程当时的工作目录（`process.cwd()`）记录为默认值；该路径会持久化，不会因为以后从其他目录重启 Host 而改变。设置页的机器人卡片会显示当前路径，并可直接修改。

渠道没有显式配置 `agentPreset` 时，新建的 IM 会话继承 Harness 的 `agent-presets.default` 全局默认值。Harness 会在每次创建会话时读取该默认值，因此修改设置只影响之后创建的新会话；已有会话以及通过 `/session` 绑定的会话保持自身 preset。渠道显式配置的 `agentPreset` 始终优先。

## 机器人命令

| 命令 | 作用 |
| --- | --- |
| `/help` | 显示机器人支持的命令和用法。 |
| `/new` | 解除当前聊天的会话绑定，让下一条普通消息开启全新 Harness 会话。 |
| `/status` | 检查当前机器人与 DeepSeek Harness 的连接状态。 |
| `/models` | 按 Provider 列出当前配置的全部可用模型。 |
| `/model` | 查看当前聊天绑定会话正在使用的模型。 |
| `/model <Provider/模型ID>` | 切换当前聊天绑定会话的模型。 |
| `/stop` | 立即停止当前聊天正在运行的任务，并保留尚未开始的排队消息。 |
| `/steer <补充指令>` | 把补充指令立即加入当前聊天正在运行的任务。 |
| `/compact` | 立即压缩当前聊天绑定会话的较早上下文。 |
| `/workspace <工作区绝对路径>` | 切换当前机器人的 Harness 工作区。 |
| `/workspacelist` | 列出当前 Harness Host 上仍然存在的工作区绝对路径。 |
| `/sessionlist [工作区序号或绝对路径]` | 列出指定工作区登记的所有会话 ID 和标题；省略参数时使用当前工作区。 |
| `/session <Session ID>` | 将当前聊天绑定到指定的已有 Harness 会话。 |
| 交互式提问 | 回复选项序号、选项文字或自定义文字；多选时用逗号分隔。 |
| 远程审批 | 回复 `批准` / `拒绝` / `同意` / `不同意` / `yes` / `no`。 |

示例：`/help`、`/new`、`/status`、`/models`、`/model deepseek-official/deepseek-v4-pro`、`/steer 只检查配置文件`、`/stop`、`/compact`、`/workspace /Users/alice/projects/my-app`、`/sessionlist 2`、`/sessionlist /Users/alice/projects/my-app` 或 `/session session-id`

### 命令说明

- `/help` 不需要参数，也不会创建会话；它会返回当前机器人支持的完整命令列表。
- `/status` 不需要参数，也不会向模型发送消息或改变会话绑定；它用于确认当前机器人能够连接 DeepSeek Harness。
- `/new` 只解除当前聊天在 dsh-im 中保存的会话绑定，不会删除、清空或归档旧 Session。下一条普通消息会在当前工作区创建并绑定一个新 Session。任务正在运行或等待问题、审批时，应先完成交互或使用 `/stop`，再使用 `/new`。
- `/models` 不需要参数，也不会创建会话。它列出 Harness 当前配置的全部可用模型，使用可稳定复制的 `Provider/模型ID`；某个 Provider 查询失败时，其他 Provider 的结果仍会显示。
- `/model` 不带参数时只查看当前会话模型；带完整模型 ID 时只接受 `/models` 列出的精确值。聊天尚无会话时，有效的切换命令会创建并绑定一个空白会话，但不会触发模型回复。切换只影响当前会话；Harness 还会尝试把它保存为以后新会话的默认模型，已有其他会话不受影响。
- 正在运行任务或等待审批、问题回答时不能切换模型；请等待完成，或先使用 `/stop`。含图片的会话无法切换到不支持图片输入的模型。
- `/stop` 和 `/steer` 只控制当前聊天自己发起的运行任务，即使多个聊天绑定同一个 Session，也不会有意控制其他聊天的任务。`/stop` 不删除会话或历史，并保留尚未开始的排队消息；重复发送是安全的。
- `/steer` 只接受文字，可包含多行；它不会创建新会话或第二个任务。没有运行任务时请直接发送普通消息；等待审批或问题回答时请先处理交互，或使用 `/stop`。
- `/compact` 只作用于当前聊天已经绑定的 Harness 会话，不会把命令发送给模型。当前聊天尚未创建会话、会话正在生成回复或没有可压缩历史时，机器人会直接返回对应状态。
- 只接受已经存在的绝对目录；路径无效时机器人会返回具体提示和正确用法。
- `/workspacelist` 不需要参数。它合并 Harness 全局登记项与当前机器人的路径；当前路径仍存在且可安全显示时会排在首位并标记为“当前”。结果可直接复制到 `/workspace` 命令。
- `/sessionlist` 的数字参数按命令执行时与 `/workspacelist` 相同的最新顺序解析；也可使用绝对路径直接指定工作区。结果会回显最终选中的路径。
- `/sessionlist` 会列出该工作区登记的所有会话。已归档会话会标记为“已归档”；空白会话和子代理会话在它们归属该工作区时也会列出；没有标题的会话显示为“暂无标题”。结果中的 ID 可直接用于 `/session Session ID`。
- `/session` 只接受一个由 `/sessionlist` 获得的 Session ID。它不会新建会话或立即向模型发送消息；绑定成功后，当前聊天的后续消息会继续该会话。普通归档会话可以绑定但不会自动取消归档，子代理会话不能绑定。
- `/session` 会自动定位会话唯一所属的工作区。同工作区绑定只替换当前聊天的映射；跨工作区绑定会切换该机器人的工作区、清除该机器人所有聊天的旧会话映射，再绑定当前聊天，因此会影响该机器人的其他聊天。已经开始生成的回复仍可完成。
- 工作区切换和会话绑定只会清除或替换 dsh-im 的聊天映射，不会删除、清空或归档任何旧 Session 内容；旧 Session 仍可再次列出和绑定。
- 任何已在对应平台可见范围内、能够正常向机器人发消息的用户都可以执行这些命令，不区分管理员和普通用户。
- 工作区列表来自 Harness Host 的全局登记信息，可能包含其他机器人、其他渠道或非 IM 项目的本机绝对路径。请将机器人可见范围限制给可信用户。
- 会话列表同样来自该全局 Harness Host；会话 ID 和标题可能属于其他机器人、其他渠道或非 IM 项目，并可能包含敏感元数据。开放命令前请确保所有可见用户都可信。
- 任何能执行 `/session` 的用户都能接续所选会话，并通过后续消息写入会话或触发其可用工具。请只向可信用户开放机器人及其会话列表。
- 切换成功后只清除当前机器人的旧 Harness 会话映射，不影响其他机器人。
- 新工作区对后续消息生效；已经开始生成的回复会继续完成。

## 其它功能

- **图片识别**：九个内置渠道都可以把 JPEG、PNG、WebP，以及以图片文件方式发送的 GIF 交给 Harness；图片可以附带文字说明。单张图片上限为 5 MB，单条消息中的图片总大小上限为 20 MB。
- **在机器人卡片切换工作区**：设置页中的每张机器人卡片都会显示当前 Harness 工作区。可以直接填写已有目录的绝对路径，也可以打开目录选择器。切换只清除该机器人的旧聊天映射，不会删除、清空或归档旧 Session；已经开始的回复可以继续完成，后续消息使用新工作区。
- **检查连接并发送测试消息**：机器人在线时，点击卡片上的「检查连接」会检查平台连接，并向该机器人最近记录的私聊发送一条“DeepSeek Harness 连接测试成功”消息；WhatsApp 会发送到账号自聊。测试消息不会创建 Harness Session，也不会调用模型。机器人必须至少收到过一条私聊才能记住测试目标，否则页面会提示尚无可用的测试会话。
- **重试连接和移除接入**：机器人离线时，卡片上的操作会变为「重试连接」；不再使用时可以点击「移除接入」。这些操作都只作用于所选机器人，不影响其他机器人或渠道。
- **多机器人独立管理**：同一渠道可以接入多个机器人。每个机器人分别保存凭据、连接状态、工作区和聊天会话映射，卡片上的工作区、连接检查、重试和移除操作互不影响。
- **流式回复和进度提示**：插件会按各平台能力显示正在思考、工具执行和逐步生成的回答；不支持原生流式接口的平台会通过编辑消息、卡片更新或最终消息完成回复。

## 设计

- Harness 中只注册一个「IM机器人」设置页；
- 九个渠道的 Host、客户端与运行时源码都在本仓库维护，不依赖外部独立渠道插件；
- 设置页跟随 DeepSeek Harness 的语言选择，在中文和 English 之间即时切换；
- 左侧使用渠道 Logo 切换微信、飞书、钉钉、企业微信、QQ、Slack、Telegram、Discord 和 WhatsApp，不使用启用/停用开关；
- 九个渠道保持独立的 RPC、凭据、连接监督和会话映射；
- 浏览器只获得二维码、Manifest 和脱敏状态；手动输入的 Secret 或 Token 仅单向提交给本机 Host，任何 RPC 响应都不会返回 App Secret、`bot_token`、钉钉 `client_secret`、企业微信 Secret、QQ `app_secret`、Slack Bot/App Token、Telegram/Discord Bot Token、WhatsApp 关联设备密钥或原始用户标识。

## 本地开发

```sh
npm install
npm run check
node bin/dsh-im.mjs install --source .
```

`npm run check` 运行单元测试、构建 Host/Client 产物，并验证发布包不包含凭据或独立渠道设置页注册。

IM 管理 RPC 默认仅接受回环浏览器。如果 Web profile 在受信任的局域网内对外提供服务，可在该 profile 的 `cordis.patch.yml` 中显式开放给 Connection 已信任的 Host authority：

```yaml
- id: xmanrui-dsh-im
  config:
    rpcAuthority: trusted-host
```

`trusted-host` 只复用 Harness 的 Host／Origin 防护，不是用户认证。启用后，能访问该局域网地址的人也能查看机器人状态、扫码或提交应用凭据、重连和删除机器人；只应在可信网络中使用。

---

## 联系方式

欢迎通过邮箱、微信或小红书联系我。

<table>
  <tr>
    <th align="center">邮箱</th>
    <th align="center">微信</th>
    <th align="center">小红书</th>
  </tr>
  <tr>
    <td align="center" valign="middle">
      <a href="mailto:longmanr307@gmail.com">longmanr307@gmail.com</a>
    </td>
    <td align="center" valign="top">
      <a href="docs/images/weixin.jpg"><img src="docs/images/weixin.jpg" alt="微信二维码" width="240"></a>
    </td>
    <td align="center" valign="top">
      <a href="docs/images/xhs.jpg"><img src="docs/images/xhs.jpg" alt="小红书二维码" width="240"></a>
    </td>
  </tr>
</table>
