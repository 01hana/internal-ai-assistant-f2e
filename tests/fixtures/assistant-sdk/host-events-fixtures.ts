export const hostEventNames = [
  "opened",
  "closed",
  "session-created",
  "session-changed",
  "answer-completed",
  "error",
  "approval-detail-requested",
  "escalation-requested",
  "context-resolution-failed",
] as const;

export const hostEventCallbackMap = {
  opened: "onOpened",
  closed: "onClosed",
  "session-created": "onSessionCreated",
  "session-changed": "onSessionChanged",
  "answer-completed": "onAnswerCompleted",
  error: "onErrorOccurred",
  "approval-detail-requested": "onApprovalDetailRequested",
  "escalation-requested": "onEscalationRequested",
  "context-resolution-failed": "onContextResolutionFailed",
} as const;

export const hostEventAllowedFields = {
  opened: ["sessionId"],
  closed: ["sessionId"],
  "session-created": ["sessionId"],
  "session-changed": ["sessionId"],
  "answer-completed": ["messageId", "sessionId", "status"],
  error: ["error", "messageId", "requestId", "sessionId"],
  "approval-detail-requested": ["approvalRequestId", "messageId", "sessionId"],
  "escalation-requested": ["escalationRequestId", "messageId", "sessionId"],
  "context-resolution-failed": ["error", "requestId", "sessionId"],
} as const;

export const forbiddenHostEventPayloadFields = [
  "apiKey",
  "credential",
  "displayUrl",
  "hostContext",
  "navigationUrl",
  "pageContext",
  "rawBackendResponse",
  "rawBusinessData",
  "rawPrompt",
  "rawRow",
  "rawSsePayload",
  "routeName",
  "secret",
  "selectedRows",
  "sessionScope",
  "token",
  "url",
  "widgetConfiguration",
] as const;

export function createLeakyHostEventPayload() {
  return {
    approvalRequestId: "approval-001",
    apiKey: "api-key",
    credential: "credential",
    displayUrl: "/approval/approval-001",
    error: {
      code: "backend_error",
      rawBackendResponse: { traceId: "trace-001" },
    },
    escalationRequestId: "escalation-001",
    hostContext: { hostApp: "erp", organizationId: "org-001" },
    messageId: "message-001",
    navigationUrl: "/host/approval/approval-001",
    pageContext: { selectedRows: [{ id: "raw-row-001", amount: 1000 }] },
    rawBackendResponse: { answerDecision: "answered" },
    rawBusinessData: { amount: 1000 },
    rawPrompt: "hidden prompt",
    rawRow: { id: "raw-row-001" },
    rawSsePayload: { event: "final" },
    requestId: "request-001",
    routeName: "approval-detail",
    secret: "secret",
    selectedRows: [{ id: "raw-row-001", amount: 1000 }],
    sessionId: "session-001",
    sessionScope: "entity",
    status: "completed",
    token: "secret-token",
    url: "https://host.example/approval/approval-001",
    widgetConfiguration: { theme: "dark" },
  };
}

export function createHostEventCallbacks() {
  return {
    onAnswerCompleted: () => undefined,
    onApprovalDetailRequested: () => undefined,
    onClosed: () => undefined,
    onContextResolutionFailed: () => undefined,
    onErrorOccurred: () => undefined,
    onEscalationRequested: () => undefined,
    onOpened: () => undefined,
    onSessionChanged: () => undefined,
    onSessionCreated: () => undefined,
  };
}

export function createThrowingHostEventCallbacks() {
  return {
    ...createHostEventCallbacks(),
    onOpened: () => {
      throw new Error("host callback failed");
    },
  };
}
