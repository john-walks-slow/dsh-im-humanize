import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import {
  HUMANIZE_RPC_CHANNEL,
  HUMANIZE_ENDPOINTS,
  HumanizeSettingsStore,
  createHumanizeRpcHandler,
  validateHumanizeUpdate,
} from '../../src/channels/shared/humanize-settings.mjs';
import { resolveRpcAuthority } from './rpc-authority.mjs';

export { HUMANIZE_RPC_CHANNEL, HUMANIZE_ENDPOINTS };

const ENDPOINTS = new Set(Object.values(HUMANIZE_ENDPOINTS));

// Keys the client may send on humanize.set. Field-level validation
// happens in validateHumanizeUpdate; this only gates the top-level shape.
const SETTABLE_KEYS = new Set([
  'streaming',
  'messageBreak',
  'onNewMessage',
  'sendDelay',
  'typingIndicator',
  'typingBurst',
  'statusReaction',
  'replyQuote',
]);

export function validHumanizePayload(endpoint, payload) {
  if (!ENDPOINTS.has(endpoint)) return false;
  if (endpoint === HUMANIZE_ENDPOINTS.get) {
    return payload === null || payload === undefined
      || (typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).length === 0);
  }
  if (endpoint === HUMANIZE_ENDPOINTS.set) {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const keys = Object.keys(payload);
    return keys.every((key) => SETTABLE_KEYS.has(key));
  }
  return false;
}

export function installHumanizeRpc(ctx, { config = {}, logger = null, authority } = {}) {
  const log = logger ?? (typeof ctx?.logger === 'function'
    ? ctx.logger('dsh-im-humanize')
    : (ctx?.logger ?? console));

  const dshHome = resolve(config.dshHome
    ?? process.env.DSH_HOME
    ?? homedir() + '/.dsh');
  const settingsPath = resolve(config.humanizeSettingsPath
    ?? join(dshHome, 'integrations', 'dsh-im', 'humanize.json'));

  const store = new HumanizeSettingsStore(settingsPath);
  const handler = createHumanizeRpcHandler({ store, logger: log });

  // Register RPC channel on the Host connection (matches the channel RPC
  // modules: authority follows config.rpcAuthority, 'loopback' by default,
  // 'trusted-host' when the deployment serves a trusted remote hostname).
  // If the connection RPC surface is unavailable (e.g. headless fixtures,
  // reduced host contexts), degrade gracefully: skip registration, keep the
  // file-backed store working for config merge at activation time.
  if (ctx?.connection?.rpc && typeof ctx.connection.rpc.handle === 'function') {
    ctx.connection.rpc.handle(
      HUMANIZE_RPC_CHANNEL,
      (endpoint, payload, signal) => {
        if (!validHumanizePayload(endpoint, payload)) {
          return Promise.resolve({
            ok: false,
            error: { code: 'bad-request', message: 'Invalid humanization request.' },
          });
        }
        return handler(endpoint, payload, signal);
      },
      { authority: resolveRpcAuthority(authority ?? config.rpcAuthority) },
    );
  } else {
    log.warn?.('[dsh-im] Host Connection RPC unavailable; humanization panel disabled');
  }

  // Expose the store so the host can read settings at activation time
  return { store, settingsPath };
}
