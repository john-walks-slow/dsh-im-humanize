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
