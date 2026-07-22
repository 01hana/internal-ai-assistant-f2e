import { computed, shallowRef } from 'vue'
import type { AssistantService } from '../../../services/api/assistant'
import type {
  AssistantApiRequestOptions,
  AssistantSessionId,
  SendAssistantMessageRequest,
} from '../../../types/assistant'
import {
  createAssistantSseStreamRunner,
  type AssistantErrorSseEvent,
  type AssistantFinalSseEvent,
  type AssistantSseParser,
  type AssistantSseStreamCallbacks,
  type AssistantSseStreamSafeError,
  type AssistantSseStreamStatus,
} from '../../../../packages/assistant-runtime/src/sse'
import type {
  AssistantSseEvent,
} from '../../../../packages/assistant-runtime/src/types'
import type {
  AssistantSseParseResult,
} from '../../../utils/assistant/assistantSseParser'

export type {
  AssistantErrorSseEvent,
  AssistantFinalSseEvent,
  AssistantSseStreamCallbacks,
  AssistantSseStreamSafeError,
  AssistantSseStreamStatus,
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

export function useAssistantSseStream(
  options: UseAssistantSseStreamOptions,
) {
  const statusState = shallowRef<AssistantSseStreamStatus>('idle')
  const lastErrorState = shallowRef<AssistantSseStreamSafeError | null>(null)
  const finalEventState = shallowRef<AssistantFinalSseEvent | null>(null)
  const lastEventState = shallowRef<AssistantSseEvent | null>(null)
  const resultsState = shallowRef<readonly AssistantSseParseResult[]>([])

  const runner = createAssistantSseStreamRunner<StartAssistantSseStreamInput>({
    createParser: options.createParser,
    createTextDecoder: options.createTextDecoder,
    inactivityTimeoutMs: options.inactivityTimeoutMs,
    callbacks: options.callbacks,
    async openStream(input, runnerOptions) {
      const response = await options.assistantService.sendMessageStream(
        input.sessionId,
        input.request,
        {
          ...input.options,
          signal: runnerOptions.signal,
        },
      )

      return response.body ?? null
    },
    state: {
      onStatusChange(nextStatus) {
        statusState.value = nextStatus
      },
      onErrorChange(error) {
        lastErrorState.value = error
      },
      onFinalEventChange(event) {
        finalEventState.value = event
      },
      onLastEventChange(event) {
        lastEventState.value = event
      },
      onResultsChange(results) {
        resultsState.value = results
      },
    },
  })

  const status = computed(() => statusState.value)
  const isStreaming = computed(
    () => statusState.value === 'connecting'
      || statusState.value === 'streaming',
  )
  const lastError = computed(() => lastErrorState.value)
  const finalEvent = computed(() => finalEventState.value)
  const lastEvent = computed(() => lastEventState.value)
  const results = computed(() => resultsState.value)

  async function start(input: StartAssistantSseStreamInput): Promise<void> {
    await runner.start(input, { externalSignal: input.options.signal })
  }

  return {
    status,
    isStreaming,
    lastError,
    finalEvent,
    lastEvent,
    results,
    start,
    cancel: runner.cancel,
    reset: runner.reset,
  }
}
