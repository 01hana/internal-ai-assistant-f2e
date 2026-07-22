import type {
  AnswerDecisionStatus,
  AssistantKnownSseEventType,
  AssistantSseEvent,
  AssistantSseEventInput,
  AssistantUnknownSseEvent,
  NoAnswerReason,
} from "../types";

export type AssistantSseMalformedEventErrorCode =
  | "invalid_json"
  | "invalid_shape";

export type AssistantSseIgnoredEventReason =
  | "duplicate_sequence"
  | "out_of_order_sequence";

export interface AssistantSseEventResult {
  kind: "event";
  eventName: AssistantKnownSseEventType;
  event: AssistantSseEvent;
  id?: string;
}

export interface AssistantSseUnknownEventResult {
  kind: "unknown_event";
  eventName: string;
  event: AssistantUnknownSseEvent;
  id?: string;
}

export interface AssistantSseMalformedEventResult {
  kind: "malformed_event";
  eventName?: string;
  rawData: string;
  errorCode: AssistantSseMalformedEventErrorCode;
  id?: string;
}

export interface AssistantSseIgnoredEventResult {
  kind: "ignored_event";
  reason: AssistantSseIgnoredEventReason;
  eventName: string;
  event: AssistantSseEventInput;
  id?: string;
}

export interface AssistantSseCommentResult {
  kind: "comment";
  comment: string;
}

export type AssistantSseParseResult =
  | AssistantSseEventResult
  | AssistantSseUnknownEventResult
  | AssistantSseMalformedEventResult
  | AssistantSseIgnoredEventResult
  | AssistantSseCommentResult;

export type AssistantSseStreamTerminalReason =
  | "completed"
  | "timeout"
  | "interrupted";

export type AssistantSseStreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "completed"
  | "interrupted"
  | "timeout"
  | "aborted"
  | "error";

export interface AssistantSseStreamSafeError {
  code:
    | "stream_transport_error"
    | "missing_stream_body"
    | "stream_read_error"
    | "stream_decode_error"
    | "stream_interrupted"
    | "stream_timeout"
    | "callback_error";
  safeMessage: string;
}

export type AssistantFinalSseEvent = Extract<
  AssistantSseEvent,
  { eventType: "final" }
>;

export type AssistantErrorSseEvent = Extract<
  AssistantSseEvent,
  { eventType: "error" }
>;

export interface AssistantSseStreamCallbacks {
  onResult?: (result: AssistantSseParseResult) => void;
  onEvent?: (event: AssistantSseEvent) => void;
  onUnknownEvent?: (result: AssistantSseUnknownEventResult) => void;
  onMalformedEvent?: (result: AssistantSseMalformedEventResult) => void;
  onIgnoredEvent?: (result: AssistantSseIgnoredEventResult) => void;
  onFinal?: (event: AssistantFinalSseEvent) => void;
  onErrorEvent?: (event: AssistantErrorSseEvent) => void;
  onTransportError?: (error: AssistantSseStreamSafeError) => void;
  onInterrupted?: (error: AssistantSseStreamSafeError) => void;
  onTimeout?: (error: AssistantSseStreamSafeError) => void;
  onComplete?: () => void;
  onAbort?: () => void;
}

export interface AssistantSseStreamStateCallbacks {
  onStatusChange?: (status: AssistantSseStreamStatus) => void;
  onErrorChange?: (error: AssistantSseStreamSafeError | null) => void;
  onFinalEventChange?: (event: AssistantFinalSseEvent | null) => void;
  onLastEventChange?: (event: AssistantSseEvent | null) => void;
  onResultsChange?: (results: readonly AssistantSseParseResult[]) => void;
}

export interface AssistantSseStreamRunnerStartOptions {
  externalSignal?: AbortSignal;
}

export interface AssistantSseStreamRunnerOptions<TInput> {
  openStream: (
    input: TInput,
    options: { signal: AbortSignal },
  ) => Promise<ReadableStream<Uint8Array> | null>;
  createParser?: () => AssistantSseParser;
  createTextDecoder?: () => TextDecoder;
  inactivityTimeoutMs?: number;
  callbacks?: AssistantSseStreamCallbacks;
  state?: AssistantSseStreamStateCallbacks;
}

export interface AssistantSseStreamRunner<TInput> {
  start(input: TInput, options?: AssistantSseStreamRunnerStartOptions): Promise<void>;
  cancel(): Promise<void>;
  reset(): Promise<void>;
  getStatus(): AssistantSseStreamStatus;
  getResults(): readonly AssistantSseParseResult[];
}

interface AssistantSseFrame {
  eventName?: string;
  id?: string;
  dataLines: string[];
}

interface ActiveAssistantSseRun {
  id: number;
  controller: AbortController;
  parser: AssistantSseParser;
  decoder: TextDecoder;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
  externalSignal: AbortSignal | null;
  externalAbortHandler: (() => void) | null;
  terminal: boolean;
  aborted: boolean;
  timedOut: boolean;
}

interface LineEnding {
  index: number;
  length: number;
}

const knownEventTypes = new Set<AssistantKnownSseEventType>([
  "tool_call_started",
  "tool_call_completed",
  "tool_call_blocked",
  "tool_call_failed",
  "evidence_attached",
  "answer_delta",
  "confirmation_required",
  "approval_required",
  "escalation_required",
  "final",
  "error",
]);

const answerDecisionStatuses = new Set<AnswerDecisionStatus>([
  "answered",
  "clarification_required",
  "no_answer",
  "confirmation_required",
  "approval_required",
  "escalation_required",
  "permission_denied",
]);

const noAnswerReasons = new Set<NoAnswerReason>([
  "no_evidence",
  "tool_failure",
  "permission_denied",
  "evidence_conflict",
  "ambiguous_query",
  "low_confidence",
  "missing_page_context",
  "unsupported_scope",
]);

const DEFAULT_INACTIVITY_TIMEOUT_MS = 60_000;

export const assistantSseStreamSafeErrors = {
  streamTransport: {
    code: "stream_transport_error",
    safeMessage: "The assistant stream could not be started.",
  },
  missingBody: {
    code: "missing_stream_body",
    safeMessage: "The assistant stream did not include a readable body.",
  },
  streamRead: {
    code: "stream_read_error",
    safeMessage: "The assistant stream could not be read.",
  },
  streamDecode: {
    code: "stream_decode_error",
    safeMessage: "The assistant stream could not be decoded.",
  },
  interrupted: {
    code: "stream_interrupted",
    safeMessage: "The assistant stream ended before a final result.",
  },
  timeout: {
    code: "stream_timeout",
    safeMessage: "The assistant stream timed out before a final result.",
  },
  callback: {
    code: "callback_error",
    safeMessage: "A stream callback could not be completed.",
  },
} as const satisfies Record<string, AssistantSseStreamSafeError>;

function createEmptyFrame(): AssistantSseFrame {
  return { dataLines: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasRequiredStrings(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return keys.every(key => isNonEmptyString(value[key]));
}

function isOptionalStringOrNull(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isEvidenceRefs(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  if (value.every(item => typeof item === "string")) {
    return true;
  }

  return value.every((item) => {
    if (
      !isRecord(item)
      || !isNonEmptyString(item.id)
      || (item.sourceType !== "structured_record"
        && item.sourceType !== "document_chunk")
    ) {
      return false;
    }

    return [
      item.sourceId,
      item.toolCallId,
      item.title,
      item.snippet,
    ].every(isOptionalStringOrNull);
  });
}

function isCommonEnvelope(value: unknown): value is AssistantUnknownSseEvent {
  return isRecord(value)
    && hasRequiredStrings(value, [
      "requestId",
      "sessionId",
      "messageId",
      "eventType",
    ])
    && Number.isInteger(value.sequence)
    && Number(value.sequence) >= 0
    && isRecord(value.data);
}

function isKnownEvent(value: AssistantUnknownSseEvent): value is AssistantSseEvent {
  const data = value.data;

  if (!isRecord(data) || !knownEventTypes.has(
    value.eventType as AssistantKnownSseEventType,
  )) {
    return false;
  }

  switch (value.eventType) {
    case "tool_call_started":
      return hasRequiredStrings(data, ["toolCallId", "toolName"]);
    case "tool_call_completed":
      return hasRequiredStrings(data, ["toolCallId", "toolName", "status", "executionStatus"]);
    case "tool_call_blocked":
      return hasRequiredStrings(data, ["toolCallId", "toolName", "status", "executionStatus"])
        && isOptionalStringOrNull(data.deniedReason);
    case "tool_call_failed":
      return hasRequiredStrings(data, ["toolCallId", "toolName", "status", "executionStatus"])
        && isOptionalStringOrNull(data.errorCode);
    case "evidence_attached":
      return Array.isArray(data.evidenceRefs)
        && data.evidenceRefs.every(item => typeof item === "string");
    case "answer_delta":
      return typeof data.delta === "string";
    case "confirmation_required":
      return hasRequiredStrings(data, ["actionDraftId", "requestId", "messageId", "riskLevel"]);
    case "approval_required":
      return hasRequiredStrings(data, ["approvalRequestId", "requestId", "messageId", "riskLevel"]);
    case "escalation_required":
      return hasRequiredStrings(data, ["escalationRequestId", "requestId", "messageId", "riskLevel"]);
    case "final":
      return isNonEmptyString(data.answerDecision)
        && answerDecisionStatuses.has(data.answerDecision as AnswerDecisionStatus)
        && isEvidenceRefs(data.evidenceRefs)
        && (
          data.noAnswerReason === undefined
          || (
            isNonEmptyString(data.noAnswerReason)
            && noAnswerReasons.has(data.noAnswerReason as NoAnswerReason)
          )
        )
        && (
          data.noAnswerReason !== "tool_failure"
          || data.answerDecision === "no_answer"
        );
    case "error":
      return hasRequiredStrings(data, ["code", "message"]);
    default:
      return false;
  }
}

function findLineEnding(value: string): LineEnding | null {
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "\n") {
      return { index, length: 1 };
    }

    if (character === "\r") {
      if (index === value.length - 1) {
        return null;
      }

      return { index, length: value[index + 1] === "\n" ? 2 : 1 };
    }
  }

  return null;
}

function parseField(line: string): { field: string; value: string } {
  const separatorIndex = line.indexOf(":");

  if (separatorIndex < 0) {
    return { field: line, value: "" };
  }

  const rawValue = line.slice(separatorIndex + 1);
  return {
    field: line.slice(0, separatorIndex),
    value: rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue,
  };
}

function correlationKey(event: AssistantSseEventInput): string {
  return JSON.stringify([event.requestId, event.sessionId, event.messageId]);
}

export class AssistantSseParser {
  private buffer = "";
  private frame = createEmptyFrame();
  private readonly lastSequenceByCorrelation = new Map<string, number>();

  push(chunk: string): AssistantSseParseResult[] {
    if (chunk.length === 0) {
      return [];
    }

    this.buffer += chunk;
    const results: AssistantSseParseResult[] = [];

    while (true) {
      const lineEnding = findLineEnding(this.buffer);
      if (!lineEnding) {
        break;
      }

      const line = this.buffer.slice(0, lineEnding.index);
      this.buffer = this.buffer.slice(lineEnding.index + lineEnding.length);
      results.push(...this.processLine(line));
    }

    return results;
  }

  flush(): AssistantSseParseResult[] {
    const results: AssistantSseParseResult[] = [];

    if (this.buffer.length > 0) {
      const line = this.buffer.endsWith("\r")
        ? this.buffer.slice(0, -1)
        : this.buffer;
      this.buffer = "";
      results.push(...this.processLine(line));
    }

    results.push(...this.dispatchFrame());
    return results;
  }

  reset(): void {
    this.buffer = "";
    this.frame = createEmptyFrame();
    this.lastSequenceByCorrelation.clear();
  }

  private processLine(line: string): AssistantSseParseResult[] {
    if (line.length === 0) {
      return this.dispatchFrame();
    }

    if (line.startsWith(":")) {
      const comment = line.slice(1);
      return [{
        kind: "comment",
        comment: comment.startsWith(" ") ? comment.slice(1) : comment,
      }];
    }

    const { field, value } = parseField(line);

    switch (field) {
      case "event":
        this.frame.eventName = value;
        break;
      case "data":
        this.frame.dataLines.push(value);
        break;
      case "id":
        if (!value.includes("\0")) {
          this.frame.id = value;
        }
        break;
      default:
        break;
    }

    return [];
  }

  private dispatchFrame(): AssistantSseParseResult[] {
    const frame = this.frame;
    this.frame = createEmptyFrame();

    if (frame.dataLines.length === 0) {
      return [];
    }

    const rawData = frame.dataLines.join("\n");
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawData);
    }
    catch {
      return [{
        kind: "malformed_event",
        eventName: frame.eventName,
        rawData,
        errorCode: "invalid_json",
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }];
    }

    if (!isCommonEnvelope(parsed)) {
      return [{
        kind: "malformed_event",
        eventName: frame.eventName,
        rawData,
        errorCode: "invalid_shape",
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }];
    }

    const eventName = frame.eventName || parsed.eventType;
    if (eventName !== parsed.eventType) {
      return [{
        kind: "malformed_event",
        eventName,
        rawData,
        errorCode: "invalid_shape",
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }];
    }

    const isKnownType = knownEventTypes.has(parsed.eventType as AssistantKnownSseEventType);
    if (isKnownType && !isKnownEvent(parsed)) {
      return [{
        kind: "malformed_event",
        eventName,
        rawData,
        errorCode: "invalid_shape",
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }];
    }

    const ignoredReason = this.getIgnoredReason(parsed);
    if (ignoredReason) {
      return [{
        kind: "ignored_event",
        reason: ignoredReason,
        eventName,
        event: parsed,
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }];
    }

    this.lastSequenceByCorrelation.set(correlationKey(parsed), parsed.sequence);

    if (isKnownType) {
      return [{
        kind: "event",
        eventName: parsed.eventType as AssistantKnownSseEventType,
        event: parsed as AssistantSseEvent,
        ...(frame.id === undefined ? {} : { id: frame.id }),
      }];
    }

    return [{
      kind: "unknown_event",
      eventName,
      event: parsed,
      ...(frame.id === undefined ? {} : { id: frame.id }),
    }];
  }

  private getIgnoredReason(event: AssistantSseEventInput): AssistantSseIgnoredEventReason | null {
    const previousSequence = this.lastSequenceByCorrelation.get(correlationKey(event));

    if (previousSequence === undefined) {
      return null;
    }

    if (event.sequence === previousSequence) {
      return "duplicate_sequence";
    }

    return event.sequence < previousSequence ? "out_of_order_sequence" : null;
  }
}

export function parseAssistantSseText(input: string): AssistantSseParseResult[] {
  const parser = new AssistantSseParser();
  return [...parser.push(input), ...parser.flush()];
}

export function accumulateAssistantAnswerDelta(
  current: string,
  event: AssistantSseEvent,
): string {
  return event.eventType === "answer_delta"
    ? `${current}${event.data.delta}`
    : current;
}

export function isAssistantFinalSseEvent(
  event: AssistantSseEvent,
): event is Extract<AssistantSseEvent, { eventType: "final" }> {
  return event.eventType === "final";
}

export function resolveAssistantSseTerminalReason(input: {
  finalReceived: boolean;
  timedOut?: boolean;
  eof?: boolean;
}): AssistantSseStreamTerminalReason | null {
  if (input.finalReceived) {
    return "completed";
  }

  if (input.timedOut) {
    return "timeout";
  }

  if (input.eof) {
    return "interrupted";
  }

  return null;
}

export function createAssistantSseStreamRunner<TInput>(
  options: AssistantSseStreamRunnerOptions<TInput>,
): AssistantSseStreamRunner<TInput> {
  const timeoutMs = Math.max(
    1,
    options.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS,
  );

  let nextRunId = 0;
  let activeRun: ActiveAssistantSseRun | null = null;
  let status: AssistantSseStreamStatus = "idle";
  let lastError: AssistantSseStreamSafeError | null = null;
  let finalEvent: AssistantFinalSseEvent | null = null;
  let lastEvent: AssistantSseEvent | null = null;
  let results: AssistantSseParseResult[] = [];

  function emitStatus(nextStatus: AssistantSseStreamStatus): void {
    status = nextStatus;
    options.state?.onStatusChange?.(nextStatus);
  }

  function emitError(error: AssistantSseStreamSafeError | null): void {
    lastError = error;
    options.state?.onErrorChange?.(error);
  }

  function emitFinalEvent(event: AssistantFinalSseEvent | null): void {
    finalEvent = event;
    options.state?.onFinalEventChange?.(event);
  }

  function emitLastEvent(event: AssistantSseEvent | null): void {
    lastEvent = event;
    options.state?.onLastEventChange?.(event);
  }

  function emitResults(nextResults: AssistantSseParseResult[]): void {
    results = nextResults;
    options.state?.onResultsChange?.(results);
  }

  function isCurrentRun(run: ActiveAssistantSseRun): boolean {
    return activeRun === run;
  }

  function setCallbackError(): void {
    if (lastError === null) {
      emitError(assistantSseStreamSafeErrors.callback);
    }
  }

  function invokeCallback<TArgs extends unknown[]>(
    callback: ((...args: TArgs) => void) | undefined,
    ...args: TArgs
  ): void {
    if (!callback) {
      return;
    }

    try {
      callback(...args);
    }
    catch {
      setCallbackError();
    }
  }

  function clearRunTimeout(run: ActiveAssistantSseRun): void {
    if (run.timeoutId !== null) {
      clearTimeout(run.timeoutId);
      run.timeoutId = null;
    }
  }

  function cleanupExternalSignal(run: ActiveAssistantSseRun): void {
    if (run.externalSignal && run.externalAbortHandler) {
      run.externalSignal.removeEventListener("abort", run.externalAbortHandler);
    }
    run.externalSignal = null;
    run.externalAbortHandler = null;
  }

  function cleanupRun(run: ActiveAssistantSseRun): void {
    clearRunTimeout(run);
    cleanupExternalSignal(run);
  }

  async function cancelReader(run: ActiveAssistantSseRun): Promise<void> {
    try {
      await run.reader?.cancel();
    }
    catch {
      // Reader cancellation is best-effort during terminal cleanup.
    }
    run.reader = null;
  }

  async function abortRun(
    run: ActiveAssistantSseRun,
    notify = true,
  ): Promise<void> {
    if (run.terminal) {
      return;
    }

    run.terminal = true;
    run.aborted = true;
    cleanupRun(run);
    run.controller.abort();

    if (isCurrentRun(run)) {
      activeRun = null;
      emitStatus("aborted");
      emitError(null);

      if (notify) {
        invokeCallback(options.callbacks?.onAbort);
      }
    }

    await cancelReader(run);
    run.parser.reset();
  }

  async function timeoutRun(run: ActiveAssistantSseRun): Promise<void> {
    if (run.terminal || !isCurrentRun(run)) {
      return;
    }

    run.terminal = true;
    run.timedOut = true;
    cleanupRun(run);
    run.controller.abort();

    if (isCurrentRun(run)) {
      activeRun = null;
      emitStatus("timeout");
      emitError(assistantSseStreamSafeErrors.timeout);
      invokeCallback(options.callbacks?.onTimeout, assistantSseStreamSafeErrors.timeout);
    }

    await cancelReader(run);
    run.parser.reset();
  }

  function armInactivityTimeout(run: ActiveAssistantSseRun): void {
    clearRunTimeout(run);
    run.timeoutId = setTimeout(() => {
      void timeoutRun(run);
    }, timeoutMs);
  }

  function attachExternalSignal(
    run: ActiveAssistantSseRun,
    signal: AbortSignal | undefined,
  ): void {
    if (!signal) {
      return;
    }

    const abortHandler = () => {
      void abortRun(run);
    };

    run.externalSignal = signal;
    run.externalAbortHandler = abortHandler;
    signal.addEventListener("abort", abortHandler, { once: true });
  }

  function resetRunState(): void {
    emitError(null);
    emitFinalEvent(null);
    emitLastEvent(null);
    emitResults([]);
  }

  function appendResult(result: AssistantSseParseResult): void {
    emitResults([...results, result]);
  }

  function dispatchResults(
    run: ActiveAssistantSseRun,
    parsedResults: AssistantSseParseResult[],
  ): boolean {
    for (const result of parsedResults) {
      if (run.terminal || !isCurrentRun(run)) {
        return false;
      }

      appendResult(result);
      invokeCallback(options.callbacks?.onResult, result);

      if (result.kind === "unknown_event") {
        invokeCallback(options.callbacks?.onUnknownEvent, result);
        continue;
      }

      if (result.kind === "malformed_event") {
        invokeCallback(options.callbacks?.onMalformedEvent, result);
        continue;
      }

      if (result.kind === "ignored_event") {
        invokeCallback(options.callbacks?.onIgnoredEvent, result);
        continue;
      }

      if (result.kind === "comment") {
        continue;
      }

      emitLastEvent(result.event);
      invokeCallback(options.callbacks?.onEvent, result.event);

      if (result.event.eventType === "error") {
        invokeCallback(options.callbacks?.onErrorEvent, result.event);
        continue;
      }

      if (result.event.eventType === "final") {
        emitFinalEvent(result.event);
        invokeCallback(options.callbacks?.onFinal, result.event);
        return true;
      }
    }

    return false;
  }

  async function finishCompleted(run: ActiveAssistantSseRun): Promise<void> {
    if (run.terminal || !isCurrentRun(run)) {
      return;
    }

    run.terminal = true;
    cleanupRun(run);
    await cancelReader(run);
    run.parser.reset();

    if (!isCurrentRun(run)) {
      return;
    }

    activeRun = null;
    emitStatus("completed");
    invokeCallback(options.callbacks?.onComplete);
  }

  function finishInterrupted(run: ActiveAssistantSseRun): void {
    if (run.terminal || !isCurrentRun(run)) {
      return;
    }

    run.terminal = true;
    cleanupRun(run);
    run.parser.reset();
    activeRun = null;
    emitStatus("interrupted");
    emitError(assistantSseStreamSafeErrors.interrupted);
    invokeCallback(options.callbacks?.onInterrupted, assistantSseStreamSafeErrors.interrupted);
  }

  async function finishTransportError(
    run: ActiveAssistantSseRun,
    error: AssistantSseStreamSafeError,
  ): Promise<void> {
    if (run.terminal || !isCurrentRun(run)) {
      return;
    }

    run.terminal = true;
    cleanupRun(run);
    run.controller.abort();
    await cancelReader(run);
    run.parser.reset();

    if (!isCurrentRun(run)) {
      return;
    }

    activeRun = null;
    emitStatus("error");
    emitError(error);
    invokeCallback(options.callbacks?.onTransportError, error);
  }

  function createRun(): ActiveAssistantSseRun {
    return {
      id: nextRunId += 1,
      controller: new AbortController(),
      parser: options.createParser?.() ?? new AssistantSseParser(),
      decoder: options.createTextDecoder?.() ?? new TextDecoder(),
      reader: null,
      timeoutId: null,
      externalSignal: null,
      externalAbortHandler: null,
      terminal: false,
      aborted: false,
      timedOut: false,
    };
  }

  async function start(
    input: TInput,
    startOptions: AssistantSseStreamRunnerStartOptions = {},
  ): Promise<void> {
    if (activeRun) {
      await abortRun(activeRun);
    }

    resetRunState();

    const run = createRun();
    activeRun = run;
    emitStatus("connecting");
    attachExternalSignal(run, startOptions.externalSignal);

    if (startOptions.externalSignal?.aborted) {
      await abortRun(run);
      return;
    }

    armInactivityTimeout(run);

    let stream: ReadableStream<Uint8Array> | null;
    try {
      stream = await options.openStream(input, { signal: run.controller.signal });
    }
    catch {
      if (!run.aborted && !run.timedOut) {
        await finishTransportError(run, assistantSseStreamSafeErrors.streamTransport);
      }
      return;
    }

    if (run.terminal || !isCurrentRun(run)) {
      return;
    }

    if (!stream) {
      await finishTransportError(run, assistantSseStreamSafeErrors.missingBody);
      return;
    }

    run.reader = stream.getReader();
    emitStatus("streaming");
    armInactivityTimeout(run);

    while (!run.terminal && isCurrentRun(run)) {
      let readResult: ReadableStreamReadResult<Uint8Array>;

      try {
        readResult = await run.reader.read();
      }
      catch {
        if (!run.aborted && !run.timedOut) {
          await finishTransportError(run, assistantSseStreamSafeErrors.streamRead);
        }
        return;
      }

      if (run.terminal || !isCurrentRun(run)) {
        return;
      }

      if (readResult.done) {
        break;
      }

      armInactivityTimeout(run);

      let decodedChunk: string;
      try {
        decodedChunk = run.decoder.decode(readResult.value, { stream: true });
      }
      catch {
        await finishTransportError(run, assistantSseStreamSafeErrors.streamDecode);
        return;
      }

      if (
        decodedChunk.length > 0
        && dispatchResults(run, run.parser.push(decodedChunk))
      ) {
        await finishCompleted(run);
        return;
      }
    }

    if (run.terminal || !isCurrentRun(run)) {
      return;
    }

    let decoderTail: string;
    try {
      decoderTail = run.decoder.decode();
    }
    catch {
      await finishTransportError(run, assistantSseStreamSafeErrors.streamDecode);
      return;
    }

    if (
      decoderTail.length > 0
      && dispatchResults(run, run.parser.push(decoderTail))
    ) {
      await finishCompleted(run);
      return;
    }

    if (dispatchResults(run, run.parser.flush())) {
      await finishCompleted(run);
      return;
    }

    finishInterrupted(run);
  }

  async function cancel(): Promise<void> {
    if (activeRun) {
      await abortRun(activeRun);
    }
  }

  async function reset(): Promise<void> {
    if (activeRun) {
      await abortRun(activeRun);
    }

    emitStatus("idle");
    resetRunState();
  }

  return {
    start,
    cancel,
    reset,
    getStatus: () => status,
    getResults: () => results,
  };
}
