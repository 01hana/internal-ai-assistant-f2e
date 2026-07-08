import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import FeedbackControls from '../../../app/features/assistant/components/FeedbackControls.vue'

const mountedWrappers: VueWrapper[] = []

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount()
  }
  document.body.innerHTML = ''
})

describe('FeedbackControls', () => {
  it('renders helpful and not-helpful icon buttons and emits selection events', async () => {
    const wrapper = await mountSuspended(FeedbackControls)
    mountedWrappers.push(wrapper)

    const helpful = wrapper.get('[data-testid="assistant-feedback-helpful"]')
    const notHelpful = wrapper.get('[data-testid="assistant-feedback-not-helpful"]')

    expect(wrapper.get('[data-testid="assistant-feedback-controls"]').exists()).toBe(true)
    expect(
      helpful.attributes('aria-label') ?? helpful.attributes('title'),
    ).toContain('有幫助')
    expect(
      notHelpful.attributes('aria-label') ?? notHelpful.attributes('title'),
    ).toContain('沒有幫助')

    await helpful.trigger('click')
    await notHelpful.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([
      ['helpful'],
      ['not_helpful'],
    ])
    expect(wrapper.emitted('submit')).toEqual([
      ['helpful'],
      ['not_helpful'],
    ])
  })

  it('reflects selected, pending, disabled, and error states safely', async () => {
    const wrapper = await mountSuspended(FeedbackControls, {
      props: {
        modelValue: 'helpful',
        pending: true,
        error: '回饋暫時無法送出',
      },
    })
    mountedWrappers.push(wrapper)

    const helpful = wrapper.get('[data-testid="assistant-feedback-helpful"]')
    const notHelpful = wrapper.get('[data-testid="assistant-feedback-not-helpful"]')

    expect(wrapper.get('[data-testid="assistant-feedback-controls"]').attributes('aria-busy')).toBe('true')
    expect(helpful.attributes('aria-pressed')).toBe('true')
    expect(notHelpful.attributes('aria-pressed')).toBe('false')
    expect(helpful.attributes('disabled')).toBeDefined()
    expect(notHelpful.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="assistant-feedback-error"]').text()).toContain('回饋暫時無法送出')
  })

  it('does not emit while disabled', async () => {
    const wrapper = await mountSuspended(FeedbackControls, {
      props: {
        disabled: true,
      },
    })
    mountedWrappers.push(wrapper)

    await wrapper.get('[data-testid="assistant-feedback-helpful"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
