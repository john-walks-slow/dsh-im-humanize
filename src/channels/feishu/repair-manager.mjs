import { RegistrationManager } from './registration-manager.mjs';

export const CARD_ACTION_CALLBACK = 'card.action.trigger';
export const CALLBACK_REPAIR_OPERATION = 'callback_repair';

function accountsDomain(domain) {
  return domain === 'lark' ? 'accounts.larksuite.com' : 'accounts.feishu.cn';
}

function launcherDomain(domain) {
  return domain === 'lark' ? 'open.larksuite.com' : 'open.feishu.cn';
}

/**
 * The SDK owns the rest of the verification URL. The repair flow accepts only
 * its target account host and singleton SDK/app/addon parameters, and it can
 * never fall back to the create-only flow. This catches regressions such as a
 * literal `{{client_id}}` before the broken URL reaches the browser.
 */
export function assertCallbackRepairUrl(value, expectedAppId, domain = 'feishu') {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Feishu callback repair returned an invalid verification URL');
  }
  const supportedDomain = domain === 'feishu' || domain === 'lark';
  const clientIds = url.searchParams.getAll('clientID');
  const transportProviders = url.searchParams.getAll('tp');
  const addons = url.searchParams.getAll('addons');
  const hasPlaceholder = String(expectedAppId).includes('{{')
    || String(expectedAppId).includes('}}')
    || [...url.searchParams.values()].some((item) => (
      item.includes('{{') || item.includes('}}')
    ));
  if (!supportedDomain
    || url.protocol !== 'https:'
    // registerApp begins on accounts.* but the SDK deliberately returns the
    // user-facing /page/launcher URL on open.*.
    || url.hostname !== launcherDomain(domain)
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
    || transportProviders.length !== 1
    || transportProviders[0] !== 'sdk'
    || clientIds.length !== 1
    || clientIds[0] !== expectedAppId
    || url.searchParams.has('createOnly')
    || addons.length !== 1
    || !addons[0]?.trim()
    || hasPlaceholder) {
    throw new Error('Feishu callback repair returned an unsafe verification URL');
  }
  return url.toString();
}

/**
 * One targeted update attempt for an existing Feishu app.  It intentionally
 * shares RegistrationManager's polling/state implementation while fixing the
 * update manifest in one place so callers cannot accidentally add scopes,
 * events, presets, or createOnly.
 */
export class CallbackRepairManager {
  #manager;
  #appId;
  #domain;

  constructor({ registerApp, onCredentials, appId, domain = 'feishu' } = {}) {
    if (typeof registerApp !== 'function') throw new TypeError('registerApp is required');
    if (typeof onCredentials !== 'function') throw new TypeError('onCredentials is required');
    if (typeof appId !== 'string' || !appId.trim()) throw new TypeError('appId is required');
    if (domain !== 'feishu' && domain !== 'lark') throw new TypeError('domain is invalid');

    this.#appId = appId.trim();
    this.#domain = domain;
    this.#manager = new RegistrationManager({
      registerApp: (options) => registerApp({
        ...options,
        onQRCodeReady: (info) => {
          assertCallbackRepairUrl(info?.url, this.#appId, this.#domain);
          options.onQRCodeReady(info);
        },
      }),
      onCredentials,
    });
  }

  start() {
    return this.#manager.start({
      source: 'deepseek-harness-card-action-repair',
      domain: accountsDomain(this.#domain),
      appId: this.#appId,
      addons: {
        preset: false,
        callbacks: { items: [CARD_ACTION_CALLBACK] },
      },
    });
  }

  status() {
    return this.#manager.status();
  }

  cancel() {
    return this.#manager.cancel();
  }
}

export default CallbackRepairManager;
