import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeTelegramAllowedUsers } from '../../../plugin-src/host/channels/telegram/production.mjs';

test('Telegram per-bot policy normalizes and validates private-message allowlists', () => {
  assert.deepEqual(normalizeTelegramAllowedUsers(undefined), []);
  assert.deepEqual(
    normalizeTelegramAllowedUsers([6087707998, '1202499116', '6087707998']),
    ['6087707998', '1202499116'],
  );
  assert.throws(
    () => normalizeTelegramAllowedUsers('6087707998'),
    /must be an array/,
  );
  assert.throws(
    () => normalizeTelegramAllowedUsers([0, '-100123', 'username']),
    /invalid Telegram User ID/,
  );
});
