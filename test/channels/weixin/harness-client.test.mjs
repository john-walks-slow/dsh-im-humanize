import assert from 'node:assert/strict';
import test from 'node:test';

import { HarnessClient, HarnessReplyTracker } from '../../../src/channels/weixin/harness-client.mjs';

test('HarnessClient lists only absolute workspace paths', async () => {
  const client = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080',
    workspace: '/tmp/default-workspace',
  });
  const options = { rpcId: 'weixin-workspace-list' };
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
    { method: 'workspace.list', payload: {}, timeoutMs: 30_000, options },
  ]);

  response = { items: 'invalid' };
  assert.deepEqual(await client.listWorkspaces(), []);
});

test('reply tracker associates only the Harness turn created by the Weixin prompt RPC', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: 'weixin-prompt', afterSeq: 2 });
  const first = tracker.consume([
    { event: { seq: 3, type: 'turn/start', data: { turn: 9 } } },
    { event: {
      seq: 4,
      type: 'user/message',
      data: { turn: 9, source: { rpcId: 'weixin-prompt' } },
    } },
    { event: {
      seq: 5,
      type: 'assistant/chunk',
      data: { turn: 9, step: 0, chunk: { type: 'text-delta', index: 0, text: '微信' } },
    } },
  ]);
  assert.deepEqual(first, { type: 'text', text: '微信' });
  tracker.consume([
    { event: {
      seq: 6,
      type: 'assistant/message',
      data: { turn: 9, message: { content: [{ type: 'text', text: '微信回复完成' }] } },
    } },
    { event: { seq: 7, type: 'turn/end', data: { turn: 9, reason: 'completed' } } },
  ]);
  assert.equal(tracker.finished, true);
  assert.equal(tracker.answer, '微信回复完成');
});

test('reply tracker ignores interleaved turns and older events', () => {
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
