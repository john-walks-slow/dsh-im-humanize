/**
 * Shared humanization form building blocks — the single source of field
 * layout, hints, options, limits, and validation for BOTH the global
 * settings panel (plugin-src/client/humanize-settings.js) and the
 * per-bot override editor (plugin-src/client/channels/shared/
 * bot-send-delay.js).
 *
 * The two panels keep their own wrappers: the global panel edits values
 * directly; the per-bot editor gates each setting behind a
 * follow-global/custom choice. But every field, label, hint, preset,
 * and error message renders identically from here, so the detail level
 * and format can never drift between the two surfaces.
 *
 * Browser-safe (client bundle only; no Node APIs, no hooks — the
 * components are pure h() trees driven entirely by props).
 *
 * Checkable inputs are audited by scripts/verify-package.mjs — keep the
 * checkbox count in this file in sync with its manifest.
 */
import { h } from '../../i18n.js';
import { DEFAULT_SEND_DELAY_CONFIG } from '../../../../src/channels/shared/send-delay.mjs';
import { DEFAULT_TYPING_BURST } from '../../../../src/channels/shared/typing-session.mjs';

// ── shared limits (wire format is milliseconds) ─────────────────────

export const READ_DELAY_MAX_SECONDS = 300;
export const SEGMENT_GAP_MAX_SECONDS = 30;
export const CHARS_PER_SECOND_MAX = 1000;
export const ACTIVITY_FAST_REPLY_MAX_SECONDS = 60;
export const ACTIVITY_WINDOW_MAX_MINUTES = 1440;
export const TYPING_BURST_MAX_MS = 30000;

// ── setting metadata (labels + hints shared by both panels) ─────────

export const ON_NEW_MESSAGE_OPTIONS = Object.freeze([
  { value: 'interrupt', label: '打断重发 (interrupt)' },
  { value: 'queue', label: '排队等待 (queue)' },
  { value: 'steer', label: '注入纠偏 (steer)' },
]);

export const TYPING_INDICATOR_OPTIONS = Object.freeze([
  { value: 'off', label: '关闭' },
  { value: 'continuous', label: '持续' },
  { value: 'burst', label: '断续' },
]);

/**
 * Canonical labels and hints for the six scalar settings. Mirrors
 * DEFAULT_HUMANIZE_SETTINGS in src/channels/shared/humanize-settings.mjs
 * (kept local to avoid pulling Node APIs into the browser bundle).
 */
export const HUMANIZE_SETTING_META = Object.freeze({
  streaming: Object.freeze({
    label: '流式回复',
    hint: '开启后 AI 回复逐字显示。关闭后一次性发送完整回复，更有沉浸感。',
  }),
  messageBreak: Object.freeze({
    label: '分步消息 (message_break)',
    hint: 'AI 调用 message_break 工具在回复中插入断点，每个分段作为独立消息发送。可与流式回复同时开启。',
  }),
  statusReaction: Object.freeze({
    label: '状态表情回应',
    hint: '处理任务时用表情标记状态（处理中/成功/失败）。关闭后不再发送表情，回复照常送达。支持 Telegram、Discord、WhatsApp、Slack、飞书、钉钉。',
  }),
  replyQuote: Object.freeze({
    label: '回复引用',
    hint: '回复时引用你的消息（引用样式）。关闭后回复以普通消息发出。仅影响 Telegram、Discord、WhatsApp 的引用样式；话题、Thread 归组不受影响。',
  }),
  onNewMessage: Object.freeze({
    label: '新消息行为',
    hint: '生成中收到新消息时的处理方式：打断重发、排队等待、或注入为纠偏指令。交互等待时一律排队。',
    options: ON_NEW_MESSAGE_OPTIONS,
  }),
  typingIndicator: Object.freeze({
    label: '输入状态指示',
    hint: '处理开始后显示“正在输入”的方式：持续显示，或像真人一样时断时续（断续）。无对应接口的渠道自动忽略此项。',
    options: TYPING_INDICATOR_OPTIONS,
  }),
});

/**
 * Shipped factory defaults for every humanization setting — the prefill
 * base when no live global config is available (mirrors
 * DEFAULT_HUMANIZE_SETTINGS; kept local for browser safety).
 */
export const SHIPPED_HUMANIZE_DEFAULTS = Object.freeze({
  streaming: true,
  messageBreak: true,
  statusReaction: true,
  replyQuote: true,
  onNewMessage: 'interrupt',
  typingIndicator: 'burst',
  typingBurst: DEFAULT_TYPING_BURST,
  sendDelay: DEFAULT_SEND_DELAY_CONFIG,
});

/** Merge the live global defaults over the shipped ones (lenient). */
export function resolvedHumanizeDefaults(humanizeDefaults) {
  return humanizeDefaults && typeof humanizeDefaults === 'object'
    ? { ...SHIPPED_HUMANIZE_DEFAULTS, ...humanizeDefaults }
    : { ...SHIPPED_HUMANIZE_DEFAULTS };
}

// ── send-delay exploration presets (fill fields for further tweaking) ──

export const SEND_DELAY_PRESETS = Object.freeze([
  {
    key: 'light',
    label: '轻拟人',
    config: {
      enabled: true,
      readDelay: { minMs: 1000, maxMs: 6000, charsPerSecond: 0, maxTotalMs: 30000, activityBoost: { enabled: true, fastReplyMs: 1000, fastWindowMs: 60000, minWindowMs: 120000, fullWindowMs: 300000 } },
      segmentGap: { minMs: 500, maxMs: 2000, charsPerSecond: 0, maxTotalMs: 10000 },
    },
  },
  {
    key: 'slow',
    label: '慢性子',
    config: {
      enabled: true,
      readDelay: { minMs: 5000, maxMs: 15000, charsPerSecond: 12, maxTotalMs: 60000, activityBoost: { enabled: false, fastReplyMs: 1000, fastWindowMs: 60000, minWindowMs: 120000, fullWindowMs: 300000 } },
      segmentGap: { minMs: 1500, maxMs: 4000, charsPerSecond: 15, maxTotalMs: 20000 },
    },
  },
  {
    key: 'immersive',
    label: '沉浸角色扮演',
    config: {
      enabled: true,
      readDelay: { minMs: 8000, maxMs: 30000, charsPerSecond: 8, maxTotalMs: 120000, activityBoost: { enabled: true, fastReplyMs: 2500, fastWindowMs: 90000, minWindowMs: 240000, fullWindowMs: 600000 } },
      segmentGap: { minMs: 2000, maxMs: 6000, charsPerSecond: 10, maxTotalMs: 30000 },
    },
  },
  {
    key: 'instant',
    label: '即刻应答',
    config: {
      enabled: true,
      readDelay: { minMs: 0, maxMs: 500, charsPerSecond: 0, maxTotalMs: 30000, activityBoost: { enabled: false, fastReplyMs: 0, fastWindowMs: 60000, minWindowMs: 120000, fullWindowMs: 300000 } },
      segmentGap: { minMs: 1000, maxMs: 3000, charsPerSecond: 12, maxTotalMs: 10000 },
    },
  },
]);

// ── draft <-> wire conversion helpers (UI strings <-> ms numbers) ───

function secondsOf(ms) {
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms) / 1000 : 0;
}

function minutesOf(ms) {
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 6000) / 10 : 0;
}

function rateOf(value) {
  return Number.isFinite(value) && value > 0 ? Math.round(value * 10) / 10 : 0;
}

/** Build a string-field sendDelay draft from a wire config. */
export function draftFromConfig(config) {
  // Caps and activity boost fall back to the shipped defaults when the
  // source config omits them (hand-edited disk sections): the resolver
  // normalizes those the same way, and a zero prefill would dead-end the
  // cross-field cap >= max validation.
  const activity = config?.readDelay?.activityBoost
    ?? DEFAULT_SEND_DELAY_CONFIG.readDelay.activityBoost;
  return {
    enabled: config?.enabled === true,
    readMin: String(secondsOf(config?.readDelay?.minMs)),
    readMax: String(secondsOf(config?.readDelay?.maxMs)),
    readCps: String(rateOf(config?.readDelay?.charsPerSecond)),
    readCap: String(secondsOf(
      config?.readDelay?.maxTotalMs ?? DEFAULT_SEND_DELAY_CONFIG.readDelay.maxTotalMs)),
    actOn: activity.enabled !== false,
    actFast: String(secondsOf(activity.fastReplyMs)),
    actFastWin: String(minutesOf(activity.fastWindowMs)),
    actMinWin: String(minutesOf(activity.minWindowMs)),
    actFullWin: String(minutesOf(activity.fullWindowMs)),
    gapMin: String(secondsOf(config?.segmentGap?.minMs)),
    gapMax: String(secondsOf(config?.segmentGap?.maxMs)),
    gapCps: String(rateOf(config?.segmentGap?.charsPerSecond)),
    gapCap: String(secondsOf(
      config?.segmentGap?.maxTotalMs ?? DEFAULT_SEND_DELAY_CONFIG.segmentGap.maxTotalMs)),
  };
}

/** Build a string-field typingBurst draft from a wire config. */
export function burstDraftFrom(burst) {
  const src = burst && typeof burst === 'object' ? burst : DEFAULT_TYPING_BURST;
  return {
    onMin: String(Number.isFinite(src.onMinMs) ? src.onMinMs : DEFAULT_TYPING_BURST.onMinMs),
    onMax: String(Number.isFinite(src.onMaxMs) ? src.onMaxMs : DEFAULT_TYPING_BURST.onMaxMs),
    offMin: String(Number.isFinite(src.offMinMs) ? src.offMinMs : DEFAULT_TYPING_BURST.offMinMs),
    offMax: String(Number.isFinite(src.offMaxMs) ? src.offMaxMs : DEFAULT_TYPING_BURST.offMaxMs),
  };
}

// ── validation (throws FieldError; both panels display identically) ──

export class FieldError extends Error {
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

function parseMs(value, { field, label, max }) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FieldError(field, `请填写${label}。`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new FieldError(field, `${label}必须是不小于 0 的数字。`);
  }
  if (parsed > max) {
    throw new FieldError(field, `${label}不能超过 ${max} 毫秒。`);
  }
  return Math.round(parsed);
}

/** Validate a sendDelay draft into the complete wire config. */
export function validateSendDelayDraft(draft) {
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

/** Validate a typingBurst draft into the wire config. */
export function validateBurstDraft(draft) {
  const onMin = parseMs(draft.onMin, { field: 'burstOnMin', label: '亮相最短', max: TYPING_BURST_MAX_MS });
  const onMax = parseMs(draft.onMax, { field: 'burstOnMax', label: '亮相最长', max: TYPING_BURST_MAX_MS });
  if (onMin > onMax) {
    throw new FieldError('burstOnMin', '亮相最短不能超过最长。');
  }
  const offMin = parseMs(draft.offMin, { field: 'burstOffMin', label: '灭相最短', max: TYPING_BURST_MAX_MS });
  const offMax = parseMs(draft.offMax, { field: 'burstOffMax', label: '灭相最长', max: TYPING_BURST_MAX_MS });
  if (offMin > offMax) {
    throw new FieldError('burstOffMin', '灭相最短不能超过最长。');
  }
  return { onMinMs: onMin, onMaxMs: onMax, offMinMs: offMin, offMaxMs: offMax };
}

// ── shared UI atoms ──────────────────────────────────────────────────

/** Inline field-error text (role=alert), rendered by both panels. */
export function FieldErrorText({ errors, field }) {
  if (!errors?.[field]) return null;
  return h('span', { className: 'dim-sendDelayFieldError', role: 'alert' }, errors[field]);
}

/** One labeled number input (advanced single-value fields). */
export function NumberField({ label, value, max, step = 0.1, min = 0, disabled, ariaLabel, error, onChange }) {
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

/** The send-delay exploration preset dropdown (探索预设). */
export function SendDelayPresetSelect({ value, disabled = false, onChange }) {
  return h('select', {
    className: 'dim-humanizePresetSelect',
    value,
    'aria-label': '探索预设',
    disabled,
    onChange: (event) => onChange(event.target.value),
  },
  h('option', { value: '' }, '探索预设…'),
  SEND_DELAY_PRESETS.map((preset) =>
    h('option', { key: preset.key, value: preset.key }, preset.label)));
}

/**
 * The complete typingBurst field group (ms wire format). Pure props:
 * { draft, busy, errors, onField } — onField(field, value) receives
 * input value strings.
 */
export function TypingBurstFields({ draft, busy = false, errors = null, onField }) {
  // Return null (not a self-nulling element) when the field has no error,
  // so `errorOf(a) || errorOf(b)` composition picks the right one.
  const errorOf = (field) => (errors?.[field]
    ? h(FieldErrorText, { errors, field })
    : null);
  return h('div', { className: 'dim-sendDelayFields' },
    h('div', { className: 'dim-sendDelayRange' },
      h('span', { className: 'dim-sendDelayRangeName' }, '亮相（毫秒）'),
      h('span', { className: 'dim-sendDelayRangeInputs' },
        h('input', {
          type: 'number', min: 0, max: TYPING_BURST_MAX_MS, step: 100,
          value: draft.onMin,
          disabled: busy,
          'aria-label': '亮相最短（毫秒）',
          onChange: (event) => onField('onMin', event.target.value),
        }),
        h('span', { className: 'dim-sendDelayRangeSep', 'aria-hidden': 'true' }, '–'),
        h('input', {
          type: 'number', min: 0, max: TYPING_BURST_MAX_MS, step: 100,
          value: draft.onMax,
          disabled: busy,
          'aria-label': '亮相最长（毫秒）',
          onChange: (event) => onField('onMax', event.target.value),
        })),
      errorOf('burstOnMin') || errorOf('burstOnMax')),
    h('div', { className: 'dim-sendDelayRange' },
      h('span', { className: 'dim-sendDelayRangeName' }, '灭相（毫秒）'),
      h('span', { className: 'dim-sendDelayRangeInputs' },
        h('input', {
          type: 'number', min: 0, max: TYPING_BURST_MAX_MS, step: 100,
          value: draft.offMin,
          disabled: busy,
          'aria-label': '灭相最短（毫秒）',
          onChange: (event) => onField('offMin', event.target.value),
        }),
        h('span', { className: 'dim-sendDelayRangeSep', 'aria-hidden': 'true' }, '–'),
        h('input', {
          type: 'number', min: 0, max: TYPING_BURST_MAX_MS, step: 100,
          value: draft.offMax,
          disabled: busy,
          'aria-label': '灭相最长（毫秒）',
          onChange: (event) => onField('offMax', event.target.value),
        })),
      errorOf('burstOffMin') || errorOf('burstOffMax')),
    h('span', { className: 'dim-humanizeFieldHint' },
      '断续模式下“正在输入”亮起与熄灭的可见时长范围；平台显示残余由插件自动补足，无需在此考虑。'));
}

/**
 * The complete sendDelay field group (seconds/minutes UI, ms wire).
 * Pure props: { draft, busy, errors, onField } — onField(field, value)
 * receives input value strings for numbers and booleans for checkboxes.
 */
export function SendDelayFields({ draft, busy = false, errors = null, onField }) {
  // Return null (not a self-nulling element) when the field has no error,
  // so `errorOf(a) || errorOf(b)` composition picks the right one.
  const errorOf = (field) => (errors?.[field]
    ? h(FieldErrorText, { errors, field })
    : null);
  return h('div', { className: 'dim-sendDelayFields' },
    h('label', { className: 'dim-humanizeField dim-sendDelayField' },
      h('span', { className: 'dim-humanizeFieldRow' },
        h('input', {
          type: 'checkbox',
          checked: draft.enabled,
          disabled: busy,
          onChange: (event) => onField('enabled', event.target.checked),
        }),
        h('span', { className: 'dim-humanizeFieldName' }, '启用发送延迟')),
      h('span', { className: 'dim-humanizeFieldHint' },
        '两阶段拟人化：先静默“稍后才读到消息”，再开始处理；排队等待的多条消息延迟会累积。')),
    h('div', { className: 'dim-sendDelayRange' },
      h('span', { className: 'dim-sendDelayRangeName' }, '阅读延迟（秒）'),
      h('span', { className: 'dim-sendDelayRangeInputs' },
        h('input', {
          type: 'number', min: 0, max: READ_DELAY_MAX_SECONDS, step: 0.1,
          value: draft.readMin,
          disabled: busy,
          'aria-label': '阅读延迟下限（秒）',
          onChange: (event) => onField('readMin', event.target.value),
        }),
        h('span', { className: 'dim-sendDelayRangeSep', 'aria-hidden': 'true' }, '–'),
        h('input', {
          type: 'number', min: 0, max: READ_DELAY_MAX_SECONDS, step: 0.1,
          value: draft.readMax,
          disabled: busy,
          'aria-label': '阅读延迟上限（秒）',
          onChange: (event) => onField('readMax', event.target.value),
        })),
      errorOf('readMin') || errorOf('readMax'),
      h('span', { className: 'dim-humanizeFieldHint' },
        '收到消息后到开始处理之间的静默时间，按用户消息长度还会略有增加。')),
    h('div', { className: 'dim-sendDelayAdvanced' },
      h(NumberField, {
        label: '阅读速度（字/秒）', ariaLabel: '阅读速度（字/秒，0 关闭）',
        value: draft.readCps, max: CHARS_PER_SECOND_MAX, disabled: busy,
        error: errorOf('readCps'),
        onChange: (value) => onField('readCps', value),
      }),
      h(NumberField, {
        label: '阅读延迟封顶（秒）', ariaLabel: '阅读延迟单回合封顶（秒）',
        value: draft.readCap, max: READ_DELAY_MAX_SECONDS, disabled: busy,
        error: errorOf('readCap'),
        onChange: (value) => onField('readCap', value),
      })),
    h('span', { className: 'dim-humanizeFieldHint' },
      '用户消息越长“读”得越久（0 关闭按长度计算）；单回合阅读延迟的硬上限。'),
    h('label', { className: 'dim-humanizeField dim-sendDelayField' },
      h('span', { className: 'dim-humanizeFieldRow' },
        h('input', {
          type: 'checkbox',
          checked: draft.actOn,
          disabled: busy,
          'aria-label': '启用活跃响应',
          onChange: (event) => onField('actOn', event.target.checked),
        }),
        h('span', { className: 'dim-humanizeFieldName' }, '活跃响应')),
      h('span', { className: 'dim-humanizeFieldHint' },
        '刚聊完天时“秒回”，闲置越久越接近完整延迟区间：模拟真人是否还盯着屏幕。')),
    h('div', { className: 'dim-sendDelayAdvanced dim-sendDelayActivity' },
      h(NumberField, {
        label: '快速回复（秒）', ariaLabel: '快速回复延迟（秒）',
        value: draft.actFast, max: ACTIVITY_FAST_REPLY_MAX_SECONDS, step: 0.5, disabled: busy,
        error: errorOf('actFast'),
        onChange: (value) => onField('actFast', value),
      }),
      h(NumberField, {
        label: '秒回窗口（分钟）', ariaLabel: '秒回窗口（分钟）',
        value: draft.actFastWin, max: ACTIVITY_WINDOW_MAX_MINUTES, step: 0.5, disabled: busy,
        error: errorOf('actFastWin'),
        onChange: (value) => onField('actFastWin', value),
      }),
      h(NumberField, {
        label: '恢复下限窗口（分钟）', ariaLabel: '恢复下限窗口（分钟）',
        value: draft.actMinWin, max: ACTIVITY_WINDOW_MAX_MINUTES, step: 0.5, disabled: busy,
        error: errorOf('actMinWin'),
        onChange: (value) => onField('actMinWin', value),
      }),
      h(NumberField, {
        label: '完全恢复窗口（分钟）', ariaLabel: '完全恢复窗口（分钟）',
        value: draft.actFullWin, max: ACTIVITY_WINDOW_MAX_MINUTES, step: 0.5, disabled: busy,
        error: errorOf('actFullWin'),
        onChange: (value) => onField('actFullWin', value),
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
          onChange: (event) => onField('gapMin', event.target.value),
        }),
        h('span', { className: 'dim-sendDelayRangeSep', 'aria-hidden': 'true' }, '–'),
        h('input', {
          type: 'number', min: 0, max: SEGMENT_GAP_MAX_SECONDS, step: 0.1,
          value: draft.gapMax,
          disabled: busy,
          'aria-label': '分段间隔上限（秒）',
          onChange: (event) => onField('gapMax', event.target.value),
        })),
      errorOf('gapMin') || errorOf('gapMax'),
      h('span', { className: 'dim-humanizeFieldHint' },
        '多条分段回复之间“正在打下一条”的停顿，仅在启用分步消息或流式分段时生效。')),
    h('div', { className: 'dim-sendDelayAdvanced' },
      h(NumberField, {
        label: '分段打字速度（字/秒）', ariaLabel: '分段打字速度（字/秒，0 关闭）',
        value: draft.gapCps, max: CHARS_PER_SECOND_MAX, disabled: busy,
        error: errorOf('gapCps'),
        onChange: (value) => onField('gapCps', value),
      }),
      h(NumberField, {
        label: '分段间隔封顶（秒）', ariaLabel: '分段间隔封顶（秒）',
        value: draft.gapCap, max: SEGMENT_GAP_MAX_SECONDS, disabled: busy,
        error: errorOf('gapCap'),
        onChange: (value) => onField('gapCap', value),
      })),
    h('span', { className: 'dim-humanizeFieldHint' },
      '按下一分段长度折算“正在打下一条”的时间（0 关闭）；分段间隔的硬上限。'));
}
