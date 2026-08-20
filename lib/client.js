window.__ModuleLoader__.load({
  id: "@xmanrui/dsh-im",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugin-src/client/index.js
var index_exports = {};
__export(index_exports, {
  IMSettingsTab: () => IMSettingsTab,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var React16 = __toESM(require("react"), 1);

// plugin-src/client/channel-logos.js
var React = __toESM(require("react"), 1);
var h = React.createElement;
function dimensions(size) {
  return size === void 0 ? {} : { width: size, height: size };
}
function WeixinLogoGlyph({ size } = {}) {
  return h("svg", {
    ...dimensions(size),
    viewBox: "0 0 24 24",
    focusable: "false",
    "aria-hidden": "true",
    "data-im-channel-logo": "weixin"
  }, h("path", {
    fill: "currentColor",
    d: "M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"
  }));
}
function FeishuLogoGlyph({ size } = {}) {
  return h(
    "svg",
    {
      ...dimensions(size),
      viewBox: "0 0 24 24",
      focusable: "false",
      "aria-hidden": "true",
      "data-im-channel-logo": "feishu"
    },
    h("path", { fill: "#00D6B9", d: "M7.2 4.5h7.6c1.2 0 2.1.55 2.7 1.58 1.05 1.8 1.55 3.45 1.58 4.95-2.04-.62-4.2-.15-6.22 1.45C11.3 9.7 9.42 7.04 7.2 4.5Z" }),
    h("path", { fill: "#1456B8", d: "M10.8 13.55c3.3-2.93 5.72-4.24 9.47-2.52-1.2 1.45-2.27 4.18-3.86 5.43-1.67 1.31-3.9.5-5.61-.64v-2.27Z" }),
    h("path", { fill: "#3370FF", d: "M4.4 8.35c3.47 3.61 7.25 6.1 10.33 5.7 1.06-.14 2.2-.72 3.4-1.72-1.04 2.65-2.6 4.8-5.06 6-2.46 1.2-5.56.52-7.42-.72A2.76 2.76 0 0 1 4.4 15.3V8.35Z" })
  );
}
function DingtalkLogoGlyph({ size } = {}) {
  return h("svg", {
    ...dimensions(size),
    viewBox: "0 0 48 48",
    focusable: "false",
    "aria-hidden": "true",
    "data-im-channel-logo": "dingtalk"
  }, h("path", {
    fill: "currentColor",
    d: "M37.05 22.783c-6.758-5.216-14.378-12.128-22.73-19.538-.655-.585-1.242-.354-1.536.42-1.88 4.973-.058 9.386 2.889 11.932s7.368 4.912 10.058 6.155c.105.049.013.203-.093.163-4.953-2.182-8.397-3.765-13.07-7.368-.497-.388-1.01-.242-1.07.521-.384 4.748 2.657 8.483 6.058 9.745 2.1.781 4.398 1.212 6.53 1.474.109.015.084.178-.027.178-2.747.01-6.058-.654-8.935-1.751-.606-.233-.818.25-.722.633.491 2.008 2.974 5.076 6.926 5.73a12 12 0 0 0 2.228.115c.164 0 .208.089.154.217q-2.685 4.6-2.803 4.797c-.091.152-.036.275.156.275h3.543c.164 0 .264.106.18.246l-4.958 8.196c-.191.328.035.565.395.301s15.212-11.133 15.636-11.448c.195-.142.148-.327-.124-.327h-3.18c-.206 0-.252-.14-.111-.28.14-.141 3.602-3.594 4.837-4.888 1.283-1.35 1.938-3.825-.231-5.498"
  }));
}
function QqLogoGlyph({ size } = {}) {
  return h("svg", {
    ...dimensions(size),
    viewBox: "0 0 24 24",
    focusable: "false",
    "aria-hidden": "true",
    "data-im-channel-logo": "qq"
  }, h("path", {
    fill: "currentColor",
    d: "M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673"
  }));
}
function WecomLogoGlyph({ size } = {}) {
  return h(
    "svg",
    {
      ...dimensions(size),
      viewBox: "0 0 24 24",
      focusable: "false",
      "aria-hidden": "true",
      "data-im-channel-logo": "wecom"
    },
    h("path", {
      fill: "none",
      stroke: "#3370FF",
      strokeWidth: "2.35",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      d: "M17.7 14.5c1.05-1.12 1.65-2.52 1.65-4.03 0-3.82-3.58-6.92-8-6.92s-8 3.1-8 6.92 3.58 6.92 8 6.92c1.17 0 2.28-.22 3.28-.62"
    }),
    h("path", { fill: "#07C160", d: "M16.1 15.15c.7-.7 1.83-.7 2.53 0s.7 1.83 0 2.53-1.83.7-2.53 0-.7-1.83 0-2.53Z" }),
    h("path", { fill: "#FFB800", d: "M19.25 13.45a1.36 1.36 0 1 1 1.92 1.92 1.36 1.36 0 0 1-1.92-1.92Z" }),
    h("path", { fill: "#FF7A00", d: "M19.55 18.05a1.16 1.16 0 1 1 1.64 1.64 1.16 1.16 0 0 1-1.64-1.64Z" }),
    h("path", { fill: "#3370FF", d: "M15.25 18.75a.92.92 0 1 1 1.3 1.3.92.92 0 0 1-1.3-1.3Z" })
  );
}
function TelegramLogoGlyph({ size } = {}) {
  return h("svg", {
    ...dimensions(size),
    viewBox: "0 0 24 24",
    focusable: "false",
    "aria-hidden": "true",
    "data-im-channel-logo": "telegram"
  }, h("path", {
    fill: "currentColor",
    d: "M23.95 4.57c-.36-1.45-1.43-1.76-2.82-1.24L1.5 10.9c-1.34.52-1.32 1.27-.24 1.6l5.03 1.57 11.66-7.36c.55-.34 1.05-.16.64.21l-9.44 8.52-.37 5.12c.54 0 .78-.24 1.08-.53l2.59-2.51 5.38 3.97c.99.55 1.7.27 1.95-.92L23.95 4.57Z"
  }));
}
function DiscordLogoGlyph({ size } = {}) {
  return h("svg", {
    ...dimensions(size),
    viewBox: "0 0 24 24",
    focusable: "false",
    "aria-hidden": "true",
    "data-im-channel-logo": "discord"
  }, h("path", {
    fill: "currentColor",
    d: "M20.32 4.37a19.8 19.8 0 0 0-4.89-1.51c-.21.38-.46.89-.63 1.29a18.4 18.4 0 0 0-5.59 0 13 13 0 0 0-.64-1.29c-1.71.29-3.36.8-4.89 1.52C.59 9.09-.25 13.68.17 18.2a19.9 19.9 0 0 0 6 3.04c.48-.66.91-1.36 1.28-2.1-.7-.26-1.37-.58-2-.96.17-.12.33-.25.49-.38 3.86 1.79 8.04 1.79 11.86 0 .16.13.32.26.49.38-.64.38-1.31.7-2.01.97.37.73.8 1.44 1.28 2.09a19.8 19.8 0 0 0 6-3.04c.49-5.24-.84-9.79-3.24-13.83ZM8.02 15.42c-1.16 0-2.11-1.07-2.11-2.38s.93-2.38 2.11-2.38c1.18 0 2.13 1.08 2.11 2.38 0 1.31-.93 2.38-2.11 2.38Zm7.95 0c-1.16 0-2.11-1.07-2.11-2.38s.93-2.38 2.11-2.38c1.18 0 2.13 1.08 2.11 2.38 0 1.31-.93 2.38-2.11 2.38Z"
  }));
}
function SlackLogoGlyph({ size } = {}) {
  return h("svg", {
    ...dimensions(size),
    viewBox: "0 0 24 24",
    focusable: "false",
    "aria-hidden": "true",
    "data-im-channel-logo": "slack"
  }, h("path", {
    fill: "currentColor",
    d: "M6 15a2 2 0 1 1-2-2h2v2Zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5Zm2-8a2 2 0 1 1 2-2v2H9Zm0 1a2 2 0 1 1 0 4H4a2 2 0 1 1 0-4h5Zm8 2a2 2 0 1 1 2 2h-2v-2Zm-1 0a2 2 0 1 1-4 0V5a2 2 0 1 1 4 0v5Zm-2 8a2 2 0 1 1-2 2v-2h2Zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5Z"
  }));
}
function WhatsappLogoGlyph({ size } = {}) {
  return h("svg", {
    ...dimensions(size),
    viewBox: "0 0 24 24",
    focusable: "false",
    "aria-hidden": "true",
    "data-im-channel-logo": "whatsapp"
  }, h("path", {
    fill: "currentColor",
    d: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.173.198-.297.298-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.999-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.83 9.83 0 0 1 2.893 6.991c-.003 5.45-4.437 9.884-9.886 9.884m8.413-18.297A11.8 11.8 0 0 0 12.055 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.9 11.9 0 0 0 5.688 1.448h.005c6.557 0 11.892-5.335 11.895-11.893a11.82 11.82 0 0 0-3.486-8.413"
  }));
}

// plugin-src/client/channels/dingtalk/api.js
var DINGTALK_RPC_CHANNEL = "/dingtalk";
var DINGTALK_ENDPOINTS = Object.freeze({
  status: "connection.status",
  beginProvisioning: "provision.begin",
  pollProvisioning: "provision.poll",
  cancelProvisioning: "provision.cancel",
  bindCredentials: "bot.bind-credentials",
  reconnectBot: "bot.reconnect",
  deleteBot: "bot.delete",
  setWorkspace: "bot.workspace.set"
});
var ACCOUNT_STATES = /* @__PURE__ */ new Set(["connected", "connecting", "offline", "error"]);
var SNAPSHOT_STATES = /* @__PURE__ */ new Set(["disconnected", "offline", "provisioning", "connected", "degraded"]);
var PROVISION_STATES = /* @__PURE__ */ new Set([
  "starting",
  "pending",
  "scanned",
  "authorizing",
  "creating",
  "connecting",
  "connected",
  "expired",
  "failed",
  "cancelled"
]);
var HEALTH_STATES = /* @__PURE__ */ new Set(["healthy", "checking", "degraded", "offline"]);
var FORBIDDEN_ERROR_FIELDS = /(client[_-]?secret|secret[_-]?ref|device[_-]?code|app[_-]?secret|access[_-]?token|token)/i;
var QR_DATA_URL = /^data:image\/(?:png|webp);base64,[a-z\d+/]+={0,2}$/i;
var MAX_QR_SOURCE_LENGTH = 2 * 1024 * 1024;
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function optionalString(value, maxLength = 240) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : void 0;
}
function opaqueId(value) {
  const id5 = optionalString(value, 128);
  return id5 && /^[a-z\d_-]+$/i.test(id5) ? id5 : void 0;
}
function timestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? void 0 : parsed;
  }
  return void 0;
}
function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}
function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function safeErrorCode(value, fallback) {
  const code = optionalString(value, 80);
  return code && /^[a-z][a-z\d_.:-]*$/i.test(code) && !FORBIDDEN_ERROR_FIELDS.test(code) ? code : fallback;
}
function sanitizeMessage(value, fallback) {
  const message = optionalString(value, 480) ?? fallback;
  if (FORBIDDEN_ERROR_FIELDS.test(message)) return fallback;
  return message.replace(/([=:]\s*)[^\s,;，。]+/g, "$1\u2022\u2022\u2022\u2022\u2022\u2022").slice(0, 240);
}
function normalizeError(value, fallbackCode, fallbackMessage) {
  if (!isRecord(value)) return void 0;
  return {
    code: safeErrorCode(value.code, fallbackCode),
    message: sanitizeMessage(value.message, fallbackMessage)
  };
}
function normalizeTestMessage(value) {
  if (!isRecord(value)) return null;
  if (value.sent === true) return { sent: true };
  if (value.sent !== false) return null;
  const code = value.code === "test-target-unavailable" ? "test-target-unavailable" : "test-message-failed";
  return { sent: false, code };
}
function unwrapRpcResult(result) {
  if (!isRecord(result) || typeof result.ok !== "boolean") {
    throw new Error("\u9489\u9489\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u54CD\u5E94");
  }
  if (!result.ok) {
    const error = new Error(sanitizeMessage(result.error?.message, "\u9489\u9489\u64CD\u4F5C\u5931\u8D25"));
    error.code = safeErrorCode(result.error?.code, "DINGTALK_RPC_ERROR");
    throw error;
  }
  return result.value;
}
function safeQrSource(value) {
  if (typeof value !== "string" || value.length > MAX_QR_SOURCE_LENGTH) return void 0;
  return QR_DATA_URL.test(value) ? value : void 0;
}
function normalizeProvisioning(value, now = Date.now()) {
  const source = isRecord(value?.provisioning) ? value.provisioning : value;
  if (!isRecord(source)) throw new Error("\u9489\u9489\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u626B\u7801\u7ED1\u5B9A\u8FDB\u5EA6");
  const attemptId = opaqueId(source.attemptId);
  if (!attemptId) throw new Error("\u9489\u9489\u626B\u7801\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u7ED1\u5B9A\u4EFB\u52A1");
  const reportedStatus = optionalString(source.status, 32) ?? optionalString(source.state, 32);
  const status = PROVISION_STATES.has(reportedStatus) ? reportedStatus : "failed";
  const expiresAt = timestamp(source.expiresAt) ?? now + clamp(source.expiresIn, 1, 2 * 60 * 60, 10 * 60) * 1e3;
  const result = {
    attemptId,
    status,
    expiresAt,
    pollIntervalMs: clamp(source.pollIntervalMs, 1e3, 1e4, 3e3)
  };
  const qrCodeDataUrl = safeQrSource(source.qrCodeDataUrl);
  if (qrCodeDataUrl) result.qrCodeDataUrl = qrCodeDataUrl;
  if (opaqueId(source.botId)) result.botId = opaqueId(source.botId);
  if (source.alreadyConnected === true) result.alreadyConnected = true;
  const error = normalizeError(
    source.error,
    "DINGTALK_PROVISION_FAILED",
    "\u9489\u9489\u673A\u5668\u4EBA\u6CA1\u6709\u63A5\u5165\u5B8C\u6210"
  );
  if (error) result.error = error;
  return result;
}
function normalizeBot(value) {
  if (!isRecord(value)) return void 0;
  const botId = opaqueId(value.botId);
  if (!botId) return void 0;
  const bot = isRecord(value.bot) ? value.bot : {};
  const connected = value.connected === true;
  const reportedState = ACCOUNT_STATES.has(value.state) ? value.state : "offline";
  const state = connected ? "connected" : reportedState === "connected" ? "connecting" : reportedState;
  const health = isRecord(value.health) ? value.health : {};
  const stats = isRecord(value.stats) ? value.stats : {};
  return {
    botId,
    state,
    connected,
    configured: value.configured !== false,
    workspace: optionalString(value.workspace, 4096) ?? "",
    bot: {
      name: optionalString(bot.name, 100) ?? "\u9489\u9489\u673A\u5668\u4EBA",
      clientIdMasked: optionalString(bot.clientIdMasked, 140) ?? "\u5DF2\u5B89\u5168\u4FDD\u5B58"
    },
    health: {
      status: HEALTH_STATES.has(health.status) ? health.status : connected ? "healthy" : "offline",
      summary: optionalString(health.summary, 200) ?? (connected ? "\u9489\u9489 Stream \u957F\u8FDE\u63A5\u8FD0\u884C\u6B63\u5E38" : "\u9489\u9489\u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA"),
      lastCheckedAt: timestamp(health.lastCheckedAt),
      lastConnectedAt: timestamp(health.lastConnectedAt)
    },
    stats: {
      messagesReceived: nonNegativeInteger(stats.messagesReceived),
      messagesReplied: nonNegativeInteger(stats.messagesReplied)
    },
    error: normalizeError(value.error, "DINGTALK_ACCOUNT_ERROR", "\u9489\u9489\u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA") ?? null
  };
}
function normalizeSnapshot(value) {
  const source = isRecord(value?.snapshot) ? value.snapshot : value;
  if (!isRecord(source) || !Array.isArray(source.bots)) {
    throw new Error("\u9489\u9489\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u673A\u5668\u4EBA\u5217\u8868");
  }
  const seen = /* @__PURE__ */ new Set();
  const bots = source.bots.map(normalizeBot).filter((bot) => {
    if (!bot || seen.has(bot.botId)) return false;
    seen.add(bot.botId);
    return true;
  });
  return {
    schemaVersion: Number.isSafeInteger(source.schemaVersion) ? source.schemaVersion : 1,
    revision: nonNegativeInteger(source.revision),
    state: SNAPSHOT_STATES.has(source.state) ? source.state : "offline",
    bots,
    totals: {
      configured: bots.length,
      connected: bots.filter((bot) => bot.connected).length
    },
    provisioning: source.provisioning ? normalizeProvisioning(source.provisioning) : null,
    testMessage: normalizeTestMessage(source.testMessage)
  };
}
function connectionTestFeedback(result) {
  if (result?.sent === true) return "\u9489\u9489\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\u3002";
  if (result?.code === "test-target-unavailable") {
    return "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\u3002\u673A\u5668\u4EBA\u5C1A\u672A\u6536\u5230\u53EF\u7528\u4E8E\u6D4B\u8BD5\u7684\u79C1\u804A\u6D88\u606F\u3002";
  }
  return result ? "\u9489\u9489\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u6D4B\u8BD5\u6D88\u606F\u53D1\u9001\u5931\u8D25\u3002" : null;
}
function presentError(error) {
  return {
    code: safeErrorCode(error?.code, "DINGTALK_ERROR"),
    message: sanitizeMessage(error?.message, "\u9489\u9489\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5")
  };
}
function formatRemaining(milliseconds) {
  const seconds = Math.max(0, Math.ceil(Number(milliseconds) / 1e3) || 0);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// plugin-src/client/channels/dingtalk/index.js
var React7 = __toESM(require("react"), 1);

// plugin-src/client/credential-binding.js
var React3 = __toESM(require("react"), 1);

// plugin-src/client/i18n.js
var React2 = __toESM(require("react"), 1);
var IM_LOCALE_NAMESPACE = "dsh-im";
var EN = Object.freeze({
  "$locale": "en",
  "IM\u673A\u5668\u4EBA": "IM bots",
  "IM\u673A\u5668\u4EBA\u8BBE\u7F6E": "IM bot settings",
  "IM \u6E20\u9053": "IM channels",
  "\u8BA9 DeepSeek Harness \u89E6\u624B\u53EF\u53CA": "DeepSeek Harness, always within reach",
  "\u5E2E\u52A9\u4E0E\u53CD\u9988 \xB7 \u524D\u5F80 GitHub": "Help & feedback \xB7 Open GitHub",
  "\u5FAE\u4FE1": "WeChat",
  "\u98DE\u4E66": "Feishu",
  "\u9489\u9489": "DingTalk",
  "\u4F01\u4E1A\u5FAE\u4FE1": "WeCom",
  "\u5FAE\u4FE1\u673A\u5668\u4EBA": "WeChat bot",
  "\u98DE\u4E66\u673A\u5668\u4EBA": "Feishu bot",
  "\u9489\u9489\u673A\u5668\u4EBA": "DingTalk bot",
  "\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA": "WeCom bot",
  "QQ\u673A\u5668\u4EBA": "QQ bot",
  "WhatsApp\u673A\u5668\u4EBA": "WhatsApp bot",
  "WhatsApp\u8D26\u53F7": "WhatsApp account",
  "\u5FAE\u4FE1\u8BBE\u7F6E": "WeChat settings",
  "\u98DE\u4E66\u673A\u5668\u4EBA\u8BBE\u7F6E": "Feishu bot settings",
  "\u9489\u9489\u8BBE\u7F6E": "DingTalk settings",
  "\u4F01\u4E1A\u5FAE\u4FE1\u8BBE\u7F6E": "WeCom settings",
  "\u626B\u7801\u63A5\u5165\u673A\u5668\u4EBA": "Scan QR code",
  "\u6B63\u5728\u63A5\u5165": "Connecting",
  "\u624B\u52A8\u63A5\u5165": "Manual setup",
  "\u6536\u8D77\u51ED\u636E": "Hide credentials",
  "\u6536\u8D77\u63A5\u5165": "Hide setup",
  "\u63A5\u5165\u673A\u5668\u4EBA": "Connect bot",
  "\u5F00\u59CB\u63A5\u5165": "Start setup",
  "\u5728\u7EBF": "online",
  "\u8FD0\u884C\u6B63\u5E38": "Connected",
  "\u6B63\u5728\u8FDE\u63A5": "Connecting",
  "\u6B63\u5728\u8FDE\u63A5\u2026": "Connecting\u2026",
  "\u8FDE\u63A5\u672A\u5C31\u7EEA": "Not connected",
  "\u8FDE\u63A5\u4E2D": "Connecting",
  "\u8FDE\u63A5\u4E2D\u65AD": "Disconnected",
  "\u9700\u8981\u5904\u7406": "Needs attention",
  "\u72B6\u6001\u672A\u77E5": "Unknown status",
  "\u79BB\u7EBF": "Offline",
  "\u5DF2\u65AD\u5F00": "Disconnected",
  "\u6D88\u606F\u901A\u9053": "Message channel",
  "\u6700\u8FD1\u68C0\u67E5": "Last checked",
  "\u5F53\u524D\u5DE5\u4F5C\u533A": "Current workspace",
  "\u9009\u62E9\u76EE\u5F55": "Choose folder",
  "\u9009\u62E9\u673A\u5668\u4EBA\u5DE5\u4F5C\u533A\u76EE\u5F55": "Select bot workspace folder",
  "\u5F53\u524D\u76EE\u5F55": "Current folder",
  "\u4E3B\u76EE\u5F55": "Home",
  "\u6B63\u5728\u51C6\u5907\u76EE\u5F55\u9009\u62E9\u5668\u2026": "Preparing folder picker\u2026",
  "\u6B63\u5728\u8BFB\u53D6\u76EE\u5F55\u2026": "Loading folders\u2026",
  "\u8FD9\u4E2A\u76EE\u5F55\u4E2D\u6CA1\u6709\u5B50\u6587\u4EF6\u5939\u3002": "This folder has no subfolders.",
  "\u6B64\u76EE\u5F55\u7684\u5B50\u6587\u4EF6\u5939\u8FC7\u591A\uFF0C\u4EC5\u663E\u793A\u524D\u4E00\u90E8\u5206\u3002": "This folder has too many subfolders; only the first group is shown.",
  "\u65E0\u6CD5\u8BFB\u53D6\u76EE\u5F55\uFF0C\u8BF7\u91CD\u8BD5\u3002": "Could not load the folder. Try again.",
  "\u91CD\u8BD5": "Retry",
  "\u663E\u793A\u9690\u85CF\u6587\u4EF6\u5939": "Show hidden folders",
  "\u5207\u6362\u540E\u4F1A\u6E05\u9664\u8FD9\u4E2A\u673A\u5668\u4EBA\u7684\u65E7\u4F1A\u8BDD\u6620\u5C04\u3002": "Switching clears this bot\u2019s previous session mappings.",
  "\u5207\u6362\u4E2D\u2026": "Switching\u2026",
  "\u9009\u62E9\u6B64\u76EE\u5F55": "Select this folder",
  "\u5DE5\u4F5C\u533A\u7EDD\u5BF9\u8DEF\u5F84": "Absolute workspace path",
  "/\u7EDD\u5BF9\u8DEF\u5F84/\u5230/\u5DE5\u4F5C\u533A": "/absolute/path/to/workspace",
  "\u4FEE\u6539": "Change",
  "\u4FDD\u5B58": "Save",
  "\u4FDD\u5B58\u4E2D\u2026": "Saving\u2026",
  "\u672A\u8BBE\u7F6E": "Not set",
  "\u5DE5\u4F5C\u533A\u4FEE\u6539\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002": "Could not update the workspace. Try again.",
  "\u8BF7\u8F93\u5165\u5DE5\u4F5C\u533A\u7EDD\u5BF9\u8DEF\u5F84\u3002": "Enter an absolute workspace path.",
  "\u5DE5\u4F5C\u533A\u5FC5\u987B\u662F\u7EDD\u5BF9\u8DEF\u5F84\u3002": "The workspace must be an absolute path.",
  "\u5DE5\u4F5C\u533A\u8DEF\u5F84\u4E0D\u5B58\u5728\u3002": "The workspace path does not exist.",
  "\u5DE5\u4F5C\u533A\u8DEF\u5F84\u5FC5\u987B\u6307\u5411\u4E00\u4E2A\u76EE\u5F55\u3002": "The workspace path must point to a directory.",
  "\u627E\u4E0D\u5230\u8981\u4FEE\u6539\u7684\u673A\u5668\u4EBA\u3002": "The bot could not be found.",
  "\u5C1A\u672A\u68C0\u67E5": "Not checked yet",
  "\u521A\u521A": "Just now",
  "\u68C0\u67E5\u8FDE\u63A5": "Check connection",
  "\u68C0\u67E5\u4E2D\u2026": "Checking\u2026",
  "\u8FDE\u63A5\u68C0\u67E5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002": "Connection check failed. Try again later.",
  "\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\uFF0C\u8BF7\u5230\u5BF9\u5E94\u673A\u5668\u4EBA\u4F1A\u8BDD\u4E2D\u786E\u8BA4\u3002": "Test message sent. Check the matching bot conversation.",
  "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\u3002\u673A\u5668\u4EBA\u5C1A\u672A\u6536\u5230\u53EF\u7528\u4E8E\u6D4B\u8BD5\u7684\u79C1\u804A\u6D88\u606F\u3002": "Connection check completed. The bot has not received a direct message it can use for testing.",
  "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u6D4B\u8BD5\u6D88\u606F\u53D1\u9001\u5931\u8D25\u3002": "Connection check completed, but the test message could not be sent.",
  "\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\uFF0C\u8BF7\u5230\u98DE\u4E66\u4F1A\u8BDD\u4E2D\u786E\u8BA4\u3002": "Test message sent. Check the Feishu conversation.",
  "\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\uFF0C\u8BF7\u5230 WhatsApp \u81EA\u804A\u4F1A\u8BDD\u4E2D\u786E\u8BA4\u3002": "Test message sent. Check the WhatsApp self-chat.",
  "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684 WhatsApp \u81EA\u804A\u76EE\u6807\u3002": "Connection check completed, but no WhatsApp self-chat target is available.",
  "\u9489\u9489\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\u3002": "DingTalk connection check completed and the test message was sent.",
  "\u9489\u9489\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u6D4B\u8BD5\u6D88\u606F\u53D1\u9001\u5931\u8D25\u3002": "DingTalk connection check completed, but the test message could not be sent.",
  "\u5FAE\u4FE1\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\u3002": "WeChat connection check completed and the test message was sent.",
  "\u5FAE\u4FE1\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u6D4B\u8BD5\u6D88\u606F\u53D1\u9001\u5931\u8D25\u3002": "WeChat connection check completed, but the test message could not be sent.",
  "\u4F01\u4E1A\u5FAE\u4FE1\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\u3002": "WeCom connection check completed and the test message was sent.",
  "\u4F01\u4E1A\u5FAE\u4FE1\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u6D4B\u8BD5\u6D88\u606F\u53D1\u9001\u5931\u8D25\u3002": "WeCom connection check completed, but the test message could not be sent.",
  "\u91CD\u8BD5\u8FDE\u63A5": "Reconnect",
  "\u91CD\u8BD5\u4E2D\u2026": "Retrying\u2026",
  "\u79FB\u9664\u63A5\u5165": "Remove connection",
  "\u786E\u8BA4\u79FB\u9664\u63A5\u5165": "Remove connection",
  "\u786E\u8BA4\u79FB\u9664": "Remove",
  "\u6B63\u5728\u79FB\u9664\u2026": "Removing\u2026",
  "\u4FDD\u7559\u673A\u5668\u4EBA": "Keep bot",
  "\u4FDD\u7559\u8D26\u53F7": "Keep account",
  "\u53D6\u6D88": "Cancel",
  "\u5173\u95ED": "Close",
  "\u7ACB\u5373\u91CD\u8BD5": "Retry now",
  "\u91CD\u65B0\u8BFB\u53D6": "Reload",
  "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801": "Generate a new QR code",
  "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801\u540E\u7EE7\u7EED": "Generate a new QR code",
  "\u5237\u65B0\u4E8C\u7EF4\u7801": "Refresh QR code",
  "\u5237\u65B0\u4E2D\u2026": "Refreshing\u2026",
  "\u6362\u4E00\u4E2A\u4E8C\u7EF4\u7801": "Get another QR code",
  "\u7EE7\u7EED\u8FDE\u63A5": "Continue connecting",
  "\u7ED1\u5B9A\u5E76\u8FDE\u63A5": "Connect",
  "\u6B63\u5728\u7ED1\u5B9A\u2026": "Connecting\u2026",
  "\u9A8C\u8BC1\u5E76\u8FDE\u63A5": "Verify and connect",
  "\u6B63\u5728\u9A8C\u8BC1\u5E76\u8FDE\u63A5\u2026": "Verifying and connecting\u2026",
  "\u6B63\u5728\u9A8C\u8BC1\u2026": "Verifying\u2026",
  "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5": "The operation failed. Try again later.",
  "\u8BF7\u7A0D\u540E\u91CD\u8BD5": "Try again later.",
  "\u5F53\u524D\u4E8C\u7EF4\u7801\u6709\u6548\u65F6\u95F4": "QR code expires in",
  "\u4E8C\u7EF4\u7801\u6709\u6548\u65F6\u95F4": "QR code expires in",
  "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F": "QR code expired",
  "\u4E8C\u7EF4\u7801\u5DF2\u5931\u6548": "QR code expired",
  "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\n\u8BF7\u91CD\u65B0\u751F\u6210": "QR code expired\nGenerate a new one",
  "\u4E8C\u7EF4\u7801\u56FE\u7247\u6B63\u5728\u751F\u6210\u2026": "Generating QR code\u2026",
  "\u4E8C\u7EF4\u7801\u6B63\u5728\u751F\u6210\u2026": "Generating QR code\u2026",
  "\u4E8C\u7EF4\u7801\u6B63\u5728\u81EA\u52A8\u5237\u65B0\u2026": "Refreshing QR code\u2026",
  "\u4E8C\u7EF4\u7801\u672A\u5C31\u7EEA\uFF0C\u8BF7\u6253\u5F00\u6388\u6743\u94FE\u63A5": "The QR code is not ready. Open the authorization link.",
  "\u4E8C\u7EF4\u7801\u56FE\u7247\u672A\u5C31\u7EEA\uFF0C\u8BF7\u4F7F\u7528\u5907\u7528\u94FE\u63A5\u3002": "The QR code is not ready. Use the alternate link.",
  "\u4E8C\u7EF4\u7801\u56FE\u7247\u672A\u5C31\u7EEA\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210\u3002": "The QR code is not ready. Generate a new one.",
  "\u7B49\u5F85\u5237\u65B0": "Waiting to refresh",
  "\u6B63\u5728\u5237\u65B0\u4E8C\u7EF4\u7801": "Refreshing QR code",
  "\u6253\u5F00\u5907\u7528\u94FE\u63A5": "Open alternate link",
  "\u751F\u6210\u4E8C\u7EF4\u7801": "Generate QR code",
  "\u751F\u6210\u5FAE\u4FE1\u4E8C\u7EF4\u7801": "Generate WeChat QR code",
  "\u751F\u6210\u98DE\u4E66\u4E8C\u7EF4\u7801": "Generate Feishu QR code",
  "\u751F\u6210\u9489\u9489\u4E8C\u7EF4\u7801": "Generate DingTalk QR code",
  "\u751F\u6210\u4F01\u4E1A\u5FAE\u4FE1\u4E8C\u7EF4\u7801": "Generate WeCom QR code",
  "\u751F\u6210 QQ \u4E8C\u7EF4\u7801": "Generate QQ QR code",
  "\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801\u2026": "Generating QR code\u2026",
  "\u6B63\u5728\u51C6\u5907\u6388\u6743\u4E8C\u7EF4\u7801": "Preparing authorization QR code",
  "\u6B63\u5728\u51C6\u5907\u5FAE\u4FE1\u4E8C\u7EF4\u7801": "Preparing WeChat QR code",
  "\u6B63\u5728\u6DFB\u52A0\u65B0\u673A\u5668\u4EBA": "Adding a new bot",
  "\u6B63\u5728\u7533\u8BF7\u9489\u9489\u6388\u6743\u4E8C\u7EF4\u7801\u2026": "Requesting DingTalk authorization QR code\u2026",
  "\u6B63\u5728\u7533\u8BF7\u4F01\u4E1A\u5FAE\u4FE1\u4E8C\u7EF4\u7801\u2026": "Requesting WeCom QR code\u2026",
  "\u6B63\u5728\u7533\u8BF7 QQ \u4E8C\u7EF4\u7801\u2026": "Requesting QQ QR code\u2026",
  "\u6B63\u5728\u751F\u6210 WhatsApp \u4E8C\u7EF4\u7801": "Generating WhatsApp QR code",
  "\u626B\u7801\uFF0C\u521B\u5EFA\u7B2C\u4E00\u4E2A\u98DE\u4E66\u5165\u53E3": "Scan to create your first Feishu bot",
  "\u626B\u7801\u53EA\u4F1A\u65B0\u589E\u4E00\u4E2A\u673A\u5668\u4EBA\uFF0C\u5DF2\u63A5\u5165\u7684\u673A\u5668\u4EBA\u4F1A\u7EE7\u7EED\u6B63\u5E38\u6536\u53D1\u6D88\u606F\u3002": "Scanning adds one bot. Existing bots will continue to send and receive messages.",
  "\u65E0\u9700\u624B\u52A8\u586B\u5199 App ID\u3002\u4EE5\u540E\u8FD8\u53EF\u4EE5\u7EE7\u7EED\u6DFB\u52A0\u673A\u5668\u4EBA\uFF0C\u5206\u522B\u670D\u52A1\u4E0D\u540C\u56E2\u961F\u6216\u98DE\u4E66\u79DF\u6237\u3002": "No App ID is required. You can add more bots later for different teams or Feishu tenants.",
  "\u4F7F\u7528\u98DE\u4E66\u626B\u7801\u521B\u5EFA\u673A\u5668\u4EBA": "Scan with Feishu to create a bot",
  "\u5237\u65B0\u4E8C\u7EF4\u7801\u540E\u7EE7\u7EED": "Refresh the QR code to continue",
  "\u6253\u5F00\u98DE\u4E66\u79FB\u52A8\u7AEF\uFF0C\u4F7F\u7528\u626B\u4E00\u626B\u8BFB\u53D6\u4E8C\u7EF4\u7801": "Open Feishu on your phone and scan the QR code",
  "\u6838\u5BF9\u5E94\u7528\u540D\u79F0\u4E0E\u6743\u9650\u8303\u56F4\uFF0C\u5E76\u786E\u8BA4\u521B\u5EFA": "Review the app name and permissions, then confirm",
  "\u4FDD\u6301\u672C\u9875\u6253\u5F00\uFF0C\u7B49\u5F85\u65B0\u673A\u5668\u4EBA\u7684\u957F\u8FDE\u63A5\u5C31\u7EEA": "Keep this page open until the bot connection is ready",
  "\u5728\u98DE\u4E66\u4E2D\u6253\u5F00": "Open in Feishu",
  "\u53D6\u6D88\u6DFB\u52A0": "Cancel",
  "\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u8FDE\u63A5\u65B0\u673A\u5668\u4EBA": "Confirmed. Connecting the new bot",
  "\u6B63\u5728\u5B89\u5168\u4FDD\u5B58\u51ED\u636E\u5E76\u68C0\u67E5\u65B0\u673A\u5668\u4EBA\u7684\u6D88\u606F\u901A\u9053\uFF0C\u5176\u4ED6\u673A\u5668\u4EBA\u4E0D\u4F1A\u4E2D\u65AD\u3002": "Saving credentials and checking the new bot connection. Existing bots will not be interrupted.",
  "\u6B63\u5728\u5411\u98DE\u4E66\u7533\u8BF7\u4E00\u6B21\u6027\u6388\u6743\u4E8C\u7EF4\u7801\uFF0C\u8BF7\u7A0D\u5019\u3002": "Requesting a one-time authorization QR code from Feishu\u2026",
  "\u65B0\u673A\u5668\u4EBA\u6CA1\u6709\u6DFB\u52A0\u5B8C\u6210": "The new bot was not added",
  "\u65B0\u98DE\u4E66\u673A\u5668\u4EBA\u5DF2\u8FDE\u63A5\uFF0C\u53EF\u4EE5\u5F00\u59CB\u804A\u5929\u3002": "The new Feishu bot is connected and ready to chat.",
  "\u98DE\u4E66\u5E94\u7528\u521B\u5EFA\u5931\u8D25": "Could not create the Feishu app",
  "\u673A\u5668\u4EBA\u5DF2\u7ECF\u521B\u5EFA\uFF0C\u4F46\u6682\u65F6\u65E0\u6CD5\u786E\u8BA4\u8FDE\u63A5\u72B6\u6001": "The bot was created, but its connection could not be confirmed yet",
  "\u673A\u5668\u4EBA\u4ECD\u672A\u8FDE\u63A5": "The bot is still offline",
  "\u673A\u5668\u4EBA\u5C1A\u672A\u8FDE\u63A5": "The bot is not connected yet",
  "\u957F\u8FDE\u63A5\u8FD0\u884C\u6B63\u5E38": "Persistent connection is healthy",
  "\u957F\u8FDE\u63A5": "Persistent connection",
  "\u5E94\u7528\u6807\u8BC6\u5DF2\u5B89\u5168\u4FDD\u5B58": "App identifier stored securely",
  "\u673A\u5668\u4EBA\u6807\u8BC6\u5DF2\u5B89\u5168\u4FDD\u5B58": "Bot identifier stored securely",
  "\u5DF2\u5B89\u5168\u4FDD\u5B58": "Stored securely",
  "\u5DF2\u63A5\u5165\u7684\u5FAE\u4FE1\u8D26\u53F7": "Connected WeChat accounts",
  "\u5DF2\u63A5\u5165\u7684\u673A\u5668\u4EBA": "Connected bots",
  "\u5DF2\u63A5\u5165\u7684\u9489\u9489\u673A\u5668\u4EBA": "Connected DingTalk bots",
  "\u5DF2\u7ED1\u5B9A\u7684\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA": "Connected WeCom bots",
  "\u5DF2\u7ED1\u5B9A\u7684 QQ \u673A\u5668\u4EBA": "Connected QQ bots",
  "\u5DF2\u63A5\u5165\u7684 WhatsApp \u673A\u5668\u4EBA": "Connected WhatsApp accounts",
  "\u4F7F\u7528\u624B\u673A\u5FAE\u4FE1\u626B\u63CF\u4E8C\u7EF4\u7801": "Scan with WeChat on your phone",
  "\u626B\u4E00\u6B21\u7801\uFF0C\u5C31\u80FD\u5728\u5FAE\u4FE1\u91CC\u4F7F\u7528 Harness": "Scan once to use Harness in WeChat",
  "\u6253\u5F00\u624B\u673A\u5FAE\u4FE1\u5E76\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801": "Open WeChat on your phone and scan the QR code",
  "\u5728\u5FAE\u4FE1\u4E2D\u786E\u8BA4\u8FDE\u63A5\u8BE5\u673A\u5668\u4EBA": "Confirm the bot connection in WeChat",
  "\u4FDD\u6301\u672C\u9875\u6253\u5F00\uFF0C\u7B49\u5F85\u673A\u5668\u4EBA\u81EA\u52A8\u8FDE\u63A5": "Keep this page open while the bot connects",
  "\u7B49\u5F85\u5FAE\u4FE1\u626B\u7801": "Waiting for WeChat scan",
  "\u9700\u8981\u914D\u5BF9\u7801": "Pairing code required",
  "\u8F93\u5165\u624B\u673A\u5FAE\u4FE1\u663E\u793A\u7684\u6570\u5B57": "Enter the number shown in WeChat",
  "\u5FAE\u4FE1\u914D\u5BF9\u7801": "WeChat pairing code",
  "\u5DF2\u626B\u7801\uFF0C\u8BF7\u5728\u624B\u673A\u4E0A\u786E\u8BA4": "Scanned. Confirm on your phone",
  "\u914D\u5BF9\u7801\u5DF2\u63D0\u4EA4\uFF0C\u6B63\u5728\u7B49\u5F85\u5FAE\u4FE1\u786E\u8BA4\u3002": "Pairing code submitted. Waiting for WeChat confirmation.",
  "\u8FD9\u662F\u5FAE\u4FE1\u9644\u52A0\u7684\u5B89\u5168\u786E\u8BA4\u6B65\u9AA4\u3002\u914D\u5BF9\u7801\u53EA\u7528\u4E8E\u672C\u6B21\u626B\u7801\u8F6E\u8BE2\uFF0C\u4E0D\u4F1A\u5199\u5165\u914D\u7F6E\u6216\u65E5\u5FD7\u3002": "This is an additional WeChat confirmation step. The pairing code is used only for this connection and is never stored.",
  "\u6B63\u5728\u4FDD\u5B58\u51ED\u636E\u5E76\u9A8C\u8BC1 Harness \u4E0E\u5FAE\u4FE1\u957F\u8F6E\u8BE2\u3002": "Saving credentials and verifying the WeChat connection.",
  "\u5FAE\u4FE1\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u542F\u52A8\u6D88\u606F\u8FDE\u63A5": "Confirmed in WeChat. Starting the message connection",
  "\u5FAE\u4FE1\u5DF2\u7ED1\u5B9A\uFF0C\u53EF\u4EE5\u5F00\u59CB\u5411\u5DF2\u7ED1\u5B9A\u7684\u673A\u5668\u4EBA\u53D1\u6D88\u606F\u3002": "WeChat is connected and ready for messages.",
  "\u8FD9\u4E2A\u5FAE\u4FE1\u8D26\u53F7\u5DF2\u7ECF\u7ED1\u5B9A\u5E76\u4FDD\u6301\u5728\u7EBF\u3002": "This WeChat account is connected and online.",
  "\u5FAE\u4FE1\u8D26\u53F7\u53CA\u672C\u673A\u51ED\u636E\u5DF2\u79FB\u9664\u3002": "The WeChat account and local credentials were removed.",
  "\u5DF2\u53D6\u6D88\u5FAE\u4FE1\u7ED1\u5B9A\u3002": "WeChat setup was cancelled.",
  "\u6B63\u5728\u8054\u7CFB\u817E\u8BAF\u5FAE\u4FE1 iLink \u670D\u52A1\u3002": "Contacting the WeChat iLink service.",
  "iLink \u957F\u8F6E\u8BE2": "iLink long polling",
  "\u626B\u4E00\u6B21\u7801\uFF0C\u81EA\u52A8\u521B\u5EFA\u5E76\u8FDE\u63A5\u673A\u5668\u4EBA": "Scan once to create and connect a bot",
  "\u4F7F\u7528\u9489\u9489 App \u5B8C\u6210\u673A\u5668\u4EBA\u6388\u6743": "Authorize the bot with the DingTalk app",
  "\u4F7F\u7528\u5DF2\u52A0\u5165\u4F01\u4E1A/\u7EC4\u7EC7\u7684\u9489\u9489\u8D26\u53F7\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801": "Scan the QR code with a DingTalk account that belongs to an organization",
  "\u5728\u6388\u6743\u9875\u70B9\u51FB\u201C\u4E00\u952E\u521B\u5EFA\u65B0\u673A\u5668\u4EBA\u201D": "Select \u201CCreate new bot\u201D on the authorization page",
  "\u8BF7\u52FF\u5173\u95ED\u672C\u9875\uFF0C\u9489\u9489\u5B8C\u6210\u6388\u6743\u540E\u5C06\u81EA\u52A8\u7EE7\u7EED\u3002": "Keep this page open. Setup will continue after DingTalk authorization.",
  "\u7B49\u5F85\u9489\u9489\u626B\u7801\u6388\u6743": "Waiting for DingTalk authorization",
  "\u6388\u6743\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u521B\u5EFA\u9489\u9489\u673A\u5668\u4EBA": "Authorized. Creating the DingTalk bot",
  "\u6B63\u5728\u786E\u8BA4\u9489\u9489\u6388\u6743": "Confirming DingTalk authorization",
  "\u6B63\u5728\u68C0\u67E5\u9489\u9489 Stream \u957F\u8FDE\u63A5\uFF0C\u6210\u529F\u540E\u4F1A\u81EA\u52A8\u663E\u793A\u4E3A\u5728\u7EBF\u3002": "Checking the DingTalk Stream connection. It will appear online when ready.",
  "\u9489\u9489\u673A\u5668\u4EBA\u5DF2\u63A5\u5165\uFF0C\u53EF\u4EE5\u5F00\u59CB\u53D1\u9001\u6D88\u606F\u3002": "The DingTalk bot is connected and ready for messages.",
  "\u8FD9\u4E2A\u9489\u9489\u673A\u5668\u4EBA\u5DF2\u7ECF\u63A5\u5165\u5E76\u4FDD\u6301\u5728\u7EBF\u3002": "This DingTalk bot is connected and online.",
  "Stream \u957F\u8FDE\u63A5": "Stream persistent connection",
  "\u4F7F\u7528\u4F01\u4E1A\u5FAE\u4FE1 App \u626B\u7801\u521B\u5EFA\u667A\u80FD\u673A\u5668\u4EBA": "Scan with WeCom to create an AI bot",
  "\u4F7F\u7528\u4F01\u4E1A\u5FAE\u4FE1 App \u5B8C\u6210\u667A\u80FD\u673A\u5668\u4EBA\u6388\u6743": "Authorize the AI bot with WeCom",
  "\u6253\u5F00\u4F01\u4E1A\u5FAE\u4FE1 App\uFF0C\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801": "Open WeCom and scan the QR code",
  "\u5728\u817E\u8BAF\u6388\u6743\u9875\u9762\u786E\u8BA4\u521B\u5EFA\u667A\u80FD\u673A\u5668\u4EBA": "Confirm bot creation on the Tencent authorization page",
  "\u8FD4\u56DE\u8FD9\u91CC\u7B49\u5F85\u8FDE\u63A5\u5B8C\u6210": "Return here and wait for the connection to complete",
  "\u7B49\u5F85\u4F01\u4E1A\u5FAE\u4FE1 App \u626B\u7801": "Waiting for WeCom scan",
  "\u4F01\u4E1A\u5FAE\u4FE1\u5DF2\u6388\u6743\uFF0C\u6B63\u5728\u8FDE\u63A5\u673A\u5668\u4EBA": "Authorized in WeCom. Connecting the bot",
  "\u51ED\u636E\u6B63\u5728\u5199\u5165\u672C\u673A\uFF0C\u5E76\u542F\u52A8\u4F01\u4E1A\u5FAE\u4FE1 WebSocket \u6D88\u606F\u8FDE\u63A5\u3002": "Saving credentials locally and starting the WeCom WebSocket connection.",
  "WebSocket \u957F\u8FDE\u63A5": "WebSocket persistent connection",
  "\u4F7F\u7528\u624B\u673A QQ \u626B\u7801\u521B\u5EFA\u5E76\u7ED1\u5B9A\u673A\u5668\u4EBA": "Scan with mobile QQ to create and connect a bot",
  "\u4F7F\u7528\u624B\u673A QQ \u5B8C\u6210\u673A\u5668\u4EBA\u7ED1\u5B9A": "Complete bot setup with mobile QQ",
  "\u6253\u5F00\u624B\u673A QQ\uFF0C\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801": "Open mobile QQ and scan the QR code",
  "\u5728\u817E\u8BAF\u6388\u6743\u9875\u9762\u786E\u8BA4\u521B\u5EFA\u6216\u7ED1\u5B9A\u673A\u5668\u4EBA": "Confirm bot creation or connection on the Tencent authorization page",
  "\u7B49\u5F85\u624B\u673A QQ \u626B\u7801": "Waiting for mobile QQ scan",
  "QQ \u5DF2\u6388\u6743\uFF0C\u6B63\u5728\u8FDE\u63A5\u673A\u5668\u4EBA": "Authorized in QQ. Connecting the bot",
  "\u51ED\u636E\u6B63\u5728\u5199\u5165\u672C\u673A\uFF0C\u5E76\u542F\u52A8 QQ WebSocket \u6D88\u606F\u8FDE\u63A5\u3002": "Saving credentials locally and starting the QQ WebSocket connection.",
  "\u4F7F\u7528\u624B\u673A WhatsApp \u626B\u63CF\u4E8C\u7EF4\u7801\u5373\u53EF\u63A5\u5165\u3002": "Scan the QR code with WhatsApp to connect.",
  "\u7528\u624B\u673A WhatsApp \u626B\u63CF\u4E8C\u7EF4\u7801": "Scan with WhatsApp on your phone",
  "\u6253\u5F00 WhatsApp \u2192 \u8BBE\u7F6E \u2192 \u5DF2\u5173\u8054\u8BBE\u5907": "Open WhatsApp \u2192 Settings \u2192 Linked devices",
  "\u70B9\u51FB\u201C\u5173\u8054\u8BBE\u5907\u201D\u5E76\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801": "Select \u201CLink a device\u201D and scan the QR code",
  "\u7B49\u5F85 WhatsApp \u626B\u7801": "Waiting for WhatsApp scan",
  "\u5DF2\u626B\u7801\uFF0C\u6B63\u5728\u8FDE\u63A5 WhatsApp": "Scanned. Connecting WhatsApp",
  "\u6B63\u5728\u5EFA\u7ACB\u5B89\u5168\u7684\u5173\u8054\u8BBE\u5907\u4F1A\u8BDD\u3002": "Creating a secure linked-device session.",
  "\u5173\u8054\u8BBE\u5907\u6B63\u5728\u63A5\u5165 DeepSeek Harness\u3002": "Linking the device to DeepSeek Harness.",
  "WhatsApp Web \u5173\u8054\u8BBE\u5907\u8FD0\u884C\u6B63\u5E38": "WhatsApp linked device is healthy",
  "Bot API \u957F\u8F6E\u8BE2": "Bot API long polling",
  " Gateway \u957F\u8FDE\u63A5": " Gateway persistent connection",
  "Gateway \u957F\u8FDE\u63A5": "Gateway persistent connection",
  " Socket Mode \u957F\u8FDE\u63A5": " Socket Mode persistent connection",
  "Socket Mode \u957F\u8FDE\u63A5": "Socket Mode persistent connection",
  "\u63A5\u5165 Telegram \u673A\u5668\u4EBA": "Connect a Telegram bot",
  "\u5148\u901A\u8FC7 @BotFather \u83B7\u53D6 Bot Token\uFF0C\u518D\u5728\u8FD9\u91CC\u5B8C\u6210\u63A5\u5165\u3002": "Get a Bot Token from @BotFather, then connect it here.",
  "\u586B\u5199 @BotFather \u751F\u6210\u7684 Bot Token": "Enter the Bot Token from @BotFather",
  "\u63A5\u5165 Discord \u673A\u5668\u4EBA": "Connect a Discord bot",
  "\u5148\u5728 Developer Portal \u521B\u5EFA Bot \u5E76\u9080\u8BF7\u5230\u670D\u52A1\u5668\uFF0C\u518D\u5728\u8FD9\u91CC\u5B8C\u6210\u63A5\u5165\u3002": "Create a bot in the Developer Portal and invite it to your server, then connect it here.",
  "\u586B\u5199 Discord Developer Portal \u7684 Bot Token": "Enter the Bot Token from the Discord Developer Portal",
  "\u63A5\u5165 Slack \u673A\u5668\u4EBA": "Connect a Slack bot",
  "\u5148\u7528 Manifest \u521B\u5EFA\u5E76\u914D\u7F6E Slack App": "Create and configure a Slack app with the manifest",
  "\u590D\u5236\u914D\u7F6E\u540E\uFF0C\u5728 Slack \u9009\u62E9 From a manifest\uFF1B\u521B\u5EFA\u5B8C\u6210\u540E\u751F\u6210 connections:write App Token\uFF0C\u5E76\u5C06\u5E94\u7528\u5B89\u88C5\u5230\u5DE5\u4F5C\u533A\u3002": "Copy the manifest and choose \u201CFrom a manifest\u201D in Slack. Then create a connections:write App Token and install the app to your workspace.",
  "\u590D\u5236 Manifest": "Copy manifest",
  "\u5DF2\u590D\u5236 Manifest": "Manifest copied",
  "\u6253\u5F00 Slack \u521B\u5EFA\u9875": "Open Slack app creation",
  "Bot Token \u6765\u81EA OAuth & Permissions\uFF1BApp Token \u6765\u81EA Basic Information\uFF0C\u5E76\u4E14\u5FC5\u987B\u5305\u542B connections:write\u3002": "Get the Bot Token from OAuth & Permissions and the App Token from Basic Information. The App Token must include connections:write.",
  "\u4F7F\u7528\u5B98\u65B9 App Manifest \u5FEB\u901F\u914D\u7F6E\u673A\u5668\u4EBA\uFF0C\u518D\u586B\u5199 Bot Token \u4E0E App Token \u5EFA\u7ACB\u672C\u5730 Socket Mode \u8FDE\u63A5\u3002": "Configure the bot with the official app manifest, then enter the Bot Token and App Token to start a local Socket Mode connection.",
  "Slack \u5DE5\u4F5C\u533A": "Slack workspace",
  "Bot Token \u4E0E App Token": "Bot Token and App Token",
  "\u586B\u5199 Bot Token": "Enter Bot Token",
  "\u624B\u52A8\u63A5\u5165\u98DE\u4E66\u673A\u5668\u4EBA": "Connect Feishu bot manually",
  "\u624B\u52A8\u63A5\u5165\u9489\u9489\u673A\u5668\u4EBA": "Connect DingTalk bot manually",
  "\u624B\u52A8\u63A5\u5165\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA": "Connect WeCom bot manually",
  "\u624B\u52A8\u63A5\u5165QQ\u673A\u5668\u4EBA": "Connect QQ bot manually",
  "\u586B\u5199\u98DE\u4E66\u5F00\u653E\u5E73\u53F0 App ID": "Enter the Feishu Open Platform App ID",
  "\u586B\u5199\u98DE\u4E66\u5F00\u653E\u5E73\u53F0 App Secret": "Enter the Feishu Open Platform App Secret",
  "\u586B\u5199\u9489\u9489\u5E94\u7528 Client ID": "Enter the DingTalk Client ID",
  "\u586B\u5199\u9489\u9489\u5E94\u7528 Client Secret": "Enter the DingTalk Client Secret",
  "\u586B\u5199\u4F01\u4E1A\u5FAE\u4FE1\u667A\u80FD\u673A\u5668\u4EBA Bot ID": "Enter the WeCom AI Bot ID",
  "\u586B\u5199\u4F01\u4E1A\u5FAE\u4FE1\u667A\u80FD\u673A\u5668\u4EBA Secret": "Enter the WeCom AI Bot Secret",
  "\u586B\u5199 QQ \u5F00\u653E\u5E73\u53F0 AppID": "Enter the QQ Open Platform AppID",
  "\u586B\u5199 QQ \u5F00\u653E\u5E73\u53F0 AppSecret": "Enter the QQ Open Platform AppSecret",
  "\u626B\u7801\u63A5\u5165\u5FAE\u4FE1\u673A\u5668\u4EBA": "Connect WeChat bot by QR code",
  "\u626B\u7801\u63A5\u5165\u98DE\u4E66\u673A\u5668\u4EBA": "Connect Feishu bot by QR code",
  "\u626B\u7801\u63A5\u5165\u9489\u9489\u673A\u5668\u4EBA": "Connect DingTalk bot by QR code",
  "\u626B\u7801\u63A5\u5165\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA": "Connect WeCom bot by QR code",
  "\u626B\u7801\u63A5\u5165 QQ \u673A\u5668\u4EBA": "Connect QQ bot by QR code",
  "\u626B\u7801\u63A5\u5165 WhatsApp \u673A\u5668\u4EBA": "Connect WhatsApp by QR code",
  "\u626B\u7801\u7ED1\u5B9A WhatsApp \u673A\u5668\u4EBA": "Connect WhatsApp by QR code",
  "\u4F7F\u7528 App ID \u548C App Secret \u7ED1\u5B9A\u98DE\u4E66\u673A\u5668\u4EBA": "Connect a Feishu bot with App ID and App Secret",
  "\u4F7F\u7528 Client ID \u548C Client Secret \u7ED1\u5B9A\u9489\u9489\u673A\u5668\u4EBA": "Connect a DingTalk bot with Client ID and Client Secret",
  "\u4F7F\u7528 Bot ID \u548C Secret \u7ED1\u5B9A\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA": "Connect a WeCom bot with Bot ID and Secret",
  "\u4F7F\u7528 AppID \u548C AppSecret \u7ED1\u5B9A QQ \u673A\u5668\u4EBA": "Connect a QQ bot with AppID and AppSecret",
  "\u4F7F\u7528 Manifest \u548C\u53CC Token \u63A5\u5165 Slack \u673A\u5668\u4EBA": "Connect a Slack bot with a manifest and two tokens",
  "\u4F7F\u7528 Bot Token \u63A5\u5165 Telegram \u673A\u5668\u4EBA": "Connect a Telegram bot with a Bot Token",
  "\u4F7F\u7528 Bot Token \u63A5\u5165 Discord \u673A\u5668\u4EBA": "Connect a Discord bot with a Bot Token",
  "\u53D6\u6D88\u7ED1\u5B9A": "Cancel setup",
  "\u53D6\u6D88\u63A5\u5165": "Cancel setup",
  "\u4E8C\u7EF4\u7801\u7531\u817E\u8BAF\u5FAE\u4FE1 iLink \u670D\u52A1\u7B7E\u53D1\u3002\u7528\u624B\u673A\u5FAE\u4FE1\u626B\u63CF\u5E76\u786E\u8BA4\u540E\uFF0C\u8D26\u53F7\u51ED\u636E\u4F1A\u76F4\u63A5\u5199\u5165 Harness Host\uFF0C\u6D4F\u89C8\u5668\u4E0D\u4F1A\u6536\u5230 bot_token\u3002": "The QR code is issued by Tencent WeChat iLink. After you scan and confirm, account credentials are written directly to the Harness Host and are never exposed to the browser.",
  "\u626B\u7801\u8D26\u53F7\u5FC5\u987B\u5DF2\u52A0\u5165\u4F01\u4E1A/\u7EC4\u7EC7\u3002\u5982\u679C\u9489\u9489\u63D0\u793A\u5C1A\u672A\u52A0\u5165\u7EC4\u7EC7\uFF0C\u8BF7\u5728\u63D0\u793A\u9875\u521B\u5EFA\u7EC4\u7EC7\uFF0C\u6216\u6362\u7528\u5DF2\u52A0\u5165\u7EC4\u7EC7\u7684\u8D26\u53F7\u3002": "The DingTalk account must belong to an organization. If prompted, create an organization or use an account that already belongs to one.",
  "\u8BF7\u5728\u624B\u673A\u4E0A\u6838\u5BF9\u5E76\u786E\u8BA4\u6388\u6743\u3002\u90E8\u5206\u8D26\u53F7\u4F1A\u989D\u5916\u663E\u793A\u4E00\u4E2A\u914D\u5BF9\u6570\u5B57\uFF0C\u9875\u9762\u4F1A\u5728\u9700\u8981\u65F6\u63D0\u793A\u8F93\u5165\u3002": "Review and confirm authorization on your phone. Some accounts may also require a pairing number.",
  "\u6388\u6743\u7531\u9489\u9489\u5B98\u65B9\u9875\u9762\u5B8C\u6210\u3002\u626B\u7801\u8D26\u53F7\u5FC5\u987B\u5DF2\u52A0\u5165\u4E00\u4E2A\u4F01\u4E1A/\u7EC4\u7EC7\u5E76\u6709\u6743\u521B\u5EFA\u673A\u5668\u4EBA\uFF1B\u521B\u5EFA\u6210\u529F\u540E\uFF0C\u5E94\u7528\u51ED\u636E\u4F1A\u76F4\u63A5\u5199\u5165 Harness Host\u3002": "Authorization is completed on DingTalk\u2019s official page. The account must belong to an organization and be allowed to create bots. Credentials are written directly to the Harness Host.",
  "\u626B\u7801\u7531\u817E\u8BAF\u5B98\u65B9\u9875\u9762\u5B8C\u6210\uFF0C\u4E0D\u9700\u8981\u624B\u52A8\u586B\u5199 AppID \u6216 AppSecret\u3002\u626B\u7801\u6210\u529F\u540E\uFF0C\u673A\u5668\u4EBA\u4F1A\u81EA\u52A8\u8FDE\u63A5 DeepSeek Harness\u3002": "Scanning is completed on Tencent\u2019s official page. No AppID or AppSecret is required, and the bot connects automatically.",
  "\u626B\u7801\u7531\u817E\u8BAF\u5B98\u65B9\u9875\u9762\u5B8C\u6210\uFF0C\u4E0D\u9700\u8981\u624B\u52A8\u586B\u5199 Bot ID \u6216 Secret\u3002\u521B\u5EFA\u6210\u529F\u540E\uFF0C\u673A\u5668\u4EBA\u4F1A\u81EA\u52A8\u8FDE\u63A5 DeepSeek Harness\u3002": "Scanning is completed on Tencent\u2019s official page. No Bot ID or Secret is required, and the bot connects automatically.",
  "\u817E\u8BAF\u9875\u9762\u4F1A\u521B\u5EFA\u6216\u7ED1\u5B9A\u4E00\u4E2A QQ \u673A\u5668\u4EBA\uFF0C\u5E76\u628A\u8FDE\u63A5\u51ED\u636E\u5B89\u5168\u4EA4\u7ED9\u672C\u673A Harness Host\u3002": "Tencent will create or connect a QQ bot and securely deliver its credentials to the local Harness Host.",
  "\u4F01\u4E1A\u5FAE\u4FE1\u5B98\u65B9\u9875\u9762\u4F1A\u521B\u5EFA\u4E00\u4E2A\u667A\u80FD\u673A\u5668\u4EBA\uFF0C\u5E76\u628A\u8FDE\u63A5\u51ED\u636E\u5B89\u5168\u4EA4\u7ED9\u672C\u673A Harness Host\u3002": "WeCom will create an AI bot and securely deliver its credentials to the local Harness Host.",
  "\u4ECE\u6B64 Harness \u79FB\u9664\u8FD9\u4E2A\u5FAE\u4FE1\u8D26\u53F7\uFF1F": "Remove this WeChat account from Harness?",
  "\u8FD9\u4F1A\u505C\u6B62\u6D88\u606F\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684 bot_token\u3001\u8D26\u53F7\u914D\u7F6E\u548C\u4F1A\u8BDD\u6620\u5C04\u3002\u5176\u4ED6\u5FAE\u4FE1\u8D26\u53F7\u4E0D\u53D7\u5F71\u54CD\u3002": "This stops the message connection and removes the locally stored bot_token, account configuration, and session mappings. Other WeChat accounts are not affected.",
  "\u6B64\u64CD\u4F5C\u4F1A\u505C\u6B62\u8FD9\u4E2A\u673A\u5668\u4EBA\u7684\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u4FDD\u5B58\u5728\u672C\u673A\u7684\u63A5\u5165\u914D\u7F6E\u548C\u51ED\u636E\u3002\u98DE\u4E66\u5F00\u653E\u5E73\u53F0\u4E2D\u7684\u5E94\u7528\u4E0D\u4F1A\u88AB\u81EA\u52A8\u5220\u9664\uFF0C\u5176\u4ED6\u673A\u5668\u4EBA\u4E5F\u4E0D\u53D7\u5F71\u54CD\u3002": "This stops the bot connection and removes the locally stored configuration and credentials. The app in Feishu Open Platform is not deleted, and other bots are not affected.",
  "\u8FD9\u4F1A\u505C\u6B62\u6D88\u606F\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684\u5E94\u7528\u51ED\u636E\u3001\u673A\u5668\u4EBA\u914D\u7F6E\u53CA\u4F1A\u8BDD\u6620\u5C04\u3002\u9489\u9489\u5F00\u653E\u5E73\u53F0\u4E2D\u7684\u673A\u5668\u4EBA\u4E0D\u4F1A\u88AB\u81EA\u52A8\u5220\u9664\u3002": "This stops the message connection and removes the locally stored app credentials, bot configuration, and session mappings. The bot in DingTalk Open Platform is not deleted.",
  "\u8FD9\u4F1A\u505C\u6B62\u6D88\u606F\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684\u5E94\u7528\u51ED\u636E\u3001\u673A\u5668\u4EBA\u914D\u7F6E\u53CA\u4F1A\u8BDD\u6620\u5C04\u3002\u4F01\u4E1A\u5FAE\u4FE1\u5E73\u53F0\u4E2D\u7684\u673A\u5668\u4EBA\u4E0D\u4F1A\u88AB\u81EA\u52A8\u5220\u9664\u3002": "This stops the message connection and removes the locally stored app credentials, bot configuration, and session mappings. The bot in WeCom is not deleted.",
  "\u8FD9\u4F1A\u505C\u6B62\u6D88\u606F\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684\u5E94\u7528\u51ED\u636E\u3001\u673A\u5668\u4EBA\u914D\u7F6E\u53CA\u4F1A\u8BDD\u6620\u5C04\u3002\u817E\u8BAF\u5E73\u53F0\u4E2D\u7684\u673A\u5668\u4EBA\u4E0D\u4F1A\u88AB\u81EA\u52A8\u5220\u9664\u3002": "This stops the message connection and removes the locally stored app credentials, bot configuration, and session mappings. The bot on Tencent\u2019s platform is not deleted.",
  "\u8FD9\u4F1A\u505C\u6B62\u6D88\u606F\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684 WhatsApp \u5173\u8054\u8BBE\u5907\u548C\u4F1A\u8BDD\u6620\u5C04\u3002": "This stops the message connection and removes the locally stored WhatsApp linked device and session mappings.",
  "\u6B63\u5728\u8BFB\u53D6\u98DE\u4E66\u673A\u5668\u4EBA\u5217\u8868": "Loading Feishu bots",
  "\u6B63\u5728\u8BFB\u53D6\u98DE\u4E66\u8FDE\u63A5\u72B6\u6001\u2026": "Loading Feishu connection status\u2026",
  "\u6B63\u5728\u8BFB\u53D6\u5FAE\u4FE1\u8FDE\u63A5\u72B6\u6001\u2026": "Loading WeChat connection status\u2026",
  "\u6B63\u5728\u8BFB\u53D6\u9489\u9489\u8FDE\u63A5\u72B6\u6001\u2026": "Loading DingTalk connection status\u2026",
  "\u901A\u8FC7\u626B\u7801\u628A\u9489\u9489\u673A\u5668\u4EBA\u63A5\u5165 DeepSeek Harness": "Connect a DingTalk bot to DeepSeek Harness by QR code",
  "\u9489\u9489\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u626B\u7801\u7ED1\u5B9A\u8FDB\u5EA6": "DingTalk did not return QR setup progress",
  "\u9489\u9489\u626B\u7801\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u7ED1\u5B9A\u4EFB\u52A1": "DingTalk did not return a valid setup attempt",
  "\u9489\u9489 Stream \u957F\u8FDE\u63A5\u8FD0\u884C\u6B63\u5E38": "DingTalk Stream connection is healthy",
  "\u9489\u9489\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u673A\u5668\u4EBA\u5217\u8868": "DingTalk did not return a valid bot list",
  "${totals.connected} / ${totals.configured} \u5728\u7EBF": "${totals.connected} / ${totals.configured} online",
  "\u7528\u4E8E\u628A\u9489\u9489\u673A\u5668\u4EBA\u63A5\u5165 DeepSeek Harness \u7684\u4E00\u6B21\u6027\u4E8C\u7EF4\u7801": "One-time QR code for connecting a DingTalk bot to DeepSeek Harness",
  "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\\n\u8BF7\u91CD\u65B0\u751F\u6210": "QR code expired\\nGenerate a new one",
  "\u673A\u5668\u4EBA\u5DF2\u521B\u5EFA\uFF0C\u6B63\u5728\u5EFA\u7ACB\u6D88\u606F\u8FDE\u63A5": "Bot created. Starting the message connection",
  "\u9489\u9489\u626B\u7801\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u5B89\u5168\u7684\u4E8C\u7EF4\u7801": "DingTalk did not return a secure QR code",
  "\u9489\u9489\u4E8C\u7EF4\u7801\u5DF2\u751F\u6210\uFF0C\u8BF7\u4F7F\u7528\u9489\u9489 App \u626B\u63CF\u3002": "DingTalk QR code generated. Scan it with the DingTalk app.",
  "\u9489\u9489\u673A\u5668\u4EBA\u51ED\u636E\u5DF2\u7ED1\u5B9A\u3002": "DingTalk bot credentials connected.",
  "\u5DF2\u53D6\u6D88\u9489\u9489\u673A\u5668\u4EBA\u63A5\u5165\u3002": "DingTalk bot setup cancelled.",
  "\u9489\u9489\u673A\u5668\u4EBA\u53CA\u672C\u673A\u51ED\u636E\u5DF2\u79FB\u9664\u3002": "DingTalk bot and local credentials removed.",
  "\u98DE\u4E66\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u4E8C\u7EF4\u7801\u4FE1\u606F": "Feishu did not return QR code information",
  "\u98DE\u4E66\u670D\u52A1\u8FD4\u56DE\u7684\u4E8C\u7EF4\u7801\u4FE1\u606F\u4E0D\u5B8C\u6574": "Feishu returned incomplete QR code information",
  "\u98DE\u4E66\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6548\u7684\u673A\u5668\u4EBA\u72B6\u6001": "Feishu returned an invalid bot status",
  "\u98DE\u4E66\u670D\u52A1\u8FD4\u56DE\u7684\u673A\u5668\u4EBA\u7F3A\u5C11 botId": "The Feishu bot is missing botId",
  "\u98DE\u4E66\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u8FDE\u63A5\u72B6\u6001": "Feishu did not return connection status",
  "\u98DE\u4E66\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u521B\u5EFA\u8FDB\u5EA6": "Feishu did not return creation progress",
  "\u98DE\u4E66\u670D\u52A1\u8FD4\u56DE\u4E86\u672A\u77E5\u7684\u521B\u5EFA\u72B6\u6001": "Feishu returned an unknown creation status",
  "\u5DF2\u63A5\u5165 ${totals.configured} \u4E2A\u673A\u5668\u4EBA\uFF0C\u5176\u4E2D ${totals.connected} \u4E2A\u5728\u7EBF": "${totals.connected} of ${totals.configured} bots online",
  "\u5C1A\u672A\u63A5\u5165\u673A\u5668\u4EBA": "No bot connected yet",
  "\u7528\u4E8E\u65B0\u589E DeepSeek Harness \u98DE\u4E66\u673A\u5668\u4EBA\u7684\u4E00\u6B21\u6027\u6388\u6743\u4E8C\u7EF4\u7801": "One-time authorization QR code for adding a Feishu bot to DeepSeek Harness",
  "\u8BF7\u5237\u65B0\u540E\u91CD\u65B0\u626B\u7801": "Refresh and scan again",
  '${connected ? "\u68C0\u67E5\u8FDE\u63A5" : "\u91CD\u8BD5\u8FDE\u63A5"}${bot.name}': '${connected ? "Check connection" : "Reconnect"} ${bot.name}',
  "\u65E0\u6CD5\u8BFB\u53D6\u98DE\u4E66\u673A\u5668\u4EBA": "Could not load Feishu bots",
  "\u6388\u6743\u4E8C\u7EF4\u7801\u5DF2\u751F\u6210\uFF0C\u8BF7\u4F7F\u7528\u98DE\u4E66\u626B\u7801\u3002": "Authorization QR code generated. Scan it with Feishu.",
  "\u98DE\u4E66\u673A\u5668\u4EBA\u51ED\u636E\u5DF2\u7ED1\u5B9A\u3002": "Feishu bot credentials connected.",
  "\u5DF2\u53D6\u6D88\u6DFB\u52A0\u673A\u5668\u4EBA\u3002": "Adding the bot was cancelled.",
  "${newBot.bot.name}\u5DF2\u8FDE\u63A5\uFF0C\u53EF\u4EE5\u5728\u98DE\u4E66\u4E2D\u5F00\u59CB\u804A\u5929\u3002": "${newBot.bot.name} is connected and ready to chat in Feishu.",
  "${bot.name}\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u673A\u5668\u4EBA\u72B6\u6001\u3002": "${bot.name} operation failed. Check the bot status.",
  "${bot.name}\u5DF2\u4ECE\u6B64 DeepSeek Harness \u79FB\u9664\uFF1B\u98DE\u4E66\u5F00\u653E\u5E73\u53F0\u4E2D\u7684\u5E94\u7528\u672A\u88AB\u5220\u9664\u3002": "${bot.name} was removed from this DeepSeek Harness. The app in Feishu Open Platform was not deleted.",
  "\u65E0\u6CD5\u8BFB\u53D6\u8FDE\u63A5\u72B6\u6001": "Could not load connection status",
  "QQ \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u626B\u7801\u7ED1\u5B9A\u8FDB\u5EA6": "QQ did not return QR setup progress",
  "QQ \u626B\u7801\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u7ED1\u5B9A\u4EFB\u52A1": "QQ did not return a valid setup attempt",
  "QQ WebSocket \u957F\u8FDE\u63A5\u8FD0\u884C\u6B63\u5E38": "QQ WebSocket connection is healthy",
  "QQ \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u673A\u5668\u4EBA\u5217\u8868": "QQ did not return a valid bot list",
  "\u5C1A\u672A\u7ED1\u5B9A QQ \u673A\u5668\u4EBA": "No QQ bot connected yet",
  "\u7528\u4E8E\u7ED1\u5B9A QQ \u673A\u5668\u4EBA\u7684\u4E00\u6B21\u6027\u4E8C\u7EF4\u7801": "One-time QR code for connecting a QQ bot",
  "${channel}${connectionSummary}\u8FD0\u884C\u6B63\u5E38": "${channel}${connectionSummary} is healthy",
  "${channel} \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u673A\u5668\u4EBA\u5217\u8868": "${channel} did not return a valid bot list",
  "\u4F7F\u7528 Bot Token \u63A5\u5165 ${channel} \u673A\u5668\u4EBA": "Connect a ${channel} bot with a Bot Token",
  "${model.totals.connected} / ${model.totals.configured} \u5728\u7EBF": "${model.totals.connected}/${model.totals.configured} online",
  " Bot API \u957F\u8F6E\u8BE2": " Bot API long polling",
  "\u4F01\u4E1A\u5FAE\u4FE1\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u626B\u7801\u7ED1\u5B9A\u8FDB\u5EA6": "WeCom did not return QR setup progress",
  "\u4F01\u4E1A\u5FAE\u4FE1\u626B\u7801\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u7ED1\u5B9A\u4EFB\u52A1": "WeCom did not return a valid setup attempt",
  "\u4F01\u4E1A\u5FAE\u4FE1 WebSocket \u957F\u8FDE\u63A5\u8FD0\u884C\u6B63\u5E38": "WeCom WebSocket connection is healthy",
  "\u4F01\u4E1A\u5FAE\u4FE1\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u673A\u5668\u4EBA\u5217\u8868": "WeCom did not return a valid bot list",
  "\u5C1A\u672A\u7ED1\u5B9A\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA": "No WeCom bot connected yet",
  "\u7528\u4E8E\u7ED1\u5B9A\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA\u7684\u4E00\u6B21\u6027\u4E8C\u7EF4\u7801": "One-time QR code for connecting a WeCom bot",
  "\u5FAE\u4FE1\u626B\u7801\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u7ED1\u5B9A\u4EFB\u52A1": "WeChat did not return a valid setup attempt",
  "\u5FAE\u4FE1\u7ED1\u5B9A\u6CA1\u6709\u5B8C\u6210": "WeChat setup did not complete",
  "\u5FAE\u4FE1\u8FDE\u63A5\u6B63\u5E38": "WeChat connection is healthy",
  "\u5FAE\u4FE1\u8FDE\u63A5\u672A\u5C31\u7EEA": "WeChat connection is not ready",
  "\u5FAE\u4FE1\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u8D26\u53F7\u5217\u8868": "WeChat did not return a valid account list",
  "\u5C1A\u672A\u7ED1\u5B9A\u5FAE\u4FE1": "No WeChat account connected yet",
  "\u7528\u4E8E\u628A\u5FAE\u4FE1\u673A\u5668\u4EBA\u7ED1\u5B9A\u5230 DeepSeek Harness \u7684\u4E00\u6B21\u6027\u4E8C\u7EF4\u7801": "One-time QR code for connecting a WeChat bot to DeepSeek Harness",
  "\u4FDD\u6301\u672C\u9875\u6253\u5F00\uFF0C\u7B49\u5F85\u6D88\u606F\u957F\u8F6E\u8BE2\u53D8\u4E3A\u5728\u7EBF": "Keep this page open until long polling is online",
  "\u5FAE\u4FE1\u4E8C\u7EF4\u7801\u5DF2\u751F\u6210\uFF0C\u8BF7\u4F7F\u7528\u624B\u673A\u5FAE\u4FE1\u626B\u63CF\u3002": "WeChat QR code generated. Scan it with WeChat on your phone.",
  "\u79FB\u9664\u5931\u8D25\uFF1A${presentError(error).message}": "Removal failed: ${presentError(error).message}",
  "\u65E0\u6CD5\u8BFB\u53D6\u5FAE\u4FE1\u72B6\u6001": "Could not load WeChat status",
  "WhatsApp \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u626B\u7801\u8FDB\u5EA6": "WhatsApp did not return QR setup progress",
  "WhatsApp \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u626B\u7801\u4EFB\u52A1": "WhatsApp did not return a valid setup attempt",
  "WhatsApp \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u673A\u5668\u4EBA\u5217\u8868": "WhatsApp did not return a valid account list",
  "\u7528\u4E8E\u5173\u8054 WhatsApp \u8BBE\u5907\u7684\u4E00\u6B21\u6027\u4E8C\u7EF4\u7801": "One-time QR code for linking a WhatsApp device"
});
var en = EN;
var zh = Object.freeze(Object.fromEntries(
  Object.keys(EN).map((key) => [key, key === "$locale" ? "zh" : key])
));
var translate = (key) => key;
function setImTranslator(next) {
  translate = typeof next === "function" ? next : (key) => key;
}
function isEnglish() {
  return translate("$locale") === "en";
}
function channelName(value) {
  return localizeText(value);
}
function translateDynamic(text5) {
  let match = /^(\d+) \/ (\d+) 在线$/.exec(text5);
  if (match) return `${match[1]}/${match[2]} online`;
  match = /^已接入 (\d+) 个机器人，其中 (\d+) 个在线$/.exec(text5);
  if (match) return `${match[2]} of ${match[1]} bots online`;
  match = /^正在读取\s*(.+?)\s*机器人状态…$/.exec(text5);
  if (match) return `Loading ${channelName(match[1])} bot status\u2026`;
  match = /^无法读取\s*(.+?)\s*机器人状态$/.exec(text5);
  if (match) return `Could not load ${channelName(match[1])} bot status`;
  match = /^尚未接入\s*(.+?)\s*机器人$/.exec(text5);
  if (match) return `No ${channelName(match[1])} bot connected yet`;
  match = /^已接入的\s*(.+?)\s*机器人$/.exec(text5);
  if (match) return `Connected ${channelName(match[1])} bots`;
  match = /^手动接入(.+)机器人$/.exec(text5);
  if (match) return `Connect ${channelName(match[1])} bot manually`;
  match = /^(.+) 设置$/.exec(text5);
  if (match) return `${channelName(match[1])} settings`;
  match = /^从 DeepSeek Harness 移除“(.+)”？$/.exec(text5);
  if (match) return `Remove \u201C${match[1]}\u201D from DeepSeek Harness?`;
  match = /^从 DeepSeek Harness 移除(.+)$/.exec(text5);
  if (match) return `Remove ${match[1]} from DeepSeek Harness`;
  match = /^(检查连接|重试连接)(.+)$/.exec(text5);
  if (match) return `${localizeText(match[1])} ${match[2]}`;
  match = /^移除(.+)$/.exec(text5);
  if (match) return `Remove ${match[1]}`;
  match = /^这会停止消息连接，并删除本机保存的 (.+)、机器人配置及会话映射。(.+)中的机器人不会被自动删除。$/.exec(text5);
  if (match) {
    return `This stops the message connection and removes the locally stored ${localizeText(match[1])}, bot configuration, and session mappings. The bot in ${localizeText(match[2])} is not deleted.`;
  }
  match = /^二维码剩余 (.+)$/.exec(text5);
  if (match) return `QR code expires in ${match[1]}`;
  match = /^状态刷新失败：(.+)$/.exec(text5);
  if (match) return `Status refresh failed: ${match[1]}`;
  match = /^状态自动刷新失败：(.+)$/.exec(text5);
  if (match) return `Automatic status refresh failed: ${match[1]}`;
  match = /^操作失败：(.+)$/.exec(text5);
  if (match) return `Operation failed: ${match[1]}`;
  match = /^连接检查失败：(.+)$/.exec(text5);
  if (match) return `Connection check failed: ${match[1]}`;
  match = /^移除失败：(.+)$/.exec(text5);
  if (match) return `Removal failed: ${match[1]}`;
  const phrases = [
    ["\u4F01\u4E1A\u5FAE\u4FE1", "WeCom"],
    ["DeepSeek Harness", "DeepSeek Harness"],
    ["WhatsApp", "WhatsApp"],
    ["Telegram", "Telegram"],
    ["Discord", "Discord"],
    ["Slack", "Slack"],
    ["\u98DE\u4E66", "Feishu"],
    ["\u9489\u9489", "DingTalk"],
    ["\u5FAE\u4FE1", "WeChat"],
    ["\u673A\u5668\u4EBA", "bot"],
    ["\u8D26\u53F7", "account"],
    ["\u5E94\u7528", "app"],
    ["\u51ED\u636E", "credentials"],
    ["\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u54CD\u5E94", "service returned an unrecognized response"],
    ["\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u673A\u5668\u4EBA\u5217\u8868", "service did not return a valid bot list"],
    ["\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", "operation failed; try again later"],
    ["\u64CD\u4F5C\u5931\u8D25", "operation failed"],
    ["\u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA", "connection is not ready"],
    ["\u6CA1\u6709\u63A5\u5165\u5B8C\u6210", "was not connected"],
    ["\u6CA1\u6709\u7ED1\u5B9A\u5B8C\u6210", "was not connected"],
    ["\u8BBE\u7F6E\u9875\u7F3A\u5C11 RPC \u8FDE\u63A5", "settings are missing an RPC connection"],
    ["\u8BBE\u7F6E", "settings"],
    ["\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210", "connection check completed"],
    ["\u4ECD\u672A\u8FDE\u63A5\uFF0C\u63D2\u4EF6\u4F1A\u7EE7\u7EED\u81EA\u52A8\u91CD\u8BD5", "is still offline; the plugin will keep retrying"],
    ["\u5DF2\u91CD\u65B0\u8FDE\u63A5", "reconnected"],
    ["\u79FB\u9664\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5", "could not be removed; try again"],
    ["\u5DF2\u8FDE\u63A5\uFF0C\u53EF\u4EE5\u5F00\u59CB\u804A\u5929", "is connected and ready to chat"],
    ["\u5DF2\u8FDE\u63A5\uFF0C\u53EF\u4EE5\u5F00\u59CB\u53D1\u9001\u6D88\u606F", "is connected and ready for messages"],
    ["\u670D\u52A1\u8BF7\u6C42\u5931\u8D25", "service request failed"],
    ["\u8FDE\u63A5\u9047\u5230\u95EE\u9898", "connection encountered a problem"],
    ["\u6B63\u5728\u8BFB\u53D6", "Loading "],
    ["\u8FDE\u63A5\u72B6\u6001", "connection status"],
    ["\u4E8C\u7EF4\u7801", "QR code"]
  ];
  let output = text5;
  for (const [source, target] of phrases) output = output.replaceAll(source, target);
  return output;
}
function localizeText(value) {
  if (typeof value !== "string") return value;
  const exact = translate(value);
  if (exact !== value || !isEnglish()) return exact;
  return translateDynamic(value);
}
var LOCALIZED_PROPS = Object.freeze([
  "aria-label",
  "alt",
  "placeholder",
  "title"
]);
function localizeChild(child) {
  if (typeof child === "string") return localizeText(child);
  if (Array.isArray(child)) return child.map(localizeChild);
  return child;
}
function h2(type, props, ...children) {
  let localizedProps = props;
  if (props) {
    for (const key of LOCALIZED_PROPS) {
      if (typeof props[key] === "string") {
        localizedProps = localizedProps === props ? { ...props } : localizedProps;
        localizedProps[key] = localizeText(props[key]);
      }
    }
  }
  return React2.createElement(type, localizedProps, ...children.map(localizeChild));
}

// plugin-src/client/credential-binding.js
function ActionIcon({ children }) {
  return h2("svg", {
    className: "dim-actionIcon",
    width: 15,
    height: 15,
    viewBox: "0 0 20 20",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true",
    focusable: "false"
  }, children);
}
function QrActionIcon() {
  return h2(
    ActionIcon,
    null,
    h2("path", {
      d: "M2.5 2.5h5v5h-5v-5Zm10 0h5v5h-5v-5Zm-10 10h5v5h-5v-5Z",
      stroke: "currentColor",
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    }),
    h2("path", {
      d: "M11.5 11.5h2v2h-2v-2Zm4 0h2v3h-2v-3Zm-4 4h3v2h-3v-2Zm5 1h1v1h-1v-1Z",
      fill: "currentColor"
    })
  );
}
function CredentialActionIcon() {
  return h2(
    ActionIcon,
    null,
    h2("circle", {
      cx: "6.25",
      cy: "10",
      r: "3.5",
      stroke: "currentColor",
      strokeWidth: "1.6"
    }),
    h2("path", {
      d: "M9.75 10h7.75m-2.5 0v2m-2.5-2v2",
      stroke: "currentColor",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    })
  );
}
function CredentialBindingPanel({
  channel: channel4,
  identityLabel,
  identityPlaceholder,
  secretLabel,
  secretPlaceholder,
  busy = false,
  error = null,
  onSubmit,
  onCancel
}) {
  const [identity, setIdentity] = React3.useState("");
  const [secret, setSecret] = React3.useState("");
  const headingId = React3.useId();
  const hasIdentity = Boolean(identityLabel);
  const submit = (event) => {
    event.preventDefault();
    const normalizedIdentity = identity.trim();
    const normalizedSecret = secret.trim();
    if (hasIdentity && !normalizedIdentity || !normalizedSecret || busy) return;
    void onSubmit?.({ identity: normalizedIdentity, secret: normalizedSecret });
  };
  return h2(
    "section",
    {
      className: "ddt-card dim-surfaceCard dim-credentialPanel",
      "aria-labelledby": headingId
    },
    h2("h3", { id: headingId, className: "dim-credentialTitle" }, `\u624B\u52A8\u63A5\u5165${channel4}\u673A\u5668\u4EBA`),
    h2(
      "form",
      {
        className: `dim-credentialForm${hasIdentity ? "" : " dim-credentialFormSingle"}`,
        onSubmit: submit
      },
      hasIdentity ? h2(
        "label",
        { className: "dim-credentialField" },
        h2("span", null, identityLabel),
        h2("input", {
          value: identity,
          onChange: (event) => setIdentity(event.target.value),
          placeholder: identityPlaceholder,
          maxLength: 512,
          autoCapitalize: "none",
          autoCorrect: "off",
          spellCheck: false,
          autoComplete: "off",
          disabled: busy,
          required: true
        })
      ) : null,
      h2(
        "label",
        { className: "dim-credentialField" },
        h2("span", null, secretLabel),
        h2("input", {
          type: "password",
          value: secret,
          onChange: (event) => setSecret(event.target.value),
          placeholder: secretPlaceholder,
          maxLength: 1024,
          autoCapitalize: "none",
          autoCorrect: "off",
          spellCheck: false,
          autoComplete: "new-password",
          disabled: busy,
          required: true
        })
      ),
      error ? h2("p", { className: "dim-credentialError", role: "alert" }, error.message ?? String(error)) : null,
      h2(
        "div",
        { className: "ddt-actions dim-viewActions dim-credentialActions" },
        h2("button", {
          type: "submit",
          className: "ddt-button",
          "data-kind": "primary",
          disabled: busy || hasIdentity && !identity.trim() || !secret.trim()
        }, busy ? "\u6B63\u5728\u7ED1\u5B9A\u2026" : "\u7ED1\u5B9A\u5E76\u8FDE\u63A5"),
        h2("button", {
          type: "button",
          className: "ddt-button",
          onClick: onCancel,
          disabled: busy
        }, "\u53D6\u6D88")
      )
    )
  );
}

// plugin-src/client/workspace-editor.js
var React5 = __toESM(require("react"), 1);

// plugin-src/client/workspace-directory-picker.js
var React4 = __toESM(require("react"), 1);
var import_react_dom = require("react-dom");
function pickerErrorCode(error) {
  return error?.rpcError?.code ?? error?.code;
}
function pickerErrorDetails(error) {
  return error?.rpcError?.details ?? error?.details;
}
function pickerErrorMessage(error) {
  return error?.rpcError?.message ?? error?.message ?? "\u65E0\u6CD5\u8BFB\u53D6\u76EE\u5F55\uFF0C\u8BF7\u91CD\u8BD5\u3002";
}
function FolderIcon() {
  return React4.createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    React4.createElement("path", { d: "M3.5 7.25A2.25 2.25 0 0 1 5.75 5h4.1l1.8 2h6.6a2.25 2.25 0 0 1 2.25 2.25v7A2.75 2.75 0 0 1 17.75 19h-12A2.25 2.25 0 0 1 3.5 16.75v-9.5Z" })
  );
}
function ChevronIcon() {
  return React4.createElement("svg", {
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, React4.createElement("path", { d: "m7.5 4.5 5 5.5-5 5.5" }));
}
function displayCrumbs(listing) {
  const homeIndex = listing.crumbs.findIndex((crumb) => crumb.path === listing.home);
  if (homeIndex < 0) return listing.crumbs;
  return listing.crumbs.slice(homeIndex);
}
function WorkspaceDirectoryPicker({
  open,
  startPath,
  picker,
  busy = false,
  saveError = null,
  onPicked,
  onCancel
}) {
  const [listing, setListing] = React4.useState(null);
  const [loading, setLoading] = React4.useState(false);
  const [error, setError] = React4.useState(null);
  const [showHidden, setShowHidden] = React4.useState(false);
  const [retryKey, setRetryKey] = React4.useState(0);
  const requestRef = React4.useRef(0);
  const controllerRef = React4.useRef(null);
  const dialogRef = React4.useRef(null);
  const bodyRef = React4.useRef(null);
  const titleId = React4.useId();
  const noticeId = React4.useId();
  const initialPathRef = React4.useRef(startPath);
  const onPickedRef = React4.useRef(onPicked);
  const onCancelRef = React4.useRef(onCancel);
  const busyRef = React4.useRef(busy);
  onPickedRef.current = onPicked;
  onCancelRef.current = onCancel;
  busyRef.current = busy;
  const loadDirectory = React4.useCallback(async (path, { reportError = true } = {}) => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    if (reportError) setError(null);
    try {
      const next = await picker.listDirectory(path, controller.signal);
      if (request !== requestRef.current || controller.signal.aborted) return { aborted: true };
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      setListing(next);
      setError(null);
      return { value: next };
    } catch (cause) {
      if (request !== requestRef.current || controller.signal.aborted) return { aborted: true };
      if (reportError) setError(pickerErrorMessage(cause));
      return { error: cause };
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [picker]);
  React4.useEffect(() => {
    if (!open) return void 0;
    let active = true;
    setListing(null);
    setError(null);
    setShowHidden(false);
    dialogRef.current?.focus?.();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busyRef.current) onCancelRef.current?.();
    };
    if (typeof document !== "undefined") document.addEventListener("keydown", handleKeyDown);
    const start = async () => {
      const initialPath = initialPathRef.current;
      const initial = await loadDirectory(initialPath || void 0, { reportError: false });
      if (!active || initial.aborted || initial.value) return;
      const code = pickerErrorCode(initial.error);
      const details = pickerErrorDetails(initial.error);
      if (code === "directory-picker-unavailable" && details?.capability === "native" && typeof picker.pickDirectory === "function") {
        setLoading(true);
        try {
          const selected = await picker.pickDirectory();
          if (!active) return;
          if (selected !== null) await onPickedRef.current?.(selected);
          else onCancelRef.current?.();
        } catch (cause) {
          if (active) setError(pickerErrorMessage(cause));
        } finally {
          if (active) setLoading(false);
        }
        return;
      }
      if (initialPath && code === "directory-unreadable") {
        const home = await loadDirectory(void 0, { reportError: false });
        if (!active || home.aborted || home.value) return;
        setError(pickerErrorMessage(home.error));
        return;
      }
      setError(pickerErrorMessage(initial.error));
    };
    void start();
    return () => {
      active = false;
      if (typeof document !== "undefined") document.removeEventListener("keydown", handleKeyDown);
      requestRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [loadDirectory, open, picker, retryKey]);
  if (!open) return null;
  const entries = (listing?.entries ?? []).filter((entry) => showHidden || !entry.hidden);
  const crumbs = listing ? displayCrumbs(listing) : [];
  const presentedError = saveError ?? error;
  const content = h2(
    "div",
    {
      className: "dim-directoryPickerBackdrop",
      onMouseDown: (event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }
    },
    h2(
      "section",
      {
        ref: dialogRef,
        className: "dim-directoryPicker",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": titleId,
        "aria-describedby": noticeId,
        tabIndex: -1
      },
      h2(
        "header",
        { className: "dim-directoryPickerHeader" },
        h2("h3", { id: titleId }, "\u9009\u62E9\u673A\u5668\u4EBA\u5DE5\u4F5C\u533A\u76EE\u5F55"),
        listing ? h2(
          "nav",
          { className: "dim-directoryCrumbs", "aria-label": "\u5F53\u524D\u76EE\u5F55" },
          crumbs.map((crumb, index) => h2(
            React4.Fragment,
            { key: crumb.path },
            index > 0 ? h2("span", { className: "dim-directoryCrumbSeparator", "aria-hidden": "true" }, "\u203A") : null,
            React4.createElement("button", {
              type: "button",
              title: crumb.path,
              disabled: loading || busy,
              "aria-current": index === crumbs.length - 1 ? "page" : void 0,
              onClick: () => void loadDirectory(crumb.path)
            }, crumb.path === listing.home ? h2("span", null, "\u4E3B\u76EE\u5F55") : crumb.name || crumb.path)
          ))
        ) : h2("p", null, "\u6B63\u5728\u51C6\u5907\u76EE\u5F55\u9009\u62E9\u5668\u2026")
      ),
      h2(
        "div",
        { ref: bodyRef, className: "dim-directoryPickerBody", "aria-busy": loading },
        loading && !listing ? h2(
          "div",
          { className: "dim-directoryPickerState" },
          h2("span", { className: "dim-directoryPickerSpinner", "aria-hidden": "true" }),
          h2("p", null, "\u6B63\u5728\u8BFB\u53D6\u76EE\u5F55\u2026")
        ) : listing ? entries.length > 0 ? h2("ul", { className: "dim-directoryList" }, entries.map((entry) => h2(
          "li",
          { key: entry.path },
          React4.createElement(
            "button",
            {
              type: "button",
              title: entry.path,
              disabled: loading || busy,
              onClick: () => void loadDirectory(entry.path)
            },
            h2("span", { className: "dim-directoryFolder" }, h2(FolderIcon)),
            React4.createElement("span", { className: "dim-directoryName" }, entry.name),
            h2("span", { className: "dim-directoryChevron" }, h2(ChevronIcon))
          )
        ))) : h2(
          "div",
          { className: "dim-directoryPickerState" },
          h2("p", null, "\u8FD9\u4E2A\u76EE\u5F55\u4E2D\u6CA1\u6709\u5B50\u6587\u4EF6\u5939\u3002")
        ) : null,
        listing?.truncated ? h2("p", { className: "dim-directoryPickerTruncated" }, "\u6B64\u76EE\u5F55\u7684\u5B50\u6587\u4EF6\u5939\u8FC7\u591A\uFF0C\u4EC5\u663E\u793A\u524D\u4E00\u90E8\u5206\u3002") : null,
        presentedError ? h2(
          "div",
          { className: "dim-directoryPickerError", role: "alert" },
          h2("span", null, presentedError),
          !listing && !busy ? h2("button", {
            type: "button",
            onClick: () => setRetryKey((value) => value + 1)
          }, "\u91CD\u8BD5") : null
        ) : null
      ),
      h2(
        "footer",
        { className: "dim-directoryPickerFooter" },
        h2(
          "button",
          {
            type: "button",
            className: "dim-directoryHidden",
            "aria-pressed": showHidden,
            onClick: () => setShowHidden((value) => !value),
            disabled: busy || !listing
          },
          h2("span", { className: "dim-directoryHiddenBox", "aria-hidden": "true" }),
          h2("span", null, "\u663E\u793A\u9690\u85CF\u6587\u4EF6\u5939")
        ),
        h2("p", { id: noticeId, className: "dim-directoryPickerNotice" }, "\u5207\u6362\u540E\u4F1A\u6E05\u9664\u8FD9\u4E2A\u673A\u5668\u4EBA\u7684\u65E7\u4F1A\u8BDD\u6620\u5C04\u3002"),
        h2(
          "div",
          { className: "dim-directoryPickerActions" },
          h2("button", { type: "button", onClick: onCancel, disabled: busy }, "\u53D6\u6D88"),
          h2("button", {
            type: "button",
            className: "dim-directoryPickerPrimary",
            disabled: busy || loading || !listing,
            onClick: () => listing && void onPicked(listing.path)
          }, busy ? "\u5207\u6362\u4E2D\u2026" : "\u9009\u62E9\u6B64\u76EE\u5F55")
        )
      )
    )
  );
  return typeof document === "undefined" ? content : (0, import_react_dom.createPortal)(content, document.body);
}

// plugin-src/client/workspace-editor.js
var WorkspaceDirectoryPickerContext = React5.createContext(null);
function WorkspaceEditor({ workspace, directoryPicker, disabled = false, onSave }) {
  const sharedDirectoryPicker = React5.useContext(WorkspaceDirectoryPickerContext);
  const activeDirectoryPicker = directoryPicker ?? sharedDirectoryPicker;
  const [open, setOpen] = React5.useState(false);
  const [saving, setSaving] = React5.useState(false);
  const [error, setError] = React5.useState(null);
  const editButtonRef = React5.useRef(null);
  const savingRef = React5.useRef(false);
  const close = React5.useCallback(() => {
    setOpen(false);
    setError(null);
    queueMicrotask(() => editButtonRef.current?.focus?.());
  }, []);
  const pick = React5.useCallback(async (value) => {
    if (!value || savingRef.current || disabled) return;
    if (value === workspace) {
      close();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave?.(value);
      close();
    } catch (cause) {
      setError(cause?.message ?? "\u5DE5\u4F5C\u533A\u4FEE\u6539\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [close, disabled, onSave, workspace]);
  return h2(
    "div",
    { className: "dim-workspace" },
    h2(
      "div",
      { className: "dim-workspaceHeader" },
      h2("span", null, "\u5F53\u524D\u5DE5\u4F5C\u533A"),
      h2("button", {
        type: "button",
        ref: editButtonRef,
        className: "dim-workspaceEdit",
        onClick: () => {
          setOpen(true);
          setError(null);
        },
        disabled: disabled || !activeDirectoryPicker
      }, "\u9009\u62E9\u76EE\u5F55")
    ),
    workspace ? React5.createElement("code", {
      className: "dim-workspacePath",
      title: workspace
    }, workspace) : h2("code", { className: "dim-workspacePath" }, "\u672A\u8BBE\u7F6E"),
    open ? h2(WorkspaceDirectoryPicker, {
      open,
      startPath: workspace,
      picker: activeDirectoryPicker,
      busy: saving || disabled,
      saveError: error,
      onPicked: pick,
      onCancel: close
    }) : null
  );
}

// plugin-src/client/workspace-snapshot-fence.js
var React6 = __toESM(require("react"), 1);
function useWorkspaceSnapshotFence() {
  const state = React6.useRef({ version: 0, pendingMutations: 0 });
  return React6.useMemo(() => Object.freeze({
    beginStatus() {
      return state.current.pendingMutations === 0 ? state.current.version : null;
    },
    canCommitStatus(version) {
      return version !== null && state.current.pendingMutations === 0 && state.current.version === version;
    },
    beginMutation() {
      state.current.pendingMutations += 1;
      state.current.version += 1;
      return state.current.version;
    },
    canCommitMutation(version) {
      return state.current.version === version;
    },
    endMutation() {
      state.current.pendingMutations = Math.max(0, state.current.pendingMutations - 1);
      return state.current.pendingMutations === 0;
    }
  }), []);
}

// plugin-src/client/channels/dingtalk/styles.js
var DINGTALK_STYLE_ID = "xmanrui-dsh-dingtalk-settings";
var CSS = String.raw`
.ddt-page {
  --ddt-accent: #1677ff;
  --ddt-accent-deep: #0958d9;
  --ddt-accent-wash: #eaf3ff;
  --ddt-success: var(--dsw-alias-state-success-primary, #20a162);
  --ddt-warning: var(--dsw-alias-state-warn-primary, #d97706);
  --ddt-error: var(--dsw-alias-state-error-primary, #d54941);
  width: 100%;
  max-width: 880px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 2px 0 28px;
  container-type: inline-size;
  color: var(--dsw-alias-label-primary, #1f2329);
  box-sizing: border-box;
}
.ddt-page *, .ddt-page *::before, .ddt-page *::after { box-sizing: border-box; }
.ddt-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.ddt-headingCopy { min-width: 0; }
.ddt-heading h2, .ddt-heading p, .ddt-card h3, .ddt-card h4, .ddt-card p { margin: 0; }
.ddt-eyebrow { margin-bottom: 3px; color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 12px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
.ddt-heading h2 { font-size: 20px; line-height: 28px; font-weight: 680; }
.ddt-heading p { margin-top: 5px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 20px; white-space: nowrap; }
.ddt-tools, .ddt-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.ddt-tools { width: 100%; justify-content: space-between; flex-wrap: nowrap; }
.ddt-badge { min-height: 30px; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px; border-radius: 999px; color: var(--dsw-alias-label-secondary, #646a73); background: var(--dsw-alias-bg-module-platform, #f2f3f5); font-size: 12px; white-space: nowrap; }
.ddt-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: #aeb3bb; }
.ddt-dot[data-tone="success"] { background: var(--ddt-success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ddt-success) 14%, transparent); }
.ddt-dot[data-tone="warning"] { background: var(--ddt-warning); }
.ddt-dot[data-tone="error"] { background: var(--ddt-error); }
.ddt-button { min-height: 34px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 13px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 8px; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-layer-1, #fff); font: inherit; font-size: 13px; font-weight: 560; text-decoration: none; cursor: pointer; transition: border-color .15s ease, background .15s ease, transform .15s ease; }
.ddt-button:hover:not(:disabled) { border-color: #aeb3bb; background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.ddt-button:active:not(:disabled) { transform: translateY(1px); }
.ddt-button:focus-visible { outline: 2px solid color-mix(in srgb, var(--ddt-accent) 70%, white); outline-offset: 2px; }
.ddt-button:disabled { cursor: not-allowed; opacity: .55; }
.ddt-button[data-kind="primary"] { color: #fff; border-color: var(--ddt-accent); background: var(--ddt-accent); }
.ddt-button[data-kind="primary"]:hover:not(:disabled) { border-color: var(--ddt-accent-deep); background: var(--ddt-accent-deep); }
.ddt-button[data-kind="danger"] { color: var(--ddt-error); }
.ddt-button[data-kind="quiet"] { min-height: 30px; padding: 0 10px; border-color: transparent; background: transparent; }
.ddt-card { overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, #e5e6eb); border-radius: 14px; background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: 0 1px 2px rgb(31 35 41 / 3%); }
.ddt-cardBody { padding: 24px; }
.ddt-empty { min-height: 230px; display: grid; grid-template-columns: minmax(0, 1fr) 180px; align-items: center; gap: 30px; }
.ddt-empty h3 { margin: 8px 0; font-size: 18px; }
.ddt-empty p { max-width: 560px; color: var(--dsw-alias-label-secondary, #646a73); line-height: 1.65; }
.ddt-empty .ddt-actions { margin-top: 20px; }
.ddt-brandMark { width: 110px; height: 110px; display: grid; place-items: center; justify-self: center; border-radius: 28px; color: #fff; background: linear-gradient(145deg, #2997ff, var(--ddt-accent)); box-shadow: 0 18px 45px rgb(22 119 255 / 23%); }
.ddt-brandMark svg { filter: drop-shadow(0 3px 8px rgb(0 35 96 / 16%)); }
.ddt-qrLayout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 34px; align-items: start; }
.ddt-qrColumn { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.ddt-qrFrame { position: relative; width: min(270px, 100%); aspect-ratio: 1; display: grid; place-items: center; overflow: hidden; padding: 10px; border: 1px solid var(--dsw-alias-border-l2, #e5e6eb); border-radius: 16px; background: #fff; }
.ddt-qrFrame::before { content: ''; position: absolute; inset: 6px; border: 1px solid rgb(22 119 255 / 10%); border-radius: 11px; pointer-events: none; }
.ddt-qrFrame img { display: block; width: 100%; height: 100%; object-fit: contain; }
.ddt-qrFallback { padding: 24px; color: #646a73; text-align: center; }
.ddt-expired { position: absolute; inset: 0; display: grid; place-items: center; padding: 30px; color: #fff; text-align: center; font-weight: 650; white-space: pre-line; background: rgb(31 35 41 / 76%); backdrop-filter: blur(3px); }
.ddt-countdown { width: min(270px, 100%); color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; }
.ddt-countdownTop { display: flex; justify-content: space-between; margin-bottom: 6px; }
.ddt-countdown strong { color: var(--dsw-alias-label-primary, #1f2329); font-variant-numeric: tabular-nums; }
.ddt-progress { height: 4px; overflow: hidden; border-radius: 99px; background: #eef0f3; }
.ddt-progress span { display: block; width: var(--ddt-progress); height: 100%; background: var(--ddt-accent); transition: width .2s linear; }
.ddt-stateLabel { display: inline-flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; font-weight: 600; }
.ddt-qrCopy { min-width: 0; overflow-wrap: anywhere; }
.ddt-qrCopy h3 { margin: 9px 0 8px; font-size: 18px; }
.ddt-qrCopy > p { color: var(--dsw-alias-label-secondary, #646a73); line-height: 1.65; }
.ddt-steps { margin: 18px 0 16px; padding: 0; list-style: none; counter-reset: ddt-step; }
.ddt-steps li { position: relative; min-height: 28px; padding: 3px 0 3px 36px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 22px; counter-increment: ddt-step; }
.ddt-steps li::before { content: counter(ddt-step); position: absolute; left: 0; top: 1px; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; color: var(--ddt-accent-deep); background: var(--ddt-accent-wash); font-size: 12px; font-weight: 700; }
.ddt-loading { padding: 38px; color: var(--dsw-alias-label-secondary, #646a73); text-align: center; }
.ddt-loading h3 { margin: 0 0 7px; color: var(--dsw-alias-label-primary, #1f2329); font-size: 17px; }
.ddt-loading p { line-height: 1.6; }
.ddt-spinner { width: 24px; height: 24px; margin: 0 auto 13px; border: 3px solid #e6e8eb; border-top-color: var(--ddt-accent); border-radius: 50%; animation: ddt-spin .8s linear infinite; }
.ddt-statusNotice, .ddt-inlineError { display: flex; align-items: flex-start; gap: 10px; padding: 13px 15px; border: 1px solid color-mix(in srgb, var(--ddt-error) 28%, transparent); border-radius: 10px; color: var(--ddt-error); background: color-mix(in srgb, var(--ddt-error) 7%, transparent); font-size: 13px; }
.ddt-inlineError { flex-direction: column; padding: 22px; }
.ddt-inlineError h3 { font-size: 17px; }
.ddt-inlineError p { line-height: 1.55; }
.ddt-errorCode { font: 11px ui-monospace, SFMono-Regular, monospace; opacity: .8; }
.ddt-listHeading { display: flex; align-items: center; justify-content: space-between; margin: 2px 0 9px; }
.ddt-listHeading h3 { margin: 0; font-size: 14px; }
.ddt-list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.ddt-accountTop { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.ddt-accountIdentity { min-width: 0; display: flex; align-items: center; gap: 12px; }
.ddt-avatar { width: 42px; height: 42px; display: grid; place-items: center; flex: none; border-radius: 12px; color: #fff; background: linear-gradient(145deg, #2997ff, var(--ddt-accent)); }
.ddt-accountIdentity h3 { overflow: hidden; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.ddt-accountIdentity p { margin-top: 4px; color: var(--dsw-alias-label-secondary, #646a73); font: 12px ui-monospace, SFMono-Regular, monospace; }
.ddt-health { display: inline-flex; align-items: center; gap: 7px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; white-space: nowrap; }
.ddt-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 20px 0; }
.ddt-metric { min-width: 0; padding: 12px; border-radius: 9px; background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.ddt-metric dt { color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 11px; }
.ddt-metric dd { overflow: hidden; margin: 5px 0 0; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.ddt-accountFooter { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding-top: 16px; border-top: 1px solid var(--dsw-alias-border-l1, #eef0f3); }
.ddt-accountFooter .ddt-actions { flex: none; flex-wrap: nowrap; gap: 8px; margin-top: 0; }
.ddt-accountFooter .ddt-button { flex: none; white-space: nowrap; }
.ddt-summary { color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; }
.ddt-confirm { padding: 18px 24px; border-top: 1px solid color-mix(in srgb, var(--ddt-error) 25%, transparent); background: color-mix(in srgb, var(--ddt-error) 5%, transparent); }
.ddt-confirm strong { display: block; margin-bottom: 6px; font-size: 14px; }
.ddt-confirm p { color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: 1.55; }
.ddt-confirm .ddt-actions { margin-top: 13px; }
.ddt-visuallyHidden { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@keyframes ddt-spin { to { transform: rotate(360deg); } }
@container (max-width: 680px) {
  .ddt-heading { flex-direction: column; align-items: stretch; }
  .ddt-tools { width: 100%; flex-wrap: nowrap; gap: 6px; }
  .ddt-tools .ddt-badge { min-height: 34px; padding-inline: 8px; }
  .ddt-tools .ddt-button { flex: none; padding-inline: 10px; white-space: nowrap; }
  .ddt-empty { grid-template-columns: minmax(0, 1fr); }
  .ddt-brandMark { display: none; }
  .ddt-qrLayout { grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 24px; }
  .ddt-qrColumn { width: 100%; min-width: 0; }
  .ddt-qrCopy { width: 100%; }
  .ddt-metrics { gap: 8px; }
  .ddt-metric { padding: 10px; }
}
@media (max-width: 720px) {
  .ddt-heading, .ddt-accountTop { flex-direction: column; align-items: stretch; }
  .ddt-heading p { white-space: normal; }
  .ddt-empty { grid-template-columns: minmax(0, 1fr); }
  .ddt-brandMark { display: none; }
  .ddt-qrLayout { grid-template-columns: minmax(0, 1fr); justify-items: center; }
  .ddt-qrCopy { width: 100%; }
  .ddt-cardBody { padding: 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .ddt-page *, .ddt-page *::before, .ddt-page *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;
function installDingtalkStyles() {
  if (typeof document === "undefined") return () => {
  };
  const existing = document.querySelector(`style[data-plugin-css="${DINGTALK_STYLE_ID}"]`);
  if (existing) return () => {
  };
  const style = document.createElement("style");
  style.dataset.plugin = "@xmanrui/dsh-dingtalk";
  style.dataset.pluginCss = DINGTALK_STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
  return () => style.remove();
}

// plugin-src/client/channels/dingtalk/index.js
var ACTIVE_PROVISION_STATES = /* @__PURE__ */ new Set(["pending", "scanned", "authorizing", "creating", "connecting"]);
function DingtalkIcon({ size = 28 }) {
  return h2("svg", {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true",
    focusable: "false"
  }, h2("path", {
    fill: "currentColor",
    d: "M37.05 22.783c-6.758-5.216-14.378-12.128-22.73-19.538-.655-.585-1.242-.354-1.536.42-1.88 4.973-.058 9.386 2.889 11.932s7.368 4.912 10.058 6.155c.105.049.013.203-.093.163-4.953-2.182-8.397-3.765-13.07-7.368-.497-.388-1.01-.242-1.07.521-.384 4.748 2.657 8.483 6.058 9.745 2.1.781 4.398 1.212 6.53 1.474.109.015.084.178-.027.178-2.747.01-6.058-.654-8.935-1.751-.606-.233-.818.25-.722.633.491 2.008 2.974 5.076 6.926 5.73a12 12 0 0 0 2.228.115c.164 0 .208.089.154.217q-2.685 4.6-2.803 4.797c-.091.152-.036.275.156.275h3.543c.164 0 .264.106.18.246l-4.958 8.196c-.191.328.035.565.395.301s15.212-11.133 15.636-11.448c.195-.142.148-.327-.124-.327h-3.18c-.206 0-.252-.14-.111-.28.14-.141 3.602-3.594 4.837-4.888 1.283-1.35 1.938-3.825-.231-5.498"
  }));
}
var Button = React7.forwardRef(function Button2({ children, kind = "secondary", className = "", ...props }, ref) {
  return h2("button", {
    ...props,
    ref,
    type: "button",
    className: `ddt-button ${className}`.trim(),
    "data-kind": kind
  }, children);
});
function Heading({ totals, adding, busy, onAdd, onCredential, credentialOpen, addButtonRef }) {
  return h2(
    "div",
    { className: "ddt-heading" },
    h2(
      "div",
      { className: "ddt-headingCopy" },
      h2("div", { className: "ddt-eyebrow" }, "Channel"),
      h2("h2", null, "\u9489\u9489\u673A\u5668\u4EBA"),
      h2("p", null, "\u901A\u8FC7\u626B\u7801\u628A\u9489\u9489\u673A\u5668\u4EBA\u63A5\u5165 DeepSeek Harness")
    ),
    h2(
      "div",
      { className: "ddt-tools" },
      h2(
        "div",
        { className: "dim-bindActions" },
        h2(Button, {
          kind: "primary",
          className: "dim-scanButton",
          onClick: onAdd,
          disabled: adding || busy,
          ref: addButtonRef,
          "aria-label": "\u626B\u7801\u63A5\u5165\u9489\u9489\u673A\u5668\u4EBA"
        }, h2(QrActionIcon), adding ? "\u6B63\u5728\u63A5\u5165" : "\u626B\u7801\u63A5\u5165\u673A\u5668\u4EBA"),
        h2(Button, {
          kind: "credential",
          className: "dim-credentialButton",
          onClick: onCredential,
          disabled: adding || busy,
          "aria-pressed": credentialOpen,
          "aria-label": "\u4F7F\u7528 Client ID \u548C Client Secret \u7ED1\u5B9A\u9489\u9489\u673A\u5668\u4EBA"
        }, h2(CredentialActionIcon), credentialOpen ? "\u6536\u8D77\u51ED\u636E" : "\u624B\u52A8\u63A5\u5165")
      ),
      totals.configured > 0 ? h2(
        "div",
        { className: "ddt-badge dim-onlineBadge" },
        h2("span", null, `${totals.connected} / ${totals.configured} \u5728\u7EBF`)
      ) : null
    )
  );
}
function LoadingView() {
  return h2(
    "div",
    { className: "ddt-card ddt-loading dim-surfaceCard dim-loadingView", "aria-busy": "true" },
    h2("div", { className: "ddt-spinner dim-spinner" }),
    h2("span", null, "\u6B63\u5728\u8BFB\u53D6\u9489\u9489\u8FDE\u63A5\u72B6\u6001\u2026")
  );
}
function EmptyView({ busy, onStart }) {
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-cardBody ddt-empty dim-surfaceBody dim-emptyView" },
      h2(
        "div",
        { className: "dim-emptyCopy" },
        h2(
          "div",
          { className: "ddt-stateLabel dim-stateLabel" },
          h2("span", { className: "ddt-dot dim-stateDot" }),
          h2("span", null, "\u5C1A\u672A\u63A5\u5165\u9489\u9489\u673A\u5668\u4EBA")
        ),
        h2("h3", null, "\u626B\u4E00\u6B21\u7801\uFF0C\u81EA\u52A8\u521B\u5EFA\u5E76\u8FDE\u63A5\u673A\u5668\u4EBA"),
        h2("p", null, "\u6388\u6743\u7531\u9489\u9489\u5B98\u65B9\u9875\u9762\u5B8C\u6210\u3002\u626B\u7801\u8D26\u53F7\u5FC5\u987B\u5DF2\u52A0\u5165\u4E00\u4E2A\u4F01\u4E1A/\u7EC4\u7EC7\u5E76\u6709\u6743\u521B\u5EFA\u673A\u5668\u4EBA\uFF1B\u521B\u5EFA\u6210\u529F\u540E\uFF0C\u5E94\u7528\u51ED\u636E\u4F1A\u76F4\u63A5\u5199\u5165 Harness Host\u3002"),
        h2(
          "div",
          { className: "ddt-actions dim-viewActions" },
          h2(
            Button,
            { kind: "primary", onClick: onStart, disabled: busy },
            busy ? "\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801\u2026" : "\u751F\u6210\u9489\u9489\u4E8C\u7EF4\u7801"
          )
        )
      ),
      h2(
        "div",
        { className: "ddt-brandMark dim-emptyBrand", "aria-hidden": "true" },
        h2(DingtalkIcon, { size: 68 })
      )
    )
  );
}
function QrPanel({ provision, now, busy, onRefresh, onCancel }) {
  const [imageFailed, setImageFailed] = React7.useState(false);
  const source = safeQrSource(provision.qrCodeDataUrl);
  const remaining = Math.max(0, provision.expiresAt - now);
  const expired = remaining === 0 || provision.status === "expired";
  const duration = Math.max(1, provision.durationMs ?? 10 * 6e4);
  const progress = Math.round(Math.min(1, remaining / duration) * 100);
  React7.useEffect(() => setImageFailed(false), [source]);
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-cardBody ddt-qrLayout dim-surfaceBody dim-qrLayout" },
      h2(
        "div",
        { className: "ddt-qrColumn dim-qrColumn" },
        h2(
          "div",
          { className: "ddt-qrFrame dim-qrFrame" },
          source && !imageFailed ? h2("img", {
            src: source,
            alt: "\u7528\u4E8E\u628A\u9489\u9489\u673A\u5668\u4EBA\u63A5\u5165 DeepSeek Harness \u7684\u4E00\u6B21\u6027\u4E8C\u7EF4\u7801",
            onError: () => setImageFailed(true)
          }) : h2("div", { className: "ddt-qrFallback dim-qrFallback" }, "\u4E8C\u7EF4\u7801\u56FE\u7247\u672A\u5C31\u7EEA\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210\u3002"),
          expired ? h2("div", { className: "ddt-expired dim-qrExpired" }, "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\n\u8BF7\u91CD\u65B0\u751F\u6210") : null
        ),
        h2(
          "div",
          { className: "ddt-countdown dim-countdown" },
          h2(
            "div",
            { className: "ddt-countdownTop dim-countdownTop" },
            h2("span", null, "\u4E8C\u7EF4\u7801\u6709\u6548\u65F6\u95F4"),
            h2("strong", null, formatRemaining(remaining))
          ),
          h2(
            "div",
            { className: "ddt-progress dim-progress", "aria-hidden": "true" },
            h2("span", { style: { "--ddt-progress": `${progress}%` } })
          )
        )
      ),
      h2(
        "div",
        { className: "ddt-qrCopy dim-qrCopy" },
        h2(
          "div",
          { className: "ddt-stateLabel dim-stateLabel" },
          h2("span", { className: "ddt-dot dim-stateDot", "data-tone": expired ? "error" : "warning" }),
          h2("span", null, expired ? "\u4E8C\u7EF4\u7801\u5DF2\u5931\u6548" : "\u7B49\u5F85\u9489\u9489\u626B\u7801\u6388\u6743")
        ),
        h2("h3", null, expired ? "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801\u540E\u7EE7\u7EED" : "\u4F7F\u7528\u9489\u9489 App \u5B8C\u6210\u673A\u5668\u4EBA\u6388\u6743"),
        h2("p", null, "\u626B\u7801\u8D26\u53F7\u5FC5\u987B\u5DF2\u52A0\u5165\u4F01\u4E1A/\u7EC4\u7EC7\u3002\u5982\u679C\u9489\u9489\u63D0\u793A\u5C1A\u672A\u52A0\u5165\u7EC4\u7EC7\uFF0C\u8BF7\u5728\u63D0\u793A\u9875\u521B\u5EFA\u7EC4\u7EC7\uFF0C\u6216\u6362\u7528\u5DF2\u52A0\u5165\u7EC4\u7EC7\u7684\u8D26\u53F7\u3002"),
        h2(
          "ol",
          { className: "ddt-steps dim-steps" },
          h2("li", null, "\u4F7F\u7528\u5DF2\u52A0\u5165\u4F01\u4E1A/\u7EC4\u7EC7\u7684\u9489\u9489\u8D26\u53F7\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801"),
          h2("li", null, "\u5728\u6388\u6743\u9875\u70B9\u51FB\u201C\u4E00\u952E\u521B\u5EFA\u65B0\u673A\u5668\u4EBA\u201D"),
          h2("li", null, "\u4FDD\u6301\u672C\u9875\u6253\u5F00\uFF0C\u7B49\u5F85\u673A\u5668\u4EBA\u81EA\u52A8\u8FDE\u63A5")
        ),
        h2(
          "div",
          { className: "ddt-actions dim-viewActions" },
          expired ? h2(Button, { kind: "primary", onClick: onRefresh, disabled: busy }, "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801") : null,
          !expired ? h2(Button, { onClick: onRefresh, disabled: busy }, "\u6362\u4E00\u4E2A\u4E8C\u7EF4\u7801") : null,
          h2(Button, { onClick: onCancel, disabled: busy }, "\u53D6\u6D88")
        )
      )
    )
  );
}
function ProgressPanel({ status, busy, onCancel }) {
  const connecting = status === "connecting";
  const creating = status === "creating";
  return h2(
    "div",
    { className: "ddt-card ddt-loading dim-surfaceCard dim-loadingView", "aria-busy": "true" },
    h2("div", { className: "ddt-spinner dim-spinner" }),
    h2("h3", null, connecting ? "\u673A\u5668\u4EBA\u5DF2\u521B\u5EFA\uFF0C\u6B63\u5728\u5EFA\u7ACB\u6D88\u606F\u8FDE\u63A5" : creating ? "\u6388\u6743\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u521B\u5EFA\u9489\u9489\u673A\u5668\u4EBA" : "\u6B63\u5728\u786E\u8BA4\u9489\u9489\u6388\u6743"),
    h2("p", null, connecting ? "\u6B63\u5728\u68C0\u67E5\u9489\u9489 Stream \u957F\u8FDE\u63A5\uFF0C\u6210\u529F\u540E\u4F1A\u81EA\u52A8\u663E\u793A\u4E3A\u5728\u7EBF\u3002" : "\u8BF7\u52FF\u5173\u95ED\u672C\u9875\uFF0C\u9489\u9489\u5B8C\u6210\u6388\u6743\u540E\u5C06\u81EA\u52A8\u7EE7\u7EED\u3002"),
    h2(
      "div",
      { className: "ddt-actions dim-viewActions", style: { justifyContent: "center", marginTop: 14 } },
      h2(Button, { onClick: onCancel, disabled: busy }, "\u53D6\u6D88\u63A5\u5165")
    )
  );
}
function ProvisionError({ provision, busy, onRetry, onClose }) {
  const error = provision.error ?? {
    code: "DINGTALK_PROVISION_FAILED",
    message: "\u9489\u9489\u673A\u5668\u4EBA\u6CA1\u6709\u63A5\u5165\u5B8C\u6210"
  };
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-inlineError dim-inlineError", role: "alert" },
      h2("h3", null, provision.status === "expired" ? "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F" : "\u9489\u9489\u673A\u5668\u4EBA\u6CA1\u6709\u63A5\u5165\u5B8C\u6210"),
      h2("p", null, error.message),
      h2("span", { className: "ddt-errorCode" }, error.code),
      h2(
        "div",
        { className: "ddt-actions dim-viewActions" },
        h2(Button, { kind: "primary", onClick: onRetry, disabled: busy }, "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801"),
        h2(Button, { onClick: onClose, disabled: busy }, "\u5173\u95ED")
      )
    )
  );
}
function checkedTime(value) {
  if (!value) return "\u5C1A\u672A\u68C0\u67E5";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(value));
  } catch {
    return "\u521A\u521A";
  }
}
function RemoveConfirmation({ account, busy, onConfirm, onCancel }) {
  const cancelRef = React7.useRef(null);
  React7.useEffect(() => cancelRef.current?.focus(), []);
  return h2(
    "div",
    {
      className: "ddt-confirm dim-confirm",
      role: "alertdialog",
      "aria-label": `\u79FB\u9664${account.bot.name}`,
      onKeyDown: (event) => {
        if (event.key === "Escape" && !busy) onCancel();
      }
    },
    h2("strong", null, `\u4ECE DeepSeek Harness \u79FB\u9664\u201C${account.bot.name}\u201D\uFF1F`),
    h2("p", null, "\u8FD9\u4F1A\u505C\u6B62\u6D88\u606F\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684\u5E94\u7528\u51ED\u636E\u3001\u673A\u5668\u4EBA\u914D\u7F6E\u53CA\u4F1A\u8BDD\u6620\u5C04\u3002\u9489\u9489\u5F00\u653E\u5E73\u53F0\u4E2D\u7684\u673A\u5668\u4EBA\u4E0D\u4F1A\u88AB\u81EA\u52A8\u5220\u9664\u3002"),
    h2(
      "div",
      { className: "ddt-actions dim-viewActions" },
      h2(Button, { ref: cancelRef, onClick: onCancel, disabled: busy }, "\u4FDD\u7559\u673A\u5668\u4EBA"),
      h2(
        Button,
        { kind: "danger", onClick: onConfirm, disabled: busy },
        busy ? "\u6B63\u5728\u79FB\u9664\u2026" : "\u786E\u8BA4\u79FB\u9664\u63A5\u5165"
      )
    )
  );
}
function AccountCard({
  account,
  busy,
  feedback,
  removing,
  onReconnect,
  onWorkspaceSave,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove
}) {
  const state = busy === "reconnect" ? "connecting" : account.state;
  const tone = account.connected ? "success" : state === "error" ? "error" : "warning";
  const stateLabel = account.connected ? "\u8FD0\u884C\u6B63\u5E38" : state === "connecting" ? "\u6B63\u5728\u8FDE\u63A5" : "\u8FDE\u63A5\u672A\u5C31\u7EEA";
  const summary = account.error?.message ?? (account.connected ? null : account.health.summary);
  return h2(
    "article",
    { className: "ddt-card dim-botCard", tabIndex: -1, "data-bot-id": account.botId },
    h2(
      "div",
      { className: "ddt-cardBody dim-botCardBody" },
      h2(
        "div",
        { className: "ddt-accountTop dim-botCardTop" },
        h2(
          "div",
          { className: "ddt-accountIdentity dim-botIdentity" },
          h2("div", { className: "ddt-avatar dim-botAvatar", "aria-hidden": "true" }, h2(DingtalkIcon, { size: 29 })),
          h2(
            "div",
            { className: "dim-botName" },
            h2("h3", { title: account.bot.name }, account.bot.name),
            h2("p", { title: account.bot.clientIdMasked }, account.bot.clientIdMasked)
          )
        ),
        h2(
          "div",
          { className: "ddt-health dim-botHealth" },
          h2("span", { className: "ddt-dot dim-healthDot", "data-tone": tone }),
          h2("span", null, stateLabel)
        )
      ),
      h2(
        "dl",
        { className: "ddt-metrics dim-botMetrics" },
        h2(
          "div",
          { className: "ddt-metric dim-botMetric" },
          h2("dt", null, "\u6D88\u606F\u901A\u9053"),
          h2("dd", null, account.connected ? "Stream \u957F\u8FDE\u63A5" : "\u79BB\u7EBF")
        ),
        h2(
          "div",
          { className: "ddt-metric dim-botMetric" },
          h2("dt", null, "\u6700\u8FD1\u68C0\u67E5"),
          h2("dd", null, checkedTime(account.health.lastCheckedAt))
        )
      ),
      h2(WorkspaceEditor, {
        workspace: account.workspace,
        disabled: Boolean(busy),
        onSave: onWorkspaceSave
      }),
      h2(
        "div",
        { className: "ddt-accountFooter dim-cardFooter" },
        summary ? h2("div", { className: "ddt-summary dim-cardSummary" }, summary) : null,
        feedback ? h2("div", {
          className: "ddt-summary dim-cardSummary",
          role: "status"
        }, feedback) : null,
        h2(
          "div",
          { className: "ddt-actions dim-cardActions" },
          h2(
            Button,
            { className: "dim-cardAction", onClick: onReconnect, disabled: Boolean(busy) },
            busy === "reconnect" ? "\u68C0\u67E5\u4E2D\u2026" : account.connected ? "\u68C0\u67E5\u8FDE\u63A5" : "\u91CD\u8BD5\u8FDE\u63A5"
          ),
          h2(
            Button,
            { className: "dim-cardAction", kind: "danger", onClick: onRequestRemove, disabled: Boolean(busy) },
            "\u79FB\u9664\u63A5\u5165"
          )
        )
      )
    ),
    removing ? h2(RemoveConfirmation, {
      account,
      busy: busy === "delete",
      onConfirm: onConfirmRemove,
      onCancel: onCancelRemove
    }) : null
  );
}
function AccountList(props) {
  return h2(
    "section",
    { className: "dim-listSection" },
    h2(
      "div",
      { className: "ddt-listHeading dim-listHeading" },
      h2("h3", null, "\u5DF2\u63A5\u5165\u7684\u9489\u9489\u673A\u5668\u4EBA")
    ),
    h2("ul", { className: "ddt-list dim-botList" }, props.bots.map((account) => h2(
      "li",
      { key: account.botId },
      h2(AccountCard, {
        account,
        busy: props.busyByBot[account.botId],
        feedback: props.feedbackByBot[account.botId]?.message,
        removing: props.removeTarget === account.botId,
        onReconnect: () => props.onReconnect(account),
        onWorkspaceSave: (workspace) => props.onWorkspaceSave(account, workspace),
        onRequestRemove: () => props.onRequestRemove(account),
        onConfirmRemove: () => props.onConfirmRemove(account),
        onCancelRemove: props.onCancelRemove
      })
    )))
  );
}
var EMPTY_TOTALS = Object.freeze({ configured: 0, connected: 0 });
function DingtalkSettingsTab({ rpcCall }) {
  const [model, setModel] = React7.useState({
    phase: "loading",
    bots: [],
    totals: EMPTY_TOTALS,
    revision: 0,
    error: null
  });
  const [provision, setProvision] = React7.useState(null);
  const [busy, setBusy] = React7.useState(false);
  const [busyByBot, setBusyByBot] = React7.useState({});
  const [feedbackByBot, setFeedbackByBot] = React7.useState({});
  const [removeTarget, setRemoveTarget] = React7.useState(null);
  const [credentialOpen, setCredentialOpen] = React7.useState(false);
  const [credentialError, setCredentialError] = React7.useState(null);
  const [notice, setNotice] = React7.useState("");
  const [now, setNow] = React7.useState(() => Date.now());
  const addButtonRef = React7.useRef(null);
  const mountedRef = React7.useRef(true);
  const statusRequestRef = React7.useRef(0);
  const workspaceFence = useWorkspaceSnapshotFence();
  const noticeFrameRef = React7.useRef(null);
  const focusFrameRef = React7.useRef(null);
  React7.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      statusRequestRef.current += 1;
      if (noticeFrameRef.current !== null) {
        window.cancelAnimationFrame(noticeFrameRef.current);
        noticeFrameRef.current = null;
      }
      if (focusFrameRef.current !== null) {
        window.cancelAnimationFrame(focusFrameRef.current);
        focusFrameRef.current = null;
      }
    };
  }, []);
  React7.useEffect(() => installDingtalkStyles(), []);
  const announce = React7.useCallback((message) => {
    if (!mountedRef.current) return;
    if (noticeFrameRef.current !== null) {
      window.cancelAnimationFrame(noticeFrameRef.current);
      noticeFrameRef.current = null;
    }
    setNotice("");
    if (message) {
      noticeFrameRef.current = window.requestAnimationFrame(() => {
        noticeFrameRef.current = null;
        if (mountedRef.current) setNotice(message);
      });
    }
  }, []);
  const discardStaleFeedback = React7.useCallback((snapshot) => {
    const botsById = new Map(snapshot.bots.map((bot) => [bot.botId, bot]));
    setFeedbackByBot((current) => {
      let changed = false;
      const next = { ...current };
      for (const [botId, feedback] of Object.entries(next)) {
        const bot = botsById.get(botId);
        if (!bot || feedback.clearWhenDisconnected && (!bot.connected || bot.error)) {
          delete next[botId];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, []);
  const focusAddButton = React7.useCallback(() => {
    if (!mountedRef.current) return;
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      if (mountedRef.current) addButtonRef.current?.focus();
    });
  }, []);
  const invoke = React7.useCallback(async (endpoint, payload = {}, signal) => {
    if (typeof rpcCall !== "function") throw new TypeError("\u9489\u9489\u8BBE\u7F6E\u9875\u7F3A\u5C11 RPC \u8FDE\u63A5");
    return unwrapRpcResult(await rpcCall(endpoint, payload, signal));
  }, [rpcCall]);
  const loadStatus = React7.useCallback(async ({
    signal,
    silent = false,
    restoreProvisioning = false
  } = {}) => {
    if (!mountedRef.current || signal?.aborted) return void 0;
    const workspaceVersion = workspaceFence.beginStatus();
    if (workspaceVersion === null) return void 0;
    const requestId = statusRequestRef.current + 1;
    statusRequestRef.current = requestId;
    const canCommit = () => mountedRef.current && !signal?.aborted && statusRequestRef.current === requestId && workspaceFence.canCommitStatus(workspaceVersion);
    if (!silent && canCommit()) {
      setModel((current) => ({ ...current, phase: "loading", error: null }));
    }
    try {
      const snapshot = normalizeSnapshot(await invoke(DINGTALK_ENDPOINTS.status, {}, signal));
      if (!canCommit()) return void 0;
      setModel({
        phase: "ready",
        bots: snapshot.bots,
        totals: snapshot.totals,
        revision: snapshot.revision,
        error: null
      });
      discardStaleFeedback(snapshot);
      if (restoreProvisioning && snapshot.provisioning) {
        setProvision((current) => !current || current.attemptId === snapshot.provisioning.attemptId ? {
          ...current,
          ...snapshot.provisioning,
          durationMs: current?.durationMs ?? Math.max(1, snapshot.provisioning.expiresAt - Date.now())
        } : current);
      }
      return snapshot;
    } catch (error) {
      if (error?.name === "AbortError" || !canCommit()) return void 0;
      setModel((current) => ({
        ...current,
        phase: silent && current.phase === "ready" ? "ready" : "error",
        error: presentError(error)
      }));
      return void 0;
    }
  }, [discardStaleFeedback, invoke, workspaceFence]);
  React7.useEffect(() => {
    const controller = new AbortController();
    void loadStatus({ signal: controller.signal, restoreProvisioning: true });
    return () => controller.abort();
  }, [loadStatus]);
  React7.useEffect(() => {
    if (model.phase !== "ready") return void 0;
    const controller = new AbortController();
    let running = false;
    const timer = window.setInterval(async () => {
      if (running || controller.signal.aborted || !mountedRef.current) return;
      running = true;
      await loadStatus({
        signal: controller.signal,
        silent: true,
        restoreProvisioning: false
      });
      running = false;
    }, 15e3);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadStatus, model.phase]);
  React7.useEffect(() => {
    if (!provision || !ACTIVE_PROVISION_STATES.has(provision.status)) return void 0;
    const timer = window.setInterval(() => {
      if (mountedRef.current) setNow(Date.now());
    }, 1e3);
    return () => window.clearInterval(timer);
  }, [provision?.attemptId, provision?.status]);
  const startProvisioning = React7.useCallback(async ({ replace = false } = {}) => {
    if (!mountedRef.current) return;
    setCredentialOpen(false);
    setCredentialError(null);
    setBusy(true);
    try {
      if (replace && provision?.attemptId) {
        await invoke(DINGTALK_ENDPOINTS.cancelProvisioning, {
          attemptId: provision.attemptId
        });
        if (!mountedRef.current) return;
      }
      setProvision({ status: "starting" });
      const started = normalizeProvisioning(await invoke(
        DINGTALK_ENDPOINTS.beginProvisioning,
        { locale: "zh-CN" }
      ));
      if (!mountedRef.current) return;
      if (!started.qrCodeDataUrl) {
        throw new Error("\u9489\u9489\u626B\u7801\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u5B89\u5168\u7684\u4E8C\u7EF4\u7801");
      }
      setNow(Date.now());
      setProvision({
        ...started,
        durationMs: Math.max(1, started.expiresAt - Date.now())
      });
      announce("\u9489\u9489\u4E8C\u7EF4\u7801\u5DF2\u751F\u6210\uFF0C\u8BF7\u4F7F\u7528\u9489\u9489 App \u626B\u63CF\u3002");
    } catch (error) {
      if (!mountedRef.current) return;
      setProvision({
        attemptId: provision?.attemptId,
        status: "failed",
        error: presentError(error)
      });
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [announce, invoke, provision?.attemptId]);
  const bindCredentials = React7.useCallback(async ({ identity, secret }) => {
    if (!mountedRef.current) return;
    const snapshotVersion = workspaceFence.beginMutation();
    setBusy(true);
    setCredentialError(null);
    try {
      const snapshot = normalizeSnapshot(await invoke(
        DINGTALK_ENDPOINTS.bindCredentials,
        { clientId: identity, clientSecret: secret }
      ));
      if (!mountedRef.current) return;
      if (workspaceFence.canCommitMutation(snapshotVersion)) {
        setModel({
          phase: "ready",
          bots: snapshot.bots,
          totals: snapshot.totals,
          revision: snapshot.revision,
          error: null
        });
        discardStaleFeedback(snapshot);
      }
      setCredentialOpen(false);
      announce("\u9489\u9489\u673A\u5668\u4EBA\u51ED\u636E\u5DF2\u7ED1\u5B9A\u3002");
    } catch (error) {
      if (mountedRef.current) setCredentialError(presentError(error));
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mountedRef.current) void loadStatus({ silent: true });
      if (mountedRef.current) setBusy(false);
    }
  }, [announce, discardStaleFeedback, invoke, loadStatus, workspaceFence]);
  const cancelProvisioning = React7.useCallback(async () => {
    if (!mountedRef.current) return;
    setBusy(true);
    try {
      if (provision?.attemptId && !["failed", "expired", "cancelled"].includes(provision.status)) {
        await invoke(DINGTALK_ENDPOINTS.cancelProvisioning, { attemptId: provision.attemptId });
        if (!mountedRef.current) return;
      }
      setProvision(null);
      announce("\u5DF2\u53D6\u6D88\u9489\u9489\u673A\u5668\u4EBA\u63A5\u5165\u3002");
      focusAddButton();
    } catch (error) {
      if (!mountedRef.current) return;
      setProvision((current) => ({ ...current, status: "failed", error: presentError(error) }));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [announce, focusAddButton, invoke, provision?.attemptId, provision?.status]);
  React7.useEffect(() => {
    const attemptId = provision?.attemptId;
    if (!attemptId || !ACTIVE_PROVISION_STATES.has(provision.status)) return void 0;
    const controller = new AbortController();
    let disposed = false;
    let timer = null;
    const canCommit = () => !disposed && !controller.signal.aborted && mountedRef.current;
    const schedule = (delay) => {
      if (!canCommit()) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (canCommit()) void poll();
      }, delay);
    };
    const poll = async () => {
      try {
        const response = await invoke(
          DINGTALK_ENDPOINTS.pollProvisioning,
          { attemptId },
          controller.signal
        );
        if (!canCommit()) return;
        const result = normalizeProvisioning(response);
        if (result.status === "connected") {
          const snapshot = await loadStatus({
            signal: controller.signal,
            silent: true,
            restoreProvisioning: false
          });
          if (!canCommit()) return;
          const account = result.botId ? snapshot?.bots.find((bot) => bot.botId === result.botId) : snapshot?.bots.find((bot) => bot.connected);
          if (!account?.connected) {
            setProvision((current) => current?.attemptId === attemptId ? { ...current, ...result, status: "connecting" } : current);
            schedule(result.pollIntervalMs);
            return;
          }
          setProvision(null);
          announce(result.alreadyConnected ? "\u8FD9\u4E2A\u9489\u9489\u673A\u5668\u4EBA\u5DF2\u7ECF\u63A5\u5165\u5E76\u4FDD\u6301\u5728\u7EBF\u3002" : "\u9489\u9489\u673A\u5668\u4EBA\u5DF2\u63A5\u5165\uFF0C\u53EF\u4EE5\u5F00\u59CB\u53D1\u9001\u6D88\u606F\u3002");
          return;
        }
        if (!canCommit()) return;
        setProvision((current) => current?.attemptId === attemptId ? { ...current, ...result, durationMs: current.durationMs } : current);
        if (ACTIVE_PROVISION_STATES.has(result.status)) {
          schedule(result.pollIntervalMs);
        }
      } catch (error) {
        if (error?.name === "AbortError" || !canCommit()) return;
        setProvision((current) => current?.attemptId === attemptId ? { ...current, status: "failed", error: presentError(error) } : current);
      }
    };
    schedule(provision.pollIntervalMs ?? 3e3);
    return () => {
      disposed = true;
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
  }, [announce, invoke, loadStatus, provision?.attemptId, provision?.pollIntervalMs, provision?.status]);
  const setBotBusy = React7.useCallback((botId, operation) => {
    if (!mountedRef.current) return;
    setBusyByBot((current) => {
      const next = { ...current };
      if (operation) next[botId] = operation;
      else delete next[botId];
      return next;
    });
  }, []);
  const runBotAction = React7.useCallback(async ({ account, operation, endpoint, payload, success }) => {
    if (!mountedRef.current) return void 0;
    const snapshotVersion = workspaceFence.beginMutation();
    setBotBusy(account.botId, operation);
    if (operation === "reconnect") {
      setFeedbackByBot((current) => {
        const next = { ...current };
        delete next[account.botId];
        return next;
      });
    }
    try {
      const snapshot = normalizeSnapshot(await invoke(endpoint, payload));
      if (!mountedRef.current) return void 0;
      if (workspaceFence.canCommitMutation(snapshotVersion)) {
        setModel({
          phase: "ready",
          bots: snapshot.bots,
          totals: snapshot.totals,
          revision: snapshot.revision,
          error: null
        });
        discardStaleFeedback(snapshot);
      }
      const successMessage = typeof success === "function" ? success(snapshot) : success;
      if (operation === "reconnect") {
        setFeedbackByBot((current) => ({
          ...current,
          [account.botId]: {
            message: successMessage,
            clearWhenDisconnected: snapshot.testMessage?.sent === true
          }
        }));
      }
      announce(successMessage);
      return snapshot;
    } catch (error) {
      if (!mountedRef.current) return void 0;
      const failureMessage = operation === "reconnect" ? "\u8FDE\u63A5\u68C0\u67E5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002" : `\u64CD\u4F5C\u5931\u8D25\uFF1A${presentError(error).message}`;
      if (operation === "reconnect") {
        setFeedbackByBot((current) => ({
          ...current,
          [account.botId]: { message: failureMessage, clearWhenDisconnected: false }
        }));
      }
      announce(failureMessage);
      return void 0;
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mountedRef.current) void loadStatus({ silent: true, restoreProvisioning: false });
      if (mountedRef.current) setBotBusy(account.botId, null);
    }
  }, [announce, discardStaleFeedback, invoke, loadStatus, setBotBusy, workspaceFence]);
  const reconnect = React7.useCallback((account) => runBotAction({
    account,
    operation: "reconnect",
    endpoint: DINGTALK_ENDPOINTS.reconnectBot,
    payload: { botId: account.botId, sendTest: true },
    success: (snapshot) => {
      const refreshed = snapshot?.bots.find((bot) => bot.botId === account.botId);
      if (!refreshed?.connected) return "\u9489\u9489\u4ECD\u672A\u8FDE\u63A5\uFF0C\u63D2\u4EF6\u4F1A\u7EE7\u7EED\u81EA\u52A8\u91CD\u8BD5\u3002";
      return connectionTestFeedback(snapshot.testMessage) ?? "\u9489\u9489\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\u3002";
    }
  }), [runBotAction]);
  const saveWorkspace = React7.useCallback(async (account, workspace) => {
    const workspaceVersion = workspaceFence.beginMutation();
    setBotBusy(account.botId, "workspace");
    try {
      const snapshot = normalizeSnapshot(await invoke(
        DINGTALK_ENDPOINTS.setWorkspace,
        { botId: account.botId, workspace }
      ));
      if (mountedRef.current && workspaceFence.canCommitMutation(workspaceVersion)) {
        setModel({
          phase: "ready",
          bots: snapshot.bots,
          totals: snapshot.totals,
          revision: snapshot.revision,
          error: null
        });
        discardStaleFeedback(snapshot);
      }
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mountedRef.current) void loadStatus({ silent: true });
      if (mountedRef.current) setBotBusy(account.botId, null);
    }
  }, [discardStaleFeedback, invoke, loadStatus, setBotBusy, workspaceFence]);
  const remove = React7.useCallback(async (account) => {
    const snapshot = await runBotAction({
      account,
      operation: "delete",
      endpoint: DINGTALK_ENDPOINTS.deleteBot,
      payload: { botId: account.botId, confirm: true },
      success: "\u9489\u9489\u673A\u5668\u4EBA\u53CA\u672C\u673A\u51ED\u636E\u5DF2\u79FB\u9664\u3002"
    });
    if (snapshot && mountedRef.current) setRemoveTarget(null);
  }, [runBotAction]);
  let provisionView = null;
  if (provision?.status === "starting") {
    provisionView = h2(
      "div",
      { className: "ddt-card ddt-loading", "aria-busy": "true" },
      h2("div", { className: "ddt-spinner" }),
      h2("span", null, "\u6B63\u5728\u7533\u8BF7\u9489\u9489\u6388\u6743\u4E8C\u7EF4\u7801\u2026")
    );
  } else if (provision?.status === "pending") {
    provisionView = h2(QrPanel, {
      provision,
      now,
      busy,
      onRefresh: () => void startProvisioning({ replace: true }),
      onCancel: () => void cancelProvisioning()
    });
  } else if (["scanned", "authorizing", "creating", "connecting"].includes(provision?.status)) {
    provisionView = h2(ProgressPanel, {
      status: provision.status,
      busy,
      onCancel: () => void cancelProvisioning()
    });
  } else if (provision && ["failed", "expired", "cancelled"].includes(provision.status)) {
    provisionView = h2(ProvisionError, {
      provision,
      busy,
      onRetry: () => void startProvisioning({ replace: Boolean(provision.attemptId) }),
      onClose: () => void cancelProvisioning()
    });
  }
  const credentialView = credentialOpen ? h2(CredentialBindingPanel, {
    channel: "\u9489\u9489",
    identityLabel: "Client ID",
    identityPlaceholder: "\u586B\u5199\u9489\u9489\u5E94\u7528 Client ID",
    secretLabel: "Client Secret",
    secretPlaceholder: "\u586B\u5199\u9489\u9489\u5E94\u7528 Client Secret",
    busy,
    error: credentialError,
    onSubmit: bindCredentials,
    onCancel: () => {
      setCredentialOpen(false);
      setCredentialError(null);
    }
  }) : null;
  return h2(
    "section",
    { className: "ddt-page dim-channelPage", "aria-label": "\u9489\u9489\u8BBE\u7F6E" },
    h2(Heading, {
      totals: model.totals,
      adding: Boolean(provision),
      busy,
      onAdd: () => void startProvisioning(),
      onCredential: () => {
        setCredentialOpen((value) => !value);
        setCredentialError(null);
      },
      credentialOpen,
      addButtonRef
    }),
    h2("div", { className: "ddt-visuallyHidden", role: "status", "aria-live": "polite" }, notice),
    model.error && model.phase === "ready" ? h2("div", { className: "ddt-statusNotice dim-statusNotice", role: "alert" }, `\u72B6\u6001\u5237\u65B0\u5931\u8D25\uFF1A${model.error.message}`) : null,
    model.phase === "loading" ? h2(LoadingView) : model.phase === "error" ? h2(
      "div",
      { className: "ddt-card dim-surfaceCard" },
      h2(
        "div",
        { className: "ddt-inlineError dim-inlineError", role: "alert" },
        h2("h3", null, "\u65E0\u6CD5\u8BFB\u53D6\u9489\u9489\u673A\u5668\u4EBA\u72B6\u6001"),
        h2("p", null, model.error?.message ?? "\u8BF7\u7A0D\u540E\u91CD\u8BD5"),
        h2(Button, { onClick: () => void loadStatus() }, "\u91CD\u65B0\u8BFB\u53D6")
      )
    ) : h2(
      React7.Fragment,
      null,
      credentialView,
      provisionView,
      model.bots.length === 0 && !provision && !credentialOpen ? h2(EmptyView, { busy, onStart: () => void startProvisioning() }) : null,
      model.bots.length > 0 ? h2(AccountList, {
        bots: model.bots,
        busyByBot,
        feedbackByBot,
        removeTarget,
        onReconnect: (account) => void reconnect(account),
        onWorkspaceSave: saveWorkspace,
        onRequestRemove: (account) => setRemoveTarget(account.botId),
        onConfirmRemove: (account) => void remove(account),
        onCancelRemove: () => setRemoveTarget(null)
      }) : null
    )
  );
}

// plugin-src/client/channels/shared/token-api.js
var ACCOUNT_STATES2 = /* @__PURE__ */ new Set(["connected", "connecting", "offline", "error"]);
function isRecord2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value, fallback, max = 240) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function id(value) {
  const result = text(value, "", 128);
  return /^[a-z\d_-]+$/i.test(result) ? result : void 0;
}
function timestamp2(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? void 0 : parsed;
}
var TOKEN_BOT_ENDPOINTS = Object.freeze({
  status: "connection.status",
  bindCredentials: "bot.bind-credentials",
  reconnectBot: "bot.reconnect",
  deleteBot: "bot.delete",
  setWorkspace: "bot.workspace.set"
});
function createTokenChannelApi(channel4, connectionSummary) {
  const unwrapRpcResult10 = (result) => {
    if (!isRecord2(result) || typeof result.ok !== "boolean") {
      throw new Error(`${channel4} \u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u54CD\u5E94`);
    }
    if (!result.ok) {
      const error = new Error(text(result.error?.message, `${channel4} \u64CD\u4F5C\u5931\u8D25`));
      error.code = text(result.error?.code, `${channel4.toUpperCase()}_RPC_ERROR`, 80);
      throw error;
    }
    return result.value;
  };
  const normalizeBot7 = (value) => {
    if (!isRecord2(value) || !id(value.botId)) return void 0;
    const connected = value.connected === true;
    const state = ACCOUNT_STATES2.has(value.state) ? value.state : "offline";
    return {
      botId: id(value.botId),
      connected,
      state: connected ? "connected" : state,
      workspace: text(value.workspace, "", 4096),
      bot: {
        name: text(value.bot?.name, `${channel4}\u673A\u5668\u4EBA`, 100),
        username: text(value.bot?.username, "", 100),
        idMasked: text(value.bot?.idMasked, "\u673A\u5668\u4EBA\u6807\u8BC6\u5DF2\u5B89\u5168\u4FDD\u5B58", 140)
      },
      health: {
        summary: text(
          value.health?.summary,
          connected ? `${channel4}${connectionSummary}\u8FD0\u884C\u6B63\u5E38` : `${channel4}\u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA`
        ),
        lastCheckedAt: timestamp2(value.health?.lastCheckedAt)
      },
      error: isRecord2(value.error) ? {
        code: text(value.error.code, `${channel4.toUpperCase()}_ACCOUNT_ERROR`, 80),
        message: text(value.error.message, `${channel4}\u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA`)
      } : null
    };
  };
  const normalizeSnapshot9 = (value) => {
    const source = isRecord2(value?.snapshot) ? value.snapshot : value;
    if (!isRecord2(source) || !Array.isArray(source.bots)) {
      throw new Error(`${channel4} \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u673A\u5668\u4EBA\u5217\u8868`);
    }
    const bots = source.bots.map(normalizeBot7).filter(Boolean);
    return {
      revision: Number.isSafeInteger(source.revision) ? source.revision : 0,
      bots,
      totals: { configured: bots.length, connected: bots.filter((bot) => bot.connected).length }
    };
  };
  const presentError10 = (error) => ({
    code: text(error?.code, `${channel4.toUpperCase()}_ERROR`, 80),
    message: text(error?.message, `${channel4}\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5`)
  });
  return Object.freeze({ unwrapRpcResult: unwrapRpcResult10, normalizeSnapshot: normalizeSnapshot9, presentError: presentError10 });
}

// plugin-src/client/channels/discord/api.js
var DISCORD_RPC_CHANNEL = "/discord";
var DISCORD_ENDPOINTS = TOKEN_BOT_ENDPOINTS;
var api = createTokenChannelApi("Discord", " Gateway \u957F\u8FDE\u63A5");
var unwrapRpcResult2 = api.unwrapRpcResult;
var normalizeSnapshot2 = api.normalizeSnapshot;
var presentError2 = api.presentError;

// plugin-src/client/channels/shared/token-channel.js
var React8 = __toESM(require("react"), 1);
var Button3 = React8.forwardRef(function Button4({ children, kind = "secondary", className = "", ...props }, ref) {
  return h2("button", {
    ...props,
    ref,
    type: "button",
    className: `ddt-button ${className}`.trim(),
    "data-kind": kind
  }, children);
});
function checkedTime2(value) {
  if (!value) return "\u5C1A\u672A\u68C0\u67E5";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(value));
  } catch {
    return "\u521A\u521A";
  }
}
function connectionTestNotice(value) {
  if (value?.testMessage?.sent === true) return "\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\uFF0C\u8BF7\u5230\u5BF9\u5E94\u673A\u5668\u4EBA\u4F1A\u8BDD\u4E2D\u786E\u8BA4\u3002";
  if (value?.testMessage?.code === "test-target-unavailable") {
    return "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\u3002\u673A\u5668\u4EBA\u5C1A\u672A\u6536\u5230\u53EF\u7528\u4E8E\u6D4B\u8BD5\u7684\u79C1\u804A\u6D88\u606F\u3002";
  }
  return value?.testMessage ? "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u6D4B\u8BD5\u6D88\u606F\u53D1\u9001\u5931\u8D25\u3002" : null;
}
function createTokenChannelSettings(definition) {
  const {
    channel: channel4,
    endpoints,
    api: api4,
    LogoGlyph,
    installStyles,
    pageClass,
    avatarClass,
    connectionLabel,
    tokenPlaceholder,
    emptyTitle,
    emptyDescription,
    platformLabel,
    CredentialPanel = null,
    credentialPayload = ({ secret }) => ({ token: secret }),
    credentialAriaLabel = `\u4F7F\u7528 Bot Token \u63A5\u5165 ${channel4} \u673A\u5668\u4EBA`,
    credentialOpenLabel = "\u624B\u52A8\u63A5\u5165",
    credentialCloseLabel = "\u6536\u8D77\u51ED\u636E",
    credentialNoun = "Bot Token",
    emptyActionLabel = "\u586B\u5199 Bot Token"
  } = definition;
  function AccountCard5({ account, busy, testNotice, removing, onReconnect, onWorkspaceSave, onRequestRemove, onConfirmRemove, onCancelRemove }) {
    const state = busy === "reconnect" ? "connecting" : account.state;
    const tone = account.connected ? "success" : state === "error" ? "error" : "warning";
    const stateLabel = account.connected ? "\u8FD0\u884C\u6B63\u5E38" : state === "connecting" ? "\u6B63\u5728\u8FDE\u63A5" : "\u8FDE\u63A5\u672A\u5C31\u7EEA";
    const summary = account.error?.message ?? (account.connected ? null : account.health.summary);
    const identity = account.bot.username ? `@${account.bot.username}` : account.bot.idMasked;
    return h2(
      "article",
      { className: "ddt-card dim-botCard", "data-bot-id": account.botId },
      h2(
        "div",
        { className: "ddt-cardBody dim-botCardBody" },
        h2(
          "div",
          { className: "ddt-accountTop dim-botCardTop" },
          h2(
            "div",
            { className: "ddt-accountIdentity dim-botIdentity" },
            h2(
              "div",
              { className: `ddt-avatar dim-botAvatar ${avatarClass}`, "aria-hidden": "true" },
              h2(LogoGlyph, { size: 29 })
            ),
            h2(
              "div",
              { className: "dim-botName" },
              h2("h3", null, account.bot.name),
              h2("p", null, identity)
            )
          ),
          h2(
            "div",
            { className: "ddt-health dim-botHealth" },
            h2("span", { className: "ddt-dot dim-healthDot", "data-tone": tone }),
            h2("span", null, stateLabel)
          )
        ),
        h2(
          "dl",
          { className: "ddt-metrics dim-botMetrics" },
          h2(
            "div",
            { className: "ddt-metric dim-botMetric" },
            h2("dt", null, "\u6D88\u606F\u901A\u9053"),
            h2("dd", null, account.connected ? connectionLabel : "\u79BB\u7EBF")
          ),
          h2(
            "div",
            { className: "ddt-metric dim-botMetric" },
            h2("dt", null, "\u6700\u8FD1\u68C0\u67E5"),
            h2("dd", null, checkedTime2(account.health.lastCheckedAt))
          )
        ),
        h2(WorkspaceEditor, {
          workspace: account.workspace,
          disabled: Boolean(busy),
          onSave: onWorkspaceSave
        }),
        h2(
          "div",
          { className: "ddt-accountFooter dim-cardFooter" },
          summary ? h2("div", { className: "ddt-summary dim-cardSummary" }, summary) : null,
          testNotice ? h2("div", { className: "ddt-summary dim-cardSummary", role: "status" }, testNotice) : null,
          h2(
            "div",
            { className: "ddt-actions dim-cardActions" },
            h2(Button3, {
              className: "dim-cardAction",
              onClick: onReconnect,
              disabled: Boolean(busy)
            }, busy === "reconnect" ? "\u68C0\u67E5\u4E2D\u2026" : account.connected ? "\u68C0\u67E5\u8FDE\u63A5" : "\u91CD\u8BD5\u8FDE\u63A5"),
            h2(Button3, {
              className: "dim-cardAction",
              kind: "danger",
              onClick: onRequestRemove,
              disabled: Boolean(busy)
            }, "\u79FB\u9664\u63A5\u5165")
          )
        )
      ),
      removing ? h2(
        "div",
        { className: "ddt-confirm dim-confirm", role: "alertdialog" },
        h2("strong", null, `\u4ECE DeepSeek Harness \u79FB\u9664\u201C${account.bot.name}\u201D\uFF1F`),
        h2("p", null, `\u8FD9\u4F1A\u505C\u6B62\u6D88\u606F\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684 ${credentialNoun}\u3001\u673A\u5668\u4EBA\u914D\u7F6E\u53CA\u4F1A\u8BDD\u6620\u5C04\u3002${platformLabel}\u4E2D\u7684\u673A\u5668\u4EBA\u4E0D\u4F1A\u88AB\u81EA\u52A8\u5220\u9664\u3002`),
        h2(
          "div",
          { className: "ddt-actions dim-viewActions" },
          h2(Button3, { onClick: onCancelRemove, disabled: Boolean(busy) }, "\u4FDD\u7559\u673A\u5668\u4EBA"),
          h2(
            Button3,
            { kind: "danger", onClick: onConfirmRemove, disabled: Boolean(busy) },
            busy === "delete" ? "\u6B63\u5728\u79FB\u9664\u2026" : "\u786E\u8BA4\u79FB\u9664\u63A5\u5165"
          )
        )
      ) : null
    );
  }
  function SettingsTab({ rpcCall }) {
    const [model, setModel] = React8.useState({
      phase: "loading",
      bots: [],
      totals: { configured: 0, connected: 0 },
      error: null
    });
    const [credentialOpen, setCredentialOpen] = React8.useState(false);
    const [credentialError, setCredentialError] = React8.useState(null);
    const [busy, setBusy] = React8.useState(false);
    const [busyByBot, setBusyByBot] = React8.useState({});
    const [testNoticeByBot, setTestNoticeByBot] = React8.useState({});
    const [removeTarget, setRemoveTarget] = React8.useState(null);
    const mounted = React8.useRef(true);
    const workspaceFence = useWorkspaceSnapshotFence();
    React8.useEffect(() => {
      const disposeDingtalk = installDingtalkStyles();
      const disposeChannel = installStyles();
      mounted.current = true;
      return () => {
        mounted.current = false;
        disposeChannel();
        disposeDingtalk();
      };
    }, []);
    const invoke = React8.useCallback(async (endpoint, payload = {}, signal) => {
      if (typeof rpcCall !== "function") throw new TypeError(`${channel4} \u8BBE\u7F6E\u9875\u7F3A\u5C11 RPC \u8FDE\u63A5`);
      return api4.unwrapRpcResult(await rpcCall(endpoint, payload, signal));
    }, [rpcCall]);
    const loadStatus = React8.useCallback(async ({ signal, silent = false } = {}) => {
      const workspaceVersion = workspaceFence.beginStatus();
      if (workspaceVersion === null) return;
      if (!silent && mounted.current) setModel((current) => ({ ...current, phase: "loading", error: null }));
      try {
        const snapshot = api4.normalizeSnapshot(await invoke(endpoints.status, {}, signal));
        if (!mounted.current || signal?.aborted || !workspaceFence.canCommitStatus(workspaceVersion)) return;
        setModel({ phase: "ready", bots: snapshot.bots, totals: snapshot.totals, error: null });
      } catch (error) {
        if (error?.name !== "AbortError" && mounted.current && !signal?.aborted && workspaceFence.canCommitStatus(workspaceVersion)) {
          setModel((current) => ({
            ...current,
            phase: silent ? current.phase : "error",
            error: api4.presentError(error)
          }));
        }
      }
    }, [invoke, workspaceFence]);
    React8.useEffect(() => {
      const controller = new AbortController();
      void loadStatus({ signal: controller.signal });
      return () => controller.abort();
    }, [loadStatus]);
    React8.useEffect(() => {
      if (model.phase !== "ready") return void 0;
      const controller = new AbortController();
      const timer = window.setInterval(
        () => void loadStatus({ signal: controller.signal, silent: true }),
        15e3
      );
      return () => {
        controller.abort();
        window.clearInterval(timer);
      };
    }, [loadStatus, model.phase]);
    const bindCredentials = React8.useCallback(async (values) => {
      const snapshotVersion = workspaceFence.beginMutation();
      setBusy(true);
      setCredentialError(null);
      try {
        const snapshot = api4.normalizeSnapshot(await invoke(
          endpoints.bindCredentials,
          credentialPayload(values)
        ));
        if (!mounted.current) return;
        if (workspaceFence.canCommitMutation(snapshotVersion)) {
          setModel({ phase: "ready", bots: snapshot.bots, totals: snapshot.totals, error: null });
        }
        setCredentialOpen(false);
      } catch (error) {
        if (mounted.current) setCredentialError(api4.presentError(error));
      } finally {
        const shouldRefresh = workspaceFence.endMutation();
        if (shouldRefresh && mounted.current) void loadStatus({ silent: true });
        if (mounted.current) setBusy(false);
      }
    }, [invoke, loadStatus, workspaceFence]);
    const botAction = React8.useCallback(async (account, operation, endpoint, payload) => {
      const snapshotVersion = workspaceFence.beginMutation();
      setBusyByBot((current) => ({ ...current, [account.botId]: operation }));
      try {
        const value = await invoke(endpoint, payload);
        const snapshot = api4.normalizeSnapshot(value);
        if (mounted.current && workspaceFence.canCommitMutation(snapshotVersion)) {
          setModel({ phase: "ready", bots: snapshot.bots, totals: snapshot.totals, error: null });
        }
        if (mounted.current && operation === "reconnect") {
          setTestNoticeByBot((current) => ({
            ...current,
            [account.botId]: connectionTestNotice(value)
          }));
        }
      } catch (error) {
        if (operation !== "reconnect") throw error;
        if (mounted.current) {
          setTestNoticeByBot((current) => ({
            ...current,
            [account.botId]: "\u8FDE\u63A5\u68C0\u67E5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002"
          }));
        }
      } finally {
        const shouldRefresh = workspaceFence.endMutation();
        if (shouldRefresh && mounted.current) void loadStatus({ silent: true });
        if (mounted.current) setBusyByBot((current) => {
          const next = { ...current };
          delete next[account.botId];
          return next;
        });
      }
    }, [invoke, loadStatus, workspaceFence]);
    const botList = model.bots.length > 0 ? h2(
      "section",
      { className: "dim-listSection" },
      h2(
        "div",
        { className: "ddt-listHeading dim-listHeading" },
        h2("h3", null, `\u5DF2\u63A5\u5165\u7684 ${channel4} \u673A\u5668\u4EBA`)
      ),
      h2("ul", { className: "ddt-list dim-botList" }, model.bots.map((account) => h2("li", { key: account.botId }, h2(AccountCard5, {
        account,
        busy: busyByBot[account.botId],
        testNotice: testNoticeByBot[account.botId],
        removing: removeTarget === account.botId,
        onReconnect: () => void botAction(
          account,
          "reconnect",
          endpoints.reconnectBot,
          { botId: account.botId, sendTest: true }
        ),
        onWorkspaceSave: (workspace) => botAction(
          account,
          "workspace",
          endpoints.setWorkspace,
          { botId: account.botId, workspace }
        ),
        onRequestRemove: () => setRemoveTarget(account.botId),
        onCancelRemove: () => setRemoveTarget(null),
        onConfirmRemove: async () => {
          await botAction(account, "delete", endpoints.deleteBot, {
            botId: account.botId,
            confirm: true
          });
          if (mounted.current) setRemoveTarget(null);
        }
      }))))
    ) : null;
    return h2(
      "section",
      {
        className: `ddt-page ${pageClass} dim-channelPage`,
        "aria-label": `${channel4} \u8BBE\u7F6E`
      },
      h2(
        "div",
        { className: "ddt-heading" },
        h2(
          "div",
          { className: "ddt-tools" },
          h2(
            "div",
            { className: "dim-bindActions" },
            h2(Button3, {
              kind: "credential",
              className: "dim-credentialButton",
              onClick: () => {
                setCredentialOpen((value) => !value);
                setCredentialError(null);
              },
              disabled: busy,
              "aria-pressed": credentialOpen,
              "aria-label": credentialAriaLabel
            }, h2(CredentialActionIcon), credentialOpen ? credentialCloseLabel : credentialOpenLabel)
          ),
          model.totals.configured > 0 ? h2(
            "div",
            { className: "ddt-badge dim-onlineBadge" },
            h2("span", null, `${model.totals.connected} / ${model.totals.configured} \u5728\u7EBF`)
          ) : null
        )
      ),
      model.phase === "loading" ? h2("div", {
        className: "ddt-card ddt-loading dim-surfaceCard dim-loadingView",
        "aria-busy": "true"
      }, h2("div", { className: "ddt-spinner dim-spinner" }), `\u6B63\u5728\u8BFB\u53D6 ${channel4} \u673A\u5668\u4EBA\u72B6\u6001\u2026`) : model.phase === "error" ? h2(
        "div",
        { className: "ddt-card dim-surfaceCard" },
        h2(
          "div",
          { className: "ddt-inlineError dim-inlineError" },
          h2("h3", null, `\u65E0\u6CD5\u8BFB\u53D6 ${channel4} \u673A\u5668\u4EBA\u72B6\u6001`),
          h2("p", null, model.error?.message),
          h2(Button3, { onClick: () => void loadStatus() }, "\u91CD\u65B0\u8BFB\u53D6")
        )
      ) : h2(
        React8.Fragment,
        null,
        credentialOpen ? CredentialPanel ? h2(CredentialPanel, {
          busy,
          error: credentialError,
          onSubmit: bindCredentials,
          onCancel: () => {
            setCredentialOpen(false);
            setCredentialError(null);
          }
        }) : h2(CredentialBindingPanel, {
          channel: channel4,
          secretLabel: "Bot Token",
          secretPlaceholder: tokenPlaceholder,
          busy,
          error: credentialError,
          onSubmit: bindCredentials,
          onCancel: () => {
            setCredentialOpen(false);
            setCredentialError(null);
          }
        }) : null,
        model.bots.length === 0 && !credentialOpen ? h2(
          "div",
          { className: "ddt-card dim-surfaceCard" },
          h2(
            "div",
            { className: "ddt-cardBody ddt-empty dim-surfaceBody dim-emptyView" },
            h2(
              "div",
              { className: "dim-emptyCopy" },
              h2(
                "div",
                { className: "ddt-stateLabel dim-stateLabel" },
                h2("span", { className: "ddt-dot dim-stateDot" }),
                h2("span", null, `\u5C1A\u672A\u63A5\u5165 ${channel4} \u673A\u5668\u4EBA`)
              ),
              h2("h3", null, emptyTitle),
              h2("p", null, emptyDescription),
              h2(
                "div",
                { className: "ddt-actions dim-viewActions" },
                h2(Button3, {
                  kind: "primary",
                  onClick: () => setCredentialOpen(true)
                }, emptyActionLabel)
              )
            ),
            h2("div", {
              className: `ddt-brandMark dim-emptyBrand ${avatarClass}`,
              "aria-hidden": "true"
            }, h2(LogoGlyph, { size: 64 }))
          )
        ) : null,
        botList
      )
    );
  }
  return { SettingsTab, AccountCard: AccountCard5 };
}

// plugin-src/client/channels/discord/styles.js
var DISCORD_STYLE_ID = "xmanrui-dsh-im-discord-settings";
var CSS2 = String.raw`
.ddc-page { --ddt-accent: #5865f2; --ddt-accent-deep: #4752c4; --ddt-accent-wash: #eef0ff; }
.ddc-avatar { color: #fff; background: #5865f2; }
.ddc-avatar svg { display: block; }
`;
function installDiscordStyles() {
  if (typeof document === "undefined") return () => {
  };
  const existing = document.querySelector(`style[data-plugin-css="${DISCORD_STYLE_ID}"]`);
  if (existing) return () => {
  };
  const style = document.createElement("style");
  style.dataset.plugin = "@xmanrui/dsh-im";
  style.dataset.pluginCss = DISCORD_STYLE_ID;
  style.textContent = CSS2;
  document.head.appendChild(style);
  return () => style.remove();
}

// plugin-src/client/channels/discord/index.js
var channel = createTokenChannelSettings({
  channel: "Discord",
  endpoints: DISCORD_ENDPOINTS,
  api,
  LogoGlyph: DiscordLogoGlyph,
  installStyles: installDiscordStyles,
  pageClass: "ddc-page",
  avatarClass: "ddc-avatar",
  connectionLabel: "Gateway \u957F\u8FDE\u63A5",
  tokenPlaceholder: "\u586B\u5199 Discord Developer Portal \u7684 Bot Token",
  emptyTitle: "\u63A5\u5165 Discord \u673A\u5668\u4EBA",
  emptyDescription: "\u5148\u5728 Developer Portal \u521B\u5EFA Bot \u5E76\u9080\u8BF7\u5230\u670D\u52A1\u5668\uFF0C\u518D\u5728\u8FD9\u91CC\u5B8C\u6210\u63A5\u5165\u3002",
  platformLabel: "Discord Developer Portal"
});
var DiscordSettingsTab = channel.SettingsTab;
var DiscordAccountCard = channel.AccountCard;

// plugin-src/client/channels/feishu/index.js
var React10 = __toESM(require("react"), 1);

// plugin-src/client/channels/feishu/api.js
var FEISHU_RPC_CHANNEL = "/feishu";
var FEISHU_ENDPOINTS = Object.freeze({
  status: "connection.status",
  beginProvisioning: "provision.begin",
  pollProvisioning: "provision.poll",
  cancelProvisioning: "provision.cancel",
  bindCredentials: "bot.bind-credentials",
  reconnectBot: "bot.reconnect",
  disconnectBot: "bot.disconnect",
  deleteBot: "bot.delete",
  setWorkspace: "bot.workspace.set",
  // Kept for rolling upgrades. The multi-bot UI never calls these endpoints.
  testConnection: "connection.test",
  disconnect: "connection.disconnect"
});
var CONNECTION_STATES = /* @__PURE__ */ new Set([
  "disconnected",
  "offline",
  "provisioning",
  "connecting",
  "reconnecting",
  "connected",
  "error"
]);
var POLL_STATES = /* @__PURE__ */ new Set([
  "pending",
  "scanned",
  "connecting",
  "connected",
  "expired",
  "failed"
]);
function isRecord3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function optionalString2(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function optionalTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? void 0 : parsed;
  }
  return void 0;
}
function clamp2(value, min, max, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function unwrapRpcResult3(result) {
  if (!isRecord3(result) || typeof result.ok !== "boolean") {
    throw new Error("\u98DE\u4E66\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u54CD\u5E94");
  }
  if (!result.ok) {
    const message = optionalString2(result.error?.message) ?? "\u98DE\u4E66\u670D\u52A1\u8BF7\u6C42\u5931\u8D25";
    const error = new Error(message);
    error.code = optionalString2(result.error?.code) ?? "FEISHU_RPC_ERROR";
    throw error;
  }
  return result.value;
}
function normalizeProvisioning2(value, now = Date.now()) {
  const source = isRecord3(value?.provisioning) ? value.provisioning : value;
  if (!isRecord3(source)) throw new Error("\u98DE\u4E66\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u4E8C\u7EF4\u7801\u4FE1\u606F");
  const attemptId = optionalString2(source.attemptId) ?? optionalString2(source.provisioningId);
  const verificationUrl = optionalString2(source.verificationUrl);
  const qrCodeDataUrl = optionalString2(source.qrCodeDataUrl);
  if (!attemptId || !verificationUrl && !qrCodeDataUrl) {
    throw new Error("\u98DE\u4E66\u670D\u52A1\u8FD4\u56DE\u7684\u4E8C\u7EF4\u7801\u4FE1\u606F\u4E0D\u5B8C\u6574");
  }
  const explicitExpiry = optionalTimestamp(source.expiresAt);
  const expireIn = clamp2(source.expireIn, 1, 60 * 60, 5 * 60);
  return {
    attemptId,
    verificationUrl,
    qrCodeDataUrl,
    expiresAt: explicitExpiry ?? now + expireIn * 1e3,
    pollIntervalMs: clamp2(source.pollIntervalMs, 800, 1e4, 1800)
  };
}
function normalizeBot2(value) {
  const source = isRecord3(value) ? value : {};
  return {
    name: optionalString2(source.name) ?? "\u98DE\u4E66\u673A\u5668\u4EBA",
    avatarUrl: optionalString2(source.avatarUrl),
    appIdMasked: optionalString2(source.appIdMasked),
    tenantName: optionalString2(source.tenantName),
    domain: source.domain === "lark" ? "lark" : "feishu",
    activated: typeof source.activated === "boolean" || typeof source.activated === "number" ? source.activated : void 0
  };
}
function normalizeHealth(value, connected = false) {
  const source = isRecord3(value) ? value : {};
  const fallbackStatus = connected ? "healthy" : "offline";
  const status = ["healthy", "degraded", "offline", "checking"].includes(source.status) ? source.status : fallbackStatus;
  return {
    status,
    summary: optionalString2(source.summary) ?? (connected ? "\u957F\u8FDE\u63A5\u8FD0\u884C\u6B63\u5E38" : "\u673A\u5668\u4EBA\u5C1A\u672A\u8FDE\u63A5"),
    lastCheckedAt: optionalTimestamp(source.lastCheckedAt),
    lastConnectedAt: optionalTimestamp(source.lastConnectedAt)
  };
}
function normalizeError2(value) {
  if (!isRecord3(value)) return void 0;
  const message = optionalString2(value.message);
  if (!message) return void 0;
  return { message, code: optionalString2(value.code) };
}
function authoritativeState(value, connected) {
  if (connected) return "connected";
  const reported = CONNECTION_STATES.has(value) ? value : "disconnected";
  if (reported === "connected" || reported === "connecting" || reported === "reconnecting") {
    return "connecting";
  }
  if (reported === "error") return "error";
  return "offline";
}
function normalizeBotConnection(value, fallbackBotId) {
  if (!isRecord3(value)) throw new Error("\u98DE\u4E66\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6548\u7684\u673A\u5668\u4EBA\u72B6\u6001");
  const botId = optionalString2(value.botId) ?? optionalString2(fallbackBotId);
  if (!botId) throw new Error("\u98DE\u4E66\u670D\u52A1\u8FD4\u56DE\u7684\u673A\u5668\u4EBA\u7F3A\u5C11 botId");
  const connected = value.connected === true;
  return {
    botId,
    state: authoritativeState(value.state, connected),
    connected,
    configured: value.configured !== false,
    workspace: optionalString2(value.workspace)?.slice(0, 4096) ?? "",
    bot: normalizeBot2(value.bot),
    health: normalizeHealth(value.health, connected),
    error: normalizeError2(value.error)
  };
}
function normalizeBotsSnapshot(value) {
  if (!isRecord3(value)) throw new Error("\u98DE\u4E66\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u8FDE\u63A5\u72B6\u6001");
  let sourceBots = Array.isArray(value.bots) ? value.bots : [];
  if (sourceBots.length === 0 && value.configured === true) {
    sourceBots = [{
      botId: optionalString2(value.botId) ?? "legacy-default",
      state: value.state,
      connected: value.connected,
      configured: true,
      bot: value.bot,
      health: value.health,
      error: value.error
    }];
  }
  const seen = /* @__PURE__ */ new Set();
  const bots = [];
  for (const source of sourceBots) {
    const bot = normalizeBotConnection(source);
    if (seen.has(bot.botId)) continue;
    seen.add(bot.botId);
    bots.push(bot);
  }
  const configured = bots.filter((bot) => bot.configured).length;
  const connected = bots.filter((bot) => bot.connected).length;
  const revision = Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0;
  const state = CONNECTION_STATES.has(value.state) ? value.state : "disconnected";
  return {
    schemaVersion: value.schemaVersion === 2 ? 2 : 1,
    revision,
    state,
    bots,
    // Derive counts from the authoritative list so stale summary fields never
    // make the UI claim that an unavailable bot is online.
    totals: { configured, connected },
    provisioning: value.provisioning ? normalizeProvisioning2(value.provisioning) : void 0,
    error: normalizeError2(value.error)
  };
}
function normalizeConnectionSnapshot(value) {
  if (!isRecord3(value)) throw new Error("\u98DE\u4E66\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u8FDE\u63A5\u72B6\u6001");
  const connected = value.connected === true;
  const reportedState = CONNECTION_STATES.has(value.state) ? value.state : "disconnected";
  const state = connected ? "connected" : reportedState === "connected" ? "connecting" : reportedState;
  const snapshot = {
    state,
    configured: value.configured === true,
    bot: normalizeBot2(value.bot),
    health: normalizeHealth(value.health, connected),
    provisioning: void 0,
    errorMessage: optionalString2(value.error?.message) ?? optionalString2(value.message)
  };
  if (value.provisioning) snapshot.provisioning = normalizeProvisioning2(value.provisioning);
  return snapshot;
}
function normalizePollResult(value) {
  if (!isRecord3(value)) throw new Error("\u98DE\u4E66\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u521B\u5EFA\u8FDB\u5EA6");
  const status = POLL_STATES.has(value.status) ? value.status : POLL_STATES.has(value.state) ? value.state : void 0;
  if (!status) throw new Error("\u98DE\u4E66\u670D\u52A1\u8FD4\u56DE\u4E86\u672A\u77E5\u7684\u521B\u5EFA\u72B6\u6001");
  const normalized = {
    status,
    botId: optionalString2(value.botId),
    message: optionalString2(value.error?.message) ?? optionalString2(value.message),
    connection: void 0,
    provisioning: void 0
  };
  if (value.provisioning) normalized.provisioning = normalizeProvisioning2(value.provisioning);
  if (status === "connected" && isRecord3(value.connection)) {
    normalized.connection = value.connection.botId ? normalizeBotConnection(value.connection) : normalizeConnectionSnapshot(value.connection);
  }
  return normalized;
}
function presentError3(error) {
  const raw = optionalString2(error?.message) ?? "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
  const message = raw.replace(/(client[_-]?secret|app[_-]?secret|secret|token)\s*[:=]\s*[^\s,;]+/gi, "$1=\u2022\u2022\u2022\u2022\u2022\u2022").slice(0, 240);
  return { message, code: optionalString2(error?.code) };
}
function formatRemaining2(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1e3));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// plugin-src/client/lifecycle.js
var React9 = __toESM(require("react"), 1);
function createPollScheduler({ setTimeoutFn, clearTimeoutFn }) {
  let disposed = false;
  let timer;
  return {
    get disposed() {
      return disposed;
    },
    schedule(callback, delayMs) {
      if (disposed) return false;
      if (timer !== void 0) clearTimeoutFn(timer);
      timer = setTimeoutFn(() => {
        timer = void 0;
        if (!disposed) void callback();
      }, delayMs);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (timer !== void 0) clearTimeoutFn(timer);
      timer = void 0;
    }
  };
}
function createAnimationFrameScheduler({ requestFrame, cancelFrame }) {
  let disposed = false;
  const frames = /* @__PURE__ */ new Set();
  const keyedFrames = /* @__PURE__ */ new Map();
  return {
    schedule(callback, key) {
      if (disposed) return false;
      const previous = key === void 0 ? void 0 : keyedFrames.get(key);
      if (previous !== void 0) {
        keyedFrames.delete(key);
        frames.delete(previous);
        cancelFrame(previous);
      }
      let frame;
      let completed = false;
      frame = requestFrame(() => {
        completed = true;
        if (frame !== void 0) frames.delete(frame);
        if (key !== void 0 && keyedFrames.get(key) === frame) keyedFrames.delete(key);
        if (!disposed) callback();
      });
      if (!completed) {
        frames.add(frame);
        if (key !== void 0) keyedFrames.set(key, frame);
      }
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const frame of frames) cancelFrame(frame);
      frames.clear();
      keyedFrames.clear();
    }
  };
}
function useAnimationFrameScheduler() {
  const schedulerRef = React9.useRef(null);
  React9.useEffect(() => {
    const scheduler = createAnimationFrameScheduler({
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (frame) => window.cancelAnimationFrame(frame)
    });
    schedulerRef.current = scheduler;
    return () => {
      scheduler.dispose();
      if (schedulerRef.current === scheduler) schedulerRef.current = null;
    };
  }, []);
  return React9.useCallback(
    (callback, key) => schedulerRef.current?.schedule(callback, key) ?? false,
    []
  );
}

// plugin-src/client/channels/feishu/styles.js
var FEISHU_STYLE_ID = "beihuixinghe-dsh-feishu-settings";
var CSS3 = String.raw`
.bxf-page {
  --bxf-accent: var(--dsw-alias-state-business-primary, #3370ff);
  --bxf-success: var(--dsw-alias-state-success-primary, #20a162);
  --bxf-warning: var(--dsw-alias-state-warn-primary, #d97706);
  --bxf-error: var(--dsw-alias-state-error-primary, #d54941);
  box-sizing: border-box;
  width: 100%;
  max-width: 860px;
  color: var(--dsw-alias-label-primary, #1f2329);
  display: flex;
  flex-direction: column;
  container-type: inline-size;
  gap: 18px;
  padding: 2px 0 24px;
}

.bxf-page *, .bxf-page *::before, .bxf-page *::after { box-sizing: border-box; }

.bxf-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.bxf-headingCopy { min-width: 0; }
.bxf-heading h2, .bxf-heading p, .bxf-card h3, .bxf-card p { margin: 0; }

.bxf-eyebrow {
  color: var(--dsw-alias-label-tertiary, #8f959e);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: .08em;
  text-transform: uppercase;
  margin-bottom: 3px;
}

.bxf-heading h2 {
  font-size: 20px;
  line-height: 28px;
  font-weight: 650;
  letter-spacing: -.015em;
}

.bxf-heading p {
  max-width: 540px;
  color: var(--dsw-alias-label-secondary, #646a73);
  font-size: 13px;
  line-height: 20px;
  margin-top: 5px;
  white-space: nowrap;
}

.bxf-headingTools {
  width: 100%;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: 8px;
}

.bxf-totalBadge {
  min-height: 28px;
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  border-radius: 999px;
  padding: 4px 10px;
  color: var(--dsw-alias-label-secondary, #646a73);
  background: var(--dsw-alias-bg-module-platform, #f2f3f5);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}

.bxf-totalBadge strong { color: var(--bxf-success); font-size: 13px; }

.bxf-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, #dee0e3);
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-3, #fff);
  box-shadow: var(--dsw-shadow-lv1, 0 3px 12px rgba(31, 35, 41, .05));
}

.bxf-card::before {
  content: "";
  pointer-events: none;
  position: absolute;
  inset: 0 0 auto;
  height: 88px;
  background:
    radial-gradient(circle at 86% -35%, color-mix(in srgb, var(--bxf-accent) 18%, transparent), transparent 68%);
  opacity: .85;
}

.bxf-cardBody { position: relative; padding: 24px; }

.bxf-intro {
  min-height: 250px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 172px;
  gap: 32px;
  align-items: center;
}

.bxf-introCopy { max-width: 500px; }

.bxf-stateLabel {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--dsw-alias-label-secondary, #646a73);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  margin-bottom: 13px;
}

.bxf-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary, #8f959e);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--dsw-alias-label-tertiary, #8f959e) 12%, transparent);
}

.bxf-dot[data-tone="success"] {
  background: var(--bxf-success);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--bxf-success) 13%, transparent);
}

.bxf-dot[data-tone="warning"] {
  background: var(--bxf-warning);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--bxf-warning) 13%, transparent);
}

.bxf-dot[data-tone="error"] {
  background: var(--bxf-error);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--bxf-error) 13%, transparent);
}

.bxf-intro h3 {
  font-size: 24px;
  line-height: 34px;
  font-weight: 650;
  letter-spacing: -.02em;
}

.bxf-introCopy > p {
  max-width: 490px;
  color: var(--dsw-alias-label-secondary, #646a73);
  font-size: 14px;
  line-height: 23px;
  margin-top: 8px;
}

.bxf-note {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: var(--dsw-alias-label-tertiary, #8f959e);
  font-size: 12px;
  line-height: 18px;
  margin-top: 16px;
}

.bxf-note svg { flex: none; margin-top: 1px; }

.bxf-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.bxf-button {
  appearance: none;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--dsw-alias-border-l2, #dee0e3);
  border-radius: 8px;
  padding: 7px 13px;
  color: var(--dsw-alias-label-primary, #1f2329);
  background: var(--dsw-alias-bg-layer-1, #fff);
  font: inherit;
  font-size: 13px;
  font-weight: 550;
  line-height: 20px;
  text-decoration: none;
  cursor: pointer;
  transition: background .15s var(--ds-ease-in-out, ease), border-color .15s var(--ds-ease-in-out, ease), transform .15s var(--ds-ease-in-out, ease);
}

.bxf-button:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, #f2f3f5);
  border-color: var(--dsw-alias-border-l1, #c9cdd4);
}

.bxf-button:active:not(:disabled) { transform: translateY(1px); }

.bxf-button:focus-visible, .bxf-link:focus-visible {
  outline: 2px solid var(--bxf-accent);
  outline-offset: 2px;
}

.bxf-button:disabled { cursor: not-allowed; opacity: .55; }

.bxf-button[data-kind="primary"] {
  border-color: var(--bxf-accent);
  color: #fff;
  background: var(--bxf-accent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--bxf-accent) 24%, transparent);
}

.bxf-button[data-kind="primary"]:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--bxf-accent) 86%, #000);
  background: color-mix(in srgb, var(--bxf-accent) 90%, #000);
}

.bxf-button[data-kind="danger"] { color: var(--bxf-error); }
.bxf-button[data-size="small"] { min-height: 32px; padding: 5px 10px; font-size: 12px; }
.bxf-bindButton { flex: none; white-space: nowrap; }

.bxf-provisionCard {
  border-color: color-mix(in srgb, var(--bxf-accent) 32%, var(--dsw-alias-border-l2, #dee0e3));
}

.bxf-markStage {
  position: relative;
  width: 156px;
  height: 156px;
  display: grid;
  place-items: center;
  justify-self: end;
}

.bxf-markStage::before, .bxf-markStage::after {
  content: "";
  position: absolute;
  border-radius: 50%;
}

.bxf-markStage::before {
  inset: 12px;
  border: 1px solid color-mix(in srgb, var(--bxf-accent) 18%, var(--dsw-alias-border-l2, #dee0e3));
  background: color-mix(in srgb, var(--bxf-accent) 4%, var(--dsw-alias-bg-layer-1, #fff));
}

.bxf-markStage::after {
  inset: 0;
  border: 1px dashed color-mix(in srgb, var(--bxf-accent) 16%, transparent);
  animation: bxf-rotate 18s linear infinite;
}

.bxf-brandMark {
  position: relative;
  z-index: 1;
  width: 68px;
  height: 68px;
  display: grid;
  place-items: center;
  border-radius: 20px;
  color: #fff;
  background: var(--bxf-accent);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--bxf-accent) 28%, transparent);
}

.bxf-qrLayout {
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  align-items: center;
  gap: 32px;
}

.bxf-qrColumn { min-width: 0; }

.bxf-qrFrame {
  position: relative;
  width: 222px;
  height: 222px;
  display: grid;
  place-items: center;
  border: 1px solid var(--dsw-alias-border-l2, #dee0e3);
  border-radius: 14px;
  padding: 13px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(31, 35, 41, .07);
}

.bxf-qrFrame::before, .bxf-qrFrame::after {
  content: "";
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: var(--bxf-accent);
  border-style: solid;
}

.bxf-qrFrame::before { inset: -3px auto auto -3px; border-width: 2px 0 0 2px; border-radius: 5px 0 0; }
.bxf-qrFrame::after { inset: auto -3px -3px auto; border-width: 0 2px 2px 0; border-radius: 0 0 5px; }
.bxf-qrFrame img { width: 100%; height: 100%; display: block; object-fit: contain; }

.bxf-qrFallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--bxf-accent);
  background: #f7f9ff;
  text-align: center;
  padding: 20px;
}

.bxf-qrFallback span { display: block; color: #646a73; font-size: 12px; line-height: 18px; margin-top: 8px; }

.bxf-expiredOverlay {
  position: absolute;
  inset: 10px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: #1f2329;
  background: rgba(255, 255, 255, .94);
  backdrop-filter: blur(3px);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.bxf-countdown {
  width: 222px;
  color: var(--dsw-alias-label-tertiary, #8f959e);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  line-height: 17px;
  margin-top: 11px;
}

.bxf-countdownTop { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.bxf-progress { height: 3px; overflow: hidden; border-radius: 99px; background: var(--dsw-alias-bg-module-platform, #f2f3f5); margin-top: 6px; }
.bxf-progress > span { display: block; width: var(--bxf-progress, 100%); height: 100%; border-radius: inherit; background: var(--bxf-accent); transition: width 1s linear; }

.bxf-qrCopy h3 { font-size: 20px; line-height: 29px; font-weight: 650; }
.bxf-qrCopy > p { color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 21px; margin-top: 7px; }

.bxf-steps { counter-reset: bxf-step; display: flex; flex-direction: column; gap: 11px; margin: 20px 0 0; padding: 0; list-style: none; }
.bxf-steps li { counter-increment: bxf-step; display: grid; grid-template-columns: 23px minmax(0, 1fr); align-items: start; gap: 9px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: 19px; }
.bxf-steps li::before { content: counter(bxf-step); width: 21px; height: 21px; display: grid; place-items: center; border: 1px solid var(--dsw-alias-border-l2, #dee0e3); border-radius: 50%; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-layer-1, #fff); font-size: 10px; font-weight: 650; }

.bxf-connecting { min-height: 292px; display: grid; place-items: center; text-align: center; padding: 36px 24px; }
.bxf-connectingCopy { max-width: 430px; }
.bxf-orbit { position: relative; width: 86px; height: 86px; display: grid; place-items: center; margin: 0 auto 22px; }
.bxf-orbit::before, .bxf-orbit::after { content: ""; position: absolute; border-radius: 50%; }
.bxf-orbit::before { inset: 3px; border: 1px solid color-mix(in srgb, var(--bxf-accent) 24%, transparent); animation: bxf-pulse 1.8s var(--ds-ease-in-out, ease) infinite; }
.bxf-orbit::after { inset: 0; border: 2px solid transparent; border-top-color: var(--bxf-accent); animation: bxf-rotate 1.2s linear infinite; }
.bxf-orbitCore { width: 50px; height: 50px; display: grid; place-items: center; border-radius: 16px; color: var(--bxf-accent); background: color-mix(in srgb, var(--bxf-accent) 9%, var(--dsw-alias-bg-layer-1, #fff)); }
.bxf-connecting h3 { font-size: 20px; line-height: 29px; }
.bxf-connecting p { color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 21px; margin-top: 7px; }
.bxf-connectingCompact { min-height: 248px; }

.bxf-inlineError {
  min-height: 190px;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-content: center;
  gap: 15px;
  padding: 28px;
}

.bxf-inlineError h3 { font-size: 17px; line-height: 25px; margin: 0; }
.bxf-inlineError p { color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 21px; margin-top: 5px; overflow-wrap: anywhere; }

.bxf-listSection { display: flex; flex-direction: column; gap: 10px; }
.bxf-listHeading { min-height: 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 2px; }
.bxf-listHeading h3 { font-size: 14px; line-height: 22px; font-weight: 650; margin: 0; }
.bxf-botList { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.bxf-botList > li { min-width: 0; }
.bxf-botCard:focus { outline: none; }
.bxf-botCard:focus-visible { outline: 2px solid var(--bxf-accent); outline-offset: 2px; }

.bxf-connectedTop { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.bxf-botIdentity { min-width: 0; display: flex; align-items: center; gap: 13px; }
.bxf-avatar { flex: none; width: 48px; height: 48px; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, #e5e6eb); border-radius: 14px; background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: 0 1px 3px rgb(31 35 41 / 7%); }
.bxf-botName { min-width: 0; }
.bxf-botName h3 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 17px; line-height: 24px; font-weight: 650; }
.bxf-botName p { overflow: hidden; color: var(--dsw-alias-label-tertiary, #8f959e); font-family: var(--ds-font-family-code, monospace); font-size: 12px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }

.bxf-healthPill { flex: none; display: inline-flex; align-items: center; gap: 7px; min-height: 28px; border-radius: 999px; padding: 4px 10px; color: var(--bxf-success); background: color-mix(in srgb, var(--bxf-success) 10%, transparent); font-size: 12px; font-weight: 600; line-height: 18px; }
.bxf-healthPill[data-health="degraded"], .bxf-healthPill[data-health="checking"], .bxf-healthPill[data-health="connecting"] { color: var(--bxf-warning); background: color-mix(in srgb, var(--bxf-warning) 10%, transparent); }
.bxf-healthPill[data-health="offline"], .bxf-healthPill[data-health="error"] { color: var(--bxf-error); background: color-mix(in srgb, var(--bxf-error) 10%, transparent); }

.bxf-statusGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 22px; }
.bxf-metric { min-width: 0; border: 1px solid var(--dsw-alias-border-l2, #dee0e3); border-radius: 9px; padding: 12px 13px; background: var(--dsw-alias-bg-module-platform, #f7f8fa); }
.bxf-metric dt { color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 11px; line-height: 17px; }
.bxf-metric dd { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-primary, #1f2329); font-size: 12px; line-height: 18px; font-weight: 550; margin: 3px 0 0; }

.bxf-connectedFooter { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--dsw-alias-border-l1, #eef0f3); }
.bxf-healthSummary { min-width: 0; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: 18px; }
.bxf-healthSummary[data-error="true"] { color: var(--bxf-error); }
.bxf-botActions { flex: none; flex-wrap: nowrap; gap: 8px; margin-top: 0; justify-content: flex-end; }
.bxf-botActions .bxf-button { flex: none; white-space: nowrap; }

.bxf-confirm {
  border-top: 1px solid var(--dsw-alias-border-l2, #dee0e3);
  background: color-mix(in srgb, var(--bxf-error) 4%, var(--dsw-alias-bg-module-platform, #f7f8fa));
  padding: 17px 24px 20px;
}
.bxf-confirm:focus { outline: none; }
.bxf-confirm h4 { font-size: 13px; line-height: 20px; margin: 0; }
.bxf-confirm p { color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: 19px; margin: 4px 0 0; }
.bxf-confirm .bxf-actions { margin-top: 12px; }

.bxf-error { min-height: 252px; display: grid; grid-template-columns: 44px minmax(0, 1fr); align-content: center; gap: 15px; padding: 30px; }
.bxf-errorIcon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 13px; color: var(--bxf-error); background: color-mix(in srgb, var(--bxf-error) 9%, transparent); }
.bxf-error h3 { font-size: 17px; line-height: 25px; }
.bxf-error p { color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 21px; margin-top: 5px; overflow-wrap: anywhere; }
.bxf-errorCode { display: inline-block; color: var(--dsw-alias-label-tertiary, #8f959e); font-family: var(--ds-font-family-code, monospace); font-size: 11px; margin-top: 7px; }

.bxf-statusNotice {
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid color-mix(in srgb, var(--bxf-warning) 28%, var(--dsw-alias-border-l2, #dee0e3));
  border-radius: 10px;
  padding: 9px 11px;
  color: var(--dsw-alias-label-secondary, #646a73);
  background: color-mix(in srgb, var(--bxf-warning) 5%, var(--dsw-alias-bg-layer-1, #fff));
  font-size: 12px;
  line-height: 18px;
}
.bxf-statusNotice > svg { flex: none; color: var(--bxf-warning); }
.bxf-statusNotice > span { min-width: 0; flex: 1; overflow-wrap: anywhere; }

.bxf-skeleton { min-height: 260px; padding: 28px; }
.bxf-skeletonLine { height: 12px; border-radius: 999px; background: linear-gradient(90deg, var(--dsw-alias-bg-module-platform, #f2f3f5), color-mix(in srgb, var(--dsw-alias-label-tertiary, #8f959e) 10%, transparent), var(--dsw-alias-bg-module-platform, #f2f3f5)); background-size: 220% 100%; animation: bxf-shimmer 1.5s linear infinite; }
.bxf-skeletonLine:nth-child(1) { width: 92px; }
.bxf-skeletonLine:nth-child(2) { width: 44%; height: 22px; margin-top: 23px; }
.bxf-skeletonLine:nth-child(3) { width: 72%; margin-top: 14px; }
.bxf-skeletonLine:nth-child(4) { width: 58%; margin-top: 9px; }
.bxf-skeletonBox { width: 138px; height: 38px; border-radius: 8px; background: var(--dsw-alias-bg-module-platform, #f2f3f5); margin-top: 28px; }

.bxf-visuallyHidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

@keyframes bxf-rotate { to { transform: rotate(360deg); } }
@keyframes bxf-pulse { 0%, 100% { transform: scale(.9); opacity: .45; } 50% { transform: scale(1.08); opacity: 1; } }
@keyframes bxf-shimmer { to { background-position: -220% 0; } }

@container (max-width: 620px) {
  .bxf-headingTools { gap: 6px; }
  .bxf-headingTools .bxf-totalBadge { padding-inline: 8px; }
  .bxf-headingTools .bxf-bindButton { padding-inline: 10px; }
}

@media (max-width: 680px) {
  .bxf-intro { grid-template-columns: minmax(0, 1fr); }
  .bxf-markStage { display: none; }
  .bxf-qrLayout { grid-template-columns: minmax(0, 1fr); justify-items: center; }
  .bxf-qrCopy { width: 100%; }
  .bxf-statusGrid { grid-template-columns: minmax(0, 1fr); }
  .bxf-connectedTop { align-items: flex-start; flex-direction: column; }
  .bxf-inlineError { grid-template-columns: minmax(0, 1fr); padding: 20px; }
  .bxf-statusNotice { align-items: flex-start; flex-wrap: wrap; }
  .bxf-cardBody { padding: 20px; }
}

@media (prefers-reduced-motion: reduce) {
  .bxf-page *, .bxf-page *::before, .bxf-page *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
}
`;
function installFeishuStyles() {
  if (typeof document === "undefined") {
    return () => {
    };
  }
  const existing = document.querySelector(
    `style[data-plugin-css="${FEISHU_STYLE_ID}"]`
  );
  if (existing) {
    return () => {
    };
  }
  const style = document.createElement("style");
  style.dataset.plugin = "@xmanrui/dsh-feishu";
  style.dataset.pluginCss = FEISHU_STYLE_ID;
  style.textContent = CSS3;
  document.head.appendChild(style);
  return () => {
    style.remove();
  };
}

// plugin-src/client/channels/feishu/index.js
function SvgIcon({ children, size = 18, className, viewBox = "0 0 24 24" }) {
  return h2("svg", {
    width: size,
    height: size,
    viewBox,
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true",
    focusable: "false",
    className
  }, children);
}
function RobotIcon({ size = 26 }) {
  return h2(
    SvgIcon,
    { size },
    h2("rect", {
      x: "5",
      y: "7.5",
      width: "14",
      height: "11",
      rx: "4",
      stroke: "currentColor",
      strokeWidth: "1.7"
    }),
    h2("path", {
      d: "M12 4.5v3M8.7 12h.01M15.3 12h.01M9.2 15.3c1.67 1.08 3.93 1.08 5.6 0M3.5 11.5v3M20.5 11.5v3",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round"
    })
  );
}
function AlertIcon({ size = 22 }) {
  return h2(
    SvgIcon,
    { size },
    h2("path", {
      d: "M12 3.4 21 19H3L12 3.4Z",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinejoin: "round"
    }),
    h2("path", {
      d: "M12 9v4.4M12 16.6v.01",
      stroke: "currentColor",
      strokeWidth: "1.9",
      strokeLinecap: "round"
    })
  );
}
function QrIcon({ size = 58 }) {
  return h2(SvgIcon, { size }, h2("path", {
    d: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2v-2Zm4 0h2v4h-2v-4Zm-4 4h4v2h-4v-2Z",
    fill: "currentColor"
  }));
}
var Button5 = React10.forwardRef(function Button6({ children, kind = "secondary", size, icon, className = "", ...props }, ref) {
  return h2("button", {
    ...props,
    ref,
    type: "button",
    className: `bxf-button ${className}`.trim(),
    "data-kind": kind,
    "data-size": size
  }, icon, h2("span", null, children));
});
function BrandMark() {
  return h2("div", { className: "bxf-brandMark" }, h2(RobotIcon, { size: 34 }));
}
function Heading2({ totals, onAdd, onCredential, credentialOpen, adding, busy, addButtonRef }) {
  const hasBots = totals.configured > 0;
  return h2(
    "div",
    { className: "bxf-heading" },
    h2(
      "div",
      { className: "bxf-headingTools" },
      h2(
        "div",
        { className: "dim-bindActions" },
        h2(Button5, {
          kind: "primary",
          size: "small",
          className: "bxf-bindButton dim-scanButton",
          onClick: onAdd,
          disabled: adding || busy,
          ref: addButtonRef,
          "aria-busy": busy ? "true" : void 0,
          "aria-label": "\u626B\u7801\u63A5\u5165\u98DE\u4E66\u673A\u5668\u4EBA",
          icon: h2(QrActionIcon)
        }, adding ? "\u6B63\u5728\u63A5\u5165" : "\u626B\u7801\u63A5\u5165\u673A\u5668\u4EBA"),
        h2(Button5, {
          kind: "credential",
          size: "small",
          className: "dim-credentialButton",
          onClick: onCredential,
          disabled: adding || busy,
          "aria-pressed": credentialOpen,
          "aria-label": "\u4F7F\u7528 App ID \u548C App Secret \u7ED1\u5B9A\u98DE\u4E66\u673A\u5668\u4EBA",
          icon: h2(CredentialActionIcon)
        }, credentialOpen ? "\u6536\u8D77\u51ED\u636E" : "\u624B\u52A8\u63A5\u5165")
      ),
      hasBots ? h2("div", {
        className: "bxf-totalBadge dim-onlineBadge",
        "aria-label": `\u5DF2\u63A5\u5165 ${totals.configured} \u4E2A\u673A\u5668\u4EBA\uFF0C\u5176\u4E2D ${totals.connected} \u4E2A\u5728\u7EBF`
      }, h2("span", null, `${totals.connected} / ${totals.configured} \u5728\u7EBF`)) : null
    )
  );
}
function LoadingView2() {
  return h2(
    "div",
    {
      className: "bxf-card dim-surfaceCard dim-loadingView",
      "aria-busy": "true",
      "aria-label": "\u6B63\u5728\u8BFB\u53D6\u98DE\u4E66\u673A\u5668\u4EBA\u5217\u8868"
    },
    h2("div", { className: "dim-spinner", "aria-hidden": "true" }),
    h2("span", null, "\u6B63\u5728\u8BFB\u53D6\u98DE\u4E66\u8FDE\u63A5\u72B6\u6001\u2026")
  );
}
function EmptyView2({ onStart, busy }) {
  return h2(
    "div",
    { className: "bxf-card dim-surfaceCard" },
    h2(
      "div",
      { className: "bxf-cardBody bxf-intro dim-surfaceBody dim-emptyView" },
      h2(
        "div",
        { className: "bxf-introCopy dim-emptyCopy" },
        h2(
          "div",
          { className: "bxf-stateLabel dim-stateLabel" },
          h2("span", { className: "bxf-dot dim-stateDot" }),
          h2("span", null, "\u5C1A\u672A\u63A5\u5165\u673A\u5668\u4EBA")
        ),
        h2("h3", null, "\u626B\u7801\uFF0C\u521B\u5EFA\u7B2C\u4E00\u4E2A\u98DE\u4E66\u5165\u53E3"),
        h2("p", null, "\u65E0\u9700\u624B\u52A8\u586B\u5199 App ID\u3002\u4EE5\u540E\u8FD8\u53EF\u4EE5\u7EE7\u7EED\u6DFB\u52A0\u673A\u5668\u4EBA\uFF0C\u5206\u522B\u670D\u52A1\u4E0D\u540C\u56E2\u961F\u6216\u98DE\u4E66\u79DF\u6237\u3002"),
        h2(
          "div",
          { className: "bxf-actions dim-viewActions" },
          h2(Button5, {
            kind: "primary",
            onClick: onStart,
            disabled: busy,
            "aria-busy": busy ? "true" : void 0
          }, busy ? "\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801\u2026" : "\u751F\u6210\u98DE\u4E66\u4E8C\u7EF4\u7801")
        )
      ),
      h2("div", { className: "bxf-markStage dim-emptyBrand", "aria-hidden": "true" }, h2(BrandMark))
    )
  );
}
function safeVerificationHref(value) {
  if (!value) return void 0;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : void 0;
  } catch {
    return void 0;
  }
}
function safeQrSource2(value) {
  if (!value) return void 0;
  return /^data:image\/(?:png|webp|svg\+xml)(?:;charset=[^;,]+)?;base64,/i.test(value) ? value : void 0;
}
function QrPane({ provision, now, onRefresh, onCancel, busy }) {
  const [imageFailed, setImageFailed] = React10.useState(false);
  const qrSource = safeQrSource2(provision.qrCodeDataUrl);
  const href = safeVerificationHref(provision.verificationUrl);
  const remaining = Math.max(0, provision.expiresAt - now);
  const expired = provision.expired === true || remaining === 0;
  const progress = Math.min(1, remaining / Math.max(1, provision.durationMs ?? remaining));
  React10.useEffect(() => setImageFailed(false), [qrSource]);
  return h2(
    "div",
    { className: "bxf-card bxf-provisionCard dim-surfaceCard" },
    h2(
      "div",
      { className: "bxf-cardBody bxf-qrLayout dim-surfaceBody dim-qrLayout" },
      h2(
        "div",
        { className: "bxf-qrColumn dim-qrColumn" },
        h2(
          "div",
          { className: "bxf-qrFrame dim-qrFrame" },
          qrSource && !imageFailed ? h2("img", {
            src: qrSource,
            alt: "\u7528\u4E8E\u65B0\u589E DeepSeek Harness \u98DE\u4E66\u673A\u5668\u4EBA\u7684\u4E00\u6B21\u6027\u6388\u6743\u4E8C\u7EF4\u7801",
            onError: () => setImageFailed(true)
          }) : h2(
            "div",
            { className: "bxf-qrFallback dim-qrFallback" },
            h2("div", null, h2(QrIcon), h2("span", null, "\u4E8C\u7EF4\u7801\u672A\u5C31\u7EEA\uFF0C\u8BF7\u6253\u5F00\u6388\u6743\u94FE\u63A5"))
          ),
          expired ? h2(
            "div",
            { className: "bxf-expiredOverlay dim-qrExpired", role: "status" },
            h2("div", null, "\u4E8C\u7EF4\u7801\u5DF2\u5931\u6548", h2("br"), "\u8BF7\u5237\u65B0\u540E\u91CD\u65B0\u626B\u7801")
          ) : null
        ),
        h2(
          "div",
          {
            className: "bxf-countdown dim-countdown",
            "aria-label": expired ? "\u4E8C\u7EF4\u7801\u5DF2\u5931\u6548" : `\u4E8C\u7EF4\u7801\u5269\u4F59 ${formatRemaining2(remaining)}`
          },
          h2(
            "div",
            { className: "bxf-countdownTop dim-countdownTop", "aria-hidden": "true" },
            h2("span", null, expired ? "\u7B49\u5F85\u5237\u65B0" : "\u4E8C\u7EF4\u7801\u6709\u6548\u65F6\u95F4"),
            h2("strong", null, formatRemaining2(remaining))
          ),
          h2(
            "div",
            { className: "bxf-progress dim-progress", "aria-hidden": "true" },
            h2("span", { style: { "--bxf-progress": `${Math.round(progress * 100)}%` } })
          )
        )
      ),
      h2(
        "div",
        { className: "bxf-qrCopy dim-qrCopy" },
        h2(
          "div",
          { className: "bxf-stateLabel dim-stateLabel" },
          h2("span", { className: "bxf-dot dim-stateDot", "data-tone": "warning" }),
          h2("span", null, "\u6B63\u5728\u6DFB\u52A0\u65B0\u673A\u5668\u4EBA")
        ),
        h2("h3", null, expired ? "\u5237\u65B0\u4E8C\u7EF4\u7801\u540E\u7EE7\u7EED" : "\u4F7F\u7528\u98DE\u4E66\u626B\u7801\u521B\u5EFA\u673A\u5668\u4EBA"),
        h2("p", null, "\u626B\u7801\u53EA\u4F1A\u65B0\u589E\u4E00\u4E2A\u673A\u5668\u4EBA\uFF0C\u5DF2\u63A5\u5165\u7684\u673A\u5668\u4EBA\u4F1A\u7EE7\u7EED\u6B63\u5E38\u6536\u53D1\u6D88\u606F\u3002"),
        h2(
          "ol",
          { className: "bxf-steps dim-steps" },
          h2("li", null, "\u6253\u5F00\u98DE\u4E66\u79FB\u52A8\u7AEF\uFF0C\u4F7F\u7528\u626B\u4E00\u626B\u8BFB\u53D6\u4E8C\u7EF4\u7801"),
          h2("li", null, "\u6838\u5BF9\u5E94\u7528\u540D\u79F0\u4E0E\u6743\u9650\u8303\u56F4\uFF0C\u5E76\u786E\u8BA4\u521B\u5EFA"),
          h2("li", null, "\u4FDD\u6301\u672C\u9875\u6253\u5F00\uFF0C\u7B49\u5F85\u65B0\u673A\u5668\u4EBA\u7684\u957F\u8FDE\u63A5\u5C31\u7EEA")
        ),
        h2(
          "div",
          { className: "bxf-actions dim-viewActions" },
          expired ? h2(Button5, {
            kind: "primary",
            onClick: onRefresh,
            disabled: busy
          }, busy ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0\u4E8C\u7EF4\u7801") : href ? h2("a", {
            className: "bxf-button bxf-link",
            "data-kind": "secondary",
            href,
            target: "_blank",
            rel: "noopener noreferrer"
          }, h2("span", null, "\u5728\u98DE\u4E66\u4E2D\u6253\u5F00")) : null,
          !expired ? h2(Button5, { onClick: onRefresh, disabled: busy }, "\u6362\u4E00\u4E2A\u4E8C\u7EF4\u7801") : null,
          h2(Button5, { onClick: onCancel, disabled: busy }, "\u53D6\u6D88\u6DFB\u52A0")
        )
      )
    )
  );
}
function ProvisionProgress({ phase, onCancel, busy }) {
  const connecting = phase === "connecting";
  return h2(
    "div",
    {
      className: "bxf-card bxf-provisionCard dim-surfaceCard dim-loadingView",
      "aria-busy": "true"
    },
    h2("div", { className: "dim-spinner", "aria-hidden": "true" }),
    h2("h3", null, connecting ? "\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u8FDE\u63A5\u65B0\u673A\u5668\u4EBA" : "\u6B63\u5728\u51C6\u5907\u6388\u6743\u4E8C\u7EF4\u7801"),
    h2("p", null, connecting ? "\u6B63\u5728\u5B89\u5168\u4FDD\u5B58\u51ED\u636E\u5E76\u68C0\u67E5\u65B0\u673A\u5668\u4EBA\u7684\u6D88\u606F\u901A\u9053\uFF0C\u5176\u4ED6\u673A\u5668\u4EBA\u4E0D\u4F1A\u4E2D\u65AD\u3002" : "\u6B63\u5728\u5411\u98DE\u4E66\u7533\u8BF7\u4E00\u6B21\u6027\u6388\u6743\u4E8C\u7EF4\u7801\uFF0C\u8BF7\u7A0D\u5019\u3002"),
    connecting ? h2(
      "div",
      { className: "bxf-actions dim-viewActions", style: { justifyContent: "center" } },
      h2(Button5, { onClick: onCancel, disabled: busy }, "\u53D6\u6D88\u6DFB\u52A0")
    ) : null
  );
}
function ProvisionError2({ error, onRetry, onCancel, busy }) {
  return h2(
    "div",
    { className: "bxf-card bxf-provisionCard dim-surfaceCard" },
    h2(
      "div",
      { className: "bxf-inlineError dim-inlineError", role: "alert" },
      h2(
        "div",
        null,
        h2("h3", null, "\u65B0\u673A\u5668\u4EBA\u6CA1\u6709\u6DFB\u52A0\u5B8C\u6210"),
        h2("p", null, error.message),
        error.code ? h2("span", { className: "bxf-errorCode" }, error.code) : null,
        h2(
          "div",
          { className: "bxf-actions dim-viewActions" },
          h2(
            Button5,
            { kind: "primary", onClick: onRetry, disabled: busy },
            busy ? "\u91CD\u8BD5\u4E2D\u2026" : "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801"
          ),
          h2(Button5, { onClick: onCancel, disabled: busy }, "\u5173\u95ED")
        )
      )
    )
  );
}
var HEALTH_LABELS = {
  connected: "\u8FD0\u884C\u6B63\u5E38",
  connecting: "\u6B63\u5728\u8FDE\u63A5",
  offline: "\u8FDE\u63A5\u4E2D\u65AD",
  error: "\u9700\u8981\u5904\u7406"
};
function formatCheckedTime(timestamp7) {
  if (!timestamp7) return "\u5C1A\u672A\u68C0\u67E5";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(timestamp7));
  } catch {
    return "\u521A\u521A";
  }
}
function connectionTestNotice2(value) {
  if (value?.testMessage?.sent === true) {
    return "\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\uFF0C\u8BF7\u5230\u98DE\u4E66\u4F1A\u8BDD\u4E2D\u786E\u8BA4\u3002";
  }
  if (value?.testMessage?.code === "test-target-unavailable") {
    return "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\u3002\u673A\u5668\u4EBA\u5C1A\u672A\u6536\u5230\u53EF\u7528\u4E8E\u6D4B\u8BD5\u7684\u79C1\u804A\u6D88\u606F\u3002";
  }
  return value?.testMessage ? "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u6D4B\u8BD5\u6D88\u606F\u53D1\u9001\u5931\u8D25\u3002" : null;
}
function RemoveConfirmation2({ bot, busy, onConfirm, onCancel }) {
  const cancelRef = React10.useRef(null);
  const idPart = bot.botId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const titleId = `bxf-remove-title-${idPart}`;
  const descriptionId = `bxf-remove-description-${idPart}`;
  React10.useEffect(() => cancelRef.current?.focus(), []);
  return h2(
    "div",
    {
      className: "bxf-confirm dim-confirm",
      role: "alertdialog",
      "aria-labelledby": titleId,
      "aria-describedby": descriptionId,
      onKeyDown: (event) => {
        if (event.key === "Escape" && !busy) {
          event.preventDefault();
          onCancel();
        }
      }
    },
    h2("h4", { id: titleId }, `\u4ECE DeepSeek Harness \u79FB\u9664\u201C${bot.bot.name}\u201D\uFF1F`),
    h2(
      "p",
      { id: descriptionId },
      "\u6B64\u64CD\u4F5C\u4F1A\u505C\u6B62\u8FD9\u4E2A\u673A\u5668\u4EBA\u7684\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u4FDD\u5B58\u5728\u672C\u673A\u7684\u63A5\u5165\u914D\u7F6E\u548C\u51ED\u636E\u3002\u98DE\u4E66\u5F00\u653E\u5E73\u53F0\u4E2D\u7684\u5E94\u7528\u4E0D\u4F1A\u88AB\u81EA\u52A8\u5220\u9664\uFF0C\u5176\u4ED6\u673A\u5668\u4EBA\u4E5F\u4E0D\u53D7\u5F71\u54CD\u3002"
    ),
    h2(
      "div",
      { className: "bxf-actions dim-viewActions" },
      h2(Button5, { ref: cancelRef, onClick: onCancel, disabled: busy }, "\u4FDD\u7559\u673A\u5668\u4EBA"),
      h2(
        Button5,
        { kind: "danger", onClick: onConfirm, disabled: busy },
        busy ? "\u6B63\u5728\u79FB\u9664\u2026" : "\u786E\u8BA4\u79FB\u9664\u63A5\u5165"
      )
    )
  );
}
function BotCard({
  connection,
  busy,
  actionError,
  testNotice,
  removing,
  onReconnect,
  onWorkspaceSave,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove,
  cardRef,
  removeButtonRef
}) {
  const { bot, health, state, connected } = connection;
  const stateForDisplay = busy === "reconnect" ? "connecting" : state;
  const tone = stateForDisplay === "connected" ? "success" : stateForDisplay === "connecting" ? "warning" : "error";
  const summary = actionError?.message ?? connection.error?.message ?? (connected ? null : health.summary);
  const titleId = `bxf-bot-${connection.botId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return h2(
    "article",
    {
      className: "bxf-card bxf-botCard dim-botCard",
      "aria-labelledby": titleId,
      "data-bot-id": connection.botId,
      tabIndex: -1,
      ref: cardRef
    },
    h2(
      "div",
      { className: "bxf-cardBody dim-botCardBody" },
      h2(
        "div",
        { className: "bxf-connectedTop dim-botCardTop" },
        h2(
          "div",
          { className: "bxf-botIdentity dim-botIdentity" },
          h2(
            "div",
            { className: "bxf-avatar dim-botAvatar", "aria-hidden": "true" },
            h2(FeishuLogoGlyph, { size: 34 })
          ),
          h2(
            "div",
            { className: "bxf-botName dim-botName" },
            h2("h3", { id: titleId, title: bot.name }, bot.name),
            h2("p", { title: bot.appIdMasked }, bot.appIdMasked ?? "\u5E94\u7528\u6807\u8BC6\u5DF2\u5B89\u5168\u4FDD\u5B58")
          )
        ),
        h2(
          "div",
          { className: "bxf-healthPill dim-botHealth", "data-health": stateForDisplay },
          h2("span", { className: "bxf-dot dim-healthDot", "data-tone": tone }),
          h2("span", null, HEALTH_LABELS[stateForDisplay] ?? "\u72B6\u6001\u672A\u77E5")
        )
      ),
      h2(
        "dl",
        { className: "bxf-statusGrid dim-botMetrics" },
        h2(
          "div",
          { className: "bxf-metric dim-botMetric" },
          h2("dt", null, "\u6D88\u606F\u901A\u9053"),
          h2("dd", null, connected ? "\u957F\u8FDE\u63A5" : stateForDisplay === "connecting" ? "\u8FDE\u63A5\u4E2D" : "\u5DF2\u65AD\u5F00")
        ),
        h2(
          "div",
          { className: "bxf-metric dim-botMetric" },
          h2("dt", null, "\u6700\u8FD1\u68C0\u67E5"),
          h2("dd", null, formatCheckedTime(health.lastCheckedAt))
        )
      ),
      h2(WorkspaceEditor, {
        workspace: connection.workspace,
        disabled: Boolean(busy),
        onSave: onWorkspaceSave
      }),
      h2(
        "div",
        { className: "bxf-connectedFooter dim-cardFooter" },
        summary ? h2(
          "div",
          { className: "bxf-healthSummary dim-cardSummary", "data-error": actionError || connection.error ? "true" : void 0 },
          summary
        ) : null,
        testNotice ? h2("div", {
          className: "bxf-healthSummary dim-cardSummary",
          role: "status"
        }, testNotice) : null,
        h2(
          "div",
          { className: "bxf-actions bxf-botActions dim-cardActions" },
          h2(Button5, {
            className: "dim-cardAction",
            onClick: onReconnect,
            disabled: Boolean(busy),
            "aria-busy": busy === "reconnect" ? "true" : void 0,
            "aria-label": `${connected ? "\u68C0\u67E5\u8FDE\u63A5" : "\u91CD\u8BD5\u8FDE\u63A5"}${bot.name}`
          }, busy === "reconnect" ? connected ? "\u68C0\u67E5\u4E2D\u2026" : "\u6B63\u5728\u8FDE\u63A5\u2026" : connected ? "\u68C0\u67E5\u8FDE\u63A5" : "\u91CD\u8BD5\u8FDE\u63A5"),
          h2(Button5, {
            className: "dim-cardAction",
            kind: "danger",
            onClick: onRequestRemove,
            disabled: Boolean(busy),
            ref: removeButtonRef,
            "aria-label": `\u4ECE DeepSeek Harness \u79FB\u9664${bot.name}`
          }, "\u79FB\u9664\u63A5\u5165")
        )
      )
    ),
    removing ? h2(RemoveConfirmation2, {
      bot: connection,
      busy: busy === "delete",
      onConfirm: onConfirmRemove,
      onCancel: onCancelRemove
    }) : null
  );
}
function BotList(props) {
  return h2(
    "section",
    { className: "bxf-listSection dim-listSection", "aria-labelledby": "bxf-bot-list-title" },
    h2(
      "div",
      { className: "bxf-listHeading dim-listHeading" },
      h2("h3", { id: "bxf-bot-list-title" }, "\u5DF2\u63A5\u5165\u7684\u673A\u5668\u4EBA")
    ),
    h2(
      "ul",
      { className: "bxf-botList dim-botList", role: "list" },
      props.bots.map((bot) => h2(
        "li",
        { key: bot.botId },
        h2(BotCard, {
          connection: bot,
          busy: props.busyByBot[bot.botId],
          actionError: props.errorsByBot[bot.botId],
          testNotice: props.testNoticesByBot[bot.botId],
          removing: props.removeTargetId === bot.botId,
          onReconnect: () => props.onReconnect(bot),
          onWorkspaceSave: (workspace) => props.onWorkspaceSave(bot, workspace),
          onRequestRemove: () => props.onRequestRemove(bot),
          onConfirmRemove: () => props.onConfirmRemove(bot),
          onCancelRemove: props.onCancelRemove,
          cardRef: (node) => props.setCardRef(bot.botId, node),
          removeButtonRef: (node) => props.setRemoveButtonRef(bot.botId, node)
        })
      ))
    )
  );
}
function PageError({ error, onRetry, busy }) {
  return h2(
    "div",
    { className: "bxf-card dim-surfaceCard" },
    h2(
      "div",
      { className: "bxf-error dim-inlineError", role: "alert" },
      h2(
        "div",
        null,
        h2("h3", null, "\u65E0\u6CD5\u8BFB\u53D6\u98DE\u4E66\u673A\u5668\u4EBA"),
        h2("p", null, error.message),
        error.code ? h2("span", { className: "bxf-errorCode" }, error.code) : null,
        h2(
          "div",
          { className: "bxf-actions dim-viewActions" },
          h2(
            Button5,
            { kind: "primary", onClick: onRetry, disabled: busy },
            busy ? "\u91CD\u8BD5\u4E2D\u2026" : "\u91CD\u65B0\u8BFB\u53D6"
          )
        )
      )
    )
  );
}
var EMPTY_TOTALS2 = Object.freeze({ configured: 0, connected: 0 });
function mergeFeishuSnapshotState(current, snapshot, { restoreProvisioning = false, now = Date.now() } = {}) {
  if (snapshot.revision > 0 && current.revision > snapshot.revision) return current;
  let provisioning = current.provisioning;
  if (!provisioning && restoreProvisioning && snapshot.provisioning) {
    provisioning = {
      phase: snapshot.state === "connecting" ? "connecting" : "qr",
      ...snapshot.provisioning,
      durationMs: Math.max(1, snapshot.provisioning.expiresAt - now),
      expired: snapshot.provisioning.expiresAt <= now
    };
  }
  return {
    ...current,
    phase: "ready",
    revision: snapshot.revision,
    bots: snapshot.bots,
    totals: snapshot.totals,
    provisioning,
    pageError: null,
    statusError: null
  };
}
function FeishuSettingsTab({ rpcCall }) {
  const [model, setModel] = React10.useState({
    phase: "loading",
    revision: 0,
    bots: [],
    totals: EMPTY_TOTALS2,
    provisioning: null,
    pageError: null,
    statusError: null
  });
  const [pageBusy, setPageBusy] = React10.useState(false);
  const [provisionBusy, setProvisionBusy] = React10.useState(false);
  const [credentialOpen, setCredentialOpen] = React10.useState(false);
  const [credentialBusy, setCredentialBusy] = React10.useState(false);
  const [credentialError, setCredentialError] = React10.useState(null);
  const [busyByBot, setBusyByBot] = React10.useState({});
  const [errorsByBot, setErrorsByBot] = React10.useState({});
  const [testNoticesByBot, setTestNoticesByBot] = React10.useState({});
  const [removeTargetId, setRemoveTargetId] = React10.useState(null);
  const [announcement, setAnnouncement] = React10.useState("");
  const [now, setNow] = React10.useState(() => Date.now());
  const [focusBotId, setFocusBotId] = React10.useState(null);
  const cardRefs = React10.useRef(/* @__PURE__ */ new Map());
  const removeButtonRefs = React10.useRef(/* @__PURE__ */ new Map());
  const addButtonRef = React10.useRef(null);
  const mountedRef = React10.useRef(true);
  const workspaceFence = useWorkspaceSnapshotFence();
  const scheduleAnimationFrame = useAnimationFrameScheduler();
  React10.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const announce = React10.useCallback((message) => {
    setAnnouncement("");
    scheduleAnimationFrame(() => {
      if (message) setAnnouncement(message);
    }, "announcement");
  }, [scheduleAnimationFrame]);
  const invoke = React10.useCallback(async (endpoint, payload = {}, signal) => {
    return unwrapRpcResult3(await rpcCall(endpoint, payload, signal));
  }, [rpcCall]);
  const mergeSnapshot = React10.useCallback((snapshot, { restoreProvisioning = false } = {}) => {
    const now2 = Date.now();
    setModel((current) => mergeFeishuSnapshotState(
      current,
      snapshot,
      { restoreProvisioning, now: now2 }
    ));
  }, []);
  const loadStatus = React10.useCallback(async ({ signal, silent = false, restoreProvisioning = false } = {}) => {
    const workspaceVersion = workspaceFence.beginStatus();
    if (workspaceVersion === null || !mountedRef.current) return void 0;
    if (!silent) setPageBusy(true);
    try {
      const snapshot = normalizeBotsSnapshot(await invoke(FEISHU_ENDPOINTS.status, {}, signal));
      if (signal?.aborted || !mountedRef.current || !workspaceFence.canCommitStatus(workspaceVersion)) return void 0;
      mergeSnapshot(snapshot, { restoreProvisioning });
      return snapshot;
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError" || !mountedRef.current || !workspaceFence.canCommitStatus(workspaceVersion)) return void 0;
      const presented = presentError3(error);
      setModel((current) => current.phase === "loading" || !silent ? { ...current, phase: "error", pageError: presented } : { ...current, statusError: presented });
      return void 0;
    } finally {
      if (!silent && !signal?.aborted && mountedRef.current) setPageBusy(false);
    }
  }, [invoke, mergeSnapshot, workspaceFence]);
  React10.useEffect(() => {
    const controller = new AbortController();
    void loadStatus({ signal: controller.signal, restoreProvisioning: true });
    return () => controller.abort();
  }, [loadStatus]);
  React10.useEffect(() => {
    if (model.phase !== "ready") return void 0;
    const controller = new AbortController();
    let inFlight = false;
    const timer = window.setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      await loadStatus({
        signal: controller.signal,
        silent: true,
        restoreProvisioning: false
      });
      inFlight = false;
    }, 15e3);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadStatus, model.phase]);
  React10.useEffect(() => {
    if (!focusBotId) return;
    const node = cardRefs.current.get(focusBotId);
    if (!node) return;
    node.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    node.focus({ preventScroll: true });
    setFocusBotId(null);
  }, [focusBotId, model.bots]);
  const startProvisioning = React10.useCallback(async ({ replace = false } = {}) => {
    setCredentialOpen(false);
    setCredentialError(null);
    setProvisionBusy(true);
    announce("");
    const previousAttemptId = model.provisioning?.attemptId;
    setModel((current) => ({
      ...current,
      phase: current.phase === "loading" ? "ready" : current.phase,
      provisioning: { phase: "creating" }
    }));
    try {
      if (replace && previousAttemptId) {
        await invoke(FEISHU_ENDPOINTS.cancelProvisioning, { attemptId: previousAttemptId });
      }
      const provision2 = normalizeProvisioning2(await invoke(
        FEISHU_ENDPOINTS.beginProvisioning,
        { locale: "zh-CN" }
      ));
      const timestamp7 = Date.now();
      setNow(timestamp7);
      setModel((current) => ({
        ...current,
        provisioning: {
          phase: "qr",
          ...provision2,
          durationMs: Math.max(1, provision2.expiresAt - timestamp7),
          expired: false
        }
      }));
      announce("\u6388\u6743\u4E8C\u7EF4\u7801\u5DF2\u751F\u6210\uFF0C\u8BF7\u4F7F\u7528\u98DE\u4E66\u626B\u7801\u3002");
    } catch (error) {
      setModel((current) => ({
        ...current,
        provisioning: { phase: "error", error: presentError3(error) }
      }));
    } finally {
      setProvisionBusy(false);
    }
  }, [announce, invoke, model.provisioning?.attemptId]);
  const bindCredentials = React10.useCallback(async ({ identity, secret }) => {
    const snapshotVersion = workspaceFence.beginMutation();
    setCredentialBusy(true);
    setCredentialError(null);
    try {
      const snapshot = normalizeBotsSnapshot(await invoke(
        FEISHU_ENDPOINTS.bindCredentials,
        { appId: identity, appSecret: secret }
      ));
      if (mountedRef.current && workspaceFence.canCommitMutation(snapshotVersion)) {
        mergeSnapshot(snapshot);
      }
      setCredentialOpen(false);
      announce("\u98DE\u4E66\u673A\u5668\u4EBA\u51ED\u636E\u5DF2\u7ED1\u5B9A\u3002");
    } catch (error) {
      setCredentialError(presentError3(error));
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mountedRef.current) void loadStatus({ silent: true });
      setCredentialBusy(false);
    }
  }, [announce, invoke, loadStatus, mergeSnapshot, workspaceFence]);
  const cancelProvisioning = React10.useCallback(async () => {
    const attemptId = model.provisioning?.attemptId;
    setProvisionBusy(true);
    try {
      if (attemptId) await invoke(FEISHU_ENDPOINTS.cancelProvisioning, { attemptId });
      setModel((current) => ({ ...current, provisioning: null }));
      announce("\u5DF2\u53D6\u6D88\u6DFB\u52A0\u673A\u5668\u4EBA\u3002");
      await loadStatus({ silent: true, restoreProvisioning: false });
      scheduleAnimationFrame(() => addButtonRef.current?.focus(), "focus");
    } catch (error) {
      setModel((current) => ({
        ...current,
        provisioning: { phase: "error", attemptId, error: presentError3(error) }
      }));
    } finally {
      setProvisionBusy(false);
    }
  }, [announce, invoke, loadStatus, model.provisioning?.attemptId, scheduleAnimationFrame]);
  const countdownAttemptId = model.provisioning?.attemptId;
  const countdownPhase = model.provisioning?.phase;
  const countdownExpiresAt = model.provisioning?.expiresAt;
  const countdownExpired = model.provisioning?.expired;
  React10.useEffect(() => {
    if (!countdownAttemptId || countdownPhase !== "qr" || countdownExpired) return void 0;
    const tick = () => {
      const timestamp7 = Date.now();
      setNow(timestamp7);
      if (timestamp7 >= countdownExpiresAt) {
        setModel((current) => current.provisioning?.attemptId === countdownAttemptId ? { ...current, provisioning: { ...current.provisioning, expired: true } } : current);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1e3);
    return () => window.clearInterval(timer);
  }, [countdownAttemptId, countdownPhase, countdownExpiresAt, countdownExpired]);
  React10.useEffect(() => {
    const provision2 = model.provisioning;
    if (!provision2 || !["qr", "connecting"].includes(provision2.phase) || !provision2.attemptId || provision2.expired) return void 0;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = normalizePollResult(await invoke(
          FEISHU_ENDPOINTS.pollProvisioning,
          { attemptId: provision2.attemptId },
          controller.signal
        ));
        if (result.status === "connected") {
          const snapshot = await loadStatus({ signal: controller.signal, silent: true, restoreProvisioning: false });
          const newBot = snapshot?.bots.find((bot) => bot.botId === result.botId);
          if (!snapshot) {
            throw new Error("\u673A\u5668\u4EBA\u5DF2\u7ECF\u521B\u5EFA\uFF0C\u4F46\u6682\u65F6\u65E0\u6CD5\u786E\u8BA4\u8FDE\u63A5\u72B6\u6001");
          }
          if (!newBot?.connected) {
            setModel((current) => current.provisioning?.attemptId === provision2.attemptId ? { ...current, provisioning: { ...current.provisioning, phase: "connecting" } } : current);
            return;
          }
          setModel((current) => ({ ...current, provisioning: null }));
          announce(newBot ? `${newBot.bot.name}\u5DF2\u8FDE\u63A5\uFF0C\u53EF\u4EE5\u5728\u98DE\u4E66\u4E2D\u5F00\u59CB\u804A\u5929\u3002` : "\u65B0\u98DE\u4E66\u673A\u5668\u4EBA\u5DF2\u8FDE\u63A5\uFF0C\u53EF\u4EE5\u5F00\u59CB\u804A\u5929\u3002");
          if (result.botId) setFocusBotId(result.botId);
          return;
        }
        if (result.status === "failed") {
          const error = new Error(result.message ?? "\u98DE\u4E66\u5E94\u7528\u521B\u5EFA\u5931\u8D25");
          error.code = "FEISHU_PROVISION_FAILED";
          throw error;
        }
        if (result.status === "expired") {
          setModel((current) => current.provisioning?.attemptId === provision2.attemptId ? { ...current, provisioning: { ...current.provisioning, phase: "qr", expired: true } } : current);
          return;
        }
        setModel((current) => {
          if (current.provisioning?.attemptId !== provision2.attemptId) return current;
          const next = result.provisioning ?? current.provisioning;
          return {
            ...current,
            provisioning: {
              ...current.provisioning,
              ...next,
              phase: ["scanned", "connecting"].includes(result.status) ? "connecting" : "qr"
            }
          };
        });
      } catch (error) {
        if (error?.name === "AbortError") return;
        setModel((current) => current.provisioning?.attemptId === provision2.attemptId ? {
          ...current,
          provisioning: {
            phase: "error",
            attemptId: provision2.attemptId,
            error: presentError3(error)
          }
        } : current);
      }
    }, provision2.pollIntervalMs);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [announce, invoke, loadStatus, model.provisioning]);
  const setBotBusy = React10.useCallback((botId, value) => {
    setBusyByBot((current) => {
      const next = { ...current };
      if (value) next[botId] = value;
      else delete next[botId];
      return next;
    });
  }, []);
  const setBotError = React10.useCallback((botId, error) => {
    setErrorsByBot((current) => {
      const next = { ...current };
      if (error) next[botId] = presentError3(error);
      else delete next[botId];
      return next;
    });
  }, []);
  const reconnectOneBot = React10.useCallback(async (connection) => {
    const { botId, bot } = connection;
    const snapshotVersion = workspaceFence.beginMutation();
    setBotBusy(botId, "reconnect");
    setBotError(botId, null);
    setTestNoticesByBot((current) => {
      const next = { ...current };
      delete next[botId];
      return next;
    });
    try {
      const value = await invoke(FEISHU_ENDPOINTS.reconnectBot, { botId, sendTest: true });
      const snapshot = normalizeBotsSnapshot(value);
      if (mountedRef.current && workspaceFence.canCommitMutation(snapshotVersion)) {
        mergeSnapshot(snapshot);
      }
      const refreshed = snapshot.bots.find((item) => item.botId === botId);
      if (!refreshed?.connected) {
        const error = new Error(
          refreshed?.error?.message ?? refreshed?.health.summary ?? "\u673A\u5668\u4EBA\u4ECD\u672A\u8FDE\u63A5"
        );
        error.code = refreshed?.error?.code ?? "FEISHU_BOT_OFFLINE";
        throw error;
      }
      const testNotice = connectionTestNotice2(value);
      if (mountedRef.current && workspaceFence.canCommitMutation(snapshotVersion)) {
        setTestNoticesByBot((current) => ({ ...current, [botId]: testNotice }));
      }
      announce(testNotice ?? (connection.connected ? `${bot.name}\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\u3002` : `${bot.name}\u5DF2\u91CD\u65B0\u8FDE\u63A5\u3002`));
    } catch (error) {
      const failure = new Error("\u8FDE\u63A5\u68C0\u67E5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
      failure.code = error?.code;
      setBotError(botId, failure);
      announce(failure.message);
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mountedRef.current) void loadStatus({ silent: true });
      setBotBusy(botId, null);
    }
  }, [announce, invoke, loadStatus, mergeSnapshot, setBotBusy, setBotError, workspaceFence]);
  const saveWorkspace = React10.useCallback(async (connection, workspace) => {
    const { botId } = connection;
    const workspaceVersion = workspaceFence.beginMutation();
    setBotBusy(botId, "workspace");
    setBotError(botId, null);
    try {
      const snapshot = normalizeBotsSnapshot(await invoke(
        FEISHU_ENDPOINTS.setWorkspace,
        { botId, workspace }
      ));
      if (mountedRef.current && workspaceFence.canCommitMutation(workspaceVersion)) {
        mergeSnapshot(snapshot);
      }
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mountedRef.current) void loadStatus({ silent: true });
      if (mountedRef.current) setBotBusy(botId, null);
    }
  }, [invoke, loadStatus, mergeSnapshot, setBotBusy, setBotError, workspaceFence]);
  const requestRemove = React10.useCallback((connection) => {
    setRemoveTargetId(connection.botId);
  }, []);
  const cancelRemove = React10.useCallback(() => {
    const botId = removeTargetId;
    setRemoveTargetId(null);
    scheduleAnimationFrame(() => removeButtonRefs.current.get(botId)?.focus(), "focus");
  }, [removeTargetId, scheduleAnimationFrame]);
  const confirmRemove = React10.useCallback(async (connection) => {
    const { botId, bot } = connection;
    const snapshotVersion = workspaceFence.beginMutation();
    setBotBusy(botId, "delete");
    setBotError(botId, null);
    try {
      const snapshot = normalizeBotsSnapshot(await invoke(
        FEISHU_ENDPOINTS.deleteBot,
        { botId, confirm: true }
      ));
      setRemoveTargetId(null);
      if (mountedRef.current && workspaceFence.canCommitMutation(snapshotVersion)) {
        mergeSnapshot(snapshot);
      }
      announce(`${bot.name}\u5DF2\u4ECE\u6B64 DeepSeek Harness \u79FB\u9664\uFF1B\u98DE\u4E66\u5F00\u653E\u5E73\u53F0\u4E2D\u7684\u5E94\u7528\u672A\u88AB\u5220\u9664\u3002`);
      scheduleAnimationFrame(() => addButtonRef.current?.focus(), "focus");
    } catch (error) {
      setBotError(botId, error);
      announce(`${bot.name}\u79FB\u9664\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002`);
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mountedRef.current) void loadStatus({ silent: true });
      setBotBusy(botId, null);
    }
  }, [announce, invoke, loadStatus, mergeSnapshot, scheduleAnimationFrame, setBotBusy, setBotError, workspaceFence]);
  const provision = model.provisioning;
  let provisionContent = null;
  if (provision?.phase === "creating") {
    provisionContent = h2(ProvisionProgress, { phase: "creating", busy: provisionBusy });
  } else if (provision?.phase === "qr") {
    provisionContent = h2(QrPane, {
      provision,
      now,
      onRefresh: () => void startProvisioning({ replace: true }),
      onCancel: () => void cancelProvisioning(),
      busy: provisionBusy || model.phase !== "ready"
    });
  } else if (provision?.phase === "connecting") {
    provisionContent = h2(ProvisionProgress, {
      phase: "connecting",
      onCancel: () => void cancelProvisioning(),
      busy: provisionBusy
    });
  } else if (provision?.phase === "error") {
    provisionContent = h2(ProvisionError2, {
      error: provision.error,
      onRetry: () => void startProvisioning({ replace: Boolean(provision.attemptId) }),
      onCancel: () => void cancelProvisioning(),
      busy: provisionBusy
    });
  }
  const credentialContent = credentialOpen ? h2(CredentialBindingPanel, {
    channel: "\u98DE\u4E66",
    identityLabel: "App ID",
    identityPlaceholder: "\u586B\u5199\u98DE\u4E66\u5F00\u653E\u5E73\u53F0 App ID",
    secretLabel: "App Secret",
    secretPlaceholder: "\u586B\u5199\u98DE\u4E66\u5F00\u653E\u5E73\u53F0 App Secret",
    busy: credentialBusy,
    error: credentialError,
    onSubmit: bindCredentials,
    onCancel: () => {
      setCredentialOpen(false);
      setCredentialError(null);
    }
  }) : null;
  const setCardRef = React10.useCallback((botId, node) => {
    if (node) cardRefs.current.set(botId, node);
    else cardRefs.current.delete(botId);
  }, []);
  const setRemoveButtonRef = React10.useCallback((botId, node) => {
    if (node) removeButtonRefs.current.set(botId, node);
    else removeButtonRefs.current.delete(botId);
  }, []);
  return h2(
    "section",
    { className: "bxf-page dim-channelPage", "aria-label": "\u98DE\u4E66\u673A\u5668\u4EBA\u8BBE\u7F6E" },
    h2(Heading2, {
      totals: model.totals,
      onAdd: () => void startProvisioning(),
      onCredential: () => {
        setCredentialOpen((value) => !value);
        setCredentialError(null);
      },
      credentialOpen,
      adding: Boolean(provision),
      busy: provisionBusy || credentialBusy,
      addButtonRef
    }),
    h2("div", {
      className: "bxf-visuallyHidden",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true"
    }, announcement),
    model.statusError ? h2(
      "div",
      { className: "bxf-statusNotice dim-statusNotice", role: "status" },
      h2(AlertIcon, { size: 16 }),
      h2("span", null, `\u72B6\u6001\u81EA\u52A8\u5237\u65B0\u5931\u8D25\uFF1A${model.statusError.message}`),
      h2(Button5, { size: "small", onClick: () => void loadStatus({ silent: true }), disabled: pageBusy }, "\u7ACB\u5373\u91CD\u8BD5")
    ) : null,
    model.phase === "loading" ? h2(LoadingView2) : model.phase === "error" ? h2(PageError, {
      error: model.pageError ?? { message: "\u65E0\u6CD5\u8BFB\u53D6\u8FDE\u63A5\u72B6\u6001" },
      onRetry: () => void loadStatus(),
      busy: pageBusy
    }) : h2(
      React10.Fragment,
      null,
      credentialContent,
      provisionContent,
      model.bots.length === 0 && !provision && !credentialOpen ? h2(EmptyView2, { onStart: () => void startProvisioning(), busy: provisionBusy }) : null,
      model.bots.length > 0 ? h2(BotList, {
        bots: model.bots,
        busyByBot,
        errorsByBot,
        testNoticesByBot,
        removeTargetId,
        onReconnect: (bot) => void reconnectOneBot(bot),
        onWorkspaceSave: saveWorkspace,
        onRequestRemove: requestRemove,
        onConfirmRemove: (bot) => void confirmRemove(bot),
        onCancelRemove: cancelRemove,
        setCardRef,
        setRemoveButtonRef
      }) : null
    )
  );
}

// plugin-src/client/channels/qq/api.js
var QQ_RPC_CHANNEL = "/qq";
var QQ_ENDPOINTS = Object.freeze({
  status: "connection.status",
  beginProvisioning: "provision.begin",
  pollProvisioning: "provision.poll",
  cancelProvisioning: "provision.cancel",
  bindCredentials: "bot.bind-credentials",
  reconnectBot: "bot.reconnect",
  deleteBot: "bot.delete",
  setWorkspace: "bot.workspace.set"
});
var PROVISION_STATES2 = /* @__PURE__ */ new Set(["starting", "pending", "refreshing", "connecting", "connected", "failed", "cancelled"]);
var ACCOUNT_STATES3 = /* @__PURE__ */ new Set(["connected", "connecting", "offline", "error"]);
var TEST_MESSAGE_CODES = /* @__PURE__ */ new Set(["test-target-unavailable", "test-message-failed"]);
var QR_DATA_URL2 = /^data:image\/(?:png|webp);base64,[a-z\d+/]+={0,2}$/i;
function isRecord4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text2(value, fallback, max = 240) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function id2(value) {
  const result = text2(value, "", 128);
  return /^[a-z\d_-]+$/i.test(result) ? result : void 0;
}
function timestamp3(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? void 0 : parsed;
}
function unwrapRpcResult4(result) {
  if (!isRecord4(result) || typeof result.ok !== "boolean") throw new Error("QQ \u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u54CD\u5E94");
  if (!result.ok) {
    const error = new Error(text2(result.error?.message, "QQ \u64CD\u4F5C\u5931\u8D25"));
    error.code = text2(result.error?.code, "QQ_RPC_ERROR", 80);
    throw error;
  }
  return result.value;
}
function safeQrSource3(value) {
  return typeof value === "string" && value.length <= 2 * 1024 * 1024 && QR_DATA_URL2.test(value) ? value : void 0;
}
function normalizeProvisioning3(value, now = Date.now()) {
  const source = isRecord4(value?.provisioning) ? value.provisioning : value;
  if (!isRecord4(source)) throw new Error("QQ \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u626B\u7801\u7ED1\u5B9A\u8FDB\u5EA6");
  const attemptId = id2(source.attemptId);
  if (!attemptId) throw new Error("QQ \u626B\u7801\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u7ED1\u5B9A\u4EFB\u52A1");
  const reported = text2(source.status, "failed", 32);
  const result = {
    attemptId,
    status: PROVISION_STATES2.has(reported) ? reported : "failed",
    expiresAt: timestamp3(source.expiresAt) ?? now + 5 * 6e4,
    pollIntervalMs: Math.min(1e4, Math.max(500, Number(source.pollIntervalMs) || 1e3)),
    qrRevision: Number.isSafeInteger(source.qrRevision) ? source.qrRevision : 0
  };
  const qrCodeDataUrl = safeQrSource3(source.qrCodeDataUrl);
  if (qrCodeDataUrl) result.qrCodeDataUrl = qrCodeDataUrl;
  if (id2(source.botId)) result.botId = id2(source.botId);
  if (isRecord4(source.error)) result.error = {
    code: text2(source.error.code, "QQ_PROVISION_FAILED", 80),
    message: text2(source.error.message, "QQ \u673A\u5668\u4EBA\u6CA1\u6709\u63A5\u5165\u5B8C\u6210")
  };
  return result;
}
function normalizeBot3(value) {
  if (!isRecord4(value) || !id2(value.botId)) return void 0;
  const connected = value.connected === true;
  const state = ACCOUNT_STATES3.has(value.state) ? value.state : "offline";
  return {
    botId: id2(value.botId),
    connected,
    state: connected ? "connected" : state,
    workspace: text2(value.workspace, "", 4096),
    bot: {
      name: text2(value.bot?.name, "QQ\u673A\u5668\u4EBA", 100),
      appIdMasked: text2(value.bot?.appIdMasked, "\u5E94\u7528\u6807\u8BC6\u5DF2\u5B89\u5168\u4FDD\u5B58", 140)
    },
    health: {
      summary: text2(value.health?.summary, connected ? "QQ WebSocket \u957F\u8FDE\u63A5\u8FD0\u884C\u6B63\u5E38" : "QQ \u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA"),
      lastCheckedAt: timestamp3(value.health?.lastCheckedAt)
    },
    error: isRecord4(value.error) ? {
      code: text2(value.error.code, "QQ_ACCOUNT_ERROR", 80),
      message: text2(value.error.message, "QQ \u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA")
    } : null
  };
}
function normalizeTestMessage2(value) {
  if (!isRecord4(value) || typeof value.sent !== "boolean") return void 0;
  if (value.sent) return { sent: true };
  const code = text2(value.code, "test-message-failed", 80);
  return {
    sent: false,
    code: TEST_MESSAGE_CODES.has(code) ? code : "test-message-failed"
  };
}
function normalizeSnapshot3(value) {
  const source = isRecord4(value?.snapshot) ? value.snapshot : value;
  if (!isRecord4(source) || !Array.isArray(source.bots)) throw new Error("QQ \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u673A\u5668\u4EBA\u5217\u8868");
  const bots = source.bots.map(normalizeBot3).filter(Boolean);
  const testMessage = normalizeTestMessage2(source.testMessage);
  return {
    revision: Number.isSafeInteger(source.revision) ? source.revision : 0,
    bots,
    totals: { configured: bots.length, connected: bots.filter((bot) => bot.connected).length },
    provisioning: source.provisioning ? normalizeProvisioning3(source.provisioning) : null,
    ...testMessage ? { testMessage } : {}
  };
}
function connectionTestFeedback2(result) {
  if (result?.sent === true) return "\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\uFF0C\u8BF7\u5230\u5BF9\u5E94\u673A\u5668\u4EBA\u4F1A\u8BDD\u4E2D\u786E\u8BA4\u3002";
  if (result?.code === "test-target-unavailable") {
    return "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\u3002\u673A\u5668\u4EBA\u5C1A\u672A\u6536\u5230\u53EF\u7528\u4E8E\u6D4B\u8BD5\u7684\u79C1\u804A\u6D88\u606F\u3002";
  }
  return result ? "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u6D4B\u8BD5\u6D88\u606F\u53D1\u9001\u5931\u8D25\u3002" : null;
}
function presentError4(error) {
  return {
    code: text2(error?.code, "QQ_ERROR", 80),
    message: text2(error?.message, "QQ \u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5")
  };
}
function formatRemaining3(milliseconds) {
  const seconds = Math.max(0, Math.ceil(Number(milliseconds) / 1e3) || 0);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// plugin-src/client/channels/qq/index.js
var React11 = __toESM(require("react"), 1);

// plugin-src/client/channels/qq/styles.js
var QQ_STYLE_ID = "xmanrui-dsh-im-qq-settings";
var CSS4 = String.raw`
.dqq-page { --ddt-accent: #1677ff; --ddt-accent-deep: #0958d9; --ddt-accent-wash: #eaf3ff; }
.dqq-avatar, .dqq-brand { color: #fff; background: #1677ff; }
.dqq-avatar svg, .dqq-brand svg { display: block; }
`;
function installQqStyles() {
  if (typeof document === "undefined") return () => {
  };
  const existing = document.querySelector(`style[data-plugin-css="${QQ_STYLE_ID}"]`);
  if (existing) return () => {
  };
  const style = document.createElement("style");
  style.dataset.plugin = "@xmanrui/dsh-im";
  style.dataset.pluginCss = QQ_STYLE_ID;
  style.textContent = CSS4;
  document.head.appendChild(style);
  return () => style.remove();
}

// plugin-src/client/channels/qq/index.js
var ACTIVE_STATES = /* @__PURE__ */ new Set(["pending", "refreshing", "connecting"]);
var Button7 = React11.forwardRef(function Button8({ children, kind = "secondary", className = "", ...props }, ref) {
  return h2("button", {
    ...props,
    ref,
    type: "button",
    className: `ddt-button ${className}`.trim(),
    "data-kind": kind
  }, children);
});
function checkedTime3(value) {
  if (!value) return "\u5C1A\u672A\u68C0\u67E5";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(value));
  } catch {
    return "\u521A\u521A";
  }
}
function Heading3({ totals, adding, busy, onAdd, onCredential, credentialOpen, addButtonRef }) {
  return h2(
    "div",
    { className: "ddt-heading" },
    h2(
      "div",
      { className: "ddt-tools" },
      h2(
        "div",
        { className: "dim-bindActions" },
        h2(Button7, {
          kind: "primary",
          className: "dim-scanButton",
          onClick: onAdd,
          disabled: adding || busy,
          ref: addButtonRef,
          "aria-label": "\u626B\u7801\u63A5\u5165 QQ \u673A\u5668\u4EBA"
        }, h2(QrActionIcon), adding ? "\u6B63\u5728\u63A5\u5165" : "\u626B\u7801\u63A5\u5165\u673A\u5668\u4EBA"),
        h2(Button7, {
          kind: "credential",
          className: "dim-credentialButton",
          onClick: onCredential,
          disabled: adding || busy,
          "aria-pressed": credentialOpen,
          "aria-label": "\u4F7F\u7528 AppID \u548C AppSecret \u7ED1\u5B9A QQ \u673A\u5668\u4EBA"
        }, h2(CredentialActionIcon), credentialOpen ? "\u6536\u8D77\u51ED\u636E" : "\u624B\u52A8\u63A5\u5165")
      ),
      totals.configured > 0 ? h2(
        "div",
        { className: "ddt-badge dim-onlineBadge" },
        h2("span", null, `${totals.connected} / ${totals.configured} \u5728\u7EBF`)
      ) : null
    )
  );
}
function LoadingView3() {
  return h2(
    "div",
    { className: "ddt-card ddt-loading dim-surfaceCard dim-loadingView", "aria-busy": "true" },
    h2("div", { className: "ddt-spinner dim-spinner" }),
    h2("span", null, "\u6B63\u5728\u8BFB\u53D6 QQ \u673A\u5668\u4EBA\u72B6\u6001\u2026")
  );
}
function EmptyView3({ busy, onStart }) {
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-cardBody ddt-empty dim-surfaceBody dim-emptyView" },
      h2(
        "div",
        { className: "dim-emptyCopy" },
        h2(
          "div",
          { className: "ddt-stateLabel dim-stateLabel" },
          h2("span", { className: "ddt-dot dim-stateDot" }),
          h2("span", null, "\u5C1A\u672A\u7ED1\u5B9A QQ \u673A\u5668\u4EBA")
        ),
        h2("h3", null, "\u4F7F\u7528\u624B\u673A QQ \u626B\u7801\u521B\u5EFA\u5E76\u7ED1\u5B9A\u673A\u5668\u4EBA"),
        h2("p", null, "\u626B\u7801\u7531\u817E\u8BAF\u5B98\u65B9\u9875\u9762\u5B8C\u6210\uFF0C\u4E0D\u9700\u8981\u624B\u52A8\u586B\u5199 AppID \u6216 AppSecret\u3002\u626B\u7801\u6210\u529F\u540E\uFF0C\u673A\u5668\u4EBA\u4F1A\u81EA\u52A8\u8FDE\u63A5 DeepSeek Harness\u3002"),
        h2(
          "div",
          { className: "ddt-actions dim-viewActions" },
          h2(
            Button7,
            { kind: "primary", onClick: onStart, disabled: busy },
            busy ? "\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801\u2026" : "\u751F\u6210 QQ \u4E8C\u7EF4\u7801"
          )
        )
      ),
      h2(
        "div",
        { className: "ddt-brandMark dim-emptyBrand dqq-brand", "aria-hidden": "true" },
        h2(QqLogoGlyph, { size: 64 })
      )
    )
  );
}
function QrPanel2({ provision, now, busy, onRefresh, onCancel }) {
  const source = safeQrSource3(provision.qrCodeDataUrl);
  const remaining = Math.max(0, provision.expiresAt - now);
  const duration = Math.max(1, provision.durationMs ?? 5 * 6e4);
  const progress = Math.round(Math.min(1, remaining / duration) * 100);
  const refreshing = provision.status === "refreshing";
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-cardBody ddt-qrLayout dim-surfaceBody dim-qrLayout" },
      h2(
        "div",
        { className: "ddt-qrColumn dim-qrColumn" },
        h2(
          "div",
          { className: "ddt-qrFrame dim-qrFrame" },
          source ? h2("img", { src: source, alt: "\u7528\u4E8E\u7ED1\u5B9A QQ \u673A\u5668\u4EBA\u7684\u4E00\u6B21\u6027\u4E8C\u7EF4\u7801" }) : h2(
            "div",
            { className: "ddt-qrFallback dim-qrFallback" },
            refreshing ? "\u4E8C\u7EF4\u7801\u6B63\u5728\u81EA\u52A8\u5237\u65B0\u2026" : "\u4E8C\u7EF4\u7801\u56FE\u7247\u6B63\u5728\u751F\u6210\u2026"
          )
        ),
        h2(
          "div",
          { className: "ddt-countdown dim-countdown" },
          h2(
            "div",
            { className: "ddt-countdownTop dim-countdownTop" },
            h2("span", null, "\u5F53\u524D\u4E8C\u7EF4\u7801\u6709\u6548\u65F6\u95F4"),
            h2("strong", null, refreshing ? "--:--" : formatRemaining3(remaining))
          ),
          h2("div", { className: "ddt-progress dim-progress", style: { "--ddt-progress": `${progress}%` } }, h2("span"))
        )
      ),
      h2(
        "div",
        { className: "ddt-qrCopy dim-qrCopy" },
        h2(
          "div",
          { className: "ddt-stateLabel dim-stateLabel" },
          h2("span", { className: "ddt-dot dim-stateDot", "data-tone": "warning" }),
          h2("span", null, refreshing ? "\u6B63\u5728\u5237\u65B0\u4E8C\u7EF4\u7801" : "\u7B49\u5F85\u624B\u673A QQ \u626B\u7801")
        ),
        h2("h3", null, "\u4F7F\u7528\u624B\u673A QQ \u5B8C\u6210\u673A\u5668\u4EBA\u7ED1\u5B9A"),
        h2("p", null, "\u817E\u8BAF\u9875\u9762\u4F1A\u521B\u5EFA\u6216\u7ED1\u5B9A\u4E00\u4E2A QQ \u673A\u5668\u4EBA\uFF0C\u5E76\u628A\u8FDE\u63A5\u51ED\u636E\u5B89\u5168\u4EA4\u7ED9\u672C\u673A Harness Host\u3002"),
        h2(
          "ol",
          { className: "ddt-steps dim-steps" },
          h2("li", null, "\u6253\u5F00\u624B\u673A QQ\uFF0C\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801"),
          h2("li", null, "\u5728\u817E\u8BAF\u6388\u6743\u9875\u9762\u786E\u8BA4\u521B\u5EFA\u6216\u7ED1\u5B9A\u673A\u5668\u4EBA"),
          h2("li", null, "\u8FD4\u56DE\u8FD9\u91CC\u7B49\u5F85\u8FDE\u63A5\u5B8C\u6210")
        ),
        h2(
          "div",
          { className: "ddt-actions dim-viewActions" },
          h2(Button7, { onClick: onRefresh, disabled: busy }, "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801"),
          h2(Button7, { kind: "quiet", onClick: onCancel, disabled: busy }, "\u53D6\u6D88")
        )
      )
    )
  );
}
function ProvisionView({ provision, busy, onRetry, onClose }) {
  if (provision.status === "connecting") {
    return h2(
      "div",
      { className: "ddt-card ddt-loading dim-surfaceCard dim-specialView", "aria-busy": "true" },
      h2("div", { className: "ddt-spinner dim-spinner" }),
      h2("h3", null, "QQ \u5DF2\u6388\u6743\uFF0C\u6B63\u5728\u8FDE\u63A5\u673A\u5668\u4EBA"),
      h2("p", null, "\u51ED\u636E\u6B63\u5728\u5199\u5165\u672C\u673A\uFF0C\u5E76\u542F\u52A8 QQ WebSocket \u6D88\u606F\u8FDE\u63A5\u3002")
    );
  }
  const error = provision.error ?? { code: "QQ_PROVISION_FAILED", message: "QQ \u673A\u5668\u4EBA\u6CA1\u6709\u7ED1\u5B9A\u5B8C\u6210" };
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-inlineError dim-inlineError", role: "alert" },
      h2("h3", null, "QQ \u673A\u5668\u4EBA\u6CA1\u6709\u7ED1\u5B9A\u5B8C\u6210"),
      h2("p", null, error.message),
      h2("span", { className: "ddt-errorCode" }, error.code),
      h2(
        "div",
        { className: "ddt-actions dim-viewActions" },
        h2(Button7, { kind: "primary", onClick: onRetry, disabled: busy }, "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801"),
        h2(Button7, { onClick: onClose, disabled: busy }, "\u5173\u95ED")
      )
    )
  );
}
function RemoveConfirmation3({ account, busy, onConfirm, onCancel }) {
  return h2(
    "div",
    { className: "ddt-confirm dim-confirm", role: "alertdialog" },
    h2("strong", null, `\u4ECE DeepSeek Harness \u79FB\u9664\u201C${account.bot.name}\u201D\uFF1F`),
    h2("p", null, "\u8FD9\u4F1A\u505C\u6B62\u6D88\u606F\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684\u5E94\u7528\u51ED\u636E\u3001\u673A\u5668\u4EBA\u914D\u7F6E\u53CA\u4F1A\u8BDD\u6620\u5C04\u3002\u817E\u8BAF\u5E73\u53F0\u4E2D\u7684\u673A\u5668\u4EBA\u4E0D\u4F1A\u88AB\u81EA\u52A8\u5220\u9664\u3002"),
    h2(
      "div",
      { className: "ddt-actions dim-viewActions" },
      h2(Button7, { onClick: onCancel, disabled: busy }, "\u4FDD\u7559\u673A\u5668\u4EBA"),
      h2(Button7, { kind: "danger", onClick: onConfirm, disabled: busy }, busy ? "\u6B63\u5728\u79FB\u9664\u2026" : "\u786E\u8BA4\u79FB\u9664\u63A5\u5165")
    )
  );
}
function AccountCard2({
  account,
  busy,
  feedback,
  removing,
  onReconnect,
  onWorkspaceSave,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove
}) {
  const tone = account.connected ? "success" : account.state === "error" ? "error" : "warning";
  const stateLabel = account.connected ? "\u8FD0\u884C\u6B63\u5E38" : account.state === "connecting" ? "\u6B63\u5728\u8FDE\u63A5" : "\u8FDE\u63A5\u672A\u5C31\u7EEA";
  const summary = account.error?.message ?? (account.connected ? null : account.health.summary);
  return h2(
    "article",
    { className: "ddt-card dim-botCard", "data-bot-id": account.botId },
    h2(
      "div",
      { className: "ddt-cardBody dim-botCardBody" },
      h2(
        "div",
        { className: "ddt-accountTop dim-botCardTop" },
        h2(
          "div",
          { className: "ddt-accountIdentity dim-botIdentity" },
          h2("div", { className: "ddt-avatar dim-botAvatar dqq-avatar", "aria-hidden": "true" }, h2(QqLogoGlyph, { size: 29 })),
          h2(
            "div",
            { className: "dim-botName" },
            h2("h3", null, account.bot.name),
            h2("p", null, account.bot.appIdMasked)
          )
        ),
        h2(
          "div",
          { className: "ddt-health dim-botHealth" },
          h2("span", { className: "ddt-dot dim-healthDot", "data-tone": tone }),
          h2("span", null, stateLabel)
        )
      ),
      h2(
        "dl",
        { className: "ddt-metrics dim-botMetrics" },
        h2("div", { className: "ddt-metric dim-botMetric" }, h2("dt", null, "\u6D88\u606F\u901A\u9053"), h2("dd", null, account.connected ? "WebSocket \u957F\u8FDE\u63A5" : "\u79BB\u7EBF")),
        h2("div", { className: "ddt-metric dim-botMetric" }, h2("dt", null, "\u6700\u8FD1\u68C0\u67E5"), h2("dd", null, checkedTime3(account.health.lastCheckedAt)))
      ),
      h2(WorkspaceEditor, {
        workspace: account.workspace,
        disabled: Boolean(busy),
        onSave: onWorkspaceSave
      }),
      h2(
        "div",
        { className: "ddt-accountFooter dim-cardFooter" },
        summary ? h2("div", { className: "ddt-summary dim-cardSummary" }, summary) : null,
        feedback ? h2("div", {
          className: "ddt-summary dim-cardSummary",
          role: "status",
          "aria-live": "polite"
        }, feedback) : null,
        h2(
          "div",
          { className: "ddt-actions dim-cardActions" },
          h2(Button7, { className: "dim-cardAction", onClick: onReconnect, disabled: Boolean(busy) }, busy === "reconnect" ? "\u68C0\u67E5\u4E2D\u2026" : account.connected ? "\u68C0\u67E5\u8FDE\u63A5" : "\u91CD\u8BD5\u8FDE\u63A5"),
          h2(Button7, { className: "dim-cardAction", kind: "danger", onClick: onRequestRemove, disabled: Boolean(busy) }, "\u79FB\u9664\u63A5\u5165")
        )
      )
    ),
    removing ? h2(RemoveConfirmation3, {
      account,
      busy: busy === "delete",
      onConfirm: onConfirmRemove,
      onCancel: onCancelRemove
    }) : null
  );
}
function QqSettingsTab({ rpcCall }) {
  const [model, setModel] = React11.useState({ phase: "loading", bots: [], totals: { configured: 0, connected: 0 }, error: null });
  const [provision, setProvision] = React11.useState(null);
  const [busy, setBusy] = React11.useState(false);
  const [busyByBot, setBusyByBot] = React11.useState({});
  const [feedbackByBot, setFeedbackByBot] = React11.useState({});
  const [removeTarget, setRemoveTarget] = React11.useState(null);
  const [credentialOpen, setCredentialOpen] = React11.useState(false);
  const [credentialError, setCredentialError] = React11.useState(null);
  const [now, setNow] = React11.useState(Date.now());
  const mounted = React11.useRef(true);
  const workspaceFence = useWorkspaceSnapshotFence();
  const addButtonRef = React11.useRef(null);
  React11.useEffect(() => {
    const disposeDingtalk = installDingtalkStyles();
    const disposeQq = installQqStyles();
    mounted.current = true;
    return () => {
      mounted.current = false;
      disposeQq();
      disposeDingtalk();
    };
  }, []);
  const invoke = React11.useCallback(async (endpoint, payload = {}, signal) => {
    if (typeof rpcCall !== "function") throw new TypeError("QQ \u8BBE\u7F6E\u9875\u7F3A\u5C11 RPC \u8FDE\u63A5");
    return unwrapRpcResult4(await rpcCall(endpoint, payload, signal));
  }, [rpcCall]);
  const loadStatus = React11.useCallback(async ({ signal, silent = false, restore = false } = {}) => {
    const workspaceVersion = workspaceFence.beginStatus();
    if (workspaceVersion === null) return void 0;
    if (!silent && mounted.current) setModel((current) => ({ ...current, phase: "loading", error: null }));
    try {
      const snapshot = normalizeSnapshot3(await invoke(QQ_ENDPOINTS.status, {}, signal));
      if (!mounted.current || signal?.aborted || !workspaceFence.canCommitStatus(workspaceVersion)) return void 0;
      setModel({ phase: "ready", bots: snapshot.bots, totals: snapshot.totals, error: null });
      if (restore && snapshot.provisioning) setProvision({
        ...snapshot.provisioning,
        durationMs: Math.max(1, snapshot.provisioning.expiresAt - Date.now())
      });
      return snapshot;
    } catch (error) {
      if (error?.name !== "AbortError" && mounted.current && !signal?.aborted && workspaceFence.canCommitStatus(workspaceVersion)) {
        setModel((current) => ({ ...current, phase: silent ? current.phase : "error", error: presentError4(error) }));
      }
      return void 0;
    }
  }, [invoke, workspaceFence]);
  React11.useEffect(() => {
    const controller = new AbortController();
    void loadStatus({ signal: controller.signal, restore: true });
    return () => controller.abort();
  }, [loadStatus]);
  React11.useEffect(() => {
    if (model.phase !== "ready") return void 0;
    const controller = new AbortController();
    const timer = window.setInterval(() => void loadStatus({ signal: controller.signal, silent: true }), 15e3);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadStatus, model.phase]);
  React11.useEffect(() => {
    if (!provision || !ACTIVE_STATES.has(provision.status)) return void 0;
    const timer = window.setInterval(() => mounted.current && setNow(Date.now()), 1e3);
    return () => window.clearInterval(timer);
  }, [provision?.attemptId, provision?.status]);
  const startProvisioning = React11.useCallback(async (replace = false) => {
    setCredentialOpen(false);
    setCredentialError(null);
    setBusy(true);
    try {
      if (replace && provision?.attemptId) await invoke(QQ_ENDPOINTS.cancelProvisioning, { attemptId: provision.attemptId });
      if (!mounted.current) return;
      setProvision({ status: "starting" });
      const started = normalizeProvisioning3(await invoke(QQ_ENDPOINTS.beginProvisioning, { locale: "zh-CN" }));
      if (!mounted.current) return;
      setNow(Date.now());
      setProvision({ ...started, durationMs: Math.max(1, started.expiresAt - Date.now()) });
    } catch (error) {
      if (mounted.current) setProvision({ status: "failed", error: presentError4(error) });
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [invoke, provision?.attemptId]);
  const bindCredentials = React11.useCallback(async ({ identity, secret }) => {
    const snapshotVersion = workspaceFence.beginMutation();
    setBusy(true);
    setCredentialError(null);
    try {
      const snapshot = normalizeSnapshot3(await invoke(
        QQ_ENDPOINTS.bindCredentials,
        { appId: identity, appSecret: secret }
      ));
      if (!mounted.current) return;
      if (workspaceFence.canCommitMutation(snapshotVersion)) {
        setModel({ phase: "ready", bots: snapshot.bots, totals: snapshot.totals, error: null });
      }
      setCredentialOpen(false);
    } catch (error) {
      if (mounted.current) setCredentialError(presentError4(error));
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mounted.current) void loadStatus({ silent: true });
      if (mounted.current) setBusy(false);
    }
  }, [invoke, loadStatus, workspaceFence]);
  const closeProvision = React11.useCallback(async () => {
    setBusy(true);
    try {
      if (provision?.attemptId && ACTIVE_STATES.has(provision.status)) {
        await invoke(QQ_ENDPOINTS.cancelProvisioning, { attemptId: provision.attemptId });
      }
      if (mounted.current) setProvision(null);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [invoke, provision?.attemptId, provision?.status]);
  React11.useEffect(() => {
    const attemptId = provision?.attemptId;
    if (!attemptId || !ACTIVE_STATES.has(provision.status)) return void 0;
    const controller = new AbortController();
    let disposed = false;
    let timer;
    const poll = async () => {
      try {
        const current = normalizeProvisioning3(await invoke(QQ_ENDPOINTS.pollProvisioning, { attemptId }, controller.signal));
        if (disposed || controller.signal.aborted || !mounted.current) return;
        if (current.status === "connected") {
          setProvision(null);
          await loadStatus({ signal: controller.signal, silent: true });
          return;
        }
        setProvision((previous) => previous?.attemptId === attemptId ? { ...previous, ...current, durationMs: current.qrRevision !== previous.qrRevision ? Math.max(1, current.expiresAt - Date.now()) : previous.durationMs } : previous);
        if (ACTIVE_STATES.has(current.status)) timer = window.setTimeout(poll, current.pollIntervalMs);
      } catch (error) {
        if (!disposed && !controller.signal.aborted && mounted.current) {
          setProvision((current) => ({ ...current, status: "failed", error: presentError4(error) }));
        }
      }
    };
    timer = window.setTimeout(poll, provision.pollIntervalMs ?? 1e3);
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [invoke, loadStatus, provision?.attemptId, provision?.pollIntervalMs, provision?.status]);
  const botAction = React11.useCallback(async (account, operation, endpoint, payload) => {
    const snapshotVersion = workspaceFence.beginMutation();
    setBusyByBot((current) => ({ ...current, [account.botId]: operation }));
    try {
      const snapshot = normalizeSnapshot3(await invoke(endpoint, payload));
      if (mounted.current && workspaceFence.canCommitMutation(snapshotVersion)) {
        setModel({ phase: "ready", bots: snapshot.bots, totals: snapshot.totals, error: null });
      }
      return snapshot;
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mounted.current) void loadStatus({ silent: true });
      if (mounted.current) setBusyByBot((current) => {
        const next = { ...current };
        delete next[account.botId];
        return next;
      });
    }
  }, [invoke, loadStatus, workspaceFence]);
  const reconnect = React11.useCallback(async (account) => {
    setFeedbackByBot((current) => {
      const next = { ...current };
      delete next[account.botId];
      return next;
    });
    try {
      const snapshot = await botAction(
        account,
        "reconnect",
        QQ_ENDPOINTS.reconnectBot,
        { botId: account.botId, sendTest: true }
      );
      if (mounted.current) {
        setFeedbackByBot((current) => ({
          ...current,
          [account.botId]: connectionTestFeedback2(snapshot?.testMessage)
        }));
      }
    } catch {
      if (mounted.current) {
        setFeedbackByBot((current) => ({
          ...current,
          [account.botId]: "\u8FDE\u63A5\u68C0\u67E5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002"
        }));
      }
    }
  }, [botAction]);
  let provisionView = null;
  if (provision?.status === "starting") provisionView = h2("div", { className: "ddt-card ddt-loading dim-surfaceCard" }, h2("div", { className: "ddt-spinner" }), "\u6B63\u5728\u7533\u8BF7 QQ \u4E8C\u7EF4\u7801\u2026");
  else if (["pending", "refreshing"].includes(provision?.status)) provisionView = h2(QrPanel2, {
    provision,
    now,
    busy,
    onRefresh: () => void startProvisioning(true),
    onCancel: () => void closeProvision()
  });
  else if (provision) provisionView = h2(ProvisionView, {
    provision,
    busy,
    onRetry: () => void startProvisioning(true),
    onClose: () => void closeProvision()
  });
  const botList = model.bots.length > 0 ? h2(
    "section",
    { className: "dim-listSection" },
    h2(
      "div",
      { className: "ddt-listHeading dim-listHeading" },
      h2("h3", null, "\u5DF2\u7ED1\u5B9A\u7684 QQ \u673A\u5668\u4EBA")
    ),
    h2("ul", { className: "ddt-list dim-botList" }, model.bots.map((account) => h2("li", { key: account.botId }, h2(AccountCard2, {
      account,
      busy: busyByBot[account.botId],
      feedback: feedbackByBot[account.botId],
      removing: removeTarget === account.botId,
      onReconnect: () => void reconnect(account),
      onWorkspaceSave: (workspace) => botAction(
        account,
        "workspace",
        QQ_ENDPOINTS.setWorkspace,
        { botId: account.botId, workspace }
      ),
      onRequestRemove: () => setRemoveTarget(account.botId),
      onCancelRemove: () => setRemoveTarget(null),
      onConfirmRemove: async () => {
        await botAction(account, "delete", QQ_ENDPOINTS.deleteBot, { botId: account.botId, confirm: true });
        if (mounted.current) setRemoveTarget(null);
      }
    }))))
  ) : null;
  const credentialView = credentialOpen ? h2(CredentialBindingPanel, {
    channel: "QQ",
    identityLabel: "AppID",
    identityPlaceholder: "\u586B\u5199 QQ \u5F00\u653E\u5E73\u53F0 AppID",
    secretLabel: "AppSecret",
    secretPlaceholder: "\u586B\u5199 QQ \u5F00\u653E\u5E73\u53F0 AppSecret",
    busy,
    error: credentialError,
    onSubmit: bindCredentials,
    onCancel: () => {
      setCredentialOpen(false);
      setCredentialError(null);
    }
  }) : null;
  return h2(
    "section",
    { className: "ddt-page dqq-page dim-channelPage", "aria-label": "QQ \u8BBE\u7F6E" },
    h2(Heading3, {
      totals: model.totals,
      adding: Boolean(provision),
      busy,
      onAdd: () => void startProvisioning(),
      onCredential: () => {
        setCredentialOpen((value) => !value);
        setCredentialError(null);
      },
      credentialOpen,
      addButtonRef
    }),
    model.phase === "loading" ? h2(LoadingView3) : model.phase === "error" ? h2("div", { className: "ddt-card dim-surfaceCard" }, h2("div", { className: "ddt-inlineError dim-inlineError" }, h2("h3", null, "\u65E0\u6CD5\u8BFB\u53D6 QQ \u673A\u5668\u4EBA\u72B6\u6001"), h2("p", null, model.error?.message), h2(Button7, { onClick: () => void loadStatus() }, "\u91CD\u65B0\u8BFB\u53D6"))) : h2(
      React11.Fragment,
      null,
      credentialView,
      provisionView,
      model.bots.length === 0 && !provision && !credentialOpen ? h2(EmptyView3, { busy, onStart: () => void startProvisioning() }) : null,
      botList
    )
  );
}

// plugin-src/client/channels/slack/api.js
var SLACK_RPC_CHANNEL = "/slack";
var SLACK_ENDPOINTS = TOKEN_BOT_ENDPOINTS;
var api2 = createTokenChannelApi("Slack", " Socket Mode \u957F\u8FDE\u63A5");
var unwrapRpcResult5 = api2.unwrapRpcResult;
var normalizeSnapshot4 = api2.normalizeSnapshot;
var presentError5 = api2.presentError;

// plugin-src/client/channels/slack/index.js
var React12 = __toESM(require("react"), 1);

// src/channels/slack/manifest.mjs
var SLACK_APP_MANIFEST_YAML = `_metadata:
  major_version: 1
display_information:
  name: DeepSeek Harness
  description: Connect Slack conversations to a local DeepSeek Harness agent.
  background_color: "#4A154B"
features:
  app_home:
    home_tab_enabled: false
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
  bot_user:
    display_name: DeepSeek Harness
    always_online: false
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - chat:write
      - files:read
      - im:history
settings:
  event_subscriptions:
    bot_events:
      - app_mention
      - message.im
  org_deploy_enabled: false
  socket_mode_enabled: true
  token_rotation_enabled: false
`;
var SLACK_CREATE_APP_URL = "https://api.slack.com/apps?new_app=1";

// plugin-src/client/channels/slack/styles.js
var SLACK_STYLE_ID = "xmanrui-dsh-im-slack-settings";
var CSS5 = String.raw`
.dsl-page { --ddt-accent: #4a154b; --ddt-accent-deep: #321033; --ddt-accent-wash: #f7eef7; }
.dsl-avatar { color: #fff; background: #4a154b; }
.dsl-avatar svg { display: block; }
.dsl-setup { display: grid; gap: 18px; }
.dsl-guide { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 18px; padding: 16px; border: 1px solid color-mix(in srgb, #4a154b 18%, var(--dsw-alias-border-l2, #e5e6eb)); border-radius: 11px; background: color-mix(in srgb, #4a154b 4%, var(--dsw-alias-bg-layer-1, #fff)); }
.dsl-guideCopy { min-width: 0; }
.dsl-guideCopy strong { display: block; margin-bottom: 5px; color: var(--dsw-alias-label-primary, #1f2329); font-size: 13px; }
.dsl-guideCopy p { margin: 0; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: 1.6; }
.dsl-guideActions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.dsl-guideActions .ddt-button { white-space: nowrap; }
.dsl-copyState { color: var(--dsw-alias-state-success-primary, #20a162); }
.dsl-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.dsl-tokenHint { grid-column: 1 / -1; margin: -4px 0 0; color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 11px; line-height: 1.55; }
@container (max-width: 680px) {
  .dsl-guide { grid-template-columns: minmax(0, 1fr); }
  .dsl-guideActions { justify-content: flex-start; }
  .dsl-fields { grid-template-columns: minmax(0, 1fr); }
}
`;
function installSlackStyles() {
  if (typeof document === "undefined") return () => {
  };
  const existing = document.querySelector(`style[data-plugin-css="${SLACK_STYLE_ID}"]`);
  if (existing) return () => {
  };
  const style = document.createElement("style");
  style.dataset.plugin = "@xmanrui/dsh-im";
  style.dataset.pluginCss = SLACK_STYLE_ID;
  style.textContent = CSS5;
  document.head.appendChild(style);
  return () => style.remove();
}

// plugin-src/client/channels/slack/index.js
function SlackCredentialPanel({ busy, error, onSubmit, onCancel }) {
  const [botToken, setBotToken] = React12.useState("");
  const [appToken, setAppToken] = React12.useState("");
  const [copied, setCopied] = React12.useState(false);
  const headingId = React12.useId();
  const copyManifest = async () => {
    try {
      await navigator.clipboard.writeText(SLACK_APP_MANIFEST_YAML);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2e3);
    } catch {
      setCopied(false);
    }
  };
  const submit = (event) => {
    event.preventDefault();
    const normalizedBotToken = botToken.trim();
    const normalizedAppToken = appToken.trim();
    if (!normalizedBotToken || !normalizedAppToken || busy) return;
    void onSubmit?.({ botToken: normalizedBotToken, appToken: normalizedAppToken });
  };
  return h2(
    "section",
    {
      className: "ddt-card dim-surfaceCard dim-credentialPanel dsl-setup",
      "aria-labelledby": headingId
    },
    h2("h3", { id: headingId, className: "dim-credentialTitle" }, "\u63A5\u5165 Slack \u673A\u5668\u4EBA"),
    h2(
      "div",
      { className: "dsl-guide" },
      h2(
        "div",
        { className: "dsl-guideCopy" },
        h2("strong", null, "\u5148\u7528 Manifest \u521B\u5EFA\u5E76\u914D\u7F6E Slack App"),
        h2("p", null, "\u590D\u5236\u914D\u7F6E\u540E\uFF0C\u5728 Slack \u9009\u62E9 From a manifest\uFF1B\u521B\u5EFA\u5B8C\u6210\u540E\u751F\u6210 connections:write App Token\uFF0C\u5E76\u5C06\u5E94\u7528\u5B89\u88C5\u5230\u5DE5\u4F5C\u533A\u3002")
      ),
      h2(
        "div",
        { className: "dsl-guideActions" },
        h2("button", {
          type: "button",
          className: "ddt-button",
          onClick: () => void copyManifest(),
          disabled: busy
        }, copied ? h2("span", { className: "dsl-copyState" }, "\u5DF2\u590D\u5236 Manifest") : "\u590D\u5236 Manifest"),
        h2("a", {
          className: "ddt-button",
          href: SLACK_CREATE_APP_URL,
          target: "_blank",
          rel: "noreferrer"
        }, "\u6253\u5F00 Slack \u521B\u5EFA\u9875")
      )
    ),
    h2(
      "form",
      { className: "dim-credentialForm dim-credentialFormSingle", onSubmit: submit },
      h2(
        "div",
        { className: "dsl-fields" },
        h2(
          "label",
          { className: "dim-credentialField" },
          h2("span", null, "Bot Token"),
          h2("input", {
            type: "password",
            value: botToken,
            onChange: (event) => setBotToken(event.target.value),
            placeholder: "xoxb-\u2026",
            maxLength: 4096,
            autoCapitalize: "none",
            autoCorrect: "off",
            spellCheck: false,
            autoComplete: "new-password",
            disabled: busy,
            required: true
          })
        ),
        h2(
          "label",
          { className: "dim-credentialField" },
          h2("span", null, "App Token"),
          h2("input", {
            type: "password",
            value: appToken,
            onChange: (event) => setAppToken(event.target.value),
            placeholder: "xapp-\u2026",
            maxLength: 4096,
            autoCapitalize: "none",
            autoCorrect: "off",
            spellCheck: false,
            autoComplete: "new-password",
            disabled: busy,
            required: true
          })
        ),
        h2("p", { className: "dsl-tokenHint" }, "Bot Token \u6765\u81EA OAuth & Permissions\uFF1BApp Token \u6765\u81EA Basic Information\uFF0C\u5E76\u4E14\u5FC5\u987B\u5305\u542B connections:write\u3002")
      ),
      error ? h2("p", { className: "dim-credentialError", role: "alert" }, error.message ?? String(error)) : null,
      h2(
        "div",
        { className: "ddt-actions dim-viewActions dim-credentialActions" },
        h2("button", {
          type: "submit",
          className: "ddt-button",
          "data-kind": "primary",
          disabled: busy || !botToken.trim() || !appToken.trim()
        }, busy ? "\u6B63\u5728\u9A8C\u8BC1\u5E76\u8FDE\u63A5\u2026" : "\u9A8C\u8BC1\u5E76\u8FDE\u63A5"),
        h2("button", {
          type: "button",
          className: "ddt-button",
          onClick: onCancel,
          disabled: busy
        }, "\u53D6\u6D88")
      )
    )
  );
}
var channel2 = createTokenChannelSettings({
  channel: "Slack",
  endpoints: SLACK_ENDPOINTS,
  api: api2,
  LogoGlyph: SlackLogoGlyph,
  installStyles: installSlackStyles,
  pageClass: "dsl-page",
  avatarClass: "dsl-avatar",
  connectionLabel: "Socket Mode \u957F\u8FDE\u63A5",
  emptyTitle: "\u63A5\u5165 Slack \u673A\u5668\u4EBA",
  emptyDescription: "\u4F7F\u7528\u5B98\u65B9 App Manifest \u5FEB\u901F\u914D\u7F6E\u673A\u5668\u4EBA\uFF0C\u518D\u586B\u5199 Bot Token \u4E0E App Token \u5EFA\u7ACB\u672C\u5730 Socket Mode \u8FDE\u63A5\u3002",
  platformLabel: "Slack \u5DE5\u4F5C\u533A",
  CredentialPanel: SlackCredentialPanel,
  credentialPayload: ({ botToken, appToken }) => ({ botToken, appToken }),
  credentialAriaLabel: "\u4F7F\u7528 Manifest \u548C\u53CC Token \u63A5\u5165 Slack \u673A\u5668\u4EBA",
  credentialOpenLabel: "\u63A5\u5165\u673A\u5668\u4EBA",
  credentialCloseLabel: "\u6536\u8D77\u63A5\u5165",
  credentialNoun: "Bot Token \u4E0E App Token",
  emptyActionLabel: "\u5F00\u59CB\u63A5\u5165"
});
var SlackSettingsTab = channel2.SettingsTab;
var SlackAccountCard = channel2.AccountCard;

// plugin-src/client/channels/telegram/api.js
var TELEGRAM_RPC_CHANNEL = "/telegram";
var TELEGRAM_ENDPOINTS = TOKEN_BOT_ENDPOINTS;
var api3 = createTokenChannelApi("Telegram", " Bot API \u957F\u8F6E\u8BE2");
var unwrapRpcResult6 = api3.unwrapRpcResult;
var normalizeSnapshot5 = api3.normalizeSnapshot;
var presentError6 = api3.presentError;

// plugin-src/client/channels/telegram/styles.js
var TELEGRAM_STYLE_ID = "xmanrui-dsh-im-telegram-settings";
var CSS6 = String.raw`
.dtg-page { --ddt-accent: #229ed9; --ddt-accent-deep: #1687bd; --ddt-accent-wash: #eaf7fd; }
.dtg-avatar { color: #fff; background: #229ed9; }
.dtg-avatar svg { display: block; }
`;
function installTelegramStyles() {
  if (typeof document === "undefined") return () => {
  };
  const existing = document.querySelector(`style[data-plugin-css="${TELEGRAM_STYLE_ID}"]`);
  if (existing) return () => {
  };
  const style = document.createElement("style");
  style.dataset.plugin = "@xmanrui/dsh-im";
  style.dataset.pluginCss = TELEGRAM_STYLE_ID;
  style.textContent = CSS6;
  document.head.appendChild(style);
  return () => style.remove();
}

// plugin-src/client/channels/telegram/index.js
var channel3 = createTokenChannelSettings({
  channel: "Telegram",
  endpoints: TELEGRAM_ENDPOINTS,
  api: api3,
  LogoGlyph: TelegramLogoGlyph,
  installStyles: installTelegramStyles,
  pageClass: "dtg-page",
  avatarClass: "dtg-avatar",
  connectionLabel: "Bot API \u957F\u8F6E\u8BE2",
  tokenPlaceholder: "\u586B\u5199 @BotFather \u751F\u6210\u7684 Bot Token",
  emptyTitle: "\u63A5\u5165 Telegram \u673A\u5668\u4EBA",
  emptyDescription: "\u5148\u901A\u8FC7 @BotFather \u83B7\u53D6 Bot Token\uFF0C\u518D\u5728\u8FD9\u91CC\u5B8C\u6210\u63A5\u5165\u3002",
  platformLabel: "Telegram"
});
var TelegramSettingsTab = channel3.SettingsTab;
var TelegramAccountCard = channel3.AccountCard;

// plugin-src/client/channels/wecom/api.js
var WECOM_RPC_CHANNEL = "/wecom";
var WECOM_ENDPOINTS = Object.freeze({
  status: "connection.status",
  beginProvisioning: "provision.begin",
  pollProvisioning: "provision.poll",
  cancelProvisioning: "provision.cancel",
  bindCredentials: "bot.bind-credentials",
  reconnectBot: "bot.reconnect",
  deleteBot: "bot.delete",
  setWorkspace: "bot.workspace.set"
});
var PROVISION_STATES3 = /* @__PURE__ */ new Set(["starting", "pending", "refreshing", "connecting", "connected", "failed", "cancelled"]);
var ACCOUNT_STATES4 = /* @__PURE__ */ new Set(["connected", "connecting", "offline", "error"]);
var QR_DATA_URL3 = /^data:image\/(?:png|webp);base64,[a-z\d+/]+={0,2}$/i;
function isRecord5(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text3(value, fallback, max = 240) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function id3(value) {
  const result = text3(value, "", 128);
  return /^[a-z\d_-]+$/i.test(result) ? result : void 0;
}
function timestamp4(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? void 0 : parsed;
}
function normalizeTestMessage3(value) {
  if (!isRecord5(value)) return null;
  if (value.sent === true) return { sent: true };
  if (value.sent !== false) return null;
  const code = value.code === "test-target-unavailable" ? "test-target-unavailable" : "test-message-failed";
  return { sent: false, code };
}
function unwrapRpcResult7(result) {
  if (!isRecord5(result) || typeof result.ok !== "boolean") throw new Error("\u4F01\u4E1A\u5FAE\u4FE1\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u54CD\u5E94");
  if (!result.ok) {
    const error = new Error(text3(result.error?.message, "\u4F01\u4E1A\u5FAE\u4FE1\u64CD\u4F5C\u5931\u8D25"));
    error.code = text3(result.error?.code, "WECOM_RPC_ERROR", 80);
    throw error;
  }
  return result.value;
}
function safeQrSource4(value) {
  return typeof value === "string" && value.length <= 2 * 1024 * 1024 && QR_DATA_URL3.test(value) ? value : void 0;
}
function normalizeProvisioning4(value, now = Date.now()) {
  const source = isRecord5(value?.provisioning) ? value.provisioning : value;
  if (!isRecord5(source)) throw new Error("\u4F01\u4E1A\u5FAE\u4FE1\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u626B\u7801\u7ED1\u5B9A\u8FDB\u5EA6");
  const attemptId = id3(source.attemptId);
  if (!attemptId) throw new Error("\u4F01\u4E1A\u5FAE\u4FE1\u626B\u7801\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u7ED1\u5B9A\u4EFB\u52A1");
  const reported = text3(source.status, "failed", 32);
  const result = {
    attemptId,
    status: PROVISION_STATES3.has(reported) ? reported : "failed",
    expiresAt: timestamp4(source.expiresAt) ?? now + 5 * 6e4,
    pollIntervalMs: Math.min(1e4, Math.max(500, Number(source.pollIntervalMs) || 1e3)),
    qrRevision: Number.isSafeInteger(source.qrRevision) ? source.qrRevision : 0
  };
  const qrCodeDataUrl = safeQrSource4(source.qrCodeDataUrl);
  if (qrCodeDataUrl) result.qrCodeDataUrl = qrCodeDataUrl;
  if (id3(source.botId)) result.botId = id3(source.botId);
  if (isRecord5(source.error)) result.error = {
    code: text3(source.error.code, "WECOM_PROVISION_FAILED", 80),
    message: text3(source.error.message, "\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA\u6CA1\u6709\u63A5\u5165\u5B8C\u6210")
  };
  return result;
}
function normalizeBot4(value) {
  if (!isRecord5(value) || !id3(value.botId)) return void 0;
  const connected = value.connected === true;
  const state = ACCOUNT_STATES4.has(value.state) ? value.state : "offline";
  return {
    botId: id3(value.botId),
    connected,
    state: connected ? "connected" : state,
    workspace: text3(value.workspace, "", 4096),
    bot: {
      name: text3(value.bot?.name, "\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA", 100),
      appIdMasked: text3(value.bot?.appIdMasked, "\u5E94\u7528\u6807\u8BC6\u5DF2\u5B89\u5168\u4FDD\u5B58", 140)
    },
    health: {
      summary: text3(value.health?.summary, connected ? "\u4F01\u4E1A\u5FAE\u4FE1 WebSocket \u957F\u8FDE\u63A5\u8FD0\u884C\u6B63\u5E38" : "\u4F01\u4E1A\u5FAE\u4FE1\u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA"),
      lastCheckedAt: timestamp4(value.health?.lastCheckedAt)
    },
    error: isRecord5(value.error) ? {
      code: text3(value.error.code, "WECOM_ACCOUNT_ERROR", 80),
      message: text3(value.error.message, "\u4F01\u4E1A\u5FAE\u4FE1\u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA")
    } : null
  };
}
function normalizeSnapshot6(value) {
  const source = isRecord5(value?.snapshot) ? value.snapshot : value;
  if (!isRecord5(source) || !Array.isArray(source.bots)) throw new Error("\u4F01\u4E1A\u5FAE\u4FE1\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u673A\u5668\u4EBA\u5217\u8868");
  const bots = source.bots.map(normalizeBot4).filter(Boolean);
  return {
    revision: Number.isSafeInteger(source.revision) ? source.revision : 0,
    bots,
    totals: { configured: bots.length, connected: bots.filter((bot) => bot.connected).length },
    provisioning: source.provisioning ? normalizeProvisioning4(source.provisioning) : null,
    testMessage: normalizeTestMessage3(source.testMessage)
  };
}
function presentError7(error) {
  return {
    code: text3(error?.code, "WECOM_ERROR", 80),
    message: text3(error?.message, "\u4F01\u4E1A\u5FAE\u4FE1\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5")
  };
}
function formatRemaining4(milliseconds) {
  const seconds = Math.max(0, Math.ceil(Number(milliseconds) / 1e3) || 0);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// plugin-src/client/channels/wecom/index.js
var React13 = __toESM(require("react"), 1);

// plugin-src/client/channels/wecom/styles.js
var WECOM_STYLE_ID = "xmanrui-dsh-im-wecom-settings";
var CSS7 = String.raw`
.dwecom-page { --ddt-accent: #3370ff; --ddt-accent-deep: #245bdb; --ddt-accent-wash: #eef4ff; }
.dwecom-avatar, .dwecom-brand { color: #3370ff; background: #fff; border: 1px solid var(--dsw-alias-border-l2, #e5e6eb); }
.dwecom-avatar svg, .dwecom-brand svg { display: block; }
`;
function installWecomStyles() {
  if (typeof document === "undefined") return () => {
  };
  const existing = document.querySelector(`style[data-plugin-css="${WECOM_STYLE_ID}"]`);
  if (existing) return () => {
  };
  const style = document.createElement("style");
  style.dataset.plugin = "@xmanrui/dsh-im";
  style.dataset.pluginCss = WECOM_STYLE_ID;
  style.textContent = CSS7;
  document.head.appendChild(style);
  return () => style.remove();
}

// plugin-src/client/channels/wecom/index.js
var ACTIVE_STATES2 = /* @__PURE__ */ new Set(["pending", "refreshing", "connecting"]);
var Button9 = React13.forwardRef(function Button10({ children, kind = "secondary", className = "", ...props }, ref) {
  return h2("button", {
    ...props,
    ref,
    type: "button",
    className: `ddt-button ${className}`.trim(),
    "data-kind": kind
  }, children);
});
function checkedTime4(value) {
  if (!value) return "\u5C1A\u672A\u68C0\u67E5";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(value));
  } catch {
    return "\u521A\u521A";
  }
}
function Heading4({ totals, adding, busy, onAdd, onCredential, credentialOpen, addButtonRef }) {
  return h2(
    "div",
    { className: "ddt-heading" },
    h2(
      "div",
      { className: "ddt-tools" },
      h2(
        "div",
        { className: "dim-bindActions" },
        h2(Button9, {
          kind: "primary",
          className: "dim-scanButton",
          onClick: onAdd,
          disabled: adding || busy,
          ref: addButtonRef,
          "aria-label": "\u626B\u7801\u63A5\u5165\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA"
        }, h2(QrActionIcon), adding ? "\u6B63\u5728\u63A5\u5165" : "\u626B\u7801\u63A5\u5165\u673A\u5668\u4EBA"),
        h2(Button9, {
          kind: "credential",
          className: "dim-credentialButton",
          onClick: onCredential,
          disabled: adding || busy,
          "aria-pressed": credentialOpen,
          "aria-label": "\u4F7F\u7528 Bot ID \u548C Secret \u7ED1\u5B9A\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA"
        }, h2(CredentialActionIcon), credentialOpen ? "\u6536\u8D77\u51ED\u636E" : "\u624B\u52A8\u63A5\u5165")
      ),
      totals.configured > 0 ? h2(
        "div",
        { className: "ddt-badge dim-onlineBadge" },
        h2("span", null, `${totals.connected} / ${totals.configured} \u5728\u7EBF`)
      ) : null
    )
  );
}
function LoadingView4() {
  return h2(
    "div",
    { className: "ddt-card ddt-loading dim-surfaceCard dim-loadingView", "aria-busy": "true" },
    h2("div", { className: "ddt-spinner dim-spinner" }),
    h2("span", null, "\u6B63\u5728\u8BFB\u53D6\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA\u72B6\u6001\u2026")
  );
}
function EmptyView4({ busy, onStart }) {
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-cardBody ddt-empty dim-surfaceBody dim-emptyView" },
      h2(
        "div",
        { className: "dim-emptyCopy" },
        h2(
          "div",
          { className: "ddt-stateLabel dim-stateLabel" },
          h2("span", { className: "ddt-dot dim-stateDot" }),
          h2("span", null, "\u5C1A\u672A\u7ED1\u5B9A\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA")
        ),
        h2("h3", null, "\u4F7F\u7528\u4F01\u4E1A\u5FAE\u4FE1 App \u626B\u7801\u521B\u5EFA\u667A\u80FD\u673A\u5668\u4EBA"),
        h2("p", null, "\u626B\u7801\u7531\u817E\u8BAF\u5B98\u65B9\u9875\u9762\u5B8C\u6210\uFF0C\u4E0D\u9700\u8981\u624B\u52A8\u586B\u5199 Bot ID \u6216 Secret\u3002\u521B\u5EFA\u6210\u529F\u540E\uFF0C\u673A\u5668\u4EBA\u4F1A\u81EA\u52A8\u8FDE\u63A5 DeepSeek Harness\u3002"),
        h2(
          "div",
          { className: "ddt-actions dim-viewActions" },
          h2(
            Button9,
            { kind: "primary", onClick: onStart, disabled: busy },
            busy ? "\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801\u2026" : "\u751F\u6210\u4F01\u4E1A\u5FAE\u4FE1\u4E8C\u7EF4\u7801"
          )
        )
      ),
      h2(
        "div",
        { className: "ddt-brandMark dim-emptyBrand dwecom-brand", "aria-hidden": "true" },
        h2(WecomLogoGlyph, { size: 64 })
      )
    )
  );
}
function QrPanel3({ provision, now, busy, onRefresh, onCancel }) {
  const source = safeQrSource4(provision.qrCodeDataUrl);
  const remaining = Math.max(0, provision.expiresAt - now);
  const duration = Math.max(1, provision.durationMs ?? 5 * 6e4);
  const progress = Math.round(Math.min(1, remaining / duration) * 100);
  const refreshing = provision.status === "refreshing";
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-cardBody ddt-qrLayout dim-surfaceBody dim-qrLayout" },
      h2(
        "div",
        { className: "ddt-qrColumn dim-qrColumn" },
        h2(
          "div",
          { className: "ddt-qrFrame dim-qrFrame" },
          source ? h2("img", { src: source, alt: "\u7528\u4E8E\u7ED1\u5B9A\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA\u7684\u4E00\u6B21\u6027\u4E8C\u7EF4\u7801" }) : h2(
            "div",
            { className: "ddt-qrFallback dim-qrFallback" },
            refreshing ? "\u4E8C\u7EF4\u7801\u6B63\u5728\u81EA\u52A8\u5237\u65B0\u2026" : "\u4E8C\u7EF4\u7801\u56FE\u7247\u6B63\u5728\u751F\u6210\u2026"
          )
        ),
        h2(
          "div",
          { className: "ddt-countdown dim-countdown" },
          h2(
            "div",
            { className: "ddt-countdownTop dim-countdownTop" },
            h2("span", null, "\u5F53\u524D\u4E8C\u7EF4\u7801\u6709\u6548\u65F6\u95F4"),
            h2("strong", null, refreshing ? "--:--" : formatRemaining4(remaining))
          ),
          h2("div", { className: "ddt-progress dim-progress", style: { "--ddt-progress": `${progress}%` } }, h2("span"))
        )
      ),
      h2(
        "div",
        { className: "ddt-qrCopy dim-qrCopy" },
        h2(
          "div",
          { className: "ddt-stateLabel dim-stateLabel" },
          h2("span", { className: "ddt-dot dim-stateDot", "data-tone": "warning" }),
          h2("span", null, refreshing ? "\u6B63\u5728\u5237\u65B0\u4E8C\u7EF4\u7801" : "\u7B49\u5F85\u4F01\u4E1A\u5FAE\u4FE1 App \u626B\u7801")
        ),
        h2("h3", null, "\u4F7F\u7528\u4F01\u4E1A\u5FAE\u4FE1 App \u5B8C\u6210\u667A\u80FD\u673A\u5668\u4EBA\u6388\u6743"),
        h2("p", null, "\u4F01\u4E1A\u5FAE\u4FE1\u5B98\u65B9\u9875\u9762\u4F1A\u521B\u5EFA\u4E00\u4E2A\u667A\u80FD\u673A\u5668\u4EBA\uFF0C\u5E76\u628A\u8FDE\u63A5\u51ED\u636E\u5B89\u5168\u4EA4\u7ED9\u672C\u673A Harness Host\u3002"),
        h2(
          "ol",
          { className: "ddt-steps dim-steps" },
          h2("li", null, "\u6253\u5F00\u4F01\u4E1A\u5FAE\u4FE1 App\uFF0C\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801"),
          h2("li", null, "\u5728\u817E\u8BAF\u6388\u6743\u9875\u9762\u786E\u8BA4\u521B\u5EFA\u667A\u80FD\u673A\u5668\u4EBA"),
          h2("li", null, "\u8FD4\u56DE\u8FD9\u91CC\u7B49\u5F85\u8FDE\u63A5\u5B8C\u6210")
        ),
        h2(
          "div",
          { className: "ddt-actions dim-viewActions" },
          h2(Button9, { onClick: onRefresh, disabled: busy }, "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801"),
          h2(Button9, { kind: "quiet", onClick: onCancel, disabled: busy }, "\u53D6\u6D88")
        )
      )
    )
  );
}
function ProvisionView2({ provision, busy, onRetry, onClose }) {
  if (provision.status === "connecting") {
    return h2(
      "div",
      { className: "ddt-card ddt-loading dim-surfaceCard dim-specialView", "aria-busy": "true" },
      h2("div", { className: "ddt-spinner dim-spinner" }),
      h2("h3", null, "\u4F01\u4E1A\u5FAE\u4FE1\u5DF2\u6388\u6743\uFF0C\u6B63\u5728\u8FDE\u63A5\u673A\u5668\u4EBA"),
      h2("p", null, "\u51ED\u636E\u6B63\u5728\u5199\u5165\u672C\u673A\uFF0C\u5E76\u542F\u52A8\u4F01\u4E1A\u5FAE\u4FE1 WebSocket \u6D88\u606F\u8FDE\u63A5\u3002")
    );
  }
  const error = provision.error ?? { code: "WECOM_PROVISION_FAILED", message: "\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA\u6CA1\u6709\u7ED1\u5B9A\u5B8C\u6210" };
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-inlineError dim-inlineError", role: "alert" },
      h2("h3", null, "\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA\u6CA1\u6709\u7ED1\u5B9A\u5B8C\u6210"),
      h2("p", null, error.message),
      h2("span", { className: "ddt-errorCode" }, error.code),
      h2(
        "div",
        { className: "ddt-actions dim-viewActions" },
        h2(Button9, { kind: "primary", onClick: onRetry, disabled: busy }, "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801"),
        h2(Button9, { onClick: onClose, disabled: busy }, "\u5173\u95ED")
      )
    )
  );
}
function RemoveConfirmation4({ account, busy, onConfirm, onCancel }) {
  return h2(
    "div",
    { className: "ddt-confirm dim-confirm", role: "alertdialog" },
    h2("strong", null, `\u4ECE DeepSeek Harness \u79FB\u9664\u201C${account.bot.name}\u201D\uFF1F`),
    h2("p", null, "\u8FD9\u4F1A\u505C\u6B62\u6D88\u606F\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684\u5E94\u7528\u51ED\u636E\u3001\u673A\u5668\u4EBA\u914D\u7F6E\u53CA\u4F1A\u8BDD\u6620\u5C04\u3002\u4F01\u4E1A\u5FAE\u4FE1\u5E73\u53F0\u4E2D\u7684\u673A\u5668\u4EBA\u4E0D\u4F1A\u88AB\u81EA\u52A8\u5220\u9664\u3002"),
    h2(
      "div",
      { className: "ddt-actions dim-viewActions" },
      h2(Button9, { onClick: onCancel, disabled: busy }, "\u4FDD\u7559\u673A\u5668\u4EBA"),
      h2(Button9, { kind: "danger", onClick: onConfirm, disabled: busy }, busy ? "\u6B63\u5728\u79FB\u9664\u2026" : "\u786E\u8BA4\u79FB\u9664\u63A5\u5165")
    )
  );
}
function AccountCard3({
  account,
  busy,
  feedback,
  removing,
  onReconnect,
  onWorkspaceSave,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove
}) {
  const tone = account.connected ? "success" : account.state === "error" ? "error" : "warning";
  const stateLabel = account.connected ? "\u8FD0\u884C\u6B63\u5E38" : account.state === "connecting" ? "\u6B63\u5728\u8FDE\u63A5" : "\u8FDE\u63A5\u672A\u5C31\u7EEA";
  const summary = account.error?.message ?? (account.connected ? null : account.health.summary);
  return h2(
    "article",
    { className: "ddt-card dim-botCard", "data-bot-id": account.botId },
    h2(
      "div",
      { className: "ddt-cardBody dim-botCardBody" },
      h2(
        "div",
        { className: "ddt-accountTop dim-botCardTop" },
        h2(
          "div",
          { className: "ddt-accountIdentity dim-botIdentity" },
          h2("div", { className: "ddt-avatar dim-botAvatar dwecom-avatar", "aria-hidden": "true" }, h2(WecomLogoGlyph, { size: 29 })),
          h2(
            "div",
            { className: "dim-botName" },
            h2("h3", null, account.bot.name),
            h2("p", null, account.bot.appIdMasked)
          )
        ),
        h2(
          "div",
          { className: "ddt-health dim-botHealth" },
          h2("span", { className: "ddt-dot dim-healthDot", "data-tone": tone }),
          h2("span", null, stateLabel)
        )
      ),
      h2(
        "dl",
        { className: "ddt-metrics dim-botMetrics" },
        h2("div", { className: "ddt-metric dim-botMetric" }, h2("dt", null, "\u6D88\u606F\u901A\u9053"), h2("dd", null, account.connected ? "WebSocket \u957F\u8FDE\u63A5" : "\u79BB\u7EBF")),
        h2("div", { className: "ddt-metric dim-botMetric" }, h2("dt", null, "\u6700\u8FD1\u68C0\u67E5"), h2("dd", null, checkedTime4(account.health.lastCheckedAt)))
      ),
      h2(WorkspaceEditor, {
        workspace: account.workspace,
        disabled: Boolean(busy),
        onSave: onWorkspaceSave
      }),
      h2(
        "div",
        { className: "ddt-accountFooter dim-cardFooter" },
        summary ? h2("div", { className: "ddt-summary dim-cardSummary" }, summary) : null,
        feedback ? h2("div", {
          className: "ddt-summary dim-cardSummary",
          role: "status",
          "aria-live": "polite"
        }, feedback) : null,
        h2(
          "div",
          { className: "ddt-actions dim-cardActions" },
          h2(Button9, { className: "dim-cardAction", onClick: onReconnect, disabled: Boolean(busy) }, busy === "reconnect" ? "\u68C0\u67E5\u4E2D\u2026" : account.connected ? "\u68C0\u67E5\u8FDE\u63A5" : "\u91CD\u8BD5\u8FDE\u63A5"),
          h2(Button9, { className: "dim-cardAction", kind: "danger", onClick: onRequestRemove, disabled: Boolean(busy) }, "\u79FB\u9664\u63A5\u5165")
        )
      )
    ),
    removing ? h2(RemoveConfirmation4, {
      account,
      busy: busy === "delete",
      onConfirm: onConfirmRemove,
      onCancel: onCancelRemove
    }) : null
  );
}
function WecomSettingsTab({ rpcCall }) {
  const [model, setModel] = React13.useState({ phase: "loading", bots: [], totals: { configured: 0, connected: 0 }, error: null });
  const [provision, setProvision] = React13.useState(null);
  const [busy, setBusy] = React13.useState(false);
  const [busyByBot, setBusyByBot] = React13.useState({});
  const [feedbackByBot, setFeedbackByBot] = React13.useState({});
  const [removeTarget, setRemoveTarget] = React13.useState(null);
  const [credentialOpen, setCredentialOpen] = React13.useState(false);
  const [credentialError, setCredentialError] = React13.useState(null);
  const [notice, setNotice] = React13.useState("");
  const [now, setNow] = React13.useState(Date.now());
  const mounted = React13.useRef(true);
  const workspaceFence = useWorkspaceSnapshotFence();
  const addButtonRef = React13.useRef(null);
  const noticeFrameRef = React13.useRef(null);
  const announce = React13.useCallback((message) => {
    if (!mounted.current) return;
    if (noticeFrameRef.current !== null) {
      window.cancelAnimationFrame(noticeFrameRef.current);
      noticeFrameRef.current = null;
    }
    setNotice("");
    if (message) {
      noticeFrameRef.current = window.requestAnimationFrame(() => {
        noticeFrameRef.current = null;
        if (mounted.current) setNotice(message);
      });
    }
  }, []);
  React13.useEffect(() => {
    const disposeDingtalk = installDingtalkStyles();
    const disposeWecom = installWecomStyles();
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (noticeFrameRef.current !== null) {
        window.cancelAnimationFrame(noticeFrameRef.current);
        noticeFrameRef.current = null;
      }
      disposeWecom();
      disposeDingtalk();
    };
  }, []);
  const invoke = React13.useCallback(async (endpoint, payload = {}, signal) => {
    if (typeof rpcCall !== "function") throw new TypeError("\u4F01\u4E1A\u5FAE\u4FE1\u8BBE\u7F6E\u9875\u7F3A\u5C11 RPC \u8FDE\u63A5");
    return unwrapRpcResult7(await rpcCall(endpoint, payload, signal));
  }, [rpcCall]);
  const loadStatus = React13.useCallback(async ({ signal, silent = false, restore = false } = {}) => {
    const workspaceVersion = workspaceFence.beginStatus();
    if (workspaceVersion === null) return void 0;
    if (!silent && mounted.current) setModel((current) => ({ ...current, phase: "loading", error: null }));
    try {
      const snapshot = normalizeSnapshot6(await invoke(WECOM_ENDPOINTS.status, {}, signal));
      if (!mounted.current || signal?.aborted || !workspaceFence.canCommitStatus(workspaceVersion)) return void 0;
      setModel({ phase: "ready", bots: snapshot.bots, totals: snapshot.totals, error: null });
      if (restore && snapshot.provisioning) setProvision({
        ...snapshot.provisioning,
        durationMs: Math.max(1, snapshot.provisioning.expiresAt - Date.now())
      });
      return snapshot;
    } catch (error) {
      if (error?.name !== "AbortError" && mounted.current && !signal?.aborted && workspaceFence.canCommitStatus(workspaceVersion)) {
        setModel((current) => ({ ...current, phase: silent ? current.phase : "error", error: presentError7(error) }));
      }
      return void 0;
    }
  }, [invoke, workspaceFence]);
  React13.useEffect(() => {
    const controller = new AbortController();
    void loadStatus({ signal: controller.signal, restore: true });
    return () => controller.abort();
  }, [loadStatus]);
  React13.useEffect(() => {
    if (model.phase !== "ready") return void 0;
    const controller = new AbortController();
    const timer = window.setInterval(() => void loadStatus({ signal: controller.signal, silent: true }), 15e3);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadStatus, model.phase]);
  React13.useEffect(() => {
    if (!provision || !ACTIVE_STATES2.has(provision.status)) return void 0;
    const timer = window.setInterval(() => mounted.current && setNow(Date.now()), 1e3);
    return () => window.clearInterval(timer);
  }, [provision?.attemptId, provision?.status]);
  const startProvisioning = React13.useCallback(async (replace = false) => {
    setCredentialOpen(false);
    setCredentialError(null);
    setBusy(true);
    try {
      if (replace && provision?.attemptId) await invoke(WECOM_ENDPOINTS.cancelProvisioning, { attemptId: provision.attemptId });
      if (!mounted.current) return;
      setProvision({ status: "starting" });
      const started = normalizeProvisioning4(await invoke(WECOM_ENDPOINTS.beginProvisioning, { locale: "zh-CN" }));
      if (!mounted.current) return;
      setNow(Date.now());
      setProvision({ ...started, durationMs: Math.max(1, started.expiresAt - Date.now()) });
    } catch (error) {
      if (mounted.current) setProvision({ status: "failed", error: presentError7(error) });
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [invoke, provision?.attemptId]);
  const bindCredentials = React13.useCallback(async ({ identity, secret }) => {
    const snapshotVersion = workspaceFence.beginMutation();
    setBusy(true);
    setCredentialError(null);
    try {
      const snapshot = normalizeSnapshot6(await invoke(
        WECOM_ENDPOINTS.bindCredentials,
        { botId: identity, secret }
      ));
      if (!mounted.current) return;
      if (workspaceFence.canCommitMutation(snapshotVersion)) {
        setModel({ phase: "ready", bots: snapshot.bots, totals: snapshot.totals, error: null });
      }
      setCredentialOpen(false);
    } catch (error) {
      if (mounted.current) setCredentialError(presentError7(error));
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mounted.current) void loadStatus({ silent: true });
      if (mounted.current) setBusy(false);
    }
  }, [invoke, loadStatus, workspaceFence]);
  const closeProvision = React13.useCallback(async () => {
    setBusy(true);
    try {
      if (provision?.attemptId && ACTIVE_STATES2.has(provision.status)) {
        await invoke(WECOM_ENDPOINTS.cancelProvisioning, { attemptId: provision.attemptId });
      }
      if (mounted.current) setProvision(null);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [invoke, provision?.attemptId, provision?.status]);
  React13.useEffect(() => {
    const attemptId = provision?.attemptId;
    if (!attemptId || !ACTIVE_STATES2.has(provision.status)) return void 0;
    const controller = new AbortController();
    let disposed = false;
    let timer;
    const poll = async () => {
      try {
        const current = normalizeProvisioning4(await invoke(WECOM_ENDPOINTS.pollProvisioning, { attemptId }, controller.signal));
        if (disposed || controller.signal.aborted || !mounted.current) return;
        if (current.status === "connected") {
          setProvision(null);
          await loadStatus({ signal: controller.signal, silent: true });
          return;
        }
        setProvision((previous) => previous?.attemptId === attemptId ? { ...previous, ...current, durationMs: current.qrRevision !== previous.qrRevision ? Math.max(1, current.expiresAt - Date.now()) : previous.durationMs } : previous);
        if (ACTIVE_STATES2.has(current.status)) timer = window.setTimeout(poll, current.pollIntervalMs);
      } catch (error) {
        if (!disposed && !controller.signal.aborted && mounted.current) {
          setProvision((current) => ({ ...current, status: "failed", error: presentError7(error) }));
        }
      }
    };
    timer = window.setTimeout(poll, provision.pollIntervalMs ?? 1e3);
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [invoke, loadStatus, provision?.attemptId, provision?.pollIntervalMs, provision?.status]);
  const botAction = React13.useCallback(async (account, operation, endpoint, payload) => {
    const snapshotVersion = workspaceFence.beginMutation();
    setBusyByBot((current) => ({ ...current, [account.botId]: operation }));
    try {
      const snapshot = normalizeSnapshot6(await invoke(endpoint, payload));
      if (mounted.current && workspaceFence.canCommitMutation(snapshotVersion)) {
        setModel({ phase: "ready", bots: snapshot.bots, totals: snapshot.totals, error: null });
      }
      return snapshot;
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mounted.current) void loadStatus({ silent: true });
      if (mounted.current) setBusyByBot((current) => {
        const next = { ...current };
        delete next[account.botId];
        return next;
      });
    }
  }, [invoke, loadStatus, workspaceFence]);
  const reconnect = React13.useCallback(async (account) => {
    setFeedbackByBot((current) => {
      const next = { ...current };
      delete next[account.botId];
      return next;
    });
    try {
      const snapshot = await botAction(
        account,
        "reconnect",
        WECOM_ENDPOINTS.reconnectBot,
        { botId: account.botId, sendTest: true }
      );
      if (!snapshot) return;
      const refreshed = snapshot.bots.find((bot) => bot.botId === account.botId);
      let feedback;
      if (!refreshed?.connected) {
        feedback = "\u4F01\u4E1A\u5FAE\u4FE1\u4ECD\u672A\u8FDE\u63A5\uFF0C\u63D2\u4EF6\u4F1A\u7EE7\u7EED\u81EA\u52A8\u91CD\u8BD5\u3002";
      } else if (snapshot.testMessage?.sent) {
        feedback = "\u4F01\u4E1A\u5FAE\u4FE1\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\u3002";
      } else if (snapshot.testMessage?.code === "test-target-unavailable") {
        feedback = "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\u3002\u673A\u5668\u4EBA\u5C1A\u672A\u6536\u5230\u53EF\u7528\u4E8E\u6D4B\u8BD5\u7684\u79C1\u804A\u6D88\u606F\u3002";
      } else if (snapshot.testMessage) {
        feedback = "\u4F01\u4E1A\u5FAE\u4FE1\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u6D4B\u8BD5\u6D88\u606F\u53D1\u9001\u5931\u8D25\u3002";
      } else {
        feedback = "\u4F01\u4E1A\u5FAE\u4FE1\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\u3002";
      }
      if (mounted.current) {
        setFeedbackByBot((current) => ({ ...current, [account.botId]: feedback }));
      }
      announce(feedback);
    } catch {
      const feedback = "\u8FDE\u63A5\u68C0\u67E5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002";
      if (mounted.current) {
        setFeedbackByBot((current) => ({ ...current, [account.botId]: feedback }));
      }
      announce(feedback);
    }
  }, [announce, botAction]);
  let provisionView = null;
  if (provision?.status === "starting") provisionView = h2("div", { className: "ddt-card ddt-loading dim-surfaceCard" }, h2("div", { className: "ddt-spinner" }), "\u6B63\u5728\u7533\u8BF7\u4F01\u4E1A\u5FAE\u4FE1\u4E8C\u7EF4\u7801\u2026");
  else if (["pending", "refreshing"].includes(provision?.status)) provisionView = h2(QrPanel3, {
    provision,
    now,
    busy,
    onRefresh: () => void startProvisioning(true),
    onCancel: () => void closeProvision()
  });
  else if (provision) provisionView = h2(ProvisionView2, {
    provision,
    busy,
    onRetry: () => void startProvisioning(true),
    onClose: () => void closeProvision()
  });
  const botList = model.bots.length > 0 ? h2(
    "section",
    { className: "dim-listSection" },
    h2(
      "div",
      { className: "ddt-listHeading dim-listHeading" },
      h2("h3", null, "\u5DF2\u7ED1\u5B9A\u7684\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA")
    ),
    h2("ul", { className: "ddt-list dim-botList" }, model.bots.map((account) => h2("li", { key: account.botId }, h2(AccountCard3, {
      account,
      busy: busyByBot[account.botId],
      feedback: feedbackByBot[account.botId],
      removing: removeTarget === account.botId,
      onReconnect: () => void reconnect(account),
      onWorkspaceSave: (workspace) => botAction(
        account,
        "workspace",
        WECOM_ENDPOINTS.setWorkspace,
        { botId: account.botId, workspace }
      ),
      onRequestRemove: () => setRemoveTarget(account.botId),
      onCancelRemove: () => setRemoveTarget(null),
      onConfirmRemove: async () => {
        await botAction(account, "delete", WECOM_ENDPOINTS.deleteBot, { botId: account.botId, confirm: true });
        if (mounted.current) setRemoveTarget(null);
      }
    }))))
  ) : null;
  const credentialView = credentialOpen ? h2(CredentialBindingPanel, {
    channel: "\u4F01\u4E1A\u5FAE\u4FE1",
    identityLabel: "Bot ID",
    identityPlaceholder: "\u586B\u5199\u4F01\u4E1A\u5FAE\u4FE1\u667A\u80FD\u673A\u5668\u4EBA Bot ID",
    secretLabel: "Secret",
    secretPlaceholder: "\u586B\u5199\u4F01\u4E1A\u5FAE\u4FE1\u667A\u80FD\u673A\u5668\u4EBA Secret",
    busy,
    error: credentialError,
    onSubmit: bindCredentials,
    onCancel: () => {
      setCredentialOpen(false);
      setCredentialError(null);
    }
  }) : null;
  return h2(
    "section",
    { className: "ddt-page dwecom-page dim-channelPage", "aria-label": "\u4F01\u4E1A\u5FAE\u4FE1\u8BBE\u7F6E" },
    h2(Heading4, {
      totals: model.totals,
      adding: Boolean(provision),
      busy,
      onAdd: () => void startProvisioning(),
      onCredential: () => {
        setCredentialOpen((value) => !value);
        setCredentialError(null);
      },
      credentialOpen,
      addButtonRef
    }),
    h2("div", { className: "ddt-visuallyHidden", role: "status", "aria-live": "polite" }, notice),
    model.phase === "loading" ? h2(LoadingView4) : model.phase === "error" ? h2("div", { className: "ddt-card dim-surfaceCard" }, h2("div", { className: "ddt-inlineError dim-inlineError" }, h2("h3", null, "\u65E0\u6CD5\u8BFB\u53D6\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA\u72B6\u6001"), h2("p", null, model.error?.message), h2(Button9, { onClick: () => void loadStatus() }, "\u91CD\u65B0\u8BFB\u53D6"))) : h2(
      React13.Fragment,
      null,
      credentialView,
      provisionView,
      model.bots.length === 0 && !provision && !credentialOpen ? h2(EmptyView4, { busy, onStart: () => void startProvisioning() }) : null,
      botList
    )
  );
}

// plugin-src/client/channels/weixin/index.js
var React14 = __toESM(require("react"), 1);

// plugin-src/client/channels/weixin/api.js
var WEIXIN_RPC_CHANNEL = "/weixin";
var WEIXIN_ENDPOINTS = Object.freeze({
  status: "connection.status",
  beginProvisioning: "provision.begin",
  pollProvisioning: "provision.poll",
  submitVerification: "provision.verify",
  cancelProvisioning: "provision.cancel",
  reconnectBot: "bot.reconnect",
  deleteBot: "bot.delete",
  setWorkspace: "bot.workspace.set"
});
var ACCOUNT_STATES5 = /* @__PURE__ */ new Set(["connected", "connecting", "offline", "error"]);
var PROVISION_STATES4 = /* @__PURE__ */ new Set([
  "starting",
  "pending",
  "scanned",
  "needs_verification",
  "connecting",
  "connected",
  "expired",
  "failed",
  "cancelled"
]);
function isRecord6(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function string(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function timestamp5(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function normalizeTestMessage4(value) {
  if (!isRecord6(value)) return null;
  if (value.sent === true) return { sent: true };
  if (value.sent !== false) return null;
  const code = value.code === "test-target-unavailable" ? "test-target-unavailable" : "test-message-failed";
  return { sent: false, code };
}
function unwrapRpcResult8(result) {
  if (!isRecord6(result) || typeof result.ok !== "boolean") {
    throw new Error("\u5FAE\u4FE1\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u54CD\u5E94");
  }
  if (!result.ok) {
    const error = new Error(string(result.error?.message, "\u5FAE\u4FE1\u64CD\u4F5C\u5931\u8D25"));
    error.code = string(result.error?.code, "WEIXIN_RPC_ERROR");
    throw error;
  }
  return result.value;
}
function safeQrSource5(value) {
  return typeof value === "string" && /^data:image\/(?:png|webp|svg\+xml)(?:;charset=[^;,]+)?;base64,/i.test(value) ? value : void 0;
}
function safeVerificationUrl(value) {
  if (typeof value !== "string") return void 0;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "weixin.qq.com" || host.endsWith(".weixin.qq.com")) ? url.toString() : void 0;
  } catch {
    return void 0;
  }
}
function normalizeProvisioning5(value) {
  if (!isRecord6(value) || !string(value.attemptId)) {
    throw new Error("\u5FAE\u4FE1\u626B\u7801\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u7ED1\u5B9A\u4EFB\u52A1");
  }
  const status = PROVISION_STATES4.has(value.status) ? value.status : "failed";
  const result = {
    attemptId: string(value.attemptId),
    status,
    expiresAt: timestamp5(value.expiresAt) ?? Date.now(),
    pollIntervalMs: Math.min(5e3, Math.max(500, Number(value.pollIntervalMs) || 1e3)),
    verificationRequired: value.verificationRequired === true || status === "needs_verification"
  };
  const verificationUrl = safeVerificationUrl(value.verificationUrl);
  const qrCodeDataUrl = safeQrSource5(value.qrCodeDataUrl);
  if (verificationUrl) result.verificationUrl = verificationUrl;
  if (qrCodeDataUrl) result.qrCodeDataUrl = qrCodeDataUrl;
  if (string(value.botId)) result.botId = string(value.botId);
  if (value.alreadyConnected === true) result.alreadyConnected = true;
  if (isRecord6(value.error)) {
    result.error = {
      code: string(value.error.code, "WEIXIN_PROVISION_FAILED"),
      message: string(value.error.message, "\u5FAE\u4FE1\u7ED1\u5B9A\u6CA1\u6709\u5B8C\u6210")
    };
  }
  return result;
}
function normalizeBot5(value) {
  if (!isRecord6(value) || !string(value.botId) || !isRecord6(value.bot)) return null;
  const state = ACCOUNT_STATES5.has(value.state) ? value.state : "error";
  const connected = value.connected === true;
  return {
    botId: string(value.botId),
    state: connected ? "connected" : state,
    connected,
    configured: value.configured === true,
    workspace: string(value.workspace).slice(0, 4096),
    bot: {
      name: string(value.bot.name, "\u5FAE\u4FE1\u673A\u5668\u4EBA"),
      accountIdMasked: string(value.bot.accountIdMasked, "\u5DF2\u5B89\u5168\u4FDD\u5B58")
    },
    health: {
      status: string(value.health?.status, connected ? "healthy" : "offline"),
      summary: string(value.health?.summary, connected ? "\u5FAE\u4FE1\u8FDE\u63A5\u6B63\u5E38" : "\u5FAE\u4FE1\u8FDE\u63A5\u672A\u5C31\u7EEA"),
      lastCheckedAt: timestamp5(value.health?.lastCheckedAt)
    },
    stats: {
      messagesReceived: Math.max(0, Number(value.stats?.messagesReceived) || 0),
      messagesReplied: Math.max(0, Number(value.stats?.messagesReplied) || 0)
    },
    error: isRecord6(value.error) ? {
      code: string(value.error.code, "WEIXIN_ACCOUNT_ERROR"),
      message: string(value.error.message, "\u5FAE\u4FE1\u8FDE\u63A5\u672A\u5C31\u7EEA")
    } : null
  };
}
function normalizeSnapshot7(value) {
  if (!isRecord6(value) || !Array.isArray(value.bots)) {
    throw new Error("\u5FAE\u4FE1\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u8D26\u53F7\u5217\u8868");
  }
  const bots = value.bots.map(normalizeBot5).filter(Boolean);
  return {
    schemaVersion: Number(value.schemaVersion) || 1,
    revision: Number(value.revision) || 0,
    state: string(value.state, "offline"),
    bots,
    totals: {
      configured: bots.length,
      connected: bots.filter((bot) => bot.connected).length
    },
    provisioning: value.provisioning ? normalizeProvisioning5(value.provisioning) : null,
    testMessage: normalizeTestMessage4(value.testMessage)
  };
}
function presentError8(error) {
  return {
    code: string(error?.code, "WEIXIN_ERROR"),
    message: string(error?.message, "\u5FAE\u4FE1\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5")
  };
}
function formatRemaining5(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1e3));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// plugin-src/client/channels/weixin/styles.js
var WEIXIN_STYLE_ID = "xmanrui-dsh-weixin-settings";
var CSS8 = String.raw`
.dxw-page {
  --dxw-accent: #07c160;
  --dxw-accent-dark: #05994c;
  --dxw-success: var(--dsw-alias-state-success-primary, #20a162);
  --dxw-warning: var(--dsw-alias-state-warn-primary, #d97706);
  --dxw-error: var(--dsw-alias-state-error-primary, #d54941);
  width: 100%;
  max-width: 880px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 2px 0 28px;
  color: var(--dsw-alias-label-primary, #1f2329);
  box-sizing: border-box;
}
.dxw-page *, .dxw-page *::before, .dxw-page *::after { box-sizing: border-box; }
.dxw-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.dxw-heading h2, .dxw-heading p, .dxw-card h3, .dxw-card p { margin: 0; }
.dxw-eyebrow { color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 12px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 3px; }
.dxw-heading h2 { font-size: 20px; line-height: 28px; font-weight: 680; }
.dxw-heading p { color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 20px; margin-top: 5px; white-space: nowrap; }
.dxw-tools, .dxw-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.dxw-tools { width: 100%; justify-content: space-between; flex-wrap: nowrap; }
.dxw-badge { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 0 11px; border-radius: 999px; color: var(--dsw-alias-label-secondary, #646a73); background: var(--dsw-alias-bg-module-platform, #f2f3f5); font-size: 12px; white-space: nowrap; }
.dxw-dot { width: 8px; height: 8px; border-radius: 50%; background: #aeb3bb; flex: none; }
.dxw-dot[data-tone="success"] { background: var(--dxw-success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dxw-success) 14%, transparent); }
.dxw-dot[data-tone="warning"] { background: var(--dxw-warning); }
.dxw-dot[data-tone="error"] { background: var(--dxw-error); }
.dxw-button { min-height: 34px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 8px; padding: 0 13px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-layer-1, #fff); font: inherit; font-size: 13px; font-weight: 560; cursor: pointer; text-decoration: none; transition: border-color .15s ease, background .15s ease, transform .15s ease; }
.dxw-button:hover:not(:disabled) { border-color: #aeb3bb; background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.dxw-button:active:not(:disabled) { transform: translateY(1px); }
.dxw-button:focus-visible, .dxw-input:focus-visible { outline: 2px solid color-mix(in srgb, var(--dxw-accent) 70%, white); outline-offset: 2px; }
.dxw-button:disabled { cursor: not-allowed; opacity: .55; }
.dxw-button[data-kind="primary"] { color: white; border-color: var(--dxw-accent); background: var(--dxw-accent); }
.dxw-button[data-kind="primary"]:hover:not(:disabled) { border-color: var(--dxw-accent-dark); background: var(--dxw-accent-dark); }
.dxw-button[data-kind="danger"] { color: var(--dxw-error); }
.dxw-card { overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, #e5e6eb); border-radius: 14px; background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: 0 1px 2px rgb(31 35 41 / 3%); }
.dxw-cardBody { padding: 24px; }
.dxw-empty { min-height: 230px; display: grid; grid-template-columns: minmax(0, 1fr) 180px; align-items: center; gap: 30px; }
.dxw-empty h3 { font-size: 18px; margin-bottom: 8px; }
.dxw-empty p { max-width: 560px; color: var(--dsw-alias-label-secondary, #646a73); line-height: 1.65; }
.dxw-empty .dxw-actions { margin-top: 20px; }
.dxw-logo { width: 110px; height: 110px; display: grid; place-items: center; justify-self: center; border-radius: 28px; color: white; background: var(--dxw-accent); box-shadow: 0 18px 45px rgb(7 193 96 / 22%); }
.dxw-logo svg { width: 62px; height: 62px; }
.dxw-qrLayout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 34px; align-items: center; }
.dxw-qrColumn { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.dxw-qrFrame { position: relative; width: 270px; aspect-ratio: 1; display: grid; place-items: center; overflow: hidden; padding: 10px; border: 1px solid var(--dsw-alias-border-l2, #e5e6eb); border-radius: 16px; background: white; }
.dxw-qrFrame img { display: block; width: 100%; height: 100%; object-fit: contain; }
.dxw-qrFallback { padding: 24px; text-align: center; color: #646a73; }
.dxw-expired { position: absolute; inset: 0; display: grid; place-items: center; padding: 30px; color: white; text-align: center; font-weight: 650; background: rgb(31 35 41 / 76%); backdrop-filter: blur(3px); }
.dxw-countdown { width: 270px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; }
.dxw-countdown div { display: flex; justify-content: space-between; margin-bottom: 6px; }
.dxw-progress { height: 4px; overflow: hidden; border-radius: 99px; background: #eef0f3; }
.dxw-progress span { display: block; width: var(--dxw-progress); height: 100%; background: var(--dxw-accent); transition: width .2s linear; }
.dxw-qrCopy h3 { margin: 9px 0 8px; font-size: 18px; }
.dxw-qrCopy > p { color: var(--dsw-alias-label-secondary, #646a73); line-height: 1.65; }
.dxw-steps { margin: 18px 0 22px; padding-left: 22px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 1.9; }
.dxw-stateLabel { display: inline-flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; font-weight: 600; }
.dxw-verify { max-width: 560px; margin: 0 auto; padding: 32px; text-align: center; }
.dxw-verify h3 { margin: 8px 0; font-size: 19px; }
.dxw-verify p { color: var(--dsw-alias-label-secondary, #646a73); line-height: 1.6; }
.dxw-codeRow { display: flex; justify-content: center; gap: 10px; margin: 24px 0 10px; }
.dxw-input { width: 190px; height: 42px; padding: 0 14px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 9px; background: var(--dsw-alias-bg-layer-1, white); color: inherit; font: inherit; font-size: 18px; letter-spacing: .16em; text-align: center; }
.dxw-statusNotice, .dxw-error { display: flex; align-items: center; gap: 10px; padding: 13px 15px; border: 1px solid color-mix(in srgb, var(--dxw-error) 28%, transparent); border-radius: 10px; color: var(--dxw-error); background: color-mix(in srgb, var(--dxw-error) 7%, transparent); font-size: 13px; }
.dxw-error { align-items: flex-start; flex-direction: column; padding: 22px; }
.dxw-error h3 { font-size: 17px; }
.dxw-errorCode { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; opacity: .8; }
.dxw-listHeading { display: flex; justify-content: space-between; align-items: center; margin: 2px 0 9px; }
.dxw-listHeading h3 { margin: 0; font-size: 14px; }
.dxw-list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.dxw-accountTop { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dxw-accountIdentity { display: flex; align-items: center; gap: 12px; min-width: 0; }
.dxw-avatar { width: 42px; height: 42px; display: grid; place-items: center; flex: none; border-radius: 12px; color: white; background: var(--dxw-accent); }
.dxw-accountIdentity h3 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
.dxw-accountIdentity p { color: var(--dsw-alias-label-secondary, #646a73); font: 12px ui-monospace, SFMono-Regular, monospace; margin-top: 4px; }
.dxw-health { display: inline-flex; align-items: center; gap: 7px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; white-space: nowrap; }
.dxw-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
.dxw-metric { padding: 12px 14px; border-radius: 9px; background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.dxw-metric dt { color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 11px; }
.dxw-metric dd { overflow: hidden; margin: 5px 0 0; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.dxw-accountFooter { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding-top: 16px; border-top: 1px solid var(--dsw-alias-border-l1, #eef0f3); }
.dxw-accountFooter .dxw-actions { flex: none; flex-wrap: nowrap; gap: 8px; margin-top: 0; }
.dxw-accountFooter .dxw-button { flex: none; white-space: nowrap; }
.dxw-summary { color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; }
.dxw-confirm { padding: 18px 24px; border-top: 1px solid color-mix(in srgb, var(--dxw-error) 25%, transparent); background: color-mix(in srgb, var(--dxw-error) 5%, transparent); }
.dxw-confirm strong { display: block; font-size: 14px; margin-bottom: 6px; }
.dxw-confirm p { color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: 1.55; }
.dxw-confirm .dxw-actions { margin-top: 13px; }
.dxw-loading { padding: 36px; color: var(--dsw-alias-label-secondary, #646a73); text-align: center; }
.dxw-spinner { width: 24px; height: 24px; margin: 0 auto 12px; border: 3px solid #e6e8eb; border-top-color: var(--dxw-accent); border-radius: 50%; animation: dxw-spin .8s linear infinite; }
.dxw-visuallyHidden { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@keyframes dxw-spin { to { transform: rotate(360deg); } }
@media (max-width: 720px) {
  .dxw-heading, .dxw-accountTop { flex-direction: column; align-items: stretch; }
  .dxw-empty { grid-template-columns: minmax(0, 1fr); }
  .dxw-logo { display: none; }
  .dxw-qrLayout { grid-template-columns: minmax(0, 1fr); justify-items: center; }
  .dxw-qrCopy { width: 100%; }
  .dxw-metrics { grid-template-columns: minmax(0, 1fr); }
  .dxw-cardBody { padding: 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .dxw-page *, .dxw-page *::before, .dxw-page *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;
function installWeixinStyles() {
  if (typeof document === "undefined") return () => {
  };
  const existing = document.querySelector(`style[data-plugin-css="${WEIXIN_STYLE_ID}"]`);
  if (existing) return () => {
  };
  const style = document.createElement("style");
  style.dataset.plugin = "@xmanrui/dsh-weixin";
  style.dataset.pluginCss = WEIXIN_STYLE_ID;
  style.textContent = CSS8;
  document.head.appendChild(style);
  return () => style.remove();
}

// plugin-src/client/channels/weixin/index.js
var Button11 = React14.forwardRef(function Button12({ children, kind = "secondary", className = "", ...props }, ref) {
  return h2("button", {
    ...props,
    ref,
    type: "button",
    className: `dxw-button ${className}`.trim(),
    "data-kind": kind
  }, children);
});
function Heading5({ totals, adding, busy, onAdd, addButtonRef }) {
  return h2(
    "div",
    { className: "dxw-heading" },
    h2(
      "div",
      { className: "dxw-tools" },
      h2(Button11, {
        kind: "primary",
        className: "dim-scanButton",
        onClick: onAdd,
        disabled: adding || busy,
        ref: addButtonRef,
        "aria-label": "\u626B\u7801\u63A5\u5165\u5FAE\u4FE1\u673A\u5668\u4EBA"
      }, h2(QrActionIcon), adding ? "\u6B63\u5728\u63A5\u5165" : "\u626B\u7801\u63A5\u5165\u673A\u5668\u4EBA"),
      totals.configured > 0 ? h2(
        "div",
        { className: "dxw-badge dim-onlineBadge" },
        h2("span", null, `${totals.connected} / ${totals.configured} \u5728\u7EBF`)
      ) : null
    )
  );
}
function LoadingView5() {
  return h2(
    "div",
    { className: "dxw-card dxw-loading dim-surfaceCard dim-loadingView", "aria-busy": "true" },
    h2("div", { className: "dxw-spinner dim-spinner" }),
    h2("span", null, "\u6B63\u5728\u8BFB\u53D6\u5FAE\u4FE1\u8FDE\u63A5\u72B6\u6001\u2026")
  );
}
function EmptyView5({ onStart, busy }) {
  return h2(
    "div",
    { className: "dxw-card dim-surfaceCard" },
    h2(
      "div",
      { className: "dxw-cardBody dxw-empty dim-surfaceBody dim-emptyView" },
      h2(
        "div",
        { className: "dim-emptyCopy" },
        h2(
          "div",
          { className: "dxw-stateLabel dim-stateLabel" },
          h2("span", { className: "dxw-dot dim-stateDot" }),
          h2("span", null, "\u5C1A\u672A\u7ED1\u5B9A\u5FAE\u4FE1")
        ),
        h2("h3", null, "\u626B\u4E00\u6B21\u7801\uFF0C\u5C31\u80FD\u5728\u5FAE\u4FE1\u91CC\u4F7F\u7528 Harness"),
        h2("p", null, "\u4E8C\u7EF4\u7801\u7531\u817E\u8BAF\u5FAE\u4FE1 iLink \u670D\u52A1\u7B7E\u53D1\u3002\u7528\u624B\u673A\u5FAE\u4FE1\u626B\u63CF\u5E76\u786E\u8BA4\u540E\uFF0C\u8D26\u53F7\u51ED\u636E\u4F1A\u76F4\u63A5\u5199\u5165 Harness Host\uFF0C\u6D4F\u89C8\u5668\u4E0D\u4F1A\u6536\u5230 bot_token\u3002"),
        h2(
          "div",
          { className: "dxw-actions dim-viewActions" },
          h2(
            Button11,
            { kind: "primary", onClick: onStart, disabled: busy },
            busy ? "\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801\u2026" : "\u751F\u6210\u5FAE\u4FE1\u4E8C\u7EF4\u7801"
          )
        )
      ),
      h2("div", { className: "dxw-logo dim-emptyBrand", "aria-hidden": "true" }, h2(WeixinLogoGlyph, { size: 64 }))
    )
  );
}
function QrPanel4({ provision, now, busy, onRefresh, onCancel }) {
  const [imageFailed, setImageFailed] = React14.useState(false);
  const source = safeQrSource5(provision.qrCodeDataUrl);
  const href = safeVerificationUrl(provision.verificationUrl);
  const remaining = Math.max(0, provision.expiresAt - now);
  const expired = remaining === 0 || provision.status === "expired";
  const duration = Math.max(1, provision.durationMs ?? 5 * 6e4);
  const progress = Math.round(Math.min(1, remaining / duration) * 100);
  React14.useEffect(() => setImageFailed(false), [source]);
  return h2(
    "div",
    { className: "dxw-card dim-surfaceCard" },
    h2(
      "div",
      { className: "dxw-cardBody dxw-qrLayout dim-surfaceBody dim-qrLayout" },
      h2(
        "div",
        { className: "dxw-qrColumn dim-qrColumn" },
        h2(
          "div",
          { className: "dxw-qrFrame dim-qrFrame" },
          source && !imageFailed ? h2("img", {
            src: source,
            alt: "\u7528\u4E8E\u628A\u5FAE\u4FE1\u673A\u5668\u4EBA\u7ED1\u5B9A\u5230 DeepSeek Harness \u7684\u4E00\u6B21\u6027\u4E8C\u7EF4\u7801",
            onError: () => setImageFailed(true)
          }) : h2("div", { className: "dxw-qrFallback dim-qrFallback" }, "\u4E8C\u7EF4\u7801\u56FE\u7247\u672A\u5C31\u7EEA\uFF0C\u8BF7\u4F7F\u7528\u5907\u7528\u94FE\u63A5\u3002"),
          expired ? h2("div", { className: "dxw-expired dim-qrExpired" }, "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\n\u8BF7\u91CD\u65B0\u751F\u6210") : null
        ),
        h2(
          "div",
          { className: "dxw-countdown dim-countdown" },
          h2("div", { className: "dim-countdownTop" }, h2("span", null, "\u4E8C\u7EF4\u7801\u6709\u6548\u65F6\u95F4"), h2("strong", null, formatRemaining5(remaining))),
          h2(
            "div",
            { className: "dxw-progress dim-progress", "aria-hidden": "true" },
            h2("span", { style: { "--dxw-progress": `${progress}%` } })
          )
        )
      ),
      h2(
        "div",
        { className: "dxw-qrCopy dim-qrCopy" },
        h2(
          "div",
          { className: "dxw-stateLabel dim-stateLabel" },
          h2("span", { className: "dxw-dot dim-stateDot", "data-tone": provision.status === "scanned" ? "success" : "warning" }),
          h2("span", null, provision.status === "scanned" ? "\u5DF2\u626B\u7801\uFF0C\u8BF7\u5728\u624B\u673A\u4E0A\u786E\u8BA4" : "\u7B49\u5F85\u5FAE\u4FE1\u626B\u7801")
        ),
        h2("h3", null, expired ? "\u4E8C\u7EF4\u7801\u5DF2\u5931\u6548" : "\u4F7F\u7528\u624B\u673A\u5FAE\u4FE1\u626B\u63CF\u4E8C\u7EF4\u7801"),
        h2("p", null, "\u8BF7\u5728\u624B\u673A\u4E0A\u6838\u5BF9\u5E76\u786E\u8BA4\u6388\u6743\u3002\u90E8\u5206\u8D26\u53F7\u4F1A\u989D\u5916\u663E\u793A\u4E00\u4E2A\u914D\u5BF9\u6570\u5B57\uFF0C\u9875\u9762\u4F1A\u5728\u9700\u8981\u65F6\u63D0\u793A\u8F93\u5165\u3002"),
        h2(
          "ol",
          { className: "dxw-steps dim-steps" },
          h2("li", null, "\u6253\u5F00\u624B\u673A\u5FAE\u4FE1\u5E76\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801"),
          h2("li", null, "\u5728\u5FAE\u4FE1\u4E2D\u786E\u8BA4\u8FDE\u63A5\u8BE5\u673A\u5668\u4EBA"),
          h2("li", null, "\u4FDD\u6301\u672C\u9875\u6253\u5F00\uFF0C\u7B49\u5F85\u6D88\u606F\u957F\u8F6E\u8BE2\u53D8\u4E3A\u5728\u7EBF")
        ),
        h2(
          "div",
          { className: "dxw-actions dim-viewActions" },
          expired ? h2(Button11, { kind: "primary", onClick: onRefresh, disabled: busy }, "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801") : null,
          href ? h2("a", {
            className: "dxw-button",
            href,
            target: "_blank",
            rel: "noopener noreferrer"
          }, "\u6253\u5F00\u5907\u7528\u94FE\u63A5") : null,
          !expired ? h2(Button11, { onClick: onRefresh, disabled: busy }, "\u6362\u4E00\u4E2A\u4E8C\u7EF4\u7801") : null,
          h2(Button11, { onClick: onCancel, disabled: busy }, "\u53D6\u6D88")
        )
      )
    )
  );
}
function VerificationPanel({ provision, busy, onSubmit, onCancel }) {
  const [code, setCode] = React14.useState("");
  const valid = /^\d{4,8}$/.test(code);
  React14.useEffect(() => setCode(""), [provision.attemptId]);
  return h2(
    "div",
    { className: "dxw-card dim-surfaceCard" },
    h2(
      "form",
      {
        className: "dxw-verify dim-specialView",
        onSubmit: (event) => {
          event.preventDefault();
          if (valid && !busy) onSubmit(code);
        }
      },
      h2(
        "div",
        { className: "dxw-stateLabel" },
        h2("span", { className: "dxw-dot", "data-tone": "warning" }),
        h2("span", null, "\u9700\u8981\u914D\u5BF9\u7801")
      ),
      h2("h3", null, "\u8F93\u5165\u624B\u673A\u5FAE\u4FE1\u663E\u793A\u7684\u6570\u5B57"),
      h2("p", null, "\u8FD9\u662F\u5FAE\u4FE1\u9644\u52A0\u7684\u5B89\u5168\u786E\u8BA4\u6B65\u9AA4\u3002\u914D\u5BF9\u7801\u53EA\u7528\u4E8E\u672C\u6B21\u626B\u7801\u8F6E\u8BE2\uFF0C\u4E0D\u4F1A\u5199\u5165\u914D\u7F6E\u6216\u65E5\u5FD7\u3002"),
      h2(
        "div",
        { className: "dxw-codeRow" },
        h2("input", {
          className: "dxw-input",
          value: code,
          inputMode: "numeric",
          autoComplete: "one-time-code",
          maxLength: 8,
          "aria-label": "\u5FAE\u4FE1\u914D\u5BF9\u7801",
          onChange: (event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8)),
          autoFocus: true
        }),
        h2("button", {
          type: "submit",
          className: "dxw-button",
          "data-kind": "primary",
          disabled: !valid || busy
        }, busy ? "\u6B63\u5728\u9A8C\u8BC1\u2026" : "\u7EE7\u7EED\u8FDE\u63A5")
      ),
      h2(Button11, { onClick: onCancel, disabled: busy }, "\u53D6\u6D88\u7ED1\u5B9A")
    )
  );
}
function ProgressPanel2({ scanned, onCancel, busy }) {
  return h2(
    "div",
    { className: "dxw-card dxw-loading dim-surfaceCard dim-loadingView", "aria-busy": "true" },
    h2("div", { className: "dxw-spinner dim-spinner" }),
    h2("h3", null, scanned ? "\u5FAE\u4FE1\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u542F\u52A8\u6D88\u606F\u8FDE\u63A5" : "\u6B63\u5728\u51C6\u5907\u5FAE\u4FE1\u4E8C\u7EF4\u7801"),
    h2("p", null, scanned ? "\u6B63\u5728\u4FDD\u5B58\u51ED\u636E\u5E76\u9A8C\u8BC1 Harness \u4E0E\u5FAE\u4FE1\u957F\u8F6E\u8BE2\u3002" : "\u6B63\u5728\u8054\u7CFB\u817E\u8BAF\u5FAE\u4FE1 iLink \u670D\u52A1\u3002"),
    onCancel ? h2(
      "div",
      { className: "dxw-actions dim-viewActions", style: { justifyContent: "center", marginTop: 14 } },
      h2(Button11, { onClick: onCancel, disabled: busy }, "\u53D6\u6D88")
    ) : null
  );
}
function ProvisionError3({ provision, busy, onRetry, onClose }) {
  const error = provision.error ?? { code: "WEIXIN_PROVISION_FAILED", message: "\u5FAE\u4FE1\u7ED1\u5B9A\u6CA1\u6709\u5B8C\u6210" };
  return h2(
    "div",
    { className: "dxw-card dim-surfaceCard" },
    h2(
      "div",
      { className: "dxw-error dim-inlineError", role: "alert" },
      h2("h3", null, provision.status === "expired" ? "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F" : "\u5FAE\u4FE1\u6CA1\u6709\u7ED1\u5B9A\u5B8C\u6210"),
      h2("p", null, error.message),
      h2("span", { className: "dxw-errorCode" }, error.code),
      h2(
        "div",
        { className: "dxw-actions dim-viewActions" },
        h2(Button11, { kind: "primary", onClick: onRetry, disabled: busy }, "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801"),
        h2(Button11, { onClick: onClose, disabled: busy }, "\u5173\u95ED")
      )
    )
  );
}
function checkedTime5(timestamp7) {
  if (!timestamp7) return "\u5C1A\u672A\u68C0\u67E5";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(timestamp7));
  } catch {
    return "\u521A\u521A";
  }
}
function AccountCard4({
  account,
  busy,
  feedback,
  removing,
  onReconnect,
  onWorkspaceSave,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove
}) {
  const state = busy === "reconnect" ? "connecting" : account.state;
  const tone = account.connected ? "success" : state === "error" ? "error" : "warning";
  const summary = account.error?.message ?? (account.connected ? null : account.health.summary);
  return h2(
    "article",
    { className: "dxw-card dim-botCard", tabIndex: -1, "data-bot-id": account.botId },
    h2(
      "div",
      { className: "dxw-cardBody dim-botCardBody" },
      h2(
        "div",
        { className: "dxw-accountTop dim-botCardTop" },
        h2(
          "div",
          { className: "dxw-accountIdentity dim-botIdentity" },
          h2("div", { className: "dxw-avatar dim-botAvatar", "aria-hidden": "true" }, h2(WeixinLogoGlyph, { size: 27 })),
          h2("div", { className: "dim-botName" }, h2("h3", null, account.bot.name), h2("p", null, account.bot.accountIdMasked))
        ),
        h2(
          "div",
          { className: "dxw-health dim-botHealth" },
          h2("span", { className: "dxw-dot dim-healthDot", "data-tone": tone }),
          h2("span", null, account.connected ? "\u8FD0\u884C\u6B63\u5E38" : state === "connecting" ? "\u6B63\u5728\u8FDE\u63A5" : "\u8FDE\u63A5\u672A\u5C31\u7EEA")
        )
      ),
      h2(
        "dl",
        { className: "dxw-metrics dim-botMetrics" },
        h2(
          "div",
          { className: "dxw-metric dim-botMetric" },
          h2("dt", null, "\u6D88\u606F\u901A\u9053"),
          h2("dd", null, account.connected ? "iLink \u957F\u8F6E\u8BE2" : "\u79BB\u7EBF")
        ),
        h2(
          "div",
          { className: "dxw-metric dim-botMetric" },
          h2("dt", null, "\u6700\u8FD1\u68C0\u67E5"),
          h2("dd", null, checkedTime5(account.health.lastCheckedAt))
        )
      ),
      h2(WorkspaceEditor, {
        workspace: account.workspace,
        disabled: Boolean(busy),
        onSave: onWorkspaceSave
      }),
      h2(
        "div",
        { className: "dxw-accountFooter dim-cardFooter" },
        summary ? h2("div", { className: "dxw-summary dim-cardSummary" }, summary) : null,
        feedback ? h2("div", {
          className: "dxw-summary dim-cardSummary",
          role: "status",
          "aria-live": "polite"
        }, feedback) : null,
        h2(
          "div",
          { className: "dxw-actions dim-cardActions" },
          h2(
            Button11,
            { className: "dim-cardAction", onClick: onReconnect, disabled: Boolean(busy) },
            busy === "reconnect" ? "\u68C0\u67E5\u4E2D\u2026" : account.connected ? "\u68C0\u67E5\u8FDE\u63A5" : "\u91CD\u8BD5\u8FDE\u63A5"
          ),
          h2(Button11, { className: "dim-cardAction", kind: "danger", onClick: onRequestRemove, disabled: Boolean(busy) }, "\u79FB\u9664\u63A5\u5165")
        )
      )
    ),
    removing ? h2(
      "div",
      { className: "dxw-confirm dim-confirm", role: "alertdialog" },
      h2("strong", null, "\u4ECE\u6B64 Harness \u79FB\u9664\u8FD9\u4E2A\u5FAE\u4FE1\u8D26\u53F7\uFF1F"),
      h2("p", null, "\u8FD9\u4F1A\u505C\u6B62\u6D88\u606F\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684 bot_token\u3001\u8D26\u53F7\u914D\u7F6E\u548C\u4F1A\u8BDD\u6620\u5C04\u3002\u5176\u4ED6\u5FAE\u4FE1\u8D26\u53F7\u4E0D\u53D7\u5F71\u54CD\u3002"),
      h2(
        "div",
        { className: "dxw-actions dim-viewActions" },
        h2(Button11, { onClick: onCancelRemove, disabled: busy === "delete" }, "\u4FDD\u7559\u8D26\u53F7"),
        h2(
          Button11,
          { kind: "danger", onClick: onConfirmRemove, disabled: busy === "delete" },
          busy === "delete" ? "\u6B63\u5728\u79FB\u9664\u2026" : "\u786E\u8BA4\u79FB\u9664"
        )
      )
    ) : null
  );
}
function AccountList2(props) {
  return h2(
    "section",
    { className: "dim-listSection" },
    h2("div", { className: "dxw-listHeading dim-listHeading" }, h2("h3", null, "\u5DF2\u63A5\u5165\u7684\u5FAE\u4FE1\u8D26\u53F7")),
    h2("ul", { className: "dxw-list dim-botList" }, props.bots.map((account) => h2(
      "li",
      { key: account.botId },
      h2(AccountCard4, {
        account,
        busy: props.busyByBot[account.botId],
        feedback: props.feedbackByBot[account.botId],
        removing: props.removeTarget === account.botId,
        onReconnect: () => props.onReconnect(account),
        onWorkspaceSave: (workspace) => props.onWorkspaceSave(account, workspace),
        onRequestRemove: () => props.onRequestRemove(account),
        onConfirmRemove: () => props.onConfirmRemove(account),
        onCancelRemove: props.onCancelRemove
      })
    )))
  );
}
var EMPTY_TOTALS3 = Object.freeze({ configured: 0, connected: 0 });
function mergeWeixinProvisioningSnapshot(current, incoming, { restoreProvisioning = false } = {}) {
  if (!incoming || !current && !restoreProvisioning) return current;
  if (current && current.attemptId !== incoming.attemptId) return current;
  return {
    ...current,
    ...incoming,
    durationMs: current?.durationMs ?? 5 * 6e4
  };
}
function WeixinSettingsTab({ rpcCall }) {
  const [model, setModel] = React14.useState({
    phase: "loading",
    bots: [],
    totals: EMPTY_TOTALS3,
    revision: 0,
    error: null
  });
  const [provision, setProvision] = React14.useState(null);
  const [busy, setBusy] = React14.useState(false);
  const [busyByBot, setBusyByBot] = React14.useState({});
  const [feedbackByBot, setFeedbackByBot] = React14.useState({});
  const [removeTarget, setRemoveTarget] = React14.useState(null);
  const [notice, setNotice] = React14.useState("");
  const [now, setNow] = React14.useState(() => Date.now());
  const addButtonRef = React14.useRef(null);
  const mountedRef = React14.useRef(true);
  const workspaceFence = useWorkspaceSnapshotFence();
  const scheduleAnimationFrame = useAnimationFrameScheduler();
  React14.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const announce = React14.useCallback((value) => {
    setNotice("");
    scheduleAnimationFrame(() => {
      if (value) setNotice(value);
    }, "announcement");
  }, [scheduleAnimationFrame]);
  const invoke = React14.useCallback(async (endpoint, payload = {}, signal) => {
    return unwrapRpcResult8(await rpcCall(endpoint, payload, signal));
  }, [rpcCall]);
  const loadStatus = React14.useCallback(async ({
    signal,
    silent = false,
    restoreProvisioning = false
  } = {}) => {
    const workspaceVersion = workspaceFence.beginStatus();
    if (workspaceVersion === null || !mountedRef.current) return void 0;
    if (!silent) setModel((current) => ({ ...current, phase: "loading", error: null }));
    try {
      const snapshot = normalizeSnapshot7(await invoke(WEIXIN_ENDPOINTS.status, {}, signal));
      if (signal?.aborted || !mountedRef.current || !workspaceFence.canCommitStatus(workspaceVersion)) return void 0;
      setModel({
        phase: "ready",
        bots: snapshot.bots,
        totals: snapshot.totals,
        revision: snapshot.revision,
        error: null
      });
      if (snapshot.provisioning) {
        setProvision((current) => mergeWeixinProvisioningSnapshot(
          current,
          snapshot.provisioning,
          { restoreProvisioning }
        ));
      }
      return snapshot;
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError" || !mountedRef.current || !workspaceFence.canCommitStatus(workspaceVersion)) return void 0;
      setModel((current) => ({
        ...current,
        phase: silent && current.phase === "ready" ? "ready" : "error",
        error: presentError8(error)
      }));
      return void 0;
    }
  }, [invoke, workspaceFence]);
  React14.useEffect(() => {
    const controller = new AbortController();
    void loadStatus({ signal: controller.signal, restoreProvisioning: true });
    return () => controller.abort();
  }, [loadStatus]);
  React14.useEffect(() => {
    if (model.phase !== "ready") return void 0;
    const controller = new AbortController();
    let running = false;
    const timer = window.setInterval(async () => {
      if (running) return;
      running = true;
      await loadStatus({
        signal: controller.signal,
        silent: true,
        restoreProvisioning: false
      });
      running = false;
    }, 15e3);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadStatus, model.phase]);
  React14.useEffect(() => {
    if (!provision || !["pending", "scanned"].includes(provision.status)) return void 0;
    const timer = window.setInterval(() => setNow(Date.now()), 1e3);
    return () => window.clearInterval(timer);
  }, [provision?.attemptId, provision?.status]);
  const startProvisioning = React14.useCallback(async ({ replace = false } = {}) => {
    setBusy(true);
    try {
      if (replace && provision?.attemptId) {
        await invoke(WEIXIN_ENDPOINTS.cancelProvisioning, { attemptId: provision.attemptId });
      }
      setProvision({ status: "starting" });
      const started = normalizeProvisioning5(await invoke(WEIXIN_ENDPOINTS.beginProvisioning, { locale: "zh-CN" }));
      setNow(Date.now());
      setProvision({ ...started, durationMs: Math.max(1, started.expiresAt - Date.now()) });
      announce("\u5FAE\u4FE1\u4E8C\u7EF4\u7801\u5DF2\u751F\u6210\uFF0C\u8BF7\u4F7F\u7528\u624B\u673A\u5FAE\u4FE1\u626B\u63CF\u3002");
    } catch (error) {
      setProvision({
        status: "failed",
        error: presentError8(error),
        ...provision?.attemptId ? { attemptId: provision.attemptId } : {}
      });
    } finally {
      setBusy(false);
    }
  }, [announce, invoke, provision?.attemptId]);
  const cancelProvisioning = React14.useCallback(async () => {
    setBusy(true);
    try {
      if (provision?.attemptId && !["failed", "expired", "cancelled"].includes(provision.status)) {
        await invoke(WEIXIN_ENDPOINTS.cancelProvisioning, { attemptId: provision.attemptId });
      }
      setProvision(null);
      announce("\u5DF2\u53D6\u6D88\u5FAE\u4FE1\u7ED1\u5B9A\u3002");
      scheduleAnimationFrame(() => addButtonRef.current?.focus(), "focus");
    } catch (error) {
      setProvision((current) => ({ ...current, status: "failed", error: presentError8(error) }));
    } finally {
      setBusy(false);
    }
  }, [announce, invoke, provision?.attemptId, provision?.status, scheduleAnimationFrame]);
  const submitVerification = React14.useCallback(async (verifyCode) => {
    if (!provision?.attemptId) return;
    setBusy(true);
    try {
      const next = normalizeProvisioning5(await invoke(WEIXIN_ENDPOINTS.submitVerification, {
        attemptId: provision.attemptId,
        verifyCode
      }));
      setProvision((current) => ({ ...current, ...next }));
      announce("\u914D\u5BF9\u7801\u5DF2\u63D0\u4EA4\uFF0C\u6B63\u5728\u7B49\u5F85\u5FAE\u4FE1\u786E\u8BA4\u3002");
    } catch (error) {
      setProvision((current) => ({ ...current, status: "failed", error: presentError8(error) }));
    } finally {
      setBusy(false);
    }
  }, [announce, invoke, provision?.attemptId]);
  React14.useEffect(() => {
    const attemptId = provision?.attemptId;
    if (!attemptId || !["pending", "scanned", "connecting"].includes(provision.status)) return void 0;
    const controller = new AbortController();
    const scheduler = createPollScheduler({
      setTimeoutFn: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimeoutFn: (timer) => window.clearTimeout(timer)
    });
    const poll = async () => {
      try {
        const result = normalizeProvisioning5(await invoke(
          WEIXIN_ENDPOINTS.pollProvisioning,
          { attemptId },
          controller.signal
        ));
        if (scheduler.disposed) return;
        if (result.status === "connected") {
          const snapshot = await loadStatus({
            signal: controller.signal,
            silent: true,
            restoreProvisioning: false
          });
          if (scheduler.disposed) return;
          const account = snapshot?.bots.find((bot) => bot.botId === result.botId);
          if (!account?.connected) {
            setProvision((current) => current?.attemptId === attemptId ? { ...current, ...result, status: "connecting" } : current);
            scheduler.schedule(poll, result.pollIntervalMs);
            return;
          }
          setProvision(null);
          announce(result.alreadyConnected ? "\u8FD9\u4E2A\u5FAE\u4FE1\u8D26\u53F7\u5DF2\u7ECF\u7ED1\u5B9A\u5E76\u4FDD\u6301\u5728\u7EBF\u3002" : "\u5FAE\u4FE1\u5DF2\u7ED1\u5B9A\uFF0C\u53EF\u4EE5\u5F00\u59CB\u5411\u5DF2\u7ED1\u5B9A\u7684\u673A\u5668\u4EBA\u53D1\u6D88\u606F\u3002");
          return;
        }
        setProvision((current) => current?.attemptId === attemptId ? { ...current, ...result, durationMs: current.durationMs } : current);
        if (["pending", "scanned", "connecting"].includes(result.status)) {
          scheduler.schedule(poll, result.pollIntervalMs);
        }
      } catch (error) {
        if (scheduler.disposed || error?.name === "AbortError") return;
        setProvision((current) => current?.attemptId === attemptId ? { ...current, status: "failed", error: presentError8(error) } : current);
      }
    };
    scheduler.schedule(poll, provision.pollIntervalMs ?? 1e3);
    return () => {
      scheduler.dispose();
      controller.abort();
    };
  }, [announce, invoke, loadStatus, provision?.attemptId, provision?.status, provision?.pollIntervalMs]);
  const setBotBusy = React14.useCallback((botId, value) => {
    setBusyByBot((current) => {
      const next = { ...current };
      if (value) next[botId] = value;
      else delete next[botId];
      return next;
    });
  }, []);
  const reconnect = React14.useCallback(async (account) => {
    const snapshotVersion = workspaceFence.beginMutation();
    setBotBusy(account.botId, "reconnect");
    setFeedbackByBot((current) => {
      const next = { ...current };
      delete next[account.botId];
      return next;
    });
    try {
      const snapshot = normalizeSnapshot7(await invoke(
        WEIXIN_ENDPOINTS.reconnectBot,
        { botId: account.botId, sendTest: true }
      ));
      if (mountedRef.current && workspaceFence.canCommitMutation(snapshotVersion)) {
        setModel((current) => ({ ...current, bots: snapshot.bots, totals: snapshot.totals, revision: snapshot.revision }));
      }
      const refreshed = snapshot.bots.find((bot) => bot.botId === account.botId);
      let feedback;
      if (!refreshed?.connected) {
        feedback = "\u5FAE\u4FE1\u4ECD\u672A\u8FDE\u63A5\uFF0C\u63D2\u4EF6\u4F1A\u7EE7\u7EED\u81EA\u52A8\u91CD\u8BD5\u3002";
      } else if (snapshot.testMessage?.sent) {
        feedback = "\u5FAE\u4FE1\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\u3002";
      } else if (snapshot.testMessage?.code === "test-target-unavailable") {
        feedback = "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\u3002\u673A\u5668\u4EBA\u5C1A\u672A\u6536\u5230\u53EF\u7528\u4E8E\u6D4B\u8BD5\u7684\u79C1\u804A\u6D88\u606F\u3002";
      } else if (snapshot.testMessage) {
        feedback = "\u5FAE\u4FE1\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u6D4B\u8BD5\u6D88\u606F\u53D1\u9001\u5931\u8D25\u3002";
      } else {
        feedback = "\u5FAE\u4FE1\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\u3002";
      }
      if (mountedRef.current) {
        setFeedbackByBot((current) => ({ ...current, [account.botId]: feedback }));
      }
      announce(feedback);
    } catch {
      const feedback = "\u8FDE\u63A5\u68C0\u67E5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002";
      if (mountedRef.current) {
        setFeedbackByBot((current) => ({ ...current, [account.botId]: feedback }));
      }
      announce(feedback);
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mountedRef.current) void loadStatus({ silent: true });
      setBotBusy(account.botId, null);
    }
  }, [announce, invoke, loadStatus, setBotBusy, workspaceFence]);
  const saveWorkspace = React14.useCallback(async (account, workspace) => {
    const workspaceVersion = workspaceFence.beginMutation();
    setBotBusy(account.botId, "workspace");
    try {
      const snapshot = normalizeSnapshot7(await invoke(
        WEIXIN_ENDPOINTS.setWorkspace,
        { botId: account.botId, workspace }
      ));
      if (mountedRef.current && workspaceFence.canCommitMutation(workspaceVersion)) {
        setModel({
          phase: "ready",
          bots: snapshot.bots,
          totals: snapshot.totals,
          revision: snapshot.revision,
          error: null
        });
      }
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mountedRef.current) void loadStatus({ silent: true });
      if (mountedRef.current) setBotBusy(account.botId, null);
    }
  }, [invoke, loadStatus, setBotBusy, workspaceFence]);
  const remove = React14.useCallback(async (account) => {
    const snapshotVersion = workspaceFence.beginMutation();
    setBotBusy(account.botId, "delete");
    try {
      const snapshot = normalizeSnapshot7(await invoke(WEIXIN_ENDPOINTS.deleteBot, {
        botId: account.botId,
        confirm: true
      }));
      if (mountedRef.current && workspaceFence.canCommitMutation(snapshotVersion)) {
        setModel((current) => ({ ...current, bots: snapshot.bots, totals: snapshot.totals, revision: snapshot.revision }));
      }
      setRemoveTarget(null);
      announce("\u5FAE\u4FE1\u8D26\u53F7\u53CA\u672C\u673A\u51ED\u636E\u5DF2\u79FB\u9664\u3002");
    } catch (error) {
      announce(`\u79FB\u9664\u5931\u8D25\uFF1A${presentError8(error).message}`);
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mountedRef.current) void loadStatus({ silent: true });
      setBotBusy(account.botId, null);
    }
  }, [announce, invoke, loadStatus, setBotBusy, workspaceFence]);
  let provisionView = null;
  if (provision?.status === "starting") {
    provisionView = h2(ProgressPanel2, { busy });
  } else if (["pending", "scanned"].includes(provision?.status)) {
    provisionView = h2(QrPanel4, {
      provision,
      now,
      busy,
      onRefresh: () => void startProvisioning({ replace: true }),
      onCancel: () => void cancelProvisioning()
    });
  } else if (provision?.status === "needs_verification") {
    provisionView = h2(VerificationPanel, {
      provision,
      busy,
      onSubmit: (code) => void submitVerification(code),
      onCancel: () => void cancelProvisioning()
    });
  } else if (provision?.status === "connecting") {
    provisionView = h2(ProgressPanel2, {
      scanned: true,
      busy,
      onCancel: () => void cancelProvisioning()
    });
  } else if (provision && ["failed", "expired", "cancelled"].includes(provision.status)) {
    provisionView = h2(ProvisionError3, {
      provision,
      busy,
      onRetry: () => void startProvisioning({ replace: Boolean(provision.attemptId) }),
      onClose: () => void cancelProvisioning()
    });
  }
  return h2(
    "section",
    { className: "dxw-page dim-channelPage", "aria-label": "\u5FAE\u4FE1\u8BBE\u7F6E" },
    h2(Heading5, {
      totals: model.totals,
      adding: Boolean(provision),
      busy,
      onAdd: () => void startProvisioning(),
      addButtonRef
    }),
    h2("div", { className: "dxw-visuallyHidden", role: "status", "aria-live": "polite" }, notice),
    model.error && model.phase === "ready" ? h2("div", { className: "dxw-statusNotice dim-statusNotice" }, `\u72B6\u6001\u5237\u65B0\u5931\u8D25\uFF1A${model.error.message}`) : null,
    model.phase === "loading" ? h2(LoadingView5) : model.phase === "error" ? h2(
      "div",
      { className: "dxw-card dim-surfaceCard" },
      h2(
        "div",
        { className: "dxw-error dim-inlineError" },
        h2("h3", null, "\u65E0\u6CD5\u8BFB\u53D6\u5FAE\u4FE1\u72B6\u6001"),
        h2("p", null, model.error?.message ?? "\u8BF7\u7A0D\u540E\u91CD\u8BD5"),
        h2(Button11, { onClick: () => void loadStatus() }, "\u91CD\u65B0\u8BFB\u53D6")
      )
    ) : h2(
      React14.Fragment,
      null,
      provisionView,
      model.bots.length === 0 && !provision ? h2(EmptyView5, { onStart: () => void startProvisioning(), busy }) : null,
      model.bots.length > 0 ? h2(AccountList2, {
        bots: model.bots,
        busyByBot,
        feedbackByBot,
        removeTarget,
        onReconnect: (account) => void reconnect(account),
        onWorkspaceSave: saveWorkspace,
        onRequestRemove: (account) => setRemoveTarget(account.botId),
        onConfirmRemove: (account) => void remove(account),
        onCancelRemove: () => setRemoveTarget(null)
      }) : null
    )
  );
}

// plugin-src/client/channels/whatsapp/api.js
var WHATSAPP_RPC_CHANNEL = "/whatsapp";
var WHATSAPP_ENDPOINTS = Object.freeze({
  status: "connection.status",
  beginProvisioning: "provision.begin",
  pollProvisioning: "provision.poll",
  cancelProvisioning: "provision.cancel",
  reconnectBot: "bot.reconnect",
  deleteBot: "bot.delete",
  setWorkspace: "bot.workspace.set"
});
var PROVISION_STATES5 = /* @__PURE__ */ new Set(["starting", "pending", "connecting", "connected", "failed", "cancelled"]);
var BOT_STATES = /* @__PURE__ */ new Set(["connected", "connecting", "offline", "error"]);
var QR_DATA_URL4 = /^data:image\/(?:png|webp);base64,[a-z\d+/]+={0,2}$/i;
function isRecord7(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text4(value, fallback, max = 240) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function id4(value) {
  const result = text4(value, "", 128);
  return /^[a-z\d_-]+$/i.test(result) ? result : void 0;
}
function timestamp6(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? void 0 : parsed;
}
function unwrapRpcResult9(result) {
  if (!isRecord7(result) || typeof result.ok !== "boolean") {
    throw new Error("WhatsApp \u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u54CD\u5E94");
  }
  if (!result.ok) {
    const error = new Error(text4(result.error?.message, "WhatsApp \u64CD\u4F5C\u5931\u8D25"));
    error.code = text4(result.error?.code, "WHATSAPP_RPC_ERROR", 80);
    throw error;
  }
  return result.value;
}
function safeQrSource6(value) {
  return typeof value === "string" && value.length <= 2 * 1024 * 1024 && QR_DATA_URL4.test(value) ? value : void 0;
}
function normalizeProvisioning6(value, now = Date.now()) {
  const source = isRecord7(value?.provisioning) ? value.provisioning : value;
  if (!isRecord7(source)) throw new Error("WhatsApp \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u626B\u7801\u8FDB\u5EA6");
  const attemptId = id4(source.attemptId);
  if (!attemptId) throw new Error("WhatsApp \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u626B\u7801\u4EFB\u52A1");
  const reported = text4(source.status, "failed", 32);
  const result = {
    attemptId,
    status: PROVISION_STATES5.has(reported) ? reported : "failed",
    expiresAt: timestamp6(source.expiresAt) ?? now + 6e4,
    pollIntervalMs: Math.min(5e3, Math.max(500, Number(source.pollIntervalMs) || 1e3)),
    qrRevision: Number.isSafeInteger(source.qrRevision) ? source.qrRevision : 0
  };
  const qrCodeDataUrl = safeQrSource6(source.qrCodeDataUrl);
  if (qrCodeDataUrl) result.qrCodeDataUrl = qrCodeDataUrl;
  if (id4(source.botId)) result.botId = id4(source.botId);
  if (isRecord7(source.error)) result.error = {
    code: text4(source.error.code, "WHATSAPP_PROVISION_FAILED", 80),
    message: text4(source.error.message, "WhatsApp \u6CA1\u6709\u63A5\u5165\u5B8C\u6210")
  };
  return result;
}
function normalizeBot6(value) {
  if (!isRecord7(value) || !id4(value.botId)) return void 0;
  const connected = value.connected === true;
  const state = BOT_STATES.has(value.state) ? value.state : "offline";
  return {
    botId: id4(value.botId),
    connected,
    state: connected ? "connected" : state,
    workspace: text4(value.workspace, "", 4096),
    bot: {
      name: text4(value.bot?.name, "WhatsApp\u673A\u5668\u4EBA", 100),
      idMasked: text4(value.bot?.idMasked, "WhatsApp\u8D26\u53F7", 140)
    },
    health: {
      summary: text4(value.health?.summary, connected ? "WhatsApp Web \u5173\u8054\u8BBE\u5907\u8FD0\u884C\u6B63\u5E38" : "WhatsApp \u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA"),
      lastCheckedAt: timestamp6(value.health?.lastCheckedAt)
    },
    error: isRecord7(value.error) ? {
      code: text4(value.error.code, "WHATSAPP_ACCOUNT_ERROR", 80),
      message: text4(value.error.message, "WhatsApp \u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA")
    } : null
  };
}
function normalizeSnapshot8(value) {
  const source = isRecord7(value?.snapshot) ? value.snapshot : value;
  if (!isRecord7(source) || !Array.isArray(source.bots)) {
    throw new Error("WhatsApp \u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u673A\u5668\u4EBA\u5217\u8868");
  }
  const bots = source.bots.map(normalizeBot6).filter(Boolean);
  return {
    revision: Number.isSafeInteger(source.revision) ? source.revision : 0,
    bots,
    totals: { configured: bots.length, connected: bots.filter((bot) => bot.connected).length },
    provisioning: source.provisioning ? normalizeProvisioning6(source.provisioning) : null
  };
}
function presentError9(error) {
  return {
    code: text4(error?.code, "WHATSAPP_ERROR", 80),
    message: text4(error?.message, "WhatsApp \u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5")
  };
}
function formatRemaining6(milliseconds) {
  const seconds = Math.max(0, Math.ceil(Number(milliseconds) / 1e3) || 0);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// plugin-src/client/channels/whatsapp/index.js
var React15 = __toESM(require("react"), 1);

// plugin-src/client/channels/whatsapp/styles.js
var WHATSAPP_STYLE_ID = "xmanrui-dsh-im-whatsapp-settings";
var CSS9 = String.raw`
.dwa-page { --ddt-accent: #25d366; --ddt-accent-deep: #128c7e; --ddt-accent-wash: #eafbf0; }
.dwa-avatar { color: #fff; background: #25d366; }
.dwa-avatar svg { display: block; }
`;
function installWhatsappStyles() {
  if (typeof document === "undefined") return () => {
  };
  const existing = document.querySelector(`style[data-plugin-css="${WHATSAPP_STYLE_ID}"]`);
  if (existing) return () => {
  };
  const style = document.createElement("style");
  style.dataset.plugin = "@xmanrui/dsh-im";
  style.dataset.pluginCss = WHATSAPP_STYLE_ID;
  style.textContent = CSS9;
  document.head.appendChild(style);
  return () => style.remove();
}

// plugin-src/client/channels/whatsapp/index.js
var ACTIVE_STATES3 = /* @__PURE__ */ new Set(["pending", "connecting"]);
var Button13 = React15.forwardRef(function Button14({ children, kind = "secondary", className = "", ...props }, ref) {
  return h2("button", {
    ...props,
    ref,
    type: "button",
    className: `ddt-button ${className}`.trim(),
    "data-kind": kind
  }, children);
});
function checkedTime6(value) {
  if (!value) return "\u5C1A\u672A\u68C0\u67E5";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(value));
  } catch {
    return "\u521A\u521A";
  }
}
function connectionTestNotice3(value) {
  if (value?.testMessage?.sent === true) {
    return "\u6D4B\u8BD5\u6D88\u606F\u5DF2\u53D1\u9001\uFF0C\u8BF7\u5230 WhatsApp \u81EA\u804A\u4F1A\u8BDD\u4E2D\u786E\u8BA4\u3002";
  }
  if (value?.testMessage?.code === "test-target-unavailable") {
    return "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684 WhatsApp \u81EA\u804A\u76EE\u6807\u3002";
  }
  return value?.testMessage ? "\u8FDE\u63A5\u68C0\u67E5\u5B8C\u6210\uFF0C\u4F46\u6D4B\u8BD5\u6D88\u606F\u53D1\u9001\u5931\u8D25\u3002" : null;
}
function Heading6({ totals, busy, onAdd, addButtonRef }) {
  return h2(
    "div",
    { className: "ddt-heading" },
    h2(
      "div",
      { className: "ddt-tools" },
      h2(
        "div",
        { className: "dim-bindActions" },
        h2(Button13, {
          kind: "primary",
          className: "dim-scanButton",
          onClick: onAdd,
          disabled: busy,
          ref: addButtonRef,
          "aria-label": "\u626B\u7801\u63A5\u5165 WhatsApp \u673A\u5668\u4EBA"
        }, h2(QrActionIcon), busy ? "\u6B63\u5728\u63A5\u5165" : "\u626B\u7801\u63A5\u5165\u673A\u5668\u4EBA")
      ),
      totals.configured > 0 ? h2(
        "div",
        { className: "ddt-badge dim-onlineBadge" },
        h2("span", null, `${totals.connected} / ${totals.configured} \u5728\u7EBF`)
      ) : null
    )
  );
}
function LoadingView6() {
  return h2("div", {
    className: "ddt-card ddt-loading dim-surfaceCard dim-loadingView",
    "aria-busy": "true"
  }, h2("div", { className: "ddt-spinner dim-spinner" }), "\u6B63\u5728\u8BFB\u53D6 WhatsApp \u673A\u5668\u4EBA\u72B6\u6001\u2026");
}
function EmptyView6({ busy, onStart }) {
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-cardBody ddt-empty dim-surfaceBody dim-emptyView" },
      h2(
        "div",
        { className: "dim-emptyCopy" },
        h2(
          "div",
          { className: "ddt-stateLabel dim-stateLabel" },
          h2("span", { className: "ddt-dot dim-stateDot" }),
          h2("span", null, "\u5C1A\u672A\u63A5\u5165 WhatsApp \u673A\u5668\u4EBA")
        ),
        h2("h3", null, "\u626B\u7801\u7ED1\u5B9A WhatsApp \u673A\u5668\u4EBA"),
        h2("p", null, "\u4F7F\u7528\u624B\u673A WhatsApp \u626B\u63CF\u4E8C\u7EF4\u7801\u5373\u53EF\u63A5\u5165\u3002"),
        h2(
          "div",
          { className: "ddt-actions dim-viewActions" },
          h2(
            Button13,
            { kind: "primary", onClick: onStart, disabled: busy },
            busy ? "\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801\u2026" : "\u751F\u6210\u4E8C\u7EF4\u7801"
          )
        )
      ),
      h2("div", {
        className: "ddt-brandMark dim-emptyBrand dwa-avatar",
        "aria-hidden": "true"
      }, h2(WhatsappLogoGlyph, { size: 64 }))
    )
  );
}
function QrPanel5({ provision, now, busy, onRefresh, onCancel }) {
  const source = safeQrSource6(provision.qrCodeDataUrl);
  const remaining = Math.max(0, provision.expiresAt - now);
  const duration = Math.max(1, provision.durationMs ?? 6e4);
  const progress = Math.round(Math.min(1, remaining / duration) * 100);
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-cardBody ddt-qrLayout dim-surfaceBody dim-qrLayout" },
      h2(
        "div",
        { className: "ddt-qrColumn dim-qrColumn" },
        h2(
          "div",
          { className: "ddt-qrFrame dim-qrFrame" },
          source ? h2("img", {
            src: source,
            alt: "\u7528\u4E8E\u5173\u8054 WhatsApp \u8BBE\u5907\u7684\u4E00\u6B21\u6027\u4E8C\u7EF4\u7801"
          }) : h2("div", { className: "ddt-qrFallback dim-qrFallback" }, "\u4E8C\u7EF4\u7801\u6B63\u5728\u751F\u6210\u2026")
        ),
        h2(
          "div",
          { className: "ddt-countdown dim-countdown" },
          h2(
            "div",
            { className: "ddt-countdownTop dim-countdownTop" },
            h2("span", null, "\u5F53\u524D\u4E8C\u7EF4\u7801\u6709\u6548\u65F6\u95F4"),
            h2("strong", null, formatRemaining6(remaining))
          ),
          h2("div", {
            className: "ddt-progress dim-progress",
            style: { "--ddt-progress": `${progress}%` }
          }, h2("span"))
        )
      ),
      h2(
        "div",
        { className: "ddt-qrCopy dim-qrCopy" },
        h2(
          "div",
          { className: "ddt-stateLabel dim-stateLabel" },
          h2("span", { className: "ddt-dot dim-stateDot", "data-tone": "warning" }),
          h2("span", null, "\u7B49\u5F85 WhatsApp \u626B\u7801")
        ),
        h2("h3", null, "\u7528\u624B\u673A WhatsApp \u626B\u63CF\u4E8C\u7EF4\u7801"),
        h2(
          "ol",
          { className: "ddt-steps dim-steps" },
          h2("li", null, "\u6253\u5F00 WhatsApp \u2192 \u8BBE\u7F6E \u2192 \u5DF2\u5173\u8054\u8BBE\u5907"),
          h2("li", null, "\u70B9\u51FB\u201C\u5173\u8054\u8BBE\u5907\u201D\u5E76\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801")
        ),
        h2(
          "div",
          { className: "ddt-actions dim-viewActions" },
          h2(Button13, { onClick: onRefresh, disabled: busy }, "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801"),
          h2(Button13, { kind: "quiet", onClick: onCancel, disabled: busy }, "\u53D6\u6D88")
        )
      )
    )
  );
}
function ProvisionView3({ provision, busy, onRetry, onClose }) {
  if (provision.status === "starting" || provision.status === "connecting") {
    const starting = provision.status === "starting";
    return h2(
      "div",
      {
        className: "ddt-card ddt-loading dim-surfaceCard dim-specialView",
        "aria-busy": "true"
      },
      h2("div", { className: "ddt-spinner dim-spinner" }),
      h2("h3", null, starting ? "\u6B63\u5728\u751F\u6210 WhatsApp \u4E8C\u7EF4\u7801" : "\u5DF2\u626B\u7801\uFF0C\u6B63\u5728\u8FDE\u63A5 WhatsApp"),
      h2("p", null, starting ? "\u6B63\u5728\u5EFA\u7ACB\u5B89\u5168\u7684\u5173\u8054\u8BBE\u5907\u4F1A\u8BDD\u3002" : "\u5173\u8054\u8BBE\u5907\u6B63\u5728\u63A5\u5165 DeepSeek Harness\u3002")
    );
  }
  const error = provision.error ?? {
    code: "WHATSAPP_PROVISION_FAILED",
    message: "WhatsApp \u6CA1\u6709\u63A5\u5165\u5B8C\u6210"
  };
  return h2(
    "div",
    { className: "ddt-card dim-surfaceCard" },
    h2(
      "div",
      { className: "ddt-inlineError dim-inlineError", role: "alert" },
      h2("h3", null, "WhatsApp \u6CA1\u6709\u63A5\u5165\u5B8C\u6210"),
      h2("p", null, error.message),
      h2("span", { className: "ddt-errorCode" }, error.code),
      h2(
        "div",
        { className: "ddt-actions dim-viewActions" },
        h2(Button13, { kind: "primary", onClick: onRetry, disabled: busy }, "\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801"),
        h2(Button13, { onClick: onClose, disabled: busy }, "\u5173\u95ED")
      )
    )
  );
}
function RemoveConfirmation5({ account, busy, onConfirm, onCancel }) {
  return h2(
    "div",
    { className: "ddt-confirm dim-confirm", role: "alertdialog" },
    h2("strong", null, `\u4ECE DeepSeek Harness \u79FB\u9664\u201C${account.bot.name}\u201D\uFF1F`),
    h2("p", null, "\u8FD9\u4F1A\u505C\u6B62\u6D88\u606F\u8FDE\u63A5\uFF0C\u5E76\u5220\u9664\u672C\u673A\u4FDD\u5B58\u7684 WhatsApp \u5173\u8054\u8BBE\u5907\u548C\u4F1A\u8BDD\u6620\u5C04\u3002"),
    h2(
      "div",
      { className: "ddt-actions dim-viewActions" },
      h2(Button13, { onClick: onCancel, disabled: busy }, "\u4FDD\u7559\u673A\u5668\u4EBA"),
      h2(
        Button13,
        { kind: "danger", onClick: onConfirm, disabled: busy },
        busy ? "\u6B63\u5728\u79FB\u9664\u2026" : "\u786E\u8BA4\u79FB\u9664\u63A5\u5165"
      )
    )
  );
}
function WhatsappAccountCard({
  account,
  busy,
  testNotice,
  removing,
  onReconnect,
  onWorkspaceSave,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove
}) {
  const state = busy === "reconnect" ? "connecting" : account.state;
  const tone = account.connected ? "success" : state === "error" ? "error" : "warning";
  const stateLabel = account.connected ? "\u8FD0\u884C\u6B63\u5E38" : state === "connecting" ? "\u6B63\u5728\u8FDE\u63A5" : "\u8FDE\u63A5\u672A\u5C31\u7EEA";
  const summary = account.error?.message ?? (account.connected ? null : account.health.summary);
  return h2(
    "article",
    { className: "ddt-card dim-botCard", "data-bot-id": account.botId },
    h2(
      "div",
      { className: "ddt-cardBody dim-botCardBody" },
      h2(
        "div",
        { className: "ddt-accountTop dim-botCardTop" },
        h2(
          "div",
          { className: "ddt-accountIdentity dim-botIdentity" },
          h2("div", {
            className: "ddt-avatar dim-botAvatar dwa-avatar",
            "aria-hidden": "true"
          }, h2(WhatsappLogoGlyph, { size: 29 })),
          h2(
            "div",
            { className: "dim-botName" },
            h2("h3", null, account.bot.name),
            h2("p", null, account.bot.idMasked)
          )
        ),
        h2(
          "div",
          { className: "ddt-health dim-botHealth" },
          h2("span", { className: "ddt-dot dim-healthDot", "data-tone": tone }),
          h2("span", null, stateLabel)
        )
      ),
      h2(
        "dl",
        { className: "ddt-metrics dim-botMetrics" },
        h2(
          "div",
          { className: "ddt-metric dim-botMetric" },
          h2("dt", null, "\u6D88\u606F\u901A\u9053"),
          h2("dd", null, account.connected ? "WhatsApp Web" : "\u79BB\u7EBF")
        ),
        h2(
          "div",
          { className: "ddt-metric dim-botMetric" },
          h2("dt", null, "\u6700\u8FD1\u68C0\u67E5"),
          h2("dd", null, checkedTime6(account.health.lastCheckedAt))
        )
      ),
      h2(WorkspaceEditor, {
        workspace: account.workspace,
        disabled: Boolean(busy),
        onSave: onWorkspaceSave
      }),
      h2(
        "div",
        { className: "ddt-accountFooter dim-cardFooter" },
        summary ? h2("div", { className: "ddt-summary dim-cardSummary" }, summary) : null,
        testNotice ? h2("div", {
          className: "ddt-summary dim-cardSummary",
          role: "status"
        }, testNotice) : null,
        h2(
          "div",
          { className: "ddt-actions dim-cardActions" },
          h2(Button13, {
            className: "dim-cardAction",
            onClick: onReconnect,
            disabled: Boolean(busy)
          }, busy === "reconnect" ? "\u68C0\u67E5\u4E2D\u2026" : account.connected ? "\u68C0\u67E5\u8FDE\u63A5" : "\u91CD\u8BD5\u8FDE\u63A5"),
          h2(Button13, {
            className: "dim-cardAction",
            kind: "danger",
            onClick: onRequestRemove,
            disabled: Boolean(busy)
          }, "\u79FB\u9664\u63A5\u5165")
        )
      )
    ),
    removing ? h2(RemoveConfirmation5, {
      account,
      busy: busy === "delete",
      onConfirm: onConfirmRemove,
      onCancel: onCancelRemove
    }) : null
  );
}
function WhatsappSettingsTab({ rpcCall }) {
  const [model, setModel] = React15.useState({
    phase: "loading",
    bots: [],
    totals: { configured: 0, connected: 0 },
    error: null
  });
  const [provision, setProvision] = React15.useState(null);
  const [busy, setBusy] = React15.useState(false);
  const [busyByBot, setBusyByBot] = React15.useState({});
  const [testNoticeByBot, setTestNoticeByBot] = React15.useState({});
  const [removeTarget, setRemoveTarget] = React15.useState(null);
  const [now, setNow] = React15.useState(Date.now());
  const mounted = React15.useRef(true);
  const workspaceFence = useWorkspaceSnapshotFence();
  const addButtonRef = React15.useRef(null);
  React15.useEffect(() => {
    const disposeDingtalk = installDingtalkStyles();
    const disposeWhatsapp = installWhatsappStyles();
    mounted.current = true;
    return () => {
      mounted.current = false;
      disposeWhatsapp();
      disposeDingtalk();
    };
  }, []);
  const invoke = React15.useCallback(async (endpoint, payload = {}, signal) => {
    if (typeof rpcCall !== "function") throw new TypeError("WhatsApp \u8BBE\u7F6E\u9875\u7F3A\u5C11 RPC \u8FDE\u63A5");
    return unwrapRpcResult9(await rpcCall(endpoint, payload, signal));
  }, [rpcCall]);
  const loadStatus = React15.useCallback(async ({ signal, silent = false, restore = false } = {}) => {
    const workspaceVersion = workspaceFence.beginStatus();
    if (workspaceVersion === null) return void 0;
    if (!silent && mounted.current) setModel((current) => ({ ...current, phase: "loading", error: null }));
    try {
      const snapshot = normalizeSnapshot8(await invoke(WHATSAPP_ENDPOINTS.status, {}, signal));
      if (!mounted.current || signal?.aborted || !workspaceFence.canCommitStatus(workspaceVersion)) return void 0;
      setModel({ phase: "ready", bots: snapshot.bots, totals: snapshot.totals, error: null });
      if (restore && snapshot.provisioning) setProvision({
        ...snapshot.provisioning,
        durationMs: Math.max(1, snapshot.provisioning.expiresAt - Date.now())
      });
      return snapshot;
    } catch (error) {
      if (error?.name !== "AbortError" && mounted.current && !signal?.aborted && workspaceFence.canCommitStatus(workspaceVersion)) {
        setModel((current) => ({
          ...current,
          phase: silent ? current.phase : "error",
          error: presentError9(error)
        }));
      }
      return void 0;
    }
  }, [invoke, workspaceFence]);
  React15.useEffect(() => {
    const controller = new AbortController();
    void loadStatus({ signal: controller.signal, restore: true });
    return () => controller.abort();
  }, [loadStatus]);
  React15.useEffect(() => {
    if (model.phase !== "ready") return void 0;
    const controller = new AbortController();
    const timer = window.setInterval(
      () => void loadStatus({ signal: controller.signal, silent: true }),
      15e3
    );
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadStatus, model.phase]);
  React15.useEffect(() => {
    if (!provision || !ACTIVE_STATES3.has(provision.status)) return void 0;
    const timer = window.setInterval(() => mounted.current && setNow(Date.now()), 1e3);
    return () => window.clearInterval(timer);
  }, [provision?.attemptId, provision?.status]);
  const startProvisioning = React15.useCallback(async (replace = false) => {
    setBusy(true);
    try {
      if (replace && provision?.attemptId) {
        await invoke(WHATSAPP_ENDPOINTS.cancelProvisioning, { attemptId: provision.attemptId });
      }
      if (!mounted.current) return;
      setProvision({ status: "starting" });
      const started = normalizeProvisioning6(await invoke(WHATSAPP_ENDPOINTS.beginProvisioning, {}));
      if (!mounted.current) return;
      setNow(Date.now());
      setProvision({ ...started, durationMs: Math.max(1, started.expiresAt - Date.now()) });
    } catch (error) {
      if (mounted.current) setProvision({ status: "failed", error: presentError9(error) });
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [invoke, provision?.attemptId]);
  const closeProvision = React15.useCallback(async () => {
    setBusy(true);
    try {
      if (provision?.attemptId && ACTIVE_STATES3.has(provision.status)) {
        await invoke(WHATSAPP_ENDPOINTS.cancelProvisioning, { attemptId: provision.attemptId });
      }
      if (mounted.current) setProvision(null);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [invoke, provision?.attemptId, provision?.status]);
  React15.useEffect(() => {
    const attemptId = provision?.attemptId;
    if (!attemptId || !ACTIVE_STATES3.has(provision.status)) return void 0;
    const controller = new AbortController();
    let disposed = false;
    let timer;
    const schedule = (delay) => {
      if (disposed || controller.signal.aborted) return;
      timer = window.setTimeout(() => void poll(), delay);
    };
    const poll = async () => {
      try {
        const current = normalizeProvisioning6(await invoke(
          WHATSAPP_ENDPOINTS.pollProvisioning,
          { attemptId },
          controller.signal
        ));
        if (disposed || controller.signal.aborted || !mounted.current) return;
        if (current.status === "connected") {
          setProvision(null);
          await loadStatus({ signal: controller.signal, silent: true });
          return;
        }
        setProvision((previous) => ({
          ...current,
          durationMs: previous?.durationMs ?? Math.max(1, current.expiresAt - Date.now())
        }));
        if (ACTIVE_STATES3.has(current.status)) schedule(current.pollIntervalMs);
      } catch (error) {
        if (!disposed && !controller.signal.aborted && mounted.current) {
          setProvision({ status: "failed", error: presentError9(error) });
        }
      }
    };
    schedule(provision.pollIntervalMs ?? 1e3);
    return () => {
      disposed = true;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [invoke, loadStatus, provision?.attemptId, provision?.status]);
  const botAction = React15.useCallback(async (account, operation, endpoint, payload) => {
    const snapshotVersion = workspaceFence.beginMutation();
    setBusyByBot((current) => ({ ...current, [account.botId]: operation }));
    if (operation === "reconnect") {
      setTestNoticeByBot((current) => {
        const next = { ...current };
        delete next[account.botId];
        return next;
      });
    }
    try {
      const value = await invoke(endpoint, payload);
      const snapshot = normalizeSnapshot8(value);
      if (mounted.current && workspaceFence.canCommitMutation(snapshotVersion)) {
        setModel({ phase: "ready", bots: snapshot.bots, totals: snapshot.totals, error: null });
        if (operation === "reconnect") {
          setTestNoticeByBot((current) => ({
            ...current,
            [account.botId]: connectionTestNotice3(value)
          }));
        }
      }
    } catch (error) {
      if (operation !== "reconnect") throw error;
      if (mounted.current && workspaceFence.canCommitMutation(snapshotVersion)) {
        setTestNoticeByBot((current) => ({
          ...current,
          [account.botId]: "\u8FDE\u63A5\u68C0\u67E5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002"
        }));
      }
    } finally {
      const shouldRefresh = workspaceFence.endMutation();
      if (shouldRefresh && mounted.current) void loadStatus({ silent: true });
      if (mounted.current) setBusyByBot((current) => {
        const next = { ...current };
        delete next[account.botId];
        return next;
      });
    }
  }, [invoke, loadStatus, workspaceFence]);
  const botList = model.bots.length > 0 ? h2(
    "section",
    { className: "dim-listSection" },
    h2(
      "div",
      { className: "ddt-listHeading dim-listHeading" },
      h2("h3", null, "\u5DF2\u63A5\u5165\u7684 WhatsApp \u673A\u5668\u4EBA")
    ),
    h2("ul", { className: "ddt-list dim-botList" }, model.bots.map((account) => h2("li", { key: account.botId }, h2(WhatsappAccountCard, {
      account,
      busy: busyByBot[account.botId],
      testNotice: testNoticeByBot[account.botId],
      removing: removeTarget === account.botId,
      onReconnect: () => void botAction(
        account,
        "reconnect",
        WHATSAPP_ENDPOINTS.reconnectBot,
        { botId: account.botId, sendTest: true }
      ),
      onWorkspaceSave: (workspace) => botAction(
        account,
        "workspace",
        WHATSAPP_ENDPOINTS.setWorkspace,
        { botId: account.botId, workspace }
      ),
      onRequestRemove: () => setRemoveTarget(account.botId),
      onCancelRemove: () => setRemoveTarget(null),
      onConfirmRemove: async () => {
        await botAction(account, "delete", WHATSAPP_ENDPOINTS.deleteBot, {
          botId: account.botId,
          confirm: true
        });
        if (mounted.current) setRemoveTarget(null);
      }
    }))))
  ) : null;
  return h2(
    "section",
    {
      className: "ddt-page dwa-page dim-channelPage",
      "aria-label": "WhatsApp \u8BBE\u7F6E"
    },
    h2(Heading6, {
      totals: model.totals,
      busy,
      onAdd: () => void startProvisioning(false),
      addButtonRef
    }),
    model.phase === "loading" ? h2(LoadingView6) : model.phase === "error" ? h2(
      "div",
      { className: "ddt-card dim-surfaceCard" },
      h2(
        "div",
        { className: "ddt-inlineError dim-inlineError" },
        h2("h3", null, "\u65E0\u6CD5\u8BFB\u53D6 WhatsApp \u673A\u5668\u4EBA\u72B6\u6001"),
        h2("p", null, model.error?.message),
        h2(Button13, { onClick: () => void loadStatus() }, "\u91CD\u65B0\u8BFB\u53D6")
      )
    ) : h2(
      React15.Fragment,
      null,
      provision?.status === "pending" ? h2(QrPanel5, {
        provision,
        now,
        busy,
        onRefresh: () => void startProvisioning(true),
        onCancel: () => void closeProvision()
      }) : provision ? h2(ProvisionView3, {
        provision,
        busy,
        onRetry: () => void startProvisioning(true),
        onClose: () => void closeProvision()
      }) : model.bots.length === 0 ? h2(EmptyView6, { busy, onStart: () => void startProvisioning(false) }) : null,
      botList
    )
  );
}

// plugin-src/client/styles.js
var IM_STYLE_ID = "xmanrui-dsh-im-settings";
var CSS10 = String.raw`
.dim-page {
  --dim-blue: var(--dsw-alias-state-business-primary, #3370ff);
  --dim-blue-soft: color-mix(in srgb, var(--dim-blue) 9%, transparent);
  width: 100%;
  max-width: 1080px;
  padding: 2px 0 30px;
  color: var(--dsw-alias-label-primary, #1f2329);
  box-sizing: border-box;
}
.dim-page *, .dim-page *::before, .dim-page *::after { box-sizing: border-box; }
.dim-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 0 0 18px; }
.dim-brand { min-width: 0; display: flex; align-items: center; gap: 12px; }
.dim-brandLogo { width: 48px; height: 48px; flex: 0 0 48px; display: block; object-fit: contain; }
.dim-title p { margin: 0; color: var(--dsw-alias-label-primary, #1f2329); font-size: 14px; line-height: 20px; font-weight: 600; white-space: nowrap; }
.dim-githubAction { position: relative; display: inline-flex; flex: none; }
.dim-githubLink { min-height: 30px; display: inline-flex; align-items: center; gap: 5px; flex: none; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 8px; color: var(--dsw-alias-label-secondary, #646a73); background: var(--dsw-alias-bg-layer-1, #fff); font-size: 12px; line-height: normal; font-weight: 560; text-decoration: none; transition: border-color .15s ease, color .15s ease, background .15s ease; }
.dim-githubLink:hover { border-color: #aeb3bb; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.dim-githubLink:focus-visible { outline: 2px solid color-mix(in srgb, var(--dim-blue) 70%, white); outline-offset: 2px; }
.dim-githubArrow { font-size: 13px; line-height: 1; }
.dim-githubTooltip { position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 20; width: max-content; max-width: min(220px, 80vw); padding: 6px 9px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 7px; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-layer-3, #fff); box-shadow: 0 8px 24px rgb(31 35 41 / 14%); font-size: 11px; line-height: 16px; font-weight: 500; white-space: nowrap; opacity: 0; visibility: hidden; transform: translateY(3px); pointer-events: none; transition: opacity .15s ease, transform .15s ease, visibility .15s ease; }
.dim-githubAction:hover .dim-githubTooltip, .dim-githubAction:focus-within .dim-githubTooltip { opacity: 1; visibility: visible; transform: translateY(0); }
.dim-layout { display: grid; grid-template-columns: 174px 1px minmax(0, 1fr); gap: 24px; align-items: start; }
.dim-rail { max-height: 520px; display: grid; align-content: start; gap: 8px; overflow-y: auto; padding: 1px 4px 1px 1px; scrollbar-width: thin; scrollbar-color: var(--dsw-alias-border-l2, #dfe1e5) transparent; }
.dim-rail::-webkit-scrollbar { width: 4px; }
.dim-rail::-webkit-scrollbar-thumb { border-radius: 99px; background: var(--dsw-alias-border-l2, #dfe1e5); }
.dim-channel { width: 100%; min-height: 48px; display: grid; grid-template-columns: 30px minmax(0, 1fr); align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid var(--dsw-alias-border-l2, #eef0f3); border-radius: 14px; color: inherit; background: var(--dsw-alias-bg-layer-3, #fff); box-shadow: 0 2px 8px rgb(31 35 41 / 3%); font: inherit; text-align: left; cursor: pointer; transition: border-color .16s ease, background .16s ease, box-shadow .16s ease; }
.dim-channel:hover { border-color: color-mix(in srgb, var(--dim-blue) 25%, var(--dsw-alias-border-l2, #eef0f3)); background: color-mix(in srgb, var(--dim-blue) 2%, var(--dsw-alias-bg-layer-3, #fff)); box-shadow: 0 5px 16px rgb(31 35 41 / 5%); }
.dim-channel[aria-selected="true"] { border-color: color-mix(in srgb, var(--dim-blue) 43%, var(--dsw-alias-border-l2, #dfe1e5)); color: var(--dim-blue); background: color-mix(in srgb, var(--dim-blue) 12%, var(--dsw-alias-bg-layer-3, #fff)); box-shadow: 0 3px 12px rgb(51 112 255 / 7%); }
.dim-channel:focus-visible { outline: none; border-color: color-mix(in srgb, var(--dim-blue) 72%, var(--dsw-alias-border-l2, #dfe1e5)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--dim-blue) 24%, transparent) inset, 0 3px 12px rgb(51 112 255 / 7%); }
.dim-logo { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; box-shadow: 0 1px 3px rgb(31 35 41 / 7%); }
.dim-logo svg { display: block; width: 20px; height: 20px; }
.dim-logoWeixin { color: white; background: #07c160; }
.dim-logoWeixin svg { width: 19px; height: 19px; }
.dim-logoFeishu { background: white; border: 1px solid var(--dsw-alias-border-l2, #e5e6eb); }
.dim-logoFeishu svg { width: 28px; height: 28px; }
.dim-logoDingtalk { color: white; background: #1677ff; }
.dim-logoDingtalk svg { width: 24px; height: 24px; }
.dim-logoQq { color: white; background: #1677ff; }
.dim-logoQq svg { width: 21px; height: 21px; }
.dim-logoWecom { background: white; border: 1px solid var(--dsw-alias-border-l2, #e5e6eb); }
.dim-logoWecom svg { width: 22px; height: 22px; }
.dim-logoTelegram { color: white; background: #229ed9; }
.dim-logoTelegram svg { width: 21px; height: 21px; }
.dim-logoDiscord { color: white; background: #5865f2; }
.dim-logoDiscord svg { width: 21px; height: 21px; }
.dim-logoSlack { color: white; background: #4a154b; }
.dim-logoSlack svg { width: 21px; height: 21px; }
.dim-logoWhatsapp { color: white; background: #25d366; }
.dim-logoWhatsapp svg { width: 21px; height: 21px; }
.dim-channelCopy { min-width: 0; display: block; }
.dim-channelCopy strong { overflow: hidden; color: inherit; font-size: 14px; line-height: 20px; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
.dim-divider { width: 1px; min-height: 520px; background: var(--dsw-alias-border-l1, #eef0f3); }
.dim-panel { min-width: 0; container-type: inline-size; }
.dim-panel .bxf-page, .dim-panel .dxw-page, .dim-panel .ddt-page, .dim-panel .dqq-page, .dim-panel .dwecom-page, .dim-panel .dsl-page, .dim-panel .dwa-page { width: 100%; max-width: none; padding: 0 0 24px; }
.dim-panel .bxf-heading, .dim-panel .dxw-heading, .dim-panel .ddt-heading { justify-content: flex-end; }
.dim-panel .bxf-headingTools, .dim-panel .dxw-tools, .dim-panel .ddt-tools { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) max-content; align-items: center; justify-content: stretch; gap: 8px; }
.dim-panel .dim-bindActions { min-width: 0; display: flex; align-items: center; flex-wrap: nowrap; gap: 8px; }
.dim-panel .dim-bindActions > button { min-width: 0; }
.dim-panel .bxf-headingTools .dim-scanButton, .dim-panel .dxw-tools .dim-scanButton, .dim-panel .ddt-tools .dim-scanButton { flex: none; min-height: 34px; display: inline-flex; align-items: center; justify-content: center; justify-self: start; gap: 6px; padding: 0 10px; border: 1px solid #1677ff; border-radius: 8px; color: #fff; background: #1677ff; box-shadow: none; font: inherit; font-size: 13px; font-weight: 560; white-space: nowrap; }
.dim-panel .bxf-headingTools .dim-scanButton:hover:not(:disabled), .dim-panel .dxw-tools .dim-scanButton:hover:not(:disabled), .dim-panel .ddt-tools .dim-scanButton:hover:not(:disabled) { border-color: #0958d9; background: #0958d9; }
.dim-panel .dim-credentialButton { flex: none; min-height: 34px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 10px; border: 1px solid #86909c; border-radius: 8px; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: 0 1px 2px rgb(31 35 41 / 5%); font: inherit; font-size: 13px; font-weight: 560; line-height: normal; white-space: nowrap; }
.dim-panel .dim-actionIcon { width: 15px; height: 15px; flex: 0 0 15px; }
.dim-panel .dim-credentialButton:hover:not(:disabled) { border-color: #4e5969; background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.dim-panel .dim-credentialButton[aria-pressed="true"] { border-color: #4e5969; background: var(--dsw-alias-bg-module-platform, #f2f3f5); box-shadow: inset 0 0 0 1px rgb(78 89 105 / 8%); }
.dim-panel .bxf-headingTools .dim-onlineBadge, .dim-panel .dxw-tools .dim-onlineBadge, .dim-panel .ddt-tools .dim-onlineBadge { min-height: 30px; display: inline-flex; align-items: center; justify-self: end; gap: 0; padding: 0 11px; border: 0; border-radius: 999px; color: var(--dsw-alias-label-secondary, #646a73); background: var(--dsw-alias-bg-module-platform, #f2f3f5); font: inherit; font-size: 12px; font-weight: 400; line-height: normal; white-space: nowrap; }
.dim-panel .dim-channelPage { width: 100%; max-width: none; display: flex; flex-direction: column; gap: 12px; padding: 0 0 24px; color: var(--dsw-alias-label-primary, #1f2329); box-sizing: border-box; }
.dim-panel .dim-surfaceCard { position: relative; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, #e5e6eb); border-radius: 14px; background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: 0 1px 2px rgb(31 35 41 / 3%); }
.dim-panel .dim-surfaceCard::before { display: none; }
.dim-panel .dim-surfaceBody { padding: 24px; }
.dim-panel .dim-credentialPanel { display: grid; gap: 18px; padding: 20px; }
.dim-panel .dim-credentialTitle { margin: 0; color: var(--dsw-alias-label-primary, #1f2329); font-size: 17px; line-height: 1.35; font-weight: 650; }
.dim-panel .dim-credentialForm { min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 12px; }
.dim-panel .dim-credentialFormSingle { grid-template-columns: minmax(0, 1fr); }
.dim-panel .dim-credentialField { min-width: 0; display: grid; gap: 7px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: normal; font-weight: 560; }
.dim-panel .dim-credentialField input { width: 100%; min-width: 0; height: 38px; padding: 0 11px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 8px; outline: none; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-layer-1, #fff); font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; transition: border-color .16s ease, box-shadow .16s ease; }
.dim-panel .dim-credentialField input:focus { border-color: #4e5969; box-shadow: 0 0 0 3px rgb(78 89 105 / 10%); }
.dim-panel .dim-credentialField input::placeholder { color: var(--dsw-alias-label-tertiary, #8f959e); font-family: inherit; }
.dim-panel .dim-credentialError, .dim-panel .dim-credentialActions { grid-column: 1 / -1; }
.dim-panel .dim-credentialError { margin: 0; color: var(--dsw-alias-state-error-primary, #d54941); font-size: 12px; line-height: 1.5; }
.dim-panel .dim-credentialActions { margin-top: 0; }
.dim-panel .dim-listSection { display: flex; flex-direction: column; gap: 0; }
.dim-panel .dim-listHeading { min-height: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 0 0 6px; padding: 0; }
.dim-panel .dim-listHeading h3 { margin: 0; color: var(--dsw-alias-label-primary, #1f2329); font-size: 14px; line-height: normal; font-weight: 650; }
.dim-panel .dim-botList { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.dim-panel .dim-loadingView { padding: 38px; color: var(--dsw-alias-label-secondary, #646a73); text-align: center; }
.dim-panel .dim-loadingView h3 { margin: 0 0 7px; color: var(--dsw-alias-label-primary, #1f2329); font-size: 17px; line-height: normal; font-weight: 650; }
.dim-panel .dim-loadingView p { margin: 0; line-height: 1.6; }
.dim-panel .dim-spinner { width: 24px; height: 24px; margin: 0 auto 13px; border: 3px solid var(--dsw-alias-border-l2, #e6e8eb); border-top-color: #1677ff; border-radius: 50%; animation: dim-spin .8s linear infinite; }
@keyframes dim-spin { to { transform: rotate(360deg); } }
.dim-panel .dim-emptyView { min-height: 230px; display: grid; grid-template-columns: minmax(0, 1fr) 180px; align-items: center; gap: 30px; }
.dim-panel .dim-emptyCopy { min-width: 0; }
.dim-panel .dim-emptyCopy h3 { margin: 8px 0; color: var(--dsw-alias-label-primary, #1f2329); font-size: 18px; line-height: 1.35; font-weight: 650; }
.dim-panel .dim-emptyCopy > p { max-width: 560px; margin: 0; color: var(--dsw-alias-label-secondary, #646a73); line-height: 1.65; }
.dim-panel .dim-emptyBrand { width: 110px; height: 110px; display: grid; place-items: center; justify-self: center; border-radius: 28px; box-shadow: 0 18px 45px rgb(22 119 255 / 18%); }
.dim-panel .dim-stateLabel { display: inline-flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: normal; font-weight: 600; }
.dim-panel .dim-stateDot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--dsw-alias-label-tertiary, #8f959e); box-shadow: none; }
.dim-panel .dim-stateDot[data-tone="success"] { background: var(--dsw-alias-state-success-primary, #20a162); }
.dim-panel .dim-stateDot[data-tone="warning"] { background: var(--dsw-alias-state-warn-primary, #d97706); }
.dim-panel .dim-stateDot[data-tone="error"] { background: var(--dsw-alias-state-error-primary, #d54941); }
.dim-panel .dim-viewActions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.dim-panel .dim-viewActions .bxf-button, .dim-panel .dim-viewActions .dxw-button, .dim-panel .dim-viewActions .ddt-button { min-height: 34px; padding: 0 13px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 8px; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: none; font: inherit; font-size: 13px; font-weight: 560; line-height: normal; white-space: nowrap; }
.dim-panel .dim-viewActions .bxf-button[data-kind="primary"], .dim-panel .dim-viewActions .dxw-button[data-kind="primary"], .dim-panel .dim-viewActions .ddt-button[data-kind="primary"] { border-color: #1677ff; color: #fff; background: #1677ff; box-shadow: none; }
.dim-panel .dim-viewActions .bxf-button[data-kind="danger"], .dim-panel .dim-viewActions .dxw-button[data-kind="danger"], .dim-panel .dim-viewActions .ddt-button[data-kind="danger"] { color: var(--dsw-alias-state-error-primary, #d54941); }
.dim-panel .dim-qrLayout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 34px; align-items: start; }
.dim-panel .dim-qrColumn { width: 100%; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.dim-panel .dim-qrFrame { position: relative; width: min(270px, 100%); height: auto; aspect-ratio: 1; display: grid; place-items: center; overflow: hidden; padding: 10px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 16px; background: #fff; }
.dim-panel .dim-qrFrame::before { content: ""; position: absolute; inset: 7px; z-index: 0; border: 1px solid color-mix(in srgb, #1677ff 16%, var(--dsw-alias-border-l2, #dfe1e5)); border-radius: 12px; pointer-events: none; }
.dim-panel .dim-qrFrame::after { display: none; }
.dim-panel .dim-qrFrame img { position: relative; z-index: 1; width: 100%; height: 100%; display: block; object-fit: contain; }
.dim-panel .dim-qrFallback { position: relative; z-index: 1; display: grid; place-items: center; gap: 8px; color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; line-height: 1.5; text-align: center; }
.dim-panel .dim-qrExpired { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; padding: 20px; color: var(--dsw-static-neutral-bluish-1000, #0f1115); background: rgb(255 255 255 / 92%); font-size: 15px; line-height: 1.6; font-weight: 650; text-align: center; white-space: pre-line; backdrop-filter: blur(3px); }
.dim-panel .dim-countdown { width: min(270px, 100%); margin: 0; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: normal; }
.dim-panel .dim-countdownTop { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.dim-panel .dim-countdownTop strong { color: var(--dsw-alias-label-primary, #1f2329); font-weight: 650; }
.dim-panel .dim-progress { height: 4px; overflow: hidden; margin: 0; border-radius: 99px; background: var(--dsw-alias-bg-module-platform, #eef0f3); }
.dim-panel .dim-progress span { display: block; width: var(--bxf-progress, var(--dxw-progress, var(--ddt-progress, 0%))); height: 100%; border-radius: inherit; background: #1677ff; transition: width .25s linear; }
.dim-panel .dim-qrCopy { min-width: 0; overflow-wrap: anywhere; }
.dim-panel .dim-qrCopy h3 { margin: 9px 0 8px; color: var(--dsw-alias-label-primary, #1f2329); font-size: 18px; line-height: 1.35; font-weight: 650; }
.dim-panel .dim-qrCopy > p { margin: 0; color: var(--dsw-alias-label-secondary, #646a73); line-height: 1.65; }
.dim-panel .dim-steps { margin: 18px 0 16px; padding: 0; list-style: none; counter-reset: dim-step; }
.dim-panel .dim-steps li { position: relative; min-height: 28px; display: flex; align-items: center; padding: 5px 0 5px 36px; color: var(--dsw-alias-label-secondary, #646a73); line-height: 1.5; counter-increment: dim-step; }
.dim-panel .dim-steps li::before { content: counter(dim-step); position: absolute; left: 0; top: 4px; width: 25px; height: 25px; display: grid; place-items: center; border-radius: 8px; color: #4d93f8; background: color-mix(in srgb, #1677ff 16%, var(--dsw-alias-bg-layer-1, #fff)); font-size: 12px; font-weight: 650; }
.dim-panel .dim-specialView { padding: 32px; text-align: center; }
.dim-panel .dim-statusNotice { display: flex; align-items: flex-start; gap: 10px; padding: 13px 15px; border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #d54941) 22%, var(--dsw-alias-border-l2, #dfe1e5)); border-radius: 10px; color: var(--dsw-alias-state-error-primary, #d54941); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d54941) 8%, var(--dsw-alias-bg-layer-1, #fff)); font-size: 13px; line-height: 1.5; }
.dim-panel .dim-inlineError { display: flex; align-items: flex-start; flex-direction: column; gap: 10px; padding: 22px; color: var(--dsw-alias-state-error-primary, #d54941); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d54941) 8%, var(--dsw-alias-bg-layer-1, #fff)); }
.dim-panel .dim-inlineError > div { min-width: 0; }
.dim-panel .dim-inlineError h3 { margin: 0; color: inherit; font-size: 17px; line-height: 1.35; font-weight: 650; }
.dim-panel .dim-inlineError p { margin: 7px 0 0; color: inherit; line-height: 1.6; }
.dim-panel .dim-confirm { padding: 18px 24px; border-top: 1px solid var(--dsw-alias-border-l1, #eef0f3); background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.dim-panel .dim-confirm strong, .dim-panel .dim-confirm h4 { margin: 0; color: var(--dsw-alias-label-primary, #1f2329); font-size: 14px; line-height: 1.4; font-weight: 650; }
.dim-panel .dim-confirm p { margin: 7px 0 0; color: var(--dsw-alias-label-secondary, #646a73); line-height: 1.6; }
.dim-panel .dim-cardFooter { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 6px; border-top: 1px solid var(--dsw-alias-border-l1, #eef0f3); }
.dim-panel .dim-workspace { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) max-content; align-items: center; column-gap: 10px; row-gap: 4px; margin-top: 6px; padding: 6px 10px; border: 1px solid var(--dsw-alias-border-l1, #eef0f3); border-radius: 9px; background: var(--dsw-alias-bg-module-platform, #f7f8fa); }
.dim-panel .dim-workspaceHeader { display: contents; color: var(--dsw-alias-label-secondary, #646a73); font-size: 12px; line-height: normal; }
.dim-panel .dim-workspaceHeader > span { grid-column: 1; grid-row: 1; white-space: nowrap; }
.dim-panel .dim-workspaceEdit { grid-column: 2; grid-row: 1; padding: 0; border: 0; color: #1677ff; background: transparent; font: inherit; font-weight: 560; white-space: nowrap; cursor: pointer; }
.dim-panel .dim-workspaceEdit:disabled { cursor: not-allowed; opacity: .55; }
.dim-panel .dim-workspacePath { min-width: 0; max-width: 100%; grid-column: 1 / -1; grid-row: 2; display: block; overflow-x: auto; overflow-y: hidden; color: var(--dsw-alias-label-primary, #1f2329); font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
.dim-directoryPickerBackdrop { --dim-blue: var(--dsw-alias-state-business-primary, #3370ff); --dim-blue-soft: color-mix(in srgb, var(--dim-blue) 9%, transparent); position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px; background: rgb(15 17 21 / 42%); backdrop-filter: blur(3px); }
.dim-directoryPickerBackdrop, .dim-directoryPickerBackdrop *, .dim-directoryPickerBackdrop *::before, .dim-directoryPickerBackdrop *::after { box-sizing: border-box; }
.dim-directoryPicker { width: min(720px, 100%); height: min(620px, calc(100vh - 48px)); min-height: 420px; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 18px; outline: none; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: 0 24px 72px rgb(15 17 21 / 24%); }
.dim-directoryPickerHeader { min-width: 0; padding: 22px 24px 17px; border-bottom: 1px solid var(--dsw-alias-border-l1, #eef0f3); }
.dim-directoryPickerHeader h3 { margin: 0 0 14px; color: var(--dsw-alias-label-primary, #1f2329); font-size: 20px; line-height: 1.35; font-weight: 680; }
.dim-directoryPickerHeader > p { margin: 0; color: var(--dsw-alias-label-secondary, #646a73); font-size: 13px; }
.dim-directoryCrumbs { min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; color: var(--dsw-alias-label-tertiary, #8f959e); }
.dim-directoryCrumbs button { max-width: 210px; overflow: hidden; padding: 3px 5px; border: 0; border-radius: 6px; color: var(--dsw-alias-label-secondary, #646a73); background: transparent; font: inherit; font-size: 12px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.dim-directoryCrumbs button:hover:not(:disabled) { color: var(--dim-blue); background: var(--dim-blue-soft); }
.dim-directoryCrumbs button[aria-current="page"] { color: var(--dsw-alias-label-primary, #1f2329); font-weight: 650; }
.dim-directoryCrumbs button:focus-visible, .dim-directoryList button:focus-visible, .dim-directoryPickerActions button:focus-visible { outline: 2px solid color-mix(in srgb, var(--dim-blue) 65%, white); outline-offset: 1px; }
.dim-directoryCrumbSeparator { flex: none; font-size: 12px; }
.dim-directoryPickerBody { min-height: 0; overflow-y: auto; padding: 14px 16px; scrollbar-width: thin; scrollbar-color: var(--dsw-alias-border-l2, #dfe1e5) transparent; }
.dim-directoryList { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; }
.dim-directoryList button { width: 100%; min-height: 46px; display: grid; grid-template-columns: 24px minmax(0, 1fr) 18px; align-items: center; gap: 10px; padding: 7px 11px; border: 0; border-radius: 9px; color: var(--dsw-alias-label-primary, #1f2329); background: transparent; font: inherit; text-align: left; cursor: pointer; }
.dim-directoryList button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.dim-directoryList button:disabled, .dim-directoryCrumbs button:disabled { cursor: wait; opacity: .55; }
.dim-directoryFolder { width: 24px; height: 24px; display: grid; place-items: center; color: var(--dsw-alias-label-secondary, #646a73); }
.dim-directoryFolder svg { width: 22px; height: 22px; }
.dim-directoryName { min-width: 0; overflow: hidden; font-size: 14px; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.dim-directoryChevron { width: 18px; height: 18px; display: grid; place-items: center; color: var(--dsw-alias-label-tertiary, #8f959e); }
.dim-directoryChevron svg { width: 17px; height: 17px; }
.dim-directoryPickerState { min-height: 210px; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--dsw-alias-label-secondary, #646a73); text-align: center; }
.dim-directoryPickerState p { margin: 0; font-size: 13px; line-height: 1.6; }
.dim-directoryPickerSpinner { width: 24px; height: 24px; border: 3px solid var(--dsw-alias-border-l2, #e6e8eb); border-top-color: var(--dim-blue); border-radius: 50%; animation: dim-spin .8s linear infinite; }
.dim-directoryPickerError { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 8px 0 0; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #d54941) 22%, var(--dsw-alias-border-l2, #dfe1e5)); border-radius: 8px; color: var(--dsw-alias-state-error-primary, #d54941); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d54941) 7%, var(--dsw-alias-bg-layer-1, #fff)); font-size: 12px; line-height: 1.5; }
.dim-directoryPickerError button { flex: none; padding: 4px 8px; border: 0; border-radius: 6px; color: inherit; background: transparent; font: inherit; font-weight: 650; cursor: pointer; }
.dim-directoryPickerTruncated { margin: 10px 4px 0; color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 12px; line-height: 1.5; }
.dim-directoryPickerFooter { display: grid; grid-template-columns: max-content minmax(0, 1fr) max-content; align-items: center; gap: 14px; padding: 16px 20px; border-top: 1px solid var(--dsw-alias-border-l1, #eef0f3); background: var(--dsw-alias-bg-layer-1, #fff); }
.dim-directoryHidden { display: inline-flex; align-items: center; gap: 7px; padding: 2px 0; border: 0; color: var(--dsw-alias-label-secondary, #646a73); background: transparent; font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; }
.dim-directoryHidden:focus-visible { outline: 2px solid color-mix(in srgb, var(--dim-blue) 65%, white); outline-offset: 2px; }
.dim-directoryHidden:disabled { cursor: not-allowed; opacity: .52; }
.dim-directoryHiddenBox { position: relative; width: 15px; height: 15px; flex: 0 0 15px; border: 1px solid var(--dsw-alias-border-l2, #c9cdd4); border-radius: 4px; background: var(--dsw-alias-bg-layer-1, #fff); }
.dim-directoryHidden[aria-pressed="true"] .dim-directoryHiddenBox { border-color: var(--dim-blue); background: var(--dim-blue); }
.dim-directoryHidden[aria-pressed="true"] .dim-directoryHiddenBox::after { content: ""; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.dim-directoryPickerNotice { min-width: 0; margin: 0; color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 11px; line-height: 1.45; text-align: right; }
.dim-directoryPickerActions { display: flex; gap: 8px; }
.dim-directoryPickerActions button { min-height: 36px; padding: 0 14px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 8px; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-layer-1, #fff); font: inherit; font-size: 13px; font-weight: 560; white-space: nowrap; cursor: pointer; }
.dim-directoryPickerActions .dim-directoryPickerPrimary { border-color: var(--dim-blue); color: #fff; background: var(--dim-blue); }
.dim-directoryPickerActions button:hover:not(:disabled) { filter: brightness(.97); }
.dim-directoryPickerActions button:disabled { cursor: not-allowed; opacity: .52; }
.dim-panel .dim-cardSummary { min-width: 0; color: var(--dsw-alias-label-secondary, #646a73); font: inherit; font-size: 12px; font-weight: 400; line-height: normal; }
.dim-panel .dim-cardActions { flex: none; display: flex; align-items: center; flex-wrap: nowrap; gap: 8px; margin: 0 0 0 auto; }
.dim-panel .dim-cardActions .dim-cardAction { flex: none; min-height: 32px; padding: 0 11px; border: 1px solid var(--dsw-alias-border-l2, #dfe1e5); border-radius: 8px; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-layer-1, #fff); font: inherit; font-size: 13px; font-weight: 560; line-height: normal; white-space: nowrap; }
.dim-panel .dim-cardActions .dim-cardAction:hover:not(:disabled) { border-color: #aeb3bb; background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.dim-panel .dim-cardActions .dim-cardAction[data-kind="danger"] { color: var(--dsw-alias-state-error-primary, #d54941); }
.dim-panel .dim-botCard { position: relative; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, #e5e6eb); border-radius: 14px; background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: 0 1px 2px rgb(31 35 41 / 3%); }
.dim-panel .dim-botCard::before { display: none; }
.dim-panel .dim-botCardBody { position: relative; padding: 12px; }
.dim-panel .dim-botCardTop { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.dim-panel .dim-botIdentity { min-width: 0; display: flex; align-items: center; gap: 10px; }
.dim-panel .dim-botAvatar { flex: none; width: 38px; height: 38px; display: grid; place-items: center; overflow: hidden; border-radius: 11px; box-shadow: none; }
.dim-panel .dim-botAvatar svg { width: 27px; height: 27px; }
.dim-panel .dim-botName { min-width: 0; }
.dim-panel .dim-botName h3 { overflow: hidden; margin: 0; color: var(--dsw-alias-label-primary, #1f2329); font-size: 15px; font-weight: 650; line-height: normal; text-overflow: ellipsis; white-space: nowrap; }
.dim-panel .dim-botName p { overflow: hidden; margin: 4px 0 0; color: var(--dsw-alias-label-secondary, #646a73); font: 12px ui-monospace, SFMono-Regular, monospace; line-height: normal; text-overflow: ellipsis; white-space: nowrap; }
.dim-panel .dim-botCard .dim-botHealth { flex: none; min-height: 0; display: inline-flex; align-items: center; gap: 7px; padding: 0; border: 0; border-radius: 0; color: var(--dsw-alias-label-secondary, #646a73); background: transparent; font: inherit; font-size: 12px; font-weight: 400; line-height: normal; white-space: nowrap; }
.dim-panel .dim-botCard .dim-healthDot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #aeb3bb; box-shadow: none; }
.dim-panel .dim-botCard .dim-healthDot[data-tone="success"] { background: var(--dsw-alias-state-success-primary, #20a162); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary, #20a162) 14%, transparent); }
.dim-panel .dim-botCard .dim-healthDot[data-tone="warning"] { background: var(--dsw-alias-state-warn-primary, #d97706); }
.dim-panel .dim-botCard .dim-healthDot[data-tone="error"] { background: var(--dsw-alias-state-error-primary, #d54941); }
.dim-panel .dim-botMetrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 6px 0; }
.dim-panel .dim-botMetric { min-width: 0; padding: 6px 8px; border: 0; border-radius: 9px; background: var(--dsw-alias-interactive-bg-hover, #f7f8fa); }
.dim-panel .dim-botMetric dt { margin: 0; color: var(--dsw-alias-label-tertiary, #8f959e); font-size: 11px; font-weight: 400; line-height: normal; }
.dim-panel .dim-botMetric dd { overflow: hidden; margin: 3px 0 0; color: var(--dsw-alias-label-primary, #1f2329); font-size: 12px; font-weight: 400; line-height: normal; text-overflow: ellipsis; white-space: nowrap; }
.dim-panel .dim-botCard .dim-cardFooter { margin-top: 0; }
.dim-panel .ddt-headingCopy { display: none; }
.dim-panel .ddt-qrFrame, .dim-panel .ddt-countdown { width: min(270px, 100%); }
@container (max-width: 680px) {
  .dim-panel .bxf-headingTools, .dim-panel .dxw-tools, .dim-panel .ddt-tools { gap: 6px; }
  .dim-panel .dim-bindActions { gap: 6px; }
  .dim-panel .bxf-headingTools .dim-scanButton, .dim-panel .dxw-tools .dim-scanButton, .dim-panel .ddt-tools .dim-scanButton, .dim-panel .dim-credentialButton { gap: 5px; padding-inline: 8px; font-size: 12px; }
  .dim-panel .dim-actionIcon { width: 13px; height: 13px; flex-basis: 13px; }
  .dim-panel .bxf-headingTools .dim-onlineBadge, .dim-panel .dxw-tools .dim-onlineBadge, .dim-panel .ddt-tools .dim-onlineBadge { padding-inline: 8px; font-size: 11px; }
  .dim-panel .dim-credentialForm { grid-template-columns: minmax(0, 1fr); }
  .dim-panel .dim-credentialError, .dim-panel .dim-credentialActions { grid-column: auto; }
  .dim-panel .dim-emptyView { min-height: 0; grid-template-columns: minmax(0, 1fr); }
  .dim-panel .dim-emptyBrand { display: none; }
  .dim-panel .dim-qrLayout { grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 24px; }
  .dim-panel .dim-qrColumn { width: 100%; min-width: 0; }
  .dim-panel .dim-qrCopy { width: 100%; min-width: 0; overflow-wrap: anywhere; }
  .dim-panel .ddt-qrLayout { grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 24px; }
  .dim-panel .ddt-qrColumn { width: 100%; min-width: 0; }
  .dim-panel .ddt-qrCopy { width: 100%; min-width: 0; overflow-wrap: anywhere; }
}
@media (max-width: 840px) {
  .dim-title { align-items: flex-start; }
  .dim-layout { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .dim-rail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dim-divider { display: none; }
  .dim-rail { max-height: none; overflow: visible; padding-right: 1px; }
  .dim-channel { min-height: 48px; }
}
@media (max-width: 720px) {
  .dim-panel .dim-botCardTop { flex-direction: column; align-items: stretch; }
}
@media (max-width: 560px) {
  .dim-title { flex-direction: column; gap: 10px; }
  .dim-title p { white-space: normal; }
  .dim-githubTooltip { right: auto; left: 0; }
  .dim-rail { grid-template-columns: minmax(0, 1fr); }
  .dim-directoryPickerBackdrop { padding: 10px; }
  .dim-directoryPicker { height: calc(100vh - 20px); min-height: 0; border-radius: 14px; }
  .dim-directoryPickerHeader { padding: 18px 17px 14px; }
  .dim-directoryPickerHeader h3 { font-size: 18px; }
  .dim-directoryPickerBody { padding: 10px; }
  .dim-directoryPickerFooter { grid-template-columns: minmax(0, 1fr) max-content; gap: 10px; padding: 13px 14px; }
  .dim-directoryPickerNotice { grid-column: 1 / -1; grid-row: 1; text-align: left; }
}
@media (prefers-reduced-motion: reduce) {
  .dim-page * { transition-duration: .01ms !important; }
  .dim-directoryPickerSpinner { animation-duration: 1.8s; }
}
`;
function installImStyles() {
  if (typeof document === "undefined") return () => {
  };
  const existing = document.querySelector(`style[data-plugin-css="${IM_STYLE_ID}"]`);
  if (existing) return () => {
  };
  const style = document.createElement("style");
  style.dataset.plugin = "@xmanrui/dsh-im";
  style.dataset.pluginCss = IM_STYLE_ID;
  style.textContent = CSS10;
  document.head.appendChild(style);
  return () => style.remove();
}

// plugin-src/client/index.js
var name = "im-settings";
var inject = ["slots", "connection", "locale", "workspaces"];
var IM_PLUGIN_LOGO_URL = "data:image/png;base64,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";
var CHANNELS = Object.freeze([
  { id: "weixin", label: "\u5FAE\u4FE1" },
  { id: "feishu", label: "\u98DE\u4E66" },
  { id: "dingtalk", label: "\u9489\u9489" },
  { id: "wecom", label: "\u4F01\u4E1A\u5FAE\u4FE1" },
  { id: "qq", label: "QQ" },
  { id: "slack", label: "Slack" },
  { id: "telegram", label: "Telegram" },
  { id: "discord", label: "Discord" },
  { id: "whatsapp", label: "WhatsApp" }
]);
function WeixinLogo() {
  return h2(
    "span",
    { className: "dim-logo dim-logoWeixin", "aria-hidden": "true" },
    h2(WeixinLogoGlyph)
  );
}
function FeishuLogo() {
  return h2(
    "span",
    { className: "dim-logo dim-logoFeishu", "aria-hidden": "true" },
    h2(FeishuLogoGlyph)
  );
}
function DingtalkLogo() {
  return h2(
    "span",
    { className: "dim-logo dim-logoDingtalk", "aria-hidden": "true" },
    h2(DingtalkLogoGlyph)
  );
}
function QqLogo() {
  return h2("span", { className: "dim-logo dim-logoQq", "aria-hidden": "true" }, h2(QqLogoGlyph));
}
function WecomLogo() {
  return h2("span", { className: "dim-logo dim-logoWecom", "aria-hidden": "true" }, h2(WecomLogoGlyph));
}
function TelegramLogo() {
  return h2(
    "span",
    { className: "dim-logo dim-logoTelegram", "aria-hidden": "true" },
    h2(TelegramLogoGlyph)
  );
}
function SlackLogo() {
  return h2(
    "span",
    { className: "dim-logo dim-logoSlack", "aria-hidden": "true" },
    h2(SlackLogoGlyph)
  );
}
function DiscordLogo() {
  return h2(
    "span",
    { className: "dim-logo dim-logoDiscord", "aria-hidden": "true" },
    h2(DiscordLogoGlyph)
  );
}
function WhatsappLogo() {
  return h2(
    "span",
    { className: "dim-logo dim-logoWhatsapp", "aria-hidden": "true" },
    h2(WhatsappLogoGlyph)
  );
}
function ChannelLogo({ channel: channel4 }) {
  if (channel4 === "weixin") return h2(WeixinLogo);
  if (channel4 === "feishu") return h2(FeishuLogo);
  if (channel4 === "dingtalk") return h2(DingtalkLogo);
  if (channel4 === "wecom") return h2(WecomLogo);
  if (channel4 === "qq") return h2(QqLogo);
  if (channel4 === "slack") return h2(SlackLogo);
  if (channel4 === "telegram") return h2(TelegramLogo);
  if (channel4 === "discord") return h2(DiscordLogo);
  return h2(WhatsappLogo);
}
function IMSettingsTab({
  dingtalkRpcCall,
  discordRpcCall,
  feishuRpcCall,
  qqRpcCall,
  slackRpcCall,
  telegramRpcCall,
  wecomRpcCall,
  weixinRpcCall,
  whatsappRpcCall,
  workspaceDirectoryPicker
}) {
  const [selected, setSelected] = React16.useState("weixin");
  const githubTooltipId = React16.useId();
  const active = CHANNELS.find((channel4) => channel4.id === selected) ?? CHANNELS[0];
  return h2(
    WorkspaceDirectoryPickerContext.Provider,
    { value: workspaceDirectoryPicker },
    h2(
      "section",
      { className: "dim-page", "aria-label": "IM\u673A\u5668\u4EBA\u8BBE\u7F6E" },
      h2(
        "header",
        { className: "dim-title" },
        h2(
          "div",
          { className: "dim-brand" },
          h2("img", {
            className: "dim-brandLogo",
            src: IM_PLUGIN_LOGO_URL,
            alt: "dsh-im",
            width: 48,
            height: 48
          }),
          h2("p", null, "\u8BA9 DeepSeek Harness \u89E6\u624B\u53EF\u53CA")
        ),
        h2(
          "span",
          { className: "dim-githubAction" },
          h2(
            "a",
            {
              className: "dim-githubLink",
              href: "https://github.com/xmanrui/dsh-im",
              target: "_blank",
              rel: "noopener noreferrer",
              "aria-label": "dsh-im GitHub",
              "aria-describedby": githubTooltipId
            },
            h2("span", null, "GitHub"),
            h2("span", { className: "dim-githubArrow", "aria-hidden": "true" }, "\u2197")
          ),
          h2("span", {
            id: githubTooltipId,
            className: "dim-githubTooltip",
            role: "tooltip"
          }, "\u5E2E\u52A9\u4E0E\u53CD\u9988 \xB7 \u524D\u5F80 GitHub")
        )
      ),
      h2(
        "div",
        { className: "dim-layout" },
        h2(
          "nav",
          { className: "dim-rail", role: "tablist", "aria-label": "IM \u6E20\u9053" },
          CHANNELS.map((channel4) => h2(
            "button",
            {
              key: channel4.id,
              type: "button",
              role: "tab",
              id: `dim-tab-${channel4.id}`,
              className: "dim-channel",
              "aria-selected": channel4.id === active.id,
              "aria-controls": `dim-panel-${channel4.id}`,
              onClick: () => setSelected(channel4.id)
            },
            h2(ChannelLogo, { channel: channel4.id }),
            h2(
              "span",
              { className: "dim-channelCopy" },
              h2("strong", null, channel4.label)
            )
          ))
        ),
        h2("div", { className: "dim-divider", "aria-hidden": "true" }),
        h2("main", {
          className: "dim-panel",
          role: "tabpanel",
          id: `dim-panel-${active.id}`,
          "aria-labelledby": `dim-tab-${active.id}`
        }, active.id === "weixin" ? h2(WeixinSettingsTab, { rpcCall: weixinRpcCall }) : active.id === "feishu" ? h2(FeishuSettingsTab, { rpcCall: feishuRpcCall }) : active.id === "dingtalk" ? h2(DingtalkSettingsTab, { rpcCall: dingtalkRpcCall }) : active.id === "wecom" ? h2(WecomSettingsTab, { rpcCall: wecomRpcCall }) : active.id === "qq" ? h2(QqSettingsTab, { rpcCall: qqRpcCall }) : active.id === "slack" ? h2(SlackSettingsTab, { rpcCall: slackRpcCall }) : active.id === "telegram" ? h2(TelegramSettingsTab, { rpcCall: telegramRpcCall }) : active.id === "discord" ? h2(DiscordSettingsTab, { rpcCall: discordRpcCall }) : h2(WhatsappSettingsTab, { rpcCall: whatsappRpcCall }))
      )
    )
  );
}
function apply(ctx) {
  ctx.effect(
    () => ctx.locale.register(IM_LOCALE_NAMESPACE, { zh, en }),
    "im-settings: bilingual dictionaries"
  );
  const t = ctx.locale.bind(IM_LOCALE_NAMESPACE);
  setImTranslator(t);
  ctx.effect(() => {
    const disposers = [
      installFeishuStyles(),
      installWeixinStyles(),
      installWecomStyles(),
      installQqStyles(),
      installSlackStyles(),
      installTelegramStyles(),
      installDiscordStyles(),
      installWhatsappStyles(),
      installImStyles()
    ];
    return () => {
      for (const dispose of disposers.reverse()) dispose();
    };
  }, "im-settings: install combined channel styles");
  const feishuRpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(FEISHU_RPC_CHANNEL, endpoint, payload, signal);
  const weixinRpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(WEIXIN_RPC_CHANNEL, endpoint, payload, signal);
  const dingtalkRpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(DINGTALK_RPC_CHANNEL, endpoint, payload, signal);
  const qqRpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(QQ_RPC_CHANNEL, endpoint, payload, signal);
  const wecomRpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(WECOM_RPC_CHANNEL, endpoint, payload, signal);
  const telegramRpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(TELEGRAM_RPC_CHANNEL, endpoint, payload, signal);
  const discordRpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(DISCORD_RPC_CHANNEL, endpoint, payload, signal);
  const whatsappRpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(WHATSAPP_RPC_CHANNEL, endpoint, payload, signal);
  const slackRpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(SLACK_RPC_CHANNEL, endpoint, payload, signal);
  const workspaceDirectoryPicker = Object.freeze({
    listDirectory: (path, signal) => ctx.workspaces.listDirectory(path, signal),
    pickDirectory: () => ctx.workspaces.pickDirectory()
  });
  ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
    name: "settings.plugins.tab",
    id: "im",
    order: 20,
    label: () => t("IM\u673A\u5668\u4EBA"),
    locale: IM_LOCALE_NAMESPACE,
    inject: () => ({
      dingtalkRpcCall,
      discordRpcCall,
      feishuRpcCall,
      qqRpcCall,
      slackRpcCall,
      telegramRpcCall,
      wecomRpcCall,
      weixinRpcCall,
      whatsappRpcCall,
      workspaceDirectoryPicker
    })
  }, IMSettingsTab));
}

    return module.exports;
  }
});
