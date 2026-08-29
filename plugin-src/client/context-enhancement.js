import * as React from 'react';
import { createPortal } from 'react-dom';

import {
  CONTEXT_ENHANCEMENT_FIELDS,
  CONTEXT_ENHANCEMENT_GUIDANCE_MAX_LENGTH,
  CONTEXT_GUIDANCE_EXAMPLE,
  normalizeContextEnhancementConfig,
  validateContextEnhancementConfig,
} from '../../src/channels/shared/context-enhancement.mjs';
import { h, localizeText } from './i18n.js';

const FIELD_LABELS = Object.freeze({
  channel: '渠道',
  conversationType: '会话类型',
  senderId: '发送者标识',
  senderName: '发送者昵称',
  botId: '机器人标识',
});

export function contextEnhancementLabel(config) {
  const { groupEnabled, directEnabled } = normalizeContextEnhancementConfig(config);
  if (groupEnabled && directEnabled) return '群聊和私聊';
  if (groupEnabled) return '仅群聊';
  if (directEnabled) return '仅私聊';
  return '未开启';
}

function ContextIcon({ kind = 'sliders' }) {
  const path = kind === 'close' ? 'M6 6l12 12M6 18 18 6'
    : kind === 'chevron' ? 'm9 5 7 7-7 7'
      : 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-3M14 20H3M14 2v4M8 10v4M18 18v4';
  return h('svg', {
    width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', focusable: 'false',
  }, h('path', { d: path }));
}

function ContextEnhancementDialog({ config, groupSupported, disabled, onSave, onClose, returnFocusRef, id }) {
  // A mounted dialog owns its draft; status refreshes must not replace unsaved edits.
  const [draft, setDraft] = React.useState(() => ({
    ...normalizeContextEnhancementConfig(config),
    ...(!groupSupported ? { groupEnabled: false } : {}),
  }));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const savingRef = React.useRef(false);
  const dialogRef = React.useRef(null);
  const mountedRef = React.useRef(true);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const groupNoticeId = React.useId();
  const guidanceId = React.useId();
  const guidanceHelpId = React.useId();
  const fieldIdPrefix = React.useId();
  const fieldsHelpId = React.useId();
  const senderNameHelpId = React.useId();
  const guidanceExample = localizeText(CONTEXT_GUIDANCE_EXAMPLE);
  const busy = disabled || saving;

  React.useEffect(() => {
    mountedRef.current = true;
    dialogRef.current?.focus?.();
    const keepFocus = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) dialogRef.current.focus();
    };
    globalThis.document?.addEventListener?.('focusin', keepFocus);
    return () => {
      mountedRef.current = false;
      globalThis.document?.removeEventListener?.('focusin', keepFocus);
      queueMicrotask(() => returnFocusRef.current?.focus?.());
    };
  }, [returnFocusRef]);

  const change = (key, value) => {
    if (busy || savingRef.current) return;
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const cancel = () => {
    if (!savingRef.current) onClose();
  };

  const save = async () => {
    if (busy || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    dialogRef.current?.focus?.();
    try {
      const next = validateContextEnhancementConfig(draft);
      await onSave(next);
      if (mountedRef.current) onClose();
    } catch (cause) {
      if (mountedRef.current) setError(cause?.message ?? '上下文增强保存失败，请重试。');
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  const content = h('div', {
    className: 'dim-contextBackdrop',
    onMouseDown: (event) => { if (event.target === event.currentTarget) cancel(); },
  }, h('section', {
    id,
    ref: dialogRef,
    className: 'dim-contextDialog',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
    'aria-describedby': descriptionId,
    'aria-busy': saving,
    tabIndex: -1,
    onKeyDown: (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll?.(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)',
      );
      if (!controls?.length) {
        event.preventDefault();
        dialogRef.current?.focus?.();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = globalThis.document?.activeElement;
      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || active === dialogRef.current)) {
        event.preventDefault();
        first.focus();
      }
    },
  },
  h('header', { className: 'dim-contextHeader' },
    h('div', { className: 'dim-contextHeaderTitle' },
      h('h3', { id: titleId }, '上下文增强'),
      h('span', { className: 'dim-contextHelp dim-contextHeaderHelp' },
        h('button', {
          type: 'button', className: 'dim-contextHelpButton', disabled: busy,
          'aria-label': '查看上下文增强说明', 'aria-describedby': descriptionId,
        }, h('span', { 'aria-hidden': 'true' }, '?')),
        h('span', { id: descriptionId, className: 'dim-contextTooltip dim-contextHeaderTooltip', role: 'tooltip' },
          '选择在哪些会话中启用、提供哪些来源字段，以及如何使用这些信息。仅使用已有消息元数据，不查询平台 API。'))),
    h('button', {
      type: 'button', className: 'dim-contextClose', 'aria-label': '关闭弹窗',
      disabled: saving, onClick: cancel,
    }, h(ContextIcon, { kind: 'close' }))),
  h('fieldset', { className: 'dim-contextSection', disabled: busy },
    h('legend', null, '启用范围'),
    h('div', { className: 'dim-contextSwitches' },
      h('label', { className: 'dim-contextSwitchRow' },
        h('span', { className: 'dim-contextSwitchLabel' },
          h('span', null, '群聊中启用'),
          !groupSupported ? h('span', {
            id: groupNoticeId, className: 'dim-contextUnavailable',
          }, '（当前渠道不支持群聊）') : null),
        h('input', {
          type: 'checkbox', role: 'switch', className: 'dim-contextSwitch',
          checked: groupSupported && draft.groupEnabled,
          disabled: busy || !groupSupported,
          'aria-describedby': !groupSupported ? groupNoticeId : undefined,
          onChange: (event) => { if (groupSupported) change('groupEnabled', event.target.checked); },
        })),
      h('label', { className: 'dim-contextSwitchRow' },
        h('span', null, '私聊中启用'),
        h('input', {
          type: 'checkbox', role: 'switch', className: 'dim-contextSwitch',
          checked: draft.directEnabled, disabled: busy,
          onChange: (event) => change('directEnabled', event.target.checked),
        }))),
  ),
  h('fieldset', { className: 'dim-contextSection', disabled: busy },
    h('legend', { className: 'dim-contextLegend' },
      h('span', null, '来源字段'),
      h('span', { className: 'dim-contextHelp dim-contextLegendHelp' },
        h('button', {
          type: 'button', className: 'dim-contextHelpButton', disabled: busy,
          'aria-label': '查看来源字段说明', 'aria-describedby': fieldsHelpId,
        }, h('span', { 'aria-hidden': 'true' }, '?')),
        h('span', { id: fieldsHelpId, className: 'dim-contextTooltip dim-contextLegendTooltip', role: 'tooltip' },
          '增强提示词中请使用字段名（如 senderId、conversationType）引用这些信息。只发送勾选且当前消息中可用的字段，不会额外查询或补全。'))),
    h('div', { className: 'dim-contextFields' }, CONTEXT_ENHANCEMENT_FIELDS.map((field) => {
      const fieldId = `${fieldIdPrefix}-${field}`;
      return h('div', { key: field, className: 'dim-contextField' },
        h('input', {
          id: fieldId, type: 'checkbox', name: field,
          checked: draft.fields.includes(field), disabled: busy,
          onChange: (event) => change('fields', event.target.checked
            ? [...draft.fields, field] : draft.fields.filter((value) => value !== field)),
        }),
        h('span', { className: 'dim-contextFieldText' },
          h('label', { className: 'dim-contextFieldName', htmlFor: fieldId }, FIELD_LABELS[field]),
          field === 'senderName' ? h('span', { className: 'dim-contextHelp dim-contextFieldHelp' },
            h('button', {
              type: 'button', className: 'dim-contextHelpButton dim-contextFieldHelpButton', disabled: busy,
              'aria-label': '查看发送者昵称字段说明', 'aria-describedby': senderNameHelpId,
            }, h('span', { 'aria-hidden': 'true' }, '?')),
            h('span', {
              id: senderNameHelpId,
              className: 'dim-contextTooltip dim-contextFieldTooltip',
              role: 'tooltip',
            }, '该字段不是每个渠道都能提供。当前消息没有发送者昵称时，即使已选择该字段，<dsh_im_source> 中也会省略 senderName。')) : null,
          h('label', { className: 'dim-contextFieldKey', htmlFor: fieldId }, field)));
    }))),
  h('div', { className: 'dim-contextGuidance' },
    h('div', { className: 'dim-contextEditorHeader' },
      h('span', { className: 'dim-contextEditorTitle' },
        h('label', { htmlFor: guidanceId }, '增强提示词'),
        h('span', { className: 'dim-contextHelp' },
          h('button', {
            type: 'button', className: 'dim-contextHelpButton', disabled: busy,
            'aria-label': '查看增强提示词使用说明', 'aria-describedby': guidanceHelpId,
          }, h('span', { 'aria-hidden': 'true' }, '?')),
          h('span', { id: guidanceHelpId, className: 'dim-contextTooltip dim-contextGuidanceTooltip', role: 'tooltip' },
            h('strong', null, '使用说明'),
            h('span', null, '用于告诉模型如何使用 <dsh_im_source> 中已选择的来源字段。只填写正文，插件会自动添加 <dsh_im_source_guidance> 成对标签。'),
            h('strong', null, '生效规则'),
            h('span', null, '只需填写正文，插件自动添加 <dsh_im_source_guidance> 成对标签。清空并保存后，不再附加增强提示词，已选来源字段仍按开关设置发送。'),
            h('strong', null, '隐私提示'),
            h('span', null, '发送者标识可能包含平台用户 ID 或电话号码形式的标识。关闭开关不会删除已经写入会话历史的信息。'),
            h('strong', null, '使用示例'),
            h('span', { className: 'dim-contextTooltipExample' }, guidanceExample)))),
      h('div', { className: 'dim-contextTextActions' },
        h('button', { type: 'button', disabled: busy, onClick: () => change('guidance', guidanceExample) }, '填入示例'),
        h('button', { type: 'button', disabled: busy, onClick: () => change('guidance', '') }, '清空'))),
    h('textarea', {
      id: guidanceId, value: draft.guidance, placeholder: guidanceExample, rows: 4, disabled: busy,
      maxLength: CONTEXT_ENHANCEMENT_GUIDANCE_MAX_LENGTH,
      'aria-describedby': guidanceHelpId,
      onChange: (event) => change('guidance', event.target.value),
    })),
  error ? h('p', { className: 'dim-contextError', role: 'alert' }, error) : null,
  h('footer', { className: 'dim-contextFooter' },
    h('button', { type: 'button', disabled: saving, onClick: cancel }, '取消'),
    h('button', {
      type: 'button', className: 'dim-contextSave', disabled: busy,
      onClick: () => { void save(); },
    }, saving ? '保存中…' : '保存'))));

  return globalThis.document?.body ? createPortal(content, document.body) : content;
}

export function ContextEnhancementEditor({ config, groupSupported = true, disabled = false, onSave }) {
  const [open, setOpen] = React.useState(false);
  const entryRef = React.useRef(null);
  const dialogId = React.useId();
  const statusId = React.useId();
  const saved = normalizeContextEnhancementConfig(config);
  const label = contextEnhancementLabel(groupSupported ? saved : { ...saved, groupEnabled: false });

  return h(React.Fragment, null,
    h('button', {
      type: 'button', ref: entryRef, className: 'dim-contextEntry', disabled,
      'aria-label': '上下文增强', 'aria-describedby': statusId,
      'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': open ? dialogId : undefined,
      onClick: () => setOpen(true),
    }, h(ContextIcon),
    h('span', { className: 'dim-contextLabel' }, '上下文增强'),
    h('span', { id: statusId, className: 'dim-contextStatus', 'data-active': label !== '未开启', 'aria-live': 'polite' }, label),
    h(ContextIcon, { kind: 'chevron' })),
    open ? h(ContextEnhancementDialog, {
      id: dialogId, config, groupSupported, disabled, onSave,
      onClose: () => setOpen(false), returnFocusRef: entryRef,
    }) : null);
}
