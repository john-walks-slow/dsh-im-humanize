import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  DEFAULT_HUMANIZE_SETTINGS,
  HumanizeSettingsStore,
  createHumanizeRpcHandler,
  normalizeHumanizeSettings,
  validateHumanizeUpdate,
} from '../src/channels/shared/humanize-settings.mjs';
import { resolveHumanizeSettings } from '../src/channels/shared/humanize-resolver.mjs';
import { createHumanizeProvider } from '../plugin-src/host/channels/shared/humanize-provider.mjs';
import { DEFAULT_SEND_DELAY_CONFIG } from '../src/channels/shared/send-delay.mjs';
import { DEFAULT_TYPING_BURST, DEFAULT_TYPING_INDICATOR } from '../src/channels/shared/typing-session.mjs';

async function tempDir() {
  return mkdtemp(join(tmpdir(), 'dsh-im-humanize-store-'));
}

test('normalizeHumanizeSettings fills the new defaults and repairs malformed values', () => {
  const normalized = normalizeHumanizeSettings({});
  assert.deepEqual(normalized, {
    streaming: true,
    messageBreak: true,
    onNewMessage: 'interrupt',
    sendDelay: DEFAULT_SEND_DELAY_CONFIG,
    typingIndicator: DEFAULT_TYPING_INDICATOR,
    typingBurst: DEFAULT_TYPING_BURST,
    statusReaction: true,
    replyQuote: true,
  });
  // Legacy typingIndicator booleans map onto the new modes.
  assert.equal(normalizeHumanizeSettings({ typingIndicator: true }).typingIndicator, 'burst');
  assert.equal(normalizeHumanizeSettings({ typingIndicator: false }).typingIndicator, 'off');
  // Malformed values fall back to defaults instead of throwing.
  const repaired = normalizeHumanizeSettings({
    typingIndicator: 'nonsense',
    typingBurst: { onMinMs: 'soon' },
    sendDelay: { readDelay: { minMs: 'x' } },
    statusReaction: 'no',
    replyQuote: null,
  });
  assert.equal(repaired.typingIndicator, DEFAULT_TYPING_INDICATOR);
  assert.deepEqual(repaired.typingBurst, DEFAULT_TYPING_BURST);
  assert.deepEqual(repaired.sendDelay, DEFAULT_SEND_DELAY_CONFIG);
  assert.equal(repaired.statusReaction, true);
  assert.equal(repaired.replyQuote, true);
});

test('validateHumanizeUpdate rejects malformed writes with typed errors', () => {
  const cases = [
    [{ streaming: 'yes' }, 'streaming', 'invalid-humanize-settings'],
    [{ messageBreak: 1 }, 'messageBreak', 'invalid-humanize-settings'],
    [{ statusReaction: 'no' }, 'statusReaction', 'invalid-humanize-settings'],
    [{ replyQuote: 1 }, 'replyQuote', 'invalid-humanize-settings'],
    [{ onNewMessage: 'shout' }, 'onNewMessage', 'invalid-humanize-settings'],
    [{ typingIndicator: 'flicker' }, 'typingIndicator', 'invalid-humanize-settings'],
    [{ typingBurst: { onMinMs: 5000, onMaxMs: 1000, offMinMs: 100, offMaxMs: 200 } }, 'typingBurst.onMinMs', 'invalid-typing-burst'],
    [{ sendDelay: { readDelay: { minMs: -5 } } }, 'sendDelay.readDelay.minMs', 'invalid-send-delay'],
    [{ unknownKey: true }, 'unknownKey', 'invalid-humanize-settings'],
    [null, 'settings', 'invalid-humanize-settings'],
  ];
  for (const [payload, field, code] of cases) {
    assert.throws(
      () => validateHumanizeUpdate(payload),
      (error) => error.code === code && error.field === field,
      `expected ${field} rejection`,
    );
  }
  // Partial updates are fine; unknown keys are not.
  assert.doesNotThrow(() => validateHumanizeUpdate({}));
  assert.doesNotThrow(() => validateHumanizeUpdate({ sendDelay: { enabled: true } }));
  assert.doesNotThrow(() => validateHumanizeUpdate({ statusReaction: false, replyQuote: false }));
  assert.doesNotThrow(() => validateHumanizeUpdate({
    sendDelay: { readDelay: { minMs: 9000 } }, // swapped into range on merge
    typingBurst: { onMinMs: 1000, onMaxMs: 2000, offMinMs: 500, offMaxMs: 900 },
  }));
});

test('HumanizeSettingsStore persists atomically with restrictive permissions', async () => {
  const dir = await tempDir();
  try {
    const path = join(dir, 'humanize.json');
    const store = new HumanizeSettingsStore(path);
    await store.load();
    await store.update({ sendDelay: { enabled: true }, typingIndicator: 'continuous' });

    const persisted = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(persisted.sendDelay.enabled, true);
    assert.equal(persisted.typingIndicator, 'continuous');
    const { mode } = await stat(path);
    assert.equal(mode & 0o077, 0, 'settings file is private to the owner');

    // A reload picks up the persisted values.
    const reloaded = new HumanizeSettingsStore(path);
    await reloaded.load();
    assert.equal(reloaded.get().sendDelay.enabled, true);
    assert.equal(reloaded.get().typingIndicator, 'continuous');
    // No crash leftovers from the atomic write.
    await assert.rejects(() => readFile(`${path}.tmp`, 'utf8'), /ENOENT/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('humanize RPC set rejects malformed payloads and merges partial updates', async () => {
  const dir = await tempDir();
  try {
    const store = new HumanizeSettingsStore(join(dir, 'humanize.json'));
    await store.load();
    const handler = createHumanizeRpcHandler({ store });

    const rejected = await handler('humanize.set', { sendDelay: { segmentGap: { maxMs: -1 } } });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, 'invalid-send-delay');
    assert.equal(rejected.error.field, 'sendDelay.segmentGap.maxMs');
    assert.equal(store.get().sendDelay.enabled, false, 'rejected writes do not mutate');

    const updated = await handler('humanize.set', { typingIndicator: 'off' });
    assert.equal(updated.ok, true);
    assert.equal(updated.value.typingIndicator, 'off');
    assert.equal(updated.value.streaming, true, 'untouched keys keep their values');
    assert.equal(store.get().typingIndicator, 'off');

    const toggled = await handler('humanize.set', { statusReaction: false, replyQuote: false });
    assert.equal(toggled.ok, true);
    assert.equal(toggled.value.statusReaction, false);
    assert.equal(toggled.value.replyQuote, false);
    assert.equal(toggled.value.typingIndicator, 'off', 'earlier partial updates persist');
    assert.equal(store.get().statusReaction, false);
    assert.equal(store.get().replyQuote, false);

    const got = await handler('humanize.get', {});
    assert.equal(got.ok, true);
    assert.equal(got.value.typingIndicator, 'off');
    assert.equal(got.value.statusReaction, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolveHumanizeSettings prefers the live provider and normalizes its output', () => {
  const resolved = resolveHumanizeSettings({ humanize: null, streaming: false, messageBreak: true });
  assert.deepEqual(resolved, {
    streaming: false,
    messageBreak: true,
    onNewMessage: 'interrupt',
    sendDelay: DEFAULT_SEND_DELAY_CONFIG,
    typingIndicator: DEFAULT_TYPING_INDICATOR,
    typingBurst: DEFAULT_TYPING_BURST,
    statusReaction: true,
    replyQuote: true,
  });

  const live = resolveHumanizeSettings({
    humanize: { getSettings: () => ({ typingIndicator: 'continuous', statusReaction: false }) },
    streaming: true,
  });
  assert.equal(live.typingIndicator, 'continuous');
  assert.equal(live.streaming, true, 'missing provider keys fall back to the snapshot');
  assert.equal(live.statusReaction, false, 'provider output wins when present');
  assert.equal(live.replyQuote, true, 'absent provider keys default to true');
  // Provider output is normalized defensively.
  assert.deepEqual(live.sendDelay, DEFAULT_SEND_DELAY_CONFIG);
  assert.deepEqual(live.typingBurst, DEFAULT_TYPING_BURST);
});

test('createHumanizeProvider merges live defaults with the per-bot section', async () => {
  const dir = await tempDir();
  try {
    const path = join(dir, 'workspaces.json');
    const workspaces = {
      humanizeFor: (botId) => workspacesContents[botId] ?? null,
    };
    const workspacesContents = {
      bot_b: { streaming: false, sendDelay: { enabled: true }, statusReaction: false },
    };

    let mutableDefaults = { streaming: true, typingIndicator: 'continuous' };
    const provider = createHumanizeProvider({
      defaults: () => mutableDefaults,
      workspaces,
      botId: 'bot_b',
    });

    const withOverride = provider.getSettings();
    assert.equal(withOverride.streaming, false, 'per-bot replaces top-level keys');
    assert.equal(withOverride.typingIndicator, 'continuous', 'unspecified keys inherit defaults');
    assert.equal(withOverride.sendDelay.enabled, true, 'per-bot sendDelay applies');
    assert.equal(withOverride.statusReaction, false, 'per-bot statusReaction replaces the default');
    assert.equal(withOverride.replyQuote, true, 'per-bot replyQuote absent inherits true');

    // The defaults accessor is live: a change flows through on the next read.
    mutableDefaults = { streaming: true, typingIndicator: 'burst' };
    assert.equal(provider.getSettings().typingIndicator, 'burst');

    // Bots without a section use the defaults whole.
    const plain = createHumanizeProvider({
      defaults: () => mutableDefaults,
      workspaces,
      botId: 'bot_a',
    });
    assert.equal(plain.getSettings().streaming, true);
    assert.equal(plain.getSettings().typingIndicator, 'burst');
    assert.equal(plain.getSettings().sendDelay.enabled, false);

    // Hand-edited per-bot sections are repaired, never trusted raw. The
    // section replaces the global sendDelay whole, so a partial hand edit
    // degrades to the disabled default — the UI always submits complete
    // objects (requireCompleteSendDelay).
    workspacesContents.bot_b = { sendDelay: { readDelay: { minMs: 'oops' } } };
    const repaired = provider.getSettings();
    assert.equal(repaired.sendDelay.enabled, false);
    assert.equal(repaired.sendDelay.readDelay.minMs, 1000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
