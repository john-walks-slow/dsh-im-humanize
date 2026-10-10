import { spawn } from 'node:child_process';
import { extname } from 'node:path';

/**
 * Telegram's `sendVoice` accepts OGG/OPUS, MP3 and M4A natively. Everything else
 * that is still audio gets transcoded to OGG/OPUS so it renders as a voice
 * bubble instead of falling back to a document.
 */
const VOICE_READY_MEDIA_TYPES = new Set([
  'audio/ogg',
  'audio/opus',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
]);
const VOICE_READY_EXTENSIONS = new Set(['.ogg', '.opus', '.mp3', '.m4a']);
const AUDIO_EXTENSIONS = new Set([
  ...VOICE_READY_EXTENSIONS,
  '.aac',
  '.flac',
  '.oga',
  '.wav',
  '.weba',
  '.wma',
]);

const VOICE_OUTPUT_MEDIA_TYPE = 'audio/ogg';
const VOICE_OUTPUT_EXTENSION = '.ogg';
const VOICE_MAX_BYTES = 50 * 1024 * 1024;
const TRANSCODE_TIMEOUT_MS = 60_000;
const TRANSCODE_STDERR_LIMIT = 2_000;

const TRANSCODE_ARGS = Object.freeze([
  '-hide_banner',
  '-loglevel', 'error',
  '-i', 'pipe:0',
  '-vn',
  '-c:a', 'libopus',
  '-b:a', '32k',
  '-f', 'ogg',
  'pipe:1',
]);

function voiceError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function unsupportedError(file) {
  return voiceError(
    'artifact-voice-unsupported',
    `Telegram cannot send "${file?.fileName ?? 'the file'}" as a voice message.`,
  );
}

function transcodeError(message, cause) {
  return voiceError('artifact-voice-transcode-failed', message, cause);
}

function abortReason(signal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted', 'AbortError');
}

function extensionOf(name) {
  return typeof name === 'string' ? extname(name).toLowerCase() : '';
}

function mediaTypeOf(file) {
  return typeof file?.mediaType === 'string' ? file.mediaType.toLowerCase() : '';
}

export function isTelegramVoiceReady(file) {
  return VOICE_READY_MEDIA_TYPES.has(mediaTypeOf(file))
    || VOICE_READY_EXTENSIONS.has(extensionOf(file?.fileName));
}

function isAudioArtifact(file) {
  return mediaTypeOf(file).startsWith('audio/')
    || AUDIO_EXTENSIONS.has(extensionOf(file?.fileName));
}

function voiceFileName(name) {
  const base = typeof name === 'string' ? name.slice(0, -extname(name).length) : '';
  return `${base || 'voice'}${VOICE_OUTPUT_EXTENSION}`;
}

function transcodeToOggOpus(bytes, {
  signal,
  ffmpegPath,
  spawnImpl,
  timeoutMs,
  maxBytes,
} = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const child = spawnImpl(ffmpegPath, TRANSCODE_ARGS, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    let total = 0;
    let stderr = '';
    let settled = false;
    let timer = null;

    const finish = (settle, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      settle(value);
    };
    const fail = (error) => {
      try {
        child.kill('SIGKILL');
      } catch {
        // The process already exited; the captured error is the real story.
      }
      finish(reject, error);
    };
    const onAbort = () => fail(abortReason(signal));

    timer = setTimeout(
      () => fail(transcodeError(`ffmpeg timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    signal?.addEventListener('abort', onAbort, { once: true });

    child.on('error', (error) => {
      finish(reject, transcodeError(`ffmpeg is unavailable (${error?.message ?? error})`, error));
    });
    child.stdout.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        fail(transcodeError(`the transcoded voice message exceeds ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-TRANSCODE_STDERR_LIMIT);
    });
    child.on('close', (code) => {
      if (code === 0 && total > 0) {
        finish(resolve, Buffer.concat(chunks, total));
        return;
      }
      const detail = stderr.trim() ? `: ${stderr.trim()}` : '';
      finish(reject, transcodeError(`ffmpeg exited with code ${code}${detail}`));
    });
    child.stdin.on('error', () => {
      // A killed ffmpeg closes stdin; the close/abort handler reports the cause.
    });
    child.stdin.end(bytes);
  });
}

/**
 * Return a file Telegram can send as a voice message: voice-ready formats pass
 * through untouched, other audio is transcoded to OGG/OPUS, and non-audio fails
 * so the caller falls back to a regular document.
 */
export async function prepareTelegramVoiceFile(file, {
  signal,
  ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg',
  spawnImpl = spawn,
  timeoutMs = TRANSCODE_TIMEOUT_MS,
  maxBytes = VOICE_MAX_BYTES,
} = {}) {
  if (!file || typeof file !== 'object' || !Buffer.isBuffer(file.bytes)) {
    throw unsupportedError(file);
  }
  signal?.throwIfAborted();
  if (isTelegramVoiceReady(file)) return file;
  if (!isAudioArtifact(file)) throw unsupportedError(file);

  const bytes = await transcodeToOggOpus(file.bytes, {
    signal,
    ffmpegPath,
    spawnImpl,
    timeoutMs,
    maxBytes,
  });
  return Object.freeze({
    ...file,
    fileName: voiceFileName(file.fileName),
    mediaType: VOICE_OUTPUT_MEDIA_TYPE,
    size: bytes.byteLength,
    bytes,
  });
}
