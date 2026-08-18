import { runWorkspaceCommand } from '../shared/workspace-command.mjs';
import {
  harnessAnswerForQuestion,
  harnessQuestionText,
  validHarnessQuestion,
} from '../shared/harness-question.mjs';
import { HarnessApprovalQueue } from '../shared/harness-approval.mjs';
import { askInWorkspaceSession } from '../shared/workspace-session.mjs';

const INTERACTION_RESOLVED_TEXT = '这个问题已在其他客户端处理，无需再次回答。';

const HELP_TEXT = [
  'QQ 机器人已连接 DeepSeek Harness。',
  '',
  '直接发送文字即可继续当前会话。',
  '/new  开启一个全新会话',
  '/workspace 工作区绝对路径  切换工作区',
  '/workspacelist  列出工作区绝对路径',
  '/sessionlist [工作区序号或绝对路径]  列出会话 ID 和标题',
  '/session Session ID  将当前聊天绑定到指定会话',
  '/status  检查连接状态',
  '/help  显示本帮助',
].join('\n');

function conversationKey(message) {
  return `${message.kind}:${message.kind === 'group' ? message.groupOpenid : message.senderId}`;
}

function safeText(message) {
  return typeof message?.content === 'string' ? message.content.trim() : '';
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function canClaimInteractionReply(message, pending) {
  return pending.questions[pending.index]
    && nonEmptyString(message?.senderId) === pending.actor
    && (message.kind !== 'group' || message.rawEventType === 'GROUP_AT_MESSAGE_CREATE')
    && nonEmptyString(safeText(message));
}

export function createQqBridgeStatus() {
  return {
    messagesReceived: 0,
    messagesReplied: 0,
    messagesRejected: 0,
    lastMessageAt: null,
    lastReplyAt: null,
    lastRejectedAt: null,
    lastError: null,
  };
}

export class QqHarnessBridge {
  #bot;
  #ownerUserOpenid;
  #harness;
  #state;
  #status;
  #logger;
  #replyTimeoutMs;
  #signal;
  #queues = new Map();
  #pendingInteractions = new Map();
  #interactionKeys = new Map();
  #acceptedMessageIds = new Set();
  #approvalTasks = new Set();
  #approvals;

  constructor({
    bot,
    ownerUserOpenid,
    harness,
    state,
    status = createQqBridgeStatus(),
    logger = console,
    replyTimeoutMs = 600_000,
    signal,
  }) {
    if (!bot || typeof bot.sendText !== 'function') throw new TypeError('QQ bot client is required');
    if (!ownerUserOpenid) throw new TypeError('QQ scanner identity is required');
    if (!harness || !state) throw new TypeError('Harness client and state store are required');
    this.#bot = bot;
    this.#ownerUserOpenid = ownerUserOpenid;
    this.#harness = harness;
    this.#state = state;
    this.#status = status;
    this.#logger = logger;
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#signal = signal;
    this.#approvals = new HarnessApprovalQueue({ label: 'qq', logger });
  }

  get status() {
    return structuredClone(this.#status);
  }

  accept(message) {
    if (this.#signal?.aborted) return Promise.resolve();
    const messageId = nonEmptyString(message?.messageId);
    const sender = nonEmptyString(message?.senderId);
    if (!messageId || !sender || message?.senderIsBot === true
      || !['c2c', 'group'].includes(message?.kind)
      || this.#state.hasSeen(messageId)
      || this.#acceptedMessageIds.has(messageId)) return Promise.resolve();
    const key = conversationKey(message);
    this.#acceptedMessageIds.add(messageId);
    const pending = this.#pendingInteractions.get(key);
    const approval = this.#approvals.claimReply({
      key,
      actor: sender,
      messageId,
      text: safeText(message),
      addressed: message.kind !== 'group' || message.rawEventType === 'GROUP_AT_MESSAGE_CREATE',
      hasPendingQuestion: Boolean(pending),
      questionCompletion: pending?.submitting || pending?.claimedReplyMessageId
        ? pending.queue
        : null,
      isQuestionPending: () => this.#pendingInteractions.has(key),
      send: (text) => this.#bot.sendText(message.replyTarget, text),
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
    if (pending && sender !== pending.actor) {
      return this.#enqueueMessage(message, messageId, key);
    }
    if (pending?.submitting || pending?.claimedReplyMessageId) {
      return this.#enqueueMessage(message, messageId, key);
    }
    if (pending) {
      if (canClaimInteractionReply(message, pending)) {
        pending.claimedReplyMessageId = messageId;
      }
      const previous = pending.queue ?? Promise.resolve();
      const current = previous
        .catch(() => undefined)
        .then(() => this.#processInteractionReply(message, messageId, key, pending))
        .catch((error) => this.#handleInteractionFailure(message, messageId, error))
        .finally(() => {
          this.#acceptedMessageIds.delete(messageId);
          if (pending.claimedReplyMessageId === messageId) pending.claimedReplyMessageId = null;
          if (pending.queue === current) pending.queue = null;
        });
      pending.queue = current;
      return current;
    }
    return this.#enqueueMessage(message, messageId, key);
  }

  #enqueueMessage(message, messageId, key, {
    releaseMessageId = true,
    alreadyRecorded = false,
  } = {}) {
    const previous = this.#queues.get(key) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() => this.#process(message, key, { alreadyRecorded }))
      .finally(() => {
        if (releaseMessageId) this.#acceptedMessageIds.delete(messageId);
        if (this.#queues.get(key) === current) this.#queues.delete(key);
      });
    this.#queues.set(key, current);
    return current;
  }

  async waitForIdle() {
    await Promise.allSettled([
      ...this.#queues.values(),
      ...[...this.#pendingInteractions.values()].flatMap((pending) => (
        pending.queue ? [pending.queue] : []
      )),
      ...this.#approvalTasks,
    ]);
  }

  async #process(message, key, { alreadyRecorded = false } = {}) {
    if (this.#signal?.aborted) return;
    const messageId = nonEmptyString(message?.messageId);
    const sender = nonEmptyString(message?.senderId);
    if (!messageId || !sender || message.senderIsBot === true) return;
    if (!['c2c', 'group'].includes(message.kind)) return;
    if (!alreadyRecorded) {
      if (this.#state.hasSeen(messageId)) return;
      this.#status.messagesReceived += 1;
      this.#status.lastMessageAt = new Date().toISOString();
    }
    if (this.#ownerUserOpenid !== '*' && sender !== this.#ownerUserOpenid) {
      this.#status.messagesRejected += 1;
      this.#status.lastRejectedAt = new Date().toISOString();
      return;
    }
    if (message.kind === 'group' && message.rawEventType !== 'GROUP_AT_MESSAGE_CREATE') return;

    const target = message.replyTarget;
    const text = safeText(message);
    try {
      if (!text) {
        await this.#bot.sendText(target, '目前仅支持文字消息。');
        await this.#state.markSeen(messageId);
        return;
      }
      const command = text.toLowerCase();
      if (command === '/help') {
        await this.#bot.sendText(target, HELP_TEXT);
        await this.#state.markSeen(messageId);
        return;
      }
      if (command === '/status') {
        await this.#harness.ensureRunning({ signal: this.#signal });
        await this.#bot.sendText(target, 'QQ 机器人与 DeepSeek Harness 连接正常。');
        await this.#state.markSeen(messageId);
        return;
      }
      if (command === '/new') {
        await this.#state.clearSession(key);
        await this.#bot.sendText(target, '已开启新会话。请发送你的问题。');
        await this.#state.markSeen(messageId);
        return;
      }
      const workspaceCommand = await runWorkspaceCommand(text, this.#harness, key);
      if (workspaceCommand) {
        for (const reply of workspaceCommand.messages ?? [workspaceCommand.message]) {
          await this.#bot.sendText(target, reply);
        }
        await this.#state.markSeen(messageId);
        return;
      }

      let stream = null;
      let streamFinished = false;
      if (message.kind === 'c2c' && target?.msgId && typeof this.#bot.openStream === 'function') {
        try {
          stream = this.#bot.openStream({ target });
        } catch (error) {
          this.#logger.warn?.('[dsh-im:qq] unable to start a QQ stream; using a text reply:', error);
        }
      }
      let answer;
      try {
        ({ answer } = await askInWorkspaceSession({
          harness: this.#harness,
          state: this.#state,
          key,
          text,
          createOptions: { signal: this.#signal },
          existsOptions: { signal: this.#signal },
          askOptions: {
            timeoutMs: this.#replyTimeoutMs,
            signal: this.#signal,
            onUpdate: stream ? async (update) => {
              const progress = update.type === 'text'
                ? update.text
                : update.type === 'tool'
                  ? `正在使用${update.name}…`
                  : update.text;
              if (progress) await stream.update(progress);
            } : undefined,
            onInteraction: (interaction) => this.#handleInteraction(interaction, {
              key,
              actor: sender,
              target,
              requiresMention: message.kind === 'group',
            }),
            onInteractionResolved: (resolution) => this.#handleInteractionResolved(resolution),
          },
        }));
      } finally {
        await Promise.allSettled([
          this.#cancelPendingInteraction(key),
          this.#approvals.closeRoute(key),
        ]);
      }
      if (stream) {
        try {
          await stream.update(answer);
          await stream.complete();
          streamFinished = true;
        } catch (error) {
          stream.cancel?.();
          this.#logger.warn?.('[dsh-im:qq] QQ stream finalization failed; using a text reply:', error);
        }
      }
      if (!streamFinished) await this.#bot.sendText(target, answer);
      await this.#state.markSeen(messageId);
      this.#status.messagesReplied += 1;
      this.#status.lastReplyAt = new Date().toISOString();
      this.#status.lastError = null;
    } catch (error) {
      if (this.#signal?.aborted) return;
      this.#status.lastError = error?.message ?? String(error);
      this.#logger.error?.('[dsh-im:qq] failed to process an inbound message:', error);
      try {
        await this.#bot.sendText(target, '消息处理失败，请稍后重试。');
        await this.#state.markSeen(messageId);
      } catch (sendError) {
        this.#logger.error?.('[dsh-im:qq] failed to send the safe error reply:', sendError);
      }
    }
  }

  async #processInteractionReply(message, messageId, key, expected) {
    this.#signal?.throwIfAborted();
    const current = this.#pendingInteractions.get(key);
    const claimed = expected.claimedReplyMessageId === messageId;
    if (!current || current !== expected || current.submitting) {
      if (claimed && (!current || current !== expected)) {
        return this.#discardResolvedInteractionReply(message, messageId);
      }
      return this.#enqueueMessage(message, messageId, key, { releaseMessageId: false });
    }
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.messagesReceived += 1;
    this.#status.lastMessageAt = new Date().toISOString();

    if (message.kind === 'group' && message.rawEventType !== 'GROUP_AT_MESSAGE_CREATE') return;
    const text = nonEmptyString(safeText(message));
    if (!text) {
      await this.#bot.sendText(message.replyTarget, '请用文字回答当前问题。');
      return;
    }

    const pending = this.#pendingInteractions.get(key);
    if (!pending || pending !== expected || pending.submitting) {
      if (claimed && (!pending || pending !== expected)) {
        await this.#bot.sendText(message.replyTarget, INTERACTION_RESOLVED_TEXT);
        return;
      }
      return this.#enqueueMessage(message, messageId, key, {
        releaseMessageId: false,
        alreadyRecorded: true,
      });
    }
    pending.target = message.replyTarget;
    if (pending.needsPresentation) {
      try {
        await this.#presentInteraction(pending);
      } catch {
        this.#status.lastError = 'QQ 交互问题发送失败。';
        this.#logger.error?.('[dsh-im:qq] failed to retry an interaction question');
        pending.interaction.reconnect?.();
        return;
      }
      const presentedPending = this.#pendingInteractions.get(key);
      if (!presentedPending || presentedPending !== expected || presentedPending.submitting) {
        if (claimed && (!presentedPending || presentedPending !== expected)) {
          await this.#bot.sendText(message.replyTarget, INTERACTION_RESOLVED_TEXT)
            .catch(() => undefined);
          return;
        }
        return this.#enqueueMessage(message, messageId, key, {
          releaseMessageId: false,
          alreadyRecorded: true,
        });
      }
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
        this.#status.lastError = 'QQ 交互问题发送失败。';
        this.#logger.error?.('[dsh-im:qq] failed to send the next interaction question');
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
      if (this.#signal?.aborted) return;
      if (error?.code === 'interaction-not-pending') {
        this.#clearPendingInteraction(key, pending.interactionId);
        await this.#bot.sendText(pending.target, INTERACTION_RESOLVED_TEXT).catch(() => undefined);
        return;
      }
      if (this.#pendingInteractions.get(key) !== pending) return;
      pending.submitting = false;
      pending.answers.pop();
      pending.index -= 1;
      this.#status.lastError = '回答提交失败。';
      this.#logger.error?.('[dsh-im:qq] failed to answer a Harness interaction');
      await this.#bot.sendText(pending.target, '回答提交失败，请重新发送当前问题的答案。')
        .catch(() => undefined);
    }
  }

  async #handleInteraction(interaction, {
    key,
    actor,
    target,
    requiresMention,
  }) {
    if (interaction?.kind === 'approval') {
      return this.#approvals.handleRequested(interaction, {
        key,
        actor,
        requiresMention,
        send: (text) => this.#bot.sendText(target, text),
      });
    }
    if (interaction?.kind !== 'question') return;
    const questions = interaction?.payload?.questions;
    const interactionId = typeof interaction?.interactionId === 'string'
      ? interaction.interactionId
      : interaction?.rpcId;
    if (typeof interaction?.rpcId !== 'string'
      || typeof interactionId !== 'string'
      || typeof interaction.sessionId !== 'string'
      || !Array.isArray(questions)
      || questions.length === 0
      || questions.some((question) => !validHarnessQuestion(question))) {
      this.#logger.warn?.('[dsh-im:qq] ignored an invalid Harness question interaction');
      return;
    }

    if (interaction.recovered === true) {
      await interaction.respond({
        ok: false,
        error: {
          code: 'cancelled',
          message: 'QQ safely cancelled an interaction left by an earlier client.',
          details: {},
        },
      });
      await this.#bot.sendText(
        target,
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
          message: 'QQ is already handling another user interaction.',
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
      actor,
      requiresMention,
      questions,
      answers: [],
      index: 0,
      target,
      queue: null,
      claimedReplyMessageId: null,
      presentationPromise: null,
      submitting: false,
      needsPresentation: true,
    };
    this.#pendingInteractions.set(key, pending);
    this.#interactionKeys.set(interactionId, key);
    await this.#presentInteraction(pending);
  }

  async #handleInteractionResolved(resolution) {
    if (resolution?.kind === 'approval') {
      await this.#approvals.handleResolved(resolution);
      return;
    }
    const interactionId = resolution?.interactionId;
    if (resolution?.kind !== 'question' || typeof interactionId !== 'string') return;
    const key = this.#interactionKeys.get(interactionId);
    if (!key) return;
    this.#clearPendingInteraction(key, interactionId);
  }

  #presentInteraction(pending) {
    if (!pending.needsPresentation) return Promise.resolve();
    if (pending.presentationPromise) return pending.presentationPromise;
    const question = pending.questions[pending.index];
    if (!question) return Promise.resolve();
    const presentation = this.#bot.sendText(
      pending.target,
      harnessQuestionText(
        question,
        pending.index,
        pending.questions.length,
        { requiresMention: pending.requiresMention },
      ),
    ).then(() => {
      pending.needsPresentation = false;
    }).finally(() => {
      if (pending.presentationPromise === presentation) pending.presentationPromise = null;
    });
    pending.presentationPromise = presentation;
    return presentation;
  }

  async #discardResolvedInteractionReply(message, messageId) {
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.messagesReceived += 1;
    this.#status.lastMessageAt = new Date().toISOString();
    await this.#bot.sendText(message.replyTarget, INTERACTION_RESOLVED_TEXT).catch(() => undefined);
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

  async #cancelPendingInteraction(key) {
    const pending = this.#takePendingInteraction(key);
    if (!pending || pending.kind !== 'question') return;
    try {
      await pending.interaction.respond({
        ok: false,
        error: {
          code: 'cancelled',
          message: 'The QQ interaction ended before the user answered.',
          details: {},
        },
      }, { signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      if (error?.code !== 'interaction-not-pending') {
        this.#logger.warn?.('[dsh-im:qq] failed to cancel a pending Harness interaction');
      }
    }
  }

  async #handleInteractionFailure(message, messageId, error) {
    if (this.#signal?.aborted) return;
    this.#status.lastError = error?.message ?? String(error);
    this.#logger.error?.('[dsh-im:qq] failed to process an interaction reply:', error);
    if (!this.#state.hasSeen(messageId)) {
      await this.#state.markSeen(messageId).catch(() => undefined);
    }
    await this.#bot.sendText(message.replyTarget, '消息处理失败，请稍后重试。')
      .catch(() => undefined);
  }
}
