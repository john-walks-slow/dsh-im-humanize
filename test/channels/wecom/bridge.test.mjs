import assert from 'node:assert/strict';
import test from 'node:test';

import { WecomHarnessBridge } from '../../../src/channels/wecom/wecom-bridge.mjs';

function frame(overrides = {}) {
  return {
    headers: { req_id: 'req-1' },
    body: {
      msgid: 'msg-1',
      chattype: 'single',
      from: { userid: 'member-1' },
      msgtype: 'text',
      text: { content: '请回答' },
      ...overrides,
    },
  };
}

function state() {
  const seen = new Set();
  return {
    seen,
    hasSeen: (id) => seen.has(id),
    markSeen: async (id) => seen.add(id),
    sessionFor: () => 'session-existing',
    sessionExists: async () => true,
    setSession: async () => {},
    clearSession: async () => {},
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
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('condition did not become true');
}

function testClient() {
  const streamed = [];
  const active = [];
  return {
    streamed,
    active,
    client: {
      replyStream: async (source, streamId, content, finish) => {
        streamed.push({ messageId: source.body.msgid, streamId, content, finish });
      },
      replyStreamNonBlocking: async (source, streamId, content, finish) => {
        streamed.push({ messageId: source.body.msgid, streamId, content, finish });
      },
      sendMessage: async (chatId, body) => active.push({ chatId, body }),
    },
  };
}

function questionInteraction({
  interactionId = 'question-1',
  sessionId = 'session-existing',
  questions = [{
    id: 'environment',
    question: '请选择测试环境',
    options: [{ label: '测试环境' }, { label: '生产环境' }],
  }],
  recovered = false,
  respond = async () => {},
  reconnect = () => {},
} = {}) {
  return {
    kind: 'question',
    interactionId,
    rpcId: interactionId,
    sessionId,
    payload: { questions },
    recovered,
    respond,
    reconnect,
  };
}

test('Enterprise WeChat messages stream Harness progress and finalize once', async () => {
  const replies = [];
  const active = [];
  const store = state();
  const bridge = new WecomHarnessBridge({
    client: {
      replyStream: async (_frame, streamId, content, finish) => replies.push({ streamId, content, finish }),
      replyStreamNonBlocking: async (_frame, streamId, content, finish) => replies.push({ streamId, content, finish }),
      sendMessage: async (chatId, body) => active.push({ chatId, body }),
    },
    generateStreamId: () => 'stream-1',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-new',
      ensureRunning: async () => true,
      ask: async (_session, _text, { onUpdate }) => {
        await onUpdate({ type: 'tool', name: '网页搜索' });
        await onUpdate({ type: 'text', text: '回答中' });
        return '最终回答';
      },
    },
    state: store,
  });

  await bridge.accept(frame());
  assert.deepEqual(replies, [
    { streamId: 'stream-1', content: '正在思考中…', finish: false },
    { streamId: 'stream-1', content: '正在使用网页搜索…', finish: false },
    { streamId: 'stream-1', content: '回答中', finish: false },
    { streamId: 'stream-1', content: '最终回答', finish: true },
  ]);
  assert.deepEqual(active, []);
  assert.equal(store.seen.has('msg-1'), true);
  assert.equal(bridge.status.messagesReplied, 1);
});

test('Enterprise WeChat visibility scope accepts direct and group conversations without local approval', async () => {
  let asks = 0;
  const client = {
    replyStream: async () => {},
    replyStreamNonBlocking: async () => {},
    sendMessage: async () => {},
  };
  const harness = {
    sessionExists: async () => true,
    ask: async () => { asks += 1; return 'ok'; },
  };
  const bridge = new WecomHarnessBridge({ client, harness, state: state(), generateStreamId: () => 'stream' });
  await bridge.accept(frame({ msgid: 'direct', from: { userid: 'member-a' } }));
  await bridge.accept(frame({ msgid: 'group', chattype: 'group', chatid: 'group-1', from: { userid: 'member-b' } }));
  assert.equal(asks, 2);
});

test('Enterprise WeChat finalizes an existing progress stream when Harness fails', async () => {
  const replies = [];
  const store = state();
  const bridge = new WecomHarnessBridge({
    client: {
      replyStream: async (_frame, streamId, content, finish) => replies.push({ streamId, content, finish }),
      replyStreamNonBlocking: async () => {},
      sendMessage: async () => {},
    },
    generateStreamId: () => 'stream-failure',
    harness: {
      sessionExists: async () => true,
      ensureRunning: async () => true,
      ask: async () => { throw new Error('Harness unavailable'); },
    },
    state: store,
    logger: { error() {} },
  });

  await bridge.accept(frame());
  assert.deepEqual(replies, [
    { streamId: 'stream-failure', content: '正在思考中…', finish: false },
    { streamId: 'stream-failure', content: '消息处理失败，请稍后重试。', finish: true },
  ]);
  assert.equal(store.seen.has('msg-1'), true);
});

test('an Enterprise WeChat answer bypasses the original conversation queue', async () => {
  const transport = testClient();
  const answered = deferred();
  const responses = [];
  const bridge = new WecomHarnessBridge({
    client: transport.client,
    generateStreamId: (() => { let index = 0; return () => `stream-${++index}`; })(),
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, _text, options) => {
        await options.onInteraction(questionInteraction({
          respond: async (result) => {
            responses.push(result);
            answered.resolve();
          },
        }));
        await answered.promise;
        return '你选择了：测试环境';
      },
    },
    state: state(),
  });

  const prompt = bridge.accept(frame({ msgid: 'question-start' }));
  await eventually(() => transport.active.some(({ body }) => (
    body.markdown.content.includes('请选择测试环境')
  )));
  const answer = bridge.accept(frame({
    msgid: 'question-answer',
    text: { content: '1' },
  }));
  await Promise.all([prompt, answer]);

  assert.deepEqual(responses, [{
    ok: true,
    value: {
      sessionId: 'session-existing',
      answer: { answers: [{ id: 'environment', selected: ['测试环境'] }] },
    },
  }]);
  assert.equal(transport.streamed.at(-1).content, '你选择了：测试环境');
  assert.equal(transport.streamed.at(-1).finish, true);
});

test('an answer waits for the first Enterprise WeChat question delivery acknowledgement', async () => {
  const questionSendStarted = deferred();
  const questionAcknowledged = deferred();
  const answered = deferred();
  const streamed = [];
  const active = [];
  const prompts = [];
  const responses = [];
  const bridge = new WecomHarnessBridge({
    client: {
      replyStream: async (source, streamId, content, finish) => {
        streamed.push({ messageId: source.body.msgid, streamId, content, finish });
      },
      sendMessage: async (chatId, body) => {
        active.push({ chatId, body });
        questionSendStarted.resolve();
        await questionAcknowledged.promise;
      },
    },
    generateStreamId: (() => { let index = 0; return () => `first-ack-${++index}`; })(),
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, text, options) => {
        prompts.push(text);
        await options.onInteraction(questionInteraction({
          interactionId: 'first-ack-question',
          respond: async (result) => {
            responses.push(result);
            answered.resolve();
          },
        }));
        await answered.promise;
        return '首问回答完成';
      },
    },
    state: state(),
  });

  const prompt = bridge.accept(frame({ msgid: 'first-ack-start' }));
  await questionSendStarted.promise;
  let answerSettled = false;
  const answer = bridge.accept(frame({
    msgid: 'first-ack-answer',
    text: { content: '1' },
  }));
  answer.then(
    () => { answerSettled = true; },
    () => { answerSettled = true; },
  );
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(answerSettled, false);
  assert.equal(active.length, 1);
  assert.deepEqual(responses, []);

  questionAcknowledged.resolve();
  await eventually(() => responses.length === 1);
  await Promise.all([prompt, answer]);

  assert.deepEqual(prompts, ['请回答']);
  assert.equal(active.length, 1);
  assert.deepEqual(responses[0].value.answer.answers, [
    { id: 'environment', selected: ['测试环境'] },
  ]);
  assert.equal(streamed.at(-1).content, '首问回答完成');
});

test('pending Enterprise WeChat questions stay isolated by conversation', async () => {
  const transport = testClient();
  const gates = new Map([
    ['ask-a', deferred()],
    ['ask-b', deferred()],
  ]);
  const responses = [];
  const bridge = new WecomHarnessBridge({
    client: transport.client,
    generateStreamId: (() => { let index = 0; return () => `isolation-${++index}`; })(),
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, text, options) => {
        const gate = gates.get(text);
        await options.onInteraction(questionInteraction({
          interactionId: `question-${text}`,
          respond: async (result) => {
            responses.push({ text, result });
            gate.resolve();
          },
        }));
        await gate.promise;
        return `done-${text}`;
      },
    },
    state: state(),
  });

  const first = bridge.accept(frame({
    msgid: 'isolation-a',
    from: { userid: 'member-a' },
    text: { content: 'ask-a' },
  }));
  const second = bridge.accept(frame({
    msgid: 'isolation-b',
    from: { userid: 'member-b' },
    text: { content: 'ask-b' },
  }));
  await eventually(() => transport.active.filter(({ body }) => (
    body.markdown.content.includes('请选择测试环境')
  )).length === 2);

  const answerA = bridge.accept(frame({
    msgid: 'isolation-answer-a',
    from: { userid: 'member-a' },
    text: { content: '1' },
  }));
  await Promise.all([first, answerA]);
  assert.deepEqual(responses.map(({ text }) => text), ['ask-a']);

  const answerB = bridge.accept(frame({
    msgid: 'isolation-answer-b',
    from: { userid: 'member-b' },
    text: { content: '2' },
  }));
  await Promise.all([second, answerB]);
  assert.deepEqual(responses.map(({ text }) => text), ['ask-a', 'ask-b']);
  assert.deepEqual(
    responses[1].result.value.answer.answers,
    [{ id: 'environment', selected: ['生产环境'] }],
  );
});

test('Enterprise WeChat accepts only an exact approval decision and never forwards a fuzzy reply', async () => {
  const transport = testClient();
  const completed = deferred();
  const prompts = [];
  const responses = [];
  const bridge = new WecomHarnessBridge({
    client: transport.client,
    generateStreamId: (() => { let index = 0; return () => `approval-${++index}`; })(),
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, text, options) => {
        prompts.push(text);
        await options.onInteraction({
          kind: 'approval',
          interactionId: 'wecom-approval',
          rpcId: 'wecom-approval-rpc',
          sessionId,
          payload: {
            type: 'approval/requested',
            sessionId,
            approvalId: 'wecom-approval',
            toolName: 'bash',
            callId: 'wecom-approval-call',
            reason: '允许执行企业微信审批测试',
          },
          toolCall: {
            callId: 'wecom-approval-call',
            name: 'bash',
            arguments: JSON.stringify({ command: "printf 'wecom-approval\\n'" }),
          },
          respond: async (result) => {
            responses.push(result);
            completed.resolve();
            return { accepted: true };
          },
        });
        await completed.promise;
        return '审批已继续';
      },
    },
    state: state(),
  });

  const outputTexts = () => [
    ...transport.active.map(({ body }) => body.markdown.content),
    ...transport.streamed.map(({ content }) => content),
  ];
  const prompt = bridge.accept(frame({
    msgid: 'approval-start',
    text: { content: '启动审批' },
  }));
  await eventually(() => outputTexts().some((text) => text.includes('允许执行企业微信审批测试')));

  const outputCountBeforeFuzzyReply = outputTexts().length;
  const fuzzy = bridge.accept(frame({
    msgid: 'approval-fuzzy',
    text: { content: '可以' },
  }));
  await eventually(() => outputTexts().slice(outputCountBeforeFuzzyReply).some((text) => text.includes('回复')
    && text.includes('批准') && text.includes('拒绝')));
  assert.deepEqual(responses, []);
  assert.deepEqual(prompts, ['启动审批']);

  await Promise.all([
    fuzzy,
    bridge.accept(frame({
      msgid: 'approval-exact',
      text: { content: '  YES  ' },
    })),
    prompt,
  ]);

  assert.deepEqual(responses, [{
    ok: true,
    value: {
      sessionId: 'session-existing',
      approvalId: 'wecom-approval',
      outcome: 'allowed-once',
    },
  }]);
  assert.deepEqual(prompts, ['启动审批']);
});

test('question replays are deduplicated and approvals remain fail-closed', async () => {
  const transport = testClient();
  const answered = deferred();
  let approvalResponses = 0;
  let questionResponses = 0;
  const bridge = new WecomHarnessBridge({
    client: transport.client,
    generateStreamId: () => 'replay-stream',
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, _text, options) => {
        await options.onInteraction({
          kind: 'approval',
          interactionId: 'approval-1',
          rpcId: 'approval-rpc-1',
          sessionId: 'session-existing',
          payload: { type: 'approval/requested', toolName: 'bash' },
          respond: async () => { approvalResponses += 1; },
        });
        const interaction = questionInteraction({
          interactionId: 'replayed-question',
          respond: async () => {
            questionResponses += 1;
            answered.resolve();
          },
        });
        await options.onInteraction(interaction);
        await options.onInteraction({ ...interaction });
        await answered.promise;
        return 'done';
      },
    },
    state: state(),
  });

  const prompt = bridge.accept(frame({ msgid: 'replay-start' }));
  await eventually(() => transport.active.length === 1);
  const answer = bridge.accept(frame({ msgid: 'replay-answer', text: { content: '1' } }));
  await Promise.all([prompt, answer]);

  assert.equal(transport.active.length, 1);
  assert.equal(approvalResponses, 0);
  assert.equal(questionResponses, 1);
});

test('a failed Enterprise WeChat interaction response can be retried', async () => {
  const transport = testClient();
  const answered = deferred();
  const attempts = [];
  const bridge = new WecomHarnessBridge({
    client: transport.client,
    generateStreamId: (() => { let index = 0; return () => `retry-${++index}`; })(),
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, _text, options) => {
        await options.onInteraction(questionInteraction({
          respond: async (result) => {
            attempts.push(structuredClone(result.value.answer.answers));
            if (attempts.length === 1) throw new Error('temporary response failure');
            answered.resolve();
          },
        }));
        await answered.promise;
        return 'retry complete';
      },
    },
    state: state(),
    logger: { error() {} },
  });

  const prompt = bridge.accept(frame({ msgid: 'retry-start' }));
  await eventually(() => transport.active.length === 1);
  await bridge.accept(frame({ msgid: 'retry-first', text: { content: '1' } }));
  assert.equal(transport.streamed.some(({ content }) => content.includes('回答提交失败')), true);

  const second = bridge.accept(frame({ msgid: 'retry-second', text: { content: '2' } }));
  await Promise.all([prompt, second]);
  assert.deepEqual(attempts, [
    [{ id: 'environment', selected: ['测试环境'] }],
    [{ id: 'environment', selected: ['生产环境'] }],
  ]);
});

test('an externally resolved Enterprise WeChat answer is not submitted as a new prompt', async () => {
  const transport = testClient();
  const resolved = deferred();
  let interactionOptions;
  const prompts = [];
  const bridge = new WecomHarnessBridge({
    client: transport.client,
    generateStreamId: (() => { let index = 0; return () => `resolved-${++index}`; })(),
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, text, options) => {
        prompts.push(text);
        interactionOptions = options;
        await options.onInteraction(questionInteraction({ interactionId: 'resolved-question' }));
        await resolved.promise;
        return '外部客户端已处理';
      },
    },
    state: state(),
  });

  const prompt = bridge.accept(frame({ msgid: 'resolved-start' }));
  await eventually(() => transport.active.length === 1 && interactionOptions);
  const lateAnswer = bridge.accept(frame({
    msgid: 'resolved-answer',
    text: { content: '1' },
  }));
  interactionOptions.onInteractionResolved({
    kind: 'question',
    interactionId: 'resolved-question',
  });
  resolved.resolve();
  await Promise.all([prompt, lateAnswer]);

  assert.deepEqual(prompts, ['请回答']);
  assert.equal(transport.streamed.some(({ messageId, content }) => (
    messageId === 'resolved-answer' && content === '这个问题已在其他客户端处理，无需再次回答。'
  )), true);
});

test('an Enterprise WeChat answer reports resolution when respond loses an in-flight race', async () => {
  const transport = testClient();
  const responseStarted = deferred();
  const releaseResponse = deferred();
  const turnResolved = deferred();
  const prompts = [];
  let interactionOptions;
  const bridge = new WecomHarnessBridge({
    client: transport.client,
    generateStreamId: (() => { let index = 0; return () => `respond-race-${++index}`; })(),
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, text, options) => {
        prompts.push(text);
        interactionOptions = options;
        await options.onInteraction(questionInteraction({
          interactionId: 'respond-race-question',
          respond: async () => {
            responseStarted.resolve();
            await releaseResponse.promise;
            const error = new Error('interaction resolved elsewhere');
            error.code = 'interaction-not-pending';
            throw error;
          },
        }));
        await turnResolved.promise;
        return '外部客户端已完成';
      },
    },
    state: state(),
  });

  const prompt = bridge.accept(frame({ msgid: 'respond-race-start' }));
  await eventually(() => transport.active.length === 1 && interactionOptions);
  const answer = bridge.accept(frame({
    msgid: 'respond-race-answer',
    text: { content: '1' },
  }));
  await responseStarted.promise;

  interactionOptions.onInteractionResolved({
    kind: 'question',
    interactionId: 'respond-race-question',
  });
  turnResolved.resolve();
  releaseResponse.resolve();
  await Promise.all([prompt, answer]);

  assert.deepEqual(prompts, ['请回答']);
  assert.equal(transport.streamed.filter(({ messageId, content }) => (
    messageId === 'respond-race-answer'
      && content === '这个问题已在其他客户端处理，无需再次回答。'
  )).length, 1);
});

test('a recovered orphan question is cancelled without exposing its content', async () => {
  const transport = testClient();
  const responses = [];
  const bridge = new WecomHarnessBridge({
    client: transport.client,
    generateStreamId: () => 'orphan-stream',
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, _text, options) => {
        await options.onInteraction(questionInteraction({
          recovered: true,
          questions: [{ id: 'secret', question: '不应显示的旧问题' }],
          respond: async (result) => responses.push(result),
        }));
        return '新消息继续完成';
      },
    },
    state: state(),
  });

  await bridge.accept(frame({ msgid: 'orphan-start' }));
  assert.equal(responses[0].ok, false);
  assert.equal(responses[0].error.code, 'cancelled');
  assert.equal(transport.active.some(({ body }) => (
    body.markdown.content.includes('不应显示的旧问题')
  )), false);
  assert.equal(transport.active.some(({ body }) => (
    body.markdown.content.includes('遗留的待回答问题')
  )), true);
});

test('multi-question Enterprise WeChat interactions preserve canonical answer order', async () => {
  const transport = testClient();
  const answered = deferred();
  let submitted;
  const questions = [
    {
      id: 'environment',
      question: '请选择环境',
      options: [{ label: '测试环境' }, { label: '生产环境' }],
    },
    {
      id: 'features',
      question: '请选择功能',
      multiSelect: true,
      options: [{ label: '日志' }, { label: '指标' }],
    },
  ];
  const bridge = new WecomHarnessBridge({
    client: transport.client,
    generateStreamId: (() => { let index = 0; return () => `batch-${++index}`; })(),
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, _text, options) => {
        await options.onInteraction(questionInteraction({
          interactionId: 'batch-question',
          questions,
          respond: async (result) => {
            submitted = result;
            answered.resolve();
          },
        }));
        await answered.promise;
        return 'batch complete';
      },
    },
    state: state(),
  });

  const prompt = bridge.accept(frame({ msgid: 'batch-start' }));
  await eventually(() => transport.active.length === 1);
  await bridge.accept(frame({ msgid: 'batch-first', text: { content: '2' } }));
  await eventually(() => transport.active.length === 2);
  const second = bridge.accept(frame({
    msgid: 'batch-second',
    text: { content: '1, 指标, 自定义' },
  }));
  await Promise.all([prompt, second]);

  assert.deepEqual(submitted.value.answer.answers, [
    { id: 'environment', selected: ['生产环境'] },
    { id: 'features', selected: ['日志', '指标'], custom: '自定义' },
  ]);
});

test('a second answer stays claimed while its Enterprise WeChat question awaits acknowledgement', async () => {
  const secondQuestionStarted = deferred();
  const secondQuestionAcknowledged = deferred();
  const turnResolved = deferred();
  const streamed = [];
  const active = [];
  const prompts = [];
  let interactionOptions;
  let responseCalls = 0;
  const bridge = new WecomHarnessBridge({
    client: {
      replyStream: async (source, streamId, content, finish) => {
        streamed.push({ messageId: source.body.msgid, streamId, content, finish });
      },
      sendMessage: async (chatId, body) => {
        active.push({ chatId, body });
        if (body.markdown.content.includes('请选择功能')) {
          secondQuestionStarted.resolve();
          await secondQuestionAcknowledged.promise;
        }
      },
    },
    generateStreamId: (() => { let index = 0; return () => `second-ack-${++index}`; })(),
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, text, options) => {
        prompts.push(text);
        interactionOptions = options;
        await options.onInteraction(questionInteraction({
          interactionId: 'second-ack-question',
          questions: [
            {
              id: 'environment',
              question: '请选择环境',
              options: [{ label: '测试环境' }, { label: '生产环境' }],
            },
            {
              id: 'features',
              question: '请选择功能',
              options: [{ label: '日志' }, { label: '指标' }],
            },
          ],
          respond: async () => { responseCalls += 1; },
        }));
        await turnResolved.promise;
        return '外部客户端已处理多问';
      },
    },
    state: state(),
  });

  const prompt = bridge.accept(frame({ msgid: 'second-ack-start' }));
  await eventually(() => active.some(({ body }) => body.markdown.content.includes('请选择环境')));
  const firstAnswer = bridge.accept(frame({
    msgid: 'second-ack-first',
    text: { content: '1' },
  }));
  await secondQuestionStarted.promise;
  const secondAnswer = bridge.accept(frame({
    msgid: 'second-ack-answer',
    text: { content: '2' },
  }));

  interactionOptions.onInteractionResolved({
    kind: 'question',
    interactionId: 'second-ack-question',
  });
  turnResolved.resolve();
  secondQuestionAcknowledged.resolve();
  await Promise.all([prompt, firstAnswer, secondAnswer]);

  assert.deepEqual(prompts, ['请回答']);
  assert.equal(responseCalls, 0);
  assert.equal(streamed.filter(({ messageId, content }) => (
    messageId === 'second-ack-answer'
      && content === '这个问题已在其他客户端处理，无需再次回答。'
  )).length, 1);
});

test('only the initiating actor can answer an Enterprise WeChat group question', async () => {
  const transport = testClient();
  const answered = deferred();
  const order = [];
  let groupResponse;
  const bridge = new WecomHarnessBridge({
    client: transport.client,
    generateStreamId: (() => { let index = 0; return () => `group-${++index}`; })(),
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, text, options) => {
        if (text !== '启动问题') {
          order.push(`normal:${text}`);
          return '普通消息完成';
        }
        await options.onInteraction(questionInteraction({
          interactionId: 'group-question',
          respond: async (result) => {
            groupResponse = result;
            order.push('answered');
            answered.resolve();
          },
        }));
        await answered.promise;
        return '问题完成';
      },
    },
    state: state(),
  });

  const prompt = bridge.accept(frame({
    msgid: 'group-start',
    chattype: 'group',
    chatid: 'group-1',
    from: { userid: 'member-a' },
    text: { content: '@RobotA 启动问题' },
  }));
  await eventually(() => transport.active.some(({ chatId }) => chatId === 'group-1'));
  assert.match(
    transport.active.find(({ chatId }) => chatId === 'group-1').body.markdown.content,
    /群聊中请 @机器人 后发送答案/,
  );
  const outsider = bridge.accept(frame({
    msgid: 'group-outsider',
    chattype: 'group',
    chatid: 'group-1',
    from: { userid: 'member-b' },
    text: { content: '@RobotA 1' },
  }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, []);

  const actor = bridge.accept(frame({
    msgid: 'group-actor',
    chattype: 'group',
    chatid: 'group-1',
    from: { userid: 'member-a' },
    text: { content: '@RobotA 2' },
  }));
  await Promise.all([prompt, actor, outsider]);
  assert.deepEqual(order, ['answered', 'normal:1']);
  assert.deepEqual(groupResponse.value.answer.answers, [
    { id: 'environment', selected: ['生产环境'] },
  ]);
});

test('aborting Enterprise WeChat work cancels its pending question without a failure reply', async () => {
  const transport = testClient();
  const controller = new AbortController();
  const cancellations = [];
  const bridge = new WecomHarnessBridge({
    client: transport.client,
    generateStreamId: () => 'abort-stream',
    signal: controller.signal,
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, _text, options) => {
        assert.equal(options.signal, controller.signal);
        await options.onInteraction(questionInteraction({
          interactionId: 'abort-question',
          respond: async (result, responseOptions) => {
            cancellations.push({ result, responseOptions });
          },
        }));
        await new Promise((resolve, reject) => {
          if (options.signal.aborted) reject(options.signal.reason);
          else options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        });
        return 'unreachable';
      },
    },
    state: state(),
  });

  const prompt = bridge.accept(frame({ msgid: 'abort-start' }));
  await eventually(() => transport.active.length === 1);
  controller.abort(new DOMException('runtime stopped', 'AbortError'));
  await prompt;

  assert.equal(cancellations.length, 1);
  assert.equal(cancellations[0].result.ok, false);
  assert.equal(cancellations[0].result.error.code, 'cancelled');
  assert.equal(cancellations[0].responseOptions.signal.aborted, false);
  assert.equal(transport.streamed.some(({ content }) => content === '消息处理失败，请稍后重试。'), false);
});
