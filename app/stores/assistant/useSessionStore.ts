import { defineStore, getActivePinia } from 'pinia'
import type {
  ActionDraftDetail,
  ActionDraftDetailState,
  ActionDraftId,
  ActionDraftOperationStatus,
  ActionDraftRecheck,
  ActionDraftStatus,
  ApprovalRequestDetailState,
  ApprovalRequestId,
  ApprovalRequestSummary,
  AssistantFeedbackValue,
  AssistantMessageFeedbackUiState,
  AssistantMessageFinalData,
  AssistantMessageId,
  AssistantRequestId,
  AssistantSession,
  AssistantSessionScope,
  AssistantSseEvent,
  AssistantStreamingStatus,
  AssistantStreamingUiMessage,
  AssistantSystemStateMessage,
  AssistantUiMessage,
  HistoryMessageSummary,
  UserUiMessage,
} from '../../types/assistant'
import type { AssistantSessionRecoveryReason } from '../../utils/assistant/sessionRecovery'
import { generateAssistantRequestId } from '../../utils/assistant/requestIdGenerator'
import {
  createAssistantRuntimeController,
  createAssistantRuntimeStores,
  type AssistantRuntimeController,
  type AssistantRuntimeTransportPort,
} from '../../../packages/assistant-runtime/src'

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

const DEGRADED_MESSAGE_KEY = 'system:degraded-state'
export const FRONTEND001_RUNTIME_SCOPE = 'frontend001:assistant-session'

function unsupportedStoreTransportResult<T>(
  operation: string,
): Promise<{ ok: false, error: { code: string, message: string, retryable: false } }> {
  return Promise.resolve({
    ok: false,
    error: {
      code: 'assistant_runtime_frontend001_store_transport_unavailable',
      message: `${operation} is provided by the Frontend 001 composable adapter.`,
      retryable: false,
    },
  })
}

function createFrontend001StoreTransport(): Pick<
  AssistantRuntimeTransportPort,
  'createSession' | 'loadHistory' | 'cancelMessage' | 'abortMessage'
> {
  return {
    createSession: () => unsupportedStoreTransportResult('createSession'),
    loadHistory: () => unsupportedStoreTransportResult('loadHistory'),
    cancelMessage: () => unsupportedStoreTransportResult('cancelMessage'),
    abortMessage: () => unsupportedStoreTransportResult('abortMessage'),
  }
}

function getApprovalRequestIdFromHistoryMessage(
  message: HistoryMessageSummary,
): ApprovalRequestId | null {
  return message.answerDecision === 'approval_required'
    ? (message.approvalRequestId ?? null)
    : null
}

function linkApprovalRequestsFromHistory(
  controller: AssistantRuntimeController<AssistantRenderableMessage>,
  messages: readonly AssistantRenderableMessage[],
) {
  for (const message of messages) {
    if (!('kind' in message) && message.role === 'assistant') {
      const approvalRequestId = getApprovalRequestIdFromHistoryMessage(message)
      if (approvalRequestId) {
        controller.ensureApprovalRequestState(approvalRequestId, {
          messageId: message.messageId,
        })
      }
    }
  }
}

export const useAssistantSessionStore = defineStore('assistant-session', () => {
  const activePinia = getActivePinia()

  if (!activePinia) {
    throw new Error('assistant_frontend001_pinia_required')
  }

  const runtimeStores =
    createAssistantRuntimeStores<AssistantRenderableMessage>({
      pinia: activePinia,
      runtimeScope: FRONTEND001_RUNTIME_SCOPE,
    })
  const runtimeController =
    createAssistantRuntimeController<AssistantRenderableMessage>({
      runtimeScope: FRONTEND001_RUNTIME_SCOPE,
      stores: runtimeStores,
      transport: createFrontend001StoreTransport(),
      idGenerator: () => generateAssistantRequestId({ prefix: 'runtime' }),
    })
  const runtimeState = runtimeStores.session
  const status = runtimeState.status as Ref<AssistantSessionLifecycleState>
  const session = runtimeState.session as Ref<AssistantSession | null>
  const sessionScope = runtimeState.sessionScope as Ref<AssistantSessionScope | null>
  const messages = runtimeState.messages
  const nextCursor = runtimeState.nextCursor
  const historyLoading = runtimeState.historyLoading
  const historyLoadingMore = runtimeState.historyLoadingMore
  const contextReady = runtimeState.contextReady
  const activeRequestId = runtimeState.activeRequestId
  const activeAssistantMessageKey = runtimeState.activeAssistantMessageKey
  const feedbackByMessageId = runtimeState.feedbackByMessageId as Ref<
    Record<AssistantMessageId, AssistantMessageFeedbackUiState>
  >
  const actionDraftById = runtimeState.actionDraftById as Ref<
    Record<ActionDraftId, ActionDraftDetailState>
  >
  const approvalRequestById = runtimeState.approvalRequestById as Ref<
    Record<ApprovalRequestId, ApprovalRequestDetailState>
  >
  const approvalRequestMessageLinks =
    runtimeState.approvalRequestMessageLinks as Ref<
      Record<AssistantMessageId, ApprovalRequestId>
    >
  const lastError = runtimeState.lastError as Ref<AssistantSessionSafeError | null>
  const recoveryReason =
    runtimeState.recoveryReason as Ref<AssistantSessionRecoveryReason | null>
  const sessionId = runtimeState.sessionId

  function setMessages(
    nextMessages: AssistantRenderableMessage[],
    cursor: string | null,
  ) {
    runtimeController.setMessages(nextMessages, cursor)
    linkApprovalRequestsFromHistory(runtimeController, nextMessages)
  }

  function appendHistoryPage(
    nextMessages: HistoryMessageSummary[],
    cursor: string | null,
  ) {
    runtimeController.appendMessages(nextMessages, cursor)
    linkApprovalRequestsFromHistory(runtimeController, nextMessages)
  }

  function upsertDegradedMessage(input: {
    degradedKind: 'degraded' | 'unavailable'
    safeTitle: string
    content: string
  }) {
    const nextMessage = {
      key: DEGRADED_MESSAGE_KEY,
      kind: 'degraded',
      role: 'assistant',
      safeTitle: input.safeTitle,
      degradedKind: input.degradedKind,
      content: input.content,
      createdAt: new Date().toISOString(),
    } satisfies AssistantSystemStateMessage

    const existingIndex = messages.value.findIndex(
      message => 'kind' in message && message.key === DEGRADED_MESSAGE_KEY,
    )

    if (existingIndex === -1) {
      messages.value.push(nextMessage)
      return
    }

    messages.value.splice(existingIndex, 1, nextMessage)
  }

  function clearDegradedMessage() {
    const existingIndex = messages.value.findIndex(
      message => 'kind' in message && message.key === DEGRADED_MESSAGE_KEY,
    )

    if (existingIndex !== -1) {
      messages.value.splice(existingIndex, 1)
    }
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
    actionDraftById,
    approvalRequestById,
    approvalRequestMessageLinks,
    lastError,
    recoveryReason,
    sessionId,
    runtimeController,
    getActiveStreamingMessage: runtimeController.stores.session
      ? (requestId?: AssistantRequestId | null) =>
          runtimeController.stores.session.messages.value.find(
            message =>
              'kind' in message
              && message.kind === 'assistant_streaming'
              && message.key === activeAssistantMessageKey.value
              && (!requestId || message.requestId === requestId),
          ) as AssistantStreamingUiMessage | undefined ?? null
      : () => null,
    setRestoring: runtimeController.setRestoring,
    setCreating: runtimeController.setCreating,
    setLoadingHistory: runtimeController.setLoadingHistory,
    setReady: runtimeController.setReady,
    setError: runtimeController.setError,
    setLastError: runtimeController.setLastError,
    clearError: runtimeController.clearError,
    setSession: runtimeController.setSession,
    setSessionScope: runtimeController.setSessionScope,
    setContextReady: runtimeController.setContextReady,
    setMessages,
    appendHistoryPage,
    appendMessages: appendHistoryPage,
    appendUserMessage: (message: UserUiMessage) =>
      runtimeController.appendUserMessage(message),
    upsertDegradedMessage,
    clearDegradedMessage,
    getFeedbackState: runtimeController.getFeedbackState,
    startFeedbackSubmission: runtimeController.startFeedbackSubmission,
    completeFeedbackSubmission: runtimeController.completeFeedbackSubmission,
    failFeedbackSubmission: runtimeController.failFeedbackSubmission,
    getActionDraftState: runtimeController.getActionDraftState,
    startActionDraftDetailLoad: runtimeController.startActionDraftDetailLoad,
    completeActionDraftDetailLoad: runtimeController.completeActionDraftDetailLoad,
    failActionDraftDetailLoad: runtimeController.failActionDraftDetailLoad,
    setActionDraftOperationStatus: runtimeController.setActionDraftOperationStatus,
    completeActionDraftOperation: runtimeController.completeActionDraftOperation,
    failActionDraftOperation: runtimeController.failActionDraftOperation,
    getApprovalRequestState: runtimeController.getApprovalRequestState,
    ensureApprovalRequestState: runtimeController.ensureApprovalRequestState,
    startApprovalRequestDetailLoad: runtimeController.startApprovalRequestDetailLoad,
    completeApprovalRequestDetailLoad: runtimeController.completeApprovalRequestDetailLoad,
    failApprovalRequestDetailLoad: runtimeController.failApprovalRequestDetailLoad,
    startApprovalRequestOpenDetail: runtimeController.startApprovalRequestOpenDetail,
    completeApprovalRequestOpenDetail: runtimeController.completeApprovalRequestOpenDetail,
    failApprovalRequestOpenDetail: runtimeController.failApprovalRequestOpenDetail,
    appendAssistantStreamingPlaceholder: (message: AssistantStreamingUiMessage) =>
      runtimeController.appendAssistantStreamingPlaceholder(message),
    setStreamingRequest: runtimeController.setStreamingRequest,
    updateActiveStreamingStatus: (
      nextStatus: AssistantStreamingStatus,
    ) => runtimeController.updateActiveStreamingStatus(nextStatus),
    applyStreamingEvent: (event: AssistantNonFinalSseEvent) =>
      runtimeController.applyStreamingEvent(event),
    recordUnknownStreamingEvent: runtimeController.recordUnknownStreamingEvent,
    finalizeActiveStreamingMessage: (event: AssistantFinalSseEvent) =>
      runtimeController.finalizeActiveStreamingMessage(event),
    markStreamingStarted: runtimeController.markStreamingStarted,
    markStreamingCancelled: runtimeController.markStreamingCancelled,
    markStreamingInterrupted: runtimeController.markStreamingInterrupted,
    markStreamingFailed: runtimeController.markStreamingFailed,
    markStreamingFinalizing: runtimeController.markStreamingFinalizing,
    clearStreamingState: runtimeController.clearStreamingState,
    resetSessionState: runtimeController.reset,
  }
})
