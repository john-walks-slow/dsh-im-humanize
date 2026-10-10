/**
 * Busy-message routing: what happens to a message that arrives while a turn
 * is already being generated.
 *
 * - interrupt: supersede the in-flight turn and process the new message as a
 *   fresh turn (the humanize fork's default: the user only perceives the
 *   newest turn, never the interruption).
 * - queue: let the current turn finish, then process the message.
 * - steer: inject the message into the running turn as a correction.
 *
 * The mode is configured in two places and resolved in one direction:
 * a bot's own stored choice (workspaces.json `busyMessageModes`) wins over
 * the global humanization setting, which wins over the shipped default.
 *
 * Browser-safe: imported by the host, the bridges, and the client bundle.
 */
export const SET_MESSAGE_MODE_ENDPOINT = 'bot.message-mode.set';

export const BUSY_MESSAGE_MODES = Object.freeze(['interrupt', 'queue', 'steer']);
export const DEFAULT_BUSY_MESSAGE_MODE = 'interrupt';

/**
 * Stop reason recorded when a new message supersedes an in-flight turn
 * (interrupt mode). Channels read it off the `turn-stopped` error to stay
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
 * Lenient read of a configured mode: unknown values (including an unset
 * global setting) fall back to the shipped default.
 */
export function normalizeBusyMessageMode(value) {
  return BUSY_MESSAGE_MODES.includes(value) ? value : DEFAULT_BUSY_MESSAGE_MODE;
}

/**
 * Read a mode from the per-bot store. Returns undefined for "this bot has no
 * choice of its own" — the caller resolves the global setting then, so an
 * unset bot must not be pinned to a concrete mode here.
 */
export function storedBusyMessageMode(value) {
  return BUSY_MESSAGE_MODES.includes(value) ? value : undefined;
}

export function validateBusyMessageMode(value) {
  if (!BUSY_MESSAGE_MODES.includes(value)) {
    throw new TypeError(`Message mode must be one of ${BUSY_MESSAGE_MODES.join(', ')}`);
  }
  return value;
}

export function validMessageModePayload(payload) {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    && Object.keys(payload).length === 2
    && typeof payload.botId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(payload.botId)
    && BUSY_MESSAGE_MODES.includes(payload.busyMessageMode);
}
