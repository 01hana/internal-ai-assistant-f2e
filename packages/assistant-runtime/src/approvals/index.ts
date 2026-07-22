import type {
  ApprovalRequestId,
  AssistantMessageId,
  AssistantRequestId,
  AssistantSessionId,
  EvidenceRefId,
  IsoDateTime,
} from "../types";

export type ApprovalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired";

export type ApprovalRequestRiskLevel = "high" | "critical";

export type ApprovalRequestDetailLoadStatus =
  | "idle"
  | "loading"
  | "available"
  | "unavailable";

export type ApprovalRequestOpenDetailStatus =
  | "idle"
  | "opening"
  | "failed";

export interface ApprovalRequestSummary {
  approvalRequestId: ApprovalRequestId;
  requestId: AssistantRequestId;
  sessionId?: AssistantSessionId | null;
  messageId: AssistantMessageId;
  status: ApprovalRequestStatus;
  riskLevel: ApprovalRequestRiskLevel;
  requesterActorId: string;
  approverActorId?: string | null;
  actionSummary?: Record<string, unknown>;
  payloadSummary?: Record<string, unknown>;
  expiresAt?: IsoDateTime | null;
  evidenceRefIds?: EvidenceRefId[];
}

export interface ApprovalRequestDetailState {
  approvalRequestId: ApprovalRequestId;
  detailStatus: ApprovalRequestDetailLoadStatus;
  openDetailStatus: ApprovalRequestOpenDetailStatus;
  requestId?: AssistantRequestId;
  messageId?: AssistantMessageId;
  sessionId?: AssistantSessionId | null;
  status?: ApprovalRequestStatus;
  riskLevel?: ApprovalRequestRiskLevel;
  actionSummary?: Record<string, unknown>;
  payloadSummary?: Record<string, unknown>;
  expiresAt?: IsoDateTime | null;
  evidenceRefIds?: EvidenceRefId[];
  safeMessage?: string | null;
  openDetailSafeMessage?: string | null;
}

export interface OpenApprovalDetailPayload {
  approvalRequestId: ApprovalRequestId;
  requestId?: AssistantRequestId;
  messageId?: AssistantMessageId;
  sessionId?: AssistantSessionId;
}

export type OpenApprovalDetailHandler = (
  payload: OpenApprovalDetailPayload,
) => void;

export interface ApprovalSummaryRow {
  key: string;
  label: string;
  value: string;
}

type SafeSummaryValue = string | number | boolean | null;

function isSafeSummaryValue(value: unknown): value is SafeSummaryValue {
  return (
    typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
    || value === null
  );
}

function sanitizeSummary(
  summary: Record<string, unknown> | undefined,
): Record<string, SafeSummaryValue> | undefined {
  if (!summary) {
    return undefined;
  }

  const safeSummary: Record<string, SafeSummaryValue> = {};

  for (const [key, value] of Object.entries(summary)) {
    if (isSafeSummaryValue(value)) {
      safeSummary[key] = value;
    }
  }

  return Object.keys(safeSummary).length > 0 ? safeSummary : undefined;
}

export function normalizeApprovalSummaryRows(
  summary: Record<string, unknown> | undefined,
): ApprovalSummaryRow[] {
  const safeSummary = sanitizeSummary(summary);

  if (!safeSummary) {
    return [];
  }

  return Object.entries(safeSummary).map(([key, value]) => ({
    key,
    label: key,
    value: value === null ? "null" : String(value),
  }));
}

export function createDefaultApprovalRequestState(
  approvalRequestId: ApprovalRequestId,
): ApprovalRequestDetailState {
  return {
    approvalRequestId,
    detailStatus: "idle",
    openDetailStatus: "idle",
  };
}

export function mergeApprovalRequestState(
  currentState: ApprovalRequestDetailState,
  nextState: Partial<ApprovalRequestDetailState>,
): ApprovalRequestDetailState {
  return {
    ...currentState,
    ...nextState,
  };
}

export function createApprovalRequestLinkState(options: {
  messageId?: AssistantMessageId;
  requestId?: AssistantRequestId;
  sessionId?: AssistantSessionId | null;
}): Partial<ApprovalRequestDetailState> {
  const nextState: Partial<ApprovalRequestDetailState> = {};

  if (options.requestId !== undefined) {
    nextState.requestId = options.requestId;
  }

  if (options.messageId !== undefined) {
    nextState.messageId = options.messageId;
  }

  if (options.sessionId !== undefined) {
    nextState.sessionId = options.sessionId;
  }

  return nextState;
}

export function startApprovalRequestDetailLoadState(
  currentState: ApprovalRequestDetailState,
): ApprovalRequestDetailState {
  return {
    ...currentState,
    detailStatus: "loading",
    safeMessage: null,
  };
}

export function completeApprovalRequestDetailLoadState(
  currentState: ApprovalRequestDetailState,
  detail: ApprovalRequestSummary,
): ApprovalRequestDetailState {
  return {
    ...currentState,
    detailStatus: "available",
    requestId: detail.requestId,
    messageId: detail.messageId,
    sessionId: detail.sessionId ?? null,
    status: detail.status,
    riskLevel: detail.riskLevel,
    actionSummary: sanitizeSummary(detail.actionSummary),
    payloadSummary: sanitizeSummary(detail.payloadSummary),
    expiresAt: detail.expiresAt,
    evidenceRefIds: detail.evidenceRefIds,
    safeMessage: null,
  };
}

export function failApprovalRequestDetailLoadState(
  currentState: ApprovalRequestDetailState,
  safeMessage: string,
): ApprovalRequestDetailState {
  return {
    ...currentState,
    detailStatus: "unavailable",
    safeMessage,
  };
}

export function startApprovalRequestOpenDetailState(
  currentState: ApprovalRequestDetailState,
): ApprovalRequestDetailState {
  return {
    ...currentState,
    openDetailStatus: "opening",
    openDetailSafeMessage: null,
  };
}

export function completeApprovalRequestOpenDetailState(
  currentState: ApprovalRequestDetailState,
): ApprovalRequestDetailState {
  return {
    ...currentState,
    openDetailStatus: "idle",
    openDetailSafeMessage: null,
  };
}

export function failApprovalRequestOpenDetailState(
  currentState: ApprovalRequestDetailState,
  safeMessage: string,
): ApprovalRequestDetailState {
  return {
    ...currentState,
    openDetailStatus: "failed",
    openDetailSafeMessage: safeMessage,
  };
}

export function createOpenApprovalDetailPayload(
  state: Pick<
    ApprovalRequestDetailState,
    "approvalRequestId" | "requestId" | "messageId" | "sessionId"
  >,
): OpenApprovalDetailPayload {
  return {
    approvalRequestId: state.approvalRequestId,
    requestId: state.requestId,
    messageId: state.messageId,
    sessionId: state.sessionId ?? undefined,
  };
}

export function getApprovalRequestStatusLabel(
  status: ApprovalRequestStatus | null | undefined,
): string | null {
  switch (status) {
    case "pending":
      return "待處理";
    case "approved":
      return "已處理";
    case "rejected":
      return "未通過";
    case "cancelled":
      return "已停止";
    case "expired":
      return "已過期";
    default:
      return null;
  }
}

export function getApprovalRiskLabel(
  riskLevel: ApprovalRequestRiskLevel | null | undefined,
): string | null {
  switch (riskLevel) {
    case "high":
      return "高";
    case "critical":
      return "重大";
    default:
      return null;
  }
}
