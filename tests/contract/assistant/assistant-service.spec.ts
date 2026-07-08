import { describe, expect, it, vi } from 'vitest'
import { createHttpClient, HttpClientError } from '../../../app/services'
import { AssistantService } from '../../../app/services/api/assistant'
import {
  feedbackNegativeSuccessResponse,
  feedbackPositiveSuccessResponse,
} from '../../fixtures/assistant-api/responses'
import type { AssistantIdentityHeaders } from '../../../app/types/assistant'

const identityHeaders = {
  'x-request-id': 'request-feedback-001',
  'x-actor-id': 'actor-001',
  'x-organization-id': 'org-001',
  'x-host-app': 'erp-web',
  'x-role': 'operator',
  'x-permission-scopes': 'orders:read',
} satisfies AssistantIdentityHeaders

describe('AssistantService feedback contract', () => {
  it('submits feedback to the encoded endpoint with the contract-aligned JSON body', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(feedbackPositiveSuccessResponse), {
        status: 201,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )
    const httpClient = createHttpClient({
      headers: {
        'x-client-baseline': 'internal-assistant',
      },
      fetcher,
    })
    const service = new AssistantService({ httpClient })

    const result = await service.submitFeedback(
      'message/with space',
      {
        rating: 'positive',
        intent: 'other',
      },
      {
        identityHeaders,
      },
    )

    const [requestUrl, init] = fetcher.mock.calls[0]!
    const headers = new Headers(init?.headers)

    expect(requestUrl).toBe(
      '/api/v1/assistant/messages/message%2Fwith%20space/feedback',
    )
    expect(init?.method).toBe('POST')
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('x-request-id')).toBe('request-feedback-001')
    expect(headers.get('x-client-baseline')).toBe('internal-assistant')
    expect(JSON.parse(String(init?.body))).toEqual({
      rating: 'positive',
      intent: 'other',
    })
    expect(result).toEqual(feedbackPositiveSuccessResponse)
  })

  it('surfaces backend feedback errors as safe HttpClientError instances', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          requestId: 'request-feedback-error-001',
          error: {
            code: 'assistant_unavailable',
            message: 'Assistant service is temporarily unavailable.',
          },
        }),
        {
          status: 503,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    )
    const service = new AssistantService({
      httpClient: createHttpClient({ fetcher }),
    })

    await expect(
      service.submitFeedback(
        feedbackNegativeSuccessResponse.data.messageId,
        {
          rating: 'negative',
          intent: 'not_helpful',
        },
        { identityHeaders },
      ),
    ).rejects.toBeInstanceOf(HttpClientError)

    await expect(
      service.submitFeedback(
        feedbackNegativeSuccessResponse.data.messageId,
        {
          rating: 'negative',
          intent: 'not_helpful',
        },
        { identityHeaders },
      ),
    ).rejects.toMatchObject({
      requestId: 'request-feedback-error-001',
      code: 'assistant_unavailable',
      message: 'Assistant service is temporarily unavailable.',
    })
  })
})
