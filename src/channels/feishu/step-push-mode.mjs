export const FEISHU_STEP_PUSH_MODES = Object.freeze({
  POST: 'post',
  STREAMING_CARD: 'streaming_card',
});

/** The presentation a newly connected bot starts with, and the fallback for
 *  unknown or missing stored values. The process card keeps the chat clean
 *  while still surfacing the execution, so it is the default presentation. */
export const DEFAULT_FEISHU_STEP_PUSH_MODE = FEISHU_STEP_PUSH_MODES.STREAMING_CARD;

export function normalizeFeishuStepPushMode(value) {
  return value === FEISHU_STEP_PUSH_MODES.POST
    ? FEISHU_STEP_PUSH_MODES.POST
    : DEFAULT_FEISHU_STEP_PUSH_MODE;
}

export function isFeishuStepPushMode(value) {
  return value === FEISHU_STEP_PUSH_MODES.POST
    || value === FEISHU_STEP_PUSH_MODES.STREAMING_CARD;
}
