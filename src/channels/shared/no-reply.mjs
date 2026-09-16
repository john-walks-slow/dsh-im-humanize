/**
 * no_reply tool — a minimal silence signal for dsh-im turns.
 *
 * Unlike the (removed) dsh-proactive no_reply, this tool carries no auditing
 * (no run history) and no tombstone. It exists only to let the model state
 * "I won't / don't want to / don't need to reply" in a dsh-im-initiated turn:
 * it mechanically concludes the turn (exec.concludeTurn()) and produces no
 * visible text.
 *
 * Usage is a description-level soft constraint (same as message_break): it is
 * only meaningful when the user message came from dsh-im.
 */

export const NO_REPLY_TOOL = 'no_reply';

/**
 * Build the tool definition for ctx.tools.register().
 * Matches the pattern of message_break / dsh_im_return_file.
 */
export function createNoReplyToolDefinition() {
  return Object.freeze({
    name: NO_REPLY_TOOL,
    description: 'Conclude the current turn in complete silence: call no_reply as your ONLY action with no chat text, so nothing is visible to the user. Use it when no IM reply should be sent — e.g. answering a dsh-im message you choose not to reply to, or in a proactive wake on an IM-connected session where you did work but no user-facing message is needed (your work stays in context). If the host also offers a reclaim-silence tool for the "nothing to do this turn" case, prefer that one for reclaiming; no_reply keeps your work in context.',
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
          acknowledged: { type: 'boolean' },
        },
        required: ['acknowledged'],
      },
      render: () => [{ type: 'text', text: 'Turn concluded silently.' }],
    },
    async execute(_args, exec) {
      if (typeof exec?.concludeTurn === 'function') {
        exec.concludeTurn();
      }
      return { acknowledged: true };
    },
  });
}

/**
 * Register the no_reply tool and its system prompt section.
 * Returns true on success, false if the context lacks the required capabilities.
 */
export function installNoReplyTool(ctx) {
  if (typeof ctx?.tools?.register !== 'function'
    || typeof ctx?.systemPrompt?.section !== 'function') {
    return false;
  }
  ctx.tools.register(createNoReplyToolDefinition());
  ctx.systemPrompt.section({
    name: 'dsh-im:no-reply',
    order: 118,
    text: 'When no IM reply should be sent, call no_reply as your ONLY action with no chat text. This covers answering a dsh-im message you do not want to reply to, and a proactive wake on an IM-connected session where you did work but no user message is needed (the work stays in context). If the host also offers a reclaim-silence tool for the "nothing to do" case, prefer that one for reclaiming the turn; no_reply keeps your work in context.',
  });
  return true;
}
