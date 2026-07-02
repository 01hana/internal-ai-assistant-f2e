import { computed, shallowRef } from 'vue'
import type {
  AssistantHostContextProvider,
  AssistantHostContextReadPurpose,
  AssistantHostContextSnapshot,
  AssistantIdentityHeaders,
  AssistantSessionId,
  AssistantSessionScope,
  OpenApprovalDetailPayload,
  PageContext,
} from '../../../types/assistant'
import { resolveDefaultSessionScope } from '../../../utils/assistant/defaultSessionScopeResolver'
import { sanitizePageContext } from '../../../utils/assistant/pageContextSanitizer'

const INITIAL_SNAPSHOT: AssistantHostContextSnapshot = {
  readiness: {
    status: 'not_ready',
    reason: 'unsupported_host',
  },
  identityHeaders: null,
  pageContext: null,
  metadataSummary: {
    contextState: 'host-context-uninitialized',
  },
}

const PROVIDER_ERROR_SNAPSHOT: AssistantHostContextSnapshot = {
  readiness: {
    status: 'degraded',
    reason: 'unknown',
  },
  identityHeaders: null,
  pageContext: null,
  metadataSummary: {
    contextState: 'provider-error',
  },
}

export function useAssistantHostContext(
  provider: AssistantHostContextProvider,
) {
  const snapshotState = shallowRef<AssistantHostContextSnapshot>(
    INITIAL_SNAPSHOT,
  )
  const lastErrorState = shallowRef<unknown | null>(null)

  const snapshot = computed(() => snapshotState.value)
  const readiness = computed(() => snapshotState.value.readiness)
  const isReady = computed(() => readiness.value.status === 'ready')
  const contextReady = computed(() => isReady.value)
  const lastError = computed(() => lastErrorState.value)

  async function getLatestSnapshot(
    purpose: AssistantHostContextReadPurpose,
  ): Promise<AssistantHostContextSnapshot> {
    try {
      const latest = await provider.getSnapshot({ purpose })
      const sanitizedSnapshot: AssistantHostContextSnapshot = {
        ...latest,
        pageContext: sanitizePageContext(latest.pageContext),
      }

      snapshotState.value = sanitizedSnapshot
      lastErrorState.value = null
      return sanitizedSnapshot
    }
    catch (error) {
      lastErrorState.value = error
      snapshotState.value = PROVIDER_ERROR_SNAPSHOT
      return PROVIDER_ERROR_SNAPSHOT
    }
  }

  async function getLatestPageContext(
    purpose: AssistantHostContextReadPurpose,
  ): Promise<PageContext | null> {
    const latest = await getLatestSnapshot(purpose)
    return latest.readiness.status === 'ready' ? latest.pageContext : null
  }

  async function getResolvedSessionScope(
    purpose: AssistantHostContextReadPurpose,
  ): Promise<AssistantSessionScope> {
    const latest = await getLatestSnapshot(purpose)

    return resolveDefaultSessionScope({
      pageContext: latest.pageContext,
      identityHeaders: latest.identityHeaders,
      sessionScopeOverride: latest.sessionScopeOverride,
    })
  }

  async function getIdentityHeaders(
    purpose: AssistantHostContextReadPurpose,
  ): Promise<AssistantIdentityHeaders | null> {
    return (await getLatestSnapshot(purpose)).identityHeaders
  }

  async function getHostManagedSessionId(
    purpose: AssistantHostContextReadPurpose,
  ): Promise<AssistantSessionId | null> {
    return (await getLatestSnapshot(purpose)).hostManagedSessionId ?? null
  }

  async function openApprovalDetail(
    payload: OpenApprovalDetailPayload,
  ): Promise<void> {
    const latest = await getLatestSnapshot('approval_detail')
    const callback = latest.onOpenApprovalDetail

    if (!callback) {
      return
    }

    try {
      await callback(payload)
    }
    catch (error) {
      lastErrorState.value = error
    }
  }

  return {
    snapshot,
    readiness,
    isReady,
    contextReady,
    lastError,
    getLatestSnapshot,
    getLatestPageContext,
    getResolvedSessionScope,
    getIdentityHeaders,
    getHostManagedSessionId,
    openApprovalDetail,
  }
}
