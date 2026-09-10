/**
 * Session-sync ownership registry: records which delivery targets of a
 * session are being mirrored as process cards by their owning bridge.
 *
 * The plain-text session-sync coordinator and the per-bridge card mirror
 * observe the same global session events. When a bridge mirrors a turn to a
 * specific target, the coordinator must suppress the plain-text delivery for
 * THAT target only — other targets (same or other channels) still receive
 * their normal text. Both sides live in the same Host process, so a
 * module-level registry is the whole contract: the mirror claims a target
 * when it opens the mirror card and releases it when the turn ends.
 */
const claimed = new Map();

function keyOf(sessionId, targetId) {
  return `${sessionId}\0${targetId ?? ''}`;
}

export function claimSessionSyncMirror(sessionId, targetId = '', turn = null) {
  if (typeof sessionId !== 'string' || !sessionId) return;
  claimed.set(keyOf(sessionId, targetId), { turn, claimedAt: Date.now() });
}

export function releaseSessionSyncMirror(sessionId, targetId = '') {
  claimed.delete(keyOf(sessionId, targetId));
}

/** True when a live mirror claim covers this session and target. */
export function isSessionSyncMirrored(sessionId, targetId = '', turn = null) {
  const claim = claimed.get(keyOf(sessionId, targetId));
  if (!claim) return false;
  if (turn !== null && claim.turn !== null && claim.turn !== turn) return false;
  return true;
}
