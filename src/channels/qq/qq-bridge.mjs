import { runWorkspaceCommand } from '../shared/workspace-command.mjs';
import { runCompactCommand } from '../shared/compact-command.mjs';
import {
  isControlCommand,
  runControlCommand,
} from '../shared/control-command.mjs';
import { rememberConnectionTestTarget } from '../shared/connection-test.mjs';
import {
  harnessAnswerForQuestion,
  harnessQuestionText,
  validHarnessQuestion,
} from '../shared/harness-question.mjs';
import { HarnessApprovalQueue } from '../shared/harness-approval.mjs';
import {
  isModelCommand,
  runModelCommand,
} from '../shared/model-command.mjs';
import {
  isPresetCommand,
  runPresetCommand,
} from '../shared/preset-command.mjs';
import { askInWorkspaceSession } from '../shared/workspace-session.mjs';
import {
  fetchImageBuffer,
  hasInboundImages,
  imagePromptUserMessage,
  promptContentForMessage,
} from '../shared/image-prompt.mjs';
import {
  materializeOutboundArtifact,
  releaseOutboundArtifact,
  trackOutboundArtifactProviderPromise,
} from '../shared/semantic/artifact.mjs';
import {
  createArtifactFailureReceipt,
  createDeliveryReceipt,
  mergeDeliveryReceipts,
  providerMessageIdsFor,
} from '../shared/semantic/delivery.mjs';

const INTERACTION_RESOLVED_TEXT = '这个问题已在其他客户端处理，无需再次回答。';
const DEFAULT_FILE_UPLOAD_TIMEOUT_MS = 120_000;

export const QQ_IMAGE_HOSTS = Object.freeze([
  '.myqcloud.com',
  '.qpic.cn',
  '.qq.com',
  '.qq.com.cn',
  '.tencentcos.com',
  '.ugcimg.cn',
]);

const QQ_IMAGE_FILENAME = /\.(?:gif|jpe?g|png|webp)$/i;

const HELP_TEXT = [
  'QQ 机器人已连接 DeepSeek Harness。',
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
].join('\n');

function conversationKey(message) {
  return `${message.kind}:${message.kind === 'group' ? message.groupOpenid : message.senderId}`;
}

function safeText(message) {
  return typeof message?.content === 'string' ? message.content.trim() : '';
}

function attachmentMediaType(attachment) {
  const value = nonEmptyString(attachment?.content_type ?? attachment?.contentType);
  if (!value) return null;
  return value.split(';', 1)[0].trim().toLowerCase();
}

function isQqImageAttachment(attachment) {
  const mediaType = attachmentMediaType(attachment);
  return mediaType?.startsWith('image/') === true
    || QQ_IMAGE_FILENAME.test(nonEmptyString(attachment?.filename) ?? '');
}

function hasQqImageAttachments(message) {
  return Array.isArray(message?.attachments)
    && message.attachments.some(isQqImageAttachment);
}

/** Convert QQ's attachment metadata into lazily downloaded image references. */
export function qqInboundMessage(message, { fetchImpl = fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const images = [];
  for (const attachment of message?.attachments ?? []) {
    if (!isQqImageAttachment(attachment)) continue;
    const url = nonEmptyString(attachment?.url);
    const name = nonEmptyString(attachment?.filename) ?? undefined;
    const mediaType = attachmentMediaType(attachment);
    const declaredSize = Number(attachment?.size);
    images.push({
      ...(name ? { name } : {}),
      ...(mediaType?.startsWith('image/') ? { mediaType } : {}),
      ...(Number.isFinite(declaredSize) && declaredSize >= 0 ? { size: declaredSize } : {}),
      load: ({ signal, maxBytes }) => {
        if (!url) throw new Error('QQ image attachment has no download URL');
        return fetchImageBuffer(url, {
          fetchImpl,
          signal,
          maxBytes,
          allowedHosts: QQ_IMAGE_HOSTS,
        });
      },
    });
  }
  return { content: safeText(message), images };
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function artifactFailureText(fileName, error) {
  const name = String(fileName ?? '结果文件').replace(/[\r\n]+/g, ' ').trim() || '结果文件';
  if (error?.name === 'UploadDailyLimitExceededError') {
    return `结果文件「${name}」已生成，但 QQ 今日文件上传额度已用完，请稍后重试。`;
  }
  switch (error?.code) {
    case 'artifact-delivery-uncertain':
      return `结果文件「${name}」的发送结果未能确认，请先检查聊天内是否已收到，不要立即重试。`;
    case 'artifact-permission-required':
      return `结果文件「${name}」已生成，但当前 QQ 机器人没有文件消息权限。`;
    case 'artifact-too-large':
      return `结果文件「${name}」超过当前 QQ 机器人可发送的文件大小，未发送。`;
    case 'artifact-empty':
      return `结果文件「${name}」为空，QQ 不允许发送空文件。`;
    case 'artifact-changed':
    case 'artifact-invalid':
    case 'artifact-unavailable':
      return `结果文件「${name}」暂时无法读取或准备发送，请确认文件仍可访问后重试。`;
    case 'artifact-rate-limited':
      return `结果文件「${name}」暂时被 QQ 限流，未能发送，请稍后重试。`;
    case 'artifact-provider-rejected':
      return `结果文件「${name}」已生成，但 QQ 拒绝了该文件或文件消息。`;
    default:
      return `结果文件「${name}」已生成，但暂时未能通过 QQ 发送，请稍后重试。`;
  }
}

function answerTextForDelivery(answer, artifacts) {
  if (typeof answer === 'string' && answer.trim()) return answer;
  return artifacts.length > 0 ? '结果文件已生成。' : answer;
}

function qqArtifactError(error, { dispatched = false } = {}) {
  if (error?.code?.startsWith?.('artifact-') || error?.name === 'UploadDailyLimitExceededError') {
    return error;
  }
  const status = Number(error?.httpStatus);
  const wrapped = new Error('QQ file delivery failed', { cause: error });
  if (status === 401 || status === 403) wrapped.code = 'artifact-permission-required';
  else if (status === 413) wrapped.code = 'artifact-too-large';
  else if (status === 429) wrapped.code = 'artifact-rate-limited';
  else if (status === 400 || status === 404) {
    wrapped.code = 'artifact-provider-rejected';
  } else {
    wrapped.code = dispatched ? 'artifact-delivery-uncertain' : 'artifact-provider-failed';
  }
  return wrapped;
}

function abortReason(signal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted', 'AbortError');
}

function waitWithSignal(promise, signal) {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      callback(value);
    };
    const onAbort = () => finish(reject, abortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error),
    );
    if (signal.aborted) onAbort();
  });
}

function canClaimInteractionReply(message, pending) {
  return pending.questions[pending.index]
    && nonEmptyString(message?.senderId) === pending.actor
    && (message.kind !== 'group' || message.rawEventType === 'GROUP_AT_MESSAGE_CREATE')
    && !hasQqImageAttachments(message)
    && nonEmptyString(safeText(message));
}

export function createQqBridgeStatus() {
  return {
    messagesReceived: 0,
    messagesReplied: 0,
    messagesRejected: 0,
    artifactsSent: 0,
    artifactSendErrors: 0,
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
  #fetchImpl;
  #fileUploadTimeoutMs;
  #queues = new Map();
  #pendingInteractions = new Map();
  #interactionKeys = new Map();
  #acceptedMessageIds = new Set();
  #approvalTasks = new Set();
  #commandTasks = new Set();
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
    fetchImpl = fetch,
    fileUploadTimeoutMs = DEFAULT_FILE_UPLOAD_TIMEOUT_MS,
  }) {
    if (!bot || typeof bot.sendText !== 'function') throw new TypeError('QQ bot client is required');
    if (!ownerUserOpenid) throw new TypeError('QQ scanner identity is required');
    if (!harness || !state) throw new TypeError('Harness client and state store are required');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
    if (!Number.isInteger(fileUploadTimeoutMs) || fileUploadTimeoutMs < 1) {
      throw new TypeError('fileUploadTimeoutMs must be a positive integer');
    }
    this.#bot = bot;
    this.#ownerUserOpenid = ownerUserOpenid;
    this.#harness = harness;
    this.#state = state;
    this.#status = status;
    this.#logger = logger;
    this.#replyTimeoutMs = replyTimeoutMs;
    this.#signal = signal;
    this.#fetchImpl = fetchImpl;
    this.#fileUploadTimeoutMs = Math.min(fileUploadTimeoutMs, DEFAULT_FILE_UPLOAD_TIMEOUT_MS);
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
    if (message.kind === 'c2c'
      && (this.#ownerUserOpenid === '*' || sender === this.#ownerUserOpenid)
      && message.replyTarget?.scope === 'c2c'
      && nonEmptyString(message.replyTarget.targetId) === sender) {
      rememberConnectionTestTarget(this.#state, message.replyTarget);
    }
    const pending = this.#pendingInteractions.get(key);
    const commandText = safeText(message);
    const commandRunner = isControlCommand(commandText)
      ? runControlCommand
      : (isModelCommand(commandText)
          ? runModelCommand
          : (isPresetCommand(commandText) ? runPresetCommand : null));
    const allowed = this.#ownerUserOpenid === '*' || sender === this.#ownerUserOpenid;
    const addressed = message.kind !== 'group'
      || message.rawEventType === 'GROUP_AT_MESSAGE_CREATE';
    if (commandRunner && allowed && addressed) {
      let task;
      task = this.#processFastCommand(
        message,
        messageId,
        key,
        commandText,
        commandRunner,
      ).catch((error) => {
        if (error?.code === 'turn-stopped' || this.#signal?.aborted) return;
        this.#status.lastError = error?.message ?? String(error);
        this.#logger.error?.('[dsh-im:qq] failed to process a command:', error);
        return this.#bot.sendText(message.replyTarget, '消息处理失败，请稍后重试。')
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
      text: hasQqImageAttachments(message) ? '' : safeText(message),
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
      ...this.#commandTasks,
    ]);
  }

  async #processFastCommand(message, messageId, key, text, runner) {
    this.#signal?.throwIfAborted();
    if (this.#state.hasSeen(messageId)) return;
    await this.#state.markSeen(messageId);
    this.#status.messagesReceived += 1;
    this.#status.lastMessageAt = new Date().toISOString();
    const result = await runner(text, this.#harness, this.#state, key, {
      signal: this.#signal,
      hasImages: hasQqImageAttachments(message),
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
      if (reply) await this.#bot.sendText(message.replyTarget, reply);
    }
    this.#status.lastError = null;
  }

  async #deliverArtifacts(target, replyTo, artifacts = [], baseReceipt = null) {
    if (artifacts.length === 0) {
      return { receipt: baseReceipt, failureNoticeVisible: false };
    }
    const receipts = baseReceipt ? [baseReceipt] : [];
    let failureNoticeVisible = false;
    for (const artifact of artifacts) {
      this.#signal?.throwIfAborted();
      try {
        if (typeof this.#bot.sendFile !== 'function') {
          const unavailable = new Error('QQ file delivery is unavailable');
          unavailable.code = 'artifact-provider-unavailable';
          throw unavailable;
        }
        const file = await materializeOutboundArtifact(artifact, {
          signal: this.#signal,
        });
        this.#signal?.throwIfAborted();
        let result;
        try {
          const timeout = AbortSignal.timeout(this.#fileUploadTimeoutMs);
          const waitSignal = this.#signal ? AbortSignal.any([this.#signal, timeout]) : timeout;
          const pending = this.#bot.sendFile(
            target,
            { buffer: file.bytes },
            {
              fileName: file.fileName,
              onProgress: () => this.#signal?.throwIfAborted(),
            },
          );
          trackOutboundArtifactProviderPromise(file, pending);
          result = await waitWithSignal(pending, waitSignal);
        } catch (error) {
          if (this.#signal?.aborted) throw abortReason(this.#signal);
          throw qqArtifactError(error, { dispatched: true });
        }
        this.#signal?.throwIfAborted();
        const messageId = nonEmptyString(result?.message?.id);
        receipts.push(createDeliveryReceipt({
          deliveryId: file.deliveryKey,
          presentation: 'qq-file',
          providerMessageIds: messageId ? [messageId] : [],
          artifacts: [{ artifactId: file.artifactId, outcome: 'sent' }],
        }));
        this.#status.artifactsSent = (this.#status.artifactsSent ?? 0) + 1;
      } catch (rawError) {
        if (this.#signal?.aborted) throw rawError;
        const error = qqArtifactError(rawError);
        this.#status.artifactSendErrors = (this.#status.artifactSendErrors ?? 0) + 1;
        this.#logger.warn?.(
          `[dsh-im:qq] result file delivery failed (${error?.code ?? error?.name ?? 'unknown'})`,
        );
        let providerMessageIds = [];
        try {
          const notice = await this.#bot.sendText(target, artifactFailureText(artifact?.fileName, error));
          failureNoticeVisible = true;
          providerMessageIds = providerMessageIdsFor(notice);
        } catch (noticeError) {
          if (this.#signal?.aborted) throw noticeError;
          this.#logger.warn?.('[dsh-im:qq] unable to send the safe result-file failure notice');
        }
        receipts.push(createArtifactFailureReceipt({
          artifactId: artifact?.artifactId ?? 'unknown',
          deliveryId: artifact?.deliveryKey ?? artifact?.artifactId ?? 'unknown',
          error,
          providerMessageIds,
        }));
      } finally {
        releaseOutboundArtifact(artifact);
      }
    }
    return {
      receipt: mergeDeliveryReceipts({
        deliveryId: replyTo,
        presentation: baseReceipt ? 'qq-text-and-files' : 'qq-files',
        receipts,
      }),
      failureNoticeVisible,
    };
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
    const promptMessage = qqInboundMessage(message, { fetchImpl: this.#fetchImpl });
    const text = promptMessage.content;
    const hasImages = hasInboundImages(promptMessage);
    let stream = null;
    try {
      if (!text && !hasImages) {
        await this.#bot.sendText(target, '目前支持文字和图片消息。');
        await this.#state.markSeen(messageId);
        return;
      }
      const command = text.toLowerCase();
      if (!hasImages && command === '/help') {
        await this.#bot.sendText(target, HELP_TEXT);
        await this.#state.markSeen(messageId);
        return;
      }
      if (!hasImages && command === '/status') {
        await this.#harness.ensureRunning({ signal: this.#signal });
        await this.#bot.sendText(target, 'QQ 机器人与 DeepSeek Harness 连接正常。');
        await this.#state.markSeen(messageId);
        return;
      }
      if (!hasImages && command === '/new') {
        await this.#state.clearSession(key);
        await this.#bot.sendText(target, '已开启新会话。请发送你的问题。');
        await this.#state.markSeen(messageId);
        return;
      }
      const workspaceCommand = hasImages
        ? null
        : await runWorkspaceCommand(text, this.#harness, key);
      if (workspaceCommand) {
        for (const reply of workspaceCommand.messages ?? [workspaceCommand.message]) {
          await this.#bot.sendText(target, reply);
        }
        await this.#state.markSeen(messageId);
        return;
      }
      const compactCommand = hasImages
        ? null
        : await runCompactCommand(
            text,
            this.#harness,
            this.#state,
            key,
            { signal: this.#signal },
          );
      if (compactCommand) {
        await this.#bot.sendText(target, compactCommand.message);
        await this.#state.markSeen(messageId);
        return;
      }

      const content = hasImages
        ? await promptContentForMessage(promptMessage, { signal: this.#signal })
        : undefined;
      let streamFinished = false;
      if (message.kind === 'c2c' && target?.msgId && typeof this.#bot.openStream === 'function') {
        try {
          stream = this.#bot.openStream({ target });
        } catch (error) {
          this.#logger.warn?.('[dsh-im:qq] unable to start a QQ stream; using a text reply:', error);
        }
      }
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
      this.#signal?.throwIfAborted();
      const displayAnswer = answerTextForDelivery(answer, artifacts);
      let textReceipt = null;
      let textSendError = null;
      try {
        if (stream) {
          try {
            await stream.update(displayAnswer);
            await stream.complete();
            streamFinished = true;
            textReceipt = createDeliveryReceipt({
              deliveryId: messageId,
              presentation: 'qq-text',
              providerMessageIds: providerMessageIdsFor(stream),
            });
          } catch (error) {
            stream.cancel?.();
            this.#logger.warn?.('[dsh-im:qq] QQ stream finalization failed; using a text reply:', error);
          }
        }
        if (!streamFinished) {
          const sent = await this.#bot.sendText(target, displayAnswer);
          textReceipt = createDeliveryReceipt({
            deliveryId: messageId,
            presentation: 'qq-text',
            providerMessageIds: providerMessageIdsFor(sent),
          });
        }
      } catch (error) {
        textSendError = error;
        this.#logger.warn?.('[dsh-im:qq] final text delivery failed; continuing with result files:', error);
      }
      const delivery = await this.#deliverArtifacts(target, messageId, artifacts, textReceipt);
      const artifactDispatched = delivery.receipt?.artifacts?.some(
        ({ outcome }) => outcome === 'sent' || outcome === 'unknown',
      );
      if (textSendError && !artifactDispatched && !delivery.failureNoticeVisible) {
        throw textSendError;
      }
      await this.#state.markSeen(messageId);
      this.#status.messagesReplied += 1;
      this.#status.lastReplyAt = new Date().toISOString();
      this.#status.lastError = null;
      return delivery.receipt;
    } catch (error) {
      if (error?.code === 'turn-stopped') {
        if (stream) {
          try {
            await stream.cancel?.();
          } catch (streamError) {
            this.#logger.warn?.('[dsh-im:qq] unable to cancel a stopped QQ stream:', streamError);
          }
          try {
            await this.#bot.sendText(target, '已停止。');
          } catch (sendError) {
            this.#logger.warn?.('[dsh-im:qq] unable to announce a stopped QQ turn:', sendError);
          }
        }
        await this.#state.markSeen(messageId);
        return;
      }
      stream?.cancel?.();
      if (this.#signal?.aborted) return;
      this.#status.lastError = error?.message ?? String(error);
      this.#logger.error?.('[dsh-im:qq] failed to process an inbound message:', error);
      try {
        await this.#bot.sendText(
          target,
          imagePromptUserMessage(error) ?? '消息处理失败，请稍后重试。',
        );
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
    if (!text || hasQqImageAttachments(message)) {
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
