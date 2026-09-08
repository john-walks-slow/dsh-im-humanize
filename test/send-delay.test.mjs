import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTIVITY_FAST_REPLY_MS_MAX,
  ACTIVITY_WINDOW_MS_MAX,
  DEFAULT_SEND_DELAY_CONFIG,
  READ_DELAY_ABSOLUTE_MAX_MS,
  SEGMENT_GAP_ABSOLUTE_MAX_MS,
  SHORT_DELAY_CAP_MS,
  abortableSleep,
  applyReadDelay,
  activityBaseDelayMs,
  applySegmentGap,
  computeReadDelayMs,
  computeSegmentGapMs,
  mergeHumanizeSettings,
  normalizeSendDelayConfig,
  requireCompleteSendDelay,
  validateSendDelayConfig,
  visibleLength,
} from '../src/channels/shared/send-delay.mjs';

test('normalizeSendDelayConfig fills defaults and stays disabled by default', () => {
  assert.deepEqual(normalizeSendDelayConfig(), DEFAULT_SEND_DELAY_CONFIG);
  assert.equal(normalizeSendDelayConfig().enabled, false);
  assert.equal(normalizeSendDelayConfig({ enabled: 'yes' }).enabled, false);
  assert.equal(normalizeSendDelayConfig({ enabled: true }).enabled, true);
});

test('normalizeSendDelayConfig clamps, swaps inverted ranges, and repairs maxTotalMs', () => {
  const normalized = normalizeSendDelayConfig({
    readDelay: { minMs: -5, maxMs: 999_999_999, maxTotalMs: 1 },
    segmentGap: { minMs: 5000, maxMs: 1000 },
  });
  assert.equal(normalized.readDelay.minMs, 0);
  assert.equal(normalized.readDelay.maxMs, READ_DELAY_ABSOLUTE_MAX_MS);
  assert.equal(normalized.readDelay.maxTotalMs, READ_DELAY_ABSOLUTE_MAX_MS);
  assert.equal(normalized.segmentGap.minMs, 1000);
  assert.equal(normalized.segmentGap.maxMs, 5000);
  assert.ok(normalized.segmentGap.maxTotalMs >= normalized.segmentGap.maxMs);
});

test('normalizeSendDelayConfig clamps and sorts activityBoost windows', () => {
  const normalized = normalizeSendDelayConfig({
    readDelay: { activityBoost: { fastReplyMs: -1, fastWindowMs: 500_000, minWindowMs: -5, fullWindowMs: 120_000 } },
  });
  const boost = normalized.readDelay.activityBoost;
  assert.equal(boost.enabled, true);
  assert.equal(boost.fastReplyMs, 0);
  // Inverted windows are sorted into fast <= min <= full.
  assert.equal(boost.fastWindowMs, 0);
  assert.equal(boost.minWindowMs, 120_000);
  assert.equal(boost.fullWindowMs, 500_000);
  assert.ok(boost.fastWindowMs <= boost.minWindowMs && boost.minWindowMs <= boost.fullWindowMs);
  const disabled = normalizeSendDelayConfig({
    readDelay: { activityBoost: { enabled: false } },
  });
  assert.equal(disabled.readDelay.activityBoost.enabled, false);
  // Hand-edited legacy sections carrying the retired idleBoost key keep
  // working: the key is dropped and the new defaults fill in.
  const legacy = normalizeSendDelayConfig({
    readDelay: { minMs: 1000, maxMs: 2000, idleBoost: { afterMs: 600_000, multiplier: 3 } },
  });
  assert.equal(legacy.readDelay.activityBoost.fullWindowMs, 300_000);
});

test('validateSendDelayConfig rejects malformed values with typed errors', () => {
  const cases = [
    [null, 'sendDelay'],
    [{ readDelay: { minMs: 5000, maxMs: 1000 } }, 'sendDelay.readDelay.minMs'],
    [{ readDelay: { minMs: -1 } }, 'sendDelay.readDelay.minMs'],
    [{ readDelay: { minMs: READ_DELAY_ABSOLUTE_MAX_MS + 1 } }, 'sendDelay.readDelay.minMs'],
    [{ readDelay: { minMs: 'x' } }, 'sendDelay.readDelay.minMs'],
    [{ readDelay: { activityBoost: { fastReplyMs: 90_000 } } }, 'sendDelay.readDelay.activityBoost.fastReplyMs'],
    [{ readDelay: { activityBoost: { enabled: 'yes' } } }, 'sendDelay.readDelay.activityBoost.enabled'],
    [{ readDelay: { activityBoost: { fullWindowMs: ACTIVITY_WINDOW_MS_MAX + 1 } } }, 'sendDelay.readDelay.activityBoost.fullWindowMs'],
    [{ readDelay: { activityBoost: { fastWindowMs: 500_000, minWindowMs: 200_000, fullWindowMs: 300_000 } } }, 'sendDelay.readDelay.activityBoost.fastWindowMs'],
    [{ segmentGap: { minMs: 100, maxMs: SEGMENT_GAP_ABSOLUTE_MAX_MS + 1 } }, 'sendDelay.segmentGap.maxMs'],
    [{ enabled: 'true' }, 'sendDelay.enabled'],
  ];
  for (const [config, field] of cases) {
    assert.throws(
      () => validateSendDelayConfig(config),
      (error) => error.code === 'invalid-send-delay' && error.field === field,
      `expected ${field} rejection for ${JSON.stringify(config)}`,
    );
  }
});

test('validateSendDelayConfig accepts a complete valid config and partial updates', () => {
  assert.doesNotThrow(() => validateSendDelayConfig({
    enabled: true,
    readDelay: {
      minMs: 3000, maxMs: 20_000, charsPerSecond: 8, maxTotalMs: 60_000,
      activityBoost: {
        enabled: true, fastReplyMs: 1000, fastWindowMs: 60_000,
        minWindowMs: 120_000, fullWindowMs: 300_000,
      },
    },
    segmentGap: { minMs: 800, maxMs: 3000, charsPerSecond: 20, maxTotalMs: 8000 },
  }));
  // Partial updates merge over stored settings — validate what is present.
  assert.doesNotThrow(() => validateSendDelayConfig({ enabled: true }));
  assert.doesNotThrow(() => validateSendDelayConfig({ readDelay: { minMs: 3000 } }));
  assert.doesNotThrow(() => validateSendDelayConfig({ readDelay: { activityBoost: { fastReplyMs: 1500 } } }));
  assert.ok(ACTIVITY_FAST_REPLY_MS_MAX >= 1000);
});

test('requireCompleteSendDelay enforces whole-object per-bot semantics', () => {
  const complete = {
    enabled: true,
    readDelay: { minMs: 3000, maxMs: 20_000 },
    segmentGap: { minMs: 800, maxMs: 3000 },
  };
  assert.doesNotThrow(() => requireCompleteSendDelay(complete));
  assert.throws(
    () => requireCompleteSendDelay({ enabled: true, readDelay: { minMs: 3000 } }),
    (error) => error.code === 'invalid-send-delay'
      && error.message.includes('segmentGap.minMs'),
  );
  // Invalid values still surface the field-level error first.
  assert.throws(
    () => requireCompleteSendDelay({ ...complete, segmentGap: { minMs: 5000, maxMs: 100 } }),
    (error) => error.field === 'sendDelay.segmentGap.minMs',
  );
});

test('mergeHumanizeSettings replaces per-bot keys whole and falls back otherwise', () => {
  const globalSettings = {
    streaming: false,
    messageBreak: true,
    typingIndicator: 'burst',
    sendDelay: { enabled: true, readDelay: { minMs: 1, maxMs: 2 } },
  };
  const perBot = { sendDelay: { enabled: true, readDelay: { minMs: 30, maxMs: 40 } } };
  const merged = mergeHumanizeSettings(globalSettings, perBot);
  assert.deepEqual(merged.sendDelay, perBot.sendDelay);
  assert.equal(merged.streaming, false);
  assert.equal(merged.typingIndicator, 'burst');
  assert.deepEqual(mergeHumanizeSettings(globalSettings, null), globalSettings);
});

test('visibleLength strips chat markup and counts code points', () => {
  assert.equal(visibleLength(''), 0);
  assert.equal(visibleLength(null), 0);
  assert.equal(visibleLength('看[链接](https://example.com)这里'), 5); // 看 链接 这里
  assert.equal(visibleLength('```\ncode block\n```'), 'code block'.length);
  assert.equal(visibleLength('**加粗** _斜_ ~~删~~ `code`'), '加粗 斜 删 code'.length);
  assert.equal(visibleLength('![alt text](https://example.com/a.png)'), 0);
  assert.equal(visibleLength('  多  个   空白\t\n换行  '), '多 个 空白 换行'.length);
  // Code points, not UTF-16 units: 😀 counts as one character.
  assert.equal(visibleLength('emoji😀ok'), Array.from('emoji😀ok').length);
  assert.equal(visibleLength('emoji😀ok'), 8);
});

// No activity record (idleMs null, the default) keeps these on the pure
// uniform path even with the activity boost enabled by default.
test('computeReadDelayMs uniform term follows the injected random source', () => {
  const readDelay = { minMs: 1000, maxMs: 6000, charsPerSecond: 0, maxTotalMs: 30_000 };
  assert.equal(computeReadDelayMs({ readDelay, random: () => 0 }), 1000);
  assert.equal(computeReadDelayMs({ readDelay, random: () => 1 }), 6000);
  assert.equal(computeReadDelayMs({ readDelay, random: () => 0.5 }), 3500);
});

test('computeReadDelayMs adds the inbound reading term', () => {
  const readDelay = { minMs: 1000, maxMs: 1000, charsPerSecond: 10, maxTotalMs: 30_000 };
  // 20 visible chars at 10 chars/s → +2000ms.
  assert.equal(computeReadDelayMs({ readDelay, userText: 'a'.repeat(20), random: () => 0 }), 3000);
  assert.equal(
    computeReadDelayMs({ readDelay, userTextLength: 20, random: () => 0 }),
    3000,
  );
});

// 5–6s range with the user's sketch curve: ~1s fast reply under a minute,
// ramp to the 5s floor by two minutes, floor until five minutes, full
// random range afterwards.
const CURVE = {
  minMs: 5000,
  maxMs: 6000,
  charsPerSecond: 0,
  maxTotalMs: 60_000,
  activityBoost: {
    enabled: true, fastReplyMs: 1000, fastWindowMs: 60_000,
    minWindowMs: 120_000, fullWindowMs: 300_000,
  },
};

test('computeReadDelayMs shortens the delay while the conversation is active', () => {
  const at = (idleMs, random = () => 0) => computeReadDelayMs({ readDelay: CURVE, idleMs, random });
  assert.equal(at(0), 1000);
  assert.equal(at(30_000), 1000);
  assert.equal(at(60_000), 1000); // fast window boundary
  assert.equal(at(90_000), 3000); // halfway ramp 1000 → 5000
  assert.ok(Math.abs(at(119_999) - 5000) < 1); // ramp ends just below the floor
  assert.equal(at(120_000), 5000); // floor reached
  assert.equal(at(299_999), 5000); // floor until the full window
  assert.equal(at(300_000), 5000); // full range: uniform(5000, 6000) at random()=0
  assert.equal(at(600_000, () => 1), 6000);
  assert.equal(at(-5_000), 1000); // clock skew clamps to 0
});

test('computeReadDelayMs activity boost stays out of the way when disabled or unknown', () => {
  const disabled = { ...CURVE, activityBoost: { ...CURVE.activityBoost, enabled: false } };
  assert.equal(computeReadDelayMs({ readDelay: disabled, idleMs: 0, random: () => 0 }), 5000);
  // No activity record (first message ever): full range, boost or not.
  assert.equal(computeReadDelayMs({ readDelay: CURVE, random: () => 1 }), 6000);
  // A "fast reply" slower than the configured floor is clamped to the floor.
  const clamped = { ...CURVE, activityBoost: { ...CURVE.activityBoost, fastReplyMs: 9000 } };
  assert.equal(computeReadDelayMs({ readDelay: clamped, idleMs: 10_000, random: () => 0 }), 5000);
  // Reading term still stacks on a boosted base, capped by maxTotalMs.
  // (maxTotalMs below maxMs would be repaired up to maxMs by the
  // normalizer, so keep the fixture range inside the cap.)
  const reading = { ...CURVE, minMs: 2000, maxMs: 2000, charsPerSecond: 5, maxTotalMs: 2500 };
  assert.equal(computeReadDelayMs({ readDelay: reading, idleMs: 0, userText: 'a'.repeat(20), random: () => 0 }), 2500);
});

test('activityBaseDelayMs reports null exactly when the uniform range applies', () => {
  assert.equal(activityBaseDelayMs(CURVE, 30_000), 1000);
  assert.equal(activityBaseDelayMs(CURVE, null), null);
  assert.equal(activityBaseDelayMs(CURVE, 300_000), null);
  assert.equal(activityBaseDelayMs({ ...CURVE, activityBoost: { ...CURVE.activityBoost, enabled: false } }, 0), null);
});

test('computeReadDelayMs honors the no-typing channel cap', () => {
  const readDelay = { minMs: 5000, maxMs: 20_000, charsPerSecond: 0, maxTotalMs: 60_000 };
  assert.equal(
    computeReadDelayMs({ readDelay, channelCapMs: SHORT_DELAY_CAP_MS, random: () => 1 }),
    SHORT_DELAY_CAP_MS,
  );
  // The cap only ever shortens: a boosted fast reply stays fast.
  assert.equal(
    computeReadDelayMs({ readDelay: CURVE, idleMs: 0, channelCapMs: SHORT_DELAY_CAP_MS }),
    1000,
  );
});

test('computeSegmentGapMs combines uniform, typing term, cap, and rate floor', () => {
  const segmentGap = { minMs: 500, maxMs: 2000, charsPerSecond: 0, maxTotalMs: 10_000 };
  assert.equal(computeSegmentGapMs({ segmentGap, random: () => 0 }), 500);
  assert.equal(computeSegmentGapMs({ segmentGap, random: () => 1 }), 2000);
  const typing = { minMs: 500, maxMs: 500, charsPerSecond: 20, maxTotalMs: 10_000 };
  assert.equal(computeSegmentGapMs({ segmentGap: typing, segmentText: 'x'.repeat(100), random: () => 0 }), 5500);
  // Platform rate floor wins over the cap.
  assert.equal(
    computeSegmentGapMs({ segmentGap: typing, segmentLength: 100, minSegmentGapMs: 10_000, random: () => 0 }),
    10_000,
  );
});

/**
 * The sleep timers are unref'd (shutdown safety); keep the event loop
 * alive so they still fire inside tests.
 */
function withKeepAlive(run) {
  const keepAlive = setInterval(() => {}, 1_000);
  return run().finally(() => clearInterval(keepAlive));
}

test('abortableSleep resolves after the delay and rejects with the abort reason', async () => {
  await withKeepAlive(async () => {
    await abortableSleep(5);
    const controller = new AbortController();
    const reason = Object.assign(new Error('superseded by a newer message'), { code: 'superseded' });
    const pending = abortableSleep(60_000, controller.signal);
    controller.abort(reason);
    await assert.rejects(pending, (error) => error.code === 'superseded');
    const bare = new AbortController();
    const pendingBare = abortableSleep(60_000, bare.signal);
    bare.abort();
    await assert.rejects(pendingBare, (error) => error.name === 'AbortError');
    await assert.rejects(() => abortableSleep(1, AbortSignal.abort(reason)), (error) => error.code === 'superseded');
  });
});

test('applyReadDelay skips when disabled and sleeps when enabled', async () => {
  await withKeepAlive(async () => {
    const disabled = await applyReadDelay({
      settings: { sendDelay: { enabled: false } },
      userText: 'hello',
    });
    assert.deepEqual(disabled, { skipped: true });

    const enabled = await applyReadDelay({
      settings: {
        sendDelay: {
          enabled: true,
          readDelay: { minMs: 5, maxMs: 5, charsPerSecond: 0, maxTotalMs: 1000 },
        },
      },
      userText: 'hello',
      random: () => 0,
    });
    assert.deepEqual(enabled, { delayedMs: 5 });
  });
});

test('applySegmentGap skips when disabled and applies the rate floor', async () => {
  await withKeepAlive(async () => {
    assert.deepEqual(
      await applySegmentGap({ settings: { sendDelay: { enabled: false } } }),
      { skipped: true },
    );
    const result = await applySegmentGap({
      settings: {
        sendDelay: {
          enabled: true,
          segmentGap: { minMs: 1, maxMs: 1, charsPerSecond: 0, maxTotalMs: 10_000 },
        },
      },
      minSegmentGapMs: 5,
      random: () => 0,
    });
    assert.deepEqual(result, { gapMs: 5 });
  });
});
