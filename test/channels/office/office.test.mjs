import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { OfficeConfigStore } from '../../../src/channels/office/config-store.mjs';
import { OfficeController } from '../../../src/channels/office/office-controller.mjs';
import { OfficeTransport } from '../../../src/channels/office/office-transport.mjs';
import { OfficeJobExecutor } from '../../../src/channels/office/office-job-executor.mjs';
import {
  OFFICE_PROTOCOL_VERSION,
  OFFICE_RPC_ENDPOINTS,
  officeHookUrls,
} from '../../../src/channels/office/protocol.mjs';
import { createOfficeRpcHandler } from '../../../plugin-src/host/channels/office/rpc.mjs';
import { OfficeSettingsTab } from '../../../plugin-src/client/channels/office/index.js';

const TOKEN = 'office-device-token-ABCDEFGHIJKLMNOPQRSTUVWXYZ-123456';

async function eventually(predicate, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('condition did not become true');
}

function config(overrides = {}) {
  return {
    version: 1,
    baseUrl: 'https://fission.gridmind.ai',
    deviceId: 'mac-a004',
    deviceTokenRef: 'DSH_OFFICE_DEVICE_TOKEN_1234567890ABCDEF12345678',
    maxConcurrency: 1,
    heartbeatSeconds: 30,
    workspaces: { 'office-project': '/Users/a004/glassespaw-ai-office-web' },
    instructionPresets: { 'action-items': 'Convert into executable action items.' },
    ...overrides,
  };
}

function credentials() {
  const values = new Map();
  return {
    values,
    resolve: async (ref) => values.has(ref) ? { value: values.get(ref), source: 'test' } : undefined,
    set: async (ref, value) => values.set(ref, value),
    unset: async (ref) => values.delete(ref),
  };
}

test('AI Office protocol derives every fixed hook from one HTTPS origin', () => {
  const hooks = officeHookUrls('https://fission.gridmind.ai');
  assert.equal(OFFICE_PROTOCOL_VERSION, 'office-harness.v1');
  assert.equal(hooks.stream, 'https://fission.gridmind.ai/api/harness/connector/stream');
  assert.equal(hooks.result, 'https://fission.gridmind.ai/api/harness/connector/jobs/:id/result');
  assert.throws(() => officeHookUrls('http://public.example'), /must use HTTPS/);
  assert.equal(officeHookUrls('http://127.0.0.1:4300').heartbeat, 'http://127.0.0.1:4300/api/harness/connector/heartbeat');
});

test('AI Office config persists safe aliases without a Device Token', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-office-config-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'config.json');
  const store = await new OfficeConfigStore(path).load();
  await store.save(config());
  const raw = await readFile(path, 'utf8');
  assert.doesNotMatch(raw, /office-device-token/);
  assert.match(raw, /office-project/);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.deepEqual(store.get().workspaces, { 'office-project': '/Users/a004/glassespaw-ai-office-web' });
  await assert.rejects(() => store.save(config({ workspaces: { unsafe: 'relative/path' } })), /invalid/);
});

test('AI Office transport authenticates heartbeat and parses SSE frames', async () => {
  const calls = [];
  const encoder = new TextEncoder();
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/heartbeat')) {
      return Response.json({ ok: true, protocolVersion: OFFICE_PROTOCOL_VERSION });
    }
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('id: evt-1\nevent: job.available\ndata: {"type":"job.available","jobId":"job-1"}\n\n'));
        controller.close();
      },
    }), { headers: { 'content-type': 'text/event-stream' } });
  };
  const transport = new OfficeTransport({
    baseUrl: 'https://fission.gridmind.ai', deviceId: 'mac-a004', token: TOKEN, fetchImpl,
  });
  await transport.heartbeat({ protocolVersion: OFFICE_PROTOCOL_VERSION });
  const events = [];
  await assert.rejects(() => transport.stream({ onEvent: (event) => events.push(event) }), /stream ended/);
  assert.equal(calls[0].options.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0].options.headers['x-harness-device-id'], 'mac-a004');
  assert.deepEqual(events, [{
    id: 'evt-1', type: 'job.available', data: { type: 'job.available', jobId: 'job-1' },
  }]);
});

test('AI Office transport uses fixed Job hooks and keeps the lease outside JSON bodies', async () => {
  const calls = [];
  const transport = new OfficeTransport({
    baseUrl: 'https://fission.gridmind.ai',
    deviceId: 'mac-a004',
    token: TOKEN,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return Response.json({ ok: true });
    },
  });
  const jobId = 'job-1234567890abcdef1234567890abcdef';
  await transport.getJob(jobId);
  await transport.acceptJob(jobId);
  await transport.progressJob(jobId, 'lease-secret', { kind: 'status', message: 'running' });
  assert.equal(calls[0].url, `https://fission.gridmind.ai/api/harness/connector/jobs/${jobId}`);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[1].url.endsWith(`/${jobId}/accept`), true);
  assert.equal(calls[2].options.headers['x-harness-lease-token'], 'lease-secret');
  assert.equal(calls[2].options.body.includes('lease-secret'), false);
});

test('AI Office controller stores the token in credentials and returns only safe status', async () => {
  let stored = null;
  const credentialStore = credentials();
  const runtimes = [];
  const controller = new OfficeController({
    credentials: credentialStore,
    configStore: {
      get: () => stored,
      save: async (value) => { stored = structuredClone(value); return stored; },
      clear: async () => { stored = null; },
    },
    createRuntime: (options) => {
      const runtime = {
        options,
        status: { state: 'connected', connected: true, reconnects: 0 },
        start() {},
        stop: async () => {},
        testConnection: async () => ({ ok: true }),
      };
      runtimes.push(runtime);
      return runtime;
    },
  });
  const status = await controller.configure({
    baseUrl: 'https://fission.gridmind.ai', deviceId: 'mac-a004', deviceToken: TOKEN,
    maxConcurrency: 1, heartbeatSeconds: 30,
    workspaces: { 'office-project': '/Users/a004/project' },
    instructionPresets: { 'action-items': 'Make tasks.' },
  });
  assert.equal(status.connected, true);
  assert.equal(status.tokenConfigured, true);
  assert.equal(JSON.stringify(status).includes(TOKEN), false);
  assert.equal(credentialStore.values.size, 1);
  assert.equal(runtimes[0].options.token, TOKEN);
  await controller.remove();
  assert.equal(credentialStore.values.size, 0);
});

test('AI Office controller normalizes the origin and tolerates a missing local credential on startup', async () => {
  const credentialStore = credentials();
  let stored = config();
  const configStore = {
    get: () => stored,
    save: async (value) => { stored = structuredClone(value); return stored; },
    clear: async () => { stored = null; },
  };
  const controller = new OfficeController({
    credentials: credentialStore,
    configStore,
    createRuntime: () => ({
      status: { state: 'connected', connected: true },
      start() {},
      stop: async () => {},
    }),
  });
  const initial = await controller.initialize();
  assert.equal(initial.configured, true);
  assert.equal(initial.state, 'missing-token');

  await controller.configure({
    baseUrl: 'https://fission.gridmind.ai/path/', deviceId: 'mac-a004', deviceToken: TOKEN,
    maxConcurrency: 1, heartbeatSeconds: 30, workspaces: {}, instructionPresets: {},
  });
  assert.equal(stored.baseUrl, 'https://fission.gridmind.ai');
  assert.equal(credentialStore.values.size, 1);
  await controller.close();
});

test('AI Office RPC validates configuration and keeps transport failures safe', async () => {
  const calls = [];
  const handler = createOfficeRpcHandler({
    status: async () => ({ configured: false }),
    configure: async (payload) => { calls.push(payload); return { configured: true }; },
    reconnect: async () => ({ configured: true }),
    test: async () => { const error = new Error('HTTP 404 internal URL'); error.code = 'office-hook-unavailable'; throw error; },
    remove: async () => ({ configured: false }),
  });
  assert.deepEqual(await handler(OFFICE_RPC_ENDPOINTS.configure, { baseUrl: 'x' }), {
    ok: false, error: { code: 'bad-request', message: 'Invalid AI Office connector request.' },
  });
  assert.equal((await handler(OFFICE_RPC_ENDPOINTS.configure, {
    baseUrl: 'https://fission.gridmind.ai', deviceId: 'mac-a004', deviceToken: TOKEN,
    workspaces: {}, instructionPresets: {},
  })).ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(await handler(OFFICE_RPC_ENDPOINTS.test, {}), {
    ok: false, error: { code: 'office-hook-unavailable', message: 'AI Office Hook 尚未上线或地址不正确。' },
  });
});

test('AI Office settings renders connection fields and fixed hook preview', () => {
  const markup = renderToStaticMarkup(React.createElement(OfficeSettingsTab, {
    rpcCall: async () => ({ ok: true, value: { configured: false } }),
    initialStatus: { configured: false },
  }));
  assert.match(markup, /AI Office Connector/);
  assert.match(markup, /Office Base URL/);
  assert.match(markup, /Device Token/);
  assert.match(markup, /Workspace 映射/);
  assert.match(markup, /api\/harness\/connector\/stream/);
});

test('AI Office Job executor claims, reports, approves, and returns one Harness result', async () => {
  const jobId = 'job-1234567890abcdef1234567890abcdef';
  const progress = [];
  const approvals = [];
  const results = [];
  const responses = [];
  let executor;
  const transport = {
    getJob: async () => ({ job: {
      id: jobId,
      workspaceAlias: 'office-project',
      instructionPreset: 'execute',
      instruction: 'Return evidence.',
      markdown: '# Office timeline',
    } }),
    acceptJob: async () => ({ leaseToken: 'lease-token-1234567890' }),
    renewJob: async () => ({ leaseExpiresAt: new Date(Date.now() + 90_000).toISOString() }),
    progressJob: async (_id, _lease, value) => { progress.push(value); return { ok: true }; },
    requestApproval: async (_id, _lease, value) => {
      approvals.push(value);
      queueMicrotask(() => executor.handleEvent({
        type: 'approval.reply',
        data: { jobId, approvalId: value.id, decision: 'approved' },
      }));
      return { ok: true };
    },
    completeJob: async (_id, _lease, value) => { results.push(value); return { ok: true }; },
    failJob: async () => { throw new Error('must not fail'); },
  };
  const harness = {
    createSession: async () => 'session-office-one',
    ask: async (_sessionId, prompt, options) => {
      assert.match(prompt, /Return evidence/);
      await options.onUpdate({ type: 'tool', name: 'apply_patch' });
      await options.onInteraction({
        kind: 'approval',
        interactionId: 'approval-one',
        sessionId: 'session-office-one',
        payload: {
          type: 'approval/requested', sessionId: 'session-office-one',
          approvalId: 'approval-one', toolName: 'apply_patch', callId: 'call-one',
        },
        toolCall: { callId: 'call-one', name: 'apply_patch', arguments: '{"patch":"safe"}' },
        respond: async (value) => { responses.push(value); return { accepted: true }; },
      });
      return '# Completed\n\nVerified.';
    },
    rpc: async () => ({ ok: true }),
  };
  executor = new OfficeJobExecutor({
    config: {
      maxConcurrency: 1,
      workspaces: { 'office-project': '/Users/a004/project' },
      instructionPresets: { execute: 'Execute carefully.' },
    },
    transport,
    createHarness: () => harness,
  });
  assert.equal(executor.offer(jobId), true);
  await eventually(() => executor.status.completed === 1);
  assert.equal(approvals[0].kind, 'approval');
  assert.equal(responses[0].value.outcome, 'allowed-once');
  assert.ok(progress.some((item) => item.kind === 'tool'));
  assert.deepEqual(results, [{ resultMarkdown: '# Completed\n\nVerified.', sessionId: 'session-office-one' }]);
  await executor.close();
});
