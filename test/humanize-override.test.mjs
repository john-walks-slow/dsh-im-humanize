import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  BotWorkspaceStore,
  createWorkspaceAwareController,
} from '../src/channels/shared/bot-workspace-store.mjs';
import {
  SET_HUMANIZE_ENDPOINT,
  normalizeHumanizeOverride,
  validateHumanizeOverrideSection,
} from '../src/channels/shared/humanize-override.mjs';
import { DEFAULT_SEND_DELAY_CONFIG } from '../src/channels/shared/send-delay.mjs';
import { DEFAULT_TYPING_BURST } from '../src/channels/shared/typing-session.mjs';
import { createWecomRpcHandler, WECOM_ENDPOINTS } from '../plugin-src/host/channels/wecom/rpc.mjs';
import { createWeixinRpcHandler, WEIXIN_ENDPOINTS } from '../plugin-src/host/channels/weixin/rpc.mjs';
import { createFeishuRpcHandler, FEISHU_ENDPOINTS } from '../plugin-src/host/channels/feishu/rpc.mjs';
import { createDingtalkRpcHandler, DINGTALK_ENDPOINTS } from '../plugin-src/host/channels/dingtalk/rpc.mjs';
import { createQqRpcHandler, QQ_ENDPOINTS } from '../plugin-src/host/channels/qq/rpc.mjs';
import { createSlackRpcHandler, SLACK_ENDPOINTS } from '../plugin-src/host/channels/slack/rpc.mjs';
import { createTelegramRpcHandler, TELEGRAM_ENDPOINTS } from '../plugin-src/host/channels/telegram/rpc.mjs';
import { createDiscordRpcHandler, DISCORD_ENDPOINTS } from '../plugin-src/host/channels/discord/rpc.mjs';
import { createWhatsappRpcHandler, WHATSAPP_ENDPOINTS } from '../plugin-src/host/channels/whatsapp/rpc.mjs';

const CHANNELS = [
  ['wecom', createWecomRpcHandler, WECOM_ENDPOINTS],
  ['weixin', createWeixinRpcHandler, WEIXIN_ENDPOINTS],
  ['feishu', createFeishuRpcHandler, FEISHU_ENDPOINTS],
  ['dingtalk', createDingtalkRpcHandler, DINGTALK_ENDPOINTS],
  ['qq', createQqRpcHandler, QQ_ENDPOINTS],
  ['slack', createSlackRpcHandler, SLACK_ENDPOINTS],
  ['telegram', createTelegramRpcHandler, TELEGRAM_ENDPOINTS],
  ['discord', createDiscordRpcHandler, DISCORD_ENDPOINTS],
  ['whatsapp', createWhatsappRpcHandler, WHATSAPP_ENDPOINTS],
];

const completeSendDelay = {
  enabled: true,
  readDelay: { minMs: 2000, maxMs: 8000, charsPerSecond: 12, maxTotalMs: 30_000 },
  segmentGap: { minMs: 600, maxMs: 2500, charsPerSecond: 0, maxTotalMs: 10_000 },
};

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-im-humanize-override-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'workspaces.json');
  const store = await new BotWorkspaceStore(path, { defaultWorkspace: directory }).load();
  return { directory, path, store };
}

function fakeController(botIds) {
  const unavailable = () => { throw new Error('unrelated lifecycle action must not run'); };
  return {
    status: () => ({ bots: botIds.map((botId) => ({ botId, configured: true, connected: false })) }),
    startProvisioning: unavailable,
    registrationStatus: unavailable,
    submitVerification: unavailable,
    cancelProvisioning: unavailable,
    bindCredentials: unavailable,
    reconnectBot: unavailable,
    deleteBot: unavailable,
    startRegistration: unavailable,
    cancelRegistration: unavailable,
    disconnect: unavailable,
    setAccessPolicy: unavailable,
    approveSender: unavailable,
    revokeSender: unavailable,
  };
}

function awareController(store, core) {
  return createWorkspaceAwareController(core, {
    workspaces: store,
    stateFor: () => { throw new Error('saving humanize must not load or clear session state'); },
  });
}

test('normalizeHumanizeOverride repairs hand-edited sections and drops garbage', () => {
  assert.equal(normalizeHumanizeOverride(null), null);
  assert.equal(normalizeHumanizeOverride('fast'), null);
  // Only valid present keys survive; invalid ones are dropped, not trusted.
  // The valid typingBurst passes through unchanged.
  assert.deepEqual(
    normalizeHumanizeOverride({
      streaming: 'yes',
      messageBreak: false,
      statusReaction: 'no',
      replyQuote: false,
      onNewMessage: 'queue',
      typingIndicator: 'flicker',
      typingBurst: { onMinMs: 1000, onMaxMs: 2000, offMinMs: 500, offMaxMs: 900 },
      sendDelay: { readDelay: { minMs: 'x' } },
    }),
    {
      messageBreak: false,
      replyQuote: false,
      onNewMessage: 'queue',
      typingBurst: { onMinMs: 1000, onMaxMs: 2000, offMinMs: 500, offMaxMs: 900 },
      sendDelay: DEFAULT_SEND_DELAY_CONFIG,
    },
  );
  assert.equal(normalizeHumanizeOverride({ streaming: 'yes' }), null);
});

test('validateHumanizeOverrideSection accepts partial sections and enforces sendDelay completeness', () => {
  assert.equal(validateHumanizeOverrideSection(null), null);
  assert.deepEqual(validateHumanizeOverrideSection({ streaming: false }), { streaming: false });
  assert.deepEqual(
    validateHumanizeOverrideSection({ statusReaction: false, replyQuote: true }),
    { statusReaction: false, replyQuote: true },
  );
  assert.deepEqual(
    validateHumanizeOverrideSection({ typingIndicator: 'burst', sendDelay: completeSendDelay }),
    {
      typingIndicator: 'burst',
      sendDelay: {
        ...completeSendDelay,
        readDelay: { ...completeSendDelay.readDelay, activityBoost: DEFAULT_SEND_DELAY_CONFIG.readDelay.activityBoost },
      },
    },
  );
  // Per-bot sendDelay replaces the global one whole: partial is rejected.
  assert.throws(
    () => validateHumanizeOverrideSection({ sendDelay: { enabled: true, readDelay: { minMs: 1000 } } }),
    (error) => error.code === 'invalid-humanize-override' || error.code === 'invalid-send-delay',
  );
  const cases = [
    [{ streaming: 'no' }, 'humanize.streaming'],
    [{ statusReaction: 'no' }, 'humanize.statusReaction'],
    [{ replyQuote: 1 }, 'humanize.replyQuote'],
    [{ onNewMessage: 'shout' }, 'humanize.onNewMessage'],
    [{ typingIndicator: 'flicker' }, 'humanize.typingIndicator'],
    [{ unknown: 1 }, 'humanize.unknown'],
    [{}, 'humanize'],
    ['fast', 'humanize'],
  ];
  for (const [value, field] of cases) {
    assert.throws(
      () => validateHumanizeOverrideSection(value),
      (error) => error.code === 'invalid-humanize-override' && error.field === field,
      `expected ${field} rejection`,
    );
  }
});

test('validateHumanizeOverrideSection inherits unset sendDelay subfields from the global base', () => {
  const base = {
    enabled: true,
    readDelay: {
      minMs: 30000,
      maxMs: 60000,
      charsPerSecond: 8,
      maxTotalMs: 120000,
      activityBoost: { enabled: true, fastReplyMs: 2000, fastWindowMs: 90000, minWindowMs: 180000, fullWindowMs: 600000 },
    },
    segmentGap: {
      minMs: 2000,
      maxMs: 6000,
      charsPerSecond: 10,
      maxTotalMs: 30000,
    },
  };
  const section = validateHumanizeOverrideSection(
    {
      sendDelay: {
        enabled: true,
        readDelay: { minMs: 2000, maxMs: 7000 },
        segmentGap: { minMs: 500, maxMs: 1500 },
      },
    },
    { sendDelayBase: base },
  );
  // Explicit base fields win; unset advanced subfields inherit the GLOBAL
  // values instead of snapping back to factory defaults (plan §5.2).
  assert.equal(section.sendDelay.readDelay.minMs, 2000);
  assert.equal(section.sendDelay.readDelay.maxMs, 7000);
  assert.equal(section.sendDelay.readDelay.charsPerSecond, 8);
  assert.equal(section.sendDelay.readDelay.maxTotalMs, 120000);
  assert.equal(section.sendDelay.readDelay.activityBoost.fastReplyMs, 2000);
  assert.equal(section.sendDelay.readDelay.activityBoost.fullWindowMs, 600000);
  assert.equal(section.sendDelay.segmentGap.charsPerSecond, 10);
  assert.equal(section.sendDelay.segmentGap.maxTotalMs, 30000);

  // Explicit advanced keys still win over the base.
  const explicit = validateHumanizeOverrideSection(
    {
      sendDelay: {
        enabled: true,
        readDelay: { minMs: 2000, maxMs: 7000, charsPerSecond: 0 },
        segmentGap: { minMs: 500, maxMs: 1500, maxTotalMs: 8000 },
      },
    },
    { sendDelayBase: base },
  );
  assert.equal(explicit.sendDelay.readDelay.charsPerSecond, 0);
  assert.equal(explicit.sendDelay.segmentGap.maxTotalMs, 8000);
  assert.equal(explicit.sendDelay.readDelay.activityBoost.fastReplyMs, 2000,
    'activity boost still inherits when not explicitly set');
  // A partial activityBoost (hand-edited override) merges subfield-wise:
  // the explicit fast reply wins, the rest still inherits the base.
  const partialBoost = validateHumanizeOverrideSection(
    {
      sendDelay: {
        enabled: true,
        readDelay: { minMs: 2000, maxMs: 7000, activityBoost: { fastReplyMs: 500 } },
        segmentGap: { minMs: 500, maxMs: 1500 },
      },
    },
    { sendDelayBase: base },
  );
  assert.equal(partialBoost.sendDelay.readDelay.activityBoost.fastReplyMs, 500);
  assert.equal(partialBoost.sendDelay.readDelay.activityBoost.fullWindowMs, 600000);

  // Without a base the unset subfields keep the factory defaults.
  const noBase = validateHumanizeOverrideSection({
    sendDelay: {
      enabled: true,
      readDelay: { minMs: 2000, maxMs: 7000 },
      segmentGap: { minMs: 500, maxMs: 1500 },
    },
  });
  assert.equal(noBase.sendDelay.readDelay.charsPerSecond, 0);
  assert.equal(noBase.sendDelay.readDelay.maxTotalMs, 30000);
  assert.equal(noBase.sendDelay.readDelay.activityBoost.fullWindowMs, 300000);
});

test('BotWorkspaceStore persists humanize sections, clears them and removes them with the bot', async (t) => {
  const { directory, path, store } = await fixture(t);
  const botId = 'delay_bot';
  const otherId = 'plain_bot';
  await store.ensure(botId);
  await store.ensure(otherId);

  assert.equal(store.humanizeFor(botId), null);
  await store.setHumanize(botId, { streaming: false, sendDelay: completeSendDelay });
  assert.deepEqual(store.humanizeFor(botId), {
    streaming: false,
    sendDelay: {
      ...completeSendDelay,
      readDelay: { ...completeSendDelay.readDelay, activityBoost: DEFAULT_SEND_DELAY_CONFIG.readDelay.activityBoost },
    },
  });
  assert.equal(store.humanizeFor(otherId), null);

  // Persisted to disk and reloaded intact.
  const disk = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(disk.humanize.delay_bot.streaming, false);
  const reloaded = await new BotWorkspaceStore(path, { defaultWorkspace: directory }).load();
  assert.deepEqual(reloaded.humanizeFor(botId), store.humanizeFor(botId));

  // Hand-edited sections are repaired on load (damage isolation).
  await writeFile(path, JSON.stringify({
    ...disk,
    humanize: { delay_bot: { streaming: 'nope', typingIndicator: 'burst' } },
  }));
  const repaired = await new BotWorkspaceStore(path, { defaultWorkspace: directory }).load();
  assert.deepEqual(repaired.humanizeFor(botId), { typingIndicator: 'burst' });

  // Clearing with null reverts the bot to global defaults.
  await repaired.setHumanize(botId, null);
  assert.equal(repaired.humanizeFor(botId), null);

  // Removing the bot removes the section; removing the last section drops
  // the key from the document.
  await repaired.setHumanize(botId, { messageBreak: false });
  await repaired.remove(botId);
  assert.equal(repaired.humanizeFor(botId), null);
  const finalDisk = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(Object.hasOwn(finalDisk, 'humanize'), false);
});

test('old workspace files without humanize sections remain untouched on load', async (t) => {
  const { directory, path } = await fixture(t);
  const original = JSON.stringify({
    version: 1,
    workspaces: { old_bot: directory },
    contextEnhancement: { old_bot: { groupEnabled: false } },
  });
  await writeFile(path, original);
  const store = await new BotWorkspaceStore(path).load();
  assert.equal(store.humanizeFor('old_bot'), null);
  assert.equal(await readFile(path, 'utf8'), original, 'loading must not migrate/write');
  // decorateStatus exposes the section for the client UI.
  const decorated = store.decorateStatus({ bots: [{ botId: 'old_bot' }] });
  assert.equal(decorated.bots[0].humanize, null);
});

for (const [channel, createHandler, endpoints] of CHANNELS) {
  test(`${channel} humanize RPC saves, validates, decorates and clears per-bot sections`, async (t) => {
    const { path, store } = await fixture(t);
    const botId = `${channel}_delay`;
    const otherBotId = `${channel}_plain`;
    await store.ensure(botId);
    await store.ensure(otherBotId);
    const controller = awareController(store, fakeController([botId, otherBotId]));
    const handler = createHandler(controller);
    assert.equal(endpoints.setHumanize, SET_HUMANIZE_ENDPOINT);

    const before = await handler(endpoints.status, {});
    assert.equal(before.ok, true);
    assert.equal(before.value.bots[0].humanize, null);

    const saved = await handler(endpoints.setHumanize, {
      botId,
      humanize: {
        typingIndicator: 'continuous',
        statusReaction: false,
        sendDelay: completeSendDelay,
      },
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.value.bots.length, 2);
    assert.equal(saved.value.bots[0].humanize.typingIndicator, 'continuous');
    assert.equal(saved.value.bots[0].humanize.statusReaction, false);
    assert.equal(saved.value.bots[1].humanize, null);
    assert.deepEqual(store.humanizeFor(botId).sendDelay.readDelay, {
      ...completeSendDelay.readDelay,
      activityBoost: DEFAULT_SEND_DELAY_CONFIG.readDelay.activityBoost,
    });

    // Invalid saves are rejected without touching the stored section.
    const diskBefore = await readFile(path, 'utf8');
    for (const bad of [
      { streaming: 'no' },
      { statusReaction: 'no' },
      { replyQuote: 'yes' },
      { sendDelay: { enabled: true, readDelay: { minMs: 5000 } } }, // incomplete
      { sendDelay: { segmentGap: { maxMs: -1 } } },
      {},
    ]) {
      const failed = await handler(endpoints.setHumanize, { botId, humanize: bad });
      assert.equal(failed.ok, false, `${channel} rejected ${JSON.stringify(bad)}`);
      assert.equal(store.humanizeFor(botId).typingIndicator, 'continuous');
    }
    assert.equal(await readFile(path, 'utf8'), diskBefore);

    // Unknown bots and aborted requests fail cleanly.
    const missing = await handler(endpoints.setHumanize, {
      botId: 'missing_bot', humanize: { streaming: false },
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.error.code, 'workspace-bot-not-found');
    const cancelled = await handler(
      endpoints.setHumanize, { botId, humanize: { streaming: false } }, AbortSignal.abort(),
    );
    assert.equal(cancelled.ok, false);
    assert.equal(cancelled.error.code, 'cancelled');

    // Clearing with null reverts to global defaults.
    const cleared = await handler(endpoints.setHumanize, { botId, humanize: null });
    assert.equal(cleared.ok, true);
    assert.equal(cleared.value.bots[0].humanize, null);
    assert.equal(store.humanizeFor(botId), null);
    // A failed write must not publish new running settings.
    await mkdir(`${path}.tmp`);
    const failedWrite = await handler(endpoints.setHumanize, { botId, humanize: { messageBreak: false } });
    assert.equal(failedWrite.ok, false);
    assert.equal(store.humanizeFor(botId), null);
    await rm(`${path}.tmp`, { recursive: true });
  });
}

test('workspace store provider chain: per-bot humanize reaches createHumanizeProvider live', async (t) => {
  const { store } = await fixture(t);
  const botId = 'provider_bot';
  await store.ensure(botId);
  const { createHumanizeProvider } = await import('../plugin-src/host/channels/shared/humanize-provider.mjs');
  const defaults = () => ({
    streaming: true,
    typingIndicator: 'burst',
    sendDelay: DEFAULT_SEND_DELAY_CONFIG,
  });
  const provider = createHumanizeProvider({ defaults, workspaces: store, botId });
  assert.equal(provider.getSettings().typingIndicator, 'burst');
  await store.setHumanize(botId, { typingIndicator: 'off' });
  assert.equal(provider.getSettings().typingIndicator, 'off', 'override applies live');
  await store.setHumanize(botId, null);
  assert.equal(provider.getSettings().typingIndicator, 'burst', 'clearing reverts live');
});
