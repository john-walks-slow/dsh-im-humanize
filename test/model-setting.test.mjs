import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  EMPTY_MODEL_CATALOG,
  listModelCatalog,
  modelCatalogHas,
  modelSelectionId,
  normalizeModelCatalog,
  normalizeModelSelection,
  validateModelSelection,
} from '../src/channels/shared/model-setting.mjs';
import {
  BotWorkspaceStore,
  createWorkspaceAwareController,
} from '../src/channels/shared/bot-workspace-store.mjs';
import {
  SET_MODEL_ENDPOINT,
  validModelPayload,
} from '../plugin-src/host/channels/shared/model-setting-rpc.mjs';
import { createWeixinRpcHandler, WEIXIN_ENDPOINTS } from '../plugin-src/host/channels/weixin/rpc.mjs';
import { createFeishuRpcHandler, FEISHU_ENDPOINTS } from '../plugin-src/host/channels/feishu/rpc.mjs';
import { createDingtalkRpcHandler, DINGTALK_ENDPOINTS } from '../plugin-src/host/channels/dingtalk/rpc.mjs';
import { createWecomRpcHandler, WECOM_ENDPOINTS } from '../plugin-src/host/channels/wecom/rpc.mjs';
import { createQqRpcHandler, QQ_ENDPOINTS } from '../plugin-src/host/channels/qq/rpc.mjs';
import { createSlackRpcHandler, SLACK_ENDPOINTS } from '../plugin-src/host/channels/slack/rpc.mjs';
import { createTelegramRpcHandler, TELEGRAM_ENDPOINTS } from '../plugin-src/host/channels/telegram/rpc.mjs';
import { createDiscordRpcHandler, DISCORD_ENDPOINTS } from '../plugin-src/host/channels/discord/rpc.mjs';
import { createWhatsappRpcHandler, WHATSAPP_ENDPOINTS } from '../plugin-src/host/channels/whatsapp/rpc.mjs';

const MODEL = Object.freeze({ provider: 'openai', model: 'gpt-5' });
const CATALOG = Object.freeze({
  groups: Object.freeze([
    Object.freeze({
      id: 'openai',
      name: 'OpenAI',
      models: Object.freeze([
        Object.freeze({ id: 'gpt-5', name: 'GPT-5' }),
        Object.freeze({ id: 'gpt-5-mini', name: 'GPT-5 mini' }),
      ]),
    }),
  ]),
  failures: Object.freeze([]),
});

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-im-model-setting-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, 'workspace');
  await mkdir(workspace);
  return { root, workspace, path: join(root, 'workspaces.json') };
}

test('model setting normalization exposes only valid public catalog fields', async () => {
  assert.equal(normalizeModelSelection(null), null);
  assert.deepEqual(normalizeModelSelection({ provider: ' openai ', model: ' gpt-5 ' }), MODEL);
  assert.equal(normalizeModelSelection({ provider: 'openai', model: 'bad\nmodel' }), null);
  assert.equal(modelSelectionId(MODEL), 'openai/gpt-5');
  assert.equal(modelCatalogHas(CATALOG, MODEL), true);
  assert.equal(modelCatalogHas(CATALOG, { provider: 'openai', model: 'missing' }), false);
  assert.throws(() => validateModelSelection({ provider: '', model: 'gpt-5' }), {
    code: 'model-selection-invalid',
  });

  const normalized = normalizeModelCatalog({
    groups: [
      {
        id: 'openai', name: ' OpenAI\n ', secret: 'do-not-copy',
        models: [
          { id: 'gpt-5', name: ' GPT-5 ', price: 99 },
          { id: 'gpt-5', name: 'duplicate' },
          { id: 'bad\nmodel', name: 'bad' },
        ],
      },
      { id: '', models: [{ id: 'ignored' }] },
    ],
    failures: [{ id: 'offline', name: ' Offline ', error: 'private stack' }],
  });
  assert.deepEqual(normalized, {
    groups: [{ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5', name: 'GPT-5' }] }],
    failures: [{ id: 'offline', name: 'Offline' }],
  });
  assert.equal(JSON.stringify(normalized).includes('do-not-copy'), false);
  assert.equal(JSON.stringify(normalized).includes('private stack'), false);

  assert.deepEqual(await listModelCatalog({ async listModels() { return CATALOG; } }), CATALOG);
  assert.deepEqual(await listModelCatalog({ async listModels() { throw new Error('offline'); } }),
    EMPTY_MODEL_CATALOG);
});

test('BotWorkspaceStore persists isolated per-bot models without clearing sessions', async (t) => {
  const { path, workspace } = await fixture(t);
  const store = await new BotWorkspaceStore(path, { defaultWorkspace: workspace }).load();
  await Promise.all([store.ensure('bot_one'), store.ensure('bot_two')]);
  const generation = store.generationFor('bot_one');
  let clears = 0;

  await store.setModel('bot_one', MODEL, {
    clearSessions: async () => { clears += 1; },
  });
  assert.deepEqual(store.modelFor('bot_one'), MODEL);
  assert.equal(store.modelFor('bot_two'), null);
  assert.equal(store.generationFor('bot_one'), generation);
  assert.equal(clears, 0);
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), {
    version: 1,
    workspaces: { bot_one: workspace, bot_two: workspace },
    models: { bot_one: MODEL },
  });

  const reloaded = await new BotWorkspaceStore(path, { defaultWorkspace: tmpdir() }).load();
  assert.deepEqual(reloaded.modelFor('bot_one'), MODEL);
  assert.equal(reloaded.modelFor('bot_two'), null);
  await reloaded.setModel('bot_one', null);
  assert.equal(reloaded.modelFor('bot_one'), null);
  assert.equal(Object.hasOwn(JSON.parse(await readFile(path, 'utf8')), 'models'), false);
  await assert.rejects(reloaded.setModel('bot_one', { provider: '', model: 'gpt-5' }), {
    code: 'model-selection-invalid',
  });
  await assert.rejects(reloaded.setModel('missing', MODEL), {
    code: 'workspace-bot-not-found',
  });
});

test('workspace-aware model setting refreshes the catalog and rejects unavailable choices', async (t) => {
  const { path, workspace } = await fixture(t);
  const workspaces = await new BotWorkspaceStore(path, { defaultWorkspace: workspace }).load();
  await workspaces.ensure('bot_one');
  let catalog = CATALOG;
  const base = {
    status() { return { bots: [{ botId: 'bot_one', connected: true }] }; },
  };
  const controller = createWorkspaceAwareController(base, {
    workspaces,
    stateFor: async () => ({ async clearSessions() {} }),
    modelCatalog: async () => catalog,
  });

  const initial = await controller.status();
  assert.deepEqual(initial.modelCatalog, CATALOG);
  assert.equal(initial.bots[0].model, null);
  const selected = await controller.updateModel('bot_one', MODEL);
  assert.deepEqual(selected.bots[0].model, MODEL);
  assert.deepEqual(selected.modelCatalog, CATALOG);

  catalog = { groups: [], failures: [] };
  await assert.rejects(controller.updateModel('bot_one', MODEL), {
    code: 'model-selection-unavailable',
  });
  assert.deepEqual(workspaces.modelFor('bot_one'), MODEL);
  const cleared = await controller.updateModel('bot_one', null);
  assert.equal(cleared.bots[0].model, null);
  assert.deepEqual(cleared.modelCatalog, catalog);
});

test('shared model RPC payload accepts only the exact bot.model.set contract', () => {
  assert.equal(SET_MODEL_ENDPOINT, 'bot.model.set');
  assert.equal(validModelPayload({ botId: 'bot_one', model: MODEL }), true);
  assert.equal(validModelPayload({ botId: 'bot_one', model: null }), true);
  assert.equal(validModelPayload({ botId: 'bot_one', model: MODEL, extra: true }), false);
  assert.equal(validModelPayload({ botId: '../bad', model: MODEL }), false);
  assert.equal(validModelPayload({ botId: 'bot_one', model: { ...MODEL, extra: true } }), false);
  assert.equal(validModelPayload({ botId: 'bot_one', provider: 'openai', model: 'gpt-5' }), false);
});

function controllerFixture() {
  const calls = [];
  const snapshot = (model = null) => ({
    schemaVersion: 2,
    revision: 1,
    modelCatalog: CATALOG,
    bots: [{
      botId: 'bot_one',
      configured: true,
      connected: true,
      state: 'connected',
      model,
    }],
  });
  const controller = {
    status: async () => snapshot(),
    bindCredentials: async () => snapshot(),
    reconnectBot: async () => snapshot(),
    deleteBot: async () => ({ ...snapshot(), bots: [] }),
    startProvisioning: async () => ({}),
    registrationStatus: async () => ({}),
    cancelProvisioning: async () => ({}),
    submitVerification: async () => ({}),
    approveSender: async () => snapshot(),
    revokeSender: async () => snapshot(),
    startRegistration: async () => ({}),
    cancelRegistration: async () => ({}),
    disconnect: async () => snapshot(),
    async updateModel(botId, model, projectStatus) {
      calls.push({ botId, model });
      const value = snapshot(model);
      return projectStatus ? projectStatus(value) : value;
    },
  };
  return { controller, calls };
}

test('all nine Host RPCs expose and execute the unified model-setting contract', async () => {
  const factories = [
    ['weixin', createWeixinRpcHandler, WEIXIN_ENDPOINTS],
    ['feishu', createFeishuRpcHandler, FEISHU_ENDPOINTS],
    ['dingtalk', createDingtalkRpcHandler, DINGTALK_ENDPOINTS],
    ['wecom', createWecomRpcHandler, WECOM_ENDPOINTS],
    ['qq', createQqRpcHandler, QQ_ENDPOINTS],
    ['slack', createSlackRpcHandler, SLACK_ENDPOINTS],
    ['telegram', createTelegramRpcHandler, TELEGRAM_ENDPOINTS],
    ['discord', createDiscordRpcHandler, DISCORD_ENDPOINTS],
    ['whatsapp', createWhatsappRpcHandler, WHATSAPP_ENDPOINTS],
  ];
  for (const [channel, createHandler, endpoints] of factories) {
    const { controller, calls } = controllerFixture();
    const handler = createHandler(controller);
    assert.equal(endpoints.setModel, SET_MODEL_ENDPOINT, channel);
    const result = await handler(endpoints.setModel, { botId: 'bot_one', model: MODEL });
    assert.equal(result.ok, true, `${channel}: ${JSON.stringify(result)}`);
    assert.deepEqual(calls, [{ botId: 'bot_one', model: MODEL }], channel);
    assert.deepEqual(result.value?.bots?.[0]?.model, MODEL, `${channel} model projection`);
    assert.deepEqual(result.value?.modelCatalog, CATALOG, `${channel} catalog projection`);
    const invalid = await handler(endpoints.setModel, {
      botId: 'bot_one', model: { ...MODEL, extra: true },
    });
    assert.equal(invalid.ok, false, channel);
    assert.equal(invalid.error.code, 'bad-request', channel);
    assert.equal(calls.length, 1, channel);
  }
});
