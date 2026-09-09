import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MacOSMessagesApi,
  normalizeIMessage,
  normalizeIMessageTarget,
} from '../../../src/channels/imessage/imessage-api.mjs';

test('normalizes private native Messages rows and ignores self messages', () => {
  const message = normalizeIMessage({
    rowid: 3, guid: 'p:1', chatGuid: 'any;-;+8613800000000', serviceName: 'iMessage', text: 'hello',
    sender: '+8613800000000', receivedAt: '2026-09-07T00:00:00.000Z',
  }, { botId: 'macos-messages' });
  assert.equal(message.conversationId, 'any;-;+8613800000000');
  assert.equal(message.content, 'hello');
  assert.equal(message.replyTarget.address, '+8613800000000');
  assert.equal(message.replyTarget.serviceName, 'iMessage');
  assert.equal(normalizeIMessage({ guid: 'p:2', chatGuid: 'c', text: 'echo', sender: 'macos-messages' }, { botId: 'macos-messages' }), null);
});

test('reads Messages database rows after a durable cursor', async () => {
  const calls = [];
  const api = new MacOSMessagesApi({
    dbPath: '/tmp/chat.db',
    execFileImpl: async (file, args) => {
      calls.push({ file, args });
      return { stdout: '[{"rowid":4,"guid":"p:4","chatGuid":"c","serviceName":"iMessage","text":"hello","sender":"+1"}]' };
    },
    osascriptImpl: async () => ({ stdout: 'Messages' }),
  });
  assert.deepEqual(await api.listMessages({ after: 3, limit: 10 }), [
    { rowid: 4, guid: 'p:4', chatGuid: 'c', serviceName: 'iMessage', text: 'hello', sender: '+1' },
  ]);
  assert.equal(calls[0].args[0], '-json');
  assert.match(calls[0].args.at(-1), /ROWID > 3/);
  assert.match(calls[0].args.at(-1), /c\.service_name = 'iMessage'/);
  assert.match(calls[0].args.at(-1), /c\.account_login/);
});

test('reads the latest iMessage row id for safe first-start cursor initialization', async (t) => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  t.after(() => Object.defineProperty(process, 'platform', platformDescriptor));
  const api = new MacOSMessagesApi({
    dbPath: '/tmp/chat.db',
    execFileImpl: async (_file, args) => {
      assert.match(args.at(-1), /MAX\(m\.ROWID\)/);
      assert.match(args.at(-1), /c\.service_name = 'iMessage'/);
      return { stdout: '[{"rowid":744}]' };
    },
    osascriptImpl: async () => ({ stdout: 'Messages' }),
  });
  assert.equal(await api.getLatestMessageRowId(), 744);
});

test('sends text through the native Messages AppleScript bridge', async () => {
  const scripts = [];
  const api = new MacOSMessagesApi({
    execFileImpl: async () => ({ stdout: '' }),
    osascriptImpl: async (script) => { scripts.push(script); return { stdout: '' }; },
  });
  assert.deepEqual(await api.sendText({ chatGuid: 'any;-;+8613800000000', address: '+8613800000000', text: 'hi' }), { sent: true });
  assert.match(scripts[0], /buddy "\+8613800000000"/);
  assert.match(scripts[0], /send "hi"/);
});

test('rejects malformed chat targets', () => {
  assert.throws(() => normalizeIMessageTarget(''), /chatGuid is required/);
  assert.equal(normalizeIMessage({
    guid: 'p:3', chatGuid: 'any;-;10000', serviceName: 'SMS', text: 'spam', sender: '10000',
  }), null);
});
