import * as React from 'react';

import { h } from './i18n.js';

export function ChannelListHeading({ className = '', id, title, connectionLabel }) {
  const helpId = React.useId();
  return h('div', { className: `${className} dim-listHeading`.trim() },
    h('div', { className: 'dim-listTitle' },
      h('h3', id ? { id } : null, title),
      h('span', { className: 'dim-channelHelp' },
        h('button', {
          type: 'button',
          className: 'dim-channelHelpButton',
          'aria-label': '查看消息通道说明',
          'aria-describedby': helpId,
        }, h('span', { 'aria-hidden': 'true' }, '?')),
        h('span', {
          id: helpId,
          className: 'dim-channelTooltip',
          role: 'tooltip',
        },
        h('span', null, '消息通道'),
        h('strong', null, connectionLabel)))));
}

export function BotStatusMeta({
  className = '',
  dotClassName = '',
  tone,
  stateLabel,
  lastCheckedAt,
  formatCheckedTime,
  healthState,
}) {
  return h('div', { className: 'dim-botHealthGroup' },
    h('div', {
      className: `${className} dim-botHealth`.trim(),
      ...(healthState ? { 'data-health': healthState } : {}),
    },
    h('span', {
      className: `${dotClassName} dim-healthDot`.trim(),
      'data-tone': tone,
    }),
    h('span', null, stateLabel)),
    h('div', { className: 'dim-lastChecked' },
      h('span', null, '最近检查'),
      h('span', null, formatCheckedTime(lastCheckedAt))));
}
