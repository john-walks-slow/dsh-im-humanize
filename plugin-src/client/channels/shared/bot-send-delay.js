/**
 * Per-bot humanization override editor, shared by every IM channel card.
 *
 * Exposes ALL humanization settings (streaming, messageBreak,
 * statusReaction, replyQuote, onNewMessage, typingIndicator,
 * typingBurst, sendDelay) for per-bot override. Each setting uses a
 * tri-state dropdown: the empty value means "follow global"; a specific
 * value means "custom override". typingBurst and sendDelay use a
 * "自定义" checkbox + the shared sub-forms.
 *
 * Field layout, hints, presets, and validation come from
 * humanize-fields.js — the SAME building blocks the global settings
 * panel renders — so the two surfaces cannot drift apart in detail or
 * format. Only the wrapper is per-bot specific: the follow-global /
 * custom gates, the override-count badge, and the channel capability
 * note.
 *
 * Data model (see src/channels/shared/humanize-override.mjs): the per-bot
 * humanize section is per-key — keys present in the section override the
 * resolved global defaults; keys absent inherit them. The editor saves
 * ONLY the custom keys (or null to clear everything). A custom sendDelay
 * is complete on write (the shared form always carries every subfield);
 * the prefill base is the override when one exists, otherwise the
 * resolved GLOBAL settings projected onto the snapshot as
 * `humanizeDefaults`, falling back to the shipped defaults.
 *
 * A mounted editor owns its draft: the 15-second silent status polling
 * rebuilds snapshot objects, and refreshes must not replace unsaved edits
 * (same convention as ContextEnhancementDialog). Re-sync happens only
 * while the draft is clean (never edited, or after a successful save).
 *
 * Checkable inputs are audited by scripts/verify-package.mjs — keep the
 * checkbox count here in sync with its manifest.
 */
import * as React from 'react';

import { h } from '../../i18n.js';
import {
  FieldError,
  HUMANIZE_SETTING_META,
  SEND_DELAY_PRESETS,
  SendDelayFields,
  SendDelayPresetSelect,
  TypingBurstFields,
  burstDraftFrom,
  draftFromConfig,
  resolvedHumanizeDefaults,
  validateBurstDraft,
  validateSendDelayDraft,
} from './humanize-fields.js';

// Channels without a typing/status API only get the delay, and their read
// delay is capped at SHORT_DELAY_CAP_MS (5s) by the bridges.
export const TYPING_CAPABILITY = Object.freeze({
  full: 'full',
  c2cOnly: 'c2c-only',
  none: 'none',
});

const BOOLEAN_KEYS = ['streaming', 'messageBreak', 'statusReaction', 'replyQuote'];
const ENUM_KEYS = ['onNewMessage', 'typingIndicator'];
const ALL_KEYS = [...BOOLEAN_KEYS, ...ENUM_KEYS, 'typingBurst', 'sendDelay'];

// ── per-key draft derivation ───────────────────────────────────────

function deriveDraft(humanize, defaults) {
  const ov = humanize && typeof humanize === 'object' ? humanize : {};
  const base = resolvedHumanizeDefaults(defaults);
  const draft = {};

  // Booleans and enums: tri-state dropdown value.
  // '' = follow global, 'true'/'false' = custom boolean, specific = custom enum
  for (const key of BOOLEAN_KEYS) {
    draft[key] = ov[key] !== undefined
      ? (ov[key] ? 'true' : 'false')
      : '';
  }
  for (const key of ENUM_KEYS) {
    draft[key] = ov[key] !== undefined ? ov[key] : '';
  }

  // typingBurst: checkbox + shared 4-field group
  draft.typingBurst = {
    custom: ov.typingBurst !== undefined,
    fields: burstDraftFrom(ov.typingBurst !== undefined ? ov.typingBurst : base.typingBurst),
  };

  // sendDelay: checkbox + shared full form
  const sdConfig = ov.sendDelay !== undefined
    ? ov.sendDelay
    : base.sendDelay;
  draft.sendDelay = {
    custom: ov.sendDelay !== undefined,
    fields: draftFromConfig(sdConfig),
  };

  return draft;
}

function countOverrides(humanize) {
  if (!humanize || typeof humanize !== 'object') return 0;
  return ALL_KEYS.filter((key) => humanize[key] !== undefined).length;
}

function overrideLabel(humanize) {
  const n = countOverrides(humanize);
  if (n === 0) return '跟随全局';
  return `已覆盖 ${n} 项`;
}

/**
 * Build the save payload from the draft. Returns a partial section
 * (only custom keys) or null (clear). Throws FieldError on validation
 * failure.
 */
function buildPayload(draft) {
  const payload = {};

  for (const key of BOOLEAN_KEYS) {
    if (draft[key] !== '') {
      payload[key] = draft[key] === 'true';
    }
  }
  for (const key of ENUM_KEYS) {
    if (draft[key] !== '') {
      payload[key] = draft[key];
    }
  }
  if (draft.typingBurst.custom) {
    payload.typingBurst = validateBurstDraft(draft.typingBurst.fields);
  }
  if (draft.sendDelay.custom) {
    payload.sendDelay = validateSendDelayDraft(draft.sendDelay.fields);
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

// ── UI helpers ────────────────────────────────────────────────────

function capabilityNote(capability) {
  if (capability === TYPING_CAPABILITY.none) {
    return '该渠道没有输入状态接口：仅发送延迟生效，阅读延迟封顶 5 秒。';
  }
  if (capability === TYPING_CAPABILITY.c2cOnly) {
    return '输入状态仅私聊可用；群聊没有输入状态，阅读延迟封顶 5 秒。';
  }
  return null;
}

function booleanLabel(value) {
  return value ? '开' : '关';
}

function enumLabel(key, value) {
  const options = HUMANIZE_SETTING_META[key]?.options ?? [];
  return options.find((option) => option.value === value)?.label ?? value;
}

// ── Main component ─────────────────────────────────────────────────

export function BotHumanizeEditor({
  humanize,
  humanizeDefaults = null,
  capability = TYPING_CAPABILITY.full,
  disabled = false,
  onSave,
}) {
  const defaults = resolvedHumanizeDefaults(humanizeDefaults);
  const [open, setOpen] = React.useState(false);
  const [presetKey, setPresetKey] = React.useState('');
  const [draft, setDraft] = React.useState(() => deriveDraft(humanize, humanizeDefaults));
  const [dirty, setDirty] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState(null);
  const [saveError, setSaveError] = React.useState(null);
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Re-sync after the parent refreshes the bot snapshot — but only while
  // the draft is clean. Silent 15s polling rebuilds snapshot objects with
  // fresh identities; a mounted editor owns its unsaved edits.
  React.useEffect(() => {
    if (dirty) return;
    setDraft(deriveDraft(humanize, humanizeDefaults));
  }, [humanize, humanizeDefaults, dirty]);

  const beginChange = () => {
    setFieldErrors(null);
    setSaveError(null);
    setSaved(false);
  };

  const updateDraft = (updater) => {
    beginChange();
    setDirty(true);
    setDraft((prev) => updater(prev));
  };

  const updateSelect = (key, value) => {
    updateDraft((prev) => ({ ...prev, [key]: value }));
  };

  const toggleCustom = (key, checked) => {
    updateDraft((prev) => ({
      ...prev,
      [key]: { ...prev[key], custom: checked },
    }));
  };

  const applyPreset = (key) => {
    setPresetKey(key);
    const preset = SEND_DELAY_PRESETS.find((candidate) => candidate.key === key);
    if (!preset) return;
    updateDraft((prev) => ({
      ...prev,
      sendDelay: { ...prev.sendDelay, fields: draftFromConfig(preset.config) },
    }));
  };

  const save = async () => {
    if (disabled || saving || typeof onSave !== 'function') return;
    beginChange();
    let payload;
    try {
      payload = buildPayload(draft);
    } catch (caught) {
      if (caught instanceof FieldError) {
        setFieldErrors({ [caught.field]: caught.message });
      } else {
        setSaveError(caught?.message ?? '配置无效，请检查后重试。');
      }
      return;
    }
    setSaving(true);
    try {
      await onSave(payload);
      setSaved(true);
      setDirty(false);
    } catch (caught) {
      setSaveError(caught?.message ?? '保存失败，请稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  const busy = disabled || saving;
  const note = capabilityNote(capability);

  // Whether the save button should say "清除覆盖" (payload is null and
  // an override exists) vs "保存" (payload is non-null).
  const hasOverride = countOverrides(humanize) > 0;
  const draftHasCustom = BOOLEAN_KEYS.some((key) => draft[key] !== '')
    || ENUM_KEYS.some((key) => draft[key] !== '')
    || draft.typingBurst.custom
    || draft.sendDelay.custom;

  return h('div', { className: 'dim-sendDelayEditor' },
    h('button', {
      type: 'button',
      className: 'dim-sendDelayToggle',
      'aria-expanded': open,
      onClick: () => setOpen((value) => !value),
      disabled,
    },
    h('span', { className: 'dim-sendDelayToggleLabel' }, '拟人化'),
    h('span', {
      className: 'dim-sendDelayToggleStatus',
      'data-active': hasOverride,
    }, overrideLabel(humanize)),
    h('span', { className: 'dim-sendDelayChevron', 'aria-hidden': 'true' }, open ? '▾' : '▸')),
    open ? h('div', { className: 'dim-sendDelayBody' },

      // ── Boolean toggles (tri-state dropdown) ──────────────────────
      ...BOOLEAN_KEYS.map((key) => {
        const meta = HUMANIZE_SETTING_META[key];
        return h('label', { key, className: 'dim-humanizeField dim-sendDelayField' },
          h('span', { className: 'dim-humanizeFieldRow' },
            h('select', {
              value: draft[key],
              disabled: busy,
              'aria-label': meta.label,
              onChange: (event) => updateSelect(key, event.target.value),
            },
            h('option', { value: '' },
              `跟随全局 (${booleanLabel(defaults[key])})`),
            h('option', { value: 'true' }, '开启'),
            h('option', { value: 'false' }, '关闭')),
            h('span', { className: 'dim-humanizeFieldName' }, meta.label)),
          h('span', { className: 'dim-humanizeFieldHint' }, meta.hint));
      }),

      // ── onNewMessage dropdown ─────────────────────────────────────
      h('label', { className: 'dim-humanizeField dim-sendDelayField' },
        h('span', { className: 'dim-humanizeFieldRow' },
          h('select', {
            value: draft.onNewMessage,
            disabled: busy,
            'aria-label': HUMANIZE_SETTING_META.onNewMessage.label,
            onChange: (event) => updateSelect('onNewMessage', event.target.value),
          },
          h('option', { value: '' },
            `跟随全局 (${enumLabel('onNewMessage', defaults.onNewMessage)})`),
          HUMANIZE_SETTING_META.onNewMessage.options.map((option) =>
            h('option', { key: option.value, value: option.value }, option.label))),
          h('span', { className: 'dim-humanizeFieldName' }, HUMANIZE_SETTING_META.onNewMessage.label)),
        h('span', { className: 'dim-humanizeFieldHint' }, HUMANIZE_SETTING_META.onNewMessage.hint)),

      // ── typingIndicator dropdown ─────────────────────────────────
      h('label', { className: 'dim-humanizeField dim-sendDelayField' },
        h('span', { className: 'dim-humanizeFieldRow' },
          h('select', {
            value: draft.typingIndicator,
            disabled: busy,
            'aria-label': HUMANIZE_SETTING_META.typingIndicator.label,
            onChange: (event) => updateSelect('typingIndicator', event.target.value),
          },
          h('option', { value: '' },
            `跟随全局 (${enumLabel('typingIndicator', defaults.typingIndicator)})`),
          HUMANIZE_SETTING_META.typingIndicator.options.map((option) =>
            h('option', { key: option.value, value: option.value }, option.label))),
          h('span', { className: 'dim-humanizeFieldName' }, HUMANIZE_SETTING_META.typingIndicator.label)),
        h('span', { className: 'dim-humanizeFieldHint' }, HUMANIZE_SETTING_META.typingIndicator.hint)),

      // ── typingBurst (gated by a custom checkbox) ──────────────────
      h('div', { className: 'dim-humanizeField dim-sendDelayField' },
        h('span', { className: 'dim-humanizeFieldRow' },
          h('input', {
            type: 'checkbox',
            checked: draft.typingBurst.custom,
            disabled: busy,
            'aria-label': '自定义断续节奏',
            onChange: (event) => toggleCustom('typingBurst', event.target.checked),
          }),
          h('span', { className: 'dim-humanizeFieldName' }, '断续节奏')),
        draft.typingBurst.custom
          ? h(TypingBurstFields, {
            draft: draft.typingBurst.fields,
            busy,
            errors: fieldErrors,
            onField: (field, value) => updateDraft((prev) => ({
              ...prev,
              typingBurst: {
                ...prev.typingBurst,
                fields: { ...prev.typingBurst.fields, [field]: value },
              },
            })),
          })
          : h('span', { className: 'dim-humanizeFieldHint' },
            `跟随全局（${defaults.typingBurst.onMinMs}–${defaults.typingBurst.onMaxMs}`
            + ` / ${defaults.typingBurst.offMinMs}–${defaults.typingBurst.offMaxMs} 毫秒）`)),

      // ── sendDelay (gated by a custom checkbox) ────────────────────
      h('div', { className: 'dim-humanizeField dim-sendDelayField' },
        h('span', { className: 'dim-humanizeFieldRow' },
          h('input', {
            type: 'checkbox',
            checked: draft.sendDelay.custom,
            disabled: busy,
            'aria-label': '自定义发送延迟',
            onChange: (event) => toggleCustom('sendDelay', event.target.checked),
          }),
          h('span', { className: 'dim-humanizeFieldName' }, '发送延迟')),
        draft.sendDelay.custom
          ? h('div', { className: 'dim-sendDelayFields' },
            h(SendDelayPresetSelect, {
              value: presetKey,
              disabled: busy,
              onChange: applyPreset,
            }),
            h(SendDelayFields, {
              draft: draft.sendDelay.fields,
              busy,
              errors: fieldErrors,
              onField: (field, value) => updateDraft((prev) => ({
                ...prev,
                sendDelay: {
                  ...prev.sendDelay,
                  fields: { ...prev.sendDelay.fields, [field]: value },
                },
              })),
            }),
            h('span', { className: 'dim-humanizeFieldHint dim-sendDelayNote' },
              '自定义项保存后固定为本页值；未自定义项继续跟随全局设置变化。'))
          : h('span', { className: 'dim-humanizeFieldHint' },
            `跟随全局（${defaults.sendDelay?.enabled === true ? '已启用' : '未启用'}）`)),

      note ? h('p', { className: 'dim-humanizeFieldHint dim-sendDelayNote' }, note) : null,

      // ── Save ──────────────────────────────────────────────────────
      h('div', { className: 'dim-humanizeActions' },
        h('button', {
          type: 'button',
          className: 'dim-deliveryButton dim-humanizeSave',
          'data-kind': 'primary',
          disabled: busy || (!dirty && !hasOverride),
          onClick: () => { void save(); },
        }, saving ? '保存中…' : (!draftHasCustom && hasOverride ? '清除覆盖' : '保存')),
        saved
          ? h('span', { className: 'dim-humanizeStatus', 'data-tone': 'success', role: 'status' }, '已保存')
          : null,
        saveError
          ? h('span', { className: 'dim-humanizeStatus', 'data-tone': 'error', role: 'alert' }, saveError)
          : null))
      : null);
}

/**
 * Deprecated alias for backward compatibility. New mount sites should
 * use BotHumanizeEditor with the `humanizeDefaults` prop (full global
 * settings object). This adapter accepts the old `sendDelayDefaults`
 * prop and projects it as `{ sendDelay }`.
 */
export function BotSendDelayEditor(props) {
  return h(BotHumanizeEditor, {
    ...props,
    humanizeDefaults: props.humanizeDefaults
      ?? (props.sendDelayDefaults ? { sendDelay: props.sendDelayDefaults } : null),
  });
}
