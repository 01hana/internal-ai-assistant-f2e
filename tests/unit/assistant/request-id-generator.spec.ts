import { describe, expect, it } from 'vitest'
import { generateAssistantRequestId } from '../../../app/utils/assistant/requestIdGenerator'

describe('generateAssistantRequestId', () => {
  it('generates a non-empty request ID with the default safe prefix', () => {
    const requestId = generateAssistantRequestId()

    expect(requestId).toMatch(/^req-/)
    expect(requestId.length).toBeGreaterThan(4)
  })

  it('uses an injected UUID deterministically with a normalized prefix', () => {
    expect(generateAssistantRequestId({
      prefix: ' Assistant Request / ',
      randomUUID: () => '00000000-0000-4000-8000-000000000001',
    })).toBe(
      'Assistant-Request-00000000-0000-4000-8000-000000000001',
    )
  })

  it('falls back to timestamp and a monotonic counter without Math.random', () => {
    const options = {
      prefix: 'req',
      randomUUID: () => {
        throw new Error('Synthetic UUID unavailable')
      },
      now: () => 1_750_000_000_000,
    }

    const first = generateAssistantRequestId(options)
    const second = generateAssistantRequestId(options)

    expect(first).not.toBe(second)
    expect(first).toMatch(/^req-[a-z0-9]+-[a-z0-9]+$/)
    expect(second).toMatch(/^req-[a-z0-9]+-[a-z0-9]+$/)
  })

  it('does not accept or encode host and sensitive context', () => {
    const requestId = generateAssistantRequestId({
      prefix: 'req',
      randomUUID: () => 'synthetic-uuid',
    })

    expect(requestId).toBe('req-synthetic-uuid')
    expect(requestId).not.toContain('actor')
    expect(requestId).not.toContain('organization')
    expect(requestId).not.toContain('route')
    expect(requestId).not.toContain('token')
  })
})
