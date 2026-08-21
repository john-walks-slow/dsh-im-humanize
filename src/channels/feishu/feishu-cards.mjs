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
    '',
    '直接发送文字/图片即继续当前会话。',
    '/session ID 或序号  绑定已有会话',
    '/compact  压缩上下文',
    '/workspace 绝对路径  切换工作区',
  ].join('\n');
}
