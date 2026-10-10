import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  isTelegramVoiceReady,
  prepareTelegramVoiceFile,
} from '../../../src/channels/telegram/voice-format.mjs';

const execFileAsync = promisify(execFile);

function fakeSpawn({ stdout = [Buffer.from('ogg-bytes')], code = 0, error = null, silent = false } = {}) {
  const calls = [];
  const spawnImpl = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.end = (bytes) => {
      child.received = bytes;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {
      child.killed = true;
    };
    if (!silent) {
      queueMicrotask(() => {
        if (error) {
          child.emit('error', error);
          return;
        }
        if (code !== 0) {
          child.stderr.emit('data', Buffer.from('ffmpeg exploded'));
        }
        for (const chunk of stdout) child.stdout.emit('data', chunk);
        child.emit('close', code);
      });
    }
    return child;
  };
  return { spawnImpl, calls };
}

function wavFile() {
  const sampleRate = 8000;
  const samples = sampleRate / 2;
  const data = Buffer.alloc(samples * 2);
  for (let index = 0; index < samples; index += 1) {
    data.writeInt16LE(Math.round(Math.sin((index / sampleRate) * 2 * Math.PI * 440) * 12000), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

test('voice readiness follows the formats Telegram accepts for sendVoice', () => {
  const ready = [
    { fileName: 'a.ogg', mediaType: 'audio/ogg' },
    { fileName: 'a.opus', mediaType: 'audio/opus' },
    { fileName: 'a.mp3', mediaType: 'audio/mpeg' },
    { fileName: 'a.m4a', mediaType: 'audio/mp4' },
    { fileName: 'a.OGG', mediaType: 'application/octet-stream' },
    { fileName: 'noext', mediaType: 'audio/mpeg' },
  ];
  const notReady = [
    { fileName: 'a.wav', mediaType: 'audio/wav' },
    { fileName: 'a.flac', mediaType: 'audio/flac' },
    { fileName: 'a.txt', mediaType: 'text/plain' },
    {},
    null,
  ];
  for (const file of ready) assert.equal(isTelegramVoiceReady(file), true, JSON.stringify(file));
  for (const file of notReady) assert.equal(isTelegramVoiceReady(file), false, JSON.stringify(file));
});

test('voice-ready artifacts pass through untouched without invoking ffmpeg', async () => {
  const { spawnImpl, calls } = fakeSpawn();
  const file = Object.freeze({
    artifactId: 'artifact-1',
    fileName: 'luna.opus',
    mediaType: 'audio/opus',
    size: 4,
    as: 'voice',
    bytes: Buffer.from('opus'),
  });

  assert.equal(await prepareTelegramVoiceFile(file, { spawnImpl }), file);
  assert.equal(calls.length, 0);
});

test('other audio artifacts are transcoded to OGG/OPUS for a native voice bubble', async () => {
  const { spawnImpl, calls } = fakeSpawn({ stdout: [Buffer.from('ogg-'), Buffer.from('bytes')] });
  const file = {
    artifactId: 'artifact-2',
    deliveryKey: 'delivery-2',
    fileName: 'luna.wav',
    mediaType: 'audio/wav',
    size: 9,
    as: 'voice',
    bytes: Buffer.from('wav-bytes'),
  };

  const voice = await prepareTelegramVoiceFile(file, { spawnImpl, ffmpegPath: '/opt/ffmpeg' });

  assert.notEqual(voice, file);
  assert.equal(voice.fileName, 'luna.ogg');
  assert.equal(voice.mediaType, 'audio/ogg');
  assert.equal(voice.size, 9);
  assert.equal(voice.artifactId, 'artifact-2');
  assert.equal(voice.deliveryKey, 'delivery-2');
  assert.equal(voice.as, 'voice');
  assert.equal(voice.bytes.toString(), 'ogg-bytes');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, '/opt/ffmpeg');
  assert.deepEqual(calls[0].args, [
    '-hide_banner',
    '-loglevel', 'error',
    '-i', 'pipe:0',
    '-vn',
    '-c:a', 'libopus',
    '-b:a', '32k',
    '-f', 'ogg',
    'pipe:1',
  ]);
  assert.deepEqual(calls[0].options, { stdio: ['pipe', 'pipe', 'pipe'] });
});

test('extensionless audio artifacts get a canonical voice file name', async () => {
  const { spawnImpl } = fakeSpawn();
  const file = { fileName: 'voice', mediaType: 'audio/wav', bytes: Buffer.from('wav') };

  const voice = await prepareTelegramVoiceFile(file, { spawnImpl });

  assert.equal(voice.fileName, 'voice.ogg');
});

test('non-audio artifacts are rejected so the caller can fall back to a document', async () => {
  const { spawnImpl, calls } = fakeSpawn();
  const file = { fileName: 'notes.txt', mediaType: 'text/plain', bytes: Buffer.from('text') };

  await assert.rejects(
    () => prepareTelegramVoiceFile(file, { spawnImpl }),
    (error) => error?.code === 'artifact-voice-unsupported',
  );
  assert.equal(calls.length, 0);
});

test('a failing or missing ffmpeg surfaces a transcode failure', async () => {
  const failing = fakeSpawn({ code: 1 });
  await assert.rejects(
    () => prepareTelegramVoiceFile(
      { fileName: 'a.wav', mediaType: 'audio/wav', bytes: Buffer.from('wav') },
      { spawnImpl: failing.spawnImpl },
    ),
    (error) => error?.code === 'artifact-voice-transcode-failed'
      && error.message.includes('ffmpeg exited with code 1'),
  );

  const missing = fakeSpawn({ error: Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' }) });
  await assert.rejects(
    () => prepareTelegramVoiceFile(
      { fileName: 'a.wav', mediaType: 'audio/wav', bytes: Buffer.from('wav') },
      { spawnImpl: missing.spawnImpl },
    ),
    (error) => error?.code === 'artifact-voice-transcode-failed'
      && error.message.includes('unavailable'),
  );
});

test('ffmpeg that never finishes is killed on timeout', async () => {
  const { spawnImpl, calls } = fakeSpawn({ silent: true });
  const started = Date.now();

  await assert.rejects(
    () => prepareTelegramVoiceFile(
      { fileName: 'a.wav', mediaType: 'audio/wav', bytes: Buffer.from('wav') },
      { spawnImpl, timeoutMs: 20 },
    ),
    (error) => error?.code === 'artifact-voice-transcode-failed'
      && error.message.includes('timed out'),
  );
  assert.ok(Date.now() - started < 2_000);
});

test('an oversized transcode is rejected before it exhausts memory', async () => {
  const { spawnImpl } = fakeSpawn({ silent: true });
  const spawnWithChunk = (command, args, options) => {
    const child = spawnImpl(command, args, options);
    queueMicrotask(() => {
      child.stdout.emit('data', Buffer.alloc(64, 1));
      child.stdout.emit('data', Buffer.alloc(64, 2));
    });
    return child;
  };

  await assert.rejects(
    () => prepareTelegramVoiceFile(
      { fileName: 'a.wav', mediaType: 'audio/wav', bytes: Buffer.from('wav') },
      { spawnImpl: spawnWithChunk, maxBytes: 100 },
    ),
    (error) => error?.code === 'artifact-voice-transcode-failed'
      && error.message.includes('exceeds'),
  );
});

test('aborting the delivery kills ffmpeg and rejects with the abort reason', async () => {
  const { spawnImpl } = fakeSpawn({ silent: true });
  const controller = new AbortController();
  const pending = prepareTelegramVoiceFile(
    { fileName: 'a.wav', mediaType: 'audio/wav', bytes: Buffer.from('wav') },
    { spawnImpl, signal: controller.signal },
  );
  controller.abort();

  await assert.rejects(() => pending, (error) => error?.name === 'AbortError');
});

test('a real ffmpeg turns WAV bytes into a playable OGG/OPUS voice file', async (t) => {
  try {
    await execFileAsync('ffmpeg', ['-version']);
  } catch {
    t.skip('ffmpeg is not installed');
    return;
  }
  const wav = wavFile();

  const voice = await prepareTelegramVoiceFile({
    fileName: 'probe.wav',
    mediaType: 'audio/wav',
    bytes: wav,
  });

  assert.equal(voice.fileName, 'probe.ogg');
  assert.equal(voice.mediaType, 'audio/ogg');
  assert.ok(voice.bytes.length > 0);
  assert.equal(voice.bytes.subarray(0, 4).toString(), 'OggS');
  assert.ok(voice.bytes.length < wav.length);
});
