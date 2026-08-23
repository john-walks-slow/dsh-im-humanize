import { runWorkspaceCommand } from './workspace-command.mjs';
import { runCompactCommand } from './compact-command.mjs';
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
  hasInboundImages,
  imagePromptUserMessage,
  promptContentForMessage,
} from './image-prompt.mjs';
import {
  harnessAnswerForQuestion,
  harnessQuestionText,
  validHarnessQuestion,
} from './harness-question.mjs';
import {
  materializeOutboundArtifact,
  releaseOutboundArtifact,
} from './semantic/artifact.mjs';
import {
  createArtifactFailureReceipt,
  createDeliveryReceipt,
  mergeDeliveryReceipts,
  providerMessageIdsFor,
} from './semantic/delivery.mjs';

const INTERACTION_RESOLVED_TEXT = '这个问题已在其他客户端处理，无需再次回答。';
const FILE_ONLY_COMPLETION_TEXT = '任务已完成。';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function canClaimInteractionReply(message, pending, senderId) {
  return pending.actor === senderId
    && (message.kind !== 'group' || message.addressed === true)
    && !hasInboundImages(message)
    && Boolean(cleanText(message.content));
}

function artifactFailureText(fileName, error, descriptor) {
  const name = String(fileName ?? '结果文件')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 255) || '结果文件';
  switch (error?.code) {
    case 'artifact-delivery-uncertain':
      return `结果文件「${name}」的发送结果未能确认，请先检查聊天内是否已收到，不要立即重试。`;
    case 'artifact-permission-required':
      if (descriptor?.key === 'slack') {
        return `结果文件「${name}」已生成，但 Slack 应用缺少 files:write 权限。请更新 Manifest、重新安装应用并重新连接机器人后重试。`;
      }
      if (descriptor?.key === 'discord') {
        return `结果文件「${name}」已生成，但机器人缺少 Discord 的 Send Messages、Attach Files 或 Read Message History 权限。`;
      }
      if (descriptor?.key === 'telegram') {
        return `结果文件「${name}」已生成，但 Telegram 不允许机器人在当前聊天发送文档，请检查聊天权限。`;
      }
      return `结果文件「${name}」已生成，但当前机器人没有文件发送权限，请检查渠道权限。`;
    case 'artifact-too-large':
      return `结果文件「${name}」超过当前渠道大小上限，未发送。`;
    case 'artifact-empty':
      return `结果文件「${name}」为空，未发送。`;
    case 'artifact-invalid':
    case 'artifact-changed':
    case 'artifact-unavailable':
      return `结果文件「${name}」暂时无法读取或准备发送，请确认文件仍可访问后重试。`;
    case 'artifact-rate-limited':
      return `结果文件「${name}」暂时被当前渠道限流，未能发送，请稍后重试。`;
    case 'artifact-provider-rejected':
      return `结果文件「${name}」已生成，但当前渠道拒绝了该文件或文件消息。`;
    default:
      return `结果文件「${name}」已生成，但当前渠道暂时未能发送，请稍后重试。`;
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
  };
}

export class TextHarnessBridge {
  #descriptor;
  #bot;
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
  #commandTasks = new Set();
  #approvals;

  constructor({
    descriptor,
    bot,
    harness,
    state,
    status = createTextBridgeStatus(),
    logger = console,
    replyTimeoutMs = 600_000,
    signal,
  }) {
    if (!descriptor?.key || !descriptor?.label) throw new TypeError('A channel descriptor is required');
    if (!bot || typeof bot.sendText !== 'function') throw new TypeError('A bot client is required');
    if (!harness || !state) throw new TypeError('Harness client and state store are required');
    this.#descriptor = descriptor;
    this.#bot = bot;
    this.#harness = harness;
    this.#state = state;
    this.#status = status;
    this.#logger = logger;
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#signal = signal;
    this.#approvals = new HarnessApprovalQueue({
      label: descriptor.key,
      logger,
    });
  }

  get status() {
    return structuredClone(this.#status);
  }

  accept(message) {
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
    this.#acceptedMessageIds.add(messageId);
    if (normalized.kind === 'direct') {
      rememberConnectionTestTarget(
        this.#state,
        normalized.connectionTestTarget ?? normalized.replyTarget,
      );
    }

    const key = `${kind}:${conversationId}`;
    const pending = this.#pendingInteractions.get(key);
    const text = cleanText(normalized.content);
    const commandRunner = isControlCommand(text)
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
      text: hasInboundImages(normalized) ? '' : normalized.content,
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
    return this.#enqueueMessage(normalized, messageId, senderId, key);
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
        if (reply) await this.#bot.sendText(target, reply);
      }
      this.#status.lastError = null;
    } catch (error) {
      if (error?.code === 'turn-stopped' || this.#signal?.aborted) return;
      this.#status.lastError = error?.message ?? String(error);
      this.#logger.error?.(`[dsh-im:${this.#descriptor.key}] failed to process a command:`, error);
      await this.#bot.sendText(target, '消息处理失败，请稍后重试。').catch(() => undefined);
    }
  }

  sendConnectionTest(text) {
    return sendRememberedConnectionTest({
      state: this.#state,
      text,
      channelLabel: `${this.#descriptor.label}机器人`,
      send: (target, message) => this.#bot.sendText(target, message),
    });
  }

  async #deliverArtifacts(target, replyTo, artifacts = [], baseReceipt) {
    const receipts = baseReceipt ? [baseReceipt] : [];
    let userVisible = Boolean(baseReceipt);
    for (const artifact of artifacts) {
      this.#signal?.throwIfAborted();
      try {
        if (typeof this.#bot.sendFile !== 'function') {
          const unavailable = new Error('Native file delivery is unavailable');
          unavailable.code = 'artifact-provider-unavailable';
          throw unavailable;
        }
        const file = await materializeOutboundArtifact(artifact, {
          signal: this.#signal,
        });
        this.#signal?.throwIfAborted();
        const result = await this.#bot.sendFile(target, file);
        receipts.push(createDeliveryReceipt({
          deliveryId: file.deliveryKey,
          presentation: `${this.#descriptor.key}-file`,
          providerMessageIds: providerMessageIdsFor(result),
          artifacts: [{ artifactId: file.artifactId, outcome: 'sent' }],
        }));
        userVisible = true;
        this.#status.artifactsSent = (this.#status.artifactsSent ?? 0) + 1;
      } catch (error) {
        if (this.#signal?.aborted) throw error;
        this.#status.artifactSendErrors = (this.#status.artifactSendErrors ?? 0) + 1;
        this.#logger.warn?.(
          `[dsh-im:${this.#descriptor.key}] result file delivery failed (${error?.code ?? 'unknown'})`,
        );
        let providerMessageIds = [];
        let noticeSent = false;
        try {
          const notice = await this.#bot.sendText(
            target,
            artifactFailureText(artifact?.fileName, error, this.#descriptor),
          );
          providerMessageIds = providerMessageIdsFor(notice);
          noticeSent = true;
        } catch {
          this.#logger.warn?.(
            `[dsh-im:${this.#descriptor.key}] unable to send the safe result-file failure notice`,
          );
        }
        const failureReceipt = createArtifactFailureReceipt({
          artifactId: artifact?.artifactId ?? 'unknown',
          deliveryId: artifact?.deliveryKey ?? artifact?.artifactId ?? 'unknown',
          error,
          providerMessageIds,
        });
        receipts.push(failureReceipt);
        if (noticeSent || failureReceipt.artifacts[0]?.outcome === 'unknown') userVisible = true;
      } finally {
        releaseOutboundArtifact(artifact);
      }
    }
    const receipt = receipts.length === 0
      ? null
      : receipts.length === 1
        ? receipts[0]
        : mergeDeliveryReceipts({
            deliveryId: replyTo,
            presentation: baseReceipt
              ? `${this.#descriptor.key}-text-and-files`
              : `${this.#descriptor.key}-files`,
            receipts,
          });
    return { receipt, userVisible };
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
    let stream = null;
    try {
      this.#signal?.throwIfAborted();
      if (message.kind === 'group' && message.addressed !== true) {
        this.#status.messagesRejected += 1;
        this.#status.lastRejectedAt = new Date().toISOString();
        return;
      }
      const hasImages = hasInboundImages(message);
      if (!text && !hasImages) {
        await this.#bot.sendText(target, '目前支持文字和图片消息。');
        return;
      }
      const command = text.toLowerCase();
      if (!hasImages && command === '/help') {
        await this.#bot.sendText(target, [
          `${this.#descriptor.label}机器人已连接 DeepSeek Harness。`,
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
          '/presetlist  按序号列出可用 Agent Preset',
          '/preset [序号或完整ID]  查看或设置当前机器人 Agent Preset',
          '纯数字 ID：/preset id:<ID>',
          '/preset --default  跟随 Host 默认',
          '/stop  停止当前任务',
          '/steer 补充指令  纠偏当前任务',
          '/status  检查连接状态',
          '/help  显示本帮助',
        ].join('\n'));
        return;
      }
      if (!hasImages && command === '/status') {
        await this.#harness.ensureRunning({ signal: this.#signal });
        await this.#bot.sendText(target, `${this.#descriptor.label}机器人与 DeepSeek Harness 连接正常。`);
        return;
      }
      const workspaceCommand = !hasImages
        ? await runWorkspaceCommand(text, this.#harness, conversationKey)
        : null;
      if (workspaceCommand) {
        for (const reply of workspaceCommand.messages ?? [workspaceCommand.message]) {
          await this.#bot.sendText(target, reply);
        }
        return;
      }
      if (!hasImages && command === '/new') {
        await this.#state.clearSession(conversationKey);
        await this.#bot.sendText(target, '已开启新会话。请发送你的问题。');
        return;
      }
      const compactCommand = !hasImages
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

      await this.#bot.sendTyping?.(target).catch((error) => {
        this.#logger.warn?.(`[dsh-im:${this.#descriptor.key}] typing indicator failed:`, error);
      });
      let streamFinished = false;
      if (typeof this.#bot.openStream === 'function') {
        try {
          stream = await this.#bot.openStream(target);
        } catch (error) {
          this.#logger.warn?.(
            `[dsh-im:${this.#descriptor.key}] unable to start a streamed reply; using text:`,
            error,
          );
        }
      }
      const content = hasImages
        ? await promptContentForMessage(message, { signal: this.#signal })
        : undefined;
      const { answer, artifacts = [] } = await askInWorkspaceSession({
        harness: this.#harness,
        state: this.#state,
        key: conversationKey,
        text,
        content,
        createOptions: this.#signal ? { signal: this.#signal } : undefined,
        existsOptions: this.#signal ? { signal: this.#signal } : undefined,
        askOptions: {
          timeoutMs: this.#replyTimeoutMs,
          signal: this.#signal,
          control: { owner: this, key: conversationKey },
          onUpdate: stream ? async (update) => {
            const progress = update.type === 'text' ? update.text
              : update.type === 'tool' ? `正在使用${update.name}…` : update.text;
            if (progress) await stream.update(progress);
          } : undefined,
          onInteraction: (interaction) => this.#handleInteraction(interaction, {
            key: conversationKey,
            actor: senderId,
            target,
            requiresMention: message.kind === 'group',
          }),
          onInteractionResolved: (resolution) => this.#handleInteractionResolved(resolution),
        },
      });
      const visibleAnswer = !cleanText(answer) && artifacts.length > 0
        ? FILE_ONLY_COMPLETION_TEXT
        : answer;
      let textDeliveryError = null;
      let textReceipt = null;
      if (stream) {
        try {
          const result = await stream.finish(visibleAnswer);
          streamFinished = true;
          textReceipt = createDeliveryReceipt({
            deliveryId: messageId,
            presentation: `${this.#descriptor.key}-stream`,
            providerMessageIds: [
              ...providerMessageIdsFor(stream),
              ...providerMessageIdsFor(result),
            ],
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
        try {
          const result = await this.#bot.sendText(target, visibleAnswer);
          textReceipt = createDeliveryReceipt({
            deliveryId: messageId,
            presentation: `${this.#descriptor.key}-text`,
            providerMessageIds: providerMessageIdsFor(result),
          });
        } catch (error) {
          textDeliveryError = error;
        }
      }
      // A failed final text must not discard an already registered result file.
      // Settle the independent attachment path before surfacing the text error.
      const delivery = await this.#deliverArtifacts(target, messageId, artifacts, textReceipt);
      if (textDeliveryError && !delivery.userVisible) throw textDeliveryError;
      this.#status.messagesReplied += 1;
      this.#status.lastReplyAt = new Date().toISOString();
      this.#status.lastError = null;
      return delivery.receipt;
    } catch (error) {
      if (error?.code === 'turn-stopped') {
        if (stream) {
          try {
            await stream.finish('已停止。');
          } catch {
            stream.cancel?.();
          }
        }
        return;
      }
      stream?.cancel?.();
      if (this.#signal?.aborted) return;
      this.#status.lastError = error?.message ?? String(error);
      const imageErrorMessage = imagePromptUserMessage(error);
      if (imageErrorMessage) {
        try {
          await this.#bot.sendText(target, imageErrorMessage);
        } catch (sendError) {
          this.#logger.error?.(
            `[dsh-im:${this.#descriptor.key}] failed to send the image error reply:`,
            sendError,
          );
        }
        return;
      }
      this.#logger.error?.(`[dsh-im:${this.#descriptor.key}] failed to process a message:`, error);
      try {
        await this.#bot.sendText(target, '消息处理失败，请稍后重试。');
      } catch (sendError) {
        this.#logger.error?.(
          `[dsh-im:${this.#descriptor.key}] failed to send the safe error reply:`,
          sendError,
        );
      }
    } finally {
      await Promise.allSettled([
        this.#cancelPendingInteraction(conversationKey),
        this.#approvals.closeRoute(conversationKey),
      ]);
    }
  }

  async #processInteractionReply(message, messageId, senderId, key, expected) {
    if (this.#signal?.aborted) return;
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
    if (!text || hasInboundImages(message)) {
      try {
        await this.#bot.sendText(target, '请用文字回答当前问题。');
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
        this.#status.lastError = `${this.#descriptor.label}交互问题发送失败。`;
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
        this.#status.lastError = `${this.#descriptor.label}交互问题发送失败。`;
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
        if (this.#signal?.aborted) return;
        try {
          await this.#bot.sendText(target, INTERACTION_RESOLVED_TEXT);
        } catch (sendError) {
          this.#logger.error?.(
            `[dsh-im:${this.#descriptor.key}] failed to send an expired interaction notice:`,
            sendError,
          );
        }
        return;
      }
      if (this.#signal?.aborted || this.#pendingInteractions.get(key) !== pending) return;
      pending.submitting = false;
      pending.answers.pop();
      pending.index -= 1;
      this.#status.lastError = '回答提交失败。';
      this.#logger.error?.(
        `[dsh-im:${this.#descriptor.key}] failed to answer a Harness interaction:`,
        error,
      );
      try {
        await this.#bot.sendText(target, '回答提交失败，请重新发送当前问题的答案。');
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
          '检测到这个 Session 中遗留的待回答问题，已安全取消并继续处理你刚才的消息。',
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
      await this.#bot.sendText(message.replyTarget, INTERACTION_RESOLVED_TEXT);
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
