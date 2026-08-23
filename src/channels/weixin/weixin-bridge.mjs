import {
  extractWeixinFiles,
  extractWeixinImages,
  extractWeixinText,
  splitWeixinText,
  weixinMessageId,
} from './weixin-api.mjs';
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
import {
  isPresetCommand,
  runPresetCommand,
} from '../shared/preset-command.mjs';
import { runWorkspaceCommand } from '../shared/workspace-command.mjs';
import { askInWorkspaceSession } from '../shared/workspace-session.mjs';
import {
  hasInboundImages,
  imagePromptDiagnostic,
  imagePromptUserMessage,
  promptContentForMessage,
} from '../shared/image-prompt.mjs';
import {
  hasInboundFiles,
  inboundFileUserMessage,
  prefetchInboundFiles,
} from '../shared/inbound-file.mjs';
import { rememberConnectionTestTarget } from '../shared/connection-test.mjs';
import { deliverOutboundArtifacts } from '../shared/semantic/artifact-delivery.mjs';
import {
  createDeliveryReceipt,
  providerMessageIdsFor,
} from '../shared/semantic/delivery.mjs';
import { t } from '../shared/i18n.mjs';

const INTERACTION_RESOLVED_TEXT = () => t('这个问题已在其他客户端处理，无需再次回答。');
const GENERIC_PROCESSING_ERROR = () => t('消息处理失败，请稍后重试。');

const HELP_TEXT = () => [
  t('微信已连接 DeepSeek Harness。'),
  '',
  t('直接发送文字、图片、文件或带文字识别结果的语音即可继续当前会话。'),
  t('/new  开启一个全新会话'),
  t('/compact  压缩当前会话的较早上下文'),
  t('/workspace 工作区绝对路径  切换工作区'),
  t('/workspacelist  列出工作区绝对路径'),
  t('/sessionlist [工作区序号或绝对路径]  列出会话 ID 和标题'),
  t('/session Session ID 或当前工作区序号  将当前聊天绑定到指定会话'),
  t('/models  按序号列出所有可用模型'),
  t('/model [序号或完整模型ID]  查看或切换当前会话模型'),
  t('示例：先发 /models，再发 /model 2'),
  t('/presetlist  按序号列出可用 Agent Preset'),
  t('/preset [序号或完整ID]  查看或设置当前机器人 Agent Preset'),
  t('纯数字 ID：/preset id:<ID>'),
  t('/preset --default  跟随 Host 默认'),
  t('/stop  停止当前任务'),
  t('/steer 补充指令  纠偏当前任务'),
  t('/status  检查连接状态'),
  t('/help  显示本帮助'),
].join('\n');

function conversationKey(userId) {
  return `p2p:${userId}`;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function weixinInboundMessage(message, api) {
  return {
    content: extractWeixinText(message) ?? '',
    images: typeof api?.inboundImages === 'function'
      ? api.inboundImages(message)
      : extractWeixinImages(message),
    files: typeof api?.inboundFiles === 'function'
      ? api.inboundFiles(message)
      : extractWeixinFiles(message),
  };
}

function hasWeixinImageItems(message) {
  return Array.isArray(message?.item_list)
    && message.item_list.some((item) => item?.image_item && typeof item.image_item === 'object');
}

function hasWeixinFileItems(message) {
  return Array.isArray(message?.item_list)
    && message.item_list.some((item) => item?.file_item && typeof item.file_item === 'object');
}

function canClaimInteractionReply(message, pending) {
  return pending.questions[pending.index]
    && nonEmptyString(message?.from_user_id) === pending.actor
    && !hasWeixinImageItems(message)
    && !hasWeixinFileItems(message)
    && nonEmptyString(extractWeixinText(message));
}

function safeMessageError(error, userMessage = GENERIC_PROCESSING_ERROR()) {
  const diagnostic = imagePromptDiagnostic(error);
  return {
    code: diagnostic?.code ?? 'message-processing-failed',
    reason: diagnostic?.reason ?? 'UNKNOWN',
    message: diagnostic?.userMessage ?? userMessage,
    at: Date.now(),
  };
}

function artifactFailureText(fileName, error) {
  const name = String(fileName ?? t('结果文件')).replace(/[\r\n]+/g, ' ').trim() || t('结果文件');
  switch (error?.code) {
    case 'artifact-delivery-uncertain':
      return t('结果文件「{name}」发送结果未能确认，请先检查聊天内是否已收到，不要立即重试。', { name });
    case 'artifact-permission-required':
      return t('结果文件「{name}」已生成，但微信机器人当前没有文件消息发送权限，请检查机器人文件消息能力。', { name });
    case 'artifact-too-large':
      return t('结果文件「{name}」超过当前微信会话可发送的文件大小，未发送。', { name });
    case 'artifact-rate-limited':
      return t('结果文件「{name}」暂时被微信限流，未能发送，请稍后重试。', { name });
    case 'artifact-provider-rejected':
      return t('结果文件「{name}」已生成，但微信拒绝了该文件消息。', { name });
    case 'artifact-invalid':
    case 'artifact-changed':
    case 'artifact-unavailable':
      return t('结果文件「{name}」暂时无法读取或准备发送，请确认文件仍可访问后重试。', { name });
    default:
      return t('结果文件「{name}」已生成，但暂时未能通过微信发送，请稍后重试。', { name });
  }
}

export function createWeixinBridgeStatus() {
  return {
    messagesReceived: 0,
    messagesReplied: 0,
    messagesRejected: 0,
    lastMessageAt: null,
    lastReplyAt: null,
    lastRejectedAt: null,
    lastError: null,
    lastMessageError: null,
  };
}

export class WeixinHarnessBridge {
  #api;
  #baseUrl;
  #token;
  #ownerUserId;
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
  #acceptedMessageIds = new Set();
  #approvalTasks = new Set();
  #commandTasks = new Set();
  #approvals;

  constructor({
    api,
    baseUrl,
    token,
    ownerUserId,
    harness,
    state,
    status = createWeixinBridgeStatus(),
    logger = console,
    replyTimeoutMs = 600_000,
    maxMessageChars = 4_000,
    signal,
  }) {
    if (!api || typeof api.sendText !== 'function') throw new TypeError('Weixin API is required');
    if (!baseUrl || !token || !ownerUserId) throw new TypeError('Weixin account credentials are required');
    if (!harness || !state) throw new TypeError('Harness client and state store are required');
    this.#api = api;
    this.#baseUrl = baseUrl;
    this.#token = token;
    this.#ownerUserId = ownerUserId;
    this.#harness = harness;
    this.#state = state;
    this.#status = status;
    this.#logger = logger;
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#maxMessageChars = maxMessageChars;
    this.#signal = signal;
    this.#approvals = new HarnessApprovalQueue({ label: 'weixin', logger });
  }

  get status() {
    return structuredClone(this.#status);
  }

  accept(message) {
    if (this.#signal?.aborted) return Promise.resolve();
    if (message?.message_type === 2) return Promise.resolve();
    const messageId = weixinMessageId(message);
    const sender = nonEmptyString(message?.from_user_id);
    if (!messageId || !sender || this.#state.hasSeen(messageId)
      || this.#acceptedMessageIds.has(messageId)) return Promise.resolve();
    this.#acceptedMessageIds.add(messageId);
    if (sender === this.#ownerUserId) {
      rememberConnectionTestTarget(this.#state, { toUserId: sender });
    }
    const key = conversationKey(sender);
    const contextToken = nonEmptyString(message?.context_token) ?? undefined;
    const runId = nonEmptyString(message?.run_id) ?? undefined;
    const pending = this.#pendingInteractions.get(key);
    const commandText = nonEmptyString(extractWeixinText(message)) ?? '';
    const commandRunner = hasWeixinFileItems(message) ? null : isControlCommand(commandText)
      ? runControlCommand
      : (isModelCommand(commandText)
          ? runModelCommand
          : (isPresetCommand(commandText) ? runPresetCommand : null));
    if (commandRunner && sender === this.#ownerUserId) {
      let task;
      task = this.#processFastCommand(
        message,
        messageId,
        key,
        sender,
        contextToken,
        runId,
        commandText,
        commandRunner,
      ).catch((error) => {
        if (error?.code === 'turn-stopped' || this.#signal?.aborted) return;
        this.#status.lastError = error?.message ?? String(error);
        this.#status.lastMessageError = safeMessageError(error);
        this.#logger.error?.('[dsh-weixin] failed to process a command:', error);
        return this.#send(sender, GENERIC_PROCESSING_ERROR(), contextToken, runId)
          .catch(() => undefined);
      }).finally(() => {
        this.#acceptedMessageIds.delete(messageId);
        this.#commandTasks.delete(task);
      });
      this.#commandTasks.add(task);
      return task;
    }
    const approval = this.#approvals.claimReply({
      key,
      actor: sender,
      messageId,
      text: hasWeixinImageItems(message) || hasWeixinFileItems(message)
        ? ''
        : extractWeixinText(message),
      addressed: true,
      hasPendingQuestion: Boolean(pending),
      questionCompletion: pending?.submitting || pending?.claimedReplyMessageId
        ? pending.queue
        : null,
      isQuestionPending: () => this.#pendingInteractions.has(key),
      send: (text) => this.#send(sender, text, contextToken, runId),
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
    const preparedMessage = message.from_user_id === this.#ownerUserId
      ? prefetchInboundFiles(
          weixinInboundMessage(message, this.#api),
          { signal: this.#signal },
        )
      : undefined;
    const previous = this.#queues.get(key) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() => this.#process(message, key, { alreadyRecorded, preparedMessage }))
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
      ...this.#commandTasks,
    ]);
  }

  async #processFastCommand(
    message,
    messageId,
    key,
    sender,
    contextToken,
    runId,
    text,
    runner,
  ) {
    this.#signal?.throwIfAborted();
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.messagesReceived += 1;
    this.#status.lastMessageAt = new Date().toISOString();
    const result = await runner(text, this.#harness, this.#state, key, {
      signal: this.#signal,
      hasImages: hasWeixinImageItems(message),
      hasFiles: hasWeixinFileItems(message),
      pendingInteraction: this.#pendingInteractions.has(key)
        || this.#approvals.hasPending(key),
      control: { owner: this, key },
    });
    if (result?.stopped) {
      await Promise.allSettled([
        this.#cancelPendingInteraction(key),
        this.#approvals.closeRoute(key),
      ]);
    }
    for (const reply of result?.messages ?? [result?.message]) {
      if (reply) await this.#send(sender, reply, contextToken, runId);
    }
    this.#status.lastError = null;
    this.#status.lastMessageError = null;
  }

  async #process(message, key, { alreadyRecorded = false, preparedMessage } = {}) {
    this.#signal?.throwIfAborted();
    const messageId = weixinMessageId(message);
    const sender = nonEmptyString(message?.from_user_id);
    if (!messageId || !sender) return;
    if (!alreadyRecorded) {
      if (this.#state.hasSeen(messageId)) return;
      this.#status.messagesReceived += 1;
      this.#status.lastMessageAt = new Date().toISOString();
    }
    if (sender !== this.#ownerUserId) {
      this.#status.messagesRejected += 1;
      this.#status.lastRejectedAt = new Date().toISOString();
      return;
    }

    const contextToken = typeof message.context_token === 'string' ? message.context_token : undefined;
    const runId = typeof message.run_id === 'string' ? message.run_id : undefined;
    try {
      const promptMessage = preparedMessage ?? weixinInboundMessage(message, this.#api);
      const text = promptMessage.content;
      const hasImages = hasInboundImages(promptMessage);
      const hasFiles = hasInboundFiles(promptMessage);
      if (!text && !hasImages && !hasFiles) {
        await this.#send(sender, t('目前支持文字、图片、文件，以及微信已转成文字的语音消息。'), contextToken, runId);
        await this.#state.markSeen(messageId);
        return;
      }

      const command = text.trim().toLowerCase();
      if (!hasImages && !hasFiles && command === '/help') {
        await this.#send(sender, HELP_TEXT(), contextToken, runId);
        await this.#state.markSeen(messageId);
        return;
      }
      if (!hasImages && !hasFiles && command === '/status') {
        await this.#harness.ensureRunning({ signal: this.#signal });
        await this.#send(sender, t('微信与 DeepSeek Harness 连接正常。'), contextToken, runId);
        await this.#state.markSeen(messageId);
        return;
      }
      if (!hasImages && !hasFiles && command === '/new') {
        await this.#state.clearSession(key);
        await this.#send(sender, t('已开启新会话。请发送你的问题。'), contextToken, runId);
        await this.#state.markSeen(messageId);
        return;
      }
      const workspaceCommand = hasImages || hasFiles
        ? null
        : await runWorkspaceCommand(text, this.#harness, key);
      if (workspaceCommand) {
        for (const reply of workspaceCommand.messages ?? [workspaceCommand.message]) {
          await this.#send(sender, reply, contextToken, runId);
        }
        await this.#state.markSeen(messageId);
        return;
      }
      const compactCommand = hasImages || hasFiles
        ? null
        : await runCompactCommand(
            text,
            this.#harness,
            this.#state,
            key,
            { signal: this.#signal },
          );
      if (compactCommand) {
        await this.#send(sender, compactCommand.message, contextToken, runId);
        await this.#state.markSeen(messageId);
        return;
      }

      const content = hasImages
        ? await promptContentForMessage(promptMessage, { signal: this.#signal })
        : undefined;
      let answer;
      let artifacts = [];
      try {
        ({ answer, artifacts = [] } = await askInWorkspaceSession({
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
            onInteraction: (interaction) => this.#handleInteraction(interaction, {
              key,
              actor: sender,
              contextToken,
              runId,
            }),
            onInteractionResolved: (resolution) => this.#handleInteractionResolved(resolution),
            files: promptMessage.files,
          },
        }));
      } finally {
        await Promise.allSettled([
          this.#cancelPendingInteraction(key),
          this.#approvals.closeRoute(key),
        ]);
      }
      const answerText = typeof answer === 'string' && answer.trim()
        ? answer
        : artifacts.length > 0 ? t('结果文件已生成。') : answer;
      let textDeliveryError = null;
      let textReceipt = null;
      try {
        textReceipt = createDeliveryReceipt({
          deliveryId: messageId,
          presentation: 'weixin-text',
          providerMessageIds: await this.#send(sender, answerText, contextToken, runId),
        });
      } catch (error) {
        textDeliveryError = error;
      }
      const delivery = await this.#deliverArtifacts(
        sender,
        messageId,
        artifacts,
        contextToken,
        runId,
        textReceipt,
      );
      if (textDeliveryError && !delivery.userVisible) throw textDeliveryError;
      await this.#state.markSeen(messageId);
      this.#status.messagesReplied += 1;
      this.#status.lastReplyAt = new Date().toISOString();
      this.#status.lastError = null;
      this.#status.lastMessageError = null;
      return delivery.receipt;
    } catch (error) {
      if (error?.code === 'turn-stopped') {
        await this.#state.markSeen(messageId);
        return;
      }
      if (this.#signal?.aborted) return;
      this.#status.lastError = error?.message ?? String(error);
      const userMessage = inboundFileUserMessage(error)
        ?? imagePromptUserMessage(error)
        ?? GENERIC_PROCESSING_ERROR();
      this.#status.lastMessageError = safeMessageError(error, userMessage);
      this.#logger.error?.('[dsh-weixin] failed to process an inbound message:', error);
      try {
        await this.#send(
          sender,
          userMessage,
          contextToken,
          runId,
        );
        await this.#state.markSeen(messageId);
      } catch (sendError) {
        this.#logger.error?.('[dsh-weixin] failed to send the safe error reply:', sendError);
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

    const text = nonEmptyString(extractWeixinText(message));
    const contextToken = nonEmptyString(message?.context_token) ?? undefined;
    const runId = nonEmptyString(message?.run_id) ?? undefined;
    if (!text || hasWeixinImageItems(message)) {
      await this.#send(
        expected.actor,
        t('请用文字回答当前问题。'),
        contextToken,
        runId,
      );
      return;
    }

    const pending = this.#pendingInteractions.get(key);
    if (!pending || pending !== expected || pending.submitting) {
      if (claimed && (!pending || pending !== expected)) {
        await this.#send(
          expected.actor,
          INTERACTION_RESOLVED_TEXT(),
          contextToken,
          runId,
        );
        return;
      }
      return this.#enqueueMessage(message, messageId, key, {
        releaseMessageId: false,
        alreadyRecorded: true,
      });
    }
    pending.contextToken = contextToken;
    pending.runId = runId;
    if (pending.needsPresentation) {
      try {
        await this.#presentInteraction(pending);
      } catch {
        this.#status.lastError = t('微信交互问题发送失败。');
        this.#logger.error?.('[dsh-weixin] failed to retry an interaction question');
        pending.interaction.reconnect?.();
        return;
      }
      const presentedPending = this.#pendingInteractions.get(key);
      if (!presentedPending || presentedPending !== expected || presentedPending.submitting) {
        if (claimed && (!presentedPending || presentedPending !== expected)) {
          await this.#send(
            expected.actor,
            INTERACTION_RESOLVED_TEXT(),
            contextToken,
            runId,
          ).catch(() => undefined);
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
        this.#status.lastError = t('微信交互问题发送失败。');
        this.#logger.error?.('[dsh-weixin] failed to send the next interaction question');
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
      this.#status.lastMessageError = null;
    } catch (error) {
      if (this.#signal?.aborted) return;
      if (error?.code === 'interaction-not-pending') {
        this.#clearPendingInteraction(key, pending.interactionId);
        await this.#send(
          pending.actor,
          INTERACTION_RESOLVED_TEXT(),
          pending.contextToken,
          pending.runId,
        ).catch(() => undefined);
        return;
      }
      if (this.#pendingInteractions.get(key) !== pending) return;
      pending.submitting = false;
      pending.answers.pop();
      pending.index -= 1;
      this.#status.lastError = t('回答提交失败。');
      this.#logger.error?.('[dsh-weixin] failed to answer a Harness interaction');
      await this.#send(
        pending.actor,
        t('回答提交失败，请重新发送当前问题的答案。'),
        pending.contextToken,
        pending.runId,
      ).catch(() => undefined);
    }
  }

  async #handleInteraction(interaction, {
    key,
    actor,
    contextToken,
    runId,
  }) {
    if (interaction?.kind === 'approval') {
      return this.#approvals.handleRequested(interaction, {
        key,
        actor,
        send: (text) => this.#send(actor, text, contextToken, runId),
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
      this.#logger.warn?.('[dsh-weixin] ignored an invalid Harness question interaction');
      return;
    }

    if (interaction.recovered === true) {
      await interaction.respond({
        ok: false,
        error: {
          code: 'cancelled',
          message: 'Weixin safely cancelled an interaction left by an earlier client.',
          details: {},
        },
      });
      await this.#send(
        actor,
        t('检测到这个 Session 中遗留的待回答问题，已安全取消并继续处理你刚才的消息。'),
        contextToken,
        runId,
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
          message: 'Weixin is already handling another user interaction.',
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
      questions,
      answers: [],
      index: 0,
      contextToken,
      runId,
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
    const presentation = this.#send(
      pending.actor,
      harnessQuestionText(question, pending.index, pending.questions.length),
      pending.contextToken,
      pending.runId,
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
    await this.#send(
      nonEmptyString(message?.from_user_id),
      INTERACTION_RESOLVED_TEXT(),
      nonEmptyString(message?.context_token) ?? undefined,
      nonEmptyString(message?.run_id) ?? undefined,
    ).catch(() => undefined);
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
          message: 'The Weixin interaction ended before the user answered.',
          details: {},
        },
      }, { signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      if (error?.code !== 'interaction-not-pending') {
        this.#logger.warn?.('[dsh-weixin] failed to cancel a pending Harness interaction');
      }
    }
  }

  async #handleInteractionFailure(message, messageId, error) {
    if (this.#signal?.aborted) return;
    this.#status.lastError = error?.message ?? String(error);
    this.#status.lastMessageError = safeMessageError(error);
    this.#logger.error?.('[dsh-weixin] failed to process an interaction reply:', error);
    if (!this.#state.hasSeen(messageId)) {
      await this.#state.markSeen(messageId).catch(() => undefined);
    }
    await this.#send(
      nonEmptyString(message?.from_user_id),
      GENERIC_PROCESSING_ERROR(),
      nonEmptyString(message?.context_token) ?? undefined,
      nonEmptyString(message?.run_id) ?? undefined,
    ).catch(() => undefined);
  }

  async #send(toUserId, text, contextToken, runId) {
    const providerMessageIds = [];
    for (const chunk of splitWeixinText(text, this.#maxMessageChars)) {
      const result = await this.#api.sendText({
        baseUrl: this.#baseUrl,
        token: this.#token,
        toUserId,
        text: chunk,
        contextToken,
        runId,
        signal: this.#signal,
      });
      providerMessageIds.push(...providerMessageIdsFor(result));
    }
    return providerMessageIds;
  }

  async #deliverArtifacts(toUserId, replyTo, artifacts, contextToken, runId, baseReceipt) {
    const sendArtifact = (method, file) => this.#api[method]({
      baseUrl: this.#baseUrl,
      token: this.#token,
      toUserId,
      file,
      contextToken,
      runId,
      signal: this.#signal,
    });
    const delivery = await deliverOutboundArtifacts({
      artifacts,
      baseReceipt,
      deliveryId: replyTo,
      aggregatePresentation: baseReceipt ? 'weixin-text-and-files' : 'weixin-files',
      channelKey: 'weixin',
      signal: this.#signal,
      sendImage: typeof this.#api.sendImage === 'function'
        ? (file) => sendArtifact('sendImage', file)
        : undefined,
      sendFile: typeof this.#api.sendFile === 'function'
        ? (file) => sendArtifact('sendFile', file)
        : undefined,
      sendFailureNotice: (artifact, error) => this.#send(
        toUserId,
        artifactFailureText(artifact?.fileName, error),
        contextToken,
        runId,
      ),
      logger: this.#logger,
    });
    this.#status.artifactsSent = (this.#status.artifactsSent ?? 0)
      + delivery.artifactsSent;
    this.#status.artifactSendErrors = (this.#status.artifactSendErrors ?? 0)
      + delivery.artifactSendErrors;
    return { receipt: delivery.receipt, userVisible: delivery.userVisible };
  }
}
