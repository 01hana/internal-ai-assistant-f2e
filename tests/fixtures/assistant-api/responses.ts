import type {
  ActionDraftCancelResult,
  ActionDraftConfirmResult,
  ActionDraftSummary,
  ApprovalRequestSummary,
  AssistantErrorEnvelope,
  AssistantSession,
  AssistantSuccessEnvelope,
  FeedbackIntent,
  FeedbackRating,
  SessionMessagesResponse,
} from '../../../app/types/assistant'

interface FeedbackAcceptedData {
  feedbackEventId: string
  messageId: string
  rating: FeedbackRating
  intent: FeedbackIntent
  reviewItemId?: string | null
}

export const createSessionSuccessResponse = {
  requestId: 'req-session-create-001',
  data: {
    id: 'session-001',
    title: 'Order status follow-up',
    status: 'open',
    createdAt: '2026-06-23T09:00:00.000Z',
    updatedAt: '2026-06-23T09:00:00.000Z',
    pageContext: {
      module: 'orders',
      route: '/orders/SO-10001',
      screenId: 'order-detail',
      entityType: 'order',
      entityId: 'SO-10001',
      activeFilters: [{ field: 'status', value: 'confirmed' }],
      visibleColumns: ['status', 'customerName'],
    },
  },
} satisfies AssistantSuccessEnvelope<AssistantSession>

export const getSessionSuccessResponse = {
  requestId: 'req-session-get-001',
  data: {
    id: 'session-001',
    title: 'Order status follow-up',
    status: 'open',
    createdAt: '2026-06-23T09:00:00.000Z',
    updatedAt: '2026-06-23T09:02:00.000Z',
    latestMessageId: 'msg-assistant-001',
  },
} satisfies AssistantSuccessEnvelope<AssistantSession>

export const historyFirstPageSuccessResponse = {
  requestId: 'req-history-001',
  data: {
    sessionId: 'session-001',
    messages: [
      {
        messageId: 'msg-user-001',
        role: 'user',
        content: '請查 SO-10001 訂單狀態',
        createdAt: '2026-06-23T09:00:30.000Z',
      },
    ],
    nextCursor: 'msg-user-001',
  },
} satisfies AssistantSuccessEnvelope<SessionMessagesResponse>

export const historyFinalPageSuccessResponse = {
  requestId: 'req-history-002',
  data: {
    sessionId: 'session-001',
    messages: [
      {
        messageId: 'msg-assistant-001',
        role: 'assistant',
        content: 'SO-10001 目前狀態為 confirmed。',
        createdAt: '2026-06-23T09:00:31.000Z',
        answerDecision: 'answered',
        evidenceRefs: ['evidence-structured-001'],
        toolSummary: {
          status: 'completed',
          toolCallIds: ['tool-call-001'],
        },
      },
    ],
    nextCursor: null,
  },
} satisfies AssistantSuccessEnvelope<SessionMessagesResponse>

export const emptyHistorySuccessResponse = {
  requestId: 'req-history-empty-001',
  data: {
    sessionId: 'session-empty-001',
    messages: [],
    nextCursor: null,
  },
} satisfies AssistantSuccessEnvelope<SessionMessagesResponse>

export const feedbackPositiveSuccessResponse = {
  requestId: 'req-feedback-positive-001',
  data: {
    feedbackEventId: 'feedback-positive-001',
    messageId: 'msg-assistant-001',
    rating: 'positive',
    intent: 'other',
    reviewItemId: null,
  },
} satisfies AssistantSuccessEnvelope<FeedbackAcceptedData>

export const feedbackNegativeSuccessResponse = {
  requestId: 'req-feedback-negative-001',
  data: {
    feedbackEventId: 'feedback-negative-001',
    messageId: 'msg-assistant-001',
    rating: 'negative',
    intent: 'not_helpful',
    reviewItemId: 'review-001',
  },
} satisfies AssistantSuccessEnvelope<FeedbackAcceptedData>

export const feedbackNeutralSuccessResponse = {
  requestId: 'req-feedback-neutral-001',
  data: {
    feedbackEventId: 'feedback-neutral-001',
    messageId: 'msg-assistant-001',
    rating: 'neutral',
    intent: 'other',
    reviewItemId: null,
  },
} satisfies AssistantSuccessEnvelope<FeedbackAcceptedData>

export const actionDraftDetailResponse = {
  requestId: 'req-action-draft-detail-001',
  data: {
    id: 'action-draft-001',
    requestId: 'req-action-draft-001',
    messageId: 'msg-assistant-confirmation-001',
    status: 'waiting_confirmation',
    riskLevel: 'medium',
    toolName: 'mock.orders.status.update',
    resource: 'orders',
    operation: 'update',
    preview: {
      targetEntityId: 'SO-10001',
      status: 'cancelled',
    },
    expiresAt: '2026-06-23T09:15:00.000Z',
  },
} satisfies AssistantSuccessEnvelope<ActionDraftSummary>

export const actionDraftConfirmSuccessResponse = {
  requestId: 'req-action-draft-confirm-001',
  data: {
    actionDraftId: 'action-draft-001',
    status: 'confirmed',
    duplicateSafe: true,
    recheck: {
      organizationBoundary: 'passed',
      draftStatus: 'passed',
      freshness: 'passed',
      permission: 'pending_execution_guard',
      toolContract: 'pending_execution_guard',
      idempotency: 'reserved',
    },
  },
} satisfies AssistantSuccessEnvelope<ActionDraftConfirmResult>

export const actionDraftConfirmDuplicateResponse = {
  requestId: 'req-action-draft-confirm-duplicate-001',
  data: {
    actionDraftId: 'action-draft-001',
    status: 'confirmed',
    duplicateSafe: true,
    recheck: {
      organizationBoundary: 'passed',
      draftStatus: 'passed',
      freshness: 'passed',
      permission: 'pending_execution_guard',
      toolContract: 'pending_execution_guard',
      idempotency: 'duplicate',
    },
  },
} satisfies AssistantSuccessEnvelope<ActionDraftConfirmResult>

export const actionDraftCancelSuccessResponse = {
  requestId: 'req-action-draft-cancel-001',
  data: {
    actionDraftId: 'action-draft-001',
    status: 'cancelled',
  },
} satisfies AssistantSuccessEnvelope<ActionDraftCancelResult>

export const approvalRequestDetailResponse = {
  requestId: 'req-approval-detail-001',
  data: {
    id: 'approval-request-001',
    requestId: 'req-approval-001',
    sessionId: 'session-001',
    messageId: 'msg-assistant-approval-001',
    status: 'pending',
    riskLevel: 'high',
    requesterActorId: 'actor-001',
    approverActorId: null,
    actionSummary: {
      toolName: 'mock.orders.cancel',
      resource: 'orders',
      operation: 'update',
    },
    payloadSummary: {
      targetEntityId: 'SO-10001',
    },
    expiresAt: '2026-06-23T09:30:00.000Z',
    evidenceRefIds: ['evidence-structured-001'],
  },
} satisfies AssistantSuccessEnvelope<ApprovalRequestSummary>

export const sessionNotFoundErrorResponse = {
  requestId: 'req-session-hidden-001',
  error: {
    code: 'not_found',
    message: 'Assistant session not found.',
    statusCode: 404,
  },
} satisfies AssistantErrorEnvelope

export const backendErrorWithoutStatusCodeResponse = {
  requestId: 'req-backend-safe-error-001',
  error: {
    code: 'assistant_unavailable',
    message: 'Assistant service is temporarily unavailable.',
  },
} satisfies AssistantErrorEnvelope
