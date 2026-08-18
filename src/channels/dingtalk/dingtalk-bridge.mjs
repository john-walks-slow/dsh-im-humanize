import {
  normalizeDingtalkSessionWebhook,
  splitDingtalkText,
} from './dingtalk-api.mjs';
import { createDingTalkCardStream } from './dingtalk-card-stream.mjs';
import {
  harnessAnswerForQuestion,
  harnessQuestionText,
  validHarnessQuestion,
} from '../shared/harness-question.mjs';
import { HarnessApprovalQueue } from '../shared/harness-approval.mjs';
import { runWorkspaceCommand } from '../shared/workspace-command.mjs';
import { askInWorkspaceSession } from '../shared/workspace-session.mjs';

const CARD_INITIAL_TEXT = '已连接 DeepSeek Harness，正在思考…';
const CARD_ERROR_TEXT = '消息处理失败，请稍后重试。';
const INTERACTION_RESOLVED_TEXT = '这个问题已在其他客户端处理，无需再次回答。';

const HELP_TEXT = [
  '钉钉机器人已连接 DeepSeek Harness。',
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

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function senderStaffId(message) {
  return nonEmptyString(message?.senderStaffId) ?? nonEmptyString(message?.senderId);
}

function conversationKey(message, sender) {
  if (String(message?.conversationType) === '2') {
    const conversationId = nonEmptyString(message?.conversationId);
    if (!conversationId) throw new Error('DingTalk group message has no conversation id');
    return `group:${conversationId}`;
  }
  return `p2p:${sender}`;
}

function cardTarget(message, sender) {
  if (String(message?.conversationType) === '2') {
    return { type: 'group', openConversationId: nonEmptyString(message?.conversationId) };
  }
  return { type: 'user', userId: sender };
}

function progressText(update) {
  if (update?.type === 'text' && nonEmptyString(update.text)) return update.text;
  if (update?.type === 'tool') {
    if (update.name === 'web_search') return '_正在搜索网络并整理信息…_';
    return `_正在使用 ${nonEmptyString(update.name) ?? '工具'}…_`;
  }
  return `_${nonEmptyString(update?.text) ?? '正在处理…'}_`;
}

function canClaimInteractionReply(message, pending, sender) {
  if (pending.needsPresentation || !pending.questions[pending.index]) return false;
  if (pending.actor !== sender) return false;
  if (String(message?.conversationType) === '2' && message?.isInAtList !== true) return false;
  if (message?.msgtype !== 'text' || !nonEmptyString(message?.text?.content)) return false;
  try {
    normalizeDingtalkSessionWebhook(message.sessionWebhook);
    return true;
  } catch {
    return false;
  }
}

function ensureStats(status) {
  status.stats ??= {};
  for (const key of ['messagesReceived', 'messagesReplied', 'messagesRejected', 'messagesIgnored']) {
    status[key] ??= 0;
    status.stats[key] = status[key];
  }
  status.pendingSenders ??= [];
}

function increment(status, key) {
  status[key] = (status[key] ?? 0) + 1;
  status.stats ??= {};
  status.stats[key] = status[key];
}

export function createDingtalkBridgeStatus({ pendingSenders = [] } = {}) {
  return {
    messagesReceived: 0,
    messagesReplied: 0,
    messagesRejected: 0,
    messagesIgnored: 0,
    lastMessageAt: null,
    lastReplyAt: null,
    lastRejectedAt: null,
    lastError: null,
    pendingSenders: structuredClone(pendingSenders),
    stats: {
      messagesReceived: 0,
      messagesReplied: 0,
      messagesRejected: 0,
      messagesIgnored: 0,
    },
  };
}

export class DingtalkHarnessBridge {
  #api;
  #clientId;
  #clientSecret;
  #harness;
  #state;
  #status;
  #logger;
  #replyTimeoutMs;
  #maxMessageChars;
  #signal;
  #queues = new Map();
  #pendingInteractions = new Map();
  #interactionKeys = new Map();
  #interactionTasks = new Set();
  #acceptedMessageIds = new Set();
  #approvals;

  constructor({
    api,
    clientId,
    clientSecret,
    harness,
    state,
    status = createDingtalkBridgeStatus(),
    logger = console,
    replyTimeoutMs = 600_000,
    maxMessageChars = 4_000,
    signal,
  }) {
    if (!api || typeof api.sendText !== 'function') throw new TypeError('DingTalk API is required');
    if (!nonEmptyString(clientId) || !nonEmptyString(clientSecret)) {
      throw new TypeError('DingTalk app credentials are required');
    }
    if (!harness || !state) throw new TypeError('Harness client and state store are required');
    this.#api = api;
    this.#clientId = clientId.trim();
    this.#clientSecret = clientSecret.trim();
    this.#harness = harness;
    this.#state = state;
    this.#status = status;
    this.#logger = logger;
    this.#approvals = new HarnessApprovalQueue({ label: 'DingTalk', logger });
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#maxMessageChars = maxMessageChars;
    this.#signal = signal;
    ensureStats(this.#status);
    this.#refreshPendingSenders();
  }

  get status() {
    this.#refreshPendingSenders();
    return structuredClone(this.#status);
  }

  accept(message) {
    if (this.#signal?.aborted) return Promise.resolve();
    const messageId = nonEmptyString(message?.msgId);
    const sender = senderStaffId(message);
    if (!messageId || !sender || this.#state.hasSeen(messageId)
      || this.#acceptedMessageIds.has(messageId)) return Promise.resolve();
    this.#acceptedMessageIds.add(messageId);

    let key;
    try {
      key = conversationKey(message, sender);
    } catch {
      this.#acceptedMessageIds.delete(messageId);
      increment(this.#status, 'messagesRejected');
      this.#status.lastRejectedAt = new Date().toISOString();
      return Promise.resolve();
    }

    let sessionWebhook = null;
    try {
      sessionWebhook = normalizeDingtalkSessionWebhook(message.sessionWebhook);
    } catch {
      // An unsafe reply route must never be able to submit an approval.
    }
    const pending = this.#pendingInteractions.get(key);
    const approvalReply = this.#approvals.claimReply({
      key,
      actor: sender,
      messageId,
      text: sessionWebhook && message?.msgtype === 'text'
        ? nonEmptyString(message?.text?.content) ?? ''
        : '',
      addressed: String(message?.conversationType) !== '2' || message?.isInAtList === true,
      hasPendingQuestion: Boolean(pending),
      questionCompletion: pending?.submitting || pending?.claimedReplyMessageId
        ? pending.queue
        : null,
      isQuestionPending: () => this.#pendingInteractions.has(key),
      send: sessionWebhook
        ? (reply) => this.#send(sessionWebhook, reply)
        : async () => undefined,
    });
    if (approvalReply) {
      let current;
      current = approvalReply.process(async () => {
          if (this.#state.hasSeen(messageId)) return false;
          await this.#state.markSeen(messageId);
          increment(this.#status, 'messagesReceived');
          this.#status.lastMessageAt = new Date().toISOString();
          if (!sessionWebhook) {
            increment(this.#status, 'messagesRejected');
            this.#status.lastRejectedAt = new Date().toISOString();
            this.#status.lastError = '钉钉消息没有安全的回复地址。';
          }
          return true;
        })
        .catch((error) => {
          if (this.#signal?.aborted) return;
          this.#status.lastError = '钉钉审批处理失败。';
          this.#logger.error?.('[dsh-dingtalk] failed to process an approval reply', error);
        })
        .finally(() => {
          this.#acceptedMessageIds.delete(messageId);
          this.#interactionTasks.delete(current);
        });
      this.#interactionTasks.add(current);
      return current;
    }

    if (pending && pending.actor !== sender) {
      return this.#enqueueMessage(message, messageId, sender, key);
    }
    // Once one valid answer has been claimed, later messages are subsequent
    // prompts even if the network submission eventually needs a retry. Invalid
    // replies do not claim the question, so the next valid answer can still
    // pass through this interaction queue.
    if (pending?.submitting || pending?.claimedReplyMessageId) {
      return this.#enqueueMessage(message, messageId, sender, key);
    }
    if (pending) {
      if (canClaimInteractionReply(message, pending, sender)) {
        pending.claimedReplyMessageId = messageId;
      }
      const previous = pending.queue ?? Promise.resolve();
      const current = previous
        .catch(() => undefined)
        .then(() => this.#processInteractionReply(message, messageId, sender, key, pending))
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
    return this.#enqueueMessage(message, messageId, sender, key);
  }

  #enqueueMessage(message, messageId, sender, key, {
    releaseMessageId = true,
    alreadyRecorded = false,
  } = {}) {
    const previous = this.#queues.get(key) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() => this.#process(message, messageId, sender, key, { alreadyRecorded }))
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
      ...this.#interactionTasks,
    ]);
  }

  async #process(message, messageId, sender, key, { alreadyRecorded = false } = {}) {
    this.#signal?.throwIfAborted();
    if (!alreadyRecorded) {
      if (this.#state.hasSeen(messageId)) return;
      await this.#state.markSeen(messageId);
      increment(this.#status, 'messagesReceived');
      this.#status.lastMessageAt = new Date().toISOString();
    }

    if (String(message.conversationType) === '2' && message.isInAtList !== true) {
      increment(this.#status, 'messagesIgnored');
      return;
    }

    let sessionWebhook;
    try {
      sessionWebhook = normalizeDingtalkSessionWebhook(message.sessionWebhook);
    } catch {
      increment(this.#status, 'messagesRejected');
      this.#status.lastRejectedAt = new Date().toISOString();
      this.#status.lastError = '钉钉消息没有安全的回复地址。';
      return;
    }

    const text = message?.msgtype === 'text' ? nonEmptyString(message?.text?.content) : null;
    let cardStream = null;
    let cardStarted = false;
    try {
      if (!text) {
        await this.#send(sessionWebhook, '目前仅支持文字消息。');
        return;
      }

      const command = text.toLowerCase();
      if (command === '/help') {
        await this.#send(sessionWebhook, HELP_TEXT);
        return;
      }
      if (command === '/status') {
        await this.#harness.ensureRunning({ signal: this.#signal });
        await this.#send(sessionWebhook, '钉钉机器人与 DeepSeek Harness 连接正常。');
        return;
      }
      if (command === '/new') {
        await this.#state.clearSession(key);
        await this.#send(sessionWebhook, '已开启新会话。请发送你的问题。');
        return;
      }
      const workspaceCommand = await runWorkspaceCommand(text, this.#harness, key);
      if (workspaceCommand) {
        for (const reply of workspaceCommand.messages ?? [workspaceCommand.message]) {
          await this.#send(sessionWebhook, reply);
        }
        return;
      }

      if (typeof this.#api.createAiCard === 'function'
        && typeof this.#api.updateAiCard === 'function'
        && typeof this.#api.finishAiCard === 'function') {
        cardStream = createDingTalkCardStream({
          api: this.#api,
          clientId: this.#clientId,
          clientSecret: this.#clientSecret,
          target: cardTarget(message, sender),
          signal: this.#signal,
          logger: this.#logger,
        });
        cardStarted = await cardStream.start(CARD_INITIAL_TEXT);
      }
      const { answer } = await askInWorkspaceSession({
        harness: this.#harness,
        state: this.#state,
        key,
        text,
        createOptions: { signal: this.#signal },
        existsOptions: { signal: this.#signal },
        askOptions: {
          timeoutMs: this.#replyTimeoutMs,
          signal: this.#signal,
          onUpdate: cardStarted
            ? (update) => cardStream.push(progressText(update))
            : undefined,
          onInteraction: (interaction) => this.#handleInteraction(interaction, {
            key,
            actor: sender,
            sessionWebhook,
            requiresMention: String(message.conversationType) === '2',
          }),
          onInteractionResolved: (resolution) => this.#handleInteractionResolved(resolution),
        },
      });
      const streamed = cardStarted && await cardStream.finish(answer);
      if (!streamed) await this.#send(sessionWebhook, answer);
      increment(this.#status, 'messagesReplied');
      this.#status.lastReplyAt = new Date().toISOString();
      this.#status.lastError = null;
    } catch {
      if (this.#signal?.aborted) return;
      this.#status.lastError = '钉钉消息处理失败。';
      this.#logger.error?.('[dsh-dingtalk] failed to process an inbound message');
      try {
        const streamed = cardStarted && await cardStream.finish(CARD_ERROR_TEXT);
        if (!streamed) await this.#send(sessionWebhook, CARD_ERROR_TEXT);
      } catch {
        this.#logger.error?.('[dsh-dingtalk] failed to send the safe error reply');
      }
    } finally {
      await this.#cancelPendingInteraction(key);
      await this.#approvals.closeRoute(key);
    }
  }

  async #processInteractionReply(message, messageId, sender, key, expected) {
    this.#signal?.throwIfAborted();
    const current = this.#pendingInteractions.get(key);
    const claimed = expected.claimedReplyMessageId === messageId;
    if (!current || current !== expected || current.submitting) {
      if (claimed && (!current || current !== expected)) {
        return this.#discardResolvedInteractionReply(message, messageId);
      }
      return this.#enqueueMessage(message, messageId, sender, key, { releaseMessageId: false });
    }
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    increment(this.#status, 'messagesReceived');
    this.#status.lastMessageAt = new Date().toISOString();

    if (String(message.conversationType) === '2' && message.isInAtList !== true) {
      increment(this.#status, 'messagesIgnored');
      return;
    }

    let sessionWebhook;
    try {
      sessionWebhook = normalizeDingtalkSessionWebhook(message.sessionWebhook);
    } catch {
      increment(this.#status, 'messagesRejected');
      this.#status.lastRejectedAt = new Date().toISOString();
      this.#status.lastError = '钉钉消息没有安全的回复地址。';
      return;
    }

    const text = message?.msgtype === 'text' ? nonEmptyString(message?.text?.content) : null;
    if (!text) {
      try {
        await this.#send(sessionWebhook, '请用文字回答当前问题。');
      } catch {
        this.#logger.error?.('[dsh-dingtalk] failed to reject a non-text interaction reply');
      }
      return;
    }

    const pending = this.#pendingInteractions.get(key);
    if (!pending || pending !== expected || pending.submitting) {
      if (claimed && (!pending || pending !== expected)) {
        try {
          await this.#send(sessionWebhook, INTERACTION_RESOLVED_TEXT);
        } catch {
          this.#logger.error?.('[dsh-dingtalk] failed to send an expired interaction notice');
        }
        return;
      }
      return this.#enqueueMessage(message, messageId, sender, key, {
        releaseMessageId: false,
        alreadyRecorded: true,
      });
    }
    pending.sessionWebhook = sessionWebhook;
    if (pending.needsPresentation) {
      try {
        await this.#presentInteraction(pending);
      } catch {
        this.#status.lastError = '钉钉交互问题发送失败。';
        this.#logger.error?.('[dsh-dingtalk] failed to retry an interaction question');
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
        this.#status.lastError = '钉钉交互问题发送失败。';
        this.#logger.error?.('[dsh-dingtalk] failed to send the next interaction question');
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
      if (this.#pendingInteractions.get(key) !== pending) return;
      if (error?.code === 'interaction-not-pending') {
        this.#clearPendingInteraction(key, pending.interactionId);
        try {
          await this.#send(sessionWebhook, INTERACTION_RESOLVED_TEXT);
        } catch {
          this.#logger.error?.('[dsh-dingtalk] failed to send an expired interaction notice');
        }
        return;
      }
      pending.submitting = false;
      pending.answers.pop();
      pending.index -= 1;
      this.#status.lastError = '回答提交失败。';
      this.#logger.error?.('[dsh-dingtalk] failed to answer a Harness interaction');
      try {
        await this.#send(sessionWebhook, '回答提交失败，请重新发送当前问题的答案。');
      } catch {
        this.#logger.error?.('[dsh-dingtalk] failed to send an interaction retry notice');
      }
    }
  }

  async #handleInteraction(interaction, {
    key,
    actor,
    sessionWebhook,
    requiresMention,
  }) {
    if (await this.#approvals.handleRequested(interaction, {
      key,
      actor,
      requiresMention,
      send: (text) => this.#send(sessionWebhook, text),
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
      this.#logger.warn?.('[dsh-dingtalk] ignored an invalid Harness question interaction');
      return;
    }

    if (interaction.recovered === true) {
      await interaction.respond({
        ok: false,
        error: {
          code: 'cancelled',
          message: 'DingTalk safely cancelled an interaction left by an earlier client.',
          details: {},
        },
      });
      try {
        await this.#send(sessionWebhook, '检测到这个 Session 中遗留的待回答问题，已安全取消并继续处理你刚才的消息。');
      } catch {
        this.#logger.error?.('[dsh-dingtalk] failed to send an interaction recovery notice');
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
      this.#logger.warn?.('[dsh-dingtalk] cancelled a second pending Harness question');
      await interaction.respond({
        ok: false,
        error: {
          code: 'cancelled',
          message: 'DingTalk is already handling another user interaction.',
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
      sessionWebhook,
      queue: null,
      claimedReplyMessageId: null,
      submitting: false,
      needsPresentation: true,
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
    this.#clearPendingInteraction(key, interactionId);
  }

  async #presentInteraction(pending) {
    const question = pending.questions[pending.index];
    if (!question) return;
    await this.#send(
      pending.sessionWebhook,
      harnessQuestionText(
        question,
        pending.index,
        pending.questions.length,
        { requiresMention: pending.requiresMention },
      ),
    );
    pending.needsPresentation = false;
  }

  async #discardResolvedInteractionReply(message, messageId) {
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    increment(this.#status, 'messagesReceived');
    this.#status.lastMessageAt = new Date().toISOString();
    let sessionWebhook;
    try {
      sessionWebhook = normalizeDingtalkSessionWebhook(message.sessionWebhook);
    } catch {
      increment(this.#status, 'messagesRejected');
      this.#status.lastRejectedAt = new Date().toISOString();
      return;
    }
    try {
      await this.#send(sessionWebhook, INTERACTION_RESOLVED_TEXT);
    } catch {
      this.#logger.error?.('[dsh-dingtalk] failed to send an expired interaction notice');
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

  async #cancelPendingInteraction(key) {
    const pending = this.#takePendingInteraction(key);
    if (!pending || pending.kind !== 'question') return;
    try {
      await pending.interaction.respond({
        ok: false,
        error: {
          code: 'cancelled',
          message: 'The DingTalk interaction ended before the user answered.',
          details: {},
        },
      }, { signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      if (error?.code !== 'interaction-not-pending') {
        this.#logger.warn?.('[dsh-dingtalk] failed to cancel a pending Harness interaction');
      }
    }
  }

  #refreshPendingSenders() {
    if (typeof this.#state.pendingSenders === 'function') {
      this.#status.pendingSenders = this.#state.pendingSenders();
    }
  }

  async #send(sessionWebhook, text) {
    for (const chunk of splitDingtalkText(text, this.#maxMessageChars)) {
      this.#signal?.throwIfAborted();
      await this.#api.sendText({
        clientId: this.#clientId,
        clientSecret: this.#clientSecret,
        sessionWebhook,
        text: chunk,
        signal: this.#signal,
      });
    }
  }
}

export const DingTalkHarnessBridge = DingtalkHarnessBridge;
export const createDingTalkBridgeStatus = createDingtalkBridgeStatus;
