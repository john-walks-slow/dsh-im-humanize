import assert from 'node:assert/strict';
import test from 'node:test';

import { QqHarnessBridge } from '../../../src/channels/qq/qq-bridge.mjs';
import { DEFAULT_SEND_DELAY_CONFIG } from '../../../src/channels/shared/send-delay.mjs';

/**
 * QQ two-phase humanization tests (plan
 * docs/features/260908-humanize-send-delay-typing §145):
 *   ① read delay — silent, pre-ask, abortable (supersede / /stop), C2C full
 *      delay vs group SHORT_DELAY_CAP_MS (group has no typing indicator).
 *   ② compose — self-managed C2C typing session replacing the dead SDK
 *      middleware: starts AFTER the delay, renews (unit-tested in
 *      test/typing-session.test.mjs), pauses on pending interactions, dies
 *      with the turn.
 */

function withKeepAlive(run) {
  const keepAlive = setInterval(() => {}, 1_000);
  return run().finally(() => clearInterval(keepAlive));
}

function stateFixture() {
  const sessions = new Map([['c2c:owner-openid', 'session-qq']]);
  const seen = new Set();
  return {
    hasSeen: (id) => seen.has(id),
    markSeen: async (id) => seen.add(id),
    sessionFor: (key) => sessions.get(key) ?? null,
    setSession: async (key, sessionId) => sessions.set(key, sessionId),
    clearSession: async (key) => sessions.delete(key),
  };
}

function message(overrides = {}) {
  return {
    kind: 'c2c',
    rawEventType: 'C2C_MESSAGE_CREATE',
    senderId: 'owner-openid',
    senderIsBot: false,
    content: '请回答',
    messageId: 'msg-1',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'msg-1' },
    ...overrides,
  };
}

function humanizeSettings(overrides = {}, sendDelayOverrides = {}) {
  return {
    getSettings: () => ({
      typingIndicator: 'off',
      messageBreak: false,
      ...overrides,
      sendDelay: {
        ...DEFAULT_SEND_DELAY_CONFIG,
        ...sendDelayOverrides,
      },
    }),
  };
}

function recordedBot({ withTyping = true } = {}) {
  const events = [];
  const typingPulses = [];
  const bot = {
    events,
    typingPulses,
    sendText: async (_target, text) => {
      events.push(`text:${text}`);
      return { id: `id-${events.length}` };
    },
  };
  if (withTyping) {
    bot.sendTyping = async (target, durationSec) => {
      events.push('typing');
      typingPulses.push({ target, durationSec });
      return { id: 'typing-ok' };
    };
  }
  return bot;
}

function createBridge({ bot, humanize, harness, state }) {
  return new QqHarnessBridge({
    bot,
    ownerUserOpenid: '*',
    harness: harness ?? {
      sessionExists: async () => true,
      createSession: async () => 'session-qq',
      workspaceSession: (sessionId) => ({
        sessionId,
        stopActiveTurn: async () => false,
      }),
      ask: async (_sessionId, _content) => 'QQ 的回答',
    },
    state: state ?? stateFixture(),
    humanize,
    logger: { warn() {}, error() {} },
  });
}

test('QQ C2C: read delay is silent, then typing starts, then the ask', async () => withKeepAlive(async () => {
  const bot = recordedBot();
  const startedAt = Date.now();
  let askAt = 0;
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'continuous' },
      { enabled: true, readDelay: { minMs: 120, maxMs: 180 } },
    ),
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-qq',
      ask: async () => {
        askAt = Date.now();
        return '延迟后的回答';
      },
    },
  });
  await bridge.accept(message({
    messageId: 'qq-delay-1',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'qq-delay-1' },
  }));
  assert.ok(askAt - startedAt >= 100, `ask must wait out the read delay (waited ${askAt - startedAt}ms)`);
  assert.equal(bot.typingPulses.length, 1, 'exactly one indicator pulse at session start');
  const pulse = bot.typingPulses[0];
  assert.equal(pulse.target.msgId, 'qq-delay-1', 'the pulse targets the inbound message');
  assert.equal(pulse.durationSec, 55, 'the display window outlives the 50s refresh cadence');
  // Silence before the ask: no typing pulse until after the delay.
  const typingIndex = bot.events.indexOf('typing');
  assert.ok(typingIndex !== -1, 'the compose phase opens with the indicator');
  assert.ok(bot.events.includes('text:延迟后的回答'));
}));

test('QQ group messages never call sendTyping', async () => withKeepAlive(async () => {
  const bot = recordedBot();
  const startedAt = Date.now();
  let askAt = 0;
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'continuous' },
      { enabled: true, readDelay: { minMs: 60, maxMs: 80 } },
    ),
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-qq',
      ask: async () => {
        askAt = Date.now();
        return '群聊回答';
      },
    },
  });
  await bridge.accept(message({
    kind: 'group',
    rawEventType: 'GROUP_AT_MESSAGE_CREATE',
    messageId: 'qq-group-1',
    replyTarget: { scope: 'group', targetId: 'group-openid', msgId: 'qq-group-1' },
  }));
  assert.ok(askAt - startedAt >= 50, 'the capped read delay still applies');
  assert.equal(bot.typingPulses.length, 0, 'group chats have no typing API (sendInputNotify is C2C only)');
  assert.ok(bot.events.includes('text:群聊回答'));
}));

test('QQ: a newer C2C message supersedes a turn still in its read delay', async () => withKeepAlive(async () => {
  const bot = recordedBot();
  const asks = [];
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'off' },
      { enabled: true, readDelay: { minMs: 400, maxMs: 500 } },
    ),
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-qq',
      ask: async (_sessionId, content) => {
        asks.push(content);
        return `回答:${content}`;
      },
    },
  });
  const first = bridge.accept(message({ messageId: 'qq-superseded-1', content: '先到的问题' }));
  await new Promise((resolve) => setImmediate(resolve));
  const second = bridge.accept(message({ messageId: 'qq-superseded-2', content: '后来的问题' }));
  await Promise.all([first, second]);
  assert.equal(asks.length, 1, 'only the newer message reaches the harness');
  assert.match(String(asks[0]), /后来的问题/);
  assert.deepEqual(bot.events.filter((e) => e.startsWith('text:')), ['text:回答:后来的问题'],
    'the superseded turn stays silent — no error reply, no double reply');
}));

test('QQ: /stop during the read delay stops the pending message', async () => withKeepAlive(async () => {
  const bot = recordedBot();
  const asks = [];
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'off' },
      { enabled: true, readDelay: { minMs: 500, maxMs: 600 } },
    ),
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-qq',
      workspaceSession: (sessionId) => ({
        sessionId,
        stopActiveTurn: async () => false,
      }),
      ask: async (_sessionId, content) => {
        asks.push(content);
        return '不应到达';
      },
    },
  });
  const pending = bridge.accept(message({ messageId: 'qq-stop-1', content: '会被停止的问题' }));
  await new Promise((resolve) => setImmediate(resolve));
  await bridge.accept(message({ messageId: 'qq-stop-cmd', content: '/stop' }));
  await pending;
  assert.deepEqual(asks, [], 'the stopped message never reaches the harness');
  assert.ok(bot.events.some((e) => e === 'text:已停止待发送的消息。'),
    'the stop command acknowledges the pending message');
  assert.equal(bot.events.some((e) => e === 'text:不应到达'), false);
  assert.equal(bot.typingPulses.length, 0, 'no indicator was ever lit');
}));

test('QQ: the typing indicator pauses for a pending question and resumes', async () => withKeepAlive(async () => {
  const bot = recordedBot();
  const pulses = { whilePending: -1, afterResume: -1 };
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'continuous' },
      { enabled: true, readDelay: { minMs: 5, maxMs: 10 } },
    ),
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-qq',
      ask: async (_sessionId, _content, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-interaction-1',
          rpcId: 'qq-rpc-1',
          sessionId: 'session-qq',
          payload: {
            questions: [{
              id: 'q1',
              question: '继续吗？',
              choices: [{ id: 'yes', name: '继续' }, { id: 'no', name: '停止' }],
            }],
          },
        });
        // While pending: no renewal pulses accumulate.
        await new Promise((resolve) => setTimeout(resolve, 60));
        pulses.whilePending = bot.typingPulses.length;
        await options.onInteractionResolved({ interactionId: 'qq-interaction-1' });
        await new Promise((resolve) => setTimeout(resolve, 10));
        return '互动后的回答';
      },
    },
  });
  await bridge.accept(message({ messageId: 'qq-interaction' }));
  assert.ok(pulses.whilePending >= 1 && pulses.whilePending <= 2,
    `no renewal pulses accumulate while the question is pending (pause works; got ${pulses.whilePending})`);
  assert.ok(bot.events.some((e) => e.startsWith('text:') && e.includes('继续吗')),
    'the pending question is presented');
  assert.ok(bot.events.some((e) => e === 'text:互动后的回答'),
    'the turn completes after the interaction');
}));
