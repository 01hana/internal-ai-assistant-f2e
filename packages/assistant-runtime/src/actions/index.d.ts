import type { ActionDraftId, AssistantMessageId, AssistantRequestId, IsoDateTime } from "../types";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ActionDraftRiskLevel = "medium";
export type ActionDraftPreview = Record<string, unknown>;
export type ActionDraftStatus = "draft" | "waiting_confirmation" | "confirmed" | "executed" | "cancelled" | "expired" | "failed";
export interface ActionDraftSummary {
    actionDraftId: ActionDraftId;
    requestId: AssistantRequestId;
    messageId: AssistantMessageId | null;
    status: ActionDraftStatus;
    riskLevel: ActionDraftRiskLevel;
    toolName: string;
    resource: string;
    operation: string;
    preview?: ActionDraftPreview;
    expiresAt?: IsoDateTime | null;
}
export type ActionDraftDetail = ActionDraftSummary;
export interface ActionDraftConfirmRequest {
    idempotencyKey?: string;
}
export type ConfirmActionDraftRequest = ActionDraftConfirmRequest;
export interface ActionDraftRecheck {
    organizationBoundary: "passed";
    draftStatus: "passed";
    freshness: "passed";
    permission: "pending_execution_guard";
    toolContract: "pending_execution_guard";
    idempotency: "reserved" | "duplicate";
}
export interface ActionDraftConfirmResult {
    actionDraftId: ActionDraftId;
    status: ActionDraftStatus;
    duplicateSafe: boolean;
    recheck: ActionDraftRecheck;
}
export type ActionDraftExecutionResult = ActionDraftConfirmResult;
export interface ActionDraftCancelResult {
    actionDraftId: ActionDraftId;
    status: ActionDraftStatus;
}
export type ActionDraftOperationStatus = "idle" | "confirming" | "cancelling" | "pending_execution_guard" | "submitted" | "executed" | "cancelled" | "expired" | "failed";
export interface ActionDraftConfirmationState {
    actionDraftId: ActionDraftId;
    operationStatus: ActionDraftOperationStatus;
    actionDraftStatus?: ActionDraftStatus;
    idempotencyKey?: string | null;
    recheck?: ActionDraftRecheck;
    safeMessage?: string;
}
export type ActionDraftDetailLoadStatus = "idle" | "loading" | "available" | "unavailable";
export interface ActionDraftDetailState extends ActionDraftConfirmationState {
    detailStatus: ActionDraftDetailLoadStatus;
    requestId?: AssistantRequestId;
    messageId?: AssistantMessageId | null;
    detail?: ActionDraftDetail;
}
export declare const ACTION_DRAFT_PENDING_GUARD_MESSAGE = "\u5DF2\u9001\u51FA\u78BA\u8A8D\uFF0C\u7CFB\u7D71\u4ECD\u5728\u8655\u7406\uFF0C\u8ACB\u52FF\u91CD\u8907\u64CD\u4F5C\u3002";
export interface ActionDraftOperationInput {
    actionDraftId: ActionDraftId;
    idempotencyKey?: string | null;
}
export declare function createActionDraftOperationInput(input: {
    actionDraftId: ActionDraftId | null | undefined;
    idempotencyKey?: string | null;
}): ActionDraftOperationInput | null;
export declare function hasPendingExecutionGuard(recheck?: ActionDraftRecheck): boolean;
export declare function mapActionDraftOperationStatus(nextStatus: ActionDraftStatus, recheck?: ActionDraftRecheck): ActionDraftOperationStatus;
export declare function createDefaultActionDraftState(actionDraftId: ActionDraftId): ActionDraftDetailState;
export declare function startActionDraftDetailLoadState(currentState: ActionDraftDetailState, options?: {
    messageId?: AssistantMessageId | null;
    requestId?: AssistantRequestId;
}): ActionDraftDetailState;
export declare function completeActionDraftDetailLoadState(currentState: ActionDraftDetailState, detail: ActionDraftDetail): ActionDraftDetailState;
export declare function failActionDraftDetailLoadState(currentState: ActionDraftDetailState, safeMessage: string): ActionDraftDetailState;
export declare function setActionDraftOperationState(currentState: ActionDraftDetailState, operationStatus: ActionDraftOperationStatus, options?: {
    idempotencyKey?: string | null;
    safeMessage?: string;
}): ActionDraftDetailState;
export declare function completeActionDraftOperationState(currentState: ActionDraftDetailState, nextStatus: ActionDraftStatus, options?: {
    recheck?: ActionDraftRecheck;
    idempotencyKey?: string | null;
}): ActionDraftDetailState;
export declare function failActionDraftOperationState(currentState: ActionDraftDetailState, safeMessage: string, operationStatus?: Extract<ActionDraftOperationStatus, "failed">): ActionDraftDetailState;
