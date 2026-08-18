import { generateReqId } from '@wecom/aibot-node-sdk';
import {
  harnessAnswerForQuestion,
  harnessQuestionText,
  validHarnessQuestion,
} from '../shared/harness-question.mjs';
import { HarnessApprovalQueue } from '../shared/harness-approval.mjs';
import { runWorkspaceCommand } from '../shared/workspace-command.mjs';
import { askInWorkspaceSession } from '../shared/workspace-session.mjs';

const HELP_TEXT = [
  '企业微信机器人已连接 DeepSeek Harness。',
  '',
  '直接发送文字即可继续当前会话。',
  '/new  开启一个全新会话',
  '/workspace 工作区绝对路径  切换工作区',
  '/workspacelist  列出工作区绝对路径',
  '/sessionlist [工作区序号或绝对路径]  列出会话 ID 和标题',
  '/session Session ID 或当前工作区序号  将当前聊天绑定到指定会话',
  '/status  检查连接状态',
  '/help  显示本帮助',
].join('\n');
const MAX_REPLY_BYTES = 18_000;
const INTERACTION_RESOLVED_TEXT = '这个问题已在其他客户端处理，无需再次回答。';

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function bodyOf(frame) {
  return frame?.body && typeof frame.body === 'object' ? frame.body : {};
}

function conversationKey(frame) {
  const body = bodyOf(frame);
  return body.chattype === 'group' ? `group:${body.chatid}` : `direct:${body.from?.userid}`;
}

function messageText(frame) {
  const body = bodyOf(frame);
  let text = '';
  if (body.msgtype === 'text') {
    text = typeof body.text?.content === 'string' ? body.text.content.trim() : '';
  } else if (body.msgtype === 'voice') {
    text = typeof body.voice?.content === 'string' ? body.voice.content.trim() : '';
  } else if (body.msgtype === 'mixed' && Array.isArray(body.mixed?.msg_item)) {
    text = body.mixed.msg_item
      .filter((item) => item?.msgtype === 'text' && typeof item.text?.content === 'string')
      .map((item) => item.text.content)
      .join('\n')
      .trim();
  }
  // Group callbacks retain the leading @bot mention that caused delivery.
  // It is routing metadata rather than part of the user's prompt or answer.
  return body.chattype === 'group'
    ? text.replace(/^\s*@\S+(?:\s+|$)/u, '').trim()
    : text;
}

function splitUtf8(text, maxBytes = MAX_REPLY_BYTES) {
  const source = String(text ?? '').trim();
  if (!source) return [];
  const chunks = [];
  let current = '';
  let bytes = 0;
  for (const character of source) {
    const size = Buffer.byteLength(character);
    if (current && bytes + size > maxBytes) {
      chunks.push(current);
      current = character;
      bytes = size;
    } else {
      current += character;
      bytes += size;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function progressText(update) {
  if (update?.type === 'text') return update.text;
  if (update?.type === 'tool') return `正在使用${update.name}…`;
  return update?.text;
}

function canClaimInteractionReply(frame, pending) {
  return pending.questions[pending.index]
    && nonEmptyString(bodyOf(frame).from?.userid) === pending.actor
    && nonEmptyString(messageText(frame));
}

export function createWecomBridgeStatus() {
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

export class WecomHarnessBridge {
  #client;
  #harness;
  #state;
  #status;
  #logger;
  #replyTimeoutMs;
  #generateReqId;
  #signal;
  #queues = new Map();
  #pendingInteractions = new Map();
  #interactionKeys = new Map();
  #acceptedMessageIds = new Set();
  #approvalTasks = new Set();
  #approvals;

  constructor({
    client,
    harness,
    state,
    status = createWecomBridgeStatus(),
    logger = console,
    replyTimeoutMs = 600_000,
    generateStreamId = generateReqId,
    signal,
  }) {
    if (!client || typeof client.replyStream !== 'function' || typeof client.sendMessage !== 'function') {
      throw new TypeError('Enterprise WeChat client is required');
    }
    if (!harness || !state) throw new TypeError('Harness client and state store are required');
    this.#client = client;
    this.#harness = harness;
    this.#state = state;
    this.#status = status;
    this.#logger = logger;
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#generateReqId = generateStreamId;
    this.#signal = signal;
    this.#approvals = new HarnessApprovalQueue({ label: 'wecom', logger });
  }

  get status() {
    return structuredClone(this.#status);
  }

  accept(frame) {
    if (this.#signal?.aborted) return Promise.resolve();
    const body = bodyOf(frame);
    const messageId = nonEmptyString(body.msgid);
    const senderId = nonEmptyString(body.from?.userid);
    const chatId = body.chattype === 'group'
      ? nonEmptyString(body.chatid)
      : senderId;
    if (!messageId || !senderId || !chatId
      || !['single', 'group'].includes(body.chattype)
      || this.#state.hasSeen(messageId)
      || this.#acceptedMessageIds.has(messageId)) return Promise.resolve();

    const key = conversationKey(frame);
    this.#acceptedMessageIds.add(messageId);
    const pending = this.#pendingInteractions.get(key);
    const approval = this.#approvals.claimReply({
      key,
      actor: senderId,
      messageId,
      text: messageText(frame),
      addressed: true,
      hasPendingQuestion: Boolean(pending),
      questionCompletion: pending?.submitting || pending?.claimedReplyMessageId
        ? pending.queue
        : null,
      isQuestionPending: () => this.#pendingInteractions.has(key),
      send: (text) => this.#sendImmediate(frame, chatId, text),
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
      return this.#enqueueMessage(frame, messageId, key);
    }
    if (pending?.submitting || pending?.claimedReplyMessageId) {
      return this.#enqueueMessage(frame, messageId, key);
    }
    if (pending) {
      if (canClaimInteractionReply(frame, pending)) {
        pending.claimedReplyMessageId = messageId;
      }
      const previous = pending.queue ?? Promise.resolve();
      const current = previous
        .catch(() => undefined)
        .then(() => this.#processInteractionReply(
          frame,
          messageId,
          senderId,
          chatId,
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
    return this.#enqueueMessage(frame, messageId, key);
  }

  #enqueueMessage(frame, messageId, key, {
    releaseMessageId = true,
    alreadyRecorded = false,
  } = {}) {
    const previous = this.#queues.get(key) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() => this.#process(frame, { alreadyRecorded }))
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

  async #sendActive(chatId, text) {
    for (const chunk of splitUtf8(text)) {
      this.#signal?.throwIfAborted();
      await this.#client.sendMessage(chatId, { msgtype: 'markdown', markdown: { content: chunk } });
    }
  }

  async #sendImmediate(frame, chatId, text) {
    this.#signal?.throwIfAborted();
    const chunks = splitUtf8(text);
    if (chunks.length === 0) return;
    try {
      await this.#client.replyStream(frame, this.#generateReqId('stream'), chunks[0], true);
      for (const chunk of chunks.slice(1)) {
        await this.#client.sendMessage(chatId, { msgtype: 'markdown', markdown: { content: chunk } });
      }
    } catch {
      await this.#sendActive(chatId, text);
    }
  }

  async #process(frame, { alreadyRecorded = false } = {}) {
    if (this.#signal?.aborted) return;
    const body = bodyOf(frame);
    const messageId = typeof body.msgid === 'string' ? body.msgid : '';
    const senderId = typeof body.from?.userid === 'string' ? body.from.userid : '';
    const chatId = body.chattype === 'group' ? body.chatid : senderId;
    if (!messageId || !senderId || !chatId || !['single', 'group'].includes(body.chattype)) return;
    if (!alreadyRecorded) {
      if (this.#state.hasSeen(messageId)) return;
      this.#status.messagesReceived += 1;
      this.#status.lastMessageAt = new Date().toISOString();
    }
    const text = messageText(frame);
    const key = conversationKey(frame);
    let streamId = null;
    let streamStarted = false;
    try {
      if (!text) {
        await this.#sendImmediate(frame, chatId, '目前支持文字、语音转写和图文混排中的文字消息。');
        await this.#state.markSeen(messageId);
        return;
      }
      const command = text.toLowerCase();
      if (command === '/help') {
        await this.#sendImmediate(frame, chatId, HELP_TEXT);
        await this.#state.markSeen(messageId);
        return;
      }
      if (command === '/status') {
        await this.#harness.ensureRunning({ signal: this.#signal });
        await this.#sendImmediate(frame, chatId, '企业微信机器人与 DeepSeek Harness 连接正常。');
        await this.#state.markSeen(messageId);
        return;
      }
      if (command === '/new') {
        await this.#state.clearSession(key);
        await this.#sendImmediate(frame, chatId, '已开启新会话。请发送你的问题。');
        await this.#state.markSeen(messageId);
        return;
      }
      const workspaceCommand = await runWorkspaceCommand(text, this.#harness, key);
      if (workspaceCommand) {
        for (const reply of workspaceCommand.messages ?? [workspaceCommand.message]) {
          await this.#sendImmediate(frame, chatId, reply);
        }
        await this.#state.markSeen(messageId);
        return;
      }

      streamId = this.#generateReqId('stream');
      try {
        await this.#client.replyStream(frame, streamId, '正在思考中…', false);
        streamStarted = true;
      } catch (error) {
        this.#logger.warn?.('[dsh-im:wecom] unable to start a stream; using an active reply:', error);
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
          onUpdate: streamStarted && typeof this.#client.replyStreamNonBlocking === 'function'
            ? async (update) => {
                const progress = splitUtf8(progressText(update))[0];
                if (progress) await this.#client.replyStreamNonBlocking(frame, streamId, progress, false);
              }
            : undefined,
          onInteraction: (interaction) => this.#handleInteraction(interaction, {
            key,
            actor: senderId,
            chatId,
            requiresMention: body.chattype === 'group',
          }),
          onInteractionResolved: (resolution) => this.#handleInteractionResolved(resolution),
        },
      });

      const chunks = splitUtf8(answer || '任务已完成，但没有生成可显示的文本。');
      let finalSent = false;
      if (streamStarted && chunks.length > 0) {
        try {
          await this.#client.replyStream(frame, streamId, chunks[0], true);
          for (const chunk of chunks.slice(1)) {
            await this.#client.sendMessage(chatId, { msgtype: 'markdown', markdown: { content: chunk } });
          }
          finalSent = true;
        } catch (error) {
          this.#logger.warn?.('[dsh-im:wecom] stream finalization failed; using an active reply:', error);
        }
      }
      if (!finalSent) await this.#sendActive(chatId, answer);
      await this.#state.markSeen(messageId);
      this.#status.messagesReplied += 1;
      this.#status.lastReplyAt = new Date().toISOString();
      this.#status.lastError = null;
    } catch (error) {
      if (this.#signal?.aborted) return;
      this.#status.lastError = error?.message ?? String(error);
      this.#logger.error?.('[dsh-im:wecom] failed to process an inbound message');
      try {
        if (streamStarted && streamId) {
          await this.#client.replyStream(frame, streamId, '消息处理失败，请稍后重试。', true);
        } else {
          await this.#sendImmediate(frame, chatId, '消息处理失败，请稍后重试。');
        }
        await this.#state.markSeen(messageId);
      } catch {
        this.#logger.error?.('[dsh-im:wecom] failed to send the safe error reply');
      }
    } finally {
      await Promise.allSettled([
        this.#cancelPendingInteraction(key),
        this.#approvals.closeRoute(key),
      ]);
    }
  }

  async #processInteractionReply(frame, messageId, senderId, chatId, key, expected) {
    if (this.#signal?.aborted) return;
    const current = this.#pendingInteractions.get(key);
    const claimed = expected.claimedReplyMessageId === messageId;
    if (!current || current !== expected || current.submitting) {
      if (claimed && (!current || current !== expected)) {
        return this.#discardResolvedInteractionReply(frame, messageId, chatId);
      }
      return this.#enqueueMessage(frame, messageId, key, { releaseMessageId: false });
    }
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.messagesReceived += 1;
    this.#status.lastMessageAt = new Date().toISOString();

    const text = nonEmptyString(messageText(frame));
    if (!text) {
      await this.#sendImmediate(frame, chatId, '请用文字或语音回答当前问题。')
        .catch(() => undefined);
      return;
    }

    const pending = this.#pendingInteractions.get(key);
    if (!pending || pending !== expected || pending.submitting) {
      if (claimed && (!pending || pending !== expected)) {
        await this.#sendImmediate(frame, chatId, INTERACTION_RESOLVED_TEXT)
          .catch(() => undefined);
        return;
      }
      return this.#enqueueMessage(frame, messageId, key, {
        releaseMessageId: false,
        alreadyRecorded: true,
      });
    }
    if (pending.actor !== senderId) {
      return this.#enqueueMessage(frame, messageId, key, {
        releaseMessageId: false,
        alreadyRecorded: true,
      });
    }

    pending.chatId = chatId;
    if (pending.needsPresentation) {
      try {
        await this.#presentInteraction(pending);
      } catch {
        this.#status.lastError = '企业微信交互问题发送失败。';
        this.#logger.error?.('[dsh-im:wecom] failed to retry an interaction question');
        pending.interaction.reconnect?.();
        return;
      }
      const presentedPending = this.#pendingInteractions.get(key);
      if (!presentedPending || presentedPending !== expected || presentedPending.submitting) {
        if (claimed && (!presentedPending || presentedPending !== expected)) {
          await this.#sendImmediate(frame, chatId, INTERACTION_RESOLVED_TEXT)
            .catch(() => undefined);
          return;
        }
        return this.#enqueueMessage(frame, messageId, key, {
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
        this.#status.lastError = '企业微信交互问题发送失败。';
        this.#logger.error?.('[dsh-im:wecom] failed to send the next interaction question');
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
        if (this.#pendingInteractions.get(key) === pending) {
          this.#clearPendingInteraction(key, pending.interactionId);
        }
        await this.#sendImmediate(frame, chatId, INTERACTION_RESOLVED_TEXT)
          .catch(() => undefined);
        return;
      }
      if (this.#pendingInteractions.get(key) !== pending) return;
      pending.submitting = false;
      pending.answers.pop();
      pending.index -= 1;
      this.#status.lastError = '回答提交失败。';
      this.#logger.error?.('[dsh-im:wecom] failed to answer a Harness interaction');
      await this.#sendImmediate(frame, chatId, '回答提交失败，请重新发送当前问题的答案。')
        .catch(() => undefined);
    }
  }

  async #handleInteraction(interaction, {
    key,
    actor,
    chatId,
    requiresMention,
  }) {
    if (interaction?.kind === 'approval') {
      return this.#approvals.handleRequested(interaction, {
        key,
        actor,
        requiresMention,
        send: (text) => this.#sendActive(chatId, text),
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
      this.#logger.warn?.('[dsh-im:wecom] ignored an invalid Harness question interaction');
      return;
    }

    if (interaction.recovered === true) {
      await interaction.respond({
        ok: false,
        error: {
          code: 'cancelled',
          message: 'Enterprise WeChat safely cancelled an interaction left by an earlier client.',
          details: {},
        },
      });
      await this.#sendActive(
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
      this.#logger.warn?.('[dsh-im:wecom] cancelled a second pending Harness question');
      await interaction.respond({
        ok: false,
        error: {
          code: 'cancelled',
          message: 'Enterprise WeChat is already handling another user interaction.',
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
      chatId,
      queue: null,
      claimedReplyMessageId: null,
      submitting: false,
      needsPresentation: true,
      presentationPromise: null,
    };
    this.#pendingInteractions.set(key, pending);
    this.#interactionKeys.set(pending.interactionId, key);
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
    const presentation = this.#sendActive(
      pending.chatId,
      harnessQuestionText(
        question,
        pending.index,
        pending.questions.length,
        { requiresMention: pending.requiresMention },
      ),
    ).then(() => {
      pending.needsPresentation = false;
    }).finally(() => {
      if (pending.presentationPromise === presentation) {
        pending.presentationPromise = null;
      }
    });
    pending.presentationPromise = presentation;
    return presentation;
  }

  async #discardResolvedInteractionReply(frame, messageId, chatId) {
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.messagesReceived += 1;
    this.#status.lastMessageAt = new Date().toISOString();
    await this.#sendImmediate(frame, chatId, INTERACTION_RESOLVED_TEXT).catch(() => undefined);
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
          message: 'The Enterprise WeChat interaction ended before the user answered.',
          details: {},
        },
      }, { signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      if (error?.code !== 'interaction-not-pending') {
        this.#logger.warn?.('[dsh-im:wecom] failed to cancel a pending Harness interaction');
      }
    }
  }
}
