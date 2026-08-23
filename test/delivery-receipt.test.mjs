import assert from 'node:assert/strict';
import test from 'node:test';

import {
  artifactOutcomeForError,
  createArtifactFailureReceipt,
  createDeliveryReceipt,
  mergeDeliveryReceipts,
  providerMessageIdsFor,
} from '../src/channels/shared/semantic/delivery.mjs';

test('DeliveryReceipt validates and freezes the shared versioned contract', () => {
  const receipt = createDeliveryReceipt({
    deliveryId: 'delivery-1',
    presentation: 'feishu-file',
    providerMessageIds: ['om-file', 'om-file'],
    artifacts: [{ artifactId: 'artifact-1', outcome: 'sent' }],
  });

  assert.deepEqual(receipt, {
    schemaVersion: 1,
    deliveryId: 'delivery-1',
    presentation: 'feishu-file',
    providerMessageIds: ['om-file'],
    artifacts: [{ artifactId: 'artifact-1', outcome: 'sent' }],
  });
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.providerMessageIds), true);
  assert.equal(Object.isFrozen(receipt.artifacts[0]), true);
  assert.throws(
    () => createDeliveryReceipt({
      deliveryId: 'delivery-invalid',
      presentation: 'feishu-file',
      artifacts: [{ artifactId: 'artifact-1', outcome: 'maybe' }],
    }),
    /artifact outcome/,
  );
});

test('artifact failures distinguish policy rejection, retryable failure, and uncertain delivery', () => {
  assert.equal(artifactOutcomeForError({ code: 'artifact-permission-required' }), 'rejected');
  assert.equal(artifactOutcomeForError({ code: 'artifact-too-large' }), 'rejected');
  assert.equal(artifactOutcomeForError({ code: 'artifact-unavailable' }), 'rejected');
  assert.equal(artifactOutcomeForError({ code: 'artifact-rate-limited' }), 'failed');
  assert.equal(artifactOutcomeForError(new Error('network unavailable')), 'failed');
  assert.equal(artifactOutcomeForError({ code: 'artifact-delivery-uncertain' }), 'unknown');

  assert.deepEqual(createArtifactFailureReceipt({
    artifactId: 'artifact-uncertain',
    deliveryId: 'delivery-uncertain',
    error: { code: 'artifact-delivery-uncertain' },
  }).artifacts, [{
    artifactId: 'artifact-uncertain',
    outcome: 'unknown',
    reason: 'artifact-delivery-uncertain',
  }]);
});

test('provider message ids are collected only from explicit message-id fields', () => {
  assert.deepEqual(providerMessageIdsFor({ message_id: 42 }), ['42']);
  assert.deepEqual(providerMessageIdsFor({ key: { id: 'wamid-one' } }), ['wamid-one']);
  assert.deepEqual(providerMessageIdsFor({ ts: '123.456' }), ['123.456']);
  assert.deepEqual(providerMessageIdsFor({ body: { msgid: 'wecom-one' } }), ['wecom-one']);
  assert.deepEqual(providerMessageIdsFor({
    providerMessageIds: ['first', 'second', 'first', '', null],
  }), ['first', 'second']);
  assert.deepEqual(providerMessageIdsFor({ processQueryKey: 'not-a-message-id' }), []);
  assert.deepEqual(providerMessageIdsFor({ files: [{ id: 'not-a-message-id' }] }), []);
});

test('text and multiple artifact attempts merge into one authoritative receipt', () => {
  const text = createDeliveryReceipt({
    deliveryId: 'turn-message',
    presentation: 'feishu-cardkit',
    providerMessageIds: ['om-card'],
  });
  const sent = createDeliveryReceipt({
    deliveryId: 'file-1',
    presentation: 'feishu-file',
    providerMessageIds: ['om-file'],
    artifacts: [{ artifactId: 'artifact-1', outcome: 'sent' }],
  });
  const failed = createArtifactFailureReceipt({
    artifactId: 'artifact-2',
    deliveryId: 'file-2',
    error: { code: 'artifact-rate-limited' },
    providerMessageIds: ['om-notice'],
  });

  assert.deepEqual(mergeDeliveryReceipts({
    deliveryId: 'turn-message',
    presentation: 'feishu-text-and-files',
    receipts: [text, sent, failed],
  }), {
    schemaVersion: 1,
    deliveryId: 'turn-message',
    presentation: 'feishu-text-and-files',
    providerMessageIds: ['om-card', 'om-file', 'om-notice'],
    artifacts: [
      { artifactId: 'artifact-1', outcome: 'sent' },
      { artifactId: 'artifact-2', outcome: 'failed', reason: 'artifact-rate-limited' },
    ],
  });
});
