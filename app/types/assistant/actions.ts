import type {
  ActionDraftId,
  ApprovalRequestId,
  AssistantMessageId,
  AssistantRequestId,
  AssistantSessionId,
  EvidenceRefId,
  IsoDateTime,
} from './contracts'
import type { EvidenceRefsWireValue } from './evidence'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type ActionDraftStatus =
  | 'draft'
  | 'waiting_confirmation'
  | 'confirmed'
  | 'executed'
  | 'cancelled'
  | 'expired'
  | 'failed'

export interface ActionDraftSummary {
  id: ActionDraftId
  requestId: AssistantRequestId
  messageId: AssistantMessageId
  status: ActionDraftStatus
  riskLevel: 'medium'
  toolName: string
  resource: string
  operation: string
  preview?: Record<string, unknown>
  expiresAt?: IsoDateTime | null
}

export interface ActionDraftConfirmRequest {
  idempotencyKey?: string
}

export interface ActionDraftRecheck {
  organizationBoundary: 'passed'
  draftStatus: 'passed'
  freshness: 'passed'
  permission: 'pending_execution_guard'
  toolContract: 'pending_execution_guard'
  idempotency: 'reserved' | 'duplicate'
}

export interface ActionDraftConfirmResult {
  actionDraftId: ActionDraftId
  status: ActionDraftStatus
  duplicateSafe: boolean
  recheck: ActionDraftRecheck
}

export interface ActionDraftCancelRequest {
  reason?: string
}

export interface ActionDraftCancelResult {
  actionDraftId: ActionDraftId
  status: ActionDraftStatus
}

export type ActionDraftOperationStatus =
  | 'idle'
  | 'confirming'
  | 'cancelling'
  | 'succeeded'
  | 'failed'

export interface ActionDraftConfirmationState {
  actionDraftId: ActionDraftId
  operationStatus: ActionDraftOperationStatus
  actionDraftStatus?: ActionDraftStatus
  recheck?: ActionDraftRecheck
  safeMessage?: string
}

export type ApprovalRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'

export interface ApprovalRequestSummary {
  id: ApprovalRequestId
  requestId: AssistantRequestId
  sessionId?: AssistantSessionId | null
  messageId: AssistantMessageId
  status: ApprovalRequestStatus
  riskLevel: 'high' | 'critical'
  requesterActorId: string
  approverActorId?: string | null
  actionSummary?: Record<string, unknown>
  payloadSummary?: Record<string, unknown>
  expiresAt?: IsoDateTime | null
  evidenceRefIds?: EvidenceRefId[]
}

export interface ApprovalRequestDisplayState {
  approvalRequestId: ApprovalRequestId
  requestId: AssistantRequestId
  messageId: AssistantMessageId
  status: ApprovalRequestStatus
  riskLevel: 'high' | 'critical'
  actionSummary?: Record<string, unknown>
  payloadSummary?: Record<string, unknown>
  expiresAt?: IsoDateTime | null
  evidenceRefs?: EvidenceRefsWireValue
  detailAvailability: 'available' | 'unavailable'
}

export interface OpenApprovalDetailPayload {
  approvalRequestId: ApprovalRequestId
  requestId?: AssistantRequestId
  messageId?: AssistantMessageId
  sessionId?: AssistantSessionId
}

export type OpenApprovalDetailHandler = (
  payload: OpenApprovalDetailPayload,
) => void

export type FeedbackRating = 'positive' | 'negative' | 'neutral'

export type FeedbackIntent =
  | 'correction'
  | 'unsafe'
  | 'not_helpful'
  | 'missing_evidence'
  | 'other'

export interface FeedbackRequest {
  rating: FeedbackRating
  intent: FeedbackIntent
  reason?: string
  comment?: string
}

export type FeedbackSubmissionStatus =
  | 'idle'
  | 'submitting'
  | 'succeeded'
  | 'failed'

export interface FeedbackSubmissionState {
  messageId: AssistantMessageId
  requestId: AssistantRequestId
  status: FeedbackSubmissionStatus
  retryable: boolean
  feedback?: FeedbackRequest
  safeMessage?: string
}
