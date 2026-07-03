import { describe, expect, it } from 'vitest'
import {
  AssistantSseParser,
  parseAssistantSseText,
} from '../../../app/utils/assistant/assistantSseParser'
import type { AssistantSseEventInput } from '../../../app/types/assistant'
import {
  answerDeltaEvent,
  approvalRequiredEvent,
  confirmationRequiredEvent,
  errorEvent,
  escalationRequiredEvent,
  evidenceAttachedEvent,
  finalAnsweredIdOnlyEvent,
  finalToolFailureEvent,
  toolCallBlockedEvent,
  toolCallCompletedEvent,
  toolCallFailedEvent,
  toolCallStartedEvent,
  unknownEvent,
} from '../../fixtures/assistant-sse/events'

function toSseFrame(
  event: AssistantSseEventInput,
  options: {
    eventName?: string | null
    id?: string
    lineEnding?: '\n' | '\r\n'
    multilineData?: boolean
    trailingBlankLine?: boolean
  } = {},
): string {
  const lineEnding = options.lineEnding ?? '\n'
  const eventName = options.eventName === undefined
    ? event.eventType
    : options.eventName
  const lines: string[] = []

  if (eventName !== null) {
    lines.push(`event: ${eventName}`)
  }

  if (options.id) {
    lines.push(`id: ${options.id}`)
  }

  const json = options.multilineData
    ? JSON.stringify(event, null, 2)
    : JSON.stringify(event)

  for (const line of json.split('\n')) {
    lines.push(`data: ${line}`)
  }

  const frame = lines.join(lineEnding)
  return options.trailingBlankLine === false
    ? frame
    : `${frame}${lineEnding}${lineEnding}`
}

const knownEvents = [
  toolCallStartedEvent,
  toolCallCompletedEvent,
  toolCallBlockedEvent,
  toolCallFailedEvent,
  evidenceAttachedEvent,
  answerDeltaEvent,
  confirmationRequiredEvent,
  approvalRequiredEvent,
  escalationRequiredEvent,
  finalAnsweredIdOnlyEvent,
  errorEvent,
] satisfies readonly AssistantSseEventInput[]

describe('AssistantSseParser', () => {
  it('parses all known event types into typed event results', () => {
    for (const expectedEvent of knownEvents) {
      const results = parseAssistantSseText(toSseFrame(expectedEvent))

      expect(results).toEqual([
        {
          kind: 'event',
          eventName: expectedEvent.eventType,
          event: expectedEvent,
        },
      ])
    }
  })

  it('parses arbitrary chunk boundaries without consuming incomplete frames', () => {
    const parser = new AssistantSseParser()
    const input = toSseFrame(finalAnsweredIdOnlyEvent)
    const results = []

    for (let index = 0; index < input.length; index += 3) {
      results.push(...parser.push(input.slice(index, index + 3)))
    }

    results.push(...parser.flush())

    expect(results).toEqual([
      {
        kind: 'event',
        eventName: 'final',
        event: finalAnsweredIdOnlyEvent,
      },
    ])
  })

  it('supports CRLF, multi-line data, event IDs, comments, and retry metadata', () => {
    const input = [
      ': heartbeat',
      'retry: 2000',
      toSseFrame(finalAnsweredIdOnlyEvent, {
        id: 'sse-event-001',
        lineEnding: '\r\n',
        multilineData: true,
      }).trimEnd(),
      '',
      '',
    ].join('\r\n')

    expect(parseAssistantSseText(input)).toEqual([
      {
        kind: 'comment',
        comment: 'heartbeat',
      },
      {
        kind: 'event',
        eventName: 'final',
        id: 'sse-event-001',
        event: finalAnsweredIdOnlyEvent,
      },
    ])
  })

  it('uses JSON eventType when the SSE event field is omitted', () => {
    expect(
      parseAssistantSseText(
        toSseFrame(answerDeltaEvent, { eventName: null }),
      ),
    ).toEqual([
      {
        kind: 'event',
        eventName: 'answer_delta',
        event: answerDeltaEvent,
      },
    ])
  })

  it('flushes a final frame without a trailing blank line', () => {
    const parser = new AssistantSseParser()

    expect(
      parser.push(
        toSseFrame(errorEvent, { trailingBlankLine: false }),
      ),
    ).toEqual([])
    expect(parser.flush()).toEqual([
      {
        kind: 'event',
        eventName: 'error',
        event: errorEvent,
      },
    ])
    expect(parser.flush()).toEqual([])
  })

  it('preserves a valid unknown event as a safe fallback', () => {
    expect(parseAssistantSseText(toSseFrame(unknownEvent))).toEqual([
      {
        kind: 'unknown_event',
        eventName: 'progress_hint',
        event: unknownEvent,
      },
    ])
  })

  it.each([
    {
      title: 'event name mismatch',
      input: toSseFrame(answerDeltaEvent, { eventName: 'final' }),
      errorCode: 'invalid_shape',
    },
    {
      title: 'invalid JSON',
      input: 'event: final\ndata: {not-json}\n\n',
      errorCode: 'invalid_json',
    },
    {
      title: 'primitive JSON',
      input: 'event: final\ndata: "not-an-envelope"\n\n',
      errorCode: 'invalid_shape',
    },
    {
      title: 'missing data',
      input: 'event: answer_delta\ndata: {"eventType":"answer_delta"}\n\n',
      errorCode: 'invalid_shape',
    },
    {
      title: 'final without answerDecision',
      input: toSseFrame({
        ...finalAnsweredIdOnlyEvent,
        data: {
          evidenceRefs: [],
        },
      }),
      errorCode: 'invalid_shape',
    },
  ])('returns a malformed result for $title', ({ input, errorCode }) => {
    const [result] = parseAssistantSseText(input)

    expect(result).toMatchObject({
      kind: 'malformed_event',
      errorCode,
    })
  })

  it('ignores duplicate and out-of-order sequences per correlation key', () => {
    const parser = new AssistantSseParser()
    const sequenceTwo = {
      ...answerDeltaEvent,
      sequence: 2,
    }
    const sequenceOne = {
      ...answerDeltaEvent,
      sequence: 1,
    }

    expect(parser.push(toSseFrame(sequenceTwo))).toEqual([
      {
        kind: 'event',
        eventName: 'answer_delta',
        event: sequenceTwo,
      },
    ])
    expect(parser.push(toSseFrame(sequenceTwo))).toEqual([
      {
        kind: 'ignored_event',
        reason: 'duplicate_sequence',
        eventName: 'answer_delta',
        event: sequenceTwo,
      },
    ])
    expect(parser.push(toSseFrame(sequenceOne))).toEqual([
      {
        kind: 'ignored_event',
        reason: 'out_of_order_sequence',
        eventName: 'answer_delta',
        event: sequenceOne,
      },
    ])
  })

  it('tracks sequences independently for different messages', () => {
    const parser = new AssistantSseParser()

    expect(parser.push(toSseFrame(toolCallStartedEvent))[0]?.kind).toBe('event')
    expect(parser.push(toSseFrame(toolCallBlockedEvent))[0]?.kind).toBe('event')
  })

  it('only accepts final.data.answerDecision as a final result', () => {
    const inputs = [
      answerDeltaEvent,
      toolCallFailedEvent,
      errorEvent,
      finalToolFailureEvent,
    ]
    const results = parseAssistantSseText(
      inputs.map(event => toSseFrame(event)).join(''),
    )
    const acceptedEvents = results
      .filter(result => result.kind === 'event')
      .map(result => result.event)

    expect(
      acceptedEvents.filter(event => event.eventType === 'final'),
    ).toEqual([finalToolFailureEvent])
    expect(finalToolFailureEvent.data).toMatchObject({
      answerDecision: 'no_answer',
      noAnswerReason: 'tool_failure',
    })
  })

  it('does not accept tool_failure or tool_failed as final decisions', () => {
    for (const answerDecision of ['tool_failure', 'tool_failed']) {
      const invalidFinal = {
        ...finalAnsweredIdOnlyEvent,
        data: {
          answerDecision,
          evidenceRefs: [],
        },
      }
      const [result] = parseAssistantSseText(toSseFrame(invalidFinal))

      expect(result).toMatchObject({
        kind: 'malformed_event',
        eventName: 'final',
        errorCode: 'invalid_shape',
      })
    }
  })

  it('resets buffered frames and sequence state', () => {
    const parser = new AssistantSseParser()

    parser.push('event: final\ndata: {"incomplete":')
    parser.push(toSseFrame(answerDeltaEvent))
    parser.reset()

    expect(parser.flush()).toEqual([])
    expect(parser.push(toSseFrame(answerDeltaEvent))[0]?.kind).toBe('event')
  })
})
