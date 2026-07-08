import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  AssistantFeedbackValue,
  AssistantMessageFeedbackUiState,
  AssistantMessageFinalData,
  AssistantMessageId,
  AssistantRequestId,
  AssistantSession,
  AssistantSessionScope,
  AssistantSseEvent,
  AssistantStreamingActivity,
  AssistantStreamingStatus,
  AssistantStreamingUiMessage,
  AssistantUiMessage,
  HistoryMessageSummary,
  UserUiMessage,
} from '../../types/assistant'
import { mapAnswerDecisionState } from '../../utils/assistant/answerDecisionStateMapper'
import { normalizeEvidenceReferences } from '../../utils/assistant/evidenceNormalizationAdapter'
import type { AssistantSessionRecoveryReason } from '../../utils/assistant/sessionRecovery'

export type AssistantSessionLifecycleState =
  | 'idle'
  | 'restoring'
  | 'creating'
  | 'loading_history'
  | 'ready'
  | 'error'

export interface AssistantSessionSafeError {
  code: string
  safeMessage: string
}

export type AssistantRenderableMessage =
  | AssistantUiMessage
  | HistoryMessageSummary

type AssistantNonFinalSseEvent = Exclude<
  AssistantSseEvent,
  { eventType: 'final' }
>

type AssistantFinalSseEvent = Extract<
  AssistantSseEvent,
  { eventType: 'final' }
>

function createFinalDecisionStateInput(
  finalData: AssistantMessageFinalData,
): AssistantMessageFinalData {
  return {
    answerDecision: finalData.answerDecision,
    answer: finalData.answer,
    noAnswerReason: finalData.noAnswerReason,
    evidenceRefs: finalData.evidenceRefs,
    clarificationQuestionId: finalData.clarificationQuestionId,
    actionDraftId: finalData.actionDraftId,
    approvalRequestId: finalData.approvalRequestId,
    escalationRequestId: finalData.escalationRequestId,
  }
}

const TOOL_ACTIVITY = {
  tool_call_started: {
    kind: 'tool_running',
    label: '正在查詢內部資料',
  },
  tool_call_completed: {
    kind: 'tool_completed',
    label: '內部資料查詢完成',
  },
  tool_call_blocked: {
    kind: 'tool_blocked',
    label: '內部資料查詢受到限制',
  },
  tool_call_failed: {
    kind: 'tool_failed',
    label: '內部資料查詢未完成',
  },
} as const satisfies Record<
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'tool_call_blocked'
  | 'tool_call_failed',
  Pick<AssistantStreamingActivity, 'kind' | 'label'>
>

const MIN_TYPING_VISIBILITY_MS = 600

export interface AssistantSessionStoreState {
  status: AssistantSessionLifecycleState
  session: AssistantSession | null
  sessionScope: AssistantSessionScope | null
  messages: AssistantRenderableMessage[]
  nextCursor: string | null
  historyLoading: boolean
  historyLoadingMore: boolean
  contextReady: boolean
  activeRequestId: AssistantRequestId | null
  activeAssistantMessageKey: string | null
  lastError: AssistantSessionSafeError | null
  recoveryReason: AssistantSessionRecoveryReason | null
}

function createInitialState(): AssistantSessionStoreState {
  return {
    status: 'idle',
    session: null,
    sessionScope: null,
    messages: [],
    nextCursor: null,
    historyLoading: false,
    historyLoadingMore: false,
    contextReady: false,
    activeRequestId: null,
    activeAssistantMessageKey: null,
    lastError: null,
    recoveryReason: null,
  }
}

export const useAssistantSessionStore = defineStore('assistant-session', () => {
  const initial = createInitialState()

  const status = ref<AssistantSessionLifecycleState>(initial.status)
  const session = ref<AssistantSession | null>(initial.session)
  const sessionScope = ref<AssistantSessionScope | null>(initial.sessionScope)
  const messages = ref<AssistantRenderableMessage[]>(initial.messages)
  const nextCursor = ref<string | null>(initial.nextCursor)
  const historyLoading = ref(initial.historyLoading)
  const historyLoadingMore = ref(initial.historyLoadingMore)
  const contextReady = ref(initial.contextReady)
  const activeRequestId = ref<AssistantRequestId | null>(initial.activeRequestId)
  const activeAssistantMessageKey = ref<string | null>(
    initial.activeAssistantMessageKey,
  )
  const feedbackByMessageId = ref<
    Record<AssistantMessageId, AssistantMessageFeedbackUiState>
  >({})
  const lastError = ref<AssistantSessionSafeError | null>(initial.lastError)
  const recoveryReason = ref<AssistantSessionRecoveryReason | null>(
    initial.recoveryReason,
  )
  const pendingRevealTimers = new Map<
    AssistantRequestId,
    ReturnType<typeof setTimeout>
  >()

  const sessionId = computed(() => session.value?.sessionId ?? null)

  function getActiveStreamingMessage(
    requestId?: AssistantRequestId | null,
  ): AssistantStreamingUiMessage | null {
    const targetRequestId = requestId ?? activeRequestId.value
    if (!targetRequestId || targetRequestId !== activeRequestId.value) {
      return null
    }

    const message = messages.value.find(
      candidate =>
        'key' in candidate
        && candidate.key === activeAssistantMessageKey.value
        && candidate.kind === 'assistant_streaming',
    )

    return message && 'status' in message ? message : null
  }

  function clearPendingRevealTimer(requestId: AssistantRequestId | null) {
    if (!requestId) {
      return
    }

    const timer = pendingRevealTimers.get(requestId)
    if (timer) {
      clearTimeout(timer)
      pendingRevealTimers.delete(requestId)
    }
  }

  function revealPendingStreamingContent(
    requestId?: AssistantRequestId | null,
    terminalStatus?: Extract<
      AssistantStreamingStatus,
      'completed' | 'interrupted' | 'failed' | 'cancelled'
    >,
  ) {
    const message = getActiveStreamingMessage(requestId)
    if (!message) {
      return
    }

    if (message.pendingContent) {
      message.content = `${message.content}${message.pendingContent}`
      message.pendingContent = ''
    }

    message.typingVisibleUntil = null
    clearPendingRevealTimer(message.requestId ?? requestId ?? null)

    if (message.pendingFinalAnswerDecision) {
      message.finalAnswerDecision = message.pendingFinalAnswerDecision
      message.pendingFinalAnswerDecision = undefined
      message.status = 'completed'
      if (requestId && activeRequestId.value === requestId) {
        activeRequestId.value = null
        activeAssistantMessageKey.value = null
      }
      return
    }

    if (terminalStatus) {
      message.status = terminalStatus
      return
    }

    if (message.content.length > 0) {
      message.status = 'streaming'
    }
  }

  function schedulePendingStreamingContentReveal(
    requestId: AssistantRequestId,
    message: AssistantStreamingUiMessage,
  ) {
    const remaining = (message.typingVisibleUntil ?? 0) - Date.now()

    if (remaining <= 0) {
      revealPendingStreamingContent(requestId)
      return
    }

    if (pendingRevealTimers.has(requestId)) {
      return
    }

    pendingRevealTimers.set(
      requestId,
      setTimeout(() => {
        pendingRevealTimers.delete(requestId)
        revealPendingStreamingContent(requestId)
      }, remaining),
    )
  }

  function setRestoring() {
    resetSessionState()
    status.value = 'restoring'
  }

  function setCreating() {
    status.value = 'creating'
    historyLoading.value = false
    historyLoadingMore.value = false
  }

  function setLoadingHistory(mode: 'initial' | 'more' = 'initial') {
    status.value = 'loading_history'
    historyLoading.value = mode === 'initial'
    historyLoadingMore.value = mode === 'more'
  }

  function setReady() {
    status.value = 'ready'
    historyLoading.value = false
    historyLoadingMore.value = false
  }

  function setError(
    error: AssistantSessionSafeError,
    nextRecoveryReason: AssistantSessionRecoveryReason | null,
  ) {
    status.value = 'error'
    historyLoading.value = false
    historyLoadingMore.value = false
    lastError.value = error
    recoveryReason.value = nextRecoveryReason
  }

  function setLastError(
    error: AssistantSessionSafeError,
    nextRecoveryReason: AssistantSessionRecoveryReason | null,
  ) {
    lastError.value = error
    recoveryReason.value = nextRecoveryReason
  }

  function clearError() {
    lastError.value = null
    recoveryReason.value = null
  }

  function setSession(nextSession: AssistantSession | null) {
    session.value = nextSession
  }

  function setSessionScope(nextSessionScope: AssistantSessionScope | null) {
    sessionScope.value = nextSessionScope
  }

  function setContextReady(nextContextReady: boolean) {
    contextReady.value = nextContextReady
  }

  function setMessages(
    nextMessages: AssistantRenderableMessage[],
    cursor: string | null,
  ) {
    messages.value = [...nextMessages]
    nextCursor.value = cursor
  }

  function appendHistoryPage(
    nextMessages: HistoryMessageSummary[],
    cursor: string | null,
  ) {
    const knownMessageIds = new Set(
      messages.value.flatMap(message =>
        'messageId' in message && message.messageId
          ? [message.messageId]
          : [],
      ),
    )

    messages.value.push(
      ...nextMessages.filter((message) => {
        if (knownMessageIds.has(message.messageId)) {
          return false
        }

        knownMessageIds.add(message.messageId)
        return true
      }),
    )
    nextCursor.value = cursor
  }

  function appendMessages(
    nextMessages: HistoryMessageSummary[],
    cursor: string | null,
  ) {
    appendHistoryPage(nextMessages, cursor)
  }

  function appendUserMessage(message: UserUiMessage) {
    messages.value.push(message)
  }

  function getFeedbackState(
    messageId: AssistantMessageId,
  ): AssistantMessageFeedbackUiState {
    return (
      feedbackByMessageId.value[messageId] ?? {
        value: null,
        pending: false,
        error: null,
        requestId: null,
      }
    )
  }

  function startFeedbackSubmission(
    messageId: AssistantMessageId,
    value: AssistantFeedbackValue,
    requestId: AssistantRequestId | null,
  ) {
    feedbackByMessageId.value = {
      ...feedbackByMessageId.value,
      [messageId]: {
        value,
        pending: true,
        error: null,
        requestId,
      },
    }
  }

  function completeFeedbackSubmission(messageId: AssistantMessageId) {
    const currentState = getFeedbackState(messageId)

    feedbackByMessageId.value = {
      ...feedbackByMessageId.value,
      [messageId]: {
        ...currentState,
        pending: false,
        error: null,
      },
    }
  }

  function failFeedbackSubmission(
    messageId: AssistantMessageId,
    previousValue: AssistantFeedbackValue | null,
    requestId: AssistantRequestId | null,
    error: string,
  ) {
    feedbackByMessageId.value = {
      ...feedbackByMessageId.value,
      [messageId]: {
        value: previousValue,
        pending: false,
        error,
        requestId,
      },
    }
  }

  function appendAssistantStreamingPlaceholder(
    message: AssistantStreamingUiMessage,
  ) {
    message.typingVisibleUntil ??= Date.now() + MIN_TYPING_VISIBILITY_MS
    message.pendingContent ??= ''
    messages.value.push(message)
  }

  function setStreamingRequest(
    requestId: AssistantRequestId,
    assistantMessageKey: string,
  ) {
    activeRequestId.value = requestId
    activeAssistantMessageKey.value = assistantMessageKey
  }

  function updateActiveStreamingStatus(nextStatus: AssistantStreamingStatus) {
    const message = getActiveStreamingMessage()
    if (message) {
      message.status = nextStatus
    }
  }

  function applyStreamingEvent(event: AssistantNonFinalSseEvent) {
    const message = getActiveStreamingMessage(event.requestId)
    if (
      !message
      || (message.lastSequence !== null && event.sequence <= message.lastSequence)
    ) {
      return
    }

    message.messageId = event.messageId
    message.lastSequence = event.sequence

    if (event.eventType === 'answer_delta') {
      if ((message.typingVisibleUntil ?? 0) > Date.now()) {
        message.pendingContent = `${message.pendingContent ?? ''}${event.data.delta}`
        message.status = 'streaming'
        schedulePendingStreamingContentReveal(event.requestId, message)
        return
      }

      if (message.pendingContent) {
        message.content = `${message.content}${message.pendingContent}`
        message.pendingContent = ''
      }

      message.typingVisibleUntil = null
      clearPendingRevealTimer(event.requestId)
      message.content += event.data.delta
      message.status = 'streaming'
      return
    }

    if (event.eventType === 'evidence_attached') {
      const knownEvidenceIds = new Set(
        message.evidence.map(reference => reference.id),
      )
      message.evidence.push(
        ...event.data.evidenceRefs
          .filter(id => !knownEvidenceIds.has(id))
          .map(id => ({
            kind: 'reference' as const,
            id,
          })),
      )
      return
    }

    if (
      event.eventType === 'tool_call_started'
      || event.eventType === 'tool_call_completed'
      || event.eventType === 'tool_call_blocked'
      || event.eventType === 'tool_call_failed'
    ) {
      const activity = TOOL_ACTIVITY[event.eventType]
      const activities = message.activities ?? []
      const activityKey = `tool:${event.data.toolCallId}`
      const nextActivity = {
        key: activityKey,
        kind: activity.kind,
        sequence: event.sequence,
        label: activity.label,
        toolCallId: event.data.toolCallId,
      } satisfies AssistantStreamingActivity
      const existingIndex = activities.findIndex(
        candidate => candidate.key === activityKey,
      )

      if (existingIndex === -1) {
        activities.push(nextActivity)
      }
      else {
        activities.splice(existingIndex, 1, nextActivity)
      }

      message.activities = activities
      return
    }

    if (event.eventType === 'error') {
      revealPendingStreamingContent(event.requestId, 'failed')
      message.activities = [
        ...(message.activities ?? []),
        {
          key: `stream-error:${event.sequence}`,
          kind: 'stream_error',
          sequence: event.sequence,
          label: '回應串流未能完成',
        },
      ]
    }
  }

  function recordUnknownStreamingEvent(
    requestId: AssistantRequestId,
    messageId: string,
    sequence: number,
  ) {
    const message = getActiveStreamingMessage(requestId)
    if (
      !message
      || (message.lastSequence !== null && sequence <= message.lastSequence)
    ) {
      return
    }

    message.messageId = messageId
    message.lastSequence = sequence
    message.activities = [
      ...(message.activities ?? []),
      {
        key: `unknown:${sequence}`,
        kind: 'unknown_event',
        sequence,
        label: '收到未識別的進度更新，已安全略過',
      },
    ]
  }

  function finalizeActiveStreamingMessage(event: AssistantFinalSseEvent) {
    const message = getActiveStreamingMessage(event.requestId)
    if (
      !message
      || (message.lastSequence !== null && event.sequence <= message.lastSequence)
    ) {
      return
    }

    message.messageId = event.messageId
    message.lastSequence = event.sequence
    const nextContent = event.data.answer ?? message.content
    const normalizedEvidence = normalizeEvidenceReferences(event.data.evidenceRefs)
    const finalDecisionState = mapAnswerDecisionState(
      createFinalDecisionStateInput(event.data),
    )

    if (
      (message.typingVisibleUntil ?? 0) > Date.now()
      && message.content.length === 0
    ) {
      message.pendingContent = nextContent
      message.pendingFinalAnswerDecision = event.data.answerDecision
      message.evidence = normalizedEvidence
      message.finalDecisionState = finalDecisionState
      message.status = 'finalizing'
      schedulePendingStreamingContentReveal(event.requestId, message)
      return
    }

    if (message.pendingContent) {
      message.content = `${message.content}${message.pendingContent}`
      message.pendingContent = ''
    }

    message.typingVisibleUntil = null
    clearPendingRevealTimer(event.requestId)
    message.content = nextContent
    message.evidence = normalizedEvidence
    message.finalAnswerDecision = event.data.answerDecision
    message.finalDecisionState = finalDecisionState
    message.pendingFinalAnswerDecision = undefined
    message.status = 'completed'
  }

  function markStreamingStarted() {
    updateActiveStreamingStatus('streaming')
  }

  function markStreamingCancelled() {
    const message = getActiveStreamingMessage()
    if (message && message.status !== 'completed') {
      revealPendingStreamingContent(message.requestId, 'cancelled')
    }
  }

  function markStreamingInterrupted() {
    const message = getActiveStreamingMessage()
    if (
      message
      && message.status !== 'completed'
      && message.status !== 'failed'
    ) {
      revealPendingStreamingContent(message.requestId, 'interrupted')
    }
  }

  function markStreamingFailed() {
    const message = getActiveStreamingMessage()
    if (message && message.status !== 'completed') {
      revealPendingStreamingContent(message.requestId, 'failed')
    }
  }

  function markStreamingFinalizing() {
    updateActiveStreamingStatus('finalizing')
  }

  function clearStreamingState() {
    const message = getActiveStreamingMessage()
    if (
      message?.pendingFinalAnswerDecision
      && (message.typingVisibleUntil ?? 0) > Date.now()
    ) {
      return
    }

    clearPendingRevealTimer(activeRequestId.value)
    activeRequestId.value = null
    activeAssistantMessageKey.value = null
  }

  function resetSessionState() {
    for (const timer of pendingRevealTimers.values()) {
      clearTimeout(timer)
    }
    pendingRevealTimers.clear()
    const initial = createInitialState()
    status.value = initial.status
    session.value = initial.session
    sessionScope.value = initial.sessionScope
    messages.value = initial.messages
    nextCursor.value = initial.nextCursor
    historyLoading.value = initial.historyLoading
    historyLoadingMore.value = initial.historyLoadingMore
    contextReady.value = initial.contextReady
    activeRequestId.value = initial.activeRequestId
    activeAssistantMessageKey.value = initial.activeAssistantMessageKey
    feedbackByMessageId.value = {}
    lastError.value = initial.lastError
    recoveryReason.value = initial.recoveryReason
  }

  return {
    status,
    session,
    sessionScope,
    messages,
    nextCursor,
    historyLoading,
    historyLoadingMore,
    contextReady,
    activeRequestId,
    activeAssistantMessageKey,
    feedbackByMessageId,
    lastError,
    recoveryReason,
    sessionId,
    getActiveStreamingMessage,
    setRestoring,
    setCreating,
    setLoadingHistory,
    setReady,
    setError,
    setLastError,
    clearError,
    setSession,
    setSessionScope,
    setContextReady,
    setMessages,
    appendHistoryPage,
    appendMessages,
    appendUserMessage,
    getFeedbackState,
    startFeedbackSubmission,
    completeFeedbackSubmission,
    failFeedbackSubmission,
    appendAssistantStreamingPlaceholder,
    setStreamingRequest,
    updateActiveStreamingStatus,
    applyStreamingEvent,
    recordUnknownStreamingEvent,
    finalizeActiveStreamingMessage,
    markStreamingStarted,
    markStreamingCancelled,
    markStreamingInterrupted,
    markStreamingFailed,
    markStreamingFinalizing,
    clearStreamingState,
    resetSessionState,
  }
})
