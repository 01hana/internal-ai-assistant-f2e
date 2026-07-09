import type { EvidenceRefsWireValue } from './evidence'

export type AssistantSessionId = string
export type AssistantMessageId = string
export type AssistantRequestId = string
export type EvidenceRefId = string
export type ToolCallId = string
export type ActionDraftId = string
export type ApprovalRequestId = string
export type ClarificationQuestionId = string
export type EscalationRequestId = string
export type IsoDateTime = string

export type AnswerDecisionStatus =
  | 'answered'
  | 'clarification_required'
  | 'no_answer'
  | 'confirmation_required'
  | 'approval_required'
  | 'escalation_required'
  | 'permission_denied'

export type NoAnswerReason =
  | 'no_evidence'
  | 'tool_failure'
  | 'permission_denied'
  | 'evidence_conflict'
  | 'ambiguous_query'
  | 'low_confidence'
  | 'missing_page_context'
  | 'unsupported_scope'

export interface PageContextSelectedRow {
  id: string
}

export interface PageContext {
  module?: string
  route?: string
  screenId?: string
  entityType?: string
  entityId?: string
  selectedRows?: PageContextSelectedRow[]
  activeFilters?: unknown[]
  visibleColumns?: string[]
  userVisibleState?: Record<string, unknown>
}

export interface CreateAssistantSessionRequest {
  pageContext?: PageContext
}

export interface SendAssistantMessageRequest {
  message: string
  pageContext?: PageContext
}

export interface AssistantSession {
  sessionId: AssistantSessionId
  status: string
  title?: string
  createdAt?: IsoDateTime
  updatedAt?: IsoDateTime
  latestMessageId?: AssistantMessageId | null
  pageContext?: PageContext | null
}

export type AssistantMessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface ToolSummary {
  status: string
  toolCallIds: ToolCallId[]
}

export interface HistoryMessageSummary {
  messageId: AssistantMessageId
  role: AssistantMessageRole
  content: string
  createdAt: IsoDateTime
  answerDecision?: AnswerDecisionStatus | null
  approvalRequestId?: ApprovalRequestId
  evidenceRefs?: EvidenceRefId[]
  toolSummary?: ToolSummary
}

export type AssistantHistoryOrder = 'asc'

export interface AssistantHistoryQuery {
  limit?: number
  cursor?: string
  order?: AssistantHistoryOrder
}

export interface SessionMessagesResponse {
  sessionId: AssistantSessionId
  messages: HistoryMessageSummary[]
  nextCursor: string | null
}

export interface ClarificationQuestionSummary {
  clarificationQuestionId: ClarificationQuestionId
  reason?: string
  question: string
  candidateRefs?: unknown[]
  blocking?: boolean
}

export interface AssistantMessageFinalData {
  answerDecision: AnswerDecisionStatus
  answer?: string
  noAnswerReason?: NoAnswerReason
  evidenceRefs: EvidenceRefsWireValue
  clarificationQuestionId?: ClarificationQuestionId
  actionDraftId?: ActionDraftId
  approvalRequestId?: ApprovalRequestId
  escalationRequestId?: EscalationRequestId
}

export type AssistantKnownSseEventType =
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'tool_call_blocked'
  | 'tool_call_failed'
  | 'evidence_attached'
  | 'answer_delta'
  | 'confirmation_required'
  | 'approval_required'
  | 'escalation_required'
  | 'final'
  | 'error'

export interface AssistantSseEventEnvelope<
  TEventType extends string = string,
  TData = unknown,
> {
  requestId: AssistantRequestId
  sessionId: AssistantSessionId
  messageId: AssistantMessageId
  eventType: TEventType
  sequence: number
  data: TData
}

export type ToolCallStartedSseEvent = AssistantSseEventEnvelope<
  'tool_call_started',
  {
    toolCallId: ToolCallId
    toolName: string
  }
>

export type ToolCallCompletedSseEvent = AssistantSseEventEnvelope<
  'tool_call_completed',
  {
    toolCallId: ToolCallId
    toolName: string
    status: string
    executionStatus: string
  }
>

export type ToolCallBlockedSseEvent = AssistantSseEventEnvelope<
  'tool_call_blocked',
  {
    toolCallId: ToolCallId
    toolName: string
    status: string
    executionStatus: string
    deniedReason?: string
  }
>

export type ToolCallFailedSseEvent = AssistantSseEventEnvelope<
  'tool_call_failed',
  {
    toolCallId: ToolCallId
    toolName: string
    status: string
    executionStatus: string
    errorCode?: string
  }
>

export type EvidenceAttachedSseEvent = AssistantSseEventEnvelope<
  'evidence_attached',
  {
    evidenceRefs: EvidenceRefId[]
  }
>

export type AnswerDeltaSseEvent = AssistantSseEventEnvelope<
  'answer_delta',
  {
    delta: string
  }
>

export type ConfirmationRequiredSseEvent = AssistantSseEventEnvelope<
  'confirmation_required',
  {
    actionDraftId: ActionDraftId
    requestId: AssistantRequestId
    messageId: AssistantMessageId
    riskLevel: string
    preview?: unknown
    expiresAt?: IsoDateTime | null
  }
>

export type ApprovalRequiredSseEvent = AssistantSseEventEnvelope<
  'approval_required',
  {
    approvalRequestId: ApprovalRequestId
    requestId: AssistantRequestId
    messageId: AssistantMessageId
    riskLevel: string
    actionSummary?: unknown
    expiresAt?: IsoDateTime | null
  }
>

export type EscalationRequiredSseEvent = AssistantSseEventEnvelope<
  'escalation_required',
  {
    escalationRequestId: EscalationRequestId
    requestId: AssistantRequestId
    messageId: AssistantMessageId
    riskLevel: string
    reasonCode?: string
    reasonSummary?: string
    actionSummary?: unknown
    expiresAt?: IsoDateTime | null
  }
>

export type FinalSseEvent = AssistantSseEventEnvelope<
  'final',
  AssistantMessageFinalData
>

export type ErrorSseEvent = AssistantSseEventEnvelope<
  'error',
  {
    code: string
    message: string
  }
>

export type AssistantSseEvent =
  | ToolCallStartedSseEvent
  | ToolCallCompletedSseEvent
  | ToolCallBlockedSseEvent
  | ToolCallFailedSseEvent
  | EvidenceAttachedSseEvent
  | AnswerDeltaSseEvent
  | ConfirmationRequiredSseEvent
  | ApprovalRequiredSseEvent
  | EscalationRequiredSseEvent
  | FinalSseEvent
  | ErrorSseEvent

export type AssistantUnknownSseEvent = AssistantSseEventEnvelope<string, unknown>

export type AssistantSseEventInput = AssistantSseEvent | AssistantUnknownSseEvent
