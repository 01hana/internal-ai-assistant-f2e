import type {
  ActionDraftId,
  ApprovalRequestId,
  AssistantMessageId,
  AssistantRequestId,
  AssistantSessionId,
  EvidenceRefId,
  IsoDateTime,
} from './contracts'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ActionDraftRiskLevel = 'medium'
export type ActionDraftPreview = Record<string, unknown>

export type ActionDraftStatus =
  | 'draft'
  | 'waiting_confirmation'
  | 'confirmed'
  | 'executed'
  | 'cancelled'
  | 'expired'
  | 'failed'

export interface ActionDraftSummary {
  actionDraftId: ActionDraftId
  requestId: AssistantRequestId
  messageId: AssistantMessageId | null
  status: ActionDraftStatus
  riskLevel: ActionDraftRiskLevel
  toolName: string
  resource: string
  operation: string
  preview?: ActionDraftPreview
  expiresAt?: IsoDateTime | null
}

export type ActionDraftDetail = ActionDraftSummary

export interface ActionDraftConfirmRequest {
  idempotencyKey?: string
}

export type ConfirmActionDraftRequest = ActionDraftConfirmRequest

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

export type ActionDraftExecutionResult = ActionDraftConfirmResult

export interface ActionDraftCancelResult {
  actionDraftId: ActionDraftId
  status: ActionDraftStatus
}

export type ActionDraftOperationStatus =
  | 'idle'
  | 'confirming'
  | 'cancelling'
  | 'pending_execution_guard'
  | 'submitted'
  | 'executed'
  | 'cancelled'
  | 'expired'
  | 'failed'

export interface ActionDraftConfirmationState {
  actionDraftId: ActionDraftId
  operationStatus: ActionDraftOperationStatus
  actionDraftStatus?: ActionDraftStatus
  idempotencyKey?: string | null
  recheck?: ActionDraftRecheck
  safeMessage?: string
}

export type ActionDraftDetailLoadStatus =
  | 'idle'
  | 'loading'
  | 'available'
  | 'unavailable'

export interface ActionDraftDetailState extends ActionDraftConfirmationState {
  detailStatus: ActionDraftDetailLoadStatus
  requestId?: AssistantRequestId
  messageId?: AssistantMessageId | null
  detail?: ActionDraftDetail
}

export type ApprovalRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'

export type ApprovalRequestRiskLevel = 'high' | 'critical'

export type ApprovalRequestDetailLoadStatus =
  | 'idle'
  | 'loading'
  | 'available'
  | 'unavailable'

export type ApprovalRequestOpenDetailStatus =
  | 'idle'
  | 'opening'
  | 'failed'

export interface ApprovalRequestSummary {
  approvalRequestId: ApprovalRequestId
  requestId: AssistantRequestId
  sessionId?: AssistantSessionId | null
  messageId: AssistantMessageId
  status: ApprovalRequestStatus
  riskLevel: ApprovalRequestRiskLevel
  requesterActorId: string
  approverActorId?: string | null
  actionSummary?: Record<string, unknown>
  payloadSummary?: Record<string, unknown>
  expiresAt?: IsoDateTime | null
  evidenceRefIds?: EvidenceRefId[]
}

export interface ApprovalRequestDetailState {
  approvalRequestId: ApprovalRequestId
  detailStatus: ApprovalRequestDetailLoadStatus
  openDetailStatus: ApprovalRequestOpenDetailStatus
  requestId?: AssistantRequestId
  messageId?: AssistantMessageId
  sessionId?: AssistantSessionId | null
  status?: ApprovalRequestStatus
  riskLevel?: ApprovalRequestRiskLevel
  actionSummary?: Record<string, unknown>
  payloadSummary?: Record<string, unknown>
  expiresAt?: IsoDateTime | null
  evidenceRefIds?: EvidenceRefId[]
  safeMessage?: string | null
  openDetailSafeMessage?: string | null
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
