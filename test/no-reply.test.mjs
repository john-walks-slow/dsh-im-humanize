import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NO_REPLY_TOOL,
  createNoReplyToolDefinition,
  installNoReplyTool,
} from '../src/channels/shared/no-reply.mjs';

test('no-reply: tool definition has correct name and description', () => {
  const def = createNoReplyToolDefinition();
  assert.equal(def.name, NO_REPLY_TOOL);
  assert.equal(def.name, 'no_reply');
  assert.match(def.description, /no IM reply should be sent/);
  assert.match(def.description, /proactive wake on an IM-connected session/);
  assert.match(def.description, /ONLY action with no chat text/);
});

test('no-reply: installNoReplyTool registers tool and system prompt section', () => {
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
  const result = installNoReplyTool(fakeCtx);
  assert.equal(result, true);
  assert.equal(registeredTools.length, 1);
  assert.equal(registeredTools[0].name, 'no_reply');
  assert.match(registeredTools[0].description, /no IM reply should be sent/);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, 'dsh-im:no-reply');
  assert.equal(sections[0].order, 118);
  assert.match(sections[0].text, /no IM reply should be sent/);
});

test('no-reply: tool definition has no required parameters', () => {
  const def = createNoReplyToolDefinition();
  assert.equal(def.parameters.type, 'object');
  assert.equal(def.parameters.additionalProperties, false);
  assert.deepEqual(def.parameters.required, []);
});

test('no-reply: execute concludes the turn and returns acknowledged:true', async () => {
  const def = createNoReplyToolDefinition();
  let concluded = false;
  const result = await def.execute({}, { concludeTurn: () => { concluded = true; } });
  assert.deepEqual(result, { acknowledged: true });
  assert.equal(concluded, true);
});

test('no-reply: execute without concludeTurn still returns acknowledged:true', async () => {
  const def = createNoReplyToolDefinition();
  const result = await def.execute({}, undefined);
  assert.deepEqual(result, { acknowledged: true });
});