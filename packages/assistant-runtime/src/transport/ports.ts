import type { AssistantSession, AssistantSessionListPage, HistoryMessageSummary } from "../types";

export type AssistantRuntimeOperationName =
  | "createSession"
  | "sendMessage"
  | "streamMessage"
  | "cancelMessage"
  | "abortMessage"
  | "submitFeedback"
  | "confirmAction"
  | "rejectAction"
  | "loadApprovalRequest";

export const assistantRuntimeTransportOperationNames = [
  "createSession",
  "sendMessage",
  "streamMessage",
  "cancelMessage",
  "abortMessage",
  "submitFeedback",
  "confirmAction",
  "rejectAction",
  "loadApprovalRequest"
] as const satisfies readonly AssistantRuntimeOperationName[];

export const assistantRuntimeTransportOwnership = {
  sharedRuntimeOwns: [
    "canonical session runtime state",
    "create/history operation execution",
    "session store mutation",
    "canonical runtime lifecycle",
    "cancellation/cleanup",
    "canonical SSE consumption",
    "retry/cancel/timeout/interrupted state",
    "safe outcome state"
  ],
  frontend001AdapterOwns: [
    "Nuxt runtime config",
    "Nuxt HTTP/auth/headers",
    "Frontend 001 route/page wiring"
  ],
  frontend002AdapterOwns: [
    "provider/context resolution",
    "provider/storage candidate collection",
    "capability-aware restore-or-create policy",
    "local persistence fallback",
    "integration bootstrap coordination",
    "request builder",
    "forbidden outgoing field gate",
    "default/injected transport execution"
  ],
  forbiddenAdapterOwnership: [
    "SSE parser",
    "canonical session state machine",
    "retry state machine",
    "safe outcome renderer contract"
  ]
} as const;

export type AssistantRuntimeSafeError = {
  code: string;
  message: string;
  status?: string;
  statusCode?: number;
  field?: string;
  surface?: string;
  retryable?: boolean;
};

export type AssistantRuntimeTransportResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AssistantRuntimeSafeError };

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

/**
 * Exactly one of `message` (typed text) or `choiceId` (a server-declared Quick Reply or suggestion,
 * Backend Feature 013) is sent.
 */
export type AssistantRuntimeSendMessageInput = {
  sessionId?: string;
  pageContext?: AssistantRuntimePageContext;
} & (
  | { message: string; choiceId?: never }
  | { choiceId: string; message?: never }
);

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
  getSession(
    input: AssistantRuntimeGetSessionInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<AssistantRuntimeSession>>;
  loadHistory(
    input: AssistantRuntimeLoadHistoryInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<AssistantRuntimeHistory>>;
};

export type AssistantRuntimeListSessionsInput = {
  limit?: number;
  cursor?: string;
  /** Omitted for the active list; `archived` lists archived sessions. */
  status?: "archived";
};

export type AssistantRuntimeArchiveSessionInput = {
  sessionId: string;
};

/** Backend Feature 013: optional session list and archive; the history view is shown only when present. */
export type AssistantRuntimeSessionHistoryCapability = {
  listSessions(
    input: AssistantRuntimeListSessionsInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<AssistantSessionListPage>>;
  archiveSession(
    input: AssistantRuntimeArchiveSessionInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<{ sessionId: string; status: "closed" }>>;
  /** Optional: move an archived session back to the active list. */
  unarchiveSession?(
    input: AssistantRuntimeArchiveSessionInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<{ sessionId: string; status: "active" }>>;
  /** Optional: delete a session for good (the backend keeps it for audit). */
  deleteSession?(
    input: AssistantRuntimeArchiveSessionInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<{ sessionId: string; status: "deleted" }>>;
};

export type AssistantRuntimeTransportPort = {
  createSession(
    input: AssistantRuntimeCreateSessionInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<AssistantRuntimeSession>>;
  /** Optional: a transport may support validating and loading a remote session. */
  getSession?: AssistantRuntimeRemoteRestorationCapability["getSession"];
  loadHistory?: AssistantRuntimeRemoteRestorationCapability["loadHistory"];
  /** Optional: Backend Feature 013 session list and archive. */
  listSessions?: AssistantRuntimeSessionHistoryCapability["listSessions"];
  archiveSession?: AssistantRuntimeSessionHistoryCapability["archiveSession"];
  unarchiveSession?: AssistantRuntimeSessionHistoryCapability["unarchiveSession"];
  deleteSession?: AssistantRuntimeSessionHistoryCapability["deleteSession"];
  sendMessage(
    input: AssistantRuntimeSendMessageInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<AssistantRuntimeMessage>>;
  streamMessage(
    input: AssistantRuntimeStreamMessageInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<ReadableStream<Uint8Array>>>;
  cancelMessage(
    input: AssistantRuntimeCancelMessageInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<{ cancelled: true }>>;
  abortMessage(
    input: AssistantRuntimeCancelMessageInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<{ aborted: true }>>;
  submitFeedback(
    input: AssistantRuntimeFeedbackInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<{ accepted: true }>>;
  confirmAction(
    input: AssistantRuntimeActionConfirmationInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<{ confirmed: true }>>;
  rejectAction(
    input: AssistantRuntimeActionConfirmationInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<{ rejected: true }>>;
  loadApprovalRequest(
    input: AssistantRuntimeApprovalInput,
    options?: AssistantRuntimeRequestOptions
  ): Promise<AssistantRuntimeTransportResult<{ approvalRequestId: string }>>;
};

export function supportsAssistantRuntimeRemoteRestoration(
  transport: AssistantRuntimeTransportPort,
): transport is AssistantRuntimeTransportPort & AssistantRuntimeRemoteRestorationCapability {
  return typeof transport.getSession === "function" && typeof transport.loadHistory === "function";
}

export function supportsAssistantRuntimeSessionHistory(
  transport: AssistantRuntimeTransportPort,
): transport is AssistantRuntimeTransportPort & AssistantRuntimeSessionHistoryCapability {
  return typeof transport.listSessions === "function" && typeof transport.archiveSession === "function";
}
