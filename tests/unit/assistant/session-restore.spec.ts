import { readFile } from 'node:fs/promises'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpClientError } from '../../../app/services'
import {
  useAssistantSession,
  type AssistantSessionHostContext,
  type AssistantSessionService,
} from '../../../app/features/assistant/composables/useAssistantSession'
import { useAssistantSessionStore } from '../../../app/stores/assistant/useSessionStore'
import {
  createSessionStorageSessionMap,
  type AssistantSessionStorageLike,
  type SessionStorageSessionMap,
} from '../../../app/utils/assistant/sessionStorageSessionMap'
import {
  isReusableAssistantSession,
  resolveSessionRecoveryReason,
  resolveSessionRestoreCandidates,
  shouldClearScopedSessionFallback,
} from '../../../app/utils/assistant/sessionRecovery'
import type {
  AssistantIdentityHeaders,
  AssistantSession,
  AssistantSessionScope,
  HistoryMessageSummary,
} from '../../../app/types/assistant'

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  const storage: AssistantSessionStorageLike = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }

  return { storage, values }
}

function createSession(status: string): AssistantSession {
  return {
    sessionId: `session-${status}`,
    status,
  }
}

const identityHeaders = {
  'x-actor-id': 'actor-001',
  'x-organization-id': 'org-001',
  'x-host-app': 'erp-web',
  'x-role': 'operator',
} satisfies AssistantIdentityHeaders

const sessionScope = {
  kind: 'page',
  key: 'actor-001:org-001:erp-web:page:orders',
  source: 'default',
  pageContext: {
    route: '/orders',
    screenId: 'orders',
  },
} satisfies AssistantSessionScope

const historyMessages: HistoryMessageSummary[] = [
  {
    messageId: 'message-001',
    role: 'user',
    content: 'First',
    createdAt: '2026-07-02T00:00:01.000Z',
  },
  {
    messageId: 'message-002',
    role: 'assistant',
    content: 'Second',
    createdAt: '2026-07-02T00:00:02.000Z',
    answerDecision: 'answered',
  },
]

function createFakeService(): AssistantSessionService {
  return {
    createSession: vi.fn(async request => ({
      requestId: 'request-create-001',
      data: {
        ...createSession('active'),
        sessionId: 'session-created',
        pageContext: request.pageContext ?? null,
      },
    })),
    getSession: vi.fn(async sessionId => ({
      requestId: 'request-get-001',
      data: {
        ...createSession('active'),
        sessionId,
      },
    })),
    getSessionMessages: vi.fn(async sessionId => ({
      requestId: 'request-history-001',
      data: {
        sessionId,
        messages: historyMessages,
        nextCursor: 'message-002',
      },
    })),
  }
}

function createFakeHostContext(
  overrides: Partial<AssistantSessionHostContext> = {},
): AssistantSessionHostContext {
  return {
    getResolvedSessionScope: vi.fn(async () => sessionScope),
    getHostManagedSessionId: vi.fn(async () => null),
    getLatestPageContext: vi.fn(async () => sessionScope.pageContext ?? null),
    getIdentityHeaders: vi.fn(async () => identityHeaders),
    ...overrides,
  }
}

function createFakeSessionMap(
  storedSessionId: string | null = null,
): SessionStorageSessionMap {
  return {
    read: vi.fn(() => storedSessionId),
    write: vi.fn(),
    clear: vi.fn(),
  }
}

describe('sessionStorageSessionMap', () => {
  it('writes and reads only a versioned session pointer under an encoded scope key', () => {
    const { storage, values } = createMemoryStorage()
    const sessionMap = createSessionStorageSessionMap({ storage })
    const scopeKey = 'actor:org:erp-web:entity:order:SO/10001'

    sessionMap.write(scopeKey, 'session-001')

    const storageKey = `internal-assistant:session:${encodeURIComponent(scopeKey)}`
    expect(sessionMap.read(scopeKey)).toBe('session-001')
    expect(JSON.parse(values.get(storageKey)!)).toEqual({
      version: 1,
      sessionId: 'session-001',
    })
    expect(Object.keys(JSON.parse(values.get(storageKey)!)).sort()).toEqual([
      'sessionId',
      'version',
    ])
  })

  it('clears only the selected scope pointer', () => {
    const { storage, values } = createMemoryStorage()
    const sessionMap = createSessionStorageSessionMap({ storage })

    sessionMap.write('scope:one', 'session-001')
    sessionMap.write('scope:two', 'session-002')
    sessionMap.clear('scope:one')

    expect(sessionMap.read('scope:one')).toBeNull()
    expect(sessionMap.read('scope:two')).toBe('session-002')
    expect(values.size).toBe(1)
  })

  it.each([
    'not-json',
    JSON.stringify({ version: 2, sessionId: 'session-001' }),
    JSON.stringify({ version: 1 }),
    JSON.stringify({ version: 1, sessionId: '   ' }),
    JSON.stringify({
      version: 1,
      sessionId: 'session-001',
      extraState: 'not-allowed',
    }),
  ])('rejects and removes an invalid scoped pointer', (storedValue) => {
    const scopeKey = 'scope:invalid'
    const storageKey = `internal-assistant:session:${encodeURIComponent(scopeKey)}`
    const { storage, values } = createMemoryStorage({
      [storageKey]: storedValue,
      'unrelated:key': 'keep-me',
    })
    const sessionMap = createSessionStorageSessionMap({ storage })

    expect(sessionMap.read(scopeKey)).toBeNull()
    expect(values.has(storageKey)).toBe(false)
    expect(values.get('unrelated:key')).toBe('keep-me')
  })

  it('is a safe no-op when storage is missing or explicitly disabled', () => {
    const defaultMap = createSessionStorageSessionMap()
    const disabledMap = createSessionStorageSessionMap({ storage: null })

    expect(defaultMap.read('scope:ssr')).toBeNull()
    expect(disabledMap.read('scope:disabled')).toBeNull()
    expect(() => defaultMap.write('scope:ssr', 'session-001')).not.toThrow()
    expect(() => disabledMap.clear('scope:disabled')).not.toThrow()
  })

  it('contains storage access failures without throwing', () => {
    const unavailableStorage: AssistantSessionStorageLike = {
      getItem: () => {
        throw new Error('Synthetic storage read failure')
      },
      setItem: () => {
        throw new Error('Synthetic storage write failure')
      },
      removeItem: () => {
        throw new Error('Synthetic storage clear failure')
      },
    }
    const sessionMap = createSessionStorageSessionMap({
      storage: unavailableStorage,
    })

    expect(sessionMap.read('scope:unavailable')).toBeNull()
    expect(() =>
      sessionMap.write('scope:unavailable', 'session-001'),
    ).not.toThrow()
    expect(() => sessionMap.clear('scope:unavailable')).not.toThrow()
  })

  it('does not implement a local storage fallback strategy', async () => {
    const source = await readFile(
      new URL(
        '../../../app/utils/assistant/sessionStorageSessionMap.ts',
        import.meta.url,
      ),
      'utf8',
    )

    expect(source).not.toMatch(/\blocalStorage\b/)
  })
})

describe('sessionRecovery', () => {
  it('prioritizes host-managed session before the scoped storage fallback', () => {
    expect(
      resolveSessionRestoreCandidates({
        scopeKey: 'actor:org:host:page:orders',
        hostManagedSessionId: 'session-host',
        storedSessionId: 'session-stored',
      }),
    ).toEqual([
      {
        source: 'host_managed',
        sessionId: 'session-host',
        scopeKey: 'actor:org:host:page:orders',
      },
      {
        source: 'session_storage',
        sessionId: 'session-stored',
        scopeKey: 'actor:org:host:page:orders',
      },
    ])
  })

  it('supports storage-only and empty candidate sets', () => {
    expect(
      resolveSessionRestoreCandidates({
        scopeKey: 'actor:org:host:global',
        storedSessionId: 'session-stored',
      }),
    ).toEqual([
      {
        source: 'session_storage',
        sessionId: 'session-stored',
        scopeKey: 'actor:org:host:global',
      },
    ])
    expect(
      resolveSessionRestoreCandidates({
        scopeKey: 'actor:org:host:global',
      }),
    ).toEqual([])
  })

  it('deduplicates matching candidates in favor of the host-managed source', () => {
    expect(
      resolveSessionRestoreCandidates({
        scopeKey: 'actor:org:host:global',
        hostManagedSessionId: 'session-shared',
        storedSessionId: 'session-shared',
      }),
    ).toEqual([
      {
        source: 'host_managed',
        sessionId: 'session-shared',
        scopeKey: 'actor:org:host:global',
      },
    ])
  })

  it.each(['active'])(
    'treats %s sessions as reusable',
    (status) => {
      expect(isReusableAssistantSession(createSession(status))).toBe(true)
      expect(resolveSessionRecoveryReason(createSession(status))).toBeNull()
    },
  )

  it.each([
    ['closed', 'closed'],
    ['expired', 'expired'],
    ['archived', 'invisible'],
    ['deleted', 'invisible'],
    ['invisible', 'invisible'],
    ['future_status', 'unknown'],
  ] as const)(
    'treats %s sessions as non-reusable with %s recovery',
    (status, reason) => {
      const session = createSession(status)
      expect(isReusableAssistantSession(session)).toBe(false)
      expect(resolveSessionRecoveryReason(session)).toBe(reason)
    },
  )

  it.each([
    [new HttpClientError('Not found', { statusCode: 404 }), 'not_found'],
    [new HttpClientError('Not found', { code: 'not_found' }), 'not_found'],
    [new HttpClientError('Denied', { code: 'forbidden' }), 'invisible'],
    [
      new HttpClientError('Denied', { code: 'permission_denied' }),
      'invisible',
    ],
    [
      new HttpClientError('Offline', { code: 'network_error' }),
      'unavailable',
    ],
    [
      new HttpClientError('Unavailable', { code: 'assistant_unavailable' }),
      'unavailable',
    ],
    [new HttpClientError('Unexpected', { code: 'unexpected' }), 'unknown'],
  ] as const)('maps transport failures to %s recovery', (error, reason) => {
    expect(resolveSessionRecoveryReason(error)).toBe(reason)
  })

  it.each(['not_found', 'invisible', 'closed', 'expired'] as const)(
    'clears scoped fallback for %s',
    (reason) => {
      expect(shouldClearScopedSessionFallback(reason)).toBe(true)
    },
  )

  it.each(['unavailable', 'unknown', null] as const)(
    'preserves scoped fallback for %s',
    (reason) => {
      expect(shouldClearScopedSessionFallback(reason)).toBe(false)
    },
  )
})

describe('useAssistantSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with an empty idle session state', () => {
    const store = useAssistantSessionStore()

    expect(store.$state).toMatchObject({
      status: 'idle',
      session: null,
      sessionScope: null,
      messages: [],
      nextCursor: null,
      lastError: null,
      recoveryReason: null,
    })
  })

  it('supports lifecycle, session, history, error, and reset transitions', () => {
    const store = useAssistantSessionStore()
    const session = createSession('active')

    store.setRestoring()
    expect(store.status).toBe('restoring')
    store.setCreating()
    expect(store.status).toBe('creating')
    store.setLoadingHistory()
    expect(store.status).toBe('loading_history')
    store.setSessionScope(sessionScope)
    store.setSession(session)
    store.setMessages(historyMessages, 'message-002')
    store.setReady()

    expect(store.status).toBe('ready')
    expect(store.sessionScope).toEqual(sessionScope)
    expect(store.session).toEqual(session)
    expect(store.sessionId).toBe(session.sessionId)
    expect(store.messages).toEqual(historyMessages)
    expect(store.nextCursor).toBe('message-002')

    store.setError(
      { code: 'session_unavailable', safeMessage: 'Session unavailable.' },
      'unavailable',
    )
    expect(store.status).toBe('error')
    expect(store.recoveryReason).toBe('unavailable')

    store.resetSessionState()
    expect(store.$state).toMatchObject({
      status: 'idle',
      session: null,
      sessionScope: null,
      messages: [],
      nextCursor: null,
      lastError: null,
      recoveryReason: null,
    })
    expect(store.sessionId).toBeNull()
  })
})

describe('useAssistantSession', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('restores the host-managed candidate first and loads asc history', async () => {
    const service = createFakeService()
    const hostContext = createFakeHostContext({
      getHostManagedSessionId: vi.fn(async () => 'session-host'),
    })
    const sessionMap = createFakeSessionMap('session-stored')
    const assistantSession = useAssistantSession({
      assistantService: service,
      hostContext,
      sessionMap,
      historyLimit: 25,
    })

    await assistantSession.restoreOrCreateSession()

    expect(service.getSession).toHaveBeenCalledTimes(1)
    expect(service.getSession).toHaveBeenCalledWith(
      'session-host',
      { identityHeaders },
    )
    expect(service.getSessionMessages).toHaveBeenCalledWith(
      'session-host',
      { limit: 25, order: 'asc' },
      expect.objectContaining({
        identityHeaders,
        signal: expect.any(AbortSignal),
      }),
    )
    expect(service.createSession).not.toHaveBeenCalled()
    expect(assistantSession.store.messages).toEqual(historyMessages)
    expect(assistantSession.store.nextCursor).toBe('message-002')
    expect(assistantSession.store.status).toBe('ready')
    expect(sessionMap.write).toHaveBeenCalledWith(
      sessionScope.key,
      'session-host',
    )
  })

  it('restores a storage-only candidate and deduplicates matching candidates', async () => {
    const service = createFakeService()
    const hostContext = createFakeHostContext({
      getHostManagedSessionId: vi.fn(async () => 'session-shared'),
    })
    const sessionMap = createFakeSessionMap('session-shared')
    const assistantSession = useAssistantSession({
      assistantService: service,
      hostContext,
      sessionMap,
    })

    await assistantSession.restoreOrCreateSession()
    expect(service.getSession).toHaveBeenCalledTimes(1)

    vi.mocked(hostContext.getHostManagedSessionId).mockResolvedValue(null)
    vi.mocked(service.getSession).mockClear()
    sessionMap.read = vi.fn(() => 'session-stored')
    assistantSession.store.resetSessionState()

    await assistantSession.restoreOrCreateSession()
    expect(service.getSession).toHaveBeenCalledTimes(1)
    expect(service.getSession).toHaveBeenCalledWith(
      'session-stored',
      { identityHeaders },
    )
  })

  it('creates a new scoped session when no restore candidates exist', async () => {
    const service = createFakeService()
    const hostContext = createFakeHostContext()
    const sessionMap = createFakeSessionMap()
    const assistantSession = useAssistantSession({
      assistantService: service,
      hostContext,
      sessionMap,
    })

    await assistantSession.restoreOrCreateSession()

    expect(service.getSession).not.toHaveBeenCalled()
    expect(service.createSession).toHaveBeenCalledWith(
      { pageContext: sessionScope.pageContext },
      expect.objectContaining({
        identityHeaders,
        signal: expect.any(AbortSignal),
      }),
    )
    expect(assistantSession.store.session?.sessionId).toBe('session-created')
    expect(assistantSession.store.messages).toEqual([])
    expect(assistantSession.store.nextCursor).toBeNull()
    expect(sessionMap.write).toHaveBeenCalledWith(
      sessionScope.key,
      'session-created',
    )
  })

  it.each(['closed', 'expired'])(
    'clears a stored %s candidate and creates a new session',
    async (status) => {
      const service = createFakeService()
      vi.mocked(service.getSession).mockResolvedValue({
        requestId: 'request-get-unusable',
        data: {
          ...createSession(status),
          sessionId: 'session-stored',
        },
      })
      const sessionMap = createFakeSessionMap('session-stored')
      const assistantSession = useAssistantSession({
        assistantService: service,
        hostContext: createFakeHostContext(),
        sessionMap,
      })

      await assistantSession.restoreOrCreateSession()

      expect(sessionMap.clear).toHaveBeenCalledWith(sessionScope.key)
      expect(service.createSession).toHaveBeenCalledTimes(1)
      expect(assistantSession.store.status).toBe('ready')
    },
  )

  it.each([
    new HttpClientError('Not found', { code: 'not_found', statusCode: 404 }),
    new HttpClientError('Invisible', { code: 'forbidden', statusCode: 403 }),
  ])(
    'clears a missing or invisible stored candidate before creating',
    async (restoreError) => {
      const service = createFakeService()
      vi.mocked(service.getSession).mockRejectedValue(restoreError)
      const sessionMap = createFakeSessionMap('session-stored')
      const assistantSession = useAssistantSession({
        assistantService: service,
        hostContext: createFakeHostContext(),
        sessionMap,
      })

      await assistantSession.restoreOrCreateSession()

      expect(sessionMap.clear).toHaveBeenCalledWith(sessionScope.key)
      expect(service.createSession).toHaveBeenCalledTimes(1)
    },
  )

  it.each(['network_error', 'assistant_unavailable'])(
    'preserves fallback and avoids duplicate creation for %s',
    async (code) => {
      const service = createFakeService()
      vi.mocked(service.getSession).mockRejectedValue(
        new HttpClientError('Temporarily unavailable', { code }),
      )
      const sessionMap = createFakeSessionMap('session-stored')
      const assistantSession = useAssistantSession({
        assistantService: service,
        hostContext: createFakeHostContext(),
        sessionMap,
      })

      await assistantSession.restoreOrCreateSession()

      expect(sessionMap.clear).not.toHaveBeenCalled()
      expect(service.createSession).not.toHaveBeenCalled()
      expect(assistantSession.store.status).toBe('error')
      expect(assistantSession.store.recoveryReason).toBe('unavailable')
      expect(assistantSession.store.lastError).not.toHaveProperty('stack')
    },
  )

  it('does not create a session when latest identity headers are unavailable', async () => {
    const service = createFakeService()
    const hostContext = createFakeHostContext({
      getIdentityHeaders: vi.fn(async () => null),
    })
    const assistantSession = useAssistantSession({
      assistantService: service,
      hostContext,
      sessionMap: createFakeSessionMap(),
    })

    await assistantSession.restoreOrCreateSession()

    expect(service.createSession).not.toHaveBeenCalled()
    expect(assistantSession.store.status).toBe('error')
    expect(assistantSession.store.lastError).toEqual({
      code: 'identity_context_unavailable',
      safeMessage: 'Identity context is not ready.',
    })
  })

  it('keeps a restored session ready when initial history loading fails', async () => {
    const service = createFakeService()
    vi.mocked(service.getSessionMessages).mockRejectedValue(
      new HttpClientError('History unavailable', {
        code: 'assistant_unavailable',
      }),
    )
    const assistantSession = useAssistantSession({
      assistantService: service,
      hostContext: createFakeHostContext(),
      sessionMap: createFakeSessionMap('session-stored'),
    })

    await assistantSession.restoreOrCreateSession()

    expect(assistantSession.store.session?.sessionId).toBe('session-stored')
    expect(assistantSession.store.messages).toEqual([])
    expect(assistantSession.store.status).toBe('ready')
    expect(assistantSession.store.lastError).not.toBeNull()
    expect(service.createSession).not.toHaveBeenCalled()
  })

  it('loads more history from nextCursor without reversing messages', async () => {
    const service = createFakeService()
    const nextPage: HistoryMessageSummary[] = [
      {
        messageId: 'message-003',
        role: 'user',
        content: 'Third',
        createdAt: '2026-07-02T00:00:03.000Z',
      },
    ]
    vi.mocked(service.getSessionMessages)
      .mockResolvedValueOnce({
        requestId: 'request-history-first',
        data: {
          sessionId: 'session-stored',
          messages: historyMessages,
          nextCursor: 'message-002',
        },
      })
      .mockResolvedValueOnce({
        requestId: 'request-history-next',
        data: {
          sessionId: 'session-stored',
          messages: nextPage,
          nextCursor: null,
        },
      })
    const assistantSession = useAssistantSession({
      assistantService: service,
      hostContext: createFakeHostContext(),
      sessionMap: createFakeSessionMap('session-stored'),
    })

    await assistantSession.restoreOrCreateSession()
    await assistantSession.loadMoreHistory()

    expect(service.getSessionMessages).toHaveBeenLastCalledWith(
      'session-stored',
      { limit: 30, cursor: 'message-002', order: 'asc' },
      expect.objectContaining({
        identityHeaders,
        signal: expect.any(AbortSignal),
      }),
    )
    expect(
      assistantSession.store.messages.map(message => message.messageId),
    ).toEqual(['message-001', 'message-002', 'message-003'])
    expect(assistantSession.store.nextCursor).toBeNull()
  })

  it('restarts with latest context, clears only current scope, and resets history', async () => {
    const service = createFakeService()
    const latestScope = {
      ...sessionScope,
      key: 'actor-001:org-001:erp-web:page:orders-latest',
      pageContext: {
        route: '/orders/latest',
        screenId: 'orders-latest',
      },
    } satisfies AssistantSessionScope
    const hostContext = createFakeHostContext({
      getResolvedSessionScope: vi.fn(async () => latestScope),
      getLatestPageContext: vi.fn(async () => latestScope.pageContext),
    })
    const sessionMap = createFakeSessionMap('session-old')
    const assistantSession = useAssistantSession({
      assistantService: service,
      hostContext,
      sessionMap,
    })
    assistantSession.store.setSession(createSession('active'))
    assistantSession.store.setMessages(historyMessages, 'message-002')

    await assistantSession.restartSession()

    expect(sessionMap.clear).toHaveBeenCalledTimes(1)
    expect(sessionMap.clear).toHaveBeenCalledWith(latestScope.key)
    expect(service.getSession).not.toHaveBeenCalled()
    expect(service.createSession).toHaveBeenCalledWith(
      { pageContext: latestScope.pageContext },
      expect.objectContaining({
        identityHeaders,
        signal: expect.any(AbortSignal),
      }),
    )
    expect(assistantSession.store.messages).toEqual([])
    expect(assistantSession.store.nextCursor).toBeNull()
    expect(sessionMap.write).toHaveBeenCalledWith(
      latestScope.key,
      'session-created',
    )
  })

  it('uses only the existing restore purpose for every latest host read', async () => {
    const service = createFakeService()
    const hostContext = createFakeHostContext()
    const assistantSession = useAssistantSession({
      assistantService: service,
      hostContext,
      sessionMap: createFakeSessionMap(),
    })

    await assistantSession.restoreOrCreateSession()
    await assistantSession.restartSession()

    for (const method of [
      hostContext.getResolvedSessionScope,
      hostContext.getLatestPageContext,
      hostContext.getIdentityHeaders,
    ]) {
      expect(vi.mocked(method).mock.calls.every(([purpose]) =>
        purpose === 'restore')).toBe(true)
    }
    expect(
      vi.mocked(hostContext.getHostManagedSessionId).mock.calls.every(
        ([purpose]) => purpose === 'restore',
      ),
    ).toBe(true)
  })
})
