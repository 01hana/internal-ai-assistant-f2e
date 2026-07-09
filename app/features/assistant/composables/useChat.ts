import { createHttpClient } from "../../../services";
import { AssistantService } from "../../../services/api/assistant";
import type {
  ActionDraftId,
  ApprovalRequestId,
  AssistantFeedbackValue,
  AssistantHostContextProvider,
  AssistantHostContextReadPurpose,
  AssistantHostContextSnapshot,
  AssistantMessageId,
  AssistantRequestId,
  AssistantSessionScope,
  AssistantStreamingUiMessage,
  OpenApprovalDetailPayload,
  FeedbackRequest,
  ResolvedAssistantIdentityHeaders,
  UserUiMessage,
} from "../../../types/assistant";
import { resolveDefaultSessionScope } from "../../../utils/assistant/defaultSessionScopeResolver";
import { generateAssistantRequestId } from "../../../utils/assistant/requestIdGenerator";
import type { AssistantSessionRecoveryReason } from "../../../utils/assistant/sessionRecovery";

export interface UseChatOptions {
  hostContextProvider?: AssistantHostContextProvider;
}

export interface AssistantSendContextReader {
  getLatestSnapshot: (
    purpose: AssistantHostContextReadPurpose,
  ) => Promise<AssistantHostContextSnapshot>;
}

export interface ResolvedAssistantSendContext {
  snapshot: AssistantHostContextSnapshot;
  scope: AssistantSessionScope;
}

export async function resolveLatestAssistantSendContext(
  hostContext: AssistantSendContextReader,
  purpose: Extract<AssistantHostContextReadPurpose, "send" | "retry">,
): Promise<ResolvedAssistantSendContext> {
  const snapshot = await hostContext.getLatestSnapshot(purpose);
  const scope = resolveDefaultSessionScope({
    pageContext: snapshot.pageContext,
    identityHeaders: snapshot.identityHeaders,
    sessionScopeOverride: snapshot.sessionScopeOverride,
  });

  return {
    snapshot,
    scope,
  };
}

export type AssistantSendDisabledReason =
  | "panel_closed"
  | "context_not_ready"
  | "session_not_ready"
  | "bootstrapping"
  | "streaming"
  | "empty_message"
  | "degraded"
  | "unavailable"
  | "scope_changed";

const TERMINAL_RECOVERY_REASONS = new Set<AssistantSessionRecoveryReason>([
  "expired",
  "closed",
  "invisible",
  "not_found",
]);

const FEEDBACK_ERROR_MESSAGE = "回饋暫時無法送出，請稍後再試。";
const ACTION_DRAFT_DETAIL_ERROR_MESSAGE = "目前無法載入確認內容，請稍後再試。";
const ACTION_DRAFT_CONFIRM_ERROR_MESSAGE = "目前無法送出確認，請稍後再試。";
const ACTION_DRAFT_CANCEL_ERROR_MESSAGE = "目前無法取消這個操作，請稍後再試。";
const APPROVAL_REQUEST_DETAIL_ERROR_MESSAGE = "目前無法載入審核摘要，請稍後再試。";
const APPROVAL_REQUEST_OPEN_DETAIL_UNAVAILABLE_MESSAGE =
  "這個環境尚未提供審核詳情入口。";
const APPROVAL_REQUEST_OPEN_DETAIL_ERROR_MESSAGE =
  "目前無法開啟審核詳情，請稍後再試。";

function mapFeedbackValueToRequest(
  value: AssistantFeedbackValue,
): FeedbackRequest {
  if (value === "helpful") {
    return {
      rating: "positive",
      intent: "other",
    };
  }

  return {
    rating: "negative",
    intent: "not_helpful",
  };
}

export function useChat(options: UseChatOptions = {}) {
  const widgetStore = useChatWidgetStore();
  const hostContextProvider =
    options.hostContextProvider ?? useAssistantHostContextAdapter();
  const hostContext = useAssistantHostContext(hostContextProvider);
  const config = useRuntimeConfig();
  const assistantService = new AssistantService({
    httpClient: createHttpClient({
      baseURL: config.public.apiBase || "/api/v1",
    }),
  });
  const assistantSession = useAssistantSession({
    hostContext,
    assistantService,
    terminalRecoveryMode: "manual_restart",
  });
  const sessionStore = assistantSession.store;
  const {
    messages,
    nextCursor,
    historyLoading,
    historyLoadingMore,
    contextReady,
    recoveryReason,
    activeRequestId,
    feedbackByMessageId,
    actionDraftById,
    approvalRequestById,
  } = storeToRefs(sessionStore);

  const scopeChanged = ref(false);
  const sendInFlight = ref(false);
  const stream = useAssistantSseStream({
    assistantService,
    callbacks: {
      onEvent: (event) => {
        if (event.eventType !== "final") {
          sessionStore.applyStreamingEvent(event);
        }
      },
      onUnknownEvent: ({ event }) => {
        sessionStore.recordUnknownStreamingEvent(
          event.requestId,
          event.messageId,
          event.sequence,
        );
      },
      onFinal: (event) => {
        sessionStore.finalizeActiveStreamingMessage(event);
        if (
          event.data.answerDecision === "confirmation_required"
          && event.data.actionDraftId
        ) {
          void loadActionDraftDetail(event.data.actionDraftId, {
            messageId: event.messageId,
            requestId: event.requestId,
          });
        }
        if (
          event.data.answerDecision === "approval_required"
          && event.data.approvalRequestId
        ) {
          void loadApprovalRequestDetail(event.data.approvalRequestId, {
            messageId: event.messageId,
            requestId: event.requestId,
            sessionId: event.sessionId,
          });
        }
      },
      onComplete: () => {
        sessionStore.clearStreamingState();
      },
      onAbort: () => {
        sessionStore.markStreamingCancelled();
        sessionStore.clearStreamingState();
      },
      onInterrupted: () => {
        sessionStore.markStreamingInterrupted();
        sessionStore.clearStreamingState();
      },
      onTimeout: () => {
        sessionStore.markStreamingFailed();
        sessionStore.clearStreamingState();
      },
      onTransportError: () => {
        sessionStore.markStreamingFailed();
        sessionStore.clearStreamingState();
      },
    },
  });

  let bootstrapTask: Promise<void> | null = null;

  const isBootstrapping = computed(
    () =>
      sessionStore.status === "restoring" ||
      sessionStore.status === "creating" ||
      (sessionStore.status === "loading_history" &&
        !sessionStore.historyLoadingMore),
  );
  const sessionReady = computed(
    () => sessionStore.status === "ready" && sessionStore.sessionId !== null,
  );
  const isStreaming = stream.isStreaming;
  const isSending = computed(
    () => sendInFlight.value || activeRequestId.value !== null,
  );
  const sendDisabledReason = computed<AssistantSendDisabledReason | null>(
    () => {
      if (scopeChanged.value) {
        return "scope_changed";
      }

      if (!widgetStore.isOpen) {
        return "panel_closed";
      }

      if (widgetStore.availability === "degraded") {
        return "degraded";
      }

      if (widgetStore.availability === "unavailable") {
        return "unavailable";
      }

      if (!contextReady.value) {
        return "context_not_ready";
      }

      if (isBootstrapping.value) {
        return "bootstrapping";
      }

      if (!sessionReady.value) {
        return "session_not_ready";
      }

      if (isSending.value || isStreaming.value) {
        return "streaming";
      }

      return null;
    },
  );
  const canSend = computed(() => sendDisabledReason.value === null);
  const recoveryState = computed(() => {
    if (
      !contextReady.value ||
      sessionStore.status !== "error" ||
      !recoveryReason.value ||
      !TERMINAL_RECOVERY_REASONS.has(recoveryReason.value)
    ) {
      return null;
    }

    return {
      reason: recoveryReason.value,
    };
  });
  const canOpenApprovalDetail = computed(() =>
    Boolean(hostContext.snapshot.value.onOpenApprovalDetail),
  );

  watch(
    hostContext.readiness,
    (readiness) => {
      const ready = readiness.status === "ready";
      sessionStore.setContextReady(ready);

      if (readiness.status === "degraded") {
        widgetStore.setAvailability("degraded");
      } else {
        widgetStore.setAvailability(ready ? "normal" : "context_not_ready");
      }
    },
    { immediate: true },
  );

  watch(
    messages,
    (nextMessages) => {
      for (const message of nextMessages) {
        if (
          "kind" in message
          || message.role !== "assistant"
          || message.answerDecision !== "approval_required"
          || !message.approvalRequestId
        ) {
          continue;
        }

        const currentState = sessionStore.getApprovalRequestState(
          message.approvalRequestId,
        );
        if (currentState.detailStatus === "idle") {
          void loadApprovalRequestDetail(message.approvalRequestId, {
            messageId: message.messageId,
            requestId: currentState.requestId,
            sessionId: currentState.sessionId ?? sessionStore.sessionId,
          });
        }
      }
    },
    { deep: true },
  );

  async function bootstrapOnPanelOpen(): Promise<void> {
    if (!widgetStore.isOpen || sessionReady.value) {
      return;
    }

    if (
      recoveryReason.value &&
      TERMINAL_RECOVERY_REASONS.has(recoveryReason.value)
    ) {
      return;
    }

    if (bootstrapTask) {
      return bootstrapTask;
    }

    bootstrapTask = assistantSession.restoreOrCreateSession();

    try {
      await bootstrapTask;
    } finally {
      bootstrapTask = null;
    }
  }

  async function loadMoreHistory(): Promise<void> {
    if (!nextCursor.value || historyLoadingMore.value) {
      return;
    }

    await assistantSession.loadMoreHistory();
  }

  async function restartSession(): Promise<void> {
    if (isBootstrapping.value) {
      return;
    }

    scopeChanged.value = false;
    await assistantSession.restartSession();
  }

  async function sendMessageWithPurpose(
    text: string,
    purpose: "send" | "retry",
  ): Promise<boolean> {
    const normalizedText = text.trim();

    if (
      !normalizedText ||
      !widgetStore.isOpen ||
      sendInFlight.value ||
      isStreaming.value
    ) {
      return false;
    }

    if (!contextReady.value) {
      return false;
    }

    sendInFlight.value = true;

    try {
      if (!sessionReady.value) {
        await bootstrapOnPanelOpen();
      }

      const sessionId = sessionStore.sessionId;
      if (!sessionReady.value || !sessionId) {
        return false;
      }

      const { snapshot: latestSnapshot, scope: latestScope } =
        await resolveLatestAssistantSendContext(hostContext, purpose);
      if (
        latestSnapshot.readiness.status !== "ready" ||
        !latestSnapshot.identityHeaders
      ) {
        sessionStore.setContextReady(false);
        widgetStore.setAvailability("context_not_ready");
        return false;
      }

      if (latestScope.key !== sessionStore.sessionScope?.key) {
        scopeChanged.value = true;
        return false;
      }

      const requestId = generateAssistantRequestId();
      const identityHeaders = {
        ...latestSnapshot.identityHeaders,
        "x-request-id": requestId,
      } satisfies ResolvedAssistantIdentityHeaders;
      const createdAt = new Date().toISOString();
      const userMessageKey = `local-user:${requestId}`;
      const assistantMessageKey = `stream:${requestId}`;
      const userMessage = {
        key: userMessageKey,
        messageId: userMessageKey,
        requestId,
        kind: "user",
        role: "user",
        content: normalizedText,
        createdAt,
      } satisfies UserUiMessage;
      const assistantPlaceholder = {
        key: assistantMessageKey,
        requestId,
        kind: "assistant_streaming",
        role: "assistant",
        content: "",
        createdAt,
        status: "sending",
        lastSequence: null,
        typingVisibleUntil: Date.now() + 600,
        pendingContent: "",
        evidence: [],
        activities: [],
      } satisfies AssistantStreamingUiMessage;

      sessionStore.appendUserMessage(userMessage);
      sessionStore.appendAssistantStreamingPlaceholder(assistantPlaceholder);
      sessionStore.setStreamingRequest(requestId, assistantMessageKey);
      sessionStore.markStreamingStarted();

      await stream.start({
        sessionId,
        request: latestSnapshot.pageContext
          ? {
              message: normalizedText,
              pageContext: latestSnapshot.pageContext,
            }
          : {
              message: normalizedText,
            },
        options: {
          identityHeaders,
        },
      });

      return true;
    } finally {
      sendInFlight.value = false;
    }
  }

  async function sendMessage(text: string): Promise<boolean> {
    return sendMessageWithPurpose(text, "send");
  }

  async function resendMessage(text: string): Promise<boolean> {
    scopeChanged.value = false;
    return sendMessageWithPurpose(text, "retry");
  }

  async function retryLastMessage(): Promise<boolean> {
    const latestUserMessage = [...messages.value]
      .reverse()
      .find((message) => message.role === "user" && message.content.trim());

    if (!latestUserMessage) {
      return false;
    }

    return resendMessage(latestUserMessage.content);
  }

  async function cancelStream(): Promise<void> {
    await stream.cancel();
  }

  async function getActionDraftIdentityHeaders(): Promise<ResolvedAssistantIdentityHeaders | null> {
    const snapshot = await hostContext.getLatestSnapshot("send");

    if (snapshot.readiness.status !== "ready" || !snapshot.identityHeaders) {
      return null;
    }

    return {
      ...snapshot.identityHeaders,
      "x-request-id": generateAssistantRequestId(),
    } satisfies ResolvedAssistantIdentityHeaders;
  }

  async function getApprovalRequestIdentityHeaders(): Promise<ResolvedAssistantIdentityHeaders | null> {
    const snapshot = await hostContext.getLatestSnapshot("approval_detail");

    if (snapshot.readiness.status !== "ready" || !snapshot.identityHeaders) {
      return null;
    }

    return {
      ...snapshot.identityHeaders,
      "x-request-id": generateAssistantRequestId(),
    } satisfies ResolvedAssistantIdentityHeaders;
  }

  async function loadActionDraftDetail(
    actionDraftId: ActionDraftId,
    options: {
      messageId?: string;
      requestId?: string;
    } = {},
  ): Promise<boolean> {
    const currentState = sessionStore.getActionDraftState(actionDraftId);
    if (
      currentState.detailStatus === "loading"
      || currentState.detailStatus === "available"
    ) {
      return currentState.detailStatus === "available";
    }

    sessionStore.startActionDraftDetailLoad(actionDraftId, options);

    try {
      const identityHeaders = await getActionDraftIdentityHeaders();
      if (!identityHeaders) {
        sessionStore.failActionDraftDetailLoad(
          actionDraftId,
          ACTION_DRAFT_DETAIL_ERROR_MESSAGE,
        );
        return false;
      }

      const response = await assistantService.getActionDraft(actionDraftId, {
        identityHeaders,
      });
      sessionStore.completeActionDraftDetailLoad(response.data);
      return true;
    }
    catch {
      sessionStore.failActionDraftDetailLoad(
        actionDraftId,
        ACTION_DRAFT_DETAIL_ERROR_MESSAGE,
      );
      return false;
    }
  }

  async function loadApprovalRequestDetail(
    approvalRequestId: ApprovalRequestId,
    options: {
      messageId?: string;
      requestId?: string;
      sessionId?: string | null;
    } = {},
  ): Promise<boolean> {
    const currentState = sessionStore.getApprovalRequestState(approvalRequestId);
    if (
      currentState.detailStatus === "loading"
      || currentState.detailStatus === "available"
    ) {
      return currentState.detailStatus === "available";
    }

    sessionStore.startApprovalRequestDetailLoad(approvalRequestId, options);

    try {
      const identityHeaders = await getApprovalRequestIdentityHeaders();
      if (!identityHeaders) {
        sessionStore.failApprovalRequestDetailLoad(
          approvalRequestId,
          APPROVAL_REQUEST_DETAIL_ERROR_MESSAGE,
        );
        return false;
      }

      const response = await assistantService.getApprovalRequest(
        approvalRequestId,
        {
          identityHeaders,
        },
      );
      sessionStore.completeApprovalRequestDetailLoad(response.data);
      return true;
    }
    catch {
      sessionStore.failApprovalRequestDetailLoad(
        approvalRequestId,
        APPROVAL_REQUEST_DETAIL_ERROR_MESSAGE,
      );
      return false;
    }
  }

  async function confirmActionDraft(actionDraftId: ActionDraftId): Promise<boolean> {
    const currentState = sessionStore.getActionDraftState(actionDraftId);

    if (
      currentState.detailStatus !== "available"
      || currentState.operationStatus === "confirming"
      || currentState.operationStatus === "cancelling"
      || currentState.operationStatus === "pending_execution_guard"
      || currentState.operationStatus === "submitted"
      || currentState.operationStatus === "executed"
      || currentState.operationStatus === "cancelled"
      || currentState.operationStatus === "expired"
      || currentState.actionDraftStatus === "cancelled"
      || currentState.actionDraftStatus === "expired"
      || currentState.actionDraftStatus === "executed"
      || currentState.actionDraftStatus === "failed"
    ) {
      return false;
    }

    const idempotencyKey = generateAssistantRequestId({ prefix: "confirm" });
    sessionStore.setActionDraftOperationStatus(actionDraftId, "confirming", {
      idempotencyKey,
      safeMessage: undefined,
    });

    try {
      const identityHeaders = await getActionDraftIdentityHeaders();
      if (!identityHeaders) {
        sessionStore.failActionDraftOperation(
          actionDraftId,
          ACTION_DRAFT_CONFIRM_ERROR_MESSAGE,
        );
        return false;
      }

      const response = await assistantService.confirmActionDraft(
        actionDraftId,
        {
          idempotencyKey,
        },
        {
          identityHeaders,
        },
      );
      sessionStore.completeActionDraftOperation(
        actionDraftId,
        response.data.status,
        {
          recheck: response.data.recheck,
          idempotencyKey,
        },
      );
      return true;
    }
    catch {
      sessionStore.failActionDraftOperation(
        actionDraftId,
        ACTION_DRAFT_CONFIRM_ERROR_MESSAGE,
      );
      return false;
    }
  }

  async function cancelActionDraft(actionDraftId: ActionDraftId): Promise<boolean> {
    const currentState = sessionStore.getActionDraftState(actionDraftId);

    if (
      currentState.detailStatus !== "available"
      || currentState.operationStatus === "confirming"
      || currentState.operationStatus === "cancelling"
      || currentState.operationStatus === "pending_execution_guard"
      || currentState.operationStatus === "submitted"
      || currentState.operationStatus === "executed"
      || currentState.operationStatus === "cancelled"
      || currentState.operationStatus === "expired"
      || currentState.actionDraftStatus === "cancelled"
      || currentState.actionDraftStatus === "expired"
      || currentState.actionDraftStatus === "executed"
      || currentState.actionDraftStatus === "failed"
    ) {
      return false;
    }

    sessionStore.setActionDraftOperationStatus(actionDraftId, "cancelling", {
      idempotencyKey: currentState.idempotencyKey ?? null,
      safeMessage: undefined,
    });

    try {
      const identityHeaders = await getActionDraftIdentityHeaders();
      if (!identityHeaders) {
        sessionStore.failActionDraftOperation(
          actionDraftId,
          ACTION_DRAFT_CANCEL_ERROR_MESSAGE,
        );
        return false;
      }

      const response = await assistantService.cancelActionDraft(
        actionDraftId,
        {
          identityHeaders,
        },
      );
      sessionStore.completeActionDraftOperation(
        actionDraftId,
        response.data.status,
        {
          idempotencyKey: currentState.idempotencyKey ?? null,
        },
      );
      return true;
    }
    catch {
      sessionStore.failActionDraftOperation(
        actionDraftId,
        ACTION_DRAFT_CANCEL_ERROR_MESSAGE,
      );
      return false;
    }
  }

  async function submitFeedback(input: {
    messageId: AssistantMessageId;
    value: AssistantFeedbackValue;
    requestId?: AssistantRequestId | null;
  }): Promise<boolean> {
    const currentState = sessionStore.getFeedbackState(input.messageId);

    if (currentState.pending) {
      return false;
    }

    if (currentState.value === input.value && currentState.error === null) {
      return false;
    }

    const previousValue = currentState.value;
    const linkedRequestId = input.requestId ?? currentState.requestId ?? null;

    sessionStore.startFeedbackSubmission(
      input.messageId,
      input.value,
      linkedRequestId,
    );

    try {
      const snapshot = await hostContext.getLatestSnapshot("send");

      if (
        snapshot.readiness.status !== "ready"
        || !snapshot.identityHeaders
      ) {
        throw new Error("feedback context not ready");
      }

      const identityHeaders = {
        ...snapshot.identityHeaders,
        "x-request-id": generateAssistantRequestId(),
      } satisfies ResolvedAssistantIdentityHeaders;

      await assistantService.submitFeedback(
        input.messageId,
        mapFeedbackValueToRequest(input.value),
        {
          identityHeaders,
        },
      );

      sessionStore.completeFeedbackSubmission(input.messageId);
      return true;
    }
    catch {
      sessionStore.failFeedbackSubmission(
        input.messageId,
        previousValue,
        linkedRequestId,
        FEEDBACK_ERROR_MESSAGE,
      );
      return false;
    }
  }

  async function openApprovalDetail(
    payload: OpenApprovalDetailPayload,
  ): Promise<void> {
    sessionStore.ensureApprovalRequestState(payload.approvalRequestId, {
      messageId: payload.messageId,
      requestId: payload.requestId,
      sessionId: payload.sessionId,
    });

    const latest = await hostContext.getLatestSnapshot("approval_detail");

    if (!latest.onOpenApprovalDetail) {
      sessionStore.failApprovalRequestOpenDetail(
        payload.approvalRequestId,
        APPROVAL_REQUEST_OPEN_DETAIL_UNAVAILABLE_MESSAGE,
      );
      return;
    }

    const previousError = hostContext.lastError.value;
    sessionStore.startApprovalRequestOpenDetail(payload.approvalRequestId);

    await hostContext.openApprovalDetail(payload);

    const nextError = hostContext.lastError.value;
    if (nextError !== null && nextError !== previousError) {
      sessionStore.failApprovalRequestOpenDetail(
        payload.approvalRequestId,
        APPROVAL_REQUEST_OPEN_DETAIL_ERROR_MESSAGE,
      );
      return;
    }

    sessionStore.completeApprovalRequestOpenDetail(payload.approvalRequestId);
  }

  return {
    isBootstrapping,
    sessionReady,
    isSending,
    isStreaming,
    canSend,
    sendDisabledReason,
    messages,
    nextCursor,
    historyLoading,
    historyLoadingMore,
    contextReady,
    feedbackByMessageId,
    actionDraftById,
    approvalRequestById,
    recoveryState,
    canOpenApprovalDetail,
    bootstrapOnPanelOpen,
    loadMoreHistory,
    restartSession,
    sendMessage,
    resendMessage,
    retryLastMessage,
    cancelStream,
    loadActionDraftDetail,
    loadApprovalRequestDetail,
    confirmActionDraft,
    cancelActionDraft,
    submitFeedback,
    openApprovalDetail,
  };
}
