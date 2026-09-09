import { createDeferredDeliveryCoordinator, deferredOutcomeText } from './deferred-delivery-coordinator.mjs';
import { t } from './i18n.mjs';
import {
  COMMAND_PERMISSION_DENIED_MESSAGE,
  evaluateInboundAccess,
} from './inbound-access.mjs';
import { captureContextEnhancement, enhanceContextContent } from './context-enhancement.mjs';
import { runWorkspaceCommand } from './workspace-command.mjs';
import { runCompactCommand } from './compact-command.mjs';
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
import { deliverOutboundArtifacts } from './semantic/artifact-delivery.mjs';
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
  channelDeliveryFailure,
  clearLastMessageFailure,
  messageFailureText,
  setLastMessageFailure,
} from './message-failure.mjs';
import { beginStatusReaction } from './status-reaction.mjs';
import { createMessageBreakHandler } from './message-break.mjs';
import {
  fireAndForgetStop,
  normalizeOnNewMessage,
  resolveNewMessagePolicy,
  trySteer,
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

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function canClaimInteractionReply(message, pending, senderId) {
  return pending.actor === senderId
    && (message.kind !== 'group' || message.addressed === true)
    && !hasInboundImages(message)
    && !hasInboundFiles(message)
    && Boolean(cleanText(message.content));
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

export class TextHarnessBridge {
  #descriptor;
  #bot;
  #harness;
  #state;
  #deferred;
  #contextEnhancement;
  #accessPolicy;
  #status;
  #logger;
  #replyTimeoutMs;
  #signal;
  #queues = new Map();
  #pendingInteractions = new Map();
  #interactionKeys = new Map();
  // Keep the accepted configuration through the existing queue/reply lifecycle.
  #acceptedMessageIds = new Map();
  #approvalTasks = new Set();
  #commandTasks = new Set();
  #approvals;
  #batches = new BatchInputManager();
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
    status = createTextBridgeStatus(),
    logger = console,
    replyTimeoutMs = 600_000,
    signal,
    streaming = true,
    messageBreak = false,
    onNewMessage = 'interrupt',
    humanize = null,
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
    this.#status = status;
    this.#logger = logger;
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#signal = signal;
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

  accept(message, { contextSnapshot, accessDecision } = {}) {
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
        text: normalized.content,
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

    const processing = this.#acceptAcceptedMessage(normalized, messageId, senderId);
    void processing.then(
      () => statusReaction.success(),
      () => statusReaction.error(),
    );
    return processing;
  }

  #acceptAcceptedMessage(normalized, messageId, senderId) {
    if (normalized.kind === 'direct') {
      rememberConnectionTestTarget(
        this.#state,
        normalized.connectionTestTarget ?? normalized.replyTarget,
      );
    }

    const key = `${normalized.kind}:${normalized.conversationId}`;
    const pending = this.#pendingInteractions.get(key);
    const text = cleanText(normalized.content);
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
            batchSubmission: { token: batch.token },
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
    const commandRunner = collectingBatch ? null : isHistoryCommand(text) ? runHistoryCommand
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
      text: hasInboundImages(normalized) || hasInboundFiles(normalized) ? '' : normalized.content,
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
    // onNewMessage policy: decide how to handle a new message when a turn is
    // already active. Pending interactions/approvals are already handled above
    // (always queue), so here we only apply the policy when there's an active
    // queue and no pending interaction.
    const policy = resolveNewMessagePolicy({
      hasQueue: this.#queues.has(key),
      hasPendingInteraction: this.#pendingInteractions.has(key),
      hasPendingApproval: this.#approvals.hasPending(key),
      onNewMessage: this.#humanizeSettings().onNewMessage,
    });
    if (policy === 'interrupt') {
      return this.#interruptAndResend(normalized, messageId, senderId, key);
    }
    if (policy === 'steer') {
      return this.#steerOrEnqueue(normalized, messageId, senderId, key);
    }
    return this.#enqueueMessage(normalized, messageId, senderId, key);
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
        error,
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
      logger: this.#logger,
    });
    return current;
  }

  /**
   * steer: inject the new message's text as a steering instruction into the
   * current turn via steerActiveTurn. If the turn has already ended or steer
   * fails (non-text message, etc.), fall back to enqueuing as a new turn.
   */
  async #steerOrEnqueue(message, messageId, senderId, key) {
    const text = cleanText(message.content);
    // steer only supports plain text; images/files fall back to queue.
    if (!text || hasInboundImages(message) || hasInboundFiles(message)) {
      return this.#enqueueMessage(message, messageId, senderId, key);
    }
    const steered = await trySteer({
      session: this.#boundSession(key),
      text,
      control: { owner: this, key },
      signal: this.#signal,
      logger: this.#logger,
    });
    if (steered) {
      // Message consumed as a steering instruction — no new turn needed.
      if (this.#state.hasSeen(messageId)) return;
      await this.#state.markSeen(messageId);
      this.#status.messagesReceived += 1;
      this.#status.lastMessageAt = new Date().toISOString();
      return;
    }
    // Turn ended or steer failed — process as a new message.
    return this.#enqueueMessage(message, messageId, senderId, key);
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

  async #processFastCommand(message, messageId, key, runner) {
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.messagesReceived += 1;
    this.#status.lastMessageAt = new Date().toISOString();
    const target = message.replyTarget;
    try {
      const result = await runner(
        cleanText(message.content),
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
        error,
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
    const text = cleanText(message.content);
    const batchSubmission = message.batchSubmission;
    let stream = null;
    let semanticStream = false;
    let typingSession = null;
    let content;
    let contextEnhanced = false;
    let streamFinished = false;
    let firstStreamReplySent = false;
    let preAsk = null;
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
          t('/new  开启一个全新会话'),
          t('/compact  压缩当前会话的较早上下文'),
          t('/history [数量]  查看最近历史消息（默认 3 条，最多 5 条）'),
          t('/workspace 工作区序号或绝对路径  切换工作区'),
          t('/workspacelist  列出工作区绝对路径'),
          t('/ws、/wsl、/workspaces  工作区命令别名'),
          t('/sessionlist 或 /sessions [工作区序号或绝对路径]  列出会话 ID 和标题'),
          t('/sessionlist --limit N  仅列出当前工作区前 N 个会话'),
          t('/session Session ID 或当前工作区序号  将当前聊天绑定到指定会话'),
          t('/models  按序号列出所有可用模型'),
          t('/reasoninglist 或 /reasonings  按序号列出当前模型可用推理等级'),
          t('/reasoning [序号、等级ID或 --default]  查看或切换当前推理等级'),
          t('/model [序号或完整模型ID] [推理等级ID]  查看或切换当前会话模型'),
          t('示例：先发 /models，再发 /model 2 [推理等级ID]'),
          t('/presetlist 或 /presets  按序号列出可用 Agent Preset'),
          t('/preset [序号或完整ID]  查看或设置当前机器人 Agent Preset'),
          t('纯数字 ID：/preset id:<ID>'),
          t('/preset --default  跟随 Host 默认'),
          t('/stop  停止当前任务'),
          t('/steer 补充指令  纠偏当前任务'),
          t('/batch  开始批量输入（仅私聊，最多 10 条文字）'),
          t('/send  提交当前批次'),
          t('/cancel  取消当前批次'),
          t('/status  检查连接状态'),
          t('/version  查看插件版本'),
          t('/help  显示本帮助'),
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
        // Streaming is skipped when streaming=false or messageBreak=true
        // (mutually exclusive). Without streaming, the reply is delivered as a
        // single complete message at the end via sendDelivery/sendText.
        // Stream opening stays inside the pre-ask region so a supersede
        // abort still wins against it.
        if (humanize.streaming) {
          if (typeof this.#bot.openDeliveryStream === 'function') {
            try {
              stream = await this.#bot.openDeliveryStream(target);
              semanticStream = true;
            } catch (error) {
              this.#logger.warn?.(
                `[dsh-im:${this.#descriptor.key}] unable to start a semantic reply stream; using final delivery:`,
                error,
              );
            }
          } else if (typeof this.#bot.openStream === 'function') {
            try {
              stream = await this.#bot.openStream(target);
            } catch (error) {
              this.#logger.warn?.(
                `[dsh-im:${this.#descriptor.key}] unable to start a streamed reply; using text:`,
                error,
              );
            }
          }
        }
        if (preAsk.signal.aborted) {
          const superseded = new Error('superseded by a newer message');
          superseded.code = 'superseded';
          throw superseded;
        }
        // Image staging is the last pre-ask step.
        content = hasImages || hasReply
          ? await promptContentForInboundMessage(message, { signal: preAskSignal })
          : undefined;
      } finally {
        if (this.#preAskControllers.get(conversationKey) === preAsk) {
          this.#preAskControllers.delete(conversationKey);
        }
      }
      // Create a message_break handler for this turn. sendSegment sends each
      // segment as a separate IM message. Only active when messageBreak=true.
      // Phase-② segment gap: "typing the next message" — every segment after
      // the first waits a humanized pause; the typing session keeps glowing
      // through the gap and restarts its on-phase after each send.
      let segmentsSent = 0;
      const messageBreakHandler = humanize.messageBreak
        ? createMessageBreakHandler({
          sendSegment: async (segmentText) => {
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
      const { answer, artifacts = [] } = await askInWorkspaceSession({
        deferredDelivery: () => ({ coordinator: this.#deferred, target: this.#descriptor.key === 'whatsapp' ? { jid: target.jid, selfChat: target.selfChat } : target }),
        harness: this.#harness,
        state: this.#state,
        key: conversationKey,
        text,
        content,
        contextEnhanced,
        createOptions: this.#signal ? { signal: this.#signal } : undefined,
        existsOptions: this.#signal ? { signal: this.#signal } : undefined,
        askOptions: {
          timeoutMs: this.#replyTimeoutMs,
          signal: this.#signal,
          control: { owner: this, key: conversationKey },
          onUpdate: (stream || messageBreakHandler) ? async (update) => {
            // message_break handler intercepts break updates and sends the
            // segment text as a separate IM message. Returns null when
            // consumed (the update is not passed to the stream handler).
            if (messageBreakHandler) {
              const handled = await messageBreakHandler.handleUpdate(update);
              if (handled === null) return;
              update = handled;
            }
            if (!stream) return;
            const progress = update.type === 'text' ? update.text
              : update.type === 'tool' ? t('正在使用{name}…', { name: update.name }) : update.text;
            if (progress) {
              const format = update.type === 'text' ? 'markdown' : 'plain';
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
          onInteraction: (interaction) => this.#handleInteraction(interaction, {
            key: conversationKey,
            actor: senderId,
            target,
            requiresMention: message.kind === 'group' && message.requiresMention !== false,
            typingSession,
          }),
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
        },
      });
      if (batchSubmission) {
        this.#batches.complete(conversationKey, batchSubmission.token);
      }
      const fileOnlyCompletion = !cleanText(answer) && artifacts.length > 0;
      // When message_break was used, the segments before each break were
      // already sent as separate messages. The final message is only the
      // remaining text after the last break point.
      const baseAnswer = fileOnlyCompletion
        ? t(FILE_ONLY_COMPLETION_TEXT)
        : answer;
      const visibleAnswer = messageBreakHandler?.hasBreaks()
        ? messageBreakHandler.remainingText(baseAnswer)
        : baseAnswer;
      const answerFormat = fileOnlyCompletion ? 'plain' : 'markdown';
      let textDeliveryError = null;
      let textReceipt = null;
      if (stream) {
        try {
          const result = await stream.finish(semanticStream
            ? createTextDeliveryBlock(visibleAnswer, answerFormat)
            : visibleAnswer);
          streamFinished = true;
          textReceipt = createDeliveryReceipt({
            deliveryId: messageId,
            presentation: result?.presentation
              ?? stream.presentation
              ?? `${this.#descriptor.key}-stream`,
            providerMessageIds: [
              ...providerMessageIdsFor(stream),
              ...providerMessageIdsFor(result),
            ],
            deliveryOutcome: result?.deliveryOutcome,
            reason: result?.reason,
          });
        } catch (error) {
          stream.cancel?.();
          this.#logger.warn?.(
            `[dsh-im:${this.#descriptor.key}] streamed reply finalization failed; using text:`,
            error,
          );
        }
      }
      if (!streamFinished) {
        // When message_break sent all text as segments, the remaining answer
        // may be empty — skip sending an empty final message.
        if (messageBreakHandler?.hasBreaks() && !cleanText(visibleAnswer)) {
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
              providerMessageIds: providerMessageIdsFor(result),
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
          new Error(`Final text delivery failed (${textReceipt.reason ?? 'unknown'})`),
          { uncertain: false },
        );
      } else if (finalDeliveryUnknown) {
        textDeliveryError = channelDeliveryFailure(
          new Error(`Final text delivery outcome is unknown (${textReceipt.reason ?? 'unknown'})`),
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
          const action = typeof item?.mediaType === 'string' && item.mediaType.startsWith('image/')
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
      return delivery.receipt;
    } catch (error) {
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
        error,
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
      return error.deliveryReceipt;
    } finally {
      // Phase-② lifecycle: the typing session is bound to the turn, not to
      // any specific send — /stop, errors and no-send endings all land here
      // and never leave a composing indicator behind.
      typingSession?.stop();
      this.#turnEnds.set(conversationKey, Date.now());
      await Promise.allSettled([
        this.#cancelPendingInteraction(conversationKey),
        this.#approvals.closeRoute(conversationKey),
      ]);
    }
  }

  async #processInteractionReply(message, messageId, senderId, key, expected) {
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
    const text = cleanText(message.content);
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
    pending.answers.push(harnessAnswerForQuestion(question, text));
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

  #presentInteraction(pending) {
    if (pending.presentationTask) return pending.presentationTask;
    const question = pending.questions[pending.index];
    if (!question) return Promise.resolve();
    const task = (async () => {
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
