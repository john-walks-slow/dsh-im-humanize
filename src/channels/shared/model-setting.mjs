const MAX_PROVIDER_ID_LENGTH = 256;
const MAX_MODEL_ID_LENGTH = 1_024;
const MAX_LABEL_LENGTH = 256;
const UNSAFE_DISPLAY_TEXT = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu;
const UNSAFE_ID_TEXT = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

function cleanId(value, maxLength) {
  if (typeof value !== 'string') return '';
  const id = value.trim();
  if (!id || id.length > maxLength || UNSAFE_ID_TEXT.test(id)) return '';
  return id;
}

function cleanLabel(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const label = value.replace(UNSAFE_DISPLAY_TEXT, ' ').replace(/\s+/gu, ' ').trim();
  return label ? label.slice(0, MAX_LABEL_LENGTH) : fallback;
}

export const EMPTY_MODEL_CATALOG = Object.freeze({
  groups: Object.freeze([]),
  failures: Object.freeze([]),
});

export function normalizeModelSelection(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const provider = cleanId(value.provider, MAX_PROVIDER_ID_LENGTH);
  const model = cleanId(value.model, MAX_MODEL_ID_LENGTH);
  return provider && model ? { provider, model } : null;
}

export function validateModelSelection(value) {
  if (value == null || value === '') return null;
  const selection = normalizeModelSelection(value);
  if (!selection) {
    const error = new Error('模型无效。');
    error.code = 'model-selection-invalid';
    throw error;
  }
  return selection;
}

export function sameModelSelection(left, right) {
  return left?.provider === right?.provider && left?.model === right?.model;
}

export function modelSelectionId(value) {
  const selection = normalizeModelSelection(value);
  return selection ? `${selection.provider}/${selection.model}` : '';
}

export function normalizeModelCatalog(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { groups: [], failures: [] };
  }
  const groups = [];
  const seen = new Set();
  for (const candidate of Array.isArray(value.groups) ? value.groups : []) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const provider = cleanId(candidate.id, MAX_PROVIDER_ID_LENGTH);
    if (!provider) continue;
    const models = [];
    for (const entry of Array.isArray(candidate.models) ? candidate.models : []) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const model = cleanId(entry.id, MAX_MODEL_ID_LENGTH);
      if (!model) continue;
      const key = `${provider}\u0000${model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      models.push({
        id: model,
        name: cleanLabel(entry.name, model),
      });
    }
    if (models.length > 0) {
      groups.push({
        id: provider,
        name: cleanLabel(candidate.name, provider),
        models,
      });
    }
  }
  const failures = [];
  for (const candidate of Array.isArray(value.failures) ? value.failures : []) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const id = cleanId(candidate.id, MAX_PROVIDER_ID_LENGTH);
    if (!id) continue;
    failures.push({ id, name: cleanLabel(candidate.name, id) });
  }
  return { groups, failures };
}

export function modelCatalogHas(catalog, selection) {
  const normalized = normalizeModelSelection(selection);
  if (!normalized) return false;
  return normalizeModelCatalog(catalog).groups.some(
    (group) => group.id === normalized.provider
      && group.models.some((model) => model.id === normalized.model),
  );
}

export async function listModelCatalog(harness, options = {}) {
  try {
    if (typeof harness?.listModels !== 'function') return normalizeModelCatalog(null);
    return normalizeModelCatalog(await harness.listModels(options));
  } catch {
    return normalizeModelCatalog(null);
  }
}
