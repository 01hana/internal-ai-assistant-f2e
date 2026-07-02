import type {
  AssistantIdentityContext,
  AssistantIdentityHeaders,
  AssistantSessionScope,
  AssistantSessionScopeKind,
  AssistantSessionScopeOverride,
  PageContext,
} from '../../types/assistant'
import { sanitizePageContext } from './pageContextSanitizer'
import { generateSessionScopeKey } from './sessionScopeKeyGenerator'

export interface DefaultSessionScopeResolverInput {
  pageContext: PageContext | null | undefined
  identityContext?: AssistantIdentityContext | null
  identityHeaders?: AssistantIdentityHeaders | null
  sessionScopeOverride?: AssistantSessionScopeOverride | null
}

function resolveDefaultKind(
  pageContext: PageContext | null,
): AssistantSessionScopeKind {
  if (pageContext?.entityType && pageContext.entityId) {
    return 'entity'
  }

  if (pageContext?.screenId || pageContext?.route) {
    return 'page'
  }

  return 'global'
}

export function resolveDefaultSessionScope(
  input: DefaultSessionScopeResolverInput,
): AssistantSessionScope {
  const pageContext = sanitizePageContext(input.pageContext)
  const kind = input.sessionScopeOverride?.kind
    ?? resolveDefaultKind(pageContext)
  const source = input.sessionScopeOverride === null
    || input.sessionScopeOverride === undefined
    ? 'default'
    : 'host_override'

  return {
    kind,
    key: generateSessionScopeKey({
      kind,
      pageContext,
      identityContext: input.identityContext,
      identityHeaders: input.identityHeaders,
      keyOverride: input.sessionScopeOverride?.key,
    }),
    source,
    pageContext,
  }
}
