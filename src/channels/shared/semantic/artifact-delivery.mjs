import {
  materializeOutboundArtifact,
  releaseOutboundArtifact,
} from './artifact.mjs';
import {
  createArtifactFailureReceipt,
  createDeliveryReceipt,
  mergeDeliveryReceipts,
  providerMessageIdsFor,
} from './delivery.mjs';

function unavailableError() {
  const error = new Error('Native file delivery is unavailable');
  error.code = 'artifact-provider-unavailable';
  return error;
}

function isAbort(error, signal) {
  return signal?.aborted
    || error?.name === 'AbortError'
    || error?.code === 'ABORT_ERR';
}

function providerIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value
      .filter((candidate) => (
        (typeof candidate === 'string' && candidate.trim())
          || Number.isSafeInteger(candidate)
      ))
      .map(String))];
  }
  return providerMessageIdsFor(value);
}

function isVoiceCandidate(file) {
  const mediaType = typeof file?.mediaType === 'string' ? file.mediaType.toLowerCase() : '';
  const fileName = typeof file?.fileName === 'string' ? file.fileName.toLowerCase() : '';
  return mediaType === 'audio/ogg'
    || mediaType === 'audio/opus'
    || fileName.endsWith('.ogg')
    || fileName.endsWith('.opus');
}

function isGifCandidate(file) {
  const mediaType = typeof file?.mediaType === 'string' ? file.mediaType.toLowerCase() : '';
  const fileName = typeof file?.fileName === 'string' ? file.fileName.toLowerCase() : '';
  return mediaType === 'image/gif' || fileName.endsWith('.gif');
}

function isImageCandidate(file) {
  const mediaType = typeof file?.mediaType === 'string' ? file.mediaType.toLowerCase() : '';
  return mediaType.startsWith('image/');
}

async function sendMaterializedArtifact(file, {
  sendFile,
  sendImage,
  sendAnimation,
  sendVoice,
  signal,
}) {
  const mode = file?.as ?? 'auto';

  // 1. Explicit 'file' mode: skips any rich presentation
  if (mode === 'file') {
    signal?.throwIfAborted();
    if (typeof sendFile !== 'function') throw unavailableError();
    return {
      presentation: 'file',
      result: await sendFile(file),
    };
  }

  // 2. Explicit 'voice' mode: prefers voice, falls back to file
  if (mode === 'voice') {
    if (typeof sendVoice === 'function') {
      try {
        return {
          presentation: 'voice',
          result: await sendVoice(file),
        };
      } catch (error) {
        if (isAbort(error, signal) || error?.code === 'artifact-delivery-uncertain') {
          throw error;
        }
      }
    }
    signal?.throwIfAborted();
    if (typeof sendFile !== 'function') throw unavailableError();
    return {
      presentation: 'file',
      result: await sendFile(file),
    };
  }

  // 3. Explicit 'animation' mode: prefers animation, then image, then file
  if (mode === 'animation') {
    if (typeof sendAnimation === 'function') {
      try {
        return {
          presentation: 'animation',
          result: await sendAnimation(file),
        };
      } catch (error) {
        if (isAbort(error, signal) || error?.code === 'artifact-delivery-uncertain') {
          throw error;
        }
      }
    }
    if (typeof sendImage === 'function') {
      try {
        return {
          presentation: 'image',
          result: await sendImage(file),
        };
      } catch (error) {
        if (isAbort(error, signal) || error?.code === 'artifact-delivery-uncertain') {
          throw error;
        }
      }
    }
    signal?.throwIfAborted();
    if (typeof sendFile !== 'function') throw unavailableError();
    return {
      presentation: 'file',
      result: await sendFile(file),
    };
  }

  // 4. Explicit 'image' mode: prefers image, falls back to file
  if (mode === 'image') {
    if (typeof sendImage === 'function') {
      try {
        return {
          presentation: 'image',
          result: await sendImage(file),
        };
      } catch (error) {
        if (isAbort(error, signal) || error?.code === 'artifact-delivery-uncertain') {
          throw error;
        }
      }
    }
    signal?.throwIfAborted();
    if (typeof sendFile !== 'function') throw unavailableError();
    return {
      presentation: 'file',
      result: await sendFile(file),
    };
  }

  // 5. 'auto' mode: smart inference
  // 5.1 Voice candidates (ogg/opus)
  if (isVoiceCandidate(file) && typeof sendVoice === 'function') {
    try {
      return {
        presentation: 'voice',
        result: await sendVoice(file),
      };
    } catch (error) {
      if (isAbort(error, signal) || error?.code === 'artifact-delivery-uncertain') {
        throw error;
      }
    }
  }

  // 5.2 GIF candidates
  if (isGifCandidate(file)) {
    if (typeof sendAnimation === 'function') {
      try {
        return {
          presentation: 'animation',
          result: await sendAnimation(file),
        };
      } catch (error) {
        if (isAbort(error, signal) || error?.code === 'artifact-delivery-uncertain') {
          throw error;
        }
      }
    }
    if (typeof sendImage === 'function') {
      try {
        return {
          presentation: 'image',
          result: await sendImage(file),
        };
      } catch (error) {
        if (isAbort(error, signal) || error?.code === 'artifact-delivery-uncertain') {
          throw error;
        }
      }
    }
  } else if (isImageCandidate(file) && typeof sendImage === 'function') {
    // 5.3 Other images
    try {
      return {
        presentation: 'image',
        result: await sendImage(file),
      };
    } catch (error) {
      if (isAbort(error, signal) || error?.code === 'artifact-delivery-uncertain') {
        throw error;
      }
    }
  }

  // 5.4 Fallback to generic file
  signal?.throwIfAborted();
  if (typeof sendFile !== 'function') throw unavailableError();
  return {
    presentation: 'file',
    result: await sendFile(file),
  };
}

/**
 * Deliver registered artifacts with one shared image-first policy while keeping
 * provider protocol details inside the channel-supplied send closures.
 */
export async function deliverOutboundArtifacts({
  artifacts = [],
  baseReceipt = null,
  deliveryId,
  aggregatePresentation,
  alwaysMerge = false,
  channelKey,
  signal,
  sendFile,
  sendImage,
  sendAnimation,
  sendVoice,
  sendFailureNotice,
  onFailure,
  logger,
}) {
  const receipts = baseReceipt ? [baseReceipt] : [];
  let userVisible = Boolean(baseReceipt) && baseReceipt.deliveryOutcome !== 'failed';
  let failureNoticeVisible = false;
  let artifactsSent = 0;
  let artifactSendErrors = 0;

  let artifactIndex = 0;
  try {
    while (artifactIndex < artifacts.length) {
      const artifact = artifacts[artifactIndex];
      artifactIndex += 1;
      try {
        signal?.throwIfAborted();
        const file = await materializeOutboundArtifact(artifact, { signal });
        signal?.throwIfAborted();
        const sent = await sendMaterializedArtifact(file, {
          sendFile,
          sendImage,
          sendAnimation,
          sendVoice,
          signal,
        });
        signal?.throwIfAborted();
        receipts.push(createDeliveryReceipt({
          deliveryId: file.deliveryKey,
          presentation: `${channelKey}-${sent.presentation}`,
          providerMessageIds: providerIds(sent.result),
          artifacts: [{ artifactId: file.artifactId, outcome: 'sent' }],
        }));
        artifactsSent += 1;
        userVisible = true;
      } catch (error) {
        if (isAbort(error, signal)) throw error;
        artifactSendErrors += 1;
        const failure = typeof onFailure === 'function'
          ? await onFailure(artifact, error)
          : null;
        const reference = typeof failure?.referenceId === 'string'
          ? ` [${failure.referenceId}]`
          : '';
        logger?.warn?.(
          `[dsh-im:${channelKey}] result artifact delivery failed${reference} (${error?.code ?? 'unknown'})`,
        );
        let messageIds = [];
        if (typeof sendFailureNotice === 'function') {
          try {
            signal?.throwIfAborted();
            const notice = await sendFailureNotice(artifact, error, failure);
            signal?.throwIfAborted();
            messageIds = providerIds(notice);
            failureNoticeVisible = true;
          } catch (noticeError) {
            if (isAbort(noticeError, signal)) throw noticeError;
            logger?.warn?.(
              `[dsh-im:${channelKey}] unable to send the safe artifact failure notice`,
            );
          }
        }
        const failureReceipt = createArtifactFailureReceipt({
          artifactId: artifact?.artifactId ?? 'unknown',
          deliveryId: artifact?.deliveryKey ?? artifact?.artifactId ?? 'unknown',
          error,
          providerMessageIds: messageIds,
        });
        receipts.push(failureReceipt);
        if (failureNoticeVisible || failureReceipt.artifacts[0]?.outcome === 'unknown') {
          userVisible = true;
        }
      } finally {
        releaseOutboundArtifact(artifact);
      }
    }
  } finally {
    while (artifactIndex < artifacts.length) {
      releaseOutboundArtifact(artifacts[artifactIndex]);
      artifactIndex += 1;
    }
  }

  let receipt = null;
  if (receipts.length === 1 && !alwaysMerge) {
    [receipt] = receipts;
  } else if (receipts.length > 0) {
    receipt = mergeDeliveryReceipts({
      deliveryId: deliveryId
        ?? baseReceipt?.deliveryId
        ?? artifacts[0]?.deliveryKey,
      presentation: aggregatePresentation
        ?? `${channelKey}-${baseReceipt ? 'text-and-files' : 'files'}`,
      receipts,
    });
  }

  return {
    receipt,
    userVisible,
    failureNoticeVisible,
    artifactsSent,
    artifactSendErrors,
  };
}
