/**
 * Humanization settings store for the dsh-im-humanize fork.
 *
 * The field table itself lives in humanize-schema.mjs; this module owns the
 * file-backed store and the RPC boundary in front of it.
 */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  DEFAULT_HUMANIZE_SETTINGS,
  HUMANIZE_KEYS,
  normalizeHumanizeSettings,
  validateHumanizeUpdate,
} from './humanize-schema.mjs';

export {
  DEFAULT_HUMANIZE_SETTINGS,
  HUMANIZE_KEYS,
  normalizeHumanizeSettings,
  validateHumanizeUpdate,
};

export const HUMANIZE_RPC_CHANNEL = '/dsh-im-humanize';

export const HUMANIZE_ENDPOINTS = Object.freeze({
  get: 'humanize.get',
  set: 'humanize.set',
});

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

  /**
   * Synchronous twin of load() for activation paths that must not defer
   * their caller past the first tick (plugin route mounting). Idempotent
   * with load(): whichever runs first populates the shared snapshot.
   */
  loadSync() {
    if (this.#loaded) return this.#settings;
    try {
      const raw = readFileSync(this.#path, 'utf8');
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
