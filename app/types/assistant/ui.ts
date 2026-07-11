import type {
  ActionDraftId,
  AnswerDecisionStatus,
  ApprovalRequestId,
  AssistantMessageId,
  AssistantRequestId,
  AssistantSessionId,
  ClarificationQuestionId,
  EscalationRequestId,
  HistoryMessageSummary,
  IsoDateTime,
  NoAnswerReason,
  ToolCallId,
} from './contracts'
import type { EvidenceReferenceDisplay } from './evidence'

export type AnswerDecisionUiState =
  | {
      kind: 'answered'
      answerDecision: 'answered'
    }
  | {
      kind: 'clarification_required'
      answerDecision: 'clarification_required'
      clarificationQuestionId?: ClarificationQuestionId
    }
  | {
      kind: 'no_answer'
      answerDecision: 'no_answer'
      noAnswerReason?: NoAnswerReason
    }
  | {
      kind: 'permission_denied'
      answerDecision: 'permission_denied'
    }
  | {
      kind: 'confirmation_required'
      answerDecision: 'confirmation_required'
      actionDraftId?: ActionDraftId
    }
  | {
      kind: 'approval_required'
      answerDecision: 'approval_required'
      approvalRequestId?: ApprovalRequestId
    }
  | {
      kind: 'escalation_required'
      answerDecision: 'escalation_required'
      escalationRequestId?: EscalationRequestId
    }

export type AssistantFeedbackValue = 'helpful' | 'not_helpful'

export interface AssistantMessageFeedbackUiState {
  value: AssistantFeedbackValue | null
  pending: boolean
  error: string | null
  requestId: AssistantRequestId | null
}

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

export type AssistantStreamingActivityKind =
  | 'tool_running'
  | 'tool_completed'
  | 'tool_blocked'
  | 'tool_failed'
  | 'stream_error'
  | 'unknown_event'

export interface AssistantStreamingActivity {
  key: string
  kind: AssistantStreamingActivityKind
  sequence: number
  label: string
  toolCallId?: ToolCallId
}

export interface AssistantStreamingUiMessage extends AssistantUiMessageBase {
  kind: 'assistant_streaming'
  role: 'assistant'
  status: AssistantStreamingStatus
  lastSequence: number | null
  typingVisibleUntil?: number | null
  pendingContent?: string
  pendingFinalAnswerDecision?: AnswerDecisionStatus
  evidence: EvidenceReferenceDisplay[]
  activities?: AssistantStreamingActivity[]
  finalAnswerDecision?: AnswerDecisionStatus
  finalDecisionState?: AnswerDecisionUiState | null
}

export type AssistantSystemStateKind = Exclude<
  AssistantMessageRendererKind,
  'user' | 'assistant_answer' | 'assistant_streaming' | 'tool_failure'
>

export interface AssistantSystemStateMessage extends AssistantUiMessageBase {
  kind: AssistantSystemStateKind
  role: 'assistant' | 'system'
  safeTitle?: string
  degradedKind?: 'degraded' | 'unavailable'
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

export type AssistantRenderableMessage = AssistantUiMessage | HistoryMessageSummary

export type AssistantMessageFrameRole = 'user' | 'assistant'

export type ResolvedAssistantMessageRendererKind =
  | 'user'
  | 'assistant_answer'
  | 'assistant_streaming'
  | 'degraded'
  | 'interrupted'
  | 'confirmation'
  | 'approval'
  | 'clarification'
  | 'no_answer'
  | 'permission_denied'
  | 'tool_failure'
  | 'escalation'
  | 'unsupported_safe_state'

export interface ResolvedAssistantMessageRenderer {
  key: string
  rendererKind: ResolvedAssistantMessageRendererKind
  frameRole: AssistantMessageFrameRole | null
  message: AssistantRenderableMessage
  messageTestId: string
  timestampTestId?: string
  showTimestamp: boolean
  fallbackKind?: 'permission_denied' | 'tool_failure' | 'escalation_required' | 'system'
}

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
