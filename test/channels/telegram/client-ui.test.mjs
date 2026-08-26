import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer from 'react-test-renderer';

import {
  TelegramAccessSettings,
  TelegramAccountCard,
  TelegramSettingsTab,
} from '../../../plugin-src/client/channels/telegram/index.js';

const { act } = TestRenderer;

test('Telegram settings exposes a Bot Token action without a fake QR action', () => {
  const markup = renderToStaticMarkup(React.createElement(TelegramSettingsTab, {
    rpcCall: async () => ({ ok: true, value: { bots: [] } }),
  }));
  assert.match(markup, /aria-label="使用 Bot Token 接入 Telegram 机器人"/);
  assert.match(markup, />手动接入</);
  assert.doesNotMatch(markup, /扫码接入机器人|dim-scanButton/);
});

test('Telegram account card matches the unified compact card layout', () => {
  const markup = renderToStaticMarkup(React.createElement(TelegramAccountCard, {
    account: {
      botId: 'telegram_test',
      connected: true,
      state: 'connected',
      bot: { name: 'Harness Bot', username: 'harness_bot', idMasked: '123•••' },
      health: { summary: 'Telegram Bot API 长轮询运行正常', lastCheckedAt: Date.now() },
      error: null,
    },
    onReconnect() {},
    onRequestRemove() {},
    onConfirmRemove() {},
    onCancelRemove() {},
  }));
  assert.match(markup, /data-im-channel-logo="telegram"/);
  assert.match(markup, /@harness_bot/);
  assert.match(markup, /class="dim-botHealthGroup"[^]*class="dim-lastChecked"><span>最近检查<\/span>/);
  assert.doesNotMatch(markup, /Bot API 长轮询|消息通道|dim-botMetric/);
  assert.match(markup, />检查连接</);
  assert.match(markup, />移除接入</);
  assert.match(markup, />访问设置</);
  assert.match(markup, /aria-label="Telegram 访问模式"/);
  assert.match(markup, />兼容模式（默认）</);
  assert.doesNotMatch(markup, /dim-cardSummary/);
});

test('Telegram access settings edits and saves one bot policy', async () => {
  const saved = [];
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(TelegramAccessSettings, {
      account: {
        botId: 'telegram_test',
        accessPolicy: { accessMode: 'compatible', allowedUsers: ['111111111'] },
      },
      onSave: async (policy) => saved.push(policy),
    }));
  });

  const select = renderer.root.findByProps({ 'aria-label': 'Telegram 访问模式' });
  let textarea = renderer.root.findByProps({
    'aria-label': '允许私聊的 Telegram User ID',
  });
  assert.equal(textarea.props.disabled, true);
  await act(async () => {
    select.props.onChange({ target: { value: 'private-allowlist' } });
  });
  textarea = renderer.root.findByProps({
    'aria-label': '允许私聊的 Telegram User ID',
  });
  assert.equal(textarea.props.disabled, false);
  await act(async () => {
    textarea.props.onChange({ target: { value: '6087707998\n1202499116\n6087707998' } });
  });
  await act(async () => {
    select.props.onChange({ target: { value: 'compatible' } });
  });
  textarea = renderer.root.findByProps({
    'aria-label': '允许私聊的 Telegram User ID',
  });
  assert.equal(textarea.props.disabled, true);
  assert.equal(textarea.props.value, '6087707998\n1202499116\n6087707998');
  await act(async () => {
    select.props.onChange({ target: { value: 'private-allowlist' } });
  });
  textarea = renderer.root.findByProps({
    'aria-label': '允许私聊的 Telegram User ID',
  });
  assert.equal(textarea.props.disabled, false);
  assert.equal(textarea.props.value, '6087707998\n1202499116\n6087707998');
  assert.deepEqual(
    renderer.root.findByProps({ className: 'dtg-accessBadge' }).children,
    ['已生效：兼容模式'],
  );
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  assert.deepEqual(saved, [{
    accessMode: 'private-allowlist',
    allowedUsers: ['6087707998', '1202499116'],
  }]);
  await act(async () => renderer.unmount());
});

test('Telegram access settings keeps both mode descriptions in an accessible help tooltip', async () => {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(TelegramAccessSettings, {
      account: {
        botId: 'telegram_test',
        accessPolicy: { accessMode: 'compatible', allowedUsers: ['111111111'] },
      },
      onSave() {},
    }));
  });
  const helpButton = renderer.root.findByProps({
    'aria-label': '查看 Telegram 访问模式说明',
  });
  const tooltip = renderer.root.findByProps({ role: 'tooltip' });
  const heading = renderer.root.findByProps({ className: 'dtg-accessHeading' });
  assert.equal(helpButton.props.type, 'button');
  assert.ok(tooltip.props.id);
  assert.equal(helpButton.props['aria-describedby'], tooltip.props.id);
  assert.equal(heading.findAllByType('p').length, 0);

  const markup = renderToStaticMarkup(React.createElement(TelegramAccessSettings, {
    account: {
      botId: 'telegram_test',
      accessPolicy: { accessMode: 'compatible', allowedUsers: ['111111111'] },
    },
    onSave() {},
  }));
  assert.match(markup, />兼容模式<\/strong>/);
  assert.match(markup, />安全模式<\/strong>/);
  assert.match(markup, /保持原有行为：私聊直接响应，群聊在被提及或回复时响应。/);
  assert.match(markup, /群聊全部忽略，私聊仅允许白名单用户。/);
  await act(async () => renderer.unmount());
});

test('Telegram access mode help opens for pointer hover and keyboard focus', async () => {
  const styles = await readFile(
    new URL('../../../plugin-src/client/channels/telegram/styles.js', import.meta.url),
    'utf8',
  );
  assert.match(styles, /\.dtg-accessHeading \{[^}]*position: relative;/);
  assert.match(styles, /\.dtg-accessHelp \{[^}]*position: static;/);
  assert.match(styles, /\.dtg-accessTooltip \{[^}]*right: 0;[^}]*width: min\(300px, 100%\);[^}]*max-width: 100%;/);
  assert.match(styles, /\.dtg-accessHelpButton:focus-visible \{/);
  assert.match(styles, /\.dtg-accessHelp:hover \.dtg-accessTooltip, \.dtg-accessHelp:focus-within \.dtg-accessTooltip \{[^}]*opacity: 1;[^}]*visibility: visible;/);
});

test('Telegram cards shrink to a narrow English panel without horizontal scrolling', async () => {
  const [sharedStyles, telegramStyles] = await Promise.all([
    readFile(new URL('../../../plugin-src/client/styles.js', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../plugin-src/client/channels/telegram/styles.js', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(sharedStyles, /\.dim-panel \.dim-botList \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(sharedStyles, /\.dim-panel \.dim-botCard \{[^}]*min-width: 0;[^}]*width: 100%;[^}]*max-width: 100%;[^}]*overflow: hidden;/);
  assert.match(sharedStyles, /\.dim-panel \.dim-botIdentity \{[^}]*min-width: 0;[^}]*flex: 1 1 0;/);
  assert.doesNotMatch(sharedStyles, /\.dim-panel \.dim-botCardTop \{ flex-direction: column;/);
  assert.match(sharedStyles, /\.dim-panel \.dim-workspacePath \{[^}]*overflow: hidden;[^}]*overflow-wrap: anywhere;[^}]*white-space: normal;/);
  assert.doesNotMatch(sharedStyles, /\.dim-panel \.dim-workspacePath \{[^}]*overflow-x: auto;/);
  assert.match(telegramStyles, /\.dtg-access \{[^}]*min-width: 0;[^}]*width: 100%;[^}]*max-width: 100%;/);
  assert.match(telegramStyles, /\.dtg-accessHeading \{[^}]*flex-wrap: wrap;/);
  assert.match(telegramStyles, /\.dtg-accessStatus \{[^}]*max-width: 100%;[^}]*flex-wrap: wrap;/);
  assert.match(telegramStyles, /\.dtg-accessField select, \.dtg-accessField textarea \{[^}]*min-width: 0;[^}]*max-width: 100%;/);
});

test('Telegram access settings warns when safe mode has an empty allowlist', () => {
  const markup = renderToStaticMarkup(React.createElement(TelegramAccessSettings, {
    account: {
      botId: 'telegram_test',
      accessPolicy: { accessMode: 'private-allowlist', allowedUsers: [] },
    },
    onSave() {},
  }));
  assert.match(markup, /白名单为空；保存后该机器人会拒绝所有入站消息。/);
});
