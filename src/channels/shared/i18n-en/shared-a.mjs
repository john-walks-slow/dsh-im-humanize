// English translations (shared-a area). Keys are exact Chinese literals passed to t().
export default {
  '这个问题已在其他客户端处理，无需再次回答。':
    'This question has already been answered from another client; no further reply is needed.',
  '任务已完成。': 'Task completed.',
  '结果文件': 'result file',
  '结果文件「{name}」的发送结果未能确认，请先检查聊天内是否已收到，不要立即重试。':
    'The delivery result of the result file "{name}" could not be confirmed. Please check whether it already arrived in the chat before retrying.',
  '结果文件「{name}」已生成，但 Slack 应用缺少 files:write 权限。请更新 Manifest、重新安装应用并重新连接机器人后重试。':
    'The result file "{name}" was generated, but the Slack app is missing the files:write permission. Please update the Manifest, reinstall the app, reconnect the bot, and try again.',
  '结果文件「{name}」已生成，但机器人缺少 Discord 的 Send Messages、Attach Files 或 Read Message History 权限。':
    'The result file "{name}" was generated, but the bot is missing the Discord Send Messages, Attach Files, or Read Message History permission.',
  '结果文件「{name}」已生成，但 Telegram 不允许机器人在当前聊天发送文档，请检查聊天权限。':
    'The result file "{name}" was generated, but Telegram does not allow the bot to send documents in this chat. Please check the chat permissions.',
  '结果文件「{name}」已生成，但当前机器人没有文件发送权限，请检查渠道权限。':
    'The result file "{name}" was generated, but the bot does not have permission to send files. Please check the channel permissions.',
  '结果文件「{name}」超过当前渠道大小上限，未发送。':
    'The result file "{name}" exceeds the size limit of this channel and was not sent.',
  '结果文件「{name}」为空，未发送。':
    'The result file "{name}" is empty and was not sent.',
  '结果文件「{name}」暂时无法读取或准备发送，请确认文件仍可访问后重试。':
    'The result file "{name}" cannot be read or prepared for sending right now. Please make sure the file is still accessible and try again.',
  '结果文件「{name}」暂时被当前渠道限流，未能发送，请稍后重试。':
    'The result file "{name}" was temporarily rate-limited by this channel and could not be sent. Please try again later.',
  '结果文件「{name}」已生成，但当前渠道拒绝了该文件或文件消息。':
    'The result file "{name}" was generated, but this channel rejected the file or file message.',
  '结果文件「{name}」已生成，但当前渠道暂时未能发送，请稍后重试。':
    'The result file "{name}" was generated, but this channel could not send it right now. Please try again later.',
  '消息处理失败，请稍后重试。': 'Failed to process the message. Please try again later.',
  '{label}机器人': '{label} bot',
  '目前支持文字和图片消息。': 'Only text and image messages are supported at the moment.',
  '目前支持文字、图片和文件消息。':
    'Only text, image, and file messages are supported at the moment.',
  '目前支持文字、图片、文件和语音转写消息。':
    'Only text, image, file, and voice-transcription messages are supported at the moment.',
  '目前支持文字、图片、文件，以及微信已转成文字的语音消息。':
    'Only text, image, file, and voice messages already transcribed to text by WeChat are supported at the moment.',
  '直接发送文字或图片即可继续当前会话。': 'Send text or an image directly to continue the current session.',
  '直接发送文字、图片或文件即可继续当前会话。':
    'Send text, an image, or a file directly to continue the current session.',
  '直接发送文字、图片、文件或带文字识别结果的语音即可继续当前会话。':
    'Send text, an image, a file, or a voice message already transcribed to text to continue the current session.',
  '{label}机器人已连接 DeepSeek Harness。': 'The {label} bot is connected to DeepSeek Harness.',
  '/new  开启一个全新会话': '/new  Start a brand-new session',
  '/compact  压缩当前会话的较早上下文': '/compact  Compact the earlier context of the current session',
  '/workspace 工作区绝对路径  切换工作区': '/workspace <absolute workspace path>  Switch workspace',
  '/workspacelist  列出工作区绝对路径': '/workspacelist  List absolute workspace paths',
  '/sessionlist [工作区序号或绝对路径]  列出会话 ID 和标题':
    '/sessionlist [workspace index or absolute path]  List session IDs and titles',
  '/session Session ID 或当前工作区序号  将当前聊天绑定到指定会话':
    '/session <Session ID or workspace index>  Bind this chat to the specified session',
  '/models  按序号列出所有可用模型': '/models  List all available models by index',
  '/model [序号或完整模型ID]  查看或切换当前会话模型':
    '/model [index or full model ID]  Show or switch the model of the current session',
  '示例：先发 /models，再发 /model 2': 'Example: send /models first, then /model 2',
  '/presetlist  按序号列出可用 Agent Preset': '/presetlist  List available Agent Presets by index',
  '/preset [序号或完整ID]  查看或设置当前机器人 Agent Preset':
    '/preset [index or full ID]  Show or set the Agent Preset of this bot',
  '纯数字 ID：/preset id:<ID>': 'Numeric-only ID: /preset id:<ID>',
  '/preset --default  跟随 Host 默认': '/preset --default  Follow the Host default',
  '/stop  停止当前任务': '/stop  Stop the current task',
  '/steer 补充指令  纠偏当前任务': '/steer <additional instruction>  Steer the current task',
  '/status  检查连接状态': '/status  Check the connection status',
  '/help  显示本帮助': '/help  Show this help',
  '{label}机器人与 DeepSeek Harness 连接正常。':
    'The {label} bot is connected to DeepSeek Harness and working normally.',
  '{label}机器人凭据缺失，请移除后重新接入。':
    '{label} bot credentials are missing. Remove the bot and connect it again.',
  '{label}连接未就绪，插件会自动重试。':
    'The {label} connection is not ready yet. The plugin will retry automatically.',
  '{label}机器人已接入，消息连接暂未就绪。':
    'The {label} bot is connected, but its message connection is not ready yet.',
  '{label}连接仍未就绪，请稍后重试。':
    'The {label} connection is still not ready. Please try again later.',
  '{label}机器人尚未连接': 'The {label} bot is not connected yet',
  '{name}（{id}）': '{name} ({id})',
  '{label}{connectionLabel}运行正常': 'The {label}{connectionLabel} is running normally',
  '{label}连接未就绪，插件会自动重试':
    'The {label} connection is not ready. The plugin will retry automatically',
  '{label}连接当前离线': 'The {label} connection is currently offline',
  '已开启新会话。请发送你的问题。': 'A new session has started. Please send your question.',
  '正在使用{name}…': 'Using {name}…',
  '已停止。': 'Stopped.',
  '请用文字回答当前问题。': 'Please answer the current question with text.',
  '{label}交互问题发送失败。': 'Failed to send the {label} interaction question.',
  '回答提交失败。': 'Failed to submit the answer.',
  '回答提交失败，请重新发送当前问题的答案。':
    'Failed to submit the answer. Please resend your answer to the current question.',
  '检测到这个 Session 中遗留的待回答问题，已安全取消并继续处理你刚才的消息。':
    'A pending question left over in this Session was detected. It has been safely cancelled, and your latest message is being processed.',
};
