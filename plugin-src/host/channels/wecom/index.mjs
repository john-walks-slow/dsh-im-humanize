import { createProductionController } from './production.mjs';
import { createWecomRpcHandler, installWecomRpc, installWecomRpcHandler } from './rpc.mjs';
import { publicWecomStartupError } from './startup-error.mjs';
import { t } from '../../../../src/channels/shared/i18n.mjs';

export const name = 'dsh-im-wecom-host';
export const inject = ['connection', 'credentials', 'typertGateway'];

export async function apply(ctx, config = {}) {
  if (config?.controller) {
    return installWecomRpc(ctx, config.controller, config.rpcOptions, config.rpcAuthority);
  }
  let startupError = {
    code: 'wecom-initializing',
    message: t('企业微信正在初始化，请稍后重新读取。'),
    details: {},
  };
  let handler = async () => ({ ok: false, error: startupError });
  const disposeRpc = installWecomRpcHandler(ctx, (endpoint, payload, signal) => {
    if (signal?.aborted) {
      return { ok: false, error: { code: 'cancelled', message: 'The request was cancelled.', details: {} } };
    }
    return handler(endpoint, payload, signal);
  }, config.rpcAuthority);
  const logger = typeof ctx.logger === 'function' ? ctx.logger('dsh-im:wecom') : (ctx.logger ?? console);
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
    production = await createProductionController(ctx, config, config.internals);
    unregisterDelivery = config.deliveryService && production.deliveryAdapter
      ? config.deliveryService.registerAdapter(production.deliveryAdapter) : undefined;
    const readyHandler = createWecomRpcHandler(production.controller, config.rpcOptions);
    ctx.effect(() => closeProduction, 'dsh-im: close Enterprise WeChat bot connections');
    handler = readyHandler;
  } catch (error) {
    startupError = publicWecomStartupError(error);
    logger.error?.('[dsh-im] failed to activate wecom; management RPC remains available', error);
    try {
      await closeProduction();
    } catch (cleanupError) {
      logger.error?.('[dsh-im] failed to close partially initialized wecom resources', cleanupError);
    }
  }
  return disposeRpc;
}

export function createWecomHostPlugin(config) {
  return Object.freeze({ name, inject, apply: (ctx) => apply(ctx, config) });
}

export { createConnectionSupervisor, ConnectionSupervisor } from './connection-supervisor.mjs';
export { createProductionController } from './production.mjs';
export {
  WECOM_ENDPOINTS,
  WECOM_RPC_CHANNEL,
  WECOM_RPC_ENDPOINTS,
  createWecomRpcHandler,
  installWecomRpc,
} from './rpc.mjs';
export { WecomController } from '../../../../src/channels/wecom/wecom-controller.mjs';
export { WecomRuntime } from '../../../../src/channels/wecom/wecom-runtime.mjs';
