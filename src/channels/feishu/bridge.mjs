import QRCode from 'qrcode';
import {
  conversationKey,
  extractInboundMessage,
  extractText,
  isAllowedSender,
  isBotSender,
  splitText,
} from './message-utils.mjs';
import {
  hasInboundImages,
  imagePromptUserMessage,
  promptContentForMessage,
} from '../shared/image-prompt.mjs';
import {
  harnessAnswerForQuestion,
  harnessQuestionText,
  validHarnessQuestion,
} from '../shared/harness-question.mjs';
import { HarnessApprovalQueue } from '../shared/harness-approval.mjs';
import { runCompactCommand } from '../shared/compact-command.mjs';
import {
  isControlCommand,
  runControlCommand,
} from '../shared/control-command.mjs';
import { rememberConnectionTestTarget } from '../shared/connection-test.mjs';
import {
  isModelCommand,
  runModelCommand,
} from '../shared/model-command.mjs';
import { runWorkspaceCommand, resolveSessionListWorkspace, workspacePathSnapshot } from '../shared/workspace-command.mjs';
import { askInWorkspaceSession } from '../shared/workspace-session.mjs';
import {
  MENU_PAGE_SIZE,
  completionCard,
  menuCard,
  menuHelpText,
  sessionListCard,
  watchListCard,
  workspaceListCard,
} from './feishu-cards.mjs';
import { MAX_WATCHES_PER_KEY } from './state-store.mjs';

const INTERACTION_RESOLVED_TEXT = '这个问题已在其他客户端处理，无需再次回答。';
const RESOLVED_REPLY_TTL_MS = 30 * 60_000;

const MENU_COMMAND = /^\/m(?:enu)?$/i;
const REPAIR_COMMAND_PREFIX = /^\/repair(?:\s|$)/i;
const REPAIR_COMMAND = /^\/repair(?:\s+(qr|status|cancel|verify))?\s*$/i;
const WATCH_COMMAND = /^\/watch(?:\s+([^\s]+))?$/i;
const UNWATCH_COMMAND = /^\/unwatch(?:\s+([^\s]+))?$/i;
const WATCHLIST_COMMAND = /^\/watchlist$/i;
const SESSION_LIST_PREFIX = /^\/sessionlist(?:\s|$)/i;
const WORKSPACE_LIST_COMMAND = /^\/workspacelist$/i;
const NUMBER_REPLY = /^\d{1,2}$/;
/** A displayed menu stays number-tappable for this long. */
const MENU_TTL_MS = 10 * 60_000;
const MAX_TRACKED_MENUS = 50;
const REPAIR_LINK_WAIT_MS = 15_000;
const REPAIR_POLL_INTERVAL_MS = 1_000;
const REPAIR_ACTIVE_STATES = new Set([
  'starting', 'qr_ready', 'polling', 'slow_down', 'domain_switched', 'saving',
]);
const REPAIR_TERMINAL_STATES = new Set([
  'succeeded', 'expired', 'cancelled', 'error',
]);
const REPAIR_URL_HOSTS = new Set([
  'accounts.feishu.cn',
  'open.feishu.cn',
  'accounts.larksuite.com',
  'open.larksuite.com',
]);

const HELP_TEXT = [
  '北汇星河 AIOS 已连接 DeepSeek Harness。',
  '',
  '直接发送文字或图片即可继续当前会话。',
  '/new  开启一个全新会话',
  '/compact  压缩当前会话的较早上下文',
  '/workspace 工作区绝对路径  切换工作区',
  '/workspacelist  列出工作区绝对路径',
  '/sessionlist [工作区序号或绝对路径]  列出会话 ID 和标题',
  '/session Session ID 或当前工作区序号  将当前聊天绑定到指定会话',
  '/models  按序号列出所有可用模型',
  '/model [序号或完整模型ID]  查看或切换当前会话模型',
  '示例：先发 /models，再发 /model 2',
  '/stop  停止当前任务',
  '/steer 补充指令  纠偏当前任务',
  '/status  检查连接状态',
  '/repair  修复卡片按钮回调',
  '/m（或 /menu）  打开交互卡片菜单',
  '/watch [Session ID 或序号]  关注会话，任务完成自动推送',
  '/unwatch [Session ID 或序号]  取消关注',
  '/watchlist  查看关注列表',
  '/archived on|off  会话列表是否包含归档会话',
  '/help  显示本帮助',
].join('\n');

const ARCHIVED_COMMAND = /^\/archived(?:\s+(on|off))?$/i;

/** Safe user-facing text for bind/workspace failures (no raw messages). */
function safeErrorText(error) {
  switch (error?.code) {
    case 'workspace-not-absolute':
      return '工作区必须是绝对路径。';
    case 'workspace-not-found':
      return '工作区路径不存在。';
    case 'workspace-not-directory':
      return '工作区路径必须指向一个目录。';
    case 'workspace-bot-not-found':
      return '机器人正在移除或已重新接入，无法操作原会话的工作区。';
    default:
      return '操作失败，请稍后重试。';
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function orderedHistoryEvents(history) {
  return (Array.isArray(history?.events) ? history.events : [])
    .map((entry) => entry?.event ?? entry)
    .filter((entry) => entry && typeof entry === 'object' && Number.isFinite(entry.seq))
    .sort((left, right) => left.seq - right.seq);
}

function senderOpenId(event) {
  return nonEmptyString(event?.sender?.sender_id?.open_id)
    ?? nonEmptyString(event?.sender?.sender_id?.user_id);
}

function strictSenderOpenId(event) {
  return nonEmptyString(event?.sender?.sender_id?.open_id);
}

function abortableDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(done, milliseconds);
    timer.unref?.();
    function done() {
      signal?.removeEventListener('abort', aborted);
      resolve();
    }
    function aborted() {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', aborted, { once: true });
  });
}

function repairSnapshot(value, { botId } = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const registration = source.registration && typeof source.registration === 'object'
    ? source.registration
    : source;
  const operation = nonEmptyString(registration.operation) ?? nonEmptyString(source.operation);
  if (operation && operation !== 'callback_repair') {
    throw new Error('The active Feishu operation is not a callback repair');
  }
  const selectedBotId = nonEmptyString(registration.botId) ?? nonEmptyString(source.botId);
  if (botId && selectedBotId && selectedBotId !== botId) {
    throw new Error('The Feishu repair belongs to another bot');
  }
  const state = nonEmptyString(registration.state);
  const attempt = registration.attemptId ?? registration.attempt;
  const attemptId = typeof attempt === 'string' || Number.isFinite(attempt)
    ? String(attempt)
    : null;
  if (!state || !attemptId) throw new Error('Feishu returned an invalid repair status');
  const verificationUrl = nonEmptyString(registration.verificationUrl)
    ?? nonEmptyString(registration.qrCodeUrl);
  const expiresAt = Number(registration.expiresAt);
  const remainingSeconds = Number(registration.remainingSeconds);
  const pollIntervalMs = Number(registration.pollIntervalMs)
    || (Number(registration.pollIntervalSeconds) * 1000);
  return {
    state,
    attemptId,
    botId: selectedBotId,
    verificationUrl,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
    remainingSeconds: Number.isFinite(remainingSeconds) ? remainingSeconds : null,
    pollIntervalMs: Number.isFinite(pollIntervalMs) && pollIntervalMs > 0
      ? pollIntervalMs
      : null,
    error: registration.error && typeof registration.error === 'object'
      ? { code: nonEmptyString(registration.error.code), message: nonEmptyString(registration.error.message) }
      : null,
  };
}

function safeRepairUrl(rawUrl, expectedAppId) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || !REPAIR_URL_HOSTS.has(url.hostname)) {
    throw new Error('Feishu returned an untrusted repair URL');
  }
  if (url.searchParams.get('tp') !== 'sdk'
    || url.searchParams.get('clientID') !== expectedAppId
    || url.searchParams.has('createOnly')) {
    throw new Error('Feishu returned an invalid existing-app repair URL');
  }
  if (url.toString().includes('{{client_id}}') || url.toString().includes('%7B%7Bclient_id%7D%7D')) {
    throw new Error('Feishu returned an unresolved client id placeholder');
  }
  return url.toString();
}

function canClaimInteractionReply(event, pending) {
  return pending.needsPresentation !== true
    && pending.questions[pending.index]
    && senderOpenId(event) === pending.actor
    && event?.message?.message_type === 'text'
    && nonEmptyString(extractText(event));
}

function ensureStatus(status) {
  for (const key of ['messagesReceived', 'messagesReplied', 'messagesRejected']) {
    status[key] ??= 0;
  }
  status.lastMessageAt ??= null;
  status.lastReplyAt ??= null;
  status.lastRejectedAt ??= null;
  status.lastError ??= null;
}

export class FeishuHarnessBridge {
  #client;
  #channel;
  #harness;
  #state;
  #queues = new Map();
  #pendingInteractions = new Map();
  #interactionKeys = new Map();
  #resolvedQuestionReplies = new Map();
  #acceptedMessageIds = new Set();
  #interactionTasks = new Set();
  #commandTasks = new Set();
  #approvals;
  #status;
  #allowedSenderOpenIds;
  #replyTimeoutMs;
  #logger;
  #signal;
  #botId;
  #appId;
  #repair;
  #repairOwnerOpenIds;
  #repairAttempt = null;
  #repairMonitorVersion = 0;
  #repairPollIntervalMs;
  #repairLinkWaitMs;
  /** Number-tappable menus: conversation key → menu state. */
  #menus = new Map();
  /** Interactive-card message id → route context for button callbacks. */
  #cardKeys = new Map();
  /** The global event-mux watcher (one per bridge). */
  #eventWatcher = null;
  /** Serializes live completions and reconnect compensation. */
  #eventTail = Promise.resolve();
  /** Earliest completion that still needs delivery for each watch. */
  #failedWatchSeqs = new Map();

  constructor({
    client,
    channel,
    harness,
    state,
    status,
    allowedSenderOpenIds = new Set(),
    botId,
    appId,
    repair,
    repairOwnerOpenIds,
    repairPollIntervalMs = REPAIR_POLL_INTERVAL_MS,
    repairLinkWaitMs = REPAIR_LINK_WAIT_MS,
    replyTimeoutMs = 600_000,
    logger = console,
    signal,
  }) {
    if (!client || !harness || !state || !status) {
      throw new TypeError('Feishu bridge dependencies are required');
    }
    if (repair !== undefined && repair !== null) {
      if (!repair || typeof repair.start !== 'function'
        || typeof repair.status !== 'function'
        || typeof repair.cancel !== 'function') {
        throw new TypeError('Feishu repair capability requires start/status/cancel');
      }
      if (!nonEmptyString(botId) || !nonEmptyString(appId)) {
        throw new TypeError('Feishu repair capability requires botId and appId');
      }
    }
    if (!Number.isFinite(repairPollIntervalMs) || repairPollIntervalMs <= 0
      || !Number.isFinite(repairLinkWaitMs) || repairLinkWaitMs <= 0) {
      throw new TypeError('Feishu repair timing values must be positive numbers');
    }
    this.#client = client;
    this.#channel = channel;
    this.#harness = harness;
    this.#state = state;
    this.#status = status;
    this.#allowedSenderOpenIds = allowedSenderOpenIds;
    this.#botId = nonEmptyString(botId);
    this.#appId = nonEmptyString(appId);
    this.#repair = repair ?? null;
    const repairOwners = repairOwnerOpenIds ?? allowedSenderOpenIds;
    this.#repairOwnerOpenIds = new Set(
      [...(repairOwners ?? [])].filter((value) => typeof value === 'string' && value && value !== '*'),
    );
    this.#repairPollIntervalMs = repairPollIntervalMs;
    this.#repairLinkWaitMs = repairLinkWaitMs;
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#logger = logger;
    this.#approvals = new HarnessApprovalQueue({ label: 'Feishu', logger });
    this.#signal = signal;
    ensureStatus(this.#status);
    // Persisted watches must resume at runtime start, not on the first
    // message. Older hosts without the mux watcher simply skip this.
    if (typeof this.#harness?.watchHarnessEvents === 'function') {
      queueMicrotask(() => this.#ensureEventWatcher());
    }
  }

  accept(event) {
    if (this.#signal?.aborted) return Promise.resolve();
    const messageId = nonEmptyString(event?.message?.message_id);
    if (!messageId || isBotSender(event)) return Promise.resolve();
    if (!isAllowedSender(event, this.#allowedSenderOpenIds)) {
      this.#status.messagesRejected += 1;
      this.#status.lastRejectedAt = new Date().toISOString();
      this.#logger.warn?.('[dsh-feishu] ignored a message from a sender outside the allowlist');
      return Promise.resolve();
    }
    if (this.#state.hasSeen(messageId) || this.#acceptedMessageIds.has(messageId)) {
      return Promise.resolve();
    }

    let key;
    try {
      key = conversationKey(event);
    } catch {
      this.#status.messagesRejected += 1;
      this.#status.lastRejectedAt = new Date().toISOString();
      return Promise.resolve();
    }

    if (event.message.chat_type === 'p2p') {
      const chatId = nonEmptyString(event.message.chat_id);
      if (chatId) rememberConnectionTestTarget(this.#state, { chatId });
    }

    this.#acceptedMessageIds.add(messageId);
    const processingReaction = this.#addReaction(messageId, 'OnIt');
    const commandMessage = extractInboundMessage(event, this.#client);
    const commandText = nonEmptyString(commandMessage.content) ?? '';
    const commandRunner = isControlCommand(commandText)
      ? runControlCommand
      : (isModelCommand(commandText) ? runModelCommand : null);
    const addressed = event?.message?.chat_type === 'p2p'
      || (Array.isArray(event?.message?.mentions) && event.message.mentions.length > 0);
    if (commandRunner && addressed) {
      const processing = this.#processFastCommand(
        event,
        messageId,
        key,
        commandMessage,
        commandRunner,
      );
      let current;
      current = processing
        .then(() => this.#finishReaction(messageId, processingReaction, 'DONE'))
        .catch((error) => this.#handleMessageFailure(
          event,
          messageId,
          processingReaction,
          error,
        ))
        .finally(() => {
          this.#acceptedMessageIds.delete(messageId);
          this.#commandTasks.delete(current);
        });
      this.#commandTasks.add(current);
      return current;
    }
    if (this.#isResolvedQuestionReply(event, key)) {
      const current = Promise.resolve()
        .then(() => this.#discardResolvedInteractionReply(event, messageId))
        .then(() => this.#finishReaction(messageId, processingReaction, 'DONE'))
        .catch((error) => this.#handleMessageFailure(
          event,
          messageId,
          processingReaction,
          error,
        ))
        .finally(() => this.#acceptedMessageIds.delete(messageId));
      return current;
    }
    const pending = this.#pendingInteractions.get(key);
    const approvalReply = this.#approvals.claimReply({
      key,
      actor: senderOpenId(event),
      messageId,
      text: extractText(event) ?? '',
      addressed: event?.message?.chat_type === 'p2p'
        || (Array.isArray(event?.message?.mentions) && event.message.mentions.length > 0),
      hasPendingQuestion: Boolean(pending),
      questionCompletion: pending?.submitting || pending?.claimedReplyMessageId
        ? pending.queue
        : null,
      isQuestionPending: () => this.#pendingInteractions.has(key),
      send: (text) => this.#send(event.message.chat_id, text),
    });
    if (approvalReply) {
      const processing = approvalReply.process(async () => {
        if (this.#state.hasSeen(messageId)) return false;
        await this.#state.markSeen(messageId);
        this.#status.lastMessageAt = new Date().toISOString();
        this.#status.messagesReceived += 1;
        return true;
      });
      let current;
      current = processing
        .then(() => this.#finishReaction(messageId, processingReaction, 'DONE'))
        .catch((error) => this.#handleMessageFailure(
          event,
          messageId,
          processingReaction,
          error,
        ))
        .finally(() => {
          this.#acceptedMessageIds.delete(messageId);
          this.#interactionTasks.delete(current);
        });
      this.#interactionTasks.add(current);
      return current;
    }
    if (pending && senderOpenId(event) !== pending.actor) {
      return this.#enqueueMessage(event, messageId, key, processingReaction);
    }
    if (pending?.submitting || pending?.claimedReplyMessageId) {
      return this.#enqueueMessage(event, messageId, key, processingReaction);
    }
    if (pending) {
      if (canClaimInteractionReply(event, pending)) pending.claimedReplyMessageId = messageId;
      const previous = pending.queue ?? Promise.resolve();
      const processing = previous
        .catch(() => undefined)
        .then(() => this.#processInteractionReply(
          event,
          messageId,
          key,
          pending,
          processingReaction,
        ));
      pending.queue = processing;

      const releaseInteraction = () => {
        if (pending.claimedReplyMessageId === messageId) {
          pending.claimedReplyMessageId = null;
        }
        if (pending.queue === processing) pending.queue = null;
      };
      let current;
      current = processing
        .then(
          () => {
            releaseInteraction();
            return this.#finishReaction(messageId, processingReaction, 'DONE');
          },
          (error) => {
            releaseInteraction();
            return this.#handleMessageFailure(
              event,
              messageId,
              processingReaction,
              error,
            );
          },
        )
        .finally(() => {
          releaseInteraction();
          this.#acceptedMessageIds.delete(messageId);
          this.#interactionTasks.delete(current);
        });
      this.#interactionTasks.add(current);
      return current;
    }
    return this.#enqueueMessage(event, messageId, key, processingReaction);
  }

  #enqueueMessage(event, messageId, key, processingReaction, {
    releaseMessageId = true,
    alreadyRecorded = false,
    finalize = true,
  } = {}) {
    const previous = this.#queues.get(key) ?? Promise.resolve();
    const work = previous
      .catch(() => undefined)
      .then(() => this.#handle(event, key, { alreadyRecorded }));
    const settled = finalize
      ? work
        .then(() => this.#finishReaction(messageId, processingReaction, 'DONE'))
        .catch((error) => this.#handleMessageFailure(
          event,
          messageId,
          processingReaction,
          error,
        ))
      : work;
    let current;
    current = settled.finally(() => {
      if (releaseMessageId) this.#acceptedMessageIds.delete(messageId);
      if (this.#queues.get(key) === current) this.#queues.delete(key);
    });
    this.#queues.set(key, current);
    return current;
  }

  async #handleMessageFailure(event, messageId, processingReaction, error) {
    if (error?.code === 'turn-stopped') {
      await this.#removeProcessingReaction(messageId, processingReaction);
      return;
    }
    if (this.#signal?.aborted) {
      await this.#removeProcessingReaction(messageId, processingReaction);
      return;
    }
    this.#logger.error?.('[dsh-feishu] message handling failed:', error?.message ?? String(error));
    this.#status.lastError = error?.message ?? String(error);
    await this.#finishReaction(messageId, processingReaction, 'ERROR');
    await this.#send(
      event.message.chat_id,
      imagePromptUserMessage(error)
        ?? '处理失败，请稍后重试。如果问题持续，请在 DeepSeek Harness 的飞书插件页面检查连接状态。',
    ).catch(() => undefined);
  }

  async waitForIdle() {
    await Promise.allSettled([
      ...this.#queues.values(),
      ...[...this.#pendingInteractions.values()].flatMap((pending) => (
        pending.queue ? [pending.queue] : []
      )),
      ...this.#interactionTasks,
      ...this.#commandTasks,
      this.#eventTail,
    ]);
  }

  async #processFastCommand(event, messageId, key, message, runner) {
    this.#signal?.throwIfAborted();
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.lastMessageAt = new Date().toISOString();
    this.#status.messagesReceived += 1;
    const result = await runner(
      nonEmptyString(message.content) ?? '',
      this.#harness,
      this.#state,
      key,
      {
        signal: this.#signal,
        hasImages: hasInboundImages(message),
        pendingInteraction: this.#pendingInteractions.has(key)
          || this.#approvals.hasPending(key),
        control: { owner: this, key },
      },
    );
    if (result?.stopped) {
      await Promise.allSettled([
        this.#cancelPendingInteraction(key),
        this.#approvals.closeRoute(key),
      ]);
    }
    for (const reply of result?.messages ?? [result?.message]) {
      if (reply) await this.#send(event.message.chat_id, reply);
    }
    this.#status.lastError = null;
  }

  async #handle(event, key, { alreadyRecorded = false } = {}) {
    this.#signal?.throwIfAborted();
    const messageId = event.message.message_id;
    if (!alreadyRecorded) {
      if (this.#state.hasSeen(messageId)) return;
      await this.#state.markSeen(messageId);
      this.#status.lastMessageAt = new Date().toISOString();
      this.#status.messagesReceived += 1;
    }

    const message = extractInboundMessage(event, this.#client);
    const text = message.content;
    const hasImages = hasInboundImages(message);
    const commandText = event.message.message_type === 'text' && !hasImages ? text : null;
    if (!text && !hasImages) {
      await this.#send(event.message.chat_id, '目前支持文字和图片消息。');
      return;
    }

    if (commandText !== null && REPAIR_COMMAND_PREFIX.test(commandText)) {
      await this.#handleRepairCommand(event, commandText);
      return;
    }
    if (commandText === '/help') {
      await this.#send(event.message.chat_id, HELP_TEXT);
      return;
    }
    if (MENU_COMMAND.test(commandText)) {
      this.#rememberMenu(key, { kind: 'menu', chatId: event.message.chat_id });
      await this.#sendCard(event.message.chat_id, menuCard(), { key });
      return;
    }
    if (commandText === '/new') {
      await this.#state.clearSession(key);
      await this.#send(event.message.chat_id, '已开启全新 Harness 会话。');
      return;
    }
    if (commandText === '/status') {
      await this.#harness.ensureRunning({ signal: this.#signal });
      await this.#send(event.message.chat_id, '飞书机器人与 DeepSeek Harness 连接正常。');
      return;
    }
    if (SESSION_LIST_PREFIX.test(commandText)) {
      const selector = commandText.slice('/sessionlist'.length).trim() || null;
      await this.#showSessions({ chatId: event.message.chat_id, key }, selector, 0);
      return;
    }
    if (WORKSPACE_LIST_COMMAND.test(commandText)) {
      await this.#showWorkspaces({ chatId: event.message.chat_id, key });
      return;
    }
    if (WATCH_COMMAND.test(commandText)) {
      const target = (WATCH_COMMAND.exec(commandText)?.[1] ?? '').trim() || null;
      await this.#runWatch(key, event.message.chat_id, target);
      return;
    }
    if (UNWATCH_COMMAND.test(commandText)) {
      const target = (UNWATCH_COMMAND.exec(commandText)?.[1] ?? '').trim() || null;
      await this.#runUnwatch(key, event.message.chat_id, target);
      return;
    }
    if (WATCHLIST_COMMAND.test(commandText)) {
      await this.#showWatchList(key, event.message.chat_id);
      return;
    }
    if (ARCHIVED_COMMAND.test(commandText)) {
      const match = ARCHIVED_COMMAND.exec(commandText);
      const value = match[1]?.toLowerCase();
      if (value !== 'on' && value !== 'off') {
        await this.#send(event.message.chat_id, '用法：/archived on（包含归档会话）或 /archived off（隐藏归档会话）');
        return;
      }
      if (typeof this.#state?.setIncludeArchivedSessions === 'function') {
        await this.#state.setIncludeArchivedSessions(value === 'on');
      }
      await this.#send(
        event.message.chat_id,
        value === 'on' ? '已开启：会话列表包含归档会话。' : '已关闭：会话列表隐藏归档会话。',
      );
      return;
    }
    if (NUMBER_REPLY.test(commandText)) {
      const menu = this.#takeMenu(key);
      if (menu) {
        await this.#handleMenuPick(menu, Number(commandText), {
          chatId: event.message.chat_id,
          key,
          event,
        });
        return;
      }
    }
    const workspaceCommand = commandText === null
      ? null
      : await runWorkspaceCommand(text, this.#harness, key);
    if (workspaceCommand) {
      for (const reply of workspaceCommand.messages ?? [workspaceCommand.message]) {
        await this.#send(event.message.chat_id, reply);
      }
      return;
    }
    const compactCommand = commandText === null
      ? null
      : await runCompactCommand(
          commandText,
          this.#harness,
          this.#state,
          key,
          { signal: this.#signal },
        );
    if (compactCommand) {
      await this.#send(event.message.chat_id, compactCommand.message);
      return;
    }

    this.#logger.info?.(`[dsh-feishu] processing ${event.message.chat_type} message ${messageId}`);
    try {
      await this.#answerWithStream(event, key, message);
      this.#status.messagesReplied += 1;
      this.#status.lastReplyAt = new Date().toISOString();
      this.#status.lastError = null;
    } finally {
      await this.#cancelPendingInteraction(key);
      await this.#approvals.closeRoute(key);
    }
  }

  // ── Interactive cards: menus and session/workspace lists ────────────────

  // Existing-app callback repair. This path deliberately uses ordinary text
  // and number replies because callback buttons are the capability being fixed.
  async #handleRepairCommand(event, commandText) {
    if (event?.message?.chat_type !== 'p2p') {
      await this.#send(event.message.chat_id, '为避免授权链接暴露，请私聊机器人发送 /repair。');
      return;
    }
    const actorOpenId = strictSenderOpenId(event);
    if (!actorOpenId || !this.#repairOwnerOpenIds.has(actorOpenId)) {
      await this.#send(
        event.message.chat_id,
        this.#repairOwnerOpenIds.size === 0
          ? '当前机器人没有可验证的接入者身份，不能从聊天发起修复；请先在插件页设置管理员。'
          : '此操作只能由机器人接入者在私聊中发起，未进行任何修改。',
      );
      return;
    }
    if (!this.#repair) {
      await this.#send(event.message.chat_id, '当前 Host 版本暂不支持聊天内修复，请先更新插件。');
      return;
    }

    const parsed = REPAIR_COMMAND.exec(commandText);
    if (!parsed) {
      await this.#send(event.message.chat_id, '用法：/repair、/repair qr、/repair status、/repair cancel 或 /repair verify');
      return;
    }
    const operation = parsed[1]?.toLowerCase() ?? 'start';
    const chatId = event.message.chat_id;
    if (operation === 'start') {
      await this.#startRepair({ actorOpenId, chatId });
      return;
    }

    const attempt = this.#repairAttempt;
    if (!attempt) {
      await this.#send(
        chatId,
        '当前 Runtime 没有可恢复的修复任务记录（机器人可能刚完成密钥更新并重启）。本命令不会启动新的授权；请查看机器人发送的验证结果，确认上一次任务已结束后再发送 /repair。',
      );
      return;
    }
    if (attempt.actorOpenId !== actorOpenId) {
      await this.#send(chatId, '另一位管理员正在修复该机器人，本次不会显示其授权信息。');
      return;
    }
    if (operation === 'cancel') {
      let snapshot;
      try {
        const result = await this.#repair.cancel(this.#repairArgs(attempt));
        snapshot = repairSnapshot(result, { botId: this.#botId });
        attempt.snapshot = snapshot;
      } catch {
        await this.#send(chatId, '暂时无法取消修复任务，请稍后重试。');
        return;
      }
      if (snapshot.state === 'cancelled') {
        attempt.stopped = true;
        this.#repairMonitorVersion += 1;
      }
      await this.#send(chatId, this.#repairStatusText(snapshot));
      return;
    }

    let snapshot;
    try {
      snapshot = await this.#refreshRepairAttempt(attempt);
    } catch {
      await this.#send(chatId, '暂时无法查询修复状态，请稍后重试。');
      return;
    }
    if (operation === 'qr') {
      if (!REPAIR_ACTIVE_STATES.has(snapshot.state) || !attempt.verificationUrl) {
        await this.#send(chatId, this.#repairStatusText(snapshot, { verificationFocused: true }));
        return;
      }
      await this.#sendRepairQr(chatId, attempt.verificationUrl, snapshot);
      return;
    }
    await this.#send(chatId, this.#repairStatusText(snapshot, {
      verificationFocused: operation === 'verify',
    }));
  }

  #repairArgs(attempt) {
    return {
      botId: this.#botId,
      attemptId: attempt.attemptId,
      actorOpenId: attempt.actorOpenId,
      chatId: attempt.chatId,
    };
  }

  async #startRepair({ actorOpenId, chatId }) {
    const previous = this.#repairAttempt;
    if (previous && REPAIR_ACTIVE_STATES.has(previous.snapshot.state)) {
      if (previous.actorOpenId !== actorOpenId) {
        await this.#send(chatId, '另一位管理员正在修复该机器人，本次不会显示其授权信息。');
        return;
      }
      try {
        const current = await this.#refreshRepairAttempt(previous);
        if (REPAIR_ACTIVE_STATES.has(current.state) && previous.verificationUrl) {
          await this.#sendRepairLink(chatId, previous.verificationUrl, current, { existing: true });
          return;
        }
      } catch {
        await this.#send(chatId, '暂时无法查询修复状态，请稍后重试。');
        return;
      }
    }

    let snapshot;
    try {
      snapshot = repairSnapshot(await this.#repair.start({
        botId: this.#botId,
        actorOpenId,
        chatId,
      }), { botId: this.#botId });
      snapshot = await this.#waitForRepairLink(snapshot, { actorOpenId, chatId });
    } catch {
      await this.#send(chatId, '修复流程暂时失败，现有机器人连接不受影响；请稍后发送 /repair 重试。');
      return;
    }
    const attempt = {
      attemptId: snapshot.attemptId,
      actorOpenId,
      chatId,
      snapshot,
      verificationUrl: null,
      stopped: false,
      announcedSaving: false,
      announcedTerminal: false,
    };
    this.#repairAttempt = attempt;

    if (snapshot.verificationUrl) {
      try {
        attempt.verificationUrl = safeRepairUrl(snapshot.verificationUrl, this.#appId);
      } catch {
        attempt.stopped = true;
        await this.#repair.cancel(this.#repairArgs(attempt)).catch(() => undefined);
        await this.#send(chatId, '飞书返回了无法安全验证的授权链接，已中止本次修复。');
        return;
      }
    }
    if (REPAIR_TERMINAL_STATES.has(snapshot.state)) {
      attempt.announcedTerminal = true;
      if (snapshot.state !== 'succeeded') {
        await this.#send(chatId, this.#repairStatusText(snapshot));
      }
      return;
    }
    if (!attempt.verificationUrl) {
      attempt.stopped = true;
      await this.#send(chatId, '飞书未返回授权链接，已中止本次修复。');
      return;
    }
    await this.#sendRepairLink(chatId, attempt.verificationUrl, snapshot);
    this.#monitorRepair(attempt);
  }

  async #waitForRepairLink(initial, context) {
    let current = initial;
    const deadline = Date.now() + this.#repairLinkWaitMs;
    while (!current.verificationUrl && REPAIR_ACTIVE_STATES.has(current.state)) {
      if (Date.now() >= deadline) throw new Error('Feishu repair link timed out');
      await abortableDelay(Math.min(100, this.#repairPollIntervalMs), this.#signal);
      current = repairSnapshot(await this.#repair.status({
        botId: this.#botId,
        attemptId: current.attemptId,
        actorOpenId: context.actorOpenId,
        chatId: context.chatId,
      }), { botId: this.#botId });
    }
    return current;
  }

  async #refreshRepairAttempt(attempt) {
    const snapshot = repairSnapshot(
      await this.#repair.status(this.#repairArgs(attempt)),
      { botId: this.#botId },
    );
    if (snapshot.attemptId !== attempt.attemptId) {
      throw new Error('Feishu repair attempt changed unexpectedly');
    }
    attempt.snapshot = snapshot;
    if (snapshot.verificationUrl) {
      attempt.verificationUrl = safeRepairUrl(snapshot.verificationUrl, this.#appId);
    }
    return snapshot;
  }

  #monitorRepair(attempt) {
    const version = ++this.#repairMonitorVersion;
    void (async () => {
      while (!attempt.stopped && this.#repairAttempt === attempt
        && this.#repairMonitorVersion === version
        && !this.#signal?.aborted) {
        const delayMs = Math.max(
          250,
          Math.min(10_000, attempt.snapshot.pollIntervalMs ?? this.#repairPollIntervalMs),
        );
        await abortableDelay(delayMs, this.#signal);
        if (attempt.stopped || this.#repairAttempt !== attempt || this.#repairMonitorVersion !== version) return;
        const snapshot = await this.#refreshRepairAttempt(attempt);
        if (snapshot.state === 'saving' && !attempt.announcedSaving) {
          attempt.announcedSaving = true;
          await this.#send(
            attempt.chatId,
            '授权已确认，正在发送并等待测试按钮回调；收到真实回调后才会完成。',
          );
        }
        if (REPAIR_TERMINAL_STATES.has(snapshot.state)) {
          attempt.stopped = true;
          // Runtime sends the verified-success notice before resolving the
          // controller probe. Avoid duplicating it here; failure terminals
          // still need an explicit chat-side explanation.
          if (snapshot.state !== 'succeeded' && !attempt.announcedTerminal) {
            attempt.announcedTerminal = true;
            await this.#send(attempt.chatId, this.#repairStatusText(snapshot));
          }
          return;
        }
      }
    })().catch(async () => {
      if (this.#signal?.aborted || attempt.stopped || this.#repairAttempt !== attempt) return;
      attempt.stopped = true;
      this.#logger.warn?.('[dsh-feishu] callback repair status monitoring failed');
      await this.#send(
        attempt.chatId,
        '修复状态查询中断，现有机器人连接不受影响；发送 /repair status 重试查询。',
      ).catch(() => undefined);
    });
  }

  async #sendRepairLink(chatId, url, snapshot, { existing = false } = {}) {
    const remaining = snapshot.remainingSeconds
      ?? (snapshot.expiresAt ? Math.max(0, Math.ceil((snapshot.expiresAt - Date.now()) / 1000)) : null);
    const expiry = remaining === null
      ? '链接为短期有效'
      : `链接约 ${Math.max(1, Math.ceil(remaining / 60))} 分钟后过期`;
    await this.#send(chatId, [
      existing ? '已有一个修复任务在等待授权。' : '🔧 准备修复卡片按钮。',
      '本次只会增量添加 card.action.trigger。请核对确认页只显示这一项；若出现其他权限或事件，请取消。',
      '',
      '当前设备直接打开：',
      url,
      '',
      `若要用另一台设备扫码，发送 /repair qr。${expiry}。`,
    ].join('\n'));
  }

  async #sendRepairQr(chatId, url, snapshot) {
    try {
      const image = await QRCode.toBuffer(url, {
        errorCorrectionLevel: 'M', margin: 1, width: 480, type: 'png',
      });
      const uploaded = await this.#client.im.v1.image.create({
        data: { image_type: 'message', image },
      });
      const imageKey = nonEmptyString(uploaded?.image_key) ?? nonEmptyString(uploaded?.data?.image_key);
      if (!imageKey) throw new Error('Feishu QR upload returned no image key');
      const remaining = snapshot.remainingSeconds
        ?? (snapshot.expiresAt ? Math.max(0, Math.ceil((snapshot.expiresAt - Date.now()) / 1000)) : null);
      await this.#send(
        chatId,
        `请用另一台设备扫码完成授权${remaining === null ? '' : `（剩余约 ${Math.max(1, Math.ceil(remaining / 60))} 分钟）`}。`,
      );
      const response = await this.#client.im.v1.message.create({
        params: { receive_id_type: 'chat_id' },
        data: {
          receive_id: chatId,
          msg_type: 'image',
          content: JSON.stringify({ image_key: imageKey }),
        },
      });
      if (response?.code && response.code !== 0) throw new Error('Feishu QR message send failed');
    } catch {
      await this.#send(chatId, `二维码暂时无法发送，请直接打开授权链接：\n${url}`);
    }
  }

  #repairStatusText(snapshot, { verificationFocused = false } = {}) {
    if (snapshot.state === 'succeeded') {
      return '✅ 修复完成：已实测收到 card.action.trigger，菜单按钮现在可用。';
    }
    if (snapshot.state === 'expired' || snapshot.error?.code === 'expired_token') {
      return '授权链接已过期；平台未返回成功结果，无法确认已修复。发送 /repair 生成新链接。';
    }
    if (snapshot.state === 'cancelled' || snapshot.error?.code === 'abort') {
      return '已取消本次修复授权，未确认完成修复。';
    }
    if (snapshot.error?.code === 'access_denied') {
      return '你已取消或拒绝授权，没有确认修复；发送 /repair 可重试。';
    }
    if (snapshot.error?.code === 'card_action_probe_timeout'
      || snapshot.error?.code === 'card-action-probe-timeout') {
      return '授权已提交，但未收到测试按钮回调。可能尚未点击或配置仍在传播；稍后发送 /repair verify 查询，不要盲目重复授权。';
    }
    if (snapshot.state === 'error') {
      return '修复流程暂时失败，现有机器人连接不受影响；发送 /repair 可重试。';
    }
    if (snapshot.state === 'saving') {
      return '授权已确认，正在等待专用测试按钮的真实回调；回调到达前不会宣告成功。';
    }
    if (verificationFocused) {
      return '授权尚未完成，暂时不能验证卡片按钮。请先打开授权链接并确认。';
    }
    const remaining = snapshot.remainingSeconds === null
      ? ''
      : `，剩余约 ${Math.max(1, Math.ceil(snapshot.remainingSeconds / 60))} 分钟`;
    return `修复任务正在等待授权${remaining}。发送 /repair qr 可获取二维码，/repair cancel 可取消。`;
  }

  /**
   * Card button callback (card.action.trigger). The operator must be an
   * allowed sender: group members outside the allowlist must never drive
   * session binding, workspace switches or other card actions.
   */
  onCardAction(event) {
    const operatorOpenId = nonEmptyString(event?.operator?.open_id)
      ?? nonEmptyString(event?.operator?.user_id)
      // Keep accepting the legacy nested shape while preferring the current
      // card.action.trigger v2 payload used by the official SDK.
      ?? nonEmptyString(event?.operator?.operator_id?.open_id)
      ?? nonEmptyString(event?.operator?.operator_id?.user_id);
    const operatorAllowed = operatorOpenId !== null
      && (this.#allowedSenderOpenIds.has('*') || this.#allowedSenderOpenIds.has(operatorOpenId));
    if (!operatorAllowed) {
      this.#logger.warn?.('[dsh-feishu] ignoring card action from an unallowed sender');
      return Promise.resolve();
    }
    const action = typeof event?.action?.value?.action === 'string'
      ? event.action.value.action
      : null;
    if (!action) return Promise.resolve();
    const messageId = nonEmptyString(event?.context?.open_message_id);
    const entry = messageId ? this.#cardKeys.get(messageId) : null;
    if (!entry) {
      // The card predates this process (the in-memory mapping resets on
      // restart) or never came from us: nudge instead of staying silent.
      const chatId = nonEmptyString(event?.context?.open_chat_id);
      if (chatId) {
        this.#send(chatId, '这个菜单已过期，请回复 /m 重新打开。').catch(() => undefined);
      }
      return Promise.resolve();
    }
    // The promise is returned so tests (and future callers) can await the
    // action; the runtime dispatcher ignores it.
    return this.#handleCardAction(action, entry).catch((error) => {
      this.#logger.warn?.('[dsh-feishu] card action failed:', error.message);
    });
  }

  async #handleCardAction(action, { chatId, key, sessionWorkspace = null }) {
    if (action === 'sessions' || /^sessions:\d+$/.test(action)) {
      const page = action === 'sessions' ? 0 : Number(action.slice('sessions:'.length));
      await this.#showSessions({ chatId, key }, sessionWorkspace, page);
      return;
    }
    if (action === 'workspaces') {
      await this.#showWorkspaces({ chatId, key });
      return;
    }
    if (action === 'watchlist') {
      await this.#showWatchList(key, chatId);
      return;
    }
    if (action === 'new') {
      await this.#state.clearSession(key);
      await this.#send(chatId, '已开启全新 Harness 会话。');
      return;
    }
    if (action === 'status') {
      await this.#harness.ensureRunning({ signal: this.#signal });
      await this.#send(chatId, '飞书机器人与 DeepSeek Harness 连接正常。');
      return;
    }
    if (action === 'help') {
      await this.#send(chatId, menuHelpText());
      return;
    }
    if (action.startsWith('use:')) {
      await this.#bindSession(key, chatId, action.slice('use:'.length));
      return;
    }
    if (action.startsWith('workspace:')) {
      await this.#switchWorkspace(key, chatId, action.slice('workspace:'.length));
      return;
    }
    if (action.startsWith('unwatch:')) {
      await this.#runUnwatch(key, chatId, action.slice('unwatch:'.length));
      return;
    }
    if (action.startsWith('watch:')) {
      await this.#runWatch(key, chatId, action.slice('watch:'.length));
    }
  }

  #rememberMenu(key, menu) {
    if (this.#menus.size >= MAX_TRACKED_MENUS) {
      const oldest = this.#menus.keys().next().value;
      if (oldest !== undefined) this.#menus.delete(oldest);
    }
    this.#menus.delete(key);
    this.#menus.set(key, { ...menu, expiresAt: Date.now() + MENU_TTL_MS });
  }

  #takeMenu(key) {
    const menu = this.#menus.get(key);
    if (!menu) return null;
    if (menu.expiresAt < Date.now()) {
      this.#menus.delete(key);
      return null;
    }
    return menu;
  }

  async #handleMenuPick(menu, number, { chatId, key, event }) {
    if (menu.kind === 'menu') {
      const action = ['sessions', 'workspaces', 'new', 'status', 'help', 'repair', 'watchlist'][number - 1];
      if (!action) {
        await this.#send(chatId, '菜单没有这个编号，回复 /m 重新打开。');
        return;
      }
      if (action === 'repair') {
        await this.#handleRepairCommand(event, '/repair');
        return;
      }
      await this.#handleCardAction(action, { chatId, key });
      return;
    }
    if (menu.kind === 'sessions') {
      const session = menu.sessions[number - 1];
      if (!session?.sessionId) {
        await this.#send(chatId, `本页只有 ${menu.sessions.length} 个会话，回复 /sessionlist 重新查看。`);
        return;
      }
      // The number label sits on the session (bind) button of the row.
      await this.#handleCardAction(`use:${session.sessionId}`, { chatId, key });
      return;
    }
    if (menu.kind === 'workspaces') {
      const workspace = menu.paths[number - 1];
      if (!workspace) {
        await this.#send(chatId, `只有 ${menu.paths.length} 个工作区，回复 /workspacelist 重新查看。`);
        return;
      }
      await this.#handleCardAction(`workspace:${workspace}`, { chatId, key });
      return;
    }
    if (menu.kind === 'watches') {
      const entry = menu.entries[number - 1];
      if (!entry?.sessionId) {
        await this.#send(chatId, `关注列表只有 ${menu.entries.length} 个会话。`);
        return;
      }
      await this.#handleCardAction(`unwatch:${entry.sessionId}`, { chatId, key });
    }
  }

  /** The sessions visible under the bot's archived policy. */
  #visibleSessions(sessions) {
    if (this.#state?.includesArchivedSessions?.() === false) {
      return sessions.filter((session) => session.archived !== true);
    }
    return sessions;
  }

  async #showSessions({ chatId, key }, selector, page = 0) {
    try {
      const resolved = await resolveSessionListWorkspace(selector ?? '', this.#harness);
      if (resolved.error) {
        await this.#send(chatId, resolved.error);
        return;
      }
      const listed = await this.#harness.listWorkspaceSessions(resolved.workspace);
      const sessions = this.#visibleSessions(Array.isArray(listed?.sessions) ? listed.sessions : []);
      const workspace = listed?.workspace ?? resolved.workspace;
      if (sessions.length === 0) {
        await this.#send(chatId, `工作区：${workspace}\n该工作区暂无会话。`);
        return;
      }
      const pageCount = Math.ceil(sessions.length / MENU_PAGE_SIZE);
      const safePage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, pageCount - 1) : 0;
      const watchedSet = new Set(
        (this.#state.watchEntries?.(key) ?? []).map((entry) => entry.sessionId),
      );
      const pageSlice = sessions.slice(safePage * MENU_PAGE_SIZE, (safePage + 1) * MENU_PAGE_SIZE);
      this.#rememberMenu(key, {
        kind: 'sessions',
        sessions: pageSlice.map((session) => ({ ...session, watched: watchedSet.has(session.sessionId) })),
      });
      await this.#sendCard(
        chatId,
        sessionListCard(workspace, sessions, safePage, sessions.length, watchedSet),
        {
          key,
          // Keep the canonical selector result for later page callbacks. The
          // list response's workspace is display data and is not authoritative.
          sessionWorkspace: resolved.workspace,
        },
      );
    } catch (error) {
      this.#logger.warn?.('[dsh-feishu] session list failed:', error.message);
      await this.#send(chatId, '暂时无法获取会话列表，请稍后重试。');
    }
  }

  async #showWorkspaces({ chatId, key }) {
    try {
      const { current, paths } = await workspacePathSnapshot(this.#harness);
      this.#rememberMenu(key, { kind: 'workspaces', paths });
      await this.#sendCard(chatId, workspaceListCard(paths, current), { key });
    } catch (error) {
      this.#logger.warn?.('[dsh-feishu] workspace list failed:', error.message);
      await this.#send(chatId, '暂时无法获取工作区列表，请稍后重试。');
    }
  }

  async #bindSession(key, chatId, sessionId) {
    try {
      const bound = await this.#harness.bindWorkspaceSession(key, sessionId);
      const title = String(bound?.title ?? '').replace(/\s+/gu, ' ').trim() || '暂无标题';
      await this.#send(chatId, `已绑定会话「${title}」\nID：${bound?.sessionId ?? sessionId}`);
    } catch (error) {
      await this.#send(chatId, `绑定失败：${safeErrorText(error)}`);
    }
  }

  async #switchWorkspace(key, chatId, workspace) {
    try {
      const current = await this.#harness.switchWorkspace(workspace);
      await this.#send(chatId, `工作区已切换为：${current}`);
    } catch (error) {
      await this.#send(chatId, `切换失败：${safeErrorText(error)}`);
    }
  }

  async #sendCard(chatId, cardJson, options = {}) {
    const response = await this.#client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: { receive_id: chatId, msg_type: 'interactive', content: cardJson },
    });
    if (response?.code && response.code !== 0) {
      throw new Error(`Feishu card send failed: ${response.msg || response.code}`);
    }
    const messageId = nonEmptyString(response?.data?.message_id);
    if (options.key && messageId) {
      this.#cardKeys.set(messageId, {
        key: options.key,
        chatId,
        sessionWorkspace: typeof options.sessionWorkspace === 'string' && options.sessionWorkspace
          ? options.sessionWorkspace
          : null,
      });
      if (this.#cardKeys.size > 200) {
        const oldest = this.#cardKeys.keys().next().value;
        if (oldest !== undefined) this.#cardKeys.delete(oldest);
      }
    }
    return messageId;
  }

  // ── Watches: read-only session tracking + completion pushes ─────────────

  #ensureEventWatcher() {
    if (this.#eventWatcher) return;
    if (typeof this.#harness?.watchHarnessEvents !== 'function') return;
    if (this.#signal?.aborted) return;
    const signal = this.#signal ?? new AbortController().signal;
    try {
      this.#eventWatcher = this.#harness.watchHarnessEvents({
        signal,
        onSessionEvent: (payload) => this.#onHarnessEvent(payload),
        onReconnect: () => {
          void this.#queueEventTask(() => this.#compensateMissedEvents());
        },
      });
      Promise.resolve(this.#eventWatcher).catch((error) => {
        if (!signal.aborted) {
          this.#logger.warn?.('[dsh-feishu] event watcher stopped:', error.message);
        }
      });
    } catch (error) {
      this.#eventWatcher = null;
      this.#logger.warn?.('[dsh-feishu] event watcher failed to start:', error.message);
    }
  }

  #queueEventTask(task) {
    const next = this.#eventTail.then(task, task).catch((error) => {
      if (!this.#signal?.aborted) {
        this.#logger.warn?.('[dsh-feishu] completion event failed:', error.message);
      }
    });
    this.#eventTail = next;
    return next;
  }

  /**
   * Resolve a /watch target READ-ONLY: a session id is validated against
   * the registered workspaces' listings, an index against the current
   * workspace. Nothing is bound and no workspace is switched.
   */
  async #resolveWatchTarget(target) {
    if (typeof target !== 'string' || target === '') {
      return { error: '用法：/watch <Session ID 或当前工作区序号>' };
    }
    const numeric = /^\d{1,4}$/.test(target) ? Number(target) : null;
    const currentPath = typeof this.#harness?.currentWorkspace === 'function'
      ? this.#harness.currentWorkspace()
      : null;
    const listSessions = async (workspace) => {
      const listed = await this.#harness.listWorkspaceSessions(workspace);
      return Array.isArray(listed?.sessions) ? listed.sessions : [];
    };
    if (numeric !== null) {
      if (!currentPath) return { error: '当前机器人没有可用的工作区，无法按序号解析会话。' };
      const sessions = this.#visibleSessions(await listSessions(currentPath));
      const session = sessions[numeric - 1];
      if (!session?.sessionId) {
        return { error: `当前工作区只有 ${sessions.length} 个会话。` };
      }
      return { sessionId: session.sessionId, title: session.title ?? '暂无标题' };
    }
    const extraPaths = typeof this.#harness?.listWorkspaces === 'function'
      ? (await this.#harness.listWorkspaces()).filter((path) => path !== currentPath)
      : [];
    const paths = [currentPath, ...extraPaths].filter(Boolean);
    for (const workspace of paths) {
      const sessions = await listSessions(workspace);
      const session = sessions.find((candidate) => candidate.sessionId === target);
      if (session) return { sessionId: target, title: session.title ?? '暂无标题' };
    }
    return { error: '没有找到这个会话，请用 /sessionlist 查看可用会话。' };
  }

  async #latestSessionSeq(sessionId) {
    if (typeof this.#harness?.rpc !== 'function') return null;
    const history = await this.#harness.rpc(
      'session.history',
      { sessionId, maxMessages: 20 },
      30_000,
      { signal: this.#signal },
    );
    return orderedHistoryEvents(history).at(-1)?.seq ?? -1;
  }

  async #runWatch(key, chatId, target) {
    this.#ensureEventWatcher();
    if (typeof this.#state?.setWatch !== 'function') {
      await this.#send(chatId, '当前状态存储不支持关注。');
      return;
    }
    let resolved;
    try {
      resolved = await this.#resolveWatchTarget(target);
    } catch (error) {
      await this.#send(chatId, `无法解析会话：${safeErrorText(error)}`);
      return;
    }
    if (resolved.error) {
      await this.#send(chatId, resolved.error);
      return;
    }
    const existing = this.#state.watchEntries?.(key) ?? [];
    const existingEntry = existing.find((entry) => entry.sessionId === resolved.sessionId);
    if (!existingEntry && existing.length >= MAX_WATCHES_PER_KEY) {
      await this.#send(chatId, `每个聊天最多关注 ${MAX_WATCHES_PER_KEY} 个会话。`);
      return;
    }
    try {
      const lastSeq = typeof existingEntry?.lastSeq === 'number'
        ? existingEntry.lastSeq
        : await this.#latestSessionSeq(resolved.sessionId);
      await this.#state.setWatch(key, {
        sessionId: resolved.sessionId,
        title: resolved.title,
        chatId,
        lastSeq,
      });
      await this.#send(chatId, `已关注会话「${String(resolved.title).replace(/\s+/gu, ' ')}」，任务完成会推送结果。`);
      await this.#queueEventTask(() => this.#compensateSession(resolved.sessionId));
    } catch (error) {
      await this.#send(chatId, `关注失败：${safeErrorText(error)}`);
    }
  }

  async #runUnwatch(key, chatId, target) {
    if (typeof this.#state?.removeWatch !== 'function') return;
    const entries = this.#state.watchEntries?.(key) ?? [];
    const entry = typeof target === 'string' && /^\d{1,4}$/.test(target)
      ? entries[Number(target) - 1]
      : entries.find((candidate) => candidate.sessionId === target);
    if (!entry) {
      await this.#send(chatId, '关注列表里没有这个会话，回复 /watchlist 查看。');
      return;
    }
    try {
      await this.#state.removeWatch(key, entry.sessionId);
      this.#failedWatchSeqs.delete(`${key}\0${entry.sessionId}`);
      await this.#send(chatId, `已取消关注「${String(entry.title ?? '').replace(/\s+/gu, ' ')}」。`);
    } catch (error) {
      await this.#send(chatId, `取消失败：${safeErrorText(error)}`);
    }
  }

  async #showWatchList(key, chatId) {
    const entries = this.#state.watchEntries?.(key) ?? [];
    this.#rememberMenu(key, { kind: 'watches', entries });
    await this.#sendCard(chatId, watchListCard(entries), { key });
  }

  /** Queue live turn completions behind any reconnect compensation. */
  #onHarnessEvent({ sessionId, event }) {
    if (this.#signal?.aborted
      || !sessionId
      || !event
      || typeof event !== 'object'
      || event.type !== 'turn/end'
      || !Number.isFinite(event.seq)) return;
    void this.#queueEventTask(async () => {
      const hasFailedDelivery = (this.#state.keysWatching?.(sessionId) ?? [])
        .some((key) => this.#failedWatchSeqs.has(`${key}\0${sessionId}`));
      if (hasFailedDelivery) await this.#compensateSession(sessionId);
      await this.#deliverCompletion(sessionId, event);
    });
  }

  async #deliverCompletion(sessionId, event) {
    if (this.#signal?.aborted || typeof this.#state?.keysWatching !== 'function') return;
    const reason = event?.data?.reason?.kind ?? event?.data?.reason ?? null;
    for (const key of this.#state.keysWatching(sessionId)) {
      if (this.#signal?.aborted) return;
      const entry = this.#state.watchEntry?.(key, sessionId);
      const deliveryKey = `${key}\0${sessionId}`;
      let failedSeq = this.#failedWatchSeqs.get(deliveryKey);
      if (typeof failedSeq === 'number'
        && typeof entry?.lastSeq === 'number'
        && entry.lastSeq >= failedSeq) {
        this.#failedWatchSeqs.delete(deliveryKey);
        failedSeq = undefined;
      }
      if (!entry?.chatId
        || (typeof entry.lastSeq === 'number' && entry.lastSeq >= event.seq)
        || (typeof failedSeq === 'number' && event.seq > failedSeq)) continue;
      try {
        await this.#sendCard(
          entry.chatId,
          completionCard(sessionId, entry.title, reason),
          { key },
        );
        const current = this.#state.watchEntry?.(key, sessionId);
        if (!current
          || current.chatId !== entry.chatId
          || (typeof current.lastSeq === 'number' && current.lastSeq >= event.seq)) continue;
        await this.#state.setWatch(key, { ...current, lastSeq: event.seq });
        if (failedSeq === event.seq) this.#failedWatchSeqs.delete(deliveryKey);
      } catch (error) {
        this.#failedWatchSeqs.set(
          deliveryKey,
          typeof failedSeq === 'number' ? Math.min(failedSeq, event.seq) : event.seq,
        );
        this.#logger.warn?.('[dsh-feishu] completion push failed:', error.message);
      }
    }
  }

  async #compensateSession(sessionId) {
    if (this.#signal?.aborted || typeof this.#harness?.rpc !== 'function') return;
    try {
      const history = await this.#harness.rpc(
        'session.history',
        { sessionId, maxMessages: 20 },
        30_000,
        { signal: this.#signal },
      );
      const events = orderedHistoryEvents(history);
      const latestSeq = events.at(-1)?.seq ?? -1;
      const keys = typeof this.#state?.keysWatching === 'function'
        ? this.#state.keysWatching(sessionId)
        : [];

      // Watches created by older versions have no baseline. Establish one
      // without replaying completions that predate the watch.
      for (const key of keys) {
        const entry = this.#state.watchEntry?.(key, sessionId);
        if (entry && typeof entry.lastSeq !== 'number') {
          await this.#state.setWatch(key, { ...entry, lastSeq: latestSeq });
        }
      }

      for (const event of events) {
        if (event.type === 'turn/end') await this.#deliverCompletion(sessionId, event);
      }
    } catch (error) {
      if (!this.#signal?.aborted) {
        this.#logger.warn?.(`[dsh-feishu] watch compensation failed for ${sessionId}:`, error.message);
      }
    }
  }

  /** Replay recent turn completions missed while the mux was disconnected. */
  async #compensateMissedEvents() {
    const sessionIds = typeof this.#state?.watchedSessionIds === 'function'
      ? this.#state.watchedSessionIds()
      : [];
    for (const sessionId of sessionIds) {
      if (this.#signal?.aborted) return;
      await this.#compensateSession(sessionId);
    }
  }

  #interactionAskOptions(event, key) {
    return {
      timeoutMs: this.#replyTimeoutMs,
      signal: this.#signal,
      control: { owner: this, key },
      onInteraction: (interaction) => this.#handleInteraction(interaction, {
        key,
        actor: senderOpenId(event),
        chatId: event.message.chat_id,
        requiresMention: event.message.chat_type !== 'p2p',
      }),
      onInteractionResolved: (resolution) => this.#handleInteractionResolved(resolution),
    };
  }

  async #answerWithStream(event, key, message) {
    const chatId = event.message.chat_id;
    const messageId = event.message.message_id;
    const text = message.content;
    const content = hasInboundImages(message)
      ? await promptContentForMessage(message, { signal: this.#signal })
      : undefined;
    if (!this.#channel?.stream) {
      const { answer } = await askInWorkspaceSession({
        harness: this.#harness,
        state: this.#state,
        key,
        text,
        content,
        createOptions: { signal: this.#signal },
        existsOptions: { signal: this.#signal },
        askOptions: this.#interactionAskOptions(event, key),
      });
      for (const chunk of splitText(answer)) await this.#send(chatId, chunk);
      this.#status.streamFallbacks = (this.#status.streamFallbacks ?? 0) + 1;
      return;
    }

    let promptStarted = false;
    let completedAnswer = '';
    try {
      await this.#channel.stream(chatId, {
        markdown: async (controller) => {
          promptStarted = true;
          const askOptions = {
            ...this.#interactionAskOptions(event, key),
            onUpdate: async (update) => {
              await controller.setContent(this.#progressText(update));
              this.#status.streamUpdates = (this.#status.streamUpdates ?? 0) + 1;
            },
          };
          ({ answer: completedAnswer } = await askInWorkspaceSession({
            harness: this.#harness,
            state: this.#state,
            key,
            text,
            content,
            createOptions: { signal: this.#signal },
            existsOptions: { signal: this.#signal },
            askOptions,
          }));
          await controller.setContent(completedAnswer);
        },
      }, { replyTo: messageId });
      this.#status.streamResponses = (this.#status.streamResponses ?? 0) + 1;
    } catch (error) {
      this.#status.streamErrors = (this.#status.streamErrors ?? 0) + 1;
      if (completedAnswer) {
        this.#logger.warn?.(
          '[dsh-feishu] native stream failed after generation; sending final text:',
          error.message,
        );
        for (const chunk of splitText(completedAnswer)) await this.#send(chatId, chunk);
        this.#status.streamFallbacks = (this.#status.streamFallbacks ?? 0) + 1;
        return;
      }
      if (promptStarted) throw error;

      this.#logger.warn?.('[dsh-feishu] native stream unavailable; using text fallback:', error.message);
      const { answer } = await askInWorkspaceSession({
        harness: this.#harness,
        state: this.#state,
        key,
        text,
        content,
        createOptions: { signal: this.#signal },
        existsOptions: { signal: this.#signal },
        askOptions: this.#interactionAskOptions(event, key),
      });
      for (const chunk of splitText(answer)) await this.#send(chatId, chunk);
      this.#status.streamFallbacks = (this.#status.streamFallbacks ?? 0) + 1;
    }
  }

  async #processInteractionReply(event, messageId, key, expected, processingReaction) {
    this.#signal?.throwIfAborted();
    const current = this.#pendingInteractions.get(key);
    const claimed = expected.claimedReplyMessageId === messageId;
    if (!current || current !== expected || current.submitting) {
      if (this.#isResolvedQuestionReply(event, key)) {
        return this.#discardResolvedInteractionReply(event, messageId);
      }
      if (claimed && (!current || current !== expected)) {
        return this.#discardResolvedInteractionReply(event, messageId);
      }
      return this.#enqueueMessage(event, messageId, key, processingReaction, {
        releaseMessageId: false,
        finalize: false,
      });
    }
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.lastMessageAt = new Date().toISOString();
    this.#status.messagesReceived += 1;

    const text = extractText(event);
    if (!text) {
      await this.#send(event.message.chat_id, '请用文字回答当前问题。');
      return;
    }

    const pending = this.#pendingInteractions.get(key);
    if (!pending || pending !== expected || pending.submitting) {
      if (this.#isResolvedQuestionReply(event, key)) {
        await this.#send(event.message.chat_id, INTERACTION_RESOLVED_TEXT).catch(() => undefined);
        return;
      }
      if (claimed && (!pending || pending !== expected)) {
        await this.#send(event.message.chat_id, INTERACTION_RESOLVED_TEXT);
        return;
      }
      return this.#enqueueMessage(event, messageId, key, processingReaction, {
        releaseMessageId: false,
        alreadyRecorded: true,
        finalize: false,
      });
    }
    pending.chatId = event.message.chat_id;
    if (pending.needsPresentation) {
      try {
        await this.#presentInteraction(pending);
      } catch {
        this.#status.lastError = '飞书交互问题发送失败。';
        this.#logger.error?.('[dsh-feishu] failed to retry an interaction question');
        pending.interaction.reconnect?.();
      }
      return;
    }
    const question = pending.questions[pending.index];
    if (!question) return;

    pending.answers.push(harnessAnswerForQuestion(question, text));
    pending.index += 1;
    if (pending.index < pending.questions.length) {
      if (pending.claimedReplyMessageId === messageId) {
        pending.claimedReplyMessageId = null;
      }
      pending.needsPresentation = true;
      try {
        await this.#presentInteraction(pending);
      } catch {
        this.#status.lastError = '飞书交互问题发送失败。';
        this.#logger.error?.('[dsh-feishu] failed to send the next interaction question');
        pending.interaction.reconnect?.();
      }
      return;
    }

    pending.submitting = true;
    try {
      await pending.interaction.respond({
        ok: true,
        value: {
          sessionId: pending.sessionId,
          answer: { answers: pending.answers },
        },
      });
      this.#rememberResolvedInteraction(key, pending);
      this.#clearPendingInteraction(key, pending.interactionId);
      this.#status.lastError = null;
    } catch (error) {
      if (this.#signal?.aborted) return;
      if (this.#pendingInteractions.get(key) !== pending) return;
      if (error?.code === 'interaction-not-pending') {
        this.#rememberResolvedInteraction(key, pending);
        this.#clearPendingInteraction(key, pending.interactionId);
        await this.#send(event.message.chat_id, INTERACTION_RESOLVED_TEXT).catch(() => undefined);
        return;
      }
      pending.submitting = false;
      pending.answers.pop();
      pending.index -= 1;
      this.#status.lastError = '回答提交失败。';
      this.#logger.error?.('[dsh-feishu] failed to answer a Harness interaction');
      await this.#send(event.message.chat_id, '回答提交失败，请重新发送当前问题的答案。')
        .catch(() => undefined);
    }
  }

  async #handleInteraction(interaction, {
    key,
    actor,
    chatId,
    requiresMention,
  }) {
    if (await this.#approvals.handleRequested(interaction, {
      key,
      actor,
      requiresMention,
      send: (text) => this.#send(chatId, text),
    })) return;

    // Approval requests return above; the existing question state machine stays unchanged.
    if (interaction?.kind !== 'question') return;
    const questions = interaction?.payload?.questions;
    const interactionId = typeof interaction?.interactionId === 'string'
      ? interaction.interactionId
      : interaction?.rpcId;
    if (typeof interaction.rpcId !== 'string'
      || typeof interactionId !== 'string'
      || typeof interaction.sessionId !== 'string'
      || !Array.isArray(questions)
      || questions.length === 0
      || questions.some((question) => !validHarnessQuestion(question))) {
      this.#logger.warn?.('[dsh-feishu] ignored an invalid Harness question interaction');
      return;
    }

    if (interaction.recovered === true) {
      await interaction.respond({
        ok: false,
        error: {
          code: 'cancelled',
          message: 'Feishu safely cancelled an interaction left by an earlier client.',
          details: {},
        },
      });
      await this.#send(
        chatId,
        '检测到这个 Session 中遗留的待回答问题，已安全取消并继续处理你刚才的消息。',
      ).catch(() => undefined);
      return;
    }

    const existing = this.#pendingInteractions.get(key);
    if (existing?.interactionId === interactionId) {
      existing.interaction = interaction;
      if (existing.needsPresentation) await this.#presentInteraction(existing);
      return;
    }
    if (this.#interactionKeys.has(interactionId)) return;
    if (existing) {
      await interaction.respond({
        ok: false,
        error: {
          code: 'cancelled',
          message: 'Feishu is already handling another user interaction.',
          details: {},
        },
      });
      return;
    }

    const pending = {
      kind: 'question',
      interactionId,
      sessionId: interaction.sessionId,
      interaction,
      key,
      actor,
      requiresMention,
      questions,
      answers: [],
      index: 0,
      chatId,
      queue: null,
      claimedReplyMessageId: null,
      submitting: false,
      needsPresentation: true,
      questionMessageIds: new Set(),
      inactive: false,
    };
    this.#pendingInteractions.set(key, pending);
    this.#interactionKeys.set(pending.interactionId, key);
    await this.#presentInteraction(pending);
  }

  async #handleInteractionResolved(resolution) {
    if (await this.#approvals.handleResolved(resolution)) return;
    const interactionId = resolution?.interactionId;
    if (resolution?.kind !== 'question' || typeof interactionId !== 'string') return;
    const key = this.#interactionKeys.get(interactionId);
    if (!key) return;
    const pending = this.#pendingInteractions.get(key);
    if (pending) this.#rememberResolvedInteraction(key, pending);
    this.#clearPendingInteraction(key, interactionId);
  }

  async #presentInteraction(pending) {
    const question = pending.questions[pending.index];
    if (!question) return;
    const messageId = await this.#send(
      pending.chatId,
      harnessQuestionText(
        question,
        pending.index,
        pending.questions.length,
        { requiresMention: pending.requiresMention },
      ),
    );
    if (messageId) {
      pending.questionMessageIds.add(messageId);
      if (pending.inactive) this.#rememberResolvedInteraction(pending.key, pending);
    }
    pending.needsPresentation = false;
  }

  #rememberResolvedInteraction(key, pending) {
    const expiresAt = Date.now() + RESOLVED_REPLY_TTL_MS;
    for (const messageId of pending.questionMessageIds ?? []) {
      this.#resolvedQuestionReplies.set(messageId, { key, expiresAt });
    }
  }

  #isResolvedQuestionReply(event, key) {
    const now = Date.now();
    for (const [messageId, resolution] of this.#resolvedQuestionReplies) {
      if (resolution.expiresAt <= now) this.#resolvedQuestionReplies.delete(messageId);
    }
    for (const reference of [event?.message?.parent_id, event?.message?.root_id]) {
      const resolution = this.#resolvedQuestionReplies.get(reference);
      if (resolution?.key === key && resolution.expiresAt > now) return true;
    }
    return false;
  }

  async #discardResolvedInteractionReply(event, messageId) {
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.lastMessageAt = new Date().toISOString();
    this.#status.messagesReceived += 1;
    await this.#send(event.message.chat_id, INTERACTION_RESOLVED_TEXT).catch(() => undefined);
  }

  #takePendingInteraction(key, interactionId) {
    const pending = this.#pendingInteractions.get(key);
    if (!pending
      || (interactionId !== undefined && pending.interactionId !== interactionId)) return null;
    this.#pendingInteractions.delete(key);
    this.#interactionKeys.delete(pending.interactionId);
    pending.inactive = true;
    return pending;
  }

  #clearPendingInteraction(key, interactionId) {
    return this.#takePendingInteraction(key, interactionId) !== null;
  }

  async #cancelPendingInteraction(key) {
    const pending = this.#takePendingInteraction(key);
    if (!pending || pending.kind !== 'question') return;
    this.#rememberResolvedInteraction(key, pending);
    try {
      await pending.interaction.respond({
        ok: false,
        error: {
          code: 'cancelled',
          message: 'The Feishu interaction ended before the user answered.',
          details: {},
        },
      }, { signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      if (error?.code !== 'interaction-not-pending') {
        this.#logger.warn?.('[dsh-feishu] failed to cancel a pending Harness interaction');
      }
    }
  }

  #progressText(update) {
    if (update.type === 'text' && update.text) return update.text;
    if (update.type === 'tool') {
      if (update.name === 'web_search') return '_正在搜索网络并整理信息…_';
      return `_正在使用 ${update.name || '工具'}…_`;
    }
    return `_${update.text || '正在处理…'}_`;
  }

  async #addReaction(messageId, emojiType) {
    if (!this.#channel?.addReaction) return null;
    try {
      const reactionId = await this.#channel.addReaction(messageId, emojiType);
      this.#status.reactionsAdded = (this.#status.reactionsAdded ?? 0) + 1;
      return reactionId;
    } catch (error) {
      this.#status.reactionErrors = (this.#status.reactionErrors ?? 0) + 1;
      this.#logger.warn?.(`[dsh-feishu] unable to add ${emojiType} reaction:`, error.message);
      return null;
    }
  }

  async #removeProcessingReaction(messageId, processingReaction) {
    const reactionId = await processingReaction;
    if (reactionId && this.#channel?.removeReaction) {
      try {
        await this.#channel.removeReaction(messageId, reactionId);
        this.#status.reactionsRemoved = (this.#status.reactionsRemoved ?? 0) + 1;
      } catch (error) {
        this.#status.reactionErrors = (this.#status.reactionErrors ?? 0) + 1;
        this.#logger.warn?.('[dsh-feishu] unable to remove processing reaction:', error.message);
      }
    }
  }

  async #finishReaction(messageId, processingReaction, finalEmojiType) {
    await this.#removeProcessingReaction(messageId, processingReaction);
    await this.#addReaction(messageId, finalEmojiType);
  }

  async #send(chatId, text) {
    const response = await this.#client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
    });
    if (response?.code && response.code !== 0) {
      throw new Error(`Feishu send failed: ${response.msg || response.code}`);
    }
    return nonEmptyString(response?.data?.message_id);
  }
}
