import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAssistantSessionStore } from '../../../app/stores/assistant/useSessionStore'

describe('assistant feedback state transitions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('provides a safe default state for unseen message ids', () => {
    const store = useAssistantSessionStore()

    expect(store.getFeedbackState('message-001')).toEqual({
      value: null,
      pending: false,
      error: null,
      requestId: null,
    })
  })

  it('supports optimistic submit, success completion, failure rollback, and retry', () => {
    const store = useAssistantSessionStore()

    store.startFeedbackSubmission('message-001', 'helpful', 'req-answer-001')
    expect(store.feedbackByMessageId['message-001']).toEqual({
      value: 'helpful',
      pending: true,
      error: null,
      requestId: 'req-answer-001',
    })

    store.completeFeedbackSubmission('message-001')
    expect(store.feedbackByMessageId['message-001']).toEqual({
      value: 'helpful',
      pending: false,
      error: null,
      requestId: 'req-answer-001',
    })

    store.startFeedbackSubmission('message-001', 'not_helpful', 'req-answer-001')
    store.failFeedbackSubmission(
      'message-001',
      'helpful',
      'req-answer-001',
      '回饋暫時無法送出，請稍後再試。',
    )
    expect(store.feedbackByMessageId['message-001']).toEqual({
      value: 'helpful',
      pending: false,
      error: '回饋暫時無法送出，請稍後再試。',
      requestId: 'req-answer-001',
    })

    store.startFeedbackSubmission('message-001', 'not_helpful', 'req-answer-001')
    expect(store.feedbackByMessageId['message-001']).toEqual({
      value: 'not_helpful',
      pending: true,
      error: null,
      requestId: 'req-answer-001',
    })
  })

  it('clears feedback state on session reset', () => {
    const store = useAssistantSessionStore()

    store.startFeedbackSubmission('message-001', 'helpful', 'req-answer-001')
    expect(store.feedbackByMessageId['message-001']).toBeDefined()

    store.resetSessionState()
    expect(store.feedbackByMessageId).toEqual({})
  })
})
