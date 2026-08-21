import { randomUUID } from 'node:crypto';
import { FeishuHarnessBridge } from './bridge.mjs';
import { cardActionProbeCard } from './feishu-cards.mjs';
import { VerifiedFeishuChannel } from './feishu-channel.mjs';
import {
  connectionTestTargetUnavailable,
  sendRememberedConnectionTest,
} from '../shared/connection-test.mjs';

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const CALLBACK_PROBE_SUCCESS_NOTICE = '✅ 修复完成：已实测收到 card.action.trigger，菜单按钮现在可用。';
const CALLBACK_PROBE_TIMEOUT_NOTICE = '⚠️ 修复验证超时：未收到测试卡按钮的 card.action.trigger，不能确认按钮已修复。请不要重复授权；先检查飞书开放平台的卡片回调配置，确认后再发送 /repair。';
const CALLBACK_PROBE_SEND_FAILURE_NOTICE = '⚠️ 修复验证失败：无法发送专用测试卡，不能确认 card.action.trigger 已恢复。请不要重复授权；先检查机器人消息权限和连接状态。';
const CALLBACK_PROBE_ABORT_NOTICE = '⚠️ 修复验证中断：Runtime 已停止，未完成 card.action.trigger 实测，不能确认修复成功。请不要重复授权；先等待机器人恢复连接。';

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function strictCardOperatorOpenId(event) {
  return nonEmptyString(event?.operator?.open_id)
    ?? nonEmptyString(event?.operator?.operator_id?.open_id);
}

function probeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function httpInstanceWithTimeout(httpInstance, timeoutMs) {
  if (!httpInstance || typeof httpInstance.request !== 'function') return undefined;
  const optionsWithTimeout = (options) => ({
    ...(options ?? {}),
    timeout: options?.timeout ?? timeoutMs,
  });
  return {
    request: (options) => httpInstance.request(optionsWithTimeout(options)),
    get: (url, options) => httpInstance.get(url, optionsWithTimeout(options)),
    delete: (url, options) => httpInstance.delete(url, optionsWithTimeout(options)),
    head: (url, options) => httpInstance.head(url, optionsWithTimeout(options)),
    options: (url, options) => httpInstance.options(url, optionsWithTimeout(options)),
    post: (url, data, options) => httpInstance.post(url, data, optionsWithTimeout(options)),
    put: (url, data, options) => httpInstance.put(url, data, optionsWithTimeout(options)),
    patch: (url, data, options) => httpInstance.patch(url, data, optionsWithTimeout(options)),
  };
}

export function createBridgeStatus({ allowedSenderCount = 1 } = {}) {
  return {
    startedAt: null,
    ready: false,
    feishuLongConnectionState: 'idle',
    harnessReachable: false,
    messagesReceived: 0,
    messagesReplied: 0,
    messagesRejected: 0,
    reactionsAdded: 0,
    reactionsRemoved: 0,
    reactionErrors: 0,
    streamResponses: 0,
    streamUpdates: 0,
    streamFallbacks: 0,
    streamErrors: 0,
    cardActionsReceived: 0,
    cardActionProbesVerified: 0,
    lastMessageAt: null,
    lastReplyAt: null,
    lastRejectedAt: null,
    lastCardActionAt: null,
    lastError: null,
    agentPreset: 'standard',
    authorizationMode: 'sender-open-id-allowlist',
    allowedSenderCount,
  };
}

/**
 * Owns one live Feishu long connection and the already-tested bridge stack.
 * The class intentionally receives the SDK and Harness dependencies so the
 * plugin can run it in-process while tests exercise the lifecycle without a
 * real Feishu tenant.
 */
export class FeishuRuntime {
  #lark;
  #botId;
  #appId;
  #appSecret;
  #domain;
  #ownerOpenIds;
  #harness;
  #state;
  #replyTimeoutMs;
  #connectTimeoutMs;
  #requestTimeoutMs;
  #logger;
  #repair;
  #client = null;
  #bridge = null;
  #wsClient = null;
  #starting = null;
  #abortController = null;
  #pendingCardActionProbes = new Map();
  #status;

  constructor({
    lark,
    botId,
    appId,
    appSecret,
    domain = 'feishu',
    ownerOpenId,
    ownerOpenIds,
    harness,
    state,
    repair,
    replyTimeoutMs = 600000,
    connectTimeoutMs = 15000,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    logger = console,
  }) {
    if (!lark) throw new Error('FeishuRuntime requires the Feishu SDK');
    if (!appId || !appSecret) throw new Error('FeishuRuntime requires app credentials');
    const allowedOwners = Array.isArray(ownerOpenIds) ? ownerOpenIds : [ownerOpenId];
    const normalizedOwners = [...new Set(allowedOwners.filter((value) => typeof value === 'string' && value))];
    if (normalizedOwners.length === 0) throw new Error('FeishuRuntime requires at least one owner open_id');
    if (!harness) throw new Error('FeishuRuntime requires a Harness client');
    if (!state) throw new Error('FeishuRuntime requires a state store');
    if (repair !== undefined && repair !== null && !nonEmptyString(botId)) {
      throw new TypeError('FeishuRuntime repair capability requires a botId');
    }
    if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
      throw new TypeError('FeishuRuntime requestTimeoutMs must be a positive number');
    }

    this.#lark = lark;
    this.#botId = nonEmptyString(botId);
    this.#appId = appId;
    this.#appSecret = appSecret;
    this.#domain = domain;
    this.#ownerOpenIds = normalizedOwners;
    this.#harness = harness;
    this.#state = state;
    this.#repair = repair ?? null;
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#connectTimeoutMs = connectTimeoutMs;
    this.#requestTimeoutMs = requestTimeoutMs;
    this.#logger = logger;
    this.#status = createBridgeStatus({ allowedSenderCount: normalizedOwners.length });
  }

  get status() {
    return structuredClone(this.#status);
  }

  async start() {
    if (this.#wsClient && this.#status.ready) return this.status;
    if (this.#starting) return this.#starting;

    this.#starting = this.#start().finally(() => {
      this.#starting = null;
    });
    return this.#starting;
  }

  async #start() {
    const abortController = new AbortController();
    this.#abortController = abortController;
    const { signal } = abortController;
    this.#status.startedAt = new Date().toISOString();
    this.#status.feishuLongConnectionState = 'connecting';
    this.#status.lastError = null;

    try {
      await this.#harness.ensureRunning({ signal });
      this.#status.harnessReachable = true;

      const sdkDomain = this.#domain === 'lark'
        ? this.#lark.Domain.Lark
        : this.#lark.Domain.Feishu;
      const larkConfig = {
        appId: this.#appId,
        appSecret: this.#appSecret,
        domain: sdkDomain,
      };
      const httpInstance = httpInstanceWithTimeout(
        this.#lark.defaultHttpInstance,
        this.#requestTimeoutMs,
      );
      if (httpInstance) larkConfig.httpInstance = httpInstance;
      this.#client = new this.#lark.Client(larkConfig);
      const channel = new VerifiedFeishuChannel({
        client: this.#client,
        initialText: '已连接 DeepSeek Harness，正在思考…',
      });
      this.#bridge = new FeishuHarnessBridge({
        client: this.#client,
        channel,
        harness: this.#harness,
        state: this.#state,
        status: this.#status,
        allowedSenderOpenIds: new Set(this.#ownerOpenIds),
        botId: this.#botId,
        appId: this.#appId,
        repair: this.#repair,
        repairOwnerOpenIds: new Set(this.#ownerOpenIds.filter((value) => value !== '*')),
        replyTimeoutMs: this.#replyTimeoutMs,
        signal,
        logger: this.#logger,
      });

      const dispatcher = new this.#lark.EventDispatcher({}).register({
        'im.message.receive_v1': (event) => {
          this.#bridge.accept(event);
          return {};
        },
        'im.message.reaction.created_v1': () => ({}),
        'im.message.reaction.deleted_v1': () => ({}),
        // Interactive-card button callbacks (only delivered when the app
        // subscribes card.action.trigger; the number-reply fallback covers
        // apps that do not).
        'card.action.trigger': (event) => {
          this.#status.cardActionsReceived += 1;
          this.#status.lastCardActionAt = new Date().toISOString();
          if (!this.#consumeCardActionProbe(event)) this.#bridge.onCardAction(event);
          return {};
        },
      });

      let settleReady;
      let settleError;
      const ready = new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error(`Feishu WebSocket handshake timed out after ${this.#connectTimeoutMs}ms`));
        }, this.#connectTimeoutMs);
        settleReady = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        settleError = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        };
      });

      this.#wsClient = new this.#lark.WSClient({
        ...larkConfig,
        loggerLevel: this.#lark.LoggerLevel.info,
        handshakeTimeoutMs: 15000,
        onReady: () => {
          this.#status.feishuLongConnectionState = 'connected';
          this.#status.ready = true;
          this.#status.lastError = null;
          settleReady();
        },
        onError: (error) => {
          this.#status.feishuLongConnectionState = 'failed';
          this.#status.ready = false;
          this.#status.lastError = error?.message ?? String(error);
          this.#logger.error('[dsh-feishu] Feishu long connection failed:', this.#status.lastError);
          settleError(error);
        },
        onReconnecting: () => {
          this.#status.feishuLongConnectionState = 'reconnecting';
          this.#status.ready = false;
        },
        onReconnected: () => {
          this.#status.feishuLongConnectionState = 'connected';
          this.#status.ready = true;
          this.#status.lastError = null;
        },
      });
      await this.#wsClient.start({ eventDispatcher: dispatcher }).catch((error) => {
        settleError(error);
      });
      await ready;
      return this.status;
    } catch (error) {
      this.#status.ready = false;
      this.#status.feishuLongConnectionState = 'failed';
      this.#status.lastError = error?.message ?? String(error);
      await this.stop({ preserveError: true });
      throw error;
    }
  }

  /**
   * Send a one-shot callback card and resolve only after Feishu delivers the
   * exact message/nonce/operator tuple over card.action.trigger. The controller
   * uses this as the final proof for both browser- and chat-initiated repairs.
   */
  async beginCardActionProbe({ expectedOperatorOpenId, timeoutMs = 90_000 } = {}) {
    if (!this.#status.ready || !this.#client) {
      throw probeError('card_action_probe_unavailable', '飞书机器人尚未连接');
    }
    const operatorOpenId = nonEmptyString(expectedOperatorOpenId);
    if (!operatorOpenId || operatorOpenId === '*') {
      throw new TypeError('A precise Feishu operator open_id is required');
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10 * 60_000) {
      throw new TypeError('Card-action probe timeout must be between 1 and 600000ms');
    }

    const nonce = randomUUID().replaceAll('-', '');
    let response;
    try {
      response = await this.#client.im.v1.message.create({
        params: { receive_id_type: 'open_id' },
        data: {
          receive_id: operatorOpenId,
          msg_type: 'interactive',
          content: cardActionProbeCard(nonce),
        },
      });
    } catch {
      void this.#sendCardActionProbeNotice(
        operatorOpenId,
        CALLBACK_PROBE_SEND_FAILURE_NOTICE,
        'failure',
      );
      throw probeError('card_action_probe_send_failed', '无法发送飞书卡片回调测试');
    }
    if (response?.code && response.code !== 0) {
      void this.#sendCardActionProbeNotice(
        operatorOpenId,
        CALLBACK_PROBE_SEND_FAILURE_NOTICE,
        'failure',
      );
      throw probeError('card_action_probe_send_failed', '无法发送飞书卡片回调测试');
    }
    const messageId = nonEmptyString(response?.data?.message_id)
      ?? nonEmptyString(response?.message_id);
    if (!messageId) {
      void this.#sendCardActionProbeNotice(
        operatorOpenId,
        CALLBACK_PROBE_SEND_FAILURE_NOTICE,
        'failure',
      );
      throw probeError('card_action_probe_send_failed', '飞书未返回测试卡片的消息 ID');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const current = this.#pendingCardActionProbes.get(messageId);
        if (!current || current.nonce !== nonce) return;
        this.#pendingCardActionProbes.delete(messageId);
        void this.#sendCardActionProbeNotice(
          operatorOpenId,
          CALLBACK_PROBE_TIMEOUT_NOTICE,
          'timeout',
        );
        reject(probeError(
          'card_action_probe_timeout',
          '在规定时间内未收到飞书卡片按钮回调',
        ));
      }, timeoutMs);
      timeout.unref?.();
      this.#pendingCardActionProbes.set(messageId, {
        messageId,
        nonce,
        expectedOperatorOpenId: operatorOpenId,
        timeout,
        resolve,
        reject,
      });
    });
  }

  #consumeCardActionProbe(event) {
    const messageId = nonEmptyString(event?.context?.open_message_id);
    if (!messageId) return false;
    const probe = this.#pendingCardActionProbes.get(messageId);
    if (!probe) return false;
    const value = event?.action?.value;
    const operatorOpenId = strictCardOperatorOpenId(event);
    if (value?.action !== 'repair_verify'
      || value?.nonce !== probe.nonce
      || operatorOpenId !== probe.expectedOperatorOpenId) {
      return false;
    }
    clearTimeout(probe.timeout);
    this.#pendingCardActionProbes.delete(messageId);
    this.#status.cardActionProbesVerified += 1;
    // Start the terminal notification before resolving the controller-facing
    // probe. A repair may rotate the App Secret and immediately replace this
    // runtime after resolution; initiating the send here keeps chat and web
    // repair flows equally observable. Notification failure never invalidates
    // the callback proof itself.
    void this.#sendCardActionProbeNotice(
      operatorOpenId,
      CALLBACK_PROBE_SUCCESS_NOTICE,
      'success',
    ).finally(() => {
      probe.resolve({
        verified: true,
        messageId,
        operatorOpenId,
      });
    });
    return true;
  }

  #sendCardActionProbeNotice(operatorOpenId, text, outcome) {
    const client = this.#client;
    if (!client) {
      this.#logger.warn?.(`[dsh-feishu] unable to send the callback repair ${outcome} notice`);
      return Promise.resolve(false);
    }
    return Promise.resolve().then(async () => {
      const response = await client.im.v1.message.create({
        params: { receive_id_type: 'open_id' },
        data: {
          receive_id: operatorOpenId,
          msg_type: 'text',
          content: JSON.stringify({ text }),
        },
      });
      if (response?.code && response.code !== 0) {
        throw new Error('Feishu callback repair notice failed');
      }
      return true;
    }).catch(() => {
      this.#logger.warn?.(`[dsh-feishu] unable to send the callback repair ${outcome} notice`);
      return false;
    });
  }

  async sendConnectionTest(text) {
    if (!this.#status.ready || !this.#client) {
      const error = new Error('飞书机器人尚未连接');
      error.code = 'test-target-unavailable';
      throw error;
    }
    if (typeof text !== 'string' || !text.trim()) {
      throw new TypeError('Feishu connection test text is required');
    }
    const send = async (receiveIdType, receiveId, content) => {
      const response = await this.#client.im.v1.message.create({
        params: { receive_id_type: receiveIdType },
        data: {
          receive_id: receiveId,
          msg_type: 'text',
          content: JSON.stringify({ text: content }),
        },
      });
      if (response?.code && response.code !== 0) {
        throw new Error(`Feishu connection test failed: ${response.msg || response.code}`);
      }
    };

    const ownerOpenId = this.#ownerOpenIds.find((value) => value !== '*');
    if (ownerOpenId) {
      await send('open_id', ownerOpenId, text);
      return { sent: true };
    }

    return sendRememberedConnectionTest({
      state: this.#state,
      text,
      channelLabel: '飞书机器人',
      send: async (target, content) => {
        const chatId = typeof target?.chatId === 'string' ? target.chatId.trim() : '';
        if (!chatId) throw connectionTestTargetUnavailable('飞书机器人');
        await send('chat_id', chatId, content);
      },
    });
  }

  async stop({ preserveError = false } = {}) {
    const error = preserveError ? this.#status.lastError : null;
    const abortController = this.#abortController;
    this.#abortController = null;
    abortController?.abort(new DOMException('Feishu runtime stopped', 'AbortError'));
    for (const probe of this.#pendingCardActionProbes.values()) {
      clearTimeout(probe.timeout);
      void this.#sendCardActionProbeNotice(
        probe.expectedOperatorOpenId,
        CALLBACK_PROBE_ABORT_NOTICE,
        'abort',
      );
      probe.reject(probeError('abort', '飞书运行时已停止'));
    }
    this.#pendingCardActionProbes.clear();
    this.#status.ready = false;
    if (this.#wsClient) {
      this.#wsClient.close({ force: true });
      this.#wsClient = null;
    }
    if (this.#bridge) {
      await this.#bridge.waitForIdle();
      this.#bridge = null;
    }
    this.#client = null;
    this.#status.feishuLongConnectionState = preserveError ? 'failed' : 'idle';
    this.#status.lastError = error;
    return this.status;
  }
}
