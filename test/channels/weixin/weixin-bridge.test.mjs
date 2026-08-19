import assert from 'node:assert/strict';
import test from 'node:test';

import { createWeixinBridgeStatus, WeixinHarnessBridge } from '../../../src/channels/weixin/weixin-bridge.mjs';
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

async function within(promise, milliseconds, messageText) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(messageText)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function message(id, text, overrides = {}) {
  return {
    message_id: id,
    message_type: 1,
    from_user_id: 'owner-user',
    context_token: `context-${id}`,
    item_list: [{ type: 1, text_item: { text } }],
    ...overrides,
  };
}

function stateFixture() {
  const sessions = new Map();
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

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x01, 0x02, 0x03,
]);

test('Weixin remembers any authorized private inbound as a connection-test target', async () => {
  const fixture = stateFixture();
  const sent = [];
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: { ensureRunning: async () => true },
    state: fixture.state,
  });

  await bridge.accept(message('help-owner', '/help'));
  assert.deepEqual(connectionTestTarget(fixture.state), { toUserId: 'owner-user' });
  assert.match(sent.at(-1).text, /\/help/);

  const rejectedFixture = stateFixture();
  const rejectedBridge = new WeixinHarnessBridge({
    api: { sendText: async () => assert.fail('unauthorized message must not be answered') },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: { ensureRunning: async () => true },
    state: rejectedFixture.state,
  });
  await rejectedBridge.accept(message('help-other', '/help', { from_user_id: 'other-user' }));
  assert.equal(connectionTestTarget(rejectedFixture.state), null);
});

test('Weixin sends image-only messages to Harness as structured content', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'session-image');
  const prompts = [];
  const sent = [];
  const bridge = new WeixinHarnessBridge({
    api: {
      inboundImages: () => [{ name: 'image', data: PNG_BYTES }],
      sendText: async (request) => sent.push(request),
    },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, content) => {
        prompts.push({ sessionId, content });
        return '微信图片已识别';
      },
    },
    state: fixture.state,
  });

  await bridge.accept(message('weixin-image', '', {
    item_list: [{ type: 2, image_item: { media: {} } }],
  }));

  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].sessionId, 'session-image');
  assert.deepEqual(prompts[0].content.map(({ type }) => type), ['text', 'image']);
  assert.equal(prompts[0].content[0].text, '请分析这张图片。');
  assert.equal(prompts[0].content[1].mediaType, 'image/png');
  assert.equal(Buffer.from(prompts[0].content[1].data, 'base64').equals(PNG_BYTES), true);
  assert.equal(sent.at(-1).text, '微信图片已识别');
  assert.equal(sent.at(-1).contextToken, 'context-weixin-image');
  assert.equal(fixture.seen.has('weixin-image'), true);
});

test('Weixin authorizes the sender before resolving encrypted image references', async () => {
  let imageExtractions = 0;
  let asks = 0;
  const bridge = new WeixinHarnessBridge({
    api: {
      inboundImages: () => { imageExtractions += 1; return [{ data: PNG_BYTES }]; },
      sendText: async () => assert.fail('an unauthorized sender must not receive a reply'),
    },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: { ask: async () => { asks += 1; return 'unexpected'; } },
    state: stateFixture().state,
  });

  await bridge.accept(message('weixin-image-other', '', {
    from_user_id: 'other-user',
    item_list: [{ type: 2, image_item: { media: {} } }],
  }));

  assert.equal(imageExtractions, 0);
  assert.equal(asks, 0);
});

test('Weixin returns a specific retry message when encrypted image loading fails', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'session-image');
  const sent = [];
  const bridge = new WeixinHarnessBridge({
    api: {
      inboundImages: () => [{ load: async () => { throw new Error('CDN unavailable'); } }],
      sendText: async (request) => sent.push(request),
    },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => true,
      ask: async () => assert.fail('a failed image must not reach Harness'),
    },
    state: fixture.state,
    logger: { error() {} },
  });

  await bridge.accept(message('weixin-image-error', '', {
    item_list: [{ type: 2, image_item: { media: {} } }],
  }));

  assert.equal(sent.at(-1).text, '图片下载失败，请重新发送后再试。');
  assert.equal(fixture.seen.has('weixin-image-error'), true);
});

test('Weixin executes /compact for the bound Session without prompting the model', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'session-compact');
  const sent = [];
  const executed = [];
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      executeCommand: async (sessionId, line) => {
        executed.push({ sessionId, line });
        return { commandId: 'compact-weixin', result: { kind: 'success', text: 'No compactable history yet.' } };
      },
      ask: async () => assert.fail('/compact must not be submitted to the model'),
    },
    state: fixture.state,
  });

  await bridge.accept(message('compact-weixin', '/compact'));

  assert.deepEqual(executed, [{ sessionId: 'session-compact', line: '/compact' }]);
  assert.equal(sent.at(-1).text, '暂无可压缩的历史记录。');
  assert.equal(fixture.seen.has('compact-weixin'), true);
});

test('Weixin lists models without prompting and help advertises all four commands', async () => {
  const fixture = stateFixture();
  const sent = [];
  let asks = 0;
  let creates = 0;
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      listModels: async () => ({
        groups: [{
          id: 'weixin-provider',
          name: 'Weixin Provider',
          models: [{ id: 'model-one', name: 'Model One' }],
        }],
        failures: [],
      }),
      createSession: async () => { creates += 1; return 'weixin-session'; },
      ask: async () => { asks += 1; return 'unexpected model reply'; },
    },
    state: fixture.state,
  });

  await bridge.accept(message('models-weixin', '/models'));
  assert.match(sent.at(-1).text, /1\. weixin-provider\/model-one/);
  assert.equal(asks, 0);
  assert.equal(creates, 0);
  assert.equal(fixture.sessions.size, 0);

  await bridge.accept(message('help-models-weixin', '/help'));
  const help = sent.at(-1).text;
  for (const command of ['/models', '/model', '/stop', '/steer']) {
    assert.equal(help.includes(command), true, command);
  }
  assert.match(help, /\/model 2/);
});

test('bridge maps the scanning Weixin user to one persistent Harness session and echoes context_token', async () => {
  const sent = [];
  const asked = [];
  const fixture = stateFixture();
  const status = createWeixinBridgeStatus();
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async (sessionId) => sessionId === 'session-1',
      createSession: async () => 'session-1',
      ask: async (sessionId, text) => {
        asked.push({ sessionId, text });
        return 'Harness 的回答';
      },
    },
    state: fixture.state,
    status,
  });

  await bridge.accept(message('1', '你好'));
  await bridge.accept(message('2', '继续'));

  assert.deepEqual(asked, [
    { sessionId: 'session-1', text: '你好' },
    { sessionId: 'session-1', text: '继续' },
  ]);
  assert.equal(fixture.sessions.get('p2p:owner-user'), 'session-1');
  assert.deepEqual(sent.map(({ toUserId, text, contextToken }) => ({ toUserId, text, contextToken })), [
    { toUserId: 'owner-user', text: 'Harness 的回答', contextToken: 'context-1' },
    { toUserId: 'owner-user', text: 'Harness 的回答', contextToken: 'context-2' },
  ]);
  assert.equal(status.messagesReceived, 2);
  assert.equal(status.messagesReplied, 2);
});

test('Weixin answers a multi-question interaction before the original turn queue', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'session-question');
  const sent = [];
  const asked = [];
  const submitted = deferred();
  const secondQuestionDelivered = deferred();
  const releaseSecondQuestion = deferred();
  const bridge = new WeixinHarnessBridge({
    api: {
      sendText: async (request) => {
        sent.push(request);
        if (request.text.includes('选择交付物')) {
          secondQuestionDelivered.resolve();
          await releaseSecondQuestion.promise;
        }
      },
    },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction({
          kind: 'question',
          interactionId: 'weixin-multi',
          rpcId: 'weixin-multi',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [
              {
                id: 'language',
                question: '选择语言',
                options: [{ label: '中文' }, { label: 'English' }],
              },
              {
                id: 'deliverables',
                question: '选择交付物',
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
        return '交互完成';
      },
    },
    state: fixture.state,
  });

  const first = bridge.accept(message('multi-start', '请分步提问'));
  await eventually(() => sent.some(({ text }) => text.includes('选择语言')));
  const firstAnswer = bridge.accept(message('multi-language', '2'));
  await secondQuestionDelivered.promise;
  const secondAnswer = bridge.accept(message('multi-deliverables', '1，文档，发布说明'));
  releaseSecondQuestion.resolve();
  await within(
    Promise.all([firstAnswer, secondAnswer]),
    500,
    'the second Weixin answer deadlocked behind delivery of the second question',
  );

  assert.deepEqual(await submitted.promise, {
    ok: true,
    value: {
      sessionId: 'session-question',
      answer: {
        answers: [
          { id: 'language', selected: ['English'] },
          { id: 'deliverables', selected: ['测试', '文档'], custom: '发布说明' },
        ],
      },
    },
  });
  await first;
  assert.deepEqual(asked, ['请分步提问']);
  assert.equal(sent.at(-1).text, '交互完成');
  assert.equal(sent.find(({ text }) => text.includes('选择交付物')).contextToken, 'context-multi-language');
});

test('Weixin consumes an exact rejection as the pending approval response', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'session-approval');
  const sent = [];
  const asked = [];
  const completed = deferred();
  const responses = [];
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction({
          kind: 'approval',
          interactionId: 'weixin-approval-exact',
          rpcId: 'weixin-approval-exact-rpc',
          sessionId,
          payload: {
            type: 'approval/requested',
            sessionId,
            approvalId: 'weixin-approval-exact',
            toolName: 'bash',
            callId: 'weixin-approval-exact-call',
            reason: '允许执行微信审批测试',
          },
          toolCall: {
            callId: 'weixin-approval-exact-call',
            name: 'bash',
            arguments: JSON.stringify({ command: "printf 'weixin-approval\\n'" }),
          },
          respond: async (result) => {
            responses.push(result);
            completed.resolve();
            return { accepted: true };
          },
        });
        await completed.promise;
        return '审批已拒绝';
      },
    },
    state: fixture.state,
  });

  const prompt = bridge.accept(message('approval-start', '启动审批'));
  await eventually(() => sent.some(({ text }) => text.includes('允许执行微信审批测试')));
  const presentation = sent.find(({ text }) => text.includes('允许执行微信审批测试')).text;
  assert.match(presentation, /bash/);
  assert.match(presentation, /批准.*拒绝/s);

  await Promise.all([
    bridge.accept(message('approval-reject', '  不同意  ')),
    prompt,
  ]);

  assert.deepEqual(responses, [{
    ok: true,
    value: {
      sessionId: 'session-approval',
      approvalId: 'weixin-approval-exact',
      outcome: 'rejected',
    },
  }]);
  assert.deepEqual(asked, ['启动审批']);
  assert.equal(sent.at(-1).text, '审批已拒绝');
});

test('Weixin deduplicates question replays, rejects parallel questions, and keeps approvals fail-closed', async () => {
  const fixture = stateFixture();
  const sent = [];
  let approvalResponse;
  let parallelResponse;
  let orphanResponse;
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-replay',
      ask: async (sessionId, _text, options) => {
        const replayedQuestion = {
          kind: 'question',
          interactionId: 'weixin-replayed-question',
          rpcId: 'weixin-replayed-question',
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
          interactionId: 'weixin-parallel-question',
          rpcId: 'weixin-parallel-question',
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
          interactionId: 'weixin-approval',
          rpcId: 'weixin-approval',
          sessionId,
          payload: {
            type: 'approval/requested',
            sessionId,
            approvalId: 'weixin-approval',
            toolName: 'bash',
          },
          respond: async (result) => { approvalResponse = result; },
        });
        await options.onInteractionResolved({
          kind: 'question',
          interactionId: 'weixin-replayed-question',
          sessionId,
          outcome: 'cancelled',
        });
        await options.onInteraction({
          kind: 'question',
          interactionId: 'weixin-orphan-question',
          rpcId: 'weixin-orphan-question',
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

  await bridge.accept(message('replay', '测试交互重放'));

  assert.equal(sent.filter(({ text }) => text.includes('只应显示一次')).length, 1);
  assert.deepEqual(parallelResponse, {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'Weixin is already handling another user interaction.',
      details: {},
    },
  });
  assert.deepEqual(approvalResponse, {
    ok: true,
    value: {
      sessionId: 'session-replay',
      approvalId: 'weixin-approval',
      outcome: 'rejected',
    },
  });
  assert.equal(sent.some(({ text }) => text.includes('approval')), false);
  assert.deepEqual(orphanResponse, {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'Weixin safely cancelled an interaction left by an earlier client.',
      details: {},
    },
  });
  assert.equal(sent.some(({ text }) => text.includes('旧会话中的敏感问题内容')), false);
  assert.equal(sent.some(({ text }) => text.includes('遗留的待回答问题')), true);
  assert.equal(sent.at(-1).text, '交互恢复完成');
});

test('Weixin keeps a queued prompt separate while a failed interaction answer is retried', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'session-submit-retry');
  const sent = [];
  const asked = [];
  const firstSubmitStarted = deferred();
  const releaseFirstSubmit = deferred();
  const answered = deferred();
  const submittedAnswers = [];
  let submitAttempts = 0;
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text === '排队的下一个问题') return '第二轮完成';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'weixin-submit-retry',
          rpcId: 'weixin-submit-retry',
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

  const first = bridge.accept(message('retry-start', '启动可重试交互'));
  await eventually(() => sent.some(({ text }) => text.includes('请回答后再继续')));
  const firstAnswer = bridge.accept(message('retry-first-answer', '第一次答案'));
  await firstSubmitStarted.promise;

  let nextSettled = false;
  const next = bridge.accept(message('retry-next', '排队的下一个问题'))
    .finally(() => { nextSettled = true; });
  releaseFirstSubmit.resolve();
  await firstAnswer;
  await eventually(() => sent.some(({ text }) => text.includes('回答提交失败')));
  assert.equal(nextSettled, false);
  assert.deepEqual(asked, ['启动可重试交互']);

  await Promise.all([
    bridge.accept(message('retry-second-answer', '重试后的答案')),
    first,
    next,
  ]);

  assert.deepEqual(submittedAnswers, ['第一次答案', '重试后的答案']);
  assert.deepEqual(asked, ['启动可重试交互', '排队的下一个问题']);
  assert.deepEqual(sent.slice(-2).map(({ text }) => text), ['第一轮完成', '第二轮完成']);
});

test('Weixin serializes an invalid pending reply before the following valid answer', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'session-invalid-answer');
  const sent = [];
  const invalidNoticeStarted = deferred();
  const releaseInvalidNotice = deferred();
  const answered = deferred();
  let submitted;
  const bridge = new WeixinHarnessBridge({
    api: {
      sendText: async (request) => {
        if (request.text === '请用文字回答当前问题。') {
          invalidNoticeStarted.resolve();
          await releaseInvalidNotice.promise;
        }
        sent.push(request);
      },
    },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, _text, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'weixin-invalid-answer',
          rpcId: 'weixin-invalid-answer',
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
  });

  const first = bridge.accept(message('invalid-start', '启动交互'));
  await eventually(() => sent.some(({ text }) => text.includes('请给出有效文字答案')));
  const invalid = bridge.accept(message('invalid-image', '', {
    message_type: 3,
    item_list: [
      { type: 1, text_item: { text: '伪装成答案的图片说明' } },
      { type: 2, image_item: { media: {} } },
    ],
  }));
  await invalidNoticeStarted.promise;
  const valid = bridge.accept(message('invalid-valid', '真正的答案'));
  releaseInvalidNotice.resolve();

  await Promise.all([invalid, valid, first]);
  assert.deepEqual(submitted.value.answer.answers, [{
    id: 'answer',
    selected: [],
    custom: '真正的答案',
  }]);
  assert.equal(sent.at(-1).text, '有效答案已收到');
});

test('Weixin discards an already-claimed answer when the interaction resolves elsewhere', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'session-resolved-race');
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
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the existing session should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text === '后来的普通问题') return '后来问题的回答';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'weixin-resolved-race',
          rpcId: 'weixin-resolved-race',
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
            interactionId: 'weixin-resolved-race',
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

  const first = bridge.accept(message('resolved-start', '启动外部解决竞态'));
  await eventually(() => typeof resolveInteraction === 'function');
  const answer = bridge.accept(message('resolved-answer', '原本的问题答案'));
  await answerMarkStarted.promise;
  const later = bridge.accept(message('resolved-later', '后来的普通问题'));
  await resolveInteraction();
  releaseAnswerMark.resolve();

  await Promise.all([answer, first, later]);
  assert.deepEqual(asked, ['启动外部解决竞态', '后来的普通问题']);
  assert.equal(asked.includes('原本的问题答案'), false);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('Weixin keeps an answer that arrives after the first question is delivered but before its send ACK', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'session-first-delivery');
  const questionDelivered = deferred();
  const releaseQuestionAck = deferred();
  const answered = deferred();
  const sent = [];
  const asked = [];
  let submitted;
  let questionSends = 0;
  const bridge = new WeixinHarnessBridge({
    api: {
      sendText: async (request) => {
        sent.push(request);
        if (request.text.includes('首问 ACK 窗口')) {
          questionSends += 1;
          questionDelivered.resolve();
          await releaseQuestionAck.promise;
        }
      },
    },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction({
          kind: 'question',
          interactionId: 'weixin-first-delivery',
          rpcId: 'weixin-first-delivery',
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

  const first = bridge.accept(message('first-delivery-start', '启动首问窗口'));
  await questionDelivered.promise;
  const answer = bridge.accept(message('first-delivery-answer', '窗口内答案'));
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

test('Weixin tombstones a q2 answer accepted before its send ACK when the interaction resolves', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'session-q2-resolved');
  const secondQuestionDelivered = deferred();
  const releaseSecondQuestionAck = deferred();
  const turnResolved = deferred();
  const sent = [];
  const asked = [];
  let resolveInteraction;
  const bridge = new WeixinHarnessBridge({
    api: {
      sendText: async (request) => {
        sent.push(request);
        if (request.text.includes('会在 ACK 前 resolved 的第二问')) {
          secondQuestionDelivered.resolve();
          await releaseSecondQuestionAck.promise;
        }
      },
    },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction({
          kind: 'question',
          interactionId: 'weixin-q2-resolved',
          rpcId: 'weixin-q2-resolved',
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
            interactionId: 'weixin-q2-resolved',
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

  const first = bridge.accept(message('q2-resolved-start', '启动 q2 resolved 窗口'));
  await eventually(() => typeof resolveInteraction === 'function');
  const firstAnswer = bridge.accept(message('q2-resolved-first', '第一问答案'));
  await secondQuestionDelivered.promise;
  const secondAnswer = bridge.accept(message('q2-resolved-second', '第二问答案'));
  resolveInteraction();
  releaseSecondQuestionAck.resolve();
  await Promise.all([firstAnswer, secondAnswer, first]);

  assert.deepEqual(asked, ['启动 q2 resolved 窗口']);
  assert.equal(fixture.seen.has('q2-resolved-second'), true);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('Weixin reports resolved when an in-flight response becomes not-pending', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'session-respond-resolved');
  const responseStarted = deferred();
  const releaseResponse = deferred();
  const turnResolved = deferred();
  const sent = [];
  let resolveInteraction;
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, _text, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'weixin-respond-resolved',
          rpcId: 'weixin-respond-resolved',
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
            interactionId: 'weixin-respond-resolved',
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

  const first = bridge.accept(message('respond-resolved-start', '启动提交竞态'));
  await eventually(() => typeof resolveInteraction === 'function');
  const answer = bridge.accept(message('respond-resolved-answer', '我的答案'));
  await responseStarted.promise;
  resolveInteraction();
  releaseResponse.resolve();
  await Promise.all([answer, first]);

  assert.equal(sent.some(({ text, contextToken }) => (
    contextToken === 'context-respond-resolved-answer'
      && text.includes('已在其他客户端处理')
  )), true);
});

test('Weixin propagates the stop signal and cancels its pending question on abort', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'stale-session');
  const controller = new AbortController();
  const interactionReady = deferred();
  let existsSignal;
  let createSignal;
  let askSignal;
  let cancellation;
  let cancellationSignal;
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async () => {} },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
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
          interactionId: 'weixin-abort-question',
          rpcId: 'weixin-abort-question',
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

  const turn = bridge.accept(message('abort-start', '启动后停止'));
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
      message: 'The Weixin interaction ended before the user answered.',
      details: {},
    },
  });
  assert.notEqual(cancellationSignal, controller.signal);
  assert.equal(cancellationSignal.aborted, false);
});

test('bridge rejects every user except the account owner returned by QR login', async () => {
  const fixture = stateFixture();
  let asked = 0;
  const status = createWeixinBridgeStatus();
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async () => assert.fail('unauthorized users must not receive a reply') },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: { ask: async () => { asked += 1; } },
    state: fixture.state,
    status,
  });

  await bridge.accept(message('unauthorized', '越权', { from_user_id: 'other-user' }));
  assert.equal(asked, 0);
  assert.equal(status.messagesRejected, 1);
});

test('bridge commands are local and internal failures return a generic message', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:owner-user', 'old-session');
  const sent = [];
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async (request) => sent.push(request.text) },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      ensureRunning: async () => true,
      sessionExists: async () => true,
      ask: async () => { throw new Error('private path /secret and token-shaped detail'); },
    },
    state: fixture.state,
    logger: { error() {} },
  });

  await bridge.accept(message('new', '/new'));
  assert.equal(fixture.sessions.has('p2p:owner-user'), false);
  await bridge.accept(message('failure', '触发失败'));
  assert.match(sent.at(-1), /消息处理失败/);
  assert.doesNotMatch(sent.at(-1), /private path|secret|token-shaped/);
});
