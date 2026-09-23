import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { Context } from '@deepseek-ai/cordis';

import { setImHostLanguage } from '../src/channels/shared/i18n.mjs';
import { createImHostPlugin, inject, name } from '../plugin-src/host/index.mjs';
import {
  DEFAULT_SEND_DELAY_CONFIG,
} from '../src/channels/shared/send-delay.mjs';
import {
  DEFAULT_TYPING_BURST,
  DEFAULT_TYPING_INDICATOR,
} from '../src/channels/shared/typing-session.mjs';

/** Deterministic settings path: absent file ⇒ built-in defaults. */
function tempSettingsPath(label) {
  return join(tmpdir(), `dsh-im-humanize-${label}-${process.pid}-${Date.now()}.json`);
}

const NO_CHANNELS = Object.freeze({
  applyFeishu: async () => {}, applyWeixin: async () => {}, applyDingtalk: async () => {},
  applyWecom: async () => {}, applyWecomApp: async () => {}, applyQq: async () => {},
  applySlack: async () => {}, applyDiscord: async () => {}, applyWhatsapp: async () => {},
  applyIMessage: async () => {}, applyOffice: async () => {},
});

test('Host resolves the bot message language before channels start and serves its RPC', async () => {
  const order = [];
  let resolved = false;
  const controller = {
    apply: () => ({}),
    snapshot: () => ({}),
    mirror: async () => ({}),
    ready: Promise.resolve().then(() => { resolved = true; }),
  };
  const plugin = createImHostPlugin({
    ...NO_CHANNELS,
    createDeliveryService: () => ({}),
    installUpdateRpc: () => {}, installInboundTtlRpc: () => {},
    installDeliveryRpc: () => {}, installDeliveryHttp: () => {},
    installSessionSyncCoordinator: () => {},
    installHostLanguage: (_ctx, config) => {
      order.push(['language', config.language]);
      return controller;
    },
    installHostLanguageRpc: (_ctx, given, authority) => {
      order.push(['language-rpc', given === controller, authority]);
    },
    applyTelegram: async () => { order.push(['telegram', resolved]); },
  });

  await plugin.apply({ connection: { fetch: {} } }, {
    language: 'en',
    rpcAuthority: 'trusted-host',
    telegram: {},
  });

  assert.deepEqual(order[0], ['language', 'en']);
  assert.deepEqual(order.find(([kind]) => kind === 'language-rpc'),
    ['language-rpc', true, 'trusted-host']);
  assert.deepEqual(order.find(([kind]) => kind === 'telegram'), ['telegram', true]);
});

test('Host composes IM channels and the AI Office connector inside one plugin context', async () => {
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
    applyIMessage: async (ctx, config) => calls.push(['imessage', ctx, config]),
    applyOffice: async (ctx, config) => calls.push(['office', ctx, config]),
  });
  const ctx = { marker: 'shared-context' };
  const config = {
    rpcAuthority: 'trusted-host',
    humanizeSettingsPath: tempSettingsPath('compose'),
    feishu: { domain: 'feishu' },
    weixin: { timeout: 30 },
    dingtalk: { replyTimeoutMs: 60_000 },
    wecom: { replyTimeoutMs: 60_000 },
    qq: { replyTimeoutMs: 60_000 },
    slack: { replyTimeoutMs: 60_000 },
    telegram: { replyTimeoutMs: 60_000 },
    discord: { replyTimeoutMs: 60_000 },
    whatsapp: { replyTimeoutMs: 60_000 },
    imessage: { replyTimeoutMs: 60_000 },
    office: { heartbeatSeconds: 30 },
  };

  await plugin.apply(ctx, config);

  assert.equal(name, 'dsh-im-host');
  assert.deepEqual(inject, [
    'connection',
    'credentials',
    'typertGateway',
  ]);
  // Humanization settings from the store snapshot are forwarded to every
  // channel config (previously dropped: the panel values never reached
  // the runtimes), alongside the live humanizeDefaults accessor.
  const expectedHumanize = {
    streaming: true,
    messageBreak: true,
    onNewMessage: 'interrupt',
    sendDelay: DEFAULT_SEND_DELAY_CONFIG,
    typingIndicator: DEFAULT_TYPING_INDICATOR,
    typingBurst: DEFAULT_TYPING_BURST,
    statusReaction: true,
    replyQuote: true,
    progressStatus: true,
  };
  assert.deepEqual(calls.map(([channel]) => channel), [
    'feishu', 'weixin', 'dingtalk', 'wecom', 'qq',
    'slack', 'telegram', 'discord', 'whatsapp', 'imessage', 'office',
  ]);
  for (const [channel, ctxArg, channelConfigArg] of calls) {
    assert.equal(ctxArg, ctx, `${channel} receives the shared context`);
    const { humanizeDefaults, ...rest } = channelConfigArg;
    assert.equal(typeof humanizeDefaults, 'function', `${channel} gets the live accessor`);
    assert.deepEqual(
      Object.keys(humanizeDefaults(channel)).sort(),
      Object.keys(expectedHumanize).sort(),
      `${channel} accessor covers every humanization key`,
    );
    assert.deepEqual(
      humanizeDefaults(channel),
      expectedHumanize,
    );
    assert.deepEqual(rest, {
      ...config[channel],
      rpcAuthority: 'trusted-host',
      ...(channel === 'office' ? {} : { deliveryService }),
      ...expectedHumanize,
    }, `${channel} config forwards humanization settings`);
  }
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
    connection: { fetch: {} },
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
    fetch: { register: () => async () => {} },
    rpc: {
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

test('Host installs channel prefixes through the real Cordis sessions dependency', async (t) => {
  const previousLanguage = setImHostLanguage('zh');
  t.after(() => setImHostLanguage(previousLanguage));
  const ctx = new Context();
  ctx.provide('connection', { fetch: { register: () => () => {} } });
  ctx.provide('credentials', {});
  ctx.provide('typertGateway', { stream() {} });
  ctx.provide('sessionController', {});
  ctx.provide('workspaceController', {});
  const data = { title: '自动标题', messageSeqs: [0], source: { kind: 'fallback' } };
  const events = [{ type: 'session/title', seq: 1, data }];
  const session = {
    id: 'weixin-old-session',
    snapshotEvents: () => events.slice(),
    append(type, value) { events.push({ type, data: value, seq: events.length + 1 }); },
  };
  ctx.provide('sessions', { get: () => session, list: () => [session] });
  const internals = Object.fromEntries(CHANNELS.map(([, applyName]) => [applyName, async () => {}]));
  Object.assign(internals, {
    installUpdateRpc: () => {}, installInboundTtlRpc: () => {},
    installDeliveryRpc: () => {}, installSessionSyncCoordinator: () => {},
    // The language test is about session-title prefixes, not the interface
    // language: keep it off the real ~/.dsh mirror so a language a tester set
    // locally cannot leak into this assertion.
    installHostLanguage: () => ({ ready: Promise.resolve() }),
    installHostLanguageRpc: () => {},
  });
  const host = ctx.plugin(createImHostPlugin(internals));
  t.after(() => host.dispose());
  await host.await();
  await new Promise((done) => setTimeout(done, 0));
  assert.deepEqual(events.at(-1).data, { ...data, title: '微信 · 自动标题' });
  assert.equal(events.length, 2);
});

test('Session title injection returns a valid Cordis startup effect', async () => {
  const effects = [];
  let installed = false;
  const ctx = {
    credentials: {}, typertGateway: { stream() {} },
    sessions: { get: () => undefined, list: () => [] },
    on: () => () => {},
    effect: (run) => { effects.push(run()); },
    inject(dependencies, callback) {
      if (dependencies.includes('sessions')) {
        const result = callback(ctx);
        assert.equal(result, undefined, 'a controller object makes Cordis unload the title observer');
        installed = true;
        return;
      }
      if (dependencies.includes('sessionController')) return callback(ctx);
    },
  };
  const internals = Object.fromEntries(CHANNELS.map(([, applyName]) => [applyName, async () => {}]));
  Object.assign(internals, { installSessionSyncCoordinator: () => {} });
  await createImHostPlugin(internals).apply(ctx);
  assert.equal(installed, true);
  for (const dispose of effects.reverse()) dispose?.();
});

const CHANNELS = [
  ['feishu', 'applyFeishu'],
  ['weixin', 'applyWeixin'],
  ['dingtalk', 'applyDingtalk'],
  ['wecom', 'applyWecom'],
  ['wecomApp', 'applyWecomApp'],
  ['qq', 'applyQq'],
  ['slack', 'applySlack'],
  ['telegram', 'applyTelegram'],
  ['discord', 'applyDiscord'],
  ['whatsapp', 'applyWhatsapp'],
  ['imessage', 'applyIMessage'],
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

test('Host starts all channels before awaiting them and isolates activation failures', async () => {
  for (const [failedChannel] of CHANNELS) {
    const fixture = activationFixture(new Set([failedChannel]));

    await fixture.plugin.apply(fixture.ctx, {});

    assert.deepEqual(fixture.calls, CHANNELS.map(([channel]) => channel));
    assert.deepEqual(fixture.events, [
      ...CHANNELS.map(([channel]) => `${channel}:start`),
      ...CHANNELS.map(([channel]) => `${channel}:${channel === failedChannel ? 'failed' : 'end'}`),
    ]);
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

test('humanizeDefaults resolves channel priority and reflects live store updates', async () => {
  const settingsPath = tempSettingsPath('live');
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify({
    streaming: false,
    typingIndicator: 'continuous',
  }));

  const capturedConfigs = new Map();
  const internals = Object.fromEntries(CHANNELS.map(([channel, applyName]) => [
    applyName,
    async (_ctx, config) => capturedConfigs.set(channel, config),
  ]));
  let humanizeHandler = null;
  const ctx = {
    connection: {
      fetch: {
        register: (route) => {
          if (route.path === '/api/dsh-im/dsh-im-humanize') humanizeHandler = route.fetch;
          return () => {};
        },
      },
    },
  };
  const config = {
    humanizeSettingsPath: settingsPath,
    // Explicit dsh-config value: wins over the store (messageBreak would
    // default to true from the store).
    messageBreak: false,
    // Channel sub-object: wins over both the store and the top level.
    telegram: { streaming: true },
  };

  await createImHostPlugin({
    ...internals,
    createDeliveryService: () => ({}),
    installUpdateRpc: () => {},
  }).apply(ctx, config);

  // Activation snapshot: every channel received the resolved values.
  assert.equal(capturedConfigs.get('slack').streaming, false); // store value
  assert.equal(capturedConfigs.get('slack').messageBreak, false); // explicit top-level
  assert.equal(capturedConfigs.get('slack').typingIndicator, 'continuous');
  assert.equal(capturedConfigs.get('telegram').streaming, true); // channel sub-object

  // Live accessor honors the same priority chain.
  const slackDefaults = capturedConfigs.get('slack').humanizeDefaults;
  assert.equal(slackDefaults('slack').streaming, false);
  assert.equal(slackDefaults('slack').messageBreak, false);
  assert.equal(slackDefaults('slack').typingIndicator, 'continuous');
  assert.equal(slackDefaults('telegram').streaming, true);
  assert.deepEqual(
    slackDefaults('telegram').sendDelay,
    DEFAULT_SEND_DELAY_CONFIG,
  );
  // New keys ride the same forwarding: absent everywhere means true, and a
  // channel sub-object override wins over the live store.
  assert.equal(slackDefaults('slack').statusReaction, true);
  assert.equal(slackDefaults('slack').replyQuote, true);

  // A panel write through the humanize RPC updates the store live: the
  // next turn's accessor read sees it without a plugin restart.
  assert.ok(humanizeHandler, 'humanize RPC handler registered');
  async function humanizeCall(method, payload) {
    const response = await humanizeHandler(new Request('http://dsh.internal/api/dsh-im/dsh-im-humanize', {
      method: 'POST',
      headers: { host: '127.0.0.1', 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: 'req-' + method,
        method: 'dsh-im/dsh-im-humanize',
        payload: { method, payload },
      }),
    }));
    const json = await response.json();
    return json.result;
  }
  const result = await humanizeCall('humanize.set', {
    typingIndicator: 'burst',
    statusReaction: false,
  });
  assert.equal(result.ok, true);
  assert.equal(slackDefaults('slack').typingIndicator, 'burst');
  assert.equal(slackDefaults('slack').statusReaction, false);
  assert.equal(slackDefaults('slack').replyQuote, true, 'untouched new keys keep their default');
  assert.equal(slackDefaults('slack').streaming, false, 'untouched keys keep their values');

  // Malformed writes are rejected with field information.
  const rejected = await humanizeCall('humanize.set', { sendDelay: { readDelay: { minMs: -1 } } });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, 'invalid-send-delay');
  assert.equal(rejected.error.field, 'sendDelay.readDelay.minMs');

  await rm(settingsPath, { force: true });
});
