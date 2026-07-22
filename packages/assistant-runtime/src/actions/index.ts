import type {
  ActionDraftId,
  AssistantMessageId,
  AssistantRequestId,
  IsoDateTime,
} from "../types";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ActionDraftRiskLevel = "medium";
export type ActionDraftPreview = Record<string, unknown>;

export type ActionDraftStatus =
  | "draft"
  | "waiting_confirmation"
  | "confirmed"
  | "executed"
  | "cancelled"
  | "expired"
  | "failed";

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

export type ActionDraftOperationStatus =
  | "idle"
  | "confirming"
  | "cancelling"
  | "pending_execution_guard"
  | "submitted"
  | "executed"
  | "cancelled"
  | "expired"
  | "failed";

export interface ActionDraftConfirmationState {
  actionDraftId: ActionDraftId;
  operationStatus: ActionDraftOperationStatus;
  actionDraftStatus?: ActionDraftStatus;
  idempotencyKey?: string | null;
  recheck?: ActionDraftRecheck;
  safeMessage?: string;
}

export type ActionDraftDetailLoadStatus =
  | "idle"
  | "loading"
  | "available"
  | "unavailable";

export interface ActionDraftDetailState extends ActionDraftConfirmationState {
  detailStatus: ActionDraftDetailLoadStatus;
  requestId?: AssistantRequestId;
  messageId?: AssistantMessageId | null;
  detail?: ActionDraftDetail;
}

export const ACTION_DRAFT_PENDING_GUARD_MESSAGE =
  "已送出確認，系統仍在處理，請勿重複操作。";

export interface ActionDraftOperationInput {
  actionDraftId: ActionDraftId;
  idempotencyKey?: string | null;
}

export function createActionDraftOperationInput(input: {
  actionDraftId: ActionDraftId | null | undefined;
  idempotencyKey?: string | null;
}): ActionDraftOperationInput | null {
  return typeof input.actionDraftId === "string" && input.actionDraftId.trim()
    ? {
        actionDraftId: input.actionDraftId,
        idempotencyKey: input.idempotencyKey ?? null,
      }
    : null;
}

export function hasPendingExecutionGuard(
  recheck?: ActionDraftRecheck,
): boolean {
  return (
    recheck?.permission === "pending_execution_guard"
    || recheck?.toolContract === "pending_execution_guard"
  );
}

export function mapActionDraftOperationStatus(
  nextStatus: ActionDraftStatus,
  recheck?: ActionDraftRecheck,
): ActionDraftOperationStatus {
  if (nextStatus === "cancelled") {
    return "cancelled";
  }

  if (nextStatus === "expired") {
    return "expired";
  }

  if (nextStatus === "failed") {
    return "failed";
  }

  if (nextStatus === "executed") {
    return "executed";
  }

  if (hasPendingExecutionGuard(recheck)) {
    return "pending_execution_guard";
  }

  return "submitted";
}

export function createDefaultActionDraftState(
  actionDraftId: ActionDraftId,
): ActionDraftDetailState {
  return {
    actionDraftId,
    operationStatus: "idle",
    detailStatus: "idle",
    idempotencyKey: null,
  };
}

export function startActionDraftDetailLoadState(
  currentState: ActionDraftDetailState,
  options: {
    messageId?: AssistantMessageId | null;
    requestId?: AssistantRequestId;
  } = {},
): ActionDraftDetailState {
  return {
    ...currentState,
    messageId: options.messageId,
    requestId: options.requestId,
    detailStatus: "loading",
    safeMessage: undefined,
  };
}

export function completeActionDraftDetailLoadState(
  currentState: ActionDraftDetailState,
  detail: ActionDraftDetail,
): ActionDraftDetailState {
  return {
    ...currentState,
    actionDraftStatus: detail.status,
    requestId: detail.requestId,
    messageId: detail.messageId,
    detailStatus: "available",
    detail,
    safeMessage: undefined,
  };
}

export function failActionDraftDetailLoadState(
  currentState: ActionDraftDetailState,
  safeMessage: string,
): ActionDraftDetailState {
  return {
    ...currentState,
    detailStatus: "unavailable",
    safeMessage,
  };
}

export function setActionDraftOperationState(
  currentState: ActionDraftDetailState,
  operationStatus: ActionDraftOperationStatus,
  options: {
    idempotencyKey?: string | null;
    safeMessage?: string;
  } = {},
): ActionDraftDetailState {
  return {
    ...currentState,
    operationStatus,
    idempotencyKey: options.idempotencyKey,
    safeMessage: options.safeMessage,
  };
}

export function completeActionDraftOperationState(
  currentState: ActionDraftDetailState,
  nextStatus: ActionDraftStatus,
  options: {
    recheck?: ActionDraftRecheck;
    idempotencyKey?: string | null;
  } = {},
): ActionDraftDetailState {
  const nextDetail = currentState.detail
    ? {
        ...currentState.detail,
        status: nextStatus,
      }
    : undefined;
  const nextOperationStatus = mapActionDraftOperationStatus(
    nextStatus,
    options.recheck,
  );

  return {
    ...currentState,
    operationStatus: nextOperationStatus,
    actionDraftStatus: nextStatus,
    idempotencyKey: options.idempotencyKey ?? null,
    recheck: options.recheck,
    detail: nextDetail,
    safeMessage: nextOperationStatus === "pending_execution_guard"
      ? ACTION_DRAFT_PENDING_GUARD_MESSAGE
      : undefined,
  };
}

export function failActionDraftOperationState(
  currentState: ActionDraftDetailState,
  safeMessage: string,
  operationStatus: Extract<ActionDraftOperationStatus, "failed"> = "failed",
): ActionDraftDetailState {
  return {
    ...currentState,
    operationStatus,
    safeMessage,
  };
}
