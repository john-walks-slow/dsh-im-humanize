const WORKSPACE_COMMAND = /^\/workspace(?:\s+([\s\S]+))?$/i;

export async function runWorkspaceCommand(text, harness) {
  if (typeof text !== 'string') return null;
  const match = WORKSPACE_COMMAND.exec(text.trim());
  if (!match) return null;
  const workspace = match[1]?.trim();
  if (!workspace) {
    return { handled: true, message: '用法：/workspace 工作区绝对路径' };
  }
  if (typeof harness?.switchWorkspace !== 'function') {
    return { handled: true, message: '当前机器人暂不支持切换工作区。' };
  }
  try {
    const current = await harness.switchWorkspace(workspace);
    return { handled: true, message: `工作区已切换为：${current}` };
  } catch (error) {
    if (['workspace-not-absolute', 'workspace-not-found', 'workspace-not-directory'].includes(error?.code)) {
      return { handled: true, message: `${error.message}\n用法：/workspace 工作区绝对路径` };
    }
    if (error?.code === 'workspace-bot-not-found') {
      return { handled: true, message: '机器人正在移除或已重新接入，无法切换原会话的工作区。' };
    }
    throw error;
  }
}
