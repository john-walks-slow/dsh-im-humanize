/**
 * message_break tool — a no-op tool the AI calls to mark a break point in its
 * response. The plugin detects the tool/call event in HarnessReplyTracker and
 * sends the accumulated text since the last break as a separate IM message.
 *
 * The tool itself does nothing (execute returns { ok: true }); the actual
 * message splitting happens in the bridge's onUpdate callback.
 *
 * The break is a trailing delimiter: it flushes the text written since the
 * previous break, so the model must call it AFTER the segment it wants sent,
 * never before starting one. A break with no new text since the last one is a
 * no-op — the text that follows waits for the next break or the final message.
 *
 * When messageBreak is enabled, each segment is delivered on its own:
 * streaming channels finalize the segment in the carrier that streamed it and
 * open a fresh carrier for the next one; channels without a carrier send each
 * segment as a separate message.
 *
 * Only a turn an IM channel is delivering can use it: the guidance renders for
 * such turns alone, and a call from any other turn is denied by the tool guard
 * (see installMessageBreakTool).
 */

import { outboundArtifactRegistry } from './semantic/artifact.mjs';

export const MESSAGE_BREAK_TOOL = 'message_break';
const MAX_MESSAGE_BREAKS_PER_TURN = 20;

/**
 * Denial reason for a turn no IM channel is delivering: the break would have
 * nothing to split, because only a channel bridge turns the tool call into
 * separate chat messages.
 */
const MESSAGE_BREAK_UNAVAILABLE = 'message_break only splits the messages a dsh-im chat is receiving, and this turn has no IM delivery consumer; nothing would be split. Reply normally instead.';

/**
 * Build the tool definition for ctx.tools.register().
 * Matches the pattern of dsh_im_return_file / ask_user_question.
 */
export function createMessageBreakToolDefinition() {
  return Object.freeze({
    name: MESSAGE_BREAK_TOOL,
    description: 'This tool is only meaningful in dsh-im sessions (where the context contains a <dsh_im> tag); calling it outside a dsh-im session is refused. Insert a message break to split your response into multiple shorter messages, like a human chatting. Write the segment first, then call this tool: everything you have written since the previous break is sent immediately as its own chat message. Never call it before you start writing a segment — an empty break sends nothing, and the text that follows waits for the next break. Text after the last break is sent as the final message. Call it at natural paragraph or topic boundaries. The tool takes no parameters. Do not use when the user message does not come from dsh-im.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
        },
        required: ['ok'],
      },
      render: () => [{ type: 'text', text: 'Message break inserted.' }],
    },
    async execute() {
      return { ok: true };
    },
  });
}

/**
 * Register the message_break tool, its ownership guard, and its guidance.
 *
 * The break only exists for an IM chat: the channel bridge turns the tool call
 * into separate chat messages. A turn no channel is delivering (Web, CLI, a
 * wake delivered by session sync) therefore gets neither the guidance nor a
 * successful call — the guard denies it, exactly like dsh_im_return_file
 * refuses a file no IM consumer can claim. Ownership is the artifact
 * registry's per-turn consumer, the plugin's single notion of "an IM channel
 * is delivering this turn".
 *
 * Returns true on success, false if the context lacks the required capabilities.
 */
export function installMessageBreakTool(ctx, { registry = outboundArtifactRegistry } = {}) {
  if (typeof ctx?.tools?.register !== 'function'
    || typeof ctx?.tools?.guard !== 'function'
    || typeof ctx?.systemPrompt?.context !== 'function') {
    return false;
  }
  const owned = (session) => registry.hasActiveConsumer(session);
  ctx.tools.register(createMessageBreakToolDefinition());
  ctx.tools.guard((exec) => exec?.name === MESSAGE_BREAK_TOOL && !owned(exec?.agent?.session)
    ? MESSAGE_BREAK_UNAVAILABLE
    : undefined);
  ctx.systemPrompt.context({
    name: 'dsh-im:message-break',
    order: 116,
    text: (assembly) => (owned(assembly?.agent?.session)
      ? 'When your response is long, split it into multiple shorter messages with the message_break tool, mimicking human chat style: write a segment, then call message_break to deliver it as its own chat message, then write the next segment. The break is a trailing delimiter — everything written since the previous break is sent at the call. Never call message_break before you start a segment: an empty break sends nothing, and the text that follows waits for the next break or the end of the turn. Text after the last break becomes the final message. Call it at natural paragraph or topic boundaries. The tool takes no parameters. Do not use when the user message does not come from dsh-im.'
      : ''),
  });
  return true;
}

/**
 * Create a handler that bridges wrap around their onUpdate callback.
 *
 * - handleUpdate(update): intercepts { type: 'message_break', text } updates,
 *   sends the segment text via sendSegment, and returns null (consumed).
 *   All other updates are passed through unchanged.
 * - remainingText(fullAnswer): computes the text that should be sent as the
 *   final message (everything after the last break point).
 * - hasBreaks(): whether any message_break was seen during this turn.
 *
 * @param {object} options
 * @param {function} options.sendSegment — async (text) => void; sends one segment
 * @param {object} [options.logger]
 */
export function createMessageBreakHandler({ sendSegment, logger = console }) {
  let sentText = '';
  let breakCount = 0;
  let breakerLogged = false;
  let emptyLogged = false;

  return {
    async handleUpdate(update) {
      if (!update || update.type !== 'message_break') return update;

      if (breakCount >= MAX_MESSAGE_BREAKS_PER_TURN) {
        if (!breakerLogged) {
          breakerLogged = true;
          logger.warn?.(
            `[dsh-im] message_break hit ${MAX_MESSAGE_BREAKS_PER_TURN} messages for this turn; staying silent until it ends`,
          );
        }
        return null; // consume but don't send or track
      }

      breakCount += 1;
      const rawText = typeof update.text === 'string' ? update.text : '';
      const text = rawText.trim();
      if (text) {
        // Track the raw segment text so remainingText can verify prefix match.
        sentText += rawText;
        try {
          await sendSegment(text);
        } catch (error) {
          logger.warn?.(
            '[dsh-im] message_break send failed:',
            error?.message ?? error,
          );
        }
      } else if (!emptyLogged) {
        // A break with nothing new since the last one is a no-op: the model
        // called it before writing the segment. Logged once per turn so the
        // misuse is observable instead of silently dropping the split.
        emptyLogged = true;
        logger.warn?.(
          '[dsh-im] message_break called with no new text since the last break; '
          + 'the segment after it will wait for the next break',
        );
      }
      return null; // consumed — do not pass to the stream/progress handler
    },

    /**
     * Compute the text that should be delivered as the final message.
     * If message_break was used, this is everything after the last break
     * point. If no breaks occurred, the full answer is returned unchanged.
     * If the prefix relationship broke (canonical rewrite), return the full
     * answer as a safe fallback.
     */
    remainingText(fullAnswer) {
      if (breakCount === 0) return fullAnswer;
      if (typeof fullAnswer !== 'string' || !fullAnswer) return '';
      if (sentText && fullAnswer.startsWith(sentText)) {
        const remaining = fullAnswer.substring(sentText.length);
        const trimmed = remaining.trim();
        return trimmed || fullAnswer.trim() || fullAnswer;
      }
      // Prefix mismatch (canonical rewrite or breaker tripped) —
      // return the full answer as a safe fallback.
      return fullAnswer;
    },

    /**
     * Whether the delivered segments already cover the whole final answer, so
     * nothing is left to send. Uses the same raw prefix rule as remainingText()
     * (which falls back to the whole answer when the prefix no longer matches),
     * then requires the remainder to be blank — suppression therefore only ever
     * fires when the tail is provably empty, never when text is still missing.
     */
    segmentsCover(fullAnswer) {
      if (breakCount === 0 || !sentText) return false;
      if (typeof fullAnswer !== 'string' || !fullAnswer) return false;
      if (!fullAnswer.startsWith(sentText)) return false;
      return fullAnswer.substring(sentText.length).trim() === '';
    },

    hasBreaks() {
      return breakCount > 0;
    },
  };
}
