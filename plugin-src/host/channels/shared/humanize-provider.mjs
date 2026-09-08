import { mergeHumanizeSettings } from '../../../../src/channels/shared/send-delay.mjs';
import { normalizeHumanizeSettings } from '../../../../src/channels/shared/humanize-settings.mjs';

/**
 * Per-bot humanization settings provider.
 *
 * Bridges call `getSettings()` on every turn so global and per-bot
 * changes apply live without a plugin restart:
 *
 * - `defaults` — a settings object or a per-channel accessor. The host
 *   installs `config.humanizeDefaults(channelName)`, which already
 *   applies channel sub-object and explicit dsh-config priority over the
 *   live humanize.json store.
 * - `workspaces` — BotWorkspaceStore. A per-bot `humanize` section, when
 *   present, REPLACES the resolved defaults whole (top-level key
 *   replacement — see mergeHumanizeSettings); disable sub-items with
 *   neutral values (multiplier: 1, charsPerSecond: 0) instead of
 *   omitting keys.
 * - `botId` — identifies the per-bot section.
 *
 * Returns `{ botId, getSettings }`; `getSettings()` always returns a
 * fully normalized settings object (lenient repair of hand-edited
 * workspace sections included).
 */
export function createHumanizeProvider({ defaults = null, workspaces = null, botId = null } = {}) {
  const readDefaults = () => (typeof defaults === 'function' ? defaults() : defaults);
  return {
    botId,
    getSettings: () => {
      const global = readDefaults() ?? {};
      const perBot = workspaces && botId && typeof workspaces.humanizeFor === 'function'
        ? (workspaces.humanizeFor(botId) ?? null)
        : null;
      return normalizeHumanizeSettings(mergeHumanizeSettings(global, perBot));
    },
  };
}
