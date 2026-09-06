import { resolve } from 'node:path';
import { homedir } from 'node:os';
import {
  HUMANIZE_RPC_CHANNEL,
  HUMANIZE_ENDPOINTS,
  HumanizeSettingsStore,
  createHumanizeRpcHandler,
} from '../../src/channels/shared/humanize-settings.mjs';

export { HUMANIZE_RPC_CHANNEL, HUMANIZE_ENDPOINTS };

const ENDPOINTS = new Set(Object.values(HUMANIZE_ENDPOINTS));

export function validHumanizePayload(endpoint, payload) {
  if (!ENDPOINTS.has(endpoint)) return false;
  if (endpoint === HUMANIZE_ENDPOINTS.get) {
    return payload === null || payload === undefined
      || (typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).length === 0);
  }
  if (endpoint === HUMANIZE_ENDPOINTS.set) {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const keys = Object.keys(payload);
    const allowed = new Set(['streaming', 'messageBreak', 'onNewMessage']);
    return keys.every((key) => allowed.has(key));
  }
  return false;
}

export function installHumanizeRpc(ctx, { config = {}, logger = null } = {}) {
  const log = logger ?? (typeof ctx?.logger === 'function'
    ? ctx.logger('dsh-im-humanize')
    : (ctx?.logger ?? console));

  const dshHome = resolve(config.dshHome
    ?? process.env.DSH_HOME
    ?? homedir() + '/.dsh');
  const settingsPath = resolve(config.humanizeSettingsPath
    ?? homedir() + '/.dsh/integrations/dsh-im/humanize.json');

  const store = new HumanizeSettingsStore(settingsPath);
  const handler = createHumanizeRpcHandler({ store, logger: log });

  // Register RPC channel
  if (typeof ctx?.rpc?.register === 'function') {
    ctx.rpc.register(HUMANIZE_RPC_CHANNEL, (endpoint, payload, signal) => {
      if (!validHumanizePayload(endpoint, payload)) {
        return Promise.resolve({
          ok: false,
          error: { code: 'bad-request', message: 'Invalid humanization request.' },
        });
      }
      return handler(endpoint, payload, signal);
    });
  } else if (typeof ctx?.handle === 'function') {
    ctx.handle(HUMANIZE_RPC_CHANNEL, (endpoint, payload, signal) => {
      if (!validHumanizePayload(endpoint, payload)) {
        return Promise.resolve({
          ok: false,
          error: { code: 'bad-request', message: 'Invalid humanization request.' },
        });
      }
      return handler(endpoint, payload, signal);
    });
  }

  // Expose the store so the host can read settings at activation time
  return { store, settingsPath };
}
