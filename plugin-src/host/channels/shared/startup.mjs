import { resolveRpcAuthority } from '../../rpc-authority.mjs';
import { publicChannelInitializing, publicChannelStartupError } from './startup-error.mjs';

/** Mount the native management RPC before any fallible production initialization. */
export async function installProductionChannel(ctx, config, {
  channel, rpcChannel, createProduction, createHandler,
}) {
  if (!ctx?.connection?.rpc || typeof ctx.connection.rpc.handle !== 'function') {
    throw new TypeError('DSH Host Connection RPC is required');
  }
  let startupError = publicChannelInitializing(channel);
  let handler = async () => ({ ok: false, error: startupError });
  const disposeRpc = ctx.connection.rpc.handle(rpcChannel, (endpoint, payload, signal) => {
    if (signal?.aborted) {
      return { ok: false, error: { code: 'cancelled', message: 'The request was cancelled.', details: {} } };
    }
    return handler(endpoint, payload, signal);
  }, { authority: resolveRpcAuthority(config.rpcAuthority) });
  const logger = typeof ctx.logger === 'function' ? ctx.logger(`dsh-im:${channel}`) : (ctx.logger ?? console);
  let production;
  let unregisterDelivery;
  let closing;
  const closeProduction = () => (closing ??= (async () => {
    try {
      await unregisterDelivery?.();
    } finally {
      await production?.close();
    }
  })());
  try {
    production = await createProduction();
    unregisterDelivery = config.deliveryService && production.deliveryAdapter
      ? config.deliveryService.registerAdapter(production.deliveryAdapter) : undefined;
    const readyHandler = createHandler(production.controller);
    ctx.effect(() => closeProduction, `dsh-im: close ${channel} connections`);
    handler = readyHandler;
  } catch (error) {
    startupError = publicChannelStartupError(channel, error);
    logger.error?.(`[dsh-im] failed to activate ${channel}; management RPC remains available`, error);
    try {
      await closeProduction();
    } catch (cleanupError) {
      logger.error?.(`[dsh-im] failed to close partially initialized ${channel} resources`, cleanupError);
    }
  }
  return disposeRpc;
}
