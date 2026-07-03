import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ChatWidget from '../../../app/features/assistant/components/ChatWidget.vue'
import { useAssistantSessionStore } from '../../../app/stores/assistant/session'
import { useChatWidgetStore } from '../../../app/stores/assistant/useChatWidgetStore'
import { createSessionStorageSessionMap } from '../../../app/utils/assistant/sessionStorageSessionMap'
import {
  contextNotReadySnapshot,
  hostManagedSessionContextSnapshot,
  pageHostContextSnapshot,
  pageSessionScopeFixture,
} from '../../fixtures/assistant-api/host-context'
import type {
  AssistantHostContextProvider,
  AssistantSession,
  AssistantSuccessEnvelope,
  SessionMessagesResponse,
} from '../../../app/types/assistant'

const mountedWrappers: VueWrapper[] = []

const openSession = {
  id: 'session-restored-001',
  title: 'Restored session',
  status: 'open',
  createdAt: '2026-07-03T01:00:00.000Z',
  updatedAt: '2026-07-03T01:05:00.000Z',
} satisfies AssistantSession

const firstHistoryPage = {
  requestId: 'request-history-first',
  data: {
    sessionId: openSession.id,
    messages: [
      {
        messageId: 'message-001',
        role: 'user',
        content: 'First message',
        createdAt: '2026-07-03T01:00:01.000Z',
      },
      {
        messageId: 'message-002',
        role: 'assistant',
        content: 'Second message',
        createdAt: '2026-07-03T01:00:02.000Z',
        answerDecision: 'answered',
      },
    ],
    nextCursor: 'message-002',
  },
} satisfies AssistantSuccessEnvelope<SessionMessagesResponse>

const finalHistoryPage = {
  requestId: 'request-history-final',
  data: {
    sessionId: openSession.id,
    messages: [
      {
        messageId: 'message-003',
        role: 'user',
        content: 'Third message',
        createdAt: '2026-07-03T01:00:03.000Z',
      },
    ],
    nextCursor: null,
  },
} satisfies AssistantSuccessEnvelope<SessionMessagesResponse>

function createProvider(
  snapshot = pageHostContextSnapshot,
): AssistantHostContextProvider {
  return {
    getSnapshot: vi.fn(() => snapshot),
  }
}

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function createSessionEnvelope(session: AssistantSession) {
  return {
    requestId: `request-${session.id}`,
    data: session,
  } satisfies AssistantSuccessEnvelope<AssistantSession>
}

function installFetchQueue(...responses: Response[]) {
  const fetchMock = vi.fn(async () => {
    const response = responses.shift()

    if (!response) {
      throw new Error('Unexpected fetch call')
    }

    return response
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function mountWidget(
  provider: AssistantHostContextProvider,
): Promise<VueWrapper> {
  const wrapper = await mountSuspended(ChatWidget, {
    attachTo: document.body,
    props: {
      hostContextProvider: provider,
    },
  })
  const nuxtPinia = (
    wrapper.vm as unknown as { $pinia: Pinia }
  ).$pinia
  setActivePinia(nuxtPinia)
  useChatWidgetStore().reset()
  useAssistantSessionStore().resetSessionState()
  await nextTick()
  mountedWrappers.push(wrapper)
  return wrapper
}

async function openPanel(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')
  await flushPromises()
}

function getRequestUrl(call: unknown[]): string {
  return String(call[0])
}

describe('panel-open session bootstrap and history', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useChatWidgetStore().reset()
    useAssistantSessionStore().resetSessionState()
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount()
    }

    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.sessionStorage.clear()
    window.localStorage.clear()
    document.body.innerHTML = ''
  })

  it('does not bootstrap until the floating panel is opened', async () => {
    const fetchMock = installFetchQueue(
      createJsonResponse(createSessionEnvelope(openSession)),
    )
    const wrapper = await mountWidget(createProvider())

    expect(wrapper.find('[data-testid="assistant-panel"]').exists()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()

    await openPanel(wrapper)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getRequestUrl(fetchMock.mock.calls[0]!)).toBe(
      '/api/v1/assistant/sessions',
    )

    await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')
    await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows only the context-not-ready safe state when host context is not ready', async () => {
    const fetchMock = installFetchQueue(
      createJsonResponse(createSessionEnvelope(openSession)),
    )
    const wrapper = await mountWidget(createProvider(contextNotReadySnapshot))

    await openPanel(wrapper)

    expect(
      wrapper.get('[data-testid="assistant-message-context-not-ready"]').text(),
    ).toContain('目前頁面內容尚未就緒')
    expect(
      wrapper.find('[data-testid="assistant-session-recovery"]').exists(),
    ).toBe(false)
    expect(wrapper.text()).not.toContain('重新開始')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('restores a host-managed session before a scoped storage fallback', async () => {
    const sessionMap = createSessionStorageSessionMap({
      storage: window.sessionStorage,
    })
    sessionMap.write(pageSessionScopeFixture.key, 'session-storage-001')

    const fetchMock = installFetchQueue(
      createJsonResponse(createSessionEnvelope({
        ...openSession,
        id: 'session-host-managed-001',
      })),
      createJsonResponse({
        ...firstHistoryPage,
        data: {
          ...firstHistoryPage.data,
          sessionId: 'session-host-managed-001',
        },
      }),
    )
    const wrapper = await mountWidget(
      createProvider(hostManagedSessionContextSnapshot),
    )

    await openPanel(wrapper)

    expect(getRequestUrl(fetchMock.mock.calls[0]!)).toBe(
      '/api/v1/assistant/sessions/session-host-managed-001',
    )
    expect(getRequestUrl(fetchMock.mock.calls[1]!)).toContain(
      '/api/v1/assistant/sessions/session-host-managed-001/messages?',
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('restores a scoped sessionStorage pointer without using localStorage', async () => {
    const localStorageGet = vi.spyOn(window.localStorage, 'getItem')
    const localStorageSet = vi.spyOn(window.localStorage, 'setItem')
    const sessionMap = createSessionStorageSessionMap({
      storage: window.sessionStorage,
    })
    sessionMap.write(pageSessionScopeFixture.key, openSession.id)

    const fetchMock = installFetchQueue(
      createJsonResponse(createSessionEnvelope(openSession)),
      createJsonResponse(firstHistoryPage),
    )
    const wrapper = await mountWidget(createProvider())

    await openPanel(wrapper)

    expect(getRequestUrl(fetchMock.mock.calls[0]!)).toBe(
      `/api/v1/assistant/sessions/${openSession.id}`,
    )
    expect(localStorageGet).not.toHaveBeenCalled()
    expect(localStorageSet).not.toHaveBeenCalled()
  })

  it('loads asc history pages using only nextCursor', async () => {
    const sessionMap = createSessionStorageSessionMap({
      storage: window.sessionStorage,
    })
    sessionMap.write(pageSessionScopeFixture.key, openSession.id)

    const fetchMock = installFetchQueue(
      createJsonResponse(createSessionEnvelope(openSession)),
      createJsonResponse(firstHistoryPage),
      createJsonResponse(finalHistoryPage),
    )
    const wrapper = await mountWidget(createProvider())

    await openPanel(wrapper)

    const firstHistoryUrl = getRequestUrl(fetchMock.mock.calls[1]!)
    expect(firstHistoryUrl).toContain(
      `/api/v1/assistant/sessions/${openSession.id}/messages?`,
    )
    expect(firstHistoryUrl).toContain('limit=30')
    expect(firstHistoryUrl).toContain('order=asc')
    expect(firstHistoryUrl).not.toContain('/history')
    expect(firstHistoryUrl).not.toContain('order=desc')
    expect(firstHistoryUrl).not.toContain('hasMore')
    expect(wrapper.text()).toContain('First message')
    expect(wrapper.text()).toContain('Second message')

    await wrapper
      .get('[data-testid="assistant-history-load-more"]')
      .trigger('click')
    await flushPromises()

    const nextHistoryUrl = getRequestUrl(fetchMock.mock.calls[2]!)
    expect(nextHistoryUrl).toContain('cursor=message-002')
    expect(nextHistoryUrl).toContain('order=asc')
    expect(wrapper.text().indexOf('First message')).toBeLessThan(
      wrapper.text().indexOf('Second message'),
    )
    expect(wrapper.text().indexOf('Second message')).toBeLessThan(
      wrapper.text().indexOf('Third message'),
    )
    expect(
      wrapper.find('[data-testid="assistant-history-load-more"]').exists(),
    ).toBe(false)
  })

  it.each(['expired', 'closed'])(
    'shows manual recovery for a stored %s session',
    async (status) => {
      const sessionMap = createSessionStorageSessionMap({
        storage: window.sessionStorage,
      })
      sessionMap.write(pageSessionScopeFixture.key, openSession.id)
      const fetchMock = installFetchQueue(
        createJsonResponse(createSessionEnvelope({
          ...openSession,
          status,
        })),
        createJsonResponse(createSessionEnvelope({
          ...openSession,
          id: 'session-restarted-001',
        })),
      )
      const wrapper = await mountWidget(createProvider())

      await openPanel(wrapper)

      expect(sessionMap.read(pageSessionScopeFixture.key)).toBeNull()
      expect(
        wrapper.get('[data-testid="assistant-session-recovery"]').text(),
      ).toContain('重新開始')
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await wrapper
        .get('[data-testid="assistant-session-restart"]')
        .trigger('click')
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(getRequestUrl(fetchMock.mock.calls[1]!)).toBe(
        '/api/v1/assistant/sessions',
      )
      expect(
        wrapper.find('[data-testid="assistant-session-recovery"]').exists(),
      ).toBe(false)
    },
  )

  it.each([
    {
      status: 403,
      code: 'forbidden',
    },
    {
      status: 404,
      code: 'not_found',
    },
  ])(
    'clears an inaccessible fallback and waits for restart ($status)',
    async ({ status, code }) => {
      const sessionMap = createSessionStorageSessionMap({
        storage: window.sessionStorage,
      })
      sessionMap.write(pageSessionScopeFixture.key, openSession.id)
      const fetchMock = installFetchQueue(
        createJsonResponse({
          requestId: `request-${code}`,
          error: {
            code,
            message: 'Safe session error.',
            statusCode: status,
          },
        }, status),
      )
      const wrapper = await mountWidget(createProvider())

      await openPanel(wrapper)

      expect(sessionMap.read(pageSessionScopeFixture.key)).toBeNull()
      expect(
        wrapper.find('[data-testid="assistant-session-recovery"]').exists(),
      ).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    },
  )

  it('does not render external-service semantics in history or recovery UI', async () => {
    installFetchQueue(
      createJsonResponse(createSessionEnvelope({
        ...openSession,
        status: 'expired',
      })),
    )
    const sessionMap = createSessionStorageSessionMap({
      storage: window.sessionStorage,
    })
    sessionMap.write(pageSessionScopeFixture.key, openSession.id)
    const wrapper = await mountWidget(createProvider())

    await openPanel(wrapper)

    const renderedText = wrapper.text().toLowerCase()
    for (const forbiddenCopy of [
      'public chatbot',
      'customer service',
      'customer support',
      'contact us',
      'lead capture',
      'handoff',
      '轉人工客服',
      '表單留資',
    ]) {
      expect(renderedText).not.toContain(forbiddenCopy)
    }
  })
})
