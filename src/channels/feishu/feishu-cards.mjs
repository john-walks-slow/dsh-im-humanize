/**
 * Feishu interactive-card builders for the dsh-im menu / session-list /
 * workspace-list UX. All builders return the JSON string the
 * `im.message.create` API expects as `content` for `msg_type: interactive`
 * (card schema 2.0; callback buttons live inside a column_set/column layout).
 *
 * The session list lays each row out as a `column_set` (fixed-width ⭐
 * watch-toggle column + weighted session-button column), which is how V2
 * expresses a row of buttons.
 *
 * Buttons carry a small `{ action }` value object that `card.action.trigger`
 * events echo back (when the app subscribes that event); every numbered
 * button also has a numeric label so the number-reply fallback stays usable
 * without button callbacks.
 */

import { t } from '../shared/i18n.mjs';

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

/** The raw button element (without the full-width column_set wrapper). */
function buttonElement(content, actionValue) {
  return {
    tag: 'button',
    text: plainText(content),
    type: 'default',
    width: 'fill',
    behaviors: [{ type: 'callback', value: { action: actionValue } }],
  };
}

function safeTitle(value) {
  const title = String(value ?? '').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
  return title || t('暂无标题');
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
  return cardWith(t('🤖 助手菜单'), [
    { tag: 'div', text: markdown(t('**点击按钮或直接回复数字**')) },
    button(t('1 · 会话列表'), 'sessions'),
    button(t('2 · 工作区'), 'workspaces'),
    button(t('3 · 新会话'), 'new'),
    button(t('4 · 状态'), 'status'),
    button(t('5 · 帮助'), 'help'),
    // Repair must remain number-driven. Apps that need this command do not
    // have card.action.trigger yet, so rendering it as a callback button would
    // send the user straight back to Feishu's broken callback setup popup.
    { tag: 'div', text: markdown(t('**6 · 修复卡片按钮**（请直接回复数字 **6**）')) },
    button(t('7 · 关注列表'), 'watchlist'),
  ]);
}

/** One-shot callback probe used only after an existing app was re-authorized. */
export function cardActionProbeCard(nonce) {
  if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new TypeError('A safe card-action probe nonce is required');
  }
  return cardWith(t('🧪 验证卡片按钮'), [
    {
      tag: 'div',
      text: markdown(t('授权已提交。请点击下方按钮；机器人真实收到回调后才会判定修复成功。')),
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
          text: plainText(t('完成验证')),
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
 * One page of the workspace's sessions. Each row is a `column_set` pair:
 * the fixed-width ⭐ watch toggle (`⭐关注` / `⭐取关` for already-watched
 * sessions) followed by the session button that carries the page-local
 * number label (reply-number fallback = bind). Archived sessions are marked
 * in the label. `watchedSessionIds` is a Set-like of ids this conversation
 * already watches.
 */
export function sessionListCard(workspace, sessions, page, total, watchedSessionIds = new Set()) {
  const start = page * MENU_PAGE_SIZE;
  const slice = sessions.slice(start, start + MENU_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / MENU_PAGE_SIZE));
  const watched = (id) => typeof watchedSessionIds?.has === 'function' && watchedSessionIds.has(id);
  /** One row: fixed 90px watch toggle + the session button filling the rest. */
  const row = (watchButton, sessionButton) => ({
    tag: 'column_set',
    flex_mode: 'none',
    horizontal_spacing: 'default',
    columns: [
      { tag: 'column', width: '90px', vertical_align: 'center', elements: [watchButton] },
      { tag: 'column', width: 'weighted', weight: 1, vertical_align: 'center', elements: [sessionButton] },
    ],
  });
  const elements = [
    { tag: 'div', text: markdown(t('**工作区**：{workspace}\n共 **{total}** 个会话{paging}', {
      workspace: `\`${workspace}\``,
      total,
      paging: total > MENU_PAGE_SIZE
        ? t('（第 {page}/{pageCount} 页）', { page: page + 1, pageCount })
        : '',
    })) },
    ...slice.map((session, offset) => {
      // Page-local numbering: number replies resolve against this page.
      const label = `${offset + 1}. ${safeTitle(session.title)}${session.archived === true ? t('（已归档）') : ''}`;
      const watching = watched(session.sessionId);
      return row(
        buttonElement(watching ? t('⭐取关') : t('⭐关注'), watching ? `unwatch:${session.sessionId}` : `watch:${session.sessionId}`),
        buttonElement(label, `use:${session.sessionId}`),
      );
    }),
  ];
  if (page > 0) elements.push(button(t('◀ 上一页'), `sessions:${page - 1}`));
  if (page + 1 < pageCount) elements.push(button(t('下一页 ▶'), `sessions:${page + 1}`));
  elements.push({ tag: 'div', text: markdown(t('回复数字（1~N）绑定本页会话。')) });
  return cardWith(t('📂 会话列表'), elements);
}

/** The workspace list card (switch-workspace buttons + reply fallback). */
export function workspaceListCard(paths, current) {
  const elements = paths.length === 0
    ? [{ tag: 'div', text: markdown(t('当前 Host 上没有已登记的工作区。')) }]
    : [
        { tag: 'div', text: markdown(t('回复数字切换工作区，或点击按钮：')) },
        ...paths.map((path, index) => button(
          `${index + 1}. ${path}${path === current ? t('（当前）') : ''}`,
          `workspace:${path}`,
        )),
      ];
  return cardWith(t('🗂 工作区'), elements);
}

/** The card-menu help text (number-driven, no command memorization). */
export function menuHelpText() {
  return [
    t('🤖 助手菜单（回复数字即可，无需记命令）'),
    '',
    t('1 · /sessionlist  列出会话（回复数字绑定）'),
    t('2 · /workspacelist  列出工作区（回复数字切换）'),
    t('3 · /new  开启新会话'),
    t('4 · /status  连接状态'),
    t('5 · /help  本帮助'),
    t('6 · /repair  修复卡片按钮（请回复数字 6）'),
    t('7 · /watchlist  关注列表'),
    '',
    t('直接发送文字/图片即继续当前会话。'),
    t('/session ID 或序号  绑定已有会话'),
    t('/watch ID 或序号  关注会话（完成后推送）'),
    t('/compact  压缩上下文'),
    t('/workspace 绝对路径  切换工作区'),
    t('/presetlist  列出可用 Agent Preset'),
    t('/preset [序号或完整ID]  查看或设置当前机器人 Agent Preset'),
    t('纯数字 ID：/preset id:<ID>'),
    t('/preset --default  跟随 Host 默认'),
  ].join('\n');
}

/** The watch list for one conversation (unwatch buttons + reply fallback). */
export function watchListCard(entries) {
  const elements = entries.length === 0
    ? [{ tag: 'div', text: markdown(t('当前没有关注的会话。\n`/watch <ID|序号>` 关注后，任务完成会自动推送。')) }]
    : [
        { tag: 'div', text: markdown(t('任务完成会自动推送，回复数字或点按钮取消关注：')) },
        ...entries.map((entry, index) => button(
          `${index + 1}. ${safeTitle(entry.title)}`,
          `unwatch:${entry.sessionId}`,
        )),
      ];
  return cardWith(t('👁 关注列表'), elements);
}

/**
 * The completion push card. `title` is the session title, `reason` the
 * turn-end kind (completed / stopped / aborted).
 */
export function completionCard(sessionId, title, reason) {
  const reasonText = reason === 'completed'
    ? t('已完成')
    : reason === 'stopped'
      ? t('已停止')
      : reason === 'aborted'
        ? t('已中止')
        : reason === 'cancelled'
          ? t('已取消')
          : t('已结束');
  return cardWith(t('✅ 任务完成'), [
    { tag: 'div', text: markdown(`**${safeTitle(title)}**\n\`${sessionId}\``) },
    { tag: 'div', text: markdown(t('**状态**：{reason}', { reason: reasonText })) },
    button(t('打开会话列表'), 'sessions'),
    button(t('工作区'), 'workspaces'),
    { tag: 'div', text: markdown(t('绑定该会话后可继续追问，输入文字即可。')) },
  ]);
}
