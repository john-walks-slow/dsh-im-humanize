import assert from 'node:assert/strict';
import test from 'node:test';

import {
  IM_SEND_TOOL,
  createImSendToolDefinition,
  installImSendTool,
} from '../src/channels/shared/im-send-tool.mjs';

test('send_im delivers through an explicit botId + targetId and reports success', async () => {
  const calls = [];
  const definition = createImSendToolDefinition({
    send: async (botId, targetId, text, options) => {
      calls.push({ botId, targetId, text, options });
    },
  });
  const signal = AbortSignal.timeout(1000);

  const result = await definition.execute(
    { botId: 'bot-a', targetId: 'daily-report', text: '构建已完成。' },
    { signal },
  );

  assert.deepEqual(result, { sent: true });
  assert.equal(calls.length, 1);
  assert.deepEqual(
    { botId: calls[0].botId, targetId: calls[0].targetId, text: calls[0].text },
    { botId: 'bot-a', targetId: 'daily-report', text: '构建已完成。' },
  );
  assert.equal(calls[0].options?.signal, signal);
});

test('send_im surfaces delivery errors with their public code', async () => {
  const failure = Object.assign(new Error('The bot is offline'), { code: 'bot-not-connected' });
  const definition = createImSendToolDefinition({
    send: async () => { throw failure; },
  });

  await assert.rejects(
    definition.execute({ botId: 'bot-a', targetId: 'daily-report', text: 'hi' }, {}),
    /send_im failed \(bot-not-connected\): The bot is offline/,
  );
});

test('send_im resolves the bound private chat when botId/targetId are omitted', async () => {
  const calls = [];
  const boundTarget = { kind: 'chat', route: { chatId: '6110538394' } };
  const definition = createImSendToolDefinition({
    send: async (botId, target, text, options) => {
      calls.push({ botId, target, text, options });
    },
    resolveBoundTargets: async (sessionId) => (
      sessionId === 'session-x' ? [{ botId: 'bot-a', target: boundTarget }] : []
    ),
  });
  const signal = AbortSignal.timeout(1000);

  const result = await definition.execute(
    { text: '该喝水啦' },
    { agent: { session: { id: 'session-x' } }, signal },
  );

  assert.deepEqual(result, { sent: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].botId, 'bot-a');
  assert.equal(calls[0].target, boundTarget);
  assert.equal(calls[0].text, '该喝水啦');
  assert.equal(calls[0].options?.signal, signal);
});

test('send_im rejects with no-bound-target when the session is unbound', async () => {
  const definition = createImSendToolDefinition({
    send: async () => {},
    resolveBoundTargets: async () => [],
  });

  await assert.rejects(
    definition.execute({ text: 'hi' }, { agent: { session: { id: 'session-x' } } }),
    /send_im failed \(no-bound-target\)/,
  );
});

test('send_im rejects with no-session when no session context is available', async () => {
  const definition = createImSendToolDefinition({
    send: async () => {},
    resolveBoundTargets: async () => [{ botId: 'bot-a', target: { kind: 'chat', route: { chatId: '1' } } }],
  });

  await assert.rejects(
    definition.execute({ text: 'hi' }, {}),
    /send_im failed \(no-session\)/,
  );
});

test('send_im rejects a half-specified explicit target', async () => {
  const definition = createImSendToolDefinition({ send: async () => {} });

  await assert.rejects(
    definition.execute({ botId: 'bot-a', text: 'hi' }, {}),
    /send_im failed \(bad-request\): provide both botId and targetId/,
  );
});

test('installImSendTool registers the tool and the prompt section, or refuses cleanly', () => {
  const registered = [];
  const sections = [];
  const ctx = {
    tools: { register: (tool) => registered.push(tool) },
    systemPrompt: { section: (section) => sections.push(section) },
  };
  const send = async () => {};

  assert.equal(installImSendTool(ctx, { send }), true);
  assert.equal(registered[0].name, IM_SEND_TOOL);
  assert.deepEqual(registered[0].parameters.required, ['text']);
  assert.equal(sections[0].name, 'dsh-im:send-im');
  assert.match(sections[0].text, /a turn NOT initiated by dsh-im/);

  assert.equal(installImSendTool({}, { send }), false);
  assert.equal(installImSendTool(ctx, {}), false);
  assert.throws(() => createImSendToolDefinition({}), TypeError);
});