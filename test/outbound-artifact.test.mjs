import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  OUTBOUND_ARTIFACT_TOOL,
  OutboundArtifactRegistry,
  createOutboundArtifactTool,
  installOutboundArtifactTool,
  materializeOutboundArtifact,
  readExactArtifactFile,
  releaseOutboundArtifact,
} from '../src/channels/shared/semantic/artifact.mjs';
import { symlinkOrSkip } from './support/filesystem.mjs';

async function fixture(t, { consumer = true } = {}) {
  const workspace = await mkdtemp(join(tmpdir(), 'dsh-im-artifact-workspace-'));
  const outside = await mkdtemp(join(tmpdir(), 'dsh-im-artifact-outside-'));
  t.after(async () => {
    await rm(workspace, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  let nextId = 0;
  const registry = new OutboundArtifactRegistry({
    uuid: () => `artifact-id-${++nextId}`,
  });
  t.after(() => registry.clear());
  const agent = {
    session: {
      header: { id: 'session-artifact', cwd: workspace },
      events: [
        { type: 'turn/start', data: { turn: 7 } },
        { type: 'user/message', data: { turn: 7, source: { rpcId: 'rpc-artifact' } } },
      ],
    },
  };
  let closeConsumer;
  if (consumer) {
    closeConsumer = registry.openConsumer('session-artifact', 'rpc-artifact');
    for (const event of agent.session.events) registry.observeSessionEvent(agent.session, event);
    t.after(closeConsumer);
  }
  return { workspace, outside, registry, agent, closeConsumer };
}

function execution(agent, callId, overrides = {}) {
  return {
    name: OUTBOUND_ARTIFACT_TOOL,
    agent,
    callId,
    rootCallId: callId,
    token: Symbol(callId),
    ...overrides,
  };
}

async function execute(tool, args, exec, result = { isError: false }) {
  const value = await tool.definition.execute(args, exec);
  tool.onResult(exec, result);
  return value;
}

async function takeFile(registry, sessionId = 'session-artifact', turn = 7) {
  const [artifact] = registry.take(sessionId, turn);
  assert.ok(artifact);
  const file = await materializeOutboundArtifact(artifact);
  return { artifact, file };
}

test('file return reads modern Session event snapshots', async (t) => {
  const fx = await fixture(t, { consumer: false });
  const events = fx.agent.session.events;
  fx.agent.session = {
    header: fx.agent.session.header,
    snapshotEvents: () => Object.freeze(events),
  };
  t.after(fx.registry.openConsumer('session-artifact', 'rpc-artifact'));
  fx.registry.observeSessionEvent(fx.agent.session, {
    type: 'user/message', data: { source: { rpcId: 'rpc-artifact' } },
  });
  await writeFile(join(fx.workspace, 'modern.txt'), 'modern session');
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  const result = await execute(tool, { path: 'modern.txt' }, execution(fx.agent, 'modern'));

  assert.equal(result.artifactId, 'artifact-id-1');
  assert.equal(result.fileName, 'modern.txt');
  const { artifact, file } = await takeFile(fx.registry);
  assert.equal(file.bytes.toString(), 'modern session');
  releaseOutboundArtifact(artifact);
});

test('file return prefers snapshotEvents over a stale session.events array', async (t) => {
  const fx = await fixture(t, { consumer: false });
  fx.agent.session.events = [];
  fx.agent.session.snapshotEvents = () => Object.freeze([
    { type: 'turn/start', data: { turn: 7 } },
  ]);
  t.after(fx.registry.openConsumer('session-artifact', 'rpc-artifact'));
  fx.registry.observeSessionEvent(fx.agent.session, {
    type: 'user/message', data: { source: { rpcId: 'rpc-artifact' } },
  });
  await writeFile(join(fx.workspace, 'prefer.txt'), 'prefer snapshot');
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  const result = await execute(tool, { path: 'prefer.txt' }, execution(fx.agent, 'prefer'));

  assert.equal(result.fileName, 'prefer.txt');
  const { artifact, file } = await takeFile(fx.registry);
  assert.equal(file.bytes.toString(), 'prefer snapshot');
  releaseOutboundArtifact(artifact);
});

test('file return still requires a live Session turn on modern snapshots', async (t) => {
  const fx = await fixture(t, { consumer: false });
  fx.agent.session = {
    header: fx.agent.session.header,
    snapshotEvents: () => Object.freeze([
      { type: 'turn/start', data: { turn: 7 } },
      { type: 'turn/end', data: { turn: 7 } },
    ]),
  };
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  await assert.rejects(
    tool.definition.execute({ path: 'ended.txt' }, execution(fx.agent, 'ended')),
    (error) => error.code === 'artifact-context-required'
      && error.message === 'A live Harness Session is required to return a file.',
  );
});

test('an existing file can be sent directly without recreation', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'existing.txt'), 'already here');
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  const result = await execute(tool, { path: 'existing.txt' }, execution(fx.agent, 'existing'));

  assert.deepEqual(result, {
    artifactId: 'artifact-id-1',
    fileName: 'existing.txt',
    size: 12,
  });
  const { artifact, file } = await takeFile(fx.registry);
  assert.equal(file.bytes.toString(), 'already here');
  releaseOutboundArtifact(artifact);
});

test('absolute outside-workspace paths and symbolic links are delivered normally', async (t) => {
  const fx = await fixture(t);
  const outsidePath = join(fx.outside, 'outside.txt');
  await writeFile(outsidePath, 'outside content');
  if (!await symlinkOrSkip(t, outsidePath, join(fx.workspace, 'linked.txt'))) return;
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  await execute(tool, { path: outsidePath }, execution(fx.agent, 'outside'));
  await execute(tool, { path: 'linked.txt' }, execution(fx.agent, 'linked'));

  const artifacts = fx.registry.take('session-artifact', 7);
  assert.equal(artifacts.length, 2);
  const files = await Promise.all(artifacts.map((artifact) => materializeOutboundArtifact(artifact)));
  assert.deepEqual(files.map((file) => file.fileName), ['outside.txt', 'linked.txt']);
  assert.deepEqual(files.map((file) => file.bytes.toString()), ['outside content', 'outside content']);
  for (const artifact of artifacts) releaseOutboundArtifact(artifact);
});

test('empty, sensitive-looking, and extension-mismatched files are not filtered', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'empty.txt'), '');
  await writeFile(
    join(fx.workspace, '.env'),
    'PASSWORD=example\n-----BEGIN PRIVATE KEY-----\nexample\n',
  );
  await writeFile(join(fx.workspace, 'plain.png'), 'not a PNG signature');
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  await execute(tool, { path: 'empty.txt' }, execution(fx.agent, 'empty'));
  await execute(tool, { path: '.env' }, execution(fx.agent, 'sensitive-looking'));
  await execute(tool, { path: 'plain.png' }, execution(fx.agent, 'extension-mismatch'));

  const artifacts = fx.registry.take('session-artifact', 7);
  assert.equal(artifacts.length, 3);
  const files = await Promise.all(artifacts.map((artifact) => materializeOutboundArtifact(artifact)));
  assert.deepEqual(files.map((file) => file.size), [0, 53, 19]);
  assert.equal(files[1].bytes.toString().startsWith('PASSWORD='), true);
  assert.equal(files[2].bytes.toString(), 'not a PNG signature');
  for (const artifact of artifacts) releaseOutboundArtifact(artifact);
});

test('the registry does not deduplicate or impose project-level file-count quotas', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'same.txt'), 'same');
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  for (let index = 0; index < 12; index += 1) {
    await execute(tool, { path: 'same.txt' }, execution(fx.agent, `same-${index}`));
  }

  const artifacts = fx.registry.take('session-artifact', 7);
  assert.equal(artifacts.length, 12);
  assert.equal(new Set(artifacts.map((artifact) => artifact.artifactId)).size, 12);
  for (const artifact of artifacts) releaseOutboundArtifact(artifact);
});

test('registration keeps a private snapshot without changing or deleting the source file', async (t) => {
  const fx = await fixture(t);
  const path = join(fx.workspace, 'mutable.txt');
  await writeFile(path, 'first value');
  const tool = createOutboundArtifactTool({ registry: fx.registry });
  await execute(tool, { path }, execution(fx.agent, 'snapshot'));
  await writeFile(path, 'second value');

  const { artifact, file } = await takeFile(fx.registry);
  assert.equal(file.bytes.toString(), 'first value');
  releaseOutboundArtifact(artifact);
  assert.equal(await readFile(path, 'utf8'), 'second value');
});

test('missing paths and directories fail because they cannot be uploaded as files', async (t) => {
  const fx = await fixture(t);
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  await assert.rejects(
    tool.definition.execute({ path: 'missing.txt' }, execution(fx.agent, 'missing')),
    (error) => error.code === 'artifact-unavailable',
  );
  await assert.rejects(
    tool.definition.execute({ path: '.' }, execution(fx.agent, 'directory')),
    (error) => error.code === 'artifact-not-file',
  );
});

test('a failed authoritative tool result is not delivered', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'failed.txt'), 'failed');
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  await execute(
    tool,
    { path: 'failed.txt' },
    execution(fx.agent, 'failed'),
    { isError: true },
  );

  assert.deepEqual(fx.registry.take('session-artifact', 7), []);
});

test('Code Mode waits for the outer execution result before delivery', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'nested.txt'), 'nested');
  const tool = createOutboundArtifactTool({ registry: fx.registry });
  const rootToken = Symbol('root');
  const nested = execution(fx.agent, 'nested', {
    parent: rootToken,
    rootCallId: 'root-call',
  });

  await execute(tool, { path: 'nested.txt' }, nested);
  assert.deepEqual(fx.registry.take('session-artifact', 7), []);
  tool.onResult({
    name: 'run_code',
    callId: 'root-call',
    rootCallId: 'root-call',
    token: rootToken,
    agent: fx.agent,
  }, { isError: false });

  const { artifact, file } = await takeFile(fx.registry);
  assert.equal(file.bytes.toString(), 'nested');
  releaseOutboundArtifact(artifact);
});

test('Session and Turn ownership routes files only to the originating conversation', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'owned.txt'), 'owned');
  const tool = createOutboundArtifactTool({ registry: fx.registry });
  await execute(tool, { path: 'owned.txt' }, execution(fx.agent, 'owned'));

  assert.deepEqual(fx.registry.take('other-session', 7), []);
  assert.deepEqual(fx.registry.take('session-artifact', 8), []);
  const [artifact] = fx.registry.take('session-artifact', 7);
  assert.ok(artifact);
  releaseOutboundArtifact(artifact);
});

test('a released consumer leaves no snapshot for a completed Turn', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'unclaimed.txt'), 'unclaimed');
  const artifact = await fx.registry.stage(
    { path: 'unclaimed.txt' },
    execution(fx.agent, 'unclaimed'),
  );
  fx.registry.commit(artifact);
  fx.closeConsumer();

  fx.registry.observeSessionEvent(
    { id: 'session-artifact' },
    { type: 'turn/end', data: { turn: 7 } },
  );

  assert.deepEqual(fx.registry.take('session-artifact', 7), []);
  await assert.rejects(
    materializeOutboundArtifact(artifact),
    (error) => error.code === 'artifact-invalid',
  );
});

test('a channel consumer keeps its completed Turn available until polling claims it', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'consumer.txt'), 'consumer');
  const closeConsumer = fx.registry.openConsumer('session-artifact', 'rpc-artifact');
  fx.registry.observeSessionEvent(
    { id: 'session-artifact' },
    { type: 'turn/start', data: { turn: 7 } },
  );
  fx.registry.observeSessionEvent(
    { id: 'session-artifact' },
    { type: 'user/message', data: { source: { rpcId: 'rpc-artifact' } } },
  );
  const tool = createOutboundArtifactTool({ registry: fx.registry });
  await execute(tool, { path: 'consumer.txt' }, execution(fx.agent, 'consumer'));

  fx.registry.observeSessionEvent(
    { id: 'session-artifact' },
    { type: 'turn/end', data: { turn: 7 } },
  );
  const [artifact] = fx.registry.take('session-artifact', 7);
  assert.ok(artifact);
  closeConsumer();

  const file = await materializeOutboundArtifact(artifact);
  assert.equal(file.bytes.toString(), 'consumer');
  releaseOutboundArtifact(artifact);
});

test('closing an unclaimed channel consumer releases its completed Turn', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'consumer-closed.txt'), 'consumer closed');
  const closeConsumer = fx.registry.openConsumer('session-artifact', 'rpc-artifact');
  fx.registry.observeSessionEvent(
    { id: 'session-artifact' },
    { type: 'turn/start', data: { turn: 7 } },
  );
  fx.registry.observeSessionEvent(
    { id: 'session-artifact' },
    { type: 'user/message', data: { source: { rpcId: 'rpc-artifact' } } },
  );
  const artifact = await fx.registry.stage(
    { path: 'consumer-closed.txt' },
    execution(fx.agent, 'consumer-closed'),
  );
  fx.registry.commit(artifact);
  fx.registry.observeSessionEvent(
    { id: 'session-artifact' },
    { type: 'turn/end', data: { turn: 7 } },
  );

  closeConsumer();

  assert.deepEqual(fx.registry.take('session-artifact', 7), []);
  await assert.rejects(
    materializeOutboundArtifact(artifact),
    (error) => error.code === 'artifact-invalid',
  );
});

test('aborting the owning delivery releases its unhanded snapshot', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'abort.txt'), 'abort');
  const tool = createOutboundArtifactTool({ registry: fx.registry });
  await execute(tool, { path: 'abort.txt' }, execution(fx.agent, 'abort'));
  const controller = new AbortController();
  const [artifact] = fx.registry.take('session-artifact', 7, { signal: controller.signal });
  controller.abort();

  await assert.rejects(
    materializeOutboundArtifact(artifact),
    (error) => error.code === 'artifact-invalid',
  );
});

test('an explicit release also cleans a snapshot that was already claimed', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'handoff-failed.txt'), 'handoff failed');
  const tool = createOutboundArtifactTool({ registry: fx.registry });
  await execute(tool, { path: 'handoff-failed.txt' }, execution(fx.agent, 'handoff-failed'));
  const [artifact] = fx.registry.take('session-artifact', 7);

  fx.registry.release(artifact);

  await assert.rejects(
    materializeOutboundArtifact(artifact),
    (error) => error.code === 'artifact-invalid',
  );
});

test('cleanup requested during materialization runs as soon as the read completes', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'concurrent-cleanup.txt'), Buffer.alloc(1024 * 1024, 7));
  const tool = createOutboundArtifactTool({ registry: fx.registry });
  await execute(
    tool,
    { path: 'concurrent-cleanup.txt' },
    execution(fx.agent, 'concurrent-cleanup'),
  );
  const [artifact] = fx.registry.take('session-artifact', 7);

  const materializing = materializeOutboundArtifact(artifact);
  fx.registry.clear();
  const file = await materializing;

  assert.equal(file.size, 1024 * 1024);
  await assert.rejects(
    materializeOutboundArtifact(artifact),
    (error) => error.code === 'artifact-invalid',
  );
});

test('exact reads have no independent timeout and preserve caller cancellation', async () => {
  let read = 0;
  const handle = {
    async read(_buffer, _offset, _length, position) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (position === 0 && read++ === 0) return { bytesRead: 1 };
      return { bytesRead: 0 };
    },
  };
  const bytes = await readExactArtifactFile(handle, 1);
  assert.equal(bytes.byteLength, 1);

  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  await assert.rejects(
    readExactArtifactFile(handle, 1, { signal: controller.signal }),
    /cancelled/,
  );
});

test('Host installer exposes the tool but only guides the current owned IM Turn', () => {
  let definition;
  const listeners = new Map();
  let context;
  const registry = new OutboundArtifactRegistry();
  const installed = installOutboundArtifactTool({
    tools: { register(value) { definition = value; } },
    on(name, value) { listeners.set(name, value); },
    systemPrompt: {
      context(value) { context = value; },
      section() { assert.fail('file-return guidance must not be global'); },
    },
  }, { registry });

  assert.equal(installed, true);
  assert.equal(definition.name, OUTBOUND_ARTIFACT_TOOL);
  assert.match(definition.description, /active IM delivery consumer/);
  assert.match(definition.description, /host present tool/);
  assert.match(definition.description, /Existing and newly created files are both valid/);
  assert.match(definition.description, /Success means queued, not sent/);
  assert.match(definition.output.render({}, { fileName: 'result.zip', size: 123 })[0].text, /has not been sent yet/);
  assert.equal(context.name, 'dsh-im:return-file');
  const session = { id: 'im-session' };
  const assembly = { agent: { session } };
  const observe = (type, data) => listeners.get('session/event')(session, { type, data });
  assert.equal(context.text(assembly), '');
  assert.equal(context.text(undefined), '');
  const close = registry.openConsumer(session.id, 'plain-rpc-id');
  observe('turn/start', { turn: 1 });
  assert.equal(context.text(assembly), '', 'a queued consumer does not own the current Turn');
  observe('user/message', { source: { rpcId: 'weixin-unregistered' } });
  assert.equal(context.text(assembly), '', 'a channel-looking prefix grants no ownership');
  observe('user/message', { source: { rpcId: 'plain-rpc-id' } });
  assert.match(context.text(assembly), /Existing files can be sent directly/);
  assert.match(context.text(assembly), /after your turn finishes/);
  assert.equal(context.text({ agent: { session: { id: 'web-session' } } }), '');
  observe('turn/end', { turn: 1 });
  observe('turn/start', { turn: 2 });
  observe('user/message', { source: { rpcId: 'web-rpc' } });
  assert.equal(context.text(assembly), '', 'the previous IM consumer cannot guide a Web Turn');
  close();
  const closeNext = registry.openConsumer(session.id, 'next-im-rpc');
  observe('user/message', { source: { rpcId: 'next-im-rpc' } });
  assert.match(context.text(assembly), /call dsh_im_return_file/);
  closeNext();
  assert.equal(context.text(assembly), '', 'released consumers contribute no guidance');
  assert.equal(typeof listeners.get('tools/result'), 'function');
  assert.equal(typeof listeners.get('session/disposed'), 'function');
  assert.equal(installOutboundArtifactTool({}), false);
});

test('file return stages with the turn observed from the live session event stream', async (t) => {
  const fx = await fixture(t);
  fx.agent.session = { header: fx.agent.session.header };
  await writeFile(join(fx.workspace, 'stream.txt'), 'stream turn');
  fx.registry.observeSessionEvent(fx.agent.session, { type: 'turn/start', data: { turn: 7 } });
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  const result = await execute(tool, { path: 'stream.txt' }, execution(fx.agent, 'stream'));

  assert.equal(result.fileName, 'stream.txt');
  const { artifact, file } = await takeFile(fx.registry);
  assert.equal(file.bytes.toString(), 'stream turn');
  releaseOutboundArtifact(artifact);
});

test('file return rejects once the observed turn has closed without any session event snapshot', async (t) => {
  const fx = await fixture(t);
  fx.agent.session = { header: fx.agent.session.header };
  fx.registry.observeSessionEvent(fx.agent.session, { type: 'turn/start', data: { turn: 7 } });
  fx.registry.observeSessionEvent(fx.agent.session, { type: 'turn/end', data: { turn: 7 } });
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  await assert.rejects(
    tool.definition.execute({ path: 'closed.txt' }, execution(fx.agent, 'closed')),
    (error) => error.code === 'artifact-context-required'
      && error.message === 'A live Harness Session is required to return a file.',
  );
});

test('file return rejects a bare session without snapshot or observed turn activity', async (t) => {
  const fx = await fixture(t, { consumer: false });
  fx.agent.session = { header: fx.agent.session.header };
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  await assert.rejects(
    tool.definition.execute({ path: 'bare.txt' }, execution(fx.agent, 'bare')),
    (error) => error.code === 'artifact-context-required'
      && error.message === 'A live Harness Session is required to return a file.',
  );
});

test('file return accepts valid as and prefer presentation modes and materializes them', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'test.ogg'), 'audio-data');
  const tool = createOutboundArtifactTool({ registry: fx.registry });

  // 1. Default without as -> 'auto'
  await execute(tool, { path: 'test.ogg' }, execution(fx.agent, 'call-default'));
  const [defaultArtifact] = fx.registry.take('session-artifact', 7);
  assert.equal(defaultArtifact.as, 'auto');
  const defaultFile = await materializeOutboundArtifact(defaultArtifact);
  assert.equal(defaultFile.as, 'auto');
  assert.equal(defaultFile.mediaType, 'audio/ogg');
  releaseOutboundArtifact(defaultArtifact);

  // 2. Explicit as: 'voice'
  await execute(tool, { path: 'test.ogg', as: 'voice' }, execution(fx.agent, 'call-voice'));
  const [voiceArtifact] = fx.registry.take('session-artifact', 7);
  assert.equal(voiceArtifact.as, 'voice');
  const voiceFile = await materializeOutboundArtifact(voiceArtifact);
  assert.equal(voiceFile.as, 'voice');
  releaseOutboundArtifact(voiceArtifact);

  // 3. Explicit as: 'file'
  await execute(tool, { path: 'test.ogg', as: 'file' }, execution(fx.agent, 'call-file'));
  const [fileArtifact] = fx.registry.take('session-artifact', 7);
  assert.equal(fileArtifact.as, 'file');
  const fileObj = await materializeOutboundArtifact(fileArtifact);
  assert.equal(fileObj.as, 'file');
  releaseOutboundArtifact(fileArtifact);

  // 4. Compatible prefer: 'animation'
  await execute(tool, { path: 'test.ogg', prefer: 'animation' }, execution(fx.agent, 'call-prefer'));
  const [animArtifact] = fx.registry.take('session-artifact', 7);
  assert.equal(animArtifact.as, 'animation');
  const animFile = await materializeOutboundArtifact(animArtifact);
  assert.equal(animFile.as, 'animation');
  releaseOutboundArtifact(animArtifact);

  // 5. Invalid mode throws TypeError
  await assert.rejects(
    tool.definition.execute({ path: 'test.ogg', as: 'unsupported' }, execution(fx.agent, 'call-invalid')),
    (error) => error instanceof TypeError && error.message.includes("Presentation mode 'as' must be one of"),
  );
});

for (const rpcId of ['bare-web-uuid', 'weixin-unregistered']) {
  test(`file return rejects an unowned Turn even with rpcId ${rpcId}`, async (t) => {
    const fx = await fixture(t, { consumer: false });
    fx.agent.session.events[1].data.source.rpcId = rpcId;
    for (const event of fx.agent.session.events) fx.registry.observeSessionEvent(fx.agent.session, event);
    await writeFile(join(fx.workspace, 'web.txt'), 'web file');
    const tool = createOutboundArtifactTool({ registry: fx.registry });
    await assert.rejects(
      tool.definition.execute({ path: 'web.txt' }, execution(fx.agent, 'web')),
      (error) => error.code === 'artifact-consumer-required'
        && /not queued/.test(error.message) && /host present tool/.test(error.message),
    );
    assert.deepEqual(fx.registry.take('session-artifact', 7), []);
  });
}

test('file return rejects a released consumer before reading the requested path', async (t) => {
  const fx = await fixture(t);
  fx.closeConsumer();
  await assert.rejects(
    fx.registry.stage({ path: 'missing.txt' }, execution(fx.agent, 'released')),
    { code: 'artifact-consumer-required' },
  );
});

test('file return cannot use an unrelated pending consumer', async (t) => {
  const fx = await fixture(t, { consumer: false });
  fx.registry.openConsumer('other-session', 'rpc-artifact');
  fx.registry.openConsumer('session-artifact', 'different-rpc');
  for (const event of fx.agent.session.events) fx.registry.observeSessionEvent(fx.agent.session, event);
  await assert.rejects(
    fx.registry.stage({ path: 'missing.txt' }, execution(fx.agent, 'unrelated')),
    { code: 'artifact-consumer-required' },
  );
});

test('an observed Turn end overrides a stale open Session snapshot', async (t) => {
  const fx = await fixture(t);
  fx.registry.observeSessionEvent(fx.agent.session, { type: 'turn/end', data: { turn: 7 } });
  assert.equal(fx.registry.hasActiveConsumer(fx.agent.session), false);
  await assert.rejects(
    fx.registry.stage({ path: 'missing.txt' }, execution(fx.agent, 'stale')),
    { code: 'artifact-context-required' },
  );
});

test('ending a turn logs and releases files whose consumer was replaced', async (t) => {
  const fx = await fixture(t);
  await writeFile(join(fx.workspace, 'orphan.txt'), 'keep the original');
  const artifact = await fx.registry.stage(
    { path: 'orphan.txt' }, execution(fx.agent, 'orphan'),
  );
  fx.registry.commit(artifact);
  t.after(fx.registry.openConsumer('session-artifact', 'rpc-artifact'));
  const warnings = [];
  const logger = { warn: (...args) => warnings.push(args) };

  fx.registry.observeSessionEvent(fx.agent.session,
    { type: 'turn/end', data: { turn: 7 } }, { logger });

  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /without an active IM delivery consumer/);
  assert.deepEqual(warnings[0][1], { sessionId: 'session-artifact', turn: 7, artifactCount: 1 });
  assert.deepEqual(fx.registry.take('session-artifact', 7), []);
  await assert.rejects(materializeOutboundArtifact(artifact), { code: 'artifact-invalid' });
  assert.equal(await readFile(join(fx.workspace, 'orphan.txt'), 'utf8'), 'keep the original');
});

test('an ordinary Web turn without files does not emit a warning', async (t) => {
  const fx = await fixture(t, { consumer: false });
  const warnings = [];
  fx.registry.observeSessionEvent(fx.agent.session,
    { type: 'turn/end', data: { turn: 7 } },
    { logger: { warn: (...args) => warnings.push(args) } });
  assert.deepEqual(warnings, []);
});
