import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create } from 'react-test-renderer';

import { FEISHU_ENDPOINTS } from '../../../plugin-src/client/channels/feishu/api.js';
import {
  BotCard,
  FeishuSettingsTab,
} from '../../../plugin-src/client/channels/feishu/index.js';
import {
  en,
  setImTranslator,
} from '../../../plugin-src/client/i18n.js';

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

function textOf(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node) return '';
  const children = node.children ?? node.props?.children ?? [];
  return (Array.isArray(children) ? children : [children]).map(textOf).join('');
}

test('Feishu connection check requests and displays test-message feedback', async () => {
  const source = await readFile(new URL(
    '../../../plugin-src/client/channels/feishu/index.js',
    import.meta.url,
  ), 'utf8');
  assert.match(source, /FEISHU_ENDPOINTS\.reconnectBot, \{ botId, sendTest: true \}/);
  assert.match(source, /机器人尚未收到可用于测试的私聊消息/);
  assert.doesNotMatch(source, /请先私聊机器人发送 \/status/);

  const markup = renderToStaticMarkup(React.createElement(BotCard, {
    connection: {
      botId: 'bot-feishu-test',
      state: 'connected',
      connected: true,
      bot: { name: '飞书测试机器人', appIdMasked: 'cli_test••••1234' },
      health: { summary: '长连接运行正常', lastCheckedAt: Date.now() },
    },
    testNotice: '测试消息已发送，请到飞书会话中确认。',
    onReconnect() {},
    onRequestRemove() {},
    onConfirmRemove() {},
    onCancelRemove() {},
  }));
  assert.match(markup, /role="status"[^>]*>测试消息已发送/);
});

test('Feishu reconnect failures render fixed English-safe feedback', async (t) => {
  const previousWindow = globalThis.window;
  let nextFrame = 0;
  const frames = new Map();
  globalThis.window = {
    setInterval() { return 1; },
    clearInterval() {},
    requestAnimationFrame(callback) {
      const id = ++nextFrame;
      frames.set(id, callback);
      queueMicrotask(() => {
        const pending = frames.get(id);
        if (!pending) return;
        frames.delete(id);
        pending();
      });
      return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  setImTranslator((key) => en[key] ?? key);
  t.after(() => {
    setImTranslator(null);
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  const snapshot = {
    schemaVersion: 2,
    revision: 1,
    state: 'connected',
    bots: [{
      botId: 'bot_feishu_test',
      state: 'connected',
      connected: true,
      configured: true,
      workspace: '/workspace/current',
      bot: { name: '今天是牢梁', appIdMasked: 'cli_test••••1234' },
      health: { status: 'healthy', summary: 'Long connection is healthy' },
    }],
  };
  const rpcCall = async (endpoint) => {
    if (endpoint === FEISHU_ENDPOINTS.status) return { ok: true, value: snapshot };
    if (endpoint === FEISHU_ENDPOINTS.reconnectBot) {
      return {
        ok: false,
        error: { code: 'FEISHU_UPSTREAM_FAILED', message: '飞书上游操作失败' },
      };
    }
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  let renderer;
  await act(async () => {
    renderer = create(React.createElement(FeishuSettingsTab, { rpcCall }));
    await flushMicrotasks();
  });
  const card = renderer.root.findByProps({ 'data-bot-id': 'bot_feishu_test' });
  await act(async () => {
    card.findAllByType('button')
      .find((button) => textOf(button) === 'Check connection').props.onClick();
    await flushMicrotasks();
  });

  const announcement = renderer.root.find(
    (node) => node.props.role === 'status' && node.props['aria-live'] === 'polite',
  );
  assert.equal(textOf(announcement), 'Connection check failed. Try again later.');
  assert.doesNotMatch(textOf(announcement), /[\p{Script=Han}]/u);
  assert.match(textOf(card), /Connection check failed\. Try again later\./);
  assert.doesNotMatch(textOf(card), /飞书上游操作失败/);
  await act(async () => { renderer.unmount(); });
});
