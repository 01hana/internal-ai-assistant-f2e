import type { EvidenceRefId, ToolCallId } from './contracts'

export type EvidenceSourceType = 'structured_record' | 'document_chunk'

export interface EvidenceRefSummary {
  id: EvidenceRefId
  sourceType: EvidenceSourceType
  sourceId?: string | null
  toolCallId?: ToolCallId | null
  title?: string | null
  snippet?: string | null
}

export type EvidenceRefsWireValue = EvidenceRefId[] | EvidenceRefSummary[]

export type EvidenceDisplayKind = 'reference' | 'summary'

export interface EvidenceReferenceOnlyDisplay {
  kind: 'reference'
  id: EvidenceRefId
}

export interface EvidenceSummaryDisplay {
  kind: 'summary'
  id: EvidenceRefId
  sourceType: EvidenceSourceType
  sourceId?: string | null
  toolCallId?: ToolCallId | null
  title?: string | null
  snippet?: string | null
}

export type EvidenceReferenceDisplay =
  | EvidenceReferenceOnlyDisplay
  | EvidenceSummaryDisplay

export type EvidenceNormalizationInput =
  | EvidenceRefsWireValue
  | null
  | undefined
