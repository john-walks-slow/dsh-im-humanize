import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDingtalkBridgeStatus,
  DingtalkHarnessBridge,
} from '../../../src/channels/dingtalk/dingtalk-bridge.mjs';
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

async function eventually(predicate, message = 'condition was not met') {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(message);
}

function message(id, text, overrides = {}) {
  return {
    msgId: id,
    msgtype: 'text',
    text: { content: text },
    conversationType: '1',
    conversationId: `conversation-${id}`,
    senderStaffId: 'staff-approved',
    senderNick: '钉钉用户',
    sessionWebhook: `https://oapi.dingtalk.com/robot/reply?ticket=${id}`,
    ...overrides,
  };
}

function stateFixture() {
  const sessions = new Map();
  const seen = new Set();
  const pending = new Map();
  return {
    sessions,
    seen,
    pending,
    state: {
      hasSeen: (id) => seen.has(id),
      markSeen: async (id) => seen.add(id),
      sessionFor: (key) => sessions.get(key) ?? null,
      setSession: async (key, sessionId) => sessions.set(key, sessionId),
      clearSession: async (key) => sessions.delete(key),
      pendingSenders: () => [...pending.values()].map((entry) => structuredClone(entry)),
      recordPendingSender: async ({ staffId, displayName, lastSeenAt }) => {
        const existing = [...pending.values()].find((entry) => entry.staffId === staffId);
        const entry = {
          requestId: existing?.requestId ?? `request-${staffId}`,
          staffId,
          displayName,
          requestedAt: existing?.requestedAt ?? lastSeenAt,
          lastSeenAt,
        };
        pending.set(entry.requestId, entry);
        return structuredClone(entry);
      },
      removePendingSenderByStaffId: async (staffId) => {
        const entry = [...pending.values()].find((value) => value.staffId === staffId);
        if (!entry) return false;
        pending.delete(entry.requestId);
        return true;
      },
    },
  };
}

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x01, 0x02, 0x03,
]);

test('DingTalk remembers any private inbound session webhook for connection tests', async () => {
  const privateFixture = stateFixture();
  const privateSent = [];
  const privateBridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => privateSent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: { ensureRunning: async () => true },
    state: privateFixture.state,
  });
  await privateBridge.accept(message('help-private', '/help'));
  assert.deepEqual(connectionTestTarget(privateFixture.state), {
    sessionWebhook: 'https://oapi.dingtalk.com/robot/reply?ticket=help-private',
  });
  assert.match(privateSent.at(-1).text, /\/help/);

  const groupFixture = stateFixture();
  const groupBridge = new DingtalkHarnessBridge({
    api: { sendText: async () => {} },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: { ensureRunning: async () => true },
    state: groupFixture.state,
  });
  await groupBridge.accept(message('help-group', '/help', {
    conversationType: '2',
    conversationId: 'group-help',
    isInAtList: true,
  }));
  assert.equal(connectionTestTarget(groupFixture.state), null);
});

test('DingTalk resolves picture downloadCode lazily and sends image-only content to Harness', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:staff-approved', 'session-image');
  const downloads = [];
  const prompts = [];
  const sent = [];
  const bridge = new DingtalkHarnessBridge({
    api: {
      downloadImage: async (request) => {
        downloads.push(request);
        return PNG_BYTES;
      },
      sendText: async (request) => sent.push(request),
    },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      ask: async (sessionId, content) => {
        prompts.push({ sessionId, content });
        return '钉钉图片已识别';
      },
    },
    state: fixture.state,
  });

  await bridge.accept(message('dingtalk-picture', '', {
    msgtype: 'picture',
    text: undefined,
    content: JSON.stringify({ downloadCode: 'opaque-picture-code' }),
    robotCode: 'robot-from-callback',
  }));

  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].clientId, 'ding-client');
  assert.equal(downloads[0].clientSecret, 'host-secret');
  assert.equal(downloads[0].robotCode, 'robot-from-callback');
  assert.equal(downloads[0].downloadCode, 'opaque-picture-code');
  assert.equal(downloads[0].maxBytes, 5 * 1024 * 1024);
  assert.equal(prompts[0].sessionId, 'session-image');
  assert.deepEqual(prompts[0].content.map(({ type }) => type), ['text', 'image']);
  assert.equal(prompts[0].content[0].text, '请分析这张图片。');
  assert.equal(prompts[0].content[1].mediaType, 'image/png');
  assert.equal(Buffer.from(prompts[0].content[1].data, 'base64').equals(PNG_BYTES), true);
  assert.equal(sent.at(-1).text, '钉钉图片已识别');
});

test('DingTalk richText preserves its caption and all picture download codes', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:staff-approved', 'session-rich-image');
  const codes = [];
  let prompt;
  const bridge = new DingtalkHarnessBridge({
    api: {
      downloadImage: async ({ downloadCode }) => {
        codes.push(downloadCode);
        return PNG_BYTES;
      },
      sendText: async () => {},
    },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      ask: async (_sessionId, content) => { prompt = content; return '完成'; },
    },
    state: fixture.state,
  });

  await bridge.accept(message('dingtalk-rich-picture', '', {
    msgtype: 'richText',
    text: undefined,
    robotCode: 'robot-from-callback',
    content: {
      richText: [
        { type: 'text', text: '请对比' },
        { type: 'picture', pictureDownloadCode: 'picture-one' },
        { type: 'text', text: { content: '这两张图' } },
        { type: 'picture', downloadCode: 'picture-two' },
      ],
    },
  }));

  assert.deepEqual(codes, ['picture-one', 'picture-two']);
  assert.deepEqual(prompt.map(({ type }) => type), ['text', 'image', 'image']);
  assert.equal(prompt[0].text, '请对比\n这两张图');
});

test('DingTalk checks the group mention before downloading a picture', async () => {
  let downloads = 0;
  let asks = 0;
  const bridge = new DingtalkHarnessBridge({
    api: {
      downloadImage: async () => { downloads += 1; return PNG_BYTES; },
      sendText: async () => {},
    },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: { ask: async () => { asks += 1; return 'unexpected'; } },
    state: stateFixture().state,
  });

  await bridge.accept(message('dingtalk-unmentioned-picture', '', {
    msgtype: 'picture',
    text: undefined,
    content: { downloadCode: 'private-picture' },
    robotCode: 'robot-from-callback',
    conversationType: '2',
    conversationId: 'group-image',
    isInAtList: false,
  }));

  assert.equal(downloads, 0);
  assert.equal(asks, 0);
});

test('DingTalk returns a specific retry message when picture download fails', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:staff-approved', 'session-image');
  const sent = [];
  const bridge = new DingtalkHarnessBridge({
    api: {
      downloadImage: async () => { throw new Error('temporary URL expired'); },
      sendText: async (request) => sent.push(request),
    },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      ask: async () => assert.fail('a failed image must not reach Harness'),
    },
    state: fixture.state,
    logger: { error() {} },
  });

  await bridge.accept(message('dingtalk-picture-error', '', {
    msgtype: 'picture',
    text: undefined,
    content: { downloadCode: 'expired-picture' },
    robotCode: 'robot-from-callback',
  }));

  assert.equal(sent.at(-1).text, '图片下载失败，请重新发送后再试。');
});

test('DingTalk distinguishes download-address failures from temporary-file failures', async () => {
  for (const [code, expected] of [
    [
      'image-download-address-failed',
      '钉钉未能换取图片下载地址，请重新发送；若持续失败，请检查机器人的“企业内机器人发送消息权限”。',
    ],
    ['image-content-download-failed', '钉钉返回的图片临时地址无法读取，请重新发送。'],
  ]) {
    const fixture = stateFixture();
    const sent = [];
    const bridge = new DingtalkHarnessBridge({
      api: {
        downloadImage: async () => {
          const error = new Error('safe stage marker');
          error.code = code;
          throw error;
        },
        sendText: async (request) => sent.push(request),
      },
      clientId: 'ding-client',
      clientSecret: 'host-secret',
      harness: { ask: async () => assert.fail('a failed image must not reach Harness') },
      state: fixture.state,
      logger: { error() {} },
    });

    await bridge.accept(message(`dingtalk-${code}`, '', {
      msgtype: 'picture',
      text: undefined,
      content: { downloadCode: 'opaque-picture-code' },
      robotCode: 'robot-from-callback',
    }));

    assert.equal(sent.at(-1).text, expected);
  }
});

test('DingTalk executes /compact for the bound Session without prompting the model', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:staff-approved', 'session-compact');
  const sent = [];
  const executed = [];
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      executeCommand: async (sessionId, line) => {
        executed.push({ sessionId, line });
        return { commandId: 'compact-dingtalk', result: { kind: 'success', text: 'No compactable history yet.' } };
      },
      ask: async () => assert.fail('/compact must not be submitted to the model'),
    },
    state: fixture.state,
  });

  await bridge.accept(message('compact-dingtalk', '/compact'));

  assert.deepEqual(executed, [{ sessionId: 'session-compact', line: '/compact' }]);
  assert.equal(sent.at(-1).text, '暂无可压缩的历史记录。');
});

test('DingTalk lists models without prompting and help advertises all four commands', async () => {
  const fixture = stateFixture();
  const sent = [];
  let asks = 0;
  let creates = 0;
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      listModels: async () => ({
        groups: [{
          id: 'dingtalk-provider',
          name: 'DingTalk Provider',
          models: [{ id: 'model-one', name: 'Model One' }],
        }],
        failures: [],
      }),
      createSession: async () => { creates += 1; return 'dingtalk-session'; },
      ask: async () => { asks += 1; return 'unexpected model reply'; },
    },
    state: fixture.state,
  });

  await bridge.accept(message('models-dingtalk', '/models'));
  assert.match(sent.at(-1).text, /1\. dingtalk-provider\/model-one/);
  assert.equal(asks, 0);
  assert.equal(creates, 0);
  assert.equal(fixture.sessions.size, 0);

  await bridge.accept(message('help-models-dingtalk', '/help'));
  const help = sent.at(-1).text;
  for (const command of ['/models', '/model', '/stop', '/steer']) {
    assert.equal(help.includes(command), true, command);
  }
  assert.match(help, /\/model 2/);
});

test('bridge maps a DingTalk direct conversation to one persistent Harness session', async () => {
  const fixture = stateFixture();
  const sent = [];
  const asked = [];
  const status = createDingtalkBridgeStatus();
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async (sessionId) => sessionId === 'session-one',
      createSession: async () => 'session-one',
      ask: async (sessionId, text) => {
        asked.push({ sessionId, text });
        return 'Harness 回答';
      },
    },
    state: fixture.state,
    status,
  });

  await Promise.all([
    bridge.accept(message('one', '你好')),
    bridge.accept(message('one', '重复消息')),
  ]);
  await bridge.accept(message('two', '继续'));

  assert.equal(fixture.sessions.get('p2p:staff-approved'), 'session-one');
  assert.deepEqual(asked, [
    { sessionId: 'session-one', text: '你好' },
    { sessionId: 'session-one', text: '继续' },
  ]);
  assert.deepEqual(sent.map(({ text, sessionWebhook }) => ({ text, sessionWebhook })), [
    { text: 'Harness 回答', sessionWebhook: 'https://oapi.dingtalk.com/robot/reply?ticket=one' },
    { text: 'Harness 回答', sessionWebhook: 'https://oapi.dingtalk.com/robot/reply?ticket=two' },
  ]);
  assert.equal(status.messagesReceived, 2);
  assert.equal(status.messagesReplied, 2);
  assert.equal(status.stats.messagesReplied, 2);
});

test('senders in the bot visibility scope enter Harness without local approval', async () => {
  const fixture = stateFixture();
  const sent = [];
  const asked = [];
  const status = createDingtalkBridgeStatus();
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-visible-sender',
      ask: async (sessionId, text) => {
        asked.push({ sessionId, text });
        return '直接回答';
      },
    },
    state: fixture.state,
    status,
  });

  await bridge.accept(message('visible', '可见范围内的问题', {
    senderStaffId: 'raw-staff-id',
    senderNick: '可见范围用户',
  }));

  assert.deepEqual(asked, [{
    sessionId: 'session-visible-sender',
    text: '可见范围内的问题',
  }]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].text, '直接回答');
  assert.equal(fixture.pending.size, 0);
  assert.deepEqual(status.pendingSenders, []);
  assert.equal(status.messagesRejected, 0);
  assert.equal(status.messagesReplied, 1);
});

test('group messages require an explicit bot mention before Harness work', async () => {
  const fixture = stateFixture();
  const sent = [];
  const asked = [];
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-group',
      ask: async (_sessionId, text) => {
        asked.push(text);
        return '群聊回答';
      },
    },
    state: fixture.state,
  });
  const group = {
    conversationType: '2',
    conversationId: 'group-one',
  };

  await bridge.accept(message('not-mentioned', '群聊噪音', { ...group, isInAtList: false }));
  await bridge.accept(message('mentioned', '明确问题', { ...group, isInAtList: true }));

  assert.deepEqual(asked, ['明确问题']);
  assert.deepEqual(sent.map(({ text }) => text), ['群聊回答']);
  assert.equal(bridge.status.messagesIgnored, 1);
  assert.equal(fixture.sessions.get('group:group-one'), 'session-group');
});

test('bridge streams Harness snapshots into one DingTalk AI Card and finalizes it', async () => {
  const fixture = stateFixture();
  const calls = { create: [], update: [], finish: [], text: [] };
  const bridge = new DingtalkHarnessBridge({
    api: {
      sendText: async (request) => calls.text.push(request),
      createAiCard: async (request) => {
        calls.create.push(request);
        return { cardInstanceId: 'card-one' };
      },
      updateAiCard: async (request) => calls.update.push(request),
      finishAiCard: async (request) => {
        calls.finish.push(request);
        return { delivered: true, completed: false };
      },
    },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-stream',
      ask: async (_sessionId, _text, options) => {
        options.onUpdate({ type: 'text', text: '生成中的完整快照' });
        await new Promise((resolve) => setTimeout(resolve, 510));
        return '最终完整回答';
      },
    },
    state: fixture.state,
  });

  await bridge.accept(message('stream', '请流式回答'));

  assert.equal(calls.create.length, 1);
  assert.deepEqual(calls.create[0].target, { type: 'user', userId: 'staff-approved' });
  assert.equal(calls.update.at(-1).text, '生成中的完整快照');
  assert.equal(calls.finish.length, 1);
  assert.equal(calls.finish[0].text, '最终完整回答');
  assert.equal(calls.text.length, 0);
  assert.equal(bridge.status.messagesReplied, 1);
});

test('bridge asks Harness once and falls back to final text when AI Card creation fails', async () => {
  const fixture = stateFixture();
  const sent = [];
  let asks = 0;
  const bridge = new DingtalkHarnessBridge({
    api: {
      sendText: async (request) => sent.push(request.text),
      createAiCard: async () => { throw new Error('card unavailable'); },
      updateAiCard: async () => undefined,
      finishAiCard: async () => undefined,
    },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-fallback',
      ask: async () => {
        asks += 1;
        return '文本降级回答';
      },
    },
    state: fixture.state,
    logger: { error() {} },
  });

  await bridge.accept(message('fallback', '卡片失败也要回答'));

  assert.equal(asks, 1);
  assert.deepEqual(sent, ['文本降级回答']);
  assert.equal(bridge.status.messagesReplied, 1);
});

test('commands stay local and unsafe session webhooks are rejected before Harness', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:staff-approved', 'old-session');
  const sent = [];
  let asked = 0;
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request.text) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      ensureRunning: async () => true,
      sessionExists: async () => true,
      ask: async () => { asked += 1; },
    },
    state: fixture.state,
    logger: { warn() {}, error() {} },
  });

  await bridge.accept(message('new', '/new'));
  assert.equal(fixture.sessions.has('p2p:staff-approved'), false);
  await bridge.accept(message('unsafe', '不应执行', {
    sessionWebhook: 'https://oapi.dingtalk.com.attacker.example/reply?private=one',
  }));
  assert.equal(asked, 0);
  assert.equal(sent[0], '已开启新会话。请发送你的问题。');
  assert.equal(sent.length, 1);
  assert.equal(bridge.status.lastError, '钉钉消息没有安全的回复地址。');
});

test('a DingTalk reply answers a pending Harness question before the original turn queue', async () => {
  const fixture = stateFixture();
  const sent = [];
  const asked = [];
  const response = deferred();
  const releaseTurn = deferred();
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-question',
      ask: async (sessionId, text, options) => {
        asked.push({ sessionId, text });
        await options.onInteraction({
          kind: 'question',
          rpcId: 'question-rpc',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{
              id: 'environment',
              header: '运行环境',
              question: '请问要使用哪个环境？',
              options: [
                { label: '生产环境', description: '处理真实数据' },
                { label: '预发环境' },
              ],
            }],
          },
          respond: async (result) => {
            response.resolve(result);
            return { accepted: true };
          },
        });
        await response.promise;
        await releaseTurn.promise;
        return '已按测试环境继续。';
      },
    },
    state: fixture.state,
  });

  let firstSettled = false;
  const first = bridge.accept(message('prompt', '先问我一个问题'))
    .finally(() => { firstSettled = true; });
  await eventually(() => sent.some(({ text }) => text.includes('请问要使用哪个环境')));

  await Promise.race([
    bridge.accept(message('answer', '测试环境')),
    new Promise((_, reject) => setTimeout(() => reject(new Error('question reply deadlocked')), 500)),
  ]);

  assert.equal(firstSettled, false);
  assert.deepEqual(await response.promise, {
    ok: true,
    value: {
      sessionId: 'session-question',
      answer: {
        answers: [{ id: 'environment', selected: [], custom: '测试环境' }],
      },
    },
  });
  assert.deepEqual(asked, [{ sessionId: 'session-question', text: '先问我一个问题' }]);

  releaseTurn.resolve();
  await first;
  assert.equal(sent.length, 2);
  assert.match(sent[0].text, /DeepSeek Harness 需要你补充信息/);
  assert.equal(sent[1].text, '已按测试环境继续。');
  assert.equal(bridge.status.messagesReceived, 2);
  assert.equal(bridge.status.messagesReplied, 1);
});

test('pending questions are isolated by DingTalk conversation', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('p2p:staff-a', 'session-a');
  fixture.sessions.set('p2p:staff-b', 'session-b');
  const sent = [];
  const asked = [];
  const answeredA = deferred();
  const releaseA = deferred();
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('existing sessions should be reused'),
      ask: async (sessionId, text, options) => {
        asked.push({ sessionId, text });
        if (sessionId === 'session-b') return '乙会话的普通回答';
        await options.onInteraction({
          kind: 'question',
          rpcId: 'rpc-a',
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
  });

  const firstA = bridge.accept(message('a-prompt', '启动甲会话', {
    senderStaffId: 'staff-a',
  }));
  await eventually(() => sent.some(({ text }) => text.includes('甲会话的问题')));

  await bridge.accept(message('b-message', '乙会话的消息', {
    senderStaffId: 'staff-b',
  }));
  assert.deepEqual(asked, [
    { sessionId: 'session-a', text: '启动甲会话' },
    { sessionId: 'session-b', text: '乙会话的消息' },
  ]);
  assert.equal(sent.some(({ text }) => text === '乙会话的普通回答'), true);

  await bridge.accept(message('a-answer', '甲的答案', { senderStaffId: 'staff-a' }));
  assert.deepEqual((await answeredA.promise).value.answer.answers, [
    { id: 'a', selected: [], custom: '甲的答案' },
  ]);
  releaseA.resolve();
  await firstA;
});

test('DingTalk handles approval replies on the fast lane and presents approvals in FIFO order', async () => {
  const fixture = stateFixture();
  const sent = [];
  const asked = [];
  const decisions = [];
  const decided = deferred();
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-approval',
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
  });

  const turn = bridge.accept(message('approval-start', '发起两个审批'));
  await eventually(() => sent.some(({ text }) => text.includes('运行第一项构建操作')));
  assert.equal(sent.some(({ text }) => text.includes('运行第二项写入操作')), false);
  assert.equal(sent.some(({ text }) => text.includes('approval-build')), false);

  await bridge.accept(message('approval-invalid', '好的'));
  assert.deepEqual(decisions, []);
  assert.deepEqual(asked, [{ sessionId: 'session-approval', text: '发起两个审批' }]);
  assert.match(sent.at(-1).text, /批准/);
  assert.match(sent.at(-1).text, /拒绝/);

  await bridge.accept(message('approval-allow', '批准'));
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

  await bridge.accept(message('approval-reject', '拒绝'));
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
  let secondQuestionResponse;
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-replay',
      ask: async (sessionId, _text, options) => {
        const question = {
          kind: 'question',
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
            secondQuestionResponse = result;
            return { accepted: true };
          },
        });
        await options.onInteraction({
          kind: 'approval',
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
    logger: { warn() {}, error() {} },
  });

  await bridge.accept(message('replay', '测试重放'));

  assert.equal(sent.filter(({ text }) => text.includes('只应显示一次')).length, 1);
  assert.deepEqual(secondQuestionResponse, {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'DingTalk is already handling another user interaction.',
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

test('a message arriving during question submission is re-queued as the next normal prompt', async () => {
  const fixture = stateFixture();
  const sent = [];
  const asked = [];
  const submitStarted = deferred();
  const releaseSubmit = deferred();
  const answered = deferred();
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-submit-race',
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text === '下一个真实问题') return '第二轮回答';
        const interaction = {
          kind: 'question',
          interactionId: 'submit-race-question',
          rpcId: 'submit-race-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'answer', question: '请先回答当前问题' }],
          },
          respond: async (result) => {
            submitStarted.resolve(result);
            await releaseSubmit.promise;
            answered.resolve();
            return { accepted: true };
          },
        };
        await options.onInteraction(interaction);
        await answered.promise;
        return '第一轮回答';
      },
    },
    state: fixture.state,
  });

  const first = bridge.accept(message('submit-start', '启动交互'));
  await eventually(() => sent.some(({ text }) => text.includes('请先回答当前问题')));
  const answer = bridge.accept(message('submit-answer', '当前问题的答案'));
  await submitStarted.promise;

  let nextSettled = false;
  const next = bridge.accept(message('submit-next', '下一个真实问题'))
    .finally(() => { nextSettled = true; });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(nextSettled, false);

  releaseSubmit.resolve();
  await Promise.all([answer, first, next]);
  assert.deepEqual(asked, ['启动交互', '下一个真实问题']);
  assert.equal(asked.includes('当前问题的答案'), false);
  assert.deepEqual(sent.slice(-2).map(({ text }) => text), ['第一轮回答', '第二轮回答']);
});

test('a queued next prompt stays separate when question submission must be retried', async () => {
  const fixture = stateFixture();
  const sent = [];
  const asked = [];
  const firstSubmitStarted = deferred();
  const releaseFirstSubmit = deferred();
  const answered = deferred();
  const submittedAnswers = [];
  let submitAttempts = 0;
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-submit-retry-race',
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
    logger: { error() {}, warn() {} },
  });

  const first = bridge.accept(message('submit-retry-start', '启动可重试交互'));
  await eventually(() => sent.some(({ text }) => text.includes('请回答后再继续')));
  const firstAnswer = bridge.accept(message('submit-retry-answer', '第一次答案'));
  await firstSubmitStarted.promise;

  let nextSettled = false;
  const next = bridge.accept(message('submit-retry-next', '排队的下一个问题'))
    .finally(() => { nextSettled = true; });
  releaseFirstSubmit.resolve();
  await firstAnswer;
  await eventually(() => sent.some(({ text }) => text.includes('回答提交失败')));
  assert.equal(nextSettled, false);
  assert.deepEqual(asked, ['启动可重试交互']);

  const retry = bridge.accept(message('submit-retry-again', '重试后的答案'));
  await Promise.all([retry, first, next]);

  assert.deepEqual(submittedAnswers, ['第一次答案', '重试后的答案']);
  assert.deepEqual(asked, ['启动可重试交互', '排队的下一个问题']);
  assert.deepEqual(sent.slice(-2).map(({ text }) => text), ['第一轮完成', '第二轮完成']);
});

test('an invalid pending reply does not block the valid answer behind it', async () => {
  const fixture = stateFixture();
  const sent = [];
  const invalidNoticeStarted = deferred();
  const releaseInvalidNotice = deferred();
  const answered = deferred();
  let submitted;
  const bridge = new DingtalkHarnessBridge({
    api: {
      sendText: async (request) => {
        if (request.text === '请用文字回答当前问题。') {
          invalidNoticeStarted.resolve();
          await releaseInvalidNotice.promise;
        }
        sent.push(request);
      },
    },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-invalid-reply',
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
  });

  const first = bridge.accept(message('invalid-reply-start', '启动交互'));
  await eventually(() => sent.some(({ text }) => text.includes('请给出有效文字答案')));
  const invalid = bridge.accept(message('invalid-reply-image', '', {
    msgtype: 'picture',
    text: undefined,
  }));
  await invalidNoticeStarted.promise;
  const valid = bridge.accept(message('invalid-reply-valid', '真正的答案'));
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
  const fixture = stateFixture();
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
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-resolved-race',
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
  });

  const first = bridge.accept(message('resolved-race-start', '启动外部解决竞态'));
  await eventually(() => typeof resolveInteraction === 'function');
  const answer = bridge.accept(message('resolved-answer-first', '原本的问题答案'));
  await answerMarkStarted.promise;
  const later = bridge.accept(message('resolved-later-second', '后来的普通问题'));
  await resolveInteraction();
  releaseAnswerMark.resolve();

  await Promise.all([answer, first, later]);
  assert.deepEqual(asked, ['启动外部解决竞态', '后来的普通问题']);
  assert.equal(asked.includes('原本的问题答案'), false);
  assert.equal(sent.some(({ text }) => text.includes('已在其他客户端处理')), true);
});

test('an orphan question is cancelled without exposing it to a new conversation', async () => {
  const fixture = stateFixture();
  const sent = [];
  let recoveredResponse;
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-orphan-recovery',
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
  });

  await bridge.accept(message('orphan-recovery', '新的会话消息'));
  assert.deepEqual(recoveredResponse, {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'DingTalk safely cancelled an interaction left by an earlier client.',
      details: {},
    },
  });
  assert.equal(sent.some(({ text }) => text.includes('旧会话中的敏感问题内容')), false);
  assert.equal(sent.some(({ text }) => text.includes('遗留的待回答问题')), true);
  assert.equal(sent.at(-1).text, '新的消息已继续');
});

test('question delivery replays safely and a multi-question batch keeps canonical answers', async () => {
  const fixture = stateFixture();
  const sent = [];
  const response = deferred();
  let firstQuestionAttempts = 0;
  let secondQuestionAttempts = 0;
  let replayTask = Promise.resolve();
  const bridge = new DingtalkHarnessBridge({
    api: {
      sendText: async (request) => {
        if (request.text.includes('选择回答语言')) {
          firstQuestionAttempts += 1;
          if (firstQuestionAttempts === 1) throw new Error('temporary first question failure');
        }
        if (request.text.includes('选择交付内容')) {
          secondQuestionAttempts += 1;
          if (secondQuestionAttempts === 1) throw new Error('temporary second question failure');
        }
        sent.push(request);
      },
    },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-question-batch',
      ask: async (sessionId, _text, options) => {
        // An already-started turn remains the owner even if a workspace switch
        // clears the conversation-to-session mapping while it is running.
        fixture.sessions.delete('p2p:staff-approved');
        const interaction = {
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
          reconnect: () => {
            replayTask = new Promise((resolve, reject) => {
              queueMicrotask(() => options.onInteraction(interaction).then(resolve, reject));
            });
          },
          respond: async (result) => {
            response.resolve(result);
            return { accepted: true };
          },
        };
        await assert.rejects(
          options.onInteraction(interaction),
          /temporary first question failure/,
        );
        await options.onInteraction(interaction);
        await response.promise;
        return '批量问题已完成';
      },
    },
    state: fixture.state,
    logger: { error() {}, warn() {} },
  });

  const first = bridge.accept(message('batch-start', '请分步提问'));
  await eventually(() => sent.some(({ text }) => text.includes('选择回答语言')));
  await bridge.accept(message('batch-language', '2'));
  await eventually(() => sent.some(({ text }) => text.includes('选择交付内容')));
  await replayTask;
  await bridge.accept(message('batch-deliverables', '1，文档，发布说明'));

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
  assert.equal(firstQuestionAttempts, 2);
  assert.equal(secondQuestionAttempts, 2);
  await first;
  assert.equal(sent.at(-1).text, '批量问题已完成');
});

test('aborting a DingTalk turn cancels its pending Harness question', async () => {
  const fixture = stateFixture();
  const controller = new AbortController();
  const sent = [];
  const cancelled = deferred();
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-cancel-question',
      ask: async (sessionId, _text, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'question-to-cancel',
          rpcId: 'question-to-cancel',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'cancel', question: '等待重连前取消' }],
          },
          respond: async (result) => {
            cancelled.resolve(result);
            return { accepted: true };
          },
        });
        await new Promise((resolve, reject) => {
          if (options.signal.aborted) {
            reject(options.signal.reason);
            return;
          }
          options.signal.addEventListener('abort', () => reject(options.signal.reason), {
            once: true,
          });
        });
      },
    },
    state: fixture.state,
    signal: controller.signal,
  });

  const processing = bridge.accept(message('cancel-start', '启动后停止'));
  await eventually(() => sent.some(({ text }) => text.includes('等待重连前取消')));
  controller.abort(new DOMException('runtime stopped', 'AbortError'));
  await processing;

  assert.deepEqual(await cancelled.promise, {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'The DingTalk interaction ended before the user answered.',
      details: {},
    },
  });
});

test('group questions tell users to mention the bot and ignore unmentioned answers', async () => {
  const fixture = stateFixture();
  const sent = [];
  const answered = deferred();
  let responseCalls = 0;
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (request) => sent.push(request) },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => false,
      createSession: async () => 'session-group-question',
      ask: async (sessionId, _text, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'group-question',
          rpcId: 'group-question',
          sessionId,
          payload: {
            type: 'question/requested',
            sessionId,
            questions: [{ id: 'group', question: '群聊问题' }],
          },
          respond: async () => {
            responseCalls += 1;
            answered.resolve();
            return { accepted: true };
          },
        });
        await answered.promise;
        return '群聊交互完成';
      },
    },
    state: fixture.state,
  });
  const group = {
    conversationType: '2',
    conversationId: 'group-question-room',
  };

  const first = bridge.accept(message('group-start', '开始群聊问答', {
    ...group,
    isInAtList: true,
  }));
  await eventually(() => sent.some(({ text }) => text.includes('群聊问题')));
  assert.match(sent[0].text, /群聊中请 @机器人/);

  await bridge.accept(message('group-unmentioned', '这条不算答案', {
    ...group,
    isInAtList: false,
  }));
  assert.equal(responseCalls, 0);
  await bridge.accept(message('group-mentioned', '这条才是答案', {
    ...group,
    isInAtList: true,
  }));
  await first;

  assert.equal(responseCalls, 1);
  assert.equal(bridge.status.messagesIgnored, 1);
  assert.equal(sent.at(-1).text, '群聊交互完成');
});

test('only the actor who started a DingTalk group interaction can answer it', async () => {
  const fixture = stateFixture();
  fixture.sessions.set('group:actor-room', 'session-group-actor');
  const asked = [];
  const submitted = deferred();
  let interactionSubmitted = false;
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async () => undefined },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      createSession: async () => assert.fail('the group session should already exist'),
      ask: async (sessionId, text, options) => {
        asked.push(text);
        if (text !== '甲发起交互') return '普通群消息已处理';
        await options.onInteraction({
          kind: 'question',
          interactionId: 'dingtalk-group-actor',
          rpcId: 'dingtalk-group-actor',
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
  });
  const group = {
    conversationType: '2',
    conversationId: 'actor-room',
    isInAtList: true,
  };

  const first = bridge.accept(message('actor-start', '甲发起交互', {
    ...group,
    senderStaffId: 'staff-a',
  }));
  await eventually(() => asked.length === 1);
  const intruder = bridge.accept(message('actor-b', '乙试图代答', {
    ...group,
    senderStaffId: 'staff-b',
  }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(interactionSubmitted, false);
  assert.deepEqual(asked, ['甲发起交互']);

  await bridge.accept(message('actor-a', '甲的答案', {
    ...group,
    senderStaffId: 'staff-a',
  }));
  assert.deepEqual((await submitted.promise).value.answer.answers, [{
    id: 'actor',
    selected: [],
    custom: '甲的答案',
  }]);
  await Promise.all([first, intruder]);
  assert.deepEqual(asked, ['甲发起交互', '乙试图代答']);
});
