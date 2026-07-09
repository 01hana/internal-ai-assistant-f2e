import { describe, expect, it } from 'vitest'
import { resolveAssistantMessageRenderer } from '../../../app/utils/assistant/assistantMessageRendererResolver'
import type {
  AssistantRenderableMessage,
  AssistantStreamingUiMessage,
  AnswerDecisionUiState,
  HistoryMessageSummary,
} from '../../../app/types/assistant'

const createdAt = '2026-07-07T09:00:00.000Z'

function createCompletedStreamingMessage(
  overrides: Partial<AssistantStreamingUiMessage> = {},
): AssistantStreamingUiMessage {
  return {
    key: 'stream:resolver-001',
    messageId: 'message-resolver-001',
    requestId: 'req-resolver-001',
    kind: 'assistant_streaming',
    role: 'assistant',
    content: '預設內容',
    createdAt,
    status: 'completed',
    lastSequence: 3,
    evidence: [],
    finalAnswerDecision: 'answered',
    finalDecisionState: {
      kind: 'answered',
      answerDecision: 'answered',
    } satisfies AnswerDecisionUiState,
    ...overrides,
  }
}

describe('assistantMessageRendererResolver', () => {
  it('maps answered messages to assistant_answer', () => {
    const resolved = resolveAssistantMessageRenderer(
      createCompletedStreamingMessage(),
    )

    expect(resolved.rendererKind).toBe('assistant_answer')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.messageTestId).toBe('assistant-ai-message')
  })

  it('maps active streaming messages to assistant_streaming', () => {
    const resolved = resolveAssistantMessageRenderer({
      ...createCompletedStreamingMessage(),
      key: 'stream:resolver-active-001',
      status: 'streaming',
      finalAnswerDecision: undefined,
      finalDecisionState: null,
      content: '',
    } satisfies AssistantStreamingUiMessage)

    expect(resolved.rendererKind).toBe('assistant_streaming')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.showTimestamp).toBe(false)
  })

  it('maps clarification_required to clarification', () => {
    const resolved = resolveAssistantMessageRenderer(
      createCompletedStreamingMessage({
        finalAnswerDecision: 'clarification_required',
        finalDecisionState: {
          kind: 'clarification_required',
          answerDecision: 'clarification_required',
          clarificationQuestionId: 'clarification-001',
        },
      }),
    )

    expect(resolved.rendererKind).toBe('clarification')
    expect(resolved.messageTestId).toBe('assistant-clarification-message')
  })

  it('maps confirmation_required to confirmation', () => {
    const resolved = resolveAssistantMessageRenderer(
      createCompletedStreamingMessage({
        finalAnswerDecision: 'confirmation_required',
        finalDecisionState: {
          kind: 'confirmation_required',
          answerDecision: 'confirmation_required',
          actionDraftId: 'action-draft-001',
        },
      }),
    )

    expect(resolved.rendererKind).toBe('confirmation')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.messageTestId).toBe('assistant-action-draft-message')
    expect(resolved.showTimestamp).toBe(true)
  })

  it('maps approval_required to approval', () => {
    const resolved = resolveAssistantMessageRenderer(
      createCompletedStreamingMessage({
        finalAnswerDecision: 'approval_required',
        finalDecisionState: {
          kind: 'approval_required',
          answerDecision: 'approval_required',
          approvalRequestId: 'approval-request-001',
        },
      }),
    )

    expect(resolved.rendererKind).toBe('approval')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.messageTestId).toBe('assistant-approval-request-message')
    expect(resolved.showTimestamp).toBe(true)
  })

  it('maps no_answer to no_answer', () => {
    const resolved = resolveAssistantMessageRenderer(
      createCompletedStreamingMessage({
        finalAnswerDecision: 'no_answer',
        finalDecisionState: {
          kind: 'no_answer',
          answerDecision: 'no_answer',
          noAnswerReason: 'no_evidence',
        },
      }),
    )

    expect(resolved.rendererKind).toBe('no_answer')
    expect(resolved.messageTestId).toBe('assistant-no-answer-message')
  })

  it('maps no_answer + tool_failure to tool_failure', () => {
    const resolved = resolveAssistantMessageRenderer(
      createCompletedStreamingMessage({
        finalAnswerDecision: 'no_answer',
        finalDecisionState: {
          kind: 'no_answer',
          answerDecision: 'no_answer',
          noAnswerReason: 'tool_failure',
        },
      }),
    )

    expect(resolved.rendererKind).toBe('tool_failure')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.showTimestamp).toBe(true)
  })

  it('maps permission_denied to permission_denied', () => {
    const resolved = resolveAssistantMessageRenderer(
      createCompletedStreamingMessage({
        finalAnswerDecision: 'permission_denied',
        finalDecisionState: {
          kind: 'permission_denied',
          answerDecision: 'permission_denied',
        },
      }),
    )

    expect(resolved.rendererKind).toBe('permission_denied')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.showTimestamp).toBe(true)
  })

  it('maps escalation_required to escalation', () => {
    const resolved = resolveAssistantMessageRenderer(
      createCompletedStreamingMessage({
        finalAnswerDecision: 'escalation_required',
        finalDecisionState: {
          kind: 'escalation_required',
          answerDecision: 'escalation_required',
          escalationRequestId: 'escalation-001',
        },
      }),
    )

    expect(resolved.rendererKind).toBe('escalation')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.showTimestamp).toBe(true)
  })

  it('maps history permission_denied to permission_denied', () => {
    const resolved = resolveAssistantMessageRenderer({
      messageId: 'message-history-permission-denied-001',
      role: 'assistant',
      content: '你目前沒有權限查看這筆資料。',
      createdAt,
      answerDecision: 'permission_denied',
    } satisfies HistoryMessageSummary)

    expect(resolved.rendererKind).toBe('permission_denied')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.showTimestamp).toBe(true)
  })

  it('maps history confirmation_required to confirmation', () => {
    const resolved = resolveAssistantMessageRenderer({
      messageId: 'message-history-confirmation-001',
      role: 'assistant',
      content: '請確認是否送出此操作。',
      createdAt,
      answerDecision: 'confirmation_required',
    } satisfies HistoryMessageSummary)

    expect(resolved.rendererKind).toBe('confirmation')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.showTimestamp).toBe(true)
  })

  it('maps history approval_required to approval', () => {
    const resolved = resolveAssistantMessageRenderer({
      messageId: 'message-history-approval-001',
      role: 'assistant',
      content: '此操作需要額外審核。',
      createdAt,
      answerDecision: 'approval_required',
      approvalRequestId: 'approval-request-001',
    } satisfies HistoryMessageSummary)

    expect(resolved.rendererKind).toBe('approval')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.showTimestamp).toBe(true)
  })

  it('maps history escalation_required to escalation', () => {
    const resolved = resolveAssistantMessageRenderer({
      messageId: 'message-history-escalation-001',
      role: 'assistant',
      content: '這個請求需要轉交後續處理。',
      createdAt,
      answerDecision: 'escalation_required',
    } satisfies HistoryMessageSummary)

    expect(resolved.rendererKind).toBe('escalation')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.showTimestamp).toBe(true)
  })

  it('maps history no_answer + tool_failure to tool_failure', () => {
    const resolved = resolveAssistantMessageRenderer({
      messageId: 'message-history-tool-failure-001',
      role: 'assistant',
      content: '目前工具執行失敗，無法安全回答。',
      createdAt,
      answerDecision: 'no_answer',
      noAnswerReason: 'tool_failure',
    } as HistoryMessageSummary & { noAnswerReason: 'tool_failure' })

    expect(resolved.rendererKind).toBe('tool_failure')
    expect(resolved.frameRole).toBe('assistant')
    expect(resolved.showTimestamp).toBe(true)
  })

  it('keeps unknown system fallbacks on unsupported_safe_state', () => {
    const resolved = resolveAssistantMessageRenderer({
      key: 'system-unsupported-001',
      kind: 'degraded',
      role: 'system',
      content: '系統目前暫時降級。',
      createdAt,
    })

    expect(resolved.rendererKind).toBe('unsupported_safe_state')
    expect(resolved.frameRole).toBeNull()
  })

  it('keeps assistant history and completed streaming routing aligned', () => {
    const messages: AssistantRenderableMessage[] = [
      {
        messageId: 'message-history-answered-001',
        role: 'assistant',
        content: '昨天共有五筆訂單。',
        createdAt,
        answerDecision: 'answered',
      } satisfies HistoryMessageSummary,
      {
        messageId: 'message-history-clarification-001',
        role: 'assistant',
        content: '請先指定要查哪一筆。',
        createdAt,
        answerDecision: 'clarification_required',
      } satisfies HistoryMessageSummary,
      {
        messageId: 'message-history-confirmation-001',
        role: 'assistant',
        content: '請先確認這個動作。',
        createdAt,
        answerDecision: 'confirmation_required',
      } satisfies HistoryMessageSummary,
      {
        messageId: 'message-history-no-answer-001',
        role: 'assistant',
        content: '目前沒有足夠資訊可安全回答。',
        createdAt,
        answerDecision: 'no_answer',
      } satisfies HistoryMessageSummary,
      {
        messageId: 'message-history-approval-001',
        role: 'assistant',
        content: '這個操作需要額外審核。',
        createdAt,
        answerDecision: 'approval_required',
        approvalRequestId: 'approval-request-001',
      } satisfies HistoryMessageSummary,
    ]

    expect(resolveAssistantMessageRenderer(messages[0]).rendererKind).toBe(
      'assistant_answer',
    )
    expect(resolveAssistantMessageRenderer(messages[1]).rendererKind).toBe(
      'clarification',
    )
    expect(resolveAssistantMessageRenderer(messages[2]).rendererKind).toBe(
      'confirmation',
    )
    expect(resolveAssistantMessageRenderer(messages[3]).rendererKind).toBe(
      'no_answer',
    )
    expect(resolveAssistantMessageRenderer(messages[4]).rendererKind).toBe(
      'approval',
    )
  })
})
