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

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function opaqueId(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 512
    && value.trim() === value
    && !/[\s:\u0000-\u001f\u007f]/u.test(value);
}

function afterPrefix(key, prefix) {
  const marker = `${prefix}:`;
  if (!key.startsWith(marker)) return null;
  const value = key.slice(marker.length);
  return opaqueId(value) ? value : null;
}

function simpleSuggestion(key, definitions) {
  for (const [prefix, kind, field] of definitions) {
    const value = afterPrefix(key, prefix);
    if (value) return { kind, route: { [field]: value } };
  }
  return null;
}

function feishuSuggestion(key) {
  const openId = afterPrefix(key, 'p2p');
  if (openId?.startsWith('ou_')) {
    return { kind: 'user', route: { openId } };
  }
  return simpleSuggestion(key, [['group', 'group', 'chatId']]);
}

function slackSuggestion(key) {
  const directChannel = afterPrefix(key, 'direct');
  if (directChannel && /^[A-Za-z0-9_-]{1,128}$/.test(directChannel)) {
    return { kind: 'conversation', route: { channelId: directChannel } };
  }
  const match = /^group:([^:]+):(\d{1,20}(?:\.\d{1,20})?)$/.exec(key);
  if (!match || !/^[A-Za-z0-9_-]{1,128}$/.test(match[1])) return null;
  return { kind: 'thread', route: { channelId: match[1], threadTs: match[2] } };
}

function telegramSuggestion(key) {
  const match = /^(direct|group):(-?\d+)(?::([1-9]\d*))?$/.exec(key);
  if (!match) return null;
  const chatId = Number(match[2]);
  if (!Number.isSafeInteger(chatId)) return null;
  if (match[1] === 'direct' && match[3] !== undefined) return null;
  if (match[3] === undefined) return { kind: 'chat', route: { chatId: match[2] } };
  const messageThreadId = Number(match[3]);
  if (!Number.isSafeInteger(messageThreadId) || messageThreadId <= 0) return null;
  return { kind: 'topic', route: { chatId: match[2], messageThreadId } };
}

function discordSuggestion(key) {
  const match = /^(?:direct|group):(\d{1,32})$/.exec(key);
  return match ? { kind: 'channel', route: { channelId: match[1] } } : null;
}

function whatsappSuggestion(key) {
  const direct = /^direct:(\d{5,32}@(s\.whatsapp\.net|lid))$/.exec(key);
  if (direct) return { kind: 'user', route: { jid: direct[1] } };
  const group = /^group:(\d{5,32}(?:-\d{1,32})?@g\.us)$/.exec(key);
  return group ? { kind: 'group', route: { jid: group[1] } } : null;
}

/** Convert one persisted conversation key into a stable proactive-delivery route. */
export function deliverySuggestionFromConversationKey(channel, key) {
  if (!CHANNELS.has(channel) || typeof key !== 'string') return null;
  switch (channel) {
    case 'weixin':
      return simpleSuggestion(key, [['p2p', 'user', 'toUserId']]);
    case 'feishu':
      return feishuSuggestion(key);
    case 'dingtalk':
      return simpleSuggestion(key, [
        ['p2p', 'user', 'userId'],
        ['group', 'group', 'openConversationId'],
      ]);
    case 'wecom':
      return simpleSuggestion(key, [
        ['direct', 'user', 'chatId'],
        ['group', 'group', 'chatId'],
      ]);
    case 'qq':
      return simpleSuggestion(key, [
        ['c2c', 'user', 'userOpenId'],
        ['group', 'group', 'groupOpenId'],
      ]);
    case 'slack':
      return slackSuggestion(key);
    case 'telegram':
      return telegramSuggestion(key);
    case 'discord':
      return discordSuggestion(key);
    case 'whatsapp':
      return whatsappSuggestion(key);
    default:
      return null;
  }
}

/**
 * Extract and de-duplicate stable delivery routes from a persisted sessions map.
 * Session ids and every other state field are intentionally ignored.
 */
export function deliverySuggestionsFromSessions(channel, sessions) {
  if (!CHANNELS.has(channel) || !isRecord(sessions)) return [];
  const suggestions = [];
  const seen = new Set();
  for (const key of Object.keys(sessions)) {
    const suggestion = deliverySuggestionFromConversationKey(channel, key);
    if (!suggestion) continue;
    const identity = JSON.stringify(suggestion);
    if (seen.has(identity)) continue;
    seen.add(identity);
    suggestions.push(suggestion);
  }
  return suggestions;
}
