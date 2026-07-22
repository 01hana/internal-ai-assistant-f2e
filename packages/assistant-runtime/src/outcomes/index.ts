import type {
  ActionDraftId,
  AnswerDecisionStatus,
  ApprovalRequestId,
  AssistantMessageFinalData,
  ClarificationQuestionId,
  EscalationRequestId,
  NoAnswerReason,
} from "../types";

export type AssistantRuntimeSafeOutcomeKind =
  | "answered"
  | "clarification_required"
  | "no_answer"
  | "confirmation_required"
  | "approval_required"
  | "escalation_required"
  | "permission_denied"
  | "tool_failure"
  | "timeout"
  | "interrupted";

export type AnswerDecisionUiState =
  | {
      kind: "answered";
      answerDecision: "answered";
    }
  | {
      kind: "clarification_required";
      answerDecision: "clarification_required";
      clarificationQuestionId?: ClarificationQuestionId;
    }
  | {
      kind: "no_answer";
      answerDecision: "no_answer";
      noAnswerReason?: NoAnswerReason;
    }
  | {
      kind: "permission_denied";
      answerDecision: "permission_denied";
    }
  | {
      kind: "confirmation_required";
      answerDecision: "confirmation_required";
      actionDraftId?: ActionDraftId;
    }
  | {
      kind: "approval_required";
      answerDecision: "approval_required";
      approvalRequestId?: ApprovalRequestId;
    }
  | {
      kind: "escalation_required";
      answerDecision: "escalation_required";
      escalationRequestId?: EscalationRequestId;
    };

export interface AssistantRuntimeTerminalOutcome {
  kind: AssistantRuntimeSafeOutcomeKind;
  answerDecision?: AnswerDecisionStatus;
  noAnswerReason?: NoAnswerReason;
  safeTitle: string;
  retryable: boolean;
}

const ANSWER_DECISION_STATUSES = new Set<AnswerDecisionStatus>([
  "answered",
  "clarification_required",
  "no_answer",
  "confirmation_required",
  "approval_required",
  "escalation_required",
  "permission_denied",
]);

const NO_ANSWER_REASONS = new Set<NoAnswerReason>([
  "no_evidence",
  "tool_failure",
  "permission_denied",
  "evidence_conflict",
  "ambiguous_query",
  "low_confidence",
  "missing_page_context",
  "unsupported_scope",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readOptionalId<TIdentifier extends string>(
  value: unknown,
): TIdentifier | undefined {
  return isNonEmptyString(value) ? (value as TIdentifier) : undefined;
}

function readNoAnswerReason(value: unknown): NoAnswerReason | undefined {
  return isNonEmptyString(value) && NO_ANSWER_REASONS.has(value as NoAnswerReason)
    ? (value as NoAnswerReason)
    : undefined;
}

export function mapAnswerDecisionState(
  finalData: Partial<AssistantMessageFinalData> | null | undefined,
): AnswerDecisionUiState | null {
  if (!finalData || !ANSWER_DECISION_STATUSES.has(finalData.answerDecision as AnswerDecisionStatus)) {
    return null;
  }

  switch (finalData.answerDecision) {
    case "answered":
      return {
        kind: "answered",
        answerDecision: "answered",
      };
    case "clarification_required":
      return {
        kind: "clarification_required",
        answerDecision: "clarification_required",
        clarificationQuestionId: readOptionalId<ClarificationQuestionId>(
          finalData.clarificationQuestionId,
        ),
      };
    case "no_answer":
      return {
        kind: "no_answer",
        answerDecision: "no_answer",
        noAnswerReason: readNoAnswerReason(finalData.noAnswerReason),
      };
    case "permission_denied":
      return {
        kind: "permission_denied",
        answerDecision: "permission_denied",
      };
    case "confirmation_required":
      return {
        kind: "confirmation_required",
        answerDecision: "confirmation_required",
        actionDraftId: readOptionalId<ActionDraftId>(finalData.actionDraftId),
      };
    case "approval_required":
      return {
        kind: "approval_required",
        answerDecision: "approval_required",
        approvalRequestId: readOptionalId<ApprovalRequestId>(
          finalData.approvalRequestId,
        ),
      };
    case "escalation_required":
      return {
        kind: "escalation_required",
        answerDecision: "escalation_required",
        escalationRequestId: readOptionalId<EscalationRequestId>(
          finalData.escalationRequestId,
        ),
      };
    default:
      return null;
  }
}

export function resolveAnswerDecisionKind(input: {
  answerDecision?: AnswerDecisionStatus | null;
  finalAnswerDecision?: AnswerDecisionStatus | null;
  finalDecisionState?: Pick<AnswerDecisionUiState, "kind"> | null;
  kind?: string | null;
}): AnswerDecisionUiState["kind"] | null {
  if (input.finalDecisionState?.kind) {
    return input.finalDecisionState.kind;
  }

  if (input.finalAnswerDecision) {
    return input.finalAnswerDecision;
  }

  if (input.answerDecision) {
    return input.answerDecision;
  }

  switch (input.kind) {
    case "clarification":
      return "clarification_required";
    case "no_answer":
    case "tool_failure":
      return "no_answer";
    case "permission_denied":
      return "permission_denied";
    case "escalation":
      return "escalation_required";
    default:
      return null;
  }
}

export function isToolFailureDecision(input: {
  kind?: string | null;
  answerDecision?: AnswerDecisionStatus | null;
  noAnswerReason?: NoAnswerReason | null;
  finalDecisionState?: Partial<AnswerDecisionUiState> | null;
}): boolean {
  if (input.finalDecisionState?.kind === "no_answer") {
    return input.finalDecisionState.noAnswerReason === "tool_failure";
  }

  if (input.answerDecision === "no_answer") {
    return input.noAnswerReason === "tool_failure";
  }

  return input.kind === "tool_failure";
}

export function createTerminalOutcome(
  kind: AssistantRuntimeSafeOutcomeKind,
): AssistantRuntimeTerminalOutcome {
  switch (kind) {
    case "answered":
      return {
        kind,
        answerDecision: "answered",
        safeTitle: "Answered",
        retryable: false,
      };
    case "clarification_required":
      return {
        kind,
        answerDecision: "clarification_required",
        safeTitle: "Clarification required",
        retryable: false,
      };
    case "no_answer":
      return {
        kind,
        answerDecision: "no_answer",
        safeTitle: "No answer available",
        retryable: false,
      };
    case "permission_denied":
      return {
        kind,
        answerDecision: "permission_denied",
        safeTitle: "Permission denied",
        retryable: false,
      };
    case "tool_failure":
      return {
        kind,
        answerDecision: "no_answer",
        noAnswerReason: "tool_failure",
        safeTitle: "Tool failed",
        retryable: true,
      };
    case "timeout":
      return {
        kind,
        safeTitle: "Response timed out",
        retryable: true,
      };
    case "interrupted":
      return {
        kind,
        safeTitle: "Response interrupted",
        retryable: true,
      };
    case "confirmation_required":
    case "approval_required":
    case "escalation_required":
      return {
        kind,
        answerDecision: kind,
        safeTitle: "Additional handling required",
        retryable: false,
      };
    default:
      return {
        kind,
        safeTitle: "Safe outcome",
        retryable: false,
      };
  }
}
