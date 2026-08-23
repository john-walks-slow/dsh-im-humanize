import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chunkMarkdownText,
  sendMarkdownReply,
} from '../../../src/channels/qq/markdown-reply.mjs';

const target = { scope: 'c2c', targetId: 'user-openid', msgId: 'msg-1' };

test('chunkMarkdownText keeps short text as a single chunk', () => {
  assert.deepEqual(chunkMarkdownText('**你好**，世界'), ['**你好**，世界']);
});

test('chunkMarkdownText returns no chunks for empty text', () => {
  assert.deepEqual(chunkMarkdownText(''), []);
  assert.deepEqual(chunkMarkdownText(null), []);
});

test('chunkMarkdownText splits long text within the limit', () => {
  const text = Array.from({ length: 200 }, (_, index) => `第${index}行内容`).join('\n');
  const chunks = chunkMarkdownText(text, 100);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 100, `chunk exceeds the limit: ${chunk.length}`);
  }
  assert.equal(chunks.join('\n'), text);
});

test('chunkMarkdownText does not break inside a code block that fits the limit', () => {
  const code = '```js\nconsole.log(1);\n```';
  const text = `${'A'.repeat(80)}\n\n${code}\n\n${'B'.repeat(80)}`;
  const chunks = chunkMarkdownText(text, 100);
  const codeChunk = chunks.find((chunk) => chunk.includes('```js'));
  assert.ok(codeChunk);
  assert.ok(codeChunk.startsWith(code));
});

test('chunkMarkdownText still chunks an oversized code block within the limit', () => {
  const code = ['```js', ...Array.from({ length: 30 }, (_, i) => `console.log(${i});`), '```']
    .join('\n');
  const chunks = chunkMarkdownText(code, 100);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 100, `chunk exceeds the limit: ${chunk.length}`);
  }
  assert.equal(chunks.join('\n'), code);
});

test('chunkMarkdownText keeps a GFM table together', () => {
  const table = [
    '| 列一 | 列二 |',
    '| --- | --- |',
    '| a | b |',
    '| c | d |',
  ].join('\n');
  const chunks = chunkMarkdownText(table, 200);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], table);
});

test('chunkMarkdownText hard-splits an oversized single line', () => {
  const line = 'x'.repeat(250);
  const chunks = chunkMarkdownText(line, 100);
  assert.deepEqual(chunks, ['x'.repeat(100), 'x'.repeat(100), 'x'.repeat(50)]);
});

test('chunkMarkdownText does not split an emoji surrogate pair', () => {
  const chunks = chunkMarkdownText(`1234😀5678`, 5);
  assert.equal(chunks.join(''), '1234😀5678');
  assert.equal(chunks.some((chunk) => chunk.includes('\uFFFD')), false);
  for (const chunk of chunks) assert.ok(chunk.length <= 5);
});

test('sendMarkdownReply sends markdown with unique msg_seq per chunk', async () => {
  const calls = [];
  const results = await sendMarkdownReply({
    send: async (options) => {
      calls.push(options);
      return { id: `id-${calls.length}` };
    },
    sendText: async () => {
      throw new Error('sendText must not be called when markdown succeeds');
    },
  }, target, '# 标题\n\n**加粗**内容');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].target, target);
  assert.equal(calls[0].msgType, 2);
  assert.equal(calls[0].markdown.content, '# 标题\n\n**加粗**内容');
  assert.equal(Number.isInteger(calls[0].extra.msg_seq), true);
  assert.deepEqual(results, [{ id: 'id-1' }]);
});

test('sendMarkdownReply assigns distinct msg_seq values across chunks', async () => {
  const seqs = [];
  const bot = {
    send: async ({ extra }) => {
      seqs.push(extra.msg_seq);
      return { id: 'x' };
    },
    sendText: async () => { throw new Error('unexpected'); },
  };
  const text = Array.from({ length: 1_500 }, (_, index) => `第${index}行`).join('\n');
  await sendMarkdownReply(bot, target, text);
  assert.ok(seqs.length > 1);
  assert.equal(new Set(seqs).size, seqs.length);
});

test('sendMarkdownReply falls back to plain text per chunk on markdown rejection', async () => {
  const sentText = [];
  const warnings = [];
  const results = await sendMarkdownReply({
    send: async () => {
      throw new Error('markdown rejected: no permission');
    },
    sendText: async (_target, text) => {
      sentText.push(text);
      return { id: `text-${sentText.length}` };
    },
  }, target, '回答内容', { logger: { warn: (...args) => warnings.push(args) } });
  assert.deepEqual(sentText, ['回答内容']);
  assert.deepEqual(results, [{ id: 'text-1' }]);
  assert.equal(warnings.length, 1);
});

test('sendMarkdownReply uses sendText directly when the bot lacks send()', async () => {
  const sentText = [];
  const results = await sendMarkdownReply({
    sendText: async (_target, text) => {
      sentText.push(text);
      return { id: 'plain-1' };
    },
  }, target, '没有 send 方法的机器人');
  assert.deepEqual(sentText, ['没有 send 方法的机器人']);
  assert.deepEqual(results, [{ id: 'plain-1' }]);
});

test('sendMarkdownReply delivers long answers as multiple markdown chunks', async () => {
  const markdownChunks = [];
  const bot = {
    send: async ({ markdown }) => {
      markdownChunks.push(markdown.content);
      return { id: `id-${markdownChunks.length}` };
    },
    sendText: async () => { throw new Error('unexpected'); },
  };
  const text = Array.from({ length: 600 }, (_, index) => `- 列表项 ${index}`).join('\n');
  const results = await sendMarkdownReply(bot, target, text);
  assert.ok(markdownChunks.length > 1);
  for (const chunk of markdownChunks) {
    assert.ok(chunk.length <= 4_500);
  }
  assert.equal(results.length, markdownChunks.length);
  assert.equal(markdownChunks.join('\n'), text);
});

test('sendMarkdownReply moves overflow chunks off the passive group reply target', async () => {
  const targets = [];
  const groupTarget = { scope: 'group', targetId: 'group-1', msgId: 'group-msg' };
  await sendMarkdownReply({
    send: async ({ target: sentTarget }) => {
      targets.push(sentTarget);
      return { id: `id-${targets.length}` };
    },
    sendText: async () => { throw new Error('unexpected'); },
  }, groupTarget, 'x'.repeat(4_500 * 6));

  assert.equal(targets.length, 6);
  assert.equal(targets.slice(0, 4).every((sentTarget) => sentTarget.msgId === 'group-msg'), true);
  assert.deepEqual(targets.slice(4), [
    { scope: 'group', targetId: 'group-1' },
    { scope: 'group', targetId: 'group-1' },
  ]);
});

test('sendMarkdownReply uses the reserved passive reply for a visible partial notice', async () => {
  const groupTarget = { scope: 'group', targetId: 'group-1', msgId: 'group-msg' };
  const notices = [];
  const results = await sendMarkdownReply({
    send: async ({ target: sentTarget }) => {
      if (!sentTarget.msgId) throw new Error('proactive disabled');
      return { id: 'passive' };
    },
    sendText: async (sentTarget, text) => {
      if (!sentTarget.msgId) throw new Error('proactive disabled');
      notices.push(text);
      return { id: 'partial-notice' };
    },
  }, groupTarget, 'x'.repeat(4_500 * 6), { logger: { warn() {} } });

  assert.equal(results.length, 5);
  assert.deepEqual(notices, ['回答较长，后续内容未能通过 QQ 完整发送，请回复“继续”。']);
});

test('sendMarkdownReply returns no deliveries for empty text', async () => {
  const results = await sendMarkdownReply({
    send: async () => { throw new Error('unexpected'); },
    sendText: async () => { throw new Error('unexpected'); },
  }, target, '');
  assert.deepEqual(results, []);
});
