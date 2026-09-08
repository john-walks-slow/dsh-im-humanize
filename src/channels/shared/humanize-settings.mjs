/**
 * Humanization settings store for the dsh-im-humanize fork.
 * Persists streaming, messageBreak, onNewMessage, sendDelay,
 * typingIndicator, and typingBurst to a JSON file.
 */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeOnNewMessage } from './new-message-policy.mjs';
import {
  DEFAULT_SEND_DELAY_CONFIG,
  normalizeSendDelayConfig,
  validateSendDelayConfig,
} from './send-delay.mjs';
import {
  DEFAULT_TYPING_BURST,
  DEFAULT_TYPING_INDICATOR,
  TYPING_INDICATOR_MODES,
  normalizeTypingBurst,
  normalizeTypingIndicator,
  validateTypingBurst,
} from './typing-session.mjs';

export const HUMANIZE_RPC_CHANNEL = '/dsh-im-humanize';

export const HUMANIZE_ENDPOINTS = Object.freeze({
  get: 'humanize.get',
  set: 'humanize.set',
});

export const DEFAULT_HUMANIZE_SETTINGS = Object.freeze({
  streaming: true,
  messageBreak: true,
  onNewMessage: 'interrupt',
  sendDelay: DEFAULT_SEND_DELAY_CONFIG,
  typingIndicator: DEFAULT_TYPING_INDICATOR,
  typingBurst: DEFAULT_TYPING_BURST,
});

/**
 * Validate and normalize humanization settings.
 * Returns a clean object with valid values only. Lenient: malformed
 * values fall back to defaults instead of throwing (disk files may be
 * hand-edited; strict rejection happens at the RPC boundary — see
 * validateHumanizeUpdate).
 */
export function normalizeHumanizeSettings(partial = {}) {
  const result = { ...DEFAULT_HUMANIZE_SETTINGS };
  if (typeof partial.streaming === 'boolean') {
    result.streaming = partial.streaming;
  }
  if (typeof partial.messageBreak === 'boolean') {
    result.messageBreak = partial.messageBreak;
  }
  result.onNewMessage = normalizeOnNewMessage(partial.onNewMessage);
  result.sendDelay = normalizeSendDelayConfig(partial.sendDelay);
  result.typingIndicator = normalizeTypingIndicator(partial.typingIndicator);
  result.typingBurst = normalizeTypingBurst(partial.typingBurst);
  return result;
}

/**
 * Strict validation for RPC writes. Accepts partial updates (the store
 * merges them over the committed settings) but rejects — never coerces —
 * malformed values. Throws Error with `code = 'invalid-humanize-settings'`
 * and a `field` path.
 */
export function validateHumanizeUpdate(partial) {
  if (partial === null || typeof partial !== 'object' || Array.isArray(partial)) {
    const error = new Error('humanize.set payload must be an object.');
    error.code = 'invalid-humanize-settings';
    error.field = 'settings';
    throw error;
  }
  if (partial.streaming !== undefined && typeof partial.streaming !== 'boolean') {
    throw invalidField('streaming', 'streaming must be a boolean.');
  }
  if (partial.messageBreak !== undefined && typeof partial.messageBreak !== 'boolean') {
    throw invalidField('messageBreak', 'messageBreak must be a boolean.');
  }
  if (partial.onNewMessage !== undefined
    && !['interrupt', 'queue', 'steer'].includes(partial.onNewMessage)) {
    throw invalidField('onNewMessage', 'onNewMessage must be one of interrupt, queue, steer.');
  }
  if (partial.typingIndicator !== undefined
    && !TYPING_INDICATOR_MODES.includes(partial.typingIndicator)) {
    throw invalidField('typingIndicator', `typingIndicator must be one of ${TYPING_INDICATOR_MODES.join(', ')}.`);
  }
  if (partial.sendDelay !== undefined) {
    validateSendDelayConfig(partial.sendDelay);
  }
  if (partial.typingBurst !== undefined) {
    validateTypingBurst(partial.typingBurst);
  }
  const known = new Set(Object.keys(DEFAULT_HUMANIZE_SETTINGS));
  for (const key of Object.keys(partial)) {
    if (!known.has(key)) {
      throw invalidField(key, `Unknown humanization setting: ${key}.`);
    }
  }
}

function invalidField(field, message) {
  const error = new Error(message);
  error.code = 'invalid-humanize-settings';
  error.field = field;
  return error;
}

/**
 * A file-backed store for humanization settings.
 */
export class HumanizeSettingsStore {
  #path;
  #settings;
  #loaded = false;

  constructor(path) {
    this.#path = path;
    this.#settings = { ...DEFAULT_HUMANIZE_SETTINGS };
  }

  async load() {
    if (this.#loaded) return this.#settings;
    try {
      const raw = await readFile(this.#path, 'utf8');
      const parsed = JSON.parse(raw);
      this.#settings = normalizeHumanizeSettings(parsed);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      // File doesn't exist yet — use defaults
    }
    this.#loaded = true;
    return this.#settings;
  }

  get() {
    return { ...this.#settings };
  }

  async update(partial) {
    const normalized = normalizeHumanizeSettings({ ...this.#settings, ...partial });
    this.#settings = normalized;
    await this.#persist();
    return { ...normalized };
  }

  async #persist() {
    await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
    // Atomic write: a crash mid-write leaves the .tmp file behind and the
    // previously committed settings intact.
    const temporary = `${this.#path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.#settings, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporary, this.#path);
  }
}

/**
 * Create an RPC handler for humanization settings.
 */
export function createHumanizeRpcHandler({ store, logger = null } = {}) {
  if (!store || typeof store.get !== 'function' || typeof store.update !== 'function') {
    throw new TypeError('createHumanizeRpcHandler requires a HumanizeSettingsStore');
  }
  return async (endpoint, payload, signal) => {
    if (signal?.aborted) {
      return { ok: false, error: { code: 'cancelled', message: 'Request cancelled.' } };
    }
    try {
      if (endpoint === HUMANIZE_ENDPOINTS.get) {
        return { ok: true, value: store.get() };
      }
      if (endpoint === HUMANIZE_ENDPOINTS.set) {
        if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
          return { ok: false, error: { code: 'bad-request', message: 'Invalid payload.' } };
        }
        // Reject — never coerce — malformed values at the RPC boundary.
        validateHumanizeUpdate(payload);
        const updated = await store.update(payload);
        logger?.info?.('[dsh-im] humanization settings updated:', updated);
        return { ok: true, value: updated };
      }
      return { ok: false, error: { code: 'bad-request', message: `Unknown endpoint: ${endpoint}` } };
    } catch (error) {
      if (error?.code === 'invalid-humanize-settings'
        || error?.code === 'invalid-send-delay'
        || error?.code === 'invalid-typing-burst') {
        return {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            ...(error.field ? { field: error.field } : {}),
          },
        };
      }
      logger?.error?.('[dsh-im] humanization RPC error:', error);
      return { ok: false, error: { code: 'internal', message: error?.message ?? 'Internal error' } };
    }
  };
}
