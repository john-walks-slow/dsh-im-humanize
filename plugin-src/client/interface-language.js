import { normalizeInterfaceLanguageTag } from '../../src/channels/shared/interface-language.mjs';

/** Host route serving the interface-language mirror (plugin-src/host/host-language-rpc.mjs). */
export const HOST_LANGUAGE_RPC_CHANNEL = '/dsh-im-language';
export const HOST_LANGUAGE_ENDPOINTS = Object.freeze({
  get: 'settings.language.get',
  mirror: 'settings.language.mirror',
});

/**
 * Report the locale the settings UI is actually rendered in to the Host, so
 * bot chat messages and command menus follow the DSH interface language.
 *
 * DSH stores a locale preference only when the reader picks one in the
 * Language row: a locale derived from the browser's language list leaves the
 * Host user-settings document empty. This mirror closes that gap, and the Host
 * keeps an explicit selection ranked above it (see
 * src/channels/shared/interface-language.mjs).
 *
 * @param ctx - client cordis context providing `locale` and the event bus.
 * @param options.rpcCall - management RPC caller for HOST_LANGUAGE_RPC_CHANNEL.
 * @returns an idempotent disposer that stops reporting.
 */
export function installInterfaceLanguageMirror(ctx, { rpcCall } = {}) {
  if (typeof rpcCall !== 'function' || typeof ctx?.locale?.getLocale !== 'function') {
    return () => {};
  }
  let mirrored = null;
  let disposed = false;

  const report = () => {
    if (disposed) return;
    const active = normalizeInterfaceLanguageTag(ctx.locale.getLocale()?.active);
    if (active === null || active === mirrored) return;
    mirrored = active;
    Promise.resolve(rpcCall(HOST_LANGUAGE_ENDPOINTS.mirror, { locale: active })).catch(() => {
      // Leave the tag unmirrored so the next locale change retries it. A Host
      // that cannot persist the mirror still answers in its stored language;
      // there is nothing for the reader to act on here.
      if (mirrored === active) mirrored = null;
    });
  };

  report();
  const off = typeof ctx.on === 'function' ? ctx.on('locale/change', report) : null;
  return () => {
    disposed = true;
    if (typeof off === 'function') off();
  };
}
