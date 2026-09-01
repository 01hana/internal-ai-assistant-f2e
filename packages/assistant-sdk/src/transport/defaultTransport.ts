import type {
  AssistantRuntimeActionConfirmationInput,
  AssistantRuntimeApprovalInput,
  AssistantRuntimeCancelMessageInput,
  AssistantRuntimeCreateSessionInput,
  AssistantRuntimeFeedbackInput,
  AssistantRuntimeGetSessionInput,
  AssistantRuntimeLoadHistoryInput,
  AssistantRuntimeRequestOptions,
  AssistantRuntimeSendMessageInput,
  AssistantRuntimeStreamMessageInput,
  AssistantRuntimeTransportPort,
  AssistantRuntimeTransportResult,
} from "../../../assistant-runtime/src/transport/ports";
import { buildAssistantRequest } from "../request/requestBuilder";
import { sanitizePageContextForRequest } from "../request/pageContext";
import type { AssistantAccessTokenProvider } from "../types/public";
import { assertOutgoingRequestSafe } from "../request/outgoingRequestBoundary";
import { resolveAccessToken } from "./accessTokenResolver";
import { toTransportFailure } from "./transportErrors";
import type {
  PackageBuiltRequest,
  SdkTransportCapabilityMap,
  SdkTransportExecutionInput,
  SdkTransportExecutor,
  SdkTransportOperationName,
} from "./types";

export type DefaultTransportOptions = {
  readonly apiBaseUrl?: string;
  readonly execute?: SdkTransportExecutor;
  readonly capabilities?: SdkTransportCapabilityMap;
  readonly integrationMode?: "backend001-compatibility" | "backend002" | "gateway-v1";
  /** Optional opaque Host credential provider for Gateway-v1 built-in requests. */
  readonly getAccessToken?: AssistantAccessTokenProvider;
};

type PortResult<T> = AssistantRuntimeTransportResult<T>;
type CompatibilityFetchRoute =
  | "createSession"
  | "getSession"
  | "loadHistory"
  | "streamMessage";
type GatewayFetchRoute = "createSession" | "getSession" | "loadHistory" | "streamMessage";

const COMPATIBILITY_API_PREFIX = "/api/v1";

function resolveCompatibilityApiBase(apiBaseUrl?: string): string {
  const configuredBase = apiBaseUrl?.trim();

  if (!configuredBase) {
    return COMPATIBILITY_API_PREFIX;
  }

  const isAbsoluteHttpUrl = /^https?:\/\//i.test(configuredBase);
  const isRootRelativePath = configuredBase.startsWith("/");

  // Keep endpoint configuration explicit and reject non-HTTP schemes.
  if (!isAbsoluteHttpUrl && !isRootRelativePath) {
    return COMPATIBILITY_API_PREFIX;
  }

  return configuredBase.replace(/\/+$/, "") || COMPATIBILITY_API_PREFIX;
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `sdk-request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readSessionId(input: { readonly sessionId?: string }): string | null {
  const sessionId = input.sessionId?.trim();
  return sessionId ? sessionId : null;
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

function gatewayJsonFailureCode(response: Response): Parameters<typeof toTransportFailure>[0] {
  if (response.status === 401) return "authentication_unavailable";
  if (response.status === 403) return "transport_forbidden";
  if (response.status === 404) return "session_not_found";
  return "transport_execution_failed";
}

async function normalizeGatewayJsonResponse<T>(response: Response): Promise<PortResult<T>> {
  if (!response.ok) {
    return toFailure(gatewayJsonFailureCode(response));
  }

  return await normalizeJsonResponse<T>(response);
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
  const sessionId = readSessionId(input);

  if (!sessionId) {
    return toFailure("missing_session_id");
  }
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
      sessionId,
      requestId,
    ),
  };
}

function buildSafeOperationExecutionInput(
  operation: SdkTransportOperationName,
  input: Readonly<Record<string, unknown>>,
): PortResult<SdkTransportExecutionInput> {
  const requestId = createRequestId();
  const sessionId = readSessionId(input);

  if (operation !== "createSession" && !sessionId) {
    return toFailure("missing_session_id");
  }
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
    value: createExecutionInput(operation, request, sessionId ?? "", requestId),
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

function getGatewayFetch(options: DefaultTransportOptions): typeof fetch | null {
  if (options.integrationMode !== "gateway-v1") {
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

function createCompatibilitySessionMessagesPath(apiBase: string, sessionId: string, cursor?: unknown): string {
  const encodedSessionId = encodeURIComponent(sessionId);
  const path = `${apiBase}/assistant/sessions/${encodedSessionId}/messages`;

  return typeof cursor === "string" && cursor.length > 0
    ? `${path}?cursor=${encodeURIComponent(cursor)}`
    : path;
}

function createCompatibilitySessionPath(apiBase: string, sessionId: string): string {
  return `${apiBase}/assistant/sessions/${encodeURIComponent(sessionId)}`;
}

function createGatewayHeaders(
  requestId: string,
  token: string,
  accept: "application/json" | "text/event-stream",
  contentType = false,
): HeadersInit {
  return {
    accept,
    authorization: `Bearer ${token}`,
    ...(contentType ? { "content-type": "application/json" } : {}),
    "x-request-id": requestId,
  };
}

function buildGatewayCreatePayload(
  request: Readonly<Record<string, unknown>>,
): PortResult<Readonly<Record<string, unknown>>> {
  if (request.pageContext === undefined) {
    return { ok: true, value: {} };
  }

  const sanitizedPageContext = sanitizePageContextForRequest(request.pageContext);

  if (!sanitizedPageContext.ok) {
    return toFailure("transport_execution_failed");
  }

  return {
    ok: true,
    value: { pageContext: sanitizedPageContext.pageContext },
  };
}

async function executeGatewayFetch<T>(
  options: DefaultTransportOptions,
  fetchImpl: typeof fetch,
  apiBase: string,
  route: GatewayFetchRoute,
  executionInput: SdkTransportExecutionInput,
  runtimeOptions?: AssistantRuntimeRequestOptions,
): Promise<PortResult<T>> {
  const accessToken = await resolveAccessToken(options.getAccessToken);

  if (!accessToken.ok) {
    return accessToken as PortResult<T>;
  }

  try {
    if (route === "createSession") {
      const payload = buildGatewayCreatePayload(executionInput.request);

      if (!payload.ok) {
        return payload as PortResult<T>;
      }

      return await normalizeGatewayJsonResponse<T>(await fetchImpl(
        `${apiBase}/assistant/sessions`,
        {
          body: JSON.stringify(payload.value),
          headers: createGatewayHeaders(executionInput.requestId, accessToken.token, "application/json", true),
          method: "POST",
          signal: runtimeOptions?.signal,
        },
      ));
    }

    if (route === "getSession") {
      return await normalizeGatewayJsonResponse<T>(await fetchImpl(
        createCompatibilitySessionPath(apiBase, executionInput.sessionId),
        {
          headers: createGatewayHeaders(executionInput.requestId, accessToken.token, "application/json"),
          method: "GET",
          signal: runtimeOptions?.signal,
        },
      ));
    }

    if (route === "loadHistory") {
      return await normalizeGatewayJsonResponse<T>(await fetchImpl(
        createCompatibilitySessionMessagesPath(apiBase, executionInput.sessionId, executionInput.request.cursor),
        {
          headers: createGatewayHeaders(executionInput.requestId, accessToken.token, "application/json"),
          method: "GET",
          signal: runtimeOptions?.signal,
        },
      ));
    }

    const response = await fetchImpl(
      createCompatibilitySessionMessagesPath(apiBase, executionInput.sessionId),
      {
        body: JSON.stringify(executionInput.request),
        headers: createGatewayHeaders(executionInput.requestId, accessToken.token, "text/event-stream", true),
        method: "POST",
        signal: runtimeOptions?.signal,
      },
    );

    return normalizeStreamResponse(response) as PortResult<T>;
  }
  catch {
    return toFailure("transport_execution_failed");
  }
}

async function executeCompatibilityFetch<T>(
  fetchImpl: typeof fetch,
  apiBase: string,
  route: CompatibilityFetchRoute,
  executionInput: SdkTransportExecutionInput,
  runtimeOptions?: AssistantRuntimeRequestOptions,
): Promise<PortResult<T>> {
  try {
    if (route === "createSession") {
      return await normalizeJsonResponse<T>(await fetchImpl(
        `${apiBase}/assistant/sessions`,
        createJsonRequestInit("POST", runtimeOptions, {}),
      ));
    }

    if (route === "getSession") {
      return await normalizeJsonResponse<T>(await fetchImpl(
        createCompatibilitySessionPath(apiBase, executionInput.sessionId),
        createJsonRequestInit("GET", runtimeOptions),
      ));
    }

    if (route === "loadHistory") {
      return await normalizeJsonResponse<T>(await fetchImpl(
        createCompatibilitySessionMessagesPath(apiBase, executionInput.sessionId, executionInput.request.cursor),
        createJsonRequestInit("GET", runtimeOptions),
      ));
    }

    const response = await fetchImpl(
      createCompatibilitySessionMessagesPath(apiBase, executionInput.sessionId),
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
    const gatewayFetch = getGatewayFetch(options);

    if (
      gatewayFetch
      && (
        operation === "createSession"
        || operation === "getSession"
        || operation === "loadHistory"
        || operation === "streamMessage"
      )
    ) {
      return await executeGatewayFetch<T>(
        options,
        gatewayFetch,
        resolveCompatibilityApiBase(options.apiBaseUrl),
        operation,
        executionInput,
        runtimeOptions,
      );
    }

    const compatibilityFetch = getCompatibilityFetch(options);

    if (
      compatibilityFetch
      && (
        operation === "createSession"
        || operation === "getSession"
        || operation === "loadHistory"
        || operation === "streamMessage"
      )
    ) {
      return await executeCompatibilityFetch<T>(
        compatibilityFetch,
        resolveCompatibilityApiBase(options.apiBaseUrl),
        operation,
        executionInput,
        runtimeOptions,
      );
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
  const integrationMode = options.integrationMode ?? "backend001-compatibility";
  const supportsRemoteRestoration = integrationMode === "backend001-compatibility" || integrationMode === "gateway-v1";
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

  async function getSession(
    input: AssistantRuntimeGetSessionInput,
    runtimeOptions?: AssistantRuntimeRequestOptions,
  ) {
    const executionInput = buildSafeOperationExecutionInput("getSession", input);

    return executionInput.ok
      ? executeOperation(options, "getSession", executionInput.value, runtimeOptions)
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

  const remoteRestoration = supportsRemoteRestoration
    ? { getSession, loadHistory }
    : {};

  return {
    abortMessage,
    cancelMessage,
    confirmAction,
    createSession,
    loadApprovalRequest,
    ...remoteRestoration,
    rejectAction,
    send,
    sendMessage,
    streamMessage,
    submitFeedback,
  } as const satisfies AssistantRuntimeTransportPort & {
    readonly send: typeof send;
  };
}
