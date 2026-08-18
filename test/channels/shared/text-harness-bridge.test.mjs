import assert from 'node:assert/strict';
import test from 'node:test';

import { TextHarnessBridge } from '../../../src/channels/shared/text-harness-bridge.mjs';

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

function stateFixture(initialSessions = {}) {
  const sessions = new Map(Object.entries(initialSessions));
  const seen = new Set();
  return {
    sessions,
    seen,
    state: {
      sessionFor(key) { return sessions.get(key) ?? null; },
      async setSession(key, sessionId) {
        sessions.set(key, sessionId);
        return true;
      },
      async clearSession(key) { sessions.delete(key); },
      hasSeen(messageId) { return seen.has(messageId); },
      async markSeen(messageId) { seen.add(messageId); },
    },
  };
}

function message(messageId, content, overrides = {}) {
  return {
    messageId,
    senderId: 'actor-a',
    senderIsBot: false,
    kind: 'direct',
    conversationId: 'chat-a',
    content,
    addressed: true,
    replyTarget: { id: `target-${messageId}` },
    ...overrides,
  };
}

function questionInteraction({
  id = 'question-one',
  sessionId = 'session-one',
  questions = [{ id: 'answer', question: '请回答' }],
  respond = async () => ({ accepted: true }),
  ...rest
} = {}) {
  return {
    kind: 'question',
    interactionId: id,
    rpcId: id,
    sessionId,
    payload: { type: 'question/requested', sessionId, questions },
    respond,
    ...rest,
  };
}

function createBridge({ harness, state, bot, signal, logger } = {}) {
  return new TextHarnessBridge({
    descriptor: { key: 'test', label: 'Test' },
    bot,
    harness,
    state,
    signal,
    logger: logger ?? { warn() {}, error() {} },
  });
}

test('answers a multi-question interaction on the fast lane with canonical values', async () => {
  const fixture = stateFixture();
  const sent = [];
  const asked = [];
  const submitted = deferred();
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      createSession: async () => 'session-one',
      ask: async (sessionId, text, options) => {
        asked.push({ sessionId, text });
        await options.onInteraction(questionInteraction({
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
          respond: async (result) => {
            submitted.resolve(result);
            return { accepted: true };
          },
        }));
        await submitted.promise;
        return '交互已完成';
      },
    },
  });

  const processing = bridge.accept(message('prompt', '请分步提问'));
  await eventually(() => sent.some(({ text }) => text.includes('选择回答语言')));
  await bridge.accept(message('language', '2'));
  await eventually(() => sent.some(({ text }) => text.includes('选择交付内容')));
  await bridge.accept(message('deliverables', '1，文档，发布说明'));

  assert.deepEqual(await submitted.promise, {
    ok: true,
    value: {
      sessionId: 'session-one',
      answer: {
        answers: [
          { id: 'language', selected: ['English'] },
          { id: 'deliverables', selected: ['测试', '文档'], custom: '发布说明' },
        ],
      },
    },
  });
  await processing;
  assert.deepEqual(asked, [{ sessionId: 'session-one', text: '请分步提问' }]);
  assert.equal(sent.at(-1).text, '交互已完成');
  assert.deepEqual(sent[1].target, { id: 'target-language' });
});

test('isolates pending questions by normalized conversation key', async () => {
  const fixture = stateFixture({
    'direct:chat-a': 'session-a',
    'direct:chat-b': 'session-b',
  });
  const sent = [];
  const answeredA = deferred();
  const asked = [];
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, text, options) => {
        asked.push({ sessionId, text });
        if (sessionId === 'session-b') return '乙会话完成';
        await options.onInteraction(questionInteraction({
          id: 'question-a',
          sessionId,
          questions: [{ id: 'a', question: '甲会话的问题' }],
          respond: async (result) => {
            answeredA.resolve(result);
            return { accepted: true };
          },
        }));
        await answeredA.promise;
        return '甲会话完成';
      },
    },
  });

  const first = bridge.accept(message('a-start', '启动甲'));
  await eventually(() => sent.some(({ text }) => text.includes('甲会话的问题')));
  await bridge.accept(message('b-normal', '乙的普通问题', {
    senderId: 'actor-b',
    conversationId: 'chat-b',
  }));
  assert.deepEqual(asked, [
    { sessionId: 'session-a', text: '启动甲' },
    { sessionId: 'session-b', text: '乙的普通问题' },
  ]);

  await bridge.accept(message('a-answer', '甲的答案'));
  assert.deepEqual((await answeredA.promise).value.answer.answers, [
    { id: 'a', selected: [], custom: '甲的答案' },
  ]);
  await first;
});

test('a group question only accepts an addressed reply from the initiating actor', async () => {
  const fixture = stateFixture({ 'group:room': 'session-group' });
  const sent = [];
  const submitted = deferred();
  const asked = [];
  let responseCalls = 0;
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text !== '甲发起交互') return '普通群消息已处理';
        await options.onInteraction(questionInteraction({
          id: 'group-question',
          sessionId,
          questions: [{ id: 'actor', question: '只能由甲回答' }],
          respond: async (result) => {
            responseCalls += 1;
            submitted.resolve(result);
            return { accepted: true };
          },
        }));
        await submitted.promise;
        return '甲的交互完成';
      },
    },
  });
  const group = { kind: 'group', conversationId: 'room' };

  const first = bridge.accept(message('group-start', '甲发起交互', { ...group }));
  await eventually(() => sent.some(({ text }) => text.includes('只能由甲回答')));
  assert.match(sent[0].text, /群聊中请 @机器人/);

  await bridge.accept(message('group-unaddressed', '没有 @ 的回答', {
    ...group,
    addressed: false,
  }));
  const intruder = bridge.accept(message('group-intruder', '乙试图代答', {
    ...group,
    senderId: 'actor-b',
  }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(responseCalls, 0);
  assert.deepEqual(asked, ['甲发起交互']);

  await bridge.accept(message('group-answer', '甲的真正答案', { ...group }));
  assert.deepEqual((await submitted.promise).value.answer.answers, [{
    id: 'actor',
    selected: [],
    custom: '甲的真正答案',
  }]);
  await Promise.all([first, intruder]);
  assert.deepEqual(asked, ['甲发起交互', '乙试图代答']);
  assert.equal(bridge.status.messagesRejected, 1);
});

test('deduplicates replays, cancels parallel and recovered questions, and leaves approval pending', async () => {
  const fixture = stateFixture();
  const sent = [];
  let parallelResponse;
  let recoveredResponse;
  let approvalResponses = 0;
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      createSession: async () => 'session-one',
      ask: async (sessionId, _text, options) => {
        const current = questionInteraction({
          id: 'replayed-question',
          sessionId,
          questions: [{ id: 'current', question: '只应显示一次' }],
        });
        await options.onInteraction(current);
        await options.onInteraction(current);
        await options.onInteraction(questionInteraction({
          id: 'parallel-question',
          sessionId,
          questions: [{ id: 'parallel', question: '不应显示的并行问题' }],
          respond: async (result) => { parallelResponse = result; },
        }));
        await options.onInteraction({
          kind: 'approval',
          interactionId: 'approval-one',
          rpcId: 'approval-rpc',
          sessionId,
          payload: { type: 'approval/requested', approvalId: 'approval-one' },
          respond: async () => { approvalResponses += 1; },
        });
        await options.onInteraction(questionInteraction({
          id: 'orphan-question',
          sessionId,
          recovered: true,
          questions: [{ id: 'secret', question: '旧会话中的敏感问题内容' }],
          respond: async (result) => { recoveredResponse = result; },
        }));
        await options.onInteractionResolved({
          kind: 'question',
          interactionId: 'replayed-question',
          sessionId,
          outcome: 'cancelled',
        });
        return '已继续处理';
      },
    },
  });

  await bridge.accept(message('replay', '测试交互重放'));
  assert.equal(sent.filter(({ text }) => text.includes('只应显示一次')).length, 1);
  assert.equal(sent.some(({ text }) => text.includes('旧会话中的敏感问题内容')), false);
  assert.equal(sent.some(({ text }) => text.includes('遗留的待回答问题')), true);
  assert.deepEqual(parallelResponse?.error, {
    code: 'cancelled',
    message: 'Test is already handling another user interaction.',
    details: {},
  });
  assert.deepEqual(recoveredResponse?.error, {
    code: 'cancelled',
    message: 'Test safely cancelled an interaction left by an earlier client.',
    details: {},
  });
  assert.equal(approvalResponses, 0);
});

test('keeps a failed interaction response pending so the actor can retry', async () => {
  const fixture = stateFixture();
  const sent = [];
  const completed = deferred();
  const submittedAnswers = [];
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      createSession: async () => 'session-one',
      ask: async (sessionId, _text, options) => {
        await options.onInteraction(questionInteraction({
          id: 'retry-question',
          sessionId,
          respond: async (result) => {
            submittedAnswers.push(result.value.answer.answers[0].custom);
            if (submittedAnswers.length === 1) throw new Error('temporary failure');
            completed.resolve();
            return { accepted: true };
          },
        }));
        await completed.promise;
        return '重试成功';
      },
    },
  });

  const processing = bridge.accept(message('retry-start', '启动可重试交互'));
  await eventually(() => sent.some(({ text }) => text.includes('请回答')));
  await bridge.accept(message('retry-first', '第一次答案'));
  assert.equal(sent.some(({ text }) => text.includes('回答提交失败')), true);
  await bridge.accept(message('retry-second', '重试后的答案'));
  await processing;

  assert.deepEqual(submittedAnswers, ['第一次答案', '重试后的答案']);
  assert.equal(sent.at(-1).text, '重试成功');
});

test('notifies the actor when an in-flight response resolves elsewhere before rejection', async () => {
  const fixture = stateFixture();
  const sent = [];
  const responseStarted = deferred();
  const asked = [];
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      createSession: async () => 'session-one',
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction(questionInteraction({
          id: 'response-resolved-race',
          sessionId,
          respond: async () => {
            options.onInteractionResolved({
              kind: 'question',
              interactionId: 'response-resolved-race',
              sessionId,
              outcome: 'answered',
            });
            responseStarted.resolve();
            const error = new Error('interaction no longer pending');
            error.code = 'interaction-not-pending';
            throw error;
          },
        }));
        await responseStarted.promise;
        return '原会话已结束';
      },
    },
  });

  const processing = bridge.accept(message('response-race-start', '启动提交竞态'));
  await eventually(() => sent.some(({ text }) => text.includes('请回答')));
  await bridge.accept(message('response-race-answer', '已经收到的答案'));
  await processing;

  assert.deepEqual(asked, ['启动提交竞态']);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('discards a claimed answer when the interaction resolves during message recording', async () => {
  const fixture = stateFixture({ 'direct:chat-a': 'session-one' });
  const originalMarkSeen = fixture.state.markSeen;
  const answerMarkStarted = deferred();
  const releaseAnswerMark = deferred();
  fixture.state.markSeen = async (messageId) => {
    if (messageId === 'racing-answer') {
      answerMarkStarted.resolve();
      await releaseAnswerMark.promise;
    }
    await originalMarkSeen(messageId);
  };
  const sent = [];
  const asked = [];
  const externallyResolved = deferred();
  let resolveInteraction;
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text === '后来的普通问题') return '后来问题的回答';
        await options.onInteraction(questionInteraction({
          id: 'resolved-race-question',
          sessionId,
        }));
        resolveInteraction = () => {
          options.onInteractionResolved({
            kind: 'question',
            interactionId: 'resolved-race-question',
            sessionId,
            outcome: 'answered',
          });
          externallyResolved.resolve();
        };
        await externallyResolved.promise;
        return '第一轮已由其他客户端完成';
      },
    },
  });

  const processing = bridge.accept(message('race-start', '启动外部解决竞态'));
  await eventually(() => typeof resolveInteraction === 'function');
  const answer = bridge.accept(message('racing-answer', '原本的问题答案'));
  await answerMarkStarted.promise;
  resolveInteraction();
  releaseAnswerMark.resolve();
  await Promise.all([processing, answer]);
  await bridge.accept(message('later-prompt', '后来的普通问题'));

  assert.deepEqual(asked, ['启动外部解决竞态', '后来的普通问题']);
  assert.equal(asked.includes('原本的问题答案'), false);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('accepts a first answer received while its question presentation is still in flight', async () => {
  const fixture = stateFixture();
  const presentationStarted = deferred();
  const releasePresentation = deferred();
  const submitted = deferred();
  const sent = [];
  const asked = [];
  let questionPresentations = 0;
  const bridge = createBridge({
    state: fixture.state,
    bot: {
      sendText: async (target, text) => {
        sent.push({ target, text });
        if (text.includes('发送仍在进行的问题')) {
          questionPresentations += 1;
          presentationStarted.resolve();
          await releasePresentation.promise;
        }
      },
    },
    harness: {
      createSession: async () => 'session-one',
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction(questionInteraction({
          id: 'first-presentation-race',
          sessionId,
          questions: [{ id: 'first', question: '发送仍在进行的问题' }],
          respond: async (result) => {
            submitted.resolve(result);
            return { accepted: true };
          },
        }));
        await submitted.promise;
        return '首问已回答';
      },
    },
  });

  const processing = bridge.accept(message('presentation-start', '启动首问竞态'));
  await presentationStarted.promise;
  const answer = bridge.accept(message('presentation-answer', '首问答案'));
  releasePresentation.resolve();
  await Promise.all([processing, answer]);

  assert.deepEqual((await submitted.promise).value.answer.answers, [{
    id: 'first',
    selected: [],
    custom: '首问答案',
  }]);
  assert.deepEqual(asked, ['启动首问竞态']);
  assert.equal(questionPresentations, 1);
  assert.equal(sent.at(-1).text, '首问已回答');
});

test('discards an answer already received when a later question resolves during presentation', async () => {
  const fixture = stateFixture();
  const secondPresentationStarted = deferred();
  const releaseSecondPresentation = deferred();
  const externallyResolved = deferred();
  const sent = [];
  const asked = [];
  let resolveInteraction;
  const bridge = createBridge({
    state: fixture.state,
    bot: {
      sendText: async (target, text) => {
        sent.push({ target, text });
        if (text.includes('仍在发送的第二问')) {
          secondPresentationStarted.resolve();
          await releaseSecondPresentation.promise;
        }
      },
    },
    harness: {
      createSession: async () => 'session-one',
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text !== '启动第二问竞态') return '不应把第二问答案作为新 prompt';
        await options.onInteraction(questionInteraction({
          id: 'second-presentation-race',
          sessionId,
          questions: [
            { id: 'first', question: '第一问' },
            { id: 'second', question: '仍在发送的第二问' },
          ],
        }));
        resolveInteraction = () => {
          options.onInteractionResolved({
            kind: 'question',
            interactionId: 'second-presentation-race',
            sessionId,
            outcome: 'answered',
          });
          externallyResolved.resolve();
        };
        await externallyResolved.promise;
        return '已由其他客户端完成';
      },
    },
  });

  const processing = bridge.accept(message('second-race-start', '启动第二问竞态'));
  await eventually(() => typeof resolveInteraction === 'function');
  const firstAnswer = bridge.accept(message('second-race-first', '第一问答案'));
  await secondPresentationStarted.promise;
  const secondAnswer = bridge.accept(message('second-race-second', '第二问已收到的答案'));
  resolveInteraction();
  releaseSecondPresentation.resolve();
  await Promise.all([processing, firstAnswer, secondAnswer]);

  assert.deepEqual(asked, ['启动第二问竞态']);
  assert.equal(asked.includes('第二问已收到的答案'), false);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('passes the runtime signal to Harness and safely cancels a pending question on abort', async () => {
  const controller = new AbortController();
  const fixture = stateFixture({ 'direct:chat-a': 'stale-session' });
  const sent = [];
  const cancelled = deferred();
  let existsSignal;
  let createSignal;
  let askSignal;
  const bridge = createBridge({
    state: fixture.state,
    signal: controller.signal,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      sessionExists: async (_sessionId, options) => {
        existsSignal = options?.signal;
        return false;
      },
      createSession: async (options) => {
        createSignal = options?.signal;
        return 'session-one';
      },
      ask: async (sessionId, _text, options) => {
        askSignal = options.signal;
        await options.onInteraction(questionInteraction({
          id: 'abort-question',
          sessionId,
          respond: async (result) => {
            cancelled.resolve(result);
            return { accepted: true };
          },
        }));
        await new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), {
            once: true,
          });
        });
      },
    },
  });

  const processing = bridge.accept(message('abort-start', '启动后停止'));
  await eventually(() => sent.some(({ text }) => text.includes('请回答')));
  controller.abort(new DOMException('runtime stopped', 'AbortError'));
  await processing;

  assert.equal(existsSignal, controller.signal);
  assert.equal(createSignal, controller.signal);
  assert.equal(askSignal, controller.signal);
  assert.deepEqual(await cancelled.promise, {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'The Test interaction ended before the user answered.',
      details: {},
    },
  });
});
