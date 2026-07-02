import type {
  AssistantIdentityContext,
  AssistantIdentityHeaders,
  AssistantSessionScopeKind,
  PageContext,
} from '../../types/assistant'

export interface SessionScopeKeyGeneratorInput {
  kind: AssistantSessionScopeKind
  pageContext?: PageContext | null
  identityContext?: AssistantIdentityContext | null
  identityHeaders?: AssistantIdentityHeaders | null
  keyOverride?: string | null
}

interface IdentityBoundaryValues {
  actorId: string
  organizationId: string
  hostApp: string
}

function normalizeKeyComponent(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized.length > 0 ? normalized : fallback
}

function stripRouteDetails(route: string | undefined): string | undefined {
  return route?.split(/[?#]/, 1)[0]
}

function resolveIdentityBoundary(
  input: SessionScopeKeyGeneratorInput,
): IdentityBoundaryValues {
  const contextHeaders = input.identityContext?.headerSource.headers

  return {
    actorId: normalizeKeyComponent(
      input.identityHeaders?.['x-actor-id']
        ?? contextHeaders?.['x-actor-id']
        ?? input.identityContext?.actor.actorId,
      'unknown-actor',
    ),
    organizationId: normalizeKeyComponent(
      input.identityHeaders?.['x-organization-id']
        ?? contextHeaders?.['x-organization-id']
        ?? input.identityContext?.organization.organizationId,
      'unknown-org',
    ),
    hostApp: normalizeKeyComponent(
      input.identityHeaders?.['x-host-app']
        ?? contextHeaders?.['x-host-app']
        ?? input.identityContext?.hostApp.hostApp,
      'unknown-host',
    ),
  }
}

function resolveScopeIdentity(
  kind: AssistantSessionScopeKind,
  pageContext: PageContext | null | undefined,
): string[] {
  if (kind === 'entity') {
    return [
      normalizeKeyComponent(pageContext?.entityType, 'unknown-entity-type'),
      normalizeKeyComponent(pageContext?.entityId, 'unknown-entity-id'),
    ]
  }

  if (kind === 'page') {
    return [
      normalizeKeyComponent(
        pageContext?.screenId ?? stripRouteDetails(pageContext?.route),
        'unknown-page',
      ),
    ]
  }

  return []
}

export function generateSessionScopeKey(
  input: SessionScopeKeyGeneratorInput,
): string {
  const boundary = resolveIdentityBoundary(input)
  const keyParts = [
    boundary.actorId,
    boundary.organizationId,
    boundary.hostApp,
    input.kind,
  ]

  if (input.keyOverride !== null && input.keyOverride !== undefined) {
    keyParts.push(
      normalizeKeyComponent(input.keyOverride, 'unknown-override'),
    )
  } else {
    keyParts.push(...resolveScopeIdentity(input.kind, input.pageContext))
  }

  return keyParts.join(':')
}
