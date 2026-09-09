/**
 * Shared humanization settings resolver for bridges.
 *
 * Bridges receive a `humanize` provider ({ getSettings() }) from their
 * runtime and resolve settings once per turn so global (humanize.json) and
 * per-bot (workspaces.json) updates apply live. Constructor-snapshot
 * values (streaming/messageBreak/onNewMessage) remain as fallbacks for
 * direct constructions (tests, embedded use) where no provider is wired.
 *
 * Provider output is normally already normalized (see
 * createHumanizeProvider); this resolver normalizes defensively again —
 * all normalizers are idempotent.
 */
import { normalizeOnNewMessage } from './new-message-policy.mjs';
import { normalizeSendDelayConfig } from './send-delay.mjs';
import { normalizeTypingBurst, normalizeTypingIndicator } from './typing-session.mjs';

export function resolveHumanizeSettings({
  humanize = null,
  streaming = true,
  messageBreak = false,
  onNewMessage = 'interrupt',
} = {}) {
  const provided = typeof humanize?.getSettings === 'function'
    ? humanize.getSettings()
    : null;
  const source = provided && typeof provided === 'object' ? provided : {};
  return {
    streaming: typeof source.streaming === 'boolean' ? source.streaming : streaming !== false,
    messageBreak: typeof source.messageBreak === 'boolean' ? source.messageBreak : messageBreak === true,
    onNewMessage: normalizeOnNewMessage(source.onNewMessage ?? onNewMessage),
    sendDelay: normalizeSendDelayConfig(source.sendDelay),
    typingIndicator: normalizeTypingIndicator(source.typingIndicator),
    typingBurst: normalizeTypingBurst(source.typingBurst),
    statusReaction: typeof source.statusReaction === 'boolean' ? source.statusReaction : true,
    replyQuote: typeof source.replyQuote === 'boolean' ? source.replyQuote : true,
  };
}
