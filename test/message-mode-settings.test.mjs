import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BotWorkspaceStore, createWorkspaceAwareController, createBotWorkspaceScope } from '../src/channels/shared/bot-workspace-store.mjs';
import { SET_MESSAGE_MODE_ENDPOINT } from '../src/channels/shared/message-mode.mjs';

const CHANNELS = [
  ['wecom', 'Wecom'], ['weixin', 'Weixin'], ['feishu', 'Feishu'], ['dingtalk', 'Dingtalk'],
  ['qq', 'Qq'], ['slack', 'Slack'], ['telegram', 'Telegram'], ['discord', 'Discord'],
  ['whatsapp', 'Whatsapp'], ['wecom-app', 'WecomApp'], ['imessage', 'IMessage'],
  ['email', 'Email'], ['matrix', 'Matrix'],
];

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-im-message-mode-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'workspaces.json');
  const store = await new BotWorkspaceStore(path, { defaultWorkspace: directory }).load();
  await store.ensure('bot_one');
  await store.ensure('bot_two');
  const status = () => ({ bots: ['bot_one', 'bot_two'].map((botId) => ({ botId, connected: false })) });
  const core = { status, permissions: async () => ({}) };
  for (const method of ['startProvisioning', 'registrationStatus', 'submitVerification',
    'cancelProvisioning', 'bindCredentials', 'reconnectBot', 'deleteBot', 'startRegistration',
    'cancelRegistration', 'disconnect', 'setAccessPolicy', 'approveSender', 'revokeSender',
    'bindApp', 'updateAppSettings', 'resetCallbackSecret']) {
    core[method] = () => { throw new Error(`Unexpected lifecycle action: ${method}`); };
  }
  const controller = createWorkspaceAwareController(core, {
    workspaces: store, stateFor: () => { throw new Error('settings must not mutate sessions'); },
  });
  return { directory, path, store, controller };
}

test('message mode defaults to interrupt, persists per bot and is live in existing scopes', async (t) => {
  const { path, directory, store } = await fixture(t);
  const state = { sessionFor: () => null };
  const scope = createBotWorkspaceScope({}, { botId: 'bot_one', workspaces: store, state });
  // No stored choice and no humanization provider: the shipped default applies.
  assert.equal(scope.harness.currentBusyMessageMode(), 'interrupt');
  // The raw read stays undefined so a later global change still reaches the bot.
  assert.equal(store.busyMessageModeFor('bot_two'), undefined);
  assert.equal(store.effectiveBusyMessageModeFor('bot_two'), 'interrupt');
  await store.setBusyMessageMode('bot_one', 'steer');
  assert.equal(scope.harness.currentBusyMessageMode(), 'steer');
  const restored = await new BotWorkspaceStore(path, { defaultWorkspace: directory }).load();
  assert.equal(restored.busyMessageModeFor('bot_one'), 'steer');
  assert.equal(restored.effectiveBusyMessageModeFor('bot_two'), 'interrupt');
  // Choosing what the default already supplies stores nothing.
  await store.setBusyMessageMode('bot_one', 'interrupt');
  assert.equal(scope.harness.currentBusyMessageMode(), 'interrupt');
  assert.equal(JSON.parse(await readFile(path, 'utf8')).busyMessageModes, undefined);
});

test('a bot choice outranks the live humanization default, which outranks interrupt', async (t) => {
  const { directory, store } = await fixture(t);
  let global = 'queue';
  const scoped = await new BotWorkspaceStore(new URL(`file://${directory}/scoped.json`).pathname, {
    defaultWorkspace: directory,
    busyMessageModeDefaults: () => global,
  }).load();
  await scoped.ensure('bot_one');
  assert.equal(scoped.effectiveBusyMessageModeFor('bot_one'), 'queue', 'the global default applies');
  await scoped.setBusyMessageMode('bot_one', 'steer');
  assert.equal(scoped.effectiveBusyMessageModeFor('bot_one'), 'steer', 'the bot choice wins');
  global = 'interrupt';
  assert.equal(scoped.effectiveBusyMessageModeFor('bot_one'), 'steer', 'the bot stays pinned');
  global = 'nonsense';
  assert.equal(scoped.effectiveBusyMessageModeFor('bot_two'), 'interrupt', 'garbage falls back');
  void store;
});

test('message mode failed disk writes and status projections leave the committed setting unchanged', async (t) => {
  const { path, store, controller } = await fixture(t);
  await store.setBusyMessageMode('bot_one', 'steer');
  const before = await readFile(path, 'utf8');
  await assert.rejects(controller.updateBusyMessageMode('bot_one', 'queue', () => { throw new Error('projection'); }), /projection/);
  await mkdir(`${path}.tmp`);
  await assert.rejects(controller.updateBusyMessageMode('bot_one', 'queue'));
  assert.equal(store.busyMessageModeFor('bot_one'), 'steer');
  assert.equal(await readFile(path, 'utf8'), before);
});

test('message mode removal clears settings and stale saves cannot affect a replacement bot', async (t) => {
  const { path, store } = await fixture(t);
  await store.setBusyMessageMode('bot_one', 'steer');
  const incarnation = store.incarnationFor('bot_one');
  await store.remove('bot_one');
  await store.ensure('bot_one');
  assert.equal(store.busyMessageModeFor('bot_one'), undefined);
  assert.equal(store.effectiveBusyMessageModeFor('bot_one'), 'interrupt');
  await assert.rejects(store.setBusyMessageMode('bot_one', 'steer', { incarnation }), { code: 'workspace-bot-not-found' });
  assert.equal(JSON.parse(await readFile(path, 'utf8')).busyMessageModes, undefined);
});

test('old and damaged optional message mode settings safely use interrupt without rewriting on read', async (t) => {
  const { path, directory } = await fixture(t);
  for (const fields of [{}, { busyMessageModes: { bot_one: 'invalid', orphan: 'steer' } }]) {
    const original = JSON.stringify({ version: 1, workspaces: { bot_one: directory }, ...fields });
    await writeFile(path, original);
    const restored = await new BotWorkspaceStore(path, { defaultWorkspace: directory }).load();
    assert.equal(restored.busyMessageModeFor('bot_one'), undefined);
    assert.equal(restored.effectiveBusyMessageModeFor('bot_one'), 'interrupt');
    assert.equal(await readFile(path, 'utf8'), original);
  }
});

for (const [channel, name] of CHANNELS) {
  test(`${channel} message-mode RPC saves and returns bot-local settings, rejects malformed requests`, async (t) => {
    const { path, store, controller } = await fixture(t);
    const rpc = await import(`../plugin-src/host/channels/${channel}/rpc.mjs`);
    const handler = rpc[`create${name}RpcHandler`](controller);
    const saved = await handler(SET_MESSAGE_MODE_ENDPOINT, { botId: 'bot_one', busyMessageMode: 'steer' });
    assert.equal(saved.ok, true, JSON.stringify(saved));
    assert.equal(saved.value.bots.find((bot) => bot.botId === 'bot_one').busyMessageMode, 'steer');
    assert.equal(saved.value.bots.find((bot) => bot.botId === 'bot_two').busyMessageMode, 'interrupt');
    const status = await handler('connection.status', {});
    assert.equal(status.value.bots.find((bot) => bot.botId === 'bot_one').busyMessageMode, 'steer');
    const before = await readFile(path, 'utf8');
    for (const payload of [
      { botId: 'bot_one', busyMessageMode: 'follow-dsh' },
      { botId: 'bot_one', busyMessageMode: true },
      { botId: 'bot_one' },
      { botId: 'bot_one', busyMessageMode: 'queue', extra: true },
      { botId: 'missing', busyMessageMode: 'queue' },
    ]) assert.equal((await handler(SET_MESSAGE_MODE_ENDPOINT, payload)).ok, false);
    assert.equal(await readFile(path, 'utf8'), before);
    assert.equal(store.busyMessageModeFor('bot_one'), 'steer');
    const reset = await handler(SET_MESSAGE_MODE_ENDPOINT, { botId: 'bot_one', busyMessageMode: 'queue' });
    assert.equal(reset.ok, true);
    assert.equal(store.busyMessageModeFor('bot_one'), 'queue');
  });
}
