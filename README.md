<h1><img src="assets/logo-icon.png" alt="dsh-im logo" width="40" align="absmiddle" style="vertical-align: middle;"> dsh-im</h1>

---

<div align="center">
  <p><strong>让聊天机器人轻松接入 DeepSeek Harness</strong></p>
  <p><strong>Connect IM bots to DeepSeek Harness with ease</strong></p>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/xmanrui/dsh-im" alt="MIT 许可证"></a>
    <img src="https://img.shields.io/badge/agent-DeepSeek%20Harness-5865f2" alt="DeepSeek Harness">
    <img src="https://dsh-im-random-badge.xmanrui-dsh-im.workers.dev" alt="滑动变祖器：今天是梁子或今天是梁圣（随机）">
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

```sh
npx -y github:xmanrui/dsh-im install
```

也可以直接从 npm 安装：

```sh
dsh plugin --profile web add @xmanrui/dsh-im
```

重启 `dsh web`，然后打开「设置 → 插件 → IM机器人」。安装器会用 `dsh-im` 替换 profile 中直接安装的 `dsh-feishu`、`dsh-weixin` 和 `dsh-dingtalk`，但不删除任何渠道数据；原有渠道凭据和扫码绑定会继续使用。

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

## 机器人命令

| 命令 | 作用 |
| --- | --- |
| `/compact` | 立即压缩当前聊天绑定会话的较早上下文。 |
| `/workspace <工作区绝对路径>` | 切换当前机器人的 Harness 工作区。 |
| `/workspacelist` | 列出当前 Harness Host 上仍然存在的工作区绝对路径。 |
| `/sessionlist [工作区序号或绝对路径]` | 列出指定工作区登记的所有会话 ID 和标题；省略参数时使用当前工作区。 |
| `/session <Session ID>` | 将当前聊天绑定到指定的已有 Harness 会话。 |

示例：`/compact`、`/workspace /Users/alice/projects/my-app`、`/sessionlist 2`、`/sessionlist /Users/alice/projects/my-app` 或 `/session session-id`

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
