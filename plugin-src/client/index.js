import * as React from 'react';
import manifest from '../../package.json' with { type: 'json' };

import {
  DingtalkLogoGlyph,
  DiscordLogoGlyph,
  FeishuLogoGlyph,
  OfficeLogoGlyph,
  QqLogoGlyph,
  SlackLogoGlyph,
  TelegramLogoGlyph,
  WecomLogoGlyph,
  WeixinLogoGlyph,
  WhatsappLogoGlyph,
} from './channel-logos.js';
import { DINGTALK_RPC_CHANNEL } from './channels/dingtalk/api.js';
import { DingtalkSettingsTab } from './channels/dingtalk/index.js';
import { DISCORD_RPC_CHANNEL } from './channels/discord/api.js';
import { DiscordSettingsTab } from './channels/discord/index.js';
import { installDiscordStyles } from './channels/discord/styles.js';
import { FeishuSettingsTab } from './channels/feishu/index.js';
import { FEISHU_RPC_CHANNEL } from './channels/feishu/api.js';
import { installFeishuStyles } from './channels/feishu/styles.js';
import { QQ_RPC_CHANNEL } from './channels/qq/api.js';
import { QqSettingsTab } from './channels/qq/index.js';
import { installQqStyles } from './channels/qq/styles.js';
import { OFFICE_RPC_CHANNEL } from './channels/office/api.js';
import { OfficeSettingsTab } from './channels/office/index.js';
import { installOfficeStyles } from './channels/office/styles.js';
import { SLACK_RPC_CHANNEL } from './channels/slack/api.js';
import { SlackSettingsTab } from './channels/slack/index.js';
import { installSlackStyles } from './channels/slack/styles.js';
import { TELEGRAM_RPC_CHANNEL } from './channels/telegram/api.js';
import { TelegramSettingsTab } from './channels/telegram/index.js';
import { installTelegramStyles } from './channels/telegram/styles.js';
import { WECOM_RPC_CHANNEL } from './channels/wecom/api.js';
import { WecomSettingsTab } from './channels/wecom/index.js';
import { installWecomStyles } from './channels/wecom/styles.js';
import { WeixinSettingsTab } from './channels/weixin/index.js';
import { WEIXIN_RPC_CHANNEL } from './channels/weixin/api.js';
import { installWeixinStyles } from './channels/weixin/styles.js';
import { WHATSAPP_RPC_CHANNEL } from './channels/whatsapp/api.js';
import { WhatsappSettingsTab } from './channels/whatsapp/index.js';
import { installWhatsappStyles } from './channels/whatsapp/styles.js';
import { en, h, IM_LOCALE_NAMESPACE, setImTranslator, zh } from './i18n.js';
import { BotSettingsContext } from './channel-card-meta.js';
import {
  DELIVERY_RPC_CHANNEL,
  DeliveryTargetSettingsPage,
} from './delivery-settings.js';
import {
  createLoopbackAwareRpcCalls,
  replacePageLocation,
} from './loopback-recovery.js';
import { installImStyles } from './styles.js';
import { UpdatePanel, UPDATE_RPC_CHANNEL } from './update-panel.js';
import { WorkspaceDirectoryPickerContext } from './workspace-editor.js';

export const name = 'im-settings';
export const inject = ['slots', 'connection', 'locale', 'workspaces'];
export const IM_PLUGIN_VERSION = manifest.version;

function callWorkspaceDirectoryApi(ctx, method, ...args) {
  // Current DSH owns directory operations on uiWorkspace; legacy Hosts keep them on workspaces.
  const uiWorkspace = typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : undefined;
  const service = typeof uiWorkspace?.[method] === 'function' ? uiWorkspace : ctx.workspaces;
  if (typeof service?.[method] !== 'function') {
    throw new Error('无法读取目录，请重试。');
  }
  return service[method](...args);
}

const CHANNELS = Object.freeze([
  { id: 'weixin', label: '微信' },
  { id: 'feishu', label: '飞书' },
  { id: 'dingtalk', label: '钉钉' },
  { id: 'wecom', label: '企业微信' },
  { id: 'qq', label: 'QQ' },
  { id: 'slack', label: 'Slack' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'discord', label: 'Discord' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'office', label: 'AI Office', note: '（实验功能）' },
]);

function WeixinLogo() {
  return h('span', { className: 'dim-logo dim-logoWeixin', 'aria-hidden': 'true' },
    h(WeixinLogoGlyph));
}

function FeishuLogo() {
  return h('span', { className: 'dim-logo dim-logoFeishu', 'aria-hidden': 'true' },
    h(FeishuLogoGlyph));
}

function DingtalkLogo() {
  return h('span', { className: 'dim-logo dim-logoDingtalk', 'aria-hidden': 'true' },
    h(DingtalkLogoGlyph));
}

function QqLogo() {
  return h('span', { className: 'dim-logo dim-logoQq', 'aria-hidden': 'true' }, h(QqLogoGlyph));
}

function WecomLogo() {
  return h('span', { className: 'dim-logo dim-logoWecom', 'aria-hidden': 'true' }, h(WecomLogoGlyph));
}

function TelegramLogo() {
  return h('span', { className: 'dim-logo dim-logoTelegram', 'aria-hidden': 'true' },
    h(TelegramLogoGlyph));
}

function SlackLogo() {
  return h('span', { className: 'dim-logo dim-logoSlack', 'aria-hidden': 'true' },
    h(SlackLogoGlyph));
}

function DiscordLogo() {
  return h('span', { className: 'dim-logo dim-logoDiscord', 'aria-hidden': 'true' },
    h(DiscordLogoGlyph));
}

function WhatsappLogo() {
  return h('span', { className: 'dim-logo dim-logoWhatsapp', 'aria-hidden': 'true' },
    h(WhatsappLogoGlyph));
}

function OfficeLogo() {
  return h('span', { className: 'dim-logo dim-logoOffice', 'aria-hidden': 'true' },
    h(OfficeLogoGlyph));
}

function ChannelLogo({ channel }) {
  if (channel === 'weixin') return h(WeixinLogo);
  if (channel === 'feishu') return h(FeishuLogo);
  if (channel === 'dingtalk') return h(DingtalkLogo);
  if (channel === 'wecom') return h(WecomLogo);
  if (channel === 'qq') return h(QqLogo);
  if (channel === 'slack') return h(SlackLogo);
  if (channel === 'telegram') return h(TelegramLogo);
  if (channel === 'discord') return h(DiscordLogo);
  if (channel === 'whatsapp') return h(WhatsappLogo);
  return h(OfficeLogo);
}

export function LoopbackRecoveryNotice({ recovery, onNavigate = replacePageLocation }) {
  return h('div', {
    className: 'dim-loopbackRecovery',
    role: 'alert',
  },
  h('div', { className: 'dim-loopbackRecoveryCopy' },
    h('strong', null, '请改用 localhost 重新打开'),
    h('p', null, '页面会在当前端口重新打开，机器人配置不会改变。'),
    h('code', null, recovery.origin)),
  h('button', {
    type: 'button',
    className: 'dim-loopbackRecoveryAction',
    onClick: () => onNavigate(recovery.url),
  }, '使用 localhost 重新打开'));
}

export function IMSettingsTab({
  dingtalkRpcCall,
  discordRpcCall,
  feishuRpcCall,
  qqRpcCall,
  slackRpcCall,
  telegramRpcCall,
  wecomRpcCall,
  weixinRpcCall,
  whatsappRpcCall,
  officeRpcCall,
  updateRpcCall,
  deliveryRpcCall,
  workspaceDirectoryPicker,
  browserLocation = globalThis.location,
  navigateToRecoveryUrl = replacePageLocation,
}) {
  const [selected, setSelected] = React.useState('weixin');
  const [loopbackRecovery, setLoopbackRecovery] = React.useState(null);
  const [runningVersion, setRunningVersion] = React.useState(IM_PLUGIN_VERSION);
  const [deliverySettings, setDeliverySettings] = React.useState(null);
  const githubTooltipId = React.useId();
  const active = CHANNELS.find((channel) => channel.id === selected) ?? CHANNELS[0];
  const reportLoopbackRecovery = React.useCallback((recovery) => {
    setLoopbackRecovery((current) => current?.url === recovery.url ? current : recovery);
  }, []);
  const reportUpdateStatus = React.useCallback((snapshot) => {
    setRunningVersion(snapshot.runningVersion);
  }, []);
  const rpcCalls = React.useMemo(() => createLoopbackAwareRpcCalls({
    dingtalkRpcCall,
    discordRpcCall,
    feishuRpcCall,
    qqRpcCall,
    slackRpcCall,
    telegramRpcCall,
    wecomRpcCall,
    weixinRpcCall,
    whatsappRpcCall,
    officeRpcCall,
    updateRpcCall,
    deliveryRpcCall,
  }, {
    location: browserLocation,
    onRecovery: reportLoopbackRecovery,
  }), [
    browserLocation,
    dingtalkRpcCall,
    discordRpcCall,
    deliveryRpcCall,
    feishuRpcCall,
    officeRpcCall,
    qqRpcCall,
    reportLoopbackRecovery,
    slackRpcCall,
    telegramRpcCall,
    updateRpcCall,
    wecomRpcCall,
    weixinRpcCall,
    whatsappRpcCall,
  ]);
  const botSettingsContext = React.useMemo(() => Object.freeze({
    openBotSettings: setDeliverySettings,
  }), []);
  return h(WorkspaceDirectoryPickerContext.Provider, { value: workspaceDirectoryPicker },
    h('section', { className: 'dim-page', 'aria-label': 'IM机器人设置' },
    h('header', { className: 'dim-title' },
      h('div', { className: 'dim-brand' },
        h('div', { className: 'dim-brandHeading' },
          h('strong', { className: 'dim-brandName' }, 'DSH-IM'),
          h('span', { className: 'dim-brandVersion' }, `v${runningVersion}`)),
        h('p', null, '让 DeepSeek Harness 触手可及')),
      h('div', { className: 'dim-titleActions' },
        h(UpdatePanel, {
          rpcCall: rpcCalls.updateRpcCall,
          clientVersion: IM_PLUGIN_VERSION,
          onStatus: reportUpdateStatus,
        }),
      h('span', { className: 'dim-githubAction' },
        h('a', {
          className: 'dim-githubLink',
          href: 'https://github.com/xmanrui/dsh-im',
          target: '_blank',
          rel: 'noopener noreferrer',
          'aria-label': 'dsh-im GitHub',
          'aria-describedby': githubTooltipId,
        },
        h('span', null, 'GitHub'),
        h('span', { className: 'dim-githubArrow', 'aria-hidden': 'true' }, '↗')),
        h('span', {
          id: githubTooltipId,
          className: 'dim-githubTooltip',
          role: 'tooltip',
        }, '帮助与反馈 · 前往 GitHub'))),
    ),
    h('div', { className: 'dim-layout' },
      h('nav', { className: 'dim-rail', role: 'tablist', 'aria-label': 'IM 渠道' },
        CHANNELS.map((channel) => h('button', {
          key: channel.id,
          type: 'button',
          role: 'tab',
          id: `dim-tab-${channel.id}`,
          className: 'dim-channel',
          'aria-selected': channel.id === active.id,
          'aria-controls': `dim-panel-${channel.id}`,
          onClick: () => {
            setSelected(channel.id);
            setDeliverySettings(null);
          },
        },
        h(ChannelLogo, { channel: channel.id }),
        h('span', { className: 'dim-channelCopy' },
          h('strong', null, channel.label),
          channel.note ? h('small', { className: 'dim-channelNote' }, channel.note) : null,
        )))),
      h('div', { className: 'dim-divider', 'aria-hidden': 'true' }),
      h('main', {
        className: 'dim-panel',
        role: 'tabpanel',
        id: `dim-panel-${active.id}`,
        'aria-labelledby': `dim-tab-${active.id}`,
      },
      loopbackRecovery
        ? h(LoopbackRecoveryNotice, {
            recovery: loopbackRecovery,
            onNavigate: navigateToRecoveryUrl,
          })
        : null,
      h(BotSettingsContext.Provider, { value: botSettingsContext },
        deliverySettings?.channel === active.id
          ? h(DeliveryTargetSettingsPage, {
              channel: active.id,
              account: deliverySettings,
              rpcCall: rpcCalls.deliveryRpcCall,
              accessRpcCall: rpcCalls[`${active.id}RpcCall`],
              onBack: () => setDeliverySettings(null),
            })
          : active.id === 'weixin'
            ? h(WeixinSettingsTab, { rpcCall: rpcCalls.weixinRpcCall })
            : active.id === 'feishu'
              ? h(FeishuSettingsTab, { rpcCall: rpcCalls.feishuRpcCall })
              : active.id === 'dingtalk'
                ? h(DingtalkSettingsTab, { rpcCall: rpcCalls.dingtalkRpcCall })
                : active.id === 'wecom'
                  ? h(WecomSettingsTab, { rpcCall: rpcCalls.wecomRpcCall })
                  : active.id === 'qq'
                    ? h(QqSettingsTab, { rpcCall: rpcCalls.qqRpcCall })
                    : active.id === 'slack'
                      ? h(SlackSettingsTab, { rpcCall: rpcCalls.slackRpcCall })
                    : active.id === 'telegram'
                      ? h(TelegramSettingsTab, { rpcCall: rpcCalls.telegramRpcCall })
                      : active.id === 'discord'
                        ? h(DiscordSettingsTab, { rpcCall: rpcCalls.discordRpcCall })
                        : active.id === 'whatsapp'
                          ? h(WhatsappSettingsTab, { rpcCall: rpcCalls.whatsappRpcCall })
                          : h(OfficeSettingsTab, { rpcCall: rpcCalls.officeRpcCall }))),
    ),
  ));
}

export function apply(ctx) {
  ctx.effect(
    () => ctx.locale.register(IM_LOCALE_NAMESPACE, { zh, en }),
    'im-settings: bilingual dictionaries',
  );
  const t = ctx.locale.bind(IM_LOCALE_NAMESPACE);
  setImTranslator(t);

  ctx.effect(() => {
    const disposers = [
      installFeishuStyles(),
      installWeixinStyles(),
      installWecomStyles(),
      installQqStyles(),
      installSlackStyles(),
      installTelegramStyles(),
      installDiscordStyles(),
      installWhatsappStyles(),
      installOfficeStyles(),
      installImStyles(),
    ];
    return () => {
      for (const dispose of disposers.reverse()) dispose();
    };
  }, 'im-settings: install combined channel styles');

  const feishuRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(FEISHU_RPC_CHANNEL, endpoint, payload, signal);
  const weixinRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(WEIXIN_RPC_CHANNEL, endpoint, payload, signal);
  const dingtalkRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(DINGTALK_RPC_CHANNEL, endpoint, payload, signal);
  const qqRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(QQ_RPC_CHANNEL, endpoint, payload, signal);
  const wecomRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(WECOM_RPC_CHANNEL, endpoint, payload, signal);
  const telegramRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(TELEGRAM_RPC_CHANNEL, endpoint, payload, signal);
  const discordRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(DISCORD_RPC_CHANNEL, endpoint, payload, signal);
  const whatsappRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(WHATSAPP_RPC_CHANNEL, endpoint, payload, signal);
  const slackRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(SLACK_RPC_CHANNEL, endpoint, payload, signal);
  const officeRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(OFFICE_RPC_CHANNEL, endpoint, payload, signal);
  const updateRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(UPDATE_RPC_CHANNEL, endpoint, payload, signal);
  const deliveryRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(DELIVERY_RPC_CHANNEL, endpoint, payload, signal);
  const workspaceDirectoryPicker = Object.freeze({
    listDirectory: (path, signal) =>
      callWorkspaceDirectoryApi(ctx, 'listDirectory', path, signal),
    pickDirectory: () => callWorkspaceDirectoryApi(ctx, 'pickDirectory'),
  });

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'xmanrui-dsh-im',
    order: 21,
    label: () => t('IM机器人'),
    locale: IM_LOCALE_NAMESPACE,
    inject: () => ({
      dingtalkRpcCall,
      discordRpcCall,
      feishuRpcCall,
      qqRpcCall,
      slackRpcCall,
      telegramRpcCall,
      wecomRpcCall,
      weixinRpcCall,
      whatsappRpcCall,
      officeRpcCall,
      updateRpcCall,
      deliveryRpcCall,
      workspaceDirectoryPicker,
    }),
  }, IMSettingsTab));
}
