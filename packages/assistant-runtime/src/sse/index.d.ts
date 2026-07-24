import type { AssistantKnownSseEventType, AssistantSseEvent, AssistantSseEventInput, AssistantUnknownSseEvent } from "../types";
export type AssistantSseMalformedEventErrorCode = "invalid_json" | "invalid_shape";
export type AssistantSseIgnoredEventReason = "duplicate_sequence" | "out_of_order_sequence";
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
export type AssistantSseParseResult = AssistantSseEventResult | AssistantSseUnknownEventResult | AssistantSseMalformedEventResult | AssistantSseIgnoredEventResult | AssistantSseCommentResult;
export type AssistantSseStreamTerminalReason = "completed" | "timeout" | "interrupted";
export type AssistantSseStreamStatus = "idle" | "connecting" | "streaming" | "completed" | "interrupted" | "timeout" | "aborted" | "error";
export interface AssistantSseStreamSafeError {
    code: "stream_transport_error" | "missing_stream_body" | "stream_read_error" | "stream_decode_error" | "stream_interrupted" | "stream_timeout" | "callback_error";
    safeMessage: string;
}
export type AssistantFinalSseEvent = Extract<AssistantSseEvent, {
    eventType: "final";
}>;
export type AssistantErrorSseEvent = Extract<AssistantSseEvent, {
    eventType: "error";
}>;
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
    openStream: (input: TInput, options: {
        signal: AbortSignal;
    }) => Promise<ReadableStream<Uint8Array> | null>;
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
export declare const assistantSseStreamSafeErrors: {
    readonly streamTransport: {
        readonly code: "stream_transport_error";
        readonly safeMessage: "The assistant stream could not be started.";
    };
    readonly missingBody: {
        readonly code: "missing_stream_body";
        readonly safeMessage: "The assistant stream did not include a readable body.";
    };
    readonly streamRead: {
        readonly code: "stream_read_error";
        readonly safeMessage: "The assistant stream could not be read.";
    };
    readonly streamDecode: {
        readonly code: "stream_decode_error";
        readonly safeMessage: "The assistant stream could not be decoded.";
    };
    readonly interrupted: {
        readonly code: "stream_interrupted";
        readonly safeMessage: "The assistant stream ended before a final result.";
    };
    readonly timeout: {
        readonly code: "stream_timeout";
        readonly safeMessage: "The assistant stream timed out before a final result.";
    };
    readonly callback: {
        readonly code: "callback_error";
        readonly safeMessage: "A stream callback could not be completed.";
    };
};
export declare class AssistantSseParser {
    private buffer;
    private frame;
    private readonly lastSequenceByCorrelation;
    push(chunk: string): AssistantSseParseResult[];
    flush(): AssistantSseParseResult[];
    reset(): void;
    private processLine;
    private dispatchFrame;
    private getIgnoredReason;
}
export declare function parseAssistantSseText(input: string): AssistantSseParseResult[];
export declare function accumulateAssistantAnswerDelta(current: string, event: AssistantSseEvent): string;
export declare function isAssistantFinalSseEvent(event: AssistantSseEvent): event is Extract<AssistantSseEvent, {
    eventType: "final";
}>;
export declare function resolveAssistantSseTerminalReason(input: {
    finalReceived: boolean;
    timedOut?: boolean;
    eof?: boolean;
}): AssistantSseStreamTerminalReason | null;
export declare function createAssistantSseStreamRunner<TInput>(options: AssistantSseStreamRunnerOptions<TInput>): AssistantSseStreamRunner<TInput>;
