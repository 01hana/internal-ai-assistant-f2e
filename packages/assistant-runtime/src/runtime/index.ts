import {
  completeActionDraftDetailLoadState,
  completeActionDraftOperationState,
  createDefaultActionDraftState,
  failActionDraftDetailLoadState,
  failActionDraftOperationState,
  setActionDraftOperationState,
  startActionDraftDetailLoadState,
  type ActionDraftDetail,
  type ActionDraftDetailState,
  type ActionDraftOperationStatus,
  type ActionDraftRecheck,
  type ActionDraftStatus,
} from "../actions";
import {
  completeApprovalRequestDetailLoadState,
  completeApprovalRequestOpenDetailState,
  createApprovalRequestLinkState,
  createDefaultApprovalRequestState,
  failApprovalRequestDetailLoadState,
  failApprovalRequestOpenDetailState,
  mergeApprovalRequestState,
  startApprovalRequestDetailLoadState,
  startApprovalRequestOpenDetailState,
  type ApprovalRequestDetailState,
  type ApprovalRequestSummary,
} from "../approvals";
import {
  normalizeEvidenceReferences,
} from "../evidence";
import {
  completeFeedbackSubmissionState,
  createDefaultFeedbackState,
  failFeedbackSubmissionState,
  startFeedbackSubmissionState,
  type AssistantMessageFeedbackUiState,
  type AssistantFeedbackValue,
} from "../feedback";
import {
  mapAnswerDecisionState,
} from "../outcomes";
import {
  createAssistantSessionHistoryOrchestrator,
} from "../session";
import {
  accumulateAssistantAnswerDelta,
  type AssistantSseStreamRunner,
} from "../sse";
import type {
  AssistantRuntimeSessionState,
  AssistantRuntimeStoreScope,
} from "../stores";
import {
  resetAssistantRuntimeSessionState,
  resetAssistantRuntimeWidgetState,
} from "../stores";
import type {
  ActionDraftId,
  ApprovalRequestId,
  AssistantMessageFinalData,
  AssistantMessageId,
  AssistantRequestId,
  AssistantSession,
  AssistantSseEvent,
  HistoryMessageSummary,
} from "../types";
import type {
  AssistantRuntimeLoadHistoryInput,
  AssistantRuntimeTransportPort,
} from "../transport/ports";

export type AssistantRuntimeStreamingTerminalStatus =
  | "completed"
  | "interrupted"
  | "failed"
  | "cancelled";

export type AssistantRuntimeStreamingStatus =
  | "idle"
  | "connecting"
  | "sending"
  | "queued"
  | "streaming"
  | "finalizing"
  | AssistantRuntimeStreamingTerminalStatus;

export interface AssistantRuntimeStreamingActivity {
  key: string;
  kind: string;
  sequence: number;
  label: string;
  toolCallId?: string;
}

export interface AssistantRuntimeStreamingMessage {
  key: string;
  kind: "assistant_streaming";
  requestId?: AssistantRequestId;
  messageId?: AssistantMessageId | null;
  role: "assistant";
  content: string;
  status: AssistantRuntimeStreamingStatus;
  createdAt: string;
  evidence: unknown[];
  lastSequence: number | null;
  pendingContent?: string;
  pendingFinalAnswerDecision?: AssistantMessageFinalData["answerDecision"];
  typingVisibleUntil?: number | null;
  activities?: AssistantRuntimeStreamingActivity[];
  finalAnswerDecision?: AssistantMessageFinalData["answerDecision"];
  finalDecisionState?: unknown;
}

type RuntimeMessage = HistoryMessageSummary | AssistantRuntimeStreamingMessage | Record<string, unknown>;
type AssistantNonFinalSseEvent = Exclude<AssistantSseEvent, { eventType: "final" }>;
type AssistantFinalSseEvent = Extract<AssistantSseEvent, { eventType: "final" }>;
type AssistantRuntimeClock = {
  setTimeout: (
    handler: Parameters<typeof globalThis.setTimeout>[0],
    timeout?: Parameters<typeof globalThis.setTimeout>[1],
  ) => ReturnType<typeof globalThis.setTimeout>;
  clearTimeout: (timer: ReturnType<typeof globalThis.setTimeout>) => void;
  Date: Pick<DateConstructor, "now">;
};

export interface AssistantRuntimeController<TMessage = RuntimeMessage> {
  runtimeScope: string;
  stores: AssistantRuntimeStoreScope<TMessage>;
  createSession(options?: { signal?: AbortSignal }): Promise<void>;
  loadHistory(input: AssistantRuntimeLoadHistoryInput, options?: { signal?: AbortSignal }): Promise<void>;
  appendHistoryPage(page: { messages: readonly HistoryMessageSummary[]; nextCursor: string | null }): void;
  accumulateDelta(current: string, event: AssistantSseEvent): string;
  setRestoring(): void;
  setCreating(): void;
  setLoadingHistory(mode?: "initial" | "more"): void;
  setReady(): void;
  setError(error: { code: string; safeMessage: string }, recoveryReason: string | null): void;
  setLastError(error: { code: string; safeMessage: string }, recoveryReason: string | null): void;
  clearError(): void;
  setSession(session: AssistantSession | null): void;
  setSessionScope(sessionScope: unknown | null): void;
  setContextReady(contextReady: boolean): void;
  setMessages(messages: readonly TMessage[], cursor: string | null): void;
  appendMessages(messages: readonly HistoryMessageSummary[], cursor: string | null): void;
  appendUserMessage(message: TMessage): void;
  prepareFeedbackSubmission(input: {
    messageId: AssistantMessageId;
    value: AssistantFeedbackValue;
    requestId?: AssistantRequestId | null;
  }): {
    allowed: boolean;
    reason?: "disposed" | "pending" | "unchanged";
    previousValue: AssistantFeedbackValue | null;
    linkedRequestId: AssistantRequestId | null;
  };
  getFeedbackState(messageId: AssistantMessageId): AssistantMessageFeedbackUiState;
  startFeedbackSubmission(messageId: AssistantMessageId, value: AssistantFeedbackValue, requestId: AssistantRequestId | null): void;
  completeFeedbackSubmission(messageId: AssistantMessageId, options?: { requestId?: AssistantRequestId | null }): void;
  failFeedbackSubmission(messageId: AssistantMessageId, previousValue: AssistantFeedbackValue | null, requestId: AssistantRequestId | null, safeMessage: string): void;
  getActionDraftState(actionDraftId: ActionDraftId): ActionDraftDetailState;
  prepareActionDraftDetailLoad(actionDraftId: ActionDraftId): { allowed: boolean; reason?: "disposed" | "loading" | "available" };
  prepareActionDraftConfirmation(actionDraftId: ActionDraftId): { allowed: boolean; reason?: "disposed" | "detail_unavailable" | "pending" | "terminal"; idempotencyKey: string | null };
  prepareActionDraftCancellation(actionDraftId: ActionDraftId): { allowed: boolean; reason?: "disposed" | "detail_unavailable" | "pending" | "terminal"; idempotencyKey: string | null };
  upsertActionDraftState(actionDraftId: ActionDraftId, nextState: Partial<ActionDraftDetailState>): void;
  startActionDraftDetailLoad(actionDraftId: ActionDraftId, options?: { messageId?: AssistantMessageId | null; requestId?: AssistantRequestId }): void;
  completeActionDraftDetailLoad(
    detail: ActionDraftDetail,
    options?: { requestId?: AssistantRequestId },
  ): void;
  failActionDraftDetailLoad(
    actionDraftId: ActionDraftId,
    safeMessage: string,
    options?: { requestId?: AssistantRequestId },
  ): void;
  setActionDraftOperationStatus(actionDraftId: ActionDraftId, operationStatus: ActionDraftOperationStatus, options?: { idempotencyKey?: string | null; safeMessage?: string }): void;
  completeActionDraftOperation(actionDraftId: ActionDraftId, nextStatus: ActionDraftStatus, options?: { recheck?: ActionDraftRecheck; idempotencyKey?: string | null }): void;
  failActionDraftOperation(actionDraftId: ActionDraftId, safeMessage: string, operationStatus?: Extract<ActionDraftOperationStatus, "failed">, options?: { idempotencyKey?: string | null }): void;
  getApprovalRequestState(approvalRequestId: ApprovalRequestId): ApprovalRequestDetailState;
  prepareApprovalRequestDetailLoad(approvalRequestId: ApprovalRequestId): { allowed: boolean; reason?: "disposed" | "loading" | "available" };
  prepareApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId): { allowed: boolean; reason?: "disposed" | "opening" };
  upsertApprovalRequestState(approvalRequestId: ApprovalRequestId, nextState: Partial<ApprovalRequestDetailState>): void;
  linkApprovalRequestMessage(messageId: AssistantMessageId, approvalRequestId: ApprovalRequestId): void;
  ensureApprovalRequestState(approvalRequestId: ApprovalRequestId, options?: { messageId?: AssistantMessageId; requestId?: AssistantRequestId; sessionId?: string | null }): void;
  startApprovalRequestDetailLoad(approvalRequestId: ApprovalRequestId, options?: { messageId?: AssistantMessageId; requestId?: AssistantRequestId; sessionId?: string | null }): void;
  completeApprovalRequestDetailLoad(detail: ApprovalRequestSummary): void;
  failApprovalRequestDetailLoad(approvalRequestId: ApprovalRequestId, safeMessage: string): void;
  startApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId): void;
  completeApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId): void;
  failApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId, safeMessage: string): void;
  appendAssistantStreamingPlaceholder(message: AssistantRuntimeStreamingMessage): void;
  setStreamingRequest(requestId: AssistantRequestId, assistantMessageKey: string): void;
  updateActiveStreamingStatus(status: AssistantRuntimeStreamingStatus): void;
  applyStreamingEvent(event: AssistantNonFinalSseEvent): void;
  recordUnknownStreamingEvent(requestId: AssistantRequestId, messageId: string, sequence: number): void;
  finalizeActiveStreamingMessage(event: AssistantFinalSseEvent): void;
  markStreamingStarted(): void;
  markStreamingCancelled(): void;
  markStreamingInterrupted(): void;
  markStreamingFailed(): void;
  markStreamingFinalizing(): void;
  clearStreamingState(): void;
  reset(): void;
  cleanup(): Promise<void>;
}

const MIN_TYPING_VISIBILITY_MS = 600;

const DEFAULT_TOOL_ACTIVITY = {
  tool_call_started: {
    kind: "tool_running",
    label: "正在查詢內部資料",
  },
  tool_call_completed: {
    kind: "tool_completed",
    label: "內部資料查詢完成",
  },
  tool_call_blocked: {
    kind: "tool_blocked",
    label: "內部資料查詢受到限制",
  },
  tool_call_failed: {
    kind: "tool_failed",
    label: "內部資料查詢未完成",
  },
} as const;

function isStreamingMessage(value: unknown): value is AssistantRuntimeStreamingMessage {
  return typeof value === "object"
    && value !== null
    && "kind" in value
    && value.kind === "assistant_streaming";
}

function createFinalDecisionStateInput(
  finalData: AssistantMessageFinalData,
): AssistantMessageFinalData {
  return {
    answerDecision: finalData.answerDecision,
    answer: finalData.answer,
    noAnswerReason: finalData.noAnswerReason,
    evidenceRefs: finalData.evidenceRefs,
    clarificationQuestionId: finalData.clarificationQuestionId,
    actionDraftId: finalData.actionDraftId,
    approvalRequestId: finalData.approvalRequestId,
    escalationRequestId: finalData.escalationRequestId,
  };
}

export function createUserRuntimeMessage(input: {
  requestId: AssistantRequestId;
  content: string;
  createdAt: string;
}) {
  const key = `local-user:${input.requestId}`;

  return {
    key,
    messageId: key,
    requestId: input.requestId,
    kind: "user" as const,
    role: "user" as const,
    content: input.content,
    createdAt: input.createdAt,
  };
}

export function createAssistantStreamingRuntimeMessage(input: {
  key: string;
  requestId: AssistantRequestId;
  createdAt: string;
  typingVisibleUntil?: number | null;
}): AssistantRuntimeStreamingMessage {
  return {
    key: input.key,
    requestId: input.requestId,
    kind: "assistant_streaming",
    role: "assistant",
    content: "",
    createdAt: input.createdAt,
    status: "sending",
    lastSequence: null,
    typingVisibleUntil: input.typingVisibleUntil,
    pendingContent: "",
    evidence: [],
    activities: [],
  };
}

export function resolveRetrySourceText(
  messages: readonly { role: string; content: string; key?: string; kind?: string; status?: string }[],
  messageKey: string,
): string | null {
  const targetIndex = messages.findIndex(
    message => message.key === messageKey,
  );

  if (targetIndex === -1) {
    return null;
  }

  const targetMessage = messages[targetIndex];
  if (!targetMessage?.kind) {
    return null;
  }

  if (
    targetMessage.kind === "assistant_streaming"
    && ["interrupted", "failed", "cancelled"].includes(targetMessage.status ?? "")
  ) {
    for (let index = targetIndex - 1; index >= 0; index -= 1) {
      const candidate = messages[index];
      if (candidate && candidate.role === "user" && candidate.content.trim()) {
        return candidate.content;
      }
    }

    return null;
  }

  if (targetMessage.kind === "degraded") {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = messages[index];
      if (candidate && candidate.role === "user" && candidate.content.trim()) {
        return candidate.content;
      }
    }
  }

  return null;
}

export function createSessionController<TMessage>(
  state: AssistantRuntimeSessionState<TMessage>,
  transport: Pick<AssistantRuntimeTransportPort, "createSession" | "loadHistory" | "cancelMessage" | "abortMessage">,
  lifecycle: { canMutate: () => boolean; captureVersion: () => number; isCurrentVersion: (version: number) => boolean },
) {
  const orchestrator = createAssistantSessionHistoryOrchestrator({ transport });

  return {
    async createSession(options: { signal?: AbortSignal } = {}) {
      const version = lifecycle.captureVersion();
      state.status.value = "creating";
      const session = await orchestrator.createSession({}, options);

      if (!lifecycle.canMutate() || !lifecycle.isCurrentVersion(version)) {
        return;
      }

      state.session.value = session;
      state.status.value = "ready";
    },
    async loadHistory(input: AssistantRuntimeLoadHistoryInput, options: { signal?: AbortSignal } = {}) {
      const version = lifecycle.captureVersion();
      state.status.value = "loading_history";
      state.historyLoading.value = true;
      const history = await orchestrator.loadHistory(input, options);

      if (!lifecycle.canMutate() || !lifecycle.isCurrentVersion(version)) {
        return;
      }

      state.messages.value = history.messages as TMessage[];
      state.nextCursor.value = history.cursor ?? null;
      state.historyLoading.value = false;
      state.status.value = "ready";
    },
    appendHistoryPage(page: { messages: readonly HistoryMessageSummary[]; nextCursor: string | null }) {
      const currentMessages = state.messages.value.filter(
        (message): message is TMessage =>
          typeof message === "object"
          && message !== null
          && "messageId" in message
          && !("kind" in message),
      ) as HistoryMessageSummary[];
      const merged = orchestrator.appendHistoryPage(
        {
          messages: currentMessages,
          nextCursor: state.nextCursor.value,
        },
        page,
      );
      const uiMessages = state.messages.value.filter(message =>
        typeof message === "object" && message !== null && "kind" in message,
      );

      state.messages.value = [...uiMessages, ...merged.messages] as TMessage[];
      state.nextCursor.value = merged.nextCursor;
    },
    cleanup: () => orchestrator.cleanup(),
  };
}

export function createStreamingController<TMessage>(
  state: AssistantRuntimeSessionState<TMessage>,
  input: {
    clock: AssistantRuntimeClock;
    canMutate: () => boolean;
  },
) {
  const pendingRevealTimers = new Map<AssistantRequestId, ReturnType<typeof setTimeout>>();

  function getActiveStreamingMessage(
    requestId?: AssistantRequestId | null,
  ): AssistantRuntimeStreamingMessage | null {
    const targetRequestId = requestId ?? state.activeRequestId.value;
    if (!targetRequestId || targetRequestId !== state.activeRequestId.value) {
      return null;
    }

    const message = state.messages.value.find(candidate =>
      isStreamingMessage(candidate)
      && candidate.key === state.activeAssistantMessageKey.value,
    );

    return isStreamingMessage(message) ? message : null;
  }

  function clearPendingRevealTimer(requestId: AssistantRequestId | null) {
    if (!requestId) {
      return;
    }

    const timer = pendingRevealTimers.get(requestId);
    if (timer) {
      input.clock.clearTimeout(timer);
      pendingRevealTimers.delete(requestId);
    }
  }

  function revealPendingStreamingContent(
    requestId?: AssistantRequestId | null,
    terminalStatus?: AssistantRuntimeStreamingTerminalStatus,
  ) {
    if (!input.canMutate()) {
      return;
    }

    const message = getActiveStreamingMessage(requestId);
    if (!message) {
      return;
    }

    if (message.pendingContent) {
      message.content = `${message.content}${message.pendingContent}`;
      message.pendingContent = "";
    }

    message.typingVisibleUntil = null;
    clearPendingRevealTimer(message.requestId ?? requestId ?? null);

    if (message.pendingFinalAnswerDecision) {
      message.finalAnswerDecision = message.pendingFinalAnswerDecision;
      message.pendingFinalAnswerDecision = undefined;
      message.status = "completed";
      if (requestId && state.activeRequestId.value === requestId) {
        state.activeRequestId.value = null;
        state.activeAssistantMessageKey.value = null;
      }
      return;
    }

    if (terminalStatus) {
      message.status = terminalStatus;
      return;
    }

    if (message.content.length > 0) {
      message.status = "streaming";
    }
  }

  function schedulePendingStreamingContentReveal(
    requestId: AssistantRequestId,
    message: AssistantRuntimeStreamingMessage,
  ) {
    const remaining = (message.typingVisibleUntil ?? 0) - input.clock.Date.now();

    if (remaining <= 0) {
      revealPendingStreamingContent(requestId);
      return;
    }

    if (pendingRevealTimers.has(requestId)) {
      return;
    }

    pendingRevealTimers.set(
      requestId,
      input.clock.setTimeout(() => {
        pendingRevealTimers.delete(requestId);
        revealPendingStreamingContent(requestId);
      }, remaining),
    );
  }

  function updateActiveStreamingStatus(nextStatus: AssistantRuntimeStreamingStatus) {
    const message = getActiveStreamingMessage();
    if (message && input.canMutate()) {
      message.status = nextStatus;
    }
  }

  function clearTimers() {
    for (const timer of pendingRevealTimers.values()) {
      input.clock.clearTimeout(timer);
    }
    pendingRevealTimers.clear();
  }

  return {
    accumulateDelta: accumulateAssistantAnswerDelta,
    getActiveStreamingMessage,
    appendAssistantStreamingPlaceholder(message: AssistantRuntimeStreamingMessage) {
      if (!input.canMutate()) {
        return;
      }

      message.typingVisibleUntil ??= input.clock.Date.now() + MIN_TYPING_VISIBILITY_MS;
      message.pendingContent ??= "";
      state.messages.value.push(message as TMessage);
    },
    setStreamingRequest(requestId: AssistantRequestId, assistantMessageKey: string) {
      if (!input.canMutate()) {
        return;
      }

      state.activeRequestId.value = requestId;
      state.activeAssistantMessageKey.value = assistantMessageKey;
    },
    updateActiveStreamingStatus,
    applyStreamingEvent(event: AssistantNonFinalSseEvent) {
      if (!input.canMutate()) {
        return;
      }

      const message = getActiveStreamingMessage(event.requestId);
      if (
        !message
        || (message.lastSequence !== null && event.sequence <= message.lastSequence)
      ) {
        return;
      }

      message.messageId = event.messageId;
      message.lastSequence = event.sequence;

      if (event.eventType === "answer_delta") {
        if ((message.typingVisibleUntil ?? 0) > input.clock.Date.now()) {
          message.pendingContent = `${message.pendingContent ?? ""}${event.data.delta}`;
          message.status = "streaming";
          schedulePendingStreamingContentReveal(event.requestId, message);
          return;
        }

        if (message.pendingContent) {
          message.content = `${message.content}${message.pendingContent}`;
          message.pendingContent = "";
        }

        message.typingVisibleUntil = null;
        clearPendingRevealTimer(event.requestId);
        message.content += event.data.delta;
        message.status = "streaming";
        return;
      }

      if (event.eventType === "evidence_attached") {
        const knownEvidenceIds = new Set(
          message.evidence
            .map(reference =>
              typeof reference === "object"
              && reference !== null
              && "id" in reference
              && typeof reference.id === "string"
                ? reference.id
                : null,
            )
            .filter((id): id is string => id !== null),
        );
        message.evidence.push(
          ...event.data.evidenceRefs
            .filter(id => !knownEvidenceIds.has(id))
            .map(id => ({
              kind: "reference" as const,
              id,
            })),
        );
        return;
      }

      if (
        event.eventType === "tool_call_started"
        || event.eventType === "tool_call_completed"
        || event.eventType === "tool_call_blocked"
        || event.eventType === "tool_call_failed"
      ) {
        const activity = DEFAULT_TOOL_ACTIVITY[event.eventType];
        const activities = message.activities ?? [];
        const activityKey = `tool:${event.data.toolCallId}`;
        const nextActivity = {
          key: activityKey,
          kind: activity.kind,
          sequence: event.sequence,
          label: activity.label,
          toolCallId: event.data.toolCallId,
        };
        const existingIndex = activities.findIndex(candidate => candidate.key === activityKey);

        if (existingIndex === -1) {
          activities.push(nextActivity);
        }
        else {
          activities.splice(existingIndex, 1, nextActivity);
        }

        message.activities = activities;
        return;
      }

      if (event.eventType === "error") {
        revealPendingStreamingContent(event.requestId, "failed");
        message.activities = [
          ...(message.activities ?? []),
          {
            key: `stream-error:${event.sequence}`,
            kind: "stream_error",
            sequence: event.sequence,
            label: "回應串流未能完成",
          },
        ];
      }
    },
    recordUnknownStreamingEvent(
      requestId: AssistantRequestId,
      messageId: string,
      sequence: number,
    ) {
      if (!input.canMutate()) {
        return;
      }

      const message = getActiveStreamingMessage(requestId);
      if (
        !message
        || (message.lastSequence !== null && sequence <= message.lastSequence)
      ) {
        return;
      }

      message.messageId = messageId;
      message.lastSequence = sequence;
      message.activities = [
        ...(message.activities ?? []),
        {
          key: `unknown:${sequence}`,
          kind: "unknown_event",
          sequence,
          label: "收到未識別的進度更新，已安全略過",
        },
      ];
    },
    finalizeActiveStreamingMessage(event: AssistantFinalSseEvent) {
      if (!input.canMutate()) {
        return;
      }

      const message = getActiveStreamingMessage(event.requestId);
      if (
        !message
        || (message.lastSequence !== null && event.sequence <= message.lastSequence)
      ) {
        return;
      }

      message.messageId = event.messageId;
      message.lastSequence = event.sequence;
      const nextContent = event.data.answer ?? message.content;
      const normalizedEvidence = normalizeEvidenceReferences(event.data.evidenceRefs);
      const finalDecisionState = mapAnswerDecisionState(
        createFinalDecisionStateInput(event.data),
      );

      if (
        (message.typingVisibleUntil ?? 0) > input.clock.Date.now()
        && message.content.length === 0
        && Boolean(message.pendingContent)
      ) {
        message.pendingContent = nextContent;
        message.pendingFinalAnswerDecision = event.data.answerDecision;
        message.evidence = normalizedEvidence;
        message.finalDecisionState = finalDecisionState;
        message.status = "finalizing";
        schedulePendingStreamingContentReveal(event.requestId, message);
        return;
      }

      if (message.pendingContent) {
        message.content = `${message.content}${message.pendingContent}`;
        message.pendingContent = "";
      }

      message.typingVisibleUntil = null;
      clearPendingRevealTimer(event.requestId);
      message.content = nextContent;
      message.evidence = normalizedEvidence;
      message.finalAnswerDecision = event.data.answerDecision;
      message.finalDecisionState = finalDecisionState;
      message.pendingFinalAnswerDecision = undefined;
      message.status = "completed";
    },
    markStreamingStarted() {
      updateActiveStreamingStatus("streaming");
    },
    markStreamingCancelled() {
      const message = getActiveStreamingMessage();
      if (message && message.status !== "completed") {
        revealPendingStreamingContent(message.requestId ?? state.activeRequestId.value, "cancelled");
      }
    },
    markStreamingInterrupted() {
      const message = getActiveStreamingMessage();
      if (
        message
        && message.status !== "completed"
        && message.status !== "failed"
      ) {
        revealPendingStreamingContent(message.requestId ?? state.activeRequestId.value, "interrupted");
      }
    },
    markStreamingFailed() {
      const message = getActiveStreamingMessage();
      if (message && message.status !== "completed") {
        revealPendingStreamingContent(message.requestId ?? state.activeRequestId.value, "failed");
      }
    },
    markStreamingFinalizing() {
      updateActiveStreamingStatus("finalizing");
    },
    clearStreamingState() {
      const message = getActiveStreamingMessage();
      if (
        message?.pendingFinalAnswerDecision
        && (message.typingVisibleUntil ?? 0) > input.clock.Date.now()
      ) {
        return;
      }

      clearPendingRevealTimer(state.activeRequestId.value);
      state.activeRequestId.value = null;
      state.activeAssistantMessageKey.value = null;
    },
    clearTimers,
    getPendingTimerCount: () => pendingRevealTimers.size,
  };
}

export function createFeedbackController<TMessage>(
  state: AssistantRuntimeSessionState<TMessage>,
  lifecycle: { canMutate: () => boolean; captureVersion: () => number; isCurrentVersion: (version: number) => boolean },
) {
  const pendingByMessageId = new Map<AssistantMessageId, { version: number; requestId: AssistantRequestId | null }>();

  function canComplete(messageId: AssistantMessageId, requestId?: AssistantRequestId | null): boolean {
    const pending = pendingByMessageId.get(messageId);

    if (!pending || !lifecycle.canMutate() || !lifecycle.isCurrentVersion(pending.version)) {
      return false;
    }

    return requestId === undefined || pending.requestId === requestId;
  }

  return {
    prepareFeedbackSubmission(input: {
      messageId: AssistantMessageId;
      value: AssistantFeedbackValue;
      requestId?: AssistantRequestId | null;
    }) {
      const currentState = state.feedbackByMessageId.value[input.messageId] ?? createDefaultFeedbackState();
      const linkedRequestId = input.requestId ?? currentState.requestId ?? null;

      if (!lifecycle.canMutate()) {
        return {
          allowed: false,
          reason: "disposed" as const,
          previousValue: currentState.value,
          linkedRequestId,
        };
      }

      if (currentState.pending) {
        return {
          allowed: false,
          reason: "pending" as const,
          previousValue: currentState.value,
          linkedRequestId,
        };
      }

      if (currentState.value === input.value && currentState.error === null) {
        return {
          allowed: false,
          reason: "unchanged" as const,
          previousValue: currentState.value,
          linkedRequestId,
        };
      }

      return {
        allowed: true,
        previousValue: currentState.value,
        linkedRequestId,
      };
    },
    getFeedbackState(messageId: AssistantMessageId) {
      return state.feedbackByMessageId.value[messageId] ?? createDefaultFeedbackState();
    },
    startFeedbackSubmission(
      messageId: AssistantMessageId,
      value: AssistantFeedbackValue,
      requestId: AssistantRequestId | null,
    ) {
      if (!lifecycle.canMutate()) {
        return;
      }

      pendingByMessageId.set(messageId, {
        version: lifecycle.captureVersion(),
        requestId,
      });
      state.feedbackByMessageId.value = {
        ...state.feedbackByMessageId.value,
        [messageId]: startFeedbackSubmissionState(value, requestId),
      };
    },
    completeFeedbackSubmission(messageId: AssistantMessageId, options: { requestId?: AssistantRequestId | null } = {}) {
      if (!canComplete(messageId, options.requestId)) {
        return;
      }

      pendingByMessageId.delete(messageId);
      state.feedbackByMessageId.value = {
        ...state.feedbackByMessageId.value,
        [messageId]: completeFeedbackSubmissionState(
          state.feedbackByMessageId.value[messageId] ?? createDefaultFeedbackState(),
        ),
      };
    },
    failFeedbackSubmission(
      messageId: AssistantMessageId,
      previousValue: AssistantFeedbackValue | null,
      requestId: AssistantRequestId | null,
      safeMessage: string,
    ) {
      if (!canComplete(messageId, requestId)) {
        return;
      }

      pendingByMessageId.delete(messageId);
      state.feedbackByMessageId.value = {
        ...state.feedbackByMessageId.value,
        [messageId]: failFeedbackSubmissionState({
          previousValue,
          requestId,
          safeMessage,
        }),
      };
    },
    clearPending: () => pendingByMessageId.clear(),
  };
}

export function createActionController<TMessage>(
  state: AssistantRuntimeSessionState<TMessage>,
  lifecycle: { canMutate: () => boolean; captureVersion: () => number; isCurrentVersion: (version: number) => boolean },
  idGenerator: () => AssistantRequestId,
) {
  const pendingDetailById = new Map<
    ActionDraftId,
    { version: number; requestId?: AssistantRequestId }
  >();
  const pendingOperationById = new Map<ActionDraftId, { version: number; idempotencyKey: string | null }>();

  function getActionDraftState(actionDraftId: ActionDraftId): ActionDraftDetailState {
    return state.actionDraftById.value[actionDraftId] ?? createDefaultActionDraftState(actionDraftId);
  }

  function setActionDraftState(actionDraftId: ActionDraftId, nextState: ActionDraftDetailState) {
    if (!lifecycle.canMutate()) {
      return;
    }

    state.actionDraftById.value = {
      ...state.actionDraftById.value,
      [actionDraftId]: nextState,
    };
  }

  function canCompleteDetail(
    actionDraftId: ActionDraftId,
    requestId?: AssistantRequestId,
  ): boolean {
    const pending = pendingDetailById.get(actionDraftId);

    if (!pending || !lifecycle.canMutate()) {
      return false;
    }

    if (!lifecycle.isCurrentVersion(pending.version)) {
      return false;
    }

    return pending.requestId === undefined || pending.requestId === requestId;
  }

  function canCompleteOperation(
    actionDraftId: ActionDraftId,
    idempotencyKey?: string | null,
  ): boolean {
    const pending = pendingOperationById.get(actionDraftId);

    if (!pending || !lifecycle.canMutate()) {
      return false;
    }

    if (!lifecycle.isCurrentVersion(pending.version)) {
      return false;
    }

    return pending.idempotencyKey === (idempotencyKey ?? null);
  }

  function prepareActionDraftOperation(actionDraftId: ActionDraftId, operation: "confirming" | "cancelling") {
    const currentState = getActionDraftState(actionDraftId);

    if (!lifecycle.canMutate()) {
      return { allowed: false, reason: "disposed" as const, idempotencyKey: null };
    }

    if (currentState.detailStatus !== "available") {
      return { allowed: false, reason: "detail_unavailable" as const, idempotencyKey: null };
    }

    if (
      currentState.operationStatus === "confirming"
      || currentState.operationStatus === "cancelling"
      || currentState.operationStatus === "pending_execution_guard"
    ) {
      return { allowed: false, reason: "pending" as const, idempotencyKey: currentState.idempotencyKey ?? null };
    }

    if (
      currentState.operationStatus === "submitted"
      || currentState.operationStatus === "executed"
      || currentState.operationStatus === "cancelled"
      || currentState.operationStatus === "expired"
      || currentState.actionDraftStatus === "cancelled"
      || currentState.actionDraftStatus === "expired"
      || currentState.actionDraftStatus === "executed"
      || currentState.actionDraftStatus === "failed"
    ) {
      return { allowed: false, reason: "terminal" as const, idempotencyKey: currentState.idempotencyKey ?? null };
    }

    const idempotencyKey = operation === "confirming"
      ? idGenerator()
      : currentState.idempotencyKey ?? idGenerator();

    return { allowed: true, idempotencyKey };
  }

  return {
    getActionDraftState,
    prepareActionDraftDetailLoad(actionDraftId: ActionDraftId) {
      const currentState = getActionDraftState(actionDraftId);

      if (!lifecycle.canMutate()) {
        return { allowed: false, reason: "disposed" as const };
      }

      if (currentState.detailStatus === "loading") {
        return { allowed: false, reason: "loading" as const };
      }

      if (currentState.detailStatus === "available") {
        return { allowed: false, reason: "available" as const };
      }

      return { allowed: true };
    },
    prepareActionDraftConfirmation: (actionDraftId: ActionDraftId) =>
      prepareActionDraftOperation(actionDraftId, "confirming"),
    prepareActionDraftCancellation: (actionDraftId: ActionDraftId) =>
      prepareActionDraftOperation(actionDraftId, "cancelling"),
    upsertActionDraftState(actionDraftId: ActionDraftId, nextState: Partial<ActionDraftDetailState>) {
      setActionDraftState(actionDraftId, {
        ...getActionDraftState(actionDraftId),
        ...nextState,
      });
    },
    startActionDraftDetailLoad(
      actionDraftId: ActionDraftId,
      options: { messageId?: AssistantMessageId | null; requestId?: AssistantRequestId } = {},
    ) {
      if (!lifecycle.canMutate()) {
        return;
      }

      pendingDetailById.set(actionDraftId, {
        version: lifecycle.captureVersion(),
        requestId: options.requestId,
      });
      setActionDraftState(
        actionDraftId,
        startActionDraftDetailLoadState(getActionDraftState(actionDraftId), options),
      );
    },
    completeActionDraftDetailLoad(
      detail: ActionDraftDetail,
      options: { requestId?: AssistantRequestId } = {},
    ) {
      if (!canCompleteDetail(
        detail.actionDraftId,
        options.requestId ?? detail.requestId,
      )) {
        return;
      }

      pendingDetailById.delete(detail.actionDraftId);
      setActionDraftState(
        detail.actionDraftId,
        completeActionDraftDetailLoadState(getActionDraftState(detail.actionDraftId), detail),
      );
    },
    failActionDraftDetailLoad(
      actionDraftId: ActionDraftId,
      safeMessage: string,
      options: { requestId?: AssistantRequestId } = {},
    ) {
      if (!canCompleteDetail(actionDraftId, options.requestId)) {
        return;
      }

      pendingDetailById.delete(actionDraftId);
      setActionDraftState(
        actionDraftId,
        failActionDraftDetailLoadState(getActionDraftState(actionDraftId), safeMessage),
      );
    },
    setActionDraftOperationStatus(
      actionDraftId: ActionDraftId,
      operationStatus: ActionDraftOperationStatus,
      options: { idempotencyKey?: string | null; safeMessage?: string } = {},
    ) {
      if (!lifecycle.canMutate()) {
        return;
      }

      if (operationStatus === "confirming" || operationStatus === "cancelling") {
        pendingOperationById.set(actionDraftId, {
          version: lifecycle.captureVersion(),
          idempotencyKey: options.idempotencyKey ?? null,
        });
      }
      setActionDraftState(
        actionDraftId,
        setActionDraftOperationState(getActionDraftState(actionDraftId), operationStatus, options),
      );
    },
    completeActionDraftOperation(
      actionDraftId: ActionDraftId,
      nextStatus: ActionDraftStatus,
      options: { recheck?: ActionDraftRecheck; idempotencyKey?: string | null } = {},
    ) {
      if (!canCompleteOperation(actionDraftId, options.idempotencyKey)) {
        return;
      }

      pendingOperationById.delete(actionDraftId);
      setActionDraftState(
        actionDraftId,
        completeActionDraftOperationState(getActionDraftState(actionDraftId), nextStatus, options),
      );
    },
    failActionDraftOperation(
      actionDraftId: ActionDraftId,
      safeMessage: string,
      operationStatus: Extract<ActionDraftOperationStatus, "failed"> = "failed",
      options: { idempotencyKey?: string | null } = {},
    ) {
      if (!canCompleteOperation(actionDraftId, options.idempotencyKey)) {
        return;
      }

      pendingOperationById.delete(actionDraftId);
      setActionDraftState(
        actionDraftId,
        failActionDraftOperationState(getActionDraftState(actionDraftId), safeMessage, operationStatus),
      );
    },
    clearPending() {
      pendingDetailById.clear();
      pendingOperationById.clear();
    },
  };
}

export function createApprovalController<TMessage>(
  state: AssistantRuntimeSessionState<TMessage>,
  lifecycle: { canMutate: () => boolean; captureVersion: () => number; isCurrentVersion: (version: number) => boolean },
) {
  const pendingDetailById = new Map<ApprovalRequestId, { version: number }>();
  const pendingOpenById = new Map<ApprovalRequestId, { version: number }>();

  function getApprovalRequestState(approvalRequestId: ApprovalRequestId): ApprovalRequestDetailState {
    return state.approvalRequestById.value[approvalRequestId]
      ?? createDefaultApprovalRequestState(approvalRequestId);
  }

  function setApprovalRequestState(
    approvalRequestId: ApprovalRequestId,
    nextState: ApprovalRequestDetailState,
  ) {
    if (!lifecycle.canMutate()) {
      return;
    }

    state.approvalRequestById.value = {
      ...state.approvalRequestById.value,
      [approvalRequestId]: nextState,
    };
  }

  function linkApprovalRequestMessage(
    messageId: AssistantMessageId,
    approvalRequestId: ApprovalRequestId,
  ) {
    if (!lifecycle.canMutate()) {
      return;
    }

    state.approvalRequestMessageLinks.value = {
      ...state.approvalRequestMessageLinks.value,
      [messageId]: approvalRequestId,
    };
  }

  function ensureApprovalRequestState(
    approvalRequestId: ApprovalRequestId,
    options: {
      messageId?: AssistantMessageId;
      requestId?: AssistantRequestId;
      sessionId?: string | null;
    } = {},
  ) {
    if (!lifecycle.canMutate()) {
      return;
    }

    setApprovalRequestState(
      approvalRequestId,
      mergeApprovalRequestState(
        getApprovalRequestState(approvalRequestId),
        createApprovalRequestLinkState(options),
      ),
    );

    if (options.messageId) {
      linkApprovalRequestMessage(options.messageId, approvalRequestId);
    }
  }

  return {
    getApprovalRequestState,
    prepareApprovalRequestDetailLoad(approvalRequestId: ApprovalRequestId) {
      const currentState = getApprovalRequestState(approvalRequestId);

      if (!lifecycle.canMutate()) {
        return { allowed: false, reason: "disposed" as const };
      }

      if (currentState.detailStatus === "loading") {
        return { allowed: false, reason: "loading" as const };
      }

      if (currentState.detailStatus === "available") {
        return { allowed: false, reason: "available" as const };
      }

      return { allowed: true };
    },
    prepareApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId) {
      const currentState = getApprovalRequestState(approvalRequestId);

      if (!lifecycle.canMutate()) {
        return { allowed: false, reason: "disposed" as const };
      }

      if (currentState.openDetailStatus === "opening") {
        return { allowed: false, reason: "opening" as const };
      }

      return { allowed: true };
    },
    upsertApprovalRequestState(
      approvalRequestId: ApprovalRequestId,
      nextState: Partial<ApprovalRequestDetailState>,
    ) {
      setApprovalRequestState(
        approvalRequestId,
        mergeApprovalRequestState(getApprovalRequestState(approvalRequestId), nextState),
      );
    },
    linkApprovalRequestMessage,
    ensureApprovalRequestState,
    startApprovalRequestDetailLoad(
      approvalRequestId: ApprovalRequestId,
      options: { messageId?: AssistantMessageId; requestId?: AssistantRequestId; sessionId?: string | null } = {},
    ) {
      if (!lifecycle.canMutate()) {
        return;
      }

      ensureApprovalRequestState(approvalRequestId, options);
      pendingDetailById.set(approvalRequestId, {
        version: lifecycle.captureVersion(),
      });
      setApprovalRequestState(
        approvalRequestId,
        startApprovalRequestDetailLoadState(getApprovalRequestState(approvalRequestId)),
      );
    },
    completeApprovalRequestDetailLoad(detail: ApprovalRequestSummary) {
      const pending = pendingDetailById.get(detail.approvalRequestId);
      if (!pending || !lifecycle.canMutate() || !lifecycle.isCurrentVersion(pending.version)) {
        return;
      }

      pendingDetailById.delete(detail.approvalRequestId);
      ensureApprovalRequestState(detail.approvalRequestId, {
        messageId: detail.messageId,
        requestId: detail.requestId,
        sessionId: detail.sessionId ?? null,
      });
      setApprovalRequestState(
        detail.approvalRequestId,
        completeApprovalRequestDetailLoadState(
          getApprovalRequestState(detail.approvalRequestId),
          detail,
        ),
      );
    },
    failApprovalRequestDetailLoad(approvalRequestId: ApprovalRequestId, safeMessage: string) {
      const pending = pendingDetailById.get(approvalRequestId);
      if (!pending || !lifecycle.canMutate() || !lifecycle.isCurrentVersion(pending.version)) {
        return;
      }

      pendingDetailById.delete(approvalRequestId);
      setApprovalRequestState(
        approvalRequestId,
        failApprovalRequestDetailLoadState(getApprovalRequestState(approvalRequestId), safeMessage),
      );
    },
    startApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId) {
      if (!lifecycle.canMutate()) {
        return;
      }

      pendingOpenById.set(approvalRequestId, {
        version: lifecycle.captureVersion(),
      });
      setApprovalRequestState(
        approvalRequestId,
        startApprovalRequestOpenDetailState(getApprovalRequestState(approvalRequestId)),
      );
    },
    completeApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId) {
      const pending = pendingOpenById.get(approvalRequestId);
      if (!pending || !lifecycle.canMutate() || !lifecycle.isCurrentVersion(pending.version)) {
        return;
      }

      pendingOpenById.delete(approvalRequestId);
      setApprovalRequestState(
        approvalRequestId,
        completeApprovalRequestOpenDetailState(getApprovalRequestState(approvalRequestId)),
      );
    },
    failApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId, safeMessage: string) {
      const pending = pendingOpenById.get(approvalRequestId);
      if (!pending || !lifecycle.canMutate() || !lifecycle.isCurrentVersion(pending.version)) {
        return;
      }

      pendingOpenById.delete(approvalRequestId);
      setApprovalRequestState(
        approvalRequestId,
        failApprovalRequestOpenDetailState(getApprovalRequestState(approvalRequestId), safeMessage),
      );
    },
    clearPending() {
      pendingDetailById.clear();
      pendingOpenById.clear();
    },
  };
}

export function createAssistantRuntimeController<TMessage = RuntimeMessage>(
  input: {
    runtimeScope: string;
    stores: AssistantRuntimeStoreScope<TMessage>;
    transport: Pick<
      AssistantRuntimeTransportPort,
      "createSession" | "loadHistory" | "cancelMessage" | "abortMessage"
    >;
    sseRunner?: AssistantSseStreamRunner<unknown>;
    clock?: Partial<Omit<AssistantRuntimeClock, "Date">> & { Date?: Pick<DateConstructor, "now"> };
    idGenerator?: () => AssistantRequestId;
  },
): AssistantRuntimeController<TMessage> {
  if (input.stores.runtimeScope !== input.runtimeScope) {
    throw new Error("assistant_runtime_scope_mismatch");
  }

  const clock: AssistantRuntimeClock = {
    setTimeout: input.clock?.setTimeout ?? ((handler, timeout) => globalThis.setTimeout(handler, timeout)),
    clearTimeout: input.clock?.clearTimeout ?? (timer => globalThis.clearTimeout(timer)),
    Date: input.clock?.Date ?? { now: () => globalThis.Date.now() },
  };
  let disposed = false;
  let lifecycleVersion = 0;
  const lifecycle = {
    canMutate: () => !disposed,
    captureVersion: () => lifecycleVersion,
    isCurrentVersion: (version: number) => version === lifecycleVersion,
  };
  const idGenerator = input.idGenerator ?? (() => `runtime:${clock.Date.now()}` as AssistantRequestId);
  const session = createSessionController(input.stores.session, input.transport, lifecycle);
  const streaming = createStreamingController(input.stores.session, {
    clock,
    canMutate: lifecycle.canMutate,
  });
  const feedback = createFeedbackController(input.stores.session, lifecycle);
  const actions = createActionController(input.stores.session, lifecycle, idGenerator);
  const approvals = createApprovalController(input.stores.session, lifecycle);

  function mutate(callback: () => void) {
    if (!disposed) {
      callback();
    }
  }

  function resetState() {
    streaming.clearTimers();
    resetAssistantRuntimeSessionState(input.stores.session);
  }

  function resetAllState() {
    resetState();
    resetAssistantRuntimeWidgetState(input.stores.widget);
  }

  return {
    runtimeScope: input.runtimeScope,
    stores: input.stores,
    createSession: session.createSession,
    loadHistory: session.loadHistory,
    appendHistoryPage: session.appendHistoryPage,
    accumulateDelta: streaming.accumulateDelta,
    setRestoring() {
      mutate(() => {
        resetState();
        input.stores.session.status.value = "restoring";
      });
    },
    setCreating() {
      mutate(() => {
        input.stores.session.status.value = "creating";
        input.stores.session.historyLoading.value = false;
        input.stores.session.historyLoadingMore.value = false;
      });
    },
    setLoadingHistory(mode = "initial") {
      mutate(() => {
        input.stores.session.status.value = "loading_history";
        input.stores.session.historyLoading.value = mode === "initial";
        input.stores.session.historyLoadingMore.value = mode === "more";
      });
    },
    setReady() {
      mutate(() => {
        input.stores.session.status.value = "ready";
        input.stores.session.historyLoading.value = false;
        input.stores.session.historyLoadingMore.value = false;
      });
    },
    setError(error, recoveryReason) {
      mutate(() => {
        input.stores.session.status.value = "error";
        input.stores.session.historyLoading.value = false;
        input.stores.session.historyLoadingMore.value = false;
        input.stores.session.lastError.value = error;
        input.stores.session.recoveryReason.value = recoveryReason;
      });
    },
    setLastError(error, recoveryReason) {
      mutate(() => {
        input.stores.session.lastError.value = error;
        input.stores.session.recoveryReason.value = recoveryReason;
      });
    },
    clearError() {
      mutate(() => {
        input.stores.session.lastError.value = null;
        input.stores.session.recoveryReason.value = null;
      });
    },
    setSession(nextSession) {
      mutate(() => {
        input.stores.session.session.value = nextSession;
      });
    },
    setSessionScope(nextSessionScope) {
      mutate(() => {
        input.stores.session.sessionScope.value = nextSessionScope;
      });
    },
    setContextReady(nextContextReady) {
      mutate(() => {
        input.stores.session.contextReady.value = nextContextReady;
      });
    },
    setMessages(nextMessages, cursor) {
      mutate(() => {
        input.stores.session.messages.value = [...nextMessages] as TMessage[];
        input.stores.session.nextCursor.value = cursor;
      });
    },
    appendMessages(nextMessages, cursor) {
      session.appendHistoryPage({ messages: nextMessages, nextCursor: cursor });
    },
    appendUserMessage(message) {
      mutate(() => {
        input.stores.session.messages.value.push(message);
      });
    },
    prepareFeedbackSubmission: feedback.prepareFeedbackSubmission,
    getFeedbackState: feedback.getFeedbackState,
    startFeedbackSubmission: feedback.startFeedbackSubmission,
    completeFeedbackSubmission: feedback.completeFeedbackSubmission,
    failFeedbackSubmission: feedback.failFeedbackSubmission,
    getActionDraftState: actions.getActionDraftState,
    prepareActionDraftDetailLoad: actions.prepareActionDraftDetailLoad,
    prepareActionDraftConfirmation: actions.prepareActionDraftConfirmation,
    prepareActionDraftCancellation: actions.prepareActionDraftCancellation,
    upsertActionDraftState: actions.upsertActionDraftState,
    startActionDraftDetailLoad: actions.startActionDraftDetailLoad,
    completeActionDraftDetailLoad: actions.completeActionDraftDetailLoad,
    failActionDraftDetailLoad: actions.failActionDraftDetailLoad,
    setActionDraftOperationStatus: actions.setActionDraftOperationStatus,
    completeActionDraftOperation: actions.completeActionDraftOperation,
    failActionDraftOperation: actions.failActionDraftOperation,
    getApprovalRequestState: approvals.getApprovalRequestState,
    prepareApprovalRequestDetailLoad: approvals.prepareApprovalRequestDetailLoad,
    prepareApprovalRequestOpenDetail: approvals.prepareApprovalRequestOpenDetail,
    upsertApprovalRequestState: approvals.upsertApprovalRequestState,
    linkApprovalRequestMessage: approvals.linkApprovalRequestMessage,
    ensureApprovalRequestState: approvals.ensureApprovalRequestState,
    startApprovalRequestDetailLoad: approvals.startApprovalRequestDetailLoad,
    completeApprovalRequestDetailLoad: approvals.completeApprovalRequestDetailLoad,
    failApprovalRequestDetailLoad: approvals.failApprovalRequestDetailLoad,
    startApprovalRequestOpenDetail: approvals.startApprovalRequestOpenDetail,
    completeApprovalRequestOpenDetail: approvals.completeApprovalRequestOpenDetail,
    failApprovalRequestOpenDetail: approvals.failApprovalRequestOpenDetail,
    appendAssistantStreamingPlaceholder: streaming.appendAssistantStreamingPlaceholder,
    setStreamingRequest: streaming.setStreamingRequest,
    updateActiveStreamingStatus: streaming.updateActiveStreamingStatus,
    applyStreamingEvent: streaming.applyStreamingEvent,
    recordUnknownStreamingEvent: streaming.recordUnknownStreamingEvent,
    finalizeActiveStreamingMessage(event) {
      streaming.finalizeActiveStreamingMessage(event);
      if (event.data.answerDecision === "confirmation_required" && event.data.actionDraftId) {
        actions.upsertActionDraftState(event.data.actionDraftId, {
          requestId: event.requestId,
          messageId: event.messageId,
        });
      }

      if (event.data.answerDecision === "approval_required" && event.data.approvalRequestId) {
        approvals.ensureApprovalRequestState(event.data.approvalRequestId, {
          messageId: event.messageId,
          requestId: event.requestId,
          sessionId: event.sessionId,
        });
      }
    },
    markStreamingStarted: streaming.markStreamingStarted,
    markStreamingCancelled: streaming.markStreamingCancelled,
    markStreamingInterrupted: streaming.markStreamingInterrupted,
    markStreamingFailed: streaming.markStreamingFailed,
    markStreamingFinalizing: streaming.markStreamingFinalizing,
    clearStreamingState: streaming.clearStreamingState,
    reset() {
      lifecycleVersion += 1;
      disposed = false;
      feedback.clearPending();
      actions.clearPending();
      approvals.clearPending();
      resetAllState();
    },
    async cleanup() {
      if (disposed) {
        return;
      }

      disposed = true;
      lifecycleVersion += 1;
      await session.cleanup();
      await input.sseRunner?.reset();
      feedback.clearPending();
      actions.clearPending();
      approvals.clearPending();
      resetAllState();
    },
  };
}
