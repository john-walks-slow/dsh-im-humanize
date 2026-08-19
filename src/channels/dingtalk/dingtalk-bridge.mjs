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
import { runCompactCommand } from '../shared/compact-command.mjs';
import {
  isControlCommand,
  runControlCommand,
} from '../shared/control-command.mjs';
import {
  isModelCommand,
  runModelCommand,
} from '../shared/model-command.mjs';
import { runWorkspaceCommand } from '../shared/workspace-command.mjs';
import { askInWorkspaceSession } from '../shared/workspace-session.mjs';
import {
  hasInboundImages,
  imagePromptUserMessage,
  promptContentForMessage,
} from '../shared/image-prompt.mjs';
import { rememberConnectionTestTarget } from '../shared/connection-test.mjs';

const CARD_INITIAL_TEXT = '已连接 DeepSeek Harness，正在思考…';
const CARD_ERROR_TEXT = '消息处理失败，请稍后重试。';
const INTERACTION_RESOLVED_TEXT = '这个问题已在其他客户端处理，无需再次回答。';

const HELP_TEXT = [
  '钉钉机器人已连接 DeepSeek Harness。',
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
  '/help  显示本帮助',
].join('\n');

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeErrorDiagnostic(error) {
  const chain = [];
  const seen = new Set();
  let current = error;
  while (current && typeof current === 'object' && chain.length < 3 && !seen.has(current)) {
    seen.add(current);
    const name = nonEmptyString(current.name)?.slice(0, 80);
    const code = nonEmptyString(current.code)?.slice(0, 80);
    const providerCode = nonEmptyString(current.providerCode)?.slice(0, 160);
    const status = Number.isInteger(current.status) ? current.status : undefined;
    chain.push({
      ...(name ? { name } : {}),
      ...(code ? { code } : {}),
      ...(providerCode ? { providerCode } : {}),
      ...(status ? { status } : {}),
    });
    current = current.cause;
  }
  return chain;
}

function dingtalkImageErrorUserMessage(error) {
  let current = error;
  const seen = new Set();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if (current.code === 'image-download-address-failed') {
      return '钉钉未能换取图片下载地址，请重新发送；若持续失败，请检查机器人的“企业内机器人发送消息权限”。';
    }
    if (current.code === 'invalid-image-download') {
      return '钉钉没有返回图片下载地址，请重新发送。';
    }
    if (current.code === 'image-content-download-failed') {
      return '钉钉返回的图片临时地址无法读取，请重新发送。';
    }
    current = current.cause;
  }
  return imagePromptUserMessage(error);
}

function senderStaffId(message) {
  return nonEmptyString(message?.senderStaffId) ?? nonEmptyString(message?.senderId);
}

function parsedMessageContent(message) {
  if (message?.content && typeof message.content === 'object') return message.content;
  if (typeof message?.content !== 'string') return null;
  try {
    const parsed = JSON.parse(message.content);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function richTextEntries(content) {
  const entries = content?.richText ?? content?.rich_text;
  return Array.isArray(entries) ? entries : [];
}

function richTextEntryText(entry) {
  if (typeof entry?.text === 'string') return nonEmptyString(entry.text);
  if (typeof entry?.text?.content === 'string') return nonEmptyString(entry.text.content);
  if (String(entry?.type).toLowerCase() === 'text' && typeof entry?.content === 'string') {
    return nonEmptyString(entry.content);
  }
  return null;
}

function downloadCodeFor(value) {
  return nonEmptyString(value?.downloadCode) ?? nonEmptyString(value?.pictureDownloadCode);
}

/** Normalize DingTalk picture and richText callbacks into lazy image references. */
export function dingtalkInboundMessage(message, {
  api,
  clientId,
  clientSecret,
} = {}) {
  const msgtype = String(message?.msgtype ?? '').toLowerCase();
  const content = parsedMessageContent(message);
  const richEntries = msgtype === 'richtext' ? richTextEntries(content) : [];
  const text = msgtype === 'text'
    ? nonEmptyString(message?.text?.content) ?? ''
    : richEntries.map(richTextEntryText).filter(Boolean).join('\n');
  const imageCodes = [];
  if (msgtype === 'picture') {
    const code = downloadCodeFor(content);
    if (code) imageCodes.push(code);
  } else if (msgtype === 'richtext') {
    for (const entry of richEntries) {
      if (String(entry?.type ?? '').toLowerCase() !== 'picture') continue;
      const code = downloadCodeFor(entry);
      if (code) imageCodes.push(code);
    }
  }
  return {
    content: text,
    images: imageCodes.map((downloadCode, index) => ({
      name: index === 0 ? 'image' : `image-${index + 1}`,
      load: ({ signal, maxBytes }) => {
        if (typeof api?.downloadImage !== 'function') {
          throw new Error('DingTalk API does not support image downloads');
        }
        return api.downloadImage({
          clientId,
          clientSecret,
          robotCode: message?.robotCode,
          downloadCode,
          signal,
          maxBytes,
        });
      },
    })),
  };
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
  #commandTasks = new Set();
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
    if (sessionWebhook && String(message.conversationType) !== '2') {
      rememberConnectionTestTarget(this.#state, { sessionWebhook });
    }
    const pending = this.#pendingInteractions.get(key);
    const promptMessage = dingtalkInboundMessage(message, {
      api: this.#api,
      clientId: this.#clientId,
      clientSecret: this.#clientSecret,
    });
    const commandText = nonEmptyString(promptMessage.content) ?? '';
    const commandRunner = isControlCommand(commandText)
      ? runControlCommand
      : (isModelCommand(commandText) ? runModelCommand : null);
    const addressed = String(message.conversationType) !== '2' || message?.isInAtList === true;
    if (commandRunner && sessionWebhook && addressed) {
      let task;
      task = this.#processFastCommand(
        message,
        messageId,
        key,
        sessionWebhook,
        promptMessage,
        commandRunner,
      ).catch((error) => {
        if (error?.code === 'turn-stopped' || this.#signal?.aborted) return;
        this.#status.lastError = '钉钉命令处理失败。';
        this.#logger.error?.('[dsh-dingtalk] failed to process a command', safeErrorDiagnostic(error));
        return this.#send(sessionWebhook, CARD_ERROR_TEXT).catch(() => undefined);
      }).finally(() => {
        this.#acceptedMessageIds.delete(messageId);
        this.#commandTasks.delete(task);
      });
      this.#commandTasks.add(task);
      return task;
    }
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
      ...this.#commandTasks,
    ]);
  }

  async #processFastCommand(message, messageId, key, sessionWebhook, prompt, runner) {
    this.#signal?.throwIfAborted();
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    increment(this.#status, 'messagesReceived');
    this.#status.lastMessageAt = new Date().toISOString();
    const result = await runner(
      nonEmptyString(prompt.content) ?? '',
      this.#harness,
      this.#state,
      key,
      {
        signal: this.#signal,
        hasImages: hasInboundImages(prompt),
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
      if (reply) await this.#send(sessionWebhook, reply);
    }
    this.#status.lastError = null;
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

    const promptMessage = dingtalkInboundMessage(message, {
      api: this.#api,
      clientId: this.#clientId,
      clientSecret: this.#clientSecret,
    });
    const text = promptMessage.content;
    const hasImages = hasInboundImages(promptMessage);
    const isPlainText = String(message?.msgtype).toLowerCase() === 'text';
    let cardStream = null;
    let cardStarted = false;
    try {
      if (!text && !hasImages) {
        await this.#send(sessionWebhook, '目前支持文字和图片消息。');
        return;
      }

      const command = text.toLowerCase();
      if (isPlainText && !hasImages && command === '/help') {
        await this.#send(sessionWebhook, HELP_TEXT);
        return;
      }
      if (isPlainText && !hasImages && command === '/status') {
        await this.#harness.ensureRunning({ signal: this.#signal });
        await this.#send(sessionWebhook, '钉钉机器人与 DeepSeek Harness 连接正常。');
        return;
      }
      if (isPlainText && !hasImages && command === '/new') {
        await this.#state.clearSession(key);
        await this.#send(sessionWebhook, '已开启新会话。请发送你的问题。');
        return;
      }
      const workspaceCommand = isPlainText && !hasImages
        ? await runWorkspaceCommand(text, this.#harness, key)
        : null;
      if (workspaceCommand) {
        for (const reply of workspaceCommand.messages ?? [workspaceCommand.message]) {
          await this.#send(sessionWebhook, reply);
        }
        return;
      }
      const compactCommand = isPlainText && !hasImages
        ? await runCompactCommand(
            text,
            this.#harness,
            this.#state,
            key,
            { signal: this.#signal },
          )
        : null;
      if (compactCommand) {
        await this.#send(sessionWebhook, compactCommand.message);
        return;
      }

      const content = hasImages
        ? await promptContentForMessage(promptMessage, { signal: this.#signal })
        : undefined;
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
        ...(hasImages ? { content } : { text }),
        createOptions: { signal: this.#signal },
        existsOptions: { signal: this.#signal },
        askOptions: {
          timeoutMs: this.#replyTimeoutMs,
          signal: this.#signal,
          control: { owner: this, key },
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
    } catch (error) {
      if (error?.code === 'turn-stopped') {
        if (cardStarted) await cardStream.finish('已停止。').catch(() => undefined);
        return;
      }
      if (this.#signal?.aborted) return;
      this.#status.lastError = '钉钉消息处理失败。';
      this.#logger.error?.(
        '[dsh-dingtalk] failed to process an inbound message',
        safeErrorDiagnostic(error),
      );
      try {
        const errorText = dingtalkImageErrorUserMessage(error) ?? CARD_ERROR_TEXT;
        const streamed = cardStarted && await cardStream.finish(errorText);
        if (!streamed) await this.#send(sessionWebhook, errorText);
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
