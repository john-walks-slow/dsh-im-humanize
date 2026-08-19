import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createHarnessSessionExecutors,
} from '../plugin-src/host/harness-session-coordinator.mjs';

function contextWith(registry) {
  return { get: (name) => name === 'agents' ? registry : undefined };
}

function liveAgent(overrides = {}) {
  const calls = [];
  const agent = {
    status: 'running',
    session: {
      events: [
        { seq: 1, type: 'turn/start', data: { turn: 6 } },
        { seq: 2, type: 'user/message', data: { source: { rpcId: 'older' } } },
        { seq: 3, type: 'turn/end', data: { turn: 6, reason: 'completed' } },
        { seq: 4, type: 'turn/start', data: { turn: 7 } },
        { seq: 5, type: 'user/message', data: { source: { rpcId: 'prompt-owned' } } },
      ],
    },
    cancel(...args) { calls.push(['cancel', ...args]); },
    inject(...args) { calls.push(['inject', ...args]); },
    steer() { throw new Error('agent.steer must never be called'); },
    ...overrides,
  };
  return { agent, calls };
}

test('Host control executor validates and mutates the exact open owned turn synchronously', () => {
  const { agent, calls } = liveAgent();
  const registry = { get: (sessionId) => sessionId === 'session-one' ? agent : undefined };
  const { controlExecutor } = createHarnessSessionExecutors(contextWith(registry));

  assert.equal(controlExecutor({
    sessionId: 'session-one',
    expectedTurn: 7,
    promptRpcId: 'prompt-owned',
    action: 'steer',
    text: '先检查日志\n再继续',
  }), true);
  assert.equal(calls.length, 1, 'inject must finish before the executor returns');
  const message = calls[0][1];
  assert.equal(calls[0][0], 'inject');
  assert.equal(message.role, 'user');
  assert.deepEqual(message.content, [{ type: 'text', text: '先检查日志\n再继续' }]);
  assert.deepEqual(message.source, { kind: 'user' });
  assert.match(message.id, /^[0-9a-f-]{36}$/i);
  assert.equal(Object.isFrozen(message), true);
  assert.equal(Object.isFrozen(message.content), true);
  assert.equal(Object.isFrozen(message.content[0]), true);

  assert.equal(controlExecutor({
    sessionId: 'session-one',
    expectedTurn: 7,
    promptRpcId: 'prompt-owned',
    action: 'stop',
  }), true);
  assert.deepEqual(calls[1], ['cancel', { kind: 'user' }, { keepInbox: true }]);
});

test('Host control executor refuses idle, replaced, closed, and foreign turns without waking', () => {
  const { agent, calls } = liveAgent();
  const { controlExecutor } = createHarnessSessionExecutors(contextWith({ get: () => agent }));
  const request = {
    sessionId: 'session-one',
    expectedTurn: 7,
    promptRpcId: 'prompt-owned',
    action: 'steer',
    text: 'must not wake',
  };

  assert.equal(controlExecutor({ ...request, promptRpcId: 'foreign' }), false);
  assert.equal(controlExecutor({ ...request, expectedTurn: 6 }), false);
  agent.status = 'idle';
  assert.equal(controlExecutor(request), false);
  agent.status = 'running';
  agent.session.events.push(
    { seq: 6, type: 'turn/end', data: { turn: 7, reason: 'cancelled' } },
    { seq: 7, type: 'turn/start', data: { turn: 8 } },
    { seq: 8, type: 'user/message', data: { source: { rpcId: 'someone-else' } } },
  );
  assert.equal(controlExecutor(request), false);
  assert.deepEqual(calls, []);
});

test('Host executors preserve HTTP fallback when AgentRegistry or attachment is absent', async () => {
  assert.deepEqual(createHarnessSessionExecutors({}), {
    controlExecutor: undefined,
    sessionMaintenanceExecutor: undefined,
  });
  assert.deepEqual(createHarnessSessionExecutors({ get() { throw new Error('not injected'); } }), {
    controlExecutor: undefined,
    sessionMaintenanceExecutor: undefined,
  });

  const { controlExecutor, sessionMaintenanceExecutor } = createHarnessSessionExecutors(
    contextWith({ get: () => undefined }),
  );
  assert.equal(controlExecutor({
    sessionId: 'cold-session', expectedTurn: 1, promptRpcId: 'rpc', action: 'stop',
  }), undefined);
  let operated = false;
  assert.equal(await sessionMaintenanceExecutor({
    sessionId: 'cold-session',
    operation: async (signal) => {
      operated = true;
      assert.equal(signal, undefined);
      return 'fallback';
    },
  }), 'fallback');
  assert.equal(operated, true);
});

test('Host maintenance executor claims idle synchronously and reports busy with a stable code', async () => {
  const maintenanceController = new AbortController();
  let operationStarted = false;
  const agent = {
    runMaintenance(operation) {
      operationStarted = true;
      return operation(maintenanceController.signal);
    },
  };
  const { sessionMaintenanceExecutor } = createHarnessSessionExecutors(
    contextWith({ get: () => agent }),
  );
  const value = sessionMaintenanceExecutor({
    sessionId: 'session-one',
    operation: async (signal) => {
      assert.equal(operationStarted, true);
      assert.equal(signal, maintenanceController.signal);
      return 'selected';
    },
  });
  assert.equal(operationStarted, true, 'maintenance must be claimed in the calling tick');
  assert.equal(await value, 'selected');

  const busy = new Error('already active');
  agent.runMaintenance = () => { throw busy; };
  assert.throws(() => sessionMaintenanceExecutor({
    sessionId: 'session-one', operation: async () => undefined,
  }), (error) => error?.code === 'agent-busy' && error.cause === busy);

  const rpcFailure = new Error('model unavailable');
  agent.runMaintenance = (operation) => operation(maintenanceController.signal);
  await assert.rejects(sessionMaintenanceExecutor({
    sessionId: 'session-one', operation: async () => { throw rpcFailure; },
  }), (error) => error === rpcFailure, 'async RPC failures must not be mislabeled as busy');
});
