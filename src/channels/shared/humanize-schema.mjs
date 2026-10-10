/**
 * Declarative humanization field table — the single source of truth for
 * every humanization setting: its default, how a stored value is repaired
 * (lenient) and how a written value is rejected (strict), and the label /
 * hint / options the settings panels render.
 *
 * Everything else derives from this table instead of restating a key list
 * or a default value:
 *
 *   - humanize-settings.mjs  — global file store + RPC handler
 *   - humanize-override.mjs  — per-bot override section (workspaces.json)
 *   - humanize-resolver.mjs  — per-turn resolution for the bridges
 *   - the client panels      — the same labels/hints/options/layout order
 *
 * Per-bot rules are scope, not field, knowledge: a field is overridable
 * per bot when it says so (`perBot`), and the strict validator applies the
 * scope's own framing (field-path prefix, completeness requirement).
 *
 * Browser-safe: no Node APIs (the client bundle imports it).
 */
import {
  DEFAULT_SEND_DELAY_CONFIG,
  normalizeSendDelayConfig,
  requireCompleteSendDelay,
  validateSendDelayConfig,
} from './send-delay.mjs';
import {
  DEFAULT_TYPING_BURST,
  DEFAULT_TYPING_INDICATOR,
  TYPING_INDICATOR_MODES,
  normalizeTypingBurst,
  normalizeTypingIndicator,
  validateTypingBurst,
} from './typing-session.mjs';

/** Busy-message routing vocabulary (the `onNewMessage` field's domain). */
export const ON_NEW_MESSAGE_MODES = Object.freeze(['interrupt', 'queue', 'steer']);
export const DEFAULT_ON_NEW_MESSAGE = 'interrupt';

/** Lenient read of the configured mode: unknown values fall back to the default. */
export function normalizeOnNewMessage(value) {
  return ON_NEW_MESSAGE_MODES.includes(value) ? value : DEFAULT_ON_NEW_MESSAGE;
}

const typingIndicatorOptions = Object.freeze([
  Object.freeze({ value: 'off', label: '关闭' }),
  Object.freeze({ value: 'continuous', label: '持续' }),
  Object.freeze({ value: 'burst', label: '断续' }),
]);

const busyMessageOptions = Object.freeze([
  Object.freeze({ value: 'interrupt', label: '打断重发 (interrupt)' }),
  Object.freeze({ value: 'queue', label: '排队等待 (queue)' }),
  Object.freeze({ value: 'steer', label: '注入纠偏 (steer)' }),
]);

/**
 * The table, in declaration order: the panels render in this order, the
 * global strict validator reports the first offending key in this order,
 * and the unknown-key check runs after every known key (unchanged from the
 * hand-written validators this replaced).
 *
 * kind:    'boolean' | 'enum' | 'shape'
 * control: which widget the panels render for it
 */
export const HUMANIZE_FIELDS = Object.freeze([
  {
    key: 'streaming',
    kind: 'boolean',
    control: 'switch',
    default: true,
    perBot: true,
    label: '流式回复',
    hint: '开启后 AI 回复逐字显示。关闭后一次性发送完整回复，更有沉浸感。',
  },
  {
    key: 'messageBreak',
    kind: 'boolean',
    control: 'switch',
    default: true,
    perBot: true,
    label: '分步消息 (message_break)',
    hint: 'AI 调用 message_break 工具在回复中插入断点，每个分段作为独立消息发送。与「流式回复」同时开启时，每段各自逐字流式，断点处定稿为一条消息。',
  },
  {
    key: 'statusReaction',
    kind: 'boolean',
    control: 'switch',
    default: true,
    perBot: true,
    label: '状态表情回应',
    hint: '处理任务时用表情标记状态（处理中/成功/失败）。关闭后不再发送表情，回复照常送达。支持 Telegram、Discord、WhatsApp、Slack、飞书、钉钉。',
  },
  {
    key: 'replyQuote',
    kind: 'boolean',
    control: 'switch',
    default: true,
    perBot: true,
    label: '回复引用',
    hint: '回复时引用你的消息（引用样式）。关闭后回复以普通消息发出。仅影响 Telegram、Discord、WhatsApp 的引用样式；话题、Thread 归组不受影响。',
  },
  {
    key: 'progressStatus',
    kind: 'boolean',
    control: 'switch',
    default: true,
    perBot: true,
    label: '过程进度提示',
    hint: '处理任务时显示中间状态气泡（如“正在处理…”“正在使用工具…”“正在整理结果…”）。关闭后不发送占位气泡与中间进度文案，回复直达；流式文本仍正常逐字显示。适用于所有具备过程气泡的聊天渠道（QQ/微信本就无中间进度；AI Office 任务进度不受影响）。',
  },
  {
    key: 'onNewMessage',
    kind: 'enum',
    control: 'select',
    default: DEFAULT_ON_NEW_MESSAGE,
    values: ON_NEW_MESSAGE_MODES,
    options: busyMessageOptions,
    perBot: true,
    label: '新消息行为',
    hint: '生成中收到新消息时的处理方式：打断重发、排队等待、或注入为纠偏指令。交互等待时一律排队。',
  },
  {
    key: 'typingIndicator',
    kind: 'enum',
    control: 'select',
    default: DEFAULT_TYPING_INDICATOR,
    values: TYPING_INDICATOR_MODES,
    options: typingIndicatorOptions,
    // Legacy booleans (true → burst, false → off) survive the rename.
    coerce: normalizeTypingIndicator,
    perBot: true,
    label: '输入状态指示',
    hint: '处理开始后显示“正在输入”的方式：持续显示，或像真人一样时断时续（断续）。无对应接口的渠道自动忽略此项。',
  },
  {
    key: 'sendDelay',
    kind: 'shape',
    control: 'delay',
    default: DEFAULT_SEND_DELAY_CONFIG,
    perBot: true,
    normalize: normalizeSendDelayConfig,
    validate: validateSendDelayConfig,
    // A per-bot section replaces the global value whole, so a per-bot write
    // must carry every core field (the UI always prefills them).
    requireComplete: requireCompleteSendDelay,
  },
  {
    key: 'typingBurst',
    kind: 'shape',
    control: 'burst',
    default: DEFAULT_TYPING_BURST,
    perBot: true,
    normalize: normalizeTypingBurst,
    validate: validateTypingBurst,
  },
].map(Object.freeze));

const FIELDS_BY_KEY = new Map(HUMANIZE_FIELDS.map((field) => [field.key, field]));

export const HUMANIZE_KEYS = Object.freeze(HUMANIZE_FIELDS.map((field) => field.key));

/** Keys a per-bot override section may carry. */
export const PER_BOT_HUMANIZE_KEYS = Object.freeze(
  HUMANIZE_FIELDS.filter((field) => field.perBot).map((field) => field.key),
);

/** Shipped factory defaults for every field. */
export const DEFAULT_HUMANIZE_SETTINGS = Object.freeze(Object.fromEntries(
  HUMANIZE_FIELDS.map((field) => [field.key, field.default]),
));

/**
 * Lenient single-value repair: malformed input falls back to the field
 * default instead of throwing (disk files may be hand-edited; strict
 * rejection belongs to the RPC boundary).
 */
export function normalizeHumanizeField(key, value) {
  const field = FIELDS_BY_KEY.get(key);
  if (!field) return undefined;
  if (field.kind === 'boolean') return typeof value === 'boolean' ? value : field.default;
  if (field.kind === 'enum') {
    const coerced = field.coerce ? field.coerce(value) : value;
    return field.values.includes(coerced) ? coerced : field.default;
  }
  return field.normalize(value);
}

/**
 * Lenient whole-object repair, used for the global store and for any
 * snapshot the bridges resolve per turn: every key is present, malformed
 * values are replaced by their defaults.
 */
export function normalizeHumanizeSettings(partial = {}) {
  const source = partial && typeof partial === 'object' && !Array.isArray(partial) ? partial : {};
  return Object.fromEntries(HUMANIZE_FIELDS.map((field) => [
    field.key,
    normalizeHumanizeField(field.key, source[field.key]),
  ]));
}

/**
 * Whether a stored per-bot value is usable as an override. Unlike the
 * lenient global reader, a per-bot entry is never repaired into the
 * default: "the key is absent" and "the key is the default value" are
 * different statements, and a malformed entry must keep inheriting the
 * global value rather than silently pinning it.
 */
function acceptsOverrideValue(field, value) {
  if (field.kind === 'boolean') return typeof value === 'boolean';
  if (field.kind === 'enum') return field.values.includes(value);
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Lenient per-bot repair: keeps only valid keys that are PRESENT (an absent
 * key means "inherit the global value", which is a different statement from
 * "set it to the default"), and returns null for a section that carries no
 * valid key at all.
 */
export function normalizeHumanizeOverride(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const field of HUMANIZE_FIELDS) {
    if (!field.perBot || value[field.key] === undefined) continue;
    if (!acceptsOverrideValue(field, value[field.key])) continue;
    out[field.key] = normalizeHumanizeField(field.key, value[field.key]);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function invalid(field, message, code) {
  const error = new Error(message);
  error.code = code;
  error.field = field;
  return error;
}

/**
 * Strict validation — rejects, never coerces. `scope` frames the message:
 *
 * - 'global': partial updates (the store merges them over what is
 *   committed) and un-prefixed field paths; `code =
 *   'invalid-humanize-settings'`.
 * - 'bot': a complete section or null to clear, `humanize.`-prefixed field
 *   paths, at least one key, and `sendDelay` complete because the section
 *   replaces the global value whole; `code = 'invalid-humanize-override'`.
 *
 * `sendDelayBase` (bot scope only) is the resolved global sendDelay used to
 * inherit unset tuning subfields at write time.
 *
 * Returns the normalized value for the bot scope (the caller stores it);
 * the global scope mutates nothing and returns undefined.
 */
export function validateHumanizeSettings(value, { scope = 'global', sendDelayBase = null } = {}) {
  const perBot = scope === 'bot';
  const code = perBot ? 'invalid-humanize-override' : 'invalid-humanize-settings';
  const pathOf = (field) => (perBot ? `humanize.${field}` : field);
  if (perBot && value === null) return null;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalid(perBot ? 'humanize' : 'settings',
      perBot ? 'humanize section must be an object or null.' : 'humanize.set payload must be an object.',
      code);
  }
  const out = {};
  for (const field of HUMANIZE_FIELDS) {
    if (!perBot && !Object.hasOwn(value, field.key)) continue;
    const present = value[field.key];
    if (present === undefined) continue;
    if (perBot && !field.perBot) {
      throw invalid(pathOf(field.key), `Unknown humanization key: ${field.key}.`, code);
    }
    const path = pathOf(field.key);
    if (field.kind === 'boolean') {
      if (typeof present !== 'boolean') {
        throw invalid(path, `${field.key} must be a boolean.`, code);
      }
    } else if (field.kind === 'enum') {
      if (!field.values.includes(present)) {
        throw invalid(path, `${field.key} must be one of ${field.values.join(', ')}.`, code);
      }
    } else if (perBot && field.requireComplete) {
      field.requireComplete(present);
    } else {
      field.validate(present);
    }
    if (!perBot) continue;
    out[field.key] = field.kind === 'shape'
      ? field.normalize(inheritSendDelayBase(field, present, sendDelayBase))
      : present;
  }
  for (const key of Object.keys(value)) {
    if (!FIELDS_BY_KEY.has(key) || (perBot && !FIELDS_BY_KEY.get(key).perBot)) {
      throw invalid(pathOf(key), `Unknown humanization ${perBot ? 'key' : 'setting'}: ${key}.`, code);
    }
  }
  if (perBot && Object.keys(out).length === 0) {
    throw invalid('humanize', 'humanize section must set at least one key (or be null to clear).', code);
  }
  return perBot ? out : undefined;
}

/** Strict validation of a global `humanize.set` payload. */
export function validateHumanizeUpdate(partial) {
  return validateHumanizeSettings(partial, { scope: 'global' });
}

/** Strict validation of a per-bot `humanize` override section. */
export function validateHumanizeOverrideSection(value, { sendDelayBase = null } = {}) {
  return validateHumanizeSettings(value, { scope: 'bot', sendDelayBase });
}

/**
 * Merge unset sendDelay subfields from the resolved GLOBAL config so a
 * per-bot override written with only the base fields (enabled + min/max)
 * keeps the global reading speed / cap / activity boost instead of
 * silently snapping them back to factory defaults. Explicit keys always
 * win; the nested activityBoost object merges subfield-wise as well.
 */
function inheritSendDelayBase(field, config, base) {
  if (field.key !== 'sendDelay') return config;
  if (base === null || typeof base !== 'object' || Array.isArray(base)) return config;
  if (config === null || typeof config !== 'object' || Array.isArray(config)) return config;
  const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const boost = isPlainObject(base.readDelay?.activityBoost)
    || isPlainObject(config.readDelay?.activityBoost)
    ? {
      activityBoost: {
        ...base.readDelay?.activityBoost,
        ...config.readDelay?.activityBoost,
      },
    }
    : {};
  return {
    ...config,
    readDelay: { ...base.readDelay, ...config.readDelay, ...boost },
    segmentGap: { ...base.segmentGap, ...config.segmentGap },
  };
}
