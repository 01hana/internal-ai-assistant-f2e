import { defineStore } from 'pinia'
import type {
  AssistantSession,
  AssistantSessionScope,
  HistoryMessageSummary,
} from '../../types/assistant'
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

export interface AssistantSessionStoreState {
  status: AssistantSessionLifecycleState
  session: AssistantSession | null
  sessionScope: AssistantSessionScope | null
  messages: HistoryMessageSummary[]
  nextCursor: string | null
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
    lastError: null,
    recoveryReason: null,
  }
}

export const useAssistantSessionStore = defineStore('assistant-session', {
  state: createInitialState,

  actions: {
    setRestoring() {
      Object.assign(this, createInitialState(), {
        status: 'restoring' as const,
      })
    },

    setCreating() {
      this.status = 'creating'
    },

    setLoadingHistory() {
      this.status = 'loading_history'
    },

    setReady() {
      this.status = 'ready'
    },

    setError(
      error: AssistantSessionSafeError,
      recoveryReason: AssistantSessionRecoveryReason | null,
    ) {
      this.status = 'error'
      this.lastError = error
      this.recoveryReason = recoveryReason
    },

    setLastError(
      error: AssistantSessionSafeError,
      recoveryReason: AssistantSessionRecoveryReason | null,
    ) {
      this.lastError = error
      this.recoveryReason = recoveryReason
    },

    clearError() {
      this.lastError = null
      this.recoveryReason = null
    },

    setSession(session: AssistantSession | null) {
      this.session = session
    },

    setSessionScope(sessionScope: AssistantSessionScope | null) {
      this.sessionScope = sessionScope
    },

    setMessages(
      messages: HistoryMessageSummary[],
      nextCursor: string | null,
    ) {
      this.messages = [...messages]
      this.nextCursor = nextCursor
    },

    appendMessages(
      messages: HistoryMessageSummary[],
      nextCursor: string | null,
    ) {
      this.messages.push(...messages)
      this.nextCursor = nextCursor
    },

    resetSessionState() {
      Object.assign(this, createInitialState())
    },
  },
})
