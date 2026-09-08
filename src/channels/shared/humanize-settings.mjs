/**
 * Humanization settings store for the dsh-im-humanize fork.
 * Persists streaming, messageBreak, and onNewMessage to a JSON file.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeOnNewMessage } from './new-message-policy.mjs';

export const HUMANIZE_RPC_CHANNEL = '/dsh-im-humanize';

export const HUMANIZE_ENDPOINTS = Object.freeze({
  get: 'humanize.get',
  set: 'humanize.set',
});

export const DEFAULT_HUMANIZE_SETTINGS = Object.freeze({
  streaming: true,
  messageBreak: true,
  onNewMessage: 'interrupt',
});

/**
 * Validate and normalize humanization settings.
 * Returns a clean object with valid values only.
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
  return result;
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
    await mkdir(dirname(this.#path), { recursive: true });
    await writeFile(this.#path, JSON.stringify(this.#settings, null, 2), 'utf8');
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
        const updated = await store.update(payload);
        logger?.info?.('[dsh-im] humanization settings updated:', updated);
        return { ok: true, value: updated };
      }
      return { ok: false, error: { code: 'bad-request', message: `Unknown endpoint: ${endpoint}` } };
    } catch (error) {
      logger?.error?.('[dsh-im] humanization RPC error:', error);
      return { ok: false, error: { code: 'internal', message: error?.message ?? 'Internal error' } };
    }
  };
}
