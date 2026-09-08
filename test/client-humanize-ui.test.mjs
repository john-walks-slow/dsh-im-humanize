import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import TestRenderer from 'react-test-renderer';

import { HumanizeSettingsPanel } from '../plugin-src/client/humanize-settings.js';
import {
  BotSendDelayEditor,
  TYPING_CAPABILITY,
} from '../plugin-src/client/channels/shared/bot-send-delay.js';
import { createTokenChannelApi } from '../plugin-src/client/channels/shared/token-api.js';
import { DEFAULT_SEND_DELAY_CONFIG } from '../src/channels/shared/send-delay.mjs';
import { DEFAULT_HUMANIZE_SETTINGS } from '../src/channels/shared/humanize-settings.mjs';

const { act, create } = TestRenderer;

function baseSettings() {
  return JSON.parse(JSON.stringify({
    ...DEFAULT_HUMANIZE_SETTINGS,
    sendDelay: { ...DEFAULT_SEND_DELAY_CONFIG },
  }));
}

async function renderPanel(rpcCall) {
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(HumanizeSettingsPanel, { rpcCall }));
  });
  return renderer;
}

// The follow/override radios and the activity-boost checkbox can both be
// unchecked; locate the mode radios by input type.
function findUncheckedRadio(renderer) {
  return renderer.root.findAll(
    (node) => node.props?.type === 'radio' && node.props.checked === false)[0];
}

function findByInputLabel(renderer, label) {
  return renderer.root.findAll((node) => Boolean(node.props))
    .filter((node) => node.props['aria-label'] === label)[0];
}

function allText(renderer) {
  const out = [];
  const walk = (node) => {
    if (typeof node === 'string') { out.push(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object' && Array.isArray(node.children)) {
      node.children.forEach(walk);
    }
  };
  walk(renderer.toJSON());
  return out.join('');
}

test('humanize global panel renders send-delay fields and typing indicator select', async () => {
  const settings = baseSettings();
  settings.sendDelay.readDelay = { minMs: 1000, maxMs: 6000 };
  const calls = [];
  const rpcCall = async (endpoint, payload) => {
    calls.push({ endpoint, payload });
    if (endpoint === 'humanize.get') return { ok: true, value: settings };
    return { ok: true, value: settings };
  };
  const renderer = await renderPanel(rpcCall);

  const readMin = findByInputLabel(renderer, '阅读延迟下限（秒）');
  const readMax = findByInputLabel(renderer, '阅读延迟上限（秒）');
  const gapMin = findByInputLabel(renderer, '分段间隔下限（秒）');
  const gapMax = findByInputLabel(renderer, '分段间隔上限（秒）');
  assert.ok(readMin && readMax && gapMin && gapMax, 'all four range inputs render');
  assert.equal(readMin.props.value, '1');
  assert.equal(readMax.props.value, '6');

  const typingSelect = renderer.root.findAll((node) =>
    node.props?.value === settings.typingIndicator && node.props?.onChange)[0];
  assert.ok(typingSelect, 'typing indicator select renders with the committed value');
  const optionValues = typingSelect.props.children.map((option) => option.props.value);
  assert.deepEqual(optionValues, ['off', 'continuous', 'burst']);

  // The no-typing cap hint is visible.
  const text = allText(renderer);
  assert.ok(text.includes('封顶 5 秒'), 'the 5s cap hint renders');
  assert.ok(text.includes('延迟会累积'), 'the queued-delay accumulation hint renders');

  // Activity boost: defaults render when the stored section omits it.
  const actFast = findByInputLabel(renderer, '快速回复延迟（秒）');
  assert.equal(actFast.props.value, '1');
  const actEnabled = renderer.root.findAll((node) =>
    node.props?.['aria-label'] === '启用活跃响应')[0];
  assert.equal(actEnabled.props.checked, true);
  const actFullWin = findByInputLabel(renderer, '完全恢复窗口（分钟）');
  assert.equal(actFullWin.props.value, '5');

  // Edit the read-delay upper bound (seconds -> ms) and save.
  await act(async () => {
    readMax.props.onChange({ target: { value: '8.5' } });
  });
  // The activity edit must land inside readDelay.activityBoost (a past
  // regression wrote it one level too high and silently did nothing).
  await act(async () => {
    actFast.props.onChange({ target: { value: '2.5' } });
  });
  const save = renderer.root.findByProps({ 'data-kind': 'primary' });
  await act(async () => {
    await save.props.onClick();
  });
  const setCall = calls.find((call) => call.endpoint === 'humanize.set');
  assert.ok(setCall, 'saving calls humanize.set');
  assert.equal(setCall.payload.sendDelay.readDelay.maxMs, 8500);
  assert.equal(setCall.payload.sendDelay.readDelay.minMs, 1000);
  assert.equal(setCall.payload.sendDelay.readDelay.activityBoost.fastReplyMs, 2500);
  assert.equal(setCall.payload.sendDelay.readDelay.activityBoost.enabled, true);
  assert.equal(setCall.payload.typingIndicator, settings.typingIndicator);
});

test('BotSendDelayEditor saves a complete per-bot sendDelay in milliseconds', async () => {
  const saved = [];
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(BotSendDelayEditor, {
      humanize: null,
      onSave: async (value) => { saved.push(value); },
    }));
  });

  const toggle = renderer.root.findByProps({ className: 'dim-sendDelayToggle' });
  assert.equal(toggle.props['aria-expanded'], false, 'starts collapsed');
  await act(async () => { toggle.props.onClick(); });
  assert.equal(toggle.props['aria-expanded'], true);

  // Follow-global with no override: save disabled.
  const saveButton = renderer.root.findByProps({ 'data-kind': 'primary' });
  assert.equal(saveButton.props.disabled, true);

  // Switch to override: prefilled defaults (feature off by default), then
  // enable it explicitly.
  const overrideRadio = findUncheckedRadio(renderer);
  await act(async () => { overrideRadio.props.onChange(); });

  const enabled = renderer.root.findAll((node) =>
    node.props?.type === 'checkbox')[0];
  assert.equal(enabled.props.checked, false, 'override draft starts from the shipped defaults');
  await act(async () => { enabled.props.onChange({ target: { checked: true } }); });
  const readMin = findByInputLabel(renderer, '阅读延迟下限（秒）');
  const readMax = findByInputLabel(renderer, '阅读延迟上限（秒）');
  await act(async () => { readMin.props.onChange({ target: { value: '2' } }); });
  await act(async () => { readMax.props.onChange({ target: { value: '7.5' } }); });
  const gapMin = findByInputLabel(renderer, '分段间隔下限（秒）');
  const gapMax = findByInputLabel(renderer, '分段间隔上限（秒）');
  await act(async () => { gapMin.props.onChange({ target: { value: '0.5' } }); });
  await act(async () => { gapMax.props.onChange({ target: { value: '1.5' } }); });

  await act(async () => {
    await renderer.root.findByProps({ 'data-kind': 'primary' }).props.onClick();
  });
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], {
    sendDelay: {
      enabled: true,
      readDelay: {
        minMs: 2000,
        maxMs: 7500,
        charsPerSecond: 0,
        maxTotalMs: 30000,
        activityBoost: {
          enabled: true, fastReplyMs: 1000, fastWindowMs: 60000,
          minWindowMs: 120000, fullWindowMs: 300000,
        },
      },
      segmentGap: {
        minMs: 500,
        maxMs: 1500,
        charsPerSecond: 0,
        maxTotalMs: 10000,
      },
    },
  });
});

test('BotSendDelayEditor preserves sibling override keys and clears on follow-global', async () => {
  const saved = [];
  const humanize = {
    typingIndicator: 'off',
    sendDelay: {
      enabled: true,
      readDelay: {
        minMs: 3000,
        maxMs: 4000,
        charsPerSecond: 10,
        maxTotalMs: 30000,
        activityBoost: { enabled: false, fastReplyMs: 1000, fastWindowMs: 60000, minWindowMs: 120000, fullWindowMs: 300000 },
      },
      segmentGap: { minMs: 500, maxMs: 1000, charsPerSecond: 0, maxTotalMs: 10000 },
    },
  };
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(BotSendDelayEditor, {
      humanize,
      onSave: async (value) => { saved.push(value); },
    }));
  });

  const status = renderer.root.findByProps({ className: 'dim-sendDelayToggleStatus' });
  assert.equal(status.props['data-active'], true, 'override is visible on the toggle');

  // Open the panel, then switch to follow-global: saving clears the whole
  // override.
  await act(async () => { renderer.root.findByProps({ className: 'dim-sendDelayToggle' }).props.onClick(); });

  // Re-saving the override keeps unrelated override keys (the section
  // replaces whole on the wire).
  const readMin = findByInputLabel(renderer, '阅读延迟下限（秒）');
  await act(async () => { readMin.props.onChange({ target: { value: '3.5' } }); });
  await act(async () => {
    await renderer.root.findByProps({ 'data-kind': 'primary' }).props.onClick();
  });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].typingIndicator, 'off');
  assert.equal(saved[0].sendDelay.readDelay.minMs, 3500);

  const followRadio = findUncheckedRadio(renderer);
  await act(async () => { followRadio.props.onChange(); });
  await act(async () => {
    await renderer.root.findByProps({ 'data-kind': 'primary' }).props.onClick();
  });
  assert.equal(saved.length, 2);
  assert.equal(saved[1], null, 'follow-global saves null and clears the override');
});

test('BotSendDelayEditor validates ranges before saving', async () => {
  const saved = [];
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(BotSendDelayEditor, {
      humanize: null,
      onSave: async (value) => { saved.push(value); },
    }));
  });
  await act(async () => { renderer.root.findByProps({ className: 'dim-sendDelayToggle' }).props.onClick(); });
  await act(async () => { findUncheckedRadio(renderer).props.onChange(); });

  const readMin = findByInputLabel(renderer, '阅读延迟下限（秒）');
  const readMax = findByInputLabel(renderer, '阅读延迟上限（秒）');
  // min > max
  await act(async () => { readMin.props.onChange({ target: { value: '9' } }); });
  await act(async () => { readMax.props.onChange({ target: { value: '2' } }); });
  await act(async () => {
    await renderer.root.findByProps({ 'data-kind': 'primary' }).props.onClick();
  });
  assert.equal(saved.length, 0, 'min>max must not save');
  assert.ok(renderer.root.findByProps({ role: 'alert' }).children.includes('阅读延迟下限不能超过上限。'));

  // above the absolute cap
  await act(async () => { readMin.props.onChange({ target: { value: '0' } }); });
  await act(async () => { readMax.props.onChange({ target: { value: '301' } }); });
  await act(async () => {
    await renderer.root.findByProps({ 'data-kind': 'primary' }).props.onClick();
  });
  assert.equal(saved.length, 0, 'over-cap must not save');
  assert.ok(renderer.root.findByProps({ role: 'alert' }).children.includes('阅读延迟上限不能超过 300 秒。'));

  // empty field
  await act(async () => { readMax.props.onChange({ target: { value: '' } }); });
  await act(async () => {
    await renderer.root.findByProps({ 'data-kind': 'primary' }).props.onClick();
  });
  assert.equal(saved.length, 0, 'empty field must not save');
});

test('BotSendDelayEditor surfaces the no-typing capability note', async () => {
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(BotSendDelayEditor, {
      humanize: null,
      capability: TYPING_CAPABILITY.none,
      onSave: async () => {},
    }));
  });
  await act(async () => { renderer.root.findByProps({ className: 'dim-sendDelayToggle' }).props.onClick(); });
  assert.ok(allText(renderer).includes('没有输入状态接口'),
    'the no-typing note renders');
});

test('token channel snapshot normalization carries per-bot humanize through', () => {
  const api = createTokenChannelApi('Telegram', ' Bot API 长轮询');
  const snapshot = {
    revision: 3,
    bots: [{
      botId: 'tg-1',
      connected: true,
      state: 'connected',
      bot: { name: 'Bot', username: 'test_bot' },
      health: { summary: 'ok' },
      humanize: {
        typingIndicator: 'off',
        sendDelay: {
          enabled: true,
          readDelay: { minMs: 1000, maxMs: 2000 },
          segmentGap: { minMs: 200, maxMs: 800 },
        },
      },
    }],
  };
  const normalized = api.normalizeSnapshot({ snapshot });
  assert.equal(normalized.bots[0].humanize.typingIndicator, 'off');
  assert.equal(normalized.bots[0].humanize.sendDelay.readDelay.maxMs, 2000);
  // The resolved global sendDelay rides along at snapshot level for the
  // per-bot editor prefill.
  const withDefaults = api.normalizeSnapshot({
    snapshot: {
      ...snapshot,
      humanizeDefaults: { sendDelay: { enabled: true, readDelay: { minMs: 30000 } } },
    },
  });
  assert.equal(withDefaults.humanizeDefaults.sendDelay.readDelay.minMs, 30000);
  assert.equal(api.normalizeSnapshot({ snapshot }).humanizeDefaults, undefined,
    'absent defaults stay absent');
  // Malformed overrides are leniently repaired (disk repair contract):
  // an invalid enabled flag drops and the rest fills with defaults.
  const broken = api.normalizeSnapshot({
    snapshot: {
      revision: 3,
      bots: [{
        botId: 'tg-2', connected: true, state: 'connected',
        bot: { name: 'Bot' }, health: { summary: 'ok' },
        humanize: { sendDelay: { enabled: 'yes please' }, streaming: 42 },
      }],
    },
  });
  assert.equal(broken.bots[0].humanize.sendDelay.enabled, false);
  assert.equal(broken.bots[0].humanize.streaming, undefined);
});

test('BotSendDelayEditor keeps unsaved drafts across snapshot refreshes', async () => {
  const saved = [];
  const makeHumanize = (minMs) => ({
    sendDelay: {
      enabled: true,
      readDelay: {
        minMs, maxMs: minMs + 1000, charsPerSecond: 0, maxTotalMs: 30000,
        activityBoost: { enabled: true, fastReplyMs: 1000, fastWindowMs: 60000, minWindowMs: 120000, fullWindowMs: 300000 },
      },
      segmentGap: { minMs: 500, maxMs: 2000, charsPerSecond: 0, maxTotalMs: 10000 },
    },
  });
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(BotSendDelayEditor, {
      humanize: makeHumanize(1000),
      onSave: async (value) => { saved.push(value); },
    }));
  });
  await act(async () => { renderer.root.findByProps({ className: 'dim-sendDelayToggle' }).props.onClick(); });

  // Simulate an unsaved edit followed by a 15s silent poll that rebuilds
  // the snapshot object (fresh identity, same values): the draft must win.
  const readMin = findByInputLabel(renderer, '阅读延迟下限（秒）');
  await act(async () => { readMin.props.onChange({ target: { value: '42' } }); });
  await act(async () => {
    renderer.update(React.createElement(BotSendDelayEditor, {
      humanize: makeHumanize(1000),
      onSave: async (value) => { saved.push(value); },
    }));
  });
  const afterPoll = findByInputLabel(renderer, '阅读延迟下限（秒）');
  assert.equal(afterPoll.props.value, '42', 'a mounted editor owns its draft');

  // Mode switches survive polling too (the reviewer-reported rollback).
  await act(async () => { findUncheckedRadio(renderer).props.onChange(); });
  await act(async () => {
    renderer.update(React.createElement(BotSendDelayEditor, {
      humanize: makeHumanize(1000),
      onSave: async (value) => { saved.push(value); },
    }));
  });
  assert.equal(saved.length, 0);
  const saveButton = renderer.root.findByProps({ 'data-kind': 'primary' });
  assert.equal(saveButton.props.children, '清除覆盖', 'unsaved mode switch survives polling');

  // After a successful save the editor re-syncs from the fresh snapshot.
  await act(async () => { saveButton.props.onClick(); });
  assert.equal(saved.length, 1);
  assert.equal(saved[0], null);
  await act(async () => {
    renderer.update(React.createElement(BotSendDelayEditor, {
      humanize: null,
      onSave: async (value) => { saved.push(value); },
    }));
  });
  assert.equal(renderer.root.findByProps({ className: 'dim-sendDelayToggleStatus' }).props.children,
    '跟随全局', 'clean editor follows the refreshed snapshot');
});

test('BotSendDelayEditor prefills an override from the resolved global defaults', async () => {
  const saved = [];
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(BotSendDelayEditor, {
      humanize: null,
      sendDelayDefaults: {
        enabled: true,
        readDelay: {
          minMs: 30000, maxMs: 60000, charsPerSecond: 8, maxTotalMs: 120000,
          activityBoost: { enabled: true, fastReplyMs: 2500, fastWindowMs: 90000, minWindowMs: 300000, fullWindowMs: 900000 },
        },
        segmentGap: { minMs: 2000, maxMs: 6000, charsPerSecond: 10, maxTotalMs: 30000 },
      },
      onSave: async (value) => { saved.push(value); },
    }));
  });
  await act(async () => { renderer.root.findByProps({ className: 'dim-sendDelayToggle' }).props.onClick(); });
  await act(async () => { findUncheckedRadio(renderer).props.onChange(); });

  const readMin = findByInputLabel(renderer, '阅读延迟下限（秒）');
  assert.equal(readMin.props.value, '30', 'prefill comes from the global config, not factory defaults');
  const readCps = findByInputLabel(renderer, '阅读速度（字/秒，0 关闭）');
  assert.equal(readCps.props.value, '8');
  const actFast = findByInputLabel(renderer, '快速回复延迟（秒）');
  assert.equal(actFast.props.value, '2.5', 'fast reply prefills from the global config');
  const actFastWin = findByInputLabel(renderer, '秒回窗口（分钟）');
  assert.equal(actFastWin.props.value, '1.5');
  const actFullWin = findByInputLabel(renderer, '完全恢复窗口（分钟）');
  assert.equal(actFullWin.props.value, '15');

  const checkboxes = renderer.root.findAll((node) => node.props?.type === 'checkbox');
  assert.equal(checkboxes.length, 2, 'enable + activity boost checkboxes');
  await act(async () => { checkboxes[0].props.onChange({ target: { checked: true } }); });
  await act(async () => {
    await renderer.root.findByProps({ 'data-kind': 'primary' }).props.onClick();
  });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].sendDelay.readDelay.minMs, 30000);
  assert.equal(saved[0].sendDelay.readDelay.activityBoost.fastReplyMs, 2500);
  assert.equal(saved[0].sendDelay.readDelay.activityBoost.enabled, true);
  assert.equal(saved[0].sendDelay.segmentGap.charsPerSecond, 10);
});
