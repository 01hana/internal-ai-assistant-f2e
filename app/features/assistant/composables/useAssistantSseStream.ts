import { computed, shallowRef } from 'vue'
import type { AssistantService } from '../../../services/api/assistant'
import type {
  AssistantApiRequestOptions,
  AssistantSessionId,
  AssistantSseEvent,
  SendAssistantMessageRequest,
} from '../../../types/assistant'
import {
  AssistantSseParser,
  type AssistantSseIgnoredEventResult,
  type AssistantSseMalformedEventResult,
  type AssistantSseParseResult,
  type AssistantSseUnknownEventResult,
} from '../../../utils/assistant/assistantSseParser'

export type AssistantSseStreamStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'completed'
  | 'interrupted'
  | 'timeout'
  | 'aborted'
  | 'error'

export interface AssistantSseStreamSafeError {
  code:
    | 'stream_transport_error'
    | 'missing_stream_body'
    | 'stream_read_error'
    | 'stream_decode_error'
    | 'stream_interrupted'
    | 'stream_timeout'
    | 'callback_error'
  safeMessage: string
}

export type AssistantFinalSseEvent = Extract<
  AssistantSseEvent,
  { eventType: 'final' }
>

export type AssistantErrorSseEvent = Extract<
  AssistantSseEvent,
  { eventType: 'error' }
>

export interface AssistantSseStreamCallbacks {
  onResult?: (result: AssistantSseParseResult) => void
  onEvent?: (event: AssistantSseEvent) => void
  onUnknownEvent?: (result: AssistantSseUnknownEventResult) => void
  onMalformedEvent?: (result: AssistantSseMalformedEventResult) => void
  onIgnoredEvent?: (result: AssistantSseIgnoredEventResult) => void
  onFinal?: (event: AssistantFinalSseEvent) => void
  onErrorEvent?: (event: AssistantErrorSseEvent) => void
  onTransportError?: (error: AssistantSseStreamSafeError) => void
  onInterrupted?: (error: AssistantSseStreamSafeError) => void
  onTimeout?: (error: AssistantSseStreamSafeError) => void
  onComplete?: () => void
  onAbort?: () => void
}

export interface StartAssistantSseStreamInput {
  sessionId: AssistantSessionId
  request: SendAssistantMessageRequest
  options: AssistantApiRequestOptions
}

export type AssistantSseStreamService = Pick<
  AssistantService,
  'sendMessageStream'
>

export interface UseAssistantSseStreamOptions {
  assistantService: AssistantSseStreamService
  createParser?: () => AssistantSseParser
  createTextDecoder?: () => TextDecoder
  inactivityTimeoutMs?: number
  callbacks?: AssistantSseStreamCallbacks
}

interface ActiveAssistantSseRun {
  id: number
  controller: AbortController
  parser: AssistantSseParser
  decoder: TextDecoder
  reader: ReadableStreamDefaultReader<Uint8Array> | null
  timeoutId: ReturnType<typeof setTimeout> | null
  externalSignal: AbortSignal | null
  externalAbortHandler: (() => void) | null
  terminal: boolean
  aborted: boolean
  timedOut: boolean
}

const DEFAULT_INACTIVITY_TIMEOUT_MS = 60_000

const SAFE_ERRORS = {
  streamTransport: {
    code: 'stream_transport_error',
    safeMessage: 'The assistant stream could not be started.',
  },
  missingBody: {
    code: 'missing_stream_body',
    safeMessage: 'The assistant stream did not include a readable body.',
  },
  streamRead: {
    code: 'stream_read_error',
    safeMessage: 'The assistant stream could not be read.',
  },
  streamDecode: {
    code: 'stream_decode_error',
    safeMessage: 'The assistant stream could not be decoded.',
  },
  interrupted: {
    code: 'stream_interrupted',
    safeMessage: 'The assistant stream ended before a final result.',
  },
  timeout: {
    code: 'stream_timeout',
    safeMessage: 'The assistant stream timed out before a final result.',
  },
  callback: {
    code: 'callback_error',
    safeMessage: 'A stream callback could not be completed.',
  },
} as const satisfies Record<string, AssistantSseStreamSafeError>

export function useAssistantSseStream(
  options: UseAssistantSseStreamOptions,
) {
  const statusState = shallowRef<AssistantSseStreamStatus>('idle')
  const lastErrorState = shallowRef<AssistantSseStreamSafeError | null>(null)
  const finalEventState = shallowRef<AssistantFinalSseEvent | null>(null)
  const lastEventState = shallowRef<AssistantSseEvent | null>(null)
  const resultsState = shallowRef<AssistantSseParseResult[]>([])
  const timeoutMs = Math.max(
    1,
    options.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS,
  )

  let nextRunId = 0
  let activeRun: ActiveAssistantSseRun | null = null

  const status = computed(() => statusState.value)
  const isStreaming = computed(
    () => statusState.value === 'connecting'
      || statusState.value === 'streaming',
  )
  const lastError = computed(() => lastErrorState.value)
  const finalEvent = computed(() => finalEventState.value)
  const lastEvent = computed(() => lastEventState.value)
  const results = computed(() => resultsState.value)

  function isCurrentRun(run: ActiveAssistantSseRun): boolean {
    return activeRun === run
  }

  function setCallbackError(): void {
    if (lastErrorState.value === null) {
      lastErrorState.value = SAFE_ERRORS.callback
    }
  }

  function invokeCallback<TArgs extends unknown[]>(
    callback: ((...args: TArgs) => void) | undefined,
    ...args: TArgs
  ): void {
    if (!callback) {
      return
    }

    try {
      callback(...args)
    }
    catch {
      setCallbackError()
    }
  }

  function clearRunTimeout(run: ActiveAssistantSseRun): void {
    if (run.timeoutId !== null) {
      clearTimeout(run.timeoutId)
      run.timeoutId = null
    }
  }

  function cleanupExternalSignal(run: ActiveAssistantSseRun): void {
    if (run.externalSignal && run.externalAbortHandler) {
      run.externalSignal.removeEventListener(
        'abort',
        run.externalAbortHandler,
      )
    }
    run.externalSignal = null
    run.externalAbortHandler = null
  }

  function cleanupRun(run: ActiveAssistantSseRun): void {
    clearRunTimeout(run)
    cleanupExternalSignal(run)
  }

  async function cancelReader(
    run: ActiveAssistantSseRun,
  ): Promise<void> {
    try {
      await run.reader?.cancel()
    }
    catch {
      // Reader cancellation is best-effort during terminal cleanup.
    }
    run.reader = null
  }

  async function abortRun(
    run: ActiveAssistantSseRun,
    notify = true,
  ): Promise<void> {
    if (run.terminal) {
      return
    }

    run.terminal = true
    run.aborted = true
    cleanupRun(run)
    run.controller.abort()

    if (isCurrentRun(run)) {
      activeRun = null
      statusState.value = 'aborted'
      lastErrorState.value = null

      if (notify) {
        invokeCallback(options.callbacks?.onAbort)
      }
    }

    await cancelReader(run)
    run.parser.reset()
  }

  async function timeoutRun(run: ActiveAssistantSseRun): Promise<void> {
    if (run.terminal || !isCurrentRun(run)) {
      return
    }

    run.terminal = true
    run.timedOut = true
    cleanupRun(run)
    run.controller.abort()

    if (isCurrentRun(run)) {
      activeRun = null
      statusState.value = 'timeout'
      lastErrorState.value = SAFE_ERRORS.timeout
      invokeCallback(options.callbacks?.onTimeout, SAFE_ERRORS.timeout)
    }

    await cancelReader(run)
    run.parser.reset()
  }

  function armInactivityTimeout(run: ActiveAssistantSseRun): void {
    clearRunTimeout(run)
    run.timeoutId = setTimeout(() => {
      void timeoutRun(run)
    }, timeoutMs)
  }

  function attachExternalSignal(
    run: ActiveAssistantSseRun,
    signal: AbortSignal | undefined,
  ): void {
    if (!signal) {
      return
    }

    const abortHandler = () => {
      void abortRun(run)
    }

    run.externalSignal = signal
    run.externalAbortHandler = abortHandler
    signal.addEventListener('abort', abortHandler, { once: true })
  }

  function appendResult(result: AssistantSseParseResult): void {
    resultsState.value = [...resultsState.value, result]
  }

  function dispatchResults(
    run: ActiveAssistantSseRun,
    parsedResults: AssistantSseParseResult[],
  ): boolean {
    for (const result of parsedResults) {
      if (run.terminal || !isCurrentRun(run)) {
        return false
      }

      appendResult(result)
      invokeCallback(options.callbacks?.onResult, result)

      if (result.kind === 'unknown_event') {
        invokeCallback(options.callbacks?.onUnknownEvent, result)
        continue
      }

      if (result.kind === 'malformed_event') {
        invokeCallback(options.callbacks?.onMalformedEvent, result)
        continue
      }

      if (result.kind === 'ignored_event') {
        invokeCallback(options.callbacks?.onIgnoredEvent, result)
        continue
      }

      if (result.kind === 'comment') {
        continue
      }

      lastEventState.value = result.event
      invokeCallback(options.callbacks?.onEvent, result.event)

      if (result.event.eventType === 'error') {
        invokeCallback(options.callbacks?.onErrorEvent, result.event)
        continue
      }

      if (result.event.eventType === 'final') {
        finalEventState.value = result.event
        invokeCallback(options.callbacks?.onFinal, result.event)
        return true
      }
    }

    return false
  }

  async function finishCompleted(
    run: ActiveAssistantSseRun,
  ): Promise<void> {
    if (run.terminal || !isCurrentRun(run)) {
      return
    }

    run.terminal = true
    cleanupRun(run)
    await cancelReader(run)
    run.parser.reset()

    if (!isCurrentRun(run)) {
      return
    }

    activeRun = null
    statusState.value = 'completed'
    invokeCallback(options.callbacks?.onComplete)
  }

  function finishInterrupted(run: ActiveAssistantSseRun): void {
    if (run.terminal || !isCurrentRun(run)) {
      return
    }

    run.terminal = true
    cleanupRun(run)
    run.parser.reset()
    activeRun = null
    statusState.value = 'interrupted'
    lastErrorState.value = SAFE_ERRORS.interrupted
    invokeCallback(options.callbacks?.onInterrupted, SAFE_ERRORS.interrupted)
  }

  async function finishTransportError(
    run: ActiveAssistantSseRun,
    error: AssistantSseStreamSafeError,
  ): Promise<void> {
    if (run.terminal || !isCurrentRun(run)) {
      return
    }

    run.terminal = true
    cleanupRun(run)
    run.controller.abort()
    await cancelReader(run)
    run.parser.reset()

    if (!isCurrentRun(run)) {
      return
    }

    activeRun = null
    statusState.value = 'error'
    lastErrorState.value = error
    invokeCallback(options.callbacks?.onTransportError, error)
  }

  function createRun(): ActiveAssistantSseRun {
    return {
      id: nextRunId += 1,
      controller: new AbortController(),
      parser: options.createParser?.() ?? new AssistantSseParser(),
      decoder: options.createTextDecoder?.() ?? new TextDecoder(),
      reader: null,
      timeoutId: null,
      externalSignal: null,
      externalAbortHandler: null,
      terminal: false,
      aborted: false,
      timedOut: false,
    }
  }

  function resetRunState(): void {
    lastErrorState.value = null
    finalEventState.value = null
    lastEventState.value = null
    resultsState.value = []
  }

  async function start(input: StartAssistantSseStreamInput): Promise<void> {
    if (activeRun) {
      await abortRun(activeRun)
    }

    resetRunState()

    const run = createRun()
    activeRun = run
    statusState.value = 'connecting'
    attachExternalSignal(run, input.options.signal)

    if (input.options.signal?.aborted) {
      await abortRun(run)
      return
    }

    armInactivityTimeout(run)

    let response: Response
    try {
      response = await options.assistantService.sendMessageStream(
        input.sessionId,
        input.request,
        {
          ...input.options,
          signal: run.controller.signal,
        },
      )
    }
    catch {
      if (!run.aborted && !run.timedOut) {
        await finishTransportError(run, SAFE_ERRORS.streamTransport)
      }
      return
    }

    if (run.terminal || !isCurrentRun(run)) {
      return
    }

    if (!response.body) {
      await finishTransportError(run, SAFE_ERRORS.missingBody)
      return
    }

    run.reader = response.body.getReader()
    statusState.value = 'streaming'
    armInactivityTimeout(run)

    while (!run.terminal && isCurrentRun(run)) {
      let readResult: ReadableStreamReadResult<Uint8Array>

      try {
        readResult = await run.reader.read()
      }
      catch {
        if (!run.aborted && !run.timedOut) {
          await finishTransportError(run, SAFE_ERRORS.streamRead)
        }
        return
      }

      if (run.terminal || !isCurrentRun(run)) {
        return
      }

      if (readResult.done) {
        break
      }

      armInactivityTimeout(run)

      let decodedChunk: string
      try {
        decodedChunk = run.decoder.decode(readResult.value, { stream: true })
      }
      catch {
        await finishTransportError(run, SAFE_ERRORS.streamDecode)
        return
      }

      if (
        decodedChunk.length > 0
        && dispatchResults(run, run.parser.push(decodedChunk))
      ) {
        await finishCompleted(run)
        return
      }
    }

    if (run.terminal || !isCurrentRun(run)) {
      return
    }

    let decoderTail: string
    try {
      decoderTail = run.decoder.decode()
    }
    catch {
      await finishTransportError(run, SAFE_ERRORS.streamDecode)
      return
    }

    if (
      decoderTail.length > 0
      && dispatchResults(run, run.parser.push(decoderTail))
    ) {
      await finishCompleted(run)
      return
    }

    if (dispatchResults(run, run.parser.flush())) {
      await finishCompleted(run)
      return
    }

    finishInterrupted(run)
  }

  async function cancel(): Promise<void> {
    if (activeRun) {
      await abortRun(activeRun)
    }
  }

  async function reset(): Promise<void> {
    if (activeRun) {
      await abortRun(activeRun)
    }

    statusState.value = 'idle'
    resetRunState()
  }

  return {
    status,
    isStreaming,
    lastError,
    finalEvent,
    lastEvent,
    results,
    start,
    cancel,
    reset,
  }
}
