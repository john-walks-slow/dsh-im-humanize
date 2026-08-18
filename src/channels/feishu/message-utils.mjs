import { ImagePromptError } from '../shared/image-prompt.mjs';

export function conversationKey(event) {
  const chatType = event?.message?.chat_type;
  if (chatType === 'p2p') {
    const senderId = event?.sender?.sender_id?.open_id || event?.sender?.sender_id?.user_id;
    if (!senderId) throw new Error('Feishu p2p event has no sender id');
    return `p2p:${senderId}`;
  }
  const chatId = event?.message?.chat_id;
  if (!chatId) throw new Error('Feishu group event has no chat id');
  return `group:${chatId}`;
}

function parsedMessageContent(event) {
  const value = event?.message?.content;
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function withoutMentions(text, event) {
  let result = typeof text === 'string' ? text : '';
  for (const mention of event?.message?.mentions ?? []) {
    if (typeof mention?.key === 'string' && mention.key) {
      result = result.replaceAll(mention.key, '');
    }
  }
  return result.trim();
}

export function extractText(event) {
  if (event?.message?.message_type !== 'text') return null;
  const parsed = parsedMessageContent(event);
  return parsed ? withoutMentions(parsed.text, event) : null;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function postContent(event, parsed = parsedMessageContent(event)) {
  if (event?.message?.message_type !== 'post') return null;
  if (!parsed) return null;

  const lines = [];
  const title = nonEmptyString(withoutMentions(parsed.title, event));
  if (title) lines.push(title);
  const imageKeys = [];
  for (const paragraph of Array.isArray(parsed.content) ? parsed.content : []) {
    if (!Array.isArray(paragraph)) continue;
    let visibleText = '';
    for (const element of paragraph) {
      const tag = String(element?.tag ?? '').toLowerCase();
      if (tag === 'img') {
        const key = nonEmptyString(element?.image_key);
        if (key) imageKeys.push(key);
      } else if (tag === 'text' || tag === 'a' || tag === 'link') {
        if (typeof element?.text === 'string') visibleText += element.text;
      }
    }
    const line = nonEmptyString(withoutMentions(visibleText, event));
    if (line) lines.push(line);
  }

  return {
    text: lines.join('\n'),
    imageKeys,
  };
}

function headerValue(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name);
  return headers?.[name] ?? headers?.[name.toLowerCase()] ?? null;
}

function declaredSize(headers) {
  const header = headerValue(headers, 'content-length');
  if (header === null || header === undefined || header === '') return null;
  const value = Number(header);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function readBoundedStream(stream, { signal, maxBytes }) {
  if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
    throw new Error('Feishu image download returned no readable stream');
  }
  signal?.throwIfAborted();
  const abort = () => stream.destroy?.(
    signal.reason ?? new DOMException('Feishu image download aborted', 'AbortError'),
  );
  signal?.addEventListener('abort', abort, { once: true });
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of stream) {
      signal?.throwIfAborted();
      const data = Buffer.from(chunk);
      size += data.length;
      if (size > maxBytes) {
        stream.destroy?.();
        throw new ImagePromptError(
          'image-too-large',
          `Feishu image exceeds ${maxBytes} bytes`,
          '图片超过 5 MB，请压缩后重试。',
        );
      }
      chunks.push(data);
    }
    signal?.throwIfAborted();
    return Buffer.concat(chunks, size);
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

function feishuImageSource(event, client, key) {
  return {
    async load({ signal, maxBytes }) {
      signal?.throwIfAborted();
      const resource = await client?.im?.v1?.messageResource?.get?.({
        path: {
          message_id: event.message.message_id,
          file_key: key,
        },
        params: { type: 'image' },
      });
      signal?.throwIfAborted();
      const size = declaredSize(resource?.headers);
      if (size !== null && size > maxBytes) {
        resource?.getReadableStream?.().destroy?.();
        throw new ImagePromptError(
          'image-too-large',
          `Feishu image declares ${size} bytes; the limit is ${maxBytes}`,
          '图片超过 5 MB，请压缩后重试。',
        );
      }
      return readBoundedStream(resource?.getReadableStream?.(), { signal, maxBytes });
    },
  };
}

export function extractInboundMessage(event, client) {
  const messageType = event?.message?.message_type;
  const parsed = parsedMessageContent(event);
  const post = postContent(event, parsed);
  const standaloneImageKey = messageType === 'image'
    ? nonEmptyString(parsed?.image_key)
    : null;
  const imageKeys = standaloneImageKey ? [standaloneImageKey] : post?.imageKeys ?? [];
  return {
    content: messageType === 'text' ? extractText(event) ?? '' : post?.text ?? '',
    images: imageKeys.map((key) => feishuImageSource(event, client, key)),
  };
}

export function splitText(text, maxChars = 9000) {
  if (text.length <= maxChars) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf('\n', maxChars);
    if (splitAt < Math.floor(maxChars * 0.6)) splitAt = maxChars;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).replace(/^\n+/, '');
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function isBotSender(event) {
  return event?.sender?.sender_type === 'bot';
}

export function isAllowedSender(event, allowedOpenIds) {
  if (!allowedOpenIds || allowedOpenIds.size === 0) return false;
  if (allowedOpenIds.has('*')) return true;
  const senderOpenId = event?.sender?.sender_id?.open_id;
  return typeof senderOpenId === 'string' && allowedOpenIds.has(senderOpenId);
}
