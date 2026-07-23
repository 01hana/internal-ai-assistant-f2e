import {
  createAssistantSessionHistoryOrchestrator,
  type AssistantSessionHistoryOrchestrator,
} from "../../../assistant-runtime/src/session";
import type {
  AssistantRuntimeCancelMessageInput,
  AssistantRuntimeCreateSessionInput,
  AssistantRuntimeHistory,
  AssistantRuntimeLoadHistoryInput,
  AssistantRuntimeSession,
  AssistantRuntimeTransportPort,
  AssistantRuntimeTransportResult,
} from "../../../assistant-runtime/src/transport/ports";

type LifecycleState = Readonly<Record<string, unknown>>;

type LifecycleTransition = {
  readonly from?: LifecycleState;
  readonly to?: LifecycleState;
};

type LifecycleResources = {
  readonly cancelHistoryLoading?: () => unknown;
  readonly cleanupSse?: () => unknown;
  readonly disconnectObserver?: () => unknown;
  readonly removeListener?: () => unknown;
  readonly suppressCallback?: () => unknown;
  readonly timerId?: ReturnType<typeof setTimeout> | number;
};

type SessionLifecycleTransport = Pick<
  AssistantRuntimeTransportPort,
  "abortMessage" | "cancelMessage" | "createSession" | "loadHistory"
>;

type SdkSessionLifecycleAdapterOptions = {
  readonly instanceId?: string;
  readonly namespace?: string;
  readonly resources?: LifecycleResources;
  readonly transport?: SessionLifecycleTransport;
};

const cleanupFields = [
  "hostApp",
  "organizationId",
  "entityType",
  "entityId",
  "pageIdentity",
  "sessionScope",
] as const;

function safeCall(callback: (() => unknown) | undefined) {
  try {
    callback?.();
  } catch {
    // Cleanup is best-effort and must not leak host/runtime errors.
  }
}

function clearTimer(timerId: LifecycleResources["timerId"]) {
  if (timerId === undefined) {
    return;
  }

  try {
    clearTimeout(timerId);
  } catch {
    // Non-browser fake timer IDs used by tests should remain harmless.
  }
}

function createInstanceId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `sdk-instance-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function transportUnavailable<T>(): AssistantRuntimeTransportResult<T> {
  return {
    error: {
      code: "transport_unavailable",
      message: "integration error",
      userMessage: "integration error",
    },
    ok: false,
  };
}

function transportExecutionFailed<T>(): AssistantRuntimeTransportResult<T> {
  return {
    error: {
      code: "transport_execution_failed",
      message: "integration error",
      userMessage: "integration error",
    },
    ok: false,
  };
}

function createUnsupportedTransport(): SessionLifecycleTransport {
  return {
    abortMessage: async () => transportUnavailable<{ aborted: true }>(),
    cancelMessage: async () => transportUnavailable<{ cancelled: true }>(),
    createSession: async () => transportUnavailable<AssistantRuntimeSession>(),
    loadHistory: async () => transportUnavailable<AssistantRuntimeHistory>(),
  };
}

async function toSafeResult<T>(
  operation: () => Promise<T>,
  isCurrent: () => boolean,
): Promise<AssistantRuntimeTransportResult<T>> {
  try {
    const value = await operation();

    if (!isCurrent()) {
      return transportExecutionFailed<T>();
    }

    return {
      ok: true,
      value,
    };
  }
  catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && typeof (error as { readonly code?: unknown }).code === "string"
    ) {
      return {
        error: {
          ...(error as { readonly code: string; readonly message?: string; readonly userMessage?: string }),
          message: (error as { readonly message?: string }).message ?? "integration error",
        },
        ok: false,
      };
    }

    return transportExecutionFailed<T>();
  }
}

export function createSessionLifecycleCoordinator(options: {
  readonly resources?: LifecycleResources;
} = {}) {
  const resources = options.resources;
  let cleanupDone = false;

  return {
    cleanup(_reason: string) {
      if (cleanupDone) {
        return;
      }

      cleanupDone = true;
      safeCall(resources?.cleanupSse);
      safeCall(resources?.cancelHistoryLoading);
      safeCall(resources?.removeListener);
      safeCall(resources?.disconnectObserver);
      safeCall(resources?.suppressCallback);
      clearTimer(resources?.timerId);
    },
    requiresCleanup(input: LifecycleTransition) {
      if (!input.from || !input.to) {
        return true;
      }

      const from = input.from;
      const to = input.to;

      return cleanupFields.some(field => from[field] === undefined || to[field] === undefined || from[field] !== to[field]);
    },
  };
}

export function createSdkSessionLifecycleAdapter(options: SdkSessionLifecycleAdapterOptions = {}) {
  const coordinator = createSessionLifecycleCoordinator({
    resources: options.resources,
  });
  const orchestrator: AssistantSessionHistoryOrchestrator = createAssistantSessionHistoryOrchestrator({
    transport: options.transport ?? createUnsupportedTransport(),
  });
  let lifecycleVersion = 0;
  let cleanupDone = false;

  function captureLifecycleVersion() {
    return lifecycleVersion;
  }

  function isCurrentLifecycleVersion(version: number) {
    return !cleanupDone && version === lifecycleVersion;
  }

  async function cleanup(reason = "destroyed") {
    if (cleanupDone) {
      return;
    }

    cleanupDone = true;
    lifecycleVersion += 1;
    coordinator.cleanup(reason);
    await orchestrator.cleanup();
  }

  function runTracked<T>(operation: () => Promise<T>) {
    const version = captureLifecycleVersion();

    return toSafeResult(operation, () => isCurrentLifecycleVersion(version));
  }

  return {
    instanceId: options.instanceId ?? createInstanceId(),
    namespace: options.namespace,
    abortMessage(input: AssistantRuntimeCancelMessageInput, requestOptions?: { signal?: AbortSignal }) {
      return runTracked(() => orchestrator.abort(input, requestOptions));
    },
    cancelMessage(input: AssistantRuntimeCancelMessageInput, requestOptions?: { signal?: AbortSignal }) {
      return runTracked(() => orchestrator.cancel(input, requestOptions));
    },
    captureLifecycleVersion,
    cleanup,
    createSession(input: AssistantRuntimeCreateSessionInput = {}, requestOptions?: { signal?: AbortSignal }) {
      return runTracked(() => orchestrator.createSession(input, requestOptions));
    },
    getPendingOperationCount: orchestrator.getPendingOperationCount,
    isCurrentLifecycleVersion,
    loadHistory(input: AssistantRuntimeLoadHistoryInput, requestOptions?: { signal?: AbortSignal }) {
      return runTracked(() => orchestrator.loadHistory(input, requestOptions));
    },
    requiresCleanup: coordinator.requiresCleanup,
  };
}
