import type {
  AssistantRuntimeCancelMessageInput,
  AssistantRuntimeCreateSessionInput,
  AssistantRuntimeHistory,
  AssistantRuntimeLoadHistoryInput,
  AssistantRuntimeRemoteRestorationCapability,
  AssistantRuntimeSession,
  AssistantRuntimeTransportPort,
} from "../transport/ports";
import {
  accumulateAssistantAnswerDelta,
} from "../sse";
import type {
  AssistantSession,
  AssistantSessionId,
  AssistantSseEvent,
  HistoryMessageSummary,
} from "../types";

export type AssistantSessionRecoveryReason =
  | "expired"
  | "closed"
  | "invisible"
  | "not_found"
  | "unavailable"
  | "unknown";

export type AssistantSessionCandidateSource =
  | "host_managed"
  | "session_storage";

export interface AssistantSessionRestoreCandidate {
  source: AssistantSessionCandidateSource;
  sessionId: AssistantSessionId;
  scopeKey: string;
}

export interface ResolveSessionRestoreCandidatesInput {
  scopeKey: string;
  hostManagedSessionId?: AssistantSessionId | null;
  storedSessionId?: AssistantSessionId | null;
}

export interface AssistantHistoryPageState {
  messages: readonly HistoryMessageSummary[];
  nextCursor: string | null;
}

export interface AssistantSessionHistoryOrchestrator {
  createSession(input?: AssistantRuntimeCreateSessionInput, options?: { signal?: AbortSignal }): Promise<AssistantRuntimeSession>;
  /** Adopt a session only after the caller has already remotely validated it. */
  adoptValidatedSession(sessionId: string, options?: { signal?: AbortSignal }): Promise<AssistantRuntimeSession>;
  loadHistory(input: AssistantRuntimeLoadHistoryInput, options?: { signal?: AbortSignal }): Promise<AssistantRuntimeHistory>;
  appendHistoryPage(current: AssistantHistoryPageState, page: AssistantHistoryPageState): AssistantHistoryPageState;
  accumulateDelta(current: string, event: AssistantSseEvent): string;
  retry<T>(
    operation: (options: { signal: AbortSignal }) => Promise<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T>;
  cancel(input: AssistantRuntimeCancelMessageInput, options?: { signal?: AbortSignal }): Promise<{ cancelled: true }>;
  abort(input: AssistantRuntimeCancelMessageInput, options?: { signal?: AbortSignal }): Promise<{ aborted: true }>;
  cleanup(): Promise<void>;
  getPendingOperationCount(): number;
}

const REUSABLE_SESSION_STATUSES = new Set(["active"]);

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNormalizedString(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim()
    ? normalizeValue(candidate)
    : null;
}

export function resolveSessionRestoreCandidates(
  input: ResolveSessionRestoreCandidatesInput,
): AssistantSessionRestoreCandidate[] {
  const candidates: AssistantSessionRestoreCandidate[] = [];
  const hostManagedSessionId = input.hostManagedSessionId?.trim();
  const storedSessionId = input.storedSessionId?.trim();

  if (hostManagedSessionId) {
    candidates.push({
      source: "host_managed",
      sessionId: input.hostManagedSessionId!,
      scopeKey: input.scopeKey,
    });
  }

  if (storedSessionId && storedSessionId !== hostManagedSessionId) {
    candidates.push({
      source: "session_storage",
      sessionId: input.storedSessionId!,
      scopeKey: input.scopeKey,
    });
  }

  return candidates;
}

export function isReusableAssistantSession(
  session: AssistantSession | null | undefined,
): boolean {
  return session !== null
    && session !== undefined
    && REUSABLE_SESSION_STATUSES.has(normalizeValue(session.status));
}

export function resolveSessionRecoveryReason(
  input: unknown,
): AssistantSessionRecoveryReason | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (!isRecord(input)) {
    return "unknown";
  }

  if (input.statusCode === 404) {
    return "not_found";
  }

  const code = readNormalizedString(input, "code");

  if (code === "not_found") {
    return "not_found";
  }

  if (code === "forbidden" || code === "permission_denied") {
    return "invisible";
  }

  if (code === "network_error" || code === "assistant_unavailable") {
    return "unavailable";
  }

  const status = readNormalizedString(input, "status");

  if (status && REUSABLE_SESSION_STATUSES.has(status)) {
    return null;
  }

  if (status === "closed") {
    return "closed";
  }

  if (status === "expired") {
    return "expired";
  }

  if (status === "archived" || status === "deleted" || status === "invisible") {
    return "invisible";
  }

  return "unknown";
}

export function shouldClearScopedSessionFallback(
  reason: AssistantSessionRecoveryReason | null,
): boolean {
  return reason === "not_found"
    || reason === "invisible"
    || reason === "closed"
    || reason === "expired";
}

export function appendAssistantHistoryPage(
  current: AssistantHistoryPageState,
  page: AssistantHistoryPageState,
): AssistantHistoryPageState {
  const knownMessageIds = new Set(current.messages.map(message => message.messageId));
  const nextMessages = [
    ...current.messages,
    ...page.messages.filter((message) => {
      if (knownMessageIds.has(message.messageId)) {
        return false;
      }

      knownMessageIds.add(message.messageId);
      return true;
    }),
  ];

  return {
    messages: nextMessages,
    nextCursor: page.nextCursor,
  };
}

function unwrapTransportResult<T>(result: { readonly ok: boolean; readonly value?: unknown; readonly error?: unknown }): T {
  if (result.ok) {
    return result.value as T;
  }

  throw result.error;
}

export function createAssistantSessionHistoryOrchestrator(input: {
  transport: Pick<AssistantRuntimeTransportPort, "createSession" | "cancelMessage" | "abortMessage">
    & Partial<AssistantRuntimeRemoteRestorationCapability>;
}): AssistantSessionHistoryOrchestrator {
  const pendingControllers = new Set<AbortController>();
  const externalAbortListeners = new Map<
    AbortController,
    { signal: AbortSignal; listener: () => void }
  >();

  function createTrackedController(signal?: AbortSignal): AbortController {
    const controller = new AbortController();
    pendingControllers.add(controller);

    if (signal) {
      if (signal.aborted) {
        controller.abort();
      }
      else {
        const listener = () => controller.abort();
        externalAbortListeners.set(controller, { signal, listener });
        signal.addEventListener("abort", listener, { once: true });
      }
    }

    return controller;
  }

  function cleanupTrackedController(controller: AbortController): void {
    const externalAbort = externalAbortListeners.get(controller);

    if (externalAbort) {
      externalAbort.signal.removeEventListener("abort", externalAbort.listener);
      externalAbortListeners.delete(controller);
    }

    pendingControllers.delete(controller);
  }

  async function runTrackedOperation<T>(
    operation: (options: { signal: AbortSignal }) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const controller = createTrackedController(signal);

    try {
      return await operation({ signal: controller.signal });
    }
    finally {
      cleanupTrackedController(controller);
    }
  }

  return {
    async createSession(createInput = {}, options = {}) {
      return runTrackedOperation(
        async trackedOptions => unwrapTransportResult<AssistantRuntimeSession>(
          await input.transport.createSession(createInput, trackedOptions),
        ),
        options.signal,
      );
    },
    async adoptValidatedSession(sessionId, options = {}) {
      return runTrackedOperation(
        async () => ({ sessionId, status: "active" }),
        options.signal,
      );
    },
    async loadHistory(loadInput, options = {}) {
      const loadHistory = input.transport.loadHistory;
      if (typeof loadHistory !== "function") {
        throw { code: "remote_restoration_unavailable" };
      }

      return runTrackedOperation(
        async trackedOptions => unwrapTransportResult<AssistantRuntimeHistory>(
          await loadHistory(loadInput, trackedOptions),
        ),
        options.signal,
      );
    },
    appendHistoryPage: appendAssistantHistoryPage,
    accumulateDelta: accumulateAssistantAnswerDelta,
    async retry(operation, options = {}) {
      return runTrackedOperation(operation, options.signal);
    },
    async cancel(cancelInput, options = {}) {
      return runTrackedOperation(
        async trackedOptions => unwrapTransportResult<{ cancelled: true }>(
          await input.transport.cancelMessage(cancelInput, trackedOptions),
        ),
        options.signal,
      );
    },
    async abort(abortInput, options = {}) {
      return runTrackedOperation(
        async trackedOptions => unwrapTransportResult<{ aborted: true }>(
          await input.transport.abortMessage(abortInput, trackedOptions),
        ),
        options.signal,
      );
    },
    async cleanup() {
      for (const controller of pendingControllers) {
        controller.abort();
        cleanupTrackedController(controller);
      }
      pendingControllers.clear();
      externalAbortListeners.clear();
    },
    getPendingOperationCount: () => pendingControllers.size,
  };
}
