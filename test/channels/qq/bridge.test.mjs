import assert from 'node:assert/strict';
import test from 'node:test';

import { QqHarnessBridge } from '../../../src/channels/qq/qq-bridge.mjs';
import { connectionTestTarget } from '../../../src/channels/shared/connection-test.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function eventually(predicate, messageText = 'condition was not met') {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(messageText);
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

function message(overrides = {}) {
  return {
    kind: 'c2c',
    rawEventType: 'C2C_MESSAGE_CREATE',
    senderId: 'owner-openid',
    senderIsBot: false,
    content: '请回答',
    messageId: 'msg-1',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'msg-1' },
    ...overrides,
  };
}

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x00,
]);

test('QQ sends image-only attachments to Harness and accepts the SDK file MIME fallback', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-image']]);
  const prompts = [];
  const downloads = [];
  const sent = [];
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (_target, text) => sent.push(text) },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, content) => {
        prompts.push({ sessionId, content });
        return '看到图片了';
      },
    },
    state: fixture.state,
    fetchImpl: async (url, init) => {
      downloads.push({ url: url.toString(), init });
      return new Response(PNG_BYTES, { headers: { 'content-type': 'application/octet-stream' } });
    },
  });

  await bridge.accept(message({
    messageId: 'qq-image',
    content: '',
    attachments: [{
      content_type: 'file',
      filename: 'diagram.PNG',
      size: PNG_BYTES.length,
      url: 'https://multimedia.nt.qq.com.cn/download/opaque',
    }],
  }));

  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].init.method, 'GET');
  assert.equal(downloads[0].init.redirect, 'manual');
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].sessionId, 'session-image');
  assert.deepEqual(prompts[0].content.map(({ type }) => type), ['text', 'image']);
  assert.equal(prompts[0].content[0].text, '请分析这张图片。');
  assert.equal(prompts[0].content[1].mediaType, 'image/png');
  assert.equal(prompts[0].content[1].name, 'diagram.PNG');
  assert.equal(Buffer.from(prompts[0].content[1].data, 'base64').equals(PNG_BYTES), true);
  assert.deepEqual(sent, ['看到图片了']);
  assert.equal(fixture.seen.has('qq-image'), true);
});

test('QQ checks sender and group mention before downloading image attachments', async () => {
  let downloads = 0;
  let asks = 0;
  const bridge = new QqHarnessBridge({
    bot: { sendText: async () => {} },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      ask: async () => { asks += 1; return 'unexpected'; },
    },
    state: stateFixture().state,
    fetchImpl: async () => { downloads += 1; return new Response(PNG_BYTES); },
  });
  const attachment = {
    content_type: 'image/png',
    filename: 'private.png',
    url: 'https://multimedia.nt.qq.com.cn/download/private',
  };

  await bridge.accept(message({
    messageId: 'qq-image-other',
    senderId: 'other-openid',
    content: '',
    attachments: [attachment],
  }));
  await bridge.accept(message({
    kind: 'group',
    rawEventType: 'GROUP_MESSAGE_CREATE',
    groupOpenid: 'group-1',
    messageId: 'qq-image-unmentioned',
    content: '',
    attachments: [attachment],
    replyTarget: { scope: 'group', targetId: 'group-1', msgId: 'qq-image-unmentioned' },
  }));

  assert.equal(downloads, 0);
  assert.equal(asks, 0);
});

test('QQ rejects non-platform image URLs without fetching and returns a retryable image error', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-image']]);
  const sent = [];
  let downloads = 0;
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (_target, text) => sent.push(text) },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      ask: async () => assert.fail('an untrusted image must not reach Harness'),
    },
    state: fixture.state,
    logger: { error() {} },
    fetchImpl: async () => { downloads += 1; return new Response(PNG_BYTES); },
  });

  await bridge.accept(message({
    messageId: 'qq-image-untrusted',
    content: '这是什么',
    attachments: [{
      content_type: 'image/png',
      filename: 'photo.png',
      url: 'https://attacker.example/photo.png',
    }],
  }));

  assert.equal(downloads, 0);
  assert.deepEqual(sent, ['图片下载失败，请重新发送后再试。']);
  assert.equal(fixture.seen.has('qq-image-untrusted'), true);
});

test('QQ does not use an image caption as a pending Harness answer', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-question-image']]);
  const sent = [];
  const answered = deferred();
  let submitted;
  let downloads = 0;
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (_target, text) => sent.push(text) },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      async ask(sessionId, _text, options) {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-question-image',
          rpcId: 'qq-question-image',
          sessionId,
          payload: {
            questions: [{
              id: 'environment',
              question: '请选择环境',
              options: [{ label: '生产环境' }],
            }],
          },
          async respond(result) {
            submitted = result;
            answered.resolve();
            return { accepted: true };
          },
        });
        await answered.promise;
        return '已完成';
      },
    },
    state: fixture.state,
    fetchImpl: async () => { downloads += 1; return new Response(PNG_BYTES); },
  });

  const first = bridge.accept(message({ messageId: 'qq-question-start', content: '开始提问' }));
  await eventually(() => sent.some((text) => text.includes('请选择环境')));
  await bridge.accept(message({
    messageId: 'qq-question-image-answer',
    content: '生产环境',
    attachments: [{
      content_type: 'image/png',
      filename: 'answer.png',
      url: 'https://multimedia.nt.qq.com.cn/download/answer',
    }],
  }));
  assert.equal(downloads, 0);
  assert.equal(submitted, undefined);
  assert.equal(sent.at(-1), '请用文字回答当前问题。');

  await bridge.accept(message({ messageId: 'qq-question-text-answer', content: '生产环境' }));
  await first;
  assert.deepEqual(submitted.value.answer.answers, [{
    id: 'environment',
    selected: ['生产环境'],
  }]);
});

test('QQ executes /compact for the bound Session without prompting the model', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-compact']]);
  const sent = [];
  const executed = [];
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (_target, text) => sent.push(text) },
    ownerUserOpenid: 'owner-openid',
    harness: {
      executeCommand: async (sessionId, line) => {
        executed.push({ sessionId, line });
        return { commandId: 'compact-qq', result: { kind: 'success', text: 'Compacted 3 history items (~900 tokens).' } };
      },
      ask: async () => assert.fail('/compact must not be submitted to the model'),
    },
    state: fixture.state,
  });

  await bridge.accept(message({ messageId: 'compact-qq', content: '/compact' }));

  assert.deepEqual(executed, [{ sessionId: 'session-compact', line: '/compact' }]);
  assert.deepEqual(sent, ['已压缩 3 条历史记录（约 900 个 token）。']);
  assert.equal(fixture.seen.has('compact-qq'), true);
});

test('QQ lists models without prompting and help advertises all four commands', async () => {
  const fixture = stateFixture();
  const sent = [];
  let asks = 0;
  let creates = 0;
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (_target, text) => sent.push(text) },
    ownerUserOpenid: 'owner-openid',
    harness: {
      listModels: async () => ({
        groups: [{
          id: 'qq-provider',
          name: 'QQ Provider',
          models: [{ id: 'model-one', name: 'Model One' }],
        }],
        failures: [],
      }),
      createSession: async () => { creates += 1; return 'qq-session'; },
      ask: async () => { asks += 1; return 'unexpected model reply'; },
    },
    state: fixture.state,
  });

  await bridge.accept(message({ messageId: 'models-qq', content: '/models' }));
  assert.match(sent.at(-1), /1\. qq-provider\/model-one/);
  assert.equal(asks, 0);
  assert.equal(creates, 0);
  assert.equal(fixture.sessions.size, 0);

  await bridge.accept(message({ messageId: 'help-models-qq', content: '/help' }));
  const help = sent.at(-1);
  for (const command of ['/models', '/model', '/stop', '/steer']) {
    assert.equal(help.includes(command), true, command);
  }
  assert.match(help, /\/model 2/);
});

test('QQ remembers any authorized private inbound as a connection-test target', async () => {
  const fixture = stateFixture();
  const sent = [];
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    ownerUserOpenid: 'owner-openid',
    harness: { ensureRunning: async () => true },
    state: fixture.state,
  });

  await bridge.accept(message({
    messageId: 'help-rejected',
    senderId: 'other-openid',
    content: '/help',
    replyTarget: { scope: 'c2c', targetId: 'other-openid', msgId: 'help-rejected' },
  }));
  await bridge.accept(message({
    kind: 'group',
    rawEventType: 'GROUP_AT_MESSAGE_CREATE',
    groupOpenid: 'group-1',
    messageId: 'help-group',
    content: '/help',
    replyTarget: { scope: 'group', targetId: 'group-1', msgId: 'help-group' },
  }));
  assert.equal(connectionTestTarget(fixture.state), null);

  const privateTarget = {
    scope: 'c2c', targetId: 'owner-openid', msgId: 'help-private',
  };
  await bridge.accept(message({
    messageId: 'help-private',
    content: '/help',
    replyTarget: privateTarget,
  }));

  assert.deepEqual(connectionTestTarget(fixture.state), privateTarget);
  assert.equal(sent.length, 2);
});

test('QQ private messages stream Harness snapshots and finalize once', async () => {
  const frames = [];
  const sent = [];
  const seen = new Set();
  const bridge = new QqHarnessBridge({
    bot: {
      sendText: async (_target, text) => sent.push(text),
      openStream: () => ({
        update: async (text) => frames.push(text),
        complete: async () => frames.push('DONE'),
        cancel() {},
      }),
    },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-new',
      ensureRunning: async () => true,
      ask: async (_session, _text, { onUpdate }) => {
        await onUpdate({ type: 'text', text: '回答中' });
        return '最终回答';
      },
    },
    state: {
      hasSeen: (id) => seen.has(id),
      markSeen: async (id) => seen.add(id),
      sessionFor: () => 'session-existing',
      setSession: async () => {},
      clearSession: async () => {},
    },
  });

  await bridge.accept(message());
  assert.deepEqual(frames, ['回答中', '最终回答', 'DONE']);
  assert.deepEqual(sent, []);
  assert.equal(seen.has('msg-1'), true);
  assert.equal(bridge.status.messagesReplied, 1);
});

test('QQ closes an opened progress stream and announces when the Harness turn is stopped', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-stopped']]);
  const frames = [];
  const sent = [];
  let cancellations = 0;
  let loggedErrors = 0;
  const bridge = new QqHarnessBridge({
    bot: {
      sendText: async (_target, text) => sent.push(text),
      openStream: () => ({
        update: async (text) => frames.push(text),
        complete: async () => frames.push('DONE'),
        cancel: () => { cancellations += 1; },
      }),
    },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, _text, { onUpdate }) => {
        await onUpdate({ type: 'tool', name: 'bash' });
        const error = new Error('turn stopped');
        error.code = 'turn-stopped';
        throw error;
      },
    },
    state: fixture.state,
    logger: { warn() {}, error() { loggedErrors += 1; } },
  });

  await bridge.accept(message({ messageId: 'qq-stopped-stream' }));

  assert.deepEqual(frames, ['正在使用bash…']);
  assert.equal(cancellations, 1);
  assert.deepEqual(sent, ['已停止。']);
  assert.equal(loggedErrors, 0);
  assert.equal(fixture.seen.has('qq-stopped-stream'), true);
});

test('QQ keeps a stopped turn terminal when stream cleanup and its notice both fail', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-stopped-fallback']]);
  let warnings = 0;
  let loggedErrors = 0;
  const bridge = new QqHarnessBridge({
    bot: {
      sendText: async () => { throw new Error('send unavailable'); },
      openStream: () => ({
        update: async () => {},
        complete: async () => {},
        cancel: () => { throw new Error('cancel unavailable'); },
      }),
    },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      ask: async () => {
        const error = new Error('turn stopped');
        error.code = 'turn-stopped';
        throw error;
      },
    },
    state: fixture.state,
    logger: {
      warn() { warnings += 1; },
      error() { loggedErrors += 1; },
    },
  });

  await bridge.accept(message({ messageId: 'qq-stopped-stream-fallback' }));

  assert.equal(warnings, 2);
  assert.equal(loggedErrors, 0);
  assert.equal(fixture.seen.has('qq-stopped-stream-fallback'), true);
});

test('QQ bridge accepts only the scanner and requires an at-message event in groups', async () => {
  let asks = 0;
  const state = {
    hasSeen: () => false,
    markSeen: async () => {},
    sessionFor: () => 'session',
    sessionExists: async () => true,
    setSession: async () => {},
    clearSession: async () => {},
  };
  const bridge = new QqHarnessBridge({
    bot: { sendText: async () => {} },
    ownerUserOpenid: 'owner-openid',
    harness: { sessionExists: async () => true, ask: async () => { asks += 1; return 'ok'; } },
    state,
  });
  await bridge.accept(message({ messageId: 'other', senderId: 'other-openid' }));
  await bridge.accept(message({
    messageId: 'group', kind: 'group', groupOpenid: 'group-1', rawEventType: 'GROUP_MESSAGE_CREATE',
    replyTarget: { scope: 'group', targetId: 'group-1', msgId: 'group' },
  }));
  assert.equal(asks, 0);
  assert.equal(bridge.status.messagesRejected, 1);
});

test('QQ credential-bound bots accept senders within the platform visibility scope', async () => {
  let asks = 0;
  const bridge = new QqHarnessBridge({
    bot: { sendText: async () => {} },
    ownerUserOpenid: '*',
    harness: {
      sessionExists: async () => true,
      ask: async () => { asks += 1; return 'ok'; },
    },
    state: {
      hasSeen: () => false,
      markSeen: async () => {},
      sessionFor: () => 'session',
      setSession: async () => {},
      clearSession: async () => {},
    },
  });
  await bridge.accept(message({ messageId: 'visible', senderId: 'visible-user' }));
  assert.equal(asks, 1);
  assert.equal(bridge.status.messagesRejected, 0);
});

test('QQ group questions require the initiating actor to mention the bot and preserve multi-question answers', async () => {
  const fixture = stateFixture([['group:group-1', 'session-group']]);
  const sent = [];
  const asked = [];
  const submitted = deferred();
  const secondQuestionDelivered = deferred();
  const releaseSecondQuestion = deferred();
  const bridge = new QqHarnessBridge({
    bot: {
      sendText: async (target, text) => {
        sent.push({ target, text });
        if (text.includes('选择交付内容')) {
          secondQuestionDelivered.resolve();
          await releaseSecondQuestion.promise;
        }
      },
    },
    ownerUserOpenid: '*',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push({ sessionId, text });
        if (text === '旁观者的普通问题') return '旁观者问题已回答';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-group-multi',
          rpcId: 'qq-group-multi',
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
            submitted.resolve(result);
            return { accepted: true };
          },
        });
        await submitted.promise;
        return '发起者交互完成';
      },
    },
    state: fixture.state,
  });

  const first = bridge.accept(message({
    kind: 'group',
    rawEventType: 'GROUP_AT_MESSAGE_CREATE',
    senderId: 'initiator',
    groupOpenid: 'group-1',
    content: '启动群聊交互',
    messageId: 'group-start',
    replyTarget: { scope: 'group', targetId: 'group-1', msgId: 'group-start' },
  }));
  await eventually(() => sent.some(({ text }) => text.includes('选择回答语言')));
  assert.equal(sent.find(({ text }) => text.includes('选择回答语言')).text
    .includes('群聊中请 @机器人 后发送答案。'), true);

  let submittedResult;
  submitted.promise.then((result) => { submittedResult = result; });
  const bystander = bridge.accept(message({
    kind: 'group',
    rawEventType: 'GROUP_AT_MESSAGE_CREATE',
    senderId: 'bystander',
    groupOpenid: 'group-1',
    content: '旁观者的普通问题',
    messageId: 'group-bystander',
    replyTarget: { scope: 'group', targetId: 'group-1', msgId: 'group-bystander' },
  }));
  await bridge.accept(message({
    kind: 'group',
    rawEventType: 'GROUP_MESSAGE_CREATE',
    senderId: 'initiator',
    groupOpenid: 'group-1',
    content: '未提及机器人的答案',
    messageId: 'group-unmentioned',
    replyTarget: { scope: 'group', targetId: 'group-1', msgId: 'group-unmentioned' },
  }));
  assert.equal(submittedResult, undefined);

  const firstAnswer = bridge.accept(message({
    kind: 'group',
    rawEventType: 'GROUP_AT_MESSAGE_CREATE',
    senderId: 'initiator',
    groupOpenid: 'group-1',
    content: '2',
    messageId: 'group-language',
    replyTarget: { scope: 'group', targetId: 'group-1', msgId: 'group-language' },
  }));
  await secondQuestionDelivered.promise;
  const secondAnswer = bridge.accept(message({
    kind: 'group',
    rawEventType: 'GROUP_AT_MESSAGE_CREATE',
    senderId: 'initiator',
    groupOpenid: 'group-1',
    content: '1，文档，发布说明',
    messageId: 'group-deliverables',
    replyTarget: { scope: 'group', targetId: 'group-1', msgId: 'group-deliverables' },
  }));
  releaseSecondQuestion.resolve();
  await Promise.all([firstAnswer, secondAnswer]);

  assert.deepEqual(await submitted.promise, {
    ok: true,
    value: {
      sessionId: 'session-group',
      answer: {
        answers: [
          { id: 'language', selected: ['English'] },
          { id: 'deliverables', selected: ['测试', '文档'], custom: '发布说明' },
        ],
      },
    },
  });
  await Promise.all([first, bystander]);
  assert.deepEqual(asked, [
    { sessionId: 'session-group', text: '启动群聊交互' },
    { sessionId: 'session-group', text: '旁观者的普通问题' },
  ]);
  assert.equal(asked.some(({ text }) => [
    '未提及机器人的答案',
    '2',
    '1，文档，发布说明',
  ].includes(text)), false);
  assert.deepEqual(sent.slice(-2).map(({ text }) => text), ['发起者交互完成', '旁观者问题已回答']);
});

test('QQ pending questions stay isolated between private conversations', async () => {
  const fixture = stateFixture([
    ['c2c:user-a', 'session-a'],
    ['c2c:user-b', 'session-b'],
  ]);
  const sent = [];
  const asked = [];
  const answeredA = deferred();
  const responseA = deferred();
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    ownerUserOpenid: '*',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing sessions should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push({ sessionId, text });
        if (sessionId === 'session-b') return '乙会话的普通回答';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-isolated-a',
          rpcId: 'qq-isolated-a',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'answer-a', question: '甲会话的问题' }],
          },
          respond: async (result) => {
            responseA.resolve(result);
            answeredA.resolve();
            return { accepted: true };
          },
        });
        await answeredA.promise;
        return '甲会话完成';
      },
    },
    state: fixture.state,
  });

  const firstA = bridge.accept(message({
    senderId: 'user-a',
    content: '启动甲会话',
    messageId: 'private-a-start',
    replyTarget: { scope: 'c2c', targetId: 'user-a', msgId: 'private-a-start' },
  }));
  await eventually(() => sent.some(({ text }) => text.includes('甲会话的问题')));
  await bridge.accept(message({
    senderId: 'user-b',
    content: '乙会话的消息',
    messageId: 'private-b',
    replyTarget: { scope: 'c2c', targetId: 'user-b', msgId: 'private-b' },
  }));
  assert.equal(sent.some(({ target, text }) => (
    target.targetId === 'user-b' && text === '乙会话的普通回答'
  )), true);

  await bridge.accept(message({
    senderId: 'user-a',
    content: '甲的答案',
    messageId: 'private-a-answer',
    replyTarget: { scope: 'c2c', targetId: 'user-a', msgId: 'private-a-answer' },
  }));
  await firstA;
  assert.deepEqual((await responseA.promise).value.answer.answers, [
    { id: 'answer-a', selected: [], custom: '甲的答案' },
  ]);
  assert.deepEqual(asked, [
    { sessionId: 'session-a', text: '启动甲会话' },
    { sessionId: 'session-b', text: '乙会话的消息' },
  ]);
});

test('QQ presents concurrent approvals in FIFO order without a code and consumes exact decisions', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-approval']]);
  const sent = [];
  const asked = [];
  const completed = deferred();
  const responses = [];
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        for (const [approvalId, reason, command] of [
          ['qq-approval-one', '允许执行第一步', "printf 'first-step\\n'"],
          ['qq-approval-two', '允许执行第二步', "printf 'second-step\\n'"],
        ]) {
          await options.onInteraction({
            kind: 'approval',
            interactionId: approvalId,
            rpcId: `${approvalId}-rpc`,
            sessionId,
            payload: {
              type: 'approval/requested',
              sessionId,
              approvalId,
              toolName: 'bash',
              callId: `${approvalId}-call`,
              reason,
            },
            toolCall: {
              callId: `${approvalId}-call`,
              name: 'bash',
              arguments: JSON.stringify({ command }),
            },
            respond: async (result) => {
              responses.push(result);
              if (responses.length === 2) completed.resolve();
              return { accepted: true };
            },
          });
        }
        await completed.promise;
        return '审批完成';
      },
    },
    state: fixture.state,
  });

  const prompt = bridge.accept(message({
    messageId: 'approval-start',
    content: '启动两个审批',
  }));
  await eventually(() => sent.some(({ text }) => text.includes('允许执行第一步')));
  assert.equal(sent.some(({ text }) => text.includes('允许执行第二步')), false);
  assert.match(sent.find(({ text }) => text.includes('允许执行第一步')).text, /bash/);
  assert.match(sent.find(({ text }) => text.includes('允许执行第一步')).text, /批准.*拒绝/s);
  assert.doesNotMatch(sent.find(({ text }) => text.includes('允许执行第一步')).text, /qq-approval-one/);

  await bridge.accept(message({
    messageId: 'approval-allow',
    content: '批准',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'approval-allow' },
  }));
  await eventually(() => sent.some(({ text }) => text.includes('允许执行第二步')));
  assert.doesNotMatch(sent.find(({ text }) => text.includes('允许执行第二步')).text, /qq-approval-two/);

  await Promise.all([
    bridge.accept(message({
      messageId: 'approval-reject',
      content: '拒绝',
      replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'approval-reject' },
    })),
    prompt,
  ]);

  assert.deepEqual(responses, [
    {
      ok: true,
      value: {
        sessionId: 'session-approval',
        approvalId: 'qq-approval-one',
        outcome: 'allowed-once',
      },
    },
    {
      ok: true,
      value: {
        sessionId: 'session-approval',
        approvalId: 'qq-approval-two',
        outcome: 'rejected',
      },
    },
  ]);
  assert.deepEqual(asked, ['启动两个审批']);
  assert.equal(sent.at(-1).text, '审批完成');
});

test('QQ deduplicates question replays, cancels orphan questions, and keeps approvals fail-closed', async () => {
  const fixture = stateFixture();
  const sent = [];
  let approvalResponse;
  let parallelResponse;
  let orphanResponse;
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-replay',
      ask: async (sessionId, _text, options) => {
        const replayedQuestion = {
          kind: 'question',
          interactionId: 'qq-replayed-question',
          rpcId: 'qq-replayed-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'choice', question: '只应显示一次' }],
          },
          respond: async () => ({ accepted: true }),
        };
        await options.onInteraction(replayedQuestion);
        await options.onInteraction(replayedQuestion);
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-parallel-question',
          rpcId: 'qq-parallel-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'parallel', question: '不应展示的并行问题' }],
          },
          respond: async (result) => {
            parallelResponse = result;
            return { accepted: true };
          },
        });
        await options.onInteraction({
          kind: 'approval',
          interactionId: 'qq-approval',
          rpcId: 'qq-approval',
          sessionId,
          payload: {
            type: 'approval/requested',
            sessionId,
            approvalId: 'qq-approval',
            toolName: 'bash',
          },
          respond: async (result) => { approvalResponse = result; },
        });
        await options.onInteractionResolved({
          kind: 'question',
          interactionId: 'qq-replayed-question',
          sessionId,
          outcome: 'cancelled',
        });
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-orphan-question',
          rpcId: 'qq-orphan-question',
          sessionId,
          recovered: true,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'secret', question: '旧会话中的敏感问题内容' }],
          },
          respond: async (result) => {
            orphanResponse = result;
            return { accepted: true };
          },
        });
        return '交互恢复完成';
      },
    },
    state: fixture.state,
    logger: { warn() {}, error() {} },
  });

  await bridge.accept(message({ messageId: 'qq-replay', content: '测试交互重放' }));

  assert.equal(sent.filter(({ text }) => text.includes('只应显示一次')).length, 1);
  assert.deepEqual(parallelResponse, {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'QQ is already handling another user interaction.',
      details: {},
    },
  });
  assert.deepEqual(approvalResponse, {
    ok: true,
    value: {
      sessionId: 'session-replay',
      approvalId: 'qq-approval',
      outcome: 'rejected',
    },
  });
  assert.equal(sent.some(({ text }) => text.includes('approval')), false);
  assert.deepEqual(orphanResponse, {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'QQ safely cancelled an interaction left by an earlier client.',
      details: {},
    },
  });
  assert.equal(sent.some(({ text }) => text.includes('旧会话中的敏感问题内容')), false);
  assert.equal(sent.some(({ text }) => text.includes('遗留的待回答问题')), true);
  assert.equal(sent.at(-1).text, '交互恢复完成');
});

test('QQ keeps a queued prompt separate while a failed interaction answer is retried', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-submit-retry']]);
  const sent = [];
  const asked = [];
  const firstSubmitStarted = deferred();
  const releaseFirstSubmit = deferred();
  const answered = deferred();
  const submittedAnswers = [];
  let submitAttempts = 0;
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text === '排队的下一个问题') return '第二轮完成';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-submit-retry',
          rpcId: 'qq-submit-retry',
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
    logger: { warn() {}, error() {} },
  });

  const first = bridge.accept(message({ messageId: 'retry-start', content: '启动可重试交互' }));
  await eventually(() => sent.some(({ text }) => text.includes('请回答后再继续')));
  const firstAnswer = bridge.accept(message({
    messageId: 'retry-first-answer',
    content: '第一次答案',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'retry-first-answer' },
  }));
  await firstSubmitStarted.promise;

  let nextSettled = false;
  const next = bridge.accept(message({
    messageId: 'retry-next',
    content: '排队的下一个问题',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'retry-next' },
  })).finally(() => { nextSettled = true; });
  releaseFirstSubmit.resolve();
  await firstAnswer;
  await eventually(() => sent.some(({ text }) => text.includes('回答提交失败')));
  assert.equal(nextSettled, false);
  assert.deepEqual(asked, ['启动可重试交互']);

  await Promise.all([
    bridge.accept(message({
      messageId: 'retry-second-answer',
      content: '重试后的答案',
      replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'retry-second-answer' },
    })),
    first,
    next,
  ]);

  assert.deepEqual(submittedAnswers, ['第一次答案', '重试后的答案']);
  assert.deepEqual(asked, ['启动可重试交互', '排队的下一个问题']);
  assert.deepEqual(sent.slice(-2).map(({ text }) => text), ['第一轮完成', '第二轮完成']);
});

test('QQ discards an already-claimed answer when the interaction resolves elsewhere', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-resolved-race']]);
  const originalMarkSeen = fixture.state.markSeen;
  const answerMarkStarted = deferred();
  const releaseAnswerMark = deferred();
  fixture.state.markSeen = async (id) => {
    if (id === 'resolved-answer') {
      answerMarkStarted.resolve();
      await releaseAnswerMark.promise;
    }
    await originalMarkSeen(id);
  };
  const sent = [];
  const asked = [];
  const resolved = deferred();
  let resolveInteraction;
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text === '后来的普通问题') return '后来问题的回答';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-resolved-race',
          rpcId: 'qq-resolved-race',
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
            interactionId: 'qq-resolved-race',
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
  });

  const first = bridge.accept(message({ messageId: 'resolved-start', content: '启动外部解决竞态' }));
  await eventually(() => typeof resolveInteraction === 'function');
  const answer = bridge.accept(message({
    messageId: 'resolved-answer',
    content: '原本的问题答案',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'resolved-answer' },
  }));
  await answerMarkStarted.promise;
  const later = bridge.accept(message({
    messageId: 'resolved-later',
    content: '后来的普通问题',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'resolved-later' },
  }));
  await resolveInteraction();
  releaseAnswerMark.resolve();

  await Promise.all([answer, first, later]);
  assert.deepEqual(asked, ['启动外部解决竞态', '后来的普通问题']);
  assert.equal(asked.includes('原本的问题答案'), false);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('QQ keeps an answer that arrives after the first question is delivered but before its send ACK', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-first-delivery']]);
  const questionDelivered = deferred();
  const releaseQuestionAck = deferred();
  const answered = deferred();
  const sent = [];
  const asked = [];
  let submitted;
  let questionSends = 0;
  const bridge = new QqHarnessBridge({
    bot: {
      sendText: async (target, text) => {
        sent.push({ target, text });
        if (text.includes('首问 ACK 窗口')) {
          questionSends += 1;
          questionDelivered.resolve();
          await releaseQuestionAck.promise;
        }
      },
    },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-first-delivery',
          rpcId: 'qq-first-delivery',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'answer', question: '首问 ACK 窗口' }],
          },
          respond: async (result) => {
            submitted = result;
            answered.resolve();
            return { accepted: true };
          },
        });
        await answered.promise;
        return '首问已完成';
      },
    },
    state: fixture.state,
  });

  const first = bridge.accept(message({
    messageId: 'first-delivery-start',
    content: '启动首问窗口',
  }));
  await questionDelivered.promise;
  const answer = bridge.accept(message({
    messageId: 'first-delivery-answer',
    content: '窗口内答案',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'first-delivery-answer' },
  }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(submitted, undefined);
  releaseQuestionAck.resolve();
  await Promise.all([first, answer]);

  assert.equal(questionSends, 1);
  assert.deepEqual(asked, ['启动首问窗口']);
  assert.deepEqual(submitted.value.answer.answers, [{
    id: 'answer',
    selected: [],
    custom: '窗口内答案',
  }]);
  assert.equal(fixture.seen.has('first-delivery-answer'), true);
});

test('QQ tombstones a q2 answer accepted before its send ACK when the interaction resolves', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-q2-resolved']]);
  const secondQuestionDelivered = deferred();
  const releaseSecondQuestionAck = deferred();
  const turnResolved = deferred();
  const sent = [];
  const asked = [];
  let resolveInteraction;
  const bridge = new QqHarnessBridge({
    bot: {
      sendText: async (target, text) => {
        sent.push({ target, text });
        if (text.includes('会在 ACK 前 resolved 的第二问')) {
          secondQuestionDelivered.resolve();
          await releaseSecondQuestionAck.promise;
        }
      },
    },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-q2-resolved',
          rpcId: 'qq-q2-resolved',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [
              { id: 'first', question: '先回答第一问' },
              { id: 'second', question: '会在 ACK 前 resolved 的第二问' },
            ],
          },
          respond: async () => assert.fail('the externally resolved interaction must not be answered'),
        });
        resolveInteraction = () => {
          options.onInteractionResolved({
            kind: 'question',
            interactionId: 'qq-q2-resolved',
            sessionId,
            outcome: 'answered',
          });
          turnResolved.resolve();
        };
        await turnResolved.promise;
        return '已由其他客户端完成';
      },
    },
    state: fixture.state,
  });

  const first = bridge.accept(message({
    messageId: 'q2-resolved-start',
    content: '启动 q2 resolved 窗口',
  }));
  await eventually(() => typeof resolveInteraction === 'function');
  const firstAnswer = bridge.accept(message({
    messageId: 'q2-resolved-first',
    content: '第一问答案',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'q2-resolved-first' },
  }));
  await secondQuestionDelivered.promise;
  const secondAnswer = bridge.accept(message({
    messageId: 'q2-resolved-second',
    content: '第二问答案',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'q2-resolved-second' },
  }));
  resolveInteraction();
  releaseSecondQuestionAck.resolve();
  await Promise.all([firstAnswer, secondAnswer, first]);

  assert.deepEqual(asked, ['启动 q2 resolved 窗口']);
  assert.equal(fixture.seen.has('q2-resolved-second'), true);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('QQ reports resolved when an in-flight response becomes not-pending', async () => {
  const fixture = stateFixture([['c2c:owner-openid', 'session-respond-resolved']]);
  const responseStarted = deferred();
  const releaseResponse = deferred();
  const turnResolved = deferred();
  const sent = [];
  let resolveInteraction;
  const bridge = new QqHarnessBridge({
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    ownerUserOpenid: 'owner-openid',
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, _text, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-respond-resolved',
          rpcId: 'qq-respond-resolved',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'answer', question: '提交中会被外部解决' }],
          },
          respond: async () => {
            responseStarted.resolve();
            await releaseResponse.promise;
            const error = new Error('already resolved');
            error.code = 'interaction-not-pending';
            throw error;
          },
        });
        resolveInteraction = () => {
          options.onInteractionResolved({
            kind: 'question',
            interactionId: 'qq-respond-resolved',
            sessionId,
            outcome: 'answered',
          });
          turnResolved.resolve();
        };
        await turnResolved.promise;
        return '外部处理完成';
      },
    },
    state: fixture.state,
  });

  const first = bridge.accept(message({
    messageId: 'respond-resolved-start',
    content: '启动提交竞态',
  }));
  await eventually(() => typeof resolveInteraction === 'function');
  const answer = bridge.accept(message({
    messageId: 'respond-resolved-answer',
    content: '我的答案',
    replyTarget: { scope: 'c2c', targetId: 'owner-openid', msgId: 'respond-resolved-answer' },
  }));
  await responseStarted.promise;
  resolveInteraction();
  releaseResponse.resolve();
  await Promise.all([answer, first]);

  assert.equal(sent.some(({ text, target }) => (
    target.msgId === 'respond-resolved-answer'
      && text.includes('已在其他客户端处理')
  )), true);
});

test('QQ propagates the stop signal and cancels its pending question on abort', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('c2c:owner-openid', 'stale-session');
  const controller = new AbortController();
  const interactionReady = deferred();
  let existsSignal;
  let createSignal;
  let askSignal;
  let cancellation;
  let cancellationSignal;
  const bridge = new QqHarnessBridge({
    bot: { sendText: async () => {} },
    ownerUserOpenid: 'owner-openid',
    signal: controller.signal,
    harness: {
      sessionExists: async (_sessionId, options) => {
        existsSignal = options.signal;
        return false;
      },
      createSession: async (options) => {
        createSignal = options.signal;
        return 'session-abort';
      },
      ask: async (sessionId, _text, options) => {
        askSignal = options.signal;
        await options.onInteraction({
          kind: 'question',
          interactionId: 'qq-abort-question',
          rpcId: 'qq-abort-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'answer', question: '等待进程停止' }],
          },
          respond: async (result, respondOptions) => {
            cancellation = result;
            cancellationSignal = respondOptions.signal;
            return { accepted: true };
          },
        });
        interactionReady.resolve();
        await new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        });
      },
    },
    state: fixture.state,
    logger: { warn() {}, error() {} },
  });

  const turn = bridge.accept(message({ messageId: 'abort-start', content: '启动后停止' }));
  await interactionReady.promise;
  controller.abort(new Error('runtime stopped'));
  await turn;

  assert.equal(existsSignal, controller.signal);
  assert.equal(createSignal, controller.signal);
  assert.equal(askSignal, controller.signal);
  assert.deepEqual(cancellation, {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'The QQ interaction ended before the user answered.',
      details: {},
    },
  });
  assert.notEqual(cancellationSignal, controller.signal);
  assert.equal(cancellationSignal.aborted, false);
});
