import { steerMessage } from './control-command.mjs';
import { isSharedLocalCommand } from './command-permission.mjs';
import { evaluateInboundAccess } from './inbound-access.mjs';
import { normalizeBusyMessageMode, SUPERSEDED_STOP_REASON } from './message-mode.mjs';
import { t } from './i18n.mjs';
import {
  messageFailureDiagnostic, messageFailureText, setLastMessageFailure,
} from './message-failure.mjs';

export function canAutomaticallySteer(policy, conversationType, senderIds) {
  // Legacy bridges have already checked their owner/allowlist at acceptance.
  return !policy || evaluateInboundAccess(policy, {
    conversationType, senderIds, text: '/steer', isCommand: true,
  }).allowed;
}

/** Serialize only routing/submission, leaving the existing task queues intact. */
export class BusyMessageDispatcher {
  #tails = new Map();
  #tasks = new Set();

  dispatch({
    key, messageId, text, commandText = text, eligible, harness, state, status,
    control, signal, enhancement, pendingInteraction, acceptedMessageIds,
    mode = harness.currentBusyMessageMode?.(), onFailure, abortPreAsk,
    enqueue, isQueued, send, logger = console, onSteered, onError,
  }) {
    // Read once, before any await: a settings change cannot reinterpret this input.
    const resolved = normalizeBusyMessageMode(mode);
    const steer = resolved === 'steer'
      && (typeof eligible === 'function' ? eligible() : eligible) && Boolean(text?.trim()) && !isSharedLocalCommand(commandText);
    // Only a busy key can be superseded, and a turn waiting for a question or
    // an approval must never be thrown away: interrupting would lose it.
    const interrupt = resolved === 'interrupt' && isQueued() && !pendingInteraction();
    const report = async (error) => {
      onFailure?.(error);
      if (signal?.aborted || error?.code === 'turn-stopped') return;
      if (onError) return onError(error);
      status.lastError = error?.message ?? String(error);
      const failure = setLastMessageFailure(status, error);
      logger.error?.('[dsh-im] failed to route a message:', messageFailureDiagnostic(error, failure));
      await Promise.resolve().then(() => send(messageFailureText(failure))).catch(() => undefined);
    };
    const queue = (alreadyRecorded = false, { quiet = false } = {}) => {
      const waiting = isQueued();
      // Reserve FIFO position before sending the optional receipt.
      const completion = enqueue({ alreadyRecorded });
      const receipt = waiting && !quiet
        ? Promise.resolve().then(() => send(t('已排队，等待前序消息处理。'))).catch((error) => {
            logger.warn?.('[dsh-im] failed to send queue receipt:', error);
          })
        : Promise.resolve();
      return { completion: Promise.all([completion, receipt]).then(([result]) => result) };
    };
    // interrupt: supersede the in-flight turn. The silent pre-ask phase (read
    // delay, image staging, stream opening) is aborted first — stopActiveTurn
    // cannot cancel a turn that has not reached the harness yet, so without it
    // the new message would wait out the whole delayed turn and both replies
    // would race. Unconditional, deliberately not gated by any feature flag.
    const supersede = () => {
      abortPreAsk?.();
      const reserved = queue(false, { quiet: true });
      this.#stopSupersededTurn({ harness, state, key, control, signal, logger });
      return reserved;
    };
    const route = async () => {
      signal?.throwIfAborted();
      if (!steer || pendingInteraction()) return queue();
      if (state.hasSeen(messageId)) return {};
      await state.markSeen(messageId);
      status.messagesReceived = (status.messagesReceived ?? 0) + 1;
      status.lastMessageAt = new Date().toISOString();
      signal?.throwIfAborted();
      const submitted = await steerMessage(text, harness, state, key, {
        signal, control, enhancement, pendingInteraction: pendingInteraction(),
      });
      if (!submitted) return queue(true);
      // Submission is final even if its receipt fails.
      await send(t('已提交补充指令，Agent 会在下一步读取。'));
      await onSteered?.();
      status.lastError = null;
      return {};
    };

    const previous = this.#tails.get(key);
    // Interrupting bypasses the routing tail (it must preempt, not queue
    // behind a steering decision); the default/attachment path keeps its
    // synchronous queue reservation.
    const routed = interrupt ? Promise.resolve(supersede())
      : !previous && !steer
      ? Promise.resolve(queue())
      : (previous ?? Promise.resolve()).catch(() => undefined).then(route);
    const tail = routed.then(() => undefined, () => undefined);
    this.#tails.set(key, tail);
    void tail.then(() => {
      if (this.#tails.get(key) === tail) this.#tails.delete(key);
    });
    const task = routed.catch(async (error) => {
      await report(error);
      return {};
    }).then(({ completion }) => completion).finally(() => {
      acceptedMessageIds.delete(messageId);
      this.#tasks.delete(task);
    });
    this.#tasks.add(task);
    return task;
  }

  async whenIdle() {
    await Promise.allSettled([...this.#tasks]);
  }

  /** The workspace session a conversation key currently maps to, if any. */
  #stopSupersededTurn({ harness, state, key, control, signal, logger }) {
    if (typeof state?.sessionFor !== 'function') return;
    const sessionId = state.sessionFor(key);
    if (typeof sessionId !== 'string' || !sessionId) return;
    if (typeof harness?.workspaceSession !== 'function') return;
    const session = harness.workspaceSession(sessionId);
    if (typeof session?.stopActiveTurn !== 'function') return;
    // Fire-and-forget: controlExecutor is synchronous, and the superseded
    // turn's ask() polling loop sees turn/end on its next poll (~300 ms).
    void session.stopActiveTurn(control, {
      ...(signal ? { signal } : {}),
      reason: SUPERSEDED_STOP_REASON,
    }).catch((error) => {
      logger.warn?.('[dsh-im] interrupt stopActiveTurn failed:', error?.message ?? error);
    });
  }
}
