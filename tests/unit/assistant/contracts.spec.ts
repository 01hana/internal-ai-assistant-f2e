import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  AnswerDecisionStatus,
  AssistantErrorEnvelope,
  AssistantHostContextSnapshot,
  AssistantIdentityContext,
  AssistantIdentityHeaders,
  AssistantSessionScope,
  FeedbackRating,
  NoAnswerReason,
  ResolvedAssistantIdentityHeaders,
  SessionMessagesResponse,
} from '../../../app/types/assistant'
import * as hostContextFixtures from '../../fixtures/assistant-api/host-context'
import * as apiFixtures from '../../fixtures/assistant-api/responses'
import { assistantFixtureScenarios } from '../../fixtures/assistant-api/scenarios'
import * as sseFixtures from '../../fixtures/assistant-sse/events'

const forbiddenFixtureKeys = [
  'rawHostState',
  'rawPageState',
  'rawPayload',
  'rawEvidence',
  'rawDocument',
  'fullDocumentText',
  'rawConnectorOutput',
  'rawLlmPrompt',
  'rawLlmResponse',
  'stack',
  'credential',
  'secret',
  'apiKey',
  'databaseUrl',
  'accessToken',
  'refreshToken',
  'cookie',
] as const

function collectObjectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectKeys(item, keys)
    }

    return keys
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      keys.push(key)
      collectObjectKeys(nestedValue, keys)
    }
  }

  return keys
}

function collectStringValues(value: unknown, values: string[] = []): string[] {
  if (typeof value === 'string') {
    values.push(value)
    return values
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, values)
    }

    return values
  }

  if (value !== null && typeof value === 'object') {
    for (const nestedValue of Object.values(value)) {
      collectStringValues(nestedValue, values)
    }
  }

  return values
}

function expectIncreasingSequences(
  stream: readonly { sequence: number }[],
): void {
  for (let index = 1; index < stream.length; index += 1) {
    expect(stream[index].sequence).toBeGreaterThan(stream[index - 1].sequence)
  }
}

describe('assistant contract type guardrails', () => {
  it('keeps tool failure separate from final decision states', () => {
    expectTypeOf<'tool_failed'>().not.toMatchTypeOf<AnswerDecisionStatus>()
    expectTypeOf<'tool_failure'>().toMatchTypeOf<NoAnswerReason>()

    expect(sseFixtures.finalToolFailureEvent.data).toMatchObject({
      answerDecision: 'no_answer',
      noAnswerReason: 'tool_failure',
    })
  })

  it('keeps all final fixtures explicit and intermediate events non-final', () => {
    const finalEvents = [
      sseFixtures.finalAnsweredIdOnlyEvent,
      sseFixtures.finalAnsweredSummaryEvent,
      sseFixtures.finalClarificationRequiredEvent,
      sseFixtures.finalNoEvidenceEvent,
      sseFixtures.finalToolFailureEvent,
      sseFixtures.finalPermissionDeniedEvent,
      sseFixtures.finalConfirmationRequiredEvent,
      sseFixtures.finalApprovalRequiredEvent,
      sseFixtures.finalEscalationRequiredEvent,
    ]

    for (const event of finalEvents) {
      expect(event.eventType).toBe('final')
      expect(event.data.answerDecision).toBeTruthy()
    }

    expect(sseFixtures.answerDeltaEvent.eventType).toBe('answer_delta')
    expect(sseFixtures.errorEvent.eventType).toBe('error')
    expect(sseFixtures.errorEvent.data).not.toHaveProperty('answerDecision')
  })

  it('keeps events within each stream correlated to one request and message', () => {
    const correlatedStreams = [
      sseFixtures.answeredIdOnlyStream,
      sseFixtures.toolFailureStream,
      sseFixtures.permissionDeniedStream,
      sseFixtures.confirmationRequiredStream,
      sseFixtures.approvalRequiredStream,
      sseFixtures.escalationRequiredStream,
      sseFixtures.errorAfterPartialStream,
    ]

    for (const stream of correlatedStreams) {
      expect(new Set(stream.map(event => event.requestId)).size).toBe(1)
      expect(new Set(stream.map(event => event.sessionId)).size).toBe(1)
      expect(new Set(stream.map(event => event.messageId)).size).toBe(1)
    }
  })

  it('keeps multi-event stream fixture sequences increasing', () => {
    const multiEventStreams = [
      sseFixtures.answeredIdOnlyStream,
      sseFixtures.toolFailureStream,
      sseFixtures.permissionDeniedStream,
      sseFixtures.confirmationRequiredStream,
      sseFixtures.approvalRequiredStream,
      sseFixtures.escalationRequiredStream,
      sseFixtures.errorAfterPartialStream,
    ]

    for (const stream of multiEventStreams) {
      expectIncreasingSequences(stream)
    }
  })

  it('distinguishes identifier-only evidence from safe summaries', () => {
    expect(sseFixtures.finalAnsweredIdOnlyEvent.data.evidenceRefs).toEqual([
      'evidence-structured-001',
    ])
    expect(
      typeof sseFixtures.finalAnsweredIdOnlyEvent.data.evidenceRefs[0],
    ).toBe('string')

    expect(sseFixtures.finalAnsweredSummaryEvent.data.evidenceRefs[0]).toEqual({
      id: 'evidence-document-001',
      sourceType: 'document_chunk',
      sourceId: 'return-policy',
      title: '退貨流程 SOP',
      snippet: '建立退貨申請後，由倉儲確認入庫。',
    })
  })

  it('supports all feedback ratings in the backend contract', () => {
    const ratings = [
      apiFixtures.feedbackPositiveSuccessResponse.data.rating,
      apiFixtures.feedbackNegativeSuccessResponse.data.rating,
      apiFixtures.feedbackNeutralSuccessResponse.data.rating,
    ] satisfies FeedbackRating[]

    expect(ratings).toEqual(['positive', 'negative', 'neutral'])
  })

  it('separates optional wire headers from resolved outbound headers', () => {
    const wireHeadersWithoutRequestId = {
      'x-actor-id': 'actor-001',
      'x-organization-id': 'org-001',
      'x-host-app': 'erp-web',
      'x-role': 'operator',
    } satisfies AssistantIdentityHeaders

    const resolvedHeaders = {
      ...wireHeadersWithoutRequestId,
      'x-request-id': 'req-resolved-001',
    } satisfies ResolvedAssistantIdentityHeaders

    expect(wireHeadersWithoutRequestId).not.toHaveProperty('x-request-id')
    expect(resolvedHeaders['x-request-id']).toBe('req-resolved-001')
    expectTypeOf(resolvedHeaders).toMatchTypeOf<ResolvedAssistantIdentityHeaders>()
  })

  it('exports typed host context, identity, and session scope fixtures', () => {
    expectTypeOf(
      hostContextFixtures.globalHostContextSnapshot,
    ).toMatchTypeOf<AssistantHostContextSnapshot>()
    expectTypeOf(
      hostContextFixtures.hostIdentityContextFixture,
    ).toMatchTypeOf<AssistantIdentityContext>()
    expectTypeOf(
      hostContextFixtures.entitySessionScopeFixture,
    ).toMatchTypeOf<AssistantSessionScope>()
  })

  it('keeps not-ready and host override fixtures explicit and safe', () => {
    expect(hostContextFixtures.contextNotReadySnapshot).toMatchObject({
      readiness: {
        status: 'not_ready',
        reason: 'identity_missing',
      },
      identityHeaders: null,
      pageContext: null,
    })
    expect(hostContextFixtures.hostOverrideSessionScopeFixture.source).toBe(
      'host_override',
    )
  })

  it('keeps approval detail integration callback-only', () => {
    const approvalDetailSnapshot =
      hostContextFixtures.approvalDetailHostContextSnapshot

    expect(typeof approvalDetailSnapshot.onOpenApprovalDetail).toBe('function')
    expect(approvalDetailSnapshot).not.toHaveProperty('approve')
    expect(approvalDetailSnapshot).not.toHaveProperty('reject')
    expect(approvalDetailSnapshot).not.toHaveProperty('cancel')
  })

  it('accepts an error envelope without statusCode', () => {
    expectTypeOf(
      apiFixtures.backendErrorWithoutStatusCodeResponse,
    ).toMatchTypeOf<AssistantErrorEnvelope>()
    expect(apiFixtures.backendErrorWithoutStatusCodeResponse.error).not
      .toHaveProperty('statusCode')
  })

  it('uses nextCursor as the only history pagination signal', () => {
    expectTypeOf(
      apiFixtures.historyFirstPageSuccessResponse.data,
    ).toMatchTypeOf<SessionMessagesResponse>()
    expect(apiFixtures.historyFirstPageSuccessResponse.data.nextCursor).toBe(
      'msg-user-001',
    )
    expect(apiFixtures.historyFirstPageSuccessResponse.data).not.toHaveProperty(
      'hasMore',
    )
  })

  it('keeps summary identifiers distinct from final linkage identifiers', () => {
    expect(apiFixtures.actionDraftDetailResponse.data.actionDraftId).toBe(
      'action-draft-001',
    )
    expect(apiFixtures.approvalRequestDetailResponse.data.id).toBe(
      'approval-request-001',
    )
    expect(
      sseFixtures.finalConfirmationRequiredEvent.data.actionDraftId,
    ).toBe('action-draft-001')
    expect(
      sseFixtures.finalApprovalRequiredEvent.data.approvalRequestId,
    ).toBe('approval-request-001')
  })

  it('keeps ApprovalRequest fixtures display-only', () => {
    expect(apiFixtures.approvalRequestDetailResponse.data).not.toHaveProperty(
      'approve',
    )
    expect(apiFixtures.approvalRequestDetailResponse.data).not.toHaveProperty(
      'reject',
    )
    expect(apiFixtures.approvalRequestDetailResponse.data).not.toHaveProperty(
      'cancel',
    )
  })

  it('keeps scenario identifiers unique and covers required safe flows', () => {
    const scenarioIds = assistantFixtureScenarios.map(
      scenario => scenario.scenarioId,
    )

    expect(new Set(scenarioIds).size).toBe(scenarioIds.length)
    expect(scenarioIds).toEqual(
      expect.arrayContaining([
        'answered-evidence-summary',
        'answered-evidence-id-only',
        'clarification-required',
        'no-answer-no-evidence',
        'no-answer-tool-failure',
        'permission-denied',
        'confirmation-required',
        'approval-required',
        'escalation-required',
        'stream-interrupted',
        'error-after-partial',
        'unknown-sse-event',
        'session-history-next-cursor',
        'feedback-neutral',
      ]),
    )
  })

  it('contains no forbidden fixture keys or history endpoint assumptions', () => {
    const fixtureCorpus = {
      apiFixtures,
      assistantFixtureScenarios,
      hostContextFixtures,
      sseFixtures,
    }
    const fixtureKeys = collectObjectKeys(fixtureCorpus)
    const fixtureStrings = collectStringValues(fixtureCorpus)

    for (const forbiddenKey of forbiddenFixtureKeys) {
      expect(fixtureKeys).not.toContain(forbiddenKey)
    }

    expect(fixtureKeys).not.toContain('hasMore')
    expect(fixtureStrings.some(value => value.includes('/history'))).toBe(false)
  })
})
