import type {
  ActionDraftId,
  AnswerDecisionStatus,
  AnswerDecisionUiState,
  ApprovalRequestId,
  AssistantMessageFinalData,
  ClarificationQuestionId,
  EscalationRequestId,
  NoAnswerReason,
} from '../../types/assistant'

const ANSWER_DECISION_STATUSES = new Set<AnswerDecisionStatus>([
  'answered',
  'clarification_required',
  'no_answer',
  'confirmation_required',
  'approval_required',
  'escalation_required',
  'permission_denied',
])

const NO_ANSWER_REASONS = new Set<NoAnswerReason>([
  'no_evidence',
  'tool_failure',
  'permission_denied',
  'evidence_conflict',
  'ambiguous_query',
  'low_confidence',
  'missing_page_context',
  'unsupported_scope',
])

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function readOptionalId<TIdentifier extends string>(
  value: unknown,
): TIdentifier | undefined {
  return isNonEmptyString(value) ? (value as TIdentifier) : undefined
}

function readNoAnswerReason(value: unknown): NoAnswerReason | undefined {
  return isNonEmptyString(value) && NO_ANSWER_REASONS.has(value as NoAnswerReason)
    ? (value as NoAnswerReason)
    : undefined
}

export function mapAnswerDecisionState(
  finalData: Partial<AssistantMessageFinalData> | null | undefined,
): AnswerDecisionUiState | null {
  if (!finalData || !ANSWER_DECISION_STATUSES.has(finalData.answerDecision as AnswerDecisionStatus)) {
    return null
  }

  switch (finalData.answerDecision) {
    case 'answered':
      return {
        kind: 'answered',
        answerDecision: 'answered',
      }
    case 'clarification_required':
      return {
        kind: 'clarification_required',
        answerDecision: 'clarification_required',
        clarificationQuestionId: readOptionalId<ClarificationQuestionId>(
          finalData.clarificationQuestionId,
        ),
      }
    case 'no_answer':
      return {
        kind: 'no_answer',
        answerDecision: 'no_answer',
        noAnswerReason: readNoAnswerReason(finalData.noAnswerReason),
      }
    case 'permission_denied':
      return {
        kind: 'permission_denied',
        answerDecision: 'permission_denied',
      }
    case 'confirmation_required':
      return {
        kind: 'confirmation_required',
        answerDecision: 'confirmation_required',
        actionDraftId: readOptionalId<ActionDraftId>(finalData.actionDraftId),
      }
    case 'approval_required':
      return {
        kind: 'approval_required',
        answerDecision: 'approval_required',
        approvalRequestId: readOptionalId<ApprovalRequestId>(
          finalData.approvalRequestId,
        ),
      }
    case 'escalation_required':
      return {
        kind: 'escalation_required',
        answerDecision: 'escalation_required',
        escalationRequestId: readOptionalId<EscalationRequestId>(
          finalData.escalationRequestId,
        ),
      }
    default:
      return null
  }
}
