import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  backendErrorWithoutStatusCodeResponse,
  createSessionSuccessResponse,
  getSessionSuccessResponse,
  historyFirstPageSuccessResponse,
  sessionNotFoundErrorResponse,
} from '../../fixtures/assistant-api/responses'
import {
  createHttpClient,
  HttpClientError,
} from '../../../app/services'
import { AssistantService } from '../../../app/services/api/assistant'
import type { AssistantIdentityHeaders } from '../../../app/types/assistant'

const identityHeaders = {
  'x-request-id': 'req-session-contract-001',
  'x-actor-id': 'actor-001',
  'x-organization-id': 'org-001',
  'x-host-app': 'erp-web',
  'x-role': 'operator',
  'x-permission-scopes': 'orders:read',
} satisfies AssistantIdentityHeaders

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function createService(payload: unknown, status = 200) {
  const fetcher = vi.fn<typeof fetch>(async () => jsonResponse(payload, status))
  const httpClient = createHttpClient({
    headers: {
      'x-client-baseline': 'internal-assistant',
    },
    fetcher,
  })

  return {
    fetcher,
    service: new AssistantService({ httpClient }),
  }
}

describe('AssistantService session contract', () => {
  it('creates a session with JSON and merged identity headers', async () => {
    const { fetcher, service } = createService(createSessionSuccessResponse, 201)
    const pageContext = {
      module: 'orders',
      route: '/orders/SO-10001',
      entityType: 'order',
      entityId: 'SO-10001',
    }

    await expect(
      service.createSession({ pageContext }, { identityHeaders }),
    ).resolves.toEqual(createSessionSuccessResponse)

    const [url, init] = fetcher.mock.calls[0]!
    const headers = new Headers(init?.headers)

    expect(url).toBe('/api/v1/assistant/sessions')
    expect(init?.method).toBe('POST')
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('x-client-baseline')).toBe('internal-assistant')
    expect(headers.get('x-request-id')).toBe('req-session-contract-001')
    expect(headers.get('x-actor-id')).toBe('actor-001')
    expect(JSON.parse(String(init?.body))).toEqual({ pageContext })
  })

  it('gets a session with an encoded path identifier', async () => {
    const { fetcher, service } = createService(getSessionSuccessResponse)

    await expect(
      service.getSession('session/with space', { identityHeaders }),
    ).resolves.toEqual(getSessionSuccessResponse)

    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe('/api/v1/assistant/sessions/session%2Fwith%20space')
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
  })
})

describe('AssistantService history contract', () => {
  it('uses only the messages endpoint with ascending cursor pagination', async () => {
    const { fetcher, service } = createService(
      historyFirstPageSuccessResponse,
    )

    const response = await service.getSessionMessages(
      'session-001',
      {
        limit: 30,
        cursor: 'message/with space',
      },
      { identityHeaders },
    )

    const [requestUrl, init] = fetcher.mock.calls[0]!
    const url = new URL(String(requestUrl), 'https://contract.test')

    expect(url.pathname).toBe(
      '/api/v1/assistant/sessions/session-001/messages',
    )
    expect(url.pathname).not.toContain('/history')
    expect(url.searchParams.get('limit')).toBe('30')
    expect(url.searchParams.get('cursor')).toBe('message/with space')
    expect(url.searchParams.get('order')).toBe('asc')
    expect(url.searchParams.get('order')).not.toBe('desc')
    expect(init?.method).toBe('GET')
    expect(response).toEqual(historyFirstPageSuccessResponse)
    expect(response.data.nextCursor).toBe('msg-user-001')
    expect(response.data).not.toHaveProperty('hasMore')
  })

  it('defaults history order to asc when query options are omitted', async () => {
    const { fetcher, service } = createService(
      historyFirstPageSuccessResponse,
    )

    await service.getSessionMessages(
      'session-001',
      {},
      { identityHeaders },
    )

    const [requestUrl] = fetcher.mock.calls[0]!
    const url = new URL(String(requestUrl), 'https://contract.test')
    expect(url.search).toBe('?order=asc')
  })
})

describe('shared HTTP error contract', () => {
  it.each([
    {
      fixture: sessionNotFoundErrorResponse,
      status: 404,
      expectedStatusCode: 404,
    },
    {
      fixture: backendErrorWithoutStatusCodeResponse,
      status: 503,
      expectedStatusCode: undefined,
    },
  ])(
    'converts safe error envelopes without exposing raw response data',
    async ({ fixture, status, expectedStatusCode }) => {
      const { service } = createService(fixture, status)

      const request = service.getSession('session-hidden-001', {
        identityHeaders,
      })

      await expect(request).rejects.toBeInstanceOf(HttpClientError)
      await expect(request).rejects.toMatchObject({
        requestId: fixture.requestId,
        code: fixture.error.code,
        statusCode: expectedStatusCode,
        message: fixture.error.message,
      })
    },
  )
})

describe('assistant service architecture boundary', () => {
  it('keeps one domain service without alternate clients or direct $fetch', async () => {
    const serviceSource = await readFile(
      new URL('../../../app/services/api/assistant.ts', import.meta.url),
      'utf8',
    )
    const apiFiles = await readdir(
      new URL('../../../app/services/api/', import.meta.url),
    )

    expect(serviceSource).not.toContain('$fetch')
    expect(serviceSource).not.toContain('createChatClient')
    expect(serviceSource).not.toContain('createAssistantClient')
    expect(apiFiles.sort()).toEqual(['assistant.ts'])
    expect(apiFiles).not.toEqual(
      expect.arrayContaining([
        'sessions.ts',
        'messages.ts',
        'feedback.ts',
        'actionDrafts.ts',
        'approvalRequests.ts',
      ]),
    )
  })
})
