import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import test from 'node:test';

import {
  createWeixinApi,
  decryptWeixinImage,
  extractWeixinText,
  normalizeWeixinApiBaseUrl,
  parseWeixinImageAesKey,
  splitWeixinText,
  weixinImageDownloadUrl,
  WeixinApiError,
} from '../../../src/channels/weixin/weixin-api.mjs';

function jsonResponse(value, init) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function encryptImage(plaintext, key) {
  const cipher = createCipheriv('aes-128-ecb', key, null);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

test('iLink image references download lazily from the canonical CDN and decrypt AES-128-ECB', async () => {
  const key = randomBytes(16);
  const plaintext = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x01, 0x02, 0x03,
  ]);
  const ciphertext = encryptImage(plaintext, key);
  const calls = [];
  const api = createWeixinApi({
    fetchImpl: async (url, init) => {
      calls.push({ url: url.toString(), init });
      return new Response(ciphertext, {
        headers: { 'content-length': String(ciphertext.length) },
      });
    },
  });
  const images = api.inboundImages({
    item_list: [{
      type: 2,
      image_item: {
        aeskey: key.toString('hex'),
        media: { encrypt_query_param: 'one=two&three=four' },
      },
    }],
  });

  assert.equal(images.length, 1);
  assert.equal(calls.length, 0);
  const loaded = await images[0].load({ maxBytes: 1_024 });

  assert.equal(loaded.equals(plaintext), true);
  assert.equal(
    calls[0].url,
    'https://novac2c.cdn.weixin.qq.com/c2c/download?encrypted_query_param=one%3Dtwo%26three%3Dfour',
  );
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.redirect, 'manual');
});

test('Weixin image keys support both documented CDN encodings and reject unsafe URLs', () => {
  const key = randomBytes(16);
  assert.equal(parseWeixinImageAesKey({ aeskey: key.toString('hex') }).equals(key), true);
  assert.equal(parseWeixinImageAesKey({
    media: { aes_key: key.toString('base64') },
  }).equals(key), true);
  assert.equal(parseWeixinImageAesKey({
    media: { aes_key: Buffer.from(key.toString('hex'), 'ascii').toString('base64') },
  }).equals(key), true);
  assert.throws(
    () => parseWeixinImageAesKey({ aeskey: 'not-a-key' }),
    (error) => error instanceof WeixinApiError && error.code === 'invalid-image-key',
  );
  assert.equal(
    weixinImageDownloadUrl({ full_url: 'https://novac2c.cdn.weixin.qq.com/c2c/download?id=one#fragment' }),
    'https://novac2c.cdn.weixin.qq.com/c2c/download?id=one',
  );
  assert.throws(
    () => weixinImageDownloadUrl({ full_url: 'https://attacker.example/c2c/download?id=one' }),
    (error) => error instanceof WeixinApiError && error.code === 'untrusted-image-url',
  );

  const encrypted = encryptImage(Buffer.from('image payload'), key);
  assert.equal(decryptWeixinImage(encrypted, key).toString(), 'image payload');
});

test('QR login uses the Tencent iLink headers and keeps local tokens out of the URL', async () => {
  const calls = [];
  const api = createWeixinApi({
    fetchImpl: async (url, init) => {
      calls.push({ url: url.toString(), init });
      return jsonResponse({
        qrcode: 'private-qr-token',
        qrcode_img_content: 'https://liteapp.weixin.qq.com/q/example',
      });
    },
  });

  const login = await api.beginLogin({ localTokens: [' token-a ', 'token-a', 'token-b'] });

  assert.deepEqual(login, {
    qrcode: 'private-qr-token',
    qrcodeUrl: 'https://liteapp.weixin.qq.com/q/example',
  });
  assert.match(calls[0].url, /ilink\/bot\/get_bot_qrcode\?bot_type=3$/);
  assert.doesNotMatch(calls[0].url, /token-a|token-b/);
  assert.equal(calls[0].init.headers['iLink-App-Id'], 'bot');
  assert.equal(calls[0].init.headers['iLink-App-ClientVersion'], String((2 << 16) | (4 << 8) | 6));
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].init.body), { local_token_list: ['token-a', 'token-b'] });
});

test('login polling submits a verification code only to an approved Weixin host', async () => {
  const calls = [];
  const api = createWeixinApi({
    fetchImpl: async (url, init) => {
      calls.push({ url: url.toString(), init });
      return jsonResponse({ status: 'scaned' });
    },
  });

  const status = await api.pollLogin({
    qrcode: 'secret-qr',
    baseUrl: 'https://shard.ilinkai.weixin.qq.com',
    verifyCode: '123456',
  });

  assert.equal(status.status, 'scaned');
  assert.match(calls[0].url, /qrcode=secret-qr&verify_code=123456$/);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.AuthorizationType, undefined);

  await assert.rejects(
    api.pollLogin({ qrcode: 'secret', baseUrl: 'https://attacker.test' }),
    (error) => error instanceof WeixinApiError && error.code === 'untrusted-base-url',
  );
  assert.equal(calls.length, 1);
});

test('sendText emits the iLink message envelope without reflecting the token in its body', async () => {
  const calls = [];
  const api = createWeixinApi({
    fetchImpl: async (url, init) => {
      calls.push({ url: url.toString(), init });
      return jsonResponse({ ret: 0 });
    },
  });
  await api.sendText({
    baseUrl: 'https://ilinkai.weixin.qq.com',
    token: 'host-only-token',
    toUserId: 'wx-user',
    text: 'Harness reply',
    contextToken: 'message-context',
    runId: 'run-1',
  });

  assert.equal(calls[0].init.headers.Authorization, 'Bearer host-only-token');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.msg.to_user_id, 'wx-user');
  assert.equal(body.msg.context_token, 'message-context');
  assert.equal(body.msg.item_list[0].text_item.text, 'Harness reply');
  assert.equal(body.base_info.channel_version, '2.4.6');
  assert.equal(body.base_info.bot_agent, 'DeepSeekHarness/0.14.0');
  assert.doesNotMatch(calls[0].init.body, /host-only-token/);
});

test('getUpdates converts its own long-poll timeout into an empty successful poll', async () => {
  const api = createWeixinApi({
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }),
  });
  const result = await api.getUpdates({
    baseUrl: 'https://ilinkai.weixin.qq.com',
    token: 'token',
    getUpdatesBuf: 'cursor',
    timeoutMs: 2,
  });
  assert.deepEqual(result, { ret: 0, msgs: [], get_updates_buf: 'cursor' });
});

test('Weixin URL, inbound text, and reply chunk helpers enforce their narrow formats', () => {
  assert.equal(
    normalizeWeixinApiBaseUrl('https://ilinkai.weixin.qq.com/path'),
    'https://ilinkai.weixin.qq.com/path/',
  );
  assert.throws(() => normalizeWeixinApiBaseUrl('https://ilinkai.weixin.qq.com:444/'));
  assert.equal(extractWeixinText({ item_list: [{ type: 1, text_item: { text: ' 你好 ' } }] }), '你好');
  assert.equal(extractWeixinText({ item_list: [{ type: 3, voice_item: { text: '语音转写' } }] }), '语音转写');
  assert.deepEqual(splitWeixinText('abcdefgh', 5), ['abcde', 'fgh']);
});
