import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HarnessClient,
  HarnessReplyTracker,
} from '../../../src/channels/feishu/harness-client.mjs';

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

class FakeSocket {
  #listeners = new Map();
  readyState = 0;

  addEventListener(name, listener) {
    const listeners = this.#listeners.get(name) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.#listeners.get(name)?.delete(listener);
  }

  open() {
    if (this.readyState !== 0) return;
    this.readyState = 1;
    this.#emit('open', {});
  }

  frame(value) {
    this.#emit('message', { data: JSON.stringify(value) });
  }

  close(code = 1000) {
    if (this.readyState >= 2) return;
    this.readyState = 3;
    this.#emit('close', { code });
  }

  #emit(name, event) {
    for (const listener of [...(this.#listeners.get(name) ?? [])]) listener(event);
  }
}

test('interaction watcher uses the real Harness wire protocol and leaves approvals fail-closed', async () => {
  const requests = [];
  const opened = deferred();
  let socket;
  let socketUrl;
  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080/base',
    workspace: '/tmp/dsh-feishu-workspace',
    fetchImpl: async (url, options) => {
      requests.push({
        url: url.toString(),
        method: options.method,
        body: JSON.parse(options.body),
      });
      return { ok: true, json: async () => ({ accepted: true }) };
    },
    createWebSocket: (url) => {
      socketUrl = url;
      socket = new FakeSocket();
      queueMicrotask(() => socket.open());
      return socket;
    },
  });
  const controller = new AbortController();
  const interactions = [];
  const watching = client.watchInteractions('session-feishu', {
    signal: controller.signal,
    onOpen: opened.resolve,
    onInteraction: (interaction) => interactions.push(interaction),
  });
  await opened.promise;

  socket.frame({
    type: 'server-request',
    rpcId: 'approval-rpc',
    method: 'approval/requested',
    payload: {
      type: 'approval/requested',
      sessionId: 'session-feishu',
      approvalId: 'approval-one',
      toolName: 'bash',
    },
  });
  socket.frame({
    type: 'server-request',
    rpcId: 'question-rpc',
    method: 'question/requested',
    payload: {
      type: 'question/requested',
      sessionId: 'session-feishu',
      questions: [{
        id: 'environment',
        question: '请选择测试环境',
        options: [{ label: '测试环境' }, { label: '生产环境' }],
      }],
    },
  });

  await eventually(() => interactions.length === 2);
  assert.equal(socketUrl, 'ws://127.0.0.1:3080/api/events.mux');
  assert.deepEqual(interactions.map((interaction) => ({
    kind: interaction.kind,
    interactionId: interaction.interactionId,
    rpcId: interaction.rpcId,
    sessionId: interaction.sessionId,
  })), [
    {
      kind: 'approval',
      interactionId: 'approval-one',
      rpcId: 'approval-rpc',
      sessionId: 'session-feishu',
    },
    {
      kind: 'question',
      interactionId: 'question-rpc',
      rpcId: 'question-rpc',
      sessionId: 'session-feishu',
    },
  ]);
  assert.equal(requests.length, 0, 'receiving an approval must never approve it automatically');

  const result = {
    ok: true,
    value: {
      sessionId: 'session-feishu',
      answer: { answers: [{ id: 'environment', selected: ['测试环境'] }] },
    },
  };
  assert.deepEqual(await interactions[1].respond(result), { accepted: true });
  assert.deepEqual(requests, [{
    url: 'http://127.0.0.1:3080/api/respond',
    method: 'POST',
    body: { type: 'client-response', rpcId: 'question-rpc', result },
  }]);

  controller.abort();
  await watching;
  assert.equal(socket.readyState, 3);
});

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

test('HarnessClient adopts one registered ordinary session without changing its preset', async () => {
  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080',
    workspace: '/tmp/default-workspace',
    agentPreset: 'custom-preset',
  });
  const options = {
    signal: new AbortController().signal,
    rpcId: 'feishu-session-adopt',
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
    { method: 'workspace.list', payload: {}, timeoutMs: 30000, options },
    { method: 'session.list', payload: {}, timeoutMs: 30000, options },
    {
      method: 'session.create',
      payload: { workspaceId: 'workspace-target', sessionId: 'session-target' },
      timeoutMs: 30000,
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
