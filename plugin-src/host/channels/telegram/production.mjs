import { TelegramConfigStore } from '../../../../src/channels/telegram/config-store.mjs';
import { TelegramHarnessClient } from '../../../../src/channels/telegram/harness-client.mjs';
import { TelegramController } from '../../../../src/channels/telegram/telegram-controller.mjs';
import { TelegramRuntime } from '../../../../src/channels/telegram/telegram-runtime.mjs';
import { TelegramStateStore } from '../../../../src/channels/telegram/state-store.mjs';
import { createTokenProductionController } from '../shared/production.mjs';

const TELEGRAM_USER_ID = /^[1-9]\d{0,15}$/;

export function normalizeTelegramAllowedUsers(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new TypeError('telegram.allowedUsers must be an array of numeric Telegram User IDs');
  }
  const normalized = value.map((entry) => {
    const userId = typeof entry === 'number' && Number.isSafeInteger(entry)
      ? String(entry) : typeof entry === 'string' ? entry.trim() : '';
    if (!TELEGRAM_USER_ID.test(userId)) {
      throw new TypeError('telegram.allowedUsers contains an invalid Telegram User ID');
    }
    return userId;
  });
  return Object.freeze([...new Set(normalized)]);
}

export function createProductionController(ctx, config = {}, internals = {}) {
  return createTokenProductionController(ctx, config, internals, {
    channel: 'telegram',
    ConfigStore: TelegramConfigStore,
    StateStore: TelegramStateStore,
    HarnessClient: TelegramHarnessClient,
    Controller: TelegramController,
    Runtime: TelegramRuntime,
    runtimeOptions: (runtimeConfig) => ({
      allowedPrivateUserIds: normalizeTelegramAllowedUsers(runtimeConfig.allowedUsers),
    }),
  });
}
