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
  const buildResult = buildAssistantRequest({
    hostContext: input.pageContext === undefined
      ? undefined
      : { pageContext: input.pageContext },
    integrationMode: integrationMode ?? "backend001-compatibility",
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

async function executeOperation<T>(
  options: DefaultTransportOptions,
  operation: SdkTransportOperationName | "send",
  executionInput: SdkTransportExecutionInput,
  runtimeOptions?: AssistantRuntimeRequestOptions,
): Promise<PortResult<T>> {
  const executor = selectExecutor(options, operation);

  if (typeof executor !== "function") {
    return toFailure("transport_unavailable");
  }

  try {
    return normalizeExecutorResult<T>(await executor(executionInput, runtimeOptions));
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
