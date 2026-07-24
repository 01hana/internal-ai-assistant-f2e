import type {
  AssistantRuntimeActionConfirmationInput,
  AssistantRuntimeApprovalInput,
  AssistantRuntimeCancelMessageInput,
  AssistantRuntimeCreateSessionInput,
  AssistantRuntimeFeedbackInput,
  AssistantRuntimeLoadHistoryInput,
  AssistantRuntimeRequestOptions,
  AssistantRuntimeSendMessageInput,
  AssistantRuntimeStreamMessageInput,
  AssistantRuntimeTransportPort,
  AssistantRuntimeTransportResult,
} from "../../../assistant-runtime/src/transport/ports";
import { buildAssistantRequest } from "../request/requestBuilder";
import { assertOutgoingRequestSafe } from "../request/outgoingRequestBoundary";
import { toTransportFailure } from "./transportErrors";
import type {
  PackageBuiltRequest,
  SdkTransportCapabilityMap,
  SdkTransportExecutionInput,
  SdkTransportExecutor,
  SdkTransportOperationName,
} from "./types";

export type DefaultTransportOptions = {
  readonly execute?: SdkTransportExecutor;
  readonly capabilities?: SdkTransportCapabilityMap;
  readonly integrationMode?: "backend001-compatibility" | "backend002";
};

type PortResult<T> = AssistantRuntimeTransportResult<T>;
type CompatibilityFetchRoute =
  | "createSession"
  | "loadHistory"
  | "streamMessage";

const COMPATIBILITY_API_PREFIX = "/api/v1";

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `sdk-request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getSessionId(input: { readonly sessionId?: string }, requestId: string): string {
  return typeof input.sessionId === "string" && input.sessionId.length > 0
    ? input.sessionId
    : `pending-${requestId}`;
}

function toFailure<T>(code: Parameters<typeof toTransportFailure>[0] = "transport_execution_failed"): PortResult<T> {
  return toTransportFailure(code) as PortResult<T>;
}

function isTransportResult<T>(value: unknown): value is PortResult<T> {
  return (
    !!value
    && typeof value === "object"
    && !isResponseLike(value)
    && "ok" in value
    && typeof (value as { readonly ok?: unknown }).ok === "boolean"
  );
}

function normalizeExecutorResult<T>(value: unknown): PortResult<T> {
  if (isTransportResult<T>(value)) {
    return value;
  }

  return {
    ok: true,
    value: value as T,
  };
}

function isResponseLike(value: unknown): value is Response {
  return (
    typeof Response !== "undefined"
    && value instanceof Response
  );
}

function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return (
    typeof ReadableStream !== "undefined"
    && value instanceof ReadableStream
  );
}

function readEnvelopeData<T>(payload: unknown): T {
  if (
    payload
    && typeof payload === "object"
    && "data" in payload
  ) {
    return (payload as { readonly data: T }).data;
  }

  return payload as T;
}

async function normalizeJsonResponse<T>(response: Response): Promise<PortResult<T>> {
  if (!response.ok) {
    return toFailure("transport_execution_failed");
  }

  try {
    return {
      ok: true,
      value: readEnvelopeData<T>(await response.json()),
    };
  }
  catch {
    return toFailure("transport_execution_failed");
  }
}

function normalizeStreamResponse(value: unknown): PortResult<ReadableStream<Uint8Array>> {
  if (isTransportResult<ReadableStream<Uint8Array>>(value)) {
    return value;
  }

  if (isReadableStream(value)) {
    return {
      ok: true,
      value,
    };
  }

  if (!isResponseLike(value)) {
    return toFailure("transport_execution_failed");
  }

  if (!value.ok || !value.body) {
    return toFailure(value.body ? "transport_execution_failed" : "sse_stream_unavailable");
  }

  return {
    ok: true,
    value: value.body,
  };
}

function assertSafeRequest(request: Readonly<Record<string, unknown>>): PortResult<undefined> {
  const safety = assertOutgoingRequestSafe({
    body: request,
    callbackPayload: {},
    headers: {},
    hiddenPrompt: undefined,
    messageText: typeof request.message === "string" ? request.message : undefined,
    pageContext: request.pageContext,
    transportMetadata: {},
  });

  if (!safety.ok) {
    return toFailure("forbidden_outgoing_request_field");
  }

  return {
    ok: true,
    value: undefined,
  };
}

function createExecutionInput(
  operation: SdkTransportOperationName | "send",
  request: Readonly<Record<string, unknown>>,
  sessionId: string,
  requestId = createRequestId(),
): SdkTransportExecutionInput {
  return {
    operation,
    request,
    requestId,
    sessionId,
  };
}

function buildMessageExecutionInput(
  operation: "sendMessage" | "streamMessage",
  input: AssistantRuntimeSendMessageInput | AssistantRuntimeStreamMessageInput,
  integrationMode: DefaultTransportOptions["integrationMode"],
): PortResult<SdkTransportExecutionInput> {
  const requestId = createRequestId();
  const mode = integrationMode ?? "backend001-compatibility";
  const buildResult = buildAssistantRequest({
    hostContext: mode === "backend001-compatibility" || input.pageContext === undefined
      ? undefined
      : { pageContext: input.pageContext },
    integrationMode: mode,
    message: input.message,
    sessionId: input.sessionId,
  });

  if (!buildResult.ok) {
    return toFailure("transport_execution_failed");
  }

  return {
    ok: true,
    value: createExecutionInput(
      operation,
      buildResult.request,
      getSessionId(input, requestId),
      requestId,
    ),
  };
}

function buildSafeOperationExecutionInput(
  operation: SdkTransportOperationName,
  input: Readonly<Record<string, unknown>>,
): PortResult<SdkTransportExecutionInput> {
  const requestId = createRequestId();
  const request = {
    operation,
    ...input,
  };
  const safety = assertSafeRequest(request);

  if (!safety.ok) {
    return safety;
  }

  return {
    ok: true,
    value: createExecutionInput(operation, request, getSessionId(input, requestId), requestId),
  };
}

function selectExecutor(
  options: DefaultTransportOptions,
  operation: SdkTransportOperationName | "send",
): SdkTransportExecutor | undefined {
  if (operation !== "send") {
    return options.capabilities?.[operation] ?? options.execute;
  }

  return options.execute;
}

function getCompatibilityFetch(options: DefaultTransportOptions): typeof fetch | null {
  if ((options.integrationMode ?? "backend001-compatibility") !== "backend001-compatibility") {
    return null;
  }

  return typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : null;
}

function createJsonRequestInit(
  method: "GET" | "POST",
  runtimeOptions?: AssistantRuntimeRequestOptions,
  request?: Readonly<Record<string, unknown>>,
): RequestInit {
  return {
    method,
    ...(request
      ? {
          body: JSON.stringify(request),
          headers: {
            "content-type": "application/json",
          },
        }
      : {}),
    signal: runtimeOptions?.signal,
  };
}

function createStreamRequestInit(
  runtimeOptions: AssistantRuntimeRequestOptions | undefined,
  request: Readonly<Record<string, unknown>>,
): RequestInit {
  return {
    body: JSON.stringify(request),
    headers: {
      accept: "text/event-stream",
      "content-type": "application/json",
    },
    method: "POST",
    signal: runtimeOptions?.signal,
  };
}

function createCompatibilitySessionMessagesPath(sessionId: string, cursor?: unknown): string {
  const encodedSessionId = encodeURIComponent(sessionId);
  const path = `${COMPATIBILITY_API_PREFIX}/assistant/sessions/${encodedSessionId}/messages`;

  return typeof cursor === "string" && cursor.length > 0
    ? `${path}?cursor=${encodeURIComponent(cursor)}`
    : path;
}

async function executeCompatibilityFetch<T>(
  fetchImpl: typeof fetch,
  route: CompatibilityFetchRoute,
  executionInput: SdkTransportExecutionInput,
  runtimeOptions?: AssistantRuntimeRequestOptions,
): Promise<PortResult<T>> {
  try {
    if (route === "createSession") {
      return await normalizeJsonResponse<T>(await fetchImpl(
        `${COMPATIBILITY_API_PREFIX}/assistant/sessions`,
        createJsonRequestInit("POST", runtimeOptions, {}),
      ));
    }

    if (route === "loadHistory") {
      return await normalizeJsonResponse<T>(await fetchImpl(
        createCompatibilitySessionMessagesPath(executionInput.sessionId, executionInput.request.cursor),
        createJsonRequestInit("GET", runtimeOptions),
      ));
    }

    const response = await fetchImpl(
      createCompatibilitySessionMessagesPath(executionInput.sessionId),
      createStreamRequestInit(runtimeOptions, executionInput.request),
    );

    return normalizeStreamResponse(response) as PortResult<T>;
  }
  catch {
    return toFailure("transport_execution_failed");
  }
}

async function executeOperation<T>(
  options: DefaultTransportOptions,
  operation: SdkTransportOperationName | "send",
  executionInput: SdkTransportExecutionInput,
  runtimeOptions?: AssistantRuntimeRequestOptions,
): Promise<PortResult<T>> {
  const executor = selectExecutor(options, operation);

  if (typeof executor !== "function") {
    const compatibilityFetch = getCompatibilityFetch(options);

    if (
      compatibilityFetch
      && (
        operation === "createSession"
        || operation === "loadHistory"
        || operation === "streamMessage"
      )
    ) {
      return await executeCompatibilityFetch<T>(compatibilityFetch, operation, executionInput, runtimeOptions);
    }

    return toFailure("transport_unavailable");
  }

  try {
    const value = await executor(executionInput, runtimeOptions);

    return operation === "streamMessage"
      ? normalizeStreamResponse(value) as PortResult<T>
      : normalizeExecutorResult<T>(value);
  }
  catch {
    return toFailure("transport_execution_failed");
  }
}

export function createDefaultTransport(options: DefaultTransportOptions = {}) {
  async function send(
    request: PackageBuiltRequest,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ): Promise<unknown> {
    return executeOperation(options, "send", {
      operation: "send",
      request: request.request,
      requestId: request.requestId,
      sessionId: request.sessionId,
    }, runtimeOptions);
  }

  async function createSession(
    input: AssistantRuntimeCreateSessionInput,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ) {
    const executionInput = buildSafeOperationExecutionInput("createSession", input);

    return executionInput.ok
      ? executeOperation(options, "createSession", executionInput.value, runtimeOptions)
      : executionInput;
  }

  async function loadHistory(
    input: AssistantRuntimeLoadHistoryInput,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ) {
    const executionInput = buildSafeOperationExecutionInput("loadHistory", input);

    return executionInput.ok
      ? executeOperation(options, "loadHistory", executionInput.value, runtimeOptions)
      : executionInput;
  }

  async function sendMessage(
    input: AssistantRuntimeSendMessageInput,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ) {
    const executionInput = buildMessageExecutionInput("sendMessage", input, options.integrationMode);

    return executionInput.ok
      ? executeOperation(options, "sendMessage", executionInput.value, runtimeOptions)
      : executionInput;
  }

  async function streamMessage(
    input: AssistantRuntimeStreamMessageInput,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ) {
    const executionInput = buildMessageExecutionInput("streamMessage", input, options.integrationMode);

    return executionInput.ok
      ? executeOperation(options, "streamMessage", executionInput.value, runtimeOptions)
      : executionInput;
  }

  async function cancelMessage(
    input: AssistantRuntimeCancelMessageInput,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ) {
    const executionInput = buildSafeOperationExecutionInput("cancelMessage", input);

    return executionInput.ok
      ? executeOperation(options, "cancelMessage", executionInput.value, runtimeOptions)
      : executionInput;
  }

  async function abortMessage(
    input: AssistantRuntimeCancelMessageInput,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ) {
    const executionInput = buildSafeOperationExecutionInput("abortMessage", input);

    return executionInput.ok
      ? executeOperation(options, "abortMessage", executionInput.value, runtimeOptions)
      : executionInput;
  }

  async function submitFeedback(
    input: AssistantRuntimeFeedbackInput,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ) {
    const executionInput = buildSafeOperationExecutionInput("submitFeedback", input);

    return executionInput.ok
      ? executeOperation(options, "submitFeedback", executionInput.value, runtimeOptions)
      : executionInput;
  }

  async function confirmAction(
    input: AssistantRuntimeActionConfirmationInput,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ) {
    const executionInput = buildSafeOperationExecutionInput("confirmAction", input);

    return executionInput.ok
      ? executeOperation(options, "confirmAction", executionInput.value, runtimeOptions)
      : executionInput;
  }

  async function rejectAction(
    input: AssistantRuntimeActionConfirmationInput,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ) {
    const executionInput = buildSafeOperationExecutionInput("rejectAction", input);

    return executionInput.ok
      ? executeOperation(options, "rejectAction", executionInput.value, runtimeOptions)
      : executionInput;
  }

  async function loadApprovalRequest(
    input: AssistantRuntimeApprovalInput,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ) {
    const executionInput = buildSafeOperationExecutionInput("loadApprovalRequest", input);

    return executionInput.ok
      ? executeOperation(options, "loadApprovalRequest", executionInput.value, runtimeOptions)
      : executionInput;
  }

  return {
    abortMessage,
    cancelMessage,
    confirmAction,
    createSession,
    loadApprovalRequest,
    loadHistory,
    rejectAction,
    send,
    sendMessage,
    streamMessage,
    submitFeedback,
  } as const satisfies AssistantRuntimeTransportPort & {
    readonly send: typeof send;
  };
}
