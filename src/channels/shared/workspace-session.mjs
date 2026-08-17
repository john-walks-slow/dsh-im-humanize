export const WORKSPACE_SESSION_STALE = 'workspace-session-stale';

function workspaceSession(harness, sessionId) {
  if (typeof harness.workspaceSession === 'function') {
    return harness.workspaceSession(sessionId);
  }
  return Object.freeze({
    sessionId,
    sessionExists: (...args) => harness.sessionExists(sessionId, ...args),
    ask: (...args) => harness.ask(sessionId, ...args),
  });
}

async function sessionExists(session, options) {
  return options === undefined
    ? session.sessionExists()
    : session.sessionExists(options);
}

async function createSession(harness, options) {
  return options === undefined
    ? harness.createSession()
    : harness.createSession(options);
}

/**
 * Resolve, persist, and ask through a session that belongs to the bot's
 * current workspace. A concurrent workspace switch invalidates the scoped
 * session and retries before any prompt is sent to the stale session.
 */
export async function askInWorkspaceSession({
  harness,
  state,
  key,
  text,
  createOptions,
  existsOptions,
  askOptions,
}) {
  while (true) {
    try {
      let sessionId = state.sessionFor(key);
      let session = sessionId ? workspaceSession(harness, sessionId) : null;
      if (!session || !(await sessionExists(session, existsOptions))) {
        sessionId = await createSession(harness, createOptions);
        if (await state.setSession(key, sessionId) === false) continue;
        session = workspaceSession(harness, sessionId);
      }
      return {
        sessionId,
        answer: await session.ask(text, askOptions),
      };
    } catch (error) {
      if (error?.code !== WORKSPACE_SESSION_STALE) throw error;
    }
  }
}
