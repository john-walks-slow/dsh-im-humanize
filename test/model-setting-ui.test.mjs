import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import TestRenderer from 'react-test-renderer';

import {
  ModelCatalogContext,
  ModelEditor,
} from '../plugin-src/client/model-setting.js';
import { AgentPresetEditor } from '../plugin-src/client/agent-preset.js';
import { WorkspaceEditor } from '../plugin-src/client/workspace-editor.js';

const { act, create } = TestRenderer;
const MODEL = Object.freeze({ provider: 'openai', model: 'gpt-5' });
const MODEL_VALUE = JSON.stringify(['openai', 'gpt-5']);
const CATALOG = Object.freeze({
  groups: Object.freeze([Object.freeze({
    id: 'openai', name: 'OpenAI', models: Object.freeze([
      Object.freeze({ id: 'gpt-5', name: 'GPT-5' }),
      Object.freeze({ id: 'gpt-5-mini', name: 'GPT-5 mini' }),
    ]),
  })]),
  failures: Object.freeze([]),
});
const channels = await Promise.all([
  ['weixin', 'WeixinSettingsTab'], ['wecom', 'WecomSettingsTab'], ['feishu', 'FeishuSettingsTab'],
  ['dingtalk', 'DingtalkSettingsTab'], ['qq', 'QqSettingsTab'], ['slack', 'SlackSettingsTab'],
  ['telegram', 'TelegramSettingsTab'], ['discord', 'DiscordSettingsTab'], ['whatsapp', 'WhatsappSettingsTab'],
].map(async ([name, component]) => {
  const api = await import(`../plugin-src/client/channels/${name}/api.js`);
  const ui = await import(`../plugin-src/client/channels/${name}/index.js`);
  return {
    name,
    Settings: ui[component],
    normalize: api.normalizeBotsSnapshot ?? api.normalizeSnapshot,
    endpoints: Object.entries(api).find(([key]) => key.endsWith('_ENDPOINTS'))[1],
  };
}));

function textOf(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return node?.children?.map(textOf).join('') ?? '';
}

async function flush() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

function mockWindow(t) {
  const previous = globalThis.window;
  let nextId = 0;
  globalThis.window = {
    setInterval() { return ++nextId; }, clearInterval() {},
    setTimeout() { return ++nextId; }, clearTimeout() {},
    requestAnimationFrame(callback) { callback(); return ++nextId; }, cancelAnimationFrame() {},
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  });
}

function snapshot(channel, models = [null, null]) {
  return {
    schemaVersion: 2,
    revision: 1,
    modelCatalog: CATALOG,
    bots: models.map((model, index) => ({
      botId: `${channel}_${index}`,
      configured: true,
      connected: true,
      state: 'connected',
      workspace: `/workspace/${index}`,
      agentPreset: '',
      model,
      bot: {
        name: `Bot ${index}`, username: `bot${index}`, idMasked: '123•••',
        accountIdMasked: '123•••', appIdMasked: 'cli•••', clientIdMasked: 'ding•••',
      },
      health: { status: 'healthy', summary: 'Connected', lastCheckedAt: 1_700_000_000_000 },
    })),
  };
}

async function mount(t, component, props) {
  let renderer;
  await act(async () => { renderer = create(React.createElement(component, props)); await flush(); });
  t.after(async () => { await act(async () => { renderer.unmount(); await flush(); }); });
  return renderer;
}

test('ModelEditor lists provider groups, explains new-session semantics and clears unavailable values', async (t) => {
  const saved = [];
  const renderer = await mount(t, ModelCatalogContext.Provider, {
    value: CATALOG,
    children: React.createElement(ModelEditor, {
      model: { provider: 'removed', model: 'old-model' },
      onSave(value) { saved.push(value); },
    }),
  });
  const select = renderer.root.findByProps({ className: 'dim-presetSelect dim-modelSelect' });
  assert.equal(select.props.value, JSON.stringify(['removed', 'old-model']));
  assert.equal(textOf(select.children[0]), '跟随默认模型');
  assert.match(textOf(select), /GPT-5（openai\/gpt-5）/u);
  assert.match(textOf(select), /removed\/old-model（已不可用）/u);
  assert.match(textOf(renderer.root.findByProps({ role: 'tooltip' })), /先发送 \/new/u);
  assert.match(textOf(renderer.root.findByProps({ role: 'status' })), /当前模型已不可用/u);
  await act(async () => { select.props.onChange({ target: { value: '' } }); await flush(); });
  assert.deepEqual(saved, [null]);
});

test('all nine client APIs preserve model selections and the public model catalog', () => {
  for (const channel of channels) {
    assert.equal(channel.endpoints.setModel, 'bot.model.set', channel.name);
    const raw = snapshot(channel.name, [MODEL, null]);
    const normalized = channel.normalize(raw);
    assert.deepEqual(normalized.bots[0].model, MODEL, channel.name);
    assert.equal(normalized.bots[1].model, null, channel.name);
    assert.deepEqual(normalized.modelCatalog, CATALOG, channel.name);
  }
});

test('all nine cards place model below workspace and save through bot.model.set', async (t) => {
  mockWindow(t);
  for (const channel of channels) await t.test(channel.name, async (t) => {
    let current = snapshot(channel.name);
    const calls = [];
    const rpcCall = async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      if (endpoint === 'connection.status') return { ok: true, value: current };
      assert.equal(endpoint, 'bot.model.set', channel.name);
      current = {
        ...current,
        revision: current.revision + 1,
        bots: current.bots.map((bot) => bot.botId === payload.botId
          ? { ...bot, model: payload.model }
          : bot),
      };
      return { ok: true, value: current };
    };
    const renderer = await mount(t, channel.Settings, { rpcCall });
    const first = () => renderer.root.findByProps({ 'data-bot-id': `${channel.name}_0` });
    const second = () => renderer.root.findByProps({ 'data-bot-id': `${channel.name}_1` });
    const editors = first().findAll((node) => (
      [WorkspaceEditor, ModelEditor, AgentPresetEditor].includes(node.type)
    ));
    assert.deepEqual(editors.map((node) => node.type), [
      WorkspaceEditor, ModelEditor, AgentPresetEditor,
    ], `${channel.name} editor order`);

    const select = first().findByProps({ className: 'dim-presetSelect dim-modelSelect' });
    await act(async () => { select.props.onChange({ target: { value: MODEL_VALUE } }); await flush(); });
    assert.deepEqual(calls.filter(({ endpoint }) => endpoint !== 'connection.status'), [{
      endpoint: 'bot.model.set',
      payload: { botId: `${channel.name}_0`, model: MODEL },
    }], channel.name);
    assert.deepEqual(first().findByType(ModelEditor).props.model, MODEL, channel.name);
    assert.equal(second().findByType(ModelEditor).props.model, null, channel.name);
  });
});
