import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifiedFeishuChannel } from '../../../src/channels/feishu/feishu-channel.mjs';

function fakeClient(overrides = {}) {
  const calls = {
    replies: [],
    updates: [],
    settings: [],
    recalls: [],
    reactionsAdded: [],
    reactionsRemoved: [],
    fileUploads: [],
  };
  const client = {
    cardkit: { v1: {
      card: {
        create: async () => ({ code: 0, data: { card_id: 'card-test' } }),
        settings: async (request) => {
          calls.settings.push(request);
          return { code: 0 };
        },
      },
      cardElement: {
        content: async (request) => {
          calls.updates.push(request);
          return { code: 0 };
        },
      },
    } },
    im: { v1: {
      file: {
        create: async (request) => {
          calls.fileUploads.push(request);
          return { file_key: 'file-key-test' };
        },
      },
      message: {
        reply: async (request) => {
          calls.replies.push(request);
          return { code: 0, data: { message_id: 'om-stream' } };
        },
        create: async () => ({ code: 0, data: { message_id: 'om-stream' } }),
        delete: async (request) => {
          calls.recalls.push(request);
          return { code: 0 };
        },
      },
      messageReaction: {
        create: async (request) => {
          calls.reactionsAdded.push(request);
          return { code: 0, data: { reaction_id: 'reaction-test' } };
        },
        delete: async (request) => {
          calls.reactionsRemoved.push(request);
          return { code: 0 };
        },
      },
    } },
  };

  if (overrides.updateContent) client.cardkit.v1.cardElement.content = overrides.updateContent;
  if (overrides.finishCard) client.cardkit.v1.card.settings = overrides.finishCard;
  if (overrides.uploadFile) client.im.v1.file.create = overrides.uploadFile;
  if (overrides.replyMessage) client.im.v1.message.reply = overrides.replyMessage;
  if (overrides.createMessage) client.im.v1.message.create = overrides.createMessage;
  return { client, calls };
}

test('VerifiedFeishuChannel streams content and verifies terminal settings', async () => {
  const { client, calls } = fakeClient();
  const channel = new VerifiedFeishuChannel({ client, initialText: '正在思考…' });

  const result = await channel.stream('oc_chat', {
    markdown: async (controller) => {
      await controller.setContent('第一段');
      await controller.setContent('第一段和第二段');
    },
  }, { replyTo: 'om_user' });

  assert.deepEqual(result, { messageId: 'om-stream' });
  assert.equal(calls.replies[0].path.message_id, 'om_user');
  assert.deepEqual(calls.updates.map((call) => ({
    content: call.data.content,
    sequence: call.data.sequence,
  })), [
    { content: '第一段', sequence: 1 },
    { content: '第一段和第二段', sequence: 2 },
  ]);
  assert.equal(calls.settings[0].data.sequence, 3);
  assert.deepEqual(JSON.parse(calls.settings[0].data.settings), {
    config: {
      streaming_mode: false,
      summary: { content: '第一段和第二段' },
    },
  });
  assert.equal(calls.recalls.length, 0);
});

test('VerifiedFeishuChannel rejects failed updates and recalls the partial card', async () => {
  const { client, calls } = fakeClient({
    updateContent: async () => ({ code: 230099, msg: 'element update failed' }),
  });
  const channel = new VerifiedFeishuChannel({ client });

  await assert.rejects(channel.stream('oc_chat', {
    markdown: async (controller) => controller.setContent('最终回答'),
  }, { replyTo: 'om_user' }), /cardElement\.content failed/);

  assert.deepEqual(calls.recalls, [{ path: { message_id: 'om-stream' } }]);
  assert.equal(calls.settings.length, 0);
});

test('VerifiedFeishuChannel rejects failed finalization and recalls the card', async () => {
  const { client, calls } = fakeClient({
    finishCard: async (request) => {
      calls.settings.push(request);
      return { code: 230099, msg: 'card finalization failed' };
    },
  });
  const channel = new VerifiedFeishuChannel({ client });

  await assert.rejects(channel.stream('oc_chat', {
    markdown: async (controller) => controller.setContent('已经生成的回答'),
  }, { replyTo: 'om_user' }), /card\.settings failed/);

  assert.deepEqual(calls.recalls, [{ path: { message_id: 'om-stream' } }]);
  assert.equal(calls.settings.length, 1);
});

test('VerifiedFeishuChannel checks reaction API results', async () => {
  const { client, calls } = fakeClient();
  const channel = new VerifiedFeishuChannel({ client });

  const reactionId = await channel.addReaction('om_user', 'OnIt');
  await channel.removeReaction('om_user', reactionId);

  assert.equal(reactionId, 'reaction-test');
  assert.equal(calls.reactionsAdded[0].data.reaction_type.emoji_type, 'OnIt');
  assert.equal(calls.reactionsRemoved[0].path.reaction_id, 'reaction-test');
});

test('VerifiedFeishuChannel uploads a materialized result and replies with a native file message', async () => {
  const { client, calls } = fakeClient();
  const channel = new VerifiedFeishuChannel({ client });
  const file = {
    artifactId: 'artifact-html',
    deliveryKey: 'delivery-html',
    fileName: 'result.html',
    mediaType: 'text/html',
    size: 19,
    bytes: Buffer.from('<h1>result</h1>'),
  };

  const receipt = await channel.sendFile('oc_chat', file, { replyTo: 'om_user' });

  assert.equal(calls.fileUploads.length, 1);
  assert.equal(calls.fileUploads[0].data.file_type, 'stream');
  assert.equal(calls.fileUploads[0].data.file_name, 'result.html');
  assert.equal(calls.fileUploads[0].data.file, file.bytes);
  assert.equal(calls.replies.length, 1);
  assert.equal(calls.replies[0].path.message_id, 'om_user');
  assert.equal(calls.replies[0].data.msg_type, 'file');
  assert.deepEqual(JSON.parse(calls.replies[0].data.content), { file_key: 'file-key-test' });
  assert.match(calls.replies[0].data.uuid, /^dshim_[a-f0-9]{40}$/);
  assert.deepEqual(receipt, {
    schemaVersion: 1,
    deliveryId: 'delivery-html',
    presentation: 'feishu-file',
    providerMessageIds: ['om-stream'],
    artifacts: [{ artifactId: 'artifact-html', outcome: 'sent' }],
  });
});

test('VerifiedFeishuChannel sends to the current chat when no reply target exists', async () => {
  const { client, calls } = fakeClient({
    createMessage: async (request) => {
      calls.replies.push(request);
      return { code: 0, data: { message_id: 'om-created-file' } };
    },
  });
  const channel = new VerifiedFeishuChannel({ client });

  await channel.sendFile('oc_chat', {
    artifactId: 'artifact-generic',
    deliveryKey: 'delivery-generic',
    fileName: 'result.bin',
    bytes: Buffer.from('generic'),
  });

  assert.deepEqual(calls.replies[0].params, { receive_id_type: 'chat_id' });
  assert.equal(calls.replies[0].data.receive_id, 'oc_chat');
  assert.equal(calls.replies[0].data.msg_type, 'file');
});

test('VerifiedFeishuChannel retries uncertain message delivery without uploading twice', async () => {
  const requests = [];
  let attempts = 0;
  const { client, calls } = fakeClient({
    replyMessage: async (request) => {
      requests.push(structuredClone(request));
      attempts += 1;
      return attempts === 1
        ? { code: 230049, msg: 'still sending' }
        : { code: 0, data: { message_id: 'om-retried-file' } };
    },
  });
  const channel = new VerifiedFeishuChannel({ client });

  const receipt = await channel.sendFile('oc_chat', {
    artifactId: 'artifact-retry',
    deliveryKey: 'delivery-retry',
    fileName: 'retry.txt',
    bytes: Buffer.from('retry'),
  }, { replyTo: 'om_user' });

  assert.equal(calls.fileUploads.length, 1);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], requests[0]);
  assert.deepEqual(receipt.providerMessageIds, ['om-retried-file']);
});

test('VerifiedFeishuChannel stops after one 230049 retry and never uploads the file twice', async () => {
  const requests = [];
  const { client, calls } = fakeClient({
    replyMessage: async (request) => {
      requests.push(structuredClone(request));
      return { code: 230049, msg: 'still sending' };
    },
  });
  const channel = new VerifiedFeishuChannel({ client });

  await assert.rejects(channel.sendFile('oc_chat', {
    artifactId: 'artifact-still-uncertain',
    deliveryKey: 'delivery-still-uncertain',
    fileName: 'uncertain.txt',
    bytes: Buffer.from('uncertain'),
  }, { replyTo: 'om_user' }), (error) => error.code === 'artifact-delivery-uncertain'
    && error.providerCode === 230049);

  assert.equal(calls.fileUploads.length, 1);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], requests[0]);
});

test('VerifiedFeishuChannel retries an SDK-thrown 230049 with the same file key and UUID', async () => {
  const requests = [];
  const { client, calls } = fakeClient({
    replyMessage: async (request) => {
      requests.push(structuredClone(request));
      if (requests.length === 1) {
        const error = new Error('still sending');
        error.code = 230049;
        throw error;
      }
      return { code: 0, data: { message_id: 'om-after-thrown-230049' } };
    },
  });
  const channel = new VerifiedFeishuChannel({ client });

  const receipt = await channel.sendFile('oc_chat', {
    artifactId: 'artifact-thrown-retry',
    deliveryKey: 'delivery-thrown-retry',
    fileName: 'thrown-retry.txt',
    bytes: Buffer.from('retry'),
  }, { replyTo: 'om_user' });

  assert.equal(calls.fileUploads.length, 1);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], requests[0]);
  assert.deepEqual(receipt.providerMessageIds, ['om-after-thrown-230049']);
});

test('VerifiedFeishuChannel bounds upload and message waits independently', async () => {
  const uploadFixture = fakeClient({ uploadFile: async () => new Promise(() => {}) });
  const uploadChannel = new VerifiedFeishuChannel({
    client: uploadFixture.client,
    fileUploadTimeoutMs: 10,
    fileMessageTimeoutMs: 100,
  });

  await assert.rejects(uploadChannel.sendFile('oc_chat', {
    artifactId: 'artifact-upload-timeout',
    deliveryKey: 'delivery-upload-timeout',
    fileName: 'upload-timeout.txt',
    bytes: Buffer.from('timeout'),
  }, { replyTo: 'om_user' }), (error) => error.code === 'artifact-provider-failed'
    && error.cause?.code === 'provider-timeout');
  assert.equal(uploadFixture.calls.replies.length, 0);

  let messageCalls = 0;
  const messageFixture = fakeClient({
    replyMessage: async () => {
      messageCalls += 1;
      return new Promise(() => {});
    },
  });
  const messageChannel = new VerifiedFeishuChannel({
    client: messageFixture.client,
    fileUploadTimeoutMs: 100,
    fileMessageTimeoutMs: 10,
  });

  await assert.rejects(messageChannel.sendFile('oc_chat', {
    artifactId: 'artifact-message-timeout',
    deliveryKey: 'delivery-message-timeout',
    fileName: 'message-timeout.txt',
    bytes: Buffer.from('timeout'),
  }, { replyTo: 'om_user' }), (error) => error.code === 'artifact-delivery-uncertain'
    && error.cause?.code === 'provider-timeout');
  assert.equal(messageFixture.calls.fileUploads.length, 1);
  assert.equal(messageCalls, 1);
});

test('VerifiedFeishuChannel rejects waits longer than the 120 second operation timeout', () => {
  const { client } = fakeClient();
  assert.throws(
    () => new VerifiedFeishuChannel({ client, fileUploadTimeoutMs: 120_001 }),
    /fileUploadTimeoutMs.*120000/,
  );
  assert.throws(
    () => new VerifiedFeishuChannel({ client, fileMessageTimeoutMs: 120_001 }),
    /fileMessageTimeoutMs.*120000/,
  );
});

test('VerifiedFeishuChannel stops after an in-flight upload when file delivery is cancelled', async () => {
  let uploadStarted;
  const started = new Promise((resolve) => { uploadStarted = resolve; });
  const { client, calls } = fakeClient({
    uploadFile: async () => {
      uploadStarted();
      return new Promise(() => {});
    },
  });
  const channel = new VerifiedFeishuChannel({ client });
  const abort = new AbortController();
  const reason = new DOMException('runtime stopped', 'AbortError');

  const sending = channel.sendFile('oc_chat', {
    artifactId: 'artifact-cancelled-upload',
    deliveryKey: 'delivery-cancelled-upload',
    fileName: 'cancelled.txt',
    bytes: Buffer.from('cancelled'),
  }, { replyTo: 'om_user', signal: abort.signal });

  await started;
  abort.abort(reason);

  await assert.rejects(sending, (error) => error === reason);
  assert.equal(calls.replies.length, 0);
});

test('VerifiedFeishuChannel immediately preserves caller abort during an in-flight message send', async () => {
  let messageStarted;
  const started = new Promise((resolve) => { messageStarted = resolve; });
  const { client, calls } = fakeClient({
    replyMessage: async () => {
      messageStarted();
      return new Promise(() => {});
    },
  });
  const channel = new VerifiedFeishuChannel({ client });
  const abort = new AbortController();
  const reason = new DOMException('runtime stopped', 'AbortError');

  const sending = channel.sendFile('oc_chat', {
    artifactId: 'artifact-cancelled-message',
    deliveryKey: 'delivery-cancelled-message',
    fileName: 'cancelled-message.txt',
    bytes: Buffer.from('cancelled'),
  }, { replyTo: 'om_user', signal: abort.signal });

  await started;
  abort.abort(reason);

  await assert.rejects(sending, (error) => error === reason
    && error.code !== 'artifact-delivery-uncertain');
  assert.equal(calls.fileUploads.length, 1);
});

test('VerifiedFeishuChannel does not retry an uncertain file message after cancellation', async () => {
  const abort = new AbortController();
  const reason = new DOMException('runtime stopped', 'AbortError');
  const requests = [];
  const { client } = fakeClient({
    replyMessage: async (request) => {
      requests.push(request);
      abort.abort(reason);
      return { code: 230049, msg: 'still sending' };
    },
  });
  const channel = new VerifiedFeishuChannel({ client });

  await assert.rejects(channel.sendFile('oc_chat', {
    artifactId: 'artifact-cancelled-retry',
    deliveryKey: 'delivery-cancelled-retry',
    fileName: 'cancelled-retry.txt',
    bytes: Buffer.from('cancelled retry'),
  }, { replyTo: 'om_user', signal: abort.signal }), (error) => error === reason);

  assert.equal(requests.length, 1);
});

test('VerifiedFeishuChannel lets Feishu decide empty and oversize file outcomes', async () => {
  const uploads = [];
  const providerCodes = [234010, 234006, 0];
  const { client } = fakeClient({
    uploadFile: async (request) => {
      uploads.push(request);
      const code = providerCodes.shift();
      return code === 0 ? {} : { code };
    },
  });
  const channel = new VerifiedFeishuChannel({ client });
  const base = {
    artifactId: 'artifact-invalid',
    deliveryKey: 'delivery-invalid',
    fileName: 'invalid.bin',
  };

  await assert.rejects(
    channel.sendFile('oc_chat', { ...base, bytes: Buffer.alloc(0) }),
    (error) => error.code === 'artifact-empty' && error.providerCode === 234010,
  );
  await assert.rejects(
    channel.sendFile('oc_chat', { ...base, bytes: Buffer.from('provider decides') }),
    (error) => error.code === 'artifact-too-large' && error.providerCode === 234006,
  );
  await assert.rejects(
    channel.sendFile('oc_chat', { ...base, bytes: Buffer.from('valid bytes') }),
    (error) => error.code === 'artifact-provider-failed' && !error.message.includes('undefined'),
  );
  assert.deepEqual(uploads.map((request) => request.data.file.byteLength), [0, 16, 11]);
});

test('VerifiedFeishuChannel distinguishes upload failure from uncertain final delivery', async () => {
  const uploadFixture = fakeClient({
    uploadFile: async () => { throw new Error('upload transport closed'); },
  });
  const uploadChannel = new VerifiedFeishuChannel({ client: uploadFixture.client });

  await assert.rejects(uploadChannel.sendFile('oc_chat', {
    artifactId: 'artifact-upload-transport',
    deliveryKey: 'delivery-upload-transport',
    fileName: 'upload.txt',
    bytes: Buffer.from('upload'),
  }, { replyTo: 'om_user' }), (error) => error.code === 'artifact-provider-failed');
  assert.equal(uploadFixture.calls.replies.length, 0);

  for (const replyMessage of [
    async () => { throw new Error('message transport closed'); },
    async () => ({ code: 0, data: {} }),
  ]) {
    const messageFixture = fakeClient({ replyMessage });
    const messageChannel = new VerifiedFeishuChannel({ client: messageFixture.client });
    await assert.rejects(messageChannel.sendFile('oc_chat', {
      artifactId: 'artifact-uncertain-message',
      deliveryKey: 'delivery-uncertain-message',
      fileName: 'message.txt',
      bytes: Buffer.from('message'),
    }, { replyTo: 'om_user' }), (error) => error.code === 'artifact-delivery-uncertain');
    assert.equal(messageFixture.calls.fileUploads.length, 1);
  }
});

test('VerifiedFeishuChannel keeps explicit final provider codes out of the uncertain bucket', async () => {
  const { client, calls } = fakeClient({
    replyMessage: async () => ({ code: 99991672, msg: 'missing scope' }),
  });
  const channel = new VerifiedFeishuChannel({ client });

  await assert.rejects(channel.sendFile('oc_chat', {
    artifactId: 'artifact-message-permission',
    deliveryKey: 'delivery-message-permission',
    fileName: 'permission.txt',
    bytes: Buffer.from('permission'),
  }, { replyTo: 'om_user' }), (error) => error.code === 'artifact-permission-required'
    && error.providerCode === 99991672);
  assert.equal(calls.fileUploads.length, 1);
});

test('VerifiedFeishuChannel classifies missing file permission without exposing provider details', async () => {
  const { client } = fakeClient({
    uploadFile: async () => {
      const error = new Error('raw tenant detail and private diagnostic');
      error.code = 99991672;
      throw error;
    },
  });
  const channel = new VerifiedFeishuChannel({ client });

  await assert.rejects(
    channel.sendFile('oc_chat', {
      artifactId: 'artifact-permission',
      deliveryKey: 'delivery-permission',
      fileName: 'result.html',
      bytes: Buffer.from('result'),
    }),
    (error) => error.code === 'artifact-permission-required'
      && error.message.includes('im:resource permission')
      && !error.message.includes('im:resource:upload')
      && !error.message.includes('private diagnostic'),
  );
});

test('VerifiedFeishuChannel recognizes the SDK array-shaped permission error', async () => {
  const { client } = fakeClient({
    uploadFile: async () => {
      const transport = new Error('raw transport diagnostic');
      transport.code = 'ERR_BAD_REQUEST';
      throw [transport, {
        code: 99991672,
        msg: 'raw provider permission URL',
      }];
    },
  });
  const channel = new VerifiedFeishuChannel({ client });

  await assert.rejects(
    channel.sendFile('oc_chat', {
      artifactId: 'artifact-array-permission',
      deliveryKey: 'delivery-array-permission',
      fileName: 'result.txt',
      bytes: Buffer.from('result'),
    }),
    (error) => error.code === 'artifact-permission-required'
      && error.providerCode === 99991672
      && !error.message.includes('provider permission URL'),
  );
});
