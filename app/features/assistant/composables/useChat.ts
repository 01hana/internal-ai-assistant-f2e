import type { AssistantHostContextProvider } from '../../../types/assistant'
import type { AssistantSessionRecoveryReason } from '../../../utils/assistant/sessionRecovery'

export interface UseChatOptions {
  hostContextProvider?: AssistantHostContextProvider
}

const TERMINAL_RECOVERY_REASONS = new Set<AssistantSessionRecoveryReason>([
  'expired',
  'closed',
  'invisible',
  'not_found',
])

export function useChat(options: UseChatOptions = {}) {
  const widgetStore = useChatWidgetStore()
  const hostContextProvider = options.hostContextProvider
    ?? useAssistantHostContextAdapter()
  const hostContext = useAssistantHostContext(hostContextProvider)
  const assistantSession = useAssistantSession({
    hostContext,
    terminalRecoveryMode: 'manual_restart',
  })
  const sessionStore = assistantSession.store
  const {
    messages,
    nextCursor,
    historyLoading,
    historyLoadingMore,
    contextReady,
    recoveryReason,
  } = storeToRefs(sessionStore)

  let bootstrapTask: Promise<void> | null = null

  const isBootstrapping = computed(() =>
    sessionStore.status === 'restoring'
    || sessionStore.status === 'creating'
    || (sessionStore.status === 'loading_history'
      && !sessionStore.historyLoadingMore),
  )
  const sessionReady = computed(() =>
    sessionStore.status === 'ready'
    && sessionStore.sessionId !== null,
  )
  const recoveryState = computed(() => {
    if (
      !contextReady.value
      || sessionStore.status !== 'error'
      || !recoveryReason.value
      || !TERMINAL_RECOVERY_REASONS.has(recoveryReason.value)
    ) {
      return null
    }

    return {
      reason: recoveryReason.value,
    }
  })

  watch(
    hostContext.readiness,
    (readiness) => {
      const ready = readiness.status === 'ready'
      sessionStore.setContextReady(ready)

      if (readiness.status === 'degraded') {
        widgetStore.setAvailability('degraded')
      }
      else {
        widgetStore.setAvailability(ready ? 'normal' : 'context_not_ready')
      }
    },
    { immediate: true },
  )

  async function bootstrapOnPanelOpen(): Promise<void> {
    if (!widgetStore.isOpen || sessionReady.value) {
      return
    }

    if (
      recoveryReason.value
      && TERMINAL_RECOVERY_REASONS.has(recoveryReason.value)
    ) {
      return
    }

    if (bootstrapTask) {
      return bootstrapTask
    }

    bootstrapTask = assistantSession.restoreOrCreateSession()

    try {
      await bootstrapTask
    }
    finally {
      bootstrapTask = null
    }
  }

  async function loadMoreHistory(): Promise<void> {
    if (!nextCursor.value || historyLoadingMore.value) {
      return
    }

    await assistantSession.loadMoreHistory()
  }

  async function restartSession(): Promise<void> {
    if (isBootstrapping.value) {
      return
    }

    await assistantSession.restartSession()
  }

  return {
    isBootstrapping,
    sessionReady,
    messages,
    nextCursor,
    historyLoading,
    historyLoadingMore,
    contextReady,
    recoveryState,
    bootstrapOnPanelOpen,
    loadMoreHistory,
    restartSession,
  }
}
