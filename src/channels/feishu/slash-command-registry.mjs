/**
 * Feishu native Slash Command registration for the dsh-im Feishu channel.
 *
 * The Feishu client shows a "/" command panel in the chat input box. The
 * command list is stored server-side per bot application and is NOT pushed
 * by dsh/Harness. dsh-im holds its own static command manifest and calls the
 * Feishu OpenAPI to register it, so users can discover commands by typing "/".
 *
 * Reference (official):
 *   https://open.feishu.cn/document/mcp_open_tools/agent-best-practices/agent-supports-slash-commands
 *
 * The registered command panel is only a client-side convenience: when a user
 * taps a command, Feishu sends it to the bot as an ordinary text message via
 * im.message.receive_v1. The bridge's #handle() command matcher therefore
 * needs no changes as long as every registered command name matches the
 * existing "/xxx" text commands.
 */

const SLASH_ENDPOINT = '/open-apis/application/v7/app_slash_commands';

// Icon keys are the documented values in the Feishu Slash Command doc.
const DEFAULT_ICON = 'ai-agent_outlined';

/**
 * The dsh-im Feishu command manifest. Every entry's `command` is registered
 * WITHOUT the leading slash; Feishu displays it as "/<command>" in the panel
 * and sends "/<command>" back as text, which matches the bridge's regexes.
 *
 * Descriptions should stay short and match what the command actually does in
 * bridge.mjs / the shared command modules.
 */
export const SLASH_COMMAND_MANIFEST = Object.freeze([
  { command: 'menu', icon: 'skill_outlined', default: '打开功能菜单', en_us: 'Open the feature menu' },
  { command: 'new', icon: 'ai-deepthink_outlined', default: '开启全新会话', en_us: 'Start a fresh session' },
  { command: 'help', icon: 'promptword_outlined', default: '查看帮助', en_us: 'Show help' },
  { command: 'status', icon: 'ai-functions_outlined', default: '查看机器人状态', en_us: 'Show bot status' },
  { command: 'compact', icon: 'ai-block_outlined', default: '压缩当前会话上下文', en_us: 'Compact the current session' },
  { command: 'sessionlist', icon: 'chat-ai_outlined', default: '列出会话', en_us: 'List sessions' },
  { command: 'workspacelist', icon: 'folder_outlined', default: '列出工作区', en_us: 'List workspaces' },
  { command: 'watch', icon: 'flag_outlined', default: '监听一个话题', en_us: 'Watch a topic' },
  { command: 'unwatch', icon: 'clear_outlined', default: '取消监听', en_us: 'Unwatch a topic' },
  { command: 'watchlist', icon: 'flag_outlined', default: '查看监听列表', en_us: 'List watched topics' },
  { command: 'archived', icon: 'folder_outlined', default: '显示或隐藏归档会话', en_us: 'Toggle archived sessions' },
]);

// Commands that require a parameter are registered too, so the user can type
// "/watch <topic>" from the panel. A leading placeholder hint is not part of
// the registered name; Feishu only allows a plain command token.

function endpointFor(domain, path) {
  const origin = domain === 'lark' ? 'https://open.larksuite.com' : 'https://open.feishu.cn';
  return new URL(path, origin);
}

function jsonResponse(body, operation) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(`${operation} returned a non-JSON response`);
  }
  if (body.code !== 0) {
    const error = new Error(`${operation} failed: ${body.msg || `code ${body.code}`}`);
    error.code = String(body.code);
    error.msg = body.msg;
    throw error;
  }
  return body;
}

/** Fetch a tenant_access_token for the app. */
async function fetchTenantAccessToken({ appId, appSecret, domain, httpInstance, timeoutMs }) {
  if (!appId || !appSecret) throw new Error('Feishu slash registration requires app credentials');
  if (!httpInstance || typeof httpInstance.request !== 'function') {
    throw new TypeError('Feishu slash registration requires an HTTP instance');
  }
  const body = jsonResponse(await httpInstance.request({
    method: 'POST',
    url: endpointFor(domain, '/open-apis/auth/v3/tenant_access_token/internal').href,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    data: { app_id: appId, app_secret: appSecret },
    signal: AbortSignal.timeout(timeoutMs),
    timeout: timeoutMs,
  }), 'Feishu authentication');
  if (!body.tenant_access_token) {
    throw new Error('Feishu authentication returned no tenant access token');
  }
  return body.tenant_access_token;
}

/** List every slash command currently registered for the app. */
export async function listSlashCommands({ appId, appSecret, domain = 'feishu', httpInstance, timeoutMs = 15000 }) {
  const token = await fetchTenantAccessToken({ appId, appSecret, domain, httpInstance, timeoutMs });
  const body = jsonResponse(await httpInstance.request({
    method: 'GET',
    url: endpointFor(domain, SLASH_ENDPOINT).href,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    signal: AbortSignal.timeout(timeoutMs),
    timeout: timeoutMs,
  }), 'Feishu slash command list');
  return Array.isArray(body.data?.items) ? body.data.items : [];
}

/** Register a single slash command. Returns the server-assigned command_id. */
export async function createSlashCommand({
  appId, appSecret, domain = 'feishu', httpInstance, timeoutMs = 15000,
  command, description, icon = DEFAULT_ICON,
}) {
  const token = await fetchTenantAccessToken({ appId, appSecret, domain, httpInstance, timeoutMs });
  const data = { command };
  if (description && (description.default_value || description.i18n)) {
    data.description = description;
  } else if (typeof description === 'string' && description.trim()) {
    data.description = { default_value: description.trim() };
  }
  if (icon) data.description = { ...(data.description ?? {}), icon: { icon_key: icon } };
  const body = jsonResponse(await httpInstance.request({
    method: 'POST',
    url: endpointFor(domain, SLASH_ENDPOINT).href,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    data,
    signal: AbortSignal.timeout(timeoutMs),
    timeout: timeoutMs,
  }), `Feishu slash command create (/${command})`);
  return body.data?.command_id ?? null;
}

/** Delete a registered slash command by its server command_id. */
export async function deleteSlashCommand({
  appId, appSecret, domain = 'feishu', httpInstance, timeoutMs = 15000, commandId,
}) {
  const token = await fetchTenantAccessToken({ appId, appSecret, domain, httpInstance, timeoutMs });
  await jsonResponse(await httpInstance.request({
    method: 'DELETE',
    url: endpointFor(domain, `${SLASH_ENDPOINT}/${commandId}`).href,
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
    timeout: timeoutMs,
  }), 'Feishu slash command delete');
}

/**
 * Best-effort sync of the manifest into the app's registered slash commands.
 * Creates any command in the manifest that is not yet registered and returns
 * a structured report. This is idempotent (the API rejects duplicates with
 * "command already exists", so we skip existing names).
 *
 * @returns {{ created: Array<{command,command_id}>, existing: string[], failed: Array<{command,error}> }}
 */
export async function registerSlashCommands({
  appId, appSecret, domain = 'feishu', httpInstance, timeoutMs = 15000,
  manifest = SLASH_COMMAND_MANIFEST,
}) {
  const existing = new Set((await listSlashCommands({ appId, appSecret, domain, httpInstance, timeoutMs }))
    .map((item) => item.command));

  const created = [];
  const failed = [];
  for (const entry of manifest) {
    const command = String(entry.command ?? '').replace(/^\//, '');
    if (!command) continue;
    if (existing.has(command)) continue;
    try {
      const description = {
        default_value: entry.default ?? entry.en_us ?? command,
        i18n: {
          zh_cn: entry.default ?? command,
          en_us: entry.en_us ?? entry.default ?? command,
        },
        icon: { icon_key: entry.icon ?? DEFAULT_ICON },
      };
      const commandId = await createSlashCommand({
        appId, appSecret, domain, httpInstance, timeoutMs, command, description,
      });
      created.push({ command, command_id: commandId });
    } catch (error) {
      // "command already exists" can race with concurrent runs; treat as existing.
      if (error?.code === '40000000' && /already exists/i.test(error?.msg ?? '')) {
        existing.add(command);
        continue;
      }
      if (error?.code === '99991640' || /lacks permission/i.test(error?.msg ?? '')) {
        // Missing app_slash_command:write permission; abort the batch.
        failed.push({ command, error });
        break;
      }
      failed.push({ command, error: error?.message ?? String(error) });
    }
  }

  return {
    created,
    existing: [...existing].filter((c) => c !== null && c !== undefined),
    failed,
  };
}

export default registerSlashCommands;
