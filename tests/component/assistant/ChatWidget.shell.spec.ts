import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import AiStreamingItem from '../../../app/features/assistant/components/AiStreamingItem.vue'
import ChatMessageArea from '../../../app/features/assistant/components/ChatMessageArea.vue'
import ChatPanel from '../../../app/features/assistant/components/ChatPanel.vue'
import ChatWidget from '../../../app/features/assistant/components/ChatWidget.vue'
import { useChatWidgetStore } from '../../../app/stores/assistant/useChatWidgetStore'
import type {
  ActionDraftDetailState,
  ApprovalRequestDetailState,
  AssistantHostContextProvider,
  AssistantHostContextSnapshot,
  AssistantStreamingStatus,
  AssistantStreamingUiMessage,
  AssistantUiMessage,
  HistoryMessageSummary,
} from '../../../app/types/assistant'

const createdAt = '2026-07-06T08:30:00.000Z'

function createStreamingMessage(
  overrides: Partial<AssistantStreamingUiMessage> = {},
): AssistantStreamingUiMessage {
  return {
    key: 'stream:req-message-items',
    kind: 'assistant_streaming',
    role: 'assistant',
    content: '',
    createdAt,
    status: 'connecting',
    lastSequence: null,
    evidence: [],
    ...overrides,
  }
}

const messages: AssistantUiMessage[] = [
  {
    key: 'user-001',
    messageId: 'message-user-001',
    kind: 'user',
    role: 'user',
    content: 'Show the current order status.',
    createdAt: '2026-07-03T01:00:00.000Z',
  },
  {
    key: 'streaming-001',
    kind: 'assistant_streaming',
    role: 'assistant',
    content: 'Checking the current status.',
    createdAt: '2026-07-03T01:00:01.000Z',
    status: 'streaming',
    lastSequence: 1,
    evidence: [],
  },
  {
    key: 'answer-001',
    messageId: 'message-answer-001',
    kind: 'assistant_answer',
    role: 'assistant',
    content: 'The order is confirmed.',
    createdAt: '2026-07-03T01:00:02.000Z',
    answerDecision: 'answered',
    evidence: [],
  },
  {
    key: 'safe-state-001',
    kind: 'no_answer',
    role: 'assistant',
    content: 'There is not enough information to answer safely.',
    createdAt: '2026-07-03T01:00:03.000Z',
    answerDecision: 'no_answer',
    noAnswerReason: 'insufficient_evidence',
  },
]

const actionDraftMessage = {
  key: 'stream:action-draft-shell-001',
  messageId: 'message-action-draft-shell-001',
  requestId: 'req-action-draft-shell-001',
  kind: 'assistant_streaming',
  role: 'assistant',
  content: '請確認是否送出此操作。',
  createdAt: '2026-07-03T01:00:04.000Z',
  status: 'completed',
  lastSequence: 1,
  evidence: [],
  finalAnswerDecision: 'confirmation_required',
  finalDecisionState: {
    kind: 'confirmation_required',
    answerDecision: 'confirmation_required',
    actionDraftId: 'action-draft-shell-001',
  },
} as const

const actionDraftState: ActionDraftDetailState = {
  actionDraftId: 'action-draft-shell-001',
  operationStatus: 'idle',
  detailStatus: 'available',
  actionDraftStatus: 'waiting_confirmation',
  idempotencyKey: null,
  detail: {
    actionDraftId: 'action-draft-shell-001',
    requestId: 'req-action-draft-shell-001',
    messageId: 'message-action-draft-shell-001',
    status: 'waiting_confirmation',
    riskLevel: 'medium',
    toolName: 'mock.orders.status.update',
    resource: 'orders',
    operation: 'update',
    preview: {
      targetEntityId: 'SO-10001',
    },
    expiresAt: '2026-07-08T10:15:00.000Z',
  },
}

const approvalMessage = {
  key: 'stream:approval-shell-001',
  messageId: 'message-approval-shell-001',
  requestId: 'req-approval-shell-001',
  kind: 'assistant_streaming',
  role: 'assistant',
  content: '此操作需要額外審核。',
  createdAt: '2026-07-03T01:00:05.000Z',
  status: 'completed',
  lastSequence: 1,
  evidence: [],
  finalAnswerDecision: 'approval_required',
  finalDecisionState: {
    kind: 'approval_required',
    answerDecision: 'approval_required',
    approvalRequestId: 'approval-request-shell-001',
  },
} as const

const approvalRequestState: ApprovalRequestDetailState = {
  approvalRequestId: 'approval-request-shell-001',
  detailStatus: 'available',
  openDetailStatus: 'idle',
  requestId: 'req-approval-shell-001',
  messageId: 'message-approval-shell-001',
  sessionId: 'session-shell-001',
  status: 'pending',
  riskLevel: 'critical',
  actionSummary: {
    operation: 'cancel',
  },
}

function createApprovalHostProvider(
  onOpenApprovalDetail?: (payload: {
    approvalRequestId: string
    requestId?: string
    messageId?: string
    sessionId?: string
  }) => void | Promise<void>,
): AssistantHostContextProvider {
  const snapshot: AssistantHostContextSnapshot = {
    readiness: { status: 'ready' },
    identityHeaders: {
      'x-request-id': 'req-host-shell-001',
      'x-actor-id': 'actor-shell-001',
      'x-organization-id': 'org-shell-001',
      'x-host-app': 'erp-web',
      'x-role': 'approver',
      'x-permission-scopes': 'orders:approve',
    },
    pageContext: {
      route: '/orders',
    },
    onOpenApprovalDetail,
  }

  return {
    getSnapshot: () => snapshot,
  }
}

const mountedWrappers: VueWrapper[] = []
let originalInnerWidth = window.innerWidth
let scrollToMock: ReturnType<typeof vi.fn>
let scrollIntoViewMock: ReturnType<typeof vi.fn>

async function mountWidget(
  props: Record<string, unknown> = {},
): Promise<VueWrapper> {
  const wrapper = await mountSuspended(ChatWidget, {
    attachTo: document.body,
    props,
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  originalInnerWidth = window.innerWidth
  scrollToMock = vi.fn()
  scrollIntoViewMock = vi.fn()

  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: scrollToMock,
  })
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewMock,
  })
})

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount()
  }
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: originalInnerWidth,
  })
  document.body.innerHTML = ''
})

describe('useChatWidgetStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('manages open state and availability without a display mode', () => {
    const store = useChatWidgetStore()

    expect(store.isOpen).toBe(false)
    expect(store.availability).toBe('normal')

    store.open()
    expect(store.isOpen).toBe(true)

    store.toggle()
    expect(store.isOpen).toBe(false)

    store.setAvailability('context_not_ready')
    expect(store.availability).toBe('context_not_ready')

    store.close()
    store.reset()
    expect(store.$state).toEqual({
      isOpen: false,
      availability: 'normal',
    })
  })
})

describe('ChatWidget floating launcher shell', () => {
  beforeEach(() => {
    useChatWidgetStore().reset()
  })

  it('defaults to a bottom-right launcher with the panel closed', async () => {
    const wrapper = await mountWidget()
    const launcher = wrapper.get('[data-testid="assistant-launcher"]')

    expect(wrapper.attributes('data-widget-placement')).toBe('bottom-right')
    expect(launcher.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="assistant-panel"]').exists()).toBe(false)
  })

  it('opens and closes the dialog by clicking the launcher', async () => {
    const wrapper = await mountWidget()
    const launcher = wrapper.get('[data-testid="assistant-launcher"]')

    await launcher.trigger('click')
    const panel = wrapper.get('[data-testid="assistant-panel"]')
    expect(launcher.attributes('aria-expanded')).toBe('true')
    expect(panel.attributes('role')).toBe('dialog')

    await launcher.trigger('click')
    expect(launcher.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="assistant-panel"]').exists()).toBe(false)
  })

  it('closes from the close button', async () => {
    const wrapper = await mountWidget()

    await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')
    await wrapper.get('[data-testid="assistant-panel-close"]').trigger('click')

    expect(wrapper.find('[data-testid="assistant-panel"]').exists()).toBe(false)
  })

  it('closes with Escape', async () => {
    const wrapper = await mountWidget()

    await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    }))
    await nextTick()

    expect(wrapper.find('[data-testid="assistant-panel"]').exists()).toBe(false)
  })

  it('shows a safe context-not-ready state and an ARIA live region', async () => {
    const wrapper = await mountWidget({
      availability: 'context_not_ready',
    })

    await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')

    expect(wrapper.get('[data-testid="assistant-message-context-not-ready"]').text())
      .toContain('目前頁面內容尚未就緒')

    const liveRegion = wrapper.get('[data-testid="assistant-panel-status"]')
    expect(liveRegion.attributes('role')).toBe('status')
    expect(liveRegion.attributes('aria-live')).toBe('polite')
  })

  it('renders degraded panel content safely without falling back to context-not-ready', async () => {
    const wrapper = await mountSuspended(ChatPanel, {
      props: {
        availability: 'degraded',
        messages: [
          {
            key: 'system:degraded-state',
            kind: 'degraded',
            role: 'assistant',
            safeTitle: '助理服務暫時不穩定',
            degradedKind: 'degraded',
            content: '目前無法完成這次回覆，請稍後再試。',
            createdAt,
          } satisfies AssistantUiMessage,
        ],
      },
    })
    mountedWrappers.push(wrapper)

    expect(wrapper.get('[data-testid="assistant-degraded-message"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="assistant-message-context-not-ready"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="assistant-panel-status"]').text()).toContain('助理服務暫時不穩定')
  })

  it('keeps the launcher and primary panel regions in a narrow viewport', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 280,
    })
    window.dispatchEvent(new Event('resize'))

    const wrapper = await mountWidget()
    expect(wrapper.get('[data-testid="assistant-launcher"]').exists()).toBe(true)

    await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')

    expect(wrapper.get('[data-testid="assistant-panel-header"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-panel-main"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-message-area"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-panel-footer"]').exists()).toBe(true)
  })

  it('does not render external-service semantics', async () => {
    const wrapper = await mountWidget()

    await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')
    const renderedText = wrapper.text().toLowerCase()
    const forbiddenCopy = [
      'public chatbot',
      'customer service',
      'customer support',
      'contact us',
      'lead capture',
      'handoff',
      'anonymous visitor',
      '轉人工客服',
      '表單留資',
    ]

    for (const copy of forbiddenCopy) {
      expect(renderedText).not.toContain(copy)
    }
  })

  it('forwards confirm and cancel events from the panel action-draft message', async () => {
    const wrapper = await mountSuspended(ChatPanel, {
      props: {
        availability: 'normal',
        messages: [actionDraftMessage],
        actionDraftStates: {
          'action-draft-shell-001': actionDraftState,
        },
      },
    })
    mountedWrappers.push(wrapper)

    await wrapper.get('[data-testid="assistant-action-draft-confirm"]').trigger('click')
    await wrapper.get('[data-testid="assistant-action-draft-cancel"]').trigger('click')

    expect(wrapper.emitted('confirmActionDraft')).toEqual([
      [{ actionDraftId: 'action-draft-shell-001' }],
    ])
    expect(wrapper.emitted('cancelActionDraft')).toEqual([
      [{ actionDraftId: 'action-draft-shell-001' }],
    ])
  })

  it('forwards retry requests from degraded and interrupted renderers', async () => {
    const wrapper = await mountSuspended(ChatPanel, {
      props: {
        availability: 'degraded',
        messages: [
          {
            key: 'stream:interrupted-shell-001',
            requestId: 'req-interrupted-shell-001',
            messageId: 'message-interrupted-shell-001',
            kind: 'assistant_streaming',
            role: 'assistant',
            content: '這是一段尚未完成的內容。',
            createdAt,
            status: 'interrupted',
            lastSequence: 1,
            evidence: [],
          } satisfies AssistantStreamingUiMessage,
        ],
      },
    })
    mountedWrappers.push(wrapper)

    await wrapper.get('[data-testid="assistant-interrupted-retry"]').trigger('click')

    expect(wrapper.emitted('retryRequested')).toEqual([
      [{ key: 'stream:interrupted-shell-001', requestId: 'req-interrupted-shell-001' }],
    ])
  })

  it('forwards open approval detail events to the host callback when available', async () => {
    const onOpenApprovalDetail = vi.fn()
    const wrapper = await mountWidget({
      hostContextProvider: createApprovalHostProvider(onOpenApprovalDetail),
    })

    await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')
    const chatPanel = wrapper.getComponent(ChatPanel)

    chatPanel.vm.$emit('openApprovalDetail', {
      approvalRequestId: 'approval-request-shell-001',
      requestId: 'req-approval-shell-001',
      messageId: 'message-approval-shell-001',
      sessionId: 'session-shell-001',
    })
    await flushPromises()

    expect(chatPanel.emitted('openApprovalDetail')).toEqual([
      [
        {
        approvalRequestId: 'approval-request-shell-001',
        requestId: 'req-approval-shell-001',
        messageId: 'message-approval-shell-001',
        sessionId: 'session-shell-001',
        },
      ],
    ])

    expect(onOpenApprovalDetail).toHaveBeenCalledWith({
      approvalRequestId: 'approval-request-shell-001',
      requestId: 'req-approval-shell-001',
      messageId: 'message-approval-shell-001',
      sessionId: 'session-shell-001',
    })
  })

  it('keeps approval detail open actions safe when the host callback is missing', async () => {
    const wrapper = await mountSuspended(ChatPanel, {
      props: {
        availability: 'normal',
        messages: [approvalMessage],
        approvalRequestStates: {
          'approval-request-shell-001': approvalRequestState,
        },
        canOpenApprovalDetail: false,
      },
    })
    mountedWrappers.push(wrapper)

    expect(
      wrapper.get('[data-testid="assistant-approval-request-open-detail"]').attributes('disabled'),
    ).toBeDefined()
  })
})

describe('ChatMessageArea registry skeleton', () => {
  it('renders its empty and context-not-ready states', async () => {
    const empty = await mountSuspended(ChatMessageArea)
    mountedWrappers.push(empty)
    expect(empty.get('[data-testid="assistant-message-empty"]').exists()).toBe(true)

    const notReady = await mountSuspended(ChatMessageArea, {
      props: {
        contextReady: false,
      },
    })
    mountedWrappers.push(notReady)
    expect(notReady.get('[data-testid="assistant-message-context-not-ready"]').exists()).toBe(true)
  })

  it('auto-scrolls via the message container and does not use scrollIntoView', async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [],
      },
    })
    mountedWrappers.push(wrapper)

    await wrapper.setProps({
      messages: [
        {
          key: 'user-scroll-001',
          messageId: 'message-scroll-001',
          kind: 'user',
          role: 'user',
          content: '查詢目前待處理訂單',
          createdAt,
        } satisfies AssistantUiMessage,
      ],
    })
    await nextTick()

    expect(scrollIntoViewMock).not.toHaveBeenCalled()
    expect(scrollToMock).toHaveBeenCalled()
  })

  it('routes messages through the four renderer slot categories', async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages,
      },
      slots: {
        user: ({ message }: { message: AssistantUiMessage }) =>
          h('span', { 'data-renderer': 'user' }, message.content),
        streaming: ({ message }: { message: AssistantUiMessage }) =>
          h('span', { 'data-renderer': 'streaming' }, message.content),
        answered: ({ message }: { message: AssistantUiMessage }) =>
          h('span', { 'data-renderer': 'answered' }, message.content),
        'safe-state': ({ message }: { message: AssistantUiMessage }) =>
          h('span', { 'data-renderer': 'safe-state' }, message.content),
      },
    })
    mountedWrappers.push(wrapper)

    expect(wrapper.findAll('[data-renderer="user"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-renderer="streaming"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-renderer="answered"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-renderer="safe-state"]')).toHaveLength(1)
  })

  it('renders current and history messages on the correct conversation side', async () => {
    const currentMessages: AssistantUiMessage[] = [
      {
        key: 'local-user:req-current',
        messageId: 'local-user:req-current',
        requestId: 'req-current',
        kind: 'user',
        role: 'user',
        content: '查詢目前待處理訂單',
        createdAt,
      },
      {
        key: 'answer-current',
        messageId: 'message-current',
        requestId: 'req-current',
        kind: 'assistant_answer',
        role: 'assistant',
        content: '目前有三筆待處理訂單。',
        createdAt,
        answerDecision: 'answered',
        evidence: [],
      },
    ]
    const historyMessages: HistoryMessageSummary[] = [
      {
        messageId: 'message-history-user',
        role: 'user',
        content: '昨天有幾筆訂單？',
        createdAt,
      },
      {
        messageId: 'message-history-assistant',
        role: 'assistant',
        content: '昨天共有五筆訂單。',
        createdAt,
        answerDecision: 'answered',
      },
      {
        messageId: 'message-history-safe-assistant',
        role: 'assistant',
        content: '目前沒有足夠資訊可安全回答。',
        createdAt,
        answerDecision: 'no_answer',
      },
    ]
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [...currentMessages, ...historyMessages],
      },
    })
    mountedWrappers.push(wrapper)

    const listItems = wrapper.findAll('li[data-message-kind]')
    expect(listItems.map(item => item.attributes('data-message-kind'))).toEqual([
      'user',
      'assistant_answer',
      'history_user',
      'history_assistant',
      'history_assistant',
    ])

    const userMessages = wrapper.findAll(
      '[data-testid="assistant-user-message"]',
    )
    const answeredAssistantMessages = wrapper.findAll(
      '[data-testid="assistant-ai-message"]',
    )
    const noAnswerAssistantMessages = wrapper.findAll(
      '[data-testid="assistant-no-answer-message"]',
    )

    expect(userMessages).toHaveLength(2)
    expect(answeredAssistantMessages).toHaveLength(2)
    expect(noAnswerAssistantMessages).toHaveLength(1)
    expect(userMessages.every(message => message.classes().includes('justify-end'))).toBe(true)
    expect(
      [...answeredAssistantMessages, ...noAnswerAssistantMessages].every(message =>
        message.classes().includes('justify-start'),
      ),
    ).toBe(true)
    expect(wrapper.text()).toContain('查詢目前待處理訂單')
    expect(wrapper.text()).toContain('昨天共有五筆訂單。')
    expect(wrapper.text()).toContain('目前沒有足夠資訊可安全回答。')
    expect(
      wrapper.findAll('[data-testid="assistant-user-message-time"]'),
    ).toHaveLength(2)
    expect(
      wrapper.findAll('[data-testid="assistant-feedback-controls"]'),
    ).toHaveLength(2)
    expect(
      wrapper
        .findAll('[data-testid="assistant-no-answer-message"]')
        .every(message =>
          !message.find('[data-testid="assistant-feedback-controls"]').exists(),
        ),
    ).toBe(true)
  })

  it('keeps history system safe-state messages on the fallback renderer without an assistant avatar', async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          {
            messageId: 'message-history-system',
            role: 'system',
            content: '系統已記錄本次查詢。',
            createdAt,
          } satisfies HistoryMessageSummary,
        ],
      },
    })
    mountedWrappers.push(wrapper)

    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="assistant-user-message"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('系統已記錄本次查詢。')
  })

  it('shows an accessible typing indicator before the first token', async () => {
    const wrapper = await mountSuspended(AiStreamingItem, {
      props: {
        message: createStreamingMessage(),
      },
    })
    mountedWrappers.push(wrapper)

    expect(wrapper.get('[data-testid="assistant-typing-indicator"]').text()).toContain(
      'AI 助理正在輸入',
    )
    expect(wrapper.findAll('[data-testid="assistant-typing-dot"]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="assistant-streaming-content"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="assistant-streaming-cursor"]').exists()).toBe(false)
  })

  it('replaces typing with streamed content and removes the cursor after final', async () => {
    const wrapper = await mountSuspended(AiStreamingItem, {
      props: {
        message: createStreamingMessage(),
      },
    })
    mountedWrappers.push(wrapper)

    await wrapper.setProps({
      message: createStreamingMessage({
        content: '正在整理訂單資料',
        status: 'streaming',
        lastSequence: 1,
      }),
    })

    expect(wrapper.find('[data-testid="assistant-typing-indicator"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="assistant-streaming-content"]').text()).toContain(
      '正在整理訂單資料',
    )
    expect(wrapper.find('[data-testid="assistant-streaming-cursor"]').exists()).toBe(true)

    await wrapper.setProps({
      message: createStreamingMessage({
        messageId: 'message-final',
        content: '訂單資料已整理完成。',
        status: 'completed',
        lastSequence: 2,
        finalAnswerDecision: 'answered',
      }),
    })

    expect(wrapper.find('[data-testid="assistant-streaming-cursor"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="assistant-streaming-finalized"]').text()).toContain(
      '回應已完成',
    )
  })

  it.each<AssistantStreamingStatus>([
    'cancelled',
    'failed',
    'interrupted',
  ])('does not keep typing after an empty %s terminal state', async (status) => {
    const wrapper = await mountSuspended(AiStreamingItem, {
      props: {
        message: createStreamingMessage({ status }),
      },
    })
    mountedWrappers.push(wrapper)

    expect(wrapper.find('[data-testid="assistant-typing-indicator"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="assistant-streaming-status"]').exists()).toBe(true)
  })
})
