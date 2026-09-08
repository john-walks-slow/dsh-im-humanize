/**
 * Humanized send delay — the "read delay" phase of the two-phase model.
 *
 * Phase ① (read delay): a silent pause BEFORE the harness ask, simulating
 * "the human did not notice the message for a while". No typing indicator,
 * no read receipt. Delay = uniform(min, max) + optional inbound-length
 * reading term + optional idle boost, capped at maxTotalMs.
 *
 * Phase ② (compose) is covered by typing-session.mjs; message_break / long
 * reply chunk gaps use `segmentGap` here ("typing the next segment").
 *
 * Browser-safe: no Node APIs (imported by both host bridges and the client
 * UI for validation).
 */

export const READ_DELAY_ABSOLUTE_MAX_MS = 300_000;
export const SEGMENT_GAP_ABSOLUTE_MAX_MS = 30_000;
export const IDLE_BOOST_MULTIPLIER_MIN = 1;
export const IDLE_BOOST_MULTIPLIER_MAX = 10;
/** Idle threshold ceiling: one day — beyond that the boost is meaningless. */
export const IDLE_BOOST_AFTER_MS_MAX = 86_400_000;
/** No-typing channels cap the read delay: nothing explains the silence. */
export const SHORT_DELAY_CAP_MS = 5_000;

export const DEFAULT_READ_DELAY = Object.freeze({
  minMs: 1000,
  maxMs: 6000,
  charsPerSecond: 0,
  maxTotalMs: 30_000,
  idleBoost: Object.freeze({ afterMs: 600_000, multiplier: 2 }),
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

function normalizeIdleBoost(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const afterMs = clamp(
    finiteNumber(source.afterMs, DEFAULT_READ_DELAY.idleBoost.afterMs),
    0,
    IDLE_BOOST_AFTER_MS_MAX,
  );
  let multiplier = finiteNumber(source.multiplier, DEFAULT_READ_DELAY.idleBoost.multiplier);
  multiplier = clamp(multiplier, IDLE_BOOST_MULTIPLIER_MIN, IDLE_BOOST_MULTIPLIER_MAX);
  return { afterMs, multiplier };
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
  readDelay.idleBoost = normalizeIdleBoost(
    source.readDelay?.idleBoost && typeof source.readDelay.idleBoost === 'object'
      ? source.readDelay.idleBoost
      : DEFAULT_READ_DELAY.idleBoost,
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
    if (readDelay.idleBoost !== undefined) {
      if (!readDelay.idleBoost || typeof readDelay.idleBoost !== 'object'
        || Array.isArray(readDelay.idleBoost)) {
        throw invalid(`${prefix}.idleBoost`, 'idleBoost must be an object.');
      }
      if (readDelay.idleBoost.afterMs !== undefined) {
        assertNumber(readDelay.idleBoost, `${prefix}.idleBoost.afterMs`, { max: IDLE_BOOST_AFTER_MS_MAX });
      }
      if (readDelay.idleBoost.multiplier !== undefined) {
        assertNumber(readDelay.idleBoost, `${prefix}.idleBoost.multiplier`, {
          min: IDLE_BOOST_MULTIPLIER_MIN,
          max: IDLE_BOOST_MULTIPLIER_MAX,
        });
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
 * baseMs    = uniform(readDelay.minMs, maxMs)
 * readingMs = visibleLength(userText) / charsPerSecond * 1000 (0 when disabled)
 * idleMult  = idleBoost.multiplier when the conversation has been idle
 *             ≥ idleBoost.afterMs, else 1
 * result    = min((baseMs + readingMs) * idleMult, maxTotalMs, channelCapMs?)
 *
 * `userTextLength` may be precomputed with visibleLength() by the caller
 * (bridges pass the raw inbound text through it when they have it).
 */
export function computeReadDelayMs({
  readDelay,
  userText = '',
  userTextLength,
  idleMs = 0,
  channelCapMs,
  random = Math.random,
} = {}) {
  const cfg = normalizeSendDelayConfig({ readDelay }).readDelay;
  const length = typeof userTextLength === 'number' && Number.isFinite(userTextLength)
    ? userTextLength
    : visibleLength(userText);
  const baseMs = uniform(cfg.minMs, cfg.maxMs, random);
  const readingMs = cfg.charsPerSecond > 0
    ? (length / cfg.charsPerSecond) * 1000
    : 0;
  const idleMult = idleMs >= cfg.idleBoost.afterMs ? cfg.idleBoost.multiplier : 1;
  const capped = Math.min(
    (baseMs + readingMs) * idleMult,
    cfg.maxTotalMs,
  );
  if (typeof channelCapMs === 'number' && Number.isFinite(channelCapMs)) {
    return Math.min(capped, Math.max(0, channelCapMs));
  }
  return capped;
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
  idleMs = 0,
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
