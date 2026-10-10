import { BusyMessageDispatcher, canAutomaticallySteer } from './busy-message-dispatcher.mjs';
import { randomUUID } from 'node:crypto';

import { createDeferredDeliveryCoordinator, deferredOutcomeText } from './deferred-delivery-coordinator.mjs';
import { t } from './i18n.mjs';
import { commandHelpLines } from './command-catalog.mjs';
import {
  COMMAND_PERMISSION_DENIED_MESSAGE,
  evaluateInboundAccess,
} from './inbound-access.mjs';
import {
  captureContextEnhancement,
  captureContextEnhancementSource,
  enhanceContextContent,
} from './context-enhancement.mjs';
import { runWorkspaceCommand } from './workspace-command.mjs';
import { runCompactCommand } from './compact-command.mjs';
import { isClearCommand, runClearCommand } from './clear-command.mjs';
import { isHistoryCommand, runHistoryCommand } from './history-command.mjs';
import {
  isControlCommand,
  runControlCommand,
} from './control-command.mjs';
import {
  rememberConnectionTestTarget,
  sendRememberedConnectionTest,
} from './connection-test.mjs';
import {
  isModelCommand,
  runModelCommand,
} from './model-command.mjs';
import {
  isPresetCommand,
  runPresetCommand,
} from './preset-command.mjs';
import { askInWorkspaceSession } from './workspace-session.mjs';
import { HarnessApprovalQueue } from './harness-approval.mjs';
import {
  BatchInputManager,
  batchInputBusyMessage,
  batchInputGroupUnsupportedMessage,
  isBatchInputCommand,
} from './batch-input.mjs';
import {
  hasInboundImages,
  imagePromptDiagnostic,
  imagePromptUserMessage,
} from './image-prompt.mjs';
import {
  hasInboundFiles,
  inboundFileUserMessage,
} from './inbound-file.mjs';
import {
  harnessAnswerForQuestion,
  harnessQuestionText,
  validHarnessQuestion,
} from './harness-question.mjs';
import { deliverOutboundArtifacts, isVoicePresentation } from './semantic/artifact-delivery.mjs';
import {
  hasReplyReference,
  promptContentForInboundMessage,
} from './semantic/reply-reference.mjs';
import {
  createDeliveryReceipt,
  createTextDeliveryBlock,
  providerMessageIdsFor,
} from './semantic/delivery.mjs';
import {
  messageFailureDiagnostic,
  channelDeliveryFailure,
  clearLastMessageFailure,
  messageFailureText,
  setLastMessageFailure,
} from './message-failure.mjs';
import { beginStatusReaction } from './status-reaction.mjs';
import { createMessageBreakHandler } from './message-break.mjs';
import {
  fireAndForgetStop,
  isSupersededStop,
  normalizeOnNewMessage,
  resolveNewMessagePolicy,
  SUPERSEDED_STOP_REASON,
} from './new-message-policy.mjs';
import { resolveHumanizeSettings } from './humanize-resolver.mjs';
import {
  applyReadDelay,
  applySegmentGap,
  SHORT_DELAY_CAP_MS,
} from './send-delay.mjs';
import { createTypingSession } from './typing-session.mjs';

const INTERACTION_RESOLVED_TEXT = '这个问题已在其他客户端处理，无需再次回答。';
const FILE_ONLY_COMPLETION_TEXT = '任务已完成。';

/**
 * How many times one inbound message may be re-delivered after a failed turn.
 *
 * A failure releases the message's `markSeen` so the next poll retries it, which
 * would otherwise loop forever on a mail that always fails. After this many
 * attempts the mark stays and the message is treated as handled.
 */
const MAX_DELIVERY_ATTEMPTS = 3;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function canClaimInteractionReply(message, pending, senderId) {
  return pending.actor === senderId
    && (message.kind !== 'group' || message.addressed === true)
    && !hasInboundImages(message)
    && !hasInboundFiles(message)
    && Boolean(controlTextOf(message));
}

function artifactFailureText(fileName, error, descriptor) {
  const name = String(fileName ?? t('结果文件'))
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 255) || t('结果文件');
  switch (error?.code) {
    case 'artifact-delivery-uncertain':
      return t('结果文件「{name}」的发送结果未能确认，请先检查聊天内是否已收到，不要立即重试。', { name });
    case 'artifact-permission-required':
      if (descriptor?.key === 'slack') {
        return t('结果文件「{name}」已生成，但 Slack 应用缺少 files:write 权限。请更新 Manifest、重新安装应用并重新连接机器人后重试。', { name });
      }
      if (descriptor?.key === 'discord') {
        return t('结果文件「{name}」已生成，但机器人缺少 Discord 的 Send Messages、Attach Files 或 Read Message History 权限。', { name });
      }
      if (descriptor?.key === 'telegram') {
        return t('结果文件「{name}」已生成，但 Telegram 不允许机器人在当前聊天发送文档，请检查聊天权限。', { name });
      }
      if (descriptor?.key === 'matrix') {
        return t('结果文件「{name}」已生成，但 Matrix homeserver 拒绝了媒体上传，请检查其媒体大小限制与上传权限。', { name });
      }
      return t('结果文件「{name}」已生成，但当前机器人没有文件发送权限，请检查渠道权限。', { name });
    case 'artifact-too-large':
      return t('结果文件「{name}」超过当前渠道大小上限，未发送。', { name });
    case 'artifact-empty':
      return t('结果文件「{name}」为空，未发送。', { name });
    case 'artifact-invalid':
    case 'artifact-changed':
    case 'artifact-unavailable':
      return t('结果文件「{name}」暂时无法读取或准备发送，请确认文件仍可访问后重试。', { name });
    case 'artifact-rate-limited':
      return t('结果文件「{name}」暂时被当前渠道限流，未能发送，请稍后重试。', { name });
    case 'artifact-provider-rejected':
      return t('结果文件「{name}」已生成，但当前渠道拒绝了该文件或文件消息。', { name });
    default:
      return t('结果文件「{name}」已生成，但当前渠道暂时未能发送，请稍后重试。', { name });
  }
}

export function createTextBridgeStatus() {
  return {
    messagesReceived: 0,
    messagesReplied: 0,
    messagesRejected: 0,
    lastMessageAt: null,
    lastReplyAt: null,
    lastRejectedAt: null,
    lastError: null,
    lastMessageError: null,
    reactionsAdded: 0,
    reactionsRemoved: 0,
    reactionErrors: 0,
  };
}

/**
 * The text a channel's control commands and approval decisions are parsed from.
 *
 * A channel may decorate `content` for the model — the email channel prepends
 * the mail headers so a subject line reaches the model — while `controlText`
 * keeps the undecorated body. Without this a decorated message made `/help`
 * and "批准" unrecognisable.
 */
function controlTextOf(message) {
  return cleanText(message?.controlText ?? message?.content);
}

export class TextHarnessBridge {
  #descriptor;
  #bot;
  #harness;
  #state;
  #deferred;
  #contextEnhancement;
  #accessPolicy;
  #thinkingTraces;
  #status;
  #logger;
  #replyTimeoutMs;
  #signal;
  #keepaliveIntervalMs;
  #queues = new Map();
  #busyMessages = new BusyMessageDispatcher();
  #pendingInteractions = new Map();
  #interactionKeys = new Map();
  // Keep the accepted configuration through the existing queue/reply lifecycle.
  #acceptedMessageIds = new Map();
  #approvalTasks = new Set();
  #commandTasks = new Set();
  #approvals;
  #batches = new BatchInputManager();
  #interactionCard;
  // Delivery attempts per message id. A failed turn releases its `markSeen` so
  // the next poll can retry, and this counter is what keeps that from becoming
  // an infinite loop on a mail that always fails.
  #deliveryAttempts = new Map();
  #streaming = true;
  #messageBreak = false;
  #onNewMessage = 'interrupt';
  // Live per-turn settings provider ({ getSettings() }); falls back to the
  // constructor snapshot above when absent.
  #humanize = null;
  // Pre-ask controllers: one per conversation key, alive only while a turn
  // is in its pre-ask phase (read delay + image staging + stream opening),
  // i.e. before it reaches the harness. Aborting supersedes that turn.
  #preAskControllers = new Map();
  // Wall-clock end of the last completed turn per conversation, for the
  // sendDelay activity boost ("still at the keyboard, replies fast").
  #turnEnds = new Map();

  constructor({
    descriptor,
    bot,
    harness,
    state,
    contextEnhancement,
    accessPolicy,
    thinkingTraces = false,
    status = createTextBridgeStatus(),
    logger = console,
    replyTimeoutMs = 600_000,
    signal,
    streaming = true,
    messageBreak = false,
    onNewMessage = 'interrupt',
    humanize = null,
    keepaliveIntervalMs = 4_000,
    interactionCard = null,
  }) {
    if (!descriptor?.key || !descriptor?.label) throw new TypeError('A channel descriptor is required');
    if (!bot || typeof bot.sendText !== 'function') throw new TypeError('A bot client is required');
    if (!harness || !state) throw new TypeError('Harness client and state store are required');
    this.#descriptor = descriptor;
    this.#bot = bot;
    this.#harness = harness;
    this.#state = state;
    this.#contextEnhancement = contextEnhancement;
    this.#accessPolicy = accessPolicy;
    this.#thinkingTraces = thinkingTraces;
    this.#status = status;
    this.#logger = logger;
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#signal = signal;
    this.#keepaliveIntervalMs = keepaliveIntervalMs;
    this.#interactionCard = interactionCard ?? null;
    this.#messageBreak = messageBreak === true;
    this.#streaming = streaming !== false;
    this.#onNewMessage = normalizeOnNewMessage(onNewMessage);
    this.#humanize = humanize ?? null;
    this.#deferred = createDeferredDeliveryCoordinator({ harness, state, signal, logger,
      deliver: (entry, outcome) => this.#deliverDeferredOutcome(entry, outcome),
    });
    this.#approvals = new HarnessApprovalQueue({
      label: descriptor.key,
      logger,
    });
  }

  get status() {
    return structuredClone(this.#status);
  }

  accept(message, { contextSnapshot, accessDecision, busyMessageMode } = {}) {
    if (this.#signal?.aborted) return Promise.resolve();
    const conversationId = cleanText(message?.conversationId);
    const kind = message?.kind === 'group' ? 'group' : 'direct';
    const normalized = { ...message, kind, conversationId };
    const messageId = cleanText(normalized.messageId);
    const senderId = cleanText(normalized.senderId);
    if (!messageId || !senderId || !conversationId || normalized.senderIsBot === true
      || this.#state.hasSeen(messageId) || this.#acceptedMessageIds.has(messageId)) {
      return Promise.resolve();
    }
    // Preserve the channel trigger boundary. Access policy never turns an
    // unaddressed group message into a denial reply.
    if (kind === 'group' && normalized.addressed !== true) {
      this.#status.messagesRejected += 1;
      this.#status.lastRejectedAt = new Date().toISOString();
      this.#acceptedMessageIds.set(messageId, null);
      return this.#finishLocalMessage(normalized, messageId, null);
    }
    if (this.#accessPolicy || accessDecision) {
      const hasImages = hasInboundImages(normalized);
      const hasFiles = hasInboundFiles(normalized);
      const decision = accessDecision ?? evaluateInboundAccess(this.#accessPolicy, {
        conversationType: kind,
        senderIds: [senderId, cleanText(normalized.senderAlternateId)].filter(Boolean),
        // The same control text the command runner below parses. A channel may
        // decorate `content` for the model (email prepends the mail headers), and
        // a decorated body never looks like a command — so reading `content` here
        // recognized no command at all and skipped the command-permission gate.
        text: controlTextOf(normalized),
        hasImages,
        hasFiles,
      });
      if (!decision.allowed) {
        this.#status.messagesRejected += 1;
        this.#status.lastRejectedAt = new Date().toISOString();
        // Mark policy denials so a webhook replay cannot repeat local work or
        // a command-permission notice.
        this.#acceptedMessageIds.set(messageId, null);
        return this.#finishLocalMessage(
          normalized,
          messageId,
          decision.reason === 'command-not-allowed'
            ? t(COMMAND_PERMISSION_DENIED_MESSAGE)
            : null,
          { recordReceived: decision.reason === 'command-not-allowed' },
        );
      }
    }
    this.#acceptedMessageIds.set(messageId, contextSnapshot === undefined
      ? captureContextEnhancement(this.#contextEnhancement, message?.kind)
      : contextSnapshot);
    const statusReaction = beginStatusReaction({
      adapter: this.#bot,
      target: normalized.kind === 'direct' || normalized.addressed === true
        ? normalized.reactionTarget
        : null,
      reactions: this.#humanizeSettings().statusReaction === false
        ? undefined
        : this.#descriptor.reactions,
      status: this.#status,
      logger: this.#logger,
      label: this.#descriptor.key,
    });
    normalized.statusReaction = statusReaction;

    const processing = this.#acceptAcceptedMessage(normalized, messageId, senderId, busyMessageMode);
    void processing.then(
      () => statusReaction.success(),
      () => statusReaction.error(),
    );
    return processing;
  }

  #acceptAcceptedMessage(normalized, messageId, senderId, busyMessageMode) {
    if (normalized.kind === 'direct') {
      rememberConnectionTestTarget(
        this.#state,
        normalized.connectionTestTarget ?? normalized.replyTarget,
      );
    }

    const key = `${normalized.kind}:${normalized.conversationId}`;
    const pending = this.#pendingInteractions.get(key);
    const text = controlTextOf(normalized);
    if (isClearCommand(text) && (
      this.#queues.has(key)
      || pending
      || this.#approvals.hasPending(key)
      || this.#batches.status(key).phase !== 'idle'
    )) {
      return this.#finishLocalMessage(
        normalized,
        messageId,
        t('当前会话正在生成回复或等待交互，请先完成交互或发送 /stop，再执行 /clear。'),
      );
    }
    const batchCommand = isBatchInputCommand(text);
    if (batchCommand && normalized.kind === 'group' && normalized.addressed === true) {
      return this.#finishLocalMessage(
        normalized,
        messageId,
        batchInputGroupUnsupportedMessage(),
      );
    }
    if (batchCommand && normalized.kind === 'direct') {
      const exactBatch = /^\/batch$/iu.test(text);
      if (exactBatch && (
        this.#queues.has(key)
        || Boolean(pending)
        || this.#approvals.hasPending(key)
      )) {
        return this.#finishLocalMessage(normalized, messageId, batchInputBusyMessage());
      }
      const batch = this.#batches.handle(key, text, {
        plainText: Boolean(text)
          && normalized.plainText !== false
          && !hasInboundImages(normalized)
          && !hasInboundFiles(normalized)
          && !hasReplyReference(normalized),
      });
      if (batch.handled) {
        if (batch.kind === 'submit') {
          return this.#enqueueMessage({
            ...normalized,
            content: batch.prompt,
            // The submission is exactly the collected text; a quote or an
            // attachment on the command itself is not part of it.
            replyTo: null,
            images: [],
            files: [],
            batchSubmission: { token: batch.token, title: batch.title },
          }, messageId, senderId, key);
        }
        return this.#finishLocalMessage(normalized, messageId, batch.message);
      }
    } else if (normalized.kind === 'direct'
      && this.#batches.status(key).phase === 'collecting') {
      const batch = this.#batches.handle(key, text, {
        plainText: Boolean(text)
          && normalized.plainText !== false
          && !hasInboundImages(normalized)
          && !hasInboundFiles(normalized)
          && !hasReplyReference(normalized),
      });
      if (batch.handled) {
        return this.#finishLocalMessage(normalized, messageId, batch.message);
      }
    }
    const collectingBatch = normalized.kind === 'direct'
      && this.#batches.status(key).phase === 'collecting';
    const commandRunner = collectingBatch ? null : isClearCommand(text) ? runClearCommand
      : isHistoryCommand(text) ? runHistoryCommand
      : hasInboundFiles(normalized) ? null : isControlCommand(text)
      ? runControlCommand
      : (isModelCommand(text)
          ? runModelCommand
          : (isPresetCommand(text) ? runPresetCommand : null));
    if (commandRunner && (normalized.kind !== 'group' || normalized.addressed === true)) {
      let task;
      task = this.#processFastCommand(
        normalized,
        messageId,
        key,
        commandRunner,
        senderId,
      ).finally(() => {
        this.#acceptedMessageIds.delete(messageId);
        this.#commandTasks.delete(task);
      });
      this.#commandTasks.add(task);
      return task;
    }
    const approval = this.#approvals.claimReply({
      key,
      actor: senderId,
      messageId,
      // Approval decisions are parsed from the control text, exactly like the
      // commands above: a decorated `content` hid "批准" behind the mail headers,
      // so a plain-body approval never claimed its pending request.
      text: hasInboundImages(normalized) || hasInboundFiles(normalized)
        ? ''
        : controlTextOf(normalized),
      addressed: normalized.kind !== 'group' || normalized.addressed === true,
      hasPendingQuestion: Boolean(pending),
      questionCompletion: pending?.submitting || pending?.claimedReplyMessageId
        ? pending.queue
        : null,
      isQuestionPending: () => this.#pendingInteractions.has(key),
      send: (text) => this.#bot.sendText(normalized.replyTarget, text),
    });
    if (approval) {
      let task;
      task = approval.process(async () => {
          if (this.#state.hasSeen(messageId)) return false;
          await this.#state.markSeen(messageId);
          this.#status.messagesReceived += 1;
          this.#status.lastMessageAt = new Date().toISOString();
          return true;
        })
        .finally(() => {
          this.#acceptedMessageIds.delete(messageId);
          this.#approvalTasks.delete(task);
        });
      this.#approvalTasks.add(task);
      return task;
    }
    if (pending && pending.actor !== senderId) {
      return this.#enqueueMessage(normalized, messageId, senderId, key);
    }
    if (pending?.submitting || pending?.claimedReplyMessageId) {
      return this.#enqueueMessage(normalized, messageId, senderId, key);
    }
    if (pending) {
      if (canClaimInteractionReply(normalized, pending, senderId)) {
        pending.claimedReplyMessageId = messageId;
      }
      const previous = pending.queue ?? Promise.resolve();
      const current = previous
        .catch(() => undefined)
        .then(() => this.#processInteractionReply(
          normalized,
          messageId,
          senderId,
          key,
          pending,
        ))
        .finally(() => {
          this.#acceptedMessageIds.delete(messageId);
          if (pending.claimedReplyMessageId === messageId) {
            pending.claimedReplyMessageId = null;
          }
          if (pending.queue === current) pending.queue = null;
        });
      pending.queue = current;
      return current;
    }
    // Busy-message routing. A pending interaction or approval always queues --
    // interrupting would lose the question and steering has nothing to inject
    // into -- so the configured policy only decides the ordinary case. The
    // fork's `interrupt` supersedes the in-flight turn here; `queue` and
    // `steer` run through the shared dispatcher, which owns the queue receipt,
    // the automatic-steer eligibility gate and the waitForIdle accounting.
    const policy = resolveNewMessagePolicy({
      hasQueue: this.#queues.has(key),
      hasPendingInteraction: this.#pendingInteractions.has(key),
      hasPendingApproval: this.#approvals.hasPending(key),
      onNewMessage: this.#humanizeSettings().onNewMessage,
    });
    if (policy === 'interrupt') {
      return this.#interruptAndResend(normalized, messageId, senderId, key);
    }
    return this.#busyMessages.dispatch({
      key, messageId, text: normalized.content,
      commandText: text, mode: policy ?? busyMessageMode,
      onFailure: (error) => this.#signal?.aborted || error?.code === 'turn-stopped'
        ? normalized.statusReaction?.clear() : normalized.statusReaction?.error(),
      eligible: () => normalized.plainText !== false
        && !hasInboundImages(normalized) && !hasInboundFiles(normalized)
        && !hasReplyReference(normalized)
        && canAutomaticallySteer(this.#accessPolicy, normalized.kind,
          [senderId, normalized.senderAlternateId].filter(Boolean)),
      harness: this.#harness, state: this.#state, status: this.#status,
      signal: this.#signal, control: { owner: this, key }, logger: this.#logger,
      acceptedMessageIds: this.#acceptedMessageIds,
      pendingInteraction: () => this.#pendingInteractions.has(key) || this.#approvals.hasPending(key),
      enhancement: {
        snapshot: this.#acceptedMessageIds.get(messageId),
        source: () => {
          const source = normalized.contextSource?.();
          return { channel: this.#descriptor.key, senderId, senderName: source?.senderName,
            conversationTitle: source?.conversationTitle,
            chatId: source?.chatId ?? normalized.conversationId, threadId: source?.threadId };
        },
      },
      isQueued: () => this.#queues.has(key),
      enqueue: (options) => this.#enqueueMessage(normalized, messageId, senderId, key, options),
      send: (reply) => this.#bot.sendText(normalized.replyTarget, reply),
    });
  }

  /**
   * Per-turn humanization settings: live provider read with
   * constructor-snapshot fallback. Called once per inbound message and
   * once per processed turn; never cached across turns.
   */
  #humanizeSettings() {
    return resolveHumanizeSettings({
      humanize: this.#humanize,
      streaming: this.#streaming,
      messageBreak: this.#messageBreak,
      onNewMessage: this.#onNewMessage,
    });
  }

  #finishLocalMessage(message, messageId, reply, { recordReceived = true } = {}) {
    let task;
    task = (async () => {
      if (this.#state.hasSeen(messageId)) return;
      await this.#state.markSeen(messageId);
      if (recordReceived) {
        this.#status.messagesReceived += 1;
        this.#status.lastMessageAt = new Date().toISOString();
      }
      if (reply) await this.#bot.sendText(message.replyTarget, reply);
      this.#status.lastError = null;
    })().catch(async (error) => {
      if (this.#signal?.aborted) {
        message.statusReaction?.clear();
        return;
      }
      message.statusReaction?.error();
      this.#status.lastError = error?.message ?? String(error);
      const failure = setLastMessageFailure(this.#status, error);
      this.#logger.error?.(
        `[dsh-im:${this.#descriptor.key}] failed to process a batch input message [${failure.referenceId}]:`,
        messageFailureDiagnostic(error, failure),
      );
    }).finally(() => {
      this.#acceptedMessageIds.delete(messageId);
      this.#commandTasks.delete(task);
    });
    this.#commandTasks.add(task);
    return task;
  }

  /** Get a workspace session bound to the conversation's current session ID. */
  #boundSession(key) {
    if (typeof this.#state?.sessionFor !== 'function') return null;
    const sessionId = this.#state.sessionFor(key);
    if (typeof sessionId !== 'string' || !sessionId) return null;
    if (typeof this.#harness?.workspaceSession !== 'function') return null;
    return this.#harness.workspaceSession(sessionId);
  }

  /**
   * interrupt: cancel the current turn immediately (fire-and-forget
   * stopActiveTurn), then process the new message as a fresh turn once the
   * old #process() settles.
   */
  #interruptAndResend(message, messageId, senderId, key) {
    // Supersede any pre-ask phase (read delay, image staging, stream
    // opening) of the current turn FIRST: stopActiveTurn cannot cancel a
    // turn that has not reached the harness yet, so without this the new
    // message would wait out the whole delayed turn and both replies
    // would race. Unconditional — deliberately not gated by
    // sendDelay.enabled (it also fixes a pre-existing double-reply race).
    this.#abortPreAskPhase(key);
    // Chain the new process after the current queue settles. The old
    // #process() will detect turn/end (within ~300 ms) and return silently.
    const previous = this.#queues.get(key) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() => this.#process(message, messageId, senderId, key))
      .finally(() => {
        this.#acceptedMessageIds.delete(messageId);
        if (this.#queues.get(key) === current) this.#queues.delete(key);
      });
    this.#queues.set(key, current);
    // Fire-and-forget: stopActiveTurn is async (refresh ownership via RPC),
    // but controlExecutor is synchronous. The old ask() polling loop will
    // see turn/end on its next poll.
    fireAndForgetStop({
      session: this.#boundSession(key),
      control: { owner: this, key },
      signal: this.#signal,
      reason: SUPERSEDED_STOP_REASON,
      logger: this.#logger,
    });
    return current;
  }

  #enqueueMessage(message, messageId, senderId, key, {
    releaseMessageId = true,
    alreadyRecorded = false,
  } = {}) {
    const previous = this.#queues.get(key) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() => this.#process(
        message,
        messageId,
        senderId,
        key,
        { alreadyRecorded },
      ))
      .finally(() => {
        if (releaseMessageId) this.#acceptedMessageIds.delete(messageId);
        if (this.#queues.get(key) === current) this.#queues.delete(key);
      });
    this.#queues.set(key, current);
    return current;
  }

  async #deliverDeferredOutcome(entry, outcome) {
    const text = deferredOutcomeText(outcome);
    return typeof this.#bot.sendDelivery === 'function'
      ? this.#bot.sendDelivery(entry.target, createTextDeliveryBlock(text, outcome.found ? 'markdown' : 'plain'))
      : this.#bot.sendText(entry.target, text);
  }

  async waitForIdle() {
    await this.#busyMessages.whenIdle();
    await Promise.allSettled([
      ...this.#queues.values(),
      ...[...this.#pendingInteractions.values()].flatMap((pending) => (
        pending.queue ? [pending.queue] : []
      )),
      ...this.#approvalTasks,
      ...this.#commandTasks,
    ]);
    await this.#deferred.whenIdle();
  }

  async #processFastCommand(message, messageId, key, runner, senderId) {
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.messagesReceived += 1;
    this.#status.lastMessageAt = new Date().toISOString();
    const target = message.replyTarget;
    try {
      const result = await runner(
        controlTextOf(message),
        this.#harness,
        this.#state,
        key,
        {
          signal: this.#signal,
          isDirect: message.kind === 'direct',
          hasImages: hasInboundImages(message),
          hasFiles: hasInboundFiles(message),
          pendingInteraction: this.#pendingInteractions.has(key)
            || this.#approvals.hasPending(key),
          control: { owner: this, key },
          deferredDelivery: this.#deferred,
          abortPreAsk: () => this.#abortPreAskPhase(key),
          enhancement: captureContextEnhancementSource(
            this.#contextEnhancement,
            message.kind,
            () => {
              const source = message.contextSource?.();
              return {
                channel: this.#descriptor.key,
                senderId,
                senderName: source?.senderName,
                conversationTitle: source?.conversationTitle,
                chatId: source?.chatId ?? message.conversationId,
                threadId: source?.threadId,
              };
            },
          ),
        },
      );
      if (result?.stopped) {
        await Promise.allSettled([
          this.#cancelPendingInteraction(key),
          this.#approvals.closeRoute(key),
        ]);
      }
      for (const reply of result?.messages ?? [result?.message]) {
        if (reply) await this.#bot.sendText(target, reply);
      }
      this.#status.lastError = null;
    } catch (error) {
      if (error?.code === 'turn-stopped' || this.#signal?.aborted) {
        message.statusReaction?.clear();
        return;
      }
      message.statusReaction?.error();
      this.#status.lastError = error?.message ?? String(error);
      const failure = setLastMessageFailure(this.#status, error);
      this.#logger.error?.(
        `[dsh-im:${this.#descriptor.key}] failed to process a command [${failure.referenceId}]:`,
        messageFailureDiagnostic(error, failure),
      );
      await this.#bot.sendText(target, messageFailureText(failure)).catch(() => undefined);
    }
  }

  sendConnectionTest(text) {
    return sendRememberedConnectionTest({
      state: this.#state,
      text,
      channelLabel: t('{label}机器人', { label: this.#descriptor.label }),
      send: (target, message) => this.#bot.sendText(target, message),
    });
  }

  sendProactiveText(target, text, { signal } = {}) {
    signal?.throwIfAborted();
    return this.#bot.sendText(target, text);
  }

  async #deliverArtifacts(target, replyTo, artifacts = [], baseReceipt, {
    onArtifact = null,
  } = {}) {
    // `onArtifact(item)` fires before each materialized artifact is sent;
    // `item.mediaType` distinguishes images from documents.
    const beforeArtifact = onArtifact ?? (() => Promise.resolve());
    const delivery = await deliverOutboundArtifacts({
      artifacts,
      baseReceipt,
      deliveryId: replyTo,
      channelKey: this.#descriptor.key,
      signal: this.#signal,
      sendVoice: typeof this.#bot.sendVoice === 'function'
        ? (file) => beforeArtifact(file).then(() => this.#bot.sendVoice(target, file))
        : undefined,
      sendAnimation: typeof this.#bot.sendAnimation === 'function'
        ? (file) => beforeArtifact(file).then(() => this.#bot.sendAnimation(target, file))
        : undefined,
      sendImage: typeof this.#bot.sendImage === 'function'
        ? (file) => beforeArtifact(file).then(() => this.#bot.sendImage(target, file))
        : undefined,
      sendFile: typeof this.#bot.sendFile === 'function'
        ? (file) => beforeArtifact(file).then(() => this.#bot.sendFile(target, file))
        : undefined,
      onFailure: (artifact, error) => setLastMessageFailure(this.#status, error, {
        userMessage: artifactFailureText(artifact?.fileName, error, this.#descriptor),
        reason: error?.code,
      }),
      sendFailureNotice: (_artifact, _error, failure) => this.#bot.sendText(
        target,
        messageFailureText(failure),
      ),
      logger: this.#logger,
    });
    this.#status.artifactsSent = (this.#status.artifactsSent ?? 0)
      + delivery.artifactsSent;
    this.#status.artifactSendErrors = (this.#status.artifactSendErrors ?? 0)
      + delivery.artifactSendErrors;
    return {
      receipt: delivery.receipt,
      userVisible: delivery.userVisible,
      artifactSendErrors: delivery.artifactSendErrors,
    };
  }

  /**
   * Abort the pre-ask phase (read delay + image staging + stream opening)
   * of one conversation's current turn. Unconditional — deliberately not
   * gated by sendDelay.enabled, because it also closes a pre-existing
   * double-reply race: stopActiveTurn cannot cancel a turn that has not
   * reached the harness yet. Returns true when a pending phase was aborted.
   */
  #abortPreAskPhase(key) {
    const controller = this.#preAskControllers.get(key);
    if (!controller) return false;
    const reason = new Error('已由更新的消息接替。');
    reason.code = 'superseded';
    controller.abort(reason);
    return true;
  }

  /**
   * Idle time in ms since the last completed turn in this conversation
   * (for the sendDelay activity boost). A first-ever message has no
   * activity record and always uses the full range.
   */
  #idleMsFor(key) {
    // null = no completed turn on record (first message): the activity
    // boost then stays out of the way and the full read-delay range applies.
    const lastTurnEnd = this.#turnEnds.get(key);
    return lastTurnEnd === undefined ? null : Date.now() - lastTurnEnd;
  }

  async #process(message, messageId, senderId, conversationKey, {
    alreadyRecorded = false,
  } = {}) {
    if (!alreadyRecorded) {
      if (this.#state.hasSeen(messageId)) return;
      await this.#state.markSeen(messageId);
      this.#status.messagesReceived += 1;
      this.#status.lastMessageAt = new Date().toISOString();
    }

    const target = message.replyTarget;
    const text = controlTextOf(message);
    const batchSubmission = message.batchSubmission;
    let stream = null;
    let semanticStream = false;
    // Thinking streams accept the same delivery-block contract as semantic
    // streams: finish() must receive { text, format } so a markdown answer
    // renders rich instead of falling back to plain text.
    let thinkingStream = false;
    let typingSession = null;
    let content;
    let contextEnhanced = false;
    let streamFinished = false;
    let firstStreamReplySent = false;
    // Whether the carrier currently holding the reply has received answer text
    // (reset on every message_break rotation).
    let carrierStreamedText = false;
    // Set when a segment could not be confirmed as delivered: the tail must
    // then never be suppressed, even when it looks already covered.
    let segmentDeliveryFailed = false;
    // Receipts of the segments already finalized by their own carrier during a
    // message_break rotation; merged into this turn's final receipt.
    const segmentReceipts = [];
    let preAsk = null;
    // A keepalive heartbeat keeps short-lived carriers (e.g. Telegram's
    // private-chat Rich Draft) visible during long silent stretches such as a
    // running tool call. Declared outside the try so every exit path (including
    // pre-prompt failures like image parsing) clears the timer.
    let keepaliveTimer = null;
    const stopKeepalive = () => {
      if (keepaliveTimer !== null) clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    };
    // Re-send the current carrier's last frame so a short-lived carrier stays
    // visible across long silent stretches. Idempotent: a message_break
    // rotation re-arms it for the new carrier without stacking timers, and it
    // also covers a first open that failed while a later one succeeded.
    const startKeepalive = (carrier) => {
      if (!carrier || carrier.keepalive !== true || typeof carrier.refresh !== 'function') return;
      if (keepaliveTimer !== null) return;
      let refreshing = false;
      keepaliveTimer = setInterval(async () => {
        // Skip ticks while the previous heartbeat is pending so redundant
        // refreshes cannot queue ahead of the final answer on a slow network.
        if (refreshing) return;
        refreshing = true;
        try {
          await Promise.allSettled([
            this.#bot.sendTyping?.(target),
            stream?.refresh?.(),
          ]);
        } catch {
          // Keepalive is best-effort, including synchronous adapter failures.
        } finally {
          refreshing = false;
        }
      }, this.#keepaliveIntervalMs);
      keepaliveTimer.unref?.();
    };
    try {
      this.#signal?.throwIfAborted();
      if (message.kind === 'group' && message.addressed !== true) {
        this.#status.messagesRejected += 1;
        this.#status.lastRejectedAt = new Date().toISOString();
        return;
      }
      const hasImages = hasInboundImages(message);
      const hasFiles = hasInboundFiles(message);
      const hasReply = hasReplyReference(message);
      if (!text && !hasImages && !hasFiles && !hasReply) {
        await this.#bot.sendText(target, t('目前支持文字、图片和文件消息。'));
        return;
      }
      const command = text.toLowerCase();
      if (!hasImages && !hasFiles && command === '/help') {
        await this.#bot.sendText(target, [
          t('{label}机器人已连接 DeepSeek Harness。', { label: this.#descriptor.label }),
          '',
          t('直接发送文字、图片或文件即可继续当前会话。'),
          ...commandHelpLines(this.#descriptor.key),
        ].join('\n'));
        return;
      }
      if (!hasImages && !hasFiles && command === '/status') {
        await this.#harness.ensureRunning({ signal: this.#signal });
        await this.#bot.sendText(target, t('{label}机器人与 DeepSeek Harness 连接正常。', { label: this.#descriptor.label }));
        return;
      }
      const workspaceCommand = !hasImages && !hasFiles
        ? await runWorkspaceCommand(text, this.#harness, conversationKey)
        : null;
      if (workspaceCommand) {
        for (const reply of workspaceCommand.messages ?? [workspaceCommand.message]) {
          await this.#bot.sendText(target, reply);
        }
        return;
      }
      if (!hasImages && !hasFiles && command === '/new') {
        await this.#state.clearSession(conversationKey);
        await this.#bot.sendText(target, t('已开启新会话。请发送你的问题。'));
        return;
      }
      const compactCommand = !hasImages && !hasFiles
        ? await runCompactCommand(
            text,
            this.#harness,
            this.#state,
            conversationKey,
            { signal: this.#signal },
          )
        : null;
      if (compactCommand) {
        await this.#bot.sendText(target, compactCommand.message);
        return;
      }

      // Resolve humanization settings for THIS turn (live provider read
      // with constructor fallback) — global/per-bot panel updates apply
      // from the next message without a restart.
      const humanize = this.#humanizeSettings();
      // progressStatus=false suppresses interim "processing…" placeholders
      // and tool/status progress edits. Declared here (before the pre-ask
      // try block) so the onUpdate closure below can read it.
      const suppressProgress = humanize.progressStatus === false;
      // With messageBreak on, every carrier is opened lazily (no "processing…"
      // placeholder). When streaming is on as well, each message_break segment
      // streams in its own carrier and is finalized there (see sendSegment
      // below); turning off progressStatus therefore still streams the text.
      const lazyStream = suppressProgress || humanize.messageBreak;
      // Open a delivery carrier for the current segment. Called once before the
      // ask and again after every message_break rotation. A channel without a
      // stream carrier (or a failed open) leaves delivery to the final message.
      // A thinking stream wins wherever the channel has one: its trace lines are
      // permanent separate messages, so there is no placeholder to open lazily.
      const openReplyStream = async () => {
        semanticStream = false;
        thinkingStream = false;
        carrierStreamedText = false;
        if (!humanize.streaming) return null;
        if (this.#thinkingTraces && typeof this.#bot.openThinkingStream === 'function') {
          try {
            const opened = await this.#bot.openThinkingStream(target);
            thinkingStream = true;
            return opened;
          } catch (error) {
            this.#logger.warn?.(
              `[dsh-im:${this.#descriptor.key}] unable to start a thinking stream; using final delivery:`,
              error,
            );
          }
        }
        const streamOptions = lazyStream ? { lazy: true } : undefined;
        if (typeof this.#bot.openDeliveryStream === 'function') {
          try {
            const opened = await this.#bot.openDeliveryStream(target, streamOptions);
            semanticStream = true;
            return opened;
          } catch (error) {
            this.#logger.warn?.(
              `[dsh-im:${this.#descriptor.key}] unable to start a semantic reply stream; using final delivery:`,
              error,
            );
            return null;
          }
        }
        if (typeof this.#bot.openStream === 'function') {
          try {
            return await this.#bot.openStream(target, streamOptions);
          } catch (error) {
            this.#logger.warn?.(
              `[dsh-im:${this.#descriptor.key}] unable to start a streamed reply; using text:`,
              error,
            );
            return null;
          }
        }
        return null;
      };
      // Without a carrier, a message_break segment is sent as its own IM message.
      const sendSegmentAsText = async (segmentText) => {
        try {
          await this.#bot.sendText(target, segmentText);
          return true;
        } catch (error) {
          this.#logger.warn?.(
            `[dsh-im:${this.#descriptor.key}] message_break segment text fallback failed:`,
            error,
          );
          return false;
        }
      };
      // Finalize the current segment in its own carrier: the carrier turns what
      // it holds into a real message. Returns whether the segment is confirmed
      // delivered (by the carrier, or by the plain-text fallback).
      const finishSegment = async (segmentText) => {
        const active = stream;
        if (!active) return false;
        // Detach first: the keepalive heartbeat must not touch a closed carrier.
        stream = null;
        let result = null;
        try {
          result = semanticStream
            ? await active.finish(createTextDeliveryBlock(segmentText, 'markdown'))
            : await active.finish(segmentText);
        } catch (error) {
          active.cancel?.();
          const failure = channelDeliveryFailure(error);
          const resent = failure.code !== 'channel-delivery-uncertain';
          this.#logger.warn?.(
            `[dsh-im:${this.#descriptor.key}] unable to finalize a message_break segment (${failure.code})${resent ? '; re-sending it as text' : '; not re-sending an unconfirmed delivery'}:`,
            error,
          );
          // A thrown delivery error is uncertain by default: the segment may
          // already have landed, so only a definite rejection is re-sent.
          return resent ? sendSegmentAsText(segmentText) : false;
        }
        // A definite failure carries no user-visible message; 'unknown' may
        // have landed, so it is never duplicated.
        if (result?.deliveryOutcome === 'failed') {
          this.#logger.warn?.(
            `[dsh-im:${this.#descriptor.key}] a message_break segment was rejected (${result?.reason ?? 'unknown'}); sending it as text:`,
          );
          return sendSegmentAsText(segmentText);
        }
        segmentReceipts.push({ result, stream: active });
        return true;
      };

      // ---- Phase ①: read delay（"过了一段时间才读到消息"）----
      // Silent: no typing indicator, no read receipts, no harness activity.
      // All command / approval / error paths return above and are never
      // delayed. The pre-ask controller makes the phase abortable: a newer
      // message (interrupt) or /stop supersedes the whole phase instead of
      // waiting it out. Channels without any typing API cap the silence at
      // SHORT_DELAY_CAP_MS — a long dead chat looks broken there.
      preAsk = new AbortController();
      this.#preAskControllers.set(conversationKey, preAsk);
      const preAskSignal = this.#signal
        ? AbortSignal.any([this.#signal, preAsk.signal])
        : preAsk.signal;
      // Phase ② state, filled in below: the compose-phase typing session
      // ("打字、思考的断续"), bound to this turn and stopped in finally.
      typingSession = null;
      try {
        await applyReadDelay({
          settings: humanize,
          userText: text,
          idleMs: this.#idleMsFor(conversationKey),
          channelCapMs: typeof this.#bot.sendTyping === 'function'
            ? undefined
            : SHORT_DELAY_CAP_MS,
          signal: preAskSignal,
        });
        // ---- Phase ②: compose（"打字、思考的断续"）----
        // The indicator opens only after the silence and then covers
        // generation, segment gaps and pending-interaction waits.
        if (humanize.typingIndicator !== 'off' && typeof this.#bot.sendTyping === 'function') {
          typingSession = createTypingSession({
            sendTyping: (action) => this.#bot.sendTyping(target, action),
            stopTyping: typeof this.#bot.stopTyping === 'function'
              ? () => this.#bot.stopTyping(target)
              : null,
            refreshMs: this.#descriptor.typing?.refreshMs ?? 4000,
            darkResidualMs: this.#descriptor.typing?.darkResidualMs ?? 0,
            mode: humanize.typingIndicator,
            burst: humanize.typingBurst,
            logger: this.#logger,
            signal: this.#signal,
          });
          await typingSession.start();
        }
        // Stream opening stays inside the pre-ask region so a supersede
        // abort still wins against it. lazyStream=true (progressStatus=false or
        // messageBreak=true) skips the "processing…" placeholder: the first
        // real content creates the bubble instead.
        stream = await openReplyStream();
        if (preAsk.signal.aborted) {
          const superseded = new Error('superseded by a newer message');
          superseded.code = 'superseded';
          throw superseded;
        }
        // Image staging is the last pre-ask step. A message may carry two
        // texts: `controlText`, the plain body the parsers read, and `content`,
        // the same body decorated for the model -- the email channel prefixes
        // the mail headers there, so a subject-only instruction is not silently
        // dropped. Falling back to the parsed text kept commands working but
        // lost that decoration entirely.
        //
        // `deferImages` keeps the image bytes out of the prompt text: they ride
        // in `askOptions.images` instead, so a channel that streams can open its
        // carrier before the download finishes.
        content = hasImages || hasReply
          ? await promptContentForInboundMessage(message, { signal: preAskSignal, deferImages: true })
          : cleanText(message.content) || undefined;
      } finally {
        if (this.#preAskControllers.get(conversationKey) === preAsk) {
          this.#preAskControllers.delete(conversationKey);
        }
      }
      // Create a message_break handler for this turn. Only active when
      // messageBreak=true. Without a carrier, sendSegment sends each segment as
      // a separate IM message. Phase-② segment gap: "typing the next message" —
      // every segment after the first waits a humanized pause; the typing
      // session keeps glowing through the gap and restarts its on-phase after
      // each send.
      let segmentsSent = 0;
      const messageBreakHandler = humanize.messageBreak
        ? createMessageBreakHandler({
          sendSegment: async (segmentText) => {
            // Streaming on: the segment is finalized in the carrier that
            // streamed it, and a fresh carrier takes over the next segment.
            if (stream) {
              if (!await finishSegment(segmentText)) segmentDeliveryFailed = true;
              // Count the delivered message so a later segment that falls back
              // to the text path still gets its humanized pause.
              segmentsSent += 1;
              stream = await openReplyStream();
              startKeepalive(stream);
              // The fresh carrier holds nothing yet: bring the composing
              // indicator back for the next segment's compute gap (start() is a
              // no-op while it still runs), unless a question/approval card is
              // waiting — that card owns the screen.
              if (typingSession
                && !this.#pendingInteractions.has(conversationKey)
                && !this.#approvals.hasPending(conversationKey)) {
                firstStreamReplySent = false;
                await typingSession.start();
              }
              return;
            }
            if (segmentsSent > 0) {
              // restartOn → sleep → send (plan §6.3): the indicator covers
              // the gap and the upcoming send, and there is no trailing
              // restartOn after the final segment (channels without a cancel
              // API would glow for the platform residual with no follow-up).
              await typingSession?.restartOn();
              await applySegmentGap({
                settings: humanize,
                segmentText,
                minSegmentGapMs: this.#descriptor.minSegmentGapMs ?? 0,
                signal: this.#signal,
              });
            }
            segmentsSent += 1;
            const sent = await this.#bot.sendText(target, segmentText);
            return sent;
          },
          logger: this.#logger,
        })
        : null;
      // A thinking carrier answers updates line by line instead of editing one
      // message, so it needs every update in order, reasoning frames included.
      const thinkingMode = Boolean(stream
        && this.#thinkingTraces
        && typeof stream.sendToolTrace === 'function');
      const snapshot = this.#acceptedMessageIds.get(messageId);
      if (snapshot) {
        const originalContent = content ?? text;
        const contextSource = message.contextSource?.();
        content = enhanceContextContent(originalContent, snapshot, () => ({
          channel: this.#descriptor.key,
          senderId,
          senderName: contextSource?.senderName,
          conversationTitle: contextSource?.conversationTitle,
          chatId: contextSource?.chatId ?? message.conversationId,
          threadId: contextSource?.threadId,
        }));
        contextEnhanced = content !== originalContent;
      }
      // Start the keepalive only after the inbound payload is ready, so a
      // pre-prompt failure (image parsing, context building) cannot leave the
      // timer running; the outermost finally below clears it on every path.
      startKeepalive(stream);
      const { answer, artifacts = [] } = await askInWorkspaceSession({
        deferredDelivery: () => ({ coordinator: this.#deferred, target: this.#descriptor.key === 'whatsapp' ? { jid: target.jid, selfChat: target.selfChat } : target }),
        harness: this.#harness,
        state: this.#state,
        key: conversationKey,
        text,
        content,
        titleText: batchSubmission?.title,
        sourceGuidance: snapshot?.config?.guidance,
        contextEnhanced,
        createOptions: this.#signal ? { signal: this.#signal } : undefined,
        existsOptions: this.#signal ? { signal: this.#signal } : undefined,
        askOptions: {
          timeoutMs: this.#replyTimeoutMs,
          signal: this.#signal,
          control: { owner: this, key: conversationKey },
          // Thinking mode needs every update (reasoning + tool calls) in
          // order; latest mode filters as before. Only thinking mode subscribes
          // to reasoning updates, so default-mode consumers on other channels
          // never see them (their progress handlers would render update.text).
          progressMode: thinkingMode ? 'all' : undefined,
          reasoning: thinkingMode,
          onUpdate: (stream || messageBreakHandler) ? async (update) => {
            // message_break handler intercepts break updates: with a live
            // carrier it finalizes the segment there and opens the next one;
            // without one it sends the segment as a separate IM message.
            // Returns null when consumed (the update must not reach the stream).
            if (messageBreakHandler) {
              const handled = await messageBreakHandler.handleUpdate(update);
              if (handled === null) return;
              update = handled;
            }
            if (!stream) return;
            if (thinkingMode) {
              // Only the 💭 and 🔧 lines are surfaced; status/text updates
              // and the assistant-message canonical text are not.
              if (update.type === 'reasoning') {
                await stream.sendThinking(update.text);
              } else if (update.type === 'tool') {
                await stream.sendToolTrace(update.name, update.arguments);
              }
              return;
            }
            if (update.type === 'reasoning') return;
            // progressStatus=false: drop interim tool/status progress text
            // ("正在使用{name}…", "正在整理结果…"). Only real text and
            // assistant-message canonical frames reach the stream.
            if (suppressProgress
              && update.type !== 'text' && update.type !== 'assistant-message') {
              return;
            }
            const progress = update.type === 'text' ? update.text
              : update.type === 'tool' ? t('正在使用{name}…', { name: update.name }) : update.text;
            if (progress) {
              const format = update.type === 'text' ? 'markdown' : 'plain';
              if (update.type === 'text') carrierStreamedText = true;
              await stream.update(semanticStream
                ? createTextDeliveryBlock(progress, format)
                : progress);
              // The first visible reply chunk makes the platform drop its
              // typing indicator by itself; stop ours so both signals agree
              // and the final send does not race a stale indicator refresh.
              if (!firstStreamReplySent) {
                firstStreamReplySent = true;
                typingSession?.stop();
              }
            }
          } : undefined,
          onInteraction: async (interaction) => {
            if (stream?.keepalive === true && typeof stream.stopPreview === 'function') {
              stopKeepalive();
              await stream.stopPreview();
            }
            return this.#handleInteraction(interaction, {
              key: conversationKey,
              actor: senderId,
              target,
              requiresMention: message.kind === 'group' && message.requiresMention !== false,
              typingSession,
            });
          },
          onInteractionResolved: (resolution) => {
            const settled = this.#handleInteractionResolved(resolution);
            return Promise.resolve(settled).finally(() => {
              // Resume typing only when no other question/approval is still
              // pending for this conversation (multi-question flows pause
              // again on the next interaction).
              if (!this.#pendingInteractions.has(conversationKey)
                && !this.#approvals.hasPending(conversationKey)) {
                typingSession?.resume();
              }
            });
          },
          files: message.files,
          images: message.images,
        },
      });
      stopKeepalive();
      if (batchSubmission) {
        this.#batches.complete(conversationKey, batchSubmission.token);
      }
      // A no_reply turn concludes without a reply: silence is the intended
      // outcome, not an empty model response. Settle quietly — clear the
      // status reaction, drop any open draft, send nothing.
      if (!cleanText(answer) && artifacts.length === 0) {
        message.statusReaction?.clear();
        stream?.cancel?.();
        return;
      }
      const fileOnlyCompletion = !cleanText(answer) && artifacts.length > 0;
      // Every segment already finalized by its own carrier contributes its
      // provider message ids to this turn's receipt.
      const segmentMessageIds = segmentReceipts.flatMap(({ result, stream: used }) => [
        ...providerMessageIdsFor(used),
        ...providerMessageIdsFor(result),
      ]);
      // When message_break was used, the segments before each break were
      // already delivered. The final message is only the remaining text after
      // the last break point — streamed by the carrier opened at that break.
      const baseAnswer = fileOnlyCompletion
        ? t(FILE_ONLY_COMPLETION_TEXT)
        : answer;
      const visibleAnswer = messageBreakHandler?.hasBreaks()
        ? messageBreakHandler.remainingText(baseAnswer)
        : baseAnswer;
      // A reply that ends exactly at a break point has no tail left: there
      // remainingText falls back to the full answer, which the segments already
      // delivered, so sending it again would duplicate the last segment.
      // `segmentsCover` proves the tail is empty, `!carrierStreamedText` keeps a
      // carrier that did stream something from being dropped, and a segment
      // that was not confirmed as delivered always gets the tail as a fallback.
      const tailAlreadyDelivered = messageBreakHandler?.segmentsCover(baseAnswer) === true
        && !carrierStreamedText
        && !segmentDeliveryFailed;
      const answerFormat = fileOnlyCompletion ? 'plain' : 'markdown';
      let textDeliveryError = null;
      let textReceipt = null;
      if (stream) {
        if (tailAlreadyDelivered || !cleanText(visibleAnswer)) {
          // Nothing is left for this carrier: it must not turn into an empty
          // message or repeat what the finalized segments already delivered.
          stream.cancel?.();
          stream = null;
        } else {
          const active = stream;
          try {
            const result = await active.finish(semanticStream || thinkingStream
              ? createTextDeliveryBlock(visibleAnswer, answerFormat)
              : visibleAnswer);
            streamFinished = true;
            textReceipt = createDeliveryReceipt({
              deliveryId: messageId,
              presentation: result?.presentation
                ?? active.presentation
                ?? `${this.#descriptor.key}-stream`,
              providerMessageIds: [
                ...segmentMessageIds,
                ...providerMessageIdsFor(active),
                ...providerMessageIdsFor(result),
              ],
              deliveryOutcome: result?.deliveryOutcome,
              reason: result?.reason,
            });
          } catch (error) {
            active.cancel?.();
            this.#logger.warn?.(
              `[dsh-im:${this.#descriptor.key}] streamed reply finalization failed; using text:`,
              error,
            );
          }
        }
      }
      if (!streamFinished) {
        // When message_break sent all text as segments, the remaining answer
        // may be empty — skip sending an empty final message.
        if (tailAlreadyDelivered
          || (messageBreakHandler?.hasBreaks() && !cleanText(visibleAnswer))) {
          // No final text to send; artifacts (if any) are delivered separately.
        } else {
          try {
            const result = typeof this.#bot.sendDelivery === 'function'
              ? await this.#bot.sendDelivery(
                  target,
                  createTextDeliveryBlock(visibleAnswer, answerFormat),
                )
              : await this.#bot.sendText(target, visibleAnswer);
            textReceipt = createDeliveryReceipt({
              deliveryId: messageId,
              presentation: result?.presentation ?? `${this.#descriptor.key}-text`,
              providerMessageIds: [
                ...segmentMessageIds,
                ...providerMessageIdsFor(result),
              ],
              deliveryOutcome: result?.deliveryOutcome,
              reason: result?.reason,
            });
          } catch (error) {
            textDeliveryError = channelDeliveryFailure(error);
          }
        }
      }
      const finalDeliveryUnknown = textReceipt?.deliveryOutcome === 'unknown';
      if (textReceipt?.deliveryOutcome === 'failed') {
        textDeliveryError = channelDeliveryFailure(
          Object.assign(new Error('Final text delivery failed'), { code: textReceipt.reason }),
          { uncertain: false },
        );
      } else if (finalDeliveryUnknown) {
        textDeliveryError = channelDeliveryFailure(
          Object.assign(new Error('Final text delivery outcome is unknown'), { code: textReceipt.reason }),
        );
      }
      // A failed final text must not discard an already registered result file.
      // Settle the independent attachment path before surfacing the text error.
      // "Uploading a file" replaces the typing action where the platform has
      // one (Telegram upload_photo/upload_document); other adapters ignore
      // the action and simply keep the indicator glowing during the upload.
      const delivery = await this.#deliverArtifacts(target, messageId, artifacts, textReceipt, {
        onArtifact: (item) => {
          if (!typingSession) return Promise.resolve();
          const isVoice = isVoicePresentation(item);
          const isImage = typeof item?.mediaType === 'string' && item.mediaType.startsWith('image/');
          const action = isVoice
            ? 'record_voice'
            : isImage
              ? 'upload_photo'
              : 'upload_document';
          return typingSession.restartOn(action);
        },
      });
      if (textDeliveryError && (!delivery.userVisible || finalDeliveryUnknown)) {
        textDeliveryError.deliveryReceipt = delivery.receipt;
        throw textDeliveryError;
      }
      if (textDeliveryError && delivery.artifactSendErrors === 0) {
        setLastMessageFailure(this.#status, textDeliveryError);
      }
      if (delivery.userVisible) {
        this.#status.messagesReplied += 1;
        this.#status.lastReplyAt = new Date().toISOString();
        this.#status.lastError = null;
        if (!textDeliveryError && delivery.artifactSendErrors === 0) {
          clearLastMessageFailure(this.#status);
        }
      }
      // The turn produced an answer, so its retry budget is spent and reset.
      this.#deliveryAttempts.delete(messageId);
      return delivery.receipt;
    } catch (error) {
      stopKeepalive();
      const turnStopped = error?.code === 'turn-stopped';
      if (batchSubmission && turnStopped) {
        this.#batches.complete(conversationKey, batchSubmission.token);
      }
      const superseded = preAsk?.signal.aborted === true;
      // Superseded turns never reached the harness: retain the batch for a
      // /send retry instead of leaving it stuck in 'submitting'.
      const failedBatch = batchSubmission && !turnStopped
        ? this.#batches.fail(conversationKey, batchSubmission.token)
        : null;
      if (turnStopped) {
        message.statusReaction?.clear();
        if (isSupersededStop(error)) {
          // A newer message superseded this turn: the interruption itself must
          // stay invisible. No notice, no finalized draft — the newer turn
          // takes over the conversation banner.
          stream?.cancel?.();
          return;
        }
        if (stream) {
          try {
            await stream.finish(t('已停止。'));
          } catch {
            stream.cancel?.();
          }
        }
        return;
      }
      if (superseded) {
        // A newer message (interrupt) or /stop replaced this turn before it
        // reached the harness: silent — the reaction clears, no failure text,
        // and the newer turn already owns this conversation.
        message.statusReaction?.clear();
        stream?.cancel?.();
        return;
      }
      if (this.#signal?.aborted) {
        message.statusReaction?.clear();
        stream?.cancel?.();
        return;
      }
      message.statusReaction?.error();
      this.#status.lastError = error?.message ?? String(error);
      const presentStreamFailure = async (text) => {
        const method = typeof stream?.fail === 'function'
          ? 'fail'
          : (typeof stream?.finish === 'function' ? 'finish' : null);
        if (!method) return false;
        try {
          const result = await stream[method](text);
          return method === 'fail'
            ? Boolean(result) && result.deliveryOutcome !== 'failed'
            : result !== false && result?.deliveryOutcome !== 'failed';
        } catch (streamError) {
          this.#logger.warn?.(
            `[dsh-im:${this.#descriptor.key}] unable to finalize the failed stream:`,
            streamError,
          );
          return false;
        }
      };
      const imageErrorMessage = imagePromptUserMessage(error);
      const fileErrorMessage = inboundFileUserMessage(error);
      const failure = setLastMessageFailure(this.#status, error, {
        userMessage: fileErrorMessage ?? imageErrorMessage,
        reason: imagePromptDiagnostic(error)?.reason,
      });
      const failureText = failedBatch?.retained
        ? `${messageFailureText(failure)}\n\n${failedBatch.message}`
        : messageFailureText(failure);
      this.#logger.error?.(
        `[dsh-im:${this.#descriptor.key}] failed to process a message [${failure.referenceId}]:`,
        messageFailureDiagnostic(error, failure),
      );
      if (await presentStreamFailure(failureText)) {
        return error.deliveryReceipt;
      }
      stream?.cancel?.();
      try {
        await this.#bot.sendText(target, failureText);
      } catch (sendError) {
        this.#logger.error?.(
          `[dsh-im:${this.#descriptor.key}] failed to send the safe error reply:`,
          sendError,
        );
      }
      // The turn produced no answer, so this id is "attempted", not "handled".
      // Releasing the mark lets the next poll retry it; `alreadyRecorded` means
      // an outer caller owns the mark, so it is left alone there.
      if (!alreadyRecorded) await this.#releaseFailedDelivery(messageId);
      return error.deliveryReceipt;
    } finally {
      // Phase-② lifecycle: the typing session is bound to the turn, not to
      // any specific send — /stop, errors and no-send endings all land here
      // and never leave a composing indicator behind.
      typingSession?.stop();
      this.#turnEnds.set(conversationKey, Date.now());
      stopKeepalive();
      await Promise.allSettled([
        this.#cancelPendingInteraction(conversationKey),
        this.#approvals.closeRoute(conversationKey),
      ]);
    }
  }

  /**
   * Release the `markSeen` of a turn that failed without delivering anything,
   * so the next poll can pick the message up again.
   *
   * Bounded: a message is retried at most `MAX_DELIVERY_ATTEMPTS` times, after
   * which the mark stays and the id becomes a tombstone. That keeps a mail that
   * always fails from being re-executed forever, while a transient Harness
   * outage no longer drops it permanently.
   *
   * Returns true when the message was released and will be retried.
   */
  async #releaseFailedDelivery(messageId) {
    const attempts = (this.#deliveryAttempts.get(messageId) ?? 0) + 1;
    if (attempts >= MAX_DELIVERY_ATTEMPTS) {
      // Give up: keep the mark so the id is never replayed, and stop tracking
      // it. The sender has already been told the turn failed.
      this.#deliveryAttempts.delete(messageId);
      this.#logger.warn?.(
        `[dsh-im:${this.#descriptor.key}] giving up on a message after `
        + `${attempts} failed delivery attempts; it will not be retried.`,
      );
      return false;
    }
    this.#deliveryAttempts.set(messageId, attempts);
    if (typeof this.#state?.unmarkSeen !== 'function') return false;
    try {
      await this.#state.unmarkSeen(messageId);
      return true;
    } catch (error) {
      this.#logger.warn?.(
        `[dsh-im:${this.#descriptor.key}] unable to release a failed message for retry:`,
        error,
      );
      return false;
    }
  }

  /**
   * Advance the pending interaction with one answer.
   *
   * `resolveAnswer` lets a caller that already knows the exact answer supply it
   * directly. A button press uses this: replaying its label as reply text would
   * re-parse a numeric label such as "2" as the second option, submitting a
   * different option than the one pressed.
   */
  async #processInteractionReply(
    message,
    messageId,
    senderId,
    key,
    expected,
    { resolveAnswer } = {},
  ) {
    if (this.#signal?.aborted) {
      message.statusReaction?.clear();
      return;
    }
    const current = this.#pendingInteractions.get(key);
    const claimed = expected.claimedReplyMessageId === messageId;
    if (!current || current !== expected || current.submitting) {
      if (claimed && (!current || current !== expected)) {
        return this.#discardResolvedInteractionReply(message, messageId);
      }
      return this.#enqueueMessage(message, messageId, senderId, key, {
        releaseMessageId: false,
      });
    }
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.messagesReceived += 1;
    this.#status.lastMessageAt = new Date().toISOString();

    if (message.kind === 'group' && message.addressed !== true) {
      this.#status.messagesRejected += 1;
      this.#status.lastRejectedAt = new Date().toISOString();
      return;
    }

    const target = message.replyTarget;
    const text = controlTextOf(message);
    if (!text || hasInboundImages(message) || hasInboundFiles(message)) {
      try {
        await this.#bot.sendText(target, t('请用文字回答当前问题。'));
      } catch (error) {
        this.#logger.error?.(
          `[dsh-im:${this.#descriptor.key}] failed to reject a non-text interaction reply:`,
          error,
        );
      }
      return;
    }

    const pending = this.#pendingInteractions.get(key);
    if (!pending || pending !== expected || pending.submitting) {
      if (claimed && (!pending || pending !== expected)) {
        return this.#discardResolvedInteractionReply(message, messageId, {
          alreadyRecorded: true,
        });
      }
      return this.#enqueueMessage(message, messageId, senderId, key, {
        releaseMessageId: false,
        alreadyRecorded: true,
      });
    }
    pending.target = target;
    if (pending.needsPresentation) {
      const presentationWasInFlight = pending.presentationTask !== null;
      try {
        await this.#presentInteraction(pending);
      } catch (error) {
        message.statusReaction?.error();
        this.#status.lastError = t('{label}交互问题发送失败。', { label: this.#descriptor.label });
        this.#logger.error?.(
          `[dsh-im:${this.#descriptor.key}] failed to retry an interaction question:`,
          error,
        );
        pending.interaction.reconnect?.();
        return;
      }
      const presented = this.#pendingInteractions.get(key);
      if (!presented || presented !== expected || presented.submitting) {
        if (claimed && (!presented || presented !== expected)) {
          return this.#discardResolvedInteractionReply(message, messageId, {
            alreadyRecorded: true,
          });
        }
        return this.#enqueueMessage(message, messageId, senderId, key, {
          releaseMessageId: false,
          alreadyRecorded: true,
        });
      }
      // A reply can arrive after the platform accepted the question message but
      // before its send promise settles. In that case it is already a valid
      // answer. A message which itself retried a failed presentation is not.
      if (!presentationWasInFlight) return;
    }

    const question = pending.questions[pending.index];
    if (!question) return;
    const answer = typeof resolveAnswer === 'function'
      ? resolveAnswer(question)
      : harnessAnswerForQuestion(question, text);
    if (!answer) return;
    // Retire this question's keyboard before moving on: the answer is already in,
    // and a card left behind in the chat stays pressable after the batch advances.
    await this.#retireInteractionCard(pending.target, pending.cardMessageId);
    pending.cardMessageId = null;
    pending.answers.push(answer);
    pending.index += 1;
    if (pending.index < pending.questions.length) {
      if (pending.claimedReplyMessageId === messageId) {
        pending.claimedReplyMessageId = null;
      }
      pending.needsPresentation = true;
      try {
        await this.#presentInteraction(pending);
      } catch (error) {
        message.statusReaction?.error();
        this.#status.lastError = t('{label}交互问题发送失败。', { label: this.#descriptor.label });
        this.#logger.error?.(
          `[dsh-im:${this.#descriptor.key}] failed to send the next interaction question:`,
          error,
        );
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
      this.#clearPendingInteraction(key, pending.interactionId);
      this.#status.lastError = null;
    } catch (error) {
      if (error?.code === 'interaction-not-pending') {
        this.#clearPendingInteraction(key, pending.interactionId);
        if (this.#signal?.aborted) {
          message.statusReaction?.clear();
          return;
        }
        try {
          await this.#bot.sendText(target, t(INTERACTION_RESOLVED_TEXT));
        } catch (sendError) {
          this.#logger.error?.(
            `[dsh-im:${this.#descriptor.key}] failed to send an expired interaction notice:`,
            sendError,
          );
        }
        return;
      }
      if (this.#signal?.aborted) {
        message.statusReaction?.clear();
        return;
      }
      if (this.#pendingInteractions.get(key) !== pending) {
        message.statusReaction?.clear();
        return;
      }
      message.statusReaction?.error();
      pending.submitting = false;
      pending.answers.pop();
      pending.index -= 1;
      this.#status.lastError = t('回答提交失败。');
      this.#logger.error?.(
        `[dsh-im:${this.#descriptor.key}] failed to answer a Harness interaction:`,
        error,
      );
      try {
        await this.#bot.sendText(target, t('回答提交失败，请重新发送当前问题的答案。'));
      } catch (sendError) {
        this.#logger.error?.(
          `[dsh-im:${this.#descriptor.key}] failed to send an interaction retry notice:`,
          sendError,
        );
      }
    }
  }

  /** Acknowledge a press so the client stops its spinner; never fails the answer. */
  async #answerInteractionCallback(callback, text) {
    if (typeof this.#bot.answerInteractionCallback !== 'function') return;
    try {
      await this.#bot.answerInteractionCallback(callback.callbackQueryId, text);
    } catch (error) {
      this.#logger.warn?.(
        `[dsh-im:${this.#descriptor.key}] could not acknowledge a button press:`,
        error?.message ?? error,
      );
    }
  }

  /** Drop a handled card's keyboard so the same press cannot be submitted twice. */
  async #retireInteractionCard(target, providerMessageId) {
    if (!providerMessageId || typeof this.#bot.updateInteractionCard !== 'function') return;
    try {
      await this.#bot.updateInteractionCard(target, providerMessageId, {
        markup: { inline_keyboard: [] },
      });
    } catch (error) {
      this.#logger.warn?.(
        `[dsh-im:${this.#descriptor.key}] could not retire an interaction card:`,
        error?.message ?? error,
      );
    }
  }

  /**
   * Accept an inline-keyboard press. The press is replayed as the option label the
   * text flow already understands, so a button and a typed reply share one
   * submission path and cannot drift apart.
   */
  async acceptCallback(callback) {
    if (this.#signal?.aborted) return;
    const conversationId = cleanText(callback?.conversationId);
    const senderId = cleanText(callback?.senderId);
    const messageId = cleanText(callback?.messageId);
    if (!conversationId || !senderId || !messageId || callback?.senderIsBot === true) return;
    const kind = callback.kind === 'group' ? 'group' : 'direct';
    const key = `${kind}:${conversationId}`;
    const pending = this.#pendingInteractions.get(key);
    const notice = (text) => this.#answerInteractionCallback(callback, text);
    if (!pending) return notice(t('该问题已处理，无需再次选择。'));
    if (pending.actor !== senderId) {
      return notice(t('只有发起当前任务的用户可以处理这条问题。'));
    }
    // A press can arrive while an earlier one is still being submitted: the
    // acknowledgement round-trip is a real window, and a user who sees no feedback
    // presses again. Claim synchronously, before the first await, so the second
    // press cannot advance the same question twice.
    if (pending.submitting || pending.callbackClaimed) {
      return notice(t('正在提交你的选择，请稍候。'));
    }

    const question = pending.questions[pending.index];
    const parsed = this.#interactionCard?.parse?.(callback.data) ?? null;
    const option = parsed && Array.isArray(question?.options)
      ? question.options[parsed.optionIndex]
      : undefined;
    if (!question || !parsed
      || !pending.cardNonce || parsed.nonce !== pending.cardNonce
      || parsed.questionIndex !== pending.index
      || !option || typeof option.label !== 'string') {
      return notice(t('这个选项已失效，请使用最新一条问题。'));
    }
    // Multi-select needs a keyboard that accumulates choices and a submit action;
    // until that exists the request keeps the text answer it has always accepted.
    if (question.multiSelect === true) {
      return notice(t('多选问题请直接回复文字。'));
    }

    pending.callbackClaimed = true;
    // A press can beat the card's own send promise — Telegram delivers the update
    // as soon as its API accepted the keyboard. Wait for delivery so the card id
    // exists and the shared submission path can retire its keyboard.
    await pending.presentationTask?.catch(() => undefined);
    await notice(t('已选择：{label}', { label: option.label }));
    await this.#processInteractionReply(
      {
        kind,
        conversationId,
        messageId,
        senderId,
        addressed: true,
        content: option.label,
        replyTarget: callback.replyTarget ?? pending.target,
        statusReaction: null,
      },
      messageId,
      senderId,
      key,
      pending,
      // The press already identifies its option by index, so answer with that
      // exact label. Replaying the label as reply text would re-parse a numeric
      // label such as "2" as the second option and submit a different one.
      { resolveAnswer: (current) => ({ id: current.id, selected: [option.label] }) },
    ).catch((error) => {
      this.#logger.error?.(
        `[dsh-im:${this.#descriptor.key}] failed to submit a card answer:`,
        error,
      );
    }).finally(() => {
      // A failed submission rolls the question back, so let the user press again.
      if (this.#pendingInteractions.get(key) === pending) pending.callbackClaimed = false;
    });
  }

  async presentSessionSyncApproval(interaction, context, options = {}) {
    return this.#approvals.handleSessionSyncRequested(interaction, context, {
      ...options, runtimeSignal: this.#signal ?? options.runtimeSignal, accessPolicy: this.#accessPolicy,
    });
  }

  async #handleInteraction(interaction, {
    key,
    actor,
    target,
    requiresMention,
    typingSession = null,
  }) {
    if (interaction?.kind === 'approval') {
      // A pending approval means the human is waiting for the other side,
      // not typing. Recovered approvals are auto-cancelled below without
      // a matching resume, so they must not pause either.
      if (interaction.recovered !== true) typingSession?.pause();
      return this.#approvals.handleRequested(interaction, {
        key,
        actor,
        requiresMention,
        send: (text) => this.#bot.sendText(target, text),
      });
    }
    if (interaction?.kind !== 'question') return;
    const questions = interaction?.payload?.questions;
    const interactionId = cleanText(interaction?.interactionId) || cleanText(interaction?.rpcId);
    if (!cleanText(interaction?.rpcId)
      || !interactionId
      || !cleanText(interaction?.sessionId)
      || !Array.isArray(questions)
      || questions.length === 0
      || questions.some((question) => !validHarnessQuestion(question))) {
      this.#logger.warn?.(
        `[dsh-im:${this.#descriptor.key}] ignored an invalid Harness question interaction`,
      );
      return;
    }

    if (interaction.recovered === true) {
      await this.#respondCancellation(
        interaction,
        `${this.#descriptor.label} safely cancelled an interaction left by an earlier client.`,
      );
      try {
        await this.#bot.sendText(
          target,
          t('检测到这个 Session 中遗留的待回答问题，已安全取消并继续处理你刚才的消息。'),
        );
      } catch (error) {
        this.#logger.error?.(
          `[dsh-im:${this.#descriptor.key}] failed to send an interaction recovery notice:`,
          error,
        );
      }
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
      this.#logger.warn?.(
        `[dsh-im:${this.#descriptor.key}] cancelled a second pending Harness question`,
      );
      await this.#respondCancellation(
        interaction,
        `${this.#descriptor.label} is already handling another user interaction.`,
      );
      return;
    }

    const pending = {
      kind: 'question',
      interactionId,
      sessionId: interaction.sessionId,
      interaction,
      actor,
      requiresMention,
      questions,
      answers: [],
      index: 0,
      target,
      queue: null,
      claimedReplyMessageId: null,
      submitting: false,
      needsPresentation: true,
      presentationTask: null,
      cardMessageId: null,
      // Identity of the keyboard currently on screen, and the guard that keeps two
      // presses of the same card from advancing one question twice.
      cardNonce: null,
      callbackClaimed: false,
    };
    // Real question pending: the human is waiting for the other side, not
    // typing (recovered questions return above without reaching here).
    typingSession?.pause();
    this.#pendingInteractions.set(key, pending);
    this.#interactionKeys.set(interactionId, key);
    await this.#presentInteraction(pending);
  }

  async #handleInteractionResolved(resolution) {
    if (resolution?.kind === 'approval') {
      await this.#approvals.handleResolved(resolution);
      return;
    }
    const interactionId = cleanText(resolution?.interactionId);
    if (resolution?.kind !== 'question' || !interactionId) return;
    const key = this.#interactionKeys.get(interactionId);
    if (!key) return;
    this.#clearPendingInteraction(key, interactionId);
  }

  /** Build card content for the current question, or null to keep the text flow. */
  #interactionCardFor(pending, question) {
    if (!this.#interactionCard || typeof this.#interactionCard.render !== 'function') return null;
    if (typeof this.#bot.sendInteractionCard !== 'function') return null;
    if (pending.submitting) return null;
    let card = null;
    try {
      card = this.#interactionCard.render(question, {
        questionIndex: pending.index,
        total: pending.questions.length,
        requiresMention: pending.requiresMention,
        nonce: pending.cardNonce,
      });
    } catch (error) {
      this.#logger.warn?.(
        `[dsh-im:${this.#descriptor.key}] interaction card renderer failed:`,
        error,
      );
      return null;
    }
    if (!card || typeof card.text !== 'string' || !card.text || !card.markup) return null;
    return card;
  }

  #presentInteraction(pending) {
    if (pending.presentationTask) return pending.presentationTask;
    const question = pending.questions[pending.index];
    if (!question) return Promise.resolve();
    const task = (async () => {
      // A fresh nonce per presentation: a later question restarts its indexes at
      // zero, so without one an old card's keyboard would answer the new question.
      pending.cardNonce = randomUUID().slice(0, 8);
      const card = this.#interactionCardFor(pending, question);
      if (card) {
        try {
          const sent = await this.#bot.sendInteractionCard(pending.target, {
            text: card.text,
            markup: card.markup,
          });
          pending.cardMessageId = sent?.providerMessageIds?.at(-1) ?? null;
          pending.needsPresentation = false;
          return;
        } catch (error) {
          // A platform that refuses the keyboard must not lose the question:
          // fall through to the plain-text flow this channel already had.
          pending.cardMessageId = null;
          this.#logger.warn?.(
            `[dsh-im:${this.#descriptor.key}] could not deliver an interaction card; `
              + 'falling back to plain text:',
            error?.message ?? error,
          );
        }
      }
      await this.#bot.sendText(
        pending.target,
        harnessQuestionText(
          question,
          pending.index,
          pending.questions.length,
          { requiresMention: pending.requiresMention },
        ),
      );
      pending.needsPresentation = false;
    })();
    pending.presentationTask = task;
    task.then(
      () => {
        if (pending.presentationTask === task) pending.presentationTask = null;
      },
      () => {
        if (pending.presentationTask === task) pending.presentationTask = null;
      },
    );
    return task;
  }

  async #discardResolvedInteractionReply(message, messageId, {
    alreadyRecorded = false,
  } = {}) {
    if (!alreadyRecorded) {
      if (this.#state.hasSeen(messageId)) return;
      await this.#state.markSeen(messageId);
      this.#status.messagesReceived += 1;
      this.#status.lastMessageAt = new Date().toISOString();
    }
    try {
      await this.#bot.sendText(message.replyTarget, t(INTERACTION_RESOLVED_TEXT));
    } catch (error) {
      this.#logger.error?.(
        `[dsh-im:${this.#descriptor.key}] failed to send an expired interaction notice:`,
        error,
      );
    }
  }

  #takePendingInteraction(key, interactionId) {
    const pending = this.#pendingInteractions.get(key);
    if (!pending
      || (interactionId !== undefined && pending.interactionId !== interactionId)) return null;
    this.#pendingInteractions.delete(key);
    this.#interactionKeys.delete(pending.interactionId);
    return pending;
  }

  #clearPendingInteraction(key, interactionId) {
    return this.#takePendingInteraction(key, interactionId) !== null;
  }

  async #respondCancellation(interaction, message) {
    try {
      await interaction.respond({
        ok: false,
        error: { code: 'cancelled', message, details: {} },
      }, { signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      if (error?.code !== 'interaction-not-pending') throw error;
    }
  }

  async #cancelPendingInteraction(key) {
    const pending = this.#takePendingInteraction(key);
    if (!pending || pending.kind !== 'question') return;
    try {
      await this.#respondCancellation(
        pending.interaction,
        `The ${this.#descriptor.label} interaction ended before the user answered.`,
      );
    } catch (error) {
      this.#logger.warn?.(
        `[dsh-im:${this.#descriptor.key}] failed to cancel a pending Harness interaction:`,
        error,
      );
    }
  }
}
