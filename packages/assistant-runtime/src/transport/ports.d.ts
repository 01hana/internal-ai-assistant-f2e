import type { AssistantSession, HistoryMessageSummary } from "../types";
export type AssistantRuntimeOperationName = "createSession" | "sendMessage" | "streamMessage" | "cancelMessage" | "abortMessage" | "submitFeedback" | "confirmAction" | "rejectAction" | "loadApprovalRequest";
export declare const assistantRuntimeTransportOperationNames: readonly ["createSession", "sendMessage", "streamMessage", "cancelMessage", "abortMessage", "submitFeedback", "confirmAction", "rejectAction", "loadApprovalRequest"];
export declare const assistantRuntimeTransportOwnership: {
    readonly sharedRuntimeOwns: readonly ["canonical session runtime state", "create/history operation execution", "session store mutation", "canonical runtime lifecycle", "cancellation/cleanup", "canonical SSE consumption", "retry/cancel/timeout/interrupted state", "safe outcome state"];
    readonly frontend001AdapterOwns: readonly ["Nuxt runtime config", "Nuxt HTTP/auth/headers", "Frontend 001 route/page wiring"];
    readonly frontend002AdapterOwns: readonly ["provider/context resolution", "provider/storage candidate collection", "capability-aware restore-or-create policy", "local persistence fallback", "integration bootstrap coordination", "request builder", "forbidden outgoing field gate", "default/injected transport execution"];
    readonly forbiddenAdapterOwnership: readonly ["SSE parser", "canonical session state machine", "retry state machine", "safe outcome renderer contract"];
};
export type AssistantRuntimeSafeError = {
    code: string;
    message: string;
    status?: string;
    statusCode?: number;
    field?: string;
    surface?: string;
    retryable?: boolean;
};
export type AssistantRuntimeTransportResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: AssistantRuntimeSafeError;
};
export type AssistantRuntimeRequestOptions = {
    signal?: AbortSignal;
    correlationId?: string;
    identityHeaders?: Readonly<Record<string, string | undefined>>;
};
export type AssistantRuntimePageContext = Readonly<Record<string, unknown>>;
export type AssistantRuntimeSession = AssistantSession;
export type AssistantRuntimeMessage = {
    messageId: string;
    sessionId: string;
    status: "queued" | "streaming" | "completed" | "failed";
};
export type AssistantRuntimeHistory = {
    sessionId: string;
    messages: readonly HistoryMessageSummary[];
    cursor?: string;
};
export type AssistantRuntimeCreateSessionInput = {
    sessionId?: string;
    pageContext?: AssistantRuntimePageContext;
};
export type AssistantRuntimeGetSessionInput = {
    sessionId: string;
};
export type AssistantRuntimeLoadHistoryInput = {
    sessionId: string;
    cursor?: string;
};
export type AssistantRuntimeSendMessageInput = {
    sessionId?: string;
    message: string;
    pageContext?: AssistantRuntimePageContext;
};
export type AssistantRuntimeStreamMessageInput = AssistantRuntimeSendMessageInput;
export type AssistantRuntimeCancelMessageInput = {
    sessionId: string;
    messageId: string;
};
export type AssistantRuntimeFeedbackInput = {
    sessionId: string;
    messageId: string;
    value: "positive" | "negative";
};
export type AssistantRuntimeActionConfirmationInput = {
    sessionId: string;
    messageId: string;
    actionId: string;
};
export type AssistantRuntimeApprovalInput = {
    sessionId: string;
    messageId: string;
    approvalRequestId: string;
};
export type AssistantRuntimeRemoteRestorationCapability = {
    getSession(input: AssistantRuntimeGetSessionInput, options?: AssistantRuntimeRequestOptions): Promise<AssistantRuntimeTransportResult<AssistantRuntimeSession>>;
    loadHistory(input: AssistantRuntimeLoadHistoryInput, options?: AssistantRuntimeRequestOptions): Promise<AssistantRuntimeTransportResult<AssistantRuntimeHistory>>;
};
export type AssistantRuntimeTransportPort = {
    createSession(input: AssistantRuntimeCreateSessionInput, options?: AssistantRuntimeRequestOptions): Promise<AssistantRuntimeTransportResult<AssistantRuntimeSession>>;
    /** Optional: a transport may support validating and loading a remote session. */
    getSession?: AssistantRuntimeRemoteRestorationCapability["getSession"];
    loadHistory?: AssistantRuntimeRemoteRestorationCapability["loadHistory"];
    sendMessage(input: AssistantRuntimeSendMessageInput, options?: AssistantRuntimeRequestOptions): Promise<AssistantRuntimeTransportResult<AssistantRuntimeMessage>>;
    streamMessage(input: AssistantRuntimeStreamMessageInput, options?: AssistantRuntimeRequestOptions): Promise<AssistantRuntimeTransportResult<ReadableStream<Uint8Array>>>;
    cancelMessage(input: AssistantRuntimeCancelMessageInput, options?: AssistantRuntimeRequestOptions): Promise<AssistantRuntimeTransportResult<{
        cancelled: true;
    }>>;
    abortMessage(input: AssistantRuntimeCancelMessageInput, options?: AssistantRuntimeRequestOptions): Promise<AssistantRuntimeTransportResult<{
        aborted: true;
    }>>;
    submitFeedback(input: AssistantRuntimeFeedbackInput, options?: AssistantRuntimeRequestOptions): Promise<AssistantRuntimeTransportResult<{
        accepted: true;
    }>>;
    confirmAction(input: AssistantRuntimeActionConfirmationInput, options?: AssistantRuntimeRequestOptions): Promise<AssistantRuntimeTransportResult<{
        confirmed: true;
    }>>;
    rejectAction(input: AssistantRuntimeActionConfirmationInput, options?: AssistantRuntimeRequestOptions): Promise<AssistantRuntimeTransportResult<{
        rejected: true;
    }>>;
    loadApprovalRequest(input: AssistantRuntimeApprovalInput, options?: AssistantRuntimeRequestOptions): Promise<AssistantRuntimeTransportResult<{
        approvalRequestId: string;
    }>>;
};
export declare function supportsAssistantRuntimeRemoteRestoration(transport: AssistantRuntimeTransportPort): transport is AssistantRuntimeTransportPort & AssistantRuntimeRemoteRestorationCapability;
