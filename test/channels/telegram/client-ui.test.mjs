import assert from 'node:assert/strict';
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
  assert.match(markup, />Bot API 长轮询</);
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
  const textarea = renderer.root.findByProps({
    'aria-label': '允许私聊的 Telegram User ID',
  });
  await act(async () => {
    select.props.onChange({ target: { value: 'private-allowlist' } });
    textarea.props.onChange({ target: { value: '6087707998\n1202499116\n6087707998' } });
  });
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
