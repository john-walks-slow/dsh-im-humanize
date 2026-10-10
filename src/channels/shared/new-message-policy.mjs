/**
 * Shared helpers for the onNewMessage policy: interrupt | queue | steer.
 *
 * Each bridge implements its own queue/process logic, but the condition
 * checks and normalization are shared here.
 */

export const ON_NEW_MESSAGE_MODES = Object.freeze(['interrupt', 'queue', 'steer']);
export const DEFAULT_ON_NEW_MESSAGE = 'interrupt';

/**
 * Stop reason recorded when a new message supersedes an in-flight turn
 * (interrupt policy). Channels read it off the `turn-stopped` error to stay
 * silent: the user only perceives the newest turn, never the interruption.
 *
 * Distinct from the pre-ask `error.code = 'superseded'` (a turn aborted before
 * it reached the harness): same word, different failure carrier. Use
 * {@link isSupersededStop} for the stop reason, never on a pre-ask error.
 */
export const SUPERSEDED_STOP_REASON = 'superseded';

/** Whether a `turn-stopped` failure came from a newer message superseding it. */
export function isSupersededStop(error) {
  return error?.stopReason === SUPERSEDED_STOP_REASON;
}

/**
 * Normalize the onNewMessage config value.
 * Falls back to the default for unknown values.
 */
export function normalizeOnNewMessage(value) {
  return ON_NEW_MESSAGE_MODES.includes(value) ? value : DEFAULT_ON_NEW_MESSAGE;
}

/**
 * Decide which policy to apply for a newly arrived message.
 *
 * Returns one of 'interrupt', 'queue', 'steer', or null.
 * - null: no active turn → process normally (no policy needed)
 * - 'queue': always queue when a pending interaction or approval exists,
 *   regardless of the configured mode
 *
 * @param {object} options
 * @param {boolean} options.hasQueue — whether there is an active processing queue
 * @param {boolean} options.hasPendingInteraction — pending question/approval from any actor
 * @param {string} options.onNewMessage — the normalized mode
 */
export function resolveNewMessagePolicy({
  hasQueue,
  hasPendingInteraction,
  hasPendingApproval,
  onNewMessage,
}) {
  if (!hasQueue) return null;

  // When the turn is waiting for an interaction or approval, always queue.
  // Interrupting would lose the question; steering has no effect while idle.
  if (hasPendingInteraction || hasPendingApproval) return 'queue';

  return onNewMessage;
}

/**
 * Fire-and-forget stopActiveTurn.  Does not await — the stop is initiated
 * immediately so the old ask() polling loop detects turn/end within one poll
 * cycle (~300 ms).  The caller should set up the new queue entry BEFORE
 * calling this so the chain is ready when the old process settles.
 *
 * `reason` rides along into the accepted stop's ownership and is surfaced on
 * the resulting turn-stopped error, letting the caller distinguish a silent
 * supersede from an explicit /stop that must keep its feedback.
 *
 * @param {object} options
 * @param {object|null} options.session — workspace session (has stopActiveTurn)
 * @param {object} options.control — { owner, key } for ownership verification
 * @param {AbortSignal} [options.signal]
 * @param {string} [options.reason] — stop reason, e.g. SUPERSEDED_STOP_REASON
 * @param {object} [options.logger]
 */
export function fireAndForgetStop({ session, control, signal, reason, logger = console }) {
  if (!session || typeof session.stopActiveTurn !== 'function') return;
  const options = { ...(signal ? { signal } : {}), ...(reason ? { reason } : {}) };
  void session.stopActiveTurn(control, options)
    .catch((error) => {
      logger.warn?.('[dsh-im] interrupt stopActiveTurn failed:', error?.message ?? error);
    });
}

/**
 * Try to steer the active turn with the given text.
 *
 * Returns true if the steer was accepted (message consumed, no new turn needed).
 * Returns false if the turn has already ended or steer failed — the caller
 * should fall back to enqueuing the message as a new turn.
 *
 * @param {object} options
 * @param {object|null} options.session — workspace session (has steerActiveTurn)
 * @param {string} options.text — the steering instruction
 * @param {object} options.control — { owner, key } for ownership verification
 * @param {AbortSignal} [options.signal]
 * @param {object} [options.logger]
 * @returns {Promise<boolean>}
 */
export async function trySteer({
  session,
  text,
  control,
  signal,
  logger = console,
}) {
  if (!session || typeof session.steerActiveTurn !== 'function') return false;
  if (!text || !text.trim()) return false;
  try {
    const steered = await session.steerActiveTurn(
      text,
      control,
      signal ? { signal } : {},
    );
    return steered === true;
  } catch (error) {
    logger.warn?.('[dsh-im] steer failed, fallback to queue:', error?.message ?? error);
    return false;
  }
}
