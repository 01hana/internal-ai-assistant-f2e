import type {
  AssistantHostContextProvider,
  AssistantHostContextSnapshot,
} from '../../../types/assistant'

export interface AssistantHostContextAdapterOptions {
  snapshot?: AssistantHostContextSnapshot | null
  getSnapshot?: AssistantHostContextProvider['getSnapshot']
}

const DEMO_FALLBACK_SNAPSHOT: AssistantHostContextSnapshot = {
  readiness: {
    status: 'not_ready',
    reason: 'unsupported_host',
  },
  identityHeaders: null,
  pageContext: null,
  metadataSummary: {
    contextState: 'demo-or-test-fallback',
  },
}

export function useAssistantHostContextAdapter(
  options?: AssistantHostContextAdapterOptions,
): AssistantHostContextProvider {
  if (options?.getSnapshot) {
    return {
      getSnapshot: options.getSnapshot,
    }
  }

  return {
    getSnapshot: () => options?.snapshot ?? DEMO_FALLBACK_SNAPSHOT,
  }
}
