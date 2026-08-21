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
  assert.match(markup, /修复卡片按钮/);
  assert.match(markup, /aria-label="修复飞书测试机器人的卡片按钮"/);
});

test('Feishu callback repair keeps a Host-submitted attempt when a stale QR cancel races saving', async (t) => {
  const previousWindow = globalThis.window;
  let nextTimer = 0;
  const timeouts = new Map();
  const frames = new Map();
  globalThis.window = {
    setInterval() { return ++nextTimer; },
    clearInterval() {},
    setTimeout(callback) {
      const id = ++nextTimer;
      timeouts.set(id, callback);
      return id;
    },
    clearTimeout(id) { timeouts.delete(id); },
    requestAnimationFrame(callback) {
      const id = ++nextTimer;
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
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  const snapshot = {
    schemaVersion: 2,
    revision: 1,
    state: 'connected',
    bots: [{
      botId: 'bot_target',
      state: 'connected',
      connected: true,
      configured: true,
      workspace: '/workspace/current',
      bot: { name: '目标机器人', appIdMasked: 'cli_tar••••rget' },
      health: { status: 'healthy', summary: '长连接运行正常' },
    }],
  };
  const calls = [];
  const rpcCall = async (endpoint, payload) => {
    calls.push({ endpoint, payload });
    if (endpoint === FEISHU_ENDPOINTS.status) return { ok: true, value: snapshot };
    if (endpoint === FEISHU_ENDPOINTS.beginCallbackRepair) {
      return {
        ok: true,
        value: {
          attemptId: 'reg_repair',
          operation: 'callback_repair',
          botId: 'bot_target',
          verificationUrl: 'https://open.feishu.cn/page/launcher?tp=sdk&clientID=cli_target',
          qrCodeDataUrl: 'data:image/png;base64,AAAA',
          expiresAt: Date.now() + 60_000,
          pollIntervalMs: 800,
        },
      };
    }
    if (endpoint === FEISHU_ENDPOINTS.pollProvisioning) {
      return {
        ok: true,
        value: {
          status: 'connecting',
          operation: 'callback_repair',
          botId: 'bot_target',
        },
      };
    }
    if (endpoint === FEISHU_ENDPOINTS.cancelProvisioning) {
      return {
        ok: true,
        value: {
          status: 'connecting',
          operation: 'callback_repair',
          botId: 'bot_target',
          message: 'Callback repair was already submitted and is still being verified.',
        },
      };
    }
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  let renderer;
  await act(async () => {
    renderer = create(React.createElement(FeishuSettingsTab, { rpcCall }));
    await flushMicrotasks();
  });
  const card = renderer.root.findByProps({ 'data-bot-id': 'bot_target' });
  await act(async () => {
    card.findAllByType('button')
      .find((button) => textOf(button) === '修复卡片按钮').props.onClick();
    await flushMicrotasks();
  });

  assert.ok(calls.some(({ endpoint, payload }) => endpoint === FEISHU_ENDPOINTS.beginCallbackRepair
    && payload.botId === 'bot_target'));
  const officialLink = renderer.root.findByType('a');
  assert.equal(
    officialLink.props.href,
    'https://open.feishu.cn/page/launcher?tp=sdk&clientID=cli_target',
  );
  assert.match(textOf(renderer.toJSON()), /不会创建新应用/);

  const staleCancel = renderer.root.findAllByType('button')
    .find((button) => textOf(button) === '取消修复');
  assert.ok(staleCancel);
  await act(async () => {
    staleCancel.props.onClick();
    await flushMicrotasks();
  });
  assert.ok(calls.some(({ endpoint, payload }) => endpoint === FEISHU_ENDPOINTS.cancelProvisioning
    && payload.attemptId === 'reg_repair'));
  assert.match(textOf(renderer.toJSON()), /此阶段无法取消/);
  assert.equal(renderer.root.findAllByType('button').some(
    (button) => textOf(button) === '取消修复',
  ), false);
  assert.ok(timeouts.size > 0, 'submitted repair keeps polling after the refused cancel');
  await act(async () => { renderer.unmount(); });
});

test('Feishu callback repair recovers when a Host restart forgets the browser attempt', async (t) => {
  const previousWindow = globalThis.window;
  let nextTimer = 0;
  const frames = new Map();
  globalThis.window = {
    setInterval() { return ++nextTimer; },
    clearInterval() {},
    setTimeout() { return ++nextTimer; },
    clearTimeout() {},
    requestAnimationFrame(callback) {
      const id = ++nextTimer;
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
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  const snapshot = {
    schemaVersion: 2,
    revision: 1,
    state: 'connected',
    bots: [{
      botId: 'bot_target',
      state: 'connected',
      connected: true,
      configured: true,
      workspace: '/workspace/current',
      bot: { name: '目标机器人', appIdMasked: 'cli_tar••••rget' },
      health: { status: 'healthy', summary: '长连接运行正常' },
    }],
  };
  let beginCount = 0;
  const calls = [];
  const rpcCall = async (endpoint, payload) => {
    calls.push({ endpoint, payload });
    if (endpoint === FEISHU_ENDPOINTS.status) return { ok: true, value: snapshot };
    if (endpoint === FEISHU_ENDPOINTS.beginCallbackRepair) {
      beginCount += 1;
      return {
        ok: true,
        value: {
          attemptId: `reg_repair_${beginCount}`,
          operation: 'callback_repair',
          botId: 'bot_target',
          verificationUrl: `https://open.feishu.cn/page/launcher?tp=sdk&clientID=cli_target&attempt=${beginCount}`,
          qrCodeDataUrl: 'data:image/png;base64,AAAA',
          expiresAt: Date.now() + 60_000,
          pollIntervalMs: 800,
        },
      };
    }
    if (endpoint === FEISHU_ENDPOINTS.cancelProvisioning) {
      return {
        ok: false,
        error: {
          code: 'bad-request',
          message: 'The provisioning attempt is no longer active.',
        },
      };
    }
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  let renderer;
  await act(async () => {
    renderer = create(React.createElement(FeishuSettingsTab, { rpcCall }));
    await flushMicrotasks();
  });
  const repairButton = () => renderer.root.findByProps({ 'data-bot-id': 'bot_target' })
    .findAllByType('button')
    .find((button) => textOf(button) === '修复卡片按钮');

  await act(async () => {
    repairButton().props.onClick();
    await flushMicrotasks();
  });
  await act(async () => {
    renderer.root.findAllByType('button')
      .find((button) => textOf(button) === '换一个二维码').props.onClick();
    await flushMicrotasks();
  });
  assert.equal(beginCount, 2, 'a stale cancel cannot block the replacement begin');
  assert.match(renderer.root.findByType('a').props.href, /attempt=2$/);

  await act(async () => {
    renderer.root.findAllByType('button')
      .find((button) => textOf(button) === '取消修复').props.onClick();
    await flushMicrotasks();
  });
  assert.match(textOf(renderer.toJSON()), /The provisioning attempt is no longer active/);
  await act(async () => {
    renderer.root.find((node) => node.props.role === 'alert')
      .findAllByType('button')
      .find((button) => textOf(button) === '关闭').props.onClick();
    await flushMicrotasks();
  });
  assert.equal(renderer.root.findAll((node) => node.props.role === 'alert').length, 0);
  assert.equal(repairButton().props.disabled, false);
  assert.ok(calls.some(({ endpoint }) => endpoint === FEISHU_ENDPOINTS.cancelProvisioning));
  await act(async () => { renderer.unmount(); });
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
