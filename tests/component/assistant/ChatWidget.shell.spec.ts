import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import ChatMessageArea from '../../../app/features/assistant/components/ChatMessageArea.vue'
import ChatWidget from '../../../app/features/assistant/components/ChatWidget.vue'
import { useChatWidgetStore } from '../../../app/stores/assistant/useChatWidgetStore'
import type { AssistantUiMessage } from '../../../app/types/assistant'

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

const mountedWrappers: VueWrapper[] = []
let originalInnerWidth = window.innerWidth

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
    originalInnerWidth = window.innerWidth
    useChatWidgetStore().reset()
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
    expect(document.activeElement).toBe(panel.element)

    await launcher.trigger('click')
    expect(launcher.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="assistant-panel"]').exists()).toBe(false)
  })

  it('closes from the close button and returns focus to the launcher', async () => {
    const wrapper = await mountWidget()
    const launcher = wrapper.get('[data-testid="assistant-launcher"]')

    await launcher.trigger('click')
    await wrapper.get('[data-testid="assistant-panel-close"]').trigger('click')

    expect(wrapper.find('[data-testid="assistant-panel"]').exists()).toBe(false)
    expect(document.activeElement).toBe(launcher.element)
  })

  it('closes with Escape and returns focus to the launcher', async () => {
    const wrapper = await mountWidget()
    const launcher = wrapper.get('[data-testid="assistant-launcher"]')

    await launcher.trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    }))
    await nextTick()

    expect(wrapper.find('[data-testid="assistant-panel"]').exists()).toBe(false)
    expect(document.activeElement).toBe(launcher.element)
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
})

describe('ChatMessageArea registry skeleton', () => {
  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount()
    }
  })

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
})
