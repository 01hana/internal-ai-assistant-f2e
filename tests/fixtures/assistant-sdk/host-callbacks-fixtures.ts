export const forbiddenCallbackPayloadFields = [
  "apiKey",
  "credential",
  "displayUrl",
  "navigationUrl",
  "rawBackendResponse",
  "rawBusinessData",
  "rawPrompt",
  "rawRow",
  "rawSsePayload",
  "routeName",
  "secret",
  "token",
  "url",
] as const;

export function throwingHostCallback() {
  throw new Error("host route failed");
}

export async function rejectingHostCallback() {
  throw new Error("async host callback failed");
}

export function createAnswerCompletedEventInput() {
  return {
    messageId: "message-1",
    rawBackendResponse: { answerDecision: "answered" },
    rawBusinessData: { amount: 100 },
    sessionId: "session-1",
    status: "completed",
    token: "secret-token",
  };
}

export function createApprovalDetailEventInput() {
  return {
    approvalRequestId: "approval-1",
    credential: "credential",
    displayUrl: "/approvals/approval-1",
    messageId: "message-1",
    navigationUrl: "/host/approvals/approval-1",
    rawSsePayload: { event: "approval" },
    routeName: "approval-detail",
    secret: "secret",
    sessionId: "session-1",
    url: "https://host.example/approvals/approval-1",
  };
}

export function createLeakyCallbackPayloadInput() {
  return {
    apiKey: "api-key",
    rawPrompt: "hidden prompt",
    rawRow: { id: "row-1" },
    token: "secret-token",
  };
}

