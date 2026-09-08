import { TextHarnessBridge, createTextBridgeStatus } from '../shared/text-harness-bridge.mjs';

export const TELEGRAM_DESCRIPTOR = Object.freeze({
  key: 'telegram',
  label: 'Telegram',
  connectionLabel: ' Bot API 长轮询',
  typing: Object.freeze({ refreshMs: 4000, darkResidualMs: 5000 }),
  minSegmentGapMs: 1000,
    reactions: Object.freeze({ processing: '👀', success: '👍', error: '👎' }),
});

export class TelegramHarnessBridge extends TextHarnessBridge {
  constructor(options) {
    super({ descriptor: TELEGRAM_DESCRIPTOR, ...options });
  }
}

export { createTextBridgeStatus as createTelegramBridgeStatus };
