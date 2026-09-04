import * as React from 'react';

import {
  EMPTY_MODEL_CATALOG,
  modelSelectionId,
  normalizeModelCatalog,
  normalizeModelSelection,
} from '../../src/channels/shared/model-setting.mjs';
import { h } from './i18n.js';

export const SET_MODEL_ENDPOINT = 'bot.model.set';
export { EMPTY_MODEL_CATALOG, normalizeModelCatalog, normalizeModelSelection };

export const ModelCatalogContext = React.createContext(EMPTY_MODEL_CATALOG);

function optionValue(selection) {
  return JSON.stringify([selection.provider, selection.model]);
}

export function ModelEditor({ model = null, disabled = false, onSave }) {
  const catalog = normalizeModelCatalog(
    React.useContext(ModelCatalogContext) ?? EMPTY_MODEL_CATALOG,
  );
  const helpId = React.useId();
  const current = normalizeModelSelection(model);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const currentValue = current ? optionValue(current) : '';
  const currentAvailable = !current || catalog.groups.some(
    (group) => group.id === current.provider
      && group.models.some((entry) => entry.id === current.model),
  );

  const selections = new Map();
  for (const group of catalog.groups) {
    for (const entry of group.models) {
      const selection = { provider: group.id, model: entry.id };
      selections.set(optionValue(selection), selection);
    }
  }
  if (current && !currentAvailable) selections.set(currentValue, current);

  const change = async (event) => {
    const nextValue = event.target.value;
    if (nextValue === currentValue || saving || disabled) return;
    const next = nextValue ? selections.get(nextValue) : null;
    if (nextValue && !next) return;
    setSaving(true);
    setError(null);
    try {
      await onSave?.(next);
    } catch (cause) {
      setError(cause?.message ?? '模型修改失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  return h('div', { className: 'dim-preset dim-modelSetting' },
    h('div', { className: 'dim-presetHeader' },
      h('span', { className: 'dim-presetTitle' },
        h('span', null, '模型'),
        h('span', { className: 'dim-presetHelp' },
          h('button', {
            type: 'button',
            className: 'dim-presetHelpButton',
            'aria-label': '查看模型设置说明',
            'aria-describedby': helpId,
          }, h('span', { 'aria-hidden': 'true' }, '?')),
          h('span', {
            id: helpId,
            className: 'dim-presetTooltip',
            role: 'tooltip',
          }, '只影响新建会话；若当前聊天已有会话，先发送 /new，再发送普通消息生效。'))),
      saving ? h('span', { className: 'dim-presetStatus' }, '保存中…') : null),
    h('select', {
      className: 'dim-presetSelect dim-modelSelect',
      value: currentValue,
      disabled: disabled || saving,
      'aria-label': '模型',
      onChange: (event) => { void change(event); },
    },
      h('option', { value: '' }, '跟随默认模型'),
      ...catalog.groups.map((group) => h(
        'optgroup',
        { key: group.id, label: group.name },
        ...group.models.map((entry) => {
          const selection = { provider: group.id, model: entry.id };
          const id = modelSelectionId(selection);
          return h('option', { key: id, value: optionValue(selection) },
            entry.name && entry.name !== entry.id ? `${entry.name}（${id}）` : id);
        }),
      )),
      current && !currentAvailable
        ? h('option', { value: currentValue }, [modelSelectionId(current), '（已不可用）'])
        : null,
    ),
    error || !currentAvailable ? h(
      'p',
      { className: 'dim-presetError', role: error ? 'alert' : 'status' },
      error ?? '当前模型已不可用，请选择其他模型或跟随默认模型。',
    ) : null,
  );
}
