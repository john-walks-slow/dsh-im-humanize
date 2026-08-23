import { fetchFileStream } from '../shared/file-download.mjs';
import { fetchImageBuffer } from '../shared/image-prompt.mjs';

const DEFAULT_BASE_URL = 'https://api.telegram.org/';
const TELEGRAM_FILE_HOSTS = Object.freeze(['api.telegram.org']);
const DEFAULT_FILE_UPLOAD_TIMEOUT_MS = 120_000;

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requestSignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function abortReason(signal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted', 'AbortError');
}

function positiveTimeout(value, name) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

function preserveProviderMetadata(target, source) {
  if (source?.providerCode !== undefined) target.providerCode = source.providerCode;
  if (source?.retry_after !== undefined) {
    target.retry_after = source.retry_after;
    target.retryAfter = source.retry_after;
  }
  if (Number.isInteger(source?.status)) target.status = source.status;
  return target;
}

function telegramArtifactProviderError(cause) {
  const providerCode = Number(cause?.providerCode);
  const status = Number(cause?.status);
  const message = cleanString(cause?.message) ?? '';
  let code = 'artifact-provider-rejected';
  let summary = 'Telegram rejected the document.';
  if (providerCode === 401 || providerCode === 403 || status === 401 || status === 403) {
    code = 'artifact-permission-required';
    summary = 'Telegram denied permission to send the document.';
  } else if (providerCode === 413 || status === 413
    || /(?:file|request|entity).{0,20}(?:too (?:big|large)|size limit)|too (?:big|large)/i.test(message)) {
    code = 'artifact-too-large';
    summary = 'The document exceeds Telegram\'s size limit.';
  } else if (providerCode === 429 || status === 429) {
    code = 'artifact-rate-limited';
    summary = 'Telegram rate-limited document delivery.';
  } else if (providerCode >= 500 || status >= 500) {
    code = 'artifact-delivery-uncertain';
    summary = 'Telegram document delivery result is uncertain.';
  }
  const error = new Error(summary, { cause });
  error.code = code;
  return preserveProviderMetadata(error, cause);
}

function uncertainTelegramDelivery(cause) {
  const error = new Error('Telegram document delivery result is uncertain', { cause });
  error.code = 'artifact-delivery-uncertain';
  return preserveProviderMetadata(error, cause);
}

export function validTelegramToken(value) {
  return typeof value === 'string' && /^\d{5,20}:[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

const TELEGRAM_COMMAND_NAME = /^[a-z0-9_]{1,32}$/;

function validBotCommand(value) {
  return Boolean(value)
    && typeof value === 'object' && !Array.isArray(value)
    && typeof value.command === 'string' && TELEGRAM_COMMAND_NAME.test(value.command)
    && typeof value.description === 'string' && value.description.length >= 1
    && value.description.length <= 256;
}

export const COMMANDS_MENU_BUTTON = Object.freeze({ type: 'commands' });

export class TelegramApi {
  #token;
  #fetch;
  #baseUrl;
  #fileUploadTimeoutMs;

  constructor({
    token,
    fetchImpl = fetch,
    baseUrl = DEFAULT_BASE_URL,
    fileUploadTimeoutMs = DEFAULT_FILE_UPLOAD_TIMEOUT_MS,
  }) {
    if (!validTelegramToken(token)) throw new TypeError('Telegram Bot Token is invalid');
    if (typeof fetchImpl !== 'function') throw new TypeError('TelegramApi requires fetch');
    this.#token = token.trim();
    this.#fetch = fetchImpl;
    this.#baseUrl = new URL(baseUrl);
    this.#fileUploadTimeoutMs = positiveTimeout(fileUploadTimeoutMs, 'fileUploadTimeoutMs');
  }

  async getMe(options = {}) {
    return this.#call('getMe', {}, options);
  }

  async getWebhookInfo(options = {}) {
    return this.#call('getWebhookInfo', {}, options);
  }

  async getUpdates({ offset, timeout = 25, signal } = {}) {
    const payload = {
      timeout,
      limit: 100,
      allowed_updates: ['message'],
      ...(Number.isSafeInteger(offset) ? { offset } : {}),
    };
    return this.#call('getUpdates', payload, {
      signal,
      timeoutMs: Math.max(10_000, (timeout + 10) * 1_000),
    });
  }

  async getFile({ fileId, signal } = {}) {
    const id = cleanString(fileId);
    if (!id || !/^[A-Za-z0-9_-]{1,512}$/.test(id)) {
      throw new TypeError('Telegram file id is invalid');
    }
    return this.#call('getFile', { file_id: id }, { signal });
  }

  async downloadFile({ fileId, signal, maxBytes } = {}) {
    const url = await this.#downloadUrl(fileId, signal);
    return fetchImageBuffer(url, {
      fetchImpl: this.#fetch,
      signal,
      maxBytes,
      allowedHosts: TELEGRAM_FILE_HOSTS,
    });
  }

  async downloadFileStream({ fileId, signal } = {}) {
    const url = await this.#downloadUrl(fileId, signal);
    return fetchFileStream(url, {
      fetchImpl: this.#fetch,
      signal,
      allowedHosts: TELEGRAM_FILE_HOSTS,
    });
  }

  async #downloadUrl(fileId, signal) {
    const file = await this.getFile({ fileId, signal });
    const filePath = cleanString(file?.file_path);
    if (!filePath || filePath.startsWith('/') || filePath.includes('\\')
      || filePath.includes('?') || filePath.includes('#')) {
      throw new Error('Telegram returned an invalid file path');
    }
    let decodedSegments;
    try {
      decodedSegments = filePath.split('/').map((segment) => decodeURIComponent(segment));
    } catch {
      throw new Error('Telegram returned an invalid file path');
    }
    if (decodedSegments.some((segment) => !segment || segment === '.' || segment === '..')) {
      throw new Error('Telegram returned an invalid file path');
    }
    const url = new URL(this.#baseUrl);
    url.pathname = `/file/bot${this.#token}/${filePath}`;
    return url;
  }

  async sendMessage({ chatId, text, replyToMessageId, messageThreadId, signal }) {
    return this.#call('sendMessage', {
      chat_id: chatId,
      text,
      link_preview_options: { is_disabled: true },
      ...(replyToMessageId ? {
        reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true },
      } : {}),
      ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
    }, { signal });
  }

  async sendDocument({ chatId, file, replyToMessageId, messageThreadId, signal }) {
    if (!file || typeof file !== 'object'
      || typeof file.fileName !== 'string' || !file.fileName
      || !Buffer.isBuffer(file.bytes)) {
      throw new TypeError('A Telegram document is required');
    }
    const payload = new FormData();
    payload.append('chat_id', String(chatId));
    payload.append(
      'document',
      new Blob([file.bytes], { type: file.mediaType ?? 'application/octet-stream' }),
      file.fileName,
    );
    if (replyToMessageId) {
      payload.append('reply_parameters', JSON.stringify({
        message_id: replyToMessageId,
        allow_sending_without_reply: true,
      }));
    }
    if (messageThreadId) payload.append('message_thread_id', String(messageThreadId));
    if (signal?.aborted) throw abortReason(signal);
    const uploadSignal = requestSignal(signal, this.#fileUploadTimeoutMs);
    try {
      return await this.#call('sendDocument', payload, {
        signal: uploadSignal,
        timeoutMs: this.#fileUploadTimeoutMs,
        multipart: true,
      });
    } catch (error) {
      if (signal?.aborted) throw abortReason(signal);
      if (error?.code?.startsWith?.('telegram-')) {
        throw telegramArtifactProviderError(error);
      }
      throw uncertainTelegramDelivery(error);
    }
  }

  async editMessageText({ chatId, messageId, text, signal }) {
    return this.#call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      link_preview_options: { is_disabled: true },
    }, { signal });
  }

  async sendChatAction({ chatId, messageThreadId, signal }) {
    return this.#call('sendChatAction', {
      chat_id: chatId,
      action: 'typing',
      ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
    }, { signal });
  }

  async setMyCommands({ commands, scope, languageCode, signal } = {}) {
    if (!Array.isArray(commands) || commands.length === 0
      || commands.some((command) => !validBotCommand(command))) {
      throw new TypeError('Telegram bot commands are invalid');
    }
    return this.#call('setMyCommands', {
      commands,
      ...(scope ? { scope } : {}),
      ...(cleanString(languageCode) ? { language_code: cleanString(languageCode) } : {}),
    }, { signal });
  }

  async setChatMenuButton({ menuButton = COMMANDS_MENU_BUTTON, signal } = {}) {
    if (!menuButton || typeof menuButton !== 'object' || Array.isArray(menuButton)) {
      throw new TypeError('Telegram menu button is invalid');
    }
    return this.#call('setChatMenuButton', { menu_button: menuButton }, { signal });
  }

  async #call(method, payload, { signal, timeoutMs = 15_000, multipart = false } = {}) {
    const url = new URL(this.#baseUrl);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/bot${this.#token}/${method}`;
    let response;
    try {
      response = await this.#fetch(url, {
        method: 'POST',
        ...(multipart ? {} : { headers: { 'content-type': 'application/json' } }),
        body: multipart ? payload : JSON.stringify(payload),
        signal: requestSignal(signal, timeoutMs),
        redirect: 'error',
      });
    } catch (error) {
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError') throw error;
      throw new Error(`Telegram ${method} transport failed`);
    }
    let body;
    try {
      body = await response.json();
    } catch {
      const error = new Error(`Telegram ${method} returned invalid JSON`);
      error.status = response?.status;
      throw error;
    }
    if (!response.ok || body?.ok !== true) {
      const description = cleanString(body?.description);
      const error = new Error(description ?? `Telegram ${method} failed`);
      error.code = Number.isInteger(body?.error_code) ? `telegram-${body.error_code}` : 'telegram-api-error';
      error.status = response.status;
      if (Number.isInteger(body?.error_code)) error.providerCode = body.error_code;
      const retryAfter = Number(body?.parameters?.retry_after);
      if (Number.isFinite(retryAfter) && retryAfter >= 0) {
        error.retry_after = retryAfter;
        error.retryAfter = retryAfter;
      }
      throw error;
    }
    return body.result;
  }
}

export async function inspectTelegramToken(token, options = {}) {
  const api = new TelegramApi({ token, ...options });
  const bot = await api.getMe();
  if (!bot?.id || bot?.is_bot !== true) throw new Error('Telegram token does not belong to a bot');
  return {
    platformId: String(bot.id),
    name: cleanString([bot.first_name, bot.last_name].filter(Boolean).join(' ')) ?? 'Telegram机器人',
    username: cleanString(bot.username),
  };
}
