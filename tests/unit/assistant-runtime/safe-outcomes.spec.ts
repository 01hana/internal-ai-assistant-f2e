import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  finalAnsweredIdOnlyEvent,
  finalAnsweredSummaryEvent,
  finalApprovalRequiredEvent,
  finalClarificationRequiredEvent,
  finalConfirmationRequiredEvent,
  finalEscalationRequiredEvent,
  finalNoEvidenceEvent,
  finalPermissionDeniedEvent,
  finalToolFailureEvent,
} from '../../fixtures/assistant-sse/events'
import {
  normalizeEvidenceReferences,
} from '../../../packages/assistant-runtime/src/evidence'
import {
  createTerminalOutcome,
  mapAnswerDecisionState,
} from '../../../packages/assistant-runtime/src/outcomes'
import type {
  AssistantMessageFinalData,
  EvidenceRefsWireValue,
} from '../../../packages/assistant-runtime/src/types'

describe('shared runtime safe outcomes', () => {
  it('maps backend final AnswerDecision data into library-safe display states', () => {
    expect(mapAnswerDecisionState(finalAnsweredIdOnlyEvent.data)).toEqual({
      kind: 'answered',
      answerDecision: 'answered',
    })
    expect(mapAnswerDecisionState(finalClarificationRequiredEvent.data)).toEqual({
      kind: 'clarification_required',
      answerDecision: 'clarification_required',
      clarificationQuestionId: 'clarification-001',
    })
    expect(mapAnswerDecisionState(finalNoEvidenceEvent.data)).toEqual({
      kind: 'no_answer',
      answerDecision: 'no_answer',
      noAnswerReason: 'no_evidence',
    })
    expect(mapAnswerDecisionState(finalPermissionDeniedEvent.data)).toEqual({
      kind: 'permission_denied',
      answerDecision: 'permission_denied',
    })
    expect(mapAnswerDecisionState(finalToolFailureEvent.data)).toEqual({
      kind: 'no_answer',
      answerDecision: 'no_answer',
      noAnswerReason: 'tool_failure',
    })
  })

  it('keeps confirmation, approval, and escalation as ID-only safe display states', () => {
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

  it('does not invent outcomes from partial data, permission hints, or evidence metadata', () => {
    expect(mapAnswerDecisionState({ answer: 'partial' })).toBeNull()
    expect(mapAnswerDecisionState({
      evidenceRefs: ['evidence-001'],
      permissionResult: 'allowed',
    } as unknown as Partial<AssistantMessageFinalData>)).toBeNull()
    expect(mapAnswerDecisionState({
      sourceSystem: 'erp',
      connectorId: 'connector-001',
      rawEvidence: { id: 'raw-001' },
    } as unknown as Partial<AssistantMessageFinalData>)).toBeNull()
  })

  it('models timeout and interrupted as safe terminal runtime outcomes', () => {
    expect(createTerminalOutcome('timeout')).toEqual({
      kind: 'timeout',
      safeTitle: 'Response timed out',
      retryable: true,
    })
    expect(createTerminalOutcome('interrupted')).toEqual({
      kind: 'interrupted',
      safeTitle: 'Response interrupted',
      retryable: true,
    })
  })
})

describe('shared runtime EvidenceRef normalization', () => {
  it('turns string evidence refs into reference-only display metadata', () => {
    expect(normalizeEvidenceReferences(finalAnsweredIdOnlyEvent.data.evidenceRefs))
      .toEqual([
        {
          kind: 'reference',
          id: 'evidence-structured-001',
        },
      ])
  })

  it('turns safe summary refs into display metadata without adding authority fields', () => {
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
    expect(normalized[0]).not.toHaveProperty('sourceSystem')
    expect(normalized[0]).not.toHaveProperty('connectorId')
    expect(normalized[0]).not.toHaveProperty('navigationUrl')
  })

  it('deduplicates evidence in stable first-seen order and upgrades safe summaries', () => {
    expect(normalizeEvidenceReferences([
      'evidence-duplicate-001',
      'evidence-second-001',
      {
        id: 'evidence-duplicate-001',
        sourceType: 'structured_record',
        title: '訂單狀態',
      },
    ] as EvidenceRefsWireValue)).toEqual([
      {
        kind: 'summary',
        id: 'evidence-duplicate-001',
        sourceType: 'structured_record',
        title: '訂單狀態',
      },
      {
        kind: 'reference',
        id: 'evidence-second-001',
      },
    ])
  })

  it('drops malformed evidence and forbidden raw/authority metadata', () => {
    const normalized = normalizeEvidenceReferences([
      '',
      { id: 'missing-source-type' },
      {
        id: 'evidence-safe-001',
        sourceType: 'document_chunk',
        title: '安全摘要',
        snippet: '只保留安全摘要。',
        rawEvidence: { secret: 'do-not-keep' },
        sourceSystem: 'erp',
        connectorId: 'connector-001',
        token: 'secret-token',
        navigationUrl: '/internal/orders/1',
      },
    ] as unknown as EvidenceRefsWireValue)

    expect(normalized).toEqual([
      {
        kind: 'summary',
        id: 'evidence-safe-001',
        sourceType: 'document_chunk',
        title: '安全摘要',
        snippet: '只保留安全摘要。',
      },
    ])

    const serialized = JSON.stringify(normalized)
    expect(serialized).not.toContain('rawEvidence')
    expect(serialized).not.toContain('sourceSystem')
    expect(serialized).not.toContain('connectorId')
    expect(serialized).not.toContain('secret-token')
    expect(serialized).not.toContain('navigationUrl')
  })
})

describe('shared runtime outcome/evidence source boundary', () => {
  it('stays library-safe and does not own frontend authority or navigation', async () => {
    const sources = await Promise.all([
      readFile('packages/assistant-runtime/src/outcomes/index.ts', 'utf8'),
      readFile('packages/assistant-runtime/src/evidence/index.ts', 'utf8'),
    ])
    const source = sources.join('\n')

    for (const forbidden of [
      "app/",
      "#app",
      "#imports",
      "useRuntimeConfig",
      "packages/assistant-sdk",
      "rawEvidence:",
      "sourceSystem:",
      "connectorId:",
      "navigationUrl:",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })
})
