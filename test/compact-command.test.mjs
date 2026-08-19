import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { runCompactCommand } from '../src/channels/shared/compact-command.mjs';
import {
  HarnessClient,
  HarnessRpcError,
} from '../src/channels/shared/harness-client.mjs';
import { createHarnessCommandExecutor } from '../plugin-src/host/harness-command-executor.mjs';

const PRODUCTION_FILES = [
  'plugin-src/host/channels/feishu/production.mjs',
  'plugin-src/host/channels/weixin/production.mjs',
  'plugin-src/host/channels/dingtalk/production.mjs',
  'plugin-src/host/channels/wecom/production.mjs',
  'plugin-src/host/channels/qq/production.mjs',
  'plugin-src/host/channels/slack/production.mjs',
  'plugin-src/host/channels/shared/production.mjs',
  'plugin-src/host/channels/whatsapp/production.mjs',
];

function state(sessionId = 'session-one') {
  return { sessionFor: () => sessionId };
}

test('compact command validates syntax and requires an existing conversation Session', async () => {
  assert.equal(await runCompactCommand('hello', {}, state(), 'direct:one'), null);
  assert.match(
    (await runCompactCommand('/compact now', {}, state(), 'direct:one')).message,
    /不带参数/,
  );
  assert.match(
    (await runCompactCommand('/COMPACT', {}, state(null), 'direct:one')).message,
    /还没有可压缩的会话/,
  );
  assert.match(
    (await runCompactCommand('/compact', {}, state(), 'direct:one')).message,
    /暂不支持/,
  );
});

test('compact command renders Harness outcomes and never changes the command line', async () => {
  const calls = [];
  const harness = {
    executeCommand: async (sessionId, line, options) => {
      calls.push({ sessionId, line, options });
      return {
        commandId: 'command-one',
        result: { kind: 'error', text: 'Compaction cancelled.' },
      };
    },
  };
  const signal = new AbortController().signal;
  const result = await runCompactCommand(
    ' /COMPACT ',
    harness,
    state(),
    'direct:one',
    { signal },
  );

  assert.equal(result.message, '上下文压缩已取消。');
  assert.deepEqual(calls, [{
    sessionId: 'session-one',
    line: '/compact',
    options: { signal },
  }]);
});

test('compact command contains unavailable, busy, stale, and invalid command failures', async () => {
  for (const [failure, pattern] of [
    [{ code: 'session-not-found' }, /会话已不存在/],
    [{ code: 'agent-busy' }, /正在生成回复/],
    [{ code: 'workspace-session-stale' }, /状态已发生变化/],
    [{ code: 'commands-unavailable' }, /暂不支持/],
    [new Error('private internal detail'), /压缩失败/],
  ]) {
    const result = await runCompactCommand('/compact', {
      executeCommand: async () => { throw failure; },
    }, state(), 'direct:one');
    assert.match(result.message, pattern);
    assert.doesNotMatch(result.message, /private internal detail/);
  }

  assert.match((await runCompactCommand('/compact', {
    executeCommand: async () => undefined,
  }, state(), 'direct:one')).message, /未注册/);
  assert.match((await runCompactCommand('/compact', {
    executeCommand: async () => ({ commandId: 'bad', result: { kind: 'other' } }),
  }, state(), 'direct:one')).message, /压缩失败/);
});

test('HarnessClient delegates command execution and normalizes Typert lookup failures', async () => {
  const calls = [];
  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:1',
    workspace: '/tmp',
    commandExecutor: async (...args) => {
      calls.push(args);
      return { commandId: 'command-one', result: { kind: 'success' } };
    },
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await client.executeCommand('session-one', '/compact', { signal }), {
    commandId: 'command-one',
    result: { kind: 'success' },
  });
  assert.deepEqual(calls, [['session-one', '/compact', { signal }]]);

  const unavailable = new HarnessClient({ baseUrl: 'http://127.0.0.1:1', workspace: '/tmp' });
  await assert.rejects(unavailable.executeCommand('session-one', '/compact'), {
    code: 'commands-unavailable',
  });

  const rejected = new HarnessClient({
    baseUrl: 'http://127.0.0.1:1',
    workspace: '/tmp',
    commandExecutor: async () => {
      const error = new Error('lookup rejected');
      error.failure = { code: 'agent-busy', message: 'busy', details: { reason: 'turn active' } };
      throw error;
    },
  });
  await assert.rejects(
    rejected.executeCommand('session-one', '/compact'),
    (error) => error instanceof HarnessRpcError && error.code === 'agent-busy',
  );
});

test('Host command executor invokes the commands Typert endpoint with the Session identity', async () => {
  const requests = [];
  const executor = createHarnessCommandExecutor({
    typertGateway: { invoke: async (request) => {
      requests.push(request);
      return { commandId: 'command-one', result: { kind: 'success' } };
    } },
  });
  const signal = new AbortController().signal;

  assert.deepEqual(await executor('session-one', '/compact', { signal }), {
    commandId: 'command-one',
    result: { kind: 'success' },
  });
  assert.deepEqual(requests, [{
    namespace: 'commands',
    method: 'execute',
    args: { agentId: 'session-one', line: '/compact' },
    signal,
  }]);
  assert.equal(createHarnessCommandExecutor({}), undefined);
  assert.throws(() => createHarnessCommandExecutor({}, 'invalid'), /must be a function/);
});

test('all nine production channels receive the Host command executor', async () => {
  for (const path of PRODUCTION_FILES) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(source, /createHarnessCommandExecutor\(ctx, internals\.commandExecutor\)/, path);
    assert.match(source, /commandExecutor \? \{ commandExecutor \} : \{\}/, path);
  }

  for (const channel of [
    'feishu', 'weixin', 'dingtalk', 'wecom', 'qq',
    'slack', 'telegram', 'discord', 'whatsapp',
  ]) {
    const source = await readFile(
      new URL(`../plugin-src/host/channels/${channel}/index.mjs`, import.meta.url),
      'utf8',
    );
    assert.match(source, /'typertGateway'/, channel);
  }
});

test('all nine production channels defer an omitted agent preset to the Harness Host', async () => {
  for (const path of PRODUCTION_FILES) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /agentPreset:\s*config\.agentPreset\s*\?\?\s*['"]standard['"]/, path);
    assert.match(
      source,
      /\.\.\.\(config\.agentPreset == null \? \{\} : \{ agentPreset: config\.agentPreset \}\)/,
      path,
    );
  }

  for (const channel of ['telegram', 'discord']) {
    const source = await readFile(
      new URL(`../plugin-src/host/channels/${channel}/production.mjs`, import.meta.url),
      'utf8',
    );
    assert.match(
      source,
      /createTokenProductionController\(ctx, config, internals,/,
      `${channel} must delegate to the shared production assembly`,
    );
  }
});
