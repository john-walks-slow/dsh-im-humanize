/**
 * Per-bot send-delay override editor, shared by every IM channel card.
 *
 * Data model (see src/channels/shared/humanize-override.mjs): the per-bot
 * humanize section REPLACES the whole override when written, so the
 * editor round-trips the full section — non-sendDelay keys present in the
 * snapshot are preserved, and the follow-global action clears the entire
 * override with an explicit confirmation label.
 *
 * The per-bot sendDelay is complete on write (enabled + readDelay +
 * segmentGap with every subfield, matching the global panel field groups);
 * the prefill base is the override when one exists, otherwise the resolved
 * GLOBAL sendDelay projected onto the snapshot as
 * `humanizeDefaults.sendDelay`, falling back to the shipped defaults.
 * UI values are seconds (minutes for the activity windows) / per-second
 * rates; the wire format is milliseconds.
 *
 * A mounted editor owns its draft: the 15-second silent status polling
 * rebuilds snapshot objects, and refreshes must not replace unsaved edits
 * (same convention as ContextEnhancementDialog). Re-sync happens only
 * while the draft is clean (never edited, or after a successful save).
 *
 * Checkable inputs are audited by scripts/verify-package.mjs — keep the
 * two checkboxes here in sync with its manifest.
 */
import * as React from 'react';

import { h } from '../../i18n.js';
import { DEFAULT_SEND_DELAY_CONFIG } from '../../../../src/channels/shared/send-delay.mjs';

export const READ_DELAY_MAX_SECONDS = 300;
export const SEGMENT_GAP_MAX_SECONDS = 30;
const CHARS_PER_SECOND_MAX = 1000;
const ACTIVITY_FAST_REPLY_MAX_SECONDS = 60;
const ACTIVITY_WINDOW_MAX_MINUTES = 1440;

// Channels without a typing/status API only get the delay, and their read
// delay is capped at SHORT_DELAY_CAP_MS (5s) by the bridges.
export const TYPING_CAPABILITY = Object.freeze({
  full: 'full',
  c2cOnly: 'c2c-only',
  none: 'none',
});

const OVERRIDE_KEYS = ['streaming', 'messageBreak', 'statusReaction', 'replyQuote', 'onNewMessage', 'typingIndicator', 'typingBurst'];

function sendDelayOverride(humanize) {
  return humanize && typeof humanize === 'object'
    && humanize.sendDelay && typeof humanize.sendDelay === 'object'
    ? humanize.sendDelay
    : null;
}

function globalSendDelayDefaults(defaults) {
  return defaults && typeof defaults === 'object' ? defaults : null;
}

function secondsOf(ms) {
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms) / 1000 : 0;
}

function minutesOf(ms) {
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 6000) / 10 : 0;
}

function rateOf(value) {
  return Number.isFinite(value) && value > 0 ? Math.round(value * 10) / 10 : 0;
}

function draftFromConfig(config) {
  // Caps and idle boost fall back to the shipped defaults when the source
  // config omits them (hand-edited disk sections): the resolver normalizes
  // those the same way, and a zero prefill would dead-end the cross-field
  // cap >= max validation.
  const activity = config.readDelay?.activityBoost
    ?? DEFAULT_SEND_DELAY_CONFIG.readDelay.activityBoost;
  return {
    enabled: config.enabled === true,
    readMin: String(secondsOf(config.readDelay?.minMs)),
    readMax: String(secondsOf(config.readDelay?.maxMs)),
    readCps: String(rateOf(config.readDelay?.charsPerSecond)),
    readCap: String(secondsOf(
      config.readDelay?.maxTotalMs ?? DEFAULT_SEND_DELAY_CONFIG.readDelay.maxTotalMs)),
    actOn: activity.enabled !== false,
    actFast: String(secondsOf(activity.fastReplyMs)),
    actFastWin: String(minutesOf(activity.fastWindowMs)),
    actMinWin: String(minutesOf(activity.minWindowMs)),
    actFullWin: String(minutesOf(activity.fullWindowMs)),
    gapMin: String(secondsOf(config.segmentGap?.minMs)),
    gapMax: String(secondsOf(config.segmentGap?.maxMs)),
    gapCps: String(rateOf(config.segmentGap?.charsPerSecond)),
    gapCap: String(secondsOf(
      config.segmentGap?.maxTotalMs ?? DEFAULT_SEND_DELAY_CONFIG.segmentGap.maxTotalMs)),
  };
}

class FieldError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

function parseSeconds(value, { field, label, max }) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FieldError(field, `请填写${label}。`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new FieldError(field, `${label}必须是不小于 0 的数字。`);
  }
  if (parsed > max) {
    throw new FieldError(field, `${label}不能超过 ${max} 秒。`);
  }
  return Math.round(parsed * 1000);
}

function parseMinutes(value, { field, label, max }) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FieldError(field, `请填写${label}。`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new FieldError(field, `${label}必须是不小于 0 的数字。`);
  }
  if (parsed > max) {
    throw new FieldError(field, `${label}不能超过 ${max} 分钟。`);
  }
  return Math.round(parsed * 60000);
}

function parseRate(value, { field, label, max, min = 0 }) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FieldError(field, `请填写${label}。`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new FieldError(field, `${label}必须是不小于 ${min} 的数字。`);
  }
  if (parsed > max) {
    throw new FieldError(field, `${label}不能超过 ${max}。`);
  }
  return Math.round(parsed * 10) / 10;
}

function validateDraft(draft) {
  const readMinMs = parseSeconds(draft.readMin, { field: 'readMin', label: '阅读延迟下限', max: READ_DELAY_MAX_SECONDS });
  const readMaxMs = parseSeconds(draft.readMax, { field: 'readMax', label: '阅读延迟上限', max: READ_DELAY_MAX_SECONDS });
  if (readMinMs > readMaxMs) {
    throw new FieldError('readMin', '阅读延迟下限不能超过上限。');
  }
  const readCps = parseRate(draft.readCps, { field: 'readCps', label: '阅读速度', max: CHARS_PER_SECOND_MAX });
  const readCapMs = parseSeconds(draft.readCap, { field: 'readCap', label: '阅读延迟封顶', max: READ_DELAY_MAX_SECONDS });
  if (readCapMs < readMaxMs) {
    throw new FieldError('readCap', '阅读延迟封顶不能低于上限。');
  }
  const activityFastMs = parseSeconds(draft.actFast, {
    field: 'actFast', label: '快速回复', max: ACTIVITY_FAST_REPLY_MAX_SECONDS,
  });
  const activityFastWinMs = parseMinutes(draft.actFastWin, {
    field: 'actFastWin', label: '秒回窗口', max: ACTIVITY_WINDOW_MAX_MINUTES,
  });
  const activityMinWinMs = parseMinutes(draft.actMinWin, {
    field: 'actMinWin', label: '恢复下限窗口', max: ACTIVITY_WINDOW_MAX_MINUTES,
  });
  const activityFullWinMs = parseMinutes(draft.actFullWin, {
    field: 'actFullWin', label: '完全恢复窗口', max: ACTIVITY_WINDOW_MAX_MINUTES,
  });
  if (activityFastWinMs > activityMinWinMs || activityMinWinMs > activityFullWinMs) {
    throw new FieldError('actFastWin', '活跃响应窗口需依次递增：秒回 ≤ 恢复下限 ≤ 完全恢复。');
  }
  const gapMinMs = parseSeconds(draft.gapMin, { field: 'gapMin', label: '分段间隔下限', max: SEGMENT_GAP_MAX_SECONDS });
  const gapMaxMs = parseSeconds(draft.gapMax, { field: 'gapMax', label: '分段间隔上限', max: SEGMENT_GAP_MAX_SECONDS });
  if (gapMinMs > gapMaxMs) {
    throw new FieldError('gapMin', '分段间隔下限不能超过上限。');
  }
  const gapCps = parseRate(draft.gapCps, { field: 'gapCps', label: '分段打字速度', max: CHARS_PER_SECOND_MAX });
  const gapCapMs = parseSeconds(draft.gapCap, { field: 'gapCap', label: '分段间隔封顶', max: SEGMENT_GAP_MAX_SECONDS });
  if (gapCapMs < gapMaxMs) {
    throw new FieldError('gapCap', '分段间隔封顶不能低于上限。');
  }
  return {
    enabled: draft.enabled === true,
    readDelay: {
      minMs: readMinMs,
      maxMs: readMaxMs,
      charsPerSecond: readCps,
      maxTotalMs: readCapMs,
      activityBoost: {
        enabled: draft.actOn === true,
        fastReplyMs: activityFastMs,
        fastWindowMs: activityFastWinMs,
        minWindowMs: activityMinWinMs,
        fullWindowMs: activityFullWinMs,
      },
    },
    segmentGap: {
      minMs: gapMinMs,
      maxMs: gapMaxMs,
      charsPerSecond: gapCps,
      maxTotalMs: gapCapMs,
    },
  };
}

function capabilityNote(capability) {
  if (capability === TYPING_CAPABILITY.none) {
    return '该渠道没有输入状态接口：仅发送延迟生效，阅读延迟封顶 5 秒。';
  }
  if (capability === TYPING_CAPABILITY.c2cOnly) {
    return '输入状态仅私聊可用；群聊没有输入状态，阅读延迟封顶 5 秒。';
  }
  return null;
}

function formatSecondsLabel(ms) {
  return String(Math.round(ms) / 1000);
}

function overrideLabel(section) {
  if (!section) return '跟随全局';
  if (section.enabled === false) return '已覆盖·未启用';
  const { readDelay } = section;
  if (!Number.isFinite(readDelay?.minMs) || !Number.isFinite(readDelay?.maxMs)) return '已覆盖';
  const min = formatSecondsLabel(readDelay.minMs);
  const max = formatSecondsLabel(readDelay.maxMs);
  return `已覆盖 ${min}–${max} 秒`;
}

/** One labeled number input (advanced single-value fields). */
function NumberField({ label, value, max, step = 0.1, min = 0, disabled, ariaLabel, error, onChange }) {
  return h('label', { className: 'dim-sendDelayAdvancedField' },
    h('span', { className: 'dim-sendDelayRangeName' }, label),
    h('input', {
      type: 'number',
      min, max, step,
      value,
      disabled,
      'aria-label': ariaLabel,
      onChange: (event) => onChange(event.target.value),
    }),
    error || null);
}

export function BotSendDelayEditor({
  humanize,
  sendDelayDefaults = null,
  capability = TYPING_CAPABILITY.full,
  disabled = false,
  onSave,
}) {
  const current = sendDelayOverride(humanize);
  const defaults = globalSendDelayDefaults(sendDelayDefaults);
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState(current ? 'override' : 'follow');
  const [draft, setDraft] = React.useState(
    () => draftFromConfig(current ?? defaults ?? DEFAULT_SEND_DELAY_CONFIG));
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
    setMode(current ? 'override' : 'follow');
    setDraft(draftFromConfig(current ?? defaults ?? DEFAULT_SEND_DELAY_CONFIG));
  }, [current, defaults, dirty]);

  const beginChange = () => {
    setFieldErrors(null);
    setSaveError(null);
    setSaved(false);
  };

  const setModeAndDraft = (nextMode) => {
    beginChange();
    setDirty(true);
    setMode(nextMode);
    if (nextMode === 'override' && !current) {
      setDraft(draftFromConfig(defaults ?? DEFAULT_SEND_DELAY_CONFIG));
    }
  };

  const updateDraft = (key, value) => {
    beginChange();
    setDirty(true);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (disabled || saving || typeof onSave !== 'function') return;
    beginChange();
    if (mode === 'follow') {
      setSaving(true);
      try {
        await onSave(null);
        setSaved(true);
        setDirty(false);
      } catch (caught) {
        setSaveError(caught?.message ?? '保存失败，请稍后重试。');
      } finally {
        setSaving(false);
      }
      return;
    }
    let payload;
    try {
      payload = validateDraft(draft);
    } catch (caught) {
      if (caught instanceof FieldError) {
        setFieldErrors({ [caught.field]: caught.message });
      } else {
        setSaveError(caught?.message ?? '配置无效，请检查后重试。');
      }
      return;
    }
    // Preserve any other override keys: the section replaces whole.
    const rest = {};
    for (const key of OVERRIDE_KEYS) {
      if (humanize && typeof humanize === 'object' && humanize[key] !== undefined) {
        rest[key] = humanize[key];
      }
    }
    setSaving(true);
    try {
      await onSave({ ...rest, sendDelay: payload });
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
  const fieldError = (field) => fieldErrors?.[field]
    ? h('span', { className: 'dim-sendDelayFieldError', role: 'alert' }, fieldErrors[field])
    : null;

  return h('div', { className: 'dim-sendDelayEditor' },
    h('button', {
      type: 'button',
      className: 'dim-sendDelayToggle',
      'aria-expanded': open,
      onClick: () => setOpen((value) => !value),
      disabled,
    },
    h('span', { className: 'dim-sendDelayToggleLabel' }, '发送延迟'),
    h('span', {
      className: 'dim-sendDelayToggleStatus',
      'data-active': Boolean(current),
    }, overrideLabel(current)),
    h('span', { className: 'dim-sendDelayChevron', 'aria-hidden': 'true' }, open ? '▾' : '▸')),
    open ? h('div', { className: 'dim-sendDelayBody' },
      h('div', { className: 'dim-sendDelayModes', role: 'radiogroup', 'aria-label': '发送延迟模式' },
        h('label', { className: 'dim-sendDelayMode' },
          h('input', {
            type: 'radio',
            name: 'send-delay-mode',
            checked: mode === 'follow',
            disabled: busy,
            onChange: () => setModeAndDraft('follow'),
          }),
          '跟随全局'),
        h('label', { className: 'dim-sendDelayMode' },
          h('input', {
            type: 'radio',
            name: 'send-delay-mode',
            checked: mode === 'override',
            disabled: busy,
            onChange: () => setModeAndDraft('override'),
          }),
          '自定义覆盖')),

      mode === 'override' ? h('div', { className: 'dim-sendDelayFields' },
        h('label', { className: 'dim-humanizeField dim-sendDelayField' },
          h('span', { className: 'dim-humanizeFieldRow' },
            h('input', {
              type: 'checkbox',
              checked: draft.enabled,
              disabled: busy,
              onChange: (event) => updateDraft('enabled', event.target.checked),
            }),
            h('span', { className: 'dim-humanizeFieldName' }, '启用发送延迟')),
          h('span', { className: 'dim-humanizeFieldHint' },
            '开启后，机器人收到消息先静默一段时间再处理，模拟真人稍后才读到消息。')),
        h('div', { className: 'dim-sendDelayRange' },
          h('span', { className: 'dim-sendDelayRangeName' }, '阅读延迟（秒）'),
          h('span', { className: 'dim-sendDelayRangeInputs' },
            h('input', {
              type: 'number', min: 0, max: READ_DELAY_MAX_SECONDS, step: 0.1,
              value: draft.readMin,
              disabled: busy,
              'aria-label': '阅读延迟下限（秒）',
              onChange: (event) => updateDraft('readMin', event.target.value),
            }),
            h('span', { className: 'dim-sendDelayRangeSep', 'aria-hidden': 'true' }, '–'),
            h('input', {
              type: 'number', min: 0, max: READ_DELAY_MAX_SECONDS, step: 0.1,
              value: draft.readMax,
              disabled: busy,
              'aria-label': '阅读延迟上限（秒）',
              onChange: (event) => updateDraft('readMax', event.target.value),
            })),
          fieldError('readMin') || fieldError('readMax'),
          h('span', { className: 'dim-humanizeFieldHint' },
            '收到消息后到开始处理之间的静默时间，按用户消息长度还会略有增加。')),
        h('div', { className: 'dim-sendDelayAdvanced' },
          h(NumberField, {
            label: '阅读速度（字/秒）', ariaLabel: '阅读速度（字/秒，0 关闭）',
            value: draft.readCps, max: CHARS_PER_SECOND_MAX, disabled: busy,
            error: fieldError('readCps'),
            onChange: (value) => updateDraft('readCps', value),
          }),
          h(NumberField, {
            label: '阅读延迟封顶（秒）', ariaLabel: '阅读延迟单回合封顶（秒）',
            value: draft.readCap, max: READ_DELAY_MAX_SECONDS, disabled: busy,
            error: fieldError('readCap'),
            onChange: (value) => updateDraft('readCap', value),
          })),
        h('label', { className: 'dim-humanizeField dim-sendDelayField' },
          h('span', { className: 'dim-humanizeFieldRow' },
            h('input', {
              type: 'checkbox',
              checked: draft.actOn,
              disabled: busy,
              'aria-label': '启用活跃响应',
              onChange: (event) => updateDraft('actOn', event.target.checked),
            }),
            h('span', { className: 'dim-humanizeFieldName' }, '活跃响应')),
          h('span', { className: 'dim-humanizeFieldHint' },
            '刚聊完天时“秒回”，闲置越久越接近完整延迟区间。')),
        h('div', { className: 'dim-sendDelayAdvanced dim-sendDelayActivity' },
          h(NumberField, {
            label: '快速回复（秒）', ariaLabel: '快速回复延迟（秒）',
            value: draft.actFast, max: ACTIVITY_FAST_REPLY_MAX_SECONDS, step: 0.5, disabled: busy,
            error: fieldError('actFast'),
            onChange: (value) => updateDraft('actFast', value),
          }),
          h(NumberField, {
            label: '秒回窗口（分钟）', ariaLabel: '秒回窗口（分钟）',
            value: draft.actFastWin, max: ACTIVITY_WINDOW_MAX_MINUTES, step: 0.5, disabled: busy,
            error: fieldError('actFastWin'),
            onChange: (value) => updateDraft('actFastWin', value),
          }),
          h(NumberField, {
            label: '恢复下限窗口（分钟）', ariaLabel: '恢复下限窗口（分钟）',
            value: draft.actMinWin, max: ACTIVITY_WINDOW_MAX_MINUTES, step: 0.5, disabled: busy,
            error: fieldError('actMinWin'),
            onChange: (value) => updateDraft('actMinWin', value),
          }),
          h(NumberField, {
            label: '完全恢复窗口（分钟）', ariaLabel: '完全恢复窗口（分钟）',
            value: draft.actFullWin, max: ACTIVITY_WINDOW_MAX_MINUTES, step: 0.5, disabled: busy,
            error: fieldError('actFullWin'),
            onChange: (value) => updateDraft('actFullWin', value),
          })),
        h('span', { className: 'dim-humanizeFieldHint' },
          '上一回合结束后：秒回窗口内直接用快速回复；过渡到下限窗口线性回升；超过完全恢复窗口回到完整随机区间。首条消息不加速。'),
        h('div', { className: 'dim-sendDelayRange' },
          h('span', { className: 'dim-sendDelayRangeName' }, '分段间隔（秒）'),
          h('span', { className: 'dim-sendDelayRangeInputs' },
            h('input', {
              type: 'number', min: 0, max: SEGMENT_GAP_MAX_SECONDS, step: 0.1,
              value: draft.gapMin,
              disabled: busy,
              'aria-label': '分段间隔下限（秒）',
              onChange: (event) => updateDraft('gapMin', event.target.value),
            }),
            h('span', { className: 'dim-sendDelayRangeSep', 'aria-hidden': 'true' }, '–'),
            h('input', {
              type: 'number', min: 0, max: SEGMENT_GAP_MAX_SECONDS, step: 0.1,
              value: draft.gapMax,
              disabled: busy,
              'aria-label': '分段间隔上限（秒）',
              onChange: (event) => updateDraft('gapMax', event.target.value),
            })),
          fieldError('gapMin') || fieldError('gapMax'),
          h('span', { className: 'dim-humanizeFieldHint' },
            '多条分段回复之间“正在打下一条”的停顿，仅在启用分步消息或流式分段时生效。')),
        h('div', { className: 'dim-sendDelayAdvanced' },
          h(NumberField, {
            label: '分段打字速度（字/秒）', ariaLabel: '分段打字速度（字/秒，0 关闭）',
            value: draft.gapCps, max: CHARS_PER_SECOND_MAX, disabled: busy,
            error: fieldError('gapCps'),
            onChange: (value) => updateDraft('gapCps', value),
          }),
          h(NumberField, {
            label: '分段间隔封顶（秒）', ariaLabel: '分段间隔封顶（秒）',
            value: draft.gapCap, max: SEGMENT_GAP_MAX_SECONDS, disabled: busy,
            error: fieldError('gapCap'),
            onChange: (value) => updateDraft('gapCap', value),
          })),
        h('p', { className: 'dim-humanizeFieldHint dim-sendDelayNote' },
          '覆盖保存后固定为本页值，之后修改全局设置不影响此机器人（覆盖为整体替换）。'),
        note ? h('p', { className: 'dim-humanizeFieldHint dim-sendDelayNote' }, note) : null)
        : h('p', { className: 'dim-humanizeFieldHint dim-sendDelayNote' },
          '机器人使用全局拟人化设置中的发送延迟。', current ? '切换回跟随全局会清除该机器人的全部拟人化覆盖。' : null,
          note ? ` ${note}` : null),

      h('div', { className: 'dim-humanizeActions' },
        h('button', {
          type: 'button',
          className: 'dim-deliveryButton dim-humanizeSave',
          'data-kind': 'primary',
          disabled: busy || (mode === 'follow' && !current),
          onClick: () => { void save(); },
        }, saving ? '保存中…' : mode === 'follow' ? '清除覆盖' : '保存'),
        saved
          ? h('span', { className: 'dim-humanizeStatus', 'data-tone': 'success', role: 'status' }, '已保存')
          : null,
        saveError
          ? h('span', { className: 'dim-humanizeStatus', 'data-tone': 'error', role: 'alert' }, saveError)
          : null))
      : null);
}
