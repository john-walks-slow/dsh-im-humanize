/**
 * Compose-phase typing indicator session — phase ② of the two-phase model.
 *
 * The session simulates "the human is typing / thinking, intermittently":
 *
 * - continuous: sendTyping fires immediately, then every `refreshMs`
 *   (platform indicator lifetime is always longer than refreshMs).
 * - burst (residual-aware): random ON phase (`burst.onMinMs..onMaxMs`,
 *   refreshed at refreshMs inside), then a dark phase. Platform indicators
 *   keep glowing for a residual lifetime after the LAST send (Telegram
 *   ~5s, Discord ~10s), so a naive "stop sending" dark phase shorter than
 *   the residual is INVISIBLE. The session therefore:
 *     - on platforms WITH an explicit cancel (stopTyping, e.g. WhatsApp
 *       'paused'): calls stopTyping at the dark start — the dark phase is
 *       visible immediately (darkResidualMs = 0);
 *     - on platforms WITHOUT a cancel: sends one final refresh at the
 *       ON→OFF transition and sleeps `visibleDark + darkResidualMs` from
 *       that final send, so the configured VISIBLE dark time is honest.
 *   The "slow" fade is what real humans look like on these platforms —
 *   Telegram only drops the indicator >5s after the last keystroke.
 *
 * Lifecycle is bound to the bridge turn: start() after the read delay,
 * stop() in the turn's finally. pause()/resume() for pending interactions
 * ("waiting for the other side, not typing"). restartOn(action) for
 * message-break segment gaps and Telegram attachment actions.
 *
 * Browser-safe module, but in practice only used by host bridges.
 */

export const TYPING_INDICATOR_MODES = Object.freeze(['off', 'continuous', 'burst']);
export const DEFAULT_TYPING_INDICATOR = 'burst';

export const DEFAULT_TYPING_BURST = Object.freeze({
  onMinMs: 3000,
  onMaxMs: 6000,
  offMinMs: 1500,
  offMaxMs: 4000,
});

const BURST_MS_ABSOLUTE_MAX = 60_000;
const FAILURE_LOG_WINDOW_MS = 10_000;

const defaultScheduler = Object.freeze({
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (timer) => clearTimeout(timer),
});

function finiteNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalize the typingIndicator value. Legacy booleans map
 * true → 'burst', false → 'off' (an on-boolean means "humanized on",
 * which since r4 is the burst rhythm).
 */
export function normalizeTypingIndicator(value) {
  if (typeof value === 'boolean') return value ? 'burst' : 'off';
  return TYPING_INDICATOR_MODES.includes(value) ? value : DEFAULT_TYPING_INDICATOR;
}

/**
 * Lenient normalization of the burst rhythm parameters (visible semantics).
 */
export function normalizeTypingBurst(partial) {
  const source = partial && typeof partial === 'object' && !Array.isArray(partial)
    ? partial
    : {};
  let onMinMs = clamp(
    finiteNumber(source.onMinMs, DEFAULT_TYPING_BURST.onMinMs),
    0,
    BURST_MS_ABSOLUTE_MAX,
  );
  let onMaxMs = clamp(
    finiteNumber(source.onMaxMs, DEFAULT_TYPING_BURST.onMaxMs),
    0,
    BURST_MS_ABSOLUTE_MAX,
  );
  if (onMinMs > onMaxMs) [onMinMs, onMaxMs] = [onMaxMs, onMinMs];
  let offMinMs = clamp(
    finiteNumber(source.offMinMs, DEFAULT_TYPING_BURST.offMinMs),
    0,
    BURST_MS_ABSOLUTE_MAX,
  );
  let offMaxMs = clamp(
    finiteNumber(source.offMaxMs, DEFAULT_TYPING_BURST.offMaxMs),
    0,
    BURST_MS_ABSOLUTE_MAX,
  );
  if (offMinMs > offMaxMs) [offMinMs, offMaxMs] = [offMaxMs, offMinMs];
  return { onMinMs, onMaxMs, offMinMs, offMaxMs };
}

function invalid(field, message) {
  const error = new Error(message);
  error.code = 'invalid-typing-burst';
  error.field = field;
  return error;
}

/**
 * Strict validation for RPC / UI writes. Throws Error with
 * `code = 'invalid-typing-burst'` and a `field` path; does not coerce.
 */
export function validateTypingBurst(burst) {
  if (burst === undefined) return;
  if (!burst || typeof burst !== 'object' || Array.isArray(burst)) {
    throw invalid('typingBurst', 'typingBurst must be an object.');
  }
  const fields = ['onMinMs', 'onMaxMs', 'offMinMs', 'offMaxMs'];
  for (const field of fields) {
    const value = burst[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw invalid(`typingBurst.${field}`, `${field} must be a finite number.`);
    }
    if (value < 0 || value > BURST_MS_ABSOLUTE_MAX) {
      throw invalid(`typingBurst.${field}`, `${field} must be between 0 and ${BURST_MS_ABSOLUTE_MAX}.`);
    }
  }
  if (burst.onMinMs > burst.onMaxMs) {
    throw invalid('typingBurst.onMinMs', 'onMinMs must be ≤ onMaxMs.');
  }
  if (burst.offMinMs > burst.offMaxMs) {
    throw invalid('typingBurst.offMinMs', 'offMinMs must be ≤ offMaxMs.');
  }
}

/**
 * Create one typing session for one target. The bridge keeps one session
 * per conversation key. `sendTyping(action?)` sends a single indicator
 * update; `stopTyping()` (optional) explicitly clears it (WhatsApp
 * 'paused'). `signal` aborts → best-effort stop + cleanup.
 *
 * All timers are unref'd; failures are logged at most once per
 * FAILURE_LOG_WINDOW_MS and never break the loop.
 */
export function createTypingSession({
  sendTyping,
  stopTyping = null,
  refreshMs = 4000,
  darkResidualMs = 0,
  mode = 'continuous',
  burst = DEFAULT_TYPING_BURST,
  random = Math.random,
  logger = console,
  signal = null,
  scheduler = defaultScheduler,
} = {}) {
  if (typeof sendTyping !== 'function') {
    throw new TypeError('createTypingSession requires a sendTyping function');
  }
  const resolvedMode = mode === 'burst' ? 'burst' : 'continuous';
  const rhythm = normalizeTypingBurst(burst);
  const hasExplicitStop = typeof stopTyping === 'function';

  let running = false;
  let paused = false;
  let timer = null;
  let lastSendAt = 0;
  let lastFailureLogAt = Number.NEGATIVE_INFINITY;

  function logFailure(error) {
    const now = scheduler.now();
    if (now - lastFailureLogAt < FAILURE_LOG_WINDOW_MS) return;
    lastFailureLogAt = now;
    logger.warn?.('[dsh-im] typing indicator failed:', error?.message ?? error);
  }

  function clearTimer() {
    if (timer !== null) {
      scheduler.clearTimeout(timer);
      timer = null;
    }
  }

  async function fire(action) {
    try {
      await sendTyping(action);
      lastSendAt = scheduler.now();
      return true;
    } catch (error) {
      logFailure(error);
      return false;
    }
  }

  async function fireExplicitStop() {
    if (!hasExplicitStop) return;
    try {
      await stopTyping();
    } catch (error) {
      logFailure(error);
    }
  }

  function arm(ms, step) {
    const handle = scheduler.setTimeout(() => {
      timer = null;
      void step();
    }, ms);
    handle?.unref?.();
    timer = handle;
  }

  function uniform(minMs, maxMs) {
    if (maxMs <= minMs) return minMs;
    return minMs + random() * (maxMs - minMs);
  }

  async function stepContinuous() {
    if (!running || paused) return;
    await fire();
    if (!running || paused) return;
    arm(refreshMs, stepContinuous);
  }

  /**
   * Burst on-phase. `remainingMs` counts down by refreshMs; each refresh
   * re-fires the indicator. When the on-phase ends we transition to the
   * dark phase (see module doc for the residual math).
   */
  async function stepBurstOn(remainingMs, action) {
    if (!running || paused) return;
    if (remainingMs <= 0) {
      await enterBurstOff(action);
      return;
    }
    const untilRefresh = Math.min(refreshMs, remainingMs);
    arm(untilRefresh, async () => {
      if (!running || paused) return;
      const nextRemaining = remainingMs - untilRefresh;
      if (nextRemaining <= 0) {
        await enterBurstOff(action);
        return;
      }
      await fire(action);
      if (!running || paused) return;
      await stepBurstOn(nextRemaining, action);
    });
  }

  async function enterBurstOff(action) {
    if (!running || paused) return;
    if (hasExplicitStop) {
      // Explicit cancel: the indicator dies right now; sleep only the
      // visible dark time.
      await fireExplicitStop();
      if (!running || paused) return;
      const visibleDarkMs = uniform(rhythm.offMinMs, rhythm.offMaxMs);
      arm(visibleDarkMs, () => void startOnPhase(action));
      return;
    }
    // No cancel API: pin the residual clock with one final refresh, then
    // sleep residual + visible dark so the dark phase is honest.
    await fire(action);
    if (!running || paused) return;
    const visibleDarkMs = uniform(rhythm.offMinMs, rhythm.offMaxMs);
    arm(visibleDarkMs + darkResidualMs, () => void startOnPhase(action));
  }

  async function startOnPhase(action) {
    if (!running || paused) return;
    await fire(action);
    if (!running || paused) return;
    if (resolvedMode === 'continuous') {
      arm(refreshMs, stepContinuous);
    } else {
      const onMs = uniform(rhythm.onMinMs, rhythm.onMaxMs);
      await stepBurstOn(onMs, action);
    }
  }

  function handleAbort() {
    stopSession();
  }

  function stopSession() {
    if (!running) {
      clearTimer();
      return;
    }
    running = false;
    paused = false;
    clearTimer();
    signal?.removeEventListener('abort', handleAbort);
    void fireExplicitStop();
  }

  const session = {
    /** Start (or restart) the session: immediate send + scheduled loop. */
    async start(action = undefined) {
      if (running) return;
      running = true;
      paused = false;
      if (signal && !signal.aborted) {
        signal.addEventListener('abort', handleAbort, { once: true });
      }
      if (signal?.aborted) {
        // Pre-aborted signal (e.g. plugin shutdown racing the read-delay
        // resolve): settle into the stopped state without touching timers.
        stopSession();
        return;
      }
      await startOnPhase(action);
    },

    /** Pause for a pending interaction/approval (indicator off). */
    async pause() {
      if (!running || paused) return;
      paused = true;
      clearTimer();
      await fireExplicitStop();
    },

    /** Resume after a pending interaction resolved. */
    async resume(action = undefined) {
      if (!running || !paused) return;
      paused = false;
      await startOnPhase(action);
    },

    /**
     * Restart the on-phase (fresh indicator + fresh rhythm). Used for
     * message-break segment gaps ("typing the next message") and Telegram
     * attachment actions (upload_photo / upload_document).
     */
    async restartOn(action = undefined) {
      if (!running || paused) return;
      clearTimer();
      await startOnPhase(action);
    },

    /** Stop the session and clear the indicator where possible. */
    stop: stopSession,

    isActive() {
      return running && !paused;
    },

    /** Time of the last successful sendTyping (ms, scheduler clock). */
    lastSendAt() {
      return lastSendAt;
    },
  };

  return session;
}
