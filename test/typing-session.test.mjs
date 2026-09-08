import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_TYPING_BURST,
  DEFAULT_TYPING_INDICATOR,
  TYPING_INDICATOR_MODES,
  createTypingSession,
  normalizeTypingBurst,
  normalizeTypingIndicator,
  validateTypingBurst,
} from '../src/channels/shared/typing-session.mjs';

/**
 * Deterministic clock for scheduling assertions. Timers fire in due order
 * as the clock advances; async steps settle between firings.
 */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const pending = new Map();

  const settle = async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextId;
      nextId += 1;
      pending.set(id, { at: now + ms, fn });
      return {
        unref() {},
        get id() {
          return id;
        },
      };
    },
    clearTimeout(handle) {
      pending.delete(handle?.id);
    },
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        let dueId = null;
        let due = null;
        for (const [id, entry] of pending) {
          if (entry.at <= target && (!due || entry.at < due.at)) {
            due = entry;
            dueId = id;
          }
        }
        if (dueId === null) break;
        pending.delete(dueId);
        now = due.at;
        due.fn();
        await settle();
      }
      now = target;
      await settle();
    },
  };
}

function recorder({ failEvery = 0 } = {}) {
  const calls = [];
  let count = 0;
  return {
    calls,
    sendTyping: async (action) => {
      count += 1;
      if (failEvery > 0 && count % failEvery === 0) {
        throw new Error('typing api blew up');
      }
      calls.push({ at: calls.clockNow ? undefined : undefined, action, seq: count });
      return undefined;
    },
  };
}

/**
 * Send-call recorder bound to a fake clock: each call records the clock
 * time at which it fired.
 */
function trackedAdapter(clock, { failEvery = 0 } = {}) {
  const sends = [];
  const stops = [];
  let count = 0;
  return {
    sends,
    stops,
    sendTyping: async (action) => {
      count += 1;
      if (failEvery > 0 && count % failEvery === 0) {
        throw new Error('typing api blew up');
      }
      sends.push({ at: clock.now(), action });
    },
    stopTyping: async () => {
      stops.push({ at: clock.now() });
    },
  };
}

const noLogger = { warn: () => {} };

test('normalizeTypingIndicator maps legacy booleans and rejects unknown values', () => {
  assert.equal(normalizeTypingIndicator(true), 'burst');
  assert.equal(normalizeTypingIndicator(false), 'off');
  assert.equal(normalizeTypingIndicator('continuous'), 'continuous');
  assert.equal(normalizeTypingIndicator('burst'), 'burst');
  assert.equal(normalizeTypingIndicator('off'), 'off');
  assert.equal(normalizeTypingIndicator('nonsense'), DEFAULT_TYPING_INDICATOR);
  assert.equal(normalizeTypingIndicator(undefined), DEFAULT_TYPING_INDICATOR);
  assert.deepEqual(TYPING_INDICATOR_MODES, ['off', 'continuous', 'burst']);
});

test('normalizeTypingBurst clamps and swaps inverted ranges', () => {
  assert.deepEqual(normalizeTypingBurst(), DEFAULT_TYPING_BURST);
  assert.deepEqual(
    normalizeTypingBurst({ onMinMs: 6000, onMaxMs: 3000, offMinMs: -5, offMaxMs: 99_999_999 }),
    { onMinMs: 3000, onMaxMs: 6000, offMinMs: 0, offMaxMs: 60_000 },
  );
});

test('validateTypingBurst rejects malformed values with typed errors', () => {
  const full = { onMinMs: 1000, onMaxMs: 2000, offMinMs: 500, offMaxMs: 900 };
  const cases = [
    [null, 'typingBurst'],
    // Partial objects are rejected: the first missing field is reported.
    [{ onMaxMs: 2000 }, 'typingBurst.onMinMs'],
    [{ ...full, onMinMs: 'x' }, 'typingBurst.onMinMs'],
    [{ ...full, onMinMs: 6000, onMaxMs: 3000 }, 'typingBurst.onMinMs'],
    [{ ...full, offMinMs: 4000, offMaxMs: 1500 }, 'typingBurst.offMinMs'],
    [{ ...full, onMaxMs: 100_000 }, 'typingBurst.onMaxMs'],
  ];
  for (const [burst, field] of cases) {
    assert.throws(
      () => validateTypingBurst(burst),
      (error) => error.code === 'invalid-typing-burst' && error.field === field,
      `expected ${field} rejection`,
    );
  }
  assert.doesNotThrow(() => validateTypingBurst(full));
  assert.doesNotThrow(() => validateTypingBurst(undefined));
});

test('continuous mode sends immediately and refreshes on the period', async () => {
  const clock = fakeClock();
  const adapter = trackedAdapter(clock);
  const session = createTypingSession({
    sendTyping: adapter.sendTyping,
    refreshMs: 4000,
    mode: 'continuous',
    logger: noLogger,
    scheduler: clock,
  });
  await session.start();
  assert.equal(adapter.sends.length, 1);
  await clock.advance(4000);
  assert.equal(adapter.sends.length, 2);
  await clock.advance(8000);
  assert.equal(adapter.sends.length, 4);
  assert.deepEqual(adapter.sends.map((c) => c.at), [0, 4000, 8000, 12_000]);
  session.stop();
});

test('burst mode is residual-aware: dark interval = visible dark + platform residual', async () => {
  const clock = fakeClock();
  const adapter = trackedAdapter(clock);
  // random()=0 → on = onMinMs = 3000, visible dark = offMinMs = 1500.
  const session = createTypingSession({
    sendTyping: adapter.sendTyping,
    refreshMs: 4000,
    darkResidualMs: 5000,
    mode: 'burst',
    burst: { onMinMs: 3000, onMaxMs: 3000, offMinMs: 1500, offMaxMs: 1500 },
    random: () => 0,
    logger: noLogger,
    scheduler: clock,
  });
  await session.start();
  assert.deepEqual(adapter.sends.map((c) => c.at), [0]);
  await clock.advance(3000);
  // ON→OFF transition sends the final refresh that pins the residual clock.
  assert.deepEqual(adapter.sends.map((c) => c.at), [0, 3000]);
  await clock.advance(6499);
  assert.equal(adapter.sends.length, 2); // still dark
  await clock.advance(1);
  // Next ON begins exactly at last send + residual(5000) + visible dark(1500).
  assert.deepEqual(adapter.sends.map((c) => c.at), [0, 3000, 9500]);
  const darkInterval = adapter.sends[2].at - adapter.sends[1].at;
  assert.equal(darkInterval, 6500);
  session.stop();
});

test('burst mode refreshes during long on-phases so coverage never gaps', async () => {
  const clock = fakeClock();
  const adapter = trackedAdapter(clock);
  const session = createTypingSession({
    sendTyping: adapter.sendTyping,
    refreshMs: 4000,
    darkResidualMs: 5000,
    mode: 'burst',
    burst: { onMinMs: 6000, onMaxMs: 6000, offMinMs: 1500, offMaxMs: 1500 },
    random: () => 0,
    logger: noLogger,
    scheduler: clock,
  });
  await session.start();
  await clock.advance(6000);
  // Sends: 0 (start), 4000 (refresh), 6000 (final refresh at transition).
  assert.deepEqual(adapter.sends.map((c) => c.at), [0, 4000, 6000]);
  session.stop();
});

test('burst mode with an explicit stop cancels the indicator immediately', async () => {
  const clock = fakeClock();
  const adapter = trackedAdapter(clock);
  const session = createTypingSession({
    sendTyping: adapter.sendTyping,
    stopTyping: adapter.stopTyping,
    refreshMs: 8000,
    darkResidualMs: 0,
    mode: 'burst',
    burst: { onMinMs: 3000, onMaxMs: 3000, offMinMs: 1500, offMaxMs: 1500 },
    random: () => 0,
    logger: noLogger,
    scheduler: clock,
  });
  await session.start();
  await clock.advance(3000);
  assert.deepEqual(adapter.stops.map((c) => c.at), [3000]); // dark starts NOW
  await clock.advance(1500);
  assert.deepEqual(adapter.sends.map((c) => c.at), [0, 4500]); // no residual wait
  session.stop();
});

test('typing failures are tolerated without breaking the loop', async () => {
  const clock = fakeClock();
  const adapter = trackedAdapter(clock, { failEvery: 2 });
  const warnings = [];
  const session = createTypingSession({
    sendTyping: adapter.sendTyping,
    refreshMs: 4000,
    mode: 'continuous',
    logger: { warn: (msg) => warnings.push(msg) },
    scheduler: clock,
  });
  await session.start();
  await clock.advance(20_000);
  // Attempts at 0, 4000, 8000, 12000, 16000, 20000 — every second one fails.
  assert.deepEqual(adapter.sends.map((c) => c.at), [0, 8000, 16_000]);
  // Failures at 4000, 12000, 20000; the 12000 failure (8s after the 4000
  // log) falls inside the 10s log window, the 20000 one does not.
  assert.equal(warnings.length, 2);
  session.stop();
});

test('failure logging is rate-limited to once per window', async () => {
  const clock = fakeClock();
  const adapter = trackedAdapter(clock, { failEvery: 1 });
  const warnings = [];
  const session = createTypingSession({
    sendTyping: adapter.sendTyping,
    refreshMs: 1000,
    mode: 'continuous',
    logger: { warn: (msg) => warnings.push(msg) },
    scheduler: clock,
  });
  await session.start();
  await clock.advance(3000);
  // 4 failures within the 10s window → only the first logs.
  assert.equal(warnings.length, 1);
  session.stop();
});

test('stop clears timers and, when available, cancels the indicator', async () => {
  const clock = fakeClock();
  const adapter = trackedAdapter(clock);
  const session = createTypingSession({
    sendTyping: adapter.sendTyping,
    stopTyping: adapter.stopTyping,
    refreshMs: 4000,
    mode: 'continuous',
    logger: noLogger,
    scheduler: clock,
  });
  await session.start();
  session.stop();
  assert.deepEqual(adapter.stops.map((c) => c.at), [0]);
  await clock.advance(20_000);
  assert.equal(adapter.sends.length, 1); // no further refresh
  session.stop(); // idempotent
  assert.equal(adapter.stops.length, 1);
});

test('pause suspends the loop and resume restarts it', async () => {
  const clock = fakeClock();
  const adapter = trackedAdapter(clock);
  const session = createTypingSession({
    sendTyping: adapter.sendTyping,
    stopTyping: adapter.stopTyping,
    refreshMs: 4000,
    mode: 'continuous',
    logger: noLogger,
    scheduler: clock,
  });
  await session.start();
  await session.pause();
  assert.equal(session.isActive(), false);
  assert.deepEqual(adapter.stops.map((c) => c.at), [0]);
  await clock.advance(20_000);
  assert.equal(adapter.sends.length, 1);
  await session.resume();
  assert.equal(session.isActive(), true);
  assert.equal(adapter.sends.length, 2); // immediate restart send
  session.stop();
});

test('restartOn immediately begins a fresh on-phase with the action', async () => {
  const clock = fakeClock();
  const adapter = trackedAdapter(clock);
  const session = createTypingSession({
    sendTyping: adapter.sendTyping,
    refreshMs: 4000,
    darkResidualMs: 5000,
    mode: 'burst',
    burst: { onMinMs: 3000, onMaxMs: 3000, offMinMs: 1500, offMaxMs: 1500 },
    random: () => 0,
    logger: noLogger,
    scheduler: clock,
  });
  await session.start();
  await clock.advance(1500);
  await session.restartOn('upload_photo');
  assert.deepEqual(
    adapter.sends.map((c) => c.at),
    [0, 1500],
  );
  assert.equal(adapter.sends[1].action, 'upload_photo');
  // The restarted on-phase runs its full 3000ms from the restart.
  await clock.advance(3000);
  assert.deepEqual(adapter.sends.map((c) => c.at), [0, 1500, 4500]);
  session.stop();
});

test('aborting the signal stops the session without further sends', async () => {
  const clock = fakeClock();
  const adapter = trackedAdapter(clock);
  const controller = new AbortController();
  const session = createTypingSession({
    sendTyping: adapter.sendTyping,
    stopTyping: adapter.stopTyping,
    refreshMs: 4000,
    mode: 'continuous',
    logger: noLogger,
    signal: controller.signal,
    scheduler: clock,
  });
  await session.start();
  controller.abort();
  assert.deepEqual(adapter.stops.map((c) => c.at), [0]);
  await clock.advance(20_000);
  assert.equal(adapter.sends.length, 1);
});

test('createTypingSession requires a sendTyping function', () => {
  assert.throws(() => createTypingSession({}), TypeError);
});

test('start() on a pre-aborted signal settles into the stopped state instead of throwing', async () => {
  const clock = fakeClock();
  const adapter = trackedAdapter(clock);
  const controller = new AbortController();
  controller.abort();
  const session = createTypingSession({
    sendTyping: adapter.sendTyping,
    stopTyping: adapter.stopTyping,
    refreshMs: 4000,
    mode: 'continuous',
    logger: noLogger,
    signal: controller.signal,
    scheduler: clock,
  });
  // Before the fix this threw ReferenceError: stop is not defined and the
  // session stayed a running=true zombie with no timers (an unawaited
  // caller like the QQ bridge would crash the host process).
  await session.start();
  assert.equal(session.isActive(), false, 'a pre-aborted session is not active');
  assert.equal(adapter.sends.length, 0, 'nothing is sent');
  // Idempotent follow-ups stay safe.
  await session.stop();
  assert.equal(session.isActive(), false);
});
