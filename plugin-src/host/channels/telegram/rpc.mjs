import {
  TOKEN_BOT_ENDPOINTS,
  createTokenBotRpcHandler,
} from '../shared/rpc.mjs';
import { resolveRpcAuthority } from '../../rpc-authority.mjs';

export const TELEGRAM_RPC_CHANNEL = '/telegram';
export const TELEGRAM_ENDPOINTS = TOKEN_BOT_ENDPOINTS;
export const TELEGRAM_RPC_ENDPOINTS = Object.freeze(Object.values(TELEGRAM_ENDPOINTS));

export function createTelegramRpcHandler(controller) {
  return createTokenBotRpcHandler(controller, { channel: 'Telegram' });
}

export function installTelegramRpc(ctx, controller, authority) {
  if (!ctx?.connection?.rpc || typeof ctx.connection.rpc.handle !== 'function') {
    throw new TypeError('DSH Host Connection RPC is required');
  }
  return ctx.connection.rpc.handle(
    TELEGRAM_RPC_CHANNEL,
    createTelegramRpcHandler(controller),
    { authority: resolveRpcAuthority(authority) },
  );
}
