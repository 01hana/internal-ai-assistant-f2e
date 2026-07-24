import type { ApprovalRequestId, AssistantMessageId, AssistantRequestId, AssistantSessionId, EvidenceRefId, IsoDateTime } from "../types";
export type ApprovalRequestStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";
export type ApprovalRequestRiskLevel = "high" | "critical";
export type ApprovalRequestDetailLoadStatus = "idle" | "loading" | "available" | "unavailable";
export type ApprovalRequestOpenDetailStatus = "idle" | "opening" | "failed";
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
export type OpenApprovalDetailHandler = (payload: OpenApprovalDetailPayload) => void;
export interface ApprovalSummaryRow {
    key: string;
    label: string;
    value: string;
}
export declare function normalizeApprovalSummaryRows(summary: Record<string, unknown> | undefined): ApprovalSummaryRow[];
export declare function createDefaultApprovalRequestState(approvalRequestId: ApprovalRequestId): ApprovalRequestDetailState;
export declare function mergeApprovalRequestState(currentState: ApprovalRequestDetailState, nextState: Partial<ApprovalRequestDetailState>): ApprovalRequestDetailState;
export declare function createApprovalRequestLinkState(options: {
    messageId?: AssistantMessageId;
    requestId?: AssistantRequestId;
    sessionId?: AssistantSessionId | null;
}): Partial<ApprovalRequestDetailState>;
export declare function startApprovalRequestDetailLoadState(currentState: ApprovalRequestDetailState): ApprovalRequestDetailState;
export declare function completeApprovalRequestDetailLoadState(currentState: ApprovalRequestDetailState, detail: ApprovalRequestSummary): ApprovalRequestDetailState;
export declare function failApprovalRequestDetailLoadState(currentState: ApprovalRequestDetailState, safeMessage: string): ApprovalRequestDetailState;
export declare function startApprovalRequestOpenDetailState(currentState: ApprovalRequestDetailState): ApprovalRequestDetailState;
export declare function completeApprovalRequestOpenDetailState(currentState: ApprovalRequestDetailState): ApprovalRequestDetailState;
export declare function failApprovalRequestOpenDetailState(currentState: ApprovalRequestDetailState, safeMessage: string): ApprovalRequestDetailState;
export declare function createOpenApprovalDetailPayload(state: Pick<ApprovalRequestDetailState, "approvalRequestId" | "requestId" | "messageId" | "sessionId">): OpenApprovalDetailPayload;
export declare function getApprovalRequestStatusLabel(status: ApprovalRequestStatus | null | undefined): string | null;
export declare function getApprovalRiskLabel(riskLevel: ApprovalRequestRiskLevel | null | undefined): string | null;
