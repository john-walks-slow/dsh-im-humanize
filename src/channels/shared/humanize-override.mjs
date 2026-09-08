/**
 * Per-bot humanization override section (workspaces.json `humanize`).
 *
 * A per-bot section REPLACES top-level settings keys whole: keys present in
 * the section override the resolved global defaults; keys absent inherit
 * them. Because the section replaces (not deep-merges), a per-bot
 * `sendDelay` must be COMPLETE when written through the RPC/UI — disable
 * sub-items with neutral values (multiplier: 1, charsPerSecond: 0) rather
 * than omitting keys.
 *
 * Browser-safe module: imported by the workspace store, the host RPC
 * layer, and the client bundle.
 */
import {
  normalizeSendDelayConfig,
  requireCompleteSendDelay,
} from './send-delay.mjs';
import {
  normalizeTypingBurst,
  validateTypingBurst,
} from './typing-session.mjs';

const ON_NEW_MESSAGE_VALUES = ['interrupt', 'queue', 'steer'];
const TYPING_INDICATOR_VALUES = ['off', 'continuous', 'burst'];

/** Shared RPC endpoint: set a bot's humanization override section. */
export const SET_HUMANIZE_ENDPOINT = 'bot.humanize.set';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Lenient normalization for a section read from disk (hand-edited files
 * are repaired, never trusted): keeps only valid present keys, dropping
 * malformed ones. Returns null for sections with no valid keys.
 */
export function normalizeHumanizeOverride(value) {
  if (!isPlainObject(value)) return null;
  const out = {};
  if (typeof value.streaming === 'boolean') out.streaming = value.streaming;
  if (typeof value.messageBreak === 'boolean') out.messageBreak = value.messageBreak;
  if (ON_NEW_MESSAGE_VALUES.includes(value.onNewMessage)) out.onNewMessage = value.onNewMessage;
  if (TYPING_INDICATOR_VALUES.includes(value.typingIndicator)) {
    out.typingIndicator = value.typingIndicator;
  }
  if (isPlainObject(value.typingBurst)) out.typingBurst = normalizeTypingBurst(value.typingBurst);
  if (isPlainObject(value.sendDelay)) out.sendDelay = normalizeSendDelayConfig(value.sendDelay);
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Merge unset sendDelay subfields from the resolved GLOBAL config so a
 * per-bot override written with only the base fields (enabled + min/max)
 * keeps the global reading speed / cap / idle boost instead of silently
 * snapping them back to factory defaults. Explicit keys always win.
 */
function inheritSendDelayBase(config, base) {
  if (!isPlainObject(base)) return config;
  return {
    ...config,
    readDelay: { ...base.readDelay, ...config.readDelay },
    segmentGap: { ...base.segmentGap, ...config.segmentGap },
    ...(isPlainObject(base.idleBoost) || isPlainObject(config.idleBoost)
      ? { idleBoost: { ...base.idleBoost, ...config.idleBoost } }
      : {}),
  };
}

/**
 * Strict validation for RPC / UI writes. `null` clears the override (the
 * bot reverts to the resolved global defaults); otherwise every present
 * key must be valid and `sendDelay` must be complete. `options`
 * .sendDelayBase is the resolved global sendDelay used to inherit unset
 * subfields (plan §5.2). Throws Error with `code =
 * 'invalid-humanize-override'` and a `field` path; returns the normalized
 * section.
 */
export function validateHumanizeOverrideSection(value, { sendDelayBase = null } = {}) {
  if (value === null) return null;
  if (!isPlainObject(value)) {
    throw invalid('humanize', 'humanize section must be an object or null.');
  }
  const out = {};
  if (value.streaming !== undefined) {
    if (typeof value.streaming !== 'boolean') {
      throw invalid('humanize.streaming', 'streaming must be a boolean.');
    }
    out.streaming = value.streaming;
  }
  if (value.messageBreak !== undefined) {
    if (typeof value.messageBreak !== 'boolean') {
      throw invalid('humanize.messageBreak', 'messageBreak must be a boolean.');
    }
    out.messageBreak = value.messageBreak;
  }
  if (value.onNewMessage !== undefined) {
    if (!ON_NEW_MESSAGE_VALUES.includes(value.onNewMessage)) {
      throw invalid('humanize.onNewMessage', 'onNewMessage must be one of interrupt, queue, steer.');
    }
    out.onNewMessage = value.onNewMessage;
  }
  if (value.typingIndicator !== undefined) {
    if (!TYPING_INDICATOR_VALUES.includes(value.typingIndicator)) {
      throw invalid('humanize.typingIndicator', 'typingIndicator must be one of off, continuous, burst.');
    }
    out.typingIndicator = value.typingIndicator;
  }
  if (value.typingBurst !== undefined) {
    validateTypingBurst(value.typingBurst);
    out.typingBurst = normalizeTypingBurst(value.typingBurst);
  }
  if (value.sendDelay !== undefined) {
    // The per-bot sendDelay replaces the global one whole, so it must be
    // complete (the UI prefills all fields; unset advanced subfields
    // inherit the current global values at write time).
    requireCompleteSendDelay(value.sendDelay);
    out.sendDelay = normalizeSendDelayConfig(
      inheritSendDelayBase(value.sendDelay, sendDelayBase));
  }
  for (const key of Object.keys(value)) {
    if (!['streaming', 'messageBreak', 'onNewMessage', 'typingIndicator', 'typingBurst', 'sendDelay'].includes(key)) {
      throw invalid(`humanize.${key}`, `Unknown humanization key: ${key}.`);
    }
  }
  if (Object.keys(out).length === 0) {
    throw invalid('humanize', 'humanize section must set at least one key (or be null to clear).');
  }
  return out;
}

function invalid(field, message) {
  const error = new Error(message);
  error.code = 'invalid-humanize-override';
  error.field = field;
  return error;
}
