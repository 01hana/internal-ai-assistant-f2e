import type {
  ActionDraftId,
  AnswerDecisionStatus,
  ApprovalRequestId,
  AssistantMessageId,
  AssistantRequestId,
  AssistantSessionId,
  ClarificationQuestionId,
  EscalationRequestId,
  IsoDateTime,
  NoAnswerReason,
} from './contracts'
import type { EvidenceReferenceDisplay } from './evidence'

export type AssistantMessageRendererKind =
  | 'user'
  | 'assistant_answer'
  | 'assistant_streaming'
  | 'clarification'
  | 'no_answer'
  | 'tool_failure'
  | 'permission_denied'
  | 'confirmation'
  | 'approval'
  | 'escalation'
  | 'degraded'
  | 'interrupted'
  | 'session_recovery'

export interface AssistantUiMessageBase {
  key: string
  messageId?: AssistantMessageId
  requestId?: AssistantRequestId
  content: string
  createdAt: IsoDateTime
}

export interface UserUiMessage extends AssistantUiMessageBase {
  kind: 'user'
  role: 'user'
  messageId: AssistantMessageId
}

export interface AssistantAnswerUiMessage extends AssistantUiMessageBase {
  kind: 'assistant_answer'
  role: 'assistant'
  messageId: AssistantMessageId
  answerDecision: 'answered'
  evidence: EvidenceReferenceDisplay[]
}

export type AssistantStreamingStatus =
  | 'idle'
  | 'sending'
  | 'connecting'
  | 'streaming'
  | 'finalizing'
  | 'completed'
  | 'interrupted'
  | 'failed'
  | 'cancelled'

export interface AssistantStreamingUiMessage extends AssistantUiMessageBase {
  kind: 'assistant_streaming'
  role: 'assistant'
  status: AssistantStreamingStatus
  lastSequence: number | null
  evidence: EvidenceReferenceDisplay[]
}

export type AssistantSystemStateKind = Exclude<
  AssistantMessageRendererKind,
  'user' | 'assistant_answer' | 'assistant_streaming' | 'tool_failure'
>

export interface AssistantSystemStateMessage extends AssistantUiMessageBase {
  kind: AssistantSystemStateKind
  role: 'assistant' | 'system'
  answerDecision?: Exclude<AnswerDecisionStatus, 'answered'>
  noAnswerReason?: NoAnswerReason
  evidence?: EvidenceReferenceDisplay[]
  actionDraftId?: ActionDraftId
  approvalRequestId?: ApprovalRequestId
  clarificationQuestionId?: ClarificationQuestionId
  escalationRequestId?: EscalationRequestId
}

export interface ToolFailureUiMessage extends AssistantUiMessageBase {
  kind: 'tool_failure'
  role: 'assistant'
  answerDecision: 'no_answer'
  noAnswerReason: 'tool_failure'
  evidence?: EvidenceReferenceDisplay[]
}

export type AssistantUiMessage =
  | UserUiMessage
  | AssistantAnswerUiMessage
  | AssistantStreamingUiMessage
  | ToolFailureUiMessage
  | AssistantSystemStateMessage

export type AssistantWidgetMode = 'embedded' | 'launcher'

export type AssistantPanelAvailability =
  | 'normal'
  | 'context_not_ready'
  | 'degraded'
  | 'unavailable'

export type AssistantContextReadinessState = 'ready' | 'not_ready'

export type AssistantSessionRecoveryStatus =
  | 'idle'
  | 'restoring'
  | 'creating'
  | 'ready'
  | 'new_session_required'
  | 'failed'

export interface AssistantSessionRecoveryState {
  status: AssistantSessionRecoveryStatus
  safeMessage?: string
}

export interface AssistantStreamingState {
  status: AssistantStreamingStatus
  requestId: AssistantRequestId | null
  messageId: AssistantMessageId | null
  lastSequence: number | null
}

export interface AssistantSessionUiState {
  sessionId: AssistantSessionId | null
  messages: AssistantUiMessage[]
  nextCursor: string | null
  streaming: AssistantStreamingState
  recovery: AssistantSessionRecoveryState
  contextReadiness: AssistantContextReadinessState
  availability: AssistantPanelAvailability
}
