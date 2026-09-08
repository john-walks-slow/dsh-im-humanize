import { createProductionController } from './production.mjs';
import { installWecomAppRpc, WECOM_APP_ENDPOINTS, WECOM_APP_RPC_CHANNEL, WECOM_APP_RPC_ENDPOINTS, createWecomAppRpcHandler } from './rpc.mjs';

export const name = 'dsh-im-wecom-app-host';
export const inject = ['connection', 'credentials', 'typertGateway'];

export async function apply(ctx, config = {}) {
  if (config?.controller) {
    return installWecomAppRpc(ctx, config.controller, config.rpcOptions, config.rpcAuthority);
  }
  const production = await createProductionController(ctx, config, config.internals);
  const unregisterDelivery = config.deliveryService && production.deliveryAdapter
    ? config.deliveryService.registerAdapter(production.deliveryAdapter) : undefined;
  const disposeRpc = installWecomAppRpc(
    ctx,
    production.controller,
    config.rpcOptions,
    config.rpcAuthority,
  );
  ctx.effect(() => async () => {
    await unregisterDelivery?.();
    await production.close();
  }, 'dsh-im: close Enterprise WeChat app connections');
  return disposeRpc;
}

export function createWecomAppHostPlugin(config) {
  return Object.freeze({ name, inject, apply: (ctx) => apply(ctx, config) });
}

export { createProductionController } from './production.mjs';
export {
  WECOM_APP_ENDPOINTS,
  WECOM_APP_RPC_CHANNEL,
  WECOM_APP_RPC_ENDPOINTS,
  createWecomAppRpcHandler,
  installWecomAppRpc,
} from './rpc.mjs';
export { WecomAppController } from '../../../../src/channels/wecom-app/wecom-app-controller.mjs';
export { WecomAppRuntime } from '../../../../src/channels/wecom-app/wecom-app-runtime.mjs';
