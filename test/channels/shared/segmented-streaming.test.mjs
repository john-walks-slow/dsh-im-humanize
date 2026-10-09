import assert from 'node:assert/strict';
import test from 'node:test';

import { TextHarnessBridge } from '../../../src/channels/shared/text-harness-bridge.mjs';
import { DEFAULT_SEND_DELAY_CONFIG } from '../../../src/channels/shared/send-delay.mjs';

function stateFixture() {
  const sessions = new Map();
  const seen = new Set();
  return {
    sessionFor: (key) => sessions.get(key) ?? null,
    async setSession(key, sessionId) { sessions.set(key, sessionId); return true; },
    async clearSession(key) { sessions.delete(key); },
    hasSeen: (messageId) => seen.has(messageId),
    async markSeen(messageId) { seen.add(messageId); },
  };
}

function message(messageId, content) {
  return {
    messageId,
    senderId: 'actor-a',
    senderIsBot: false,
    kind: 'direct',
    conversationId: 'chat-a',
    content,
    addressed: true,
    replyTarget: { id: `target-${messageId}` },
  };
}

function humanizeSettings(overrides = {}) {
  return {
    getSettings: () => ({
      typingIndicator: 'off',
      sendDelay: { ...DEFAULT_SEND_DELAY_CONFIG, ...overrides.sendDelay },
      ...overrides,
    }),
  };
}

/**
 * Bot double whose carrier records every carrier interaction. Each carrier
 * reports its own segment id so the merged turn receipt is observable.
 * `onFinish(value, index)` may return 'throw' or 'fail' to exercise the
 * segment fallbacks.
 */
function streamBot({ onFinish = null } = {}) {
  const events = [];
  let index = 0;
  return {
    events,
    sendText: async (_target, text) => {
      events.push(`text:${text}`);
      return { providerMessageIds: [`text-${events.length}`] };
    },
    openStream: async (_target, options) => {
      events.push(`open:${JSON.stringify(options)}`);
      const carrier = ++index;
      return {
        presentation: 'test-stream',
        providerMessageIds: [`segment-${carrier}`],
        update: async (value) => {
          events.push(`update:${value}`);
        },
        finish: async (value) => {
          events.push(`finish:${value}`);
          const verdict = onFinish?.(value, carrier);
          if (verdict === 'throw') throw new Error('carrier finalization failed');
          if (verdict === 'throw-permission') {
            throw Object.assign(new Error('Telegram 403'), { status: 403 });
          }
          if (verdict === 'fail') return { deliveryOutcome: 'failed', reason: 'rejected' };
          return { presentation: 'test-stream', providerMessageIds: [`final-${carrier}`] };
        },
        cancel: () => {
          events.push(`cancel:${carrier}`);
        },
      };
    },
  };
}

/** Bot double for the semantic carrier path (openDeliveryStream). */
function semanticStreamBot() {
  const events = [];
  let index = 0;
  return {
    events,
    sendText: async (_target, text) => {
      events.push(`text:${text}`);
      return { providerMessageIds: [] };
    },
    openDeliveryStream: async (_target, options) => {
      events.push(`open:${JSON.stringify(options)}`);
      const carrier = ++index;
      return {
        presentation: 'semantic',
        providerMessageIds: [],
        update: async (block) => {
          events.push(`update:${block.format}:${block.text}`);
        },
        finish: async (block) => {
          events.push(`finish:${block.format}:${block.text}`);
          return { providerMessageIds: [`final-${carrier}`] };
        },
        cancel: () => {
          events.push(`cancel:${carrier}`);
        },
      };
    },
  };
}

function createBridge({ bot, humanize, harness }) {
  return new TextHarnessBridge({
    descriptor: { key: 'test', label: 'Test' },
    bot,
    harness,
    state: stateFixture(),
    logger: { warn() {}, error() {} },
    humanize,
  });
}

function askDrivingStub(deliver, answer) {
  return {
    createSession: async () => 'session',
    ask: async (_sessionId, _text, options) => {
      await deliver(options.onUpdate);
      return answer;
    },
  };
}

test('messageBreak with streaming forwards text updates to the carrier', async () => {
  const bot = streamBot();
  let onUpdate = null;
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, messageBreak: true, progressStatus: false }),
    harness: {
      createSession: async () => 'session',
      ask: async (_sessionId, _text, options) => {
        onUpdate = options.onUpdate;
        return '回答';
      },
    },
  });
  await bridge.accept(message('m1', '问题'));
  // progressStatus=false still suppresses tool progress…
  await onUpdate({ type: 'tool', name: 'bash' });
  assert.deepEqual(
    bot.events.filter((event) => event.startsWith('update:')),
    [],
    'tool progress is dropped while progressStatus is off',
  );
  // …but real answer text streams instead of being dropped by messageBreak.
  await onUpdate({ type: 'text', text: '逐字输出' });
  assert.ok(bot.events.includes('update:逐字输出'), 'text reaches the carrier');
});

test('a message_break finalizes the segment in place and opens a fresh carrier', async () => {
  const bot = streamBot();
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, messageBreak: true, progressStatus: false }),
    harness: askDrivingStub(async (onUpdate) => {
      await onUpdate({ type: 'text', text: '第一段' });
      await onUpdate({ type: 'message_break', text: '第一段' });
      await onUpdate({ type: 'text', text: '第二段' });
    }, '第一段第二段'),
  });
  const receipt = await bridge.accept(message('m2', '问题'));
  assert.deepEqual(bot.events, [
    'open:{"lazy":true}',
    'update:第一段',
    'finish:第一段',
    'open:{"lazy":true}',
    'update:第二段',
    'finish:第二段',
  ]);
  assert.deepEqual(
    receipt?.providerMessageIds,
    ['segment-1', 'final-1', 'segment-2', 'final-2'],
    'every finalized segment contributes to the turn receipt',
  );
});

test('a turn ending right after a break cancels the empty carrier', async () => {
  const bot = streamBot();
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, messageBreak: true, progressStatus: false }),
    harness: askDrivingStub(async (onUpdate) => {
      await onUpdate({ type: 'text', text: '第一段' });
      await onUpdate({ type: 'message_break', text: '第一段' });
    }, '第一段'),
  });
  const receipt = await bridge.accept(message('m3', '问题'));
  assert.deepEqual(bot.events, [
    'open:{"lazy":true}',
    'update:第一段',
    'finish:第一段',
    'open:{"lazy":true}',
    'cancel:2',
  ]);
  // The turn has no text receipt: nothing was delivered as a final message,
  // the segment already went out through its own carrier.
  assert.equal(receipt, null);
});

test('messageBreak without streaming still sends each segment as text', async () => {
  const bot = streamBot();
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: false, messageBreak: true }),
    harness: askDrivingStub(async (onUpdate) => {
      await onUpdate({ type: 'text', text: '第一段' });
      await onUpdate({ type: 'message_break', text: '第一段' });
    }, '第一段第二段'),
  });
  await bridge.accept(message('m4', '问题'));
  assert.deepEqual(bot.events, ['text:第一段', 'text:第二段']);
});

test('a raw whitespace mismatch never drops the tail it cannot account for', async () => {
  const bot = streamBot();
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, messageBreak: true, progressStatus: false }),
    harness: askDrivingStub(async (onUpdate) => {
      await onUpdate({ type: 'text', text: '第一段' });
      // A segment whose raw text no longer prefixes the canonical answer (here:
      // trailing newlines the answer dropped) must not be treated as "the reply
      // ended at the break": repeating the segment beats losing the tail.
      await onUpdate({ type: 'message_break', text: '第一段\n\n' });
    }, '第一段第二段'),
  });
  await bridge.accept(message('m7', '问题'));
  assert.deepEqual(bot.events, [
    'open:{"lazy":true}',
    'update:第一段',
    'finish:第一段',
    'open:{"lazy":true}',
    'finish:第一段第二段',
  ]);
});

test('a semantic carrier (openDeliveryStream) also rotates per segment', async () => {
  const bot = semanticStreamBot();
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, messageBreak: true, progressStatus: false }),
    harness: askDrivingStub(async (onUpdate) => {
      await onUpdate({ type: 'text', text: '第一段' });
      await onUpdate({ type: 'message_break', text: '第一段' });
      await onUpdate({ type: 'text', text: '第二段' });
    }, '第一段第二段'),
  });
  await bridge.accept(message('m8', '问题'));
  assert.deepEqual(bot.events, [
    'open:{"lazy":true}',
    'update:markdown:第一段',
    'finish:markdown:第一段',
    'open:{"lazy":true}',
    'update:markdown:第二段',
    'finish:markdown:第二段',
  ]);
});

test('an uncertain segment finalization failure is not re-sent', async () => {
  const bot = streamBot({ onFinish: (_value, carrier) => (carrier === 1 ? 'throw' : null) });
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, messageBreak: true, progressStatus: false }),
    harness: askDrivingStub(async (onUpdate) => {
      await onUpdate({ type: 'text', text: '第一段' });
      await onUpdate({ type: 'message_break', text: '第一段' });
      await onUpdate({ type: 'text', text: '第二段' });
    }, '第一段第二段'),
  });
  await bridge.accept(message('m5', '问题'));
  // A thrown delivery error may already have landed: re-sending the segment
  // could duplicate it in the chat.
  assert.deepEqual(bot.events, [
    'open:{"lazy":true}',
    'update:第一段',
    'finish:第一段',
    'cancel:1',
    'open:{"lazy":true}',
    'update:第二段',
    'finish:第二段',
  ]);
});

test('a definitively rejected segment is re-sent as text', async () => {
  const bot = streamBot({ onFinish: (_value, carrier) => (carrier === 1 ? 'throw-permission' : null) });
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, messageBreak: true, progressStatus: false }),
    harness: askDrivingStub(async (onUpdate) => {
      await onUpdate({ type: 'text', text: '第一段' });
      await onUpdate({ type: 'message_break', text: '第一段' });
      await onUpdate({ type: 'text', text: '第二段' });
    }, '第一段第二段'),
  });
  await bridge.accept(message('m9', '问题'));
  assert.deepEqual(bot.events, [
    'open:{"lazy":true}',
    'update:第一段',
    'finish:第一段',
    'cancel:1',
    'text:第一段',
    'open:{"lazy":true}',
    'update:第二段',
    'finish:第二段',
  ]);
});

test('a carrier that fails to re-open degrades the next segment to text', async () => {
  const events = [];
  let opened = 0;
  const bot = {
    events,
    sendText: async (_target, text) => {
      events.push(`text:${text}`);
      return { providerMessageIds: [] };
    },
    openStream: async (_target, options) => {
      events.push(`open:${JSON.stringify(options)}`);
      opened += 1;
      if (opened > 1) throw new Error('carrier unavailable');
      return {
        presentation: 'test-stream',
        update: async (value) => { events.push(`update:${value}`); },
        finish: async (value) => { events.push(`finish:${value}`); return {}; },
        cancel: () => { events.push('cancel'); },
      };
    },
  };
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, messageBreak: true, progressStatus: false }),
    harness: askDrivingStub(async (onUpdate) => {
      await onUpdate({ type: 'text', text: '第一段' });
      await onUpdate({ type: 'message_break', text: '第一段' });
      await onUpdate({ type: 'text', text: '第二段' });
    }, '第一段第二段'),
  });
  await bridge.accept(message('m10', '问题'));
  // The reopened carrier is gone, so the tail falls back to a plain text send
  // rather than being dropped.
  assert.deepEqual(events, [
    'open:{"lazy":true}',
    'update:第一段',
    'finish:第一段',
    'open:{"lazy":true}',
    'text:第二段',
  ]);
});

test('a rotation brings the composing indicator back for the next segment', async () => {
  const bot = streamBot();
  const typingAt = [];
  bot.sendTyping = async () => { typingAt.push(bot.events.length); };
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({
      streaming: true,
      messageBreak: true,
      progressStatus: false,
      typingIndicator: 'continuous',
    }),
    harness: askDrivingStub(async (onUpdate) => {
      await onUpdate({ type: 'text', text: '第一段' });
      await onUpdate({ type: 'message_break', text: '第一段' });
      await onUpdate({ type: 'text', text: '第二段' });
    }, '第一段第二段'),
  });
  await bridge.accept(message('m11', '问题'));
  // The first streamed frame stops the indicator; the rotation must bring it
  // back for the next segment's compute gap.
  const finished = bot.events.indexOf('finish:第一段');
  assert.ok(finished !== -1, 'the first segment was finalized');
  assert.ok(typingAt.some((at) => at > finished),
    `the composing indicator was re-armed after the break (typing at ${typingAt.join(',')}, finished at ${finished})`);
});

test('a segment the carrier reports as failed is re-sent as text', async () => {
  const bot = streamBot({ onFinish: (_value, carrier) => (carrier === 1 ? 'fail' : null) });
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, messageBreak: true, progressStatus: false }),
    harness: askDrivingStub(async (onUpdate) => {
      await onUpdate({ type: 'message_break', text: '第一段' });
    }, '第一段'),
  });
  await bridge.accept(message('m6', '问题'));
  assert.deepEqual(bot.events, [
    'open:{"lazy":true}',
    'finish:第一段',
    'text:第一段',
    'open:{"lazy":true}',
    'cancel:2',
  ]);
});
