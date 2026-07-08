import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ChatMessageArea from '../../../app/features/assistant/components/ChatMessageArea.vue'
import type {
  AssistantStreamingUiMessage,
  AnswerDecisionUiState,
  EvidenceReferenceDisplay,
  HistoryMessageSummary,
} from '../../../app/types/assistant'

const mountedWrappers: VueWrapper[] = []
const createdAt = '2026-07-07T09:00:00.000Z'

function createCompletedStreamingMessage(
  overrides: Partial<AssistantStreamingUiMessage> = {},
): AssistantStreamingUiMessage {
  return {
    key: 'stream:answer-evidence-001',
    messageId: 'message-answer-evidence-001',
    requestId: 'req-answer-evidence-001',
    kind: 'assistant_streaming',
    role: 'assistant',
    content: 'SO-10001 目前狀態為 confirmed。',
    createdAt,
    status: 'completed',
    lastSequence: 4,
    evidence: [],
    finalAnswerDecision: 'answered',
    finalDecisionState: {
      kind: 'answered',
      answerDecision: 'answered',
    } satisfies AnswerDecisionUiState,
    ...overrides,
  }
}

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount()
  }
  document.body.innerHTML = ''
})

describe('AiMessageItem answered evidence UI', () => {
  it('renders safe summary evidence with sourceType, title, and snippet', async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          createCompletedStreamingMessage({
            evidence: [
              {
                kind: 'summary',
                id: 'evidence-document-001',
                sourceType: 'document_chunk',
                title: '退貨流程 SOP',
                snippet: '建立退貨申請後，由倉儲確認入庫。',
              },
            ] satisfies EvidenceReferenceDisplay[],
          }),
        ],
      },
    })
    mountedWrappers.push(wrapper)

    expect(wrapper.get('[data-testid="assistant-ai-message"]').exists()).toBe(true)
    expect(
      wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists(),
    ).toBe(true)
    expect(wrapper.get('[data-testid="assistant-ai-bubble"]').text()).toContain(
      'SO-10001 目前狀態為 confirmed。',
    )
    expect(wrapper.get('[data-testid="assistant-ai-message-time"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-ai-answer-decision"]').text()).toContain('已回答')
    expect(wrapper.get('[data-testid="assistant-evidence-display"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-evidence-source-type"]').text()).toContain('document_chunk')
    expect(wrapper.get('[data-testid="assistant-evidence-title"]').text()).toContain('退貨流程 SOP')
    expect(wrapper.get('[data-testid="assistant-evidence-snippet"]').text()).toContain('建立退貨申請後，由倉儲確認入庫。')

    const metadata = wrapper.get('[data-testid="assistant-message-metadata"]')
    const feedbackControls = wrapper.get('[data-testid="assistant-feedback-controls"]')
    const helpfulFeedback = wrapper.get('[data-testid="assistant-feedback-helpful"]')
    const notHelpfulFeedback = wrapper.get('[data-testid="assistant-feedback-not-helpful"]')

    expect(metadata.exists()).toBe(true)
    expect(metadata.find('[data-testid="assistant-feedback-controls"]').exists()).toBe(true)
    expect(metadata.find('[data-testid="assistant-ai-message-time"]').exists()).toBe(true)
    expect(feedbackControls.exists()).toBe(true)
    expect(
      helpfulFeedback.attributes('aria-label') ?? helpfulFeedback.attributes('title'),
    ).toContain('有幫助')
    expect(
      notHelpfulFeedback.attributes('aria-label') ?? notHelpfulFeedback.attributes('title'),
    ).toContain('沒有幫助')
    expect(helpfulFeedback.attributes('disabled')).toBeUndefined()
    expect(notHelpfulFeedback.attributes('disabled')).toBeUndefined()
    expect(
      wrapper
        .get('[data-testid="assistant-ai-bubble"]')
        .find('[data-testid="assistant-feedback-controls"]')
        .exists(),
    ).toBe(false)

    await helpfulFeedback.trigger('click')

    expect(wrapper.emitted('feedback')).toEqual([
      [
        {
          messageId: 'message-answer-evidence-001',
          value: 'helpful',
          requestId: 'req-answer-evidence-001',
        },
      ],
    ])
  })

  it('reflects selected feedback state from parent-managed props', async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createCompletedStreamingMessage()],
        feedbackStates: {
          'message-answer-evidence-001': {
            value: 'helpful',
            pending: false,
            error: null,
            requestId: 'req-answer-evidence-001',
          },
        },
      },
    })
    mountedWrappers.push(wrapper)

    expect(
      wrapper.get('[data-testid="assistant-feedback-helpful"]').attributes('aria-pressed'),
    ).toBe('true')
  })

  it('disables feedback controls when the answered message has no messageId', async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          createCompletedStreamingMessage({
            messageId: undefined,
          }),
        ],
      },
    })
    mountedWrappers.push(wrapper)

    expect(
      wrapper.get('[data-testid="assistant-feedback-helpful"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.get('[data-testid="assistant-feedback-not-helpful"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.get('[data-testid="assistant-feedback-helpful"]').trigger('click')
    expect(wrapper.emitted('feedback')).toBeUndefined()
  })

  it('renders reference-only evidence ids without inventing title, snippet, or sourceType', async () => {
    const historyAssistantMessage = {
      messageId: 'message-history-reference-001',
      role: 'assistant',
      content: '這是 reference-only evidence flow。',
      createdAt,
      answerDecision: 'answered',
      evidenceRefs: ['evidence-structured-001'],
    } satisfies HistoryMessageSummary

    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [historyAssistantMessage],
      },
    })
    mountedWrappers.push(wrapper)

    expect(wrapper.get('[data-testid="assistant-evidence-reference"]').text()).toContain(
      'evidence-structured-001',
    )
    expect(wrapper.find('[data-testid="assistant-evidence-title"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="assistant-evidence-snippet"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="assistant-evidence-source-type"]').exists()).toBe(false)
  })

  it('stays safe when evidence is empty and does not render raw evidence details', async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createCompletedStreamingMessage()],
      },
    })
    mountedWrappers.push(wrapper)

    expect(wrapper.find('[data-testid="assistant-evidence-display"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('rawEvidence')
    expect(wrapper.text()).not.toContain('rawToolOutput')
    expect(wrapper.text()).not.toContain('fullDocumentText')

    for (const copy of [
      'public chatbot',
      'customer service',
      'lead capture',
      'handoff',
    ]) {
      expect(wrapper.text().toLowerCase()).not.toContain(copy)
    }
  })

  it('renders the dedicated permission_denied safe state without answered metadata', async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          {
            messageId: 'message-history-permission-denied-001',
            role: 'assistant',
            content: '你目前沒有權限查看這筆資料。',
            createdAt,
            answerDecision: 'permission_denied',
          } satisfies HistoryMessageSummary,
        ],
      },
    })
    mountedWrappers.push(wrapper)

    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false)
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false)
    expect(wrapper.get('[data-testid="assistant-permission-denied-message"]').exists()).toBe(true)
  })
})

describe('ChatMessageArea completed answer rendering', () => {
  it('renders a completed streaming message with final decision as the answered assistant UI', async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          createCompletedStreamingMessage({
            content: '訂單資料已整理完成。',
          }),
        ],
      },
    })
    mountedWrappers.push(wrapper)

    expect(wrapper.get('[data-testid="assistant-ai-message"]').text()).toContain(
      '訂單資料已整理完成。',
    )
    expect(wrapper.get('[data-testid="assistant-message-metadata"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="assistant-streaming-message"]').exists()).toBe(false)
  })
})
