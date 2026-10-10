import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MESSAGE_BREAK_TOOL,
  createMessageBreakToolDefinition,
  createMessageBreakHandler,
  installMessageBreakTool,
} from '../src/channels/shared/message-break.mjs';

test('message-break: tool definition has correct name and description', () => {
  const def = createMessageBreakToolDefinition();
  assert.equal(def.name, MESSAGE_BREAK_TOOL);
  assert.equal(def.name, 'message_break');
  assert.match(def.description, /Do not use when the user message does not come from dsh-im/);
});

test('message-break: installMessageBreakTool registers tool and system prompt section', () => {
  const registeredTools = [];
  const sections = [];
  const fakeCtx = {
    tools: {
      register(tool) {
        registeredTools.push(tool);
      },
    },
    systemPrompt: {
      section(sec) {
        sections.push(sec);
      },
    },
  };
  const result = installMessageBreakTool(fakeCtx);
  assert.equal(result, true);
  assert.equal(registeredTools.length, 1);
  assert.equal(registeredTools[0].name, 'message_break');
  assert.match(registeredTools[0].description, /Do not use when the user message does not come from dsh-im/);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, 'dsh-im:message-break');
  assert.match(sections[0].text, /Do not use when the user message does not come from dsh-im/);
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

test('message-break: segmentsCover only fires when nothing is left to send', async () => {
  const handler = createMessageBreakHandler({ sendSegment: async () => {} });
  assert.equal(handler.segmentsCover('anything'), false, 'no break yet');
  await handler.handleUpdate({ type: 'message_break', text: '第一段' });
  assert.equal(handler.segmentsCover('第一段'), true, 'the answer ended at the break point');
  assert.equal(handler.segmentsCover('第一段\n'), true, 'trailing whitespace is not content');
  assert.equal(handler.segmentsCover('第一段第二段'), false, 'a tail is still pending');
  assert.equal(handler.segmentsCover('改写后的回答'), false, 'canonical rewrite');
  assert.equal(handler.segmentsCover(''), false, 'empty answer');
});

test('message-break: segmentsCover never suppresses a tail split by raw whitespace', async () => {
  const handler = createMessageBreakHandler({ sendSegment: async () => {} });
  // The raw segment text no longer prefixes the answer (it carries whitespace
  // the canonical answer dropped), so the whole answer must still be sent —
  // losing the second segment would be worse than repeating the first.
  await handler.handleUpdate({ type: 'message_break', text: '第一段\n\n' });
  assert.equal(handler.segmentsCover('第一段第二段'), false);
  assert.equal(handler.remainingText('第一段第二段'), '第一段第二段');
});

test('message-break: prompt surfaces spell out the write-then-break rule', () => {
  const def = createMessageBreakToolDefinition();
  const sections = [];
  installMessageBreakTool({
    tools: { register() {} },
    systemPrompt: { section: (sec) => sections.push(sec) },
  });
  for (const text of [def.description, sections[0].text]) {
    // The rule that makes the tool work: the segment is written first.
    assert.match(text, /Write the segment first, then call this tool|write a segment, then call message_break/);
    assert.match(text, /Never call it before you start writing a segment|Never call message_break before you start a segment/);
    assert.match(text, /Do not use when the user message does not come from dsh-im/);
    // The ambiguous "segments between breaks" framing invited leading breaks.
    assert.doesNotMatch(text, /between message_break calls/);
  }
});

test('message-break: handler does not send empty segments', async () => {
  const sent = [];
  const warnings = [];
  const handler = createMessageBreakHandler({
    sendSegment: async (text) => { sent.push(text); },
    logger: { warn: (...args) => warnings.push(args.join(' ')) },
  });
  await handler.handleUpdate({ type: 'message_break', text: '   ' });
  assert.equal(sent.length, 0);
  // hasBreaks is still true (the break was registered)
  assert.equal(handler.hasBreaks(), true);
  // A leading (empty) break is flagged once so the misuse is observable.
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /no new text since the last break/);
});

test('message-break: handler warns only once per turn for empty breaks', async () => {
  const warnings = [];
  const handler = createMessageBreakHandler({
    sendSegment: async () => {},
    logger: { warn: (...args) => warnings.push(args.join(' ')) },
  });
  await handler.handleUpdate({ type: 'message_break', text: '' });
  await handler.handleUpdate({ type: 'message_break', text: '' });
  assert.equal(warnings.length, 1);
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
