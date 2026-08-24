import assert from 'node:assert/strict';
import test from 'node:test';

import { createImHostPlugin, inject, name } from '../plugin-src/host/index.mjs';

test('Host composes nine IM channels and the AI Office connector inside one plugin context', async () => {
  const calls = [];
  const plugin = createImHostPlugin({
    applyFeishu: async (ctx, config) => calls.push(['feishu', ctx, config]),
    applyWeixin: async (ctx, config) => calls.push(['weixin', ctx, config]),
    applyDingtalk: async (ctx, config) => calls.push(['dingtalk', ctx, config]),
    applyWecom: async (ctx, config) => calls.push(['wecom', ctx, config]),
    applyQq: async (ctx, config) => calls.push(['qq', ctx, config]),
    applySlack: async (ctx, config) => calls.push(['slack', ctx, config]),
    applyTelegram: async (ctx, config) => calls.push(['telegram', ctx, config]),
    applyDiscord: async (ctx, config) => calls.push(['discord', ctx, config]),
    applyWhatsapp: async (ctx, config) => calls.push(['whatsapp', ctx, config]),
    applyOffice: async (ctx, config) => calls.push(['office', ctx, config]),
  });
  const ctx = { marker: 'shared-context' };
  const config = {
    rpcAuthority: 'trusted-host',
    feishu: { domain: 'feishu' },
    weixin: { timeout: 30 },
    dingtalk: { replyTimeoutMs: 60_000 },
    wecom: { replyTimeoutMs: 60_000 },
    qq: { replyTimeoutMs: 60_000 },
    slack: { replyTimeoutMs: 60_000 },
    telegram: { replyTimeoutMs: 60_000 },
    discord: { replyTimeoutMs: 60_000 },
    whatsapp: { replyTimeoutMs: 60_000 },
    office: { heartbeatSeconds: 30 },
  };

  await plugin.apply(ctx, config);

  assert.equal(name, 'dsh-im-host');
  assert.deepEqual(inject, [
    'connection',
    'credentials',
    'webServer',
    'typertGateway',
  ]);
  assert.deepEqual(calls, [
    ['feishu', ctx, { ...config.feishu, rpcAuthority: 'trusted-host' }],
    ['weixin', ctx, { ...config.weixin, rpcAuthority: 'trusted-host' }],
    ['dingtalk', ctx, { ...config.dingtalk, rpcAuthority: 'trusted-host' }],
    ['wecom', ctx, { ...config.wecom, rpcAuthority: 'trusted-host' }],
    ['qq', ctx, { ...config.qq, rpcAuthority: 'trusted-host' }],
    ['slack', ctx, { ...config.slack, rpcAuthority: 'trusted-host' }],
    ['telegram', ctx, { ...config.telegram, rpcAuthority: 'trusted-host' }],
    ['discord', ctx, { ...config.discord, rpcAuthority: 'trusted-host' }],
    ['whatsapp', ctx, { ...config.whatsapp, rpcAuthority: 'trusted-host' }],
    ['office', ctx, { ...config.office, rpcAuthority: 'trusted-host' }],
  ]);
});

const CHANNELS = [
  ['feishu', 'applyFeishu'],
  ['weixin', 'applyWeixin'],
  ['dingtalk', 'applyDingtalk'],
  ['wecom', 'applyWecom'],
  ['qq', 'applyQq'],
  ['slack', 'applySlack'],
  ['telegram', 'applyTelegram'],
  ['discord', 'applyDiscord'],
  ['whatsapp', 'applyWhatsapp'],
  ['office', 'applyOffice'],
];

function activationFixture(failedChannels) {
  const calls = [];
  const events = [];
  const errors = [];
  const failures = new Map();
  const internals = Object.fromEntries(CHANNELS.map(([channel, applyName]) => [
    applyName,
    async () => {
      calls.push(channel);
      events.push(`${channel}:start`);
      await new Promise((resolve) => setImmediate(resolve));
      if (failedChannels.has(channel)) {
        const error = new Error(`${channel} unavailable`);
        failures.set(channel, error);
        events.push(`${channel}:failed`);
        throw error;
      }
      events.push(`${channel}:end`);
    },
  ]));
  const ctx = { logger: { error: (...args) => errors.push(args) } };
  return { plugin: createImHostPlugin(internals), ctx, calls, events, errors, failures };
}

test('Host continues activating channels in order when one channel fails', async () => {
  for (const [failedChannel] of CHANNELS) {
    const fixture = activationFixture(new Set([failedChannel]));

    await fixture.plugin.apply(fixture.ctx, {});

    assert.deepEqual(fixture.calls, CHANNELS.map(([channel]) => channel));
    assert.deepEqual(fixture.events, CHANNELS.flatMap(([channel]) => [
      `${channel}:start`,
      `${channel}:${channel === failedChannel ? 'failed' : 'end'}`,
    ]));
    assert.equal(fixture.errors.length, 1);
    assert.match(fixture.errors[0][0], new RegExp(`activate ${failedChannel}`));
    assert.equal(fixture.errors[0][1], fixture.failures.get(failedChannel));
  }
});

test('Host reports aggregate failure only after every channel was attempted', async () => {
  const fixture = activationFixture(new Set(CHANNELS.map(([channel]) => channel)));

  await assert.rejects(
    () => fixture.plugin.apply(fixture.ctx, {}),
    (error) => error instanceof AggregateError
      && error.errors.length === CHANNELS.length
      && /failed to activate every channel/.test(error.message),
  );
  assert.deepEqual(fixture.calls, CHANNELS.map(([channel]) => channel));
  assert.equal(fixture.errors.length, CHANNELS.length);
});
