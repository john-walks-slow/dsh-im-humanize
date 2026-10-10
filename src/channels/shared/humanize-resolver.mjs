/**
 * Shared humanization settings resolver for bridges.
 *
 * Bridges receive a `humanize` provider ({ getSettings() }) from their
 * runtime and resolve settings once per turn so global (humanize.json) and
 * per-bot (workspaces.json) updates apply live. Constructor-snapshot values
 * (streaming/messageBreak) remain as fallbacks for direct constructions
 * (tests, embedded use) where no provider is wired.
 *
 * Field defaults and repairs come from the schema table — the resolver only
 * decides WHICH source wins (live provider → constructor snapshot → shipped
 * default) and normalizes whatever it picked, so provider output that a
 * hand-edited section left malformed cannot leak into a turn.
 */
import { HUMANIZE_FIELDS, normalizeHumanizeField } from './humanize-schema.mjs';

export function resolveHumanizeSettings({ humanize = null, ...snapshot } = {}) {
  const provided = typeof humanize?.getSettings === 'function'
    ? humanize.getSettings()
    : null;
  const source = provided && typeof provided === 'object' ? provided : {};
  const resolved = {};
  for (const field of HUMANIZE_FIELDS) {
    const value = source[field.key] ?? snapshot[field.key] ?? field.default;
    resolved[field.key] = normalizeHumanizeField(field.key, value);
  }
  return resolved;
}
