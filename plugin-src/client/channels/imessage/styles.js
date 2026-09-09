export const IMESSAGE_STYLE_ID = 'xmanrui-dsh-im-imessage-settings';
const CSS = String.raw`
.dim-pageIMessage { --ddt-accent: #32a852; --ddt-accent-deep: #248a40; --ddt-accent-wash: #edf9f0; }
.dim-avatarIMessage { color: #fff; background: #32a852; }
.dim-avatarIMessage svg { display: block; }
.dim-imessagePermissionPanel { padding: 20px; }
.dim-imessagePermissionPanel p { color: var(--dsw-alias-label-secondary, #646a73); }
.dim-imessagePermissionSteps { margin: 16px 0; padding-left: 22px; }
.dim-imessagePermissionSteps li { margin: 12px 0; }
.dim-imessagePermissionSteps a { color: var(--ddt-accent-deep); }
`;
export function installIMessageStyles() {
  if (typeof document === 'undefined') return () => {};
  const existing = document.querySelector(`style[data-plugin-css="${IMESSAGE_STYLE_ID}"]`);
  if (existing) return () => {};
  const style = document.createElement('style'); style.dataset.plugin = '@xmanrui/dsh-im';
  style.dataset.pluginCss = IMESSAGE_STYLE_ID; style.textContent = CSS; document.head.appendChild(style);
  return () => style.remove();
}
