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
import {
  OFFICE_PROTOCOL_VERSION,
  OFFICE_RPC_ENDPOINTS,
  officeHookUrls,
} from '../../../src/channels/office/protocol.mjs';
import { createOfficeRpcHandler } from '../../../plugin-src/host/channels/office/rpc.mjs';
import { OfficeSettingsTab } from '../../../plugin-src/client/channels/office/index.js';

const TOKEN = 'office-device-token-ABCDEFGHIJKLMNOPQRSTUVWXYZ-123456';

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
