import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import {
  conversationKey,
  extractInboundMessage,
  extractText,
  isAllowedSender,
  isBotSender,
  splitText,
} from '../../../src/channels/feishu/message-utils.mjs';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('extractText removes bot mentions', () => {
  const event = {
    message: {
      message_type: 'text',
      content: JSON.stringify({ text: '@_user_1 你好' }),
      mentions: [{ key: '@_user_1' }],
    },
  };
  assert.equal(extractText(event), '你好');
});

test('extractInboundMessage lazily downloads a Feishu image resource as a bounded stream', async () => {
  const calls = [];
  const event = {
    message: {
      message_id: 'om_image',
      message_type: 'image',
      content: JSON.stringify({ image_key: 'img_test' }),
    },
  };
  const client = { im: { v1: { messageResource: { get: async (request) => {
    calls.push(request);
    return {
      headers: { 'content-length': String(PNG_1X1.length) },
      getReadableStream: () => Readable.from([
        PNG_1X1.subarray(0, 12),
        PNG_1X1.subarray(12),
      ]),
    };
  } } } } };

  const message = extractInboundMessage(event, client);
  assert.equal(message.content, '');
  assert.equal(message.images.length, 1);
  assert.deepEqual(await message.images[0].load({ maxBytes: 1024 }), PNG_1X1);
  assert.deepEqual(calls, [{
    path: { message_id: 'om_image', file_key: 'img_test' },
    params: { type: 'image' },
  }]);
});

test('extractInboundMessage preserves visible Feishu post text and every embedded image', async () => {
  const calls = [];
  const event = {
    message: {
      message_id: 'om_post',
      message_type: 'post',
      mentions: [{ key: '@_bot_1' }],
      content: JSON.stringify({
        title: '截图比较',
        content: [
          [
            { tag: 'at', user_id: '@_bot_1', user_name: '机器人' },
            { tag: 'text', text: '@_bot_1 请查看 ' },
            { tag: 'a', text: '第一处', href: 'https://example.com/one' },
            { tag: 'link', text: ' 和第二处', href: 'https://example.com/two' },
          ],
          [{ tag: 'img', image_key: 'img_first' }],
          [{ tag: 'text', text: '补充说明' }],
          [
            { tag: 'img', image_key: 'img_second' },
            { tag: 'img', image_key: '  ' },
          ],
        ],
      }),
    },
  };
  const client = { im: { v1: { messageResource: { get: async (request) => {
    calls.push(request);
    return {
      headers: { 'content-length': String(PNG_1X1.length) },
      getReadableStream: () => Readable.from([PNG_1X1]),
    };
  } } } } };

  const message = extractInboundMessage(event, client);
  assert.equal(extractText(event), null, 'rich posts must not become interaction replies');
  assert.equal(message.content, '截图比较\n请查看 第一处 和第二处\n补充说明');
  assert.equal(message.images.length, 2);
  assert.deepEqual(await Promise.all(message.images.map((image) => image.load({ maxBytes: 1024 }))), [
    PNG_1X1,
    PNG_1X1,
  ]);
  assert.deepEqual(calls, [
    {
      path: { message_id: 'om_post', file_key: 'img_first' },
      params: { type: 'image' },
    },
    {
      path: { message_id: 'om_post', file_key: 'img_second' },
      params: { type: 'image' },
    },
  ]);
});

test('extractInboundMessage exposes a native Feishu file as a lazy unbounded resource download', async () => {
  const calls = [];
  const bytes = Buffer.from('ordinary-file-payload');
  const event = {
    message: {
      message_id: 'om_file',
      message_type: 'file',
      content: JSON.stringify({ file_key: 'file_test', file_name: 'report.bin' }),
    },
  };
  const client = { im: { v1: { messageResource: { get: async (request) => {
    calls.push(request);
    return {
      getReadableStream: () => Readable.from([bytes.subarray(0, 4), bytes.subarray(4)]),
    };
  } } } } };

  const message = extractInboundMessage(event, client);
  assert.equal(message.content, '');
  assert.deepEqual(message.images, []);
  assert.equal(message.files.length, 1);
  assert.equal(message.files[0].name, 'report.bin');
  assert.equal(calls.length, 0, 'file download stays lazy');
  assert.deepEqual(await message.files[0].load({}), bytes);
  assert.deepEqual(calls, [{
    path: { message_id: 'om_file', file_key: 'file_test' },
    params: { type: 'file' },
  }]);
});

test('Feishu image loading rejects declared or streamed data above the caller limit', async () => {
  for (const resource of [
    {
      headers: { 'content-length': '5' },
      getReadableStream: () => Readable.from([Buffer.alloc(5)]),
    },
    {
      headers: {},
      getReadableStream: () => Readable.from([Buffer.alloc(2), Buffer.alloc(3)]),
    },
  ]) {
    const message = extractInboundMessage({
      message: {
        message_id: 'om_large',
        message_type: 'image',
        content: JSON.stringify({ image_key: 'img_large' }),
      },
    }, { im: { v1: { messageResource: { get: async () => resource } } } });
    await assert.rejects(message.images[0].load({ maxBytes: 4 }), /limit|exceeds/);
  }
});

test('Feishu image loading maps the missing message scope to an actionable error', async () => {
  const providerError = new Error('Request failed with status code 400');
  const body = Buffer.from(JSON.stringify({
    code: 99991672,
    msg: 'missing required tenant scope',
  }));
  providerError.response = {
    status: 400,
    data: Readable.from([body.subarray(0, 9), body.subarray(9)]),
  };
  const message = extractInboundMessage({
    message: {
      message_id: 'om_permission',
      message_type: 'image',
      content: JSON.stringify({ image_key: 'img_permission' }),
    },
  }, { im: { v1: { messageResource: { get: async () => { throw providerError; } } } } });

  await assert.rejects(message.images[0].load({ maxBytes: 1024 }), (error) => {
    assert.equal(error.code, 'feishu-image-permission-required');
    assert.match(error.userMessage, /im:message:readonly/);
    assert.match(error.userMessage, /\/repair/);
    assert.match(error.userMessage, /「IM机器人」设置页/);
    assert.match(error.userMessage, /补全权限/);
    assert.match(error.userMessage, /发布新版本/);
    assert.equal(error.cause, providerError);
    return true;
  });
});

test('Feishu image loading leaves unrelated provider failures on the generic path', async () => {
  const providerError = new Error('Request failed with status code 400');
  providerError.response = {
    status: 400,
    data: Readable.from([Buffer.from(JSON.stringify({ code: 99991400 }))]),
  };
  const message = extractInboundMessage({
    message: {
      message_id: 'om_other_error',
      message_type: 'image',
      content: JSON.stringify({ image_key: 'img_other_error' }),
    },
  }, { im: { v1: { messageResource: { get: async () => { throw providerError; } } } } });

  await assert.rejects(
    message.images[0].load({ maxBytes: 1024 }),
    (error) => error === providerError,
  );
});

test('malformed Feishu image content does not create a downloadable image reference', () => {
  assert.deepEqual(extractInboundMessage({
    message: { message_type: 'image', content: '{not-json' },
  }, {}), { content: '', images: [], files: [] });
  assert.deepEqual(extractInboundMessage({
    message: { message_type: 'post', content: '{not-json' },
  }, {}), { content: '', images: [], files: [] });
});

test('conversationKey isolates p2p users and groups', () => {
  assert.equal(conversationKey({
    sender: { sender_id: { open_id: 'ou_test' } },
    message: { chat_type: 'p2p', chat_id: 'oc_private' },
  }), 'p2p:ou_test');
  assert.equal(conversationKey({
    sender: { sender_id: { open_id: 'ou_test' } },
    message: { chat_type: 'group', chat_id: 'oc_group' },
  }), 'group:oc_group');
});

test('splitText preserves all text', () => {
  const input = `${'a'.repeat(12)}\n${'b'.repeat(12)}`;
  const chunks = splitText(input, 15);
  assert.equal(chunks.join('\n'), input);
  assert.ok(chunks.every((chunk) => chunk.length <= 15));
});

test('isBotSender rejects bot loops', () => {
  assert.equal(isBotSender({ sender: { sender_type: 'bot' } }), true);
  assert.equal(isBotSender({ sender: { sender_type: 'user' } }), false);
});

test('isAllowedSender enforces an open-id allowlist', () => {
  const event = { sender: { sender_id: { open_id: 'ou_allowed' } } };
  assert.equal(isAllowedSender(event, new Set()), false);
  assert.equal(isAllowedSender(event, new Set(['ou_allowed'])), true);
  assert.equal(isAllowedSender(event, new Set(['ou_other'])), false);
  assert.equal(isAllowedSender(event, new Set(['*'])), true);
});
