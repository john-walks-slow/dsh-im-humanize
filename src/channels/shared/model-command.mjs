import { splitWorkspaceCommandMessage } from './workspace-command.mjs';
import { t } from './i18n.mjs';
import { WORKSPACE_SESSION_STALE } from './workspace-session.mjs';
import { withSessionBindingLock } from './session-binding-lock.mjs';

const MODEL_COMMAND = /^\/model(?=$|\s)/i;
const MODELS_COMMAND = /^\/models(?=$|\s)/i;
const MODEL_USAGE = '用法：/model <序号> 或 /model <provider>/<model>';
const MODELS_USAGE = '用法：/models（不带参数）';
const SESSION_BINDING_CHANGED = 'session-binding-changed';
const MODEL_SELECTION_MISMATCH = 'model-selection-mismatch';
const UNSAFE_DISPLAY_TEXT_GLOBAL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu;

function commandResult(message) {
  return {
    handled: true,
    message,
    messages: splitWorkspaceCommandMessage(message),
  };
}

function safeDisplayText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(UNSAFE_DISPLAY_TEXT_GLOBAL, ' ').replace(/\s+/gu, ' ').trim();
}

function rpcOptions(signal) {
  return signal ? { signal } : {};
}

function normalizeCatalog(value, { requireCurrent = false } = {}) {
  if (!value || typeof value !== 'object'
    || !Array.isArray(value.groups) || !Array.isArray(value.failures)) {
    throw new TypeError('Harness returned an invalid model catalog');
  }
  const groups = value.groups.map((group) => {
    if (!group || typeof group !== 'object'
      || typeof group.id !== 'string' || !group.id
      || typeof group.name !== 'string' || !group.name
      || !Array.isArray(group.models)) {
      throw new TypeError('Harness returned an invalid model provider group');
    }
    return {
      id: group.id,
      name: group.name,
      models: group.models.map((model) => {
        if (!model || typeof model !== 'object'
          || typeof model.id !== 'string' || !model.id
          || typeof model.name !== 'string' || !model.name) {
          throw new TypeError('Harness returned an invalid model');
        }
        return { id: model.id, name: model.name };
      }),
    };
  });
  const failures = value.failures.map((failure) => {
    if (!failure || typeof failure !== 'object'
      || typeof failure.id !== 'string' || !failure.id
      || typeof failure.name !== 'string' || !failure.name) {
      throw new TypeError('Harness returned an invalid model provider failure');
    }
    return { id: failure.id, name: failure.name };
  });
  let current = null;
  if (value.current !== undefined) {
    if (!value.current || typeof value.current !== 'object'
      || typeof value.current.provider !== 'string' || !value.current.provider
      || typeof value.current.model !== 'string' || !value.current.model) {
      throw new TypeError('Harness returned an invalid current model');
    }
    current = { provider: value.current.provider, model: value.current.model };
  } else if (requireCurrent) {
    throw new TypeError('Harness returned no current model');
  }
  return { groups, failures, current };
}

function modelId(provider, model) {
  return `${provider}/${model}`;
}

function sameModel(left, right) {
  return left?.provider === right?.provider && left?.model === right?.model;
}

function selectionMismatch(expected, actual, source) {
  const error = new Error(`Harness ${source} did not confirm the selected model`);
  error.code = MODEL_SELECTION_MISMATCH;
  error.expected = expected;
  error.actual = actual;
  error.source = source;
  return error;
}

function sessionBindingChanged() {
  const error = new Error('Conversation binding changed during model selection');
  error.code = SESSION_BINDING_CHANGED;
  return error;
}

function assertSessionBinding(state, key, expectedSessionId) {
  const currentSessionId = typeof state?.sessionFor === 'function'
    ? state.sessionFor(key)
    : null;
  if (currentSessionId !== expectedSessionId) throw sessionBindingChanged();
}

function matchingModel(catalog, requested) {
  for (const group of catalog.groups) {
    for (const model of group.models) {
      if (modelId(group.id, model.id) === requested) {
        return { provider: group.id, model: model.id };
      }
    }
  }
  return null;
}

function modelAt(catalog, requestedIndex) {
  let index = 0;
  for (const group of catalog.groups) {
    for (const model of group.models) {
      index += 1;
      if (index === requestedIndex) {
        return { provider: group.id, model: model.id };
      }
    }
  }
  return null;
}

function modelNumberRequest(requested) {
  if (!/^\d+$/u.test(requested)) return null;
  const index = Number(requested);
  return { index: Number.isSafeInteger(index) && index > 0 ? index : null };
}

function invalidModelNumberMessage(requested) {
  return [
    t('模型序号无效：{input}', { input: safeDisplayText(requested) }),
    '',
    t('请发送 /models 查看并输入有效的正整数序号。'),
  ].join('\n');
}

function formatCatalog(catalog) {
  const currentId = catalog.current
    ? modelId(catalog.current.provider, catalog.current.model)
    : null;
  const lines = [t('可用模型：')];
  let index = 0;
  if (catalog.groups.length === 0) lines.push('', t('当前没有可用模型。'));
  for (const group of catalog.groups) {
    lines.push('', safeDisplayText(group.name) || safeDisplayText(group.id));
    for (const model of group.models) {
      index += 1;
      const id = modelId(group.id, model.id);
      lines.push(`${index}. ${safeDisplayText(id)}${id === currentId ? t('（当前）') : ''}`);
    }
  }
  if (catalog.failures.length > 0) {
    lines.push('', t('以下模型提供方暂时不可用：'));
    for (const failure of catalog.failures) {
      lines.push(`- ${safeDisplayText(failure.name) || safeDisplayText(failure.id)}`);
    }
  }
  if (index > 0) lines.push('', t('切换模型：/model <序号>'));
  return lines.join('\n');
}

function currentModelMessage(current) {
  return [
    t('当前模型：'),
    modelId(current.provider, current.model),
    '',
    t('查看全部模型：/models'),
    t('切换模型：/model <序号>'),
  ].join('\n');
}

function noSessionMessage() {
  return [
    t('当前聊天还没有会话。'),
    '',
    t('查看模型：/models'),
    t('选择模型：/model <序号>'),
  ].join('\n');
}

function errorCode(error) {
  return error?.code ?? error?.failure?.code;
}

function modelErrorMessage(error, action) {
  const code = errorCode(error);
  if (code === 'agent-busy') {
    return t('当前任务正在运行，请等待完成或先发送 /stop。');
  }
  if (code === 'session-not-found') {
    return t('当前聊天绑定的会话已不存在，请重试。');
  }
  if (code === 'model-unavailable') {
    return t('无法切换到该模型。模型当前不可用，或不支持当前会话中的图片。');
  }
  if (code === WORKSPACE_SESSION_STALE || code === 'workspace-bot-not-found') {
    return t('工作区或机器人状态已发生变化，请重试。');
  }
  if (code === SESSION_BINDING_CHANGED) {
    return t('当前聊天绑定的会话已发生变化，请重试。');
  }
  if (code === MODEL_SELECTION_MISMATCH) {
    const expected = error?.expected;
    const actual = error?.actual;
    const lines = [t('模型切换失败，请稍后重试。')];
    if (expected?.provider && expected?.model) {
      lines.push('', `requested: ${safeDisplayText(modelId(expected.provider, expected.model))}`);
    }
    if (actual?.provider && actual?.model) {
      const label = error?.source === 'models.current'
        ? t('当前模型：')
        : 'selectModel.selected:';
      lines.push(`${label} ${safeDisplayText(modelId(actual.provider, actual.model))}`);
    } else {
      lines.push(`${error?.source ?? 'Harness'}: unconfirmed`);
    }
    return lines.join('\n');
  }
  if (code === 'cancelled' || error?.name === 'AbortError') {
    return action === 'list' ? t('获取模型列表已取消。') : t('模型切换已取消。');
  }
  return action === 'list'
    ? t('暂时无法获取模型列表，请稍后重试。')
    : t('模型切换失败，请稍后重试。');
}

async function boundSession(harness, state, key, options) {
  if (typeof state?.sessionFor !== 'function') return null;
  const sessionId = state.sessionFor(key);
  if (typeof sessionId !== 'string' || !sessionId) return null;
  if (typeof harness?.workspaceSession !== 'function') {
    throw new TypeError('Harness does not support workspace sessions');
  }
  const session = harness.workspaceSession(sessionId);
  if (!session || typeof session.sessionExists !== 'function') {
    throw new TypeError('Harness returned an invalid workspace session');
  }
  if (await session.sessionExists(options)) return { sessionId, session };
  if (typeof state.clearSession === 'function' && state.sessionFor(key) === sessionId) {
    await state.clearSession(key);
  }
  return null;
}

async function sessionIsBusy(session, control, options) {
  if (typeof session?.isRunning !== 'function'
    || typeof session?.hasActiveTurn !== 'function') {
    throw new TypeError('Harness session does not expose run state');
  }
  if (await session.isRunning(options)) return true;
  return Boolean(await session.hasActiveTurn(control, options));
}

async function listCatalog(harness, options) {
  if (typeof harness?.listModels !== 'function') {
    throw new TypeError('Harness does not support listing models');
  }
  return normalizeCatalog(await harness.listModels(options));
}

async function sessionCatalog(session, options) {
  if (typeof session?.models !== 'function') {
    throw new TypeError('Harness session does not support listing models');
  }
  return normalizeCatalog(await session.models(options), { requireCurrent: true });
}

async function selectAndVerifyModel(session, selection, options) {
  if (typeof session?.selectModel !== 'function') {
    throw new TypeError('Harness session does not support model selection');
  }
  const selected = (await session.selectModel(selection, options))?.selected;
  if (!sameModel(selected, selection)) {
    throw selectionMismatch(selection, selected, 'selectModel.selected');
  }
  const current = (await sessionCatalog(session, options)).current;
  if (!sameModel(current, selection)) {
    throw selectionMismatch(selection, current, 'models.current');
  }
  return current;
}

function isModelsCommand(command) {
  return MODELS_COMMAND.test(command);
}

export function isModelCommand(text) {
  if (typeof text !== 'string') return false;
  const command = text.trim();
  return MODELS_COMMAND.test(command) || MODEL_COMMAND.test(command);
}

export async function runModelCommand(text, harness, state, key, options = {}) {
  if (!isModelCommand(text)) return null;
  const command = text.trim();
  if (options.hasImages) {
    return commandResult(t('模型命令仅支持纯文字，请移除图片后重试。'));
  }
  const requestOptions = rpcOptions(options.signal);

  if (isModelsCommand(command)) {
    if (!/^\/models[ \t]*$/iu.test(command)) return commandResult(t(MODELS_USAGE));
    try {
      const bound = await boundSession(harness, state, key, requestOptions);
      const catalog = bound
        ? await sessionCatalog(bound.session, requestOptions)
        : await listCatalog(harness, requestOptions);
      return commandResult(formatCatalog(catalog));
    } catch (error) {
      return commandResult(modelErrorMessage(error, 'list'));
    }
  }

  const match = /^\/model(?:[ \t]+([^\s]+))?[ \t]*$/iu.exec(command);
  if (!match) return commandResult(t(MODEL_USAGE));
  const requested = match[1];
  if (!requested) {
    try {
      const bound = await boundSession(harness, state, key, requestOptions);
      if (!bound) return commandResult(noSessionMessage());
      const catalog = await sessionCatalog(bound.session, requestOptions);
      return commandResult(currentModelMessage(catalog.current));
    } catch (error) {
      return commandResult(modelErrorMessage(error, 'select'));
    }
  }
  const numberRequest = modelNumberRequest(requested);
  if (numberRequest?.index === null) {
    return commandResult(invalidModelNumberMessage(requested));
  }
  if (!numberRequest
    && (!requested.includes('/') || requested.startsWith('/') || requested.endsWith('/'))) {
    return commandResult(t(MODEL_USAGE));
  }
  if (options.pendingInteraction) {
    return commandResult([
      t('当前任务正在等待你的回答或审批。'),
      '',
      t('请先处理当前请求，或者发送 /stop 停止任务。'),
    ].join('\n'));
  }

  try {
    return await withSessionBindingLock(state, key, async () => {
      const bound = await boundSession(harness, state, key, requestOptions);
      if (bound && await sessionIsBusy(bound.session, options.control, requestOptions)) {
        return commandResult(t('当前任务正在运行，请等待完成或先发送 /stop。'));
      }

      const catalog = bound
        ? await sessionCatalog(bound.session, requestOptions)
        : await listCatalog(harness, requestOptions);
      const selection = numberRequest
        ? modelAt(catalog, numberRequest.index)
        : matchingModel(catalog, requested);
      if (!selection) {
        if (numberRequest) return commandResult(invalidModelNumberMessage(requested));
        return commandResult([
          t('没有找到模型：{model}', { model: safeDisplayText(requested) }),
          '',
          t('请发送 /models 查看可用模型。'),
        ].join('\n'));
      }

      let applied;
      if (bound) {
        applied = await selectAndVerifyModel(bound.session, selection, requestOptions);
        assertSessionBinding(state, key, bound.sessionId);
      } else {
        if (typeof harness?.createSession !== 'function'
          || typeof harness?.workspaceSession !== 'function'
          || typeof state?.sessionFor !== 'function'
          || typeof state?.setSession !== 'function') {
          throw new TypeError('Harness cannot create a conversation session');
        }
        const sessionId = await harness.createSession(requestOptions);
        if (typeof sessionId !== 'string' || !sessionId) {
          throw new TypeError('Harness returned an invalid session id');
        }
        const session = harness.workspaceSession(sessionId);
        applied = await selectAndVerifyModel(session, selection, requestOptions);
        const currentSessionId = state.sessionFor(key);
        if (typeof currentSessionId === 'string' && currentSessionId) {
          throw sessionBindingChanged();
        }
        if (await state.setSession(key, sessionId) === false) {
          const stale = new Error('Workspace changed while binding the new session');
          stale.code = WORKSPACE_SESSION_STALE;
          throw stale;
        }
      }
      return commandResult(t(`模型已切换为：
{model}

后续消息将使用该模型。`, { model: modelId(applied.provider, applied.model) }));
    });
  } catch (error) {
    return commandResult(modelErrorMessage(error, 'select'));
  }
}
