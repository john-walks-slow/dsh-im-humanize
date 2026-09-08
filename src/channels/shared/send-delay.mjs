/**
 * Humanized send delay — the "read delay" phase of the two-phase model.
 *
 * Phase ① (read delay): a silent pause BEFORE the harness ask, simulating
 * "the human did not notice the message for a while". No typing indicator,
 * no read receipt. Delay = uniform(min, max) + optional inbound-length
 * reading term, capped at maxTotalMs. The optional activity boost SHORTENS
 * the delay right after a completed turn ("still at the keyboard") and
 * recovers to the full range as the conversation goes idle.
 *
 * Phase ② (compose) is covered by typing-session.mjs; message_break / long
 * reply chunk gaps use `segmentGap` here ("typing the next segment").
 *
 * Browser-safe: no Node APIs (imported by both host bridges and the client
 * UI for validation).
 */

export const READ_DELAY_ABSOLUTE_MAX_MS = 300_000;
export const SEGMENT_GAP_ABSOLUTE_MAX_MS = 30_000;
/** A "fast reply" slower than a minute is not a fast reply. */
export const ACTIVITY_FAST_REPLY_MS_MAX = 60_000;
/** Window ceiling: one day — beyond that the curve is meaningless. */
export const ACTIVITY_WINDOW_MS_MAX = 86_400_000;
/** No-typing channels cap the read delay: nothing explains the silence. */
export const SHORT_DELAY_CAP_MS = 5_000;

/**
 * Activity boost (replaces the retired idleBoost): a quick back-and-forth
 * deserves a quick reply. Recovery curve over the idle time since the last
 * completed turn:
 *   idle <  fastWindowMs -> fastReplyMs  ("just chatting, replies in ~1s")
 *   idle <  minWindowMs  -> linear ramp fastReplyMs -> minMs
 *   idle <  fullWindowMs -> minMs (the configured floor)
 *   idle >= fullWindowMs -> full uniform(minMs, maxMs) range
 * `idleMs == null` (no completed turn on record, e.g. the first message)
 * uses the full range: no activity history, no boost. At runtime the
 * boosted base never exceeds minMs (the boost only ever shortens).
 */
export const DEFAULT_ACTIVITY_BOOST = Object.freeze({
  enabled: true,
  fastReplyMs: 1000,
  fastWindowMs: 60_000,
  minWindowMs: 120_000,
  fullWindowMs: 300_000,
});

export const DEFAULT_READ_DELAY = Object.freeze({
  minMs: 1000,
  maxMs: 6000,
  charsPerSecond: 0,
  maxTotalMs: 30_000,
  activityBoost: DEFAULT_ACTIVITY_BOOST,
});

export const DEFAULT_SEGMENT_GAP = Object.freeze({
  minMs: 500,
  maxMs: 2000,
  charsPerSecond: 0,
  maxTotalMs: 10_000,
});

export const DEFAULT_SEND_DELAY_CONFIG = Object.freeze({
  enabled: false,
  readDelay: DEFAULT_READ_DELAY,
  segmentGap: DEFAULT_SEGMENT_GAP,
});

function finiteNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRange(range, fallback, absoluteMax, defaultTotalMs) {
  const source = range && typeof range === 'object' && !Array.isArray(range) ? range : {};
  let minMs = finiteNumber(source.minMs, fallback.minMs);
  let maxMs = finiteNumber(source.maxMs, fallback.maxMs);
  minMs = clamp(minMs, 0, absoluteMax);
  maxMs = clamp(maxMs, 0, absoluteMax);
  if (minMs > maxMs) [minMs, maxMs] = [maxMs, minMs];
  const charsPerSecond = clamp(
    finiteNumber(source.charsPerSecond, fallback.charsPerSecond),
    0,
    1000,
  );
  let maxTotalMs = clamp(
    finiteNumber(source.maxTotalMs, defaultTotalMs),
    0,
    absoluteMax,
  );
  if (maxTotalMs < maxMs) maxTotalMs = maxMs;
  return { minMs, maxMs, charsPerSecond, maxTotalMs };
}

function normalizeActivityBoost(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const fallback = DEFAULT_READ_DELAY.activityBoost;
  const enabled = source.enabled !== false;
  const fastReplyMs = clamp(
    finiteNumber(source.fastReplyMs, fallback.fastReplyMs),
    0,
    ACTIVITY_FAST_REPLY_MS_MAX,
  );
  // Inverted windows are sorted, not rejected: lenient disk repair.
  const [fastWindowMs, minWindowMs, fullWindowMs] = [
    clamp(finiteNumber(source.fastWindowMs, fallback.fastWindowMs), 0, ACTIVITY_WINDOW_MS_MAX),
    clamp(finiteNumber(source.minWindowMs, fallback.minWindowMs), 0, ACTIVITY_WINDOW_MS_MAX),
    clamp(finiteNumber(source.fullWindowMs, fallback.fullWindowMs), 0, ACTIVITY_WINDOW_MS_MAX),
  ].sort((a, b) => a - b);
  return { enabled, fastReplyMs, fastWindowMs, minWindowMs, fullWindowMs };
}

/**
 * Lenient normalization for values read from disk or merged from partials.
 * Anything malformed falls back to defaults; out-of-range values are
 * clamped; inverted ranges are swapped. Always returns a complete config.
 */
export function normalizeSendDelayConfig(partial) {
  const source = partial && typeof partial === 'object' && !Array.isArray(partial)
    ? partial
    : {};
  const readDelay = normalizeRange(
    source.readDelay,
    DEFAULT_READ_DELAY,
    READ_DELAY_ABSOLUTE_MAX_MS,
    30_000,
  );
  readDelay.activityBoost = normalizeActivityBoost(
    source.readDelay?.activityBoost && typeof source.readDelay.activityBoost === 'object'
      ? source.readDelay.activityBoost
      : DEFAULT_READ_DELAY.activityBoost,
  );
  const segmentGap = normalizeRange(
    source.segmentGap,
    DEFAULT_SEGMENT_GAP,
    SEGMENT_GAP_ABSOLUTE_MAX_MS,
    10_000,
  );
  return {
    enabled: source.enabled === true,
    readDelay,
    segmentGap,
  };
}

function invalid(field, message) {
  const error = new Error(message);
  error.code = 'invalid-send-delay';
  error.field = field;
  return error;
}

/**
 * Strict numeric check. `path` is the full field path used in error
 * messages; the container lookup key is its last segment.
 */
function assertNumber(container, path, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const key = path.split('.').pop();
  const value = container?.[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalid(path, `${path} must be a finite number.`);
  }
  if (value < min || value > max) {
    throw invalid(path, `${path} must be between ${min} and ${max}.`);
  }
}

/**
 * Strict validation for RPC / UI writes. Validates whatever fields are
 * PRESENT (the global store merges partial updates); cross-field rules
 * apply when both sides are present. Throws Error with
 * `code = 'invalid-send-delay'` and a `field` path; does not coerce.
 *
 * Per-bot writes additionally require the core fields to be complete
 * (the per-bot config replaces the global one whole) — see
 * `requireCompleteSendDelay`.
 */
export function validateSendDelayConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw invalid('sendDelay', 'sendDelay must be an object.');
  }
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    throw invalid('sendDelay.enabled', 'enabled must be a boolean.');
  }
  const { readDelay, segmentGap } = config;
  if (readDelay !== undefined) {
    if (!readDelay || typeof readDelay !== 'object' || Array.isArray(readDelay)) {
      throw invalid('sendDelay.readDelay', 'readDelay must be an object.');
    }
    const prefix = 'sendDelay.readDelay';
    if (readDelay.minMs !== undefined) {
      assertNumber(readDelay, `${prefix}.minMs`, { max: READ_DELAY_ABSOLUTE_MAX_MS });
    }
    if (readDelay.maxMs !== undefined) {
      assertNumber(readDelay, `${prefix}.maxMs`, { max: READ_DELAY_ABSOLUTE_MAX_MS });
    }
    if (readDelay.minMs !== undefined && readDelay.maxMs !== undefined
      && readDelay.minMs > readDelay.maxMs) {
      throw invalid(`${prefix}.minMs`, 'readDelay minMs must be ≤ maxMs.');
    }
    if (readDelay.charsPerSecond !== undefined) {
      assertNumber(readDelay, `${prefix}.charsPerSecond`, { max: 1000 });
    }
    if (readDelay.maxTotalMs !== undefined) {
      assertNumber(readDelay, `${prefix}.maxTotalMs`, { max: READ_DELAY_ABSOLUTE_MAX_MS });
    }
    if (readDelay.activityBoost !== undefined) {
      const activity = readDelay.activityBoost;
      if (!activity || typeof activity !== 'object' || Array.isArray(activity)) {
        throw invalid(`${prefix}.activityBoost`, 'activityBoost must be an object.');
      }
      if (activity.enabled !== undefined && typeof activity.enabled !== 'boolean') {
        throw invalid(`${prefix}.activityBoost.enabled`, 'enabled must be a boolean.');
      }
      if (activity.fastReplyMs !== undefined) {
        assertNumber(activity, `${prefix}.activityBoost.fastReplyMs`, { max: ACTIVITY_FAST_REPLY_MS_MAX });
      }
      const windows = [
        ['fastWindowMs', ACTIVITY_WINDOW_MS_MAX],
        ['minWindowMs', ACTIVITY_WINDOW_MS_MAX],
        ['fullWindowMs', ACTIVITY_WINDOW_MS_MAX],
      ];
      for (const [field, max] of windows) {
        if (activity[field] !== undefined) {
          assertNumber(activity, `${prefix}.activityBoost.${field}`, { max });
        }
      }
      // Cross-field ordering applies only when every window is present
      // (the global store merges partial updates).
      if (activity.fastWindowMs !== undefined
        && activity.minWindowMs !== undefined
        && activity.fullWindowMs !== undefined
        && (activity.fastWindowMs > activity.minWindowMs
          || activity.minWindowMs > activity.fullWindowMs)) {
        throw invalid(
          `${prefix}.activityBoost.fastWindowMs`,
          'activityBoost windows must satisfy fastWindowMs <= minWindowMs <= fullWindowMs.',
        );
      }
    }
  }
  if (segmentGap !== undefined) {
    if (!segmentGap || typeof segmentGap !== 'object' || Array.isArray(segmentGap)) {
      throw invalid('sendDelay.segmentGap', 'segmentGap must be an object.');
    }
    const prefix = 'sendDelay.segmentGap';
    if (segmentGap.minMs !== undefined) {
      assertNumber(segmentGap, `${prefix}.minMs`, { max: SEGMENT_GAP_ABSOLUTE_MAX_MS });
    }
    if (segmentGap.maxMs !== undefined) {
      assertNumber(segmentGap, `${prefix}.maxMs`, { max: SEGMENT_GAP_ABSOLUTE_MAX_MS });
    }
    if (segmentGap.minMs !== undefined && segmentGap.maxMs !== undefined
      && segmentGap.minMs > segmentGap.maxMs) {
      throw invalid(`${prefix}.minMs`, 'segmentGap minMs must be ≤ maxMs.');
    }
    if (segmentGap.charsPerSecond !== undefined) {
      assertNumber(segmentGap, `${prefix}.charsPerSecond`, { max: 1000 });
    }
    if (segmentGap.maxTotalMs !== undefined) {
      assertNumber(segmentGap, `${prefix}.maxTotalMs`, { max: SEGMENT_GAP_ABSOLUTE_MAX_MS });
    }
  }
}

/**
 * Per-bot configs replace the global default whole, so their core fields
 * must all be present (optional tuning fields default sensibly).
 * Runs validateSendDelayConfig first.
 */
export function requireCompleteSendDelay(config) {
  validateSendDelayConfig(config);
  const missing = [];
  if (!config || typeof config !== 'object') {
    throw invalid('sendDelay', 'sendDelay must be an object.');
  }
  if (config.enabled === undefined) missing.push('enabled');
  if (config.readDelay?.minMs === undefined) missing.push('readDelay.minMs');
  if (config.readDelay?.maxMs === undefined) missing.push('readDelay.maxMs');
  if (config.segmentGap?.minMs === undefined) missing.push('segmentGap.minMs');
  if (config.segmentGap?.maxMs === undefined) missing.push('segmentGap.maxMs');
  if (missing.length > 0) {
    throw invalid(
      'sendDelay',
      `per-bot sendDelay must be complete; missing: ${missing.join(', ')}.`,
    );
  }
}

/**
 * Merge per-bot humanize settings over the global defaults.
 * Per-bot top-level keys replace global keys whole (no deep merge);
 * missing keys fall back to the global value.
 */
export function mergeHumanizeSettings(globalSettings = {}, perBotSettings = null) {
  const merged = { ...globalSettings };
  if (!perBotSettings || typeof perBotSettings !== 'object') return merged;
  for (const [key, value] of Object.entries(perBotSettings)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

/**
 * Visible length of a text (code-point count after stripping chat markup):
 * markdown links keep only the anchor text, code fences/inline markers lose
 * their syntax, image syntax is dropped, whitespace runs collapse to one.
 * v1 heuristic — good enough to scale a reading term.
 */
export function visibleLength(text) {
  if (typeof text !== 'string' || !text) return 0;
  let out = text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, ''))
    // Images render nothing visible; links render only the anchor text.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~>#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!out) out = '';
  return Array.from(out).length;
}

function uniform(minMs, maxMs, random) {
  if (maxMs <= minMs) return minMs;
  return minMs + random() * (maxMs - minMs);
}

/**
 * Read delay for one turn.
 *
 * baseMs    = activityBoost base when an activity record exists and the
 *             boost is enabled (see DEFAULT_ACTIVITY_BOOST for the curve;
 *             never above readDelay.minMs), else uniform(minMs, maxMs)
 * readingMs = visibleLength(userText) / charsPerSecond * 1000 (0 when disabled)
 * result    = min(baseMs + readingMs, maxTotalMs, channelCapMs?)
 *
 * `idleMs == null` means "no completed turn on record" (e.g. the first
 * message ever): no activity history, full uniform range. `userTextLength`
 * may be precomputed with visibleLength() by the caller.
 */
export function computeReadDelayMs({
  readDelay,
  userText = '',
  userTextLength,
  idleMs = null,
  channelCapMs,
  random = Math.random,
} = {}) {
  const cfg = normalizeSendDelayConfig({ readDelay }).readDelay;
  const length = typeof userTextLength === 'number' && Number.isFinite(userTextLength)
    ? userTextLength
    : visibleLength(userText);
  const baseMs = boostedBaseMs(cfg.activityBoost, cfg.minMs, idleMs)
    ?? uniform(cfg.minMs, cfg.maxMs, random);
  const readingMs = cfg.charsPerSecond > 0
    ? (length / cfg.charsPerSecond) * 1000
    : 0;
  const capped = Math.min(baseMs + readingMs, cfg.maxTotalMs);
  if (typeof channelCapMs === 'number' && Number.isFinite(channelCapMs)) {
    return Math.min(capped, Math.max(0, channelCapMs));
  }
  return capped;
}

/**
 * Activity-boosted base delay, or null when the full uniform range applies
 * (boost disabled, idleMs unknown, or idle already past the full window).
 * The boosted base never exceeds readDelay.minMs: a boost only shortens.
 * Accepts raw or normalized configs (normalization is idempotent).
 */
export function activityBaseDelayMs(readDelay, idleMs) {
  const cfg = normalizeSendDelayConfig({ readDelay }).readDelay;
  return boostedBaseMs(cfg.activityBoost, cfg.minMs, idleMs);
}

/** Curve core on plain values (both inputs already normalized). */
function boostedBaseMs(boost, minMs, idleMs) {
  if (!boost.enabled || idleMs == null) return null;
  const idle = Math.max(0, idleMs);
  if (idle >= boost.fullWindowMs) return null;
  // A fast reply slower than the configured floor is clamped to the floor.
  const fastMs = Math.min(boost.fastReplyMs, minMs);
  if (idle >= boost.minWindowMs) return minMs;
  if (idle <= boost.fastWindowMs) return fastMs;
  const span = Math.max(1, boost.minWindowMs - boost.fastWindowMs);
  const progress = (idle - boost.fastWindowMs) / span;
  return fastMs + (minMs - fastMs) * progress;
}

/**
 * Gap between message_break segments / long-reply chunks ("typing the next
 * segment"). Platform rate-control floors (minSegmentGapMs) win over the
 * cap — platform safety first.
 */
export function computeSegmentGapMs({
  segmentGap,
  segmentText = '',
  segmentLength,
  minSegmentGapMs = 0,
  random = Math.random,
} = {}) {
  const cfg = normalizeSendDelayConfig({ segmentGap }).segmentGap;
  const length = typeof segmentLength === 'number' && Number.isFinite(segmentLength)
    ? segmentLength
    : visibleLength(segmentText);
  const baseMs = uniform(cfg.minMs, cfg.maxMs, random);
  const typingMs = cfg.charsPerSecond > 0
    ? (length / cfg.charsPerSecond) * 1000
    : 0;
  const capped = Math.min(baseMs + typingMs, cfg.maxTotalMs);
  return Math.max(capped, Math.max(0, minSegmentGapMs));
}

/**
 * Abort-aware sleep. Rejects with `signal.reason` when aborted with a
 * reason (the bridge aborts superseded turns with an error carrying
 * `code = 'superseded'`), or with a standard AbortError otherwise.
 * Async so a pre-aborted signal produces a rejected promise, never a
 * synchronous throw.
 */
export async function abortableSleep(ms, signal) {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  }
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    timer.unref?.();
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Phase-① gate + sleep for a normal assistant turn.
 * Returns { delayedMs } after sleeping, or { skipped: true } when the
 * feature is disabled or the computed delay is zero.
 */
export async function applyReadDelay({
  settings,
  userText = '',
  idleMs = null,
  channelCapMs,
  signal,
  random = Math.random,
} = {}) {
  const config = normalizeSendDelayConfig(settings?.sendDelay);
  if (!config.enabled) return { skipped: true };
  const delayMs = computeReadDelayMs({
    readDelay: config.readDelay,
    userText,
    idleMs,
    channelCapMs,
    random,
  });
  if (delayMs <= 0) return { skipped: true };
  await abortableSleep(delayMs, signal);
  return { delayedMs: delayMs };
}

/**
 * Phase-② segment gap ("typing the next segment"). Returns
 * { gapMs } after sleeping, or { skipped: true }.
 */
export async function applySegmentGap({
  settings,
  segmentText = '',
  minSegmentGapMs = 0,
  signal,
  random = Math.random,
} = {}) {
  const config = normalizeSendDelayConfig(settings?.sendDelay);
  if (!config.enabled) return { skipped: true };
  const gapMs = computeSegmentGapMs({
    segmentGap: config.segmentGap,
    segmentText,
    minSegmentGapMs,
    random,
  });
  if (gapMs <= 0) return { skipped: true };
  await abortableSleep(gapMs, signal);
  return { gapMs };
}
