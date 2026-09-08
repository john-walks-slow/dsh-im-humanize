import { createProductionController } from './production.mjs';
import { createWeixinRpcHandler, installWeixinRpc, WEIXIN_RPC_CHANNEL } from './rpc.mjs';
import { installProductionChannel } from '../shared/startup.mjs';

export const name = 'dsh-weixin-host';
export const inject = ['connection', 'credentials', 'typertGateway'];

export async function apply(ctx, config = {}) {
  if (config?.controller) {
    return installWeixinRpc(ctx, config.controller, config.rpcOptions, config.rpcAuthority);
  }

  return installProductionChannel(ctx, config, {
    channel: 'weixin',
    rpcChannel: WEIXIN_RPC_CHANNEL,
    createProduction: () => createProductionController(ctx, config, config.internals),
    createHandler: controller => createWeixinRpcHandler(controller, config.rpcOptions),
  });
}

export function createWeixinHostPlugin(config) {
  return Object.freeze({ name, inject, apply: (ctx) => apply(ctx, config) });
}

export { createConnectionSupervisor, ConnectionSupervisor } from './connection-supervisor.mjs';
export { createProductionController } from './production.mjs';
export {
  WEIXIN_ENDPOINTS,
  WEIXIN_RPC_CHANNEL,
  WEIXIN_RPC_ENDPOINTS,
  createWeixinRpcHandler,
  installWeixinRpc,
} from './rpc.mjs';
export { WeixinController } from '../../../../src/channels/weixin/weixin-controller.mjs';
export { WeixinRuntime } from '../../../../src/channels/weixin/weixin-runtime.mjs';
