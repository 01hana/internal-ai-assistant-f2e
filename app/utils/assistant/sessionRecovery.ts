import type {
  AssistantSession,
  AssistantSessionId,
} from '../../types/assistant'

export type AssistantSessionRecoveryReason =
  | 'expired'
  | 'closed'
  | 'invisible'
  | 'not_found'
  | 'unavailable'
  | 'unknown'

export type AssistantSessionCandidateSource =
  | 'host_managed'
  | 'session_storage'

export interface AssistantSessionRestoreCandidate {
  source: AssistantSessionCandidateSource
  sessionId: AssistantSessionId
  scopeKey: string
}

export interface ResolveSessionRestoreCandidatesInput {
  scopeKey: string
  hostManagedSessionId?: AssistantSessionId | null
  storedSessionId?: AssistantSessionId | null
}

const REUSABLE_SESSION_STATUSES = new Set(['open', 'active', 'ready'])

function normalizeValue(value: string): string {
  return value.trim().toLowerCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readNormalizedString(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const candidate = value[key]
  return typeof candidate === 'string' && candidate.trim()
    ? normalizeValue(candidate)
    : null
}

export function resolveSessionRestoreCandidates(
  input: ResolveSessionRestoreCandidatesInput,
): AssistantSessionRestoreCandidate[] {
  const candidates: AssistantSessionRestoreCandidate[] = []
  const hostManagedSessionId = input.hostManagedSessionId?.trim()
  const storedSessionId = input.storedSessionId?.trim()

  if (hostManagedSessionId) {
    candidates.push({
      source: 'host_managed',
      sessionId: input.hostManagedSessionId!,
      scopeKey: input.scopeKey,
    })
  }

  if (
    storedSessionId
    && storedSessionId !== hostManagedSessionId
  ) {
    candidates.push({
      source: 'session_storage',
      sessionId: input.storedSessionId!,
      scopeKey: input.scopeKey,
    })
  }

  return candidates
}

export function isReusableAssistantSession(
  session: AssistantSession | null | undefined,
): boolean {
  return session !== null
    && session !== undefined
    && REUSABLE_SESSION_STATUSES.has(normalizeValue(session.status))
}

export function resolveSessionRecoveryReason(
  input: unknown,
): AssistantSessionRecoveryReason | null {
  if (input === null || input === undefined) {
    return null
  }

  if (!isRecord(input)) {
    return 'unknown'
  }

  if (input.statusCode === 404) {
    return 'not_found'
  }

  const code = readNormalizedString(input, 'code')

  if (code === 'not_found') {
    return 'not_found'
  }

  if (code === 'forbidden' || code === 'permission_denied') {
    return 'invisible'
  }

  if (code === 'network_error' || code === 'assistant_unavailable') {
    return 'unavailable'
  }

  const status = readNormalizedString(input, 'status')

  if (status && REUSABLE_SESSION_STATUSES.has(status)) {
    return null
  }

  if (status === 'closed') {
    return 'closed'
  }

  if (status === 'expired') {
    return 'expired'
  }

  if (
    status === 'archived'
    || status === 'deleted'
    || status === 'invisible'
  ) {
    return 'invisible'
  }

  return 'unknown'
}

export function shouldClearScopedSessionFallback(
  reason: AssistantSessionRecoveryReason | null,
): boolean {
  return reason === 'not_found'
    || reason === 'invisible'
    || reason === 'closed'
    || reason === 'expired'
}
