import {
  forbiddenOutgoingFields,
  localOnlyFields,
  secretLikeFields,
} from "./forbidden-fields";

export const forbiddenRequestBuilderFields = [
  ...localOnlyFields,
  ...secretLikeFields,
  ...forbiddenOutgoingFields,
  "apiKey",
  "connectionString",
  "hostContext",
  "integrationMode",
  "onApprovalDetailRequested",
  "onClosed",
  "onError",
  "onOpened",
  "hiddenPrompt",
] as const;

export function createSafePageContext() {
  return {
    entityId: "order-001",
    entityType: "order",
    route: "/orders/001",
    screenId: "order-detail",
    selectedRows: [
      {
        id: "order-001",
        label: "SO-001",
        selected: true,
        total: 1200,
      },
    ],
  };
}

export function createCompleteHostContext() {
  return {
    actorId: "actor-001",
    correlation: {
      requestId: "request-001",
    },
    hostApp: "erp",
    organizationId: "org-001",
    pageContext: createSafePageContext(),
    requestId: "request-001",
    sessionId: "session-001",
  };
}

export function createMissingBackend002HostContext() {
  return {
    hostApp: "erp",
    pageContext: createSafePageContext(),
  };
}

export function createLeakyHostContext() {
  return {
    ...createCompleteHostContext(),
    callbacks: { onOpened: () => undefined },
    connectorId: "connector-001",
    hostCallbacks: { onError: () => undefined },
    localUiState: { open: true },
    permissionResult: "allow",
    sessionScope: "entity",
    sourceSystem: "frontend-selected-source",
    token: "secret-token",
    widgetConfiguration: { theme: "dark" },
  };
}

export function createBackend001RequestBuilderInput() {
  return {
    hostContext: createLeakyHostContext(),
    integrationMode: "backend001-compatibility",
    message: "Summarize this order",
    operation: "send",
    sessionId: "session-001",
    widgetConfiguration: {
      locale: "zh-TW",
      position: "bottom-right",
      theme: "dark",
    },
  };
}

export function createBackend002RequestBuilderInput() {
  return {
    hostContext: createCompleteHostContext(),
    integrationMode: "backend002",
    message: "Summarize this order",
    operation: "send",
    sessionId: "session-001",
  };
}

export function createBackend002MissingContextInput() {
  return {
    hostContext: createMissingBackend002HostContext(),
    integrationMode: "backend002",
    message: "Summarize this order",
    operation: "send",
  };
}

export function createBackend002ForbiddenAuthorityInput(field: string) {
  return {
    ...createBackend002RequestBuilderInput(),
    hostContext: {
      ...createCompleteHostContext(),
      [field]: "frontend-owned-value",
    },
  };
}
