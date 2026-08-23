import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  DiscordConfigStore,
  deriveDiscordBotIdentity,
} from '../../../src/channels/discord/config-store.mjs';
import { DiscordController } from '../../../src/channels/discord/discord-controller.mjs';
import {
  DiscordApi,
  inspectDiscordToken,
  validDiscordToken,
} from '../../../src/channels/discord/discord-api.mjs';
import {
  DiscordRuntime,
  normalizeDiscordMessage,
} from '../../../src/channels/discord/discord-runtime.mjs';
import {
  DISCORD_ENDPOINTS,
  createDiscordRpcHandler,
} from '../../../plugin-src/host/channels/discord/rpc.mjs';

const TOKEN = 'MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.ABCD.abcdefghijklmnopqrstuvwxyz123456';

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function eventually(predicate, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('condition was not met before timeout');
}

test('Discord API authenticates with a Bot header and validates the current bot', async () => {
  assert.equal(validDiscordToken(TOKEN), true);
  assert.equal(validDiscordToken('not-a-token'), false);
  const calls = [];
  const bot = await inspectDiscordToken(TOKEN, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({
        id: '1234567890123456789',
        bot: true,
        username: 'HarnessBot',
        global_name: 'Harness Discord',
      });
    },
  });
  assert.deepEqual(bot, {
    platformId: '1234567890123456789',
    name: 'Harness Discord',
    username: 'HarnessBot',
  });
  assert.equal(calls[0].options.headers.authorization, `Bot ${TOKEN}`);
  assert.match(calls[0].url.pathname, /users\/@me$/);

  const api = new DiscordApi({
    token: TOKEN,
    fetchImpl: async () => jsonResponse({ message: '401: Unauthorized' }, 401),
  });
  await assert.rejects(() => api.getCurrentUser(), (error) => {
    assert.equal(error.code, 'discord-401');
    assert.doesNotMatch(error.message, new RegExp(TOKEN.replaceAll('.', '\\.')));
    return true;
  });
});

test('Discord API retries one rate-limited message request', async () => {
  let attempts = 0;
  const api = new DiscordApi({
    token: TOKEN,
    fetchImpl: async () => {
      attempts += 1;
      return attempts === 1
        ? jsonResponse({ message: 'rate limited', retry_after: 0.001 }, 429)
        : jsonResponse({ id: '987654321012345678', content: 'hello' });
    },
  });
  const message = await api.createMessage({
    channelId: '123456789012345678',
    content: 'hello',
  });
  assert.equal(message.id, '987654321012345678');
  assert.equal(attempts, 2);
});

test('Discord API uploads a result file as a native attachment and preserves the reply', async () => {
  let request;
  const api = new DiscordApi({
    token: TOKEN,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({ id: '987654321012345679', attachments: [{ id: '1' }] });
    },
  });
  const result = await api.createFileMessage({
    channelId: '123456789012345678',
    replyToMessageId: '123456789012345679',
    file: {
      artifactId: 'artifact-discord-one',
      deliveryKey: 'session:turn:artifact-discord-one',
      fileName: 'result.html',
      mediaType: 'text/html',
      bytes: Buffer.from('<p>discord-result</p>'),
    },
  });

  assert.equal(result.id, '987654321012345679');
  assert.match(request.url.pathname, /channels\/123456789012345678\/messages$/);
  assert.equal(request.options.headers['content-type'], undefined);
  assert.ok(request.options.body instanceof FormData);
  const payload = JSON.parse(request.options.body.get('payload_json'));
  assert.deepEqual(payload.attachments, [{ id: 0, filename: 'result.html' }]);
  assert.match(payload.nonce, /^[0-9a-f]{25}$/);
  assert.equal(payload.enforce_nonce, true);
  assert.equal(payload.message_reference.message_id, '123456789012345679');
  assert.deepEqual(payload.allowed_mentions, { parse: [], replied_user: false });
  const attachment = request.options.body.get('files[0]');
  assert.equal(attachment.name, 'result.html');
  assert.equal(attachment.type, 'text/html');
  assert.equal(Buffer.from(await attachment.arrayBuffer()).toString(), '<p>discord-result</p>');
});

test('Discord attachment retry reuses one FormData body and one stable nonce', async () => {
  const bodies = [];
  const nonces = [];
  let attempts = 0;
  const api = new DiscordApi({
    token: TOKEN,
    fetchImpl: async (_url, options) => {
      attempts += 1;
      bodies.push(options.body);
      nonces.push(JSON.parse(options.body.get('payload_json')).nonce);
      return attempts === 1
        ? jsonResponse({ code: 20028, message: 'rate limited', retry_after: 0.001 }, 429)
        : jsonResponse({ id: '987654321012345680', attachments: [{ id: '1' }] });
    },
  });
  const result = await api.createFileMessage({
    channelId: '123456789012345678',
    file: {
      deliveryKey: 'session:turn:artifact-retry',
      fileName: 'result.txt',
      bytes: Buffer.from('retry-safe'),
    },
  });

  assert.equal(result.id, '987654321012345680');
  assert.equal(attempts, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(nonces[0], nonces[1]);
  assert.match(nonces[0], /^[0-9a-f]{25}$/);
});

test('Discord attachment errors retain provider details and use stable artifact reasons', async () => {
  const cases = [{
    body: { code: 50013, message: 'Missing Permissions' },
    status: 403,
    code: 'artifact-permission-required',
  }, {
    body: { code: 40005, message: 'Request entity too large' },
    status: 413,
    code: 'artifact-too-large',
  }, {
    body: { code: 20028, message: 'rate limited', retry_after: 0.001 },
    status: 429,
    code: 'artifact-rate-limited',
    retryAfter: 0.001,
  }, {
    body: { code: 50035, message: 'Invalid Form Body' },
    status: 400,
    code: 'artifact-provider-rejected',
  }, {
    body: { code: 0, message: 'Internal Server Error' },
    status: 500,
    code: 'artifact-delivery-uncertain',
  }];

  for (const entry of cases) {
    const api = new DiscordApi({
      token: TOKEN,
      fetchImpl: async () => jsonResponse(entry.body, entry.status),
    });
    await assert.rejects(() => api.createFileMessage({
      channelId: '123456789012345678',
      file: { fileName: 'result.bin', bytes: Buffer.from('result') },
    }), (error) => {
      assert.equal(error.code, entry.code);
      assert.equal(error.providerCode, entry.body.code);
      assert.equal(error.status, entry.status);
      assert.equal(error.retry_after, entry.retryAfter);
      assert.equal(error.retryAfter, entry.retryAfter);
      return true;
    });
  }
});

test('Discord attachment delivery marks post-dispatch failures uncertain but preserves caller aborts', async () => {
  for (const fetchImpl of [
    async () => { throw new TypeError('socket reset'); },
    async () => new Response('not-json', { status: 200 }),
  ]) {
    const api = new DiscordApi({ token: TOKEN, fetchImpl });
    await assert.rejects(() => api.createFileMessage({
      channelId: '123456789012345678',
      file: { fileName: 'result.bin', bytes: Buffer.from('result') },
    }), (error) => error.code === 'artifact-delivery-uncertain');
  }

  const timeoutApi = new DiscordApi({
    token: TOKEN,
    fileUploadTimeoutMs: 10,
    fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  });
  await assert.rejects(() => timeoutApi.createFileMessage({
    channelId: '123456789012345678',
    file: { fileName: 'result.bin', bytes: Buffer.from('result') },
  }), (error) => error.code === 'artifact-delivery-uncertain'
    && error.cause?.name === 'TimeoutError');

  const caller = new AbortController();
  const reason = new DOMException('caller stopped', 'AbortError');
  caller.abort(reason);
  let calls = 0;
  const cancelledApi = new DiscordApi({
    token: TOKEN,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ id: '987654321012345680' });
    },
  });
  await assert.rejects(() => cancelledApi.createFileMessage({
    channelId: '123456789012345678',
    file: { fileName: 'result.bin', bytes: Buffer.from('result') },
    signal: caller.signal,
  }), (error) => error === reason && error.code !== 'artifact-delivery-uncertain');
  assert.equal(calls, 0);
});

test('Discord controller persists a credential reference and exposes only masked identity', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-im-discord-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = join(directory, 'config.json');
  const configStore = await new DiscordConfigStore(configPath).load();
  const credentialStore = credentials();
  const controller = new DiscordController({
    credentials: credentialStore,
    configStore,
    inspectToken: async () => ({
      platformId: '1234567890123456789',
      name: 'Harness Discord',
      username: 'HarnessBot',
    }),
    createRuntime: async () => ({
      status: {
        ready: true,
        connectionState: 'connected',
        harnessReachable: true,
        lastCheckedAt: 20,
      },
      async start() {},
      async stop() {},
    }),
  });
  const status = await controller.bindCredentials({ token: TOKEN });
  assert.equal(status.totals.connected, 1);
  assert.equal(status.bots[0].bot.name, 'Harness Discord');
  const identity = deriveDiscordBotIdentity('1234567890123456789');
  assert.equal(credentialStore.values.get(identity.tokenRef), TOKEN);
  assert.doesNotMatch(await readFile(configPath, 'utf8'), new RegExp(TOKEN.replaceAll('.', '\\.')));
  await controller.deleteBot(identity.botId);
  assert.equal(credentialStore.values.has(identity.tokenRef), false);
});

test('Discord RPC rejects extra credential fields and removes token internals', async () => {
  const controller = {
    status: () => ({ bots: [], totals: { configured: 0, connected: 0 } }),
    bindCredentials: async () => ({
      bots: [{
        botId: 'discord_123',
        token: TOKEN,
        tokenRef: 'DSH_DISCORD_BOT_TOKEN_ABC',
        bot: { name: 'Discord机器人', idMasked: '123•••' },
      }],
      totals: { configured: 1, connected: 0 },
    }),
    reconnectBot: async () => ({ bots: [], totals: { configured: 0, connected: 0 } }),
    deleteBot: async () => ({ bots: [], totals: { configured: 0, connected: 0 } }),
  };
  const handler = createDiscordRpcHandler(controller);
  const result = await handler(DISCORD_ENDPOINTS.bindCredentials, { token: TOKEN });
  assert.equal(result.ok, true);
  assert.equal(result.value.bots[0].token, undefined);
  assert.equal(result.value.bots[0].tokenRef, undefined);
  const rejected = await handler(DISCORD_ENDPOINTS.bindCredentials, { token: TOKEN, appId: 'x' });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, 'bad-request');
});

test('Discord normalizes DMs and only addressed server messages', () => {
  const direct = normalizeDiscordMessage({
    id: '111111111111111111',
    channel_id: '222222222222222222',
    author: { id: '333333333333333333', bot: false },
    content: 'hello',
  }, '1234567890123456789');
  assert.equal(direct.kind, 'direct');
  assert.equal(direct.addressed, true);
  assert.deepEqual(direct.connectionTestTarget, { channelId: '222222222222222222' });

  const group = normalizeDiscordMessage({
    id: '111111111111111112',
    channel_id: '222222222222222223',
    guild_id: '444444444444444444',
    author: { id: '333333333333333334', bot: false },
    mentions: [{ id: '1234567890123456789' }],
    content: '<@1234567890123456789> run this',
  }, '1234567890123456789');
  assert.equal(group.kind, 'group');
  assert.equal(group.addressed, true);
  assert.equal(group.content, 'run this');

  const unmentionedReply = normalizeDiscordMessage({
    id: '111111111111111113',
    channel_id: '222222222222222223',
    guild_id: '444444444444444444',
    author: { id: '333333333333333334', bot: false },
    mentions: [],
    referenced_message: { author: { id: '1234567890123456789', bot: true } },
    content: '',
  }, '1234567890123456789');
  assert.equal(unmentionedReply.addressed, false);
});

test('Discord keeps image attachments in images and exposes ordinary attachments as files', async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const calls = [];
  const message = normalizeDiscordMessage({
    id: '111111111111111120',
    channel_id: '222222222222222220',
    author: { id: '333333333333333330', bot: false },
    content: '',
    attachments: [{
      id: '555555555555555550',
      filename: 'screen.png',
      content_type: 'image/png',
      size: png.length,
      url: 'https://cdn.discordapp.com/attachments/222/555/screen.png?ex=test',
    }, {
      id: '555555555555555551',
      filename: 'notes.txt',
      content_type: 'text/plain',
      size: 4,
      url: 'https://cdn.discordapp.com/attachments/222/555/notes.txt',
    }, {
      id: '555555555555555552',
      filename: 'camera.jpg',
      size: png.length,
      url: 'https://cdn.discordapp.com/attachments/222/555/camera.jpg',
    }],
  }, '1234567890123456789', {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(png, { status: 200, headers: { 'content-length': String(png.length) } });
    },
  });

  assert.equal(message.content, '');
  assert.equal(message.images.length, 2);
  assert.deepEqual({
    name: message.images[0].name,
    mediaType: message.images[0].mediaType,
    size: message.images[0].size,
  }, { name: 'screen.png', mediaType: 'image/png', size: png.length });
  assert.equal(message.images[1].mediaType, 'image/jpeg');
  assert.deepEqual(await message.images[0].load({ maxBytes: 100 }), png);
  assert.equal(calls[0].url.hostname, 'cdn.discordapp.com');
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(message.files.length, 1);
  assert.deepEqual({
    name: message.files[0].name,
    mediaType: message.files[0].mediaType,
    size: message.files[0].size,
  }, { name: 'notes.txt', mediaType: 'text/plain', size: 4 });
  const controller = new AbortController();
  const loadedFile = await message.files[0].load({ signal: controller.signal });
  const fileChunks = [];
  for await (const chunk of loadedFile.stream) fileChunks.push(Buffer.from(chunk));
  assert.deepEqual(Buffer.concat(fileChunks), png);
  assert.equal(calls[1].url.pathname.endsWith('/notes.txt'), true);
  assert.equal(calls[1].options.signal, controller.signal);

  const unsafe = normalizeDiscordMessage({
    id: '111111111111111121',
    channel_id: '222222222222222220',
    author: { id: '333333333333333330', bot: false },
    attachments: [{
      filename: 'screen.png', content_type: 'image/png', size: 8,
      url: 'https://example.com/internal.png',
    }],
  }, '1234567890123456789', { fetchImpl: async () => assert.fail('must not fetch') });
  await assert.rejects(() => unsafe.images[0].load({ maxBytes: 100 }), /messaging platform/);
});

class FakeSocket {
  #listeners = new Map();
  sent = [];
  readyState = 1;

  addEventListener(name, listener) {
    const listeners = this.#listeners.get(name) ?? [];
    listeners.push(listener);
    this.#listeners.set(name, listeners);
  }

  send(value) {
    const packet = JSON.parse(value);
    this.sent.push(packet);
    if (packet.op === 2) {
      queueMicrotask(() => this.emit('message', {
        data: JSON.stringify({
          op: 0,
          t: 'READY',
          s: 1,
          d: {
            session_id: 'session',
            resume_gateway_url: 'wss://gateway.discord.gg',
          },
        }),
      }));
    }
  }

  close(code = 1000) {
    if (this.readyState >= 2) return;
    this.readyState = 3;
    this.emit('close', { code });
  }

  emit(name, event) {
    for (const listener of this.#listeners.get(name) ?? []) listener(event);
  }
}

test('Discord runtime identifies on Gateway v10 and becomes ready', async () => {
  let socket;
  const abortMark = deferred();
  let abortMarkStarted = false;
  const errors = [];
  const runtime = new DiscordRuntime({
    config: {
      botId: 'discord_test',
      platformId: '1234567890123456789',
      name: 'Harness Discord',
    },
    token: TOKEN,
    harness: { ensureRunning: async () => true },
    state: {
      sessionFor: () => null,
      setSession: async () => {},
      clearSession: async () => {},
      hasSeen: () => false,
      markSeen: async (messageId) => {
        if (messageId === '111111111111111199') {
          abortMarkStarted = true;
          return abortMark.promise;
        }
        throw new Error(`Discord state write failed for ${messageId}`);
      },
    },
    createApi: () => ({
      getCurrentUser: async () => ({ id: '1234567890123456789', bot: true }),
      getGatewayBot: async () => ({ url: 'wss://gateway.discord.gg' }),
    }),
    createWebSocket: () => {
      socket = new FakeSocket();
      queueMicrotask(() => socket.emit('message', {
        data: JSON.stringify({ op: 10, d: { heartbeat_interval: 45_000 } }),
      }));
      return socket;
    },
    random: () => 0.5,
    logger: {
      warn() {},
      error(...args) { errors.push(args); },
    },
  });
  await runtime.start();
  assert.equal(runtime.status.ready, true);
  const identify = socket.sent.find((packet) => packet.op === 2);
  assert.equal(identify.d.token, TOKEN);
  assert.equal(identify.d.intents, 4_609);
  assert.equal(identify.d.properties.browser, 'dsh-im');

  for (const [id, sequence] of [
    ['111111111111111190', 2],
    ['111111111111111191', 3],
  ]) {
    socket.emit('message', {
      data: JSON.stringify({
        op: 0,
        t: 'MESSAGE_CREATE',
        s: sequence,
        d: {
          id,
          channel_id: '222222222222222222',
          author: { id: '333333333333333333', bot: false },
          content: 'trigger state failure',
        },
      }),
    });
  }
  await eventually(() => errors.length === 2);
  assert.equal(errors.every((args) => args[0].includes('message handling failed')), true);

  socket.emit('message', {
    data: JSON.stringify({
      op: 0,
      t: 'MESSAGE_CREATE',
      s: 4,
      d: {
        id: '111111111111111199',
        channel_id: '222222222222222222',
        author: { id: '333333333333333333', bot: false },
        content: 'abort state write',
      },
    }),
  });
  await eventually(() => abortMarkStarted);
  const stopping = runtime.stop();
  abortMark.reject(new Error('Discord state write aborted'));
  await stopping;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(errors.length, 2);
  assert.equal(runtime.status.ready, false);
});
