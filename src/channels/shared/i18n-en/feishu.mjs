// English translations (feishu area). Keys are exact Chinese literals passed to t().
export default {
  // feishu/bridge.mjs — welcome / help
  '北汇星河 AIOS 已连接 DeepSeek Harness。':
    'BeiHui XingHe AIOS is connected to DeepSeek Harness.',
  '/repair  修复卡片按钮回调': '/repair  Repair the card-button callback',
  '/m（或 /menu）  打开交互卡片菜单': '/m (or /menu)  Open the interactive card menu',
  '/watch [Session ID 或序号]  关注会话，任务完成自动推送':
    '/watch [Session ID or index]  Watch a session; completion is pushed automatically',
  '/unwatch [Session ID 或序号]  取消关注':
    '/unwatch [Session ID or index]  Stop watching',
  '/watchlist  查看关注列表': '/watchlist  View the watch list',
  '/archived on|off  会话列表是否包含归档会话':
    '/archived on|off  Whether the session list includes archived sessions',
  '工作区必须是绝对路径。': 'The workspace must be an absolute path.',
  '工作区路径不存在。': 'The workspace path does not exist.',
  '工作区路径必须指向一个目录。': 'The workspace path must point to a directory.',
  '机器人正在移除或已重新接入，无法操作原会话的工作区。':
    'The bot is being removed or has been reconnected; the original session’s workspace cannot be changed.',
  '操作失败，请稍后重试。': 'The operation failed. Please try again later.',
  '结果文件「{name}」已生成，但机器人缺少飞书文件上传权限。请为应用添加 im:resource 并完成必要审批后重试。':
    'The result file "{name}" was generated, but the bot lacks Feishu file-upload permission. Add the im:resource scope to the app, complete the required approval, and try again.',
  '结果文件「{name}」超过飞书 30 MB 上限，未发送。':
    'The result file "{name}" exceeds the Feishu 30 MB limit and was not sent.',
  '结果文件「{name}」为空，飞书不允许发送空文件。':
    'The result file "{name}" is empty; Feishu does not allow sending empty files.',
  '结果文件「{name}」暂时被飞书限流，未能发送，请稍后重试。':
    'The result file "{name}" was temporarily rate-limited by Feishu and could not be sent. Please try again later.',
  '结果文件「{name}」已生成，但暂时未能发送，请稍后重试。':
    'The result file "{name}" was generated but could not be sent right now. Please try again later.',
  '处理失败，请稍后重试。如果问题持续，请在 DeepSeek Harness 的飞书插件页面检查连接状态。':
    'Message processing failed. Please try again later. If the problem persists, check the connection status on the Feishu plugin page in DeepSeek Harness.',
  '已开启全新 Harness 会话。': 'A brand-new Harness session has started.',
  '飞书机器人与 DeepSeek Harness 连接正常。':
    'The Feishu bot is connected to DeepSeek Harness and working normally.',
  '用法：/archived on（包含归档会话）或 /archived off（隐藏归档会话）':
    'Usage: /archived on (include archived sessions) or /archived off (hide archived sessions)',
  '已开启：会话列表包含归档会话。': 'On: the session list includes archived sessions.',
  '已关闭：会话列表隐藏归档会话。': 'Off: the session list hides archived sessions.',

  // feishu/bridge.mjs — repair flow
  '为避免授权链接暴露，请私聊机器人发送 /repair。':
    'To keep the authorization link private, send /repair to the bot in a direct message.',
  '当前机器人没有可验证的接入者身份，不能从聊天发起修复；请先在插件页设置管理员。':
    'This bot has no verifiable owner identity, so repair cannot be started from chat. Set an administrator on the plugin page first.',
  '此操作只能由机器人接入者在私聊中发起，未进行任何修改。':
    'This action can only be started by the bot owner in a direct message. Nothing was changed.',
  '当前 Host 版本暂不支持聊天内修复，请先更新插件。':
    'The current Host version does not support in-chat repair. Update the plugin first.',
  '用法：/repair、/repair qr、/repair status、/repair cancel 或 /repair verify':
    'Usage: /repair, /repair qr, /repair status, /repair cancel, or /repair verify',
  '当前 Runtime 没有可恢复的修复任务记录（机器人可能刚完成密钥更新并重启）。本命令不会启动新的授权；请查看机器人发送的验证结果，确认上一次任务已结束后再发送 /repair。':
    'The current Runtime has no recoverable repair attempt (the bot may have just rotated its secret and restarted). This command starts no new authorization. Check the verification result the bot sent, then send /repair after the previous attempt has finished.',
  '另一位管理员正在修复该机器人，本次不会显示其授权信息。':
    'Another administrator is repairing this bot; its authorization info will not be shown this time.',
  '暂时无法取消修复任务，请稍后重试。':
    'Could not cancel the repair task right now. Please try again later.',
  '暂时无法查询修复状态，请稍后重试。':
    'Could not check the repair status right now. Please try again later.',
  '修复流程暂时失败，现有机器人连接不受影响；请稍后发送 /repair 重试。':
    'The repair flow failed for now; the existing bot connection is unaffected. Send /repair again later.',
  '飞书返回了无法安全验证的授权链接，已中止本次修复。':
    'Feishu returned an authorization link that cannot be verified safely. This repair was aborted.',
  '飞书未返回授权链接，已中止本次修复。':
    'Feishu did not return an authorization link. This repair was aborted.',
  '授权已确认，正在发送并等待测试按钮回调；收到真实回调后才会完成。':
    'Authorization confirmed. Sending a test button and waiting for its callback; this completes only after a real callback arrives.',
  '修复状态查询中断，现有机器人连接不受影响；发送 /repair status 重试查询。':
    'The repair status query was interrupted; the existing bot connection is unaffected. Send /repair status to retry.',
  '链接为短期有效': 'The link is valid for a short time.',
  '链接约 {minutes} 分钟后过期': 'The link expires in about {minutes} minutes',
  '已有一个修复任务在等待授权。': 'A repair task is already waiting for authorization.',
  '🔧 准备修复卡片按钮。': '🔧 Preparing to repair the card buttons.',
  '本次只会增量添加 card.action.trigger。请核对确认页只显示这一项；若出现其他权限或事件，请取消。':
    'Only card.action.trigger will be added. Check that the confirmation page shows only this item; cancel if any other permission or event appears.',
  '当前设备直接打开：': 'Open directly on this device:',
  '若要用另一台设备扫码，发送 /repair qr。{expiry}。':
    'To scan with another device, send /repair qr. {expiry}.',
  '请用另一台设备扫码完成授权{remaining}。':
    'Complete authorization by scanning with another device{remaining}.',
  '（剩余约 {minutes} 分钟）': ' (about {minutes} minutes left)',
  '二维码暂时无法发送，请直接打开授权链接：\n{url}':
    'The QR code could not be sent. Open the authorization link directly:\n{url}',
  '授权链接已过期；平台未返回成功结果，无法确认已修复。发送 /repair 生成新链接。':
    'The authorization link expired; the platform returned no success, so the repair cannot be confirmed. Send /repair for a new link.',
  '已取消本次修复授权，未确认完成修复。':
    'Repair authorization was cancelled; the repair was not confirmed.',
  '你已取消或拒绝授权，没有确认修复；发送 /repair 可重试。':
    'You cancelled or declined authorization, so the repair was not confirmed. Send /repair to retry.',
  '授权已提交，但未收到测试按钮回调。可能尚未点击或配置仍在传播；稍后发送 /repair verify 查询，不要盲目重复授权。':
    'Authorization was submitted, but no test-button callback arrived. It may not have been tapped yet, or the config is still propagating. Send /repair verify later to check; do not authorize blindly again.',
  '修复流程暂时失败，现有机器人连接不受影响；发送 /repair 可重试。':
    'The repair flow failed for now; the existing bot connection is unaffected. Send /repair to retry.',
  '授权已确认，正在等待专用测试按钮的真实回调；回调到达前不会宣告成功。':
    'Authorization confirmed. Waiting for the real callback from the dedicated test button; success is not declared until it arrives.',
  '授权尚未完成，暂时不能验证卡片按钮。请先打开授权链接并确认。':
    'Authorization is not complete, so the card buttons cannot be verified yet. Open the authorization link and confirm first.',
  '修复任务正在等待授权{remaining}。发送 /repair qr 可获取二维码，/repair cancel 可取消。':
    'The repair task is waiting for authorization{remaining}. Send /repair qr for the QR code, or /repair cancel to cancel.',
  '，剩余约 {minutes} 分钟': ', about {minutes} minutes left',
  '这个菜单已过期，请回复 /m 重新打开。': 'This menu has expired. Send /m to reopen it.',
  '菜单没有这个编号，回复 /m 重新打开。': 'This menu has no such number. Send /m to reopen it.',
  '本页只有 {count} 个会话，回复 /sessionlist 重新查看。':
    'This page has only {count} sessions. Send /sessionlist to view them again.',
  '只有 {count} 个工作区，回复 /workspacelist 重新查看。':
    'There are only {count} workspaces. Send /workspacelist to view them again.',
  '关注列表只有 {count} 个会话。': 'The watch list has only {count} sessions.',




  '已绑定会话「{title}」\nID：{id}': 'Session bound: "{title}"\nID: {id}',
  '绑定失败：{message}': 'Binding failed: {message}',

  '切换失败：{message}': 'Switch failed: {message}',
  '用法：/watch <Session ID 或当前工作区序号>':
    'Usage: /watch <Session ID or the current workspace index>',
  '当前机器人没有可用的工作区，无法按序号解析会话。':
    'This bot has no available workspace, so sessions cannot be resolved by index.',
  '当前工作区只有 {count} 个会话。': 'The current workspace has only {count} sessions.',
  '没有找到这个会话，请用 /sessionlist 查看可用会话。':
    'Session not found. Use /sessionlist to see the available sessions.',
  '当前状态存储不支持关注。': 'The current state store does not support watching.',
  '无法解析会话：{message}': 'Could not resolve the session: {message}',
  '每个聊天最多关注 {count} 个会话。': 'Each chat can watch at most {count} sessions.',
  '关注列表里没有这个会话，回复 /watchlist 查看。':
    'This session is not in the watch list. Send /watchlist to view it.',
  '已关注会话「{title}」，任务完成会推送结果。':
    'Watching session "{title}"; results are pushed when the task completes.',
  '关注失败：{message}': 'Could not watch: {message}',
  '已取消关注「{title}」。': 'Unwatched "{title}".',
  '取消失败：{message}': 'Could not unwatch: {message}',
  '飞书交互问题发送失败。': 'Failed to send the Feishu interaction question.',

  // feishu/feishu-cards.mjs — interactive cards
  '🤖 助手菜单': '🤖 Assistant menu',
  '**点击按钮或直接回复数字**': '**Tap a button or reply with a number**',
  '1 · 会话列表': '1 · Sessions',
  '2 · 工作区': '2 · Workspace',
  '3 · 新会话': '3 · New session',
  '4 · 状态': '4 · Status',
  '5 · 帮助': '5 · Help',
  '**6 · 修复卡片按钮**（请直接回复数字 **6**）':
    '**6 · Repair card buttons** (reply with the number **6**)',
  '7 · 关注列表': '7 · Watch list',
  '🧪 验证卡片按钮': '🧪 Verify card buttons',
  '授权已提交。请点击下方按钮；机器人真实收到回调后才会判定修复成功。':
    'Authorization submitted. Tap the button below; the repair is confirmed only after the bot receives the real callback.',
  '完成验证': 'Finish verification',
  '**工作区**：{workspace}\n共 **{total}** 个会话{paging}':
    '**Workspace**: {workspace}\n**{total}** sessions in total{paging}',
  '（第 {page}/{pageCount} 页）': ' (page {page}/{pageCount})',
  '⭐取关': '⭐ Unwatch',
  '⭐关注': '⭐ Watch',
  '◀ 上一页': '◀ Previous',
  '下一页 ▶': 'Next ▶',
  '回复数字（1~N）绑定本页会话。': 'Reply with a number (1–N) to bind a session on this page.',
  '📂 会话列表': '📂 Session list',
  '当前 Host 上没有已登记的工作区。': 'No workspaces are registered on the current Host.',
  '回复数字切换工作区，或点击按钮：': 'Reply with a number to switch workspaces, or tap a button:',
  '🗂 工作区': '🗂 Workspace',
  '🤖 助手菜单（回复数字即可，无需记命令）':
    '🤖 Assistant menu (reply with a number — no need to memorize commands)',
  '1 · /sessionlist  列出会话（回复数字绑定）':
    '1 · /sessionlist  List sessions (reply with a number to bind)',
  '2 · /workspacelist  列出工作区（回复数字切换）':
    '2 · /workspacelist  List workspaces (reply with a number to switch)',
  '3 · /new  开启新会话': '3 · /new  Start a new session',
  '4 · /status  连接状态': '4 · /status  Connection status',
  '5 · /help  本帮助': '5 · /help  This help',
  '6 · /repair  修复卡片按钮（请回复数字 6）':
    '6 · /repair  Repair card buttons (reply with the number 6)',
  '7 · /watchlist  关注列表': '7 · /watchlist  Watch list',
  '直接发送文字/图片即继续当前会话。':
    'Send text or an image directly to continue the current session.',
  '/session ID 或序号  绑定已有会话': '/session ID or index  Bind an existing session',
  '/watch ID 或序号  关注会话（完成后推送）':
    '/watch ID or index  Watch a session (push when done)',
  '/compact  压缩上下文': '/compact  Compact the context',
  '/workspace 绝对路径  切换工作区': '/workspace <absolute path>  Switch workspace',
  '/presetlist  列出可用 Agent Preset': '/presetlist  List available Agent Presets',
  '任务完成会自动推送，回复数字或点按钮取消关注：':
    'Completion is pushed automatically. Reply with a number or tap a button to unwatch:',
  '👁 关注列表': '👁 Watch list',
  '已完成': 'Completed',
  '已停止': 'Stopped',
  '已中止': 'Aborted',
  '已取消': 'Cancelled',
  '已结束': 'Ended',
  '✅ 任务完成': '✅ Task complete',
  '**状态**：{reason}': '**Status**: {reason}',
  '打开会话列表': 'Open session list',
  '工作区': 'Workspace',
  '绑定该会话后可继续追问，输入文字即可。':
    'After binding this session you can keep asking; just type a message.',
  '当前没有关注的会话。\n`/watch <ID|序号>` 关注后，任务完成会自动推送。':
    'No sessions are being watched.\nWatch one with `/watch <ID|index>` and completion is pushed automatically.',

  // feishu/feishu-channel.mjs
  '正在生成…': 'Generating…',
  '回答完成': 'Answer complete',
  '飞书机器人': 'Feishu bot',

  // feishu/message-utils.mjs
  '飞书机器人缺少图片读取权限。请在飞书开放平台为该应用添加 im:message:readonly，发布新版本并完成必要的管理员审批后，再重新发送图片。':
    'The Feishu bot is missing image-read permission. Add im:message:readonly to the app in Feishu Open Platform, publish a new version, complete the required admin approval, then resend the image.',

  // feishu/feishu-runtime.mjs — callback probe notices
  '✅ 修复完成：已实测收到 card.action.trigger，菜单按钮现在可用。':
    '✅ Repair complete: card.action.trigger was received in a real test; the menu buttons now work.',
  '⚠️ 修复验证超时：未收到测试卡按钮的 card.action.trigger，不能确认按钮已修复。请不要重复授权；先检查飞书开放平台的卡片回调配置，确认后再发送 /repair。':
    '⚠️ Repair verification timed out: no card.action.trigger from the test card button was received, so the buttons cannot be confirmed repaired. Do not authorize again; check the card-callback configuration in Feishu Open Platform first, then send /repair.',
  '⚠️ 修复验证失败：无法发送专用测试卡，不能确认 card.action.trigger 已恢复。请不要重复授权；先检查机器人消息权限和连接状态。':
    '⚠️ Repair verification failed: the dedicated test card could not be sent, so card.action.trigger cannot be confirmed restored. Do not authorize again; check the bot message permission and connection status first.',
  '⚠️ 修复验证中断：Runtime 已停止，未完成 card.action.trigger 实测，不能确认修复成功。请不要重复授权；先等待机器人恢复连接。':
    '⚠️ Repair verification interrupted: the Runtime stopped before the card.action.trigger test completed, so the repair cannot be confirmed. Do not authorize again; wait for the bot to reconnect.',
};
