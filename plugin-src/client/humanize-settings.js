import * as React from 'react';

import { h } from './i18n.js';

// These constants are duplicated in plugin-src/host/humanize-rpc.mjs and
// src/channels/shared/humanize-settings.mjs to avoid importing Node.js
// built-in modules into the browser bundle.
export const HUMANIZE_RPC_CHANNEL = '/dsh-im-humanize';
export const HUMANIZE_SETTINGS_TAB_ID = 'humanize-settings';
export const HUMANIZE_ENDPOINTS = Object.freeze({
  get: 'humanize.get',
  set: 'humanize.set',
});

const ON_NEW_MESSAGE_OPTIONS = [
  { value: 'interrupt', label: '打断重发 (interrupt)' },
  { value: 'queue', label: '排队等待 (queue)' },
  { value: 'steer', label: '注入纠偏 (steer)' },
];

const TYPING_INDICATOR_OPTIONS = [
  { value: 'off', label: '关闭' },
  { value: 'continuous', label: '持续' },
  { value: 'burst', label: '断续' },
];

const READ_DELAY_MAX_SECONDS = 300;
const SEGMENT_GAP_MAX_SECONDS = 30;
const CHARS_PER_SECOND_MAX = 1000;
const IDLE_AFTER_MAX_MINUTES = 1440;
const IDLE_MULTIPLIER_MAX = 10;
const TYPING_BURST_MAX_MS = 30000;

// Exploration presets (plan §5.1/§7.1): fill the send-delay fields for
// further tweaking; nothing is saved until 保存.
const SEND_DELAY_PRESETS = Object.freeze([
  {
    key: 'light',
    label: '轻拟人',
    config: {
      enabled: true,
      readDelay: { minMs: 1000, maxMs: 6000, charsPerSecond: 0, maxTotalMs: 30000, idleBoost: { afterMs: 600000, multiplier: 2 } },
      segmentGap: { minMs: 500, maxMs: 2000, charsPerSecond: 0, maxTotalMs: 10000 },
    },
  },
  {
    key: 'slow',
    label: '慢性子',
    config: {
      enabled: true,
      readDelay: { minMs: 5000, maxMs: 15000, charsPerSecond: 12, maxTotalMs: 60000, idleBoost: { afterMs: 300000, multiplier: 2.5 } },
      segmentGap: { minMs: 1500, maxMs: 4000, charsPerSecond: 15, maxTotalMs: 20000 },
    },
  },
  {
    key: 'immersive',
    label: '沉浸角色扮演',
    config: {
      enabled: true,
      readDelay: { minMs: 8000, maxMs: 30000, charsPerSecond: 8, maxTotalMs: 120000, idleBoost: { afterMs: 300000, multiplier: 3 } },
      segmentGap: { minMs: 2000, maxMs: 6000, charsPerSecond: 10, maxTotalMs: 30000 },
    },
  },
  {
    key: 'instant',
    label: '即刻应答',
    config: {
      enabled: true,
      readDelay: { minMs: 0, maxMs: 500, charsPerSecond: 0, maxTotalMs: 30000, idleBoost: { afterMs: 600000, multiplier: 1 } },
      segmentGap: { minMs: 1000, maxMs: 3000, charsPerSecond: 12, maxTotalMs: 10000 },
    },
  },
]);

function secondsInputValue(ms) {
  return String(Number.isFinite(ms) && ms > 0 ? Math.round(ms) / 1000 : 0);
}

function minutesInputValue(ms) {
  return String(Number.isFinite(ms) && ms > 0 ? Math.round(ms / 6000) / 10 : 0);
}

function rateInputValue(value) {
  return String(Number.isFinite(value) && value > 0 ? Math.round(value * 10) / 10 : 0);
}

function msInputValue(ms) {
  return String(Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0);
}

function presentError(error, fallback) {
  return error?.message || fallback;
}

function unwrapRpcResult(result) {
  if (result?.ok === true) return result.value;
  if (result?.ok === false) {
    const error = new Error(result.error?.message || '请求失败，请稍后重试。');
    error.code = result.error?.code;
    throw error;
  }
  return result;
}

export function HumanizeSettingsPanel({ rpcCall }) {
  const [phase, setPhase] = React.useState('loading');
  const [loadError, setLoadError] = React.useState(null);
  const [settings, setSettings] = React.useState(null);
  const [saveError, setSaveError] = React.useState(null);
  const [saveSucceeded, setSaveSucceeded] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const mounted = React.useRef(true);
  const saving = React.useRef(false);

  const invoke = React.useCallback(async (endpoint, payload = {}, signal) => {
    if (typeof rpcCall !== 'function') throw new Error('拟人化设置暂不可用。');
    return unwrapRpcResult(await rpcCall(endpoint, payload, signal));
  }, [rpcCall]);

  const loadSettings = React.useCallback(async ({ signal } = {}) => {
    setPhase('loading');
    setLoadError(null);
    try {
      const value = await invoke(HUMANIZE_ENDPOINTS.get, {}, signal);
      if (signal?.aborted || !mounted.current) return;
      setSettings(value);
      setPhase('ready');
    } catch (caught) {
      if (signal?.aborted || caught?.name === 'AbortError' || !mounted.current) return;
      setLoadError(presentError(caught, '无法读取拟人化设置，请稍后重试。'));
      setPhase('error');
    }
  }, [invoke]);

  React.useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void loadSettings({ signal: controller.signal });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [loadSettings]);

  const updateField = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaveSucceeded(false);
  };

  // Update one sendDelay number field (ms on the wire, seconds in inputs).
  const updateSendDelayMs = (group, field, seconds) => {
    setSaveSucceeded(false);
    const numeric = Number(seconds);
    const ms = Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 1000) : 0;
    setSettings((prev) => ({
      ...prev,
      sendDelay: {
        ...prev.sendDelay,
        [group]: { ...prev.sendDelay?.[group], [field]: ms },
      },
    }));
  };

  // A per-second rate (chars/second); 0 disables the term.
  const updateSendDelayRate = (group, field, raw) => {
    setSaveSucceeded(false);
    const numeric = Number(raw);
    const rate = Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 10) / 10 : 0;
    setSettings((prev) => ({
      ...prev,
      sendDelay: {
        ...prev.sendDelay,
        [group]: { ...prev.sendDelay?.[group], [field]: rate },
      },
    }));
  };

  // Idle boost: threshold in minutes on the wire in ms; multiplier
  // unitless (1 = off).
  const updateIdleAfterMs = (minutes) => {
    setSaveSucceeded(false);
    const numeric = Number(minutes);
    const ms = Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 60000) : 0;
    setSettings((prev) => ({
      ...prev,
      sendDelay: {
        ...prev.sendDelay,
        idleBoost: { ...prev.sendDelay?.idleBoost, afterMs: ms },
      },
    }));
  };

  const updateIdleMultiplier = (raw) => {
    setSaveSucceeded(false);
    const numeric = Number(raw);
    const multiplier = Number.isFinite(numeric) && numeric >= 1 ? Math.round(numeric * 10) / 10 : 1;
    setSettings((prev) => ({
      ...prev,
      sendDelay: {
        ...prev.sendDelay,
        idleBoost: { ...prev.sendDelay?.idleBoost, multiplier },
      },
    }));
  };

  // typingBurst rhythm fields (milliseconds).
  const updateTypingBurstMs = (field, raw) => {
    setSaveSucceeded(false);
    const numeric = Number(raw);
    const ms = Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
    setSettings((prev) => ({
      ...prev,
      typingBurst: { ...prev.typingBurst, [field]: ms },
    }));
  };

  const [presetKey, setPresetKey] = React.useState('');
  const applyPreset = (key) => {
    const preset = SEND_DELAY_PRESETS.find((item) => item.key === key);
    if (!preset) return;
    setSaveSucceeded(false);
    setSettings((prev) => ({
      ...prev,
      sendDelay: {
        enabled: preset.config.enabled,
        readDelay: { ...preset.config.readDelay, idleBoost: { ...preset.config.readDelay.idleBoost } },
        segmentGap: { ...preset.config.segmentGap },
      },
    }));
  };

  const save = async () => {
    if (phase !== 'ready' || saving.current) return;
    saving.current = true;
    setIsSaving(true);
    setSaveError(null);
    setSaveSucceeded(false);
    try {
      const updated = await invoke(HUMANIZE_ENDPOINTS.set, settings);
      if (!mounted.current) return;
      setSettings(updated);
      setSaveSucceeded(true);
    } catch (caught) {
      if (!mounted.current) return;
      setSaveError(presentError(caught, '保存失败，请稍后重试。'));
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  if (phase === 'loading') {
    return h('div', { className: 'dim-globalSection dim-humanizeSettings--loading' },
      h('p', null, '正在加载…'));
  }

  if (phase === 'error') {
    return h('div', { className: 'dim-globalSection' },
      h('p', { className: 'dim-humanizeStatus', 'data-tone': 'error', role: 'alert' }, loadError),
      h('div', { className: 'dim-humanizeActions' },
        h('button', {
          type: 'button',
          className: 'dim-deliveryButton',
          onClick: () => void loadSettings(),
        }, '重试')));
  }

  if (!settings) {
    return h('div', { className: 'dim-globalSection' },
      h('p', { className: 'dim-humanizeStatus' }, '暂无可用设置。'));
  }

  return h('section', { className: 'dim-generalSettingsPage dim-humanizeSettings' },
    h('header', { className: 'dim-generalSettingsHeader' },
      h('h2', null, '拟人化设置')),
    h('section', { className: 'dim-globalSection' },
      h('p', { className: 'dim-humanizeDesc' },
        '控制 AI 回复的发送方式，让对话更像真人交流。'),

      // Streaming toggle
      h('label', { className: 'dim-humanizeField' },
        h('span', { className: 'dim-humanizeFieldRow' },
          h('input', {
            type: 'checkbox',
            checked: settings.streaming,
            onChange: (e) => updateField('streaming', e.target.checked),
          }),
          h('span', { className: 'dim-humanizeFieldName' }, '流式回复')),
        h('span', { className: 'dim-humanizeFieldHint' },
          '开启后 AI 回复逐字显示。关闭后一次性发送完整回复，更有沉浸感。'),
      ),

      // Message break toggle
      h('label', { className: 'dim-humanizeField' },
        h('span', { className: 'dim-humanizeFieldRow' },
          h('input', {
            type: 'checkbox',
            checked: settings.messageBreak,
            onChange: (e) => updateField('messageBreak', e.target.checked),
          }),
          h('span', { className: 'dim-humanizeFieldName' }, '分步消息 (message_break)')),
        h('span', { className: 'dim-humanizeFieldHint' },
          'AI 调用 message_break 工具在回复中插入断点，每个分段作为独立消息发送。可与流式回复同时开启。'),
      ),

      // onNewMessage dropdown
      h('label', { className: 'dim-humanizeField' },
        h('span', { className: 'dim-humanizeFieldName' }, '新消息行为'),
        h('select', {
          value: settings.onNewMessage,
          onChange: (e) => updateField('onNewMessage', e.target.value),
        },
        ON_NEW_MESSAGE_OPTIONS.map((opt) =>
          h('option', { key: opt.value, value: opt.value }, opt.label),
        )),
        h('span', { className: 'dim-humanizeFieldHint' },
          '生成中收到新消息时的处理方式：打断重发、排队等待、或注入为纠偏指令。交互等待时一律排队。'),
      ),

      // Send delay (phase ①: read latency)
      h('div', { className: 'dim-humanizeBlockHead' },
        h('span', { className: 'dim-humanizeFieldName' }, '发送延迟（全局默认）'),
        h('select', {
          className: 'dim-humanizePresetSelect',
          value: presetKey,
          'aria-label': '探索预设',
          onChange: (e) => {
            setPresetKey(e.target.value);
            applyPreset(e.target.value);
          },
        },
        h('option', { value: '' }, '探索预设…'),
        SEND_DELAY_PRESETS.map((preset) =>
          h('option', { key: preset.key, value: preset.key }, preset.label)))),
      h('label', { className: 'dim-humanizeField' },
        h('span', { className: 'dim-humanizeFieldRow' },
          h('input', {
            type: 'checkbox',
            checked: settings.sendDelay?.enabled === true,
            onChange: (e) => {
              setSaveSucceeded(false);
              setSettings((prev) => ({
                ...prev,
                sendDelay: { ...prev.sendDelay, enabled: e.target.checked },
              }));
            },
          }),
          h('span', { className: 'dim-humanizeFieldName' }, '启用发送延迟')),
        h('span', { className: 'dim-humanizeFieldHint' },
          '两阶段拟人化：先静默“稍后才读到消息”，再开始处理；排队等待的多条消息延迟会累积。'),
      ),
      h('div', { className: 'dim-humanizeRangeRow' },
        h('span', { className: 'dim-humanizeRangeName' }, '阅读延迟（秒）'),
        h('span', { className: 'dim-humanizeRangeInputs' },
          h('input', {
            type: 'number', min: 0, max: READ_DELAY_MAX_SECONDS, step: 0.1,
            value: secondsInputValue(settings.sendDelay?.readDelay?.minMs),
            'aria-label': '阅读延迟下限（秒）',
            onChange: (e) => updateSendDelayMs('readDelay', 'minMs', e.target.value),
          }),
          h('span', { className: 'dim-humanizeRangeSep', 'aria-hidden': 'true' }, '–'),
          h('input', {
            type: 'number', min: 0, max: READ_DELAY_MAX_SECONDS, step: 0.1,
            value: secondsInputValue(settings.sendDelay?.readDelay?.maxMs),
            'aria-label': '阅读延迟上限（秒）',
            onChange: (e) => updateSendDelayMs('readDelay', 'maxMs', e.target.value),
          }))),
      h('div', { className: 'dim-humanizeRangeRow' },
        h('span', { className: 'dim-humanizeRangeName' }, '阅读速度（字/秒）'),
        h('span', { className: 'dim-humanizeRangeInputs' },
          h('input', {
            type: 'number', min: 0, max: CHARS_PER_SECOND_MAX, step: 0.5,
            value: String(secondsInputValue(settings.sendDelay?.readDelay?.charsPerSecond)),
            'aria-label': '阅读速度（字/秒，0 关闭）',
            onChange: (e) => updateSendDelayRate('readDelay', 'charsPerSecond', e.target.value),
          }),
          h('span', { className: 'dim-humanizeRangeSep', 'aria-hidden': 'true' }, '·'),
          h('span', { className: 'dim-humanizeRangeName' }, '单回合封顶（秒）'),
          h('input', {
            type: 'number', min: 0, max: READ_DELAY_MAX_SECONDS, step: 1,
            value: secondsInputValue(settings.sendDelay?.readDelay?.maxTotalMs),
            'aria-label': '阅读延迟单回合封顶（秒）',
            onChange: (e) => updateSendDelayMs('readDelay', 'maxTotalMs', e.target.value),
          }))),
      h('span', { className: 'dim-humanizeFieldHint' },
        '用户消息越长“读”得越久（0 关闭按长度计算）；单回合阅读延迟的硬上限。'),
      h('div', { className: 'dim-humanizeRangeRow' },
        h('span', { className: 'dim-humanizeRangeName' }, '闲置加成'),
        h('span', { className: 'dim-humanizeRangeInputs' },
          h('span', { className: 'dim-humanizeRangeName' }, '闲置 ≥'),
          h('input', {
            type: 'number', min: 0, max: IDLE_AFTER_MAX_MINUTES, step: 1,
            value: String(minutesInputValue(settings.sendDelay?.readDelay?.idleBoost?.afterMs)),
            'aria-label': '闲置阈值（分钟）',
            onChange: (e) => updateIdleAfterMs(e.target.value),
          }),
          h('span', { className: 'dim-humanizeRangeSep', 'aria-hidden': 'true' }, '分钟 → 延迟 ×'),
          h('input', {
            type: 'number', min: 1, max: IDLE_MULTIPLIER_MAX, step: 0.5,
            value: String(rateInputValue(settings.sendDelay?.readDelay?.idleBoost?.multiplier)),
            'aria-label': '闲置加成倍数',
            onChange: (e) => updateIdleMultiplier(e.target.value),
          }))),
      h('span', { className: 'dim-humanizeFieldHint' },
        '会话闲置超过阈值后，阅读延迟乘以该倍数；倍数为 1 即关闭。'),
      h('div', { className: 'dim-humanizeRangeRow' },
        h('span', { className: 'dim-humanizeRangeName' }, '分段间隔（秒）'),
        h('span', { className: 'dim-humanizeRangeInputs' },
          h('input', {
            type: 'number', min: 0, max: SEGMENT_GAP_MAX_SECONDS, step: 0.1,
            value: secondsInputValue(settings.sendDelay?.segmentGap?.minMs),
            'aria-label': '分段间隔下限（秒）',
            onChange: (e) => updateSendDelayMs('segmentGap', 'minMs', e.target.value),
          }),
          h('span', { className: 'dim-humanizeRangeSep', 'aria-hidden': 'true' }, '–'),
          h('input', {
            type: 'number', min: 0, max: SEGMENT_GAP_MAX_SECONDS, step: 0.1,
            value: secondsInputValue(settings.sendDelay?.segmentGap?.maxMs),
            'aria-label': '分段间隔上限（秒）',
            onChange: (e) => updateSendDelayMs('segmentGap', 'maxMs', e.target.value),
          })),
        h('span', { className: 'dim-humanizeFieldHint' },
          '分段间隔是分段回复之间“正在打下一条”的停顿；阅读延迟是收到消息后的静默时间。'),
      ),
      h('div', { className: 'dim-humanizeRangeRow' },
        h('span', { className: 'dim-humanizeRangeName' }, '分段打字速度（字/秒）'),
        h('span', { className: 'dim-humanizeRangeInputs' },
          h('input', {
            type: 'number', min: 0, max: CHARS_PER_SECOND_MAX, step: 0.5,
            value: rateInputValue(settings.sendDelay?.segmentGap?.charsPerSecond),
            'aria-label': '分段打字速度（字/秒，0 关闭）',
            onChange: (e) => updateSendDelayRate('segmentGap', 'charsPerSecond', e.target.value),
          }),
          h('span', { className: 'dim-humanizeRangeSep', 'aria-hidden': 'true' }, '·'),
          h('span', { className: 'dim-humanizeRangeName' }, '封顶（秒）'),
          h('input', {
            type: 'number', min: 0, max: SEGMENT_GAP_MAX_SECONDS, step: 1,
            value: secondsInputValue(settings.sendDelay?.segmentGap?.maxTotalMs),
            'aria-label': '分段间隔封顶（秒）',
            onChange: (e) => updateSendDelayMs('segmentGap', 'maxTotalMs', e.target.value),
          }))),
      h('span', { className: 'dim-humanizeFieldHint' },
        '按下一分段长度折算“正在打下一条”的时间（0 关闭）；分段间隔的硬上限。'),
      h('span', { className: 'dim-humanizeFieldHint' },
        '钉钉、企业微信、飞书、Slack 等无输入状态接口的渠道只有延迟生效，且阅读延迟封顶 5 秒。'),

      // Typing indicator (phase ②: compose)
      h('label', { className: 'dim-humanizeField' },
        h('span', { className: 'dim-humanizeFieldName' }, '输入状态指示'),
        h('select', {
          value: settings.typingIndicator,
          onChange: (e) => updateField('typingIndicator', e.target.value),
        },
        TYPING_INDICATOR_OPTIONS.map((opt) =>
          h('option', { key: opt.value, value: opt.value }, opt.label),
        )),
        h('span', { className: 'dim-humanizeFieldHint' },
          '处理开始后显示“正在输入”的方式：持续显示，或像真人一样时断时续（断续）。无对应接口的渠道自动忽略此项。'),
      ),
      h('details', { className: 'dim-humanizeAdvanced' },
        h('summary', null, '断续节奏高级参数'),
        h('div', { className: 'dim-humanizeRangeRow' },
          h('span', { className: 'dim-humanizeRangeName' }, '亮相（毫秒）'),
          h('span', { className: 'dim-humanizeRangeInputs' },
            h('input', {
              type: 'number', min: 0, max: TYPING_BURST_MAX_MS, step: 100,
              value: String(msInputValue(settings.typingBurst?.onMinMs)),
              'aria-label': '亮相最短（毫秒）',
              onChange: (e) => updateTypingBurstMs('onMinMs', e.target.value),
            }),
            h('span', { className: 'dim-humanizeRangeSep', 'aria-hidden': 'true' }, '–'),
            h('input', {
              type: 'number', min: 0, max: TYPING_BURST_MAX_MS, step: 100,
              value: String(msInputValue(settings.typingBurst?.onMaxMs)),
              'aria-label': '亮相最长（毫秒）',
              onChange: (e) => updateTypingBurstMs('onMaxMs', e.target.value),
            }))),
        h('div', { className: 'dim-humanizeRangeRow' },
          h('span', { className: 'dim-humanizeRangeName' }, '灭相（毫秒）'),
          h('span', { className: 'dim-humanizeRangeInputs' },
            h('input', {
              type: 'number', min: 0, max: TYPING_BURST_MAX_MS, step: 100,
              value: String(msInputValue(settings.typingBurst?.offMinMs)),
              'aria-label': '灭相最短（毫秒）',
              onChange: (e) => updateTypingBurstMs('offMinMs', e.target.value),
            }),
            h('span', { className: 'dim-humanizeRangeSep', 'aria-hidden': 'true' }, '–'),
            h('input', {
              type: 'number', min: 0, max: TYPING_BURST_MAX_MS, step: 100,
              value: String(msInputValue(settings.typingBurst?.offMaxMs)),
              'aria-label': '灭相最长（毫秒）',
              onChange: (e) => updateTypingBurstMs('offMaxMs', e.target.value),
            }))),
        h('span', { className: 'dim-humanizeFieldHint' },
          '断续模式下“正在输入”亮起与熄灭的可见时长范围；平台显示残余由插件自动补足，无需在此考虑。'),
      ),
      h('span', { className: 'dim-humanizeFieldHint dim-humanizePerBotHint' },
        '按机器人单独覆盖发送延迟：在各渠道的机器人卡片“发送延迟”中设置。'),

      // Save button
      h('div', { className: 'dim-humanizeActions' },
        h('button', {
          type: 'button',
          className: 'dim-deliveryButton dim-humanizeSave',
          'data-kind': 'primary',
          disabled: isSaving,
          onClick: () => void save(),
        }, isSaving ? '保存中…' : '保存'),
        saveSucceeded
          ? h('span', { className: 'dim-humanizeStatus', 'data-tone': 'success', role: 'status' }, '已保存')
          : null,
        saveError
          ? h('span', { className: 'dim-humanizeStatus', 'data-tone': 'error', role: 'alert' }, saveError)
          : null,
      ),
    ),
  );
}
