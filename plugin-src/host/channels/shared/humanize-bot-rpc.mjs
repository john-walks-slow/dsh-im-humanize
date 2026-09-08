import {
  SET_HUMANIZE_ENDPOINT,
  validateHumanizeOverrideSection,
} from '../../../../src/channels/shared/humanize-override.mjs';

export { SET_HUMANIZE_ENDPOINT };

export function validHumanizeSectionPayload(payload) {
  try {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || Reflect.ownKeys(payload).length !== 2
      || !Object.hasOwn(payload, 'botId') || !Object.hasOwn(payload, 'humanize')
      || typeof payload.botId !== 'string'
      || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.botId)) return false;
    validateHumanizeOverrideSection(payload.humanize);
    return true;
  } catch {
    return false;
  }
}
