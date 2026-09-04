import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HarnessReplyTracker } from '../src/channels/shared/harness-client.mjs';

const PROMPT_RPC_ID = 'reply-tracker-test';

function turnPrefix(turn = 1) {
  return [
    { type: 'turn/start', seq: 1, data: { turn } },
    {
      type: 'user/message',
      seq: 2,
      data: { turn, source: { rpcId: PROMPT_RPC_ID } },
    },
  ];
}

function textDelta(seq, { turn = 1, step = 0, index = 0, text }) {
  return {
    type: 'assistant/chunk',
    seq,
    data: { turn, step, chunk: { type: 'text-delta', index, text } },
  };
}

function assistantMessage(seq, { turn = 1, step, text }) {
  return {
    type: 'assistant/message',
    seq,
    data: {
      turn,
      ...(step === undefined ? {} : { step }),
      message: { content: [{ type: 'text', text }] },
    },
  };
}

test('HarnessReplyTracker accumulates text deltas across steps', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: PROMPT_RPC_ID });

  const updates = tracker.consumeAll([
    ...turnPrefix(),
    textDelta(3, { step: 0, text: '第一段' }),
    textDelta(4, { step: 1, text: '第二段' }),
    { type: 'turn/end', seq: 5, data: { turn: 1, reason: { kind: 'completed' } } },
  ]);

  assert.deepEqual(updates, [{ type: 'text', text: '第一段\n\n第二段' }]);
  assert.equal(tracker.answer, '第一段\n\n第二段');
  assert.equal(tracker.finished, true);
});

test('HarnessReplyTracker orders content parts within each step', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: PROMPT_RPC_ID });

  tracker.consumeAll([
    ...turnPrefix(),
    textDelta(3, { step: 1, index: 1, text: '乙' }),
    textDelta(4, { step: 0, index: 0, text: '甲' }),
    textDelta(5, { step: 1, index: 0, text: '丙' }),
  ]);

  assert.equal(tracker.answer, '甲\n\n丙\n乙');
});

test('HarnessReplyTracker merges canonical assistant messages across steps', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: PROMPT_RPC_ID });

  tracker.consumeAll([
    ...turnPrefix(),
    assistantMessage(3, { step: 0, text: '第一步定稿' }),
    assistantMessage(4, { step: 1, text: '第二步定稿' }),
  ]);

  assert.equal(tracker.answer, '第一步定稿\n\n第二步定稿');
});

test('HarnessReplyTracker replaces one step deltas with its canonical message', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: PROMPT_RPC_ID });

  tracker.consumeAll([
    ...turnPrefix(),
    textDelta(3, { step: 0, text: '第一步草稿' }),
    assistantMessage(4, { step: 0, text: '第一步定稿' }),
    textDelta(5, { step: 1, text: '第二步草稿' }),
    assistantMessage(6, { step: 1, text: '第二步定稿' }),
  ]);

  assert.equal(tracker.answer, '第一步定稿\n\n第二步定稿');
  assert.equal(tracker.answer.includes('草稿'), false);
});

test('HarnessReplyTracker keeps replace-latest behavior for assistant messages without step metadata', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: PROMPT_RPC_ID });

  tracker.consumeAll([
    ...turnPrefix(),
    assistantMessage(3, { text: '旧定稿' }),
    assistantMessage(4, { text: '新定稿' }),
  ]);

  assert.equal(tracker.answer, '新定稿');
});

test('HarnessReplyTracker excludes reasoning and tool events from the answer', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: PROMPT_RPC_ID });

  tracker.consumeAll([
    ...turnPrefix(),
    {
      type: 'assistant/chunk',
      seq: 3,
      data: {
        turn: 1,
        step: 0,
        chunk: { type: 'reasoning-delta', index: 0, text: '内部推理' },
      },
    },
    { type: 'tool/call', seq: 4, data: { turn: 1, step: 0, name: 'search' } },
    { type: 'tool/result', seq: 5, data: { turn: 1, step: 0, secret: '工具结果' } },
    textDelta(6, { step: 1, text: '用户可见答案' }),
  ]);

  assert.equal(tracker.answer, '用户可见答案');
});

test('HarnessReplyTracker still ignores duplicate sequences and unrelated turns', () => {
  const tracker = new HarnessReplyTracker({ promptRpcId: PROMPT_RPC_ID, afterSeq: 10 });

  tracker.consumeAll([
    { type: 'turn/start', seq: 11, data: { turn: 7 } },
    {
      type: 'user/message',
      seq: 12,
      data: { turn: 7, source: { rpcId: PROMPT_RPC_ID } },
    },
    textDelta(14, { turn: 8, step: 0, text: '其他 Turn' }),
    textDelta(13, { turn: 7, step: 0, text: '有效' }),
    textDelta(13, { turn: 7, step: 0, text: '重复' }),
  ]);

  assert.equal(tracker.answer, '有效');
});
