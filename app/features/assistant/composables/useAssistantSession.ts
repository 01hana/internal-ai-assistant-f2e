import type {
  AssistantApiRequestOptions,
  AssistantHistoryQuery,
  AssistantIdentityHeaders,
  AssistantSession,
  AssistantSessionId,
  AssistantSessionScope,
  AssistantSuccessEnvelope,
  CreateAssistantSessionRequest,
  PageContext,
  SessionMessagesResponse,
} from '../../../types/assistant'
import { AssistantService } from '../../../services/api/assistant'
import {
  useAssistantSessionStore,
  type AssistantSessionSafeError,
} from '../../../stores/assistant/session'
import {
  isReusableAssistantSession,
  resolveSessionRecoveryReason,
  resolveSessionRestoreCandidates,
  shouldClearScopedSessionFallback,
  type AssistantSessionRecoveryReason,
} from '../../../utils/assistant/sessionRecovery'
import {
  createSessionStorageSessionMap,
  type SessionStorageSessionMap,
} from '../../../utils/assistant/sessionStorageSessionMap'

export interface AssistantSessionService {
  createSession(
    request: CreateAssistantSessionRequest,
    options: AssistantApiRequestOptions,
  ): Promise<AssistantSuccessEnvelope<AssistantSession>>
  getSession(
    sessionId: AssistantSessionId,
    options: AssistantApiRequestOptions,
  ): Promise<AssistantSuccessEnvelope<AssistantSession>>
  getSessionMessages(
    sessionId: AssistantSessionId,
    query: AssistantHistoryQuery,
    options: AssistantApiRequestOptions,
  ): Promise<AssistantSuccessEnvelope<SessionMessagesResponse>>
}

export interface AssistantSessionHostContext {
  getResolvedSessionScope(
    purpose: 'restore',
  ): Promise<AssistantSessionScope>
  getHostManagedSessionId(
    purpose: 'restore',
  ): Promise<AssistantSessionId | null>
  getLatestPageContext(
    purpose: 'restore',
  ): Promise<PageContext | null>
  getIdentityHeaders(
    purpose: 'restore',
  ): Promise<AssistantIdentityHeaders | null>
}

export interface UseAssistantSessionOptions {
  assistantService?: AssistantSessionService
  hostContext: AssistantSessionHostContext
  sessionMap?: SessionStorageSessionMap
  historyLimit?: number
  terminalRecoveryMode?: 'automatic_create' | 'manual_restart'
}

const DEFAULT_HISTORY_LIMIT = 30

function createSafeError(
  code: string,
  safeMessage: string,
): AssistantSessionSafeError {
  return { code, safeMessage }
}

function createRecoveryError(
  reason: AssistantSessionRecoveryReason,
): AssistantSessionSafeError {
  if (reason === 'unavailable') {
    return createSafeError(
      'session_unavailable',
      'The assistant session is temporarily unavailable.',
    )
  }

  return createSafeError(
    'session_restore_failed',
    'The assistant session could not be restored.',
  )
}

export function useAssistantSession(options: UseAssistantSessionOptions) {
  const assistantService = options.assistantService ?? new AssistantService()
  const sessionMap = options.sessionMap ?? createSessionStorageSessionMap()
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT
  const terminalRecoveryMode
    = options.terminalRecoveryMode ?? 'automatic_create'
  const store = useAssistantSessionStore()

  async function getLatestIdentityHeaders():
  Promise<AssistantIdentityHeaders | null> {
    try {
      return await options.hostContext.getIdentityHeaders('restore')
    }
    catch {
      return null
    }
  }

  function setIdentityUnavailable(): void {
    store.setError(
      createSafeError(
        'identity_context_unavailable',
        'Identity context is not ready.',
      ),
      'unknown',
    )
  }

  async function loadInitialHistory(
    sessionId: AssistantSessionId,
  ): Promise<void> {
    store.setLoadingHistory()
    store.setMessages([], null)

    const identityHeaders = await getLatestIdentityHeaders()

    if (!identityHeaders) {
      store.setLastError(
        createSafeError(
          'identity_context_unavailable',
          'Identity context is not ready.',
        ),
        'unknown',
      )
      store.setReady()
      return
    }

    try {
      const response = await assistantService.getSessionMessages(
        sessionId,
        {
          limit: historyLimit,
          order: 'asc',
        },
        { identityHeaders },
      )

      store.setMessages(response.data.messages, response.data.nextCursor)
      store.clearError()
    }
    catch (error) {
      const reason = resolveSessionRecoveryReason(error) ?? 'unknown'
      store.setLastError(
        createSafeError(
          'history_unavailable',
          'Session history is temporarily unavailable.',
        ),
        reason,
      )
    }

    store.setReady()
  }

  async function createNewSession(
    sessionScope: AssistantSessionScope,
  ): Promise<void> {
    store.setCreating()
    store.setSessionScope(sessionScope)

    let pageContext: PageContext | null

    try {
      pageContext = await options.hostContext.getLatestPageContext('restore')
    }
    catch {
      store.setError(
        createSafeError(
          'page_context_unavailable',
          'Page context is not ready.',
        ),
        'unknown',
      )
      return
    }

    const identityHeaders = await getLatestIdentityHeaders()

    if (!identityHeaders) {
      setIdentityUnavailable()
      return
    }

    try {
      const response = await assistantService.createSession(
        pageContext ? { pageContext } : {},
        { identityHeaders },
      )

      store.setSession(response.data)
      store.setMessages([], null)
      store.clearError()
      sessionMap.write(sessionScope.key, response.data.id)
      store.setReady()
    }
    catch (error) {
      const reason = resolveSessionRecoveryReason(error) ?? 'unknown'
      store.setError(createRecoveryError(reason), reason)
    }
  }

  async function restoreOrCreateSession(): Promise<void> {
    store.setRestoring()

    let sessionScope: AssistantSessionScope
    let hostManagedSessionId: AssistantSessionId | null

    try {
      sessionScope = await options.hostContext
        .getResolvedSessionScope('restore')
      store.setSessionScope(sessionScope)
      hostManagedSessionId = await options.hostContext
        .getHostManagedSessionId('restore')
    }
    catch {
      store.setError(
        createSafeError(
          'host_context_unavailable',
          'Host context is not ready.',
        ),
        'unknown',
      )
      return
    }

    const storedSessionId = sessionMap.read(sessionScope.key)
    const candidates = resolveSessionRestoreCandidates({
      scopeKey: sessionScope.key,
      hostManagedSessionId,
      storedSessionId,
    })

    for (const candidate of candidates) {
      const identityHeaders = await getLatestIdentityHeaders()

      if (!identityHeaders) {
        setIdentityUnavailable()
        return
      }

      try {
        const response = await assistantService.getSession(
          candidate.sessionId,
          { identityHeaders },
        )

        if (isReusableAssistantSession(response.data)) {
          store.setSession(response.data)
          sessionMap.write(sessionScope.key, response.data.id)
          await loadInitialHistory(response.data.id)
          return
        }

        const reason = resolveSessionRecoveryReason(response.data) ?? 'unknown'

        if (
          shouldClearScopedSessionFallback(reason)
          && (
            candidate.sessionId === storedSessionId
            || terminalRecoveryMode === 'manual_restart'
          )
        ) {
          sessionMap.clear(sessionScope.key)
        }

        if (
          shouldClearScopedSessionFallback(reason)
          && terminalRecoveryMode === 'manual_restart'
        ) {
          store.setSession(null)
          store.setMessages([], null)
          store.setError(createRecoveryError(reason), reason)
          return
        }

        if (!shouldClearScopedSessionFallback(reason)) {
          store.setError(createRecoveryError(reason), reason)
          return
        }
      }
      catch (error) {
        const reason = resolveSessionRecoveryReason(error) ?? 'unknown'

        if (
          shouldClearScopedSessionFallback(reason)
          && (
            candidate.sessionId === storedSessionId
            || terminalRecoveryMode === 'manual_restart'
          )
        ) {
          sessionMap.clear(sessionScope.key)
        }

        if (
          shouldClearScopedSessionFallback(reason)
          && terminalRecoveryMode === 'manual_restart'
        ) {
          store.setSession(null)
          store.setMessages([], null)
          store.setError(createRecoveryError(reason), reason)
          return
        }

        if (!shouldClearScopedSessionFallback(reason)) {
          store.setError(createRecoveryError(reason), reason)
          return
        }
      }
    }

    await createNewSession(sessionScope)
  }

  async function loadMoreHistory(): Promise<void> {
    const sessionId = store.session?.id
    const cursor = store.nextCursor

    if (!sessionId || !cursor) {
      return
    }

    store.setLoadingHistory('more')
    const identityHeaders = await getLatestIdentityHeaders()

    if (!identityHeaders) {
      store.setLastError(
        createSafeError(
          'identity_context_unavailable',
          'Identity context is not ready.',
        ),
        'unknown',
      )
      store.setReady()
      return
    }

    try {
      const response = await assistantService.getSessionMessages(
        sessionId,
        {
          limit: historyLimit,
          cursor,
          order: 'asc',
        },
        { identityHeaders },
      )

      store.appendMessages(response.data.messages, response.data.nextCursor)
      store.clearError()
    }
    catch (error) {
      const reason = resolveSessionRecoveryReason(error) ?? 'unknown'
      store.setLastError(
        createSafeError(
          'history_unavailable',
          'Session history is temporarily unavailable.',
        ),
        reason,
      )
    }

    store.setReady()
  }

  async function restartSession(): Promise<void> {
    store.setRestoring()

    let sessionScope: AssistantSessionScope

    try {
      sessionScope = await options.hostContext
        .getResolvedSessionScope('restore')
    }
    catch {
      store.setError(
        createSafeError(
          'host_context_unavailable',
          'Host context is not ready.',
        ),
        'unknown',
      )
      return
    }

    sessionMap.clear(sessionScope.key)
    await createNewSession(sessionScope)
  }

  async function clearScopedFallback(): Promise<void> {
    const sessionScope = await options.hostContext
      .getResolvedSessionScope('restore')
    sessionMap.clear(sessionScope.key)
  }

  return {
    store,
    restoreOrCreateSession,
    loadMoreHistory,
    restartSession,
    clearScopedFallback,
  }
}
