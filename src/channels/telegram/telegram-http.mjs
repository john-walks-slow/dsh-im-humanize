import {
  EnvHttpProxyAgent,
  FormData as UndiciFormData,
  fetch as undiciFetch,
} from 'undici';

const TELEGRAM_CONNECTIONS = 4;
const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 10_000;
const DEFAULT_KEEP_ALIVE_MAX_TIMEOUT_MS = 60_000;
const DEFAULT_KEEP_ALIVE_TIMEOUT_THRESHOLD_MS = 1_000;
const DEFAULT_HEADERS_TIMEOUT_MS = 60_000;
const DEFAULT_BODY_TIMEOUT_MS = 120_000;

export function createTelegramHttpTransport() {
  const dispatcher = new EnvHttpProxyAgent({
    connections: TELEGRAM_CONNECTIONS,
    keepAliveTimeout: DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
    keepAliveMaxTimeout: DEFAULT_KEEP_ALIVE_MAX_TIMEOUT_MS,
    keepAliveTimeoutThreshold: DEFAULT_KEEP_ALIVE_TIMEOUT_THRESHOLD_MS,
    headersTimeout: DEFAULT_HEADERS_TIMEOUT_MS,
    bodyTimeout: DEFAULT_BODY_TIMEOUT_MS,
  });
  let destroyed = false;
  return {
    fetchImpl: (url, options = {}) => undiciFetch(url, { ...options, dispatcher }),
    FormDataImpl: UndiciFormData,
    async destroy() {
      if (destroyed) return;
      destroyed = true;
      await dispatcher.destroy();
    },
  };
}
