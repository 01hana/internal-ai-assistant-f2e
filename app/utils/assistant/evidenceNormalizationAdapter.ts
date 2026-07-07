import type {
  EvidenceNormalizationInput,
  EvidenceRefSummary,
  EvidenceReferenceDisplay,
  EvidenceSourceType,
} from '../../types/assistant'

const EVIDENCE_SOURCE_TYPES = new Set<EvidenceSourceType>([
  'structured_record',
  'document_chunk',
])

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function readEvidenceId(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null
  }

  return value.trim()
}

function readOptionalNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null
  }

  return isNonEmptyString(value) ? value.trim() : undefined
}

function normalizeSummaryEvidence(
  value: unknown,
): EvidenceReferenceDisplay | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<EvidenceRefSummary>
  const id = readEvidenceId(candidate.id)
  if (!id || !EVIDENCE_SOURCE_TYPES.has(candidate.sourceType as EvidenceSourceType)) {
    return null
  }

  return {
    kind: 'summary',
    id,
    sourceType: candidate.sourceType as EvidenceSourceType,
    sourceId: readOptionalNullableString(candidate.sourceId),
    toolCallId: readOptionalNullableString(candidate.toolCallId),
    title: readOptionalNullableString(candidate.title),
    snippet: readOptionalNullableString(candidate.snippet),
  }
}

function normalizeReferenceEvidence(
  value: unknown,
): EvidenceReferenceDisplay | null {
  const id = readEvidenceId(value)

  if (!id) {
    return null
  }

  return {
    kind: 'reference',
    id,
  }
}

function upsertEvidenceDisplay(
  normalized: Map<string, EvidenceReferenceDisplay>,
  value: EvidenceReferenceDisplay,
) {
  const existing = normalized.get(value.id)

  if (!existing) {
    normalized.set(value.id, value)
    return
  }

  if (existing.kind === 'reference' && value.kind === 'summary') {
    normalized.set(value.id, value)
  }
}

export function normalizeEvidenceReferences(
  input: EvidenceNormalizationInput,
): EvidenceReferenceDisplay[] {
  if (!Array.isArray(input) || input.length === 0) {
    return []
  }

  const normalized = new Map<string, EvidenceReferenceDisplay>()

  for (const entry of input) {
    const nextValue = typeof entry === 'string'
      ? normalizeReferenceEvidence(entry)
      : normalizeSummaryEvidence(entry)

    if (nextValue) {
      upsertEvidenceDisplay(normalized, nextValue)
    }
  }

  return Array.from(normalized.values())
}
