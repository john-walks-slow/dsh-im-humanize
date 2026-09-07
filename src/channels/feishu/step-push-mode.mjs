export const FEISHU_STEP_PUSH_MODES = Object.freeze({
  POST: 'post',
  STREAMING_CARD: 'streaming_card',
});

/** Unknown or missing values fall back to the default `post` message stream. */
export function normalizeFeishuStepPushMode(value) {
  return value === FEISHU_STEP_PUSH_MODES.STREAMING_CARD
    ? FEISHU_STEP_PUSH_MODES.STREAMING_CARD
    : FEISHU_STEP_PUSH_MODES.POST;
}

export function isFeishuStepPushMode(value) {
  return value === FEISHU_STEP_PUSH_MODES.POST
    || value === FEISHU_STEP_PUSH_MODES.STREAMING_CARD;
}
