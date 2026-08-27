/**
 * Adapt the Host's Typert command gateway to the channel Harness client.
 * Programmatic production fixtures may omit the gateway and exercise other assembly paths.
 */
export function createHarnessCommandExecutor(ctx, provided) {
  if (provided !== undefined) {
    if (typeof provided !== 'function') throw new TypeError('commandExecutor must be a function');
    return provided;
  }
  const gateway = ctx?.typertGateway;
  if (!gateway) return undefined;
  if (typeof gateway.invoke !== 'function') {
    throw new TypeError('dsh-im requires a callable ctx.typertGateway');
  }
  return async (sessionId, line, options = {}) => {
    const request = {
      namespace: 'commands',
      method: 'execute',
      args: { agentId: sessionId, line, images: [] },
      signal: options.signal,
    };
    try {
      return await gateway.invoke(request);
    } catch (error) {
      // Newer Hosts require images; older Hosts reject that field before
      // invoking the command. Retry only that exact pre-dispatch failure so
      // a business failure can never cause compaction to run twice.
      if (error?.name !== 'TypertGatewayError'
        || error.code !== 'arguments-invalid'
        || error.endpoint !== 'commands/execute'
        || error.message !== 'typert gateway: commands/execute: args fields do not match the descriptor: unexpected "images"') {
        throw error;
      }
      options.signal?.throwIfAborted();
      return gateway.invoke({
        ...request,
        args: { agentId: sessionId, line },
      });
    }
  };
}
