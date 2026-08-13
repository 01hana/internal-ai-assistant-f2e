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
import { getCurrentScope, onScopeDispose } from 'vue'
import {
  createAssistantSessionHistoryOrchestrator,
} from '../../../../packages/assistant-runtime/src/session'
import type {
  AssistantRuntimeCancelMessageInput,
  AssistantRuntimeSafeError,
  AssistantRuntimePageContext,
  AssistantRuntimeRequestOptions,
  AssistantRuntimeTransportPort,
  AssistantRuntimeTransportResult,
} from '../../../../packages/assistant-runtime/src/transport/ports'
import {
  useAssistantSessionStore,
  type AssistantSessionSafeError,
} from '../../../stores/assistant/useSessionStore'
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
  cancelMessage?(
    input: AssistantRuntimeCancelMessageInput,
    options: AssistantApiRequestOptions,
  ): Promise<AssistantSuccessEnvelope<{ cancelled: true }>>
  abortMessage?(
    input: AssistantRuntimeCancelMessageInput,
    options: AssistantApiRequestOptions,
  ): Promise<AssistantSuccessEnvelope<{ aborted: true }>>
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

function toRuntimeTransportError(error: unknown): AssistantRuntimeSafeError {
  const record = typeof error === 'object' && error !== null
    ? error as Record<string, unknown>
    : {}

  return {
    code: typeof record.code === 'string' ? record.code : 'transport_error',
    message: 'The assistant session operation could not be completed.',
    retryable: record.statusCode === 503 || record.code === 'network_error',
    ...(typeof record.statusCode === 'number'
      ? { statusCode: record.statusCode }
      : {}),
    ...(typeof record.status === 'string' ? { status: record.status } : {}),
  }
}

async function toRuntimeResult<T>(
  operation: () => Promise<T>,
): Promise<AssistantRuntimeTransportResult<T>> {
  try {
    return { ok: true, value: await operation() }
  }
  catch (error) {
    return { ok: false, error: toRuntimeTransportError(error) }
  }
}

function unsupportedTransportResult<T>(
  operation: 'cancelMessage' | 'abortMessage',
): AssistantRuntimeTransportResult<T> {
  return {
    ok: false,
    error: {
      code: 'transport_operation_unsupported',
      message: `The assistant transport does not support ${operation}.`,
      retryable: false,
    },
  }
}

export function useAssistantSession(options: UseAssistantSessionOptions) {
  const assistantService: AssistantSessionService
    = options.assistantService ?? new AssistantService()
  const sessionMap = options.sessionMap ?? createSessionStorageSessionMap()
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT
  const terminalRecoveryMode
    = options.terminalRecoveryMode ?? 'automatic_create'
  const store = useAssistantSessionStore()

  const runtimeTransport: Pick<
    AssistantRuntimeTransportPort,
    'createSession' | 'loadHistory' | 'cancelMessage' | 'abortMessage'
  > = {
    async createSession(input, runtimeOptions) {
      return toRuntimeResult(async () => {
        const identityHeaders = await getLatestIdentityHeaders()

        if (!identityHeaders) {
          throw { code: 'identity_context_unavailable' }
        }

        const response = await assistantService.createSession(
          input.pageContext ? { pageContext: input.pageContext as PageContext } : {},
          {
            identityHeaders,
            signal: runtimeOptions?.signal,
          },
        )

        return response.data
      })
    },
    async loadHistory(input, runtimeOptions) {
      return toRuntimeResult(async () => {
        const identityHeaders = await getLatestIdentityHeaders()

        if (!identityHeaders) {
          throw { code: 'identity_context_unavailable' }
        }

        const response = await assistantService.getSessionMessages(
          input.sessionId,
          {
            limit: historyLimit,
            ...(input.cursor ? { cursor: input.cursor } : {}),
            order: 'asc',
          },
          {
            identityHeaders,
            signal: runtimeOptions?.signal,
          },
        )

        return {
          sessionId: response.data.sessionId,
          messages: response.data.messages,
          cursor: response.data.nextCursor ?? undefined,
        }
      })
    },
    async cancelMessage(input, runtimeOptions) {
      const cancelMessage = assistantService.cancelMessage

      if (!cancelMessage) {
        return unsupportedTransportResult('cancelMessage')
      }

      return toRuntimeResult(async () => {
        const identityHeaders = await getLatestIdentityHeaders()

        if (!identityHeaders) {
          throw { code: 'identity_context_unavailable' }
        }

        const response = await cancelMessage(
          input,
          createAssistantRequestOptions(identityHeaders, runtimeOptions),
        )

        return response.data
      })
    },
    async abortMessage(input, runtimeOptions) {
      const abortMessage = assistantService.abortMessage

      if (!abortMessage) {
        return unsupportedTransportResult('abortMessage')
      }

      return toRuntimeResult(async () => {
        const identityHeaders = await getLatestIdentityHeaders()

        if (!identityHeaders) {
          throw { code: 'identity_context_unavailable' }
        }

        const response = await abortMessage(
          input,
          createAssistantRequestOptions(identityHeaders, runtimeOptions),
        )

        return response.data
      })
    },
  }

  const sessionOrchestrator = createAssistantSessionHistoryOrchestrator({
    transport: runtimeTransport,
  })

  async function getLatestIdentityHeaders():
  Promise<AssistantIdentityHeaders | null> {
    try {
      return await options.hostContext.getIdentityHeaders('restore')
    }
    catch {
      return null
    }
  }

  function createAssistantRequestOptions(
    identityHeaders: AssistantIdentityHeaders,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ): AssistantApiRequestOptions {
    return {
      identityHeaders,
      signal: runtimeOptions?.signal,
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
      const history = await sessionOrchestrator.loadHistory({ sessionId })

      store.setMessages([...history.messages], history.cursor ?? null)
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
      const session = await sessionOrchestrator.createSession(
        pageContext
          ? { pageContext: pageContext as unknown as AssistantRuntimePageContext }
          : {},
      )

      store.setSession(session)
      store.setMessages([], null)
      store.clearError()
      sessionMap.write(sessionScope.key, session.sessionId)
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
          const session = await sessionOrchestrator.adoptValidatedSession(
            response.data.sessionId,
          )

          store.setSession({ ...response.data, ...session })
          sessionMap.write(sessionScope.key, response.data.sessionId)
          await loadInitialHistory(response.data.sessionId)
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
    const sessionId = store.session?.sessionId
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
      const history = await sessionOrchestrator.loadHistory({
        sessionId,
        cursor,
      })

      store.appendMessages([...history.messages], history.cursor ?? null)
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

  async function cleanup(): Promise<void> {
    await sessionOrchestrator.cleanup()
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      void cleanup()
    })
  }

  return {
    store,
    restoreOrCreateSession,
    loadMoreHistory,
    restartSession,
    clearScopedFallback,
    cleanup,
  }
}
