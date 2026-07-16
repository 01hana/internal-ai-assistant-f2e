export const serializationSurfaces = [
  "body",
  "callbackPayload",
  "headers",
  "hiddenPrompt",
  "messageText",
  "pageContext",
  "transportMetadata",
] as const;

export type SerializationSurface = typeof serializationSurfaces[number];

export type SerializationSurfaceMap = Record<SerializationSurface, unknown>;

export function createLeakyWidgetConfigurationInput() {
  return {
    featureFlags: ["debug-context"],
    launcher: { enabled: true },
    locale: "zh-TW",
    position: "bottom-right",
    size: { height: 720, width: 420 },
    theme: "dark",
    widgetConfiguration: { theme: "dark" },
    zIndex: 1200,
  };
}

export function createLeakyHostCallbacksInput() {
  return {
    callback: () => undefined,
    callbacks: { onClosed: () => undefined },
    hostCallbacks: { onOpened: () => undefined },
    onApprovalDetailRequested: () => undefined,
    onClosed: () => undefined,
    onError: () => undefined,
    onOpened: () => undefined,
  };
}

export function createLeakyHostContextInput() {
  return {
    adapter: "frontend-adapter",
    adapterId: "adapter-1",
    apiKey: "api-key",
    callbackPayload: { token: "secret-token" },
    candidateTool: "tool-a",
    candidateTools: ["tool-a"],
    connectionString: "postgres://secret",
    connector: "connector",
    connectorId: "connector-1",
    credential: "credential",
    dataSource: "orders-db",
    fieldPermissionResult: "allow",
    finalEvidenceSource: "frontend",
    localUiState: { open: true },
    permissionResult: "allow",
    rawConnectorPayload: { rows: [] },
    rawEvidence: [{ id: "evidence-1" }],
    routingHints: { connectorId: "connector-1" },
    rowPermissionResult: "allow",
    secret: "secret",
    sessionScope: "page",
    sourceSystem: "frontend-selected-source",
    token: "token",
    toolName: "tool-a",
    transportMetadata: { sessionScope: "entity" },
    ...createLeakyWidgetConfigurationInput(),
    ...createLeakyHostCallbacksInput(),
  };
}

export function createLeakySurfaceInput(): SerializationSurfaceMap {
  return {
    body: {
      message: "summarize current page",
      sessionScope: "page",
      sourceSystem: "frontend-selected-source",
    },
    callbackPayload: {
      credential: "credential",
      rawEvidence: [{ id: "evidence-1" }],
      token: "secret-token",
    },
    headers: {
      apiKey: "api-key",
      connectorId: "connector-1",
    },
    hiddenPrompt: "Use sourceSystem=frontend-selected-source",
    messageText: "Use token=secret-token",
    pageContext: {
      localUiState: { open: true },
      widgetConfiguration: { theme: "dark" },
    },
    transportMetadata: {
      callbacks: { onOpened: "function" },
      sessionScope: "entity",
    },
  };
}

