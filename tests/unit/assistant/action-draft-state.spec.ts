import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAssistantSessionStore } from '../../../app/stores/assistant/useSessionStore'
import type { ActionDraftDetail } from '../../../app/types/assistant'

function createActionDraftDetail(
  overrides: Partial<ActionDraftDetail> = {},
): ActionDraftDetail {
  return {
    actionDraftId: 'action-draft-001',
    requestId: 'req-action-draft-001',
    messageId: 'message-action-draft-001',
    status: 'waiting_confirmation',
    riskLevel: 'medium',
    toolName: 'mock.orders.status.update',
    resource: 'orders',
    operation: 'update',
    preview: {
      targetEntityId: 'SO-10001',
    },
    expiresAt: '2026-07-09T10:15:00.000Z',
    ...overrides,
  }
}

function loadActionDraftDetail(
  store: ReturnType<typeof useAssistantSessionStore>,
  detail: ActionDraftDetail,
) {
  store.startActionDraftDetailLoad(detail.actionDraftId, {
    messageId: detail.messageId,
    requestId: detail.requestId,
  })
  store.completeActionDraftDetailLoad(detail)
}

describe('useAssistantSessionStore action draft state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('provides a default action draft state', () => {
    const store = useAssistantSessionStore()

    expect(store.getActionDraftState('action-draft-001')).toEqual({
      actionDraftId: 'action-draft-001',
      operationStatus: 'idle',
      detailStatus: 'idle',
      idempotencyKey: null,
    })
  })

  it('loads detail successfully and records linkage', () => {
    const store = useAssistantSessionStore()

    store.startActionDraftDetailLoad('action-draft-001', {
      messageId: 'message-action-draft-001',
      requestId: 'req-action-draft-001',
    })
    loadActionDraftDetail(store, createActionDraftDetail())

    expect(store.getActionDraftState('action-draft-001')).toMatchObject({
      detailStatus: 'available',
      requestId: 'req-action-draft-001',
      messageId: 'message-action-draft-001',
      actionDraftStatus: 'waiting_confirmation',
      detail: createActionDraftDetail(),
    })
  })

  it('marks detail load failures as unavailable', () => {
    const store = useAssistantSessionStore()

    store.startActionDraftDetailLoad('action-draft-001')
    store.failActionDraftDetailLoad(
      'action-draft-001',
      '目前無法載入確認內容，請稍後再試。',
    )

    expect(store.getActionDraftState('action-draft-001')).toMatchObject({
      detailStatus: 'unavailable',
      safeMessage: '目前無法載入確認內容，請稍後再試。',
    })
  })

  it('tracks confirm start and pending_execution_guard completion safely', () => {
    const store = useAssistantSessionStore()

    loadActionDraftDetail(store, createActionDraftDetail())
    store.setActionDraftOperationStatus('action-draft-001', 'confirming', {
      idempotencyKey: 'confirm-001',
    })
    store.completeActionDraftOperation('action-draft-001', 'confirmed', {
      idempotencyKey: 'confirm-001',
      recheck: {
        organizationBoundary: 'passed',
        draftStatus: 'passed',
        freshness: 'passed',
        permission: 'pending_execution_guard',
        toolContract: 'pending_execution_guard',
        idempotency: 'reserved',
      },
    })

    expect(store.getActionDraftState('action-draft-001')).toMatchObject({
      operationStatus: 'pending_execution_guard',
      actionDraftStatus: 'confirmed',
      idempotencyKey: 'confirm-001',
      safeMessage: '已送出確認，系統仍在處理，請勿重複操作。',
    })
  })

  it('maps executed and cancelled results into terminal-safe statuses', () => {
    const store = useAssistantSessionStore()

    loadActionDraftDetail(store, createActionDraftDetail())
    store.setActionDraftOperationStatus('action-draft-001', 'confirming', {
      idempotencyKey: 'confirm-002',
    })
    store.completeActionDraftOperation('action-draft-001', 'executed', {
      idempotencyKey: 'confirm-002',
    })
    expect(store.getActionDraftState('action-draft-001')).toMatchObject({
      operationStatus: 'executed',
      actionDraftStatus: 'executed',
    })

    loadActionDraftDetail(
      store,
      createActionDraftDetail({ actionDraftId: 'action-draft-002', messageId: 'message-action-draft-002' }),
    )
    store.setActionDraftOperationStatus('action-draft-002', 'cancelling', {
      idempotencyKey: 'cancel-002',
    })
    store.completeActionDraftOperation('action-draft-002', 'cancelled', {
      idempotencyKey: 'cancel-002',
    })
    expect(store.getActionDraftState('action-draft-002')).toMatchObject({
      operationStatus: 'cancelled',
      actionDraftStatus: 'cancelled',
    })
  })

  it('records retryable failures without clearing detail', () => {
    const store = useAssistantSessionStore()

    loadActionDraftDetail(store, createActionDraftDetail())
    store.setActionDraftOperationStatus('action-draft-001', 'confirming', {
      idempotencyKey: 'confirm-003',
    })
    store.failActionDraftOperation(
      'action-draft-001',
      '目前無法送出確認，請稍後再試。',
      'failed',
      { idempotencyKey: 'confirm-003' },
    )

    expect(store.getActionDraftState('action-draft-001')).toMatchObject({
      operationStatus: 'failed',
      safeMessage: '目前無法送出確認，請稍後再試。',
      detailStatus: 'available',
    })
  })

  it('keeps multiple action drafts independent', () => {
    const store = useAssistantSessionStore()

    loadActionDraftDetail(store, createActionDraftDetail())
    loadActionDraftDetail(
      store,
      createActionDraftDetail({
        actionDraftId: 'action-draft-002',
        messageId: 'message-action-draft-002',
      }),
    )
    store.setActionDraftOperationStatus('action-draft-001', 'confirming', {
      idempotencyKey: 'confirm-004',
    })
    store.setActionDraftOperationStatus('action-draft-002', 'cancelling')

    expect(store.getActionDraftState('action-draft-001')).toMatchObject({
      operationStatus: 'confirming',
    })
    expect(store.getActionDraftState('action-draft-002')).toMatchObject({
      operationStatus: 'cancelling',
    })
  })

  it('clears action draft state on reset', () => {
    const store = useAssistantSessionStore()

    loadActionDraftDetail(store, createActionDraftDetail())
    store.setActionDraftOperationStatus('action-draft-001', 'confirming', {
      idempotencyKey: 'confirm-005',
    })
    store.resetSessionState()

    expect(store.actionDraftById).toEqual({})
    expect(store.getActionDraftState('action-draft-001')).toEqual({
      actionDraftId: 'action-draft-001',
      operationStatus: 'idle',
      detailStatus: 'idle',
      idempotencyKey: null,
    })
  })
})
