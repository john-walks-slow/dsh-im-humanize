import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DisconnectReason } from '@whiskeysockets/baileys';

import {
  WhatsappConfigStore,
  deriveWhatsappBotId,
} from '../../../src/channels/whatsapp/config-store.mjs';
import { WhatsappController } from '../../../src/channels/whatsapp/whatsapp-controller.mjs';
import {
  WhatsappRuntime,
  normalizeWhatsappMessage,
} from '../../../src/channels/whatsapp/whatsapp-runtime.mjs';
import { createWhatsappWebSession } from '../../../src/channels/whatsapp/whatsapp-web-session.mjs';
import {
  WHATSAPP_ENDPOINTS,
  createWhatsappRpcHandler,
} from '../../../plugin-src/host/channels/whatsapp/rpc.mjs';

const ACCOUNT_JID = '16505550123@s.whatsapp.net';
const AUTH_DIRECTORY = '7fe8c17e-4fb7-4c5b-a9dc-c36525575dd1';

function linkedConfig(overrides = {}) {
  return {
    botId: deriveWhatsappBotId(ACCOUNT_JID),
    accountJid: ACCOUNT_JID,
    authDirectory: AUTH_DIRECTORY,
    name: 'Harness WhatsApp',
    createdAt: new Date().toISOString(),
    connectedAt: new Date().toISOString(),
    ...overrides,
  };
}

test('WhatsApp config stores only linked-device metadata with restrictive permissions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-im-whatsapp-config-'));
  const path = join(root, 'config.json');
  const store = await new WhatsappConfigStore(path).load();
  await store.save(linkedConfig());
  assert.equal(store.list()[0].accountJid, ACCOUNT_JID);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await assert.rejects(() => store.save(linkedConfig({ botId: 'whatsapp_invalid' })));
});

test('WhatsApp Web session reports QR and linked identity without printing either', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-im-whatsapp-session-'));
  const events = new EventEmitter();
  let ended = false;
  const socket = {
    ev: events,
    user: { id: '16505550123:4@s.whatsapp.net', name: 'Harness WhatsApp' },
    end: async () => { ended = true; },
    logout: async () => {},
  };
  const qrValues = [];
  const session = await createWhatsappWebSession({
    authDir: root,
    onQr: (value) => qrValues.push(value),
    makeSocket: () => socket,
    loadAuthState: async () => ({
      state: {
        creds: { me: socket.user },
        keys: { get: async () => ({}), set: async () => {} },
      },
      saveCreds: async () => {},
    }),
  });
  events.emit('connection.update', { qr: 'host-only-qr-value' });
  events.emit('connection.update', { connection: 'open' });
  assert.deepEqual(qrValues, ['host-only-qr-value']);
  assert.deepEqual(await session.ready, {
    accountJid: ACCOUNT_JID,
    name: 'Harness WhatsApp',
  });
  assert.equal((await stat(root)).mode & 0o777, 0o700);
  await session.close();
  assert.equal(ended, true);
});

test('WhatsApp Web session restarts the socket after first-time QR pairing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-im-whatsapp-restart-'));
  const sockets = Array.from({ length: 2 }, (_, index) => ({
    ev: new EventEmitter(),
    user: index === 1
      ? { id: '16505550123:4@s.whatsapp.net', name: 'Harness WhatsApp' }
      : undefined,
    end: async () => {},
    logout: async () => {},
  }));
  let socketIndex = 0;
  let saveCount = 0;
  const authState = {
    creds: {},
    keys: { get: async () => ({}), set: async () => {} },
  };
  const session = await createWhatsappWebSession({
    authDir: root,
    onQr: () => {},
    makeSocket: () => sockets[socketIndex++],
    loadAuthState: async () => ({
      state: authState,
      saveCreds: async () => { saveCount += 1; },
    }),
  });
  authState.creds.me = sockets[1].user;
  sockets[0].ev.emit('creds.update', { me: sockets[1].user });
  sockets[0].ev.emit('connection.update', {
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode: DisconnectReason.restartRequired } } },
  });
  for (let index = 0; index < 20 && socketIndex < 2; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(socketIndex, 2);
  assert.equal(saveCount, 1);
  assert.equal(session.socket, sockets[1]);
  sockets[1].ev.emit('connection.update', { connection: 'open' });
  assert.deepEqual(await session.ready, {
    accountJid: ACCOUNT_JID,
    name: 'Harness WhatsApp',
  });
  await session.close();
});

test('WhatsApp Web session accepts recent append events without replaying stale history', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-im-whatsapp-append-'));
  const events = new EventEmitter();
  const received = [];
  const session = await createWhatsappWebSession({
    authDir: root,
    onQr: () => {},
    onMessage: async (message) => { received.push(message.key.id); },
    makeSocket: () => ({
      ev: events,
      end: async () => {},
      logout: async () => {},
    }),
    loadAuthState: async () => ({
      state: {
        creds: {},
        keys: { get: async () => ({}), set: async () => {} },
      },
      saveCreds: async () => {},
    }),
  });
  void session.ready.catch(() => undefined);
  events.emit('messages.upsert', {
    type: 'append',
    messages: [
      { key: { id: 'recent' }, messageTimestamp: Math.floor(Date.now() / 1_000) },
      { key: { id: 'stale' }, messageTimestamp: Math.floor(Date.now() / 1_000) - 300 },
    ],
  });
  events.emit('messages.upsert', {
    type: 'notify',
    messages: [{ key: { id: 'notify' } }],
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(received, ['recent', 'notify']);
  await session.close();
});

test('WhatsApp normalizes direct and explicitly mentioned group messages', () => {
  const direct = normalizeWhatsappMessage({
    key: { remoteJid: '16505550999@s.whatsapp.net', id: 'direct-1', fromMe: false },
    message: { conversation: 'hello' },
  }, ACCOUNT_JID);
  assert.equal(direct.kind, 'direct');
  assert.equal(direct.addressed, true);
  assert.equal(direct.content, 'hello');

  const group = normalizeWhatsappMessage({
    key: {
      remoteJid: '120363000000000000@g.us',
      participant: '16505550999@s.whatsapp.net',
      id: 'group-1',
      fromMe: false,
    },
    message: {
      extendedTextMessage: {
        text: 'question',
        contextInfo: { mentionedJid: [ACCOUNT_JID] },
      },
    },
  }, ACCOUNT_JID);
  assert.equal(group.kind, 'group');
  assert.equal(group.addressed, true);
  assert.equal(normalizeWhatsappMessage({
    key: { remoteJid: 'status@broadcast', id: 'ignored', fromMe: false },
    message: { conversation: 'ignored' },
  }, ACCOUNT_JID), null);

  const selfChat = normalizeWhatsappMessage({
    key: { remoteJid: ACCOUNT_JID, id: 'self-1', fromMe: true },
    message: { conversation: 'message yourself' },
  }, ACCOUNT_JID);
  assert.equal(selfChat.selfChat, true);
  assert.equal(selfChat.addressed, true);
  assert.equal(normalizeWhatsappMessage({
    key: { remoteJid: '16505550999@s.whatsapp.net', id: 'outbound-1', fromMe: true },
    message: { conversation: 'ordinary outbound message' },
  }, ACCOUNT_JID), null);
});

test('WhatsApp exposes image media through a bounded Baileys download stream', async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const calls = [];
  const controller = new AbortController();
  const group = normalizeWhatsappMessage({
    key: {
      remoteJid: '120363000000000000@g.us',
      participant: '16505550999@s.whatsapp.net',
      id: 'group-image-1',
      fromMe: false,
    },
    message: {
      imageMessage: {
        mimetype: 'image/png',
        caption: '看看这张图',
        fileLength: { toString: () => String(png.length) },
        url: 'https://mmg.whatsapp.net/image',
        contextInfo: { mentionedJid: [ACCOUNT_JID] },
      },
    },
  }, ACCOUNT_JID, {
    download: async (raw, type, options) => {
      calls.push({ raw, type, options });
      return {
        async *[Symbol.asyncIterator]() { yield png; },
      };
    },
  });
  assert.equal(group.addressed, true);
  assert.equal(group.content, '看看这张图');
  assert.equal(group.images.length, 1);
  assert.equal(group.images[0].size, png.length);
  assert.deepEqual(await group.images[0].load({ signal: controller.signal, maxBytes: 100 }), png);
  assert.equal(calls[0].type, 'stream');
  assert.equal(calls[0].options.options.signal instanceof AbortSignal, true);

  const downloadStarted = Promise.withResolvers();
  const lateStream = Promise.withResolvers();
  let lateStreamDestroyed = false;
  const cancelled = normalizeWhatsappMessage({
    key: { remoteJid: '16505550999@s.whatsapp.net', id: 'cancelled-1', fromMe: false },
    message: {
      imageMessage: { mimetype: 'image/png', url: 'https://mmg.whatsapp.net/cancelled' },
    },
  }, ACCOUNT_JID, {
    download: async () => {
      downloadStarted.resolve();
      return lateStream.promise;
    },
  });
  const cancelledController = new AbortController();
  const cancelledLoad = cancelled.images[0].load({
    signal: cancelledController.signal,
    maxBytes: 100,
  });
  await downloadStarted.promise;
  cancelledController.abort(new DOMException('Stopped', 'AbortError'));
  await assert.rejects(cancelledLoad, { name: 'AbortError' });
  lateStream.resolve({ destroy() { lateStreamDestroyed = true; } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lateStreamDestroyed, true);

  const document = normalizeWhatsappMessage({
    key: { remoteJid: '16505550999@s.whatsapp.net', id: 'document-image-1', fromMe: false },
    message: {
      documentMessage: {
        mimetype: 'image/webp', fileName: 'diagram.webp', fileLength: 2_000,
        url: 'https://mmg.whatsapp.net/document',
      },
    },
  }, ACCOUNT_JID);
  assert.equal(document.images[0].name, 'diagram.webp');
  assert.equal(document.images[0].mediaType, 'image/webp');

  for (const [index, wrapper] of [
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
  ].entries()) {
    const wrappedMessage = {
      [wrapper]: {
        message: {
          imageMessage: {
            mimetype: 'image/jpeg', url: `https://mmg.whatsapp.net/view-once-${index}`,
          },
        },
      },
    };
    const viewOnce = normalizeWhatsappMessage({
      key: {
        remoteJid: '16505550999@s.whatsapp.net',
        id: `view-once-${index}`,
        fromMe: false,
      },
      message: index === 1
        ? { ephemeralMessage: { message: wrappedMessage } }
        : wrappedMessage,
    }, ACCOUNT_JID);
    assert.deepEqual(viewOnce.images, []);
  }

  const oversized = normalizeWhatsappMessage({
    key: { remoteJid: '16505550999@s.whatsapp.net', id: 'oversized-1', fromMe: false },
    message: {
      imageMessage: { mimetype: 'image/jpeg', url: 'https://mmg.whatsapp.net/oversized' },
    },
  }, ACCOUNT_JID, {
    download: async () => ({
      async *[Symbol.asyncIterator]() {
        yield Buffer.alloc(4);
        yield Buffer.alloc(4);
      },
      destroy() {},
    }),
  });
  await assert.rejects(() => oversized.images[0].load({ maxBytes: 5 }), (error) => {
    assert.equal(error.code, 'image-too-large');
    return true;
  });
});

test('WhatsApp runtime connects a linked device and replies through Harness', async () => {
  let callbacks;
  const calls = [];
  const socket = {
    sendPresenceUpdate: async (...args) => calls.push(['presence', ...args]),
    readMessages: async () => {},
    sendMessage: async (jid, content) => {
      calls.push(['message', jid, content]);
      return { key: { id: 'reply-1' } };
    },
  };
  const state = {
    hasSeen: () => false,
    markSeen: async () => {},
    sessionFor: () => 'session-1',
    sessionExists: async () => true,
  };
  const harness = {
    ensureRunning: async () => {},
    sessionExists: async () => true,
    ask: async () => 'Harness answer',
  };
  const runtime = new WhatsappRuntime({
    config: linkedConfig(),
    authDir: '/tmp/test-whatsapp-auth',
    harness,
    state,
    createSession: async (options) => {
      callbacks = options;
      return {
        socket,
        ready: Promise.resolve({ accountJid: ACCOUNT_JID, name: 'Harness WhatsApp' }),
        close: async () => {},
        logout: async () => {},
      };
    },
  });
  await runtime.start();
  await callbacks.onMessage({
    key: { remoteJid: '16505550999@s.whatsapp.net', id: 'direct-2', fromMe: false },
    message: { conversation: 'hello' },
  });
  assert.equal(runtime.status.ready, true);
  assert.ok(calls.some((call) => call[0] === 'presence' && call[1] === 'composing'));
  assert.ok(calls.some((call) => call[0] === 'message' && call[2].text === 'Harness answer'));
  await runtime.stop();
});

test('WhatsApp runtime answers self-chat without processing its own reply echo', async () => {
  let callbacks;
  let askCount = 0;
  const sent = [];
  const socket = {
    sendPresenceUpdate: async () => {},
    readMessages: async () => { throw new Error('self-chat must not send a read receipt'); },
    sendMessage: async (jid, content) => {
      sent.push([jid, content]);
      return { key: { id: 'bot-reply-1' } };
    },
  };
  const runtime = new WhatsappRuntime({
    config: linkedConfig(),
    authDir: '/tmp/test-whatsapp-self-chat',
    harness: {
      ensureRunning: async () => {},
      sessionExists: async () => true,
      ask: async () => { askCount += 1; return 'Harness self-chat answer'; },
    },
    state: {
      hasSeen: () => false,
      markSeen: async () => {},
      sessionFor: () => 'session-self',
      sessionExists: async () => true,
    },
    createSession: async (options) => {
      callbacks = options;
      return {
        socket,
        ready: Promise.resolve({ accountJid: ACCOUNT_JID, name: 'Harness WhatsApp' }),
        close: async () => {},
        logout: async () => {},
      };
    },
  });
  await runtime.start();
  await callbacks.onMessage({
    key: { remoteJid: ACCOUNT_JID, id: 'owner-message-1', fromMe: true },
    message: { conversation: 'hello from message yourself' },
  });
  await callbacks.onMessage({
    key: { remoteJid: ACCOUNT_JID, id: 'bot-reply-1', fromMe: true },
    message: { conversation: 'Harness self-chat answer' },
  });
  assert.equal(askCount, 1);
  assert.deepEqual(sent, [[ACCOUNT_JID, { text: 'Harness self-chat answer' }]]);
  await runtime.stop();
});

test('WhatsApp runtime sends a connection test to self and suppresses its outbound echo', async () => {
  let callbacks;
  let askCount = 0;
  const sent = [];
  const socket = {
    sendPresenceUpdate: async () => {},
    readMessages: async () => {},
    sendMessage: async (jid, content) => {
      sent.push([jid, content]);
      return { key: { id: 'connection-test-1' } };
    },
  };
  const runtime = new WhatsappRuntime({
    config: linkedConfig(),
    authDir: '/tmp/test-whatsapp-connection-test',
    harness: {
      ensureRunning: async () => {},
      sessionExists: async () => true,
      ask: async () => { askCount += 1; return 'unexpected'; },
    },
    state: {
      hasSeen: () => false,
      markSeen: async () => {},
      sessionFor: () => 'session-connection-test',
      sessionExists: async () => true,
    },
    createSession: async (options) => {
      callbacks = options;
      return {
        socket,
        ready: Promise.resolve({ accountJid: ACCOUNT_JID, name: 'Harness WhatsApp' }),
        close: async () => {},
        logout: async () => {},
      };
    },
  });

  await runtime.start();
  assert.deepEqual(await runtime.sendConnectionTest('连接测试'), { sent: true });
  assert.deepEqual(sent, [[ACCOUNT_JID, { text: '连接测试' }]]);
  await callbacks.onMessage({
    key: { remoteJid: ACCOUNT_JID, id: 'connection-test-1', fromMe: true },
    message: { conversation: '连接测试' },
  });
  assert.equal(askCount, 0);
  await runtime.stop();
});

test('WhatsApp controller delegates connection test copy to the current runtime', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-im-whatsapp-test-message-'));
  const configStore = await new WhatsappConfigStore(join(root, 'config.json')).load();
  const config = await configStore.save(linkedConfig());
  const sent = [];
  const controller = new WhatsappController({
    configStore,
    authPath: (name) => join(root, 'auth', name),
    createSession: async () => { throw new Error('not used'); },
    createRuntime: async () => ({
      status: {
        ready: true,
        connectionState: 'connected',
        harnessReachable: true,
      },
      start: async () => {},
      stop: async () => {},
      sendConnectionTest: async (text) => {
        sent.push(text);
        return { sent: true };
      },
    }),
  });
  t.after(() => controller.close());

  await controller.initialize();
  assert.deepEqual(await controller.sendConnectionTest(config.botId), { sent: true });
  assert.deepEqual(sent, [
    '✅ DeepSeek Harness 连接测试成功\n这条消息由插件页面中的“Harness WhatsApp（1650••••0123）”机器人卡片发出。',
  ]);
});

test('WhatsApp reconnect RPC sends tests only for the connected target and keeps failures non-fatal', async () => {
  const botId = deriveWhatsappBotId(ACCOUNT_JID);
  let connected = true;
  let sendFailure = false;
  let sendCalls = 0;
  const snapshot = () => ({
    schemaVersion: 1,
    revision: 1,
    bots: [{
      botId,
      state: connected ? 'connected' : 'offline',
      connected,
      configured: true,
      bot: { name: 'Harness WhatsApp', idMasked: '1650••••0123' },
      health: { summary: 'status', lastCheckedAt: Date.now() },
    }],
    totals: { configured: 1, connected: connected ? 1 : 0 },
  });
  const controller = {
    status: async () => snapshot(),
    startProvisioning: async () => null,
    registrationStatus: async () => null,
    cancelProvisioning: async () => null,
    reconnectBot: async () => snapshot(),
    deleteBot: async () => snapshot(),
    sendConnectionTest: async () => {
      sendCalls += 1;
      if (sendFailure) throw new Error('private provider failure');
      return { sent: true };
    },
  };
  const handler = createWhatsappRpcHandler(controller);

  const legacy = await handler(WHATSAPP_ENDPOINTS.reconnectBot, { botId });
  assert.equal(legacy.ok, true);
  assert.equal('testMessage' in legacy.value, false);
  assert.equal(sendCalls, 0);

  const success = await handler(
    WHATSAPP_ENDPOINTS.reconnectBot,
    { botId, sendTest: true },
  );
  assert.deepEqual(success.value.testMessage, { sent: true });
  assert.equal(sendCalls, 1);

  sendFailure = true;
  const failedSend = await handler(
    WHATSAPP_ENDPOINTS.reconnectBot,
    { botId, sendTest: true },
  );
  assert.equal(failedSend.ok, true);
  assert.deepEqual(failedSend.value.testMessage, {
    sent: false,
    code: 'test-message-failed',
  });
  assert.doesNotMatch(JSON.stringify(failedSend), /private provider failure/);

  connected = false;
  const unavailable = await handler(
    WHATSAPP_ENDPOINTS.reconnectBot,
    { botId, sendTest: true },
  );
  assert.equal(unavailable.ok, true);
  assert.deepEqual(unavailable.value.testMessage, {
    sent: false,
    code: 'test-target-unavailable',
  });
  assert.equal(sendCalls, 2);

  const invalid = await handler(
    WHATSAPP_ENDPOINTS.reconnectBot,
    { botId, sendTest: 'yes' },
  );
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, 'bad-request');
});

test('WhatsApp RPC never sends a connection test after reconnect is cancelled', async () => {
  let resolveReconnect;
  let sendCalls = 0;
  const reconnect = new Promise((resolve) => { resolveReconnect = resolve; });
  const botId = deriveWhatsappBotId(ACCOUNT_JID);
  const controller = {
    status: async () => ({ bots: [] }),
    startProvisioning: async () => null,
    registrationStatus: async () => null,
    cancelProvisioning: async () => null,
    reconnectBot: async () => reconnect,
    sendConnectionTest: async () => { sendCalls += 1; },
    deleteBot: async () => ({ bots: [] }),
  };
  const abort = new AbortController();
  const result = createWhatsappRpcHandler(controller)(WHATSAPP_ENDPOINTS.reconnectBot, {
    botId,
    sendTest: true,
  }, abort.signal);

  abort.abort();
  resolveReconnect({ bots: [{ botId, connected: true }] });

  assert.deepEqual(await result, {
    ok: false,
    error: { code: 'cancelled', message: 'The request was cancelled.' },
  });
  assert.equal(sendCalls, 0);
});

test('WhatsApp QR controller and RPC keep the raw QR and linked identity host-only', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-im-whatsapp-controller-'));
  const configStore = await new WhatsappConfigStore(join(root, 'config.json')).load();
  let sessionOptions;
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const deletedAuth = [];
  const controller = new WhatsappController({
    configStore,
    authPath: (name) => join(root, 'auth', name),
    createSession: async (options) => {
      sessionOptions = options;
      queueMicrotask(() => options.onQr('raw-linked-device-qr'));
      return { ready, close: async () => {} };
    },
    createRuntime: async () => ({
      status: {
        ready: true,
        connectionState: 'connected',
        harnessReachable: true,
        lastCheckedAt: Date.now(),
      },
      start: async () => {},
      stop: async () => {},
    }),
    deleteAuth: async (name) => deletedAuth.push(name),
  });
  t.after(() => controller.close());
  const handler = createWhatsappRpcHandler(controller, {
    encodeQr: async () => 'data:image/png;base64,QUJDRA==',
  });
  const started = await handler(WHATSAPP_ENDPOINTS.beginProvisioning, {});
  assert.equal(started.ok, true);
  assert.match(started.value.qrCodeDataUrl, /^data:image\/png/);
  assert.doesNotMatch(JSON.stringify(started.value), /raw-linked-device-qr|accountJid|authDirectory/);
  resolveReady({ accountJid: ACCOUNT_JID, name: 'Harness WhatsApp' });
  let status;
  for (let index = 0; index < 20; index += 1) {
    status = await handler(WHATSAPP_ENDPOINTS.status, {});
    if (status.value?.bots?.length) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(status.ok, true);
  assert.equal(status.value.bots[0].connected, true);
  assert.doesNotMatch(JSON.stringify(status.value), /16505550123@s\.whatsapp\.net|authDirectory/);
  assert.equal(sessionOptions.signal.aborted, false);
  assert.deepEqual(deletedAuth, []);
});
