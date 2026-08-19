import assert from 'node:assert/strict';
import test from 'node:test';

import { DiscordHarnessBridge } from '../../../src/channels/discord/discord-bridge.mjs';
import { connectionTestTarget } from '../../../src/channels/shared/connection-test.mjs';
import { TextHarnessBridge } from '../../../src/channels/shared/text-harness-bridge.mjs';
import { SlackHarnessBridge } from '../../../src/channels/slack/slack-bridge.mjs';
import { TelegramHarnessBridge } from '../../../src/channels/telegram/telegram-bridge.mjs';
import { WhatsappHarnessBridge } from '../../../src/channels/whatsapp/whatsapp-bridge.mjs';

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

async function within(promise, timeoutMs, messageText) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(messageText)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
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

function approvalInteraction({
  id = 'approval-one',
  sessionId = 'session-one',
  toolName = 'bash',
  callId = 'call-one',
  reason = '测试审批链路',
  argumentsText = JSON.stringify({ command: "printf 'approval-test\\n'" }),
  respond = async () => ({ accepted: true }),
  ...rest
} = {}) {
  return {
    kind: 'approval',
    interactionId: id,
    rpcId: `rpc-${id}`,
    sessionId,
    payload: {
      type: 'approval/requested',
      sessionId,
      approvalId: id,
      toolName,
      callId,
      reason,
    },
    toolCall: { callId, name: toolName, arguments: argumentsText },
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

test('all four shared text channels execute /compact outside the model prompt path', async () => {
  for (const [name, Bridge] of [
    ['slack', SlackHarnessBridge],
    ['telegram', TelegramHarnessBridge],
    ['discord', DiscordHarnessBridge],
    ['whatsapp', WhatsappHarnessBridge],
  ]) {
    const fixture = stateFixture({ 'direct:chat-a': `session-${name}` });
    const sent = [];
    const executed = [];
    const bridge = new Bridge({
      bot: { sendText: async (_target, text) => sent.push(text) },
      state: fixture.state,
      harness: {
        executeCommand: async (sessionId, line) => {
          executed.push({ sessionId, line });
          return {
            commandId: `command-${name}`,
            result: { kind: 'success', text: 'Compacted 12 history items (~3456 tokens).' },
          };
        },
        ask: async () => assert.fail('/compact must not be submitted to the model'),
      },
    });

    await bridge.accept(message(`compact-${name}`, '/compact'));

    assert.deepEqual(executed, [{ sessionId: `session-${name}`, line: '/compact' }]);
    assert.deepEqual(sent, ['已压缩 12 条历史记录（约 3456 个 token）。']);
  }
});

test('all four shared text channels list models locally and advertise all four commands', async () => {
  for (const [name, Bridge] of [
    ['slack', SlackHarnessBridge],
    ['telegram', TelegramHarnessBridge],
    ['discord', DiscordHarnessBridge],
    ['whatsapp', WhatsappHarnessBridge],
  ]) {
    const fixture = stateFixture();
    const sent = [];
    let asks = 0;
    let creates = 0;
    const bridge = new Bridge({
      bot: { sendText: async (_target, text) => sent.push(text) },
      state: fixture.state,
      harness: {
        listModels: async () => ({
          groups: [{
            id: `${name}-provider`,
            name: `${name} Provider`,
            models: [{ id: 'model-one', name: 'Model One' }],
          }],
          failures: [],
        }),
        createSession: async () => { creates += 1; return `${name}-session`; },
        ask: async () => { asks += 1; return 'unexpected model reply'; },
      },
    });

    await bridge.accept(message(`models-${name}`, '/models'));
    assert.match(sent.at(-1), new RegExp(`1\\. ${name}-provider/model-one`), name);
    assert.equal(asks, 0, `${name} ask`);
    assert.equal(creates, 0, `${name} create`);
    assert.equal(fixture.sessions.size, 0, `${name} session binding`);

    await bridge.accept(message(`help-${name}`, '/help'));
    const help = sent.at(-1);
    for (const command of ['/models', '/model', '/stop', '/steer']) {
      assert.match(help, new RegExp(`\\${command}`), `${name} ${command}`);
    }
    assert.match(help, /\/model 2/, `${name} numbered model selection`);
  }
});

test('/stop uses the shared command fast lane without waiting for the running prompt', async () => {
  const fixture = stateFixture({ 'direct:chat-a': 'session-running' });
  const askStarted = deferred();
  const releaseAsk = deferred();
  const sent = [];
  const controls = {};
  let promptSettled = false;
  const session = {
    sessionExists: async () => true,
    ask: async (_text, options) => {
      controls.prompt = options.control;
      askStarted.resolve();
      await releaseAsk.promise;
      return '原任务完成';
    },
    stopActiveTurn: async (control) => {
      controls.stop = control;
      return true;
    },
  };
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (_target, text) => sent.push(text) },
    harness: { workspaceSession: () => session },
  });

  const prompt = bridge.accept(message('running-prompt', '执行一个长任务'))
    .finally(() => { promptSettled = true; });
  await askStarted.promise;

  await within(
    bridge.accept(message('running-stop', '/stop')),
    250,
    '/stop waited for the ordinary conversation queue',
  );
  assert.equal(promptSettled, false);
  assert.equal(sent.includes('已请求停止当前任务。'), true);
  assert.equal(controls.stop.owner, controls.prompt.owner);
  assert.equal(controls.stop.key, controls.prompt.key);

  releaseAsk.resolve();
  await prompt;
  assert.equal(sent.at(-1), '原任务完成');
});

test('a stopped shared-channel turn closes an opened stream instead of leaving a processing placeholder', async () => {
  const fixture = stateFixture({ 'direct:chat-a': 'session-running' });
  const finished = [];
  let cancelled = 0;
  const sent = [];
  const stopped = new Error('stopped');
  stopped.code = 'turn-stopped';
  const bridge = createBridge({
    state: fixture.state,
    bot: {
      sendText: async (_target, text) => sent.push(text),
      openStream: async () => ({
        update() {},
        async finish(text) { finished.push(text); },
        cancel() { cancelled += 1; },
      }),
    },
    harness: {
      workspaceSession: () => ({
        sessionExists: async () => true,
        ask: async () => { throw stopped; },
      }),
    },
  });

  await bridge.accept(message('stopped-stream', '执行长任务'));

  assert.deepEqual(finished, ['已停止。']);
  assert.equal(cancelled, 0);
  assert.deepEqual(sent, []);
});

test('Slack, Telegram, and Discord remember any valid direct message per bot', async () => {
  for (const [name, Bridge] of [
    ['slack', SlackHarnessBridge],
    ['telegram', TelegramHarnessBridge],
    ['discord', DiscordHarnessBridge],
  ]) {
    let sessionSequence = 0;
    const harness = {
      createSession: async () => `${name}-session-${++sessionSequence}`,
      ask: async () => `${name} reply`,
    };
    const first = stateFixture();
    const second = stateFixture();
    const firstSent = [];
    const secondSent = [];
    const firstBot = {
      sendText: async (target, text) => firstSent.push({ target, text }),
    };
    const secondBot = {
      sendText: async (target, text) => secondSent.push({ target, text }),
    };
    const firstBridge = new Bridge({ bot: firstBot, harness, state: first.state });
    const secondBridge = new Bridge({ bot: secondBot, harness, state: second.state });
    const firstTarget = { channelId: `${name}-private-a` };
    const secondTarget = { channelId: `${name}-private-b` };

    await firstBridge.accept(message(`${name}-direct-a`, 'hello', {
      conversationId: `${name}-private-a`,
      replyTarget: { ...firstTarget, replyToMessageId: 'reply-a' },
      connectionTestTarget: firstTarget,
    }));
    assert.deepEqual(connectionTestTarget(first.state), firstTarget, name);

    await firstBridge.accept(message(`${name}-group`, 'hello group', {
      kind: 'group',
      conversationId: `${name}-group`,
      addressed: true,
      replyTarget: { channelId: `${name}-group` },
      connectionTestTarget: { channelId: `${name}-group` },
    }));
    assert.deepEqual(connectionTestTarget(first.state), firstTarget, `${name} group`);

    await firstBridge.accept(message(`${name}-direct-a`, 'duplicate', {
      conversationId: `${name}-private-replay`,
      replyTarget: { channelId: `${name}-private-replay` },
      connectionTestTarget: { channelId: `${name}-private-replay` },
    }));
    assert.deepEqual(connectionTestTarget(first.state), firstTarget, `${name} duplicate`);

    await secondBridge.accept(message(`${name}-direct-b`, 'hello', {
      conversationId: `${name}-private-b`,
      replyTarget: { ...secondTarget, replyToMessageId: 'reply-b' },
      connectionTestTarget: secondTarget,
    }));
    assert.deepEqual(connectionTestTarget(second.state), secondTarget, `${name} second bot`);

    const reconnectedFirstBridge = new Bridge({ bot: firstBot, harness, state: first.state });
    await reconnectedFirstBridge.sendConnectionTest(`${name} first test`);
    await secondBridge.sendConnectionTest(`${name} second test`);
    assert.deepEqual(
      firstSent.find(({ text }) => text === `${name} first test`)?.target,
      firstTarget,
      `${name} reconnect`,
    );
    assert.deepEqual(
      secondSent.find(({ text }) => text === `${name} second test`)?.target,
      secondTarget,
      `${name} bot isolation`,
    );
  }
});

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

test('answers approvals on the interaction fast lane with precise text decisions', async () => {
  const fixture = stateFixture();
  const sent = [];
  const asked = [];
  const submitted = [];
  const cases = [
    { reply: '批准', outcome: 'allowed-once' },
    { reply: '同意', outcome: 'allowed-once' },
    { reply: '  YeS  ', outcome: 'allowed-once' },
    { reply: '拒绝', outcome: 'rejected' },
    { reply: '不同意', outcome: 'rejected' },
    { reply: '  NO  ', outcome: 'rejected' },
  ];
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      createSession: async () => 'session-one',
      ask: async (sessionId, text, options) => {
        asked.push({ sessionId, text });
        for (const [index, approvalCase] of cases.entries()) {
          const answered = deferred();
          await options.onInteraction(approvalInteraction({
            id: `approval-${index + 1}`,
            sessionId,
            toolName: `tool-${index + 1}`,
            reason: `精准回复测试 ${index + 1}`,
            respond: async (result) => {
              submitted.push(result);
              answered.resolve();
              return { accepted: true };
            },
          }));
          await answered.promise;
          assert.equal(submitted.at(-1).value.outcome, approvalCase.outcome);
        }
        return '所有审批已完成';
      },
    },
  });

  const processing = bridge.accept(message('approval-start', '启动审批测试'));
  for (const [index, approvalCase] of cases.entries()) {
    await eventually(() => sent.some(({ text }) => text.includes(`tool-${index + 1}`)));
    await bridge.accept(message(`approval-reply-${index + 1}`, approvalCase.reply));
  }
  await processing;

  assert.deepEqual(submitted, cases.map(({ outcome }, index) => ({
    ok: true,
    value: {
      sessionId: 'session-one',
      approvalId: `approval-${index + 1}`,
      outcome,
    },
  })));
  assert.deepEqual(asked, [{ sessionId: 'session-one', text: '启动审批测试' }]);
  assert.equal(sent.at(-1).text, '所有审批已完成');
});

test('all four shared text channel bridges inherit the approval fast lane', async () => {
  const channels = [
    ['Slack', SlackHarnessBridge],
    ['Discord', DiscordHarnessBridge],
    ['Telegram', TelegramHarnessBridge],
    ['WhatsApp', WhatsappHarnessBridge],
  ];

  for (const [label, Bridge] of channels) {
    const fixture = stateFixture();
    const sent = [];
    const submitted = deferred();
    const asked = [];
    const bridge = new Bridge({
      state: fixture.state,
      logger: { warn() {}, error() {} },
      bot: { sendText: async (target, text) => sent.push({ target, text }) },
      harness: {
        createSession: async () => 'session-one',
        ask: async (sessionId, text, options) => {
          asked.push(text);
          await options.onInteraction(approvalInteraction({
            id: `${label.toLowerCase()}-approval`,
            sessionId,
            toolName: `${label.toLowerCase()}-tool`,
            respond: async (result) => {
              submitted.resolve(result);
              return { accepted: true };
            },
          }));
          await submitted.promise;
          return `${label} 审批完成`;
        },
      },
    });

    const processing = bridge.accept(message(`${label}-prompt`, `${label} 启动审批`));
    await eventually(() => sent.some(({ text }) => text.includes(`${label.toLowerCase()}-tool`)));
    await bridge.accept(message(`${label}-decision`, '批准'));
    await processing;

    assert.equal((await submitted.promise).value.outcome, 'allowed-once', label);
    assert.deepEqual(asked, [`${label} 启动审批`], label);
    assert.equal(sent.at(-1).text, `${label} 审批完成`, label);
  }
});

test('keeps an imprecise approval reply out of the Harness prompt queue', async () => {
  const fixture = stateFixture();
  const sent = [];
  const asked = [];
  const submitted = deferred();
  let responseCalls = 0;
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      createSession: async () => 'session-one',
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction(approvalInteraction({
          sessionId,
          respond: async (result) => {
            responseCalls += 1;
            submitted.resolve(result);
            return { accepted: true };
          },
        }));
        await submitted.promise;
        return '审批已继续';
      },
    },
  });

  const processing = bridge.accept(message('imprecise-start', '启动精准匹配测试'));
  await eventually(() => sent.some(({ text }) => text.includes('测试审批链路')));
  const imprecise = bridge.accept(message('imprecise-reply', '好的'));
  await imprecise;
  assert.equal(responseCalls, 0);
  assert.deepEqual(asked, ['启动精准匹配测试']);

  const approval = bridge.accept(message('precise-reply', '批准'));
  await Promise.all([processing, approval]);

  assert.deepEqual(await submitted.promise, {
    ok: true,
    value: {
      sessionId: 'session-one',
      approvalId: 'approval-one',
      outcome: 'allowed-once',
    },
  });
  assert.deepEqual(asked, ['启动精准匹配测试']);
});

test('presents parallel approvals from one conversation in fifo order without codes', async () => {
  const fixture = stateFixture();
  const sent = [];
  const submitted = [];
  const firstAnswered = deferred();
  const secondAnswered = deferred();
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      createSession: async () => 'session-one',
      ask: async (sessionId, _text, options) => {
        await Promise.all([
          options.onInteraction(approvalInteraction({
            id: 'fifo-first-id',
            sessionId,
            toolName: 'first-tool',
            reason: '第一条审批',
            respond: async (result) => {
              submitted.push(result);
              firstAnswered.resolve();
              return { accepted: true };
            },
          })),
          options.onInteraction(approvalInteraction({
            id: 'fifo-second-id',
            sessionId,
            toolName: 'second-tool',
            reason: '第二条审批',
            respond: async (result) => {
              submitted.push(result);
              secondAnswered.resolve();
              return { accepted: true };
            },
          })),
        ]);
        await Promise.all([firstAnswered.promise, secondAnswered.promise]);
        return '并行审批已完成';
      },
    },
  });

  const processing = bridge.accept(message('fifo-start', '启动并行审批'));
  await eventually(() => sent.some(({ text }) => text.includes('first-tool')));
  assert.equal(sent.some(({ text }) => text.includes('second-tool')), false);

  await bridge.accept(message('fifo-first-reply', '批准'));
  await eventually(() => sent.some(({ text }) => text.includes('second-tool')));
  await bridge.accept(message('fifo-second-reply', '拒绝'));
  await processing;

  const approvalMessages = sent.filter(({ text }) => (
    text.includes('first-tool') || text.includes('second-tool')
  ));
  assert.equal(approvalMessages.length, 2);
  assert.match(approvalMessages[0].text, /first-tool/);
  assert.match(approvalMessages[1].text, /second-tool/);
  assert.equal(approvalMessages.some(({ text }) => (
    text.includes('fifo-first-id') || text.includes('fifo-second-id')
  )), false);
  assert.deepEqual(submitted.map(({ value }) => ({
    approvalId: value.approvalId,
    outcome: value.outcome,
  })), [
    { approvalId: 'fifo-first-id', outcome: 'allowed-once' },
    { approvalId: 'fifo-second-id', outcome: 'rejected' },
  ]);
});

test('a completed approval tombstone never steals yes or no from a live question', async () => {
  const fixture = stateFixture();
  const sent = [];
  const approvalDone = deferred();
  const questionDone = deferred();
  let questionResponse;
  const asked = [];
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      createSession: async () => 'session-one',
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction(approvalInteraction({
          sessionId,
          respond: async () => {
            approvalDone.resolve();
            return { accepted: true };
          },
        }));
        await approvalDone.promise;
        await options.onInteraction(questionInteraction({
          id: 'question-after-approval',
          sessionId,
          questions: [{ id: 'continue', question: '是否继续？' }],
          respond: async (result) => {
            questionResponse = result;
            questionDone.resolve();
            return { accepted: true };
          },
        }));
        await questionDone.promise;
        return '审批和提问均已完成';
      },
    },
  });

  const processing = bridge.accept(message('approval-then-question', '开始组合交互'));
  await eventually(() => sent.some(({ text }) => text.includes("printf 'approval-test")));
  await bridge.accept(message('approval-before-question', '批准'));
  await eventually(() => sent.some(({ text }) => text.includes('是否继续？')));
  await bridge.accept(message('question-yes', 'yes'));
  await processing;

  assert.deepEqual(questionResponse.value.answer.answers, [{
    id: 'continue',
    selected: [],
    custom: 'yes',
  }]);
  assert.deepEqual(asked, ['开始组合交互']);
  assert.equal(sent.at(-1).text, '审批和提问均已完成');
});

test('a sibling approval waits for an in-flight question answer without deadlocking', async () => {
  const fixture = stateFixture();
  const sent = [];
  const questionResponseStarted = deferred();
  const releaseQuestionResponse = deferred();
  const questionDone = deferred();
  const approvalDone = deferred();
  const asked = [];
  const questionResponses = [];
  const approvalResponses = [];
  const bridge = createBridge({
    state: fixture.state,
    bot: { sendText: async (target, text) => sent.push({ target, text }) },
    harness: {
      createSession: async () => 'session-one',
      ask: async (sessionId, text, options) => {
        asked.push(text);
        await options.onInteraction(approvalInteraction({
          id: 'sibling-approval',
          sessionId,
          respond: async (result) => {
            approvalResponses.push(result);
            approvalDone.resolve();
            return { accepted: true };
          },
        }));
        await options.onInteraction(questionInteraction({
          id: 'sibling-question',
          sessionId,
          questions: [{ id: 'continue', question: '是否继续执行？' }],
          respond: async (result) => {
            questionResponses.push(result);
            questionResponseStarted.resolve();
            await releaseQuestionResponse.promise;
            questionDone.resolve();
            return { accepted: true };
          },
        }));
        await Promise.all([questionDone.promise, approvalDone.promise]);
        return '组合交互已完成';
      },
    },
  });

  const processing = bridge.accept(message('sibling-start', '启动并行交互'));
  await eventually(() => sent.some(({ text }) => text.includes('是否继续执行？')));
  const answeringQuestion = bridge.accept(message('sibling-question-answer', 'yes'));
  await questionResponseStarted.promise;
  const approving = bridge.accept(message('sibling-approval-answer', '批准'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(approvalResponses.length, 0);

  releaseQuestionResponse.resolve();
  await Promise.all([answeringQuestion, approving, processing]);
  assert.deepEqual(questionResponses[0].value.answer.answers, [{
    id: 'continue',
    selected: [],
    custom: 'yes',
  }]);
  assert.equal(approvalResponses[0].value.outcome, 'allowed-once');
  assert.deepEqual(asked, ['启动并行交互']);
  assert.equal(sent.at(-1).text, '组合交互已完成');
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

test('deduplicates replays and safely closes recovered questions and approvals', async () => {
  const fixture = stateFixture();
  const sent = [];
  let parallelResponse;
  let recoveredResponse;
  let approvalResponse;
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
        await options.onInteraction(approvalInteraction({
          id: 'orphan-approval',
          sessionId,
          recovered: true,
          respond: async (result) => { approvalResponse = result; },
        }));
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
  assert.deepEqual(approvalResponse, {
    ok: true,
    value: {
      sessionId: 'session-one',
      approvalId: 'orphan-approval',
      outcome: 'rejected',
    },
  });
  assert.equal(sent.some(({ text }) => text.includes("printf 'approval-test")), false);
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
