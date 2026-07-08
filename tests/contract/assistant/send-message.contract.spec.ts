import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  createHttpClient,
  HttpClientError,
} from '../../../app/services'
import { AssistantService } from '../../../app/services/api/assistant'
import type { AssistantIdentityHeaders } from '../../../app/types/assistant'

const identityHeaders = {
  'x-request-id': 'request-stream-001',
  'x-actor-id': 'actor-001',
  'x-organization-id': 'org-001',
  'x-host-app': 'erp-web',
  'x-role': 'operator',
  'x-permission-scopes': 'orders:read',
} satisfies AssistantIdentityHeaders

function createSseResponse(body = 'event: final\ndata: {}\n\n'): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
    },
  })
}

function createService(response: Response) {
  const fetcher = vi.fn<typeof fetch>(async () => response)
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

describe('AssistantService send-message stream contract', () => {
  it('sends JSON to the encoded session endpoint and returns an unread SSE response', async () => {
    const response = createSseResponse()
    const { fetcher, service } = createService(response)
    const controller = new AbortController()
    const request = {
      message: 'Show the current order status.',
      pageContext: {
        route: '/orders/SO-10001',
        screenId: 'order-detail',
        entityType: 'order',
        entityId: 'SO-10001',
      },
    }

    const result = await service.sendMessageStream(
      'session/with space',
      request,
      {
        identityHeaders,
        signal: controller.signal,
      },
    )

    const [requestUrl, init] = fetcher.mock.calls[0]!
    const headers = new Headers(init?.headers)

    expect(requestUrl).toBe(
      '/api/v1/assistant/sessions/session%2Fwith%20space/messages',
    )
    expect(String(requestUrl)).not.toContain('/history')
    expect(String(requestUrl)).not.toContain('/messages/stream')
    expect(init?.method).toBe('POST')
    expect(init?.signal).toBe(controller.signal)
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('accept')).toBe('text/event-stream')
    expect(headers.get('x-request-id')).toBe('request-stream-001')
    expect(headers.get('x-actor-id')).toBe('actor-001')
    expect(headers.get('x-client-baseline')).toBe('internal-assistant')
    expect(JSON.parse(String(init?.body))).toEqual(request)
    expect(result).toBe(response)
    expect(result.headers.get('content-type')).toContain('text/event-stream')
    expect(result.bodyUsed).toBe(false)
    await expect(result.text()).resolves.toBe('event: final\ndata: {}\n\n')
  })

  it('does not treat an HTTP 200 SSE error event as a transport failure', async () => {
    const body = [
      'event: error',
      'data: {"eventType":"error","data":{"code":"stream_error"}}',
      '',
      '',
    ].join('\n')
    const response = createSseResponse(body)
    const { service } = createService(response)

    const result = await service.sendMessageStream(
      'session-001',
      { message: 'Synthetic stream error scenario.' },
      { identityHeaders },
    )

    expect(result.bodyUsed).toBe(false)
    await expect(result.text()).resolves.toBe(body)
  })
})

describe('shared HTTP stream errors', () => {
  it('converts a non-OK JSON envelope into a safe typed error', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({
        requestId: 'request-error-001',
        error: {
          code: 'assistant_unavailable',
          message: 'Assistant service is temporarily unavailable.',
        },
      }), {
        status: 503,
        headers: {
          'content-type': 'application/json',
        },
      }))
    const httpClient = createHttpClient({ fetcher })

    const result = httpClient.stream({
      path: 'assistant/sessions/session-001/messages',
      method: 'POST',
      body: { message: 'Synthetic request.' },
    })

    await expect(result).rejects.toBeInstanceOf(HttpClientError)
    await expect(result).rejects.toMatchObject({
      requestId: 'request-error-001',
      code: 'assistant_unavailable',
      statusCode: undefined,
      message: 'Assistant service is temporarily unavailable.',
    })
  })

  it('uses generic safe errors for malformed responses and network failures', async () => {
    const malformedClient = createHttpClient({
      fetcher: vi.fn<typeof fetch>(async () =>
        new Response('upstream diagnostics', {
          status: 502,
          headers: { 'content-type': 'text/plain' },
        })),
    })
    const networkClient = createHttpClient({
      fetcher: vi.fn<typeof fetch>(async () => {
        throw new Error('Synthetic network diagnostics')
      }),
    })

    await expect(malformedClient.stream({ path: 'assistant/test' }))
      .rejects.toMatchObject({
        code: 'http_error',
        statusCode: 502,
        message: 'The service could not complete the request.',
      })
    await expect(networkClient.stream({ path: 'assistant/test' }))
      .rejects.toMatchObject({
        code: 'network_error',
        message: 'The service is currently unreachable.',
      })
  })

  it('rejects an unexpected success content type without consuming the body', async () => {
    const response = new Response('{"data":"not-a-stream"}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
    const httpClient = createHttpClient({
      fetcher: vi.fn<typeof fetch>(async () => response),
    })

    await expect(httpClient.stream({ path: 'assistant/test' }))
      .rejects.toMatchObject({
        code: 'unexpected_content_type',
      })
    expect(response.bodyUsed).toBe(false)
  })

  it('supports silent errors without suppressing the thrown HttpClientError', async () => {
    const onError = vi.fn()
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response('unavailable', { status: 503 }))
    const httpClient = createHttpClient({ fetcher, onError })

    await expect(httpClient.stream({
      path: 'assistant/test',
      silent: true,
    })).rejects.toBeInstanceOf(HttpClientError)
    expect(onError).not.toHaveBeenCalled()

    await expect(httpClient.stream({
      path: 'assistant/test',
    })).rejects.toBeInstanceOf(HttpClientError)
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe('send-message architecture boundary', () => {
  it('keeps stream transport in the existing shared client and domain service', async () => {
    const serviceSource = await readFile(
      new URL('../../../app/services/api/assistant.ts', import.meta.url),
      'utf8',
    )
    const clientSource = await readFile(
      new URL('../../../app/services/index.ts', import.meta.url),
      'utf8',
    )
    const apiFiles = await readdir(
      new URL('../../../app/services/api/', import.meta.url),
    )
    const methods = Object.getOwnPropertyNames(AssistantService.prototype)

    expect(serviceSource).not.toContain('$fetch')
    expect(serviceSource).not.toContain('globalThis.fetch')
    expect(clientSource).not.toContain('createChatClient')
    expect(clientSource).not.toContain('createAssistantClient')
    expect(apiFiles.sort()).toEqual(['assistant.ts'])
    expect(methods).toEqual(expect.arrayContaining([
      'createSession',
      'getSession',
      'getSessionMessages',
      'sendMessageStream',
      'submitFeedback',
    ]))
    expect(methods).not.toEqual(expect.arrayContaining([
      'getActionDraft',
      'confirmActionDraft',
      'cancelActionDraft',
      'getApprovalRequest',
    ]))
  })
})
