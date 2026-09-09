import assert from 'node:assert/strict';
import test from 'node:test';

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { TextHarnessBridge } from '../src/channels/shared/text-harness-bridge.mjs';
import { outboundArtifactRegistry } from '../src/channels/shared/semantic/artifact.mjs';
import { DEFAULT_SEND_DELAY_CONFIG } from '../src/channels/shared/send-delay.mjs';

/**
 * Bridge-level tests for the two-phase humanization pipeline (plan
 * docs/features/260908-humanize-send-delay-typing §339):
 *   ① read delay — silent, pre-ask, abortable (supersede)
 *   ② compose — typing session, segment gaps, interaction pause/resume,
 *      streaming early-stop, turn-bound stop.
 *
 * The typing-session state machine itself (burst rhythm, residual-aware
 * dark phase) is covered by test/typing-session.test.mjs with a fake
 * clock; here only ordering and lifecycle are asserted.
 */

const DESCRIPTOR = Object.freeze({
  key: 'test',
  label: 'Test',
  reactions: undefined,
  typing: Object.freeze({ refreshMs: 50, darkResidualMs: 0 }),
});

/**
 * Read-delay/typing timers are unref'd (shutdown safety); keep the event
 * loop alive for the duration of each test body.
 */
function withKeepAlive(run) {
  const keepAlive = setInterval(() => {}, 1_000);
  return run().finally(() => clearInterval(keepAlive));
}

function stateFixture() {
  const sessions = new Map();
  const seen = new Set();
  return {
    state: {
      sessionFor: (key) => sessions.get(key) ?? null,
      async setSession(key, sessionId) {
        sessions.set(key, sessionId);
        return true;
      },
      async clearSession(key) { sessions.delete(key); },
      hasSeen: (messageId) => seen.has(messageId),
      async markSeen(messageId) { seen.add(messageId); },
    },
  };
}

function message(messageId, content, overrides = {}) {
  return {
    messageId,
    senderId: 'actor-a',
    senderIsBot: false,
    kind: 'direct',
    conversationId: 'chat-a',
    content,
    addressed: true,
    replyTarget: { id: `target-${messageId}` },
    ...overrides,
  };
}

function humanizeSettings(overrides = {}, sendDelayOverrides = {}) {
  return {
    getSettings: () => ({
      typingIndicator: 'off',
      ...overrides,
      sendDelay: {
        ...DEFAULT_SEND_DELAY_CONFIG,
        ...sendDelayOverrides,
      },
    }),
  };
}

function recordedBot({
  withTyping = true,
  withStopTyping = false,
  streaming = false,
} = {}) {
  const events = [];
  const bot = {
    events,
    sendText: async (_target, text) => {
      events.push(`text:${text}`);
      return { providerMessageIds: [`id-${events.length}`] };
    },
    openStream: streaming
      ? async () => {
        events.push('open');
        return {
          update: async (text) => { events.push(`update:${text}`); },
          finish: async (text) => { events.push(`finish:${text}`); },
          cancel: () => { events.push('cancel'); },
        };
      }
      : undefined,
  };
  if (withTyping) {
    bot.sendTyping = async () => { events.push('typing'); };
  }
  if (withStopTyping) {
    bot.stopTyping = async () => { events.push('stop-typing'); };
  }
  return bot;
}

function createBridge({ bot, humanize, harness, state, descriptor = DESCRIPTOR } = {}) {
  return new TextHarnessBridge({
    descriptor,
    bot,
    harness,
    state: state ?? stateFixture().state,
    logger: { warn() {}, error() {} },
    humanize,
  });
}

test('read delay is silent and precedes both the typing indicator and the ask', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: true });
  const startedAt = Date.now();
  let askAt = 0;
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'continuous' },
      { enabled: true, readDelay: { minMs: 120, maxMs: 180 } },
    ),
    harness: {
      createSession: async () => 'session-delay',
      ask: async () => {
        askAt = Date.now();
        return '延迟后的回答';
      },
    },
  });
  await bridge.accept(message('delay-one', '需要延迟的问题'));
  const replyAt = Date.now();
  assert.ok(askAt - startedAt >= 100, `ask must wait out the read delay (waited ${askAt - startedAt}ms)`);
  assert.ok(replyAt - startedAt < 5_000, 'delay must be bounded');
  // Phase ② order: the typing indicator opens first, then the ask runs.
  const typingIndex = bot.events.indexOf('typing');
  const textIndex = bot.events.indexOf('text:延迟后的回答');
  assert.ok(typingIndex !== -1, 'typing indicator must fire in compose phase');
  assert.ok(textIndex > typingIndex, 'reply text follows the typing indicator');
}));

test('a follow-up message right after a completed turn gets the activity fast reply', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: true });
  const askWaits = [];
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'continuous' },
      {
        enabled: true,
        readDelay: {
          minMs: 200, maxMs: 300, charsPerSecond: 0, maxTotalMs: 30_000,
          activityBoost: {
            enabled: true, fastReplyMs: 150, fastWindowMs: 60_000,
            minWindowMs: 120_000, fullWindowMs: 300_000,
          },
        },
      },
    ),
    harness: {
      createSession: async () => 'session-activity',
      sessionExists: async () => true,
      ask: async () => {
        askWaits.push(Date.now());
        return '回答';
      },
    },
  });
  let turnStartedAt = Date.now();
  await bridge.accept(message('activity-one', '第一条'));
  // First message: no completed turn on record (idleMs null) → the full
  // uniform range applies, not the fast reply.
  const firstWait = askWaits[0] - turnStartedAt;
  assert.ok(firstWait >= 200, `first message waits the full range (waited ${firstWait}ms)`);

  turnStartedAt = Date.now();
  await bridge.accept(message('activity-two', '马上又来一条'));
  // The previous turn just ended: idle is inside the fast window, so the
  // base snaps to fastReplyMs instead of uniform(200, 300).
  const secondWait = askWaits[1] - turnStartedAt;
  assert.ok(secondWait >= 100, `fast reply still waits (waited ${secondWait}ms)`);
  assert.ok(secondWait < 200, `follow-up beats the configured floor (waited ${secondWait}ms)`);
}));

test('sendDelay disabled keeps the legacy immediate flow', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: true });
  const startedAt = Date.now();
  let askAt = 0;
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ typingIndicator: 'off' }),
    harness: {
      createSession: async () => 'session-no-delay',
      ask: async () => {
        askAt = Date.now();
        return '立即回答';
      },
    },
  });
  await bridge.accept(message('no-delay', '普通问题'));
  assert.ok(askAt - startedAt < 80, 'disabled sendDelay must not sleep');
  assert.equal(bot.events.includes('typing'), false, 'typing off = no indicator at all');
  assert.deepEqual(bot.events.filter((e) => e.startsWith('text:')), ['text:立即回答']);
}));

test('a newer message supersedes a turn still in its read delay', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: true });
  const asks = [];
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'off' },
      { enabled: true, readDelay: { minMs: 400, maxMs: 500 } },
    ),
    harness: {
      createSession: async () => 'session-supersede',
      ask: async (_sessionId, content) => {
        asks.push(content);
        return `回答:${content}`;
      },
    },
  });
  const first = bridge.accept(message('superseded-one', '先到的问题'));
  await new Promise((resolve) => setImmediate(resolve));
  // Second message arrives while the first is still silently reading.
  const second = bridge.accept(message('superseded-two', '后来的问题'));
  await Promise.all([first, second]);
  assert.deepEqual(asks, ['后来的问题'], 'only the newer message reaches the harness');
  assert.deepEqual(bot.events.filter((e) => e.startsWith('text:')), ['text:回答:后来的问题'],
    'the superseded turn stays silent — no error reply, no double reply');
}));

test('/stop during the read delay stops the pending message', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: true });
  const asks = [];
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'off' },
      { enabled: true, readDelay: { minMs: 500, maxMs: 600 } },
    ),
    harness: {
      createSession: async () => 'session-stop',
      ask: async (_sessionId, content) => {
        asks.push(content);
        return '不应到达';
      },
    },
  });
  const pending = bridge.accept(message('stop-one', '会被停止的问题'));
  await new Promise((resolve) => setImmediate(resolve));
  await bridge.accept(message('stop-cmd', '/stop'));
  await pending;
  assert.deepEqual(asks, [], 'the stopped message never reaches the harness');
  assert.ok(bot.events.some((e) => e.startsWith('text:已停止待发送的消息')),
    'the stop command acknowledges the pending message');
  assert.equal(bot.events.some((e) => e.startsWith('text:不应到达')), false);
}));

test('streaming early-stops the typing session at the first visible reply', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: true, withStopTyping: true, streaming: true });
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'continuous' },
      { enabled: true, readDelay: { minMs: 10, maxMs: 20 } },
    ),
    harness: {
      createSession: async () => 'session-early-stop',
      ask: async (_sessionId, _content, options) => {
        await options.onUpdate({ type: 'text', text: '第一段' });
        // Give the (50ms) refresh timer a chance to fire wrongly.
        await new Promise((resolve) => setTimeout(resolve, 140));
        await options.onUpdate({ type: 'text', text: '第二段' });
        await new Promise((resolve) => setTimeout(resolve, 60));
        return '最终回答';
      },
    },
  });
  await bridge.accept(message('early-stop', '流式问题'));
  const typingEvents = bot.events.filter((e) => e === 'typing');
  assert.ok(typingEvents.length >= 1, 'the compose session starts with the indicator');
  assert.equal(bot.events.indexOf('stop-typing') !== -1, true,
    'the session stops explicitly once the first stream update is visible');
  const stopIndex = bot.events.indexOf('stop-typing');
  assert.equal(bot.events.filter((e, index) => e === 'typing' && index > stopIndex).length, 0,
    'no indicator refresh after the first visible reply');
}));

test('with onNewMessage queue, a message during an in-flight ask queues instead of superseding', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: false });
  const asks = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'off', onNewMessage: 'queue' },
      { enabled: true, readDelay: { minMs: 5, maxMs: 10 } },
    ),
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-queue',
      ask: async (_sessionId, content) => {
        asks.push(String(content));
        if (String(content).includes('第一条')) await firstGate;
        return `回答:${content}`;
      },
    },
  });
  const first = bridge.accept(message('q1', '第一条'));
  // Let the read delay pass so the first ask is genuinely in flight.
  await new Promise((resolve) => setTimeout(resolve, 60));
  const second = bridge.accept(message('q2', '第二条'));
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(asks.length, 1, 'the second message must not start its own turn');
  assert.match(asks[0], /第一条/);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(asks.map((a) => (a.includes('第一条') ? 1 : a.includes('第二条') ? 2 : 0)), [1, 2],
    'both messages reach the harness in order');
  assert.ok(bot.events.includes('text:回答:第一条') && bot.events.includes('text:回答:第二条'),
    'both turns deliver their replies — no silent supersede');
}));

test('with onNewMessage steer, a plain text message steers and never supersedes', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: false });
  const steers = [];
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'off', onNewMessage: 'steer' },
      { enabled: true, readDelay: { minMs: 5, maxMs: 10 } },
    ),
    harness: {
      // #boundSession only steers through a workspaceSession view, so the
      // fixture exposes one (trySteer requires it).
      workspaceSession: (sessionId) => ({
        sessionId,
        sessionExists: async () => true,
        steerActiveTurn: async (text) => {
          steers.push(String(text));
          return true;
        },
        ask: async (content) => {
          await new Promise((resolve) => setTimeout(resolve, 80));
          return `回答:${content}`;
        },
      }),
      createSession: async () => 'session-steer',
    },
  });
  const first = bridge.accept(message('s1', '第一条'));
  await new Promise((resolve) => setTimeout(resolve, 60));
  const second = bridge.accept(message('s2', '补充说明'));
  await Promise.all([first, second]);
  assert.deepEqual(steers, ['补充说明'], 'the in-flight turn is steered, not superseded');
  assert.ok(bot.events.includes('text:回答:第一条'),
    'the original turn still completes and replies');
  assert.ok(!bot.events.some((e) => e.startsWith('text:') && e.includes('补充说明')),
    'the steering message itself never becomes a separate reply');
}));

test('a superseded batch submission returns to collecting so /send can retry', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: false });
  const asks = [];
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'off' },
      { enabled: true, readDelay: { minMs: 400, maxMs: 500 } },
    ),
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-batch',
      ask: async (_sessionId, content) => {
        asks.push(String(content));
        return `回答:${content}`;
      },
    },
  });
  await bridge.accept(message('b-open', '/batch'));
  await bridge.accept(message('b-1', '第一句批量内容'));
  await bridge.accept(message('b-2', '第二句批量内容'));
  const submitted = bridge.accept(message('b-send', '/send'));
  await new Promise((resolve) => setImmediate(resolve));
  // A newer message during the batch turn's read delay supersedes it.
  const newer = bridge.accept(message('b-new', '插队问题'));
  await Promise.all([submitted, newer]);
  assert.equal(asks.length, 1, 'only the newer message reaches the harness');
  assert.match(asks[0], /插队问题/);
  assert.ok(!bot.events.some((e) => e.includes('批量内容')),
    'the superseded batch never produces a reply');

  // The batch fell back to collecting — /send retries instead of being
  // told the batch is still submitting.
  const retried = bridge.accept(message('b-retry', '/send'));
  await retried;
  assert.equal(asks.length, 2, 'the retry re-submits the batch');
  assert.match(asks[1], /第一句批量内容/);
  assert.match(asks[1], /第二句批量内容/);
  assert.ok(bot.events.some((e) => e.includes('第一句批量内容')),
    'the retried batch turn replies');
}));

test('artifact delivery restarts the indicator with the upload action', async (t) => withKeepAlive(async () => {
  // Real registered artifacts: the bridge materializes managed snapshots
  // before sending, so the fixture goes through the actual registry.
  const workDir = await mkdtemp(join(tmpdir(), 'dsh-im-artifact-test-'));
  t.after(async () => { await rm(workDir, { recursive: true, force: true }); });
  const imagePath = join(workDir, 'chart.png');
  const docPath = join(workDir, 'notes.txt');
  await writeFile(imagePath, 'fake-png-bytes');
  await writeFile(docPath, 'fake-doc-bytes');
  const exec = {
    signal: new AbortController().signal,
    callId: 'call-art',
    agent: {
      session: {
        header: { id: 'session-artifacts', cwd: workDir },
        events: [{ type: 'turn/start', data: { turn: 7 } }],
      },
    },
  };
  const imageArtifact = await outboundArtifactRegistry.stage({ path: imagePath }, exec);
  const docArtifact = await outboundArtifactRegistry.stage({ path: docPath }, exec);

  const bot = recordedBot({ withTyping: true });
  const typingActions = [];
  bot.sendTyping = async (_target, action) => { typingActions.push(action ?? 'typing'); };
  bot.sendImage = async () => ({ providerMessageIds: ['img-1'] });
  bot.sendFile = async () => ({ providerMessageIds: ['doc-1'] });

  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'continuous' },
      { enabled: true, readDelay: { minMs: 5, maxMs: 10 } },
    ),
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-artifacts',
      ask: async (_sessionId, _content, options) => {
        await options.onArtifact(imageArtifact);
        await options.onArtifact(docArtifact);
        return '带附件的回答';
      },
    },
  });
  await bridge.accept(message('artifact-1', '附件问题'));
  assert.ok(typingActions.includes('upload_photo'),
    `an image artifact switches the indicator to upload_photo (got ${typingActions.join(',')})`);
  assert.ok(typingActions.includes('upload_document'),
    `a document artifact switches the indicator to upload_document (got ${typingActions.join(',')})`);
  assert.ok(bot.events.includes('text:带附件的回答'),
    'the text reply still completes the turn');
  // The registry's managed snapshots are released after delivery.
  const second = [];
  bot.sendTyping = async (_target, action) => { second.push(action ?? 'typing'); };
  await bridge.accept(message('artifact-2', '再要一次附件'));
  assert.equal(second.filter((a) => a === 'upload_photo' || a === 'upload_document').length, 0,
    'released artifacts are not re-delivered');
}));

test('segment gaps pause between message-break segments and relight the indicator', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: true });
  const segmentTimes = new Map();
  const sendTextOriginal = bot.sendText;
  bot.sendText = async (target, text) => {
    segmentTimes.set(text, Date.now());
    return sendTextOriginal(target, text);
  };
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'continuous', messageBreak: true, streaming: false },
      {
        enabled: true,
        readDelay: { minMs: 5, maxMs: 10 },
        segmentGap: { minMs: 90, maxMs: 110 },
      },
    ),
    harness: {
      createSession: async () => 'session-segments',
      ask: async (_sessionId, _content, options) => {
        await options.onUpdate({ type: 'message_break', text: '第一段' });
        await options.onUpdate({ type: 'message_break', text: '第二段' });
        return '收尾';
      },
    },
  });
  await bridge.accept(message('segments', '分段问题'));
  const firstAt = segmentTimes.get('第一段');
  const secondAt = segmentTimes.get('第二段');
  assert.ok(firstAt !== undefined && secondAt !== undefined,
    `both segments must be sent separately (got ${[...segmentTimes.keys()].join(', ')})`);
  assert.ok(secondAt - firstAt >= 70,
    `segments must be separated by the segment gap (waited ${secondAt - firstAt}ms)`);
  // The indicator relights after each segment send (restartOn in the
  // sendSegment wrapper).
  const firstSegmentIndex = bot.events.indexOf('text:第一段');
  const typingAfterFirstSegment = bot.events.filter(
    (e, index) => e === 'typing' && index > firstSegmentIndex,
  ).length;
  assert.ok(typingAfterFirstSegment >= 1, 'the indicator relights between segments');
  assert.ok(bot.events.includes('text:收尾'), 'the remaining text still completes the turn');
}));

test('pending questions pause the compose session and resume after resolution', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: true });
  const typingWhilePending = { count: -1 };
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'continuous' },
      { enabled: true, readDelay: { minMs: 5, maxMs: 10 } },
    ),
    harness: {
      createSession: async () => 'session-interaction',
      ask: async (_sessionId, _content, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'interaction-1',
          rpcId: 'rpc-1',
          sessionId: 'session-interaction',
          payload: {
            questions: [{
              id: 'q1',
              question: '继续吗？',
              choices: [{ id: 'yes', name: '继续' }, { id: 'no', name: '停止' }],
            }],
          },
        });
        // While the question is pending the session must pause: no
        // indicator refreshes for ~5 refresh periods (50ms each).
        await new Promise((resolve) => setTimeout(resolve, 240));
        typingWhilePending.count = bot.events.filter((e) => e === 'typing').length;
        return '互动后的回答';
      },
    },
  });
  const acceptTask = bridge.accept(message('interaction', '互动问题'));
  // Wait until the question is presented, then answer it.
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(bot.events.some((e) => e.startsWith('text:') && e.includes('继续吗')), true,
    'the pending question is presented');
  const typingBeforeQuestion = bot.events
    .slice(0, bot.events.findIndex((e) => e.startsWith('text:') && e.includes('继续吗')))
    .filter((e) => e === 'typing').length;
  await bridge.accept(message('interaction-answer', '继续'));
  await acceptTask;
  assert.ok(typingWhilePending.count >= 0
    && typingWhilePending.count - typingBeforeQuestion <= 1,
    'no indicator refreshes accumulate while the question is pending (pause works)');
  assert.ok(bot.events.some((e) => e === 'text:互动后的回答'),
    'the turn completes after the interaction');
}));


test('turn errors stop the typing session without leaving the indicator on', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: true, withStopTyping: true });
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ typingIndicator: 'continuous' }),
    harness: {
      createSession: async () => 'session-error',
      ask: async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        throw new Error('harness exploded');
      },
    },
  });
  await bridge.accept(message('error-turn', '会失败的问题'));
  assert.equal(bot.events.at(-1), 'stop-typing',
    'the session is stopped at turn end even when the ask fails');
  assert.ok(bot.events.some((e) => e.startsWith('text:') && e.includes('任务未完成')),
    'the failure reply still reaches the user');
}));

test('channels without a typing API never start a session and still delay reads', async () => withKeepAlive(async () => {
  const bot = recordedBot({ withTyping: false });
  const startedAt = Date.now();
  let askAt = 0;
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings(
      { typingIndicator: 'burst' },
      { enabled: true, readDelay: { minMs: 90, maxMs: 120 } },
    ),
    harness: {
      createSession: async () => 'session-no-typing-api',
      ask: async () => {
        askAt = Date.now();
        return '无声渠道的回答';
      },
    },
  });
  await bridge.accept(message('no-typing-api', '无声渠道'));
  assert.ok(askAt - startedAt >= 70, 'the read delay applies without a typing API');
  assert.equal(bot.events.includes('typing'), false, 'no typing events without the API');
}));

function reactiveBot() {
  const reactions = [];
  const bot = recordedBot({ withTyping: false, withStopTyping: true });
  bot.addReaction = async (target, emoji) => {
    reactions.push(`add:${emoji}`);
    return emoji;
  };
  bot.removeReaction = async (target, emoji) => {
    reactions.push(`remove:${emoji}`);
    return emoji;
  };
  bot.reactions = reactions;
  return bot;
}

async function waitForReactionTerminal(bot, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (bot.reactions.some((e) => e === 'add:👍' || e === 'add:👎')) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function reactionDescriptor() {
  return Object.freeze({
    key: 'test',
    label: 'Test',
    reactions: Object.freeze({ processing: '👀', success: '👍', error: '👎' }),
    typing: Object.freeze({ refreshMs: 50, darkResidualMs: 0 }),
  });
}

test('statusReaction=false silences emoji reactions while the reply still delivers', async () => withKeepAlive(async () => {
  const bot = reactiveBot();
  const bridge = createBridge({
    bot,
    descriptor: reactionDescriptor(),
    humanize: humanizeSettings({ statusReaction: false }),
    harness: {
      createSession: async () => 'session-reaction-off',
      ask: async () => '关闭表情后的回答',
    },
  });
  await bridge.accept(message('reaction-off', '不要表情', { reactionTarget: { id: 'reaction-off' } }));
  // The terminal transition is fire-and-forget; give it a window in
  // which any stray call would be recorded, then assert none happened.
  await waitForReactionTerminal(bot, 300);
  assert.deepEqual(bot.reactions, [], 'no reaction calls at all when disabled');
  assert.ok(bot.events.some((e) => e === 'text:关闭表情后的回答'),
    'the reply still delivers');
}));

test('statusReaction default keeps the processing and terminal emoji lifecycle', async () => withKeepAlive(async () => {
  const bot = reactiveBot();
  const bridge = createBridge({
    bot,
    descriptor: reactionDescriptor(),
    humanize: humanizeSettings({}),
    harness: {
      createSession: async () => 'session-reaction-on',
      ask: async () => '保留表情的回答',
    },
  });
  await bridge.accept(message('reaction-on', '要表情', { reactionTarget: { id: 'reaction-on' } }));
  await waitForReactionTerminal(bot);
  assert.ok(bot.reactions.includes('add:👀'), 'processing reaction is attached');
  assert.ok(bot.reactions.includes('remove:👀'), 'processing reaction is removed');
  assert.ok(bot.reactions.some((e) => e === 'add:👍' || e === 'add:👎'),
    'a terminal reaction lands');
  assert.ok(bot.events.some((e) => e === 'text:保留表情的回答'),
    'the reply still delivers');
}));
