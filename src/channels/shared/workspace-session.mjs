export const WORKSPACE_SESSION_STALE = 'workspace-session-stale';

async function sessionExists(harness, sessionId, options) {
  return options === undefined
    ? harness.sessionExists(sessionId)
    : harness.sessionExists(sessionId, options);
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
    let sessionId = state.sessionFor(key);
    if (!sessionId || !(await sessionExists(harness, sessionId, existsOptions))) {
      sessionId = await createSession(harness, createOptions);
      if (await state.setSession(key, sessionId) === false) continue;
    }
    try {
      return {
        sessionId,
        answer: await harness.ask(sessionId, text, askOptions),
      };
    } catch (error) {
      if (error?.code !== WORKSPACE_SESSION_STALE) throw error;
    }
  }
}
