import type { ActionDraftId, AnswerDecisionStatus, ApprovalRequestId, AssistantMessageFinalData, ClarificationQuestionId, EscalationRequestId, NoAnswerReason } from "../types";
export type AssistantRuntimeSafeOutcomeKind = "answered" | "clarification_required" | "no_answer" | "confirmation_required" | "approval_required" | "escalation_required" | "permission_denied" | "tool_failure" | "timeout" | "interrupted";
export type AnswerDecisionUiState = {
    kind: "answered";
    answerDecision: "answered";
} | {
    kind: "clarification_required";
    answerDecision: "clarification_required";
    clarificationQuestionId?: ClarificationQuestionId;
} | {
    kind: "no_answer";
    answerDecision: "no_answer";
    noAnswerReason?: NoAnswerReason;
} | {
    kind: "permission_denied";
    answerDecision: "permission_denied";
} | {
    kind: "confirmation_required";
    answerDecision: "confirmation_required";
    actionDraftId?: ActionDraftId;
} | {
    kind: "approval_required";
    answerDecision: "approval_required";
    approvalRequestId?: ApprovalRequestId;
} | {
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
export declare function mapAnswerDecisionState(finalData: Partial<AssistantMessageFinalData> | null | undefined): AnswerDecisionUiState | null;
export declare function resolveAnswerDecisionKind(input: {
    answerDecision?: AnswerDecisionStatus | null;
    finalAnswerDecision?: AnswerDecisionStatus | null;
    finalDecisionState?: Pick<AnswerDecisionUiState, "kind"> | null;
    kind?: string | null;
}): AnswerDecisionUiState["kind"] | null;
export declare function isToolFailureDecision(input: {
    kind?: string | null;
    answerDecision?: AnswerDecisionStatus | null;
    noAnswerReason?: NoAnswerReason | null;
    finalDecisionState?: Partial<AnswerDecisionUiState> | null;
}): boolean;
export declare function createTerminalOutcome(kind: AssistantRuntimeSafeOutcomeKind): AssistantRuntimeTerminalOutcome;
