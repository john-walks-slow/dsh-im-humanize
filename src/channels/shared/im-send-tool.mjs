/**
 * send_im tool — deliver one text message to the user through IM.
 *
 * It exists for turns that are silent by default: a proactive wake or
 * background task runs in a session no inbound IM message carries the reply
 * back from, so ordinary chat text reaches nobody. In a turn initiated by
 * dsh-im (an inbound IM message), the model must just write the reply — the
 * bridge carries it back automatically — and must NOT call this tool.
 *
 * botId/targetId are optional: when both are omitted the tool resolves the
 * private chat currently bound to the running session (via
 * listSessionConversations) and delivers there; a session with no bound
 * private chat fails, so the model can fall back to explicit ids.
 */

export const IM_SEND_TOOL = 'send_im';

export function createImSendToolDefinition({ send, resolveBoundTargets }) {
  if (typeof send !== 'function') throw new TypeError('A delivery send function is required');
  return Object.freeze({
    name: IM_SEND_TOOL,
    description: 'Deliver one text message to the user through IM. Use this ONLY in turns NOT initiated by dsh-im: in a turn initiated by dsh-im (an inbound IM message), just write the reply as ordinary chat text and it reaches the user automatically. Call send_im only in silent turns — typically a proactive wake or background task — where no inbound IM message carries the reply back. If both botId and targetId are omitted, the message is delivered to the private chat currently bound to this session; if the session has no bound private chat this fails, so provide both ids explicitly. Provide botId + targetId (copied from the IM bot settings page, 复制调用参数) to target a specific saved delivery target.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        botId: {
          type: 'string',
          description: 'Optional. Bot ID copied from the IM bot settings page. Omit both botId and targetId to deliver to the private chat bound to the current session.',
        },
        targetId: {
          type: 'string',
          description: 'Optional. Saved target ID under that bot (from 复制调用参数). Omit both botId and targetId to deliver to the private chat bound to the current session.',
        },
        text: {
          type: 'string',
          description: 'Non-empty message text to deliver.',
        },
      },
      required: ['text'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sent: { type: 'boolean' },
        },
        required: ['sent'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.sent ? 'IM message delivered.' : 'IM message was not delivered.',
      }],
    },
    async execute(args, exec) {
      const text = typeof args?.text === 'string' ? args.text : '';
      if (!text.trim()) {
        throw new Error('send_im failed (bad-request): text must be a non-empty string');
      }
      const botId = typeof args?.botId === 'string' && args.botId ? args.botId : '';
      const targetId = typeof args?.targetId === 'string' && args.targetId ? args.targetId : '';
      const signal = exec?.signal;

      if (botId || targetId) {
        if (!botId || !targetId) {
          throw new Error('send_im failed (bad-request): provide both botId and targetId, or omit both to auto-resolve the bound private chat');
        }
        try {
          await send(botId, targetId, text, { signal });
          return { sent: true };
        } catch (error) {
          throw new Error(`send_im failed (${error?.code ?? 'delivery-failed'}): ${error?.message ?? String(error)}`);
        }
      }

      const sessionId = exec?.agent?.session?.id;
      if (typeof sessionId !== 'string' || !sessionId) {
        throw new Error('send_im failed (no-session): cannot resolve the current session — provide botId and targetId explicitly');
      }
      if (typeof resolveBoundTargets !== 'function') {
        throw new Error('send_im failed (unavailable): bound-target resolution is unavailable — provide botId and targetId explicitly');
      }
      let bound;
      try {
        bound = await resolveBoundTargets(sessionId);
      } catch (error) {
        throw new Error(`send_im failed (lookup-failed): ${error?.message ?? String(error)}`);
      }
      if (!Array.isArray(bound) || bound.length === 0) {
        throw new Error('send_im failed (no-bound-target): this session has no bound IM private chat — provide botId and targetId explicitly');
      }
      const results = await Promise.allSettled(bound.map(({ botId: boundBotId, target }) => {
        if (typeof boundBotId !== 'string' || !boundBotId) {
          return Promise.reject(new Error('invalid bound bot id'));
        }
        return send(boundBotId, target, text, { signal });
      }));
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length === results.length) {
        const first = failures[0].reason;
        throw new Error(`send_im failed (delivery-failed): ${first?.message ?? String(first)}`);
      }
      return { sent: true };
    },
  });
}

/**
 * Register the send_im tool and its system prompt section.
 * Returns true on success, false if the context lacks the required
 * capabilities or no send function was provided.
 */
export function installImSendTool(ctx, { send, resolveBoundTargets } = {}) {
  if (typeof ctx?.tools?.register !== 'function'
    || typeof ctx?.systemPrompt?.section !== 'function'
    || typeof send !== 'function') {
    return false;
  }
  ctx.tools.register(createImSendToolDefinition({ send, resolveBoundTargets }));
  ctx.systemPrompt.section({
    name: 'dsh-im:send-im',
    order: 117,
    text: 'When you must reach the user through IM from a turn NOT initiated by dsh-im (no inbound IM message carries the reply back) — typically a proactive wake or background task — call send_im. In a turn initiated by dsh-im, never call send_im: just write the reply as ordinary chat text and it reaches the user. You may omit both botId and targetId to deliver to the private chat bound to the current session.',
  });
  return true;
}
