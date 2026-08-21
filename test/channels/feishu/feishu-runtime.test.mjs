import assert from 'node:assert/strict';
import test from 'node:test';
import { FeishuRuntime } from '../../../src/channels/feishu/feishu-runtime.mjs';
import { rememberConnectionTestTarget } from '../../../src/channels/shared/connection-test.mjs';

class FakeClient {
  static instances = [];
  static sent = [];

  constructor(options) {
    this.options = options;
    this.im = {
      v1: {
        message: {
          create: async (payload) => {
            FakeClient.sent.push(payload);
            return { code: 0, data: { message_id: `message-${FakeClient.sent.length}` } };
          },
        },
      },
    };
    FakeClient.instances.push(this);
  }
}

class FakeDispatcher {
  register(handlers) {
    this.handlers = handlers;
    return this;
  }
}

class FakeWSClient {
  static instances = [];

  constructor(options) {
    this.options = options;
    this.state = 'idle';
    FakeWSClient.instances.push(this);
  }

  async start({ eventDispatcher } = {}) {
    this.state = 'connecting';
    this.dispatcher = eventDispatcher;
  }

  becomeReady() {
    this.state = 'connected';
    this.options.onReady();
  }

  getConnectionStatus() {
    return { state: this.state };
  }

  close() {
    this.state = 'closed';
  }
}

function fakeLark() {
  FakeWSClient.instances.length = 0;
  FakeClient.instances.length = 0;
  FakeClient.sent.length = 0;
  return {
    Domain: { Feishu: 'feishu-domain', Lark: 'lark-domain' },
    LoggerLevel: { info: 'info' },
    Client: FakeClient,
    EventDispatcher: FakeDispatcher,
    WSClient: FakeWSClient,
    defaultHttpInstance: {
      request: async (options) => options,
      get: async (_url, options) => options,
      delete: async (_url, options) => options,
      head: async (_url, options) => options,
      options: async (_url, options) => options,
      post: async (_url, _data, options) => options,
      put: async (_url, _data, options) => options,
      patch: async (_url, _data, options) => options,
    },
  };
}

test('FeishuRuntime becomes chat-ready only after Harness and Feishu are connected', async () => {
  let harnessChecks = 0;
  let harnessSignal;
  const runtime = new FeishuRuntime({
    lark: fakeLark(),
    appId: 'cli_test',
    appSecret: 'secret',
    ownerOpenIds: ['*', 'ou_owner'],
    harness: {
      async ensureRunning(options) {
        harnessChecks += 1;
        harnessSignal = options.signal;
      },
    },
    state: { hasSeen: () => false },
  });

  assert.equal(runtime.status.ready, false);
  let settled = false;
  const starting = runtime.start().then((value) => {
    settled = true;
    return value;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  assert.equal(runtime.status.feishuLongConnectionState, 'connecting');
  FakeWSClient.instances[0].becomeReady();
  const status = await starting;
  assert.equal(harnessChecks, 1);
  assert.equal(status.ready, true);
  assert.equal(status.feishuLongConnectionState, 'connected');
  assert.equal(status.harnessReachable, true);
  assert.equal(harnessSignal.aborted, false);
  assert.equal((await FakeClient.instances[0].options.httpInstance.request({
    url: 'https://open.feishu.cn/test',
  })).timeout, 15_000);

  assert.deepEqual(await runtime.sendConnectionTest('连接测试'), { sent: true });
  assert.deepEqual(FakeClient.sent, [{
    params: { receive_id_type: 'open_id' },
    data: {
      receive_id: 'ou_owner',
      msg_type: 'text',
      content: JSON.stringify({ text: '连接测试' }),
    },
  }]);

  const stopped = await runtime.stop();
  assert.equal(stopped.ready, false);
  assert.equal(stopped.feishuLongConnectionState, 'idle');
  assert.equal(FakeWSClient.instances[0].state, 'closed');
  assert.equal(harnessSignal.aborted, true);
});

test('FeishuRuntime uses a remembered private target for wildcard-only manual bots', async () => {
  const state = { hasSeen: () => false };
  const runtime = new FeishuRuntime({
    lark: fakeLark(),
    appId: 'cli_manual',
    appSecret: 'secret',
    ownerOpenIds: ['*'],
    harness: { async ensureRunning() {} },
    state,
  });

  const starting = runtime.start();
  await new Promise((resolve) => setImmediate(resolve));
  FakeWSClient.instances[0].becomeReady();
  await starting;

  await assert.rejects(
    runtime.sendConnectionTest('连接测试'),
    (error) => error?.code === 'test-target-unavailable',
  );
  rememberConnectionTestTarget(state, { chatId: 'oc_manual_private' });
  assert.deepEqual(await runtime.sendConnectionTest('连接测试'), { sent: true });
  assert.deepEqual(FakeClient.sent, [{
    params: { receive_id_type: 'chat_id' },
    data: {
      receive_id: 'oc_manual_private',
      msg_type: 'text',
      content: JSON.stringify({ text: '连接测试' }),
    },
  }]);

  await runtime.stop();
});

test('FeishuRuntime fails closed when the initial WebSocket handshake times out', async () => {
  const runtime = new FeishuRuntime({
    lark: fakeLark(),
    appId: 'cli_test',
    appSecret: 'secret',
    ownerOpenId: 'ou_owner',
    harness: { async ensureRunning() {} },
    state: { hasSeen: () => false },
    connectTimeoutMs: 10,
  });

  await assert.rejects(runtime.start(), /handshake timed out/);
  assert.equal(runtime.status.ready, false);
  assert.equal(runtime.status.feishuLongConnectionState, 'failed');
  assert.equal(FakeWSClient.instances[0].state, 'closed');
});

test('FeishuRuntime fails closed when Harness is unavailable', async () => {
  const runtime = new FeishuRuntime({
    lark: fakeLark(),
    appId: 'cli_test',
    appSecret: 'secret',
    ownerOpenId: 'ou_owner',
    harness: {
      async ensureRunning() { throw new Error('Harness unavailable'); },
    },
    state: { hasSeen: () => false },
  });

  await assert.rejects(runtime.start(), /Harness unavailable/);
  assert.equal(runtime.status.ready, false);
  assert.equal(runtime.status.feishuLongConnectionState, 'failed');
  assert.equal(runtime.status.lastError, 'Harness unavailable');
});

async function startRuntimeForProbe(options = {}) {
  const runtime = new FeishuRuntime({
    lark: fakeLark(),
    botId: 'bot_probe',
    appId: 'cli_probe',
    appSecret: 'secret',
    ownerOpenIds: ['ou_owner'],
    harness: { async ensureRunning() {} },
    state: { hasSeen: () => false },
    ...options,
  });
  const starting = runtime.start();
  await new Promise((resolve) => setImmediate(resolve));
  FakeWSClient.instances[0].becomeReady();
  await starting;
  return runtime;
}

function probeAction({ messageId = 'message-1', nonce, operatorOpenId = 'ou_owner' } = {}) {
  return {
    operator: { open_id: operatorOpenId },
    action: { value: { action: 'repair_verify', nonce } },
    context: { open_message_id: messageId },
  };
}

test('FeishuRuntime resolves a card-action probe only for the exact message, nonce and operator', async () => {
  const runtime = await startRuntimeForProbe();
  let settled = false;
  const probe = runtime.beginCardActionProbe({
    expectedOperatorOpenId: 'ou_owner',
    timeoutMs: 1_000,
  }).then((value) => {
    settled = true;
    return value;
  });
  await new Promise((resolve) => setImmediate(resolve));

  const request = FakeClient.sent[0];
  assert.deepEqual(request.params, { receive_id_type: 'open_id' });
  assert.equal(request.data.receive_id, 'ou_owner');
  assert.equal(request.data.msg_type, 'interactive');
  const card = JSON.parse(request.data.content);
  const behavior = card.body.elements[1].columns[0].elements[0].behaviors[0];
  assert.equal(behavior.value.action, 'repair_verify');
  const nonce = behavior.value.nonce;
  assert.match(nonce, /^[A-Za-z0-9_-]{16,128}$/);

  const dispatch = FakeWSClient.instances[0].dispatcher.handlers['card.action.trigger'];
  dispatch(probeAction({ messageId: 'message-other', nonce }));
  dispatch(probeAction({ nonce: `${nonce}x` }));
  dispatch(probeAction({ nonce, operatorOpenId: 'ou_other' }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);

  dispatch(probeAction({ nonce }));
  assert.deepEqual(await probe, {
    verified: true,
    messageId: 'message-1',
    operatorOpenId: 'ou_owner',
  });
  assert.equal(runtime.status.cardActionsReceived, 4);
  assert.equal(runtime.status.cardActionProbesVerified, 1);
  assert.equal(FakeClient.sent.length, 2);
  assert.deepEqual(FakeClient.sent[1], {
    params: { receive_id_type: 'open_id' },
    data: {
      receive_id: 'ou_owner',
      msg_type: 'text',
      content: JSON.stringify({
        text: '✅ 修复完成：已实测收到 card.action.trigger，菜单按钮现在可用。',
      }),
    },
  });
  await runtime.stop();
});

test('FeishuRuntime times out and aborts pending card-action probes with stable codes', async () => {
  const runtime = await startRuntimeForProbe();
  await assert.rejects(
    runtime.beginCardActionProbe({ expectedOperatorOpenId: 'ou_owner', timeoutMs: 10 }),
    (error) => error?.code === 'card_action_probe_timeout',
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(
    JSON.parse(FakeClient.sent.at(-1).data.content).text,
    /修复验证超时.*不能确认按钮已修复.*不要重复授权/,
  );

  const pending = runtime.beginCardActionProbe({
    expectedOperatorOpenId: 'ou_owner',
    timeoutMs: 1_000,
  });
  await new Promise((resolve) => setImmediate(resolve));
  await runtime.stop();
  await assert.rejects(pending, (error) => error?.code === 'abort');
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(
    JSON.parse(FakeClient.sent.at(-1).data.content).text,
    /修复验证中断.*不能确认修复成功.*不要重复授权/,
  );
});

test('FeishuRuntime reports probe-card send failure without masking its stable error', async () => {
  const runtime = await startRuntimeForProbe();
  const client = FakeClient.instances[0];
  client.im.v1.message.create = async (payload) => {
    FakeClient.sent.push(payload);
    if (payload.data.msg_type === 'interactive') return { code: 230001 };
    return { code: 0, data: { message_id: 'failure-notice' } };
  };

  await assert.rejects(
    runtime.beginCardActionProbe({ expectedOperatorOpenId: 'ou_owner', timeoutMs: 1_000 }),
    (error) => error?.code === 'card_action_probe_send_failed',
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(FakeClient.sent.length, 2);
  assert.match(
    JSON.parse(FakeClient.sent[1].data.content).text,
    /修复验证失败.*不能确认 card\.action\.trigger 已恢复.*不要重复授权/,
  );
  await runtime.stop();
});

test('FeishuRuntime rejects imprecise probe operators and probes before connection', async () => {
  const runtime = new FeishuRuntime({
    lark: fakeLark(),
    botId: 'bot_probe',
    appId: 'cli_probe',
    appSecret: 'secret',
    ownerOpenIds: ['*'],
    harness: { async ensureRunning() {} },
    state: { hasSeen: () => false },
  });
  await assert.rejects(
    runtime.beginCardActionProbe({ expectedOperatorOpenId: 'ou_owner' }),
    (error) => error?.code === 'card_action_probe_unavailable',
  );

  const starting = runtime.start();
  await new Promise((resolve) => setImmediate(resolve));
  FakeWSClient.instances[0].becomeReady();
  await starting;
  await assert.rejects(
    runtime.beginCardActionProbe({ expectedOperatorOpenId: '*' }),
    /precise Feishu operator/,
  );
  await runtime.stop();
});
