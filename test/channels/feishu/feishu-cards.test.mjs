import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cardActionProbeCard,
  menuCard,
  menuHelpText,
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

test('menu exposes the increased command set and keeps repair number-only', () => {
  const card = JSON.parse(menuCard());
  assert.match(JSON.stringify(card), /6 · 修复卡片按钮/);
  const actions = buttons(card).flatMap((button) => (
    button.behaviors?.map((behavior) => behavior?.value?.action) ?? []
  ));
  assert.deepEqual(actions, [
    'new', 'sessions', 'workspaces', 'stop', 'compact',
    'watchlist', 'status', 'settings', 'help',
  ]);
  // 修复不占位按钮：仅通过数字兜底「6」触发（见 bridge）
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
