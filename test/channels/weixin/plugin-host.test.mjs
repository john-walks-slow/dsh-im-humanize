import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WEIXIN_ENDPOINTS,
  apply,
  createWeixinRpcHandler,
} from '../../../plugin-src/host/channels/weixin/index.mjs';

function snapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    revision: 1,
    state: 'disconnected',
    bots: [],
    totals: { configured: 0, connected: 0 },
    ...overrides,
  };
}

function controllerFixture() {
  const attempts = new Map();
  const controller = {
    status: () => snapshot(),
    startProvisioning: async () => {
      const value = {
        attemptId: 'attempt-1',
        status: 'pending',
        verificationUrl: 'https://liteapp.weixin.qq.com/q/test',
        expiresAt: Date.now() + 60_000,
        pollIntervalMs: 1_000,
      };
      attempts.set(value.attemptId, value);
      return value;
    },
    registrationStatus: (id) => attempts.get(id) ?? null,
    submitVerification: async (id) => ({ ...attempts.get(id), status: 'scanned' }),
    cancelProvisioning: async (id) => ({ ...attempts.get(id), status: 'cancelled' }),
    reconnectBot: async () => snapshot(),
    sendConnectionTest: async () => ({ sent: true }),
    deleteBot: async () => snapshot(),
  };
  return controller;
}

test('Host plugin registers the Weixin RPC channel as loopback-only', async () => {
  let registration;
  const dispose = async () => {};
  const ctx = {
    connection: { rpc: { handle: (channel, handler, options) => {
      registration = { channel, handler, options };
      return dispose;
    } } },
  };
  const returned = await apply(ctx, { controller: controllerFixture() });
  assert.equal(returned, dispose);
  assert.equal(registration.channel, '/weixin');
  assert.deepEqual(registration.options, { authority: 'loopback' });
});

test('Host plugin opts the Weixin RPC channel into trusted Host authorities', async () => {
  let registration;
  const ctx = {
    connection: { rpc: { handle: (channel, handler, options) => {
      registration = { channel, handler, options };
      return async () => {};
    } } },
  };
  await apply(ctx, {
    controller: controllerFixture(),
    rpcAuthority: 'trusted-host',
  });
  assert.deepEqual(registration.options, { authority: 'trusted-host' });
});

test('RPC returns QR data and verification states without exposing secret-shaped fields', async () => {
  const controller = controllerFixture();
  const handler = createWeixinRpcHandler(controller, {
    encodeQr: async (url) => `data:image/png;base64,${Buffer.from(url).toString('base64')}`,
  });
  const signal = new AbortController().signal;

  const begun = await handler(WEIXIN_ENDPOINTS.beginProvisioning, {}, signal);
  assert.equal(begun.ok, true);
  assert.match(begun.value.qrCodeDataUrl, /^data:image\/png;base64,/);
  const verified = await handler(WEIXIN_ENDPOINTS.submitVerification, {
    attemptId: 'attempt-1', verifyCode: '123456',
  }, signal);
  assert.equal(verified.ok, true);
  assert.equal(verified.value.status, 'scanned');

  const secretAttempt = await handler(WEIXIN_ENDPOINTS.beginProvisioning, {
    bot_token: 'must-never-cross-the-browser-boundary',
  }, signal);
  assert.equal(secretAttempt.ok, false);
  assert.equal(secretAttempt.error.code, 'bad-request');
  assert.doesNotMatch(JSON.stringify(secretAttempt), /must-never-cross/);
});

test('RPC requires explicit confirmation before removing a Weixin account', async () => {
  const handler = createWeixinRpcHandler(controllerFixture());
  const result = await handler(WEIXIN_ENDPOINTS.deleteBot, {
    botId: 'wx_0123456789abcdef01234567',
    confirm: false,
  }, new AbortController().signal);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'bad-request');
});

test('RPC sends a Weixin connection test only after reconnect reports the account connected', async () => {
  const botId = 'wx_0123456789abcdef01234567';
  const sent = [];
  const connected = controllerFixture();
  connected.reconnectBot = async () => snapshot({
    state: 'connected',
    bots: [{ botId, connected: true }],
    totals: { configured: 1, connected: 1 },
  });
  connected.sendConnectionTest = async (id) => { sent.push(id); };
  const success = await createWeixinRpcHandler(connected)(WEIXIN_ENDPOINTS.reconnectBot, {
    botId, sendTest: true,
  });
  assert.equal(success.ok, true);
  assert.deepEqual(success.value.testMessage, { sent: true });
  assert.deepEqual(sent, [botId]);

  connected.sendConnectionTest = async () => { throw new Error('send rejected'); };
  const failedSend = await createWeixinRpcHandler(connected)(WEIXIN_ENDPOINTS.reconnectBot, {
    botId, sendTest: true,
  });
  assert.equal(failedSend.ok, true);
  assert.deepEqual(failedSend.value.testMessage, {
    sent: false, code: 'test-message-failed',
  });

  let offlineSendCalled = false;
  const offline = controllerFixture();
  offline.reconnectBot = async () => snapshot({
    state: 'offline',
    bots: [{ botId, connected: false }],
    totals: { configured: 1, connected: 0 },
  });
  offline.sendConnectionTest = async () => { offlineSendCalled = true; };
  const unavailable = await createWeixinRpcHandler(offline)(WEIXIN_ENDPOINTS.reconnectBot, {
    botId, sendTest: true,
  });
  assert.equal(unavailable.ok, true);
  assert.deepEqual(unavailable.value.testMessage, {
    sent: false, code: 'test-target-unavailable',
  });
  assert.equal(offlineSendCalled, false);
  const missingMethod = controllerFixture();
  missingMethod.reconnectBot = connected.reconnectBot;
  delete missingMethod.sendConnectionTest;
  const missing = await createWeixinRpcHandler(missingMethod)(WEIXIN_ENDPOINTS.reconnectBot, {
    botId, sendTest: true,
  });
  assert.equal(missing.ok, true);
  assert.deepEqual(missing.value.testMessage, {
    sent: false, code: 'test-target-unavailable',
  });
  assert.equal((await createWeixinRpcHandler(connected)(WEIXIN_ENDPOINTS.reconnectBot, {
    botId, sendTest: false,
  })).ok, false);
});
