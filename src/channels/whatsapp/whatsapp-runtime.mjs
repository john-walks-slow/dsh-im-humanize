import {
  areJidsSameUser,
  downloadMediaMessage,
  normalizeMessageContent,
} from '@whiskeysockets/baileys';

import { splitMessageText } from '../shared/editable-message-stream.mjs';
import { ImagePromptError } from '../shared/image-prompt.mjs';
import { createWhatsappBridgeStatus, WhatsappHarnessBridge } from './whatsapp-bridge.mjs';
import { createWhatsappWebSession } from './whatsapp-web-session.mjs';

const IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 15_000;
const MESSAGE_WRAPPER_KEYS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'documentWithCaptionMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'editedMessage',
  'associatedChildMessage',
  'groupStatusMessage',
  'groupStatusMessageV2',
];
const VIEW_ONCE_WRAPPER_KEYS = new Set([
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
]);

function hasViewOnceWrapper(content) {
  let current = content;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const wrapperKey = MESSAGE_WRAPPER_KEYS.find((key) => current[key]?.message);
    if (!wrapperKey) return false;
    if (VIEW_ONCE_WRAPPER_KEYS.has(wrapperKey)) return true;
    current = current[wrapperKey].message;
  }
  return false;
}

function messageContext(content) {
  return content?.extendedTextMessage?.contextInfo
    ?? content?.imageMessage?.contextInfo
    ?? content?.videoMessage?.contextInfo
    ?? content?.documentMessage?.contextInfo
    ?? null;
}

function messageText(content) {
  return content?.conversation
    ?? content?.extendedTextMessage?.text
    ?? content?.imageMessage?.caption
    ?? content?.videoMessage?.caption
    ?? content?.documentMessage?.caption
    ?? '';
}

function mediaSize(value) {
  if (Number.isSafeInteger(value) && value >= 0) return value;
  let converted;
  try {
    converted = Number(value?.toString?.());
  } catch {
    return undefined;
  }
  return Number.isSafeInteger(converted) && converted >= 0 ? converted : undefined;
}

async function downloadWhatsappImage(message, download, {
  signal,
  maxBytes = DEFAULT_MAX_IMAGE_BYTES,
} = {}) {
  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS);
  const downloadSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const pendingStream = Promise.resolve().then(() => (
    download(message, 'stream', { options: { signal: downloadSignal } })
  ));
  const stream = await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return false;
      settled = true;
      downloadSignal.removeEventListener('abort', onAbort);
      callback(value);
      return true;
    };
    const onAbort = () => finish(reject, downloadSignal.reason);
    downloadSignal.addEventListener('abort', onAbort, { once: true });
    pendingStream.then((value) => {
      if (!finish(resolve, value)) value?.destroy?.();
    }, (error) => finish(reject, error));
    if (downloadSignal.aborted) onAbort();
  }).catch((error) => {
    if (signal?.aborted) throw signal.reason ?? error;
    if (timeout.aborted) {
      throw new ImagePromptError(
        'image-download-failed',
        `WhatsApp image download timed out after ${IMAGE_DOWNLOAD_TIMEOUT_MS} ms`,
        '图片下载失败，请重新发送后再试。',
      );
    }
    throw error;
  });
  const chunks = [];
  let size = 0;
  const abortStream = () => stream?.destroy?.(downloadSignal.reason);
  downloadSignal.addEventListener('abort', abortStream, { once: true });
  try {
    for await (const chunk of stream) {
      downloadSignal.throwIfAborted();
      const data = Buffer.from(chunk);
      size += data.length;
      if (size > maxBytes) {
        stream.destroy?.();
        throw new ImagePromptError(
          'image-too-large',
          `WhatsApp image exceeded ${maxBytes} bytes`,
          '图片超过 5 MB，请压缩后重试。',
        );
      }
      chunks.push(data);
    }
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    if (timeout.aborted) {
      throw new ImagePromptError(
        'image-download-failed',
        `WhatsApp image stream timed out after ${IMAGE_DOWNLOAD_TIMEOUT_MS} ms`,
        '图片下载失败，请重新发送后再试。',
      );
    }
    throw error;
  } finally {
    downloadSignal.removeEventListener('abort', abortStream);
  }
  return Buffer.concat(chunks, size);
}

function whatsappImageSource(message, content, download, { viewOnce = false } = {}) {
  let media;
  let name;
  if (!viewOnce && content?.imageMessage && content.imageMessage.viewOnce !== true) {
    media = content.imageMessage;
  } else if (content?.documentMessage) {
    const type = typeof content.documentMessage.mimetype === 'string'
      ? content.documentMessage.mimetype.toLowerCase() : '';
    if (!IMAGE_MEDIA_TYPES.has(type)) return null;
    media = content.documentMessage;
    name = typeof media.fileName === 'string' ? media.fileName : undefined;
  }
  if (!media) return null;
  const mediaType = typeof media.mimetype === 'string' ? media.mimetype.toLowerCase() : '';
  if (!IMAGE_MEDIA_TYPES.has(mediaType)) return null;
  return {
    name,
    mediaType,
    size: mediaSize(media.fileLength),
    load: (options) => downloadWhatsappImage(message, download, options),
  };
}

export function normalizeWhatsappMessage(message, accountJid, {
  download = downloadMediaMessage,
} = {}) {
  const remoteJid = typeof message?.key?.remoteJid === 'string' ? message.key.remoteJid : '';
  const alternateRemoteJid = typeof message?.key?.remoteJidAlt === 'string'
    ? message.key.remoteJidAlt : '';
  const messageId = typeof message?.key?.id === 'string' ? message.key.id : '';
  if (!remoteJid || !messageId || remoteJid === 'status@broadcast'
    || remoteJid.endsWith('@newsletter')) return null;
  const group = remoteJid.endsWith('@g.us');
  const fromMe = message.key.fromMe === true;
  const selfChat = fromMe && !group
    && [remoteJid, alternateRemoteJid].some((jid) => jid && areJidsSameUser(jid, accountJid));
  if (fromMe && !selfChat) return null;
  const senderJid = selfChat ? accountJid : group ? message.key.participant : remoteJid;
  if (typeof senderJid !== 'string' || !senderJid) return null;
  const viewOnce = hasViewOnceWrapper(message.message);
  const content = normalizeMessageContent(message.message);
  const context = messageContext(content);
  const mentioned = Array.isArray(context?.mentionedJid)
    && context.mentionedJid.some((jid) => areJidsSameUser(jid, accountJid));
  const replyToSelf = typeof context?.participant === 'string'
    && areJidsSameUser(context.participant, accountJid);
  const image = whatsappImageSource(message, content, download, { viewOnce });
  return {
    messageId: `${remoteJid}:${messageId}`,
    providerMessageId: messageId,
    senderId: senderJid,
    senderIsBot: false,
    kind: group ? 'group' : 'direct',
    conversationId: remoteJid,
    content: messageText(content),
    images: image ? [image] : [],
    addressed: !group || mentioned || replyToSelf,
    selfChat,
    replyTarget: { jid: remoteJid, quoted: message, selfChat },
  };
}

class RecentWhatsappOutboundIds {
  #ids = new Map();

  has(id) {
    this.#purge();
    return this.#ids.has(id);
  }

  remember(id) {
    if (typeof id !== 'string' || !id) return;
    this.#purge();
    this.#ids.set(id, Date.now() + 5 * 60_000);
    while (this.#ids.size > 256) this.#ids.delete(this.#ids.keys().next().value);
  }

  #purge() {
    const now = Date.now();
    for (const [id, expiresAt] of this.#ids) {
      if (expiresAt > now) continue;
      this.#ids.delete(id);
    }
  }
}

class WhatsappBotClient {
  #socket;
  #outboundIds;
  #typingTimers = new Map();

  constructor(socket, outboundIds) {
    this.#socket = socket;
    this.#outboundIds = outboundIds;
  }

  async sendText(target, text) {
    await this.#stopTyping(target.jid);
    let result = null;
    for (const [index, chunk] of splitMessageText(text, 4_000).entries()) {
      result = await this.#socket.sendMessage(
        target.jid,
        { text: chunk },
        index === 0 && target.quoted ? { quoted: target.quoted } : undefined,
      );
      this.#outboundIds.remember(result?.key?.id);
    }
    return result;
  }

  async sendTyping(target) {
    if (!target.selfChat && target.quoted?.key) {
      await this.#socket.readMessages([target.quoted.key]).catch(() => undefined);
    }
    await this.#socket.sendPresenceUpdate('composing', target.jid);
    await this.#stopTyping(target.jid, false);
    const timer = setInterval(() => {
      void this.#socket.sendPresenceUpdate('composing', target.jid).catch(() => {
        void this.#stopTyping(target.jid);
      });
    }, 20_000);
    timer.unref?.();
    this.#typingTimers.set(target.jid, timer);
  }

  async close() {
    const jids = [...this.#typingTimers.keys()];
    await Promise.allSettled(jids.map((jid) => this.#stopTyping(jid)));
  }

  async #stopTyping(jid, sendPaused = true) {
    const timer = this.#typingTimers.get(jid);
    if (timer) clearInterval(timer);
    this.#typingTimers.delete(jid);
    if (sendPaused) await this.#socket.sendPresenceUpdate('paused', jid).catch(() => undefined);
  }
}

export function createWhatsappRuntimeStatus() {
  return {
    startedAt: null,
    ready: false,
    connectionState: 'idle',
    harnessReachable: false,
    lastCheckedAt: null,
    lastConnectedAt: null,
    lastError: null,
    ...createWhatsappBridgeStatus(),
  };
}

export class WhatsappRuntime {
  #config;
  #authDir;
  #harness;
  #state;
  #logger;
  #replyTimeoutMs;
  #connectTimeoutMs;
  #createSession;
  #status = createWhatsappRuntimeStatus();
  #abortController = null;
  #session = null;
  #client = null;
  #bridge = null;
  #starting = null;

  constructor({
    config,
    authDir,
    harness,
    state,
    logger = console,
    replyTimeoutMs = 600_000,
    connectTimeoutMs = 30_000,
    createSession = createWhatsappWebSession,
  }) {
    if (!config || !authDir || !harness || !state || typeof createSession !== 'function') {
      throw new TypeError('WhatsappRuntime requires config, auth directory, Harness, state, and session factory');
    }
    this.#config = config;
    this.#authDir = authDir;
    this.#harness = harness;
    this.#state = state;
    this.#logger = logger;
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#connectTimeoutMs = connectTimeoutMs;
    this.#createSession = createSession;
  }

  get status() {
    return structuredClone(this.#status);
  }

  async start() {
    if (this.#status.ready && this.#session) return this.status;
    if (this.#starting) return this.#starting;
    this.#starting = this.#start().finally(() => { this.#starting = null; });
    return this.#starting;
  }

  async #start() {
    await this.stop();
    this.#status.startedAt = new Date().toISOString();
    this.#status.connectionState = 'connecting';
    this.#status.lastError = null;
    await this.#harness.ensureRunning();
    this.#status.harnessReachable = true;
    const controller = new AbortController();
    this.#abortController = controller;
    const outboundIds = new RecentWhatsappOutboundIds();
    let rejectRelink;
    const relinkRequired = new Promise((_, reject) => { rejectRelink = reject; });
    void relinkRequired.catch(() => undefined);
    try {
      const session = await this.#createSession({
        authDir: this.#authDir,
        signal: controller.signal,
        logger: this.#logger,
        onQr: () => rejectRelink(Object.assign(
          new Error('WhatsApp linked-device session must be scanned again'),
          { code: 'relink-required' },
        )),
        onMessage: async (raw) => {
          const message = normalizeWhatsappMessage(raw, this.#config.accountJid);
          if (!message || outboundIds.has(message.providerMessageId) || !this.#bridge) return;
          this.#status.lastCheckedAt = Date.now();
          await this.#bridge.accept(message);
        },
        onDisconnect: ({ error }) => {
          if (controller.signal.aborted) return;
          this.#status.ready = false;
          this.#status.connectionState = 'failed';
          this.#status.lastError = error?.message ?? 'WhatsApp Web connection closed';
        },
      });
      this.#session = session;
      let timer;
      const identity = await Promise.race([
        session.ready,
        relinkRequired,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('WhatsApp Web did not connect in time')),
            this.#connectTimeoutMs,
          );
        }),
      ]).finally(() => clearTimeout(timer));
      if (!areJidsSameUser(identity.accountJid, this.#config.accountJid)) {
        throw new Error('WhatsApp linked account does not match the saved bot');
      }
      const client = new WhatsappBotClient(session.socket, outboundIds);
      this.#client = client;
      this.#bridge = new WhatsappHarnessBridge({
        bot: client,
        harness: this.#harness,
        state: this.#state,
        status: this.#status,
        logger: this.#logger,
        replyTimeoutMs: this.#replyTimeoutMs,
        signal: controller.signal,
      });
      const now = Date.now();
      this.#status.ready = true;
      this.#status.connectionState = 'connected';
      this.#status.lastCheckedAt = now;
      this.#status.lastConnectedAt = now;
      return this.status;
    } catch (error) {
      this.#status.ready = false;
      this.#status.connectionState = 'failed';
      this.#status.lastError = error?.message ?? String(error);
      await this.stop();
      throw error;
    }
  }

  async logout() {
    await this.#session?.logout().catch(() => undefined);
    return this.stop();
  }

  async sendConnectionTest(text) {
    if (!this.#status.ready || !this.#client) {
      const error = new Error('WhatsApp机器人尚未连接');
      error.code = 'test-target-unavailable';
      throw error;
    }
    if (typeof text !== 'string' || !text.trim()) {
      throw new TypeError('WhatsApp connection test text is required');
    }
    await this.#client.sendText({
      jid: this.#config.accountJid,
      selfChat: true,
    }, text);
    return { sent: true };
  }

  async stop() {
    const session = this.#session;
    const client = this.#client;
    const bridge = this.#bridge;
    this.#abortController?.abort();
    this.#abortController = null;
    this.#session = null;
    this.#client = null;
    this.#bridge = null;
    await client?.close().catch(() => undefined);
    await session?.close().catch(() => undefined);
    await Promise.race([
      bridge?.waitForIdle() ?? Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    this.#status.ready = false;
    this.#status.connectionState = 'idle';
    return this.status;
  }
}
