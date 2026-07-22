import { readFile } from 'node:fs/promises'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useAssistantSession,
  type AssistantSessionHostContext,
  type AssistantSessionService,
} from '../../../app/features/assistant/composables/useAssistantSession'
import type {
  AssistantIdentityHeaders,
  AssistantSession,
  AssistantSessionScope,
} from '../../../app/types/assistant'

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

function createSession(sessionId: string): AssistantSession {
  return {
    sessionId,
    status: 'active',
  }
}

function createHostContext(
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

function createSessionService(
  overrides: Partial<AssistantSessionService> = {},
): AssistantSessionService {
  return {
    createSession: vi.fn(async request => ({
      requestId: 'request-create-001',
      data: {
        ...createSession('session-created'),
        pageContext: request.pageContext ?? null,
      },
    })),
    getSession: vi.fn(async sessionId => ({
      requestId: 'request-get-001',
      data: createSession(sessionId),
    })),
    getSessionMessages: vi.fn(async sessionId => ({
      requestId: 'request-history-001',
      data: {
        sessionId,
        messages: [],
        nextCursor: null,
      },
    })),
    ...overrides,
  }
}

async function waitFor(
  assertion: () => void,
  attempts = 20,
): Promise<void> {
  let lastError: unknown

  for (let index = 0; index < attempts; index += 1) {
    try {
      assertion()
      return
    }
    catch (error) {
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  throw lastError
}

describe('useAssistantSession Frontend 001 shared-runtime adapter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('passes the shared runtime tracked signal to AssistantService.createSession', async () => {
    let trackedSignal: AbortSignal | undefined
    const service = createSessionService({
      createSession: vi.fn(async (request, options) => {
        trackedSignal = options.signal

        return {
          requestId: 'request-create-001',
          data: {
            ...createSession('session-created'),
            pageContext: request.pageContext ?? null,
          },
        }
      }),
    })
    const assistantSession = useAssistantSession({
      assistantService: service,
      hostContext: createHostContext(),
    })

    await assistantSession.restoreOrCreateSession()

    expect(service.createSession).toHaveBeenCalledTimes(1)
    expect(trackedSignal).toBeInstanceOf(AbortSignal)
    expect(trackedSignal?.aborted).toBe(false)
    expect(service.createSession).toHaveBeenCalledWith(
      { pageContext: sessionScope.pageContext },
      expect.objectContaining({
        identityHeaders,
        signal: trackedSignal,
      }),
    )
  })

  it('passes the shared runtime tracked signal to AssistantService.getSessionMessages', async () => {
    let trackedSignal: AbortSignal | undefined
    const service = createSessionService({
      getSessionMessages: vi.fn(async (sessionId, _query, options) => {
        trackedSignal = options.signal

        return {
          requestId: 'request-history-001',
          data: {
            sessionId,
            messages: [],
            nextCursor: null,
          },
        }
      }),
    })
    const assistantSession = useAssistantSession({
      assistantService: service,
      hostContext: createHostContext({
        getHostManagedSessionId: vi.fn(async () => 'session-host'),
      }),
    })

    await assistantSession.restoreOrCreateSession()

    expect(service.getSessionMessages).toHaveBeenCalledTimes(1)
    expect(trackedSignal).toBeInstanceOf(AbortSignal)
    expect(trackedSignal?.aborted).toBe(false)
    expect(service.getSessionMessages).toHaveBeenCalledWith(
      'session-host',
      { limit: 30, order: 'asc' },
      expect.objectContaining({
        identityHeaders,
        signal: trackedSignal,
      }),
    )
  })

  it('aborts pending shared runtime operations when cleanup is called', async () => {
    let trackedSignal: AbortSignal | undefined
    const service = createSessionService({
      createSession: vi.fn((request, options) => {
        trackedSignal = options.signal

        return new Promise((resolve, reject) => {
          options.signal?.addEventListener(
            'abort',
            () => reject({ code: 'aborted' }),
            { once: true },
          )

          if (options.signal?.aborted) {
            reject({ code: 'aborted' })
            return
          }

          void request
          void resolve
        })
      }),
    })
    const assistantSession = useAssistantSession({
      assistantService: service,
      hostContext: createHostContext(),
    })

    const restorePromise = assistantSession.restoreOrCreateSession()
    await waitFor(() => {
      expect(trackedSignal).toBeInstanceOf(AbortSignal)
    })

    expect(trackedSignal?.aborted).toBe(false)

    await assistantSession.cleanup()
    expect(trackedSignal?.aborted).toBe(true)
    await restorePromise
  })

  it('does not report cancel or abort success when no real service capability exists', async () => {
    const source = await readFile(
      'app/features/assistant/composables/useAssistantSession.ts',
      'utf8',
    )

    expect(source).not.toMatch(
      /async\s+cancelMessage\s*\([^)]*\)\s*\{\s*return\s*\{\s*ok:\s*true,\s*value:\s*\{\s*cancelled:\s*true\s*\}/,
    )
    expect(source).not.toMatch(
      /async\s+abortMessage\s*\([^)]*\)\s*\{\s*return\s*\{\s*ok:\s*true,\s*value:\s*\{\s*aborted:\s*true\s*\}/,
    )
    expect(source).toContain('transport_operation_unsupported')
  })
})
