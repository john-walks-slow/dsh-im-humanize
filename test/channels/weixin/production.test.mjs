import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createProductionController } from '../../../plugin-src/host/channels/weixin/production.mjs';

test('Weixin production has no per-bot result-file Gate', async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'dsh-weixin-production-artifacts-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const runtimes = [];
  let controllerOptions;

  class ConfigStore {
    async load() { return this; }
    list() { return []; }
  }
  class StateStore {
    async load() { return this; }
  }
  class Harness {
    stopManagedProcess() {}
  }
  class Runtime {
    constructor(options) { runtimes.push(options); }
  }
  class Controller {
    constructor(options) { controllerOptions = options; }
    async close() {}
  }
  const createConnectionSupervisor = () => ({
    ready: Promise.resolve(),
    start() { return this; },
    async close() {},
  });
  const internals = {
    ConfigStore,
    StateStore,
    HarnessClient: Harness,
    Controller,
    Runtime,
    api: {},
    createConnectionSupervisor,
  };
  const ctx = {
    credentials: {},
    apiProxy: {},
    logger: () => ({ error() {}, warn() {}, info() {}, debug() {} }),
  };

  const production = await createProductionController(ctx, { dataDir }, internals);
  await controllerOptions.createRuntime({
    botId: 'wx_enabled',
    config: { botId: 'wx_enabled' },
    token: 'host-only',
  });
  await controllerOptions.createRuntime({
    botId: 'wx_disabled',
    config: { botId: 'wx_disabled' },
    token: 'host-only',
  });

  assert.equal(Object.hasOwn(runtimes[0], 'outboundArtifactsEnabled'), false);
  assert.equal(Object.hasOwn(runtimes[1], 'outboundArtifactsEnabled'), false);
  assert.equal(runtimes[0].maxMessageChars, 1_800);
  assert.equal(runtimes[1].maxMessageChars, 1_800);
  await production.close();

  const productionWithDefault = await createProductionController(ctx, { dataDir }, internals);
  await controllerOptions.createRuntime({
    botId: 'wx_default',
    config: { botId: 'wx_default' },
    token: 'host-only',
  });
  assert.equal(Object.hasOwn(runtimes[2], 'outboundArtifactsEnabled'), false);
  assert.equal(runtimes[2].maxMessageChars, 1_800);
  await productionWithDefault.close();
});
