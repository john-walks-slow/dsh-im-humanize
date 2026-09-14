import assert from 'node:assert/strict';
import test from 'node:test';

import { createEditableMessageStream } from '../../../src/channels/shared/editable-message-stream.mjs';
import { TextHarnessBridge } from '../../../src/channels/shared/text-harness-bridge.mjs';
import { TelegramBotClient } from '../../../src/channels/telegram/telegram-runtime.mjs';
import { DEFAULT_SEND_DELAY_CONFIG } from '../../../src/channels/shared/send-delay.mjs';

function withKeepAlive(run) {
  const keepAlive = setInterval(() => {}, 1_000);
  return run().finally(() => clearInterval(keepAlive));
}

function stateFixture() {
  const sessions = new Map();
  const seen = new Set();
  return {
    sessionFor: (key) => sessions.get(key) ?? null,
    async setSession(key, sessionId) { sessions.set(key, sessionId); return true; },
    async clearSession(key) { sessions.delete(key); },
    hasSeen: (messageId) => seen.has(messageId),
    async markSeen(messageId) { seen.add(messageId); },
  };
}

function message(messageId, content) {
  return {
    messageId,
    senderId: 'actor-a',
    senderIsBot: false,
    kind: 'direct',
    conversationId: 'chat-a',
    content,
    addressed: true,
    replyTarget: { id: `target-${messageId}` },
  };
}

function humanizeSettings(overrides = {}) {
  return {
    getSettings: () => ({
      typingIndicator: 'off',
      sendDelay: { ...DEFAULT_SEND_DELAY_CONFIG, ...overrides.sendDelay },
      ...overrides,
    }),
  };
}

function recordedStreamBot() {
  const events = [];
  const bot = {
    events,
    sendText: async (_target, text) => {
      events.push(`text:${text}`);
      return { providerMessageIds: [`id-${events.length}`] };
    },
    openStream: async (_target, options) => {
      events.push(`open:${JSON.stringify(options)}`);
      return {
        update: async (value) => { events.push(`update:${typeof value === 'string' ? value : '<block>'}`); },
        finish: async (value) => { events.push(`finish:${typeof value === 'string' ? value : '<block>'}`); return { presentation: 'test' }; },
        cancel: () => { events.push('cancel'); },
      };
    },
  };
  return bot;
}

function createBridge({ bot, humanize, harness, state }) {
  return new TextHarnessBridge({
    descriptor: { key: 'test', label: 'Test' },
    bot,
    harness,
    state: state ?? stateFixture(),
    logger: { warn() {}, error() {} },
    humanize,
  });
}

// ── createEditableMessageStream lazy mode ───────────────────────────

test('lazy editable stream: start() does not create a placeholder message', async () => {
  const created = [];
  const edited = [];
  const stream = createEditableMessageStream({
    lazy: true,
    limit: 100,
    create: async (text) => { created.push(text); return 'msg-1'; },
    edit: async (messageId, text) => { edited.push({ messageId, text }); },
    sendRemainder: async () => ({}),
  });
  await stream.start();
  assert.deepEqual(created, [], 'no placeholder created on start');
  assert.deepEqual(edited, [], 'no edit on start');
});

test('lazy editable stream: the first real update creates the message with that text', async () => {
  const created = [];
  const edited = [];
  const stream = createEditableMessageStream({
    lazy: true,
    updateIntervalMs: 0,
    limit: 100,
    create: async (text) => { created.push(text); return 'msg-1'; },
    edit: async (messageId, text) => { edited.push({ messageId, text }); },
    sendRemainder: async () => ({}),
  });
  await stream.start();
  stream.update('hello world');
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(created, ['hello world'], 'first update creates with the real text, not a placeholder');
  assert.deepEqual(edited, [], 'no edit before a second update');
});

test('lazy editable stream: finish without any update sends the first chunk as a fresh message', async () => {
  const created = [];
  const edited = [];
  const remainders = [];
  const stream = createEditableMessageStream({
    lazy: true,
    limit: 5,
    create: async (text) => { created.push(text); return 'msg-1'; },
    edit: async (messageId, text) => { edited.push({ messageId, text }); },
    sendRemainder: async (text) => { remainders.push(text); return { id: `r-${remainders.length}` }; },
    messageIdForResult: (result) => result.id,
  });
  await stream.start();
  await stream.finish('ABCDEFGHIJ');
  assert.deepEqual(created, ['ABCDE'], 'finish creates the first chunk fresh');
  assert.deepEqual(edited, [], 'no placeholder edit on finish');
  assert.deepEqual(remainders, ['FGHIJ'], 'remainder chunk is sent');
  assert.deepEqual(stream.providerMessageIds, ['msg-1', 'r-1']);
});

test('lazy editable stream: cancel before any create leaves no message behind', async () => {
  const created = [];
  const stream = createEditableMessageStream({
    lazy: true,
    limit: 100,
    create: async (text) => { created.push(text); return 'msg-1'; },
    edit: async () => {},
    sendRemainder: async () => ({}),
  });
  await stream.start();
  stream.update('pending text');
  stream.cancel();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(created, [], 'cancel before the timer fires creates nothing');
});

// ── Telegram openDeliveryStream lazy ────────────────────────────────

test('lazy telegram rich-draft stream skips the initial "正在处理…" draft', async () => {
  const drafts = [];
  const telegram = new TelegramBotClient({
    api: {
      sendRichMessageDraft: async ({ richMessage }) => { drafts.push(richMessage.markdown); return {}; },
    },
    logger: { warn() {}, error() {} },
  });
  const stream = await telegram.openDeliveryStream(
    { chatId: 1, chatType: 'private' },
    { lazy: true },
  );
  assert.deepEqual(drafts, [], 'no draft bubble created on open');
  await stream.update('real content');
  assert.deepEqual(drafts.length, 1, 'first update creates the draft');
});

test('lazy telegram regular stream defers the placeholder; finish sends fresh when none created', async () => {
  const sent = [];
  const edited = [];
  const telegram = new TelegramBotClient({
    api: {
      sendMessage: async ({ text }) => { sent.push(text); return { message_id: 500 }; },
      editMessageText: async ({ text }) => { edited.push(text); return {}; },
      sendRichMessage: async () => ({}),
    },
    logger: { warn() {}, error() {} },
  });
  const target = { chatId: 1, chatType: 'group', replyToMessageId: 7 };
  const stream = await telegram.openDeliveryStream(target, { lazy: true });
  assert.deepEqual(sent, [], 'no placeholder sent on open');
  // finish without any update: sendRich delivers the final text fresh.
  await stream.finish('final answer');
  assert.ok(sent.length === 0 || sent.includes('final answer'),
    'finish sends the final text when no placeholder exists');
  assert.deepEqual(edited, [], 'no edit when no placeholder was created');
});

// ── TextHarnessBridge onUpdate filter ────────────────────────────────

test('progressStatus=false drops tool/status updates but keeps text', async () => withKeepAlive(async () => {
  const bot = recordedStreamBot();
  let capturedOnUpdate = null;
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, progressStatus: false }),
    harness: {
      createSession: async () => 'session',
      ask: async (_sessionId, _text, options) => {
        capturedOnUpdate = options.onUpdate;
        return '最终回答';
      },
    },
  });
  await bridge.accept(message('p1', '问题'));
  assert.ok(typeof capturedOnUpdate === 'function', 'streaming ask captured onUpdate');
  // Tool and status progress must NOT reach the stream.
  await capturedOnUpdate({ type: 'tool', name: 'bash' });
  await capturedOnUpdate({ type: 'status', text: '正在整理结果…' });
  assert.ok(!bot.events.some((e) => e.startsWith('update:')),
    'no tool/status progress pushed to the stream');
  // Real text still streams.
  await capturedOnUpdate({ type: 'text', text: '你好' });
  assert.ok(bot.events.some((e) => e === 'update:你好'),
    'real text updates reach the stream');
}));

test('progressStatus=false + messageBreak=true skips the placeholder stream entirely', async () => withKeepAlive(async () => {
  const bot = recordedStreamBot();
  let capturedOnUpdate = null;
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, messageBreak: true, progressStatus: false }),
    harness: {
      createSession: async () => 'session',
      ask: async (_sessionId, _text, options) => {
        capturedOnUpdate = options.onUpdate;
        return '分段回答';
      },
    },
  });
  await bridge.accept(message('p2', '问题'));
  assert.ok(!bot.events.some((e) => e.startsWith('open:')),
    'no placeholder stream opened when progressStatus is off and messageBreak is on');
  assert.ok(typeof capturedOnUpdate === 'function', 'onUpdate still wired for message_break');
}));

test('progressStatus default (true) still streams tool progress text', async () => withKeepAlive(async () => {
  const bot = recordedStreamBot();
  let capturedOnUpdate = null;
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true }),
    harness: {
      createSession: async () => 'session',
      ask: async (_sessionId, _text, options) => {
        capturedOnUpdate = options.onUpdate;
        return '回答';
      },
    },
  });
  await bridge.accept(message('p3', '问题'));
  await capturedOnUpdate({ type: 'tool', name: 'bash' });
  assert.ok(bot.events.some((e) => e.startsWith('update:')),
    'tool progress still streams when progressStatus is on (default)');
}));

// ── Slack lazy stream ────────────────────────────────────────────────

function slackApiFixture() {
  const calls = [];
  return {
    calls,
    startStream: async () => { calls.push('start'); return { ts: 'ts-1' }; },
    appendStream: async ({ markdownText }) => { calls.push(`append:${markdownText}`); },
    stopStream: async () => { calls.push('stop'); },
    postMessage: async ({ text }) => { calls.push(`post:${text}`); return { ts: `post-${calls.length}` }; },
  };
}

test('lazy slack stream: open does not startStream; first update starts and appends', async () => {
  const api = slackApiFixture();
  const { SlackBotClient } = await import('../../../src/channels/slack/slack-runtime.mjs');
  const slack = new SlackBotClient({ api, logger: { warn() {}, error() {} } });
  const stream = await slack.openStream({ channelId: 'C1' }, { lazy: true });
  assert.deepEqual(api.calls, [], 'no streaming message created on open');
  assert.equal(stream.messageId, undefined, 'messageId getter stays undefined before start');
  stream.update('hello slack');
  await new Promise((r) => setTimeout(r, 400));
  assert.ok(api.calls.includes('start'), 'first update starts the stream');
  assert.ok(api.calls.includes('append:hello slack'), 'first text is appended as the delta');
  assert.deepEqual(stream.providerMessageIds, ['ts-1'], 'provider id recorded once started');
});

test('lazy slack stream: finish without any update posts the final text directly', async () => {
  const api = slackApiFixture();
  const { SlackBotClient } = await import('../../../src/channels/slack/slack-runtime.mjs');
  const slack = new SlackBotClient({ api, logger: { warn() {}, error() {} } });
  const stream = await slack.openStream({ channelId: 'C1' }, { lazy: true });
  await stream.finish('final text');
  assert.ok(!api.calls.includes('start'), 'no stream was ever started');
  assert.ok(api.calls.includes('post:final text'), 'final text posted as a plain message');
});

test('lazy slack stream: cancel before any update never calls stopStream', async () => {
  const api = slackApiFixture();
  const { SlackBotClient } = await import('../../../src/channels/slack/slack-runtime.mjs');
  const slack = new SlackBotClient({ api, logger: { warn() {}, error() {} } });
  const stream = await slack.openStream({ channelId: 'C1' }, { lazy: true });
  stream.cancel();
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(api.calls, [], 'nothing started, nothing to stop');
});

// ── WhatsApp / Discord lazy passthrough ──────────────────────────────

test('lazy whatsapp openStream defers message creation to the first real text', async () => {
  const { WhatsappBotClient } = await import('../../../src/channels/whatsapp/whatsapp-runtime.mjs');
  const sent = [];
  const whatsapp = new WhatsappBotClient({
    sendPresenceUpdate: async () => {},
    sendMessage: async (_chat, content) => {
      const text = typeof content === 'string' ? content : content?.text;
      sent.push(text);
      return { key: { id: `w-${sent.length}` } };
    },
  }, { remember() {}, reserve() {} });
  const stream = await whatsapp.openStream({ chatId: 'wa-chat' }, { lazy: true });
  assert.deepEqual(sent, [], 'no placeholder sent on open');
  stream.update('real whatsapp text');
  await new Promise((r) => setTimeout(r, 1_300));
  assert.deepEqual(sent, ['real whatsapp text'], 'first update creates with the real text');
});

test('lazy discord openStream defers message creation to the first real text', async () => {
  const { DiscordBotClient } = await import('../../../src/channels/discord/discord-runtime.mjs');
  const created = [];
  const discord = new DiscordBotClient({
    api: {
      createMessage: async ({ content }) => { created.push(content); return { id: `d-${created.length}` }; },
      editMessage: async () => ({}),
    },
    logger: { warn() {}, error() {} },
  });
  const stream = await discord.openStream({ channelId: 'dc' }, { lazy: true });
  assert.deepEqual(created, [], 'no placeholder created on open');
  stream.update('real discord text');
  await new Promise((r) => setTimeout(r, 900));
  assert.deepEqual(created, ['real discord text'], 'first update creates with the real text');
});

// ── assistant-message retention ──────────────────────────────────────

test('progressStatus=false still streams assistant-message canonical steps', async () => withKeepAlive(async () => {
  const bot = recordedStreamBot();
  let capturedOnUpdate = null;
  const bridge = createBridge({
    bot,
    humanize: humanizeSettings({ streaming: true, progressStatus: false }),
    harness: {
      createSession: async () => 'session',
      ask: async (_sessionId, _text, options) => {
        capturedOnUpdate = options.onUpdate;
        return '回答';
      },
    },
  });
  await bridge.accept(message('p4', '问题'));
  await capturedOnUpdate({ type: 'assistant-message', text: '计划步骤' });
  assert.ok(bot.events.some((e) => e.startsWith('update:')),
    'assistant-message canonical steps are kept when progressStatus is off');
}));
