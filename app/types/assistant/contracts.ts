export type {
  ActionDraftId,
  AnswerDecisionStatus,
  AnswerDeltaSseEvent,
  ApprovalRequestId,
  ApprovalRequiredSseEvent,
  AssistantHistoryOrder,
  AssistantHistoryQuery,
  AssistantKnownSseEventType,
  AssistantMessageFinalData,
  AssistantMessageId,
  AssistantMessageRole,
  AssistantRequestId,
  AssistantSession,
  AssistantSessionId,
  AssistantSseEvent,
  AssistantSseEventEnvelope,
  AssistantSseEventInput,
  AssistantUnknownSseEvent,
  ClarificationQuestionId,
  ConfirmationRequiredSseEvent,
  CreateAssistantSessionRequest,
  ErrorSseEvent,
  EscalationRequestId,
  EscalationRequiredSseEvent,
  EvidenceAttachedSseEvent,
  EvidenceRefId,
  EvidenceRefsWireValue,
  EvidenceSourceType,
  FinalSseEvent,
  HistoryMessageSummary,
  IsoDateTime,
  NoAnswerReason,
  PageContext,
  PageContextSelectedRow,
  SendAssistantMessageRequest,
  SessionMessagesResponse,
  ToolCallBlockedSseEvent,
  ToolCallCompletedSseEvent,
  ToolCallFailedSseEvent,
  ToolCallId,
  ToolCallStartedSseEvent,
  ToolSummary,
} from '../../../packages/assistant-runtime/src/types'

import type { ClarificationQuestionId } from '../../../packages/assistant-runtime/src/types'

export interface ClarificationQuestionSummary {
  clarificationQuestionId: ClarificationQuestionId
  reason?: string
  question: string
  candidateRefs?: unknown[]
  blocking?: boolean
}
