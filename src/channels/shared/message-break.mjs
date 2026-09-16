/**
 * message_break tool — a no-op tool the AI calls to mark a break point in its
 * response. The plugin detects the tool/call event in HarnessReplyTracker and
 * sends the accumulated text since the last break as a separate IM message.
 *
 * The tool itself does nothing (execute returns { ok: true }); the actual
 * message splitting happens in the bridge's onUpdate callback.
 *
 * When messageBreak is enabled, streaming is automatically disabled (mutually
 * exclusive) because the stream finish/reopen dance adds complexity without
 * benefit for the "human-like" chat experience.
 */

export const MESSAGE_BREAK_TOOL = 'message_break';
const MAX_MESSAGE_BREAKS_PER_TURN = 20;

/**
 * Build the tool definition for ctx.tools.register().
 * Matches the pattern of dsh_im_return_file / ask_user_question.
 */
export function createMessageBreakToolDefinition() {
  return Object.freeze({
    name: MESSAGE_BREAK_TOOL,
    description: 'Insert a message break to split your response into multiple shorter messages, like a human chatting. Call this between natural paragraph or topic boundaries. The text you wrote before each break is sent as a separate message; text after the last break becomes the final message. Do not include any parameters. Do not use when the user message does not come from dsh-im.',
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
 * Register the message_break tool and its system prompt section.
 * Returns true on success, false if the context lacks the required capabilities.
 */
export function installMessageBreakTool(ctx) {
  if (typeof ctx?.tools?.register !== 'function'
    || typeof ctx?.systemPrompt?.section !== 'function') {
    return false;
  }
  ctx.tools.register(createMessageBreakToolDefinition());
  ctx.systemPrompt.section({
    name: 'dsh-im:message-break',
    order: 116,
    text: 'When your response is long, use the message_break tool to split it into multiple shorter messages. Each segment between message_break calls becomes a separate chat message, mimicking human chat style. Call message_break at natural paragraph or topic boundaries. The tool takes no parameters. Do not use when the user message does not come from dsh-im.',
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

    hasBreaks() {
      return breakCount > 0;
    },
  };
}
