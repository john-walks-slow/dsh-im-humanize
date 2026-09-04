import assert from 'node:assert/strict';
import test from 'node:test';

import { Context } from '@deepseek-ai/cordis';

import { createImHostPlugin, inject, name } from '../plugin-src/host/index.mjs';

test('Host composes nine IM channels and the AI Office connector inside one plugin context', async () => {
  const calls = [];
  const deliveryService = { marker: 'shared-delivery-service' };
  const plugin = createImHostPlugin({
    createDeliveryService: () => deliveryService,
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
    'typertGateway',
  ]);
  assert.deepEqual(calls, [
    ['feishu', ctx, { ...config.feishu, rpcAuthority: 'trusted-host', deliveryService }],
    ['weixin', ctx, { ...config.weixin, rpcAuthority: 'trusted-host', deliveryService }],
    ['dingtalk', ctx, { ...config.dingtalk, rpcAuthority: 'trusted-host', deliveryService }],
    ['wecom', ctx, { ...config.wecom, rpcAuthority: 'trusted-host', deliveryService }],
    ['qq', ctx, { ...config.qq, rpcAuthority: 'trusted-host', deliveryService }],
    ['slack', ctx, { ...config.slack, rpcAuthority: 'trusted-host', deliveryService }],
    ['telegram', ctx, { ...config.telegram, rpcAuthority: 'trusted-host', deliveryService }],
    ['discord', ctx, { ...config.discord, rpcAuthority: 'trusted-host', deliveryService }],
    ['whatsapp', ctx, { ...config.whatsapp, rpcAuthority: 'trusted-host', deliveryService }],
    ['office', ctx, { ...config.office, rpcAuthority: 'trusted-host' }],
  ]);
});

test('Host provides #65 and installs #84 with the same delivery service', async () => {
  const sent = [];
  const deliveryService = {
    async send(...args) { sent.push(args); return { sent: true }; },
    async listTargets(botId) {
      return { botId, channel: 'telegram', targets: [{ targetId: 'target' }] };
    },
    async listBots() { return [{ botId: 'bot_one', channel: 'telegram' }]; },
  };
  const provided = [];
  const rpc = [];
  const http = [];
  const channelServices = [];
  const internals = Object.fromEntries(CHANNELS.map(([channel, applyName]) => [
    applyName,
    async (_ctx, config) => {
      if (channel !== 'office') channelServices.push(config.deliveryService);
    },
  ]));
  Object.assign(internals, {
    createDeliveryService: () => deliveryService,
    installUpdateRpc: () => {},
    installDeliveryRpc: (...args) => rpc.push(args),
    installDeliveryHttp: (...args) => http.push(args),
  });
  const ctx = {
    connection: { rpc: {} },
    webServer: { register() {} },
    effect() {},
    provide: (...args) => provided.push(args),
  };

  await createImHostPlugin(internals).apply(ctx, { rpcAuthority: 'trusted-host' });

  assert.equal(provided[0][0], 'dshIm');
  assert.equal(rpc[0][1], deliveryService);
  assert.deepEqual(rpc[0][2], { authority: 'trusted-host' });
  assert.equal(http[0][1], deliveryService);
  assert.ok(channelServices.every((service) => service === deliveryService));
  assert.deepEqual(await provided[0][1].listTargets('bot_one'), [{ targetId: 'target' }]);
  assert.deepEqual(await provided[0][1].listBots(), [{ botId: 'bot_one', channel: 'telegram' }]);
  assert.deepEqual(await provided[0][1].send('bot_one', 'target', 'hello'), { sent: true });
  assert.deepEqual(sent, [['bot_one', 'target', 'hello', undefined]]);
});

test('#65 activates a real Cordis consumer without crossing the Connection RPC', async (t) => {
  const ctx = new Context();
  const rpcCalls = [];
  ctx.provide('connection', {
    rpc: {
      handle: () => async () => {},
      call: (...args) => rpcCalls.push(args),
    },
  });
  ctx.provide('credentials', {});
  ctx.provide('typertGateway', { stream() {} });
  ctx.provide('sessionController', {});
  ctx.provide('workspaceController', {});

  const sent = [];
  const deliveryService = {
    async send(...args) {
      sent.push(args);
      return { sent: true };
    },
    async listTargets() { return { targets: [] }; },
    async listBots() { return []; },
  };
  const internals = Object.fromEntries(CHANNELS.map(([, applyName]) => [
    applyName,
    async () => {},
  ]));
  Object.assign(internals, {
    createDeliveryService: () => deliveryService,
    installUpdateRpc: () => async () => {},
    installDeliveryRpc: () => async () => {},
  });

  const host = ctx.plugin(createImHostPlugin(internals));
  t.after(() => host.dispose());
  await host.await();

  let result;
  const consumer = ctx.plugin({
    name: 'dsh-im-delivery-consumer-test',
    inject: ['dshIm'],
    async apply(consumerCtx) {
      result = await consumerCtx.dshIm.send('bot_one', 'daily-report', '测试消息');
    },
  });
  t.after(() => consumer.dispose());
  await consumer.await();

  assert.deepEqual(result, { sent: true });
  assert.deepEqual(sent, [['bot_one', 'daily-report', '测试消息', undefined]]);
  assert.equal(rpcCalls.length, 0);
});

test('Host waits for apiProxy on legacy Harness and Controllers on modern Harness', async () => {
  for (const [modern, expected] of [
    [false, ['apiProxy']],
    [true, ['sessionController', 'workspaceController']],
  ]) {
    const injections = [];
    const calls = [];
    const plugin = createImHostPlugin(Object.fromEntries(CHANNELS.map(([channel, applyName]) => [
      applyName,
      async () => calls.push(channel),
    ])));
    const ctx = {
      credentials: {},
      typertGateway: modern ? { stream() {} } : { invoke() {} },
      inject(dependencies, callback) {
        injections.push(dependencies);
        if (dependencies.includes('tools') || dependencies.includes('webServer')) return {};
        return {
          then(resolve, reject) {
            Promise.resolve(callback(ctx)).then(resolve, reject);
          },
        };
      },
    };
    await plugin.apply(ctx, {});
    assert.deepEqual(injections[0], expected);
    assert.deepEqual(calls, CHANNELS.map(([channel]) => channel));
  }
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
