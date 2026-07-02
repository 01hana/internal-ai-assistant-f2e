import type {
  AssistantHostContextSnapshot,
  AssistantIdentityContext,
  AssistantIdentityHeaders,
  AssistantSessionScope,
  OpenApprovalDetailHandler,
} from '../../../app/types/assistant'

export const hostIdentityHeadersFixture = {
  'x-request-id': 'req-host-context-001',
  'x-actor-id': 'actor-001',
  'x-organization-id': 'org-001',
  'x-host-app': 'erp-web',
  'x-role': 'operator',
  'x-permission-scopes': 'orders:read,inventory:read',
} satisfies AssistantIdentityHeaders

export const hostIdentityContextFixture = {
  requestId: 'req-host-context-001',
  actor: {
    actorId: 'actor-001',
    role: 'operator',
  },
  organization: {
    organizationId: 'org-001',
  },
  hostApp: {
    hostApp: 'erp-web',
  },
  permissionScopes: ['orders:read', 'inventory:read'],
  headerSource: {
    kind: 'host_provider',
    headers: hostIdentityHeadersFixture,
    requestMetadata: {
      requestId: 'req-host-context-001',
    },
  },
} satisfies AssistantIdentityContext

export const globalSessionScopeFixture = {
  kind: 'global',
  key: 'actor-001:org-001:erp-web:global',
  source: 'default',
  pageContext: {
    module: 'assistant',
  },
} satisfies AssistantSessionScope

export const globalHostContextSnapshot = {
  readiness: {
    status: 'ready',
  },
  identityHeaders: hostIdentityHeadersFixture,
  pageContext: {
    module: 'assistant',
  },
  metadataSummary: {
    hostSurface: 'global-assistant-entry',
  },
} satisfies AssistantHostContextSnapshot

export const pageSessionScopeFixture = {
  kind: 'page',
  key: 'actor-001:org-001:erp-web:page:orders-list',
  source: 'default',
  pageContext: {
    module: 'orders',
    route: '/orders',
    screenId: 'orders-list',
  },
} satisfies AssistantSessionScope

export const pageHostContextSnapshot = {
  readiness: {
    status: 'ready',
  },
  identityHeaders: hostIdentityHeadersFixture,
  pageContext: {
    module: 'orders',
    route: '/orders',
    screenId: 'orders-list',
    activeFilters: [{ field: 'status', value: 'confirmed' }],
    visibleColumns: ['orderNumber', 'status'],
  },
} satisfies AssistantHostContextSnapshot

export const entitySessionScopeFixture = {
  kind: 'entity',
  key: 'actor-001:org-001:erp-web:entity:order:so-10001',
  source: 'default',
  pageContext: {
    module: 'orders',
    route: '/orders/SO-10001',
    screenId: 'order-detail',
    entityType: 'order',
    entityId: 'SO-10001',
  },
} satisfies AssistantSessionScope

export const entityHostContextSnapshot = {
  readiness: {
    status: 'ready',
  },
  identityHeaders: hostIdentityHeadersFixture,
  pageContext: {
    module: 'orders',
    route: '/orders/SO-10001',
    screenId: 'order-detail',
    entityType: 'order',
    entityId: 'SO-10001',
    visibleColumns: ['orderNumber', 'status', 'customerName'],
    userVisibleState: {
      selectedTab: 'summary',
    },
  },
} satisfies AssistantHostContextSnapshot

export const hostOverrideSessionScopeFixture = {
  kind: 'global',
  key: 'actor-001:org-001:erp-web:global:shared-orders',
  source: 'host_override',
  pageContext: entityHostContextSnapshot.pageContext,
} satisfies AssistantSessionScope

export const hostOverrideContextSnapshot = {
  ...entityHostContextSnapshot,
  sessionScopeOverride: {
    kind: 'global',
    key: 'shared-orders',
  },
} satisfies AssistantHostContextSnapshot

export const contextNotReadySnapshot = {
  readiness: {
    status: 'not_ready',
    reason: 'identity_missing',
  },
  identityHeaders: null,
  pageContext: null,
  metadataSummary: {
    contextState: 'waiting-for-host',
  },
} satisfies AssistantHostContextSnapshot

export const identityReadyWithoutPageContextSnapshot = {
  readiness: {
    status: 'ready',
  },
  identityHeaders: hostIdentityHeadersFixture,
  pageContext: null,
} satisfies AssistantHostContextSnapshot

export const hostManagedSessionContextSnapshot = {
  ...pageHostContextSnapshot,
  hostManagedSessionId: 'session-host-managed-001',
} satisfies AssistantHostContextSnapshot

export const onOpenApprovalDetailFixture: OpenApprovalDetailHandler = () =>
  undefined

export const approvalDetailHostContextSnapshot = {
  ...entityHostContextSnapshot,
  onOpenApprovalDetail: onOpenApprovalDetailFixture,
} satisfies AssistantHostContextSnapshot
