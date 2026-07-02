import { describe, expect, it, vi } from 'vitest'
import type {
  AssistantHostContextProvider,
  AssistantHostContextSnapshot,
  AssistantIdentityHeaders,
  OpenApprovalDetailPayload,
  PageContext,
} from '../../../app/types/assistant'
import { useAssistantHostContext } from '../../../app/features/assistant/composables/useAssistantHostContext'
import { useAssistantHostContextAdapter } from '../../../app/features/assistant/composables/useAssistantHostContextAdapter'
import { resolveDefaultSessionScope } from '../../../app/utils/assistant/defaultSessionScopeResolver'
import { sanitizePageContext } from '../../../app/utils/assistant/pageContextSanitizer'
import { generateSessionScopeKey } from '../../../app/utils/assistant/sessionScopeKeyGenerator'
import {
  approvalDetailHostContextSnapshot,
  contextNotReadySnapshot,
  entityHostContextSnapshot,
  globalHostContextSnapshot,
  hostManagedSessionContextSnapshot,
  hostOverrideContextSnapshot,
  hostIdentityContextFixture,
  hostIdentityHeadersFixture,
  identityReadyWithoutPageContextSnapshot,
  pageHostContextSnapshot,
} from '../../fixtures/assistant-api/host-context'

describe('pageContextSanitizer', () => {
  it('preserves safe visible summaries without mutating the input', () => {
    const pageContext = {
      module: ' orders ',
      route: ' /Orders/List?accessToken=remove-me#details ',
      screenId: ' orders-list ',
      entityType: ' order ',
      entityId: ' SO-10001 ',
      selectedRows: [
        {
          orderNumber: ' SO-10001 ',
          status: ' confirmed ',
          hiddenInternal: 'remove-me',
          accessToken: 'remove-me',
          secret: 'remove-me',
          credential: 'remove-me',
          nested: { value: 'remove-me' },
        },
      ],
      activeFilters: [
        {
          field: ' status ',
          operator: ' in ',
          value: ['confirmed'],
          authorization: 'remove-me',
        },
      ],
      visibleColumns: [
        ' orderNumber ',
        'status',
        'accessToken',
        'secret',
        'credential',
        '',
        'orderNumber',
      ],
      userVisibleState: {
        selectedTab: ' summary ',
        cookie: 'remove-me',
        nested: { value: 'remove-me' },
      },
    } satisfies PageContext
    const original = structuredClone(pageContext)

    expect(sanitizePageContext(pageContext)).toEqual({
      module: 'orders',
      route: '/Orders/List',
      screenId: 'orders-list',
      entityType: 'order',
      entityId: 'SO-10001',
      selectedRows: [
        {
          orderNumber: 'SO-10001',
          status: 'confirmed',
        },
      ],
      activeFilters: [
        {
          field: 'status',
          operator: 'in',
        },
      ],
      visibleColumns: ['orderNumber', 'status'],
      userVisibleState: {
        selectedTab: 'summary',
      },
    })
    expect(pageContext).toEqual(original)
  })

  it('omits selected rows when visible columns are unavailable', () => {
    const result = sanitizePageContext({
      selectedRows: [{ orderNumber: 'SO-10001' }],
    })

    expect(result).toBeNull()
  })

  it('applies collection and string limits', () => {
    const result = sanitizePageContext(
      {
        module: ' inventory ',
        selectedRows: [
          { sku: 'ABCDEFGHIJ', quantity: 2 },
          { sku: 'SECOND', quantity: 3 },
        ],
        activeFilters: [
          { field: 'warehouse', value: 'NORTH-WAREHOUSE' },
          { field: 'status', value: 'active' },
        ],
        visibleColumns: ['sku', 'quantity'],
        userVisibleState: {
          selectedTab: 'overview',
          density: 'compact',
        },
      },
      {
        maxSelectedRows: 1,
        maxActiveFilters: 1,
        maxVisibleColumns: 1,
        maxUserVisibleStateKeys: 1,
        maxStringLength: 5,
      },
    )

    expect(result).toEqual({
      module: 'inven',
      selectedRows: [{ sku: 'ABCDE' }],
      activeFilters: [{ field: 'wareh', value: 'NORTH' }],
      visibleColumns: ['sku'],
      userVisibleState: {
        selectedTab: 'overv',
      },
    })
  })

  it('removes filters that describe or contain sensitive material', () => {
    const activeFilters = [
      { field: 'status', operator: 'eq', value: 'confirmed' },
      { field: 'warehouse', operator: 'eq', value: 'NORTH' },
      { field: 'customerName', operator: 'contains', value: 'Lin' },
      { field: 'accessToken', operator: 'eq', value: 'remove-me' },
      { column: 'cookie', operator: 'eq', value: 'remove-me' },
      { key: 'api_key', operator: 'eq', value: 'remove-me' },
      { name: 'authorization', operator: 'contains', value: 'remove-me' },
      { property: 'refreshToken', value: 'remove-me' },
      { dataIndex: 'credential', value: 'remove-me' },
      { accessor: 'private-key', value: 'remove-me' },
      { field: 'status', value: 'Bearer synthetic-value' },
      { field: 'status', value: 'accessToken=synthetic-value' },
      { field: 'status', value: 'refresh_token = synthetic-value' },
      { field: 'status', value: 'api-key: synthetic-value' },
      { field: 'status', value: 'AUTHORIZATION=synthetic-value' },
      { field: 'status', value: 'cookie=synthetic-value' },
      { field: 'status', value: 'password=synthetic-value' },
      { field: 'status', value: 'secret=synthetic-value' },
      { field: 'status', value: 'credential=synthetic-value' },
    ]
    const original = structuredClone(activeFilters)

    expect(sanitizePageContext({ activeFilters })?.activeFilters).toEqual([
      { field: 'status', operator: 'eq', value: 'confirmed' },
      { field: 'warehouse', operator: 'eq', value: 'NORTH' },
      { field: 'customerName', operator: 'contains', value: 'Lin' },
    ])
    expect(activeFilters).toEqual(original)
  })

  it('returns null for absent or empty context', () => {
    expect(sanitizePageContext(null)).toBeNull()
    expect(sanitizePageContext(undefined)).toBeNull()
    expect(sanitizePageContext({})).toBeNull()
  })
})

describe('defaultSessionScopeResolver', () => {
  it('resolves entity context before page context', () => {
    const scope = resolveDefaultSessionScope({
      pageContext: entityHostContextSnapshot.pageContext,
      identityHeaders: hostIdentityHeadersFixture,
    })

    expect(scope).toMatchObject({
      kind: 'entity',
      key: 'actor-001:org-001:erp-web:entity:order:so-10001',
      source: 'default',
    })
    expect(scope.pageContext).not.toBe(
      entityHostContextSnapshot.pageContext,
    )
  })

  it('resolves page context using screenId before route', () => {
    const scope = resolveDefaultSessionScope({
      pageContext: pageHostContextSnapshot.pageContext,
      identityHeaders: hostIdentityHeadersFixture,
    })

    expect(scope).toMatchObject({
      kind: 'page',
      key: 'actor-001:org-001:erp-web:page:orders-list',
      source: 'default',
    })
  })

  it('resolves route-only page context and global fallback', () => {
    expect(
      resolveDefaultSessionScope({
        pageContext: { route: '/Inventory / Overview?tab=all' },
        identityHeaders: hostIdentityHeadersFixture,
      }),
    ).toMatchObject({
      kind: 'page',
      key: 'actor-001:org-001:erp-web:page:inventory-overview',
      source: 'default',
    })

    expect(
      resolveDefaultSessionScope({
        pageContext: globalHostContextSnapshot.pageContext,
        identityHeaders: hostIdentityHeadersFixture,
      }),
    ).toMatchObject({
      kind: 'global',
      key: 'actor-001:org-001:erp-web:global',
      source: 'default',
    })
  })

  it('lets a host override win and boundary-scopes its key', () => {
    const scope = resolveDefaultSessionScope({
      pageContext: entityHostContextSnapshot.pageContext,
      identityHeaders: hostIdentityHeadersFixture,
      sessionScopeOverride: {
        kind: 'global',
        key: ' Shared Orders / Taiwan ',
      },
    })

    expect(scope).toMatchObject({
      kind: 'global',
      key: 'actor-001:org-001:erp-web:global:shared-orders-taiwan',
      source: 'host_override',
    })
  })

  it('generates a deterministic key for an override without a key', () => {
    const input = {
      pageContext: entityHostContextSnapshot.pageContext,
      identityHeaders: hostIdentityHeadersFixture,
      sessionScopeOverride: {
        kind: 'page' as const,
      },
    }

    expect(resolveDefaultSessionScope(input)).toEqual(
      resolveDefaultSessionScope(input),
    )
    expect(resolveDefaultSessionScope(input)).toMatchObject({
      kind: 'page',
      key: 'actor-001:org-001:erp-web:page:order-detail',
      source: 'host_override',
    })
  })
})

describe('sessionScopeKeyGenerator', () => {
  it('generates deterministic boundary-scoped keys', () => {
    const input = {
      kind: 'entity' as const,
      pageContext: {
        entityType: 'Sales Order',
        entityId: 'SO / 10001',
      },
      identityHeaders: {
        'x-actor-id': ' Actor / 001 ',
        'x-organization-id': ' Org @ Main ',
        'x-host-app': ' ERP Web ',
        'x-role': 'operator',
      } satisfies AssistantIdentityHeaders,
    }

    expect(generateSessionScopeKey(input)).toBe(
      'actor-001:org-main:erp-web:entity:sales-order:so-10001',
    )
    expect(generateSessionScopeKey(input)).toBe(
      generateSessionScopeKey(input),
    )
  })

  it('prefers explicit headers and otherwise uses safe unknown boundaries', () => {
    expect(
      generateSessionScopeKey({
        kind: 'global',
        identityHeaders: {
          ...hostIdentityHeadersFixture,
          'x-actor-id': 'actor-explicit',
        },
        identityContext: hostIdentityContextFixture,
      }),
    ).toBe('actor-explicit:org-001:erp-web:global')

    expect(generateSessionScopeKey({ kind: 'global' })).toBe(
      'unknown-actor:unknown-org:unknown-host:global',
    )
  })

  it('excludes raw context and permission details from keys', () => {
    const key = generateSessionScopeKey({
      kind: 'page',
      pageContext: {
        route: '/orders?accessToken=remove-me',
        screenId: 'orders-list',
        selectedRows: [{ orderNumber: 'DO-NOT-INCLUDE' }],
        activeFilters: [{ value: 'DO-NOT-INCLUDE' }],
        userVisibleState: { selectedTab: 'DO-NOT-INCLUDE' },
      },
      identityContext: {
        ...hostIdentityContextFixture,
        permissionScopes: ['DO-NOT-INCLUDE'],
      },
    })

    expect(key).toBe('actor-001:org-001:erp-web:page:orders-list')
    expect(key).not.toContain('do-not-include')
    expect(key).not.toContain('remove-me')
  })
})

describe('useAssistantHostContextAdapter', () => {
  it('prefers the custom reader and forwards the read purpose', async () => {
    const getSnapshot = vi.fn<AssistantHostContextProvider['getSnapshot']>(
      async ({ purpose }) => ({
        ...pageHostContextSnapshot,
        metadataSummary: { purpose },
      }),
    )
    const provider = useAssistantHostContextAdapter({
      snapshot: globalHostContextSnapshot,
      getSnapshot,
    })

    const snapshot = await provider.getSnapshot({ purpose: 'retry' })

    expect(getSnapshot).toHaveBeenCalledWith({ purpose: 'retry' })
    expect(snapshot.metadataSummary).toEqual({ purpose: 'retry' })
  })

  it('returns a static snapshot on every read', async () => {
    const provider = useAssistantHostContextAdapter({
      snapshot: pageHostContextSnapshot,
    })

    expect(await provider.getSnapshot({ purpose: 'send' })).toBe(
      pageHostContextSnapshot,
    )
    expect(await provider.getSnapshot({ purpose: 'restore' })).toBe(
      pageHostContextSnapshot,
    )
  })

  it.each([undefined, { snapshot: null }])(
    'returns a safe fallback with no approval operations',
    async (options) => {
      const provider = useAssistantHostContextAdapter(options)
      const snapshot = await provider.getSnapshot({ purpose: 'send' })

      expect(snapshot).toMatchObject({
        readiness: { status: 'not_ready', reason: 'unsupported_host' },
        identityHeaders: null,
        pageContext: null,
        metadataSummary: { contextState: 'demo-or-test-fallback' },
      })
      expect(snapshot).not.toHaveProperty('approve')
      expect(snapshot).not.toHaveProperty('reject')
      expect(snapshot).not.toHaveProperty('cancel')
    },
  )
})

describe('useAssistantHostContext', () => {
  it('reads fresh send, retry, and restore snapshots instead of cached context', async () => {
    const snapshots: AssistantHostContextSnapshot[] = [
      {
        ...pageHostContextSnapshot,
        pageContext: {
          route: '/orders?tab=open#today',
          screenId: 'orders-list',
        },
      },
      {
        ...pageHostContextSnapshot,
        pageContext: {
          route: '/orders/42?from=list',
          screenId: 'order-detail',
        },
      },
      identityReadyWithoutPageContextSnapshot,
    ]
    const getSnapshot = vi.fn<AssistantHostContextProvider['getSnapshot']>(
      async () => snapshots.shift()!,
    )
    const hostContext = useAssistantHostContext({ getSnapshot })

    await expect(hostContext.getLatestPageContext('send')).resolves.toEqual({
      route: '/orders',
      screenId: 'orders-list',
    })
    await expect(hostContext.getLatestPageContext('retry')).resolves.toEqual({
      route: '/orders/42',
      screenId: 'order-detail',
    })
    await expect(hostContext.getLatestPageContext('restore')).resolves.toBeNull()
    expect(getSnapshot.mock.calls.map(([options]) => options.purpose)).toEqual([
      'send',
      'retry',
      'restore',
    ])
  })

  it('stores a sanitized copy and hides page context when readiness is not ready', async () => {
    const rawPageContext: PageContext = {
      route: '/inventory?token=synthetic#private',
      visibleColumns: ['sku'],
      selectedRows: [{ sku: 'A-100', hiddenSecret: 'synthetic-value' }],
    }
    const provider = useAssistantHostContextAdapter({
      getSnapshot: vi
        .fn<AssistantHostContextProvider['getSnapshot']>()
        .mockResolvedValueOnce({
          ...pageHostContextSnapshot,
          pageContext: rawPageContext,
        })
        .mockResolvedValueOnce(contextNotReadySnapshot),
    })
    const hostContext = useAssistantHostContext(provider)

    const sanitized = await hostContext.getLatestSnapshot('send')

    expect(sanitized.pageContext).not.toBe(rawPageContext)
    expect(sanitized.pageContext).toEqual({
      route: '/inventory',
      visibleColumns: ['sku'],
      selectedRows: [{ sku: 'A-100' }],
    })
    await expect(hostContext.getLatestPageContext('retry')).resolves.toBeNull()
  })

  it('keeps readiness refs synchronized across host states', async () => {
    const degradedSnapshot: AssistantHostContextSnapshot = {
      readiness: { status: 'degraded', reason: 'unknown' },
      identityHeaders: null,
      pageContext: null,
    }
    const provider = useAssistantHostContextAdapter({
      getSnapshot: vi
        .fn<AssistantHostContextProvider['getSnapshot']>()
        .mockResolvedValueOnce(globalHostContextSnapshot)
        .mockResolvedValueOnce(contextNotReadySnapshot)
        .mockResolvedValueOnce(degradedSnapshot),
    })
    const hostContext = useAssistantHostContext(provider)

    expect(hostContext.readiness.value.status).toBe('not_ready')
    expect(hostContext.isReady.value).toBe(false)
    await hostContext.getLatestSnapshot('send')
    expect(hostContext.isReady.value).toBe(true)
    expect(hostContext.contextReady.value).toBe(true)
    await hostContext.getLatestSnapshot('retry')
    expect(hostContext.readiness.value.status).toBe('not_ready')
    await hostContext.getLatestSnapshot('restore')
    expect(hostContext.readiness.value.status).toBe('degraded')
    expect(hostContext.contextReady.value).toBe(false)
  })

  it('turns provider failures into a safe degraded snapshot', async () => {
    const providerError = new Error('synthetic provider failure')
    const hostContext = useAssistantHostContext({
      getSnapshot: vi.fn(async () => {
        throw providerError
      }),
    })

    await expect(hostContext.getLatestSnapshot('send')).resolves.toEqual({
      readiness: { status: 'degraded', reason: 'unknown' },
      identityHeaders: null,
      pageContext: null,
      metadataSummary: { contextState: 'provider-error' },
    })
    expect(hostContext.lastError.value).toBe(providerError)
    expect(hostContext.snapshot.value?.metadataSummary).not.toHaveProperty(
      'stack',
    )
  })

  it('delegates entity, page, global, and override scope resolution', async () => {
    const snapshots = [
      entityHostContextSnapshot,
      pageHostContextSnapshot,
      globalHostContextSnapshot,
      hostOverrideContextSnapshot,
    ]
    const hostContext = useAssistantHostContext({
      getSnapshot: vi.fn(async () => snapshots.shift()!),
    })

    await expect(hostContext.getResolvedSessionScope('restore')).resolves.toMatchObject({
      kind: 'entity',
      source: 'default',
    })
    await expect(hostContext.getResolvedSessionScope('restore')).resolves.toMatchObject({
      kind: 'page',
      source: 'default',
    })
    await expect(hostContext.getResolvedSessionScope('restore')).resolves.toMatchObject({
      kind: 'global',
      source: 'default',
    })
    await expect(hostContext.getResolvedSessionScope('restore')).resolves.toMatchObject({
      kind: 'global',
      source: 'host_override',
    })
  })

  it('reads latest session and identity values without generating a request ID', async () => {
    const identityHeadersWithoutRequestId: AssistantIdentityHeaders = {
      'x-actor-id': 'actor-001',
      'x-organization-id': 'org-001',
      'x-host-app': 'erp-web',
      'x-role': 'operator',
      'x-permission-scopes': 'orders:read,inventory:read',
    }
    const hostContext = useAssistantHostContext({
      getSnapshot: vi
        .fn<AssistantHostContextProvider['getSnapshot']>()
        .mockResolvedValueOnce(hostManagedSessionContextSnapshot)
        .mockResolvedValueOnce({
          ...globalHostContextSnapshot,
          identityHeaders: identityHeadersWithoutRequestId,
        }),
    })

    await expect(hostContext.getHostManagedSessionId('restore')).resolves.toBe(
      'session-host-managed-001',
    )
    await expect(hostContext.getIdentityHeaders('send')).resolves.toEqual(
      identityHeadersWithoutRequestId,
    )
    expect(identityHeadersWithoutRequestId).not.toHaveProperty('x-request-id')
  })

  it('uses the latest approval detail callback and preserves the original payload', async () => {
    const payload: OpenApprovalDetailPayload = {
      approvalRequestId: 'approval-request-001',
      messageId: 'message-001',
      requestId: 'request-001',
    }
    const callback = vi.fn()
    const hostContext = useAssistantHostContext(
      useAssistantHostContextAdapter({
        snapshot: {
          ...approvalDetailHostContextSnapshot,
          onOpenApprovalDetail: callback,
        },
      }),
    )

    await expect(hostContext.openApprovalDetail(payload)).resolves.toBeUndefined()
    expect(callback).toHaveBeenCalledWith(payload)
    expect(hostContext.lastError.value).toBeNull()
  })

  it('safely handles missing, throwing, and rejecting approval callbacks', async () => {
    const payload: OpenApprovalDetailPayload = {
      approvalRequestId: 'approval-request-002',
    }
    const callbackError = new Error('synthetic callback failure')
    const snapshots: AssistantHostContextSnapshot[] = [
      globalHostContextSnapshot,
      {
        ...approvalDetailHostContextSnapshot,
        onOpenApprovalDetail: () => {
          throw callbackError
        },
      },
      {
        ...approvalDetailHostContextSnapshot,
        onOpenApprovalDetail: async () => {
          throw callbackError
        },
      },
    ]
    const getSnapshot = vi.fn<AssistantHostContextProvider['getSnapshot']>(
      async () => snapshots.shift()!,
    )
    const hostContext = useAssistantHostContext({ getSnapshot })

    await expect(hostContext.openApprovalDetail(payload)).resolves.toBeUndefined()
    await expect(hostContext.openApprovalDetail(payload)).resolves.toBeUndefined()
    expect(hostContext.lastError.value).toBe(callbackError)
    await expect(hostContext.openApprovalDetail(payload)).resolves.toBeUndefined()
    expect(hostContext.lastError.value).toBe(callbackError)
    expect(
      getSnapshot.mock.calls.every(
        ([options]) => options.purpose === 'approval_detail',
      ),
    ).toBe(true)
    expect(hostContext).not.toHaveProperty('approve')
    expect(hostContext).not.toHaveProperty('reject')
    expect(hostContext).not.toHaveProperty('cancel')
  })
})
