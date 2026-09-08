import assert from 'node:assert/strict';
import test from 'node:test';

import { WeixinHarnessBridge } from '../../../src/channels/weixin/weixin-bridge.mjs';
import { DingtalkHarnessBridge } from '../../../src/channels/dingtalk/dingtalk-bridge.mjs';
import { WecomHarnessBridge } from '../../../src/channels/wecom/wecom-bridge.mjs';
import { FeishuHarnessBridge } from '../../../src/channels/feishu/bridge.mjs';
import { DEFAULT_SEND_DELAY_CONFIG } from '../../../src/channels/shared/send-delay.mjs';

/**
 * Two-phase humanization smoke tests for the four standalone bridges (plan
 * docs/features/260908-humanize-send-delay-typing §346): the silent read
 * delay and the supersede semantics (a newer message during the delay
 * cancels the older turn silently). weixin runs the long delay tier (it has
 * a ticket typing indicator); dingtalk/wecom/feishu have no typing API and
 * cap the read delay at SHORT_DELAY_CAP_MS. Channel-specific typing
 * behavior lives in the per-channel suites (weixin ticket keepalive,
 * feishu cards, wecom streams).
 */

function withKeepAlive(run) {
  const keepAlive = setInterval(() => {}, 1_000);
  return run().finally(() => clearInterval(keepAlive));
}

function humanizeProvider(readDelay) {
  return {
    getSettings: () => ({
      typingIndicator: 'off',
      messageBreak: false,
      streaming: true,
      sendDelay: readDelay === null
        ? DEFAULT_SEND_DELAY_CONFIG
        : { ...DEFAULT_SEND_DELAY_CONFIG, enabled: true, readDelay },
    }),
  };
}

function stateFixture(boundKey) {
  const sessions = new Map(boundKey ? [[boundKey, 'session-x']] : []);
  const seen = new Set();
  return {
    hasSeen: (id) => seen.has(id),
    markSeen: async (id) => seen.add(id),
    sessionFor: (key) => sessions.get(key) ?? null,
    setSession: async (key, sessionId) => sessions.set(key, sessionId),
    clearSession: async (key) => sessions.delete(key),
  };
}

function harnessRecording(asks) {
  return {
    sessionExists: async () => true,
    createSession: async () => 'session-x',
    ask: async (_sessionId, content) => {
      asks.push(String(content));
      return '桥接回答';
    },
  };
}

function weixinMessage(id, text) {
  return {
    message_id: id,
    message_type: 1,
    from_user_id: 'owner-user',
    context_token: `context-${id}`,
    item_list: [{ type: 1, text_item: { text } }],
  };
}

function dingtalkMessage(id, text) {
  return {
    msgId: id,
    msgtype: 'text',
    text: { content: text },
    conversationType: '1',
    conversationId: 'conversation-fixed',
    senderStaffId: 'staff-approved',
    senderNick: '钉钉用户',
    sessionWebhook: `https://oapi.dingtalk.com/robot/reply?ticket=${id}`,
  };
}

function wecomFrame(id, text) {
  return {
    headers: { req_id: `req-${id}` },
    body: {
      msgid: id,
      chattype: 'single',
      from: { userid: 'member-1' },
      msgtype: 'text',
      text: { content: text },
    },
  };
}

function feishuEvent(id, text) {
  return {
    message: {
      message_id: id,
      chat_id: 'oc_1',
      chat_type: 'p2p',
      message_type: 'text',
      content: JSON.stringify({ text }),
    },
    sender: { sender_id: { open_id: 'ou_owner' }, sender_type: 'user' },
  };
}

// ── weixin ────────────────────────────────────────────────────────────────

test('weixin: read delay precedes the ask and the typing ticket', async () => withKeepAlive(async () => {
  const calls = [];
  const startedAt = Date.now();
  let askAt = 0;
  const bridge = new WeixinHarnessBridge({
    api: {
      sendText: async () => { calls.push('sendText'); return { messageId: 'wx-1' }; },
      getConfig: async () => { calls.push('getConfig'); return { typingTicket: 'ticket-1' }; },
      sendTyping: async () => { calls.push('sendTyping'); },
    },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-x',
      ask: async () => { askAt = Date.now(); return '微信回答'; },
    },
    state: stateFixture('p2p:owner-user'),
    humanize: humanizeProvider({ minMs: 120, maxMs: 180 }),
  });
  await bridge.accept(weixinMessage('wx-delay', '延迟问题'));
  assert.ok(askAt - startedAt >= 100, `ask must wait out the read delay (waited ${askAt - startedAt}ms)`);
  assert.equal(calls[0], 'getConfig', 'the typing ticket is only requested after the silence');
  assert.equal(calls[1], 'sendTyping');
  assert.ok(askAt - startedAt < 5_000, 'the wait stays within the requested range');
}));

test('weixin: a newer message supersedes a delayed turn silently', async () => withKeepAlive(async () => {
  const sent = [];
  const asks = [];
  const bridge = new WeixinHarnessBridge({
    api: { sendText: async (_t, text) => { sent.push(text); return { messageId: 'wx-2' }; } },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    harness: harnessRecording(asks),
    state: stateFixture('p2p:owner-user'),
    humanize: humanizeProvider({ minMs: 400, maxMs: 500 }),
  });
  const first = bridge.accept(weixinMessage('wx-sup-1', '先到的问题'));
  await new Promise((resolve) => setImmediate(resolve));
  const second = bridge.accept(weixinMessage('wx-sup-2', '后来的问题'));
  await Promise.all([first, second]);
  assert.equal(asks.length, 1, 'only the newer message reaches the harness');
  assert.match(asks[0], /后来的问题/);
  assert.equal(sent.length, 1, 'the superseded turn stays silent');
}));

test('weixin: the typing keepalive pauses for a pending question and re-arms on resume', async () => withKeepAlive(async () => {
  const typingCalls = [];
  const marks = { beforePending: 0, whilePending: -1, afterResume: -1 };
  const bridge = new WeixinHarnessBridge({
    api: {
      sendText: async (_t, text) => ({ messageId: `wx-r-${typingCalls.length}` }),
      getConfig: async () => ({ typingTicket: 'ticket-1' }),
      sendTyping: async ({ status }) => { typingCalls.push(status); },
    },
    baseUrl: 'https://ilinkai.weixin.qq.com/',
    token: 'host-token',
    ownerUserId: 'owner-user',
    typingKeepaliveMs: 40,
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-x',
      ask: async (_sessionId, _content, options) => {
        await options.onInteraction({
          kind: 'question',
          interactionId: 'wx-interaction-1',
          rpcId: 'wx-rpc-1',
          sessionId: 'session-x',
          payload: {
            questions: [{
              id: 'q1',
              question: '继续吗？',
              choices: [{ id: 'yes', name: '继续' }, { id: 'no', name: '停止' }],
            }],
          },
        });
        // While pending: the keepalive timer must be paused.
        marks.beforePending = typingCalls.filter((status) => status === 1).length;
        await new Promise((resolve) => setTimeout(resolve, 130));
        marks.whilePending = typingCalls.filter((status) => status === 1).length;
        await options.onInteractionResolved({ kind: 'question', interactionId: 'wx-interaction-1' });
        // After resume: the keepalive re-arms (immediate refresh + loop).
        await new Promise((resolve) => setTimeout(resolve, 90));
        marks.afterResume = typingCalls.filter((status) => status === 1).length;
        return '互动后的回答';
      },
    },
    state: stateFixture('p2p:owner-user'),
    humanize: humanizeProvider({ minMs: 5, maxMs: 10 }),
  });
  await bridge.accept(weixinMessage('wx-pending', '互动问题'));
  assert.ok(marks.beforePending >= 1, 'the ticket typing starts before the ask');
  assert.equal(marks.whilePending, marks.beforePending,
    `no keepalive pulses while the question is pending (got ${marks.whilePending} vs ${marks.beforePending})`);
  assert.ok(marks.afterResume >= marks.whilePending + 2,
    `resume re-arms the keepalive loop (got ${marks.afterResume} vs ${marks.whilePending})`);
}));

// ── dingtalk ──────────────────────────────────────────────────────────────

test('dingtalk: read delay precedes the ask; card placeholder follows it', async () => withKeepAlive(async () => {
  const calls = [];
  const startedAt = Date.now();
  let askAt = 0;
  const bridge = new DingtalkHarnessBridge({
    api: {
      sendText: async () => { calls.push('sendText'); return { messageId: 'ding-1' }; },
      createAiCard: async () => { calls.push(`createAiCard@${Date.now() - startedAt}`); return true; },
      updateAiCard: async () => true,
      finishAiCard: async () => true,
    },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-x',
      ask: async () => { askAt = Date.now(); return '钉钉回答'; },
    },
    state: stateFixture('staff-approved'),
    humanize: humanizeProvider({ minMs: 120, maxMs: 180 }),
  });
  await bridge.accept(dingtalkMessage('ding-delay', '延迟问题'));
  assert.ok(askAt - startedAt >= 100, 'ask must wait out the read delay');
  const cardCall = calls.find((c) => c.startsWith('createAiCard@'));
  assert.ok(cardCall, 'the card placeholder opens in the compose phase');
  const cardAt = Number(cardCall.split('@')[1]);
  assert.ok(cardAt >= 100, 'the placeholder appears only after the silence');
}));

test('dingtalk: message-break segments respect the 3s webhook rate floor', async () => withKeepAlive(async () => {
  const segmentTimes = new Map();
  const bridge = new DingtalkHarnessBridge({
    api: {
      sendText: async ({ text }) => {
        segmentTimes.set(text, Date.now());
        return { messageId: `ding-seg-${segmentTimes.size}` };
      },
      createAiCard: async () => true,
      updateAiCard: async () => true,
      finishAiCard: async () => true,
    },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-x',
      ask: async (_sessionId, _content, options) => {
        await options.onUpdate({ type: 'message_break', text: '第一段' });
        await options.onUpdate({ type: 'message_break', text: '第二段' });
        return '收尾';
      },
    },
    state: stateFixture('staff-approved'),
    humanize: {
      getSettings: () => ({
        typingIndicator: 'off',
        messageBreak: true,
        streaming: false,
        sendDelay: {
          ...DEFAULT_SEND_DELAY_CONFIG,
          enabled: true,
          readDelay: { minMs: 5, maxMs: 10 },
          // Deliberately below the DingTalk webhook floor: the bridge must
          // clamp the gap up to ~3s (20 messages/min rate limit).
          segmentGap: { minMs: 50, maxMs: 80 },
        },
      }),
    },
  });
  await bridge.accept(dingtalkMessage('ding-segments', '分段问题'));
  const firstAt = segmentTimes.get('第一段');
  const secondAt = segmentTimes.get('第二段');
  assert.ok(firstAt !== undefined && secondAt !== undefined,
    `both segments must be sent (got ${[...segmentTimes.keys()].join(', ')})`);
  assert.ok(secondAt - firstAt >= 2900,
    `the segment gap must respect the 3s webhook floor (waited ${secondAt - firstAt}ms)`);
  assert.ok(segmentTimes.has('收尾'), 'the remaining text completes the turn');
}));

test('dingtalk: streaming=false skips the AI card and sends one shot after the delay', async () => withKeepAlive(async () => {
  const calls = [];
  const startedAt = Date.now();
  let askAt = 0;
  const bridge = new DingtalkHarnessBridge({
    api: {
      sendText: async ({ text }) => { calls.push(`sendText:${text}@${Date.now() - startedAt}`); return { messageId: 'ding-off' }; },
      createAiCard: async () => { calls.push('createAiCard'); return true; },
      updateAiCard: async () => true,
      finishAiCard: async () => true,
    },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-x',
      ask: async () => { askAt = Date.now(); return '一次性回答'; },
    },
    state: stateFixture('staff-approved'),
    humanize: {
      getSettings: () => ({
        typingIndicator: 'off',
        messageBreak: false,
        streaming: false,
        sendDelay: {
          ...DEFAULT_SEND_DELAY_CONFIG,
          enabled: true,
          readDelay: { minMs: 120, maxMs: 180 },
        },
      }),
    },
  });
  await bridge.accept(dingtalkMessage('ding-nostream', '关闭流式问题'));
  assert.ok(askAt - startedAt >= 100, 'ask must wait out the read delay');
  assert.ok(!calls.includes('createAiCard'), 'streaming=false never opens the AI card');
  const send = calls.find((c) => c.startsWith('sendText:'));
  assert.ok(send, 'the answer is delivered in one shot');
  assert.ok(send.includes('一次性回答'), 'the one-shot send carries the full answer');
  assert.ok(Number(send.split('@')[1]) >= 100, 'the send happens after the silence');
}));

test('dingtalk: a newer message supersedes a delayed turn silently', async () => withKeepAlive(async () => {
  const sent = [];
  const asks = [];
  const bridge = new DingtalkHarnessBridge({
    api: { sendText: async (_t, text) => { sent.push(text); return { messageId: 'ding-2' }; } },
    clientId: 'ding-client',
    clientSecret: 'host-secret',
    harness: harnessRecording(asks),
    state: stateFixture('staff-approved'),
    humanize: humanizeProvider({ minMs: 400, maxMs: 500 }),
  });
  const first = bridge.accept(dingtalkMessage('ding-sup-1', '先到的问题'));
  await new Promise((resolve) => setImmediate(resolve));
  const second = bridge.accept(dingtalkMessage('ding-sup-2', '后来的问题'));
  await Promise.all([first, second]);
  assert.equal(asks.length, 1, 'only the newer message reaches the harness');
  assert.match(asks[0], /后来的问题/);
  assert.equal(sent.length, 1, 'the superseded turn stays silent');
}));

// ── wecom ─────────────────────────────────────────────────────────────────

test('wecom: read delay precedes the ask and the thinking placeholder', async () => withKeepAlive(async () => {
  const calls = [];
  const startedAt = Date.now();
  let askAt = 0;
  const bridge = new WecomHarnessBridge({
    client: {
      replyStream: async (_s, _id, _content, finish) => {
        calls.push(`replyStream@${Date.now() - startedAt}${finish ? ':finish' : ''}`);
        return { body: { msgid: 'wecom-1' } };
      },
      replyStreamNonBlocking: async () => {},
      sendMessage: async () => { calls.push('sendMessage'); },
    },
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-x',
      ask: async () => { askAt = Date.now(); return '企微回答'; },
    },
    state: stateFixture('direct:member-1'),
    humanize: humanizeProvider({ minMs: 120, maxMs: 180 }),
  });
  await bridge.accept(wecomFrame('wecom-delay', '延迟问题'));
  assert.ok(askAt - startedAt >= 100, 'ask must wait out the read delay');
  const openCall = calls.find((c) => c.startsWith('replyStream@') && !c.endsWith(':finish'));
  assert.ok(openCall, 'the thinking placeholder opens in the compose phase');
  const openAt = Number(openCall.split('@')[1].replace(':finish', ''));
  assert.ok(openAt >= 100, 'the placeholder appears only after the silence');
}));

test('wecom: a newer message supersedes a delayed turn silently', async () => withKeepAlive(async () => {
  const sent = [];
  const asks = [];
  const bridge = new WecomHarnessBridge({
    client: {
      replyStream: async (_s, _id, content) => {
        sent.push(String(content));
        return { body: { msgid: 'wecom-2' } };
      },
      replyStreamNonBlocking: async () => {},
      sendMessage: async () => {},
    },
    harness: harnessRecording(asks),
    state: stateFixture('direct:member-1'),
    humanize: humanizeProvider({ minMs: 400, maxMs: 500 }),
  });
  const first = bridge.accept(wecomFrame('wecom-sup-1', '先到的问题'));
  await new Promise((resolve) => setImmediate(resolve));
  const second = bridge.accept(wecomFrame('wecom-sup-2', '后来的问题'));
  await Promise.all([first, second]);
  assert.equal(asks.length, 1, 'only the newer message reaches the harness');
  assert.match(asks[0], /后来的问题/);
  // The newer turn alone speaks: placeholder + final stream (or one-shot
  // reply). The superseded turn must not add any visible output.
  assert.ok(sent.length >= 1 && sent.length <= 2,
    `only the newer turn's placeholder+final appear (got ${sent.length})`);
  assert.ok(sent.every((content) => !String(content).includes('先到的问题')),
    'the superseded turn stays silent');
}));

test('wecom: streaming=false never opens a stream and answers via #sendImmediate', async () => withKeepAlive(async () => {
  const calls = [];
  const bridge = new WecomHarnessBridge({
    client: {
      // #sendImmediate is passive-first: a whole answer goes out as ONE
      // replyStream(..., finish=true) call (no placeholder, no updates).
      replyStream: async (_frame, _reqId, content, finish) => {
        calls.push(`replyStream:${content}:${finish ? 'finish' : 'open'}`);
        return { body: { msgid: 'wecom-2' } };
      },
      replyStreamNonBlocking: async () => { calls.push('replyStreamNonBlocking'); },
      sendMessage: async (chatId, payload) => {
        calls.push(`sendMessage:${payload?.markdown?.content ?? ''}`);
      },
    },
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-x',
      ask: async () => '企微一次性回答',
    },
    state: stateFixture('direct:member-1'),
    humanize: {
      getSettings: () => ({
        typingIndicator: 'off',
        messageBreak: false,
        streaming: false,
        sendDelay: {
          ...DEFAULT_SEND_DELAY_CONFIG,
          enabled: true,
          readDelay: { minMs: 120, maxMs: 180 },
        },
      }),
    },
  });
  await bridge.accept(wecomFrame('wecom-nostream', '关闭流式问题'));
  assert.ok(!calls.includes('replyStreamNonBlocking'),
    'streaming=false never opens the thinking placeholder');
  const streams = calls.filter((c) => c.startsWith('replyStream:'));
  assert.equal(streams.length, 1, `exactly one passive delivery (got ${streams.join(' | ')})`);
  assert.ok(streams[0].endsWith(':finish'), 'the passive delivery closes in one shot');
  assert.ok(streams[0].includes('企微一次性回答'), 'the one-shot delivery carries the full answer');
  assert.ok(!calls.some((c) => c.startsWith('sendMessage:')),
    'no chunked fallback was needed');
}));

// ── feishu ────────────────────────────────────────────────────────────────

test('feishu: read delay precedes the ask (plain text path)', async () => withKeepAlive(async () => {
  const sent = [];
  const startedAt = Date.now();
  let askAt = 0;
  const bridge = new FeishuHarnessBridge({
    client: {
      im: {
        v1: {
          message: {
            create: async (request) => {
              sent.push(request);
              return { code: 0, data: { message_id: 'om-x' } };
            },
          },
        },
      },
    },
    channel: {},
    harness: {
      sessionExists: async () => true,
      createSession: async () => 'session-x',
      ask: async () => { askAt = Date.now(); return '飞书回答'; },
    },
    state: stateFixture('p2p:oc_1'),
    status: {},
    allowedSenderOpenIds: new Set(['ou_owner']),
    humanize: humanizeProvider({ minMs: 120, maxMs: 180 }),
  });
  await bridge.accept(feishuEvent('fs-delay', '延迟问题'));
  assert.ok(askAt - startedAt >= 100, 'ask must wait out the read delay');
  assert.ok(sent.length >= 1, 'the answer is delivered');
}));

test('feishu: a newer message supersedes a delayed turn silently', async () => withKeepAlive(async () => {
  const sent = [];
  const asks = [];
  const bridge = new FeishuHarnessBridge({
    client: {
      im: {
        v1: {
          message: {
            create: async (request) => {
              sent.push(request);
              return { code: 0, data: { message_id: 'om-y' } };
            },
          },
        },
      },
    },
    channel: {},
    harness: harnessRecording(asks),
    state: stateFixture('p2p:oc_1'),
    status: {},
    allowedSenderOpenIds: new Set(['ou_owner']),
    humanize: humanizeProvider({ minMs: 400, maxMs: 500 }),
  });
  const first = bridge.accept(feishuEvent('fs-sup-1', '先到的问题'));
  await new Promise((resolve) => setImmediate(resolve));
  const second = bridge.accept(feishuEvent('fs-sup-2', '后来的问题'));
  await Promise.all([first, second]);
  assert.equal(asks.length, 1, 'only the newer message reaches the harness');
  assert.match(asks[0], /后来的问题/);
  assert.equal(sent.length, 1, 'the superseded turn stays silent');
}));
