import * as React from 'react';

import { h } from './i18n.js';

function looksLikeAbsolutePath(value) {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value);
}

export function WorkspaceEditor({ workspace, disabled = false, onSave }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(workspace ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const inputRef = React.useRef(null);
  const editButtonRef = React.useRef(null);
  const restoreFocus = React.useRef(false);

  React.useEffect(() => {
    if (!editing) setDraft(workspace ?? '');
  }, [workspace, editing]);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  const cancel = () => {
    setDraft(workspace ?? '');
    setError(null);
    restoreFocus.current = true;
    setEditing(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value || saving || disabled) return;
    if (!looksLikeAbsolutePath(value)) {
      setError('工作区必须是绝对路径。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave?.(value);
      restoreFocus.current = true;
      setEditing(false);
    } catch (cause) {
      setError(cause?.message ?? '工作区修改失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  return h('div', { className: 'dim-workspace' },
    h('div', { className: 'dim-workspaceHeader' },
      h('span', null, '当前工作区'),
      editing ? null : h('button', {
        type: 'button',
        ref: editButtonRef,
        className: 'dim-workspaceEdit',
        onClick: () => { setEditing(true); setError(null); },
        disabled,
      }, '修改')),
    editing
      ? h('form', { className: 'dim-workspaceForm', onSubmit: submit },
          h('input', {
            ref: inputRef,
            value: draft,
            onChange: (event) => setDraft(event.target.value),
            placeholder: '/绝对路径/到/工作区',
            'aria-label': '工作区绝对路径',
            autoCapitalize: 'none',
            autoCorrect: 'off',
            spellCheck: false,
            maxLength: 4_096,
            required: true,
            disabled: saving || disabled,
          }),
          h('div', { className: 'dim-workspaceActions' },
            h('button', {
              type: 'submit', disabled: saving || disabled || !draft.trim(),
            }, saving ? '保存中…' : '保存'),
            h('button', { type: 'button', onClick: cancel, disabled: saving || disabled }, '取消')),
          error ? h('p', { className: 'dim-workspaceError', role: 'alert' }, error) : null)
      : workspace
        ? React.createElement('code', {
            className: 'dim-workspacePath',
            title: workspace,
          }, workspace)
        : h('code', { className: 'dim-workspacePath' }, '未设置'),
  );
}
