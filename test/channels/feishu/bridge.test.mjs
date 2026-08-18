import test from 'node:test';
import assert from 'node:assert/strict';
import { FeishuHarnessBridge } from '../../../src/channels/feishu/bridge.mjs';

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

test('a non-text pending reply does not block the valid answer behind it', async () => {
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
  const invalid = bridge.accept(event('invalid-reply-image', '', {
    message_type: 'image',
    content: JSON.stringify({ image_key: 'img-test' }),
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
