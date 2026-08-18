import { fetchImageBuffer, ImagePromptError } from '../shared/image-prompt.mjs';

const DEFAULT_BASE_URL = 'https://slack.com/api/';
const SLACK_FILE_HOST = 'files.slack.com';
const LEGACY_SLACK_FILE_HOST = 'slack.com';
const SLACK_FILE_PATH_PREFIX = '/files-pri/';
const SLACK_FILE_HOSTS = Object.freeze([SLACK_FILE_HOST]);

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requestSignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function isRedirectStatus(status) {
  return Number.isInteger(status) && status >= 300 && status < 400;
}

async function cancelResponseBody(response) {
  try {
    await response?.body?.cancel?.();
  } catch {
    // Preserve the download failure when response cleanup also fails.
  }
}

function secureSlackFileUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Image download URL must use HTTPS');
  if (url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Image download URL is not hosted by the messaging platform');
  }
  if (url.hostname === LEGACY_SLACK_FILE_HOST && url.pathname.startsWith(SLACK_FILE_PATH_PREFIX)) {
    url.hostname = SLACK_FILE_HOST;
  }
  if (url.hostname !== SLACK_FILE_HOST || !url.pathname.startsWith(SLACK_FILE_PATH_PREFIX)) {
    throw new Error('Image download URL is not hosted by the messaging platform');
  }
  url.hash = '';
  return url;
}

function redirectUrl(response, source) {
  const location = response?.headers?.get?.('location');
  if (!location) return null;
  try {
    return new URL(location, source);
  } catch {
    return null;
  }
}

function responseOAuthScopes(response) {
  const raw = response?.headers?.get?.('x-oauth-scopes');
  if (raw === null || raw === undefined) return null;
  return new Set(raw.split(',').map((scope) => scope.trim()).filter(Boolean));
}

function isSlackWorkspaceRedirect(target) {
  return target?.protocol === 'https:'
    && !target.username
    && !target.password
    && (!target.port || target.port === '443')
    && target.hostname.endsWith('.slack.com')
    && target.hostname !== SLACK_FILE_HOST
    && target.pathname === '/'
    && target.searchParams.has('redir');
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    timer?.unref?.();
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function slackId(value, name) {
  const result = cleanString(value);
  if (!result || !/^[A-Z][A-Z0-9]{4,30}$/i.test(result)) {
    throw new TypeError(`Invalid Slack ${name}`);
  }
  return result;
}

function requiredString(value, name) {
  const result = cleanString(value);
  if (!result) throw new TypeError(`Slack ${name} is required`);
  return result;
}

function safeOutgoingText(value, { trim = true } = {}) {
  const raw = typeof value === 'string' ? value : '';
  const text = trim ? raw.trim() : raw;
  if (!text) throw new TypeError('Slack message text is required');
  return text
    .replace(/<@([A-Z0-9]+)>/gi, '@$1')
    .replace(/<!(channel|here|everyone)(?:\^[^>]*)?>/gi, '@$1');
}

function apiFailure(method, payload, tokenKind) {
  const reason = cleanString(payload?.error) ?? 'unknown_error';
  const error = new Error(`Slack ${method} failed: ${reason.replaceAll('_', ' ')}`);
  if (['invalid_auth', 'not_authed', 'token_revoked', 'account_inactive'].includes(reason)) {
    error.code = tokenKind === 'app' ? 'slack-invalid-app-token' : 'slack-invalid-bot-token';
  } else if (reason === 'missing_scope') {
    error.code = 'slack-missing-scope';
  } else if (reason === 'method_not_supported_for_channel_type'
    || reason === 'channel_type_not_supported'
    || reason === 'deprecated_endpoint') {
    error.code = 'slack-stream-unavailable';
  } else {
    error.code = `slack-${reason}`;
  }
  return error;
}

export function validSlackBotToken(value) {
  return typeof value === 'string'
    && /^xoxb-[A-Za-z0-9-]{16,}$/.test(value.trim());
}

export function validSlackAppToken(value) {
  return typeof value === 'string'
    && /^xapp-[A-Za-z0-9-]{16,}$/.test(value.trim());
}

export class SlackApi {
  #botToken;
  #appToken;
  #fetch;
  #baseUrl;
  #botScopes = null;

  constructor({ botToken, appToken, fetchImpl = fetch, baseUrl = DEFAULT_BASE_URL }) {
    if (botToken !== undefined && !validSlackBotToken(botToken)) {
      throw new TypeError('Slack Bot Token is invalid');
    }
    if (appToken !== undefined && !validSlackAppToken(appToken)) {
      throw new TypeError('Slack App Token is invalid');
    }
    if (!botToken && !appToken) throw new TypeError('SlackApi requires a token');
    if (typeof fetchImpl !== 'function') throw new TypeError('SlackApi requires fetch');
    this.#botToken = botToken?.trim();
    this.#appToken = appToken?.trim();
    this.#fetch = fetchImpl;
    this.#baseUrl = new URL(baseUrl);
  }

  authTest(options = {}) {
    return this.#request('auth.test', { ...options, tokenKind: 'bot' });
  }

  openConnection(options = {}) {
    return this.#request('apps.connections.open', {
      ...options,
      tokenKind: 'app',
      body: undefined,
    });
  }

  postMessage({ channelId, text, threadTs, signal }) {
    return this.#request('chat.postMessage', {
      tokenKind: 'bot',
      signal,
      body: {
        channel: slackId(channelId, 'channel id'),
        text: safeOutgoingText(text),
        ...(threadTs ? { thread_ts: cleanString(threadTs) } : {}),
        mrkdwn: true,
        link_names: false,
        unfurl_links: false,
        unfurl_media: false,
      },
    });
  }

  updateMessage({ channelId, ts, text, signal }) {
    return this.#request('chat.update', {
      tokenKind: 'bot',
      signal,
      body: {
        channel: slackId(channelId, 'channel id'),
        ts: requiredString(ts, 'message timestamp'),
        text: safeOutgoingText(text),
        parse: 'none',
        link_names: false,
      },
    });
  }

  startStream({ channelId, threadTs, recipientTeamId, recipientUserId, markdownText, signal }) {
    return this.#request('chat.startStream', {
      tokenKind: 'bot',
      signal,
      body: {
        channel: slackId(channelId, 'channel id'),
        thread_ts: requiredString(threadTs, 'thread timestamp'),
        ...(recipientTeamId ? { recipient_team_id: slackId(recipientTeamId, 'team id') } : {}),
        ...(recipientUserId ? { recipient_user_id: slackId(recipientUserId, 'user id') } : {}),
        ...(cleanString(markdownText) ? { markdown_text: safeOutgoingText(markdownText) } : {}),
      },
    });
  }

  appendStream({ channelId, ts, markdownText, signal }) {
    return this.#request('chat.appendStream', {
      tokenKind: 'bot',
      signal,
      body: {
        channel: slackId(channelId, 'channel id'),
        ts: requiredString(ts, 'stream timestamp'),
        markdown_text: safeOutgoingText(markdownText, { trim: false }),
      },
    });
  }

  stopStream({ channelId, ts, markdownText, signal }) {
    return this.#request('chat.stopStream', {
      tokenKind: 'bot',
      signal,
      body: {
        channel: slackId(channelId, 'channel id'),
        ts: requiredString(ts, 'stream timestamp'),
        ...(cleanString(markdownText) ? {
          markdown_text: safeOutgoingText(markdownText, { trim: false }),
        } : {}),
      },
    });
  }

  async downloadFile({ url, signal, maxBytes }) {
    if (!this.#botToken) throw new TypeError('Slack bot token is required for file download');
    const target = secureSlackFileUrl(url);
    const fetchSlackFile = async (requestUrl, options) => {
      const response = await this.#fetch(requestUrl, options);
      if (!isRedirectStatus(response?.status)) return response;

      const next = redirectUrl(response, requestUrl);
      if ((this.#botScopes && !this.#botScopes.has('files:read'))
        || isSlackWorkspaceRedirect(next)) {
        await cancelResponseBody(response);
        throw new ImagePromptError(
          'slack-file-access-required',
          'Slack redirected a private file request to the workspace because file access was not granted',
          'Slack 未授权机器人读取该文件。请为应用添加 files:read 后重新安装，再重新发送图片。',
        );
      }
      return response;
    };
    return fetchImageBuffer(target, {
      fetchImpl: fetchSlackFile,
      headers: { authorization: `Bearer ${this.#botToken}` },
      signal,
      maxBytes,
      allowedHosts: SLACK_FILE_HOSTS,
    });
  }

  async #request(method, {
    tokenKind,
    body,
    signal,
    timeoutMs = 15_000,
    retry = true,
  }) {
    const token = tokenKind === 'app' ? this.#appToken : this.#botToken;
    if (!token) throw new TypeError(`Slack ${tokenKind} token is required for ${method}`);
    let response;
    try {
      response = await this.#fetch(new URL(method, this.#baseUrl), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': body === undefined
            ? 'application/x-www-form-urlencoded;charset=utf-8'
            : 'application/json;charset=utf-8',
          'user-agent': 'DeepSeek-Harness-dsh-im (https://github.com/xmanrui/dsh-im, 0.2.2)',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: requestSignal(signal, timeoutMs),
        redirect: 'error',
      });
    } catch (error) {
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError') throw error;
      throw new Error(`Slack ${method} transport failed`);
    }

    if (tokenKind === 'bot') {
      const scopes = responseOAuthScopes(response);
      if (scopes) this.#botScopes = scopes;
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`Slack ${method} returned invalid JSON`);
    }
    if (response.status === 429 && retry) {
      const seconds = Number(response.headers.get('retry-after')) || 1;
      await delay(Math.min(10_000, Math.max(100, seconds * 1_000)), signal);
      return this.#request(method, { tokenKind, body, signal, timeoutMs, retry: false });
    }
    if (!response.ok || payload?.ok !== true) throw apiFailure(method, payload, tokenKind);
    return payload;
  }
}

export async function inspectSlackCredentials({ botToken, appToken }, options = {}) {
  if (!validSlackBotToken(botToken)) {
    const error = new TypeError('Slack Bot Token 必须以 xoxb- 开头。');
    error.code = 'slack-invalid-bot-token';
    throw error;
  }
  if (!validSlackAppToken(appToken)) {
    const error = new TypeError('Slack App Token 必须以 xapp- 开头。');
    error.code = 'slack-invalid-app-token';
    throw error;
  }
  const api = new SlackApi({ botToken, appToken, ...options });
  const [identity, connection] = await Promise.all([api.authTest(), api.openConnection()]);
  if (!identity?.team_id || !identity?.user_id || !identity?.bot_id) {
    throw new Error('Slack Bot Token 没有返回完整的机器人身份。');
  }
  let socketUrl;
  try {
    socketUrl = new URL(connection?.url);
  } catch {
    socketUrl = null;
  }
  if (!socketUrl || socketUrl.protocol !== 'wss:') {
    const error = new Error('Slack App Token 无法创建 Socket Mode 连接，请确认已启用 Socket Mode 和 connections:write。');
    error.code = 'slack-socket-mode';
    throw error;
  }
  return {
    platformId: `${identity.team_id}:${identity.user_id}`,
    name: cleanString(identity.user) ?? 'DeepSeek Harness',
    username: cleanString(identity.user),
    teamId: String(identity.team_id),
    teamName: cleanString(identity.team),
  };
}
