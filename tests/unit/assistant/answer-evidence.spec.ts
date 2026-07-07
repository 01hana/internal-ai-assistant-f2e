import { describe, expect, it } from 'vitest'
import {
  finalAnsweredIdOnlyEvent,
  finalAnsweredSummaryEvent,
  finalApprovalRequiredEvent,
  finalClarificationRequiredEvent,
  finalConfirmationRequiredEvent,
  finalEscalationRequiredEvent,
  finalPermissionDeniedEvent,
  finalToolFailureEvent,
} from '../../fixtures/assistant-sse/events'
import type {
  AssistantMessageFinalData,
  EvidenceNormalizationInput,
  EvidenceReferenceDisplay,
} from '../../../app/types/assistant'
import { mapAnswerDecisionState } from '../../../app/utils/assistant/answerDecisionStateMapper'
import { normalizeEvidenceReferences } from '../../../app/utils/assistant/evidenceNormalizationAdapter'

describe('answerDecisionStateMapper', () => {
  it('maps answered final data to the answered UI state', () => {
    expect(mapAnswerDecisionState(finalAnsweredIdOnlyEvent.data)).toEqual({
      kind: 'answered',
      answerDecision: 'answered',
    })
  })

  it('maps clarification-required final data to the clarification UI state', () => {
    expect(mapAnswerDecisionState(finalClarificationRequiredEvent.data)).toEqual({
      kind: 'clarification_required',
      answerDecision: 'clarification_required',
      clarificationQuestionId: 'clarification-001',
    })
  })

  it('keeps tool failure inside the no-answer decision state', () => {
    expect(mapAnswerDecisionState(finalToolFailureEvent.data)).toEqual({
      kind: 'no_answer',
      answerDecision: 'no_answer',
      noAnswerReason: 'tool_failure',
    })
  })

  it.each([
    'no_evidence',
    'missing_page_context',
    'evidence_conflict',
  ] as const)(
    'maps no-answer reason %s without inventing a new final state',
    (noAnswerReason) => {
      const finalData = {
        answerDecision: 'no_answer',
        noAnswerReason,
        evidenceRefs: [],
      } satisfies AssistantMessageFinalData

      expect(mapAnswerDecisionState(finalData)).toEqual({
        kind: 'no_answer',
        answerDecision: 'no_answer',
        noAnswerReason,
      })
    },
  )

  it('maps permission denied to the dedicated permission-denied state', () => {
    expect(mapAnswerDecisionState(finalPermissionDeniedEvent.data)).toEqual({
      kind: 'permission_denied',
      answerDecision: 'permission_denied',
    })
  })

  it('maps confirmation, approval, and escalation gates with their linkage ids', () => {
    expect(mapAnswerDecisionState(finalConfirmationRequiredEvent.data)).toEqual({
      kind: 'confirmation_required',
      answerDecision: 'confirmation_required',
      actionDraftId: 'action-draft-001',
    })
    expect(mapAnswerDecisionState(finalApprovalRequiredEvent.data)).toEqual({
      kind: 'approval_required',
      answerDecision: 'approval_required',
      approvalRequestId: 'approval-request-001',
    })
    expect(mapAnswerDecisionState(finalEscalationRequiredEvent.data)).toEqual({
      kind: 'escalation_required',
      answerDecision: 'escalation_required',
      escalationRequestId: 'escalation-request-001',
    })
  })

  it('does not treat partial or non-final data as answered or completed', () => {
    expect(
      mapAnswerDecisionState({
        answer: 'partial answer',
      } as Partial<AssistantMessageFinalData>),
    ).toBeNull()

    expect(
      mapAnswerDecisionState({
        delta: 'partial answer',
      } as unknown as Partial<AssistantMessageFinalData>),
    ).toBeNull()

    expect(
      mapAnswerDecisionState({
        code: 'stream_error',
        message: 'Request failed',
      } as unknown as Partial<AssistantMessageFinalData>),
    ).toBeNull()
  })
})

describe('evidenceNormalizationAdapter', () => {
  it('turns string evidence references into reference-only display items', () => {
    const normalized = normalizeEvidenceReferences(
      finalAnsweredIdOnlyEvent.data.evidenceRefs,
    )

    expect(normalized).toEqual([
      {
        kind: 'reference',
        id: 'evidence-structured-001',
      },
    ])
    expect(normalized[0]).not.toHaveProperty('title')
    expect(normalized[0]).not.toHaveProperty('snippet')
    expect(normalized[0]).not.toHaveProperty('sourceType')
  })

  it('turns EvidenceRefSummary[] into summary display items without adding fields', () => {
    const normalized = normalizeEvidenceReferences(
      finalAnsweredSummaryEvent.data.evidenceRefs,
    )

    expect(normalized).toEqual([
      {
        kind: 'summary',
        id: 'evidence-document-001',
        sourceType: 'document_chunk',
        sourceId: 'return-policy',
        title: '退貨流程 SOP',
        snippet: '建立退貨申請後，由倉儲確認入庫。',
      },
    ])
  })

  it('drops raw evidence, raw tool output, and full document text from runtime input', () => {
    const normalized = normalizeEvidenceReferences([
      {
        id: 'evidence-document-002',
        sourceType: 'document_chunk',
        title: '安全摘要',
        snippet: '只保留後端已提供的安全摘要。',
        rawEvidence: {
          internal: true,
        },
        rawToolOutput: 'SECRET',
        fullDocumentText: 'do not keep this',
      },
    ] as unknown as EvidenceNormalizationInput)

    expect(normalized).toEqual([
      {
        kind: 'summary',
        id: 'evidence-document-002',
        sourceType: 'document_chunk',
        title: '安全摘要',
        snippet: '只保留後端已提供的安全摘要。',
      },
    ] satisfies EvidenceReferenceDisplay[])
    expect(normalized[0]).not.toHaveProperty('rawEvidence')
    expect(normalized[0]).not.toHaveProperty('rawToolOutput')
    expect(normalized[0]).not.toHaveProperty('fullDocumentText')
  })

  it('deduplicates evidence ids and upgrades a reference to a summary when safe data arrives later', () => {
    const normalized = normalizeEvidenceReferences([
      'evidence-duplicate-001',
      {
        id: 'evidence-duplicate-001',
        sourceType: 'structured_record',
        title: '訂單狀態',
      },
      'evidence-duplicate-001',
    ] as unknown as EvidenceNormalizationInput)

    expect(normalized).toEqual([
      {
        kind: 'summary',
        id: 'evidence-duplicate-001',
        sourceType: 'structured_record',
        title: '訂單狀態',
      },
    ])
  })

  it('returns an empty list for invalid or empty evidence input', () => {
    expect(normalizeEvidenceReferences([])).toEqual([])
    expect(normalizeEvidenceReferences(null)).toEqual([])
    expect(normalizeEvidenceReferences(undefined)).toEqual([])
    expect(
      normalizeEvidenceReferences([
        '',
        '   ',
        { sourceType: 'document_chunk' },
        { id: 'evidence-invalid-001' },
      ] as unknown as EvidenceNormalizationInput),
    ).toEqual([])
  })
})
