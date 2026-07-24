import type { EvidenceRefId, EvidenceRefsWireValue, EvidenceSourceType, ToolCallId } from "../types";
export type EvidenceDisplayKind = "reference" | "summary";
export interface EvidenceReferenceOnlyDisplay {
    kind: "reference";
    id: EvidenceRefId;
}
export interface EvidenceSummaryDisplay {
    kind: "summary";
    id: EvidenceRefId;
    sourceType: EvidenceSourceType;
    sourceId?: string | null;
    toolCallId?: ToolCallId | null;
    title?: string | null;
    snippet?: string | null;
}
export type EvidenceReferenceDisplay = EvidenceReferenceOnlyDisplay | EvidenceSummaryDisplay;
export type EvidenceNormalizationInput = EvidenceRefsWireValue | null | undefined;
export declare function normalizeEvidenceReferences(input: EvidenceNormalizationInput): EvidenceReferenceDisplay[];
