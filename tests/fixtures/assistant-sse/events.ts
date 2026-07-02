import type {
  AssistantSseEvent,
  AssistantSseEventInput,
  AssistantUnknownSseEvent,
} from '../../../app/types/assistant'

export const toolCallStartedEvent = {
  requestId: 'req-structured-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-structured-001',
  eventType: 'tool_call_started',
  sequence: 1,
  data: {
    toolCallId: 'tool-call-001',
    toolName: 'mock.orders.status.read',
  },
} satisfies AssistantSseEvent

export const toolCallCompletedEvent = {
  requestId: 'req-structured-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-structured-001',
  eventType: 'tool_call_completed',
  sequence: 2,
  data: {
    toolCallId: 'tool-call-001',
    toolName: 'mock.orders.status.read',
    status: 'completed',
    executionStatus: 'executed',
  },
} satisfies AssistantSseEvent

export const evidenceAttachedEvent = {
  requestId: 'req-structured-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-structured-001',
  eventType: 'evidence_attached',
  sequence: 3,
  data: {
    evidenceRefs: ['evidence-structured-001'],
  },
} satisfies AssistantSseEvent

export const answerDeltaEvent = {
  requestId: 'req-structured-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-structured-001',
  eventType: 'answer_delta',
  sequence: 4,
  data: {
    delta: 'SO-10001 目前狀態為 confirmed。',
  },
} satisfies AssistantSseEvent

export const finalAnsweredIdOnlyEvent = {
  requestId: 'req-structured-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-structured-001',
  eventType: 'final',
  sequence: 5,
  data: {
    answerDecision: 'answered',
    answer: 'SO-10001 目前狀態為 confirmed。',
    evidenceRefs: ['evidence-structured-001'],
  },
} satisfies AssistantSseEvent

export const finalAnsweredSummaryEvent = {
  requestId: 'req-document-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-document-001',
  eventType: 'final',
  sequence: 1,
  data: {
    answerDecision: 'answered',
    answer: '退貨需先建立退貨申請，再由倉儲確認入庫。',
    evidenceRefs: [
      {
        id: 'evidence-document-001',
        sourceType: 'document_chunk',
        sourceId: 'return-policy',
        title: '退貨流程 SOP',
        snippet: '建立退貨申請後，由倉儲確認入庫。',
      },
    ],
  },
} satisfies AssistantSseEvent

export const toolCallBlockedEvent = {
  requestId: 'req-tool-blocked-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-blocked-001',
  eventType: 'tool_call_blocked',
  sequence: 1,
  data: {
    toolCallId: 'tool-call-blocked-001',
    toolName: 'mock.orders.status.read',
    status: 'blocked',
    executionStatus: 'not_executed',
    deniedReason: 'permission_denied',
  },
} satisfies AssistantSseEvent

export const toolFailureStartedEvent = {
  requestId: 'req-tool-failure-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-tool-failure-001',
  eventType: 'tool_call_started',
  sequence: 1,
  data: {
    toolCallId: 'tool-call-failure-001',
    toolName: 'mock.orders.status.read',
  },
} satisfies AssistantSseEvent

export const toolCallFailedEvent = {
  requestId: 'req-tool-failure-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-tool-failure-001',
  eventType: 'tool_call_failed',
  sequence: 2,
  data: {
    toolCallId: 'tool-call-failure-001',
    toolName: 'mock.orders.status.read',
    status: 'failed',
    executionStatus: 'failed',
    errorCode: 'connector_unavailable',
  },
} satisfies AssistantSseEvent

export const finalToolFailureEvent = {
  requestId: 'req-tool-failure-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-tool-failure-001',
  eventType: 'final',
  sequence: 3,
  data: {
    answerDecision: 'no_answer',
    noAnswerReason: 'tool_failure',
    answer: '目前無法安全產生確定答案，請稍後再試。',
    evidenceRefs: [],
  },
} satisfies AssistantSseEvent

export const finalClarificationRequiredEvent = {
  requestId: 'req-clarification-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-clarification-001',
  eventType: 'final',
  sequence: 1,
  data: {
    answerDecision: 'clarification_required',
    clarificationQuestionId: 'clarification-001',
    answer: '你選取了多筆資料，請指定要查詢哪一筆。',
    evidenceRefs: [],
  },
} satisfies AssistantSseEvent

export const finalNoEvidenceEvent = {
  requestId: 'req-no-evidence-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-no-evidence-001',
  eventType: 'final',
  sequence: 1,
  data: {
    answerDecision: 'no_answer',
    noAnswerReason: 'no_evidence',
    answer: '目前沒有足夠證據可以安全回答。',
    evidenceRefs: [],
  },
} satisfies AssistantSseEvent

export const finalPermissionDeniedEvent = {
  requestId: 'req-tool-blocked-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-blocked-001',
  eventType: 'final',
  sequence: 2,
  data: {
    answerDecision: 'permission_denied',
    noAnswerReason: 'permission_denied',
    answer: '你目前沒有權限取得此資訊。',
    evidenceRefs: [],
  },
} satisfies AssistantSseEvent

export const confirmationRequiredEvent = {
  requestId: 'req-confirmation-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-confirmation-001',
  eventType: 'confirmation_required',
  sequence: 1,
  data: {
    actionDraftId: 'action-draft-001',
    requestId: 'req-confirmation-001',
    messageId: 'msg-assistant-confirmation-001',
    riskLevel: 'medium',
    preview: {
      targetEntityId: 'SO-10001',
      status: 'cancelled',
    },
    expiresAt: '2026-06-23T09:15:00.000Z',
  },
} satisfies AssistantSseEvent

export const finalConfirmationRequiredEvent = {
  requestId: 'req-confirmation-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-confirmation-001',
  eventType: 'final',
  sequence: 2,
  data: {
    answerDecision: 'confirmation_required',
    answer: '請確認是否送出此操作。',
    evidenceRefs: [],
    actionDraftId: 'action-draft-001',
  },
} satisfies AssistantSseEvent

export const approvalRequiredEvent = {
  requestId: 'req-approval-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-approval-001',
  eventType: 'approval_required',
  sequence: 1,
  data: {
    approvalRequestId: 'approval-request-001',
    requestId: 'req-approval-001',
    messageId: 'msg-assistant-approval-001',
    riskLevel: 'high',
    actionSummary: {
      targetEntityId: 'SO-10001',
      operation: 'cancel',
    },
    expiresAt: '2026-06-23T09:30:00.000Z',
  },
} satisfies AssistantSseEvent

export const finalApprovalRequiredEvent = {
  requestId: 'req-approval-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-approval-001',
  eventType: 'final',
  sequence: 2,
  data: {
    answerDecision: 'approval_required',
    answer: '此操作需要額外核准。',
    evidenceRefs: ['evidence-structured-001'],
    approvalRequestId: 'approval-request-001',
  },
} satisfies AssistantSseEvent

export const escalationRequiredEvent = {
  requestId: 'req-escalation-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-escalation-001',
  eventType: 'escalation_required',
  sequence: 1,
  data: {
    escalationRequestId: 'escalation-request-001',
    requestId: 'req-escalation-001',
    messageId: 'msg-assistant-escalation-001',
    riskLevel: 'critical',
    reasonCode: 'manual_review_required',
    reasonSummary: '此操作需要人工介入。',
    actionSummary: {
      targetEntityId: 'SO-10001',
      operation: 'cancel',
    },
  },
} satisfies AssistantSseEvent

export const finalEscalationRequiredEvent = {
  requestId: 'req-escalation-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-escalation-001',
  eventType: 'final',
  sequence: 2,
  data: {
    answerDecision: 'escalation_required',
    answer: '此操作需要人工介入。',
    evidenceRefs: [],
    escalationRequestId: 'escalation-request-001',
  },
} satisfies AssistantSseEvent

export const errorEvent = {
  requestId: 'req-stream-error-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-error-001',
  eventType: 'error',
  sequence: 1,
  data: {
    code: 'stream_failed',
    message: 'The assistant stream could not be completed.',
  },
} satisfies AssistantSseEvent

export const partialBeforeErrorEvent = {
  requestId: 'req-partial-error-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-partial-error-001',
  eventType: 'answer_delta',
  sequence: 1,
  data: {
    delta: '這是一段尚未完成的回答。',
  },
} satisfies AssistantSseEvent

export const interruptedAnswerDeltaEvent = {
  requestId: 'req-interrupted-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-interrupted-001',
  eventType: 'answer_delta',
  sequence: 1,
  data: {
    delta: '這是一段在 final 前中斷的回答。',
  },
} satisfies AssistantSseEvent

export const errorAfterPartialEvent = {
  requestId: 'req-partial-error-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-partial-error-001',
  eventType: 'error',
  sequence: 2,
  data: {
    code: 'stream_interrupted',
    message: 'The stream ended before a final decision was received.',
  },
} satisfies AssistantSseEvent

export const unknownEvent = {
  requestId: 'req-unknown-event-001',
  sessionId: 'session-001',
  messageId: 'msg-assistant-unknown-001',
  eventType: 'progress_hint',
  sequence: 1,
  data: {
    safeMessage: 'Processing continues.',
  },
} satisfies AssistantUnknownSseEvent

export const answeredIdOnlyStream = [
  toolCallStartedEvent,
  toolCallCompletedEvent,
  evidenceAttachedEvent,
  answerDeltaEvent,
  finalAnsweredIdOnlyEvent,
] satisfies readonly AssistantSseEvent[]

export const answeredSummaryStream = [
  finalAnsweredSummaryEvent,
] satisfies readonly AssistantSseEvent[]

export const clarificationStream = [
  finalClarificationRequiredEvent,
] satisfies readonly AssistantSseEvent[]

export const noEvidenceStream = [
  finalNoEvidenceEvent,
] satisfies readonly AssistantSseEvent[]

export const toolFailureStream = [
  toolFailureStartedEvent,
  toolCallFailedEvent,
  finalToolFailureEvent,
] satisfies readonly AssistantSseEvent[]

export const permissionDeniedStream = [
  toolCallBlockedEvent,
  finalPermissionDeniedEvent,
] satisfies readonly AssistantSseEvent[]

export const confirmationRequiredStream = [
  confirmationRequiredEvent,
  finalConfirmationRequiredEvent,
] satisfies readonly AssistantSseEvent[]

export const approvalRequiredStream = [
  approvalRequiredEvent,
  finalApprovalRequiredEvent,
] satisfies readonly AssistantSseEvent[]

export const escalationRequiredStream = [
  escalationRequiredEvent,
  finalEscalationRequiredEvent,
] satisfies readonly AssistantSseEvent[]

export const interruptedStreamSeed = [
  interruptedAnswerDeltaEvent,
] satisfies readonly AssistantSseEvent[]

export const errorAfterPartialStream = [
  partialBeforeErrorEvent,
  errorAfterPartialEvent,
] satisfies readonly AssistantSseEvent[]

export const unknownEventStream = [
  unknownEvent,
] satisfies readonly AssistantSseEventInput[]
