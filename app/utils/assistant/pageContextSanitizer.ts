import type {
  PageContext,
  PageContextSelectedRow,
} from '../../types/assistant'

export interface PageContextSanitizerOptions {
  maxSelectedRows?: number
  maxActiveFilters?: number
  maxVisibleColumns?: number
  maxUserVisibleStateKeys?: number
  maxStringLength?: number
}

type SafePrimitive = string | number | boolean | null

const DEFAULT_OPTIONS: Required<PageContextSanitizerOptions> = {
  maxSelectedRows: 20,
  maxActiveFilters: 20,
  maxVisibleColumns: 50,
  maxUserVisibleStateKeys: 20,
  maxStringLength: 256,
}

const FORBIDDEN_KEY_FRAGMENTS = [
  'password',
  'secret',
  'token',
  'apikey',
  'credential',
  'authorization',
  'cookie',
  'databaseurl',
  'connectionstring',
  'privatekey',
  'rawpayload',
  'rawhoststate',
  'rawpagestate',
  'rawevidence',
  'rawdocument',
  'fulldocumenttext',
  'rawconnectoroutput',
  'rawllmprompt',
  'rawllmresponse',
  'stack',
] as const

const PROTOTYPE_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
])

const FILTER_DESCRIPTOR_KEYS = new Set([
  'field',
  'column',
  'key',
  'name',
  'property',
  'dataindex',
  'accessor',
])

const SENSITIVE_FILTER_VALUE_PATTERNS = [
  /\bbearer\s+\S+/i,
  /\b(?:access[\s_-]*token|refresh[\s_-]*token|api[\s_-]*key|authorization|cookie|password|secret|credential)\s*[:=]\s*\S+/i,
] as const

function resolveLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(0, Math.floor(value))
}

function resolveOptions(
  options: PageContextSanitizerOptions | undefined,
): Required<PageContextSanitizerOptions> {
  return {
    maxSelectedRows: resolveLimit(
      options?.maxSelectedRows,
      DEFAULT_OPTIONS.maxSelectedRows,
    ),
    maxActiveFilters: resolveLimit(
      options?.maxActiveFilters,
      DEFAULT_OPTIONS.maxActiveFilters,
    ),
    maxVisibleColumns: resolveLimit(
      options?.maxVisibleColumns,
      DEFAULT_OPTIONS.maxVisibleColumns,
    ),
    maxUserVisibleStateKeys: resolveLimit(
      options?.maxUserVisibleStateKeys,
      DEFAULT_OPTIONS.maxUserVisibleStateKeys,
    ),
    maxStringLength: resolveLimit(
      options?.maxStringLength,
      DEFAULT_OPTIONS.maxStringLength,
    ),
  }
}

function normalizeKeyForComparison(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isSafeKey(key: string): boolean {
  if (PROTOTYPE_KEYS.has(key.trim().toLowerCase())) {
    return false
  }

  const normalizedKey = normalizeKeyForComparison(key)

  return (
    normalizedKey.length > 0
    && !FORBIDDEN_KEY_FRAGMENTS.some(fragment =>
      normalizedKey.includes(fragment),
    )
  )
}

function containsSensitiveFilterValue(value: string): boolean {
  return SENSITIVE_FILTER_VALUE_PATTERNS.some(pattern => pattern.test(value))
}

function isSensitiveActiveFilter(filter: unknown): boolean {
  if (typeof filter === 'string') {
    return containsSensitiveFilterValue(filter)
  }

  if (
    filter === null
    || typeof filter !== 'object'
    || Array.isArray(filter)
  ) {
    return false
  }

  return Object.entries(filter).some(([rawKey, rawValue]) => {
    if (typeof rawValue !== 'string') {
      return false
    }

    const normalizedKey = normalizeKeyForComparison(rawKey)
    const describesSensitiveField = FILTER_DESCRIPTOR_KEYS.has(normalizedKey)
      && !isSafeKey(rawValue)

    return describesSensitiveField || containsSensitiveFilterValue(rawValue)
  })
}

function sanitizeString(
  value: string,
  maxStringLength: number,
): string | undefined {
  const normalizedValue = value.trim().slice(0, maxStringLength)
  return normalizedValue.length > 0 ? normalizedValue : undefined
}

function sanitizePrimitive(
  value: unknown,
  maxStringLength: number,
): SafePrimitive | undefined {
  if (typeof value === 'string') {
    return sanitizeString(value, maxStringLength)
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === 'boolean' || value === null) {
    return value
  }

  return undefined
}

function sanitizeShallowObject(
  value: unknown,
  maxStringLength: number,
  maxKeys = Number.POSITIVE_INFINITY,
  allowedKeys?: ReadonlySet<string>,
): Record<string, SafePrimitive> | undefined {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    return undefined
  }

  const sanitized: Record<string, SafePrimitive> = {}

  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (Object.keys(sanitized).length >= maxKeys) {
      break
    }

    const key = rawKey.trim()
    if (
      !isSafeKey(key)
      || (allowedKeys !== undefined && !allowedKeys.has(key))
    ) {
      continue
    }

    const primitive = sanitizePrimitive(rawValue, maxStringLength)
    if (primitive !== undefined) {
      sanitized[key] = primitive
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function sanitizeVisibleColumns(
  columns: PageContext['visibleColumns'],
  options: Required<PageContextSanitizerOptions>,
): string[] | undefined {
  if (!Array.isArray(columns)) {
    return undefined
  }

  const sanitized: string[] = []
  const seen = new Set<string>()

  for (const value of columns) {
    if (sanitized.length >= options.maxVisibleColumns) {
      break
    }

    if (typeof value !== 'string') {
      continue
    }

    const column = sanitizeString(value, options.maxStringLength)
    if (
      column === undefined
      || !isSafeKey(column)
      || seen.has(column)
    ) {
      continue
    }

    seen.add(column)
    sanitized.push(column)
  }

  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeSelectedRows(
  rows: PageContext['selectedRows'],
  options: Required<PageContextSanitizerOptions>,
): PageContextSelectedRow[] | undefined {
  if (!Array.isArray(rows)) {
    return undefined
  }

  const sanitized = rows
    .slice(0, options.maxSelectedRows)
    .map((row): PageContextSelectedRow | undefined => {
      if (
        row === null
        || typeof row !== 'object'
        || Array.isArray(row)
      ) {
        return undefined
      }

      const rawId = row.id
      if (typeof rawId !== 'string') {
        return undefined
      }

      const id = sanitizeString(rawId, options.maxStringLength)

      return id === undefined ? undefined : { id }
    })
    .filter(
      (row): row is PageContextSelectedRow => row !== undefined,
    )

  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeActiveFilters(
  filters: PageContext['activeFilters'],
  options: Required<PageContextSanitizerOptions>,
): unknown[] | undefined {
  if (!Array.isArray(filters)) {
    return undefined
  }

  const sanitized = filters
    .slice(0, options.maxActiveFilters)
    .map(filter => {
      if (isSensitiveActiveFilter(filter)) {
        return undefined
      }

      const primitive = sanitizePrimitive(filter, options.maxStringLength)
      if (primitive !== undefined) {
        return primitive
      }

      return sanitizeShallowObject(filter, options.maxStringLength)
    })
    .filter((filter): filter is NonNullable<typeof filter> =>
      filter !== undefined,
    )

  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeRoute(
  route: string | undefined,
  maxStringLength: number,
): string | undefined {
  if (route === undefined) {
    return undefined
  }

  return sanitizeString(route.split(/[?#]/, 1)[0] ?? '', maxStringLength)
}

export function sanitizePageContext(
  pageContext: PageContext | null | undefined,
  options?: PageContextSanitizerOptions,
): PageContext | null {
  if (pageContext === null || pageContext === undefined) {
    return null
  }

  const resolvedOptions = resolveOptions(options)
  const visibleColumns = sanitizeVisibleColumns(
    pageContext.visibleColumns,
    resolvedOptions,
  )
  const sanitized: PageContext = {}

  const moduleName = pageContext.module === undefined
    ? undefined
    : sanitizeString(pageContext.module, resolvedOptions.maxStringLength)
  const route = sanitizeRoute(
    pageContext.route,
    resolvedOptions.maxStringLength,
  )
  const screenId = pageContext.screenId === undefined
    ? undefined
    : sanitizeString(pageContext.screenId, resolvedOptions.maxStringLength)
  const entityType = pageContext.entityType === undefined
    ? undefined
    : sanitizeString(pageContext.entityType, resolvedOptions.maxStringLength)
  const entityId = pageContext.entityId === undefined
    ? undefined
    : sanitizeString(pageContext.entityId, resolvedOptions.maxStringLength)
  const selectedRows = sanitizeSelectedRows(
    pageContext.selectedRows,
    resolvedOptions,
  )
  const activeFilters = sanitizeActiveFilters(
    pageContext.activeFilters,
    resolvedOptions,
  )
  const userVisibleState = sanitizeShallowObject(
    pageContext.userVisibleState,
    resolvedOptions.maxStringLength,
    resolvedOptions.maxUserVisibleStateKeys,
  )

  if (moduleName !== undefined) sanitized.module = moduleName
  if (route !== undefined) sanitized.route = route
  if (screenId !== undefined) sanitized.screenId = screenId
  if (entityType !== undefined) sanitized.entityType = entityType
  if (entityId !== undefined) sanitized.entityId = entityId
  if (selectedRows !== undefined) sanitized.selectedRows = selectedRows
  if (activeFilters !== undefined) sanitized.activeFilters = activeFilters
  if (visibleColumns !== undefined) sanitized.visibleColumns = visibleColumns
  if (userVisibleState !== undefined) {
    sanitized.userVisibleState = userVisibleState
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null
}
