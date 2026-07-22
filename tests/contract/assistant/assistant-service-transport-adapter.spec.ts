import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  createHttpClient,
  HttpClientError,
} from '../../../app/services'
import { AssistantService } from '../../../app/services/api/assistant'
import type { AssistantIdentityHeaders } from '../../../app/types/assistant'

const identityHeaders = {
  'x-request-id': 'request-transport-001',
  'x-actor-id': 'actor-001',
  'x-organization-id': 'org-001',
  'x-host-app': 'erp-web',
  'x-role': 'operator',
  'x-permission-scopes': 'orders:read',
} satisfies AssistantIdentityHeaders

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function createSseResponse(): Response {
  return new Response('event: final\ndata: {}\n\n', {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
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

function expectTransportRequest(
  fetcher: ReturnType<typeof vi.fn<typeof fetch>>,
  expected: {
    path: string
    method: string
    signal: AbortSignal
    body?: unknown
    query?: string
    accept?: string
  },
): void {
  const [requestUrl, init] = fetcher.mock.calls[0]!
  const headers = new Headers(init?.headers)
  const expectedUrl = expected.query
    ? `/api/v1/${expected.path}?${expected.query}`
    : `/api/v1/${expected.path}`

  expect(requestUrl).toBe(expectedUrl)
  expect(init?.method).toBe(expected.method)
  expect(init?.signal).toBe(expected.signal)
  expect(headers.get('x-request-id')).toBe('request-transport-001')
  expect(headers.get('x-actor-id')).toBe('actor-001')
  expect(headers.get('x-client-baseline')).toBe('internal-assistant')

  if (expected.accept) {
    expect(headers.get('accept')).toBe(expected.accept)
  }

  if (expected.body !== undefined) {
    expect(headers.get('content-type')).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toEqual(expected.body)
  }
  else {
    expect(init?.body).toBeUndefined()
  }
}

describe('AssistantService Nuxt transport adapter contract', () => {
  it('forwards create-session transport requests without owning session state', async () => {
    const envelope = {
      requestId: 'request-create-001',
      data: {
        sessionId: 'session-created',
        status: 'active',
      },
    }
    const controller = new AbortController()
    const { fetcher, service } = createService(createJsonResponse(envelope, 201))
    const request = {
      pageContext: {
        route: '/orders',
        screenId: 'orders',
      },
    }

    const result = await service.createSession(request, {
      identityHeaders,
      signal: controller.signal,
      silent: true,
    })

    expectTransportRequest(fetcher, {
      path: 'assistant/sessions',
      method: 'POST',
      signal: controller.signal,
      body: request,
    })
    expect(result).toEqual(envelope)
  })

  it('forwards get-session and history transport requests with encoded paths and query params', async () => {
    const sessionEnvelope = {
      requestId: 'request-get-001',
      data: {
        sessionId: 'session/with space',
        status: 'active',
      },
    }
    const historyEnvelope = {
      requestId: 'request-history-001',
      data: {
        sessionId: 'session/with space',
        messages: [],
        nextCursor: 'cursor-next',
      },
    }
    const controller = new AbortController()
    const getSession = createService(createJsonResponse(sessionEnvelope))
    const getHistory = createService(createJsonResponse(historyEnvelope))

    await expect(
      getSession.service.getSession('session/with space', {
        identityHeaders,
        signal: controller.signal,
      }),
    ).resolves.toEqual(sessionEnvelope)
    expectTransportRequest(getSession.fetcher, {
      path: 'assistant/sessions/session%2Fwith%20space',
      method: 'GET',
      signal: controller.signal,
    })

    await expect(
      getHistory.service.getSessionMessages(
        'session/with space',
        {
          limit: 30,
          cursor: 'cursor/with space',
          order: 'desc',
        },
        {
          identityHeaders,
          signal: controller.signal,
        },
      ),
    ).resolves.toEqual(historyEnvelope)
    expectTransportRequest(getHistory.fetcher, {
      path: 'assistant/sessions/session%2Fwith%20space/messages',
      query: 'limit=30&cursor=cursor%2Fwith+space&order=desc',
      method: 'GET',
      signal: controller.signal,
    })
  })

  it('returns an unread SSE Response for message streaming without parsing events', async () => {
    const controller = new AbortController()
    const response = createSseResponse()
    const { fetcher, service } = createService(response)
    const request = {
      message: 'Summarize current order risks.',
      pageContext: {
        route: '/orders/SO-10001',
      },
    }

    const result = await service.sendMessageStream(
      'session-stream',
      request,
      {
        identityHeaders,
        signal: controller.signal,
      },
    )

    expectTransportRequest(fetcher, {
      path: 'assistant/sessions/session-stream/messages',
      method: 'POST',
      signal: controller.signal,
      body: request,
      accept: 'text/event-stream',
    })
    expect(result).toBe(response)
    expect(result.bodyUsed).toBe(false)
  })

  it('forwards feedback, action draft, and approval transport methods without creating UI state', async () => {
    const controller = new AbortController()
    const feedbackEnvelope = {
      requestId: 'request-feedback-001',
      data: {
        feedbackEventId: 'feedback-001',
        messageId: 'message/with space',
        rating: 'positive',
        intent: 'other',
      },
    }
    const actionDraftEnvelope = {
      requestId: 'request-action-001',
      data: {
        actionDraftId: 'action/with space',
        requestId: 'request-action-001',
        messageId: 'message-001',
        status: 'waiting_confirmation',
        riskLevel: 'medium',
        toolName: 'orders.confirm',
        resource: 'order',
        operation: 'confirm',
      },
    }
    const confirmEnvelope = {
      requestId: 'request-confirm-001',
      data: {
        actionDraftId: 'action/with space',
        status: 'confirmed',
        duplicateSafe: false,
        recheck: {
          organizationBoundary: 'passed',
          draftStatus: 'passed',
          freshness: 'passed',
          permission: 'pending_execution_guard',
          toolContract: 'pending_execution_guard',
          idempotency: 'reserved',
        },
      },
    }
    const cancelEnvelope = {
      requestId: 'request-cancel-001',
      data: {
        actionDraftId: 'action/with space',
        status: 'cancelled',
      },
    }
    const approvalEnvelope = {
      requestId: 'request-approval-001',
      data: {
        approvalRequestId: 'approval/with space',
        requestId: 'request-approval-001',
        messageId: 'message-001',
        status: 'pending',
        riskLevel: 'high',
        requesterActorId: 'actor-001',
      },
    }

    const feedback = createService(createJsonResponse(feedbackEnvelope, 201))
    await expect(
      feedback.service.submitFeedback(
        'message/with space',
        {
          rating: 'positive',
          intent: 'other',
        },
        {
          identityHeaders,
          signal: controller.signal,
        },
      ),
    ).resolves.toEqual(feedbackEnvelope)
    expectTransportRequest(feedback.fetcher, {
      path: 'assistant/messages/message%2Fwith%20space/feedback',
      method: 'POST',
      signal: controller.signal,
      body: {
        rating: 'positive',
        intent: 'other',
      },
    })

    const actionDraft = createService(createJsonResponse(actionDraftEnvelope))
    await expect(
      actionDraft.service.getActionDraft('action/with space', {
        identityHeaders,
        signal: controller.signal,
      }),
    ).resolves.toEqual(actionDraftEnvelope)
    expectTransportRequest(actionDraft.fetcher, {
      path: 'assistant/action-drafts/action%2Fwith%20space',
      method: 'GET',
      signal: controller.signal,
    })

    const confirm = createService(createJsonResponse(confirmEnvelope))
    await expect(
      confirm.service.confirmActionDraft(
        'action/with space',
        { idempotencyKey: 'idem-001' },
        {
          identityHeaders,
          signal: controller.signal,
        },
      ),
    ).resolves.toEqual(confirmEnvelope)
    expectTransportRequest(confirm.fetcher, {
      path: 'assistant/action-drafts/action%2Fwith%20space/confirm',
      method: 'POST',
      signal: controller.signal,
      body: { idempotencyKey: 'idem-001' },
    })

    const cancel = createService(createJsonResponse(cancelEnvelope))
    await expect(
      cancel.service.cancelActionDraft('action/with space', {
        identityHeaders,
        signal: controller.signal,
      }),
    ).resolves.toEqual(cancelEnvelope)
    expectTransportRequest(cancel.fetcher, {
      path: 'assistant/action-drafts/action%2Fwith%20space/cancel',
      method: 'POST',
      signal: controller.signal,
    })

    const approval = createService(createJsonResponse(approvalEnvelope))
    await expect(
      approval.service.getApprovalRequest('approval/with space', {
        identityHeaders,
        signal: controller.signal,
      }),
    ).resolves.toEqual(approvalEnvelope)
    expectTransportRequest(approval.fetcher, {
      path: 'assistant/approval-requests/approval%2Fwith%20space',
      method: 'GET',
      signal: controller.signal,
    })
  })

  it('surfaces backend and network failures as safe HttpClientError results', async () => {
    const backendErrorService = new AssistantService({
      httpClient: createHttpClient({
        fetcher: vi.fn<typeof fetch>(async () =>
          createJsonResponse({
            requestId: 'request-error-001',
            error: {
              code: 'assistant_unavailable',
              message: 'Assistant service is temporarily unavailable.',
            },
          }, 503),
        ),
      }),
    })
    const networkErrorService = new AssistantService({
      httpClient: createHttpClient({
        fetcher: vi.fn<typeof fetch>(async () => {
          throw new Error('raw network diagnostic')
        }),
      }),
    })

    await expect(
      backendErrorService.createSession({}, { identityHeaders }),
    ).rejects.toMatchObject({
      requestId: 'request-error-001',
      code: 'assistant_unavailable',
      message: 'Assistant service is temporarily unavailable.',
    })
    await expect(
      networkErrorService.getSession('session-001', { identityHeaders }),
    ).rejects.toMatchObject({
      code: 'network_error',
      message: 'The service is currently unreachable.',
    })
    await expect(
      networkErrorService.getSession('session-001', { identityHeaders }),
    ).rejects.toBeInstanceOf(HttpClientError)
  })

  it('does not own canonical runtime, SSE, session, outcome, or UI state', async () => {
    const serviceSource = await readFile(
      new URL('../../../app/services/api/assistant.ts', import.meta.url),
      'utf8',
    )
    const forbiddenRuntimeOwnershipPatterns = [
      /\bparseAssistantSse\b/,
      /\bcreateAssistantSseStreamRunner\b/,
      /\bgetReader\s*\(/,
      /\bnew\s+ReadableStream\b/,
      /\bEventSource\b/,
      /\bfinalizeActiveStreamingMessage\b/,
      /\bappendAssistantStreamingPlaceholder\b/,
      /\bmarkStreaming(Cancelled|Interrupted|Failed)\b/,
      /\bclearStreamingState\b/,
      /\bmapAnswerDecisionState\b/,
      /\bnormalizeEvidenceReferences\b/,
      /\bcreateTerminalOutcome\b/,
      /\bstartFeedbackSubmissionState\b/,
      /\bcreateDefaultActionDraftState\b/,
      /\bcreateDefaultApprovalRequestState\b/,
      /\bruntimeController\b/,
      /\buseAssistantSessionStore\b/,
      /\buseChatWidgetStore\b/,
      /\bChatWidget\b/,
      /\bChatPanel\b/,
      /\bChatInputBar\b/,
    ]

    expect(serviceSource).toContain('createHttpClient')
    expect(serviceSource).toContain('this.httpClient.request')
    expect(serviceSource).toContain('this.httpClient.stream')

    for (const pattern of forbiddenRuntimeOwnershipPatterns) {
      expect(serviceSource, `AssistantService must remain transport-only: ${pattern}`).not.toMatch(pattern)
    }
  })
})
