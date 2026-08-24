import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cardActionProbeCard,
  customSteerCard,
  menuCard,
  menuHelpText,
  modelCard,
} from '../../../src/channels/feishu/feishu-cards.mjs';

function buttons(value, result = []) {
  if (Array.isArray(value)) {
    for (const item of value) buttons(item, result);
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  if (value.tag === 'button') result.push(value);
  for (const child of Object.values(value)) buttons(child, result);
  return result;
}

function selects(value, result = []) {
  if (Array.isArray(value)) {
    for (const item of value) selects(item, result);
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  if (value.tag === 'select_static') result.push(value);
  for (const child of Object.values(value)) selects(child, result);
  return result;
}

function forms(value, result = []) {
  if (Array.isArray(value)) {
    for (const item of value) forms(item, result);
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  if (value.tag === 'form') result.push(value);
  for (const child of Object.values(value)) forms(child, result);
  return result;
}

test('menu exposes the increased command set and keeps repair number-only', () => {
  const card = JSON.parse(menuCard());
  assert.match(JSON.stringify(card), /\*\*5\*\*\S*修复/);
  const actions = buttons(card).flatMap((button) => (
    button.behaviors?.map((behavior) => behavior?.value?.action) ?? []
  ));
  assert.deepEqual(actions, [
    'presets', 'models', 'new', 'sessions', 'workspaces',
    'stop', 'compact', 'archive_toggle', 'status', 'help',
  ]);
  // 修复不占位按钮：仅通过数字兜底「5🔧」触发（见 bridge）
  assert.equal(actions.includes('repair'), false);
});

test('menu help advertises Agent Preset commands', () => {
  const help = menuHelpText();
  assert.match(help, /\/presetlist/);
  assert.match(help, /\/preset \[序号或完整ID\]/);
  assert.match(help, /\/preset id:<ID>/);
  assert.match(help, /\/preset --default/);
});

test('card-action probe carries only its action and opaque nonce', () => {
  const nonce = '0123456789abcdef0123456789abcdef';
  const card = JSON.parse(cardActionProbeCard(nonce));
  const probe = buttons(card)[0];
  assert.deepEqual(probe.behaviors, [{
    type: 'callback',
    value: { action: 'repair_verify', nonce },
  }]);
  assert.throws(() => cardActionProbeCard('{{client_id}}'), /safe card-action probe nonce/);
});

test('custom steer card wraps input and submit in a form container', () => {
  const card = JSON.parse(customSteerCard());
  const form = forms(card)[0];
  assert.ok(form, 'custom steer card must contain a form container');
  assert.equal(form.name, 'steer_form');
  const inputs = buttons(form).filter((element) => element.tag === 'input');
  // inputs are not buttons; scan form.elements directly
  const input = form.elements.find((element) => element.tag === 'input');
  assert.equal(input?.name, 'steer_text');
  const submit = form.elements.find((element) => element.tag === 'button');
  assert.equal(submit?.form_action_type, 'submit');
  assert.deepEqual(submit?.behaviors, [{
    type: 'callback',
    value: { action: 'steer', source: 'form' },
  }]);
  // 表单外的返回菜单按钮仍保留
  const back = buttons(card).find((b) => b.behaviors?.[0]?.value?.action === 'back_to_menu');
  assert.ok(back);
});

test('menu session dropdown highlights the currently bound session via initial_index', () => {
  const sessions = [
    { id: 'session-1', title: 'First' },
    { id: 'session-2', title: 'Second' },
    { id: 'session-3', title: 'Third' },
  ];
  const card = JSON.parse(menuCard({
    currentSession: { id: 'session-2', title: 'Second' },
    sessions,
  }));
  const pick = selects(card).find((s) => s.name === 'session_pick');
  assert.ok(pick, 'menu must render a session dropdown');
  // initial_index is 1-based; the currently bound session sits at index 2.
  assert.equal(pick.initial_index, 2);
});

test('model card dropdown highlights the current model via initial_index', () => {
  const catalog = {
    groups: [
      { id: 'openrouter', name: 'OpenRouter', models: [
        { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' },
      ] },
    ],
    current: { provider: 'openrouter', model: 'deepseek/deepseek-chat' },
  };
  const card = JSON.parse(modelCard(catalog));
  const pick = selects(card).find((s) => s.name === 'model_pick');
  assert.ok(pick, 'model card must render a dropdown');
  // deepseek/deepseek-chat is the second option (1-based index 2), even
  // though the id itself contains a `/`.
  assert.equal(pick.initial_index, 2);
});
