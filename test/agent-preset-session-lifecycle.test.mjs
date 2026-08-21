import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  BotWorkspaceStore,
  createBotWorkspaceScope,
  createWorkspaceAwareController,
} from '../src/channels/shared/bot-workspace-store.mjs';
import { ConversationStateStore } from '../src/channels/shared/conversation-state-store.mjs';
import { TextHarnessBridge } from '../src/channels/shared/text-harness-bridge.mjs';
import {
  TOKEN_BOT_ENDPOINTS,
  createTokenBotRpcHandler,
} from '../plugin-src/host/channels/shared/rpc.mjs';

function message(messageId, content) {
  return {
    messageId,
    senderId: 'actor-one',
    senderIsBot: false,
    kind: 'direct',
    conversationId: 'chat-one',
    content,
    addressed: true,
    replyTarget: { id: 'chat-one' },
  };
}

test('an agent preset change applies only after /new creates the next session', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-im-preset-lifecycle-')));
  t.after(() => rm(root, { recursive: true, force: true }));

  const botId = 'bot-one';
  const conversationKey = 'direct:chat-one';
  const workspaces = await new BotWorkspaceStore(join(root, 'workspaces.json'), {
    defaultWorkspace: root,
  }).load();
  await workspaces.ensure(botId, { defaultAgentPreset: 'preset-old' });
  const state = await new ConversationStateStore(join(root, 'state.json')).load();

  const creations = [];
  const asks = [];
  const sessions = new Set();
  const harness = {
    async createSession(options) {
      const sessionId = `session-${creations.length === 0 ? 'a' : 'b'}`;
      creations.push({ sessionId, options });
      sessions.add(sessionId);
      return sessionId;
    },
    async sessionExists(sessionId) {
      return sessions.has(sessionId);
    },
    async ask(sessionId, text) {
      asks.push({ sessionId, text });
      return `answer-from-${sessionId}`;
    },
  };
  const scope = createBotWorkspaceScope(harness, { botId, workspaces, state });
  const sent = [];
  const bridge = new TextHarnessBridge({
    descriptor: { key: 'test', label: 'Test' },
    bot: { async sendText(_target, text) { sent.push(text); } },
    harness: scope.harness,
    state: scope.state,
    logger: { warn() {}, error() {} },
  });

  const baseController = {
    status() { return { bots: [{ botId, connected: true }] }; },
    bindCredentials() { return this.status(); },
    reconnectBot() { return this.status(); },
    deleteBot() { return { bots: [] }; },
  };
  const controller = createWorkspaceAwareController(baseController, {
    workspaces,
    stateFor: async () => state,
    agentPresetCatalog: {
      defaultId: 'preset-old',
      items: [
        { id: 'preset-old', label: 'Old preset' },
        { id: 'preset-new', label: 'New preset' },
      ],
    },
  });
  const rpc = createTokenBotRpcHandler(controller, { channel: 'Test' });

  await bridge.accept(message('message-one', 'first prompt'));
  assert.equal(state.sessionFor(conversationKey), 'session-a');
  assert.deepEqual(creations, [{
    sessionId: 'session-a',
    options: { workspace: root, agentPreset: 'preset-old' },
  }]);

  const updated = await rpc(TOKEN_BOT_ENDPOINTS.setAgentPreset, {
    botId,
    agentPreset: 'preset-new',
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.value.bots[0].agentPreset, 'preset-new');
  assert.equal(state.sessionFor(conversationKey), 'session-a');

  await bridge.accept(message('message-two', 'still in the current chat'));
  assert.equal(creations.length, 1, 'the current chat must reuse session A');
  assert.equal(state.sessionFor(conversationKey), 'session-a');

  await bridge.accept(message('message-new', '/new'));
  assert.equal(state.sessionFor(conversationKey), null);
  assert.equal(creations.length, 1, '/new itself must not create a session');

  await bridge.accept(message('message-three', 'first prompt after /new'));
  assert.equal(state.sessionFor(conversationKey), 'session-b');
  assert.deepEqual(creations, [
    {
      sessionId: 'session-a',
      options: { workspace: root, agentPreset: 'preset-old' },
    },
    {
      sessionId: 'session-b',
      options: { workspace: root, agentPreset: 'preset-new' },
    },
  ]);
  assert.deepEqual(asks, [
    { sessionId: 'session-a', text: 'first prompt' },
    { sessionId: 'session-a', text: 'still in the current chat' },
    { sessionId: 'session-b', text: 'first prompt after /new' },
  ]);
  assert.deepEqual(sent, [
    'answer-from-session-a',
    'answer-from-session-a',
    '已开启新会话。请发送你的问题。',
    'answer-from-session-b',
  ]);
});
