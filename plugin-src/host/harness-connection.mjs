/** Connect to this Host directly unless an external Harness URL was configured. */
export function harnessConnection(ctx, config = {}) {
  if (config.harnessBaseUrl !== undefined) {
    return { baseUrl: new URL(config.harnessBaseUrl) };
  }
  if (!ctx?.apiProxy) {
    throw new TypeError('dsh-im requires the Host apiProxy service; check that DSH has finished loading its Host services');
  }
  return {
    apiProxy: ctx.apiProxy,
    // Cordis child contexts share one root; different Hosts must not share
    // ownership of pending questions and approvals.
    interactionScope: ctx.root ?? ctx,
  };
}
