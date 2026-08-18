import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDingtalkApi,
  DINGTALK_AI_CARD_TEMPLATE_ID,
  DINGTALK_API_BASE_URL,
  normalizeDingtalkCardMarkdown,
  normalizeDingtalkSessionWebhook,
  splitDingtalkText,
} from '../../../src/channels/dingtalk/dingtalk-api.mjs';

function jsonResponse(value, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

test('registration API performs init, begin, and poll with normalized results', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: url.toString(), options });
    if (url.pathname.endsWith('/init')) return jsonResponse({ errcode: 0, nonce: ' nonce-1 ' });
    if (url.pathname.endsWith('/begin')) {
      return jsonResponse({
        errcode: 0,
        device_code: ' device-1 ',
        user_code: 'user-1',
        verification_uri: 'https://h5.dingtalk.com/verify',
        verification_uri_complete: 'https://h5.dingtalk.com/verify?code=one',
        expires_in: 300,
        interval: 3,
      });
    }
    return jsonResponse({
      errcode: 0,
      status: 'success',
      client_id: 'ding-client',
      client_secret: 'host-only-secret',
    });
  };
  const api = createDingtalkApi({ fetchImpl, cardMinIntervalMs: 0, cardBackoffMs: 0 });

  const begun = await api.beginRegistration();
  const polled = await api.pollRegistration({ deviceCode: begun.deviceCode });

  assert.deepEqual(begun, {
    deviceCode: 'device-1',
    userCode: 'user-1',
    verificationUri: 'https://h5.dingtalk.com/verify',
    verificationUriComplete: 'https://h5.dingtalk.com/verify?code=one',
    expiresInSeconds: 300,
    intervalSeconds: 3,
  });
  assert.deepEqual(polled, {
    status: 'SUCCESS',
    failReason: undefined,
    clientId: 'ding-client',
    clientSecret: 'host-only-secret',
  });
  assert.deepEqual(calls.map(({ url, options }) => ({
    path: new URL(url).pathname,
    body: JSON.parse(options.body),
    redirect: options.redirect,
  })), [
    { path: '/app/registration/init', body: { source: 'DING_DWS_CLAW' }, redirect: 'error' },
    { path: '/app/registration/begin', body: { nonce: 'nonce-1' }, redirect: 'error' },
    { path: '/app/registration/poll', body: { device_code: 'device-1' }, redirect: 'error' },
  ]);
});

test('session replies use the fixed token endpoint, reject redirects, and cache access tokens', async () => {
  const calls = [];
  let now = 1_000;
  const fetchImpl = async (url, options) => {
    calls.push({ url: url.toString(), options });
    if (url.toString() === `${DINGTALK_API_BASE_URL}v1.0/oauth2/accessToken`) {
      return jsonResponse({ accessToken: 'access-token', expireIn: 7_200 });
    }
    return jsonResponse({ errcode: 0 });
  };
  const api = createDingtalkApi({ fetchImpl, now: () => now });
  const request = {
    clientId: 'ding-client',
    clientSecret: 'host-only-secret',
    sessionWebhook: 'https://oapi.dingtalk.com/robot/sendBySession?session=opaque',
    text: '回答',
  };

  await api.sendText(request);
  now += 10_000;
  await api.sendText({ ...request, text: '继续' });

  assert.equal(calls.filter(({ url }) => url.includes('/oauth2/accessToken')).length, 1);
  assert.equal(calls.length, 3);
  for (const { options } of calls) assert.equal(options.redirect, 'error');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    appKey: 'ding-client',
    appSecret: 'host-only-secret',
  });
  assert.equal(calls[1].options.headers['x-acs-dingtalk-access-token'], 'access-token');
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    msgtype: 'text',
    text: { content: '继续' },
  });
});

test('DingTalk image downloads exchange downloadCode with the callback robotCode and do not forward auth', async () => {
  const imageBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x01, 0x02,
  ]);
  const calls = [];
  const fetchImpl = async (url, options) => {
    const href = url.toString();
    calls.push({ url: href, options });
    if (href === `${DINGTALK_API_BASE_URL}v1.0/oauth2/accessToken`) {
      return jsonResponse({ accessToken: 'image-access-token', expireIn: 7_200 });
    }
    if (href === `${DINGTALK_API_BASE_URL}v1.0/robot/messageFiles/download`) {
      return jsonResponse({ downloadUrl: 'https://download.oss-cn-hangzhou.aliyuncs.com/opaque-image' });
    }
    return new Response(imageBytes, {
      headers: { 'content-length': String(imageBytes.length) },
    });
  };
  const api = createDingtalkApi({ fetchImpl });

  const loaded = await api.downloadImage({
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    robotCode: 'robot-from-callback',
    downloadCode: 'opaque-download-code',
    maxBytes: 1_024,
  });

  assert.equal(loaded.equals(imageBytes), true);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    downloadCode: 'opaque-download-code',
    robotCode: 'robot-from-callback',
  });
  assert.equal(
    calls[1].options.headers['x-acs-dingtalk-access-token'],
    'image-access-token',
  );
  assert.equal(calls[2].options.method, 'GET');
  assert.equal(calls[2].options.redirect, 'manual');
  assert.equal(calls[2].options.headers?.['x-acs-dingtalk-access-token'], undefined);
});

test('DingTalk upgrades its HTTP temporary image URL to HTTPS without changing the signed request', async () => {
  const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0x01]);
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: url.toString(), options });
    if (url.toString() === `${DINGTALK_API_BASE_URL}v1.0/oauth2/accessToken`) {
      return jsonResponse({ accessToken: 'image-access-token', expireIn: 7_200 });
    }
    if (url.toString() === `${DINGTALK_API_BASE_URL}v1.0/robot/messageFiles/download`) {
      return jsonResponse({
        downloadUrl: 'http://download.example.test:80/private/image?signature=opaque%2Bvalue',
      });
    }
    return new Response(imageBytes, { status: 200 });
  };
  const api = createDingtalkApi({ fetchImpl });

  assert.deepEqual(await api.downloadImage({
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    robotCode: 'robot-from-callback',
    downloadCode: 'opaque-download-code',
    maxBytes: 1_024,
  }), imageBytes);

  assert.equal(
    calls[2].url,
    'https://download.example.test/private/image?signature=opaque%2Bvalue',
  );
  assert.equal(calls[2].options.headers?.['content-type'], undefined);
  assert.equal(calls[2].options.headers?.['x-acs-dingtalk-access-token'], undefined);
});

test('DingTalk image exchange errors preserve the provider code without exposing its message', async () => {
  const fetchImpl = async (url) => {
    if (url.toString() === `${DINGTALK_API_BASE_URL}v1.0/oauth2/accessToken`) {
      return jsonResponse({ accessToken: 'image-access-token', expireIn: 7_200 });
    }
    return jsonResponse({
      code: 'invalidParameter.robotCode.auth',
      message: 'response may contain platform details',
    }, { status: 400 });
  };
  const api = createDingtalkApi({ fetchImpl });

  await assert.rejects(
    api.downloadImage({
      clientId: 'ding-client',
      clientSecret: 'host-secret',
      robotCode: 'robot-from-callback',
      downloadCode: 'opaque-download-code',
      maxBytes: 1_024,
    }),
    (error) => {
      assert.equal(error.code, 'image-download-address-failed');
      assert.equal(error.status, 400);
      assert.equal(error.providerCode, 'invalidParameter.robotCode.auth');
      assert.equal(error.cause?.code, 'http-error');
      assert.doesNotMatch(error.message, /platform details/);
      return true;
    },
  );
});

test('DingTalk image content failures do not expose network or signed-URL details', async () => {
  const fetchImpl = async (url) => {
    if (url.toString() === `${DINGTALK_API_BASE_URL}v1.0/oauth2/accessToken`) {
      return jsonResponse({ accessToken: 'image-access-token', expireIn: 7_200 });
    }
    if (url.toString() === `${DINGTALK_API_BASE_URL}v1.0/robot/messageFiles/download`) {
      return jsonResponse({ downloadUrl: 'https://download.example.test/private?signature=hidden' });
    }
    const cause = new Error('socket details must stay private');
    cause.code = 'ECONNRESET';
    throw new TypeError('fetch failed', { cause });
  };
  const api = createDingtalkApi({ fetchImpl });

  await assert.rejects(
    api.downloadImage({
      clientId: 'ding-client',
      clientSecret: 'host-secret',
      robotCode: 'robot-from-callback',
      downloadCode: 'opaque-download-code',
      maxBytes: 1_024,
    }),
    (error) => {
      assert.equal(error.code, 'image-content-download-failed');
      assert.equal(error.providerCode, undefined);
      assert.equal(error.cause?.cause?.code, 'ECONNRESET');
      assert.doesNotMatch(error.message, /private|signature|socket details|hidden/);
      return true;
    },
  );
});

test('session webhook validation accepts only HTTPS DingTalk hosts on the default port', () => {
  assert.equal(
    normalizeDingtalkSessionWebhook('https://dingtalk.com/reply?ticket=one'),
    'https://dingtalk.com/reply?ticket=one',
  );
  assert.equal(
    normalizeDingtalkSessionWebhook('https://oapi.dingtalk.com:443/reply?ticket=one'),
    'https://oapi.dingtalk.com/reply?ticket=one',
  );
  for (const value of [
    'http://oapi.dingtalk.com/reply',
    'https://oapi.dingtalk.com.evil.example/reply',
    'https://user@oapi.dingtalk.com/reply',
    'https://oapi.dingtalk.com:8443/reply',
  ]) {
    assert.throws(() => normalizeDingtalkSessionWebhook(value), /不受信任/);
  }
});

test('AI Card replies create, deliver, stream full snapshots, and finalize on fixed endpoints', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: url.toString(), options });
    if (url.toString() === `${DINGTALK_API_BASE_URL}v1.0/oauth2/accessToken`) {
      return jsonResponse({ accessToken: 'access-token', expireIn: 7_200 });
    }
    return jsonResponse({});
  };
  const api = createDingtalkApi({ fetchImpl, cardMinIntervalMs: 0, cardBackoffMs: 0 });
  const credentials = { clientId: 'ding-client', clientSecret: 'host-only-secret' };
  const card = await api.createAiCard({
    ...credentials,
    target: { type: 'user', userId: 'staff-one' },
    initialText: '正在处理…',
  });
  await api.updateAiCard({ ...credentials, ...card, text: '第一行\n第二行' });
  await api.finishAiCard({ ...credentials, ...card, text: '最终回答' });

  const cardCalls = calls.slice(1).map(({ url, options }) => ({
    method: options.method,
    path: new URL(url).pathname,
    body: JSON.parse(options.body),
    token: options.headers['x-acs-dingtalk-access-token'],
    redirect: options.redirect,
  }));
  assert.deepEqual(cardCalls.map(({ method, path }) => ({ method, path })), [
    { method: 'POST', path: '/v1.0/card/instances' },
    { method: 'POST', path: '/v1.0/card/instances/deliver' },
    { method: 'PUT', path: '/v1.0/card/instances' },
    { method: 'PUT', path: '/v1.0/card/streaming' },
    { method: 'PUT', path: '/v1.0/card/streaming' },
    { method: 'PUT', path: '/v1.0/card/streaming' },
    { method: 'PUT', path: '/v1.0/card/instances' },
  ]);
  assert.ok(cardCalls.every(({ token, redirect }) => token === 'access-token' && redirect === 'error'));
  assert.equal(cardCalls[0].body.cardTemplateId, DINGTALK_AI_CARD_TEMPLATE_ID);
  assert.equal(cardCalls[0].body.outTrackId, card.cardInstanceId);
  assert.equal(cardCalls[1].body.openSpaceId, 'dtv1.card//IM_ROBOT.staff-one');
  assert.equal(cardCalls[1].body.imRobotOpenDeliverModel.robotCode, 'ding-client');
  assert.equal(cardCalls[2].body.cardData.cardParamMap.flowStatus, '2');
  assert.equal(cardCalls[3].body.content, '正在处理…');
  assert.equal(cardCalls[4].body.content, '第一行<br>第二行');
  assert.equal(cardCalls[4].body.isFull, true);
  assert.equal(cardCalls[4].body.isFinalize, false);
  assert.equal(cardCalls[5].body.content, '最终回答');
  assert.equal(cardCalls[5].body.isFinalize, true);
  assert.equal(cardCalls[6].body.cardData.cardParamMap.flowStatus, '3');
});

test('AI Card markdown preserves fenced code while rendering ordinary line breaks', () => {
  assert.equal(normalizeDingtalkCardMarkdown('一\n二'), '一<br>二');
  assert.equal(
    normalizeDingtalkCardMarkdown('```js\nconst answer = 42\n```\n完成'),
    '```js\nconst answer = 42\n```\n完成',
  );
});

test('AI Card start slots preserve 20 QPS without blocking cleanup behind slow HTTP', async () => {
  const firstUpdate = deferred();
  const bodies = [];
  const waits = [];
  let now = 0;
  const fetchImpl = async (url, options) => {
    if (url.toString() === `${DINGTALK_API_BASE_URL}v1.0/oauth2/accessToken`) {
      return jsonResponse({ accessToken: 'access-token', expireIn: 7_200 });
    }
    const body = JSON.parse(options.body);
    bodies.push(body);
    if (new URL(url).pathname === '/v1.0/card/streaming' && body.isError === false) {
      await firstUpdate.promise;
    }
    return jsonResponse({});
  };
  const api = createDingtalkApi({
    fetchImpl,
    now: () => now,
    cardMinIntervalMs: 50,
    delay: async (ms) => {
      waits.push(ms);
      now += ms;
    },
  });
  const request = {
    clientId: 'ding-client',
    clientSecret: 'host-only-secret',
    cardInstanceId: 'card-one',
  };

  const slowUpdate = api.updateAiCard({ ...request, text: '仍在请求中' });
  await new Promise((resolve) => setImmediate(resolve));
  await api.failAiCard({ ...request, text: '及时收口' });

  assert.equal(bodies.some((body) => body.isError === true), true);
  assert.equal(bodies.some((body) => body.cardData?.cardParamMap?.flowStatus === '5'), true);
  assert.deepEqual(waits, [50, 50]);
  firstUpdate.resolve();
  await slowUpdate;
});

test('AI Card retries one QPS rejection after the configured backoff', async () => {
  let attempts = 0;
  const waits = [];
  const fetchImpl = async (url) => {
    if (url.toString() === `${DINGTALK_API_BASE_URL}v1.0/oauth2/accessToken`) {
      return jsonResponse({ accessToken: 'access-token', expireIn: 7_200 });
    }
    attempts += 1;
    return attempts === 1 ? jsonResponse({}, { status: 403 }) : jsonResponse({});
  };
  const api = createDingtalkApi({
    fetchImpl,
    cardMinIntervalMs: 0,
    cardBackoffMs: 1_000,
    delay: async (ms) => waits.push(ms),
  });

  await api.updateAiCard({
    clientId: 'ding-client',
    clientSecret: 'host-only-secret',
    cardInstanceId: 'card-one',
    text: '重试内容',
  });

  assert.equal(attempts, 2);
  assert.deepEqual(waits, [1_000]);
});

test('AI Card cleanup marks failure while a completed final frame never falls back twice', async () => {
  const calls = [];
  let rejectCompletedStatus = true;
  const fetchImpl = async (url, options) => {
    calls.push({ url: url.toString(), options });
    if (url.toString() === `${DINGTALK_API_BASE_URL}v1.0/oauth2/accessToken`) {
      return jsonResponse({ accessToken: 'access-token', expireIn: 7_200 });
    }
    const body = JSON.parse(options.body);
    if (rejectCompletedStatus
      && new URL(url).pathname === '/v1.0/card/instances'
      && body.cardData?.cardParamMap?.flowStatus === '3') {
      return jsonResponse({}, { status: 500 });
    }
    return jsonResponse({});
  };
  const api = createDingtalkApi({ fetchImpl, cardMinIntervalMs: 0, cardBackoffMs: 0 });
  const request = {
    clientId: 'ding-client',
    clientSecret: 'host-only-secret',
    cardInstanceId: 'card-one',
  };

  assert.deepEqual(await api.finishAiCard({ ...request, text: '最终答案' }), {
    delivered: true,
    completed: false,
  });
  rejectCompletedStatus = false;
  await api.failAiCard({ ...request, text: '处理失败' });

  const bodies = calls
    .filter(({ url }) => new URL(url).pathname.startsWith('/v1.0/card/'))
    .map(({ options }) => JSON.parse(options.body));
  assert.equal(bodies.some((body) => body.isFinalize === true && body.isError === false), true);
  assert.equal(bodies.some((body) => body.isError === true), true);
  assert.equal(bodies.some((body) => body.cardData?.cardParamMap?.flowStatus === '5'), true);
});

test('AI Card creation closes a delivered card with an independent signal after abort', async () => {
  const controller = new AbortController();
  const bodies = [];
  const fetchImpl = async (url, options) => {
    if (url.toString() === `${DINGTALK_API_BASE_URL}v1.0/oauth2/accessToken`) {
      return jsonResponse({ accessToken: 'access-token', expireIn: 7_200 });
    }
    const body = JSON.parse(options.body);
    bodies.push(body);
    if (options.method === 'PUT' && body.cardData?.cardParamMap?.flowStatus === '2') {
      controller.abort(new DOMException('stopped', 'AbortError'));
      throw controller.signal.reason;
    }
    return jsonResponse({});
  };
  const api = createDingtalkApi({ fetchImpl, cardMinIntervalMs: 0, cardBackoffMs: 0 });

  await assert.rejects(api.createAiCard({
    clientId: 'ding-client',
    clientSecret: 'host-only-secret',
    target: { type: 'user', userId: 'staff-one' },
    initialText: '正在处理',
    signal: controller.signal,
  }), { name: 'AbortError' });

  assert.equal(bodies.some((body) => body.isError === true), true);
  assert.equal(bodies.some((body) => body.cardData?.cardParamMap?.flowStatus === '5'), true);
});

test('text splitting prefers line boundaries and never produces oversized chunks', () => {
  const chunks = splitDingtalkText('第一段\n第二段很长\n第三段', 8);
  assert.equal(chunks.join('').replaceAll('\n', ''), '第一段第二段很长第三段');
  assert.ok(chunks.every((chunk) => chunk.length <= 8));
});
