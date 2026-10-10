import { extractConnectionEvidence, createConnectionDiagnostics, atConnectionStage } from '../shared/connection-error.mjs';
import { QQBot, contentSanitizer } from '@tencent-connect/qqbot-nodejs';

import {
  connectionTestTarget,
  connectionTestTargetUnavailable,
} from '../shared/connection-test.mjs';
import { t } from '../shared/i18n.mjs';
import { createQqBridgeStatus, QqHarnessBridge } from './qq-bridge.mjs';
import { isQqMessageAddressed, normalizeQqMentions } from './qq-mention.mjs';

function timeoutError() {
  const error = new Error('QQ WebSocket did not become ready in time');
  error.code = 'connect-timeout';
  return error;
}

export function createQqRuntimeStatus() {
  return {
    startedAt: null,
    ready: false,
    qqConnectionState: 'idle',
    harnessReachable: false,
    lastCheckedAt: null,
    lastConnectedAt: null,
    lastError: null,
    ...createQqBridgeStatus(),
  };
}

export class QqRuntime {
  #config;
  #appSecret;
  #harness;
  #state;
  #contextEnhancement;
  #accessPolicy;
  #logger;
  #diagnostics;
  #replyTimeoutMs;
  #streaming = true;
  #messageBreak = false;
  #humanize = null;
  #connectTimeoutMs;
  #createBot;
  #status = createQqRuntimeStatus();
  #bot = null;
  #bridge = null;
  #abortController = null;
  #runTask = null;
  #starting = null;

  constructor({
    config,
    appSecret,
    harness,
    state,
    contextEnhancement,
    accessPolicy,
    logger = console,
    replyTimeoutMs = 600_000,
    streaming = true, messageBreak = false, humanize = null,
    connectTimeoutMs = 20_000,
    createBot = (options) => new QQBot(options),
  }) {
    if (!config || !appSecret || !harness || !state) {
      throw new TypeError('QqRuntime requires config, app secret, Harness, and state');
    }
    this.#config = config;
    this.#appSecret = appSecret;
    this.#harness = harness;
    this.#state = state;
    this.#contextEnhancement = contextEnhancement;
    this.#accessPolicy = accessPolicy;
    this.#logger = logger; this.#diagnostics = createConnectionDiagnostics({ channel: 'qq', logger });
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#streaming = streaming !== false;
    this.#messageBreak = messageBreak === true;
    this.#humanize = humanize ?? null;
    this.#connectTimeoutMs = connectTimeoutMs;
    this.#createBot = createBot;
  }

  get status() {
    return structuredClone(this.#status);
  }

  async sendConnectionTest(text) {
    if (!this.#status.ready || !this.#bot) {
      throw connectionTestTargetUnavailable(t('QQ机器人'));
    }
    const ownerUserOpenid = typeof this.#config.ownerUserOpenid === 'string'
      ? this.#config.ownerUserOpenid.trim()
      : '';
    const remembered = connectionTestTarget(this.#state);
    const rememberedUserOpenid = remembered?.scope === 'c2c'
      && typeof remembered.targetId === 'string'
      ? remembered.targetId.trim()
      : '';
    const target = rememberedUserOpenid
      ? { scope: 'c2c', targetId: rememberedUserOpenid }
      : (ownerUserOpenid && ownerUserOpenid !== '*'
        ? { scope: 'c2c', targetId: ownerUserOpenid }
        : null);
    if (!target) throw connectionTestTargetUnavailable(t('QQ机器人'));
    await this.#bot.sendText(target, text);
    return { sent: true };
  }

  async presentSessionSyncApproval(target, interaction, options = {}) {
    if (!this.#status.ready || !this.#bridge) return false;
    const actor = typeof target?.route?.userOpenId === 'string' ? target.route.userOpenId.trim() : '';
    if (!actor) return false;
    return this.#bridge.presentSessionSyncApproval(interaction, {
      key: options.key, actor, validate: options.validate,
      send: (text) => this.sendProactiveText(target, text),
    }, options);
  }

  async sendProactiveText(target, text, { signal } = {}) {
    const nativeId = target?.kind === 'user'
      ? (typeof target?.route?.userOpenId === 'string' ? target.route.userOpenId.trim() : '')
      : target?.kind === 'group'
        ? (typeof target?.route?.groupOpenId === 'string' ? target.route.groupOpenId.trim() : '')
        : '';
    if (!nativeId) {
      const error = new TypeError('Invalid QQ proactive delivery target');
      error.code = 'invalid-target';
      throw error;
    }
    if (!this.#status.ready || !this.#bot) {
      const error = new Error('QQ bot is not connected');
      error.code = 'bot-not-connected';
      throw error;
    }
    signal?.throwIfAborted();
    return this.#bot.sendText({
      scope: target.kind === 'user' ? 'c2c' : 'group',
      targetId: nativeId,
    }, text);
  }

  async start() {
    if (this.#status.ready && this.#bot) return this.status;
    if (this.#starting) return this.#starting;
    this.#starting = this.#start().finally(() => {
      this.#starting = null;
    });
    return this.#starting;
  }

  async #start() {
    await this.stop();
    this.#status.startedAt = new Date().toISOString();
    this.#status.qqConnectionState = 'connecting';
    this.#status.lastError = null; this.#status.error = null; this.#diagnostics.clear();
    await atConnectionStage('harness.check', () => this.#harness.ensureRunning());
    this.#status.harnessReachable = true;

    const sdkLogger = {
      error: (...args) => this.#logger.error?.(...args),
      warn: (...args) => this.#logger.warn?.(...args),
      info: (...args) => this.#logger.info?.(...args),
      debug: () => {},
    };
    const bot = this.#createBot({
      appId: this.#config.appId,
      appSecret: this.#appSecret,
      accountId: this.#config.botId,
      logger: sdkLogger,
      transport: 'websocket',
      tokenPrefetch: 'sync',
      // sendText is reserved for literal notices/connection tests. Markdown
      // replies use the explicit msg_type=2 path in sendMarkdownReply().
      markdownSupport: false,
    });
    if (!bot || typeof bot.start !== 'function' || typeof bot.stop !== 'function') {
      throw new TypeError('QQ bot factory returned an invalid client');
    }
    const controller = new AbortController();
    this.#abortController = controller;
    this.#bot = bot;
    this.#bridge = new QqHarnessBridge({
      bot,
      ownerUserOpenid: this.#config.ownerUserOpenid,
      harness: this.#harness,
      state: this.#state,
      contextEnhancement: this.#contextEnhancement,
      accessPolicy: this.#accessPolicy,
      status: this.#status,
      logger: this.#logger,
      replyTimeoutMs: this.#replyTimeoutMs,
      streaming: this.#streaming, messageBreak: this.#messageBreak,
        humanize: this.#humanize,
      signal: controller.signal,
    });
    const botMentionIds = new Set([this.#config.appId]);
    bot.use(async (ctx, next) => {
      ctx.message = normalizeQqMentions(ctx.message, botMentionIds);
      await next();
    });
    // QQ delivers emoji/face messages as opaque `<faceType=..,faceId="..",ext="..">`
    // tags. Parse them into readable text so the Harness sees what the sender
    // actually meant instead of an unusable markup fragment.
    bot.use(contentSanitizer({ parseFaceTags: true }));
    // The SDK typingIndicator middleware was removed: its 50s keepalive was
    // dead in this integration (the SDK awaits middleware handlers while
    // onMessage does not await the bridge task, so `await next()` returned
    // immediately and the timer was cleared). The bridge now runs a
    // self-managed typing session that starts after the read delay,
    // covers the whole compose phase, and actually renews (qq-bridge.mjs).

    let readyResolve;
    let readyReject;
    const ready = new Promise((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });
    const onReady = (data) => {
      if (typeof data?.user?.id === 'string' && data.user.id.trim()) {
        botMentionIds.add(data.user.id.trim());
      }
      const now = Date.now();
      this.#status.ready = true;
      this.#status.qqConnectionState = 'connected';
      this.#status.lastCheckedAt = now;
      this.#status.lastConnectedAt = now;
      this.#status.lastError = null; this.#status.error = null; this.#diagnostics.clear();
      readyResolve();
    };
    const onError = (error) => {
      if (!this.#status.ready) readyReject(error);
      else {
        this.#status.error = this.#diagnostics.report(error, { operation: 'connection.monitor', botId: this.#config?.botId, automatic: true }).publicError;
        this.#status.lastError = this.#status.error.message;
        this.#logger.warn?.(`[dsh-im:qq] bot ${this.#config.botId} connection error:`, extractConnectionEvidence(error).details);
      }
    };
    const onMessage = (_ctx, message) => {
      const task = this.#bridge?.accept(message);
      if (!task) return;
      void task.catch((error) => {
        if (controller.signal.aborted) return;
        this.#logger.error?.(
          `[dsh-im:qq] bot ${this.#config.botId} message handling failed:`,
          extractConnectionEvidence(error).details,
        );
      });
    };
    bot.on('ready', onReady);
    bot.on('resumed', onReady);
    bot.on('error', onError);
    bot.on('message', onMessage);

    const runTask = Promise.resolve().then(() => bot.start(controller.signal));
    this.#runTask = runTask;
    runTask.catch((error) => {
      if (controller.signal.aborted) return;
      readyReject(error);
      this.#status.ready = false;
      this.#status.qqConnectionState = 'failed';
      this.#status.error = this.#diagnostics.report(error, { operation: 'connection.monitor', botId: this.#config?.botId, automatic: true }).publicError;
      this.#status.lastError = this.#status.error.message;
      this.#logger.error?.(`[dsh-im:qq] bot ${this.#config.botId} connection stopped:`, extractConnectionEvidence(error).details);
    });

    let timer;
    try {
      await Promise.race([
        ready,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(timeoutError()), this.#connectTimeoutMs);
        }),
      ]);
      this.#status.ready = true;
      this.#status.qqConnectionState = 'connected';
      this.#status.lastCheckedAt = Date.now();
      this.#status.lastConnectedAt = Date.now();
      return this.status;
    } catch (error) {
      this.#status.ready = false;
      this.#status.qqConnectionState = 'failed';
      this.#status.error = this.#diagnostics.report(error, { operation: 'connection.monitor', botId: this.#config?.botId, automatic: true }).publicError;
      this.#status.lastError = this.#status.error.message;
      await this.stop();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async stop() {
    const bot = this.#bot;
    const bridge = this.#bridge;
    const runTask = this.#runTask;
    this.#abortController?.abort();
    this.#abortController = null;
    this.#bot = null;
    this.#bridge = null;
    this.#runTask = null;
    try {
      bot?.stop();
    } catch (error) {
      this.#logger.warn?.(`[dsh-im:qq] bot ${this.#config.botId} failed to stop cleanly:`, extractConnectionEvidence(error).details);
    }
    await Promise.race([
      runTask?.catch(() => undefined) ?? Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    await bridge?.waitForIdle();
    this.#status.ready = false;
    this.#status.qqConnectionState = 'idle';
    return this.status;
  }
}
