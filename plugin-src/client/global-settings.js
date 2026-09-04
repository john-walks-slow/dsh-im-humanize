import * as React from 'react';

import {
  DEFAULT_INBOUND_TTL_HOURS,
  INBOUND_TTL_MAX_HOURS,
  normalizeInboundTtlHours,
} from '../../src/channels/shared/inbound-ttl.mjs';
import { h } from './i18n.js';

export const GLOBAL_SETTINGS_RPC_CHANNEL = '/dsh-im-settings';

export const GLOBAL_SETTINGS_TAB_ID = 'global-settings';

const ATTACHMENTS_TAB_ID = 'dim-general-settings-tab-attachments';
const ATTACHMENTS_PANEL_ID = 'dim-general-settings-panel-attachments';

export const GLOBAL_SETTINGS_ENDPOINTS = Object.freeze({
  getTtl: 'settings.inbound-ttl.get',
  setTtl: 'settings.inbound-ttl.set',
  sweep: 'settings.inbound-ttl.sweep',
});

function presentError(error, fallback) {
  return error?.message || fallback;
}

function unwrapRpcResult(result) {
  if (result?.ok === true) return result.value;
  if (result?.ok === false) {
    const error = new Error(result.error?.message || '请求失败，请稍后重试。');
    error.code = result.error?.code;
    throw error;
  }
  return result;
}

export function GlobalSettingsLogoGlyph({ size } = {}) {
  return h('svg', {
    ...(size === undefined ? {} : { width: size, height: size }),
    viewBox: '0 0 24 24',
    focusable: 'false',
    'aria-hidden': 'true',
    'data-im-icon': 'global-settings',
  }, h('path', {
    fill: 'currentColor',
    d: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58ZM12 15.6A3.61 3.61 0 0 1 8.4 12c0-1.98 1.62-3.6 3.6-3.6s3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6Z',
  }));
}

function GlobalButton({ children, kind = 'secondary', className = '', ...props }) {
  return h('button', {
    ...props,
    type: props.type ?? 'button',
    className: `dim-deliveryButton ${className}`.trim(),
    'data-kind': kind,
  }, children);
}

export function GlobalSettingsPanel({ rpcCall }) {
  const [phase, setPhase] = React.useState('loading');
  const [loadError, setLoadError] = React.useState(null);
  const [ttlInput, setTtlInput] = React.useState('');
  const [savedTtl, setSavedTtl] = React.useState(null);
  const [ttlError, setTtlError] = React.useState(false);
  const [saveError, setSaveError] = React.useState(null);
  const [saveSucceeded, setSaveSucceeded] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [sweepConfirming, setSweepConfirming] = React.useState(false);
  const [sweeping, setSweeping] = React.useState(false);
  const ttlErrorId = React.useId();
  const ttlHintsId = React.useId();
  const sweepTriggerId = React.useId();
  const sweepConfirmId = React.useId();
  const sweepConfirmTextId = React.useId();
  const sweepConfirmButtonId = React.useId();
  const mounted = React.useRef(true);
  const saving = React.useRef(false);

  const invoke = React.useCallback(async (endpoint, payload = {}, signal) => {
    if (typeof rpcCall !== 'function') throw new Error('通用设置暂不可用。');
    return unwrapRpcResult(await rpcCall(endpoint, payload, signal));
  }, [rpcCall]);

  const loadSettings = React.useCallback(async ({ signal } = {}) => {
    setPhase('loading');
    setLoadError(null);
    try {
      const value = await invoke(GLOBAL_SETTINGS_ENDPOINTS.getTtl, {}, signal);
      if (signal?.aborted || !mounted.current) return;
      const ttlHours = normalizeInboundTtlHours(value?.ttlHours);
      if (ttlHours === null) {
        setLoadError('通用设置返回了无法识别的响应。');
        setPhase('error');
        return;
      }
      setSavedTtl(ttlHours);
      setTtlInput(String(ttlHours));
      setTtlError(false);
      setSaveError(null);
      setSaveSucceeded(false);
      setPhase('ready');
    } catch (caught) {
      if (signal?.aborted || caught?.name === 'AbortError' || !mounted.current) return;
      setLoadError(presentError(caught, '无法读取通用设置，请稍后重试。'));
      setPhase('error');
    }
  }, [invoke]);

  React.useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void loadSettings({ signal: controller.signal });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [loadSettings]);

  React.useEffect(() => {
    if (!sweepConfirming) return;
    globalThis.document?.getElementById(sweepConfirmButtonId)?.focus();
  }, [sweepConfirmButtonId, sweepConfirming]);

  const commitTtl = async () => {
    if (phase === 'loading' || saving.current) return;
    const proposed = normalizeInboundTtlHours(ttlInput.trim());
    if (proposed === null) {
      setSaveError(null);
      setSaveSucceeded(false);
      setTtlError(true);
      return;
    }
    setTtlError(false);
    if (proposed === savedTtl) return;
    saving.current = true;
    setIsSaving(true);
    setSaveError(null);
    setSaveSucceeded(false);
    try {
      const value = await invoke(GLOBAL_SETTINGS_ENDPOINTS.setTtl, { ttlHours: proposed });
      if (!mounted.current) return;
      const confirmed = normalizeInboundTtlHours(value?.ttlHours);
      const finalTtl = confirmed === null ? proposed : confirmed;
      setSavedTtl(finalTtl);
      // Never clobber the field if the user kept typing while the save was in flight.
      setTtlInput((current) => current.trim() === String(proposed) ? String(finalTtl) : current);
      setLoadError(null);
      setSaveSucceeded(true);
      setPhase('ready');
    } catch (caught) {
      if (mounted.current) {
        setSaveError(presentError(caught, '设置保存失败，请稍后重试。'));
      }
    } finally {
      saving.current = false;
      if (mounted.current) setIsSaving(false);
    }
  };

  const requestSweep = () => {
    if (sweeping) return;
    setSweepConfirming(true);
  };

  const cancelSweep = ({ restoreFocus = false } = {}) => {
    setSweepConfirming(false);
    if (restoreFocus) globalThis.document?.getElementById(sweepTriggerId)?.focus();
  };

  const runSweep = async () => {
    setSweepConfirming(false);
    setSweeping(true);
    try {
      // Manual sweeps are silent by design: the busy label on the button is
      // the only feedback, and RPC results or failures are not announced.
      await invoke(GLOBAL_SETTINGS_ENDPOINTS.sweep, {});
    } catch {
      // Intentionally swallowed — no result feedback for manual sweeps.
    } finally {
      if (mounted.current) setSweeping(false);
    }
  };

  const inlineStatus = phase === 'loading'
    ? { role: 'status', message: '正在读取通用设置…' }
    : ttlError
      ? { role: 'alert', message: `请输入 -1、0 或 1~${INBOUND_TTL_MAX_HOURS} 之间的整数。` }
      : saveError
        ? { role: 'alert', message: saveError }
        : phase === 'error' && loadError
          ? { role: 'alert', message: loadError }
          : saveSucceeded
            ? { role: 'status', message: '已保存' }
            : null;

  const proposedTtl = normalizeInboundTtlHours(ttlInput.trim());
  const canSave = phase !== 'loading'
    && !isSaving
    && proposedTtl !== null
    && proposedTtl !== savedTtl;

  return h('section', { className: 'dim-generalSettingsPage', 'aria-label': '通用设置' },
    h('header', { className: 'dim-generalSettingsHeader' },
      h('h2', null, '通用设置')),
    h('div', { className: 'dim-generalSettingsTabsBar' },
      h('div', {
        className: 'dim-generalSettingsTabs',
        role: 'tablist',
        'aria-label': '通用设置分类',
      },
      h('button', {
        type: 'button',
        id: ATTACHMENTS_TAB_ID,
        className: 'dim-generalSettingsTab',
        role: 'tab',
        'aria-selected': true,
        'aria-controls': ATTACHMENTS_PANEL_ID,
      }, '附件'))),
    h('div', {
      id: ATTACHMENTS_PANEL_ID,
      className: 'dim-generalSettingsTabPanel',
      role: 'tabpanel',
      'aria-labelledby': ATTACHMENTS_TAB_ID,
    },
    h('section', {
      className: 'dim-globalSection',
      'aria-label': '附件',
      'aria-busy': phase === 'loading',
    },
    h('div', { className: 'dim-globalHead' },
      h('div', { className: 'dim-globalHeadTitle' },
        h('h3', { id: 'dim-globalTtlTitle' }, '附件保留时长 (小时)'),
        h('div', { className: 'dim-globalTtlHelp' },
          h('button', {
            type: 'button',
            className: 'dim-channelHelpButton dim-globalTtlHelpButton',
            'aria-label': '查看附件保留时长说明',
            'aria-describedby': ttlHintsId,
          }, h('span', { 'aria-hidden': 'true' }, '?')),
          h('div', {
            id: ttlHintsId,
            className: 'dim-globalTtlTooltip',
            role: 'tooltip',
          },
          h('ul', { className: 'dim-globalTtlHints' },
            h('li', null,
              h('code', null, '-1'),
              h('span', null, '永久保留，不会自动清理')),
            h('li', null,
              h('code', null, '0'),
              h('span', null, '每 Turn 结束后立即清理')),
            h('li', null,
              h('code', null, `1~${INBOUND_TTL_MAX_HOURS}`),
              h('span', null, '小时后自动清理'))))))),
    h('form', {
      className: 'dim-globalTtlRow',
      onSubmit: (event) => {
        event.preventDefault();
        void commitTtl();
      },
    },
      h('input', {
        id: 'dim-globalTtlInput',
        className: 'dim-globalTtlInput',
        type: 'text',
        value: ttlInput,
        placeholder: String(DEFAULT_INBOUND_TTL_HOURS),
        autoComplete: 'off',
        disabled: phase === 'loading' || isSaving,
        'aria-labelledby': 'dim-globalTtlTitle',
        'aria-invalid': ttlError ? 'true' : undefined,
        'aria-describedby': ttlError ? ttlErrorId : ttlHintsId,
        onBlur: () => {
          setTtlError(normalizeInboundTtlHours(ttlInput.trim()) === null);
        },
        onKeyDown: (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          void commitTtl();
        },
        onChange: (event) => {
          setTtlInput(event.target.value);
          setTtlError(false);
          setSaveError(null);
          setSaveSucceeded(false);
        },
      }),
      h(GlobalButton, {
        type: 'submit',
        kind: 'primary',
        className: 'dim-globalSaveButton',
        disabled: !canSave,
      }, isSaving ? '保存中…' : '保存'),
      h('div', {
        className: 'dim-globalSweepAction',
        onBlur: (event) => {
          if (sweepConfirming && !event.currentTarget.contains(event.relatedTarget)) cancelSweep();
        },
      },
      h(GlobalButton, {
        id: sweepTriggerId,
        className: 'dim-globalSweepButton',
        onClick: () => (sweepConfirming ? cancelSweep() : requestSweep()),
        disabled: sweeping,
        'aria-haspopup': 'dialog',
        'aria-expanded': sweepConfirming,
        'aria-controls': sweepConfirmId,
      }, sweeping ? '正在清理…' : '清理过期附件'),
      sweepConfirming
        ? h('div', {
          id: sweepConfirmId,
          className: 'dim-globalSweepConfirm',
          role: 'alertdialog',
          'aria-label': '确认清理过期附件',
          'aria-describedby': sweepConfirmTextId,
          onKeyDown: (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            cancelSweep({ restoreFocus: true });
          },
        },
        h('p', { id: sweepConfirmTextId }, '确认清理当前已过期的附件？'),
        h('div', { className: 'dim-globalSweepConfirmActions' },
          h(GlobalButton, { onClick: () => cancelSweep({ restoreFocus: true }) }, '取消'),
          h(GlobalButton, {
            id: sweepConfirmButtonId,
            kind: 'danger',
            className: 'dim-globalSweepConfirmButton',
            onClick: () => void runSweep(),
          }, '确认清理')))
        : null),
      inlineStatus
        ? h('p', {
          id: ttlErrorId,
          className: 'dim-globalInline',
          'data-tone': inlineStatus.role === 'alert' ? 'error' : undefined,
          role: inlineStatus.role,
          'aria-live': inlineStatus.role === 'status' ? 'polite' : undefined,
        }, inlineStatus.message)
        : null))));
}
