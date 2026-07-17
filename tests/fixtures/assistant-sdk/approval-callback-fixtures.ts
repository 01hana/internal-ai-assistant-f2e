export const approvalCallbackAllowedFields = [
  "approvalRequestId",
  "messageId",
  "sessionId",
] as const;

export const forbiddenApprovalCallbackFields = [
  "credential",
  "displayUrl",
  "hostContext",
  "navigationUrl",
  "pageContext",
  "rawActionDraft",
  "rawApprovalRequest",
  "routeName",
  "secret",
  "selectedRows",
  "token",
  "url",
] as const;

export function createLeakyApprovalDetailInput() {
  return {
    approvalRequestId: "approval-001",
    credential: "credential",
    displayUrl: "/approval/approval-001",
    hostContext: { hostApp: "erp" },
    messageId: "message-001",
    navigationUrl: "/host/approval/approval-001",
    pageContext: { entityId: "order-001" },
    rawActionDraft: { action: "approve" },
    rawApprovalRequest: { id: "approval-001", internalState: "pending" },
    routeName: "approval-detail",
    secret: "secret",
    selectedRows: [{ id: "row-001" }],
    sessionId: "session-001",
    token: "secret-token",
    url: "https://host.example/approval/approval-001",
  };
}

export function createThrowingApprovalCallback() {
  return () => {
    throw new Error("host approval route failed");
  };
}

