import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ON_NEW_MESSAGE_MODES,
  DEFAULT_ON_NEW_MESSAGE,
  normalizeOnNewMessage,
  resolveNewMessagePolicy,
  fireAndForgetStop,
  trySteer,
} from '../src/channels/shared/new-message-policy.mjs';

test('new-message-policy: modes are interrupt, queue, steer', () => {
  assert.deepEqual([...ON_NEW_MESSAGE_MODES], ['interrupt', 'queue', 'steer']);
  assert.equal(DEFAULT_ON_NEW_MESSAGE, 'interrupt');
});

test('new-message-policy: normalizeOnNewMessage accepts valid values', () => {
  assert.equal(normalizeOnNewMessage('interrupt'), 'interrupt');
  assert.equal(normalizeOnNewMessage('queue'), 'queue');
  assert.equal(normalizeOnNewMessage('steer'), 'steer');
});

test('new-message-policy: normalizeOnNewMessage falls back to default for invalid', () => {
  assert.equal(normalizeOnNewMessage('invalid'), DEFAULT_ON_NEW_MESSAGE);
  assert.equal(normalizeOnNewMessage(undefined), DEFAULT_ON_NEW_MESSAGE);
  assert.equal(normalizeOnNewMessage(null), DEFAULT_ON_NEW_MESSAGE);
  assert.equal(normalizeOnNewMessage(123), DEFAULT_ON_NEW_MESSAGE);
});

test('new-message-policy: resolveNewMessagePolicy returns null when no queue', () => {
  const result = resolveNewMessagePolicy({
    hasQueue: false,
    hasPendingInteraction: false,
    hasPendingApproval: false,
    onNewMessage: 'interrupt',
  });
  assert.equal(result, null);
});

test('new-message-policy: resolveNewMessagePolicy returns queue when pending interaction', () => {
  for (const mode of ['interrupt', 'queue', 'steer']) {
    const result = resolveNewMessagePolicy({
      hasQueue: true,
      hasPendingInteraction: true,
      hasPendingApproval: false,
      onNewMessage: mode,
    });
    assert.equal(result, 'queue', `pending interaction should queue regardless of mode=${mode}`);
  }
});

test('new-message-policy: resolveNewMessagePolicy returns queue when pending approval', () => {
  for (const mode of ['interrupt', 'queue', 'steer']) {
    const result = resolveNewMessagePolicy({
      hasQueue: true,
      hasPendingInteraction: false,
      hasPendingApproval: true,
      onNewMessage: mode,
    });
    assert.equal(result, 'queue', `pending approval should queue regardless of mode=${mode}`);
  }
});

test('new-message-policy: resolveNewMessagePolicy returns configured mode when active queue, no pending', () => {
  assert.equal(resolveNewMessagePolicy({
    hasQueue: true, hasPendingInteraction: false, hasPendingApproval: false,
    onNewMessage: 'interrupt',
  }), 'interrupt');
  assert.equal(resolveNewMessagePolicy({
    hasQueue: true, hasPendingInteraction: false, hasPendingApproval: false,
    onNewMessage: 'queue',
  }), 'queue');
  assert.equal(resolveNewMessagePolicy({
    hasQueue: true, hasPendingInteraction: false, hasPendingApproval: false,
    onNewMessage: 'steer',
  }), 'steer');
});

test('new-message-policy: fireAndForgetStop calls stopActiveTurn without awaiting', async () => {
  let called = false;
  const session = {
    stopActiveTurn(control, options) {
      called = true;
      return Promise.resolve(true);
    },
  };
  fireAndForgetStop({
    session,
    control: { owner: 'test', key: 'k1' },
  });
  // fire-and-forget: the call is initiated but not awaited
  // wait a tick for the promise to settle
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(called, true);
});

test('new-message-policy: fireAndForgetStop does not throw when session is null', () => {
  // Should not throw
  fireAndForgetStop({ session: null, control: { owner: 'test', key: 'k1' } });
});

test('new-message-policy: fireAndForgetStop catches errors', async () => {
  const session = {
    stopActiveTurn() { return Promise.reject(new Error('fail')); },
  };
  // Should not throw
  fireAndForgetStop({
    session,
    control: { owner: 'test', key: 'k1' },
    logger: { warn() {} },
  });
  await new Promise((r) => setTimeout(r, 10));
});

test('new-message-policy: trySteer returns true when steer succeeds', async () => {
  const session = {
    steerActiveTurn(text, control, options) {
      return Promise.resolve(true);
    },
  };
  const result = await trySteer({
    session,
    text: 'new instruction',
    control: { owner: 'test', key: 'k1' },
  });
  assert.equal(result, true);
});

test('new-message-policy: trySteer returns false when turn ended', async () => {
  const session = {
    steerActiveTurn() { return Promise.resolve(false); },
  };
  const result = await trySteer({
    session,
    text: 'new instruction',
    control: { owner: 'test', key: 'k1' },
  });
  assert.equal(result, false);
});

test('new-message-policy: trySteer returns false for empty text', async () => {
  const result = await trySteer({
    session: { steerActiveTurn: () => Promise.resolve(true) },
    text: '',
    control: { owner: 'test', key: 'k1' },
  });
  assert.equal(result, false);
});

test('new-message-policy: trySteer returns false when session is null', async () => {
  const result = await trySteer({
    session: null,
    text: 'instruction',
    control: { owner: 'test', key: 'k1' },
  });
  assert.equal(result, false);
});

test('new-message-policy: trySteer catches errors and returns false', async () => {
  const session = {
    steerActiveTurn() { return Promise.reject(new Error('network error')); },
  };
  const result = await trySteer({
    session,
    text: 'instruction',
    control: { owner: 'test', key: 'k1' },
    logger: { warn() {} },
  });
  assert.equal(result, false);
});
