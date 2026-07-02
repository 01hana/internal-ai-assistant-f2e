import type { AssistantRequestId } from './contracts'
import type {
  AssistantIdentityHeaders,
  AssistantRequestMetadata,
  ResolvedAssistantIdentityHeaders,
} from './envelopes'

export type AssistantPermissionScope = string

export interface AssistantActorIdentity {
  actorId: string
  role: string
}

export interface AssistantOrganizationIdentity {
  organizationId: string
}

export interface AssistantHostAppIdentity {
  hostApp: string
}

export interface AssistantIdentityBoundary {
  actor: AssistantActorIdentity
  organization: AssistantOrganizationIdentity
  hostApp: AssistantHostAppIdentity
}

export type AssistantIdentityHeaderSourceKind =
  | 'host_provider'
  | 'props_adapter'

export interface AssistantIdentityHeaderSource<
  THeaders extends AssistantIdentityHeaders = AssistantIdentityHeaders,
> {
  kind: AssistantIdentityHeaderSourceKind
  headers: THeaders
  requestMetadata?: AssistantRequestMetadata
}

export type ResolvedAssistantIdentityHeaderSource =
  AssistantIdentityHeaderSource<ResolvedAssistantIdentityHeaders>

export interface AssistantIdentityContext extends AssistantIdentityBoundary {
  requestId?: AssistantRequestId
  permissionScopes?: readonly AssistantPermissionScope[]
  headerSource: AssistantIdentityHeaderSource
}
