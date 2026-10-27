export const backendAuthorityFields = [
  "sourceSystem",
  "connector",
  "connectorId",
  "adapter",
  "adapterId",
  "dataSource",
  "candidateTool",
  "candidateTools",
  "toolName",
  "permissionResult",
  "fieldPermissionResult",
  "rowPermissionResult",
  "finalEvidenceSource",
  "rawEvidence",
  "rawConnectorPayload",
  "routingHint",
  "routingHints",
  "approvalNavigation",
  "approvalNavigationMetadata",
  "navigationUrl",
  "approvalUrl",
] as const;

export const secretLikeFields = [
  "token",
  "accessToken",
  "refreshToken",
  "credential",
  "secret",
] as const;

export const forbiddenOutgoingFields = [
  ...backendAuthorityFields,
  ...secretLikeFields,
] as const;

export const localOnlyFields = [
  "sessionScope",
  "widgetConfiguration",
  "hostCallbacks",
  "hostEvents",
  "localUiState",
  "transportMetadata",
  "callback",
  "callbacks",
] as const;

export const runtimePayloadNames = [
  "payload",
  "request",
  "outgoing",
  "body",
  "headers",
  "metadata",
  "transportMetadata",
  "pageContext",
  "hostContext",
  "providerContext",
  "callbackPayload",
  "url",
  "query",
  "hash",
  "message",
  "messageText",
  "hiddenPrompt",
  "routingMetadata",
  "logPayload",
  "telemetryPayload",
  "persistencePayload",
  "requestInit",
] as const;

export const credentialSinkObjectNames = [
  "console",
  "logger",
  "telemetry",
  "analytics",
  "localStorage",
  "sessionStorage",
  "indexedDB",
] as const;

export const credentialSinkCallNames = [
  "fetch",
  "stringify",
  "setItem",
  "track",
  "capture",
  "log",
  "debug",
  "info",
  "warn",
  "error",
  "append",
  "set",
  "put",
  "URL",
  "URLSearchParams",
] as const;
