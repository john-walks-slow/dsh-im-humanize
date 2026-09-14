import * as React from 'react';

import { h } from './i18n.js';
import {
  FieldError,
  HUMANIZE_SETTING_META,
  SEND_DELAY_PRESETS,
  SendDelayFields,
  SendDelayPresetSelect,
  TypingBurstFields,
  burstDraftFrom,
  draftFromConfig,
  validateBurstDraft,
  validateSendDelayDraft,
} from './channels/shared/humanize-fields.js';

// These constants are duplicated in plugin-src/host/humanize-rpc.mjs and
// src/channels/shared/humanize-settings.mjs to avoid importing Node.js
// built-in modules into the browser bundle.
export const HUMANIZE_RPC_CHANNEL = '/dsh-im-humanize';
export const HUMANIZE_SETTINGS_TAB_ID = 'humanize-settings';
export const HUMANIZE_ENDPOINTS = Object.freeze({
  get: 'humanize.get',
  set: 'humanize.set',
});

const BOOLEAN_SETTING_KEYS = ['streaming', 'messageBreak', 'statusReaction', 'replyQuote'];

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
  // String drafts for the two structured settings — the SAME draft shape
  // and validation the per-bot editor uses (see humanize-fields.js), so
  // field layout, hints, and error messages are identical on both
  // surfaces. Serialized into the wire config on save.
  const [sdDraft, setSdDraft] = React.useState(() => draftFromConfig(null));
  const [burstDraft, setBurstDraft] = React.useState(() => burstDraftFrom(null));
  const [fieldErrors, setFieldErrors] = React.useState(null);
  const [presetKey, setPresetKey] = React.useState('');
  const [saveError, setSaveError] = React.useState(null);
  const [saveSucceeded, setSaveSucceeded] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const mounted = React.useRef(true);
  const saving = React.useRef(false);

  const invoke = React.useCallback(async (endpoint, payload = {}, signal) => {
    if (typeof rpcCall !== 'function') throw new Error('拟人化设置暂不可用。');
    return unwrapRpcResult(await rpcCall(endpoint, payload, signal));
  }, [rpcCall]);

  const adoptSettings = (value) => {
    setSettings(value);
    setSdDraft(draftFromConfig(value?.sendDelay));
    setBurstDraft(burstDraftFrom(value?.typingBurst));
  };

  const loadSettings = React.useCallback(async ({ signal } = {}) => {
    setPhase('loading');
    setLoadError(null);
    try {
      const value = await invoke(HUMANIZE_ENDPOINTS.get, {}, signal);
      if (signal?.aborted || !mounted.current) return;
      adoptSettings(value);
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
    setSaveSucceeded(false);
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updateSdField = (field, value) => {
    setSaveSucceeded(false);
    setSdDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateBurstField = (field, value) => {
    setSaveSucceeded(false);
    setBurstDraft((prev) => ({ ...prev, [field]: value }));
  };

  const applyPreset = (key) => {
    setPresetKey(key);
    const preset = SEND_DELAY_PRESETS.find((item) => item.key === key);
    if (!preset) return;
    setSaveSucceeded(false);
    setSdDraft(draftFromConfig(preset.config));
  };

  const save = async () => {
    if (phase !== 'ready' || saving.current) return;
    let sendDelay;
    let typingBurst;
    try {
      sendDelay = validateSendDelayDraft(sdDraft);
      typingBurst = validateBurstDraft(burstDraft);
    } catch (caught) {
      if (caught instanceof FieldError) {
        setFieldErrors({ [caught.field]: caught.message });
      } else {
        setSaveError(presentError(caught, '配置无效，请检查后重试。'));
      }
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setSaveError(null);
    setSaveSucceeded(false);
    setFieldErrors(null);
    try {
      const updated = await invoke(HUMANIZE_ENDPOINTS.set, {
        ...settings,
        sendDelay,
        typingBurst,
      });
      if (!mounted.current) return;
      adoptSettings(updated);
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

      // Boolean toggles (labels + hints from the shared metadata — the
      // same texts the per-bot editor shows).
      ...BOOLEAN_SETTING_KEYS.map((key) => {
        const meta = HUMANIZE_SETTING_META[key];
        return h('label', { key, className: 'dim-humanizeField' },
          h('span', { className: 'dim-humanizeFieldRow' },
            h('input', {
              type: 'checkbox',
              checked: settings[key] !== false,
              onChange: (e) => updateField(key, e.target.checked),
            }),
            h('span', { className: 'dim-humanizeFieldName' }, meta.label)),
          h('span', { className: 'dim-humanizeFieldHint' }, meta.hint));
      }),

      // onNewMessage dropdown
      h('label', { className: 'dim-humanizeField' },
        h('span', { className: 'dim-humanizeFieldName' }, HUMANIZE_SETTING_META.onNewMessage.label),
        h('select', {
          value: settings.onNewMessage,
          onChange: (e) => updateField('onNewMessage', e.target.value),
        },
        HUMANIZE_SETTING_META.onNewMessage.options.map((opt) =>
          h('option', { key: opt.value, value: opt.value }, opt.label),
        )),
        h('span', { className: 'dim-humanizeFieldHint' }, HUMANIZE_SETTING_META.onNewMessage.hint),
      ),

      // Send delay — the shared field group (identical layout, hints,
      // and validation to the per-bot editor's custom sendDelay form).
      h('div', { className: 'dim-humanizeBlockHead' },
        h('span', { className: 'dim-humanizeFieldName' }, '发送延迟（全局默认）'),
        h(SendDelayPresetSelect, {
          value: presetKey,
          disabled: isSaving,
          onChange: applyPreset,
        })),
      h(SendDelayFields, {
        draft: sdDraft,
        busy: isSaving,
        errors: fieldErrors,
        onField: updateSdField,
      }),
      h('span', { className: 'dim-humanizeFieldHint' },
        '钉钉、企业微信、飞书、Slack 等无输入状态接口的渠道只有延迟生效，且阅读延迟封顶 5 秒。'),

      // Typing indicator (phase ②: compose)
      h('label', { className: 'dim-humanizeField' },
        h('span', { className: 'dim-humanizeFieldName' }, HUMANIZE_SETTING_META.typingIndicator.label),
        h('select', {
          value: settings.typingIndicator,
          onChange: (e) => updateField('typingIndicator', e.target.value),
        },
        HUMANIZE_SETTING_META.typingIndicator.options.map((opt) =>
          h('option', { key: opt.value, value: opt.value }, opt.label),
        )),
        h('span', { className: 'dim-humanizeFieldHint' }, HUMANIZE_SETTING_META.typingIndicator.hint),
      ),
      h('details', { className: 'dim-humanizeAdvanced' },
        h('summary', null, '断续节奏高级参数'),
        h(TypingBurstFields, {
          draft: burstDraft,
          busy: isSaving,
          errors: fieldErrors,
          onField: updateBurstField,
        })),
      h('span', { className: 'dim-humanizeFieldHint dim-humanizePerBotHint' },
        '按机器人单独覆盖任意拟人化设置：在各渠道的机器人卡片“拟人化”中设置。'),

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
