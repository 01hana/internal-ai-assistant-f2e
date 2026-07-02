import type {
  AnswerDecisionStatus,
  AssistantApiEnvelope,
  AssistantMessageRendererKind,
  AssistantSseEventInput,
} from '../../../app/types/assistant'
import {
  actionDraftDetailResponse,
  approvalRequestDetailResponse,
  backendErrorWithoutStatusCodeResponse,
  emptyHistorySuccessResponse,
  feedbackNegativeSuccessResponse,
  feedbackNeutralSuccessResponse,
  feedbackPositiveSuccessResponse,
  historyFirstPageSuccessResponse,
  sessionNotFoundErrorResponse,
} from './responses'
import {
  answeredIdOnlyStream,
  answeredSummaryStream,
  approvalRequiredStream,
  clarificationStream,
  confirmationRequiredStream,
  errorAfterPartialStream,
  escalationRequiredStream,
  interruptedStreamSeed,
  noEvidenceStream,
  permissionDeniedStream,
  toolFailureStream,
  unknownEventStream,
} from '../assistant-sse/events'

export type AssistantFixtureRuntimeCondition =
  | 'backend_error'
  | 'empty_history'
  | 'error_after_partial'
  | 'feedback_submitted'
  | 'stream_interrupted'
  | 'unknown_sse_event'

export interface AssistantFixtureScenario {
  scenarioId: string
  title: string
  answerDecision?: AnswerDecisionStatus
  frontendRuntimeCondition?: AssistantFixtureRuntimeCondition
  apiFixtures: readonly AssistantApiEnvelope<unknown>[]
  sseFixtures: readonly AssistantSseEventInput[]
  expectedUiKind: AssistantMessageRendererKind
  guardrails: readonly string[]
}

export const assistantFixtureScenarios = [
  {
    scenarioId: 'answered-evidence-summary',
    title: 'Answered with safe evidence summary',
    answerDecision: 'answered',
    apiFixtures: [],
    sseFixtures: answeredSummaryStream,
    expectedUiKind: 'assistant_answer',
    guardrails: ['Summary fields originate from EvidenceRefSummary.'],
  },
  {
    scenarioId: 'answered-evidence-id-only',
    title: 'Answered with evidence reference identifiers',
    answerDecision: 'answered',
    apiFixtures: [],
    sseFixtures: answeredIdOnlyStream,
    expectedUiKind: 'assistant_answer',
    guardrails: ['Identifier-only evidence must remain identifier-only.'],
  },
  {
    scenarioId: 'clarification-required',
    title: 'Clarification required',
    answerDecision: 'clarification_required',
    apiFixtures: [],
    sseFixtures: clarificationStream,
    expectedUiKind: 'clarification',
    guardrails: ['Preserve clarificationQuestionId for later interaction.'],
  },
  {
    scenarioId: 'no-answer-no-evidence',
    title: 'No answer because evidence is unavailable',
    answerDecision: 'no_answer',
    apiFixtures: [],
    sseFixtures: noEvidenceStream,
    expectedUiKind: 'no_answer',
    guardrails: ['Do not fabricate an answer or evidence.'],
  },
  {
    scenarioId: 'no-answer-tool-failure',
    title: 'No answer after tool failure',
    answerDecision: 'no_answer',
    apiFixtures: [],
    sseFixtures: toolFailureStream,
    expectedUiKind: 'tool_failure',
    guardrails: ['tool_failure is a NoAnswerReason, not a final state.'],
  },
  {
    scenarioId: 'permission-denied',
    title: 'Permission denied',
    answerDecision: 'permission_denied',
    apiFixtures: [],
    sseFixtures: permissionDeniedStream,
    expectedUiKind: 'permission_denied',
    guardrails: ['Frontend displays the backend decision without re-evaluating access.'],
  },
  {
    scenarioId: 'confirmation-required',
    title: 'Medium-risk action requires confirmation',
    answerDecision: 'confirmation_required',
    apiFixtures: [actionDraftDetailResponse],
    sseFixtures: confirmationRequiredStream,
    expectedUiKind: 'confirmation',
    guardrails: ['Confirmation does not imply that the side effect completed.'],
  },
  {
    scenarioId: 'approval-required',
    title: 'High-risk action requires approval',
    answerDecision: 'approval_required',
    apiFixtures: [approvalRequestDetailResponse],
    sseFixtures: approvalRequiredStream,
    expectedUiKind: 'approval',
    guardrails: ['ApprovalRequest remains display-only.'],
  },
  {
    scenarioId: 'escalation-required',
    title: 'Manual escalation required',
    answerDecision: 'escalation_required',
    apiFixtures: [],
    sseFixtures: escalationRequiredStream,
    expectedUiKind: 'escalation',
    guardrails: ['Preserve escalationRequestId for host integration.'],
  },
  {
    scenarioId: 'backend-error-status-code',
    title: 'Session is not visible',
    frontendRuntimeCondition: 'backend_error',
    apiFixtures: [sessionNotFoundErrorResponse],
    sseFixtures: [],
    expectedUiKind: 'session_recovery',
    guardrails: ['Use the safe error envelope and start a recovery flow.'],
  },
  {
    scenarioId: 'backend-error-no-status-code',
    title: 'Backend error without HTTP status metadata',
    frontendRuntimeCondition: 'backend_error',
    apiFixtures: [backendErrorWithoutStatusCodeResponse],
    sseFixtures: [],
    expectedUiKind: 'degraded',
    guardrails: ['statusCode is optional in the wire envelope.'],
  },
  {
    scenarioId: 'stream-interrupted',
    title: 'Stream interrupted before final',
    frontendRuntimeCondition: 'stream_interrupted',
    apiFixtures: [],
    sseFixtures: interruptedStreamSeed,
    expectedUiKind: 'interrupted',
    guardrails: ['Partial content must never be promoted to final.'],
  },
  {
    scenarioId: 'error-after-partial',
    title: 'Stream error after partial content',
    frontendRuntimeCondition: 'error_after_partial',
    apiFixtures: [],
    sseFixtures: errorAfterPartialStream,
    expectedUiKind: 'interrupted',
    guardrails: ['An error event must not promote partial content to final.'],
  },
  {
    scenarioId: 'unknown-sse-event',
    title: 'Unknown SSE event is safely tolerated',
    frontendRuntimeCondition: 'unknown_sse_event',
    apiFixtures: [],
    sseFixtures: unknownEventStream,
    expectedUiKind: 'assistant_streaming',
    guardrails: ['Unknown event types must not crash or finalize the message.'],
  },
  {
    scenarioId: 'session-history-next-cursor',
    title: 'Session history has another page',
    apiFixtures: [historyFirstPageSuccessResponse],
    sseFixtures: [],
    expectedUiKind: 'session_recovery',
    guardrails: ['Pagination depends only on nextCursor.'],
  },
  {
    scenarioId: 'session-history-empty',
    title: 'Visible session has no message history',
    frontendRuntimeCondition: 'empty_history',
    apiFixtures: [emptyHistorySuccessResponse],
    sseFixtures: [],
    expectedUiKind: 'session_recovery',
    guardrails: ['Empty history is a valid state.'],
  },
  {
    scenarioId: 'feedback-positive',
    title: 'Positive message feedback',
    frontendRuntimeCondition: 'feedback_submitted',
    apiFixtures: [feedbackPositiveSuccessResponse],
    sseFixtures: [],
    expectedUiKind: 'assistant_answer',
    guardrails: ['Frontend submits feedback but does not create review records.'],
  },
  {
    scenarioId: 'feedback-negative',
    title: 'Negative message feedback',
    frontendRuntimeCondition: 'feedback_submitted',
    apiFixtures: [feedbackNegativeSuccessResponse],
    sseFixtures: [],
    expectedUiKind: 'assistant_answer',
    guardrails: ['A backend reviewItemId is linkage data, not a frontend review model.'],
  },
  {
    scenarioId: 'feedback-neutral',
    title: 'Neutral message feedback',
    frontendRuntimeCondition: 'feedback_submitted',
    apiFixtures: [feedbackNeutralSuccessResponse],
    sseFixtures: [],
    expectedUiKind: 'assistant_answer',
    guardrails: ['neutral remains a supported backend wire rating.'],
  },
] satisfies readonly AssistantFixtureScenario[]
