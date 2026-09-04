import { deliverySuggestionsFromSessions } from './delivery-suggestions.mjs';

const CHANNELS = new Set([
  'weixin',
  'feishu',
  'dingtalk',
  'wecom',
  'qq',
  'slack',
  'telegram',
  'discord',
  'whatsapp',
]);

export function supportsDeliveryChannel(channel) {
  return CHANNELS.has(channel);
}

function invalidTarget(message) {
  const error = new Error(message);
  error.code = 'invalid-target';
  return error;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed, label) {
  if (!isRecord(value)) throw invalidTarget(`${label} must be an object`);
  const extra = Object.keys(value).find((key) => !allowed.includes(key));
  if (extra !== undefined) throw invalidTarget(`${label} contains an unknown field`);
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value || value.trim() !== value) {
    throw invalidTarget(`${label} must be a non-empty string without surrounding whitespace`);
  }
  return value;
}

function targetName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
    throw invalidTarget('target.name must contain 1 to 80 characters');
  }
  return value.trim();
}

function routeWithStrings(route, fields) {
  exactKeys(route, fields, 'route');
  const normalized = {};
  for (const field of fields) normalized[field] = requiredString(route[field], `route.${field}`);
  return normalized;
}

function oneOf(value, choices) {
  if (!choices.includes(value)) throw invalidTarget('target kind is not supported by this channel');
  return value;
}

function normalizeRoute(channel, kind, route) {
  switch (channel) {
    case 'weixin':
      oneOf(kind, ['user']);
      return routeWithStrings(route, ['toUserId']);
    case 'feishu':
      oneOf(kind, ['user', 'group']);
      return routeWithStrings(route, kind === 'user' ? ['openId'] : ['chatId']);
    case 'dingtalk':
      oneOf(kind, ['user', 'group']);
      return routeWithStrings(route, kind === 'user' ? ['userId'] : ['openConversationId']);
    case 'wecom':
      oneOf(kind, ['user', 'group']);
      return routeWithStrings(route, ['chatId']);
    case 'qq':
      oneOf(kind, ['user', 'group']);
      return routeWithStrings(route, kind === 'user' ? ['userOpenId'] : ['groupOpenId']);
    case 'slack': {
      oneOf(kind, ['conversation', 'thread']);
      const normalized = routeWithStrings(
        route,
        kind === 'conversation' ? ['channelId'] : ['channelId', 'threadTs'],
      );
      return normalized;
    }
    case 'telegram': {
      oneOf(kind, ['chat', 'topic']);
      exactKeys(route, kind === 'chat' ? ['chatId'] : ['chatId', 'messageThreadId'], 'route');
      const chatId = requiredString(route.chatId, 'route.chatId');
      if (!/^-?\d+$/.test(chatId)) throw invalidTarget('route.chatId must be a decimal string');
      if (kind === 'chat') return { chatId };
      if (!Number.isSafeInteger(route.messageThreadId) || route.messageThreadId <= 0) {
        throw invalidTarget('route.messageThreadId must be a positive integer');
      }
      return { chatId, messageThreadId: route.messageThreadId };
    }
    case 'discord':
      oneOf(kind, ['channel']);
      return routeWithStrings(route, ['channelId']);
    case 'whatsapp': {
      oneOf(kind, ['user', 'group']);
      const normalized = routeWithStrings(route, ['jid']);
      const valid = kind === 'user'
        ? /^\d{5,32}@(s\.whatsapp\.net|lid)$/.test(normalized.jid)
        : /^\d{5,32}(?:-\d{1,32})?@g\.us$/.test(normalized.jid);
      if (!valid) {
        throw invalidTarget(`route.jid must be a ${kind} WhatsApp JID`);
      }
      return normalized;
    }
    default:
      throw new TypeError(`Unsupported delivery channel: ${channel}`);
  }
}

/** Strictly validate and copy one channel delivery target. */
export function normalizeDeliveryTarget(channel, value, { targetIdRequired = true } = {}) {
  if (!supportsDeliveryChannel(channel)) throw new TypeError(`Unsupported delivery channel: ${channel}`);
  exactKeys(
    value,
    targetIdRequired ? ['targetId', 'name', 'kind', 'route'] : ['name', 'kind', 'route'],
    'target',
  );
  const normalized = {};
  if (targetIdRequired) normalized.targetId = requiredString(value.targetId, 'target.targetId');
  if (value.name !== undefined) normalized.name = targetName(value.name);
  normalized.kind = requiredString(value.kind, 'target.kind');
  normalized.route = normalizeRoute(channel, normalized.kind, value.route);
  return normalized;
}

/** Bind one channel's existing workspace store and unwrapped controller to DeliveryService. */
export function createDeliveryAdapter({ channel, workspaces, coreController, stateFor }) {
  if (!supportsDeliveryChannel(channel)) throw new TypeError(`Unsupported delivery channel: ${channel}`);
  if (!workspaces || typeof workspaces !== 'object') {
    throw new TypeError('delivery adapter requires a workspace store');
  }
  if (!coreController || typeof coreController !== 'object') {
    throw new TypeError('delivery adapter requires a proactive text controller');
  }
  if (typeof stateFor !== 'function') {
    throw new TypeError('delivery adapter requires a bot state getter');
  }
  return Object.freeze({
    channel,
    ownsBot: (botId) => workspaces.has(botId),
    listBots: () => workspaces.listBotIds(),
    listTargets: (botId) => workspaces.listDeliveryTargets(botId),
    async listSuggestions(botId) {
      const state = await stateFor(botId);
      if (!state || typeof state.snapshot !== 'function') {
        throw new TypeError('delivery suggestion state cannot be inspected');
      }
      const suggestions = deliverySuggestionsFromSessions(channel, state.snapshot()?.sessions);
      return suggestions.map((suggestion) => normalizeDeliveryTarget(
        channel,
        suggestion,
        { targetIdRequired: false },
      ));
    },
    createTarget: (botId, target) => workspaces.createDeliveryTarget(
      botId,
      normalizeDeliveryTarget(channel, target),
    ),
    updateTarget: (botId, targetId, replacement) => workspaces.updateDeliveryTarget(
      botId,
      targetId,
      normalizeDeliveryTarget(channel, replacement, { targetIdRequired: false }),
    ),
    deleteTarget: (botId, targetId) => workspaces.deleteDeliveryTarget(botId, targetId),
    async sendText(botId, target, text, options = {}) {
      const normalized = normalizeDeliveryTarget(channel, target);
      if (typeof coreController.sendProactiveText !== 'function') {
        throw new TypeError('delivery controller cannot send proactive text');
      }
      await coreController.sendProactiveText(botId, normalized, text, options);
      return { sent: true };
    },
  });
}
