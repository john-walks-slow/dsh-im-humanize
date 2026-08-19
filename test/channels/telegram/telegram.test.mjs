import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  TelegramConfigStore,
  deriveTelegramBotIdentity,
} from '../../../src/channels/telegram/config-store.mjs';
import { TelegramController } from '../../../src/channels/telegram/telegram-controller.mjs';
import {
  TelegramApi,
  inspectTelegramToken,
  validTelegramToken,
} from '../../../src/channels/telegram/telegram-api.mjs';
import { TelegramHarnessBridge } from '../../../src/channels/telegram/telegram-bridge.mjs';
import {
  TelegramRuntime,
  normalizeTelegramUpdate,
} from '../../../src/channels/telegram/telegram-runtime.mjs';
import { TelegramStateStore } from '../../../src/channels/telegram/state-store.mjs';
import {
  TELEGRAM_ENDPOINTS,
  createTelegramRpcHandler,
} from '../../../plugin-src/host/channels/telegram/rpc.mjs';

const TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function credentials() {
  const values = new Map();
  return {
    values,
    async resolve(ref) {
      return values.has(ref) ? { value: values.get(ref), source: 'test' } : undefined;
    },
    async set(ref, value) { values.set(ref, value); },
    async unset(ref) { values.delete(ref); },
  };
}

function memoryState() {
  const sessions = new Map();
  const seen = new Set();
  return {
    sessionFor: (key) => sessions.get(key) ?? null,
    setSession: async (key, value) => sessions.set(key, value),
    clearSession: async (key) => sessions.delete(key),
    hasSeen: (id) => seen.has(id),
    markSeen: async (id) => seen.add(id),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function bounded(promise, message, timeoutMs = 1_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test('Telegram API validates a Bot Token without exposing it in requests or errors', async () => {
  assert.equal(validTelegramToken(TOKEN), true);
  assert.equal(validTelegramToken('short'), false);
  const calls = [];
  const bot = await inspectTelegramToken(TOKEN, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ ok: true, result: {
        id: 123456789,
        is_bot: true,
        first_name: 'Harness',
        username: 'HarnessBot',
      } });
    },
  });
  assert.deepEqual(bot, {
    platformId: '123456789',
    name: 'Harness',
    username: 'HarnessBot',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.protocol, 'https:');
  assert.equal(calls[0].url.hostname, 'api.telegram.org');
  assert.match(calls[0].url.pathname, /^\/bot/);
  assert.match(calls[0].url.pathname, /getMe$/);
  assert.equal(calls[0].options.method, 'POST');

  const api = new TelegramApi({
    token: TOKEN,
    fetchImpl: async () => jsonResponse({ ok: false, error_code: 401, description: 'Unauthorized' }, 401),
  });
  await assert.rejects(() => api.getMe(), (error) => {
    assert.equal(error.code, 'telegram-401');
    assert.doesNotMatch(error.message, new RegExp(TOKEN));
    return true;
  });
});

test('Telegram API resolves and downloads files without exposing arbitrary paths', async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const calls = [];
  const api = new TelegramApi({
    token: TOKEN,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.pathname.endsWith('/getFile')) {
        return jsonResponse({ ok: true, result: { file_path: 'photos/file_1.png' } });
      }
      return new Response(png, { status: 200, headers: { 'content-length': String(png.length) } });
    },
  });
  assert.deepEqual(await api.downloadFile({ fileId: 'AgAC_test-file', maxBytes: 100 }), png);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[1].options.method, 'GET');
  assert.equal(calls[1].url.hostname, 'api.telegram.org');
  assert.match(calls[1].url.pathname, /\/file\/bot.+\/photos\/file_1\.png$/);

  const unsafeApi = new TelegramApi({
    token: TOKEN,
    fetchImpl: async () => jsonResponse({ ok: true, result: { file_path: '../secret' } }),
  });
  await assert.rejects(() => unsafeApi.downloadFile({ fileId: 'AgAC_test-file' }), (error) => {
    assert.match(error.message, /invalid file path/);
    assert.doesNotMatch(error.message, new RegExp(TOKEN.replaceAll(':', '\\:')));
    return true;
  });
});

test('Telegram config and controller store only a credential reference in bot data', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-im-telegram-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = join(directory, 'config.json');
  const configStore = await new TelegramConfigStore(configPath).load();
  const credentialStore = credentials();
  const runtimes = [];
  const connectionTests = [];
  const controller = new TelegramController({
    credentials: credentialStore,
    configStore,
    inspectToken: async () => ({
      platformId: '123456789', name: 'Harness Telegram', username: 'harness_bot',
    }),
    createRuntime: async () => {
      const runtime = {
        status: {
          ready: true,
          connectionState: 'connected',
          harnessReachable: true,
          lastCheckedAt: 10,
        },
        async start() {},
        async stop() {},
        async sendConnectionTest(text) { connectionTests.push(text); },
      };
      runtimes.push(runtime);
      return runtime;
    },
  });

  const status = await controller.bindCredentials({ token: TOKEN });
  assert.equal(status.totals.connected, 1);
  assert.equal(status.bots[0].bot.name, 'Harness Telegram');
  assert.equal(status.bots[0].bot.username, 'harness_bot');
  const identity = deriveTelegramBotIdentity('123456789');
  assert.equal(credentialStore.values.get(identity.tokenRef), TOKEN);
  const persisted = await readFile(configPath, 'utf8');
  assert.doesNotMatch(persisted, new RegExp(TOKEN));
  assert.match(persisted, new RegExp(identity.tokenRef));

  await controller.reconnectBot(identity.botId);
  assert.equal(runtimes.length, 2);
  await controller.sendConnectionTest(identity.botId);
  assert.match(connectionTests[0], /Harness Telegram/);
  assert.match(connectionTests[0], /123•••/);
  await controller.deleteBot(identity.botId);
  assert.equal(credentialStore.values.has(identity.tokenRef), false);
  assert.equal(controller.status().totals.configured, 0);
});

test('Telegram RPC accepts only token binding and strips credential internals', async () => {
  const calls = [];
  const connectionTests = [];
  const controller = {
    status: () => ({ bots: [], totals: { configured: 0, connected: 0 } }),
    bindCredentials: async (payload) => {
      calls.push(payload);
      return {
        bots: [{
          botId: 'telegram_123',
          tokenRef: 'DSH_TELEGRAM_BOT_TOKEN_ABC',
          token: TOKEN,
          bot: { name: 'Telegram机器人', idMasked: '123•••' },
        }],
        totals: { configured: 1, connected: 0 },
      };
    },
    reconnectBot: async (botId) => ({
      bots: [{ botId, connected: true }],
      totals: { configured: 1, connected: 1 },
    }),
    sendConnectionTest: async (botId) => { connectionTests.push(botId); },
    deleteBot: async () => ({ bots: [], totals: { configured: 0, connected: 0 } }),
  };
  const handler = createTelegramRpcHandler(controller);
  const result = await handler(TELEGRAM_ENDPOINTS.bindCredentials, { token: TOKEN });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{ token: TOKEN }]);
  assert.equal(result.value.bots[0].token, undefined);
  assert.equal(result.value.bots[0].tokenRef, undefined);
  const rejected = await handler(TELEGRAM_ENDPOINTS.bindCredentials, { token: TOKEN, extra: true });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, 'bad-request');

  const legacyReconnect = await handler(TELEGRAM_ENDPOINTS.reconnectBot, {
    botId: 'telegram_123',
  });
  assert.equal(legacyReconnect.ok, true);
  assert.equal('testMessage' in legacyReconnect.value, false);
  assert.deepEqual(connectionTests, []);

  const tested = await handler(TELEGRAM_ENDPOINTS.reconnectBot, {
    botId: 'telegram_123',
    sendTest: true,
  });
  assert.equal(tested.ok, true);
  assert.deepEqual(tested.value.testMessage, { sent: true });
  assert.deepEqual(connectionTests, ['telegram_123']);

  controller.sendConnectionTest = async () => {
    const error = new Error('No explicit recipient');
    error.code = 'test-target-unavailable';
    throw error;
  };
  const missingTarget = await handler(TELEGRAM_ENDPOINTS.reconnectBot, {
    botId: 'telegram_123',
    sendTest: true,
  });
  assert.equal(missingTarget.ok, true);
  assert.deepEqual(missingTarget.value.testMessage, {
    sent: false,
    code: 'test-target-unavailable',
  });
});

test('shared token RPC never sends a connection test after reconnect is cancelled', async () => {
  let resolveReconnect;
  let sendCalls = 0;
  const reconnect = new Promise((resolve) => { resolveReconnect = resolve; });
  const controller = {
    status: async () => ({ bots: [] }),
    bindCredentials: async () => ({ bots: [] }),
    reconnectBot: async () => reconnect,
    sendConnectionTest: async () => { sendCalls += 1; },
    deleteBot: async () => ({ bots: [] }),
  };
  const abort = new AbortController();
  const result = createTelegramRpcHandler(controller)(TELEGRAM_ENDPOINTS.reconnectBot, {
    botId: 'telegram_123',
    sendTest: true,
  }, abort.signal);

  abort.abort();
  resolveReconnect({ bots: [{ botId: 'telegram_123', connected: true }] });

  assert.deepEqual(await result, {
    ok: false,
    error: { code: 'cancelled', message: 'The request was cancelled.' },
  });
  assert.equal(sendCalls, 0);
});

test('Telegram normalizes private messages and requires an explicit group address', () => {
  const privateMessage = normalizeTelegramUpdate({
    update_id: 10,
    message: {
      message_id: 4,
      chat: { id: 88, type: 'private' },
      from: { id: 42, is_bot: false },
      text: 'hello',
    },
  }, { botId: '123456789', username: 'HarnessBot' });
  assert.equal(privateMessage.kind, 'direct');
  assert.equal(privateMessage.addressed, true);
  assert.deepEqual(privateMessage.connectionTestTarget, { chatId: 88, messageThreadId: undefined });

  const groupMessage = normalizeTelegramUpdate({
    update_id: 11,
    message: {
      message_id: 5,
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 43, is_bot: false },
      text: '@HarnessBot run this',
      entities: [{ type: 'mention', offset: 0, length: 11 }],
    },
  }, { botId: '123456789', username: 'HarnessBot' });
  assert.equal(groupMessage.kind, 'group');
  assert.equal(groupMessage.addressed, true);
  assert.equal(groupMessage.content, 'run this');

  const topicOne = normalizeTelegramUpdate({
    update_id: 12,
    message: {
      message_id: 6,
      message_thread_id: 100,
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 43, is_bot: false },
      text: '@HarnessBot first topic',
      entities: [{ type: 'mention', offset: 0, length: 11 }],
    },
  }, { botId: '123456789', username: 'HarnessBot' });
  const topicTwo = normalizeTelegramUpdate({
    update_id: 13,
    message: {
      message_id: 7,
      message_thread_id: 200,
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 43, is_bot: false },
      text: '@HarnessBot second topic',
      entities: [{ type: 'mention', offset: 0, length: 11 }],
    },
  }, { botId: '123456789', username: 'HarnessBot' });
  assert.equal(topicOne.conversationId, '-1001:100');
  assert.equal(topicTwo.conversationId, '-1001:200');
  assert.notEqual(topicOne.conversationId, topicTwo.conversationId);
  assert.equal(topicOne.replyTarget.messageThreadId, 100);
  assert.equal(topicTwo.replyTarget.messageThreadId, 200);
});

test('Telegram normalizes photo captions and image documents into one downloadable image', async () => {
  const loads = [];
  const groupPhoto = normalizeTelegramUpdate({
    update_id: 20,
    message: {
      message_id: 10,
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 43, is_bot: false },
      caption: '@HarnessBot 看看这张图',
      caption_entities: [{ type: 'mention', offset: 0, length: 11 }],
      photo: [
        { file_id: 'small', file_unique_id: 'photo', width: 90, height: 90, file_size: 500 },
        { file_id: 'large', file_unique_id: 'photo', width: 1280, height: 720, file_size: 2_000 },
      ],
    },
  }, {
    botId: '123456789',
    username: 'HarnessBot',
    loadFile: async (fileId, options) => {
      loads.push({ fileId, options });
      return Buffer.from('image');
    },
  });
  assert.equal(groupPhoto.addressed, true);
  assert.equal(groupPhoto.content, '看看这张图');
  assert.equal(groupPhoto.images.length, 1);
  assert.equal(groupPhoto.images[0].size, 2_000);
  await groupPhoto.images[0].load({ maxBytes: 5_000 });
  assert.equal(loads[0].fileId, 'large');

  const document = normalizeTelegramUpdate({
    update_id: 21,
    message: {
      message_id: 11,
      chat: { id: 88, type: 'private' },
      from: { id: 42, is_bot: false },
      document: {
        file_id: 'png-document', file_name: 'diagram.png', mime_type: 'image/png', file_size: 3_000,
      },
    },
  }, { botId: '123456789', username: 'HarnessBot' });
  assert.equal(document.images[0].name, 'diagram.png');
  assert.equal(document.images[0].mediaType, 'image/png');

  const documentWithoutMime = normalizeTelegramUpdate({
    update_id: 23,
    message: {
      message_id: 13,
      chat: { id: 88, type: 'private' },
      from: { id: 42, is_bot: false },
      document: { file_id: 'webp-document', file_name: 'diagram.webp', file_size: 2_000 },
    },
  }, { botId: '123456789', username: 'HarnessBot' });
  assert.equal(documentWithoutMime.images[0].mediaType, 'image/webp');

  const pdf = normalizeTelegramUpdate({
    update_id: 22,
    message: {
      message_id: 12,
      chat: { id: 88, type: 'private' },
      from: { id: 42, is_bot: false },
      document: { file_id: 'pdf-document', file_name: 'file.pdf', mime_type: 'application/pdf' },
    },
  }, { botId: '123456789', username: 'HarnessBot' });
  assert.deepEqual(pdf.images, []);
});

test('Telegram bridge ignores unaddressed groups and streams direct replies', async () => {
  const sent = [];
  const sentTargets = [];
  const updates = [];
  const bot = {
    sendText: async (target, text) => {
      sentTargets.push(target);
      sent.push(text);
    },
    sendTyping: async () => {},
    openStream: async () => ({
      update: async (text) => updates.push(text),
      finish: async (text) => sent.push(text),
    }),
  };
  let askCount = 0;
  const harness = {
    ensureRunning: async () => true,
    sessionExists: async () => true,
    createSession: async () => 'session-1',
    ask: async (_session, _text, options) => {
      askCount += 1;
      await options.onUpdate({ type: 'tool', name: '搜索' });
      await options.onUpdate({ type: 'text', text: '处理中' });
      return '完成';
    },
  };
  const state = memoryState();
  const bridge = new TelegramHarnessBridge({ bot, harness, state });
  await bridge.accept({
    messageId: '1', senderId: 'u1', kind: 'group', conversationId: 'g1', content: 'ignored',
    addressed: false, replyTarget: {},
  });
  assert.equal(askCount, 0);
  await bridge.accept({
    messageId: '2', senderId: 'u1', kind: 'direct', conversationId: 'u1', content: 'hello',
    addressed: true,
    replyTarget: { chatId: 88, replyToMessageId: 7 },
    connectionTestTarget: { chatId: 88 },
  });
  assert.equal(askCount, 1);
  assert.deepEqual(updates, ['正在使用搜索…', '处理中']);
  assert.deepEqual(sent, ['完成']);
  await bridge.sendConnectionTest('card test');
  assert.equal(sent.at(-1), 'card test');
  assert.deepEqual(sentTargets.at(-1), { chatId: 88 });
  const reconnectedBridge = new TelegramHarnessBridge({ bot, harness, state });
  await reconnectedBridge.sendConnectionTest('after reconnect');
  assert.equal(sent.at(-1), 'after reconnect');
  assert.deepEqual(sentTargets.at(-1), { chatId: 88 });
});

test('Telegram runtime validates webhook state and starts a cancellable long poll', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-im-telegram-runtime-'));
  const state = await new TelegramStateStore(join(directory, 'state.json')).load();
  const calls = [];
  const fakeApi = {
    getMe: async () => ({ id: 123456789, is_bot: true }),
    getWebhookInfo: async () => ({ url: '' }),
    getUpdates: async ({ offset, timeout, signal }) => {
      calls.push({ offset, timeout });
      if (timeout === 0) return [];
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true }));
    },
  };
  const runtime = new TelegramRuntime({
    config: {
      botId: 'telegram_test',
      platformId: '123456789',
      username: 'HarnessBot',
    },
    token: TOKEN,
    harness: { ensureRunning: async () => true },
    state,
    createApi: () => fakeApi,
  });
  await runtime.start();
  assert.equal(runtime.status.ready, true);
  assert.equal(runtime.status.connectionState, 'connected');
  await runtime.stop();
  assert.equal(runtime.status.ready, false);
  assert.deepEqual(calls[0], { offset: -1, timeout: 0 });
  await rm(directory, { recursive: true, force: true });
});

test('Telegram runtime keeps polling while a Harness question waits for its answer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-im-telegram-interaction-'));
  const state = await new TelegramStateStore(join(directory, 'state.json')).load();
  const questionSent = deferred();
  const secondPollStarted = deferred();
  const answerSubmitted = deferred();
  const releaseTurn = deferred();
  const finalReplySent = deferred();
  const pollOffsets = [];
  const asked = [];
  let answerUpdateDelivered = false;
  let originalTurnEnded = false;
  let nextOutboundMessageId = 500;

  const promptUpdate = {
    update_id: 10,
    message: {
      message_id: 100,
      chat: { id: 42, type: 'private' },
      from: { id: 7, is_bot: false },
      text: '请先询问测试环境',
    },
  };
  const answerUpdate = {
    update_id: 11,
    message: {
      message_id: 101,
      chat: { id: 42, type: 'private' },
      from: { id: 7, is_bot: false },
      text: '2',
    },
  };
  const fakeApi = {
    getMe: async () => ({ id: 123456789, is_bot: true }),
    getWebhookInfo: async () => ({ url: '' }),
    getUpdates: async ({ offset, timeout, signal }) => {
      pollOffsets.push(offset);
      if (timeout === 0) return [];
      if (offset === 0) return [promptUpdate];
      if (offset === 11) {
        secondPollStarted.resolve(originalTurnEnded);
        await questionSent.promise;
        answerUpdateDelivered = true;
        return [answerUpdate];
      }
      assert.equal(offset, 12);
      return new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
    sendChatAction: async () => true,
    sendMessage: async ({ text }) => {
      const messageId = nextOutboundMessageId;
      nextOutboundMessageId += 1;
      if (text.includes('请选择测试环境')) questionSent.resolve();
      return { message_id: messageId };
    },
    editMessageText: async ({ text }) => {
      if (text === '已选择生产环境') finalReplySent.resolve();
      return true;
    },
  };
  const harness = {
    ensureRunning: async () => true,
    createSession: async () => 'session-runtime-interaction',
    ask: async (sessionId, text, options) => {
      asked.push({ sessionId, text });
      if (text !== '请先询问测试环境') return '不应将答案当成新 prompt';
      await options.onInteraction({
        kind: 'question',
        interactionId: 'telegram-runtime-question',
        rpcId: 'telegram-runtime-question',
        sessionId,
        payload: {
          type: 'question/requested',
          sessionId,
          questions: [{
            id: 'environment',
            question: '请选择测试环境',
            options: [{ label: '测试环境' }, { label: '生产环境' }],
          }],
        },
        respond: async (result) => {
          assert.equal(answerUpdateDelivered, true);
          assert.equal(originalTurnEnded, false);
          answerSubmitted.resolve(result);
          return { accepted: true };
        },
      });
      await Promise.race([
        answerSubmitted.promise,
        new Promise((_, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), {
            once: true,
          });
        }),
      ]);
      await releaseTurn.promise;
      originalTurnEnded = true;
      return '已选择生产环境';
    },
  };
  const runtime = new TelegramRuntime({
    config: {
      botId: 'telegram_interaction',
      platformId: '123456789',
      username: 'HarnessBot',
    },
    token: TOKEN,
    harness,
    state,
    createApi: () => fakeApi,
    logger: { error() {}, warn() {} },
  });

  try {
    await runtime.start();
    assert.equal(await bounded(
      secondPollStarted.promise,
      'poller did not request the answer update while the first turn was active',
    ), false);
    const submitted = await bounded(
      answerSubmitted.promise,
      'the Telegram answer was not submitted through the interaction fast path',
    );
    assert.deepEqual(submitted, {
      ok: true,
      value: {
        sessionId: 'session-runtime-interaction',
        answer: {
          answers: [{ id: 'environment', selected: ['生产环境'] }],
        },
      },
    });
    assert.equal(originalTurnEnded, false);
    assert.deepEqual(asked, [{
      sessionId: 'session-runtime-interaction',
      text: '请先询问测试环境',
    }]);

    await bounded((async () => {
      while (state.cursor() !== 12) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    })(), 'Telegram cursor did not advance past the answer update');
    assert.deepEqual(pollOffsets.slice(0, 4), [-1, 0, 11, 12]);
    assert.equal(state.hasSeen('10'), true);
    assert.equal(state.hasSeen('11'), true);

    releaseTurn.resolve();
    await bounded(finalReplySent.promise, 'the original Harness turn did not finish');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(originalTurnEnded, true);
    assert.deepEqual(asked, [{
      sessionId: 'session-runtime-interaction',
      text: '请先询问测试环境',
    }]);
  } finally {
    releaseTurn.resolve();
    await runtime.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
