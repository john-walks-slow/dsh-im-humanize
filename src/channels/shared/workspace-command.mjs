import { stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

const WORKSPACE_COMMAND = /^\/workspace(?:\s+([\s\S]+))?$/i;
const WORKSPACE_LIST_COMMAND = /^\/workspacelist(?:\s+([\s\S]+))?$/i;
const MAX_WORKSPACE_PATH_LENGTH = 4_096;
const MAX_COMMAND_MESSAGE_LENGTH = 1_800;

function commandResult(message, messages = [message]) {
  return { handled: true, message, messages };
}

function normalizedWorkspacePath(value) {
  if (typeof value !== 'string' || value.length > MAX_WORKSPACE_PATH_LENGTH
    || !isAbsolute(value) || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)) return null;
  return resolve(value);
}

async function existingWorkspacePaths(values) {
  const unique = [...new Set(values.map(normalizedWorkspacePath).filter(Boolean))];
  const checked = await Promise.all(unique.map(async (workspace) => {
    try {
      return (await stat(workspace)).isDirectory() ? workspace : null;
    } catch {
      return null;
    }
  }));
  return checked.filter(Boolean);
}

export function splitWorkspaceCommandMessage(message) {
  const messages = [];
  let offset = 0;
  while (offset < message.length) {
    let end = Math.min(offset + MAX_COMMAND_MESSAGE_LENGTH, message.length);
    if (end < message.length) {
      const lineBreak = message.lastIndexOf('\n', end - 1);
      if (lineBreak >= offset) {
        end = lineBreak + 1;
      } else {
        const trailing = message.charCodeAt(end - 1);
        const leading = message.charCodeAt(end);
        if (trailing >= 0xd800 && trailing <= 0xdbff
          && leading >= 0xdc00 && leading <= 0xdfff) end -= 1;
      }
    }
    messages.push(message.slice(offset, end));
    offset = end;
  }
  return messages;
}

async function runWorkspaceListCommand(match, harness) {
  if (match[1]?.trim()) return commandResult('用法：/workspacelist');
  if (typeof harness?.listWorkspaces !== 'function') {
    return commandResult('当前机器人暂不支持列出工作区。');
  }
  try {
    const listed = await harness.listWorkspaces();
    const current = typeof harness.currentWorkspace === 'function'
      ? normalizedWorkspacePath(harness.currentWorkspace())
      : null;
    const paths = await existingWorkspacePaths([
      ...(current ? [current] : []),
      ...(Array.isArray(listed) ? listed : []),
    ]);
    harness.assertWorkspaceScope?.();
    if (paths.length === 0) {
      return commandResult('当前 Harness Host 上没有仍然存在的已登记工作区。');
    }
    const lines = [
      `当前 Harness Host 上存在的工作区（${paths.length}）：`,
      ...paths.map((workspace, index) => (
        `${index + 1}. ${workspace}${workspace === current ? '（当前）' : ''}`
      )),
      '',
      '切换用法：/workspace 工作区绝对路径',
    ];
    const message = lines.join('\n');
    return commandResult(message, splitWorkspaceCommandMessage(message));
  } catch (error) {
    if (error?.code === 'workspace-bot-not-found') {
      return commandResult('机器人正在移除或已重新接入，无法列出原会话的工作区。');
    }
    return commandResult('暂时无法获取工作区列表，请稍后重试。');
  }
}

export async function runWorkspaceCommand(text, harness) {
  if (typeof text !== 'string') return null;
  const command = text.trim();
  const listMatch = WORKSPACE_LIST_COMMAND.exec(command);
  if (listMatch) return runWorkspaceListCommand(listMatch, harness);
  const match = WORKSPACE_COMMAND.exec(command);
  if (!match) return null;
  const workspace = match[1]?.trim();
  if (!workspace) {
    return commandResult('用法：/workspace 工作区绝对路径');
  }
  if (typeof harness?.switchWorkspace !== 'function') {
    return commandResult('当前机器人暂不支持切换工作区。');
  }
  try {
    const current = await harness.switchWorkspace(workspace);
    return commandResult(`工作区已切换为：${current}`);
  } catch (error) {
    if (['workspace-not-absolute', 'workspace-not-found', 'workspace-not-directory'].includes(error?.code)) {
      return commandResult(`${error.message}\n用法：/workspace 工作区绝对路径`);
    }
    if (error?.code === 'workspace-bot-not-found') {
      return commandResult('机器人正在移除或已重新接入，无法切换原会话的工作区。');
    }
    throw error;
  }
}
