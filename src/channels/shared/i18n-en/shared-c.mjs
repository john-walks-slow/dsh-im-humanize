// English translations (shared-c area). Keys are exact Chinese literals passed to t().
export default {
  // harness-approval.mjs
  '请精准回复「批准」或「拒绝」（也支持：同意 / 不同意 / yes / no）。':
    'Please reply exactly with 「批准」 (approve) or 「拒绝」 (reject). Also accepted: 同意 / 不同意 / yes / no.',
  '请先完成当前问题，再精准回复「批准」或「拒绝」。':
    'Please finish the current question first, then reply exactly with 「批准」 (approve) or 「拒绝」 (reject).',
  '该审批已处理，无需再次回复。':
    'This approval has already been handled; no need to reply again.',
  'DeepSeek Harness 需要你的审批：':
    'DeepSeek Harness needs your approval:',
  '工具：{tool}': 'Tool: {tool}',
  '操作参数：': 'Operation parameters:',
  '原因：{reason}': 'Reason: {reason}',
  '群聊中请 @机器人 后发送审批决定。':
    'In group chats, please @ the bot before sending your approval decision.',
  '只有发起当前任务的用户可以处理这条审批。':
    'Only the user who started the current task can handle this approval.',
  '审批决定正在提交，请稍候。':
    'Your approval decision is being submitted; please wait.',
  '已批准，仅对本次操作有效。':
    'Approved — valid for this operation only.',
  '已拒绝此次操作。': 'This operation was rejected.',
  '无法完整展示这次操作，已安全拒绝此次审批。':
    'The operation could not be displayed in full, so this approval was safely rejected.',
  '审批提交失败，请重新回复「批准」或「拒绝」。':
    'Failed to submit the approval; please reply with 「批准」 (approve) or 「拒绝」 (reject) again.',

  // harness-question.mjs
  'DeepSeek Harness 需要你补充信息{progress}：':
    'DeepSeek Harness needs more information{progress}:',
  '请输入你的回答。': 'Please enter your answer.',
  '请回复选项序号或文字；多选用逗号分隔，也可补充其他内容。':
    'Reply with option numbers or text; separate multiple choices with commas, or add anything else.',
  '请回复一个选项序号或文字，也可直接输入其他答案。':
    'Reply with an option number or its text, or type your own answer directly.',
  '请直接回复你的答案。': 'Please reply with your answer directly.',
  '群聊中请 @机器人 后发送答案。':
    'In group chats, please @ the bot before sending your answer.',

  // image-prompt.mjs
  '当前模型不支持图片，请用 /models 查看可用模型，再用 /model <序号> 切换后重发。':
    'The current model does not support images. Use /models to list available models, switch with /model <number>, then resend.',
  '图片超过宿主允许的大小，请压缩后重试。':
    'The image exceeds the size allowed by the host; compress it and try again.',
  '图片分辨率过高，请压缩后重试。':
    'The image resolution is too high; compress it and try again.',
  '图片内容无效或格式不受支持，请重新发送。':
    'The image content is invalid or its format is unsupported; please resend it.',
  '未能读取图片内容，请重新发送。':
    'Could not read the image content; please resend it.',
  '图片格式与实际内容不一致，请重新发送。':
    'The image format does not match its actual content; please resend it.',
  '一次发送的图片数量超过宿主限制，请减少后重试。':
    'The number of images sent at once exceeds the host limit; send fewer and try again.',
  '图片总大小超过宿主限制，请减少图片或压缩后重试。':
    'The total image size exceeds the host limit; send fewer images or compress them and try again.',
  '图片下载地址发生了重定向，暂时无法读取。':
    'The image download URL redirected and cannot be read right now.',
  '图片下载失败（HTTP {status}），请重新发送后再试。':
    'Image download failed (HTTP {status}); please resend it and try again.',
  '图片超过 5 MB，请压缩后重试。':
    'The image is larger than 5 MB; compress it and try again.',
  '一次最多只能处理 {maxImages} 张图片。':
    'At most {maxImages} images can be processed at once.',
  '一次发送的图片总大小过大，请减少图片数量或压缩后重试。':
    'The total size of the images sent is too large; send fewer images or compress them and try again.',
  '图片下载失败，请重新发送后再试。':
    'Image download failed; please resend it and try again.',
  '暂不支持该图片格式，请发送 JPEG、PNG、WebP 或 GIF 图片。':
    'This image format is not supported yet; please send a JPEG, PNG, WebP, or GIF image.',

  // connection-test.mjs
  '✅ DeepSeek Harness 连接测试成功':
    '✅ DeepSeek Harness connection test succeeded',
  '这条消息由插件页面中的“{name}”机器人卡片发出。':
    'This message was sent from the "{name}" bot card on the plugin page.',
  '{channelLabel}尚未收到可用于测试的私聊消息。':
    'The {channelLabel} has not received a direct message that can be used for testing yet.',
  '机器人': 'bot',

  // editable-message-stream.mjs / harness-client.mjs / progress text
  '正在处理…': 'Processing…',
  '处理完成。': 'Processing complete.',
  '工具': 'tool',
  '正在整理结果…': 'Gathering results…',
  '_正在搜索网络并整理信息…_': '_Searching the web and gathering information…_',
  '_正在使用 {name}…_': '_Using {name}…_',

  // image-prompt.mjs
  '请分析这张图片。': 'Analyze this image.',

  // inbound-file.mjs
  '文件接收失败，请重新发送后再试。': 'File reception failed. Please resend it.',
  '文件下载失败，请重新发送后再试。': 'File download failed. Please resend it.',

  // agent-preset.mjs
  'Agent Preset 无效。': 'Invalid Agent Preset.',
};
