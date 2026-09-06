import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MESSAGE_BREAK_TOOL,
  createMessageBreakToolDefinition,
  createMessageBreakHandler,
} from '../src/channels/shared/message-break.mjs';

test('message-break: tool definition has correct name', () => {
  const def = createMessageBreakToolDefinition();
  assert.equal(def.name, MESSAGE_BREAK_TOOL);
  assert.equal(def.name, 'message_break');
});

test('message-break: tool definition has no required parameters', () => {
  const def = createMessageBreakToolDefinition();
  assert.equal(def.parameters.type, 'object');
  assert.equal(def.parameters.additionalProperties, false);
  assert.deepEqual(def.parameters.required, []);
});

test('message-break: tool execute returns ok:true', async () => {
  const def = createMessageBreakToolDefinition();
  const result = await def.execute({});
  assert.deepEqual(result, { ok: true });
});

test('message-break: handler passes through non-break updates', async () => {
  const sent = [];
  const handler = createMessageBreakHandler({
    sendSegment: async (text) => { sent.push(text); },
  });
  const update = { type: 'text', text: 'hello' };
  const result = await handler.handleUpdate(update);
  assert.equal(result, update);
  assert.equal(sent.length, 0);
});

test('message-break: handler sends segment text on break and returns null', async () => {
  const sent = [];
  const handler = createMessageBreakHandler({
    sendSegment: async (text) => { sent.push(text); },
  });
  const result = await handler.handleUpdate({ type: 'message_break', text: 'first segment' });
  assert.equal(result, null);
  assert.equal(sent.length, 1);
  assert.equal(sent[0], 'first segment');
});

test('message-break: handler remainingText returns full answer when no breaks', () => {
  const handler = createMessageBreakHandler({ sendSegment: async () => {} });
  assert.equal(handler.remainingText('full answer'), 'full answer');
  assert.equal(handler.hasBreaks(), false);
});

test('message-break: handler remainingText returns text after last break', async () => {
  const handler = createMessageBreakHandler({ sendSegment: async () => {} });
  await handler.handleUpdate({ type: 'message_break', text: 'segment 1' });
  await handler.handleUpdate({ type: 'message_break', text: 'segment 2' });
  // sentText = 'segment 1segment 2' (raw concatenation)
  // fullAnswer must start with sentText for the prefix match
  const fullAnswer = 'segment 1segment 2remaining';
  const remaining = handler.remainingText(fullAnswer);
  assert.equal(remaining, 'remaining');
  assert.equal(handler.hasBreaks(), true);
});

test('message-break: handler remainingText trims leading whitespace', async () => {
  const handler = createMessageBreakHandler({ sendSegment: async () => {} });
  await handler.handleUpdate({ type: 'message_break', text: 'hello' });
  // sentText = 'hello', fullAnswer = 'hello\n\nworld'
  const remaining = handler.remainingText('hello\n\nworld');
  assert.equal(remaining, 'world');
});

test('message-break: handler remainingText returns full answer when prefix mismatch', async () => {
  const handler = createMessageBreakHandler({ sendSegment: async () => {} });
  await handler.handleUpdate({ type: 'message_break', text: 'abc' });
  // sentText = 'abc', but fullAnswer doesn't start with 'abc'
  // remainingText should return the full answer as fallback
  const remaining = handler.remainingText('xyzfinal');
  assert.equal(remaining, 'xyzfinal');
});

test('message-break: handler remainingText returns empty for empty answer', async () => {
  const handler = createMessageBreakHandler({ sendSegment: async () => {} });
  await handler.handleUpdate({ type: 'message_break', text: 'all text' });
  assert.equal(handler.remainingText(''), '');
});

test('message-break: handler remainingText returns full answer when sent exceeds answer length', async () => {
  const handler = createMessageBreakHandler({ sendSegment: async () => {} });
  await handler.handleUpdate({ type: 'message_break', text: 'very long segment text' });
  // sentLength (24) > fullAnswer length (5)
  assert.equal(handler.remainingText('short'), 'short');
});

test('message-break: handler does not send empty segments', async () => {
  const sent = [];
  const handler = createMessageBreakHandler({
    sendSegment: async (text) => { sent.push(text); },
  });
  await handler.handleUpdate({ type: 'message_break', text: '   ' });
  assert.equal(sent.length, 0);
  // hasBreaks is still true (the break was registered)
  assert.equal(handler.hasBreaks(), true);
});

test('message-break: handler circuit breaker after 20 breaks', async () => {
  const sent = [];
  const handler = createMessageBreakHandler({
    sendSegment: async (text) => { sent.push(text); },
  });
  for (let i = 0; i < 25; i += 1) {
    await handler.handleUpdate({ type: 'message_break', text: `seg ${i}` });
  }
  // Only 20 segments should be sent (breaker trips at 20)
  assert.equal(sent.length, 20);
  assert.equal(handler.hasBreaks(), true);
});

test('message-break: handler sendSegment failure does not throw', async () => {
  const handler = createMessageBreakHandler({
    sendSegment: async () => { throw new Error('send failed'); },
    logger: { warn() {} }, // suppress warning
  });
  // Should not throw
  const result = await handler.handleUpdate({ type: 'message_break', text: 'segment' });
  assert.equal(result, null);
  assert.equal(handler.hasBreaks(), true);
});
