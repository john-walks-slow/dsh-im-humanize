import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as React from 'react';
import TestRenderer from 'react-test-renderer';

import {
  CONTEXT_ENHANCEMENT_FIELDS,
  CONTEXT_ENHANCEMENT_GUIDANCE_MAX_LENGTH,
  CONTEXT_GUIDANCE_EXAMPLE,
  DEFAULT_CONTEXT_ENHANCEMENT_CONFIG,
} from '../src/channels/shared/context-enhancement.mjs';
import { ContextEnhancementEditor, contextEnhancementLabel } from '../plugin-src/client/context-enhancement.js';
import { AgentPresetEditor } from '../plugin-src/client/agent-preset.js';
import { WorkspaceEditor } from '../plugin-src/client/workspace-editor.js';
import { en, setImTranslator } from '../plugin-src/client/i18n.js';

const { act, create } = TestRenderer;
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

function button(root, name) {
  const found = root.findAllByType('button').find((node) => textOf(node) === name);
  assert.ok(found, `missing button: ${name}`);
  return found;
}

function fields(root) {
  return root.findAllByType('input').filter((node) => CONTEXT_ENHANCEMENT_FIELDS.includes(node.props.name));
}

function switches(root) {
  return root.findAllByProps({ role: 'switch' });
}

function badge(root) {
  return textOf(root.findByProps({ className: 'dim-contextStatus' }));
}

async function flush() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

async function open(root) {
  await act(async () => { root.findByProps({ className: 'dim-contextEntry' }).props.onClick(); });
}

async function click(root, label) {
  await act(async () => { button(root, label).props.onClick(); await flush(); });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function mockWindow(t) {
  const previous = globalThis.window;
  const intervals = new Map();
  let nextId = 0;
  globalThis.window = {
    setInterval(callback, delay) { const id = ++nextId; intervals.set(id, { callback, delay }); return id; },
    clearInterval(id) { intervals.delete(id); },
    setTimeout() { return ++nextId; }, clearTimeout() {},
    requestAnimationFrame(callback) { callback(); return ++nextId; }, cancelAnimationFrame() {},
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  });
  return { poll: () => [...intervals.values()].find(({ delay }) => delay === 15_000)?.callback() };
}

function snapshot(channel, configs = [undefined, undefined]) {
  return {
    revision: 1,
    bots: configs.map((config, index) => ({
      botId: `${channel}_${index}`, configured: true, connected: true, state: 'connected',
      workspace: `/workspace/${index}`, agentPreset: '', contextEnhancement: config,
      bot: {
        name: `Bot ${index}`, username: `bot${index}`, idMasked: '123•••',
        accountIdMasked: '123•••', appIdMasked: 'cli•••', clientIdMasked: 'ding•••',
      },
      health: { status: 'healthy', summary: 'Connected', lastCheckedAt: 1_700_000_000_000 },
    })),
  };
}

async function mount(t, component, props, options) {
  let renderer;
  await act(async () => { renderer = create(React.createElement(component, props), options); await flush(); });
  t.after(async () => { await act(async () => { renderer.unmount(); await flush(); }); });
  return renderer;
}

test('context settings default to off with sender ID and empty guidance, and explain the guidance', async (t) => {
  assert.equal(contextEnhancementLabel(undefined), '未开启');
  for (const [groupEnabled, directEnabled, label] of [
    [false, false, '未开启'], [true, false, '仅群聊'],
    [false, true, '仅私聊'], [true, true, '群聊和私聊'],
  ]) {
    const config = { ...DEFAULT_CONTEXT_ENHANCEMENT_CONFIG, groupEnabled, directEnabled };
    assert.equal(contextEnhancementLabel(config), label);
  }
  const saved = [];
  const renderer = await mount(t, ContextEnhancementEditor, { onSave: (value) => saved.push(value) });
  const entry = renderer.root.findByProps({ className: 'dim-contextEntry' });
  assert.equal(entry.props.disabled, false);
  assert.equal(entry.props['aria-haspopup'], 'dialog');
  await open(renderer.root);
  const contextHelp = renderer.root.findByProps({ 'aria-label': '查看上下文增强说明' });
  const contextTooltip = renderer.root.findByProps({ id: contextHelp.props['aria-describedby'] });
  assert.equal(renderer.root.findByProps({ role: 'dialog' }).props['aria-describedby'], contextTooltip.props.id);
  assert.match(textOf(contextTooltip), /选择在哪些会话中启用.*不查询平台 API/);
  assert.equal(renderer.root.findAllByType('p').some((node) => textOf(node).startsWith('选择在哪些会话中启用')), false);
  assert.deepEqual(switches(renderer.root).map((node) => node.props.checked), [false, false]);
  assert.equal(renderer.root.findByType('textarea').props.rows, 4);
  assert.deepEqual(fields(renderer.root).map((node) => node.props.name), CONTEXT_ENHANCEMENT_FIELDS);
  assert.deepEqual(fields(renderer.root).filter((node) => node.props.checked).map((node) => node.props.name), ['senderId']);
  assert.deepEqual(renderer.root.findAllByProps({ className: 'dim-contextFieldKey' }).map(textOf), CONTEXT_ENHANCEMENT_FIELDS);
  const fieldsHelp = renderer.root.findByProps({ 'aria-label': '查看来源字段说明' });
  const fieldsTooltip = renderer.root.findByProps({ id: fieldsHelp.props['aria-describedby'] });
  assert.match(textOf(fieldsTooltip), /增强提示词中请使用字段名（如 senderId、conversationType）.*不会额外查询或补全/);
  assert.equal(renderer.root.findAllByType('p').some((node) => textOf(node).startsWith('增强提示词中请使用字段名')), false);
  assert.equal(renderer.root.findByType('textarea').props.value, '');
  assert.equal(renderer.root.findByType('textarea').props.placeholder, CONTEXT_GUIDANCE_EXAMPLE);
  const help = renderer.root.findByProps({ 'aria-label': '查看增强提示词使用说明' });
  const tooltip = renderer.root.findByProps({ id: help.props['aria-describedby'] });
  assert.equal(help.props.type, 'button');
  assert.equal(help.props['aria-describedby'], tooltip.props.id);
  assert.match(textOf(tooltip), /使用说明.*dsh_im_source.*生效规则.*清空并保存.*隐私提示.*会话历史.*使用示例.*conversationType/s);
  assert.equal(textOf(tooltip.findByProps({ className: 'dim-contextTooltipExample' })), CONTEXT_GUIDANCE_EXAMPLE);
  assert.equal(renderer.root.findByType('textarea').props['aria-describedby'], tooltip.props.id);
  assert.equal(renderer.root.findAllByType('p').some((node) => /只需填写正文|发送者标识可能包含/.test(textOf(node))), false);
  const senderNameHelp = renderer.root.findByProps({ 'aria-label': '查看发送者昵称字段说明' });
  const senderNameTooltip = renderer.root.findByProps({ id: senderNameHelp.props['aria-describedby'] });
  assert.equal(senderNameHelp.props.type, 'button');
  assert.equal(senderNameHelp.parent.props.className, 'dim-contextHelp dim-contextFieldHelp');
  assert.equal(senderNameHelp.parent.parent.props.className, 'dim-contextFieldText');
  assert.match(textOf(senderNameTooltip), /不是每个渠道.*dsh_im_source.*省略 senderName/s);
  assert.deepEqual(saved, []);
});

test('switches, fields, and guidance are local drafts until Save; Cancel and close discard them', async (t) => {
  const saved = [];
  const renderer = await mount(t, ContextEnhancementEditor, { onSave: (value) => saved.push(value) });
  for (const dismiss of ['取消', 'close', 'escape', 'backdrop']) {
    await open(renderer.root);
    await act(async () => { switches(renderer.root)[0].props.onChange({ target: { checked: true } }); });
    assert.deepEqual(switches(renderer.root).map((node) => node.props.checked), [true, false]);
    await act(async () => { switches(renderer.root)[1].props.onChange({ target: { checked: true } }); });
    assert.deepEqual(switches(renderer.root).map((node) => node.props.checked), [true, true]);
    await act(async () => {
      switches(renderer.root)[0].props.onChange({ target: { checked: false } });
      fields(renderer.root)[0].props.onChange({ target: { checked: false } });
    });
    assert.deepEqual(switches(renderer.root).map((node) => node.props.checked), [false, true]);
    await click(renderer.root, '清空');
    assert.equal(badge(renderer.root), '未开启');
    assert.equal(renderer.root.findByType('textarea').props.value, '');
    assert.deepEqual(saved, []);
    await act(async () => {
      if (dismiss === 'close') renderer.root.findByProps({ 'aria-label': '关闭弹窗' }).props.onClick();
      else if (dismiss === 'escape') renderer.root.findByProps({ role: 'dialog' }).props.onKeyDown({
        key: 'Escape', preventDefault() {}, stopPropagation() {},
      });
      else if (dismiss === 'backdrop') {
        const target = {};
        renderer.root.findByProps({ className: 'dim-contextBackdrop' }).props.onMouseDown({ target, currentTarget: target });
      } else button(renderer.root, dismiss).props.onClick();
      await flush();
    });
    assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
    await open(renderer.root);
    assert.deepEqual(switches(renderer.root).map((node) => node.props.checked), [false, false]);
    assert.deepEqual(fields(renderer.root).filter((node) => node.props.checked).map((node) => node.props.name), ['senderId']);
    assert.equal(renderer.root.findByType('textarea').props.value, '');
    await click(renderer.root, '取消');
  }
  assert.deepEqual(saved, []);
});

test('Save submits one complete config, preserves explicit empty fields/guidance, and fills the example alone', async (t) => {
  let saved;
  const calls = [];
  function Fixture() {
    const [config, setConfig] = React.useState(undefined);
    return React.createElement(ContextEnhancementEditor, {
      config,
      onSave(value) { saved = value; calls.push(value); setConfig(value); },
    });
  }
  const renderer = await mount(t, Fixture);
  await open(renderer.root);
  await act(async () => { switches(renderer.root)[0].props.onChange({ target: { checked: true } }); });
  // Read each freshly rendered checkbox so every independent edit uses the current draft.
  for (const name of CONTEXT_ENHANCEMENT_FIELDS) {
    await act(async () => { renderer.root.findByProps({ name }).props.onChange({ target: { checked: false } }); });
  }
  await click(renderer.root, '清空');
  await click(renderer.root, '保存');
  assert.equal(calls.length, 1);
  assert.deepEqual(saved, { groupEnabled: true, directEnabled: false, fields: [], guidance: '' });
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
  assert.equal(badge(renderer.root), '仅群聊');
  await open(renderer.root);
  assert.ok(fields(renderer.root).every((node) => !node.props.checked));
  assert.equal(renderer.root.findByType('textarea').props.value, '');
  assert.equal(renderer.root.findByType('textarea').props.placeholder, CONTEXT_GUIDANCE_EXAMPLE);
  await click(renderer.root, '填入示例');
  assert.equal(renderer.root.findByType('textarea').props.value, CONTEXT_GUIDANCE_EXAMPLE);
  assert.ok(fields(renderer.root).every((node) => !node.props.checked));
  assert.deepEqual(switches(renderer.root).map((node) => node.props.checked), [true, false]);
  await click(renderer.root, '取消');
  const reloaded = await mount(t, ContextEnhancementEditor, { config: JSON.parse(JSON.stringify(saved)) });
  await open(reloaded.root);
  assert.equal(reloaded.root.findByType('textarea').props.value, '');
  assert.ok(fields(reloaded.root).every((node) => !node.props.checked));
});

test('failed atomic saves retain the draft, lock edits and duplicate submits, and can be retried', async (t) => {
  const request = deferred();
  const calls = [];
  const renderer = await mount(t, ContextEnhancementEditor, {
    config: DEFAULT_CONTEXT_ENHANCEMENT_CONFIG,
    onSave(value) { calls.push(value); return calls.length === 1 ? request.promise : undefined; },
  });
  await open(renderer.root);
  await act(async () => {
    switches(renderer.root)[1].props.onChange({ target: { checked: true } });
    renderer.root.findByType('textarea').props.onChange({ target: { value: 'local draft' } });
  });
  const saveButton = button(renderer.root, '保存');
  await act(async () => { saveButton.props.onClick(); saveButton.props.onClick(); await flush(); });
  assert.equal(calls.length, 1);
  assert.equal(renderer.root.findByProps({ role: 'dialog' }).props['aria-busy'], true);
  assert.ok(renderer.root.findAllByType('input').every((node) => node.props.disabled));
  assert.ok(renderer.root.findAllByType('button').every((node) => node.props.disabled || node.props.className === 'dim-contextEntry'));
  await act(async () => {
    renderer.root.findByType('textarea').props.onChange({ target: { value: 'do not commit' } });
    renderer.root.findByProps({ role: 'dialog' }).props.onKeyDown({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    button(renderer.root, '取消').props.onClick();
  });
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1);
  assert.equal(renderer.root.findByType('textarea').props.value, 'local draft');
  assert.equal(badge(renderer.root), '未开启');
  request.reject(new Error('Save rejected'));
  await act(async () => { await flush(); });
  assert.equal(textOf(renderer.root.findByProps({ role: 'alert' })), 'Save rejected');
  assert.equal(renderer.root.findByType('textarea').props.value, 'local draft');
  assert.deepEqual(switches(renderer.root).map((node) => node.props.checked), [false, true]);
  assert.equal(badge(renderer.root), '未开启');
  await click(renderer.root, '保存');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
});

test('Weixin displays and saves only its supported direct scope', async (t) => {
  const saved = [];
  const renderer = await mount(t, ContextEnhancementEditor, {
    groupSupported: false,
    config: { ...DEFAULT_CONTEXT_ENHANCEMENT_CONFIG, groupEnabled: true },
    onSave(value) { saved.push(value); },
  });
  assert.equal(badge(renderer.root), '未开启');
  await open(renderer.root);
  const group = switches(renderer.root)[0];
  assert.equal(group.props.checked, false);
  assert.equal(group.props.disabled, true);
  const groupNotice = renderer.root.findByProps({ id: group.props['aria-describedby'] });
  assert.equal(textOf(groupNotice), '（当前渠道不支持群聊）');
  assert.equal(groupNotice.props.className, 'dim-contextUnavailable');
  assert.equal(groupNotice.parent.props.className, 'dim-contextSwitchLabel');
  await act(async () => {
    group.props.onChange({ target: { checked: true } });
    switches(renderer.root)[1].props.onChange({ target: { checked: true } });
  });
  await click(renderer.root, '保存');
  assert.equal(saved[0].groupEnabled, false);
  assert.equal(saved[0].directEnabled, true);
});

test('dialog traps Tab and external focus, cancels with Escape, and restores entry focus', async (t) => {
  const previous = globalThis.document;
  const listeners = new Map();
  const document = { activeElement: null, addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } };
  globalThis.document = document;
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  const focusable = () => ({ focus() { document.activeElement = this; } });
  const entry = focusable();
  const first = focusable();
  const last = focusable();
  const dialog = { ...focusable(), contains(node) { return [this, first, last].includes(node); }, querySelectorAll() { return [first, last]; } };
  const renderer = await mount(t, ContextEnhancementEditor, {}, {
    createNodeMock(element) {
      if (element.props.className === 'dim-contextEntry') return entry;
      if (element.props.role === 'dialog') return dialog;
      return {};
    },
  });
  await open(renderer.root);
  assert.equal(document.activeElement, dialog);
  const keydown = (shiftKey) => {
    let prevented = false;
    renderer.root.findByProps({ role: 'dialog' }).props.onKeyDown({ key: 'Tab', shiftKey, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
  };
  keydown(false);
  assert.equal(document.activeElement, first);
  keydown(true);
  assert.equal(document.activeElement, last);
  keydown(false);
  assert.equal(document.activeElement, first);
  listeners.get('focusin')({ target: {} });
  assert.equal(document.activeElement, dialog);
  await act(async () => {
    renderer.root.findByProps({ role: 'dialog' }).props.onKeyDown({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    await flush();
  });
  assert.equal(document.activeElement, entry);
  assert.equal(listeners.has('focusin'), false);
});

test('all context dialog copy and validation errors localize without translating the saved body', async (t) => {
  setImTranslator((key) => en[key] ?? key);
  t.after(() => setImTranslator(null));
  const saved = [];
  const renderer = await mount(t, ContextEnhancementEditor, { groupSupported: false, onSave: (value) => saved.push(value) });
  assert.equal(badge(renderer.root), 'Not enabled');
  await open(renderer.root);
  assert.doesNotMatch(textOf(renderer.root), /[\p{Script=Han}]/u);
  assert.equal(renderer.root.findByType('textarea').props.value, '');
  assert.equal(renderer.root.findByType('textarea').props.placeholder, en[CONTEXT_GUIDANCE_EXAMPLE]);
  assert.equal(renderer.root.findByType('textarea').props.maxLength, CONTEXT_ENHANCEMENT_GUIDANCE_MAX_LENGTH);
  const localizedExample = textOf(renderer.root.findByProps({ className: 'dim-contextTooltipExample' }));
  assert.equal(localizedExample, en[CONTEXT_GUIDANCE_EXAMPLE]);
  await click(renderer.root, 'Use example');
  assert.equal(renderer.root.findByType('textarea').props.value, localizedExample);
  await click(renderer.root, 'Clear');
  await act(async () => {
    renderer.root.findByType('textarea').props.onChange({ target: { value: 'x'.repeat(CONTEXT_ENHANCEMENT_GUIDANCE_MAX_LENGTH + 1) } });
  });
  await click(renderer.root, 'Save');
  assert.match(textOf(renderer.root.findByProps({ role: 'alert' })), /Guidance must not exceed 8000 characters/);
  assert.deepEqual(saved, []);
});

test('all nine APIs preserve canonical, empty, absent and damaged context configurations', () => {
  for (const channel of channels) {
    assert.equal(channel.endpoints.setContextEnhancement, 'bot.context-enhancement.set');
    const empty = { groupEnabled: true, directEnabled: false, fields: [], guidance: '' };
    const raw = snapshot(channel.name, [undefined, empty]);
    const normalized = channel.normalize(raw);
    assert.deepEqual(normalized.bots[0].contextEnhancement, DEFAULT_CONTEXT_ENHANCEMENT_CONFIG, channel.name);
    assert.deepEqual(normalized.bots[1].contextEnhancement, empty, channel.name);
    const canonical = channel.normalize(snapshot(channel.name, [{
      groupEnabled: false, directEnabled: true, fields: ['botId', 'channel', 'botId'], guidance: ' \n ',
    }]));
    assert.deepEqual(canonical.bots[0].contextEnhancement, {
      groupEnabled: false, directEnabled: true, fields: ['channel', 'botId'], guidance: '',
    }, channel.name);
    const damaged = channel.normalize(snapshot(channel.name, [{ groupEnabled: 'true', fields: ['secret'] }]));
    assert.equal(damaged.bots[0].contextEnhancement.groupEnabled, false, channel.name);
    assert.equal(damaged.bots[0].contextEnhancement.directEnabled, false, channel.name);
    assert.deepEqual(raw.bots[1].contextEnhancement, empty);
  }
});

test('all nine cards save through their existing RPC path, isolate bots and preserve explicit empty on reload', async (t) => {
  mockWindow(t);
  for (const channel of channels) await t.test(channel.name, async (t) => {
    let current = snapshot(channel.name);
    const calls = [];
    const rpcCall = async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      if (endpoint === 'connection.status') return { ok: true, value: current };
      assert.equal(endpoint, 'bot.context-enhancement.set');
      current = { ...current, revision: 2, bots: current.bots.map((bot) => bot.botId === payload.botId
        ? { ...bot, contextEnhancement: payload.config } : bot) };
      return { ok: true, value: current };
    };
    const renderer = await mount(t, channel.Settings, { rpcCall });
    const first = () => renderer.root.findByProps({ 'data-bot-id': `${channel.name}_0` });
    const second = () => renderer.root.findByProps({ 'data-bot-id': `${channel.name}_1` });
    const editors = first().findAll((node) => [WorkspaceEditor, AgentPresetEditor, ContextEnhancementEditor].includes(node.type));
    assert.deepEqual(editors.map((node) => node.type), [WorkspaceEditor, AgentPresetEditor, ContextEnhancementEditor]);
    assert.equal(badge(first()), '未开启');
    await open(first());
    await act(async () => { switches(first())[1].props.onChange({ target: { checked: true } }); });
    for (const name of CONTEXT_ENHANCEMENT_FIELDS) await act(async () => {
      first().findByProps({ name }).props.onChange({ target: { checked: false } });
    });
    await click(first(), '清空');
    assert.deepEqual(calls.map((call) => call.endpoint), ['connection.status']);
    assert.equal(badge(first()), '未开启');
    assert.equal(badge(second()), '未开启');
    await click(first(), '保存');
    const mutations = calls.filter((call) => call.endpoint !== 'connection.status');
    assert.deepEqual(mutations, [{ endpoint: 'bot.context-enhancement.set', payload: {
      botId: `${channel.name}_0`, config: { groupEnabled: false, directEnabled: true, fields: [], guidance: '' },
    } }]);
    assert.equal(badge(first()), '仅私聊');
    assert.equal(badge(second()), '未开启');
    assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
    assert.equal(current.bots[0].workspace, '/workspace/0');
    const reloaded = await mount(t, channel.Settings, { rpcCall });
    await open(reloaded.root.findByProps({ 'data-bot-id': `${channel.name}_0` }));
    assert.equal(reloaded.root.findByProps({ role: 'dialog' }).findByType('textarea').props.value, '');
    assert.ok(fields(reloaded.root).every((node) => !node.props.checked));
  });
});

test('all nine settings fence stale polls and reconcile against the actual saved response', async (t) => {
  const timers = mockWindow(t);
  for (const channel of channels) await t.test(channel.name, async (t) => {
    const oldRead = deferred();
    const original = snapshot(channel.name);
    let current = original;
    let reads = 0;
    const actual = { groupEnabled: false, directEnabled: true, fields: ['botId'], guidance: '' };
    const rpcCall = async (endpoint) => {
      if (endpoint === 'connection.status') {
        reads += 1;
        return reads === 2 ? oldRead.promise : { ok: true, value: current };
      }
      assert.equal(endpoint, 'bot.context-enhancement.set');
      current = snapshot(channel.name, [actual, undefined]);
      return { ok: true, value: current };
    };
    const renderer = await mount(t, channel.Settings, { rpcCall });
    await act(async () => { void timers.poll(); await flush(); });
    assert.equal(reads, 2);
    const first = () => renderer.root.findByProps({ 'data-bot-id': `${channel.name}_0` });
    await open(first());
    // The server response, not an optimistic copy of this draft, is authoritative.
    await click(first(), '保存');
    assert.equal(badge(first()), '仅私聊');
    oldRead.resolve({ ok: true, value: original });
    await act(async () => { await flush(); });
    assert.equal(badge(first()), '仅私聊');
    await open(first());
    assert.deepEqual(fields(first()).filter((node) => node.props.checked).map((node) => node.props.name), ['botId']);
    assert.equal(first().findByProps({ role: 'dialog' }).findByType('textarea').props.value, '');
  });
});

test('all nine settings ignore an older concurrent bot mutation after context settings are saved', async (t) => {
  mockWindow(t);
  for (const channel of channels) await t.test(channel.name, async (t) => {
    const reconnect = deferred();
    const original = snapshot(channel.name);
    let current = original;
    const rpcCall = async (endpoint, payload) => {
      if (endpoint === 'connection.status') return { ok: true, value: current };
      if (endpoint === 'bot.reconnect') return reconnect.promise;
      assert.equal(endpoint, 'bot.context-enhancement.set');
      current = snapshot(channel.name, [payload.config, undefined]);
      return { ok: true, value: current };
    };
    const renderer = await mount(t, channel.Settings, { rpcCall });
    const first = () => renderer.root.findByProps({ 'data-bot-id': `${channel.name}_0` });
    const second = renderer.root.findByProps({ 'data-bot-id': `${channel.name}_1` });
    await act(async () => { button(second, '检查连接').props.onClick(); await flush(); });
    await open(first());
    await act(async () => { switches(first())[1].props.onChange({ target: { checked: true } }); });
    await click(first(), '保存');
    assert.equal(badge(first()), '仅私聊');
    reconnect.resolve({ ok: true, value: original });
    await act(async () => { await flush(); });
    assert.equal(badge(first()), '仅私聊');
    assert.equal(first().findByProps({ className: 'dim-contextEntry' }).props.disabled, false);
  });
});

test('all nine failed save RPCs keep runtime state and drafts intact through status reconciliation', async (t) => {
  mockWindow(t);
  for (const channel of channels) await t.test(channel.name, async (t) => {
    const original = snapshot(channel.name);
    const calls = [];
    const rpcCall = async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      if (endpoint === 'connection.status') return { ok: true, value: original };
      assert.equal(endpoint, 'bot.context-enhancement.set');
      return { ok: false, error: { code: 'context-enhancement-invalid', message: 'Save rejected' } };
    };
    const renderer = await mount(t, channel.Settings, { rpcCall });
    const first = () => renderer.root.findByProps({ 'data-bot-id': `${channel.name}_0` });
    await open(first());
    await act(async () => { switches(first())[1].props.onChange({ target: { checked: true } }); });
    await click(first(), '清空');
    await click(first(), '保存');
    assert.equal(badge(first()), '未开启');
    assert.equal(switches(first())[1].props.checked, true);
    const dialog = first().findByProps({ role: 'dialog' });
    assert.equal(dialog.findByType('textarea').props.value, '');
    assert.ok(textOf(dialog.findByProps({ role: 'alert' })));
    assert.equal(original.bots[0].contextEnhancement, undefined);
    assert.equal(calls.filter((call) => call.endpoint !== 'connection.status').length, 1);
    await click(first(), '取消');
    await open(first());
    assert.equal(switches(first())[1].props.checked, false);
    assert.equal(first().findByProps({ role: 'dialog' }).findByType('textarea').props.value, '');
  });
});

test('the approved neutral entry and theme-aware modal keep responsive labels and touch targets', async () => {
  const styles = await readFile(new URL('../plugin-src/client/styles.js', import.meta.url), 'utf8');
  assert.match(styles, /\.dim-contextEntry \{[^}]*min-height: 40px;[^}]*minmax\(0, 1fr\)[^}]*border-radius: 8px;[^}]*font-size: 13px;/);
  assert.match(styles, /\.dim-contextStatus\[data-active="true"\] \{[^}]*--dsw-alias-state-business-primary/);
  assert.match(styles, /\.dim-contextDialog \{[^}]*width: min\(450px, 100%\);[^}]*overflow-y: auto;[^}]*border-radius: 12px;[^}]*--dsw-alias-bg-layer-3/);
  assert.match(styles, /\.dim-contextFields \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.dim-contextSwitches \{[^}]*grid-template-columns: 1fr;[^}]*gap: 2px;/);
  assert.match(styles, /\.dim-contextGuidance textarea \{[^}]*min-height: 88px;/);
  assert.match(styles, /\.dim-contextGuidance textarea::placeholder \{[^}]*--dsw-alias-label-tertiary[^}]*opacity: 1;/);
  assert.match(styles, /\.dim-contextFieldKey \{[^}]*ui-monospace/);
  assert.match(styles, /\.dim-contextFieldText \{[^}]*grid-template-columns: max-content max-content;[^}]*column-gap: 5px;/);
  assert.match(styles, /\.dim-contextTooltip\.dim-contextFieldTooltip \{[^}]*right: 0;[^}]*left: auto;/);
  assert.match(styles, /@media \(pointer: coarse\) \{\s*\.dim-contextEntry[^}]*min-height: 44px;/);
  assert.match(styles, /\.dim-contextLabel \{[^}]*overflow-wrap: anywhere;/);
  assert.match(styles, /\.dim-contextTooltip \{[^}]*opacity: 0;[^}]*visibility: hidden;/);
  assert.match(styles, /\.dim-contextTooltip\.dim-contextGuidanceTooltip \{[^}]*bottom: calc\(100% \+ 7px\);[^}]*overflow-y: auto;/);
  assert.match(styles, /\.dim-contextHeader \{[^}]*position: relative;/);
  assert.match(styles, /\.dim-contextLegend \{[^}]*position: relative;[^}]*inline-flex/);
  assert.match(styles, /\.dim-contextHelp:hover \.dim-contextTooltip, \.dim-contextHelp:focus-within \.dim-contextTooltip \{[^}]*opacity: 1;[^}]*visibility: visible;/);
  const office = await readFile(new URL('../plugin-src/client/channels/office/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(office, /ContextEnhancement|context-enhancement/);
});
