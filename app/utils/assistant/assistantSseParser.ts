import type {
  AnswerDecisionStatus,
  AssistantKnownSseEventType,
  AssistantSseEvent,
  AssistantSseEventInput,
  AssistantUnknownSseEvent,
  NoAnswerReason,
} from '../../types/assistant'

export type AssistantSseMalformedEventErrorCode =
  | 'invalid_json'
  | 'invalid_shape'

export type AssistantSseIgnoredEventReason =
  | 'duplicate_sequence'
  | 'out_of_order_sequence'

export interface AssistantSseEventResult {
  kind: 'event'
  eventName: AssistantKnownSseEventType
  event: AssistantSseEvent
  id?: string
}

export interface AssistantSseUnknownEventResult {
  kind: 'unknown_event'
  eventName: string
  event: AssistantUnknownSseEvent
  id?: string
}

export interface AssistantSseMalformedEventResult {
  kind: 'malformed_event'
  eventName?: string
  rawData: string
  errorCode: AssistantSseMalformedEventErrorCode
  id?: string
}

export interface AssistantSseIgnoredEventResult {
  kind: 'ignored_event'
  reason: AssistantSseIgnoredEventReason
  eventName: string
  event: AssistantSseEventInput
  id?: string
}

export interface AssistantSseCommentResult {
  kind: 'comment'
  comment: string
}

export type AssistantSseParseResult =
  | AssistantSseEventResult
  | AssistantSseUnknownEventResult
  | AssistantSseMalformedEventResult
  | AssistantSseIgnoredEventResult
  | AssistantSseCommentResult

interface AssistantSseFrame {
  eventName?: string
  id?: string
  dataLines: string[]
}

interface LineEnding {
  index: number
  length: number
}

const knownEventTypes = new Set<AssistantKnownSseEventType>([
  'tool_call_started',
  'tool_call_completed',
  'tool_call_blocked',
  'tool_call_failed',
  'evidence_attached',
  'answer_delta',
  'confirmation_required',
  'approval_required',
  'escalation_required',
  'final',
  'error',
])

const answerDecisionStatuses = new Set<AnswerDecisionStatus>([
  'answered',
  'clarification_required',
  'no_answer',
  'confirmation_required',
  'approval_required',
  'escalation_required',
  'permission_denied',
])

const noAnswerReasons = new Set<NoAnswerReason>([
  'no_evidence',
  'tool_failure',
  'permission_denied',
  'evidence_conflict',
  'ambiguous_query',
  'low_confidence',
  'missing_page_context',
  'unsupported_scope',
])

function createEmptyFrame(): AssistantSseFrame {
  return {
    dataLines: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function hasRequiredStrings(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return keys.every(key => isNonEmptyString(value[key]))
}

function isOptionalStringOrNull(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string'
}

function isEvidenceRefs(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false
  }

  if (value.every(item => typeof item === 'string')) {
    return true
  }

  return value.every((item) => {
    if (
      !isRecord(item)
      || !isNonEmptyString(item.id)
      || (item.sourceType !== 'structured_record'
        && item.sourceType !== 'document_chunk')
    ) {
      return false
    }

    return [
      item.sourceId,
      item.toolCallId,
      item.title,
      item.snippet,
    ].every(isOptionalStringOrNull)
  })
}

function isCommonEnvelope(
  value: unknown,
): value is AssistantUnknownSseEvent {
  return isRecord(value)
    && hasRequiredStrings(value, [
      'requestId',
      'sessionId',
      'messageId',
      'eventType',
    ])
    && Number.isInteger(value.sequence)
    && Number(value.sequence) >= 0
    && isRecord(value.data)
}

function isToolCallStartedData(data: Record<string, unknown>): boolean {
  return hasRequiredStrings(data, ['toolCallId', 'toolName'])
}

function isToolCallCompletedData(data: Record<string, unknown>): boolean {
  return hasRequiredStrings(data, [
    'toolCallId',
    'toolName',
    'status',
    'executionStatus',
  ])
}

function isToolCallBlockedData(data: Record<string, unknown>): boolean {
  return isToolCallCompletedData(data)
    && isOptionalStringOrNull(data.deniedReason)
}

function isToolCallFailedData(data: Record<string, unknown>): boolean {
  return isToolCallCompletedData(data)
    && isOptionalStringOrNull(data.errorCode)
}

function isEvidenceAttachedData(data: Record<string, unknown>): boolean {
  return Array.isArray(data.evidenceRefs)
    && data.evidenceRefs.every(item => typeof item === 'string')
}

function isAnswerDeltaData(data: Record<string, unknown>): boolean {
  return typeof data.delta === 'string'
}

function isConfirmationRequiredData(data: Record<string, unknown>): boolean {
  return hasRequiredStrings(data, [
    'actionDraftId',
    'requestId',
    'messageId',
    'riskLevel',
  ])
}

function isApprovalRequiredData(data: Record<string, unknown>): boolean {
  return hasRequiredStrings(data, [
    'approvalRequestId',
    'requestId',
    'messageId',
    'riskLevel',
  ])
}

function isEscalationRequiredData(data: Record<string, unknown>): boolean {
  return hasRequiredStrings(data, [
    'escalationRequestId',
    'requestId',
    'messageId',
    'riskLevel',
  ])
}

function isFinalData(data: Record<string, unknown>): boolean {
  if (
    !isNonEmptyString(data.answerDecision)
    || !answerDecisionStatuses.has(data.answerDecision as AnswerDecisionStatus)
    || !isEvidenceRefs(data.evidenceRefs)
  ) {
    return false
  }

  if (
    data.noAnswerReason !== undefined
    && (
      !isNonEmptyString(data.noAnswerReason)
      || !noAnswerReasons.has(data.noAnswerReason as NoAnswerReason)
    )
  ) {
    return false
  }

  return data.noAnswerReason !== 'tool_failure'
    || data.answerDecision === 'no_answer'
}

function isErrorData(data: Record<string, unknown>): boolean {
  return hasRequiredStrings(data, ['code', 'message'])
}

function isKnownEvent(value: AssistantUnknownSseEvent): value is AssistantSseEvent {
  const data = value.data

  if (!isRecord(data) || !knownEventTypes.has(
    value.eventType as AssistantKnownSseEventType,
  )) {
    return false
  }

  switch (value.eventType) {
    case 'tool_call_started':
      return isToolCallStartedData(data)
    case 'tool_call_completed':
      return isToolCallCompletedData(data)
    case 'tool_call_blocked':
      return isToolCallBlockedData(data)
    case 'tool_call_failed':
      return isToolCallFailedData(data)
    case 'evidence_attached':
      return isEvidenceAttachedData(data)
    case 'answer_delta':
      return isAnswerDeltaData(data)
    case 'confirmation_required':
      return isConfirmationRequiredData(data)
    case 'approval_required':
      return isApprovalRequiredData(data)
    case 'escalation_required':
      return isEscalationRequiredData(data)
    case 'final':
      return isFinalData(data)
    case 'error':
      return isErrorData(data)
    default:
      return false
  }
}

function findLineEnding(value: string): LineEnding | null {
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]

    if (character === '\n') {
      return { index, length: 1 }
    }

    if (character === '\r') {
      if (index === value.length - 1) {
        return null
      }

      return {
        index,
        length: value[index + 1] === '\n' ? 2 : 1,
      }
    }
  }

  return null
}

function parseField(line: string): { field: string, value: string } {
  const separatorIndex = line.indexOf(':')

  if (separatorIndex < 0) {
    return {
      field: line,
      value: '',
    }
  }

  const rawValue = line.slice(separatorIndex + 1)
  return {
    field: line.slice(0, separatorIndex),
    value: rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue,
  }
}

function correlationKey(event: AssistantSseEventInput): string {
  return JSON.stringify([
    event.requestId,
    event.sessionId,
    event.messageId,
  ])
}

export class AssistantSseParser {
  private buffer = ''
  private frame = createEmptyFrame()
  private readonly lastSequenceByCorrelation = new Map<string, number>()

  push(chunk: string): AssistantSseParseResult[] {
    if (chunk.length === 0) {
      return []
    }

    this.buffer += chunk
    const results: AssistantSseParseResult[] = []

    while (true) {
      const lineEnding = findLineEnding(this.buffer)
      if (!lineEnding) {
        break
      }

      const line = this.buffer.slice(0, lineEnding.index)
      this.buffer = this.buffer.slice(lineEnding.index + lineEnding.length)
      results.push(...this.processLine(line))
    }

    return results
  }

  flush(): AssistantSseParseResult[] {
    const results: AssistantSseParseResult[] = []

    if (this.buffer.length > 0) {
      const line = this.buffer.endsWith('\r')
        ? this.buffer.slice(0, -1)
        : this.buffer
      this.buffer = ''
      results.push(...this.processLine(line))
    }

    results.push(...this.dispatchFrame())
    return results
  }

  reset(): void {
    this.buffer = ''
    this.frame = createEmptyFrame()
    this.lastSequenceByCorrelation.clear()
  }

  private processLine(line: string): AssistantSseParseResult[] {
    if (line.length === 0) {
      return this.dispatchFrame()
    }

    if (line.startsWith(':')) {
      const comment = line.slice(1)
      return [{
        kind: 'comment',
        comment: comment.startsWith(' ') ? comment.slice(1) : comment,
      }]
    }

    const { field, value } = parseField(line)

    switch (field) {
      case 'event':
        this.frame.eventName = value
        break
      case 'data':
        this.frame.dataLines.push(value)
        break
      case 'id':
        if (!value.includes('\0')) {
          this.frame.id = value
        }
        break
      default:
        break
    }

    return []
  }

  private dispatchFrame(): AssistantSseParseResult[] {
    const frame = this.frame
    this.frame = createEmptyFrame()

    if (frame.dataLines.length === 0) {
      return []
    }

    const rawData = frame.dataLines.join('\n')
    let parsed: unknown

    try {
      parsed = JSON.parse(rawData)
    }
    catch {
      return [{
        kind: 'malformed_event',
        eventName: frame.eventName,
        rawData,
        errorCode: 'invalid_json',
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }]
    }

    if (!isCommonEnvelope(parsed)) {
      return [{
        kind: 'malformed_event',
        eventName: frame.eventName,
        rawData,
        errorCode: 'invalid_shape',
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }]
    }

    const eventName = frame.eventName || parsed.eventType
    if (eventName !== parsed.eventType) {
      return [{
        kind: 'malformed_event',
        eventName,
        rawData,
        errorCode: 'invalid_shape',
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }]
    }

    const isKnownType = knownEventTypes.has(
      parsed.eventType as AssistantKnownSseEventType,
    )
    if (isKnownType && !isKnownEvent(parsed)) {
      return [{
        kind: 'malformed_event',
        eventName,
        rawData,
        errorCode: 'invalid_shape',
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }]
    }

    const ignoredReason = this.getIgnoredReason(parsed)
    if (ignoredReason) {
      return [{
        kind: 'ignored_event',
        reason: ignoredReason,
        eventName,
        event: parsed,
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }]
    }

    this.lastSequenceByCorrelation.set(
      correlationKey(parsed),
      parsed.sequence,
    )

    if (isKnownType) {
      return [{
        kind: 'event',
        eventName: parsed.eventType as AssistantKnownSseEventType,
        event: parsed as AssistantSseEvent,
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }]
    }

    return [{
      kind: 'unknown_event',
      eventName,
      event: parsed,
      ...(frame.id === undefined ? {} : { id: frame.id }),
    }]
  }

  private getIgnoredReason(
    event: AssistantSseEventInput,
  ): AssistantSseIgnoredEventReason | null {
    const previousSequence = this.lastSequenceByCorrelation.get(
      correlationKey(event),
    )

    if (previousSequence === undefined) {
      return null
    }

    if (event.sequence === previousSequence) {
      return 'duplicate_sequence'
    }

    return event.sequence < previousSequence
      ? 'out_of_order_sequence'
      : null
  }
}

export function parseAssistantSseText(
  input: string,
): AssistantSseParseResult[] {
  const parser = new AssistantSseParser()
  return [
    ...parser.push(input),
    ...parser.flush(),
  ]
}
