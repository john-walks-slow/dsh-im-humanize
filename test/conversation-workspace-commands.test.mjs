import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  BotWorkspaceStore,
  createBotWorkspaceScope,
} from '../src/channels/shared/bot-workspace-store.mjs';
import { ConversationStateStore } from '../src/channels/shared/conversation-state-store.mjs';
import { runWorkspaceCommand } from '../src/channels/shared/workspace-command.mjs';

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-im-conversation-commands-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const defaultWorkspace = join(root, 'default');
  const alternateWorkspace = join(root, 'alternate');
  await Promise.all([mkdir(defaultWorkspace), mkdir(alternateWorkspace)]);
  const workspaces = await new BotWorkspaceStore(join(root, 'workspaces.json'), {
    defaultWorkspace,
  }).load();
  const botId = 'bot_conversation_commands';
  await workspaces.ensure(botId);
  const state = await new ConversationStateStore(join(root, 'state.json')).load();
  const knownSessions = [
    { sessionId: 'session-A', workspace: defaultWorkspace, title: 'Default workspace session' },
    { sessionId: 'session-B', workspace: alternateWorkspace, title: 'Conversation workspace session' },
  ];
  const listedWorkspaces = [];
  const adoptedSessions = [];
  const harness = {
    async listWorkspaces() { return [defaultWorkspace, alternateWorkspace]; },
    async listWorkspaceSessions(workspace) {
      listedWorkspaces.push(workspace);
      return { workspace, sessions: knownSessions.filter((session) => session.workspace === workspace) };
    },
    async adoptWorkspaceSession(sessionId) {
      adoptedSessions.push(sessionId);
      return knownSessions.find((session) => session.sessionId === sessionId);
    },
  };
  const scope = createBotWorkspaceScope(harness, { botId, workspaces, state });
  const key = 'group:conversation';
  return {
    command: (text) => runWorkspaceCommand(text, scope.harness, key),
    workspaces,
    state,
    key,
    botId,
    defaultWorkspace,
    alternateWorkspace,
    listedWorkspaces,
    adoptedSessions,
  };
}

test('/session N selects from the same effective workspace as /sessionlist', async (t) => {
  const f = await fixture(t);
  await f.command(`/conv ${f.alternateWorkspace}`);

  const listing = await f.command('/sessionlist');
  assert.match(listing.message, /session-B/u);
  assert.doesNotMatch(listing.message, /session-A/u);
  const binding = await f.command('/session 1');

  assert.match(binding.message, /session-B/u);
  assert.equal(f.state.sessionFor(f.key), 'session-B');
  assert.deepEqual(f.adoptedSessions, ['session-B']);
  assert.deepEqual(f.listedWorkspaces, [f.alternateWorkspace, f.alternateWorkspace]);
  assert.equal(f.workspaces.conversationWorkspaceFor(f.botId, f.key), f.alternateWorkspace);
});

test('/session N still follows the bot default without an override', async (t) => {
  const f = await fixture(t);
  const listing = await f.command('/sessionlist');
  const binding = await f.command('/session 1');

  assert.match(listing.message, /session-A/u);
  assert.match(binding.message, /session-A/u);
  assert.equal(f.state.sessionFor(f.key), 'session-A');
  assert.deepEqual(f.listedWorkspaces, [f.defaultWorkspace, f.defaultWorkspace]);
});

test('/conv reports persisted explicit bindings and following the bot default', async (t) => {
  const f = await fixture(t);
  assert.match((await f.command('/conv')).message, /状态：未显式绑定，当前跟随 bot 默认工作区/u);

  await f.command(`/conv ${f.defaultWorkspace}`);
  assert.equal(f.workspaces.hasConversationWorkspaceOverride(f.botId, f.key), true);
  assert.match((await f.command('/conv')).message, /状态：已为该对话显式绑定/u);

  await f.command(`/conv ${f.alternateWorkspace}`);
  assert.match((await f.command('/conv')).message, /状态：已为该对话显式绑定/u);

  await f.command('/conv clear');
  assert.equal(f.workspaces.hasConversationWorkspaceOverride(f.botId, f.key), false);
  assert.match((await f.command('/conv')).message, /状态：未显式绑定，当前跟随 bot 默认工作区/u);
});

test('/session ID retains existing cross-workspace bot-default behavior', async (t) => {
  const f = await fixture(t);
  await f.state.setSession('group:other', 'session-A');
  const binding = await f.command('/session session-B');

  assert.match(binding.message, /session-B/u);
  assert.equal(f.state.sessionFor(f.key), 'session-B');
  assert.equal(f.workspaces.workspaceFor(f.botId), f.alternateWorkspace);
  assert.equal(f.state.sessionFor('group:other'), null);
  assert.deepEqual(f.listedWorkspaces, []);
});
