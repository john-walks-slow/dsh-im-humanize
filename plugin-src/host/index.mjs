import { apply as applyDingtalk } from './channels/dingtalk/index.mjs';
import { apply as applyDiscord } from './channels/discord/index.mjs';
import { apply as applyOffice } from './channels/office/index.mjs';
import { apply as applyFeishu } from './channels/feishu/index.mjs';
import { apply as applyQq } from './channels/qq/index.mjs';
import { apply as applySlack } from './channels/slack/index.mjs';
import { apply as applyTelegram } from './channels/telegram/index.mjs';
import { apply as applyWecom } from './channels/wecom/index.mjs';
import { apply as applyWeixin } from './channels/weixin/index.mjs';
import { apply as applyWhatsapp } from './channels/whatsapp/index.mjs';
import { installOutboundArtifactTool } from '../../src/channels/shared/semantic/artifact.mjs';
import { installMessageBreakTool } from '../../src/channels/shared/message-break.mjs';
import { installNoReplyTool } from '../../src/channels/shared/no-reply.mjs';
import { installImSendTool } from '../../src/channels/shared/im-send-tool.mjs';
import { setImHostLanguage } from '../../src/channels/shared/i18n.mjs';
import { installDeliveryRpc } from './delivery-rpc.mjs';
import { installDeliveryHttp } from './delivery-http.mjs';
import { createDeliveryService } from './delivery-service.mjs';
import { installInboundTtlRpc } from './inbound-ttl-rpc.mjs';
import { installSessionSyncCoordinator } from './session-sync-coordinator.mjs';
import { installUpdateRpc } from './update-rpc.mjs';
import { installHumanizeRpc } from './humanize-rpc.mjs';

export const name = 'dsh-im-host';
export const inject = [
  'connection',
  'credentials',
  'typertGateway',
];

// Humanization keys forwarded to every channel config with channel
// sub-object priority. `humanizeDefaults` (installed by activateChannels)
// provides the live per-channel resolution for bridges.
const HUMANIZE_CONFIG_KEYS = [
  'streaming',
  'messageBreak',
  'onNewMessage',
  'sendDelay',
  'typingIndicator',
  'typingBurst',
  'statusReaction',
  'replyQuote',
  'progressStatus',
];

function channelConfig(config, name, deliveryService) {
  const channel = config[name] ?? {};
  const withAuthority = config.rpcAuthority === undefined
    ? channel
    : { ...channel, rpcAuthority: config.rpcAuthority };
  const base = name === 'office' ? withAuthority : { ...withAuthority, deliveryService };
  const forwarded = {};
  for (const key of HUMANIZE_CONFIG_KEYS) {
    if (channel[key] !== undefined || config[key] !== undefined) {
      forwarded[key] = channel[key] ?? config[key];
    }
  }
  return {
    ...base,
    ...forwarded,
    ...(typeof config.humanizeDefaults === 'function'
      ? { humanizeDefaults: config.humanizeDefaults }
      : {}),
  };
}

export function createImHostPlugin(internals = {}) {
  const startUpdate = internals.installUpdateRpc ?? installUpdateRpc;
  const startInboundTtl = internals.installInboundTtlRpc ?? installInboundTtlRpc;
  const startDelivery = internals.installDeliveryRpc ?? installDeliveryRpc;
  const startDeliveryHttp = internals.installDeliveryHttp ?? installDeliveryHttp;
  const startSessionSync = internals.installSessionSyncCoordinator
    ?? installSessionSyncCoordinator;
  const makeDeliveryService = internals.createDeliveryService ?? createDeliveryService;
  const startFeishu = internals.applyFeishu ?? applyFeishu;
  const startWeixin = internals.applyWeixin ?? applyWeixin;
  const startDingtalk = internals.applyDingtalk ?? applyDingtalk;
  const startWecom = internals.applyWecom ?? applyWecom;
  const startQq = internals.applyQq ?? applyQq;
  const startSlack = internals.applySlack ?? applySlack;
  const startTelegram = internals.applyTelegram ?? applyTelegram;
  const startDiscord = internals.applyDiscord ?? applyDiscord;
  const startOffice = internals.applyOffice ?? applyOffice;
  const startWhatsapp = internals.applyWhatsapp ?? applyWhatsapp;
  const channels = [
    ['feishu', startFeishu],
    ['weixin', startWeixin],
    ['dingtalk', startDingtalk],
    ['wecom', startWecom],
    ['qq', startQq],
    ['slack', startSlack],
    ['telegram', startTelegram],
    ['discord', startDiscord],
    ['whatsapp', startWhatsapp],
    ['office', startOffice],
  ];
  return Object.freeze({
    name,
    inject,
    async apply(ctx, config = {}) {
      const unavailableSessionSyncChannels = channels
        .map(([channel]) => channel)
        .filter((channel) => channel !== 'office'
          && config[channel]?.harnessBaseUrl !== undefined);
      const deliveryService = makeDeliveryService({ unavailableSessionSyncChannels });
      if (typeof ctx?.provide === 'function') {
        ctx.provide('dshIm', Object.freeze({
          send: (botId, targetId, text, options) => (
            deliveryService.send(botId, targetId, text, options)
          ),
          listTargets: async (botId) => (await deliveryService.listTargets(botId)).targets,
          listBots: () => deliveryService.listBots(),
        }));
      }
      const activate = async (readyCtx) => {
        await activateChannels(readyCtx, config, deliveryService);
      };
      if (typeof ctx?.inject === 'function') {
        const modern = typeof ctx?.typertGateway?.stream === 'function';
        await ctx.inject(
          modern ? ['sessionController', 'workspaceController'] : ['apiProxy'],
          activate,
        );
        ctx.inject(['webServer'], (httpCtx) => {
          startDeliveryHttp(httpCtx, deliveryService);
        });
        return;
      }
      await activate(ctx);
      if (ctx?.webServer?.register && typeof ctx?.effect === 'function') {
        startDeliveryHttp(ctx, deliveryService);
      }
    },
  });

  async function activateChannels(ctx, config, deliveryService) {
    setImHostLanguage(config.language ?? process.env.DSH_IM_LANGUAGE);

    // Load humanization settings from the file-backed store and merge them
    // into the config so all channels receive the same values. The
    // humanizeDefaults accessor lets bridges re-read the store on every
    // turn, so panel updates apply without a plugin restart.
    let humanizeStore = null;
    try {
      const result = installHumanizeRpc(ctx, {
        config,
        logger: ctx?.logger,
        authority: config.rpcAuthority,
      });
      humanizeStore = result.store;
      await humanizeStore.load();
    } catch (error) {
      ctx?.logger?.error?.('[dsh-im] humanization settings load failed; using defaults:', error);
    }
    // Explicit dsh-config values outrank the store; channel sub-objects
    // outrank both. Captured before the merge below so the live accessor
    // never resolves through a stale snapshot.
    const explicitHumanize = Object.fromEntries(
      HUMANIZE_CONFIG_KEYS.map((key) => [key, config[key]]),
    );
    const humanizeSnapshot = humanizeStore ? humanizeStore.get() : {};
    const humanizeDefaults = (channelName) => {
      const live = humanizeStore ? humanizeStore.get() : {};
      const sub = config[channelName] ?? {};
      const resolved = {};
      for (const key of HUMANIZE_CONFIG_KEYS) {
        resolved[key] = sub[key] ?? explicitHumanize[key] ?? live[key];
      }
      return resolved;
    };
    config = {
      ...config,
      humanizeDefaults,
    };
    for (const key of HUMANIZE_CONFIG_KEYS) {
      if (config[key] === undefined && humanizeSnapshot[key] !== undefined) {
        config[key] = humanizeSnapshot[key];
      }
    }

    const imSend = (botId, targetId, text, options) => (
      deliveryService.send(botId, targetId, text, options)
    );
    const resolveBoundTargets = (sessionId) => (
      deliveryService.listSessionConversations(sessionId)
    );
    if (typeof ctx?.inject === 'function') {
      ctx.inject(['tools', 'systemPrompt'], (toolCtx) => {
        installOutboundArtifactTool(toolCtx);
        installNoReplyTool(toolCtx);
        if (config.messageBreak !== false) {
          installMessageBreakTool(toolCtx);
        }
        if (config.imSendTool !== false) {
          installImSendTool(toolCtx, { send: imSend, resolveBoundTargets });
        }
      });
    } else {
      installOutboundArtifactTool(ctx);
      installNoReplyTool(ctx);
      if (config.messageBreak !== false) {
        installMessageBreakTool(ctx);
      }
      if (config.imSendTool !== false) {
        installImSendTool(ctx, { send: imSend, resolveBoundTargets });
      }
    }
    const logger = typeof ctx?.logger === 'function'
      ? ctx.logger(name)
      : (ctx?.logger ?? console);
    if (ctx?.connection?.rpc) {
      try {
        startUpdate(ctx);
      } catch (error) {
        logger.error?.('[dsh-im] failed to activate update management; continuing with channels', error);
      }
      try {
        startInboundTtl(ctx, { config });
      } catch (error) {
        logger.error?.('[dsh-im] failed to activate inbound TTL settings; continuing with channels', error);
      }
      try {
        startDelivery(ctx, deliveryService, { authority: config.rpcAuthority });
      } catch (error) {
        logger.error?.('[dsh-im] failed to activate delivery management; continuing with channels', error);
      }
    }
    const failures = [];
    for (const [channel, start] of channels) {
      try {
        await start(ctx, channelConfig(config, channel, deliveryService));
      } catch (error) {
        failures.push(error);
        logger.error?.(`[dsh-im] failed to activate ${channel}; continuing with the remaining channels`, error);
      }
    }
    if (failures.length === channels.length) {
      throw new AggregateError(failures, 'dsh-im failed to activate every channel');
    }
    if (typeof ctx?.on === 'function') {
      try {
        startSessionSync(ctx, deliveryService, {
          logger,
          inputScope: ctx.root ?? ctx,
        });
      } catch (error) {
        logger.error?.('[dsh-im] failed to activate Session sync; continuing with channels', error);
      }
    }
  }
}

export async function apply(ctx, config = {}) {
  return createImHostPlugin().apply(ctx, config);
}
