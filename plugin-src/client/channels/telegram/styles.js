export const TELEGRAM_STYLE_ID = 'xmanrui-dsh-im-telegram-settings';

const CSS = String.raw`
.dtg-page { --ddt-accent: #229ed9; --ddt-accent-deep: #1687bd; --ddt-accent-wash: #eaf7fd; }
.dtg-avatar { color: #fff; background: #229ed9; }
.dtg-avatar svg { display: block; }
.dtg-access { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 10px; background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.dtg-accessHeading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.dtg-accessHeading strong { font-size: 13px; }
.dtg-accessHeading p { margin: 3px 0 0; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: 1.5; }
.dtg-accessBadge { flex: none; padding: 3px 8px; border-radius: 999px; color: #1687bd; background: #eaf7fd; font-size: 11px; font-weight: 700; }
.dtg-accessBadge[data-mode="private-allowlist"] { color: #a15c00; background: #fff3d6; }
.dtg-accessField { display: grid; gap: 5px; color: var(--dsw-alias-label-primary, #1f2329); font-size: 12px; font-weight: 600; }
.dtg-accessField select, .dtg-accessField textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l1, #c9cdd4); border-radius: 7px; color: inherit; background: var(--dsw-alias-bg-layer-1, #fff); font: inherit; font-weight: 400; }
.dtg-accessField select { height: 34px; padding: 0 9px; }
.dtg-accessField textarea { min-height: 68px; padding: 8px 9px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.dtg-accessField small { color: var(--dsw-alias-label-secondary, #646a73); font-weight: 400; }
.dtg-accessWarning, .dtg-accessError { margin: 0; font-size: 12px; line-height: 1.5; }
.dtg-accessWarning { color: #a15c00; }
.dtg-accessError { color: var(--dsw-alias-state-error-primary, #d83931); }
.dtg-accessActions { display: flex; justify-content: flex-end; }
`;

export function installTelegramStyles() {
  if (typeof document === 'undefined') return () => {};
  const existing = document.querySelector(`style[data-plugin-css="${TELEGRAM_STYLE_ID}"]`);
  if (existing) return () => {};
  const style = document.createElement('style');
  style.dataset.plugin = '@xmanrui/dsh-im';
  style.dataset.pluginCss = TELEGRAM_STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
  return () => style.remove();
}
