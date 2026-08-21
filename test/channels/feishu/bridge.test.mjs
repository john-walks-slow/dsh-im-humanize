import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FeishuHarnessBridge } from '../../../src/channels/feishu/bridge.mjs';
import { DEFAULT_IMAGE_PROMPT } from '../../../src/channels/shared/image-prompt.mjs';
import { connectionTestTarget } from '../../../src/channels/shared/connection-test.mjs';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function eventually(predicate, message = 'condition was not met') {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(message);
}

function event(messageId, text, overrides = {}) {
  const { senderOpenId = 'ou_user', ...messageOverrides } = overrides;
  return {
    sender: { sender_type: 'user', sender_id: { open_id: senderOpenId } },
    message: {
      message_id: messageId,
      message_type: 'text',
      chat_type: 'p2p',
      chat_id: 'oc_chat',
      content: JSON.stringify({ text }),
      ...messageOverrides,
    },
  };
}

function stateFixture(initialSessions = []) {
  const sessions = new Map(initialSessions);
  const seen = new Set();
  return {
    sessions,
    seen,
    state: {
      hasSeen: (id) => seen.has(id),
      markSeen: async (id) => seen.add(id),
      sessionFor: (key) => sessions.get(key) ?? null,
      setSession: async (key, sessionId) => sessions.set(key, sessionId),
      clearSession: async (key) => sessions.delete(key),
    },
  };
}

function bridgeStatus() {
  return {
    messagesReceived: 0,
    messagesReplied: 0,
    messagesRejected: 0,
    lastMessageAt: null,
    lastReplyAt: null,
    lastRejectedAt: null,
    lastError: null,
  };
}

function textClient(sendText) {
  let sequence = 0;
  return {
    im: { v1: { message: { create: async (request) => {
      const outgoing = {
        chatId: request.data.receive_id,
        text: JSON.parse(request.data.content).text,
      };
      await sendText(outgoing);
      sequence += 1;
      return { code: 0, data: { message_id: `om_test_${sequence}` } };
    } } } },
  };
}

test('Feishu remembers any authorized private inbound message as a connection-test target', async () => {
  const groupFixture = stateFixture();
  const groupBridge = new FeishuHarnessBridge({
    client: textClient(async () => {}),
    channel: {},
    harness: { ensureRunning: async () => true },
    state: groupFixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });
  await groupBridge.accept(event('target-group', '/help', {
    chat_type: 'group',
    chat_id: 'oc_group',
  }));
  await groupBridge.waitForIdle();
  assert.equal(connectionTestTarget(groupFixture.state), null);

  const rejectedFixture = stateFixture();
  const rejectedBridge = new FeishuHarnessBridge({
    client: textClient(async () => {}),
    channel: {},
    harness: { ensureRunning: async () => true },
    state: rejectedFixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_owner']),
  });
  await rejectedBridge.accept(event('target-rejected', '/help', {
    senderOpenId: 'ou_other',
  }));
  await rejectedBridge.waitForIdle();
  assert.equal(connectionTestTarget(rejectedFixture.state), null);

  const privateFixture = stateFixture();
  const privateBridge = new FeishuHarnessBridge({
    client: textClient(async () => {}),
    channel: {},
    harness: { ensureRunning: async () => true },
    state: privateFixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['*']),
  });
  await privateBridge.accept(event('target-private', '/help', {
    chat_id: 'oc_private',
  }));
  await privateBridge.waitForIdle();
  assert.deepEqual(connectionTestTarget(privateFixture.state), { chatId: 'oc_private' });
});

test('Feishu executes /compact for the bound Session without prompting the model', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-compact']]);
  const sent = [];
  const executed = [];
  const bridge = new FeishuHarnessBridge({
    client: textClient(async ({ text }) => sent.push(text)),
    channel: {},
    harness: {
      executeCommand: async (sessionId, line) => {
        executed.push({ sessionId, line });
        return { commandId: 'compact-feishu', result: { kind: 'success', text: 'No compactable history yet.' } };
      },
      ask: async () => assert.fail('/compact must not be submitted to the model'),
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  await bridge.accept(event('compact-feishu', '/compact'));
  await bridge.waitForIdle();

  assert.deepEqual(executed, [{ sessionId: 'session-compact', line: '/compact' }]);
  assert.deepEqual(sent, ['暂无可压缩的历史记录。']);
});

test('Feishu lists models without prompting and help advertises all four commands', async () => {
  const fixture = stateFixture();
  const sent = [];
  let asks = 0;
  let creates = 0;
  const bridge = new FeishuHarnessBridge({
    client: textClient(async ({ text }) => sent.push(text)),
    channel: {},
    harness: {
      listModels: async () => ({
        groups: [{
          id: 'feishu-provider',
          name: 'Feishu Provider',
          models: [{ id: 'model-one', name: 'Model One' }],
        }],
        failures: [],
      }),
      createSession: async () => { creates += 1; return 'feishu-session'; },
      ask: async () => { asks += 1; return 'unexpected model reply'; },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  await bridge.accept(event('models-feishu', '/models'));
  await bridge.waitForIdle();
  assert.match(sent.at(-1), /1\. feishu-provider\/model-one/);
  assert.equal(asks, 0);
  assert.equal(creates, 0);
  assert.equal(fixture.sessions.size, 0);

  await bridge.accept(event('help-feishu', '/help'));
  await bridge.waitForIdle();
  const help = sent.at(-1);
  for (const command of ['/models', '/model', '/stop', '/steer']) {
    assert.equal(help.includes(command), true, command);
  }
  assert.match(help, /\/model 2/);
});

test('bridge maps a Feishu conversation to a persistent Harness session and replies', async () => {
  const sent = [];
  const reactions = [];
  const removedReactions = [];
  const streamed = [];
  const sessions = new Map();
  const seen = new Set();
  const asked = [];
  const client = {
    im: { v1: { message: { create: async (request) => {
      sent.push(request);
      return { code: 0 };
    } } } },
  };
  const channel = {
    addReaction: async (messageId, emojiType) => {
      reactions.push({ messageId, emojiType });
      return `reaction-${emojiType}`;
    },
    removeReaction: async (messageId, reactionId) => {
      removedReactions.push({ messageId, reactionId });
    },
    stream: async (chatId, input, options) => {
      const updates = [];
      await input.markdown({
        setContent: async (content) => updates.push(content),
      });
      streamed.push({ chatId, options, updates });
      return { messageId: 'om_reply' };
    },
  };
  const harness = {
    ensureRunning: async () => true,
    sessionExists: async (sessionId) => sessionId === 'session-test',
    createSession: async () => 'session-test',
    ask: async (sessionId, text, options) => {
      asked.push({ sessionId, text });
      await options.onUpdate({ type: 'text', text: 'Harness' });
      return 'Harness reply';
    },
  };
  const state = {
    hasSeen: (id) => seen.has(id),
    markSeen: async (id) => seen.add(id),
    sessionFor: (key) => sessions.get(key) ?? null,
    setSession: async (key, sessionId) => sessions.set(key, sessionId),
    clearSession: async (key) => sessions.delete(key),
  };
  const status = {
    messagesReceived: 0,
    messagesReplied: 0,
    messagesRejected: 0,
    lastMessageAt: null,
    lastReplyAt: null,
    lastRejectedAt: null,
    lastError: null,
  };
  const bridge = new FeishuHarnessBridge({
    client,
    channel,
    harness,
    state,
    status,
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  bridge.accept(event('om_1', '你好'));
  await bridge.waitForIdle();

  assert.equal(sessions.get('p2p:ou_user'), 'session-test');
  assert.deepEqual(asked, [{ sessionId: 'session-test', text: '你好' }]);
  assert.deepEqual(streamed, [{
    chatId: 'oc_chat',
    options: { replyTo: 'om_1' },
    updates: ['Harness', 'Harness reply'],
  }]);
  assert.deepEqual(reactions, [
    { messageId: 'om_1', emojiType: 'OnIt' },
    { messageId: 'om_1', emojiType: 'DONE' },
  ]);
  assert.deepEqual(removedReactions, [
    { messageId: 'om_1', reactionId: 'reaction-OnIt' },
  ]);
  assert.equal(sent.length, 0);
  assert.equal(status.messagesReceived, 1);
  assert.equal(status.messagesReplied, 1);
  assert.equal(status.streamResponses, 1);

  bridge.accept(event('om_1', '重复消息'));
  await bridge.waitForIdle();
  assert.equal(asked.length, 1);

  bridge.accept({
    ...event('om_2', '越权消息'),
    sender: { sender_type: 'user', sender_id: { open_id: 'ou_other' } },
  });
  await bridge.waitForIdle();
  assert.equal(asked.length, 1);
  assert.equal(status.messagesRejected, 1);
});

test('bridge downloads an inbound Feishu image once and submits structured Harness content', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-image']]);
  const downloaded = [];
  const asked = [];
  const sent = [];
  const client = {
    im: { v1: {
      messageResource: { get: async (request) => {
        downloaded.push(request);
        return {
          headers: { 'content-length': String(PNG_1X1.length) },
          getReadableStream: () => Readable.from([PNG_1X1]),
        };
      } },
      message: { create: async (request) => {
        sent.push(JSON.parse(request.data.content).text);
        return { code: 0, data: { message_id: 'om_image_reply' } };
      } },
    } },
  };
  const bridge = new FeishuHarnessBridge({
    client,
    channel: {},
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, content) => {
        asked.push({ sessionId, content });
        return '看到了一张图片';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });
  const imageEvent = event('om_image_input', '', {
    message_type: 'image',
    content: JSON.stringify({ image_key: 'img_input' }),
  });

  await bridge.accept(imageEvent);
  await bridge.accept(imageEvent);
  await bridge.accept({
    ...event('om_image_unauthorized', '', {
      message_type: 'image',
      content: JSON.stringify({ image_key: 'img_unauthorized' }),
    }),
    sender: { sender_type: 'user', sender_id: { open_id: 'ou_other' } },
  });
  await bridge.waitForIdle();

  assert.deepEqual(downloaded, [{
    path: { message_id: 'om_image_input', file_key: 'img_input' },
    params: { type: 'image' },
  }]);
  assert.deepEqual(asked, [{
    sessionId: 'session-image',
    content: [
      { type: 'text', text: DEFAULT_IMAGE_PROMPT },
      { type: 'image', mediaType: 'image/png', data: PNG_1X1.toString('base64') },
    ],
  }]);
  assert.deepEqual(sent, ['看到了一张图片']);
});

test('bridge tells users to grant im:message:readonly when Feishu rejects image access', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-image-permission']]);
  const sent = [];
  const providerError = new Error('Request failed with status code 400');
  providerError.code = 'ERR_BAD_REQUEST';
  providerError.response = {
    status: 400,
    data: Readable.from([Buffer.from(JSON.stringify({
      code: 99991672,
      msg: 'secret-shaped provider detail /private/path',
    }))]),
  };
  const client = {
    im: { v1: {
      messageResource: { get: async () => { throw providerError; } },
      message: { create: async (request) => {
        sent.push(JSON.parse(request.data.content).text);
        return { code: 0, data: { message_id: 'om_permission_reply' } };
      } },
    } },
  };
  const bridge = new FeishuHarnessBridge({
    client,
    channel: {},
    harness: {
      sessionExists: async () => true,
      ask: async () => assert.fail('permission failures must not reach Harness'),
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  await bridge.accept(event('om_image_permission', '', {
    message_type: 'image',
    content: JSON.stringify({ image_key: 'img_permission' }),
  }));
  await bridge.waitForIdle();

  assert.equal(sent.length, 1);
  assert.match(sent[0], /im:message:readonly/);
  assert.match(sent[0], /发布新版本/);
  assert.doesNotMatch(sent[0], /99991672|HTTP 400|secret-shaped|private\/path/);
});

test('bridge sends Feishu post text and all embedded images as one structured prompt', async () => {
  const fixture = stateFixture([['group:oc_post_group', 'session-post']]);
  const downloaded = [];
  const asked = [];
  const sent = [];
  const client = {
    im: { v1: {
      messageResource: { get: async (request) => {
        downloaded.push(request);
        return {
          headers: { 'content-length': String(PNG_1X1.length) },
          getReadableStream: () => Readable.from([PNG_1X1]),
        };
      } },
      message: { create: async (request) => {
        sent.push(JSON.parse(request.data.content).text);
        return { code: 0, data: { message_id: 'om_post_reply' } };
      } },
    } },
  };
  const bridge = new FeishuHarnessBridge({
    client,
    channel: {},
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, content) => {
        asked.push({ sessionId, content });
        return '两张图片都已收到';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });
  const postEvent = event('om_post_input', '', {
    message_type: 'post',
    chat_type: 'group',
    chat_id: 'oc_post_group',
    mentions: [{ key: '@_bot_1' }],
    content: JSON.stringify({
      title: '比较截图',
      content: [
        [
          { tag: 'at', user_id: '@_bot_1', user_name: '机器人' },
          { tag: 'text', text: '@_bot_1 请比较 ' },
          { tag: 'a', text: '这两张图', href: 'https://example.com' },
        ],
        [{ tag: 'img', image_key: 'img_post_first' }],
        [{ tag: 'img', image_key: 'img_post_second' }],
      ],
    }),
  });

  await bridge.accept(postEvent);
  await bridge.waitForIdle();

  assert.deepEqual(downloaded, [
    {
      path: { message_id: 'om_post_input', file_key: 'img_post_first' },
      params: { type: 'image' },
    },
    {
      path: { message_id: 'om_post_input', file_key: 'img_post_second' },
      params: { type: 'image' },
    },
  ]);
  assert.deepEqual(asked, [{
    sessionId: 'session-post',
    content: [
      { type: 'text', text: '比较截图\n请比较 这两张图' },
      { type: 'image', mediaType: 'image/png', data: PNG_1X1.toString('base64') },
      { type: 'image', mediaType: 'image/png', data: PNG_1X1.toString('base64') },
    ],
  }]);
  assert.deepEqual(sent, ['两张图片都已收到']);
});

test('text inside a Feishu post is a model prompt rather than a local command', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-post-command']]);
  const asked = [];
  const sent = [];
  const bridge = new FeishuHarnessBridge({
    client: textClient(async ({ text }) => sent.push(text)),
    channel: {},
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, content) => {
        asked.push({ sessionId, content });
        return '按普通内容处理';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  await bridge.accept(event('om_post_command', '', {
    message_type: 'post',
    content: JSON.stringify({ content: [[{ tag: 'text', text: '/new' }]] }),
  }));
  await bridge.waitForIdle();

  assert.equal(fixture.sessions.get('p2p:ou_user'), 'session-post-command');
  assert.deepEqual(asked, [{ sessionId: 'session-post-command', content: '/new' }]);
  assert.deepEqual(sent, ['按普通内容处理']);
});

test('a threaded Feishu reply answers a pending Harness question before the original turn queue', async () => {
  const sent = [];
  const streamed = [];
  const asked = [];
  const seen = new Set();
  const sessions = new Map([['p2p:ou_user', 'session-question']]);
  const submitStarted = deferred();
  const releaseSubmit = deferred();
  const answerAccepted = deferred();
  let originalTurnFinished = false;
  const status = {
    messagesReceived: 0,
    messagesReplied: 0,
    messagesRejected: 0,
    lastMessageAt: null,
    lastReplyAt: null,
    lastRejectedAt: null,
    lastError: null,
  };
  const bridge = new FeishuHarnessBridge({
    client: {
      im: { v1: { message: { create: async (request) => {
        sent.push(JSON.parse(request.data.content).text);
        return { code: 0, data: { message_id: `om_sent_${sent.length}` } };
      } } } },
    },
    channel: {
      stream: async (_chatId, input) => {
        await input.markdown({
          setContent: async (content) => streamed.push(content),
        });
        originalTurnFinished = true;
        return { messageId: 'om_stream' };
      },
    },
    harness: {
      ensureRunning: async () => true,
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push({ sessionId, text });
        await options.onUpdate({ type: 'tool', name: 'ask_user_question' });
        await options.onInteraction({
          kind: 'question',
          interactionId: 'question-rpc',
          rpcId: 'question-rpc',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{
              id: 'environment',
              header: '测试环境',
              question: '请选择测试环境',
              options: [{ label: '测试环境' }, { label: '生产环境' }],
            }],
          },
          respond: async (result) => {
            submitStarted.resolve(result);
            await releaseSubmit.promise;
            answerAccepted.resolve();
            return { accepted: true };
          },
        });
        await answerAccepted.promise;
        return '你选择了：测试环境';
      },
    },
    state: {
      hasSeen: (id) => seen.has(id),
      markSeen: async (id) => seen.add(id),
      sessionFor: (key) => sessions.get(key) ?? null,
      setSession: async (key, sessionId) => sessions.set(key, sessionId),
      clearSession: async (key) => sessions.delete(key),
    },
    status,
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  bridge.accept(event('om_prompt', '请先调用 ask_user_question'));
  await eventually(
    () => [...sent, ...streamed].some((text) => text.includes('请选择测试环境')),
    'the Harness question was not presented in Feishu',
  );

  bridge.accept(event('om_answer', '1', {
    root_id: 'om_prompt',
    parent_id: 'om_sent_1',
    thread_id: 'omt_question_thread',
  }));
  const submitted = await Promise.race([
    submitStarted.promise,
    new Promise((_, reject) => setTimeout(
      () => reject(new Error('threaded Feishu answer deadlocked behind the original turn')),
      500,
    )),
  ]);

  assert.equal(originalTurnFinished, false);
  assert.deepEqual(submitted, {
    ok: true,
    value: {
      sessionId: 'session-question',
      answer: {
        answers: [{ id: 'environment', selected: ['测试环境'] }],
      },
    },
  });
  assert.deepEqual(asked, [{
    sessionId: 'session-question',
    text: '请先调用 ask_user_question',
  }]);

  // This matches the screenshot: /status can arrive while the answer is being
  // submitted. It may wait for the original turn, but it must not remain stuck.
  bridge.accept(event('om_status', '/status'));
  releaseSubmit.resolve();
  await bridge.waitForIdle();

  assert.equal(originalTurnFinished, true);
  assert.equal(streamed.at(-1), '你选择了：测试环境');
  assert.equal(sent.some((text) => text.includes('连接正常')), true);
  assert.deepEqual(asked, [{
    sessionId: 'session-question',
    text: '请先调用 ask_user_question',
  }], 'the answer and /status must not become new Harness prompts');
  assert.deepEqual([...seen].sort(), ['om_answer', 'om_prompt', 'om_status']);
  assert.equal(status.messagesReceived, 3);
  assert.equal(status.messagesReplied, 1);
});

test('pending Harness questions are isolated by Feishu conversation', async () => {
  const fixture = stateFixture([
    ['p2p:ou_a', 'session-a'],
    ['p2p:ou_b', 'session-b'],
  ]);
  const sent = [];
  const asked = [];
  const answeredA = deferred();
  const releaseA = deferred();
  const bridge = new FeishuHarnessBridge({
    client: textClient(async (message) => sent.push(message)),
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('existing sessions should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push({ sessionId, text });
        if (sessionId === 'session-b') return '乙会话的普通回答';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'question-a',
          rpcId: 'question-a',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'a', question: '甲会话的问题' }],
          },
          respond: async (result) => {
            answeredA.resolve(result);
            return { accepted: true };
          },
        });
        await answeredA.promise;
        await releaseA.promise;
        return '甲会话完成';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_a', 'ou_b']),
  });

  const firstA = bridge.accept(event('a-prompt', '启动甲会话', {
    senderOpenId: 'ou_a',
    chat_id: 'oc_a',
  }));
  await eventually(() => sent.some(({ text }) => text.includes('甲会话的问题')));

  await bridge.accept(event('b-message', '乙会话的消息', {
    senderOpenId: 'ou_b',
    chat_id: 'oc_b',
  }));
  assert.deepEqual(asked, [
    { sessionId: 'session-a', text: '启动甲会话' },
    { sessionId: 'session-b', text: '乙会话的消息' },
  ]);
  assert.equal(sent.some(({ chatId, text }) => (
    chatId === 'oc_b' && text === '乙会话的普通回答'
  )), true);

  await bridge.accept(event('a-answer', '甲的答案', {
    senderOpenId: 'ou_a',
    chat_id: 'oc_a',
  }));
  assert.deepEqual((await answeredA.promise).value.answer.answers, [
    { id: 'a', selected: [], custom: '甲的答案' },
  ]);
  releaseA.resolve();
  await firstA;
});

test('Feishu handles approval replies on the fast lane and presents approvals in FIFO order', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-approval']]);
  const sent = [];
  const asked = [];
  const decisions = [];
  const decided = deferred();
  const bridge = new FeishuHarnessBridge({
    client: textClient(async (message) => sent.push(message)),
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push({ sessionId, text });
        const approval = (approvalId, toolName, reason) => ({
          kind: 'approval',
          interactionId: approvalId,
          rpcId: `rpc-${approvalId}`,
          sessionId,
          payload: {
            type: 'approval/requested',
            sessionId,
            approvalId,
            toolName,
            callId: `call-${approvalId}`,
            reason,
          },
          toolCall: {
            callId: `call-${approvalId}`,
            name: toolName,
            arguments: JSON.stringify({ operation: reason }),
          },
          respond: async (result) => {
            decisions.push(result);
            if (decisions.length === 2) decided.resolve();
            return { accepted: true };
          },
        });
        await options.onInteraction(approval(
          'approval-build',
          'bash',
          '运行第一项构建操作',
        ));
        await options.onInteraction(approval(
          'approval-write',
          'write_file',
          '运行第二项写入操作',
        ));
        await decided.promise;
        return '两个审批均已处理';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  const turn = bridge.accept(event('approval-start', '发起两个审批'));
  await eventually(() => sent.some(({ text }) => text.includes('运行第一项构建操作')));
  assert.equal(sent.some(({ text }) => text.includes('运行第二项写入操作')), false);
  assert.equal(sent.some(({ text }) => text.includes('approval-build')), false);

  await bridge.accept(event('approval-invalid', '好的'));
  assert.deepEqual(decisions, []);
  assert.deepEqual(asked, [{ sessionId: 'session-approval', text: '发起两个审批' }]);
  assert.match(sent.at(-1).text, /批准/);
  assert.match(sent.at(-1).text, /拒绝/);

  await bridge.accept(event('approval-allow', '批准'));
  assert.deepEqual(decisions, [{
    ok: true,
    value: {
      sessionId: 'session-approval',
      approvalId: 'approval-build',
      outcome: 'allowed-once',
    },
  }]);
  assert.equal(sent.filter(({ text }) => text.includes('运行第二项写入操作')).length, 1);
  assert.equal(sent.some(({ text }) => text.includes('approval-write')), false);

  await bridge.accept(event('approval-reject', '拒绝'));
  await turn;

  assert.deepEqual(decisions, [
    {
      ok: true,
      value: {
        sessionId: 'session-approval',
        approvalId: 'approval-build',
        outcome: 'allowed-once',
      },
    },
    {
      ok: true,
      value: {
        sessionId: 'session-approval',
        approvalId: 'approval-write',
        outcome: 'rejected',
      },
    },
  ]);
  assert.equal(sent.at(-1).text, '两个审批均已处理');
});

test('question replays are deduplicated and an unrenderable approval is safely rejected', async () => {
  const fixture = stateFixture();
  const sent = [];
  let approvalResponse;
  let parallelQuestionResponse;
  const bridge = new FeishuHarnessBridge({
    client: textClient(async (message) => sent.push(message)),
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-replay',
      ask: async (sessionId, _text, options) => {
        const question = {
          kind: 'question',
          interactionId: 'replayed-question',
          rpcId: 'replayed-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'choice', question: '只应显示一次' }],
          },
          respond: async () => ({ accepted: true }),
        };
        await options.onInteraction(question);
        await options.onInteraction(question);
        await options.onInteraction({
          kind: 'question',
          interactionId: 'parallel-question',
          rpcId: 'parallel-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'parallel', question: '不应无声丢弃' }],
          },
          respond: async (result) => {
            parallelQuestionResponse = result;
            return { accepted: true };
          },
        });
        await options.onInteraction({
          kind: 'approval',
          interactionId: 'approval-one',
          rpcId: 'approval-rpc',
          sessionId,
          payload: {
            type: 'approval/requested',
            sessionId,
            approvalId: 'approval-one',
            toolName: 'bash',
          },
          respond: async (result) => {
            approvalResponse = result;
            return { accepted: true };
          },
        });
        await options.onInteractionResolved({
          kind: 'question',
          sessionId,
          interactionId: 'replayed-question',
          outcome: 'cancelled',
        });
        return '交互已取消';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
    logger: { info() {}, warn() {}, error() {} },
  });

  await bridge.accept(event('replay', '测试重放'));

  assert.equal(sent.filter(({ text }) => text.includes('只应显示一次')).length, 1);
  assert.deepEqual(parallelQuestionResponse, {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'Feishu is already handling another user interaction.',
      details: {},
    },
  });
  assert.deepEqual(approvalResponse, {
    ok: true,
    value: {
      sessionId: 'session-replay',
      approvalId: 'approval-one',
      outcome: 'rejected',
    },
  });
  assert.equal(sent.some(({ text }) => text.includes('无法完整展示')), true);
  assert.equal(sent.at(-1).text, '交互已取消');
});

test('a queued next prompt stays separate while a failed interaction response is retried', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-submit-retry']]);
  const sent = [];
  const asked = [];
  const firstSubmitStarted = deferred();
  const releaseFirstSubmit = deferred();
  const answered = deferred();
  const submittedAnswers = [];
  let submitAttempts = 0;
  const bridge = new FeishuHarnessBridge({
    client: textClient(async (message) => sent.push(message)),
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text === '排队的下一个问题') return '第二轮完成';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'submit-retry-question',
          rpcId: 'submit-retry-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'answer', question: '请回答后再继续' }],
          },
          respond: async (result) => {
            submittedAnswers.push(result.value.answer.answers[0].custom);
            submitAttempts += 1;
            if (submitAttempts === 1) {
              firstSubmitStarted.resolve();
              await releaseFirstSubmit.promise;
              throw new Error('temporary response failure');
            }
            answered.resolve();
            return { accepted: true };
          },
        });
        await answered.promise;
        return '第一轮完成';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
    logger: { info() {}, warn() {}, error() {} },
  });

  const first = bridge.accept(event('submit-retry-start', '启动可重试交互'));
  await eventually(() => sent.some(({ text }) => text.includes('请回答后再继续')));
  const firstAnswer = bridge.accept(event('submit-retry-answer', '第一次答案'));
  await firstSubmitStarted.promise;

  let nextSettled = false;
  const next = bridge.accept(event('submit-retry-next', '排队的下一个问题'))
    .finally(() => { nextSettled = true; });
  releaseFirstSubmit.resolve();
  await firstAnswer;
  await eventually(() => sent.some(({ text }) => text.includes('回答提交失败')));
  assert.equal(nextSettled, false);
  assert.deepEqual(asked, ['启动可重试交互']);

  const retry = bridge.accept(event('submit-retry-again', '重试后的答案'));
  await Promise.all([retry, first, next]);

  assert.deepEqual(submittedAnswers, ['第一次答案', '重试后的答案']);
  assert.deepEqual(asked, ['启动可重试交互', '排队的下一个问题']);
  assert.deepEqual(sent.slice(-2).map(({ text }) => text), ['第一轮完成', '第二轮完成']);
});

test('a rich-post pending reply does not block the valid text answer behind it', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-invalid-reply']]);
  const sent = [];
  const invalidNoticeStarted = deferred();
  const releaseInvalidNotice = deferred();
  const answered = deferred();
  let submitted;
  const bridge = new FeishuHarnessBridge({
    client: textClient(async (message) => {
      if (message.text === '请用文字回答当前问题。') {
        invalidNoticeStarted.resolve();
        await releaseInvalidNotice.promise;
      }
      sent.push(message);
    }),
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, _text, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'invalid-reply-question',
          rpcId: 'invalid-reply-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'answer', question: '请给出有效文字答案' }],
          },
          respond: async (result) => {
            submitted = result;
            answered.resolve();
            return { accepted: true };
          },
        });
        await answered.promise;
        return '有效答案已收到';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  const first = bridge.accept(event('invalid-reply-start', '启动交互'));
  await eventually(() => sent.some(({ text }) => text.includes('请给出有效文字答案')));
  const invalid = bridge.accept(event('invalid-reply-post', '', {
    message_type: 'post',
    content: JSON.stringify({
      content: [
        [{ tag: 'text', text: '这不是文字回答' }],
        [{ tag: 'img', image_key: 'img-test' }],
      ],
    }),
  }));
  await invalidNoticeStarted.promise;
  const valid = bridge.accept(event('invalid-reply-valid', '真正的答案'));
  releaseInvalidNotice.resolve();

  await Promise.all([invalid, valid, first]);
  assert.deepEqual(submitted.value.answer.answers, [{
    id: 'answer',
    selected: [],
    custom: '真正的答案',
  }]);
  assert.equal(sent.at(-1).text, '有效答案已收到');
});

test('an answer resolved elsewhere is not reinterpreted as a later prompt', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-resolved-race']]);
  const originalMarkSeen = fixture.state.markSeen;
  const answerMarkStarted = deferred();
  const releaseAnswerMark = deferred();
  fixture.state.markSeen = async (id) => {
    if (id === 'resolved-answer-first') {
      answerMarkStarted.resolve();
      await releaseAnswerMark.promise;
    }
    await originalMarkSeen(id);
  };
  const sent = [];
  const asked = [];
  const resolved = deferred();
  let resolveInteraction;
  const bridge = new FeishuHarnessBridge({
    client: textClient(async (message) => sent.push(message)),
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text === '后来的普通问题') return '后来问题的回答';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'resolved-race-question',
          rpcId: 'resolved-race-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'answer', question: '可能在其他客户端回答' }],
          },
          respond: async () => ({ accepted: true }),
        });
        resolveInteraction = async () => {
          await options.onInteractionResolved({
            kind: 'question',
            interactionId: 'resolved-race-question',
            sessionId,
            outcome: 'answered',
          });
          resolved.resolve();
        };
        await resolved.promise;
        return '第一轮已由其他客户端完成';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  const first = bridge.accept(event('resolved-race-start', '启动外部解决竞态'));
  await eventually(() => typeof resolveInteraction === 'function');
  const answer = bridge.accept(event('resolved-answer-first', '原本的问题答案'));
  await answerMarkStarted.promise;
  const later = bridge.accept(event('resolved-later-second', '后来的普通问题'));
  await resolveInteraction();
  releaseAnswerMark.resolve();

  await Promise.all([answer, first, later]);
  assert.deepEqual(asked, ['启动外部解决竞态', '后来的普通问题']);
  assert.equal(asked.includes('原本的问题答案'), false);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('a late reply to a resolved Feishu question thread is discarded', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-resolved-thread']]);
  const sent = [];
  const asked = [];
  const resolved = deferred();
  let resolveInteraction;
  const bridge = new FeishuHarnessBridge({
    client: textClient(async (message) => sent.push(message)),
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction({
          kind: 'question',
          interactionId: 'resolved-thread-question',
          rpcId: 'resolved-thread-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'late', question: '稍后会在其他客户端回答' }],
          },
          respond: async () => ({ accepted: true }),
        });
        resolveInteraction = async () => {
          await options.onInteractionResolved({
            kind: 'question',
            interactionId: 'resolved-thread-question',
            sessionId,
            outcome: 'answered',
          });
          resolved.resolve();
        };
        await resolved.promise;
        return '已由其他客户端完成';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  const first = bridge.accept(event('resolved-thread-start', '启动线程迟到测试'));
  await eventually(() => typeof resolveInteraction === 'function' && sent.length === 1);
  await resolveInteraction();
  await first;
  await bridge.accept(event('resolved-thread-late', '1', {
    root_id: 'resolved-thread-start',
    parent_id: 'om_test_1',
    thread_id: 'omt_resolved_thread',
  }));

  assert.deepEqual(asked, ['启动线程迟到测试']);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('a question resolved while its next message is in flight tombstones that late thread', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-resolved-inflight']]);
  const sent = [];
  const asked = [];
  const q2SendStarted = deferred();
  const releaseQ2Send = deferred();
  const resolved = deferred();
  let resolveInteraction;
  let nextMessageSequence = 0;
  let q2MessageId;
  const client = {
    im: { v1: { message: { create: async (request) => {
      const messageId = `om_inflight_${++nextMessageSequence}`;
      const outgoing = {
        chatId: request.data.receive_id,
        text: JSON.parse(request.data.content).text,
        messageId,
      };
      sent.push(outgoing);
      if (outgoing.text.includes('在途的第二问')) {
        q2MessageId = messageId;
        q2SendStarted.resolve();
        await releaseQ2Send.promise;
      }
      return { code: 0, data: { message_id: messageId } };
    } } } },
  };
  const bridge = new FeishuHarnessBridge({
    client,
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text !== '启动在途解决竞态') return '迟到回答被错误地当成普通 prompt';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'resolved-inflight-question',
          rpcId: 'resolved-inflight-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [
              { id: 'first', question: '先回答第一问' },
              { id: 'second', question: '在途的第二问' },
            ],
          },
          respond: async () => ({ accepted: true }),
        });
        resolveInteraction = async () => {
          await options.onInteractionResolved({
            kind: 'question',
            interactionId: 'resolved-inflight-question',
            sessionId,
            outcome: 'answered',
          });
          resolved.resolve();
        };
        await resolved.promise;
        return '已在其他客户端完成';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  const first = bridge.accept(event('resolved-inflight-start', '启动在途解决竞态'));
  await eventually(() => typeof resolveInteraction === 'function');
  const firstAnswer = bridge.accept(event('resolved-inflight-first-answer', '第一问答案'));
  await q2SendStarted.promise;
  await resolveInteraction();
  releaseQ2Send.resolve();
  await Promise.all([firstAnswer, first]);

  await bridge.accept(event('resolved-inflight-late-q2-answer', '第二问的迟到答案', {
    root_id: 'resolved-inflight-start',
    parent_id: q2MessageId,
    thread_id: 'omt_resolved_inflight_q2',
  }));

  assert.deepEqual(asked, ['启动在途解决竞态']);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('a q2 thread reply accepted before an in-flight send resolves is discarded after resolution', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-resolved-accepted-inflight']]);
  const sent = [];
  const asked = [];
  const q2Delivered = deferred();
  const releaseQ2Send = deferred();
  const resolved = deferred();
  let resolveInteraction;
  let nextMessageSequence = 0;
  let q2MessageId;
  const client = {
    im: { v1: { message: { create: async (request) => {
      const messageId = `om_accepted_inflight_${++nextMessageSequence}`;
      const outgoing = {
        chatId: request.data.receive_id,
        text: JSON.parse(request.data.content).text,
        messageId,
      };
      sent.push(outgoing);
      if (outgoing.text.includes('已投递但 Promise 未返回的第二问')) {
        q2MessageId = messageId;
        q2Delivered.resolve();
        await releaseQ2Send.promise;
      }
      return { code: 0, data: { message_id: messageId } };
    } } } },
  };
  const bridge = new FeishuHarnessBridge({
    client,
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text !== '启动已接收回复竞态') return '已接收的迟到回复被错误地当成普通 prompt';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'resolved-accepted-inflight-question',
          rpcId: 'resolved-accepted-inflight-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [
              { id: 'first', question: '先完成第一问' },
              { id: 'second', question: '已投递但 Promise 未返回的第二问' },
            ],
          },
          respond: async () => ({ accepted: true }),
        });
        resolveInteraction = async () => {
          await options.onInteractionResolved({
            kind: 'question',
            interactionId: 'resolved-accepted-inflight-question',
            sessionId,
            outcome: 'answered',
          });
          resolved.resolve();
        };
        await resolved.promise;
        return '已在其他客户端完成';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  const first = bridge.accept(event('resolved-accepted-inflight-start', '启动已接收回复竞态'));
  await eventually(() => typeof resolveInteraction === 'function');
  const firstAnswer = bridge.accept(event(
    'resolved-accepted-inflight-first-answer',
    '第一问答案',
  ));
  await q2Delivered.promise;

  // Feishu has delivered q2 and can emit its thread reply, while the SDK
  // message.create Promise observed by the bridge is still pending.
  const alreadyAcceptedReply = bridge.accept(event(
    'resolved-accepted-inflight-q2-answer',
    '第二问的在途答案',
    {
      root_id: 'resolved-accepted-inflight-start',
      parent_id: q2MessageId,
      thread_id: 'omt_resolved_accepted_inflight_q2',
    },
  ));
  await resolveInteraction();
  releaseQ2Send.resolve();
  await Promise.all([alreadyAcceptedReply, firstAnswer, first]);

  assert.deepEqual(asked, ['启动已接收回复竞态']);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('a recovered orphan question is cancelled without exposing its old content', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-orphan-recovery']]);
  const sent = [];
  let recoveredResponse;
  const bridge = new FeishuHarnessBridge({
    client: textClient(async (message) => sent.push(message)),
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, _text, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'orphan-secret-question',
          rpcId: 'orphan-secret-question',
          sessionId,
          recovered: true,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'secret', question: '旧会话中的敏感问题内容' }],
          },
          respond: async (result) => {
            recoveredResponse = result;
            return { accepted: true };
          },
        });
        return '新的消息已继续';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  await bridge.accept(event('orphan-recovery', '新的会话消息'));
  assert.deepEqual(recoveredResponse, {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'Feishu safely cancelled an interaction left by an earlier client.',
      details: {},
    },
  });
  assert.equal(sent.some(({ text }) => text.includes('旧会话中的敏感问题内容')), false);
  assert.equal(sent.some(({ text }) => text.includes('遗留的待回答问题')), true);
  assert.equal(sent.at(-1).text, '新的消息已继续');
});

test('a multi-question interaction keeps ordered canonical answers', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-question-batch']]);
  const sent = [];
  const response = deferred();
  const bridge = new FeishuHarnessBridge({
    client: textClient(async (message) => sent.push(message)),
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, _text, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'batch-question',
          rpcId: 'batch-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [
              {
                id: 'language',
                question: '选择回答语言',
                options: [{ label: '中文' }, { label: 'English' }],
              },
              {
                id: 'deliverables',
                question: '选择交付内容',
                multiSelect: true,
                options: [{ label: '测试' }, { label: '文档' }],
              },
            ],
          },
          respond: async (result) => {
            response.resolve(result);
            return { accepted: true };
          },
        });
        await response.promise;
        return '批量问题已完成';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  const first = bridge.accept(event('batch-start', '请分步提问'));
  await eventually(() => sent.some(({ text }) => (
    text.includes('（1/2）') && text.includes('选择回答语言')
  )));
  await bridge.accept(event('batch-language', '2'));
  await eventually(() => sent.some(({ text }) => (
    text.includes('（2/2）') && text.includes('选择交付内容')
  )));
  await bridge.accept(event('batch-deliverables', '1，文档，发布说明'));

  assert.deepEqual(await response.promise, {
    ok: true,
    value: {
      sessionId: 'session-question-batch',
      answer: {
        answers: [
          { id: 'language', selected: ['English'] },
          { id: 'deliverables', selected: ['测试', '文档'], custom: '发布说明' },
        ],
      },
    },
  });
  await first;
  assert.equal(sent.at(-1).text, '批量问题已完成');
});

test('the second answer bypasses the first answer reaction-finalization window', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-multi-window']]);
  const sent = [];
  const asked = [];
  const firstAnswerDoneStarted = deferred();
  const releaseFirstAnswerDone = deferred();
  const submitted = deferred();
  const releaseTurn = deferred();
  const bridge = new FeishuHarnessBridge({
    client: textClient(async (message) => sent.push(message)),
    channel: {
      addReaction: async (messageId, emojiType) => {
        if (messageId === 'multi-window-first-answer' && emojiType === 'DONE') {
          firstAnswerDoneStarted.resolve();
          await releaseFirstAnswerDone.promise;
        }
        return `reaction-${messageId}-${emojiType}`;
      },
      removeReaction: async () => undefined,
    },
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text !== '启动多问题窗口') return '第二问答案被错误地当成普通 prompt';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'multi-window-question',
          rpcId: 'multi-window-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [
              {
                id: 'first',
                question: '第一问',
                options: [{ label: '甲' }, { label: '乙' }],
              },
              {
                id: 'second',
                question: '第二问',
                options: [{ label: '丙' }, { label: '丁' }],
              },
            ],
          },
          respond: async (result) => {
            submitted.resolve(result);
            releaseTurn.resolve();
            return { accepted: true };
          },
        });
        await releaseTurn.promise;
        return '两个问题均已完成';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  const first = bridge.accept(event('multi-window-start', '启动多问题窗口'));
  await eventually(() => sent.some(({ text }) => text.includes('第一问')));
  const firstAnswer = bridge.accept(event('multi-window-first-answer', '1'));
  await eventually(() => sent.some(({ text }) => text.includes('第二问')));
  await firstAnswerDoneStarted.promise;

  const secondAnswer = bridge.accept(event('multi-window-second-answer', '2'));
  let submittedResult;
  let deadline;
  try {
    submittedResult = await Promise.race([
      submitted.promise,
      new Promise((_, reject) => {
        deadline = setTimeout(
          () => reject(new Error(
            'the second answer deadlocked behind the first answer DONE reaction',
          )),
          500,
        );
      }),
    ]);
  } finally {
    clearTimeout(deadline);
    // Keep the red test from leaving unresolved work behind in the test process.
    releaseFirstAnswerDone.resolve();
    releaseTurn.resolve();
    await Promise.allSettled([firstAnswer, secondAnswer, first]);
  }

  assert.deepEqual(submittedResult, {
    ok: true,
    value: {
      sessionId: 'session-multi-window',
      answer: {
        answers: [
          { id: 'first', selected: ['甲'] },
          { id: 'second', selected: ['丁'] },
        ],
      },
    },
  });
  assert.deepEqual(asked, ['启动多问题窗口']);
  assert.equal(sent.at(-1).text, '两个问题均已完成');
});

test('a group interaction question tells the user to mention the bot again', async () => {
  const fixture = stateFixture([['group:oc_group_mention', 'session-group-mention']]);
  const sent = [];
  const bridge = new FeishuHarnessBridge({
    client: textClient(async (message) => sent.push(message)),
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the group session should already exist'),
      ask: async (sessionId, _text, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'group-mention-question',
          rpcId: 'group-mention-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{
              id: 'environment',
              question: '请选择群聊测试环境',
              options: [{ label: '测试环境' }, { label: '生产环境' }],
            }],
          },
          respond: async () => ({ accepted: true }),
        });
        return '群聊提示测试结束';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_a']),
  });

  await bridge.accept(event('group-mention-start', '@机器人 请先提问', {
    senderOpenId: 'ou_a',
    chat_type: 'group',
    chat_id: 'oc_group_mention',
    mentions: [{ key: '@机器人' }],
  }));

  const questionText = sent.find(({ text }) => text.includes('请选择群聊测试环境'))?.text;
  assert.match(questionText ?? '', /群聊中请\s*@机器人\s*后发送答案/);
});

test('only the actor who started a group interaction can answer it', async () => {
  const fixture = stateFixture([['group:oc_group_actor', 'session-group-actor']]);
  const asked = [];
  const submitted = deferred();
  let interactionSubmitted = false;
  const bridge = new FeishuHarnessBridge({
    client: textClient(async () => undefined),
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the group session should already exist'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text !== '甲发起交互') return '普通群消息已处理';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'group-actor-question',
          rpcId: 'group-actor-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'actor', question: '只能由甲回答' }],
          },
          respond: async (result) => {
            interactionSubmitted = true;
            submitted.resolve(result);
            return { accepted: true };
          },
        });
        await submitted.promise;
        return '甲的交互已完成';
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_a', 'ou_b']),
  });

  const first = bridge.accept(event('group-actor-start', '甲发起交互', {
    senderOpenId: 'ou_a',
    chat_type: 'group',
    chat_id: 'oc_group_actor',
  }));
  await eventually(() => asked.length === 1);
  const intruder = bridge.accept(event('group-actor-b', '乙试图代答', {
    senderOpenId: 'ou_b',
    chat_type: 'group',
    chat_id: 'oc_group_actor',
  }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(interactionSubmitted, false);
  assert.deepEqual(asked, ['甲发起交互']);

  await bridge.accept(event('group-actor-a', '甲的答案', {
    senderOpenId: 'ou_a',
    chat_type: 'group',
    chat_id: 'oc_group_actor',
  }));
  assert.deepEqual((await submitted.promise).value.answer.answers, [{
    id: 'actor',
    selected: [],
    custom: '甲的答案',
  }]);
  await Promise.all([first, intruder]);
  assert.deepEqual(asked, ['甲发起交互', '乙试图代答']);
});

test('aborting an active Feishu turn removes its processing reaction', async () => {
  const fixture = stateFixture([['p2p:ou_user', 'session-abort-reaction']]);
  const controller = new AbortController();
  const reactions = [];
  const removed = [];
  const askStarted = deferred();
  const bridge = new FeishuHarnessBridge({
    client: textClient(async () => undefined),
    channel: {
      addReaction: async (messageId, emojiType) => {
        reactions.push({ messageId, emojiType });
        return `reaction-${emojiType}`;
      },
      removeReaction: async (messageId, reactionId) => removed.push({ messageId, reactionId }),
      stream: async (_chatId, input) => input.markdown({ setContent: async () => undefined }),
    },
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (_sessionId, _text, options) => {
        askStarted.resolve();
        await new Promise((resolve, reject) => {
          if (options.signal.aborted) {
            reject(options.signal.reason);
            return;
          }
          options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        });
      },
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_user']),
    signal: controller.signal,
  });

  const processing = bridge.accept(event('abort-reaction', '启动后停止'));
  await askStarted.promise;
  controller.abort(new DOMException('runtime stopped', 'AbortError'));
  await processing;

  assert.deepEqual(reactions, [{ messageId: 'abort-reaction', emojiType: 'OnIt' }]);
  assert.deepEqual(removed, [{
    messageId: 'abort-reaction',
    reactionId: 'reaction-OnIt',
  }]);
});

test('reaction failures do not block streaming replies', async () => {
  const seen = new Set();
  const status = { messagesReceived: 0, messagesReplied: 0, messagesRejected: 0 };
  const bridge = new FeishuHarnessBridge({
    client: {},
    channel: {
      addReaction: async () => { throw new Error('reaction unavailable'); },
      stream: async (_chatId, input) => input.markdown({ setContent: async () => undefined }),
    },
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, _text, options) => {
        await options.onUpdate({ type: 'tool', name: 'web_search' });
        return '天气结果';
      },
    },
    state: {
      hasSeen: (id) => seen.has(id),
      markSeen: async (id) => seen.add(id),
      sessionFor: () => 'session-existing',
    },
    status,
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  bridge.accept(event('om_reaction_failure', '深圳天气'));
  await bridge.waitForIdle();

  assert.equal(status.messagesReplied, 1);
  assert.equal(status.reactionErrors, 2);
  assert.equal(status.streamResponses, 1);
});

test('a stream finalization failure falls back to text without repeating the prompt', async () => {
  const seen = new Set();
  const sent = [];
  const finalReactions = [];
  let askCount = 0;
  const status = { messagesReceived: 0, messagesReplied: 0, messagesRejected: 0 };
  const bridge = new FeishuHarnessBridge({
    client: {
      im: { v1: { message: { create: async (request) => {
        sent.push(JSON.parse(request.data.content).text);
        return { code: 0 };
      } } } },
    },
    channel: {
      addReaction: async (_messageId, emojiType) => {
        finalReactions.push(emojiType);
        return `reaction-${emojiType}`;
      },
      removeReaction: async () => undefined,
      stream: async (_chatId, input) => {
        await input.markdown({ setContent: async () => undefined });
        throw new Error('card finalization failed');
      },
    },
    harness: {
      sessionExists: async () => true,
      ask: async () => {
        askCount += 1;
        return '已经生成的最终回答';
      },
    },
    state: {
      hasSeen: (id) => seen.has(id),
      markSeen: async (id) => seen.add(id),
      sessionFor: () => 'session-existing',
    },
    status,
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  bridge.accept(event('om_stream_finalize_failure', '不要重复提交'));
  await bridge.waitForIdle();

  assert.equal(askCount, 1);
  assert.deepEqual(sent, ['已经生成的最终回答']);
  assert.deepEqual(finalReactions, ['OnIt', 'DONE']);
  assert.equal(status.messagesReplied, 1);
  assert.equal(status.streamFallbacks, 1);
  assert.equal(status.streamErrors, 1);
});

test('bridge does not expose internal error details in a Feishu failure reply', async () => {
  const sent = [];
  const seen = new Set();
  const status = { messagesReceived: 0, messagesReplied: 0, messagesRejected: 0 };
  const bridge = new FeishuHarnessBridge({
    client: {
      im: { v1: { message: { create: async (request) => {
        sent.push(JSON.parse(request.data.content).text);
        return { code: 0 };
      } } } },
    },
    channel: {
      addReaction: async (_messageId, emojiType) => `reaction-${emojiType}`,
      removeReaction: async () => undefined,
    },
    harness: {
      sessionExists: async () => true,
      ask: async () => {
        throw new Error('secret-shaped-internal-detail /private/path');
      },
    },
    state: {
      hasSeen: (id) => seen.has(id),
      markSeen: async (id) => seen.add(id),
      sessionFor: () => 'session-existing',
    },
    status,
    allowedSenderOpenIds: new Set(['ou_user']),
  });

  bridge.accept(event('om_internal_failure', '触发错误'));
  await bridge.waitForIdle();

  assert.equal(sent.length, 1);
  assert.match(sent[0], /处理失败，请稍后重试/);
  assert.doesNotMatch(sent[0], /secret-shaped-internal-detail|private\/path/);
  assert.equal(status.lastError, 'secret-shaped-internal-detail /private/path');
});

// ── Interactive cards: menus, session lists, workspace lists ───────────────

function cardClient(onSend) {
  let sequence = 0;
  return {
    im: { v1: { message: { create: async (request) => {
      const outgoing = {
        chatId: request.data.receive_id,
        msgType: request.data.msg_type,
        content: request.data.msg_type === 'interactive'
          ? JSON.parse(request.data.content)
          : request.data.content,
      };
      await onSend(outgoing);
      sequence += 1;
      return { code: 0, data: { message_id: `om_card_${sequence}` } };
    } } } },
  };
}

function cardActionEvent(messageId, action, operatorOpenId) {
  return {
    operator: { open_id: operatorOpenId },
    action: { value: { action } },
    context: { open_message_id: messageId },
  };
}

function buttonsFromCard(content) {
  const buttons = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (value.tag === 'button') buttons.push(value);
    for (const child of Object.values(value)) visit(child);
  };
  visit(content.body?.elements);
  return buttons;
}

function callbackAction(button) {
  return button.behaviors?.find((behavior) => behavior?.type === 'callback')?.value?.action;
}

function useActionsFromCard(content) {
  return buttonsFromCard(content)
    .map(callbackAction)
    .filter((action) => typeof action === 'string' && action.startsWith('use:'))
    .map((action) => action.slice('use:'.length));
}

function sessionsHarness(count) {
  const workspace = join(tmpdir(), 'dsh-im-card-test-work');
  mkdirSync(workspace, { recursive: true });
  const sessions = Array.from({ length: count }, (_, index) => ({
    sessionId: `session-${String(index + 1).padStart(2, '0')}`,
    title: `Session ${index + 1}`,
  }));
  return {
    ensureRunning: async () => true,
    currentWorkspace: () => workspace,
    listWorkspaceSessions: async () => ({ workspace, sessions }),
    listWorkspaces: async () => [workspace],
    bindWorkspaceSession: async (_key, sessionId) => ({ sessionId, title: `Session ${sessionId}` }),
    switchWorkspace: async (path) => path,
  };
}

test('card buttons from an unallowed sender are ignored', async () => {
  const fixture = stateFixture();
  const sent = [];
  const bridge = new FeishuHarnessBridge({
    client: cardClient(async ({ chatId, msgType, content }) => {
      sent.push({ chatId, msgType, content });
    }),
    channel: {},
    harness: sessionsHarness(3),
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_owner']),
  });

  await bridge.accept(event('menu-open', '/m', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  assert.equal(sent.length, 1);
  assert.equal(fixture.sessions.size, 0);

  // A group member outside the allowlist clicks "new session" on the card.
  await bridge.onCardAction(cardActionEvent('om_card_1', 'new', 'ou_evil'));
  await bridge.waitForIdle();
  assert.equal(fixture.sessions.size, 0, 'unallowed card operator must not act');

  await bridge.onCardAction({
    action: { value: { action: 'new' } },
    context: { open_message_id: 'om_card_1' },
  });
  await bridge.waitForIdle();
  assert.equal(sent.length, 1, 'a card action without an operator must fail closed');
});

test('card buttons from an allowed sender work', async () => {
  const fixture = stateFixture();
  const sent = [];
  const bridge = new FeishuHarnessBridge({
    client: cardClient(async ({ chatId, msgType, content }) => {
      sent.push({ chatId, msgType, content });
    }),
    channel: {},
    harness: sessionsHarness(3),
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_owner']),
  });

  await bridge.accept(event('menu-open-2', '/m', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  assert.equal(sent.length, 1);

  await bridge.onCardAction(cardActionEvent('om_card_1', 'new', 'ou_owner'));
  await bridge.waitForIdle();
  assert.equal(sent.length, 2, 'allowed operator click should send a reply');
});

test('card buttons honor the wildcard sender allowlist', async () => {
  const fixture = stateFixture();
  const sent = [];
  const bridge = new FeishuHarnessBridge({
    client: cardClient(async (outgoing) => sent.push(outgoing)),
    channel: {},
    harness: sessionsHarness(3),
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['*']),
  });

  await bridge.accept(event('menu-open-wildcard', '/m', { senderOpenId: 'ou_any_user' }));
  await bridge.waitForIdle();
  await bridge.onCardAction(cardActionEvent('om_card_1', 'status', 'ou_another_user'));
  await bridge.waitForIdle();

  assert.equal(sent.length, 2, 'wildcard access must apply to card callbacks too');
});

function cards(messages) { return messages.filter((m) => m.msgType === 'interactive'); }

test('session list paginates by page number across 25 sessions', async () => {
  const fixture = stateFixture();
  const sent = [];
  const bridge = new FeishuHarnessBridge({
    client: cardClient(async ({ chatId, msgType, content }) => {
      sent.push({ chatId, msgType, content });
    }),
    channel: {},
    harness: sessionsHarness(25),
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_owner']),
  });

  await bridge.accept(event('sessions-open', '/sessionlist', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  assert.equal(cards(sent).length, 1);
  const page0 = cards(sent).at(-1).content;
  const firstLayout = page0.body.elements.find((element) => element.tag === 'column_set');
  const firstButton = firstLayout?.columns?.[0]?.elements?.[0];
  assert.equal(firstButton?.tag, 'button');
  assert.equal(Object.hasOwn(firstButton, 'value'), false, 'V2 buttons must not use the legacy value field');
  assert.equal(callbackAction(firstButton), 'use:session-01');
  assert.equal(useActionsFromCard(page0).length, 10);
  assert.equal(useActionsFromCard(page0)[0], 'session-01');

  // Button on page 0 asks for page 2 (zero-based page number).
  await bridge.onCardAction(cardActionEvent('om_card_1', 'sessions:2', 'ou_owner'));
  await bridge.waitForIdle();
  const page2 = cards(sent).at(-1).content;
  assert.equal(useActionsFromCard(page2).length, 5);
  assert.equal(useActionsFromCard(page2)[0], 'session-21', 'page 2 must start at the 21st session (no double page scaling)');

  await bridge.onCardAction(cardActionEvent('om_card_2', 'sessions:1', 'ou_owner'));
  await bridge.waitForIdle();
  const page1 = cards(sent).at(-1).content;
  assert.equal(useActionsFromCard(page1).length, 10);
  assert.equal(useActionsFromCard(page1)[0], 'session-11');
});

test('number replies on a later session page use page-local labels', async () => {
  const fixture = stateFixture();
  const sent = [];
  const bridge = new FeishuHarnessBridge({
    client: cardClient(async (outgoing) => sent.push(outgoing)),
    channel: {},
    harness: sessionsHarness(25),
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_owner']),
  });

  await bridge.accept(event('sessions-number-open', '/sessionlist', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  await bridge.onCardAction(cardActionEvent('om_card_1', 'sessions:2', 'ou_owner'));
  await bridge.waitForIdle();

  const page2Buttons = buttonsFromCard(cards(sent).at(-1).content);
  assert.match(page2Buttons[0].text.content, /^1\. Session 21$/);

  await bridge.accept(event('sessions-number-pick', '1', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  assert.match(JSON.parse(sent.at(-1).content).text, /ID：session-21/);
});

test('session pagination preserves an explicitly selected workspace', async () => {
  const fixture = stateFixture();
  const sent = [];
  const workspaceARaw = join(tmpdir(), `dsh-im-card-current-${process.pid}`);
  const workspaceBRaw = join(tmpdir(), `dsh-im-card-selected-${process.pid}`);
  mkdirSync(workspaceARaw, { recursive: true });
  mkdirSync(workspaceBRaw, { recursive: true });
  const workspaceA = realpathSync(workspaceARaw);
  const workspaceB = realpathSync(workspaceBRaw);
  const sessionSet = (prefix) => Array.from({ length: 25 }, (_, index) => ({
    sessionId: `${prefix}-${String(index + 1).padStart(2, '0')}`,
    title: `${prefix} Session ${index + 1}`,
  }));
  const bridge = new FeishuHarnessBridge({
    client: cardClient(async (outgoing) => sent.push(outgoing)),
    channel: {},
    harness: {
      ensureRunning: async () => true,
      currentWorkspace: () => workspaceA,
      listWorkspaces: async () => [workspaceA, workspaceB],
      listWorkspaceSessions: async (workspace) => ({
        workspace,
        sessions: workspace === workspaceB ? sessionSet('selected') : sessionSet('current'),
      }),
      bindWorkspaceSession: async (_key, sessionId) => ({ sessionId, title: sessionId }),
      switchWorkspace: async (path) => path,
    },
    state: fixture.state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_owner']),
  });

  await bridge.accept(event('selected-workspace-open', '/sessionlist 2', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  assert.equal(useActionsFromCard(cards(sent).at(-1).content)[0], 'selected-01');

  await bridge.onCardAction(cardActionEvent('om_card_1', 'sessions:1', 'ou_owner'));
  await bridge.waitForIdle();
  assert.equal(useActionsFromCard(cards(sent).at(-1).content)[0], 'selected-11');
  assert.match(JSON.stringify(cards(sent).at(-1).content), new RegExp(workspaceB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

const REPAIR_APP_ID = 'cli_repair_test';
const REPAIR_BOT_ID = 'bot_repair_test';
const REPAIR_URL = `https://open.feishu.cn/page/launcher?tp=sdk&clientID=${REPAIR_APP_ID}&addons=safe`;

function repairStatus(state = 'qr_ready', overrides = {}) {
  return {
    registration: {
      operation: 'callback_repair',
      state,
      attempt: 'repair_attempt_1',
      botId: REPAIR_BOT_ID,
      qrCodeUrl: REPAIR_URL,
      expiresAt: Date.now() + 60_000,
      remainingSeconds: 60,
      ...overrides,
    },
  };
}

function repairCapability({
  startStatus = repairStatus(),
  status = startStatus,
  cancelStatus = repairStatus('cancelled', { qrCodeUrl: undefined }),
} = {}) {
  const calls = { start: [], status: [], cancel: [] };
  return {
    calls,
    capability: {
      async start(args) { calls.start.push(args); return startStatus; },
      async status(args) {
        calls.status.push(args);
        return typeof status === 'function' ? status(calls.status.length) : status;
      },
      async cancel(args) {
        calls.cancel.push(args);
        return typeof cancelStatus === 'function'
          ? cancelStatus(calls.cancel.length)
          : cancelStatus;
      },
    },
  };
}

function repairBridge({
  allowedSenderOpenIds = new Set(['ou_owner']),
  repairOwnerOpenIds,
  capability,
  client,
  sent = [],
} = {}) {
  const fixture = stateFixture();
  let asks = 0;
  const activeClient = client ?? cardClient(async (outgoing) => sent.push(outgoing));
  return {
    fixture,
    sent,
    get asks() { return asks; },
    bridge: new FeishuHarnessBridge({
      client: activeClient,
      channel: {},
      harness: {
        ensureRunning: async () => true,
        ask: async () => { asks += 1; return 'unexpected'; },
      },
      state: fixture.state,
      status: bridgeStatus(),
      allowedSenderOpenIds,
      repairOwnerOpenIds,
      botId: REPAIR_BOT_ID,
      appId: REPAIR_APP_ID,
      repair: capability,
      repairPollIntervalMs: 5,
      repairLinkWaitMs: 100,
    }),
  };
}

test('/repair sends a validated ordinary SDK link without prompting Harness', async () => {
  const repair = repairCapability();
  const fx = repairBridge({ capability: repair.capability });

  await fx.bridge.accept(event('repair-start', '/repair', { senderOpenId: 'ou_owner' }));
  await fx.bridge.waitForIdle();

  assert.equal(repair.calls.start.length, 1);
  assert.deepEqual(repair.calls.start[0], {
    botId: REPAIR_BOT_ID,
    actorOpenId: 'ou_owner',
    chatId: 'oc_chat',
  });
  assert.equal(fx.asks, 0);
  const message = JSON.parse(fx.sent.at(-1).content).text;
  assert.match(message, /card\.action\.trigger/);
  assert.match(message, new RegExp(REPAIR_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(message, /\/repair qr/);
});

test('/repair status after a runtime restart never starts a duplicate authorization', async () => {
  const repair = repairCapability();
  const fx = repairBridge({ capability: repair.capability });

  await fx.bridge.accept(event('repair-restarted-status', '/repair status', {
    senderOpenId: 'ou_owner',
  }));
  await fx.bridge.waitForIdle();

  assert.equal(repair.calls.start.length, 0);
  assert.equal(repair.calls.status.length, 0);
  assert.equal(repair.calls.cancel.length, 0);
  const message = JSON.parse(fx.sent.at(-1).content).text;
  assert.match(message, /没有可恢复的修复任务记录/);
  assert.match(message, /不会启动新的授权/);
});

test('menu repair entry is number-only and reply 6 starts the same repair flow', async () => {
  const repair = repairCapability();
  const fx = repairBridge({ capability: repair.capability });

  await fx.bridge.accept(event('repair-menu-open', '/m', { senderOpenId: 'ou_owner' }));
  await fx.bridge.waitForIdle();
  const menu = cards(fx.sent)[0].content;
  assert.match(JSON.stringify(menu), /6 · 修复卡片按钮/);
  assert.equal(buttonsFromCard(menu).some((button) => callbackAction(button) === 'repair'), false);

  await fx.bridge.accept(event('repair-menu-six', '6', { senderOpenId: 'ou_owner' }));
  await fx.bridge.waitForIdle();
  assert.equal(repair.calls.start.length, 1);
  assert.equal(fx.asks, 0);
  assert.match(JSON.parse(fx.sent.at(-1).content).text, /card\.action\.trigger/);
});

test('chat repair requires a private chat and an exact owner; wildcard never authorizes it', async () => {
  const wildcardRepair = repairCapability();
  const wildcard = repairBridge({
    allowedSenderOpenIds: new Set(['*']),
    capability: wildcardRepair.capability,
  });
  await wildcard.bridge.accept(event('repair-wildcard', '/repair', { senderOpenId: 'ou_anyone' }));
  await wildcard.bridge.waitForIdle();
  assert.equal(wildcardRepair.calls.start.length, 0);
  assert.match(JSON.parse(wildcard.sent.at(-1).content).text, /没有可验证的接入者身份/);

  const mixedRepair = repairCapability();
  const mixed = repairBridge({
    allowedSenderOpenIds: new Set(['*', 'ou_owner']),
    capability: mixedRepair.capability,
  });
  await mixed.bridge.accept(event('repair-mixed-intruder', '/repair', { senderOpenId: 'ou_other' }));
  await mixed.bridge.waitForIdle();
  assert.equal(mixedRepair.calls.start.length, 0);
  assert.match(JSON.parse(mixed.sent.at(-1).content).text, /只能由机器人接入者/);
  await mixed.bridge.accept(event('repair-mixed-owner', '/repair', { senderOpenId: 'ou_owner' }));
  await mixed.bridge.waitForIdle();
  assert.equal(mixedRepair.calls.start.length, 1);

  const groupRepair = repairCapability();
  const group = repairBridge({ capability: groupRepair.capability });
  await group.bridge.accept(event('repair-group', '/repair', {
    senderOpenId: 'ou_owner',
    chat_type: 'group',
    chat_id: 'oc_group',
  }));
  await group.bridge.waitForIdle();
  assert.equal(groupRepair.calls.start.length, 0);
  assert.match(JSON.parse(group.sent.at(-1).content).text, /请私聊机器人/);
});

test('/repair qr, status, verify and cancel stay scoped to the initiating owner', async () => {
  const sent = [];
  let sequence = 0;
  const client = {
    im: { v1: {
      image: { create: async ({ data }) => {
        assert.equal(data.image_type, 'message');
        assert.equal(Buffer.isBuffer(data.image), true);
        return { image_key: 'img_repair_qr' };
      } },
      message: { create: async (request) => {
        sent.push(request);
        sequence += 1;
        return { code: 0, data: { message_id: `om_repair_${sequence}` } };
      } },
    } },
  };
  const repair = repairCapability();
  const fx = repairBridge({ capability: repair.capability, client, sent });

  await fx.bridge.accept(event('repair-commands-start', '/repair', { senderOpenId: 'ou_owner' }));
  await fx.bridge.waitForIdle();
  await fx.bridge.accept(event('repair-commands-qr', '/repair qr', { senderOpenId: 'ou_owner' }));
  await fx.bridge.waitForIdle();
  assert.equal(sent.some((request) => request.data.msg_type === 'image'
    && JSON.parse(request.data.content).image_key === 'img_repair_qr'), true);

  await fx.bridge.accept(event('repair-commands-status', '/repair status', { senderOpenId: 'ou_owner' }));
  await fx.bridge.accept(event('repair-commands-verify', '/repair verify', { senderOpenId: 'ou_owner' }));
  await fx.bridge.waitForIdle();
  const textMessages = sent
    .filter((request) => request.data.msg_type === 'text')
    .map((request) => JSON.parse(request.data.content).text);
  assert.equal(textMessages.some((text) => text.includes('修复任务正在等待授权')), true);
  assert.equal(textMessages.some((text) => text.includes('授权尚未完成')), true);

  await fx.bridge.accept(event('repair-commands-cancel', '/repair cancel', { senderOpenId: 'ou_owner' }));
  await fx.bridge.waitForIdle();
  assert.equal(repair.calls.cancel.length, 1);
  assert.equal(repair.calls.cancel[0].actorOpenId, 'ou_owner');
});

test('/repair cancel only reports cancellation when the controller confirms it', async () => {
  for (const state of ['saving', 'succeeded']) {
    const repair = repairCapability({
      cancelStatus: repairStatus(state, { qrCodeUrl: undefined }),
      status: repairStatus(state, { qrCodeUrl: undefined }),
    });
    const fx = repairBridge({ capability: repair.capability });
    await fx.bridge.accept(event(`repair-cancel-${state}-start`, '/repair', {
      senderOpenId: 'ou_owner',
    }));
    await fx.bridge.waitForIdle();
    await fx.bridge.accept(event(`repair-cancel-${state}`, '/repair cancel', {
      senderOpenId: 'ou_owner',
    }));
    await fx.bridge.waitForIdle();

    const reply = JSON.parse(fx.sent.at(-1).content).text;
    assert.doesNotMatch(reply, /已取消本次修复授权/);
    assert.match(reply, state === 'saving' ? /正在等待专用测试按钮/ : /修复完成/);
    await eventually(() => repair.calls.status.length > 0);
  }
});

test('/repair rejects placeholder or mismatched launcher links and cancels the attempt', async () => {
  for (const badUrl of [
    'https://open.feishu.cn/page/launcher?tp=sdk&clientID=%7B%7Bclient_id%7D%7D',
    'https://open.feishu.cn/page/launcher?tp=sdk&clientID=cli_other_app',
    `https://open.feishu.cn/page/launcher?tp=card&clientID=${REPAIR_APP_ID}`,
  ]) {
    const repair = repairCapability({
      startStatus: repairStatus('qr_ready', { qrCodeUrl: badUrl }),
    });
    const fx = repairBridge({ capability: repair.capability });
    await fx.bridge.accept(event(`repair-bad-${repair.calls.start.length}-${badUrl.length}`, '/repair', {
      senderOpenId: 'ou_owner',
    }));
    await fx.bridge.waitForIdle();
    assert.equal(repair.calls.cancel.length, 1);
    const text = JSON.parse(fx.sent.at(-1).content).text;
    assert.match(text, /无法安全验证/);
    assert.doesNotMatch(text, /\{\{client_id\}\}|cli_other_app/);
  }
});

test('repair monitor reports expiry without claiming that the callback was fixed', async () => {
  const repair = repairCapability({
    status: repairStatus('expired', {
      qrCodeUrl: undefined,
      remainingSeconds: 0,
      error: { code: 'expired_token', message: 'safe' },
    }),
  });
  const fx = repairBridge({ capability: repair.capability });
  await fx.bridge.accept(event('repair-expiry', '/repair', { senderOpenId: 'ou_owner' }));
  await fx.bridge.waitForIdle();
  await eventually(() => fx.sent.some((outgoing) => (
    outgoing.msgType === 'text'
      && JSON.parse(outgoing.content).text.includes('授权链接已过期')
  )));
  const terminal = fx.sent
    .filter((outgoing) => outgoing.msgType === 'text')
    .map((outgoing) => JSON.parse(outgoing.content).text)
    .find((text) => text.includes('授权链接已过期'));
  assert.doesNotMatch(terminal, /修复完成/);
});

// ── Watches: read-only tracking, persistence, compensation, dedup ─────────

import { StateStore } from '../../../src/channels/feishu/state-store.mjs';

function watchHarness({ sessionsByWorkspace = { 'C:/work': [] }, current = 'C:/work', history = [] } = {}) {
  const listeners = [];
  return {
    ensureRunning: async () => true,
    currentWorkspace: () => current,
    listWorkspaces: async () => Object.keys(sessionsByWorkspace),
    listWorkspaceSessions: async (workspace) => ({ workspace, sessions: sessionsByWorkspace[workspace] ?? [] }),
    bindWorkspaceSession: async (_key, sessionId) => ({ sessionId, title: `Title ${sessionId}` }),
    switchWorkspace: async (path) => path,
    rpc: async (method, params) => (method === 'session.history' ? { events: history } : null),
    watchHarnessEvents: ({ onSessionEvent, onReconnect }) => {
      listeners.push({ onSessionEvent, onReconnect });
      return Promise.resolve();
    },
    _listeners: listeners,
  };
}

async function watchStoreFixture(seedSessions = []) {
  const store = new StateStore(join(tmpdir(), `dsh-im-watch-test-${Math.random().toString(36).slice(2)}.json`));
  await store.load();
  for (const [key, sessionId] of seedSessions) await store.setSession(key, sessionId);
  return { store, state: store };
}

test('/watch resolves read-only: no binding, no workspace switch', async () => {
  const { state } = await watchStoreFixture([['p2p:ou_owner', 'bound-session']]);
  let bindCalls = 0;
  let switchCalls = 0;
  const harness = watchHarness({
    sessionsByWorkspace: { 'C:/work': [{ sessionId: 'target-session', title: 'Target' }] },
  });
  harness.bindWorkspaceSession = async () => { bindCalls += 1; throw new Error('must not bind'); };
  harness.switchWorkspace = async () => { switchCalls += 1; throw new Error('must not switch'); };
  const sent = [];
  const bridge = new FeishuHarnessBridge({
    client: textClient(async ({ text }) => sent.push(text)),
    channel: {},
    harness,
    state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_owner']),
  });

  await bridge.accept(event('watch-1', '/watch 1', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  assert.match(sent.at(-1), /已关注会话「Target」/);
  assert.equal(bindCalls, 0, 'watch must not bind the conversation');
  assert.equal(switchCalls, 0, 'watch must not switch workspaces');
  assert.equal(state.sessionFor('p2p:ou_owner'), 'bound-session', 'existing binding unchanged');
  const entry = state.watchEntry('p2p:ou_owner', 'target-session');
  assert.ok(entry, 'watch entry persisted');
  assert.equal(entry.chatId, 'oc_chat');
});

test('/watch finds a session in another workspace without switching', async () => {
  const { state } = await watchStoreFixture();
  const harness = watchHarness({
    current: 'C:/work',
    sessionsByWorkspace: {
      'C:/work': [],
      'D:/other': [{ sessionId: 'other-session', title: 'Other Session' }],
    },
  });
  const sent = [];
  const bridge = new FeishuHarnessBridge({
    client: textClient(async ({ text }) => sent.push(text)),
    channel: {},
    harness,
    state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_owner']),
  });

  await bridge.accept(event('watch-x', '/watch other-session', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  assert.match(sent.at(-1), /已关注会话「Other Session」/);
  assert.equal(state.sessionFor('p2p:ou_owner'), null, 'cross-workspace watch must not bind');
  assert.ok(state.watchEntry('p2p:ou_owner', 'other-session'));
});

test('persisted watches resume the event watcher at runtime start', async () => {
  const { state } = await watchStoreFixture();
  await state.setWatch('p2p:ou_owner', { sessionId: 'kept-session', title: 'Kept', chatId: 'oc_chat', lastSeq: 3 });
  const harness = watchHarness();

  const bridge = new FeishuHarnessBridge({
    client: textClient(async () => {}),
    channel: {},
    harness,
    state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_owner']),
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(harness._listeners.length, 1, 'watcher must restart from persisted state');
  assert.ok(bridge);
});

test('reconnect compensation replays missed turn/end and dedups duplicates', async () => {
  const { state } = await watchStoreFixture();
  await state.setWatch('p2p:ou_owner', { sessionId: 'watched-session', title: 'Watched', chatId: 'oc_chat', lastSeq: null });
  const harness = watchHarness({
    sessionsByWorkspace: { 'C:/work': [{ sessionId: 'watched-session', title: 'Watched' }] },
    history: [
      { type: 'turn/end', seq: 10, data: { turn: 't1', reason: { kind: 'completed' } } },
      { type: 'turn/end', seq: 11, data: { turn: 't2', reason: { kind: 'completed' } } },
    ],
  });
  const cards = [];
  const bridge = new FeishuHarnessBridge({
    client: cardClient(async ({ msgType, content }) => {
      if (msgType === 'interactive') cards.push(content);
    }),
    channel: {},
    harness,
    state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_owner']),
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(harness._listeners.length, 1);

  // Live event: t1 arrives before any replay.
  harness._listeners[0].onSessionEvent({ sessionId: 'watched-session', event: { type: 'turn/end', seq: 10, data: { turn: 't1', reason: { kind: 'completed' } } } });
  await bridge.waitForIdle();
  assert.equal(cards.length, 1, 'one completion for the live event');

  // Reconnect: history replays t1 (dedup) and t2 (new).
  await harness._listeners[0].onReconnect();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cards.length, 2, 'exactly one new completion from compensation (t1 deduped)');
  assert.match(JSON.stringify(cards[1]), /watched-session/);
});

test('archived sessions are hidden by default; /archived on reveals them', async () => {
  const { state } = await watchStoreFixture();
  const work = join(tmpdir(), 'dsh-im-archived-test-work');
  mkdirSync(work, { recursive: true });
  const harness = watchHarness({
    current: work,
    sessionsByWorkspace: {
      [work]: [
        { sessionId: 'live-session', title: 'Live', archived: false },
        { sessionId: 'old-session', title: 'Old', archived: true },
      ],
    },
  });
  const sent = [];
  const cards = [];
  const bridge = new FeishuHarnessBridge({
    client: cardClient(async ({ msgType, content }) => {
      if (msgType === 'interactive') cards.push(content);
    }),
    channel: {},
    harness,
    state,
    status: bridgeStatus(),
    allowedSenderOpenIds: new Set(['ou_owner']),
  });
  bridge._sent = sent;

  // Default: hidden. The explicit toggle re-enables inclusion for the card check.
  assert.equal(state.includesArchivedSessions(), false);

  await bridge.accept(event('sessions-arch', '/sessionlist', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  const use = useActionsFromCard(cards.at(-1));
  assert.deepEqual(use, ['live-session'], 'archived session hidden');

  // The numeric watch index must resolve against the filtered list too.
  await bridge.accept(event('watch-arch', '/watch 1', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  assert.ok(state.watchEntry('p2p:ou_owner', 'live-session'));
  assert.equal(state.watchEntry('p2p:ou_owner', 'old-session'), null);

  await bridge.accept(event('archived-on', '/archived on', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  await bridge.accept(event('sessions-arch-2', '/sessionlist', { senderOpenId: 'ou_owner' }));
  await bridge.waitForIdle();
  const useOn = useActionsFromCard(cards.at(-1));
  assert.deepEqual(useOn, ['live-session', 'old-session'], '/archived on restores archived sessions');
});
