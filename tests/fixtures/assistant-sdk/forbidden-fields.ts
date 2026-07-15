export const forbiddenOutgoingFields = [
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
  "token",
  "accessToken",
  "refreshToken",
  "credential",
  "secret",
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

export const secretLikeFields = [
  "token",
  "accessToken",
  "refreshToken",
  "credential",
  "secret",
] as const;

export const runtimePayloadNames = [
  "payload",
  "request",
  "outgoing",
  "body",
  "headers",
  "metadata",
  "transportMetadata",
] as const;
