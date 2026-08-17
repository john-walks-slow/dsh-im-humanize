import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import TestRenderer from 'react-test-renderer';

import { WorkspaceEditor } from '../plugin-src/client/workspace-editor.js';
import { DiscordSettingsTab } from '../plugin-src/client/channels/discord/index.js';

const { act, create } = TestRenderer;

function submitEvent() {
  return { preventDefault() {} };
}

function deferred() {
  let resolve;
  const promise = new Promise((onResolve) => { resolve = onResolve; });
  return { promise, resolve };
}

async function flushMicrotasks() {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

function discordSnapshot(workspace) {
  return {
    revision: 1,
    bots: [{
      botId: 'discord_test',
      connected: true,
      state: 'connected',
      workspace,
      bot: { name: 'Harness Bot', username: 'HarnessBot', idMasked: '123•••' },
      health: { summary: 'Discord Gateway 长连接运行正常', lastCheckedAt: Date.now() },
      error: null,
    }],
  };
}

function twoBotDiscordSnapshot(firstWorkspace) {
  const first = discordSnapshot(firstWorkspace).bots[0];
  return {
    revision: 1,
    bots: [
      { ...first, botId: 'discord_first', bot: { ...first.bot, name: 'First Bot' } },
      {
        ...first,
        botId: 'discord_second',
        workspace: '/workspace/second',
        bot: { ...first.bot, name: 'Second Bot' },
      },
    ],
  };
}

test('WorkspaceEditor shows the current path and saves an edited absolute path', async () => {
  const saved = [];
  function Fixture() {
    const [workspace, setWorkspace] = React.useState('/workspace/current');
    return React.createElement(WorkspaceEditor, {
      workspace,
      async onSave(value) {
        saved.push(value);
        setWorkspace(value);
      },
    });
  }

  let renderer;
  await act(async () => { renderer = create(React.createElement(Fixture)); });
  assert.equal(renderer.root.findByType('code').props.title, '/workspace/current');

  await act(async () => {
    renderer.root.findByType('button').props.onClick();
  });
  const input = renderer.root.findByType('input');
  assert.equal(input.props.value, '/workspace/current');
  assert.equal(input.props.maxLength, 4_096);
  await act(async () => {
    input.props.onChange({ target: { value: '  /workspace/next project  ' } });
  });
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit(submitEvent());
  });

  assert.deepEqual(saved, ['/workspace/next project']);
  assert.equal(renderer.root.findByType('code').props.title, '/workspace/next project');
});

test('WorkspaceEditor keeps editing and presents a rejected workspace error', async () => {
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(WorkspaceEditor, {
      workspace: '/workspace/current',
      async onSave() {
        const error = new Error('工作区路径不存在。');
        error.code = 'workspace-not-found';
        throw error;
      },
    }));
  });
  await act(async () => { renderer.root.findByType('button').props.onClick(); });
  await act(async () => {
    renderer.root.findByType('input').props.onChange({ target: { value: '/workspace/missing' } });
  });
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit(submitEvent());
  });

  assert.equal(renderer.root.findByProps({ role: 'alert' }).children.join(''), '工作区路径不存在。');
  assert.equal(renderer.root.findByType('input').props.value, '/workspace/missing');
});

test('WorkspaceEditor rejects a relative path before calling the Host', async () => {
  let saves = 0;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(WorkspaceEditor, {
      workspace: '/workspace/current',
      async onSave() { saves += 1; },
    }));
  });
  await act(async () => { renderer.root.findByType('button').props.onClick(); });
  await act(async () => {
    renderer.root.findByType('input').props.onChange({ target: { value: 'relative/path' } });
  });
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit(submitEvent());
  });

  assert.equal(saves, 0);
  assert.equal(renderer.root.findByProps({ role: 'alert' }).children.join(''), '工作区必须是绝对路径。');
});

test('WorkspaceEditor moves keyboard focus into and back out of edit mode', async () => {
  let inputFocus = 0;
  let editFocus = 0;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(WorkspaceEditor, {
      workspace: '/workspace/current',
      async onSave() {},
    }), {
      createNodeMock(element) {
        if (element.type === 'input') return { focus() { inputFocus += 1; } };
        if (element.props?.className === 'dim-workspaceEdit') {
          return { focus() { editFocus += 1; } };
        }
        return {};
      },
    });
  });
  await act(async () => { renderer.root.findByType('button').props.onClick(); });
  assert.equal(inputFocus, 1);
  const cancel = renderer.root.findAllByType('button')
    .find((button) => button.children.join('') === '取消');
  await act(async () => { cancel.props.onClick(); });
  assert.equal(editFocus, 1);
});

test('a status response started before saving cannot restore the old workspace', async (t) => {
  const previousWindow = globalThis.window;
  let intervalCallback;
  globalThis.window = {
    setInterval(callback) { intervalCallback = callback; return 1; },
    clearInterval() {},
  };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const staleStatus = deferred();
  let statusCalls = 0;
  const rpcCall = async (endpoint) => {
    if (endpoint === 'connection.status') {
      statusCalls += 1;
      if (statusCalls === 1) return { ok: true, value: discordSnapshot('/workspace/current') };
      if (statusCalls === 2) return staleStatus.promise;
      return { ok: true, value: discordSnapshot('/workspace/new') };
    }
    if (endpoint === 'bot.workspace.set') {
      return { ok: true, value: discordSnapshot('/workspace/new') };
    }
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  let renderer;
  await act(async () => {
    renderer = create(React.createElement(DiscordSettingsTab, { rpcCall }));
    await flushMicrotasks();
  });
  await act(async () => {
    intervalCallback();
    await flushMicrotasks();
  });
  await act(async () => {
    renderer.root.findAllByType('button')
      .find((button) => button.children.join('') === '修改').props.onClick();
  });
  await act(async () => {
    renderer.root.findByType('input').props.onChange({ target: { value: '/workspace/new' } });
    await renderer.root.findByType('form').props.onSubmit(submitEvent());
    await flushMicrotasks();
  });
  assert.equal(renderer.root.findByType('code').props.title, '/workspace/new');

  await act(async () => {
    staleStatus.resolve({ ok: true, value: discordSnapshot('/workspace/old') });
    await flushMicrotasks();
  });
  assert.equal(renderer.root.findByType('code').props.title, '/workspace/new');
  await act(async () => { renderer.unmount(); });
});

test('an older reconnect snapshot from another bot cannot restore a saved workspace', async (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = { setInterval() { return 1; }, clearInterval() {} };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const staleReconnect = deferred();
  let statusCalls = 0;
  const rpcCall = async (endpoint) => {
    if (endpoint === 'connection.status') {
      statusCalls += 1;
      return {
        ok: true,
        value: twoBotDiscordSnapshot(statusCalls === 1 ? '/workspace/current' : '/workspace/new'),
      };
    }
    if (endpoint === 'bot.reconnect') return staleReconnect.promise;
    if (endpoint === 'bot.workspace.set') {
      return { ok: true, value: twoBotDiscordSnapshot('/workspace/new') };
    }
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  let renderer;
  await act(async () => {
    renderer = create(React.createElement(DiscordSettingsTab, { rpcCall }));
    await flushMicrotasks();
  });
  const firstCard = renderer.root.findByProps({ 'data-bot-id': 'discord_first' });
  const secondCard = renderer.root.findByProps({ 'data-bot-id': 'discord_second' });
  await act(async () => {
    secondCard.findAllByType('button')
      .find((button) => button.children.join('') === '检查连接').props.onClick();
    await flushMicrotasks();
  });
  await act(async () => {
    firstCard.findAllByType('button')
      .find((button) => button.children.join('') === '修改').props.onClick();
  });
  await act(async () => {
    firstCard.findByType('input').props.onChange({ target: { value: '/workspace/new' } });
    await firstCard.findByType('form').props.onSubmit(submitEvent());
    await flushMicrotasks();
  });

  staleReconnect.resolve({ ok: true, value: twoBotDiscordSnapshot('/workspace/old') });
  await act(async () => { await flushMicrotasks(); });
  assert.equal(
    renderer.root.findByProps({ 'data-bot-id': 'discord_first' }).findByType('code').props.title,
    '/workspace/new',
  );
  await act(async () => { renderer.unmount(); });
});

test('an older reconnect snapshot cannot resurrect a bot deleted by a newer mutation', async (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = { setInterval() { return 1; }, clearInterval() {} };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const staleReconnect = deferred();
  const initialSnapshot = twoBotDiscordSnapshot('/workspace/first');
  const deletedSnapshot = { ...initialSnapshot, bots: initialSnapshot.bots.slice(1) };
  let statusCalls = 0;
  const rpcCall = async (endpoint) => {
    if (endpoint === 'connection.status') {
      statusCalls += 1;
      return { ok: true, value: statusCalls === 1 ? initialSnapshot : deletedSnapshot };
    }
    if (endpoint === 'bot.reconnect') return staleReconnect.promise;
    if (endpoint === 'bot.delete') return { ok: true, value: deletedSnapshot };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  let renderer;
  await act(async () => {
    renderer = create(React.createElement(DiscordSettingsTab, { rpcCall }));
    await flushMicrotasks();
  });
  const firstCard = renderer.root.findByProps({ 'data-bot-id': 'discord_first' });
  const secondCard = renderer.root.findByProps({ 'data-bot-id': 'discord_second' });
  await act(async () => {
    secondCard.findAllByType('button')
      .find((button) => button.children.join('') === '检查连接').props.onClick();
    await flushMicrotasks();
  });
  await act(async () => {
    firstCard.findAllByType('button')
      .find((button) => button.children.join('') === '移除接入').props.onClick();
  });
  await act(async () => {
    await firstCard.findAllByType('button')
      .find((button) => button.children.join('') === '确认移除接入').props.onClick();
    await flushMicrotasks();
  });
  assert.equal(renderer.root.findAllByProps({ 'data-bot-id': 'discord_first' }).length, 0);

  staleReconnect.resolve({ ok: true, value: initialSnapshot });
  await act(async () => { await flushMicrotasks(); });
  assert.equal(renderer.root.findAllByProps({ 'data-bot-id': 'discord_first' }).length, 0);
  await act(async () => { renderer.unmount(); });
});
