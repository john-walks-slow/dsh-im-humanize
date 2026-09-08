import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SEND_DELAY_CONFIG,
  IDLE_BOOST_MULTIPLIER_MAX,
  READ_DELAY_ABSOLUTE_MAX_MS,
  SEGMENT_GAP_ABSOLUTE_MAX_MS,
  SHORT_DELAY_CAP_MS,
  abortableSleep,
  applyReadDelay,
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

test('normalizeSendDelayConfig clamps idleBoost into range', () => {
  const normalized = normalizeSendDelayConfig({
    readDelay: { idleBoost: { afterMs: -1, multiplier: 99 } },
  });
  assert.equal(normalized.readDelay.idleBoost.afterMs, 0);
  assert.equal(normalized.readDelay.idleBoost.multiplier, IDLE_BOOST_MULTIPLIER_MAX);
  const neutral = normalizeSendDelayConfig({
    readDelay: { idleBoost: { multiplier: 1 } },
  });
  assert.equal(neutral.readDelay.idleBoost.multiplier, 1);
  assert.equal(neutral.readDelay.idleBoost.afterMs, 600_000);
});

test('validateSendDelayConfig rejects malformed values with typed errors', () => {
  const cases = [
    [null, 'sendDelay'],
    [{ readDelay: { minMs: 5000, maxMs: 1000 } }, 'sendDelay.readDelay.minMs'],
    [{ readDelay: { minMs: -1 } }, 'sendDelay.readDelay.minMs'],
    [{ readDelay: { minMs: READ_DELAY_ABSOLUTE_MAX_MS + 1 } }, 'sendDelay.readDelay.minMs'],
    [{ readDelay: { minMs: 'x' } }, 'sendDelay.readDelay.minMs'],
    [{ readDelay: { idleBoost: { multiplier: 0 } } }, 'sendDelay.readDelay.idleBoost.multiplier'],
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
    readDelay: { minMs: 3000, maxMs: 20_000, charsPerSecond: 8, maxTotalMs: 60_000, idleBoost: { afterMs: 300_000, multiplier: 3 } },
    segmentGap: { minMs: 800, maxMs: 3000, charsPerSecond: 20, maxTotalMs: 8000 },
  }));
  // Partial updates merge over stored settings — validate what is present.
  assert.doesNotThrow(() => validateSendDelayConfig({ enabled: true }));
  assert.doesNotThrow(() => validateSendDelayConfig({ readDelay: { minMs: 3000 } }));
  assert.doesNotThrow(() => validateSendDelayConfig({ readDelay: { idleBoost: { multiplier: 1 } } }));
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

test('computeReadDelayMs uniform term follows the injected random source', () => {
  const readDelay = { minMs: 1000, maxMs: 6000, charsPerSecond: 0, maxTotalMs: 30_000, idleBoost: { afterMs: 600_000, multiplier: 2 } };
  assert.equal(computeReadDelayMs({ readDelay, random: () => 0 }), 1000);
  assert.equal(computeReadDelayMs({ readDelay, random: () => 1 }), 6000);
  assert.equal(computeReadDelayMs({ readDelay, random: () => 0.5 }), 3500);
});

test('computeReadDelayMs adds the inbound reading term', () => {
  const readDelay = { minMs: 1000, maxMs: 1000, charsPerSecond: 10, maxTotalMs: 30_000, idleBoost: { afterMs: 600_000, multiplier: 1 } };
  // 20 visible chars at 10 chars/s → +2000ms.
  assert.equal(computeReadDelayMs({ readDelay, userText: 'a'.repeat(20), random: () => 0 }), 3000);
  assert.equal(
    computeReadDelayMs({ readDelay, userTextLength: 20, random: () => 0 }),
    3000,
  );
});

test('computeReadDelayMs applies idle boost above the threshold and caps the total', () => {
  const readDelay = { minMs: 1000, maxMs: 6000, charsPerSecond: 0, maxTotalMs: 30_000, idleBoost: { afterMs: 600_000, multiplier: 2 } };
  assert.equal(computeReadDelayMs({ readDelay, idleMs: 599_999, random: () => 0 }), 1000);
  assert.equal(computeReadDelayMs({ readDelay, idleMs: 600_000, random: () => 0 }), 2000);
  const capped = { minMs: 5000, maxMs: 20_000, charsPerSecond: 0, maxTotalMs: 25_000, idleBoost: { afterMs: 0, multiplier: 3 } };
  assert.equal(computeReadDelayMs({ readDelay: capped, idleMs: 1000, random: () => 1 }), 25_000);
});

test('computeReadDelayMs honors the no-typing channel cap', () => {
  const readDelay = { minMs: 5000, maxMs: 20_000, charsPerSecond: 0, maxTotalMs: 60_000, idleBoost: { afterMs: 600_000, multiplier: 1 } };
  assert.equal(
    computeReadDelayMs({ readDelay, channelCapMs: SHORT_DELAY_CAP_MS, random: () => 1 }),
    SHORT_DELAY_CAP_MS,
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
          readDelay: { minMs: 5, maxMs: 5, charsPerSecond: 0, maxTotalMs: 1000, idleBoost: { afterMs: 600_000, multiplier: 1 } },
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
