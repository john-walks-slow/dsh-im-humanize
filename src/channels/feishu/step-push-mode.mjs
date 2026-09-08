export const FEISHU_STEP_PUSH_MODES = Object.freeze({
  POST: 'post',
  STREAMING_CARD: 'streaming_card',
});

/** New connections explicitly opt into the process-card presentation. */
export const DEFAULT_FEISHU_STEP_PUSH_MODE = FEISHU_STEP_PUSH_MODES.STREAMING_CARD;

export function normalizeFeishuStepPushMode(value) {
  // Bots created before modes existed used posts when step push was enabled.
  return value === FEISHU_STEP_PUSH_MODES.STREAMING_CARD
    ? FEISHU_STEP_PUSH_MODES.STREAMING_CARD
    : FEISHU_STEP_PUSH_MODES.POST;
}

export function isFeishuStepPushMode(value) {
  return value === FEISHU_STEP_PUSH_MODES.POST
    || value === FEISHU_STEP_PUSH_MODES.STREAMING_CARD;
}
