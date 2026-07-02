import type {
  OpenApprovalDetailHandler,
  OpenApprovalDetailPayload,
} from './actions'
import type { AssistantSessionId, PageContext } from './contracts'
import type { AssistantIdentityHeaders } from './envelopes'

export type AssistantHostContextReadinessReason =
  | 'identity_missing'
  | 'organization_missing'
  | 'host_app_missing'
  | 'page_context_loading'
  | 'permission_context_loading'
  | 'unsupported_host'
  | 'unknown'

export type AssistantHostContextReadiness =
  | {
      status: 'ready'
      reason?: never
    }
  | {
      status: 'not_ready'
      reason: AssistantHostContextReadinessReason
    }
  | {
      status: 'degraded'
      reason: AssistantHostContextReadinessReason
    }

export type AssistantSessionScopeKind = 'global' | 'page' | 'entity'

export type AssistantSessionScopeSource = 'default' | 'host_override'

export interface AssistantSessionScope {
  kind: AssistantSessionScopeKind
  key: string
  source: AssistantSessionScopeSource
  pageContext?: PageContext | null
}

export interface AssistantSessionScopeOverride {
  kind: AssistantSessionScopeKind
  key?: string
}

export interface AssistantHostProvidedSession {
  hostManagedSessionId?: AssistantSessionId
}

export type AssistantHostMetadataValue =
  | string
  | number
  | boolean
  | null

export type AssistantHostMetadataSummary = Readonly<
  Record<string, AssistantHostMetadataValue>
>

export interface AssistantHostContextSnapshot
  extends AssistantHostProvidedSession {
  readiness: AssistantHostContextReadiness
  identityHeaders: AssistantIdentityHeaders | null
  pageContext: PageContext | null
  sessionScopeOverride?: AssistantSessionScopeOverride
  onOpenApprovalDetail?: OpenApprovalDetailHandler
  metadataSummary?: AssistantHostMetadataSummary
}

export type AssistantHostContextReadPurpose =
  | 'send'
  | 'retry'
  | 'restore'
  | 'approval_detail'

export interface AssistantHostContextProviderOptions {
  purpose: AssistantHostContextReadPurpose
}

export type AssistantHostContextProviderResult =
  | AssistantHostContextSnapshot
  | Promise<AssistantHostContextSnapshot>

export interface AssistantHostContextProvider {
  getSnapshot: (
    options: AssistantHostContextProviderOptions,
  ) => AssistantHostContextProviderResult
}

export type AssistantHostAdapter = AssistantHostContextProvider

export type {
  OpenApprovalDetailHandler,
  OpenApprovalDetailPayload,
}
