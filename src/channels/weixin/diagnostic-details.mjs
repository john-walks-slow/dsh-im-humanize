// Shared by Host and Client: only explicitly admitted diagnostic facts cross the UI boundary.
const OPERATIONS = new Set([
  'startup', 'connection.restore', 'connection.monitor', 'connection.close', 'connection.status',
  'provision.begin', 'provision.poll', 'provision.verify', 'provision.cancel', 'bot.reconnect', 'bot.delete',
  'bot.workspace.set', 'bot.model.set', 'bot.agent-preset.set', 'bot.context-enhancement.set', 'bot.access-policy.set', 'bot.alias.set',
]);
const STAGES = new Set([
  'startup.load', 'qr.begin', 'qr.encode', 'qr.poll', 'qr.verify', 'qr.cancel', 'credential.read', 'credential.save', 'credential.remove',
  'account.save', 'account.remove', 'state.load', 'state.write', 'state.cleanup', 'workspace.write', 'workspace.cleanup',
  'runtime.prepare', 'activation', 'harness.check', 'connection.start', 'connection.poll', 'connection.stop', 'status.read', 'rollback', 'management.request',
]);
const REASONS = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT', 'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET',
  'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_SSL_WRONG_VERSION_NUMBER',
  'ENOENT', 'EACCES', 'EPERM', 'ENOSPC', 'EROFS', 'ENOTDIR', 'EISDIR', 'EBUSY', 'EIO', 'EXDEV', 'EMFILE', 'ENFILE', 'EEXIST',
  'invalid-json', 'read-only',
]);
const RESOURCES = new Set(['credential-store', 'account-config', 'account-state', 'workspace-config', 'workspace-directory']);

export function normalizeWeixinDiagnosticDetails(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const [field, allowed] of [['operation', OPERATIONS], ['stage', STAGES], ['reason', REASONS], ['resource', RESOURCES]]) {
    if (allowed.has(value[field])) result[field] = value[field];
  }
  if (/^WX-CONN-[A-F0-9]{8}$/.test(value.referenceId ?? '')) result.referenceId = value.referenceId;
  if (typeof value.occurredAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.occurredAt)
    && Number.isFinite(Date.parse(value.occurredAt))) result.occurredAt = value.occurredAt;
  if (Number.isInteger(value.httpStatus) && value.httpStatus >= 100 && value.httpStatus <= 599) result.httpStatus = value.httpStatus;
  const provider = typeof value.providerCode === 'number' && Number.isSafeInteger(value.providerCode)
    ? String(value.providerCode) : value.providerCode;
  if (typeof provider === 'string' && /^-?\d{1,12}$/.test(provider)) result.providerCode = provider;
  if (typeof value.pluginVersion === 'string' && /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(value.pluginVersion)
    && value.pluginVersion.length <= 64) result.pluginVersion = value.pluginVersion;
  if (['succeeded', 'failed', 'not-attempted', 'unknown'].includes(value.rollback)) result.rollback = value.rollback;
  if (typeof value.hint === 'string' && value.hint.trim()) result.hint = value.hint.trim().slice(0, 500);
  return result;
}
