/**
 * Feishu interactive-card builders for the dsh-im menu / session-list /
 * workspace-list UX. All builders return the JSON string the
 * `im.message.create` API expects as `content` for `msg_type: interactive`
 * (card schema 2.0; callback buttons live inside a column_set/column layout).
 *
 * Buttons carry a small `{ action }` callback behavior that
 * `card.action.trigger` events echo back (when the app subscribes that
 * callback); every button also carries a numeric label so the number-reply
 * fallback stays usable without button callbacks.
 */

export const MENU_PAGE_SIZE = 10;

function plainText(content) {
  return { tag: 'plain_text', content: String(content) };
}

function markdown(content) {
  return { tag: 'lark_md', content: String(content) };
}

function button(content, actionValue) {
  return {
    tag: 'column_set',
    flex_mode: 'none',
    columns: [{
      tag: 'column',
      width: 'weighted',
      weight: 1,
      elements: [{
        tag: 'button',
        text: plainText(content),
        type: 'default',
        width: 'fill',
        behaviors: [{ type: 'callback', value: { action: actionValue } }],
      }],
    }],
  };
}

function safeTitle(value) {
  const title = String(value ?? '').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
  return title || '暂无标题';
}

function cardWith(headerText, elements) {
  return JSON.stringify({
    schema: '2.0',
    header: { title: plainText(headerText), template: 'blue' },
    body: { elements },
  });
}

/** The main command menu (buttons + number-reply fallback). */
export function menuCard() {
  return cardWith('🤖 助手菜单', [
    { tag: 'div', text: markdown('**点击按钮或直接回复数字**') },
    button('1 · 会话列表', 'sessions'),
    button('2 · 工作区', 'workspaces'),
    button('3 · 新会话', 'new'),
    button('4 · 状态', 'status'),
    button('5 · 帮助', 'help'),
    // Repair must remain number-driven. Apps that need this command do not
    // have card.action.trigger yet, so rendering it as a callback button would
    // send the user straight back to Feishu's broken callback setup popup.
    { tag: 'div', text: markdown('**6 · 修复卡片按钮**（请直接回复数字 **6**）') },
  ]);
}

/** One-shot callback probe used only after an existing app was re-authorized. */
export function cardActionProbeCard(nonce) {
  if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new TypeError('A safe card-action probe nonce is required');
  }
  return cardWith('🧪 验证卡片按钮', [
    {
      tag: 'div',
      text: markdown('授权已提交。请点击下方按钮；机器人真实收到回调后才会判定修复成功。'),
    },
    {
      tag: 'column_set',
      flex_mode: 'none',
      columns: [{
        tag: 'column',
        width: 'weighted',
        weight: 1,
        elements: [{
          tag: 'button',
          text: plainText('完成验证'),
          type: 'primary',
          width: 'fill',
          behaviors: [{
            type: 'callback',
            value: { action: 'repair_verify', nonce },
          }],
        }],
      }],
    },
  ]);
}

/**
 * One page of the workspace's sessions. Each row is a bind button; the
 * number label equals the reply-number for the same action (fallback).
 */
export function sessionListCard(workspace, sessions, page, total) {
  const start = page * MENU_PAGE_SIZE;
  const slice = sessions.slice(start, start + MENU_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / MENU_PAGE_SIZE));
  const elements = [
    { tag: 'div', text: markdown(`**工作区**：\`${workspace}\`\n共 **${total}** 个会话${total > MENU_PAGE_SIZE ? `（第 ${page + 1}/${pageCount} 页）` : ''}`) },
    ...slice.map((session, offset) => button(
      `${offset + 1}. ${safeTitle(session.title)}`,
      `use:${session.sessionId}`,
    )),
  ];
  if (page > 0) elements.push(button('◀ 上一页', `sessions:${page - 1}`));
  if (page + 1 < pageCount) elements.push(button('下一页 ▶', `sessions:${page + 1}`));
  elements.push({ tag: 'div', text: markdown('回复数字（1~N）同样可以绑定本页会话。') });
  return cardWith('📂 会话列表', elements);
}

/** The workspace list card (switch-workspace buttons + reply fallback). */
export function workspaceListCard(paths, current) {
  const elements = paths.length === 0
    ? [{ tag: 'div', text: markdown('当前 Host 上没有已登记的工作区。') }]
    : [
        { tag: 'div', text: markdown(`回复数字切换工作区，或点击按钮：`) },
        ...paths.map((path, index) => button(
          `${index + 1}. ${path}${path === current ? '（当前）' : ''}`,
          `workspace:${path}`,
        )),
      ];
  return cardWith('🗂 工作区', elements);
}

/** The card-menu help text (number-driven, no command memorization). */
export function menuHelpText() {
  return [
    '🤖 助手菜单（回复数字即可，无需记命令）',
    '',
    '1 · /sessionlist  列出会话（回复数字绑定）',
    '2 · /workspacelist  列出工作区（回复数字切换）',
    '3 · /new  开启新会话',
    '4 · /status  连接状态',
    '5 · /help  本帮助',
    '6 · /repair  修复卡片按钮（请回复数字 6）',
    '',
    '直接发送文字/图片即继续当前会话。',
    '/session ID 或序号  绑定已有会话',
    '/compact  压缩上下文',
    '/workspace 绝对路径  切换工作区',
  ].join('\n');
}

/** The watch list for one conversation (unwatch buttons + reply fallback). */
export function watchListCard(entries) {
  const elements = entries.length === 0
    ? [{ tag: 'div', text: markdown('当前没有关注的会话。\n`/watch <ID|序号>` 关注后，任务完成会自动推送。') }]
    : [
        { tag: 'div', text: markdown('任务完成会自动推送，回复数字或点按钮取消关注：') },
        ...entries.map((entry, index) => button(
          `${index + 1}. ${safeTitle(entry.title)}`,
          `unwatch:${entry.sessionId}`,
        )),
      ];
  return cardWith('👁 关注列表', elements);
}

/**
 * The completion push card. `title` is the session title, `reason` the
 * turn-end kind (completed / stopped / aborted).
 */
export function completionCard(sessionId, title, reason) {
  const reasonText = reason === 'stopped' ? '已停止' : reason === 'aborted' ? '已中止' : '已完成';
  return cardWith('✅ 任务完成', [
    { tag: 'div', text: markdown(`**${safeTitle(title)}**\n\`${sessionId}\``) },
    { tag: 'div', text: markdown(`**状态**：${reasonText}`) },
    button('打开会话列表', 'sessions'),
    button('工作区', 'workspaces'),
    { tag: 'div', text: markdown('绑定该会话后可继续追问，输入文字即可。') },
  ]);
}
