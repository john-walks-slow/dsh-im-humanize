import assert from 'node:assert/strict';
import test from 'node:test';

import { HarnessClient, HarnessReplyTracker, HarnessRpcError } from '../../../src/channels/dingtalk/harness-client.mjs';

test('HarnessClient lists only absolute workspace paths and forwards request options', async () => {
  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080',
    workspace: '/tmp/default-workspace',
  });
  const options = {
    signal: new AbortController().signal,
    rpcId: 'dingtalk-workspace-list',
  };
  let ensuredWith;
  let rpcCall;
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
  client.ensureRunning = async (received) => { ensuredWith = received; };
  client.rpc = async (method, payload, timeoutMs, rpcOptions) => {
    rpcCall = { method, payload, timeoutMs, options: rpcOptions };
    return response;
  };

  assert.deepEqual(await client.listWorkspaces(options), [
    '/tmp/workspace-one',
    '/tmp/workspace two',
  ]);
  assert.equal(ensuredWith, options);
  assert.deepEqual(rpcCall, {
    method: 'workspace.list',
    payload: {},
    timeoutMs: 30_000,
    options,
  });

  response = null;
  assert.deepEqual(await client.listWorkspaces(), []);
});

test('HarnessClient lists sessions by workspace accounting and forwards request options', async () => {
  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080',
    workspace: '/tmp/default-workspace',
  });
  const options = {
    signal: new AbortController().signal,
    rpcId: 'dingtalk-session-list',
  };
  const calls = [];
  let invalidWorkspaceResponse = false;
  let invalidSessionResponse = false;
  client.ensureRunning = async (received) => {
    calls.push({ method: 'ensureRunning', options: received });
  };
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
    { method: 'ensureRunning', options },
    { method: 'workspace.list', payload: {}, timeoutMs: 30_000, options },
    { method: 'session.list', payload: {}, timeoutMs: 30_000, options },
  ]);

  calls.length = 0;
  assert.deepEqual(await client.listWorkspaceSessions('/tmp/unregistered'), {
    workspace: '/tmp/unregistered',
    sessions: [],
  });
  assert.deepEqual(calls, [
    { method: 'ensureRunning', options: {} },
    { method: 'workspace.list', payload: {}, timeoutMs: 30_000, options: {} },
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

test('HarnessClient adopts one registered ordinary session and forwards request options', async () => {
  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080',
    workspace: '/tmp/default-workspace',
    agentPreset: 'custom-preset',
  });
  const options = {
    signal: new AbortController().signal,
    rpcId: 'dingtalk-session-adopt',
  };
  const calls = [];
  client.ensureRunning = async (received) => {
    calls.push({ method: 'ensureRunning', options: received });
  };
  client.rpc = async (method, payload, timeoutMs, rpcOptions) => {
    calls.push({ method, payload, timeoutMs, options: rpcOptions });
    if (method === 'workspace.list') {
      return {
        items: [
          {
            workspaceId: 'workspace-target',
            path: '/tmp/target',
            sessionIds: ['session-other', 'session-target'],
          },
          { workspaceId: 'workspace-unsafe', path: '/tmp/unsafe\u202e', sessionIds: [] },
          { workspaceId: 'workspace-other', path: '/tmp/other', sessionIds: [] },
        ],
        archivedSessionIds: ['session-target'],
      };
    }
    if (method === 'session.list') {
      return {
        items: [{
          sessionId: 'session-target',
          projections: { values: { title: 'Existing conversation' } },
        }],
      };
    }
    assert.equal(method, 'session.create');
    return { sessionId: 'session-target', agentPreset: 'persisted-preset' };
  };

  assert.deepEqual(await client.adoptWorkspaceSession('session-target', options), {
    sessionId: 'session-target',
    workspace: '/tmp/target',
    title: 'Existing conversation',
    archived: true,
  });
  assert.deepEqual(calls, [
    { method: 'ensureRunning', options },
    { method: 'workspace.list', payload: {}, timeoutMs: 30_000, options },
    { method: 'session.list', payload: {}, timeoutMs: 30_000, options },
    {
      method: 'session.create',
      payload: { workspaceId: 'workspace-target', sessionId: 'session-target' },
      timeoutMs: 30_000,
      options,
    },
  ]);
});

test('HarnessClient safely rejects invalid, unregistered, ambiguous, and subagent adoption', async () => {
  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080',
    workspace: '/tmp/default-workspace',
  });
  let mode = 'unregistered';
  let createCalls = 0;
  client.ensureRunning = async () => undefined;
  client.rpc = async (method) => {
    if (method === 'workspace.list') {
      if (mode === 'invalid-workspaces') return { items: null, archivedSessionIds: [] };
      if (mode === 'unregistered') {
        return {
          items: [{ workspaceId: 'workspace', path: '/tmp/workspace', sessionIds: [] }],
          archivedSessionIds: [],
        };
      }
      return {
        items: [
          {
            workspaceId: 'workspace-one',
            path: '/tmp/one',
            sessionIds: ['session-target'],
          },
          ...(mode === 'ambiguous' ? [{
            workspaceId: 'workspace-two',
            path: '/tmp/two',
            sessionIds: ['session-target'],
          }] : []),
        ],
        archivedSessionIds: [],
      };
    }
    if (method === 'session.list') {
      if (mode === 'summary-missing') return { items: [] };
      return {
        items: [{
          sessionId: 'session-target',
          ...(mode === 'subagent' ? { origin: 'subagent' } : {}),
        }],
      };
    }
    createCalls += 1;
    return mode === 'bad-create'
      ? { sessionId: 'different-session' }
      : { sessionId: 'session-target' };
  };

  for (const invalid of [
    undefined,
    '',
    '   ',
    'session target',
    'session\u0000target',
    's'.repeat(257),
  ]) {
    await assert.rejects(
      client.adoptWorkspaceSession(invalid),
      (error) => error?.code === 'session-id-invalid',
    );
  }
  await assert.rejects(
    client.adoptWorkspaceSession('session-target'),
    (error) => error?.code === 'session-not-registered',
  );
  mode = 'ambiguous';
  await assert.rejects(
    client.adoptWorkspaceSession('session-target'),
    (error) => error?.code === 'session-workspace-ambiguous',
  );
  mode = 'summary-missing';
  await assert.rejects(
    client.adoptWorkspaceSession('session-target'),
    (error) => error?.code === 'session-summary-unavailable',
  );
  mode = 'subagent';
  await assert.rejects(
    client.adoptWorkspaceSession('session-target'),
    (error) => error?.code === 'session-subagent-unsupported',
  );
  assert.equal(createCalls, 0);

  mode = 'invalid-workspaces';
  await assert.rejects(
    client.adoptWorkspaceSession('session-target'),
    /invalid response for workspace\.list/,
  );
  mode = 'bad-create';
  await assert.rejects(
    client.adoptWorkspaceSession('session-target'),
    /invalid response for session\.create/,
  );
  assert.equal(createCalls, 1);
});

test('reply tracker associates only the Harness turn created by the DingTalk prompt RPC', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: 'dingtalk-prompt', afterSeq: 2 });
  const update = tracker.consume([
    { event: { seq: 3, type: 'turn/start', data: { turn: 9 } } },
    { event: {
      seq: 4,
      type: 'user/message',
      data: { turn: 9, source: { rpcId: 'dingtalk-prompt' } },
    } },
    { event: {
      seq: 5,
      type: 'assistant/chunk',
      data: { turn: 9, step: 0, chunk: { type: 'text-delta', index: 0, text: '钉钉' } },
    } },
  ]);
  assert.deepEqual(update, { type: 'text', text: '钉钉' });
  tracker.consume([
    { event: {
      seq: 6,
      type: 'assistant/message',
      data: { turn: 9, message: { content: [{ type: 'text', text: '钉钉回复完成' }] } },
    } },
    { event: { seq: 7, type: 'turn/end', data: { turn: 9, reason: 'completed' } } },
  ]);
  assert.equal(tracker.finished, true);
  assert.equal(tracker.answer, '钉钉回复完成');
});

test('reply tracker ignores interleaved turns and events at or before the baseline', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: 'target', afterSeq: 10 });
  tracker.consume([
    { event: { seq: 9, type: 'turn/start', data: { turn: 1 } } },
    { event: { seq: 11, type: 'turn/start', data: { turn: 2 } } },
    { event: { seq: 12, type: 'user/message', data: { turn: 2, source: { rpcId: 'other' } } } },
    { event: {
      seq: 13,
      type: 'assistant/message',
      data: { turn: 2, message: { content: [{ type: 'text', text: 'wrong' }] } },
    } },
  ]);
  assert.equal(tracker.answer, '');
  assert.equal(tracker.finished, false);
});

test('Harness client validates the RPC envelope and preserves server error codes', async () => {
  let request;
  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080',
    workspace: '/tmp/workspace',
    fetchImpl: async (url, options) => {
      request = { url: url.toString(), body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          type: 'server-response',
          rpcId: request.body.rpcId,
          result: { ok: false, error: { code: 'session-not-found', message: 'missing' } },
        }),
      };
    },
  });

  await assert.rejects(
    client.rpc('session.history', { sessionId: 'one' }),
    (error) => error instanceof HarnessRpcError && error.code === 'session-not-found',
  );
  assert.equal(request.url, 'http://127.0.0.1:3080/api/session.history');
  assert.match(request.body.rpcId, /^dingtalk-/);
});
