import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HarnessClient,
  HarnessReplyTracker,
} from '../../../src/channels/feishu/harness-client.mjs';

test('HarnessClient lists only absolute workspace paths', async () => {
  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080',
    workspace: '/tmp/default-workspace',
  });
  const options = { rpcId: 'feishu-workspace-list' };
  const calls = [];
  let response = {
    items: [
      {
        workspaceId: 'workspace-one',
        path: '/tmp/workspace-one',
        title: 'private title',
        sessionIds: ['private-session'],
      },
      { workspaceId: 'relative', path: 'relative/workspace' },
      null,
      { workspaceId: 'workspace-two', path: '/tmp/workspace two' },
    ],
    archivedSessionIds: ['private-archive'],
  };
  client.ensureRunning = async () => { calls.push({ method: 'ensureRunning' }); };
  client.rpc = async (method, payload, timeoutMs, rpcOptions) => {
    calls.push({ method, payload, timeoutMs, options: rpcOptions });
    return response;
  };

  assert.deepEqual(await client.listWorkspaces(options), [
    '/tmp/workspace-one',
    '/tmp/workspace two',
  ]);
  assert.deepEqual(calls, [
    { method: 'ensureRunning' },
    { method: 'workspace.list', payload: {}, timeoutMs: 30000, options },
  ]);

  response = { items: 'invalid' };
  assert.deepEqual(await client.listWorkspaces(), []);
});

test('HarnessClient lists sessions by workspace accounting in its stored order', async () => {
  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080',
    workspace: '/tmp/default-workspace',
  });
  const options = { rpcId: 'feishu-session-list' };
  const calls = [];
  let invalidWorkspaceResponse = false;
  let invalidSessionResponse = false;
  client.ensureRunning = async () => { calls.push({ method: 'ensureRunning' }); };
  client.rpc = async (method, payload, timeoutMs, rpcOptions) => {
    calls.push({ method, payload, timeoutMs, options: rpcOptions });
    if (method === 'workspace.list') {
      if (invalidWorkspaceResponse) return null;
      return {
        items: [
          {
            workspaceId: 'target',
            path: '/tmp/target',
            sessionIds: ['session-two', 'session-missing', 'session-one'],
          },
          { workspaceId: 'other', path: '/tmp/other', sessionIds: ['cwd-only'] },
        ],
        archivedSessionIds: ['session-missing', 'session-one'],
      };
    }
    assert.equal(method, 'session.list');
    if (invalidSessionResponse) return null;
    return {
      items: [
        {
          sessionId: 'session-one',
          blank: false,
          cwd: '/tmp/target',
          projections: { values: { title: null } },
        },
        {
          sessionId: 'session-two',
          blank: true,
          origin: 'subagent',
          cwd: '/tmp/different',
          projections: { values: { title: 'Second session' } },
        },
        {
          sessionId: 'cwd-only',
          blank: false,
          cwd: '/tmp/target',
          projections: { values: { title: 'Must not leak into target' } },
        },
      ],
    };
  };

  assert.deepEqual(await client.listWorkspaceSessions('/tmp/target', options), {
    workspace: '/tmp/target',
    sessions: [
      {
        sessionId: 'session-two',
        title: 'Second session',
        archived: false,
        blank: true,
        origin: 'subagent',
        summaryAvailable: true,
      },
      {
        sessionId: 'session-missing',
        title: null,
        archived: true,
        blank: false,
        origin: null,
        summaryAvailable: false,
      },
      {
        sessionId: 'session-one',
        title: null,
        archived: true,
        blank: false,
        origin: null,
        summaryAvailable: true,
      },
    ],
  });
  assert.deepEqual(calls, [
    { method: 'ensureRunning' },
    { method: 'workspace.list', payload: {}, timeoutMs: 30000, options },
    { method: 'session.list', payload: {}, timeoutMs: 30000, options },
  ]);

  calls.length = 0;
  assert.deepEqual(await client.listWorkspaceSessions('/tmp/unregistered'), {
    workspace: '/tmp/unregistered',
    sessions: [],
  });
  assert.deepEqual(calls, [
    { method: 'ensureRunning' },
    { method: 'workspace.list', payload: {}, timeoutMs: 30000, options: {} },
  ]);

  invalidWorkspaceResponse = true;
  await assert.rejects(
    client.listWorkspaceSessions('/tmp/target'),
    /invalid response for workspace\.list/,
  );
  invalidWorkspaceResponse = false;
  invalidSessionResponse = true;
  await assert.rejects(
    client.listWorkspaceSessions('/tmp/target'),
    /invalid response for session\.list/,
  );
});

test('HarnessClient reads the nested workspace.create response used by DSH rc.6', async (t) => {
  const methods = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const request = JSON.parse(options.body);
    methods.push(request.method);
    const value = request.method === 'workspace.list'
      ? { items: [], archivedSessionIds: [] }
      : {
          workspace: {
            workspaceId: 'workspace-new',
            path: '/tmp/dsh-feishu-workspace',
          },
          created: true,
        };
    return {
      ok: true,
      async json() {
        return {
          type: 'server-response',
          rpcId: request.rpcId,
          result: { ok: true, value },
        };
      },
    };
  });

  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080',
    workspace: '/tmp/dsh-feishu-workspace',
    agentPreset: 'standard',
    autostart: false,
    dshBin: 'dsh',
  });

  assert.equal(await client.workspaceId(), 'workspace-new');
  assert.deepEqual(methods, ['workspace.list', 'workspace.create']);
});

test('HarnessReplyTracker correlates the prompt and emits only answer text', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: 'prompt-1', afterSeq: 10 });

  assert.equal(tracker.consume([
    { event: { type: 'turn/start', seq: 11, data: { turn: 4 } } },
    { event: {
      type: 'user/message',
      seq: 12,
      data: { source: { rpcId: 'someone-else' } },
    } },
    { event: {
      type: 'assistant/chunk',
      seq: 13,
      data: { turn: 4, step: 1, chunk: { type: 'text-delta', index: 0, text: '忽略' } },
    } },
    { event: { type: 'turn/end', seq: 14, data: { turn: 4, reason: { kind: 'completed' } } } },
  ]), null);
  assert.equal(tracker.finished, false);

  const first = tracker.consume([
    { event: { type: 'turn/start', seq: 15, data: { turn: 5 } } },
    { event: {
      type: 'user/message',
      seq: 16,
      data: { source: { rpcId: 'prompt-1' } },
    } },
    { event: {
      type: 'assistant/chunk',
      seq: 17,
      data: { turn: 5, step: 1, chunk: { type: 'reasoning-delta', index: 0, text: '不能泄露' } },
    } },
    { event: {
      type: 'assistant/chunk',
      seq: 18,
      data: { turn: 5, step: 1, chunk: { type: 'text-delta', index: 1, text: '深圳' } },
    } },
  ]);
  assert.deepEqual(first, { type: 'text', text: '深圳' });

  const second = tracker.consume([
    { event: {
      type: 'assistant/chunk',
      seq: 18,
      data: { turn: 5, step: 1, chunk: { type: 'text-delta', index: 1, text: '重复' } },
    } },
    { event: {
      type: 'assistant/chunk',
      seq: 19,
      data: { turn: 5, step: 1, chunk: { type: 'text-delta', index: 1, text: '明天有雨' } },
    } },
  ]);
  assert.deepEqual(second, { type: 'text', text: '深圳明天有雨' });

  const final = tracker.consume([
    { event: {
      type: 'assistant/message',
      seq: 20,
      data: {
        turn: 5,
        step: 1,
        message: { content: [
          { type: 'reasoning', text: '仍然不能泄露' },
          { type: 'text', text: '深圳明天有阵雨。' },
        ] },
      },
    } },
    { event: { type: 'turn/end', seq: 21, data: { turn: 5, reason: { kind: 'completed' } } } },
  ]);
  assert.deepEqual(final, { type: 'text', text: '深圳明天有阵雨。' });
  assert.equal(tracker.finished, true);
  assert.equal(tracker.answer, '深圳明天有阵雨。');
  assert.deepEqual(tracker.reason, { kind: 'completed' });
});

test('HarnessReplyTracker emits tool progress without exposing tool results', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: 'prompt-tool' });
  const update = tracker.consume([
    { type: 'turn/start', seq: 1, data: { turn: 1 } },
    { type: 'user/message', seq: 2, data: { source: { rpcId: 'prompt-tool' } } },
    { type: 'tool/call', seq: 3, data: { turn: 1, step: 1, name: 'web_search' } },
  ]);
  assert.deepEqual(update, { type: 'tool', name: 'web_search' });

  assert.deepEqual(tracker.consume([
    { type: 'tool/result', seq: 4, data: { turn: 1, step: 1, secret: 'not rendered' } },
  ]), { type: 'status', text: '正在整理结果…' });
});
