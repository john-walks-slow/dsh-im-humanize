import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSessionSyncCoordinator,
  installSessionSyncCoordinator,
} from '../plugin-src/host/session-sync-coordinator.mjs';

const TARGET_A = Object.freeze({ channel: 'feishu', botId: 'bot-a', targetId: 'alice' });
const TARGET_B = Object.freeze({ channel: 'telegram', botId: 'bot-b', targetId: 'bob' });
const TARGET_C = Object.freeze({ channel: 'slack', botId: 'bot-c', targetId: 'carol' });

function turnStart(turn = 1) {
  return { type: 'turn/start', data: { turn } };
}

function userMessage(text, rpcId = 'dsh-user') {
  return {
    type: 'user/message',
    surfaceOp: 'append',
    data: { source: { kind: 'user', rpcId }, content: [{ type: 'text', text }] },
  };
}

function assistantMessage(step, text, turn = 1) {
  return {
    type: 'assistant/message',
    surfaceOp: 'append',
    data: {
      turn,
      step,
      message: { role: 'assistant', content: [{ type: 'text', text }] },
    },
  };
}

function turnEnd(reason = { kind: 'completed' }, turn = 1) {
  return { type: 'turn/end', data: { turn, reason } };
}

test('Session sync mirrors direct DSH text and one ordered multi-step assistant result', async () => {
  const sends = [];
  let lookup = 0;
  const deliveryService = {
    async listSessionSyncTargets() {
      lookup += 1;
      return lookup === 1 ? [TARGET_A, TARGET_B] : [TARGET_A, TARGET_C];
    },
    async sendSessionSyncText(botId, targetId, sessionId, text) {
      sends.push({ botId, targetId, sessionId, text });
    },
    async listSessionConversations() { return []; },
    async send() {},
  };
  const coordinator = createSessionSyncCoordinator({ deliveryService });

  void coordinator.enqueue('session-one', turnStart());
  void coordinator.enqueue('session-one', userMessage('先检查构建'), 'dsh');
  void coordinator.enqueue('session-one', userMessage('再检查测试', 'dsh-steer'), 'dsh');
  void coordinator.enqueue('session-one', assistantMessage(1, '第二步结果'));
  void coordinator.enqueue('session-one', {
    type: 'assistant/attempt',
    surfaceOp: 'append',
    data: { turn: 1, step: 2, message: { content: [{ type: 'text', text: '不得出现' }] } },
  });
  void coordinator.enqueue('session-one', assistantMessage(0, '第一步结果'));
  void coordinator.enqueue('session-one', turnEnd());
  await coordinator.whenIdle();

  assert.deepEqual(sends, [
    { botId: 'bot-a', targetId: 'alice', sessionId: 'session-one', text: '[来自 DSH]\n先检查构建' },
    { botId: 'bot-b', targetId: 'bob', sessionId: 'session-one', text: '[来自 DSH]\n先检查构建' },
    { botId: 'bot-a', targetId: 'alice', sessionId: 'session-one', text: '[来自 DSH]\n再检查测试' },
    { botId: 'bot-c', targetId: 'carol', sessionId: 'session-one', text: '[来自 DSH]\n再检查测试' },
    {
      botId: 'bot-a',
      targetId: 'alice',
      sessionId: 'session-one',
      text: '[DSH 助手]\n第一步结果\n\n第二步结果',
    },
  ]);
});

test('Session sync suppresses IM, unknown, non-append, and unsuccessful Turn output', async () => {
  const sends = [];
  const deliveryService = {
    async listSessionSyncTargets() { return [TARGET_A]; },
    async sendSessionSyncText(...args) { sends.push(args); },
    async listSessionConversations() { return []; },
    async send() {},
  };
  const coordinator = createSessionSyncCoordinator({ deliveryService });

  for (const [sessionId, origin, reason] of [
    ['session-im', 'im', { kind: 'completed' }],
    ['session-unknown', 'other', { kind: 'completed' }],
    ['session-failed', 'dsh', { kind: 'error' }],
  ]) {
    void coordinator.enqueue(sessionId, turnStart());
    void coordinator.enqueue(sessionId, userMessage('输入'), origin);
    void coordinator.enqueue(sessionId, assistantMessage(0, '回答'));
    void coordinator.enqueue(sessionId, turnEnd(reason));
  }
  void coordinator.enqueue('session-replace', turnStart());
  void coordinator.enqueue('session-replace', {
    ...userMessage('替换输入'),
    surfaceOp: 'replace',
  }, 'dsh');
  void coordinator.enqueue('session-replace', assistantMessage(0, '不得发送'));
  void coordinator.enqueue('session-replace', turnEnd());
  await coordinator.whenIdle();

  assert.deepEqual(sends, [[
    'bot-a', 'alice', 'session-failed', '[来自 DSH]\n输入',
  ]]);
});

test('Session sync isolates target failures and only returns the assistant to successful recipients', async () => {
  const sends = [];
  const warnings = [];
  const deliveryService = {
    async listSessionSyncTargets() { return [TARGET_A, TARGET_B]; },
    async sendSessionSyncText(botId, targetId, sessionId, text) {
      sends.push({ botId, targetId, sessionId, text });
      if (targetId === 'bob') throw new Error('provider secret detail');
    },
    async listSessionConversations() { return []; },
    async send() {},
  };
  const coordinator = createSessionSyncCoordinator({
    deliveryService,
    logger: { warn: (...args) => warnings.push(args) },
  });

  void coordinator.enqueue('session-one', turnStart());
  void coordinator.enqueue('session-one', userMessage('开始'), 'dsh');
  void coordinator.enqueue('session-one', assistantMessage(0, '完成'));
  void coordinator.enqueue('session-one', turnEnd('completed'));
  await coordinator.whenIdle();

  assert.equal(sends.filter((entry) => entry.targetId === 'alice').length, 2);
  assert.equal(sends.filter((entry) => entry.targetId === 'bob').length, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /telegram\/bot-b\/bob/);
});

test('installed Session sync classifies an unregistered Host user rpcId as direct DSH input', async () => {
  let listener;
  let disposed = 0;
  const effects = [];
  const sends = [];
  const ctx = {
    root: {},
    on(name, callback, options) {
      assert.equal(name, 'session/event');
      assert.deepEqual(options, { global: true });
      listener = callback;
      return () => { disposed += 1; };
    },
    effect(effect) { effects.push(effect()); },
  };
  const installed = installSessionSyncCoordinator(ctx, {
    async listSessionSyncTargets() { return [TARGET_A]; },
    async sendSessionSyncText(...args) { sends.push(args); },
    async listSessionConversations() { return []; },
    async send() {},
  });

  listener({ id: 'session-one' }, turnStart());
  listener({ id: 'session-one' }, userMessage('Desktop 输入', 'desktop-rpc'));
  listener({ id: 'session-one' }, assistantMessage(0, 'Desktop 回答'));
  listener({ id: 'session-one' }, turnEnd());
  await installed.whenIdle();

  assert.deepEqual(sends.map((entry) => entry[3]), [
    '[来自 DSH]\nDesktop 输入',
    '[DSH 助手]\nDesktop 回答',
  ]);
  effects[0]();
  installed.close();
  assert.equal(disposed, 1);
});

function wakeMessage(plugin = 'dsh-proactive') {
  return {
    type: 'user/message',
    surfaceOp: 'append',
    data: {
      source: { kind: 'plugin', plugin, form: 'notice' },
      content: [{ type: 'text', text: '[dsh-proactive wake alarm-1 heartbeat] now …' }],
    },
  };
}

function subagentSettled() {
  return {
    type: 'user/message',
    surfaceOp: 'append',
    data: {
      source: { kind: 'subagent-settled', form: 'notice', summary: 'done', senderSessionId: 's' },
      content: [{ type: 'text', text: '[subagent settled] done' }],
    },
  };
}

const BOUND = Object.freeze({ kind: 'chat', route: { chatId: '6110538394' } });

test('Session sync auto-delivers a proactive wake reply to the bound private chat', async () => {
  const sends = [];
  const lookups = [];
  const deliveryService = {
    async listSessionSyncTargets() { return []; },
    async sendSessionSyncText() {},
    async listSessionConversations(sessionId) {
      lookups.push(sessionId);
      return [{ channel: 'telegram', botId: 'bot-b', target: BOUND }];
    },
    async send(botId, target, text) {
      sends.push({ botId, target, text });
    },
  };
  const coordinator = createSessionSyncCoordinator({ deliveryService });

  void coordinator.enqueue('session-one', turnStart());
  void coordinator.enqueue('session-one', wakeMessage(), 'wake');
  void coordinator.enqueue('session-one', assistantMessage(0, '该喝水了'));
  void coordinator.enqueue('session-one', turnEnd());
  await coordinator.whenIdle();

  assert.deepEqual(lookups, ['session-one']);
  assert.deepEqual(sends, [{ botId: 'bot-b', target: BOUND, text: '该喝水了' }]);
});

test('Session sync auto-delivers a subagent-settled reply to the bound private chat', async () => {
  const sends = [];
  const deliveryService = {
    async listSessionSyncTargets() { return []; },
    async sendSessionSyncText() {},
    async listSessionConversations() {
      return [{ channel: 'telegram', botId: 'bot-b', target: BOUND }];
    },
    async send(botId, target, text) { sends.push({ botId, target, text }); },
  };
  const coordinator = createSessionSyncCoordinator({ deliveryService });

  void coordinator.enqueue('session-one', turnStart());
  void coordinator.enqueue('session-one', subagentSettled(), 'wake');
  void coordinator.enqueue('session-one', assistantMessage(0, '任务完成'));
  void coordinator.enqueue('session-one', turnEnd());
  await coordinator.whenIdle();

  assert.deepEqual(sends, [{ botId: 'bot-b', target: BOUND, text: '任务完成' }]);
});

test('Session sync stays silent for no-reply wakes and failed wakes', async () => {
  const sends = [];
  let listener;
  const ctx = {
    root: {},
    on(name, callback) { listener = callback; return () => {}; },
    effect(effect) { void effect(); },
  };
  const installed = installSessionSyncCoordinator(ctx, {
    async listSessionSyncTargets() { return []; },
    async sendSessionSyncText() {},
    async listSessionConversations() {
      return [{ channel: 'telegram', botId: 'bot-b', target: BOUND }];
    },
    async send(...args) { sends.push(args); },
  });

  // Silent wake: no visible assistant text.
  listener({ id: 'session-silent' }, turnStart());
  listener({ id: 'session-silent' }, wakeMessage());
  listener({ id: 'session-silent' }, turnEnd());
  // Failed wake: turn did not complete.
  listener({ id: 'session-failed' }, turnStart());
  listener({ id: 'session-failed' }, wakeMessage());
  listener({ id: 'session-failed' }, assistantMessage(0, '不得投递'));
  listener({ id: 'session-failed' }, turnEnd({ kind: 'error' }));
  await installed.whenIdle();

  assert.deepEqual(sends, []);
  installed.close();
});

test('Session sync auto-delivers for any plugin source', async () => {
  const sends = [];
  let listener;
  const ctx = {
    root: {},
    on(name, callback) { listener = callback; return () => {}; },
    effect(effect) { void effect(); },
  };
  const installed = installSessionSyncCoordinator(ctx, {
    async listSessionSyncTargets() { return []; },
    async sendSessionSyncText() {},
    async listSessionConversations() {
      return [{ channel: 'telegram', botId: 'bot-b', target: BOUND }];
    },
    async send(botId, target, text) { sends.push({ botId, target, text }); },
  });

  listener({ id: 'session-one' }, turnStart());
  listener({ id: 'session-one' }, wakeMessage('dsh-other-plugin'));
  listener({ id: 'session-one' }, assistantMessage(0, '任意 plugin 也投'));
  listener({ id: 'session-one' }, turnEnd());
  await installed.whenIdle();

  assert.deepEqual(sends, [{ botId: 'bot-b', target: BOUND, text: '任意 plugin 也投' }]);
  installed.close();
});

test('Session sync stays silent when the wake conversation lookup fails', async () => {
  const sends = [];
  const warnings = [];
  const deliveryService = {
    async listSessionSyncTargets() { return []; },
    async sendSessionSyncText() {},
    async listSessionConversations() { throw new Error('state unavailable'); },
    async send(...args) { sends.push(args); },
  };
  const coordinator = createSessionSyncCoordinator({
    deliveryService,
    logger: { warn: (...args) => warnings.push(args) },
  });

  void coordinator.enqueue('session-one', turnStart());
  void coordinator.enqueue('session-one', wakeMessage(), 'wake');
  void coordinator.enqueue('session-one', assistantMessage(0, '该喝水了'));
  void coordinator.enqueue('session-one', turnEnd());
  await coordinator.whenIdle();

  assert.deepEqual(sends, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /ignored Session sync wake lookup failure/);
});
