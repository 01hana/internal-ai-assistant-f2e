import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ChatWidget from '../../../app/features/assistant/components/ChatWidget.vue'
import { useAssistantSessionStore } from '../../../app/stores/assistant/useSessionStore'
import { useChatWidgetStore } from '../../../app/stores/assistant/useChatWidgetStore'
import type {
  ApprovalRequestDetailState,
  AssistantHostContextProvider,
  AssistantHostContextSnapshot,
} from '../../../app/types/assistant'

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

const chatWidgetSourcePath = resolve(
  process.cwd(),
  'app/features/assistant/components/ChatWidget.vue',
)
const chatPanelSourcePath = resolve(
  process.cwd(),
  'app/features/assistant/components/ChatPanel.vue',
)

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
    expect(wrapper.get('[data-testid="assistant-chat-input"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-chat-submit"]').exists()).toBe(true)

    const liveRegion = wrapper.get('[data-testid="assistant-panel-status"]')
    expect(liveRegion.text()).toContain('目前頁面內容尚未就緒')
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
    expect(wrapper.get('[data-testid="assistant-panel-main"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-message-area"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-panel-footer"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-chat-input"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-chat-submit"]').exists()).toBe(true)
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

  it('uses the Frontend 001 product panel as the active UI renderer', () => {
    const source = readFileSync(chatWidgetSourcePath, 'utf8')
    const panelSource = readFileSync(chatPanelSourcePath, 'utf8')

    expect(source).toContain('<ChatPanel')
    expect(source).toContain('<UButton')
    expect(source).toContain('<UIcon')
    expect(source).not.toContain('AssistantProductIcon')
    expect(source).not.toContain('AssistantProductRuntimePanel')
    expect(source).not.toContain('AssistantProductPanelShell')
    expect(source).not.toContain('AssistantRuntimeRoot')
    expect(source).not.toContain('FRONTEND001_RUNTIME_SCOPE')
    expect(source).not.toContain('AssistantService')
    expect(source).not.toMatch(/createAssistantSseStreamRunner|parseAssistantSse|ReadableStream|AbortController/)
    expect(panelSource).toContain('<ChatMessageArea')
    expect(panelSource).toContain('<ChatInputBar')
    expect(panelSource).not.toContain('AssistantProductRuntimePanel')
    expect(panelSource).not.toContain('AssistantProductPanelShell')
  })

  it('keeps Frontend 001 product selectors active in the ChatWidget path', async () => {
    const wrapper = await mountWidget()

    await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')

    expect(wrapper.get('[data-testid="assistant-message-area"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-panel-footer"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-chat-input"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-chat-submit"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assistant-panel-restart"]').attributes('aria-label')).toBe('重新開始助理對話')
    expect(wrapper.get('[data-testid="assistant-panel-close"]').attributes('aria-label')).toBe('關閉助理面板')
    expect(wrapper.get('[data-testid="assistant-launcher"]').attributes('aria-controls')).toBe('assistant-chat-panel')
    expect(wrapper.find('[data-testid="assistant-runtime-root"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="assistant-product-runtime-panel"]').exists()).toBe(false)
  })

  it('forwards open approval detail events to the host callback when available', async () => {
    const onOpenApprovalDetail = vi.fn()
    const wrapper = await mountWidget({
      hostContextProvider: createApprovalHostProvider(onOpenApprovalDetail),
    })
    const sessionStore = useAssistantSessionStore()

    await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')
    await flushPromises()
    sessionStore.setReady()
    sessionStore.setContextReady(true)
    sessionStore.setMessages([approvalMessage], null)
    sessionStore.runtimeController.upsertApprovalRequestState(
      'approval-request-shell-001',
      approvalRequestState,
    )
    await nextTick()
    await wrapper.get('[data-testid="assistant-approval-request-open-detail"]').trigger('click')
    await flushPromises()

    expect(onOpenApprovalDetail).toHaveBeenCalledWith({
      approvalRequestId: 'approval-request-shell-001',
      requestId: 'req-approval-shell-001',
      messageId: 'message-approval-shell-001',
      sessionId: 'session-shell-001',
    })
  })

  it('keeps approval detail open actions safe when the host callback is missing', async () => {
    const wrapper = await mountWidget({
      hostContextProvider: createApprovalHostProvider(),
    })
    const sessionStore = useAssistantSessionStore()

    await wrapper.get('[data-testid="assistant-launcher"]').trigger('click')
    await flushPromises()
    sessionStore.setReady()
    sessionStore.setContextReady(true)
    sessionStore.setMessages([approvalMessage], null)
    sessionStore.runtimeController.upsertApprovalRequestState(
      'approval-request-shell-001',
      approvalRequestState,
    )
    await nextTick()
    await wrapper.get('[data-testid="assistant-approval-request-open-detail"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(
      wrapper.get('[data-testid="assistant-approval-request-open-detail-unavailable"]').text(),
    ).toContain('尚未提供審核詳情入口')
  })
})
