import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  useAssistantSseStream,
  type AssistantSseStreamCallbacks,
  type AssistantSseStreamService,
} from '../../../app/features/assistant/composables/useAssistantSseStream'
import { AssistantService } from '../../../app/services/api/assistant'
import type {
  AssistantApiRequestOptions,
  AssistantIdentityHeaders,
  AssistantSseEventInput,
  SendAssistantMessageRequest,
} from '../../../app/types/assistant'
import {
  answerDeltaEvent,
  errorEvent,
  finalAnsweredIdOnlyEvent,
  toolCallFailedEvent,
  unknownEvent,
} from '../../fixtures/assistant-sse/events'

const identityHeaders = {
  'x-request-id': 'request-stream-lifecycle-001',
  'x-actor-id': 'actor-001',
  'x-organization-id': 'org-001',
  'x-host-app': 'erp-web',
  'x-role': 'operator',
} satisfies AssistantIdentityHeaders

const startInput = {
  sessionId: 'session-001',
  request: {
    message: 'Show the current order status.',
    pageContext: {
      route: '/orders/SO-10001',
      entityType: 'order',
      entityId: 'SO-10001',
    },
  },
  options: {
    identityHeaders,
  },
} satisfies {
  sessionId: string
  request: SendAssistantMessageRequest
  options: AssistantApiRequestOptions
}

function toSseFrame(
  event: AssistantSseEventInput,
  trailingBlankLine = true,
): string {
  const frame = [
    `event: ${event.eventType}`,
    `data: ${JSON.stringify(event)}`,
  ].join('\n')

  return trailingBlankLine ? `${frame}\n\n` : frame
}

function createChunkedSseResponse(chunks: readonly string[]): Response {
  const encoder = new TextEncoder()

  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  }), {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
    },
  })
}

function createService(
  implementation: AssistantSseStreamService['sendMessageStream'],
): AssistantSseStreamService & {
  sendMessageStream: ReturnType<
    typeof vi.fn<AssistantSseStreamService['sendMessageStream']>
  >
} {
  return {
    sendMessageStream: vi.fn(implementation),
  }
}

async function waitFor(
  predicate: () => boolean,
  message = 'condition was not reached',
): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    if (predicate()) {
      return
    }
    await Promise.resolve()
  }

  throw new Error(message)
}

describe('useAssistantSseStream lifecycle', () => {
  it('calls the service with an internal signal and completes only on final', async () => {
    let resolveResponse!: (response: Response) => void
    const service = createService(() =>
      new Promise<Response>((resolve) => {
        resolveResponse = resolve
      }))
    const onResult = vi.fn()
    const onEvent = vi.fn()
    const onFinal = vi.fn()
    const onComplete = vi.fn()
    const stream = useAssistantSseStream({
      assistantService: service,
      callbacks: {
        onResult,
        onEvent,
        onFinal,
        onComplete,
      },
    })

    const startPromise = stream.start(startInput)

    expect(stream.status.value).toBe('connecting')
    const serviceOptions = service.sendMessageStream.mock.calls[0]![2]
    expect(serviceOptions.identityHeaders).toEqual(identityHeaders)
    expect(serviceOptions.signal).toBeInstanceOf(AbortSignal)
    expect(serviceOptions.signal).not.toBe(startInput.options.signal)

    const payload = [
      toSseFrame(answerDeltaEvent),
      toSseFrame(finalAnsweredIdOnlyEvent, false),
    ].join('')
    resolveResponse(createChunkedSseResponse([
      payload.slice(0, 17),
      payload.slice(17, 83),
      payload.slice(83),
    ]))

    await startPromise

    expect(stream.status.value).toBe('completed')
    expect(stream.isStreaming.value).toBe(false)
    expect(stream.results.value).toHaveLength(2)
    expect(stream.lastEvent.value).toEqual(finalAnsweredIdOnlyEvent)
    expect(stream.finalEvent.value).toEqual(finalAnsweredIdOnlyEvent)
    expect(stream.lastError.value).toBeNull()
    expect(onResult).toHaveBeenCalledTimes(2)
    expect(onEvent).toHaveBeenCalledTimes(2)
    expect(onFinal).toHaveBeenCalledOnce()
    expect(onFinal).toHaveBeenCalledWith(finalAnsweredIdOnlyEvent)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('keeps non-final event types from producing a final result', async () => {
    const onFinal = vi.fn()
    const onErrorEvent = vi.fn()
    const onTransportError = vi.fn()
    const service = createService(async () =>
      createChunkedSseResponse([
        toSseFrame(answerDeltaEvent),
        toSseFrame(toolCallFailedEvent),
        toSseFrame(errorEvent),
      ]))
    const stream = useAssistantSseStream({
      assistantService: service,
      callbacks: {
        onFinal,
        onErrorEvent,
        onTransportError,
      },
    })

    await stream.start(startInput)

    expect(stream.status.value).toBe('interrupted')
    expect(stream.finalEvent.value).toBeNull()
    expect(stream.lastError.value).toMatchObject({
      code: 'stream_interrupted',
    })
    expect(onFinal).not.toHaveBeenCalled()
    expect(onErrorEvent).toHaveBeenCalledWith(errorEvent)
    expect(onTransportError).not.toHaveBeenCalled()
  })

  it('keeps comment, unknown, malformed, and ignored results non-fatal', async () => {
    const duplicateDelta = toSseFrame(answerDeltaEvent)
    const payload = [
      ': heartbeat\n\n',
      toSseFrame(unknownEvent),
      'event: final\ndata: {invalid-json}\n\n',
      duplicateDelta,
      duplicateDelta,
      toSseFrame(finalAnsweredIdOnlyEvent),
    ].join('')
    const callbacks = {
      onUnknownEvent: vi.fn(),
      onMalformedEvent: vi.fn(),
      onIgnoredEvent: vi.fn(),
    } satisfies AssistantSseStreamCallbacks
    const stream = useAssistantSseStream({
      assistantService: createService(async () =>
        createChunkedSseResponse([payload])),
      callbacks,
    })

    await stream.start(startInput)

    expect(stream.status.value).toBe('completed')
    expect(stream.results.value.map(result => result.kind)).toEqual([
      'comment',
      'unknown_event',
      'malformed_event',
      'event',
      'ignored_event',
      'event',
    ])
    expect(callbacks.onUnknownEvent).toHaveBeenCalledOnce()
    expect(callbacks.onMalformedEvent).toHaveBeenCalledOnce()
    expect(callbacks.onIgnoredEvent).toHaveBeenCalledOnce()
    expect(stream.finalEvent.value).toEqual(finalAnsweredIdOnlyEvent)
  })

  it('marks EOF before final as interrupted instead of completed', async () => {
    const onInterrupted = vi.fn()
    const onComplete = vi.fn()
    const stream = useAssistantSseStream({
      assistantService: createService(async () =>
        createChunkedSseResponse([toSseFrame(answerDeltaEvent)])),
      callbacks: {
        onInterrupted,
        onComplete,
      },
    })

    await stream.start(startInput)

    expect(stream.status.value).toBe('interrupted')
    expect(stream.finalEvent.value).toBeNull()
    expect(onInterrupted).toHaveBeenCalledWith({
      code: 'stream_interrupted',
      safeMessage: 'The assistant stream ended before a final result.',
    })
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('times out after 60 seconds of inactivity without a final event', async () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const onTransportError = vi.fn()
    const response = new Response(new ReadableStream<Uint8Array>({
      start() {},
    }), {
      headers: {
        'content-type': 'text/event-stream',
      },
    })
    const stream = useAssistantSseStream({
      assistantService: createService(async () => response),
      callbacks: {
        onTimeout,
        onTransportError,
      },
    })

    const startPromise = stream.start(startInput)
    await waitFor(() => stream.status.value === 'streaming')
    await vi.advanceTimersByTimeAsync(60_000)
    await startPromise

    expect(stream.status.value).toBe('timeout')
    expect(stream.finalEvent.value).toBeNull()
    expect(stream.lastError.value).toMatchObject({
      code: 'stream_timeout',
    })
    expect(onTimeout).toHaveBeenCalledOnce()
    expect(onTransportError).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it.each([
    {
      title: 'service rejection',
      service: createService(async () => {
        throw new Error('Synthetic transport diagnostics')
      }),
      expectedCode: 'stream_transport_error',
    },
    {
      title: 'missing response body',
      service: createService(async () => new Response(null)),
      expectedCode: 'missing_stream_body',
    },
    {
      title: 'reader failure',
      service: createService(async () =>
        new Response(new ReadableStream<Uint8Array>({
          start(controller) {
            controller.error(new Error('Synthetic reader diagnostics'))
          },
        }))),
      expectedCode: 'stream_read_error',
    },
  ])('handles $title as a safe transport error', async ({
    service,
    expectedCode,
  }) => {
    const onTransportError = vi.fn()
    const onErrorEvent = vi.fn()
    const stream = useAssistantSseStream({
      assistantService: service,
      callbacks: {
        onTransportError,
        onErrorEvent,
      },
    })

    await stream.start(startInput)

    expect(stream.status.value).toBe('error')
    expect(stream.lastError.value).toMatchObject({
      code: expectedCode,
    })
    expect(stream.lastError.value).not.toHaveProperty('stack')
    expect(stream.finalEvent.value).toBeNull()
    expect(onTransportError).toHaveBeenCalledOnce()
    expect(onErrorEvent).not.toHaveBeenCalled()
  })

  it('cancels an active stream without reporting a transport error', async () => {
    const readerCancel = vi.fn()
    const onAbort = vi.fn()
    const onComplete = vi.fn()
    const onTransportError = vi.fn()
    const response = new Response(new ReadableStream<Uint8Array>({
      start() {},
      cancel: readerCancel,
    }))
    const stream = useAssistantSseStream({
      assistantService: createService(async () => response),
      callbacks: {
        onAbort,
        onComplete,
        onTransportError,
      },
    })

    const startPromise = stream.start(startInput)
    await waitFor(() => stream.status.value === 'streaming')
    await stream.cancel()
    await startPromise

    expect(stream.status.value).toBe('aborted')
    expect(stream.finalEvent.value).toBeNull()
    expect(stream.lastError.value).toBeNull()
    expect(readerCancel).toHaveBeenCalledOnce()
    expect(onAbort).toHaveBeenCalledOnce()
    expect(onComplete).not.toHaveBeenCalled()
    expect(onTransportError).not.toHaveBeenCalled()
  })

  it('bridges an external abort signal and skips already-aborted starts', async () => {
    const controller = new AbortController()
    const service = createService(async () =>
      new Response(new ReadableStream<Uint8Array>({ start() {} })))
    const onAbort = vi.fn()
    const stream = useAssistantSseStream({
      assistantService: service,
      callbacks: { onAbort },
    })

    const startPromise = stream.start({
      ...startInput,
      options: {
        ...startInput.options,
        signal: controller.signal,
      },
    })
    await waitFor(() => stream.status.value === 'streaming')
    controller.abort()
    await startPromise

    expect(stream.status.value).toBe('aborted')
    expect(onAbort).toHaveBeenCalledOnce()

    const alreadyAborted = new AbortController()
    alreadyAborted.abort()
    await stream.start({
      ...startInput,
      options: {
        ...startInput.options,
        signal: alreadyAborted.signal,
      },
    })

    expect(service.sendMessageStream).toHaveBeenCalledOnce()
    expect(stream.status.value).toBe('aborted')
  })

  it('auto-cancels a previous run without allowing stale state to win', async () => {
    const firstCancel = vi.fn()
    const firstResponse = new Response(new ReadableStream<Uint8Array>({
      start() {},
      cancel: firstCancel,
    }))
    const secondResponse = createChunkedSseResponse([
      toSseFrame(finalAnsweredIdOnlyEvent),
    ])
    const service = createService(
      vi.fn()
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse),
    )
    const onAbort = vi.fn()
    const stream = useAssistantSseStream({
      assistantService: service,
      callbacks: { onAbort },
    })

    const firstStart = stream.start(startInput)
    await waitFor(() => stream.status.value === 'streaming')
    const secondStart = stream.start({
      ...startInput,
      request: {
        message: 'Start a replacement stream.',
      },
    })

    await Promise.all([firstStart, secondStart])

    expect(firstCancel).toHaveBeenCalledOnce()
    expect(onAbort).toHaveBeenCalledOnce()
    expect(stream.status.value).toBe('completed')
    expect(stream.finalEvent.value).toEqual(finalAnsweredIdOnlyEvent)
    expect(stream.results.value).toHaveLength(1)
  })

  it('contains callback failures without interrupting a valid final', async () => {
    const stream = useAssistantSseStream({
      assistantService: createService(async () =>
        createChunkedSseResponse([
          toSseFrame(finalAnsweredIdOnlyEvent),
        ])),
      callbacks: {
        onEvent() {
          throw new Error('Synthetic callback diagnostics')
        },
      },
    })

    await stream.start(startInput)

    expect(stream.status.value).toBe('completed')
    expect(stream.finalEvent.value).toEqual(finalAnsweredIdOnlyEvent)
    expect(stream.lastError.value).toEqual({
      code: 'callback_error',
      safeMessage: 'A stream callback could not be completed.',
    })
  })

  it('resets active and completed state back to idle', async () => {
    const stream = useAssistantSseStream({
      assistantService: createService(async () =>
        createChunkedSseResponse([
          toSseFrame(finalAnsweredIdOnlyEvent),
        ])),
    })

    await stream.start(startInput)
    await stream.reset()

    expect(stream.status.value).toBe('idle')
    expect(stream.lastError.value).toBeNull()
    expect(stream.finalEvent.value).toBeNull()
    expect(stream.lastEvent.value).toBeNull()
    expect(stream.results.value).toEqual([])
  })
})

describe('SSE stream architecture boundary', () => {
  it('keeps lifecycle orchestration out of transport, stores, and UI', async () => {
    const source = await readFile(
      new URL(
        '../../../app/features/assistant/composables/useAssistantSseStream.ts',
        import.meta.url,
      ),
      'utf8',
    )
    const methods = Object.getOwnPropertyNames(AssistantService.prototype)

    expect(source).not.toContain('$fetch')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('defineStore')
    expect(source).not.toContain('useAssistantSessionStore')
    expect(source).not.toContain('ChatWidget')
    expect(source).not.toContain('ChatPanel')
    expect(source).not.toContain('ChatInputBar')
    expect(source).not.toContain('docs/reference')
    expect(methods).toEqual(expect.arrayContaining([
      'createSession',
      'getSession',
      'getSessionMessages',
      'sendMessageStream',
    ]))
  })
})
