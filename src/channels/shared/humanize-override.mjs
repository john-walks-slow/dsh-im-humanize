/**
 * Per-bot humanization override section (workspaces.json `humanize`).
 *
 * A per-bot section REPLACES top-level settings keys whole: keys present in
 * the section override the resolved global defaults; keys absent inherit
 * them. Because the section replaces (not deep-merges), a per-bot
 * `sendDelay` must be COMPLETE when written through the RPC/UI — disable
 * sub-items with neutral values (multiplier: 1, charsPerSecond: 0) rather
 * than omitting keys.
 *
 * The section's field knowledge lives in humanize-schema.mjs (one table for
 * both scopes); this module is the per-bot surface: its RPC endpoint, and
 * the section-level readers/writers re-exported for that surface.
 *
 * Browser-safe module: imported by the workspace store, the host RPC
 * layer, and the client bundle.
 */
export { normalizeHumanizeOverride, validateHumanizeOverrideSection } from './humanize-schema.mjs';

/** Shared RPC endpoint: set a bot's humanization override section. */
export const SET_HUMANIZE_ENDPOINT = 'bot.humanize.set';
