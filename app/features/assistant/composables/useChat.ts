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
  ResolvedAssistantIdentityHeaders,
  UserUiMessage,
} from "../../../types/assistant";
import { resolveDefaultSessionScope } from "../../../utils/assistant/defaultSessionScopeResolver";
import { generateAssistantRequestId } from "../../../utils/assistant/requestIdGenerator";
import type { AssistantSessionRecoveryReason } from "../../../utils/assistant/sessionRecovery";
import {
  mapFeedbackValueToRequest,
  createUserRuntimeMessage,
  createAssistantStreamingRuntimeMessage,
  resolveRetrySourceText as resolveRuntimeRetrySourceText,
} from "../../../../packages/assistant-runtime/src";
import type { AssistantRuntimeController } from "../../../../packages/assistant-runtime/src";
import { getCurrentScope, onScopeDispose } from "vue";

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
const DEGRADED_MESSAGE = {
  safeTitle: "助理服務暫時不穩定",
  content: "目前無法完成這次回覆，請稍後再試。",
} as const;
const UNAVAILABLE_MESSAGE = {
  safeTitle: "助理暫時無法使用",
  content: "目前無法完成這次回覆，請稍後再試。",
} as const;

const runtimeControllerConsumers = new WeakMap<
  AssistantRuntimeController<unknown>,
  number
>();

function registerRuntimeControllerConsumer(
  runtimeController: AssistantRuntimeController<unknown>,
  onLastConsumerDispose?: () => Promise<void> | void,
) {
  if (!getCurrentScope()) {
    return;
  }

  const currentConsumers = runtimeControllerConsumers.get(runtimeController) ?? 0;
  if (currentConsumers === 0) {
    runtimeController.reset();
  }

  runtimeControllerConsumers.set(runtimeController, currentConsumers + 1);

  onScopeDispose(() => {
    const nextConsumers = (runtimeControllerConsumers.get(runtimeController) ?? 1) - 1;

    if (nextConsumers > 0) {
      runtimeControllerConsumers.set(runtimeController, nextConsumers);
      return;
    }

    runtimeControllerConsumers.delete(runtimeController);
    void Promise.resolve(onLastConsumerDispose?.())
      .finally(() => runtimeController.cleanup());
  });
}

function syncLatestAvailabilityState(
  snapshot: AssistantHostContextSnapshot,
  sessionStore: ReturnType<typeof useAssistantSessionStore>,
  widgetStore: ReturnType<typeof useChatWidgetStore>,
) {
  const ready = snapshot.readiness.status === "ready";
  const hasIdentityHeaders = Boolean(snapshot.identityHeaders);
  const hasPageContext = Boolean(snapshot.pageContext);

  if (ready && hasIdentityHeaders && hasPageContext) {
    sessionStore.setContextReady(true);
    sessionStore.clearDegradedMessage();
    widgetStore.setAvailability("normal");
    return {
      canProceed: true,
    };
  }

  if (snapshot.readiness.status === "degraded") {
    sessionStore.setContextReady(false);
    sessionStore.upsertDegradedMessage({
      degradedKind: "degraded",
      safeTitle: DEGRADED_MESSAGE.safeTitle,
      content: DEGRADED_MESSAGE.content,
    });
    widgetStore.setAvailability("degraded");
    return {
      canProceed: false,
    };
  }

  sessionStore.setContextReady(false);
  sessionStore.clearDegradedMessage();

  if (!hasIdentityHeaders || !hasPageContext) {
    widgetStore.setAvailability("unavailable");
    sessionStore.upsertDegradedMessage({
      degradedKind: "unavailable",
      safeTitle: UNAVAILABLE_MESSAGE.safeTitle,
      content: UNAVAILABLE_MESSAGE.content,
    });
  } else {
    widgetStore.setAvailability("context_not_ready");
  }

  return {
    canProceed: false,
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
  const runtimeController = sessionStore.runtimeController;
  let resetStreamOnDispose: (() => Promise<void> | void) | null = null;
  registerRuntimeControllerConsumer(
    runtimeController as unknown as AssistantRuntimeController<unknown>,
    () => resetStreamOnDispose?.(),
  );
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
  const retryingMessageKey = ref<string | null>(null);
  const stream = useAssistantSseStream({
    assistantService,
    callbacks: {
      onEvent: (event) => {
        if (event.eventType !== "final") {
          runtimeController.applyStreamingEvent(event);
        }
      },
      onUnknownEvent: ({ event }) => {
        runtimeController.recordUnknownStreamingEvent(
          event.requestId,
          event.messageId,
          event.sequence,
        );
      },
      onFinal: (event) => {
        runtimeController.finalizeActiveStreamingMessage(event);
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
        runtimeController.clearStreamingState();
      },
      onAbort: () => {
        runtimeController.markStreamingCancelled();
        runtimeController.clearStreamingState();
      },
      onInterrupted: () => {
        runtimeController.markStreamingInterrupted();
        runtimeController.clearStreamingState();
      },
      onTimeout: () => {
        runtimeController.markStreamingFailed();
        runtimeController.clearStreamingState();
      },
      onTransportError: () => {
        runtimeController.markStreamingFailed();
        runtimeController.clearStreamingState();
      },
    },
  });
  resetStreamOnDispose = () => stream.reset();

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
    [hostContext.readiness, () => sessionStore.status, recoveryReason],
    ([readiness, sessionStatus, nextRecoveryReason]) => {
      const ready = readiness.status === "ready";
      sessionStore.setContextReady(ready);

      if (readiness.status === "degraded") {
        widgetStore.setAvailability("degraded");
        sessionStore.upsertDegradedMessage({
          degradedKind: "degraded",
          safeTitle: DEGRADED_MESSAGE.safeTitle,
          content: DEGRADED_MESSAGE.content,
        });
        return;
      }

      if (
        ready &&
        sessionStatus === "error" &&
        (nextRecoveryReason === "unavailable" || nextRecoveryReason === "unknown")
      ) {
        widgetStore.setAvailability("unavailable");
        sessionStore.upsertDegradedMessage({
          degradedKind: "unavailable",
          safeTitle: UNAVAILABLE_MESSAGE.safeTitle,
          content: UNAVAILABLE_MESSAGE.content,
        });
        return;
      }

      sessionStore.clearDegradedMessage();
      widgetStore.setAvailability(ready ? "normal" : "context_not_ready");
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

    if (purpose === "send" && !contextReady.value) {
      return false;
    }

    sendInFlight.value = true;

    try {
      const { snapshot: latestSnapshot, scope: latestScope } =
        await resolveLatestAssistantSendContext(hostContext, purpose);

      if (
        !syncLatestAvailabilityState(
          latestSnapshot,
          sessionStore,
          widgetStore,
        ).canProceed
      ) {
        return false;
      }

      if (!sessionReady.value) {
        await bootstrapOnPanelOpen();
      }

      const sessionId = sessionStore.sessionId;
      if (!sessionReady.value || !sessionId || !latestSnapshot.identityHeaders) {
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
      const assistantMessageKey = `stream:${requestId}`;
      const createdAt = new Date().toISOString();
      const userMessage = createUserRuntimeMessage({
        requestId,
        content: normalizedText,
        createdAt,
      }) satisfies UserUiMessage;
      const assistantPlaceholder = createAssistantStreamingRuntimeMessage({
        key: assistantMessageKey,
        requestId,
        createdAt,
        typingVisibleUntil: Date.now() + 600,
      }) as AssistantStreamingUiMessage;

      runtimeController.appendUserMessage(userMessage);
      runtimeController.appendAssistantStreamingPlaceholder(assistantPlaceholder);
      runtimeController.setStreamingRequest(requestId, assistantMessageKey);
      runtimeController.markStreamingStarted();

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

  function resolveRetrySourceText(messageKey: string): string | null {
    return resolveRuntimeRetrySourceText(messages.value, messageKey);
  }

  async function retryMessage(messageKey: string): Promise<boolean> {
    if (retryingMessageKey.value) {
      return false;
    }

    const sourceText = resolveRetrySourceText(messageKey);
    if (!sourceText) {
      return false;
    }

    retryingMessageKey.value = messageKey;

    try {
      return await resendMessage(sourceText);
    } finally {
      if (retryingMessageKey.value === messageKey) {
        retryingMessageKey.value = null;
      }
    }
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
    const eligibility = runtimeController.prepareActionDraftDetailLoad(actionDraftId);
    if (!eligibility.allowed) {
      return eligibility.reason === "available";
    }

    runtimeController.startActionDraftDetailLoad(actionDraftId, options);

    try {
      const identityHeaders = await getActionDraftIdentityHeaders();
      if (!identityHeaders) {
        runtimeController.failActionDraftDetailLoad(
          actionDraftId,
          ACTION_DRAFT_DETAIL_ERROR_MESSAGE,
          { requestId: options.requestId },
        );
        return false;
      }

      const response = await assistantService.getActionDraft(actionDraftId, {
        identityHeaders,
      });
      runtimeController.completeActionDraftDetailLoad(response.data, {
        requestId: options.requestId,
      });
      return true;
    }
    catch {
      runtimeController.failActionDraftDetailLoad(
        actionDraftId,
        ACTION_DRAFT_DETAIL_ERROR_MESSAGE,
        { requestId: options.requestId },
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
    const eligibility = runtimeController.prepareApprovalRequestDetailLoad(approvalRequestId);
    if (!eligibility.allowed) {
      return eligibility.reason === "available";
    }

    runtimeController.startApprovalRequestDetailLoad(approvalRequestId, options);

    try {
      const identityHeaders = await getApprovalRequestIdentityHeaders();
      if (!identityHeaders) {
        runtimeController.failApprovalRequestDetailLoad(
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
      runtimeController.completeApprovalRequestDetailLoad(response.data);
      return true;
    }
    catch {
      runtimeController.failApprovalRequestDetailLoad(
        approvalRequestId,
        APPROVAL_REQUEST_DETAIL_ERROR_MESSAGE,
      );
      return false;
    }
  }

  async function confirmActionDraft(actionDraftId: ActionDraftId): Promise<boolean> {
    const eligibility = runtimeController.prepareActionDraftConfirmation(actionDraftId);
    if (!eligibility.allowed || !eligibility.idempotencyKey) {
      return false;
    }

    const idempotencyKey = eligibility.idempotencyKey;
    runtimeController.setActionDraftOperationStatus(actionDraftId, "confirming", {
      idempotencyKey,
      safeMessage: undefined,
    });

    try {
      const identityHeaders = await getActionDraftIdentityHeaders();
      if (!identityHeaders) {
        runtimeController.failActionDraftOperation(
          actionDraftId,
          ACTION_DRAFT_CONFIRM_ERROR_MESSAGE,
          "failed",
          { idempotencyKey },
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
      runtimeController.completeActionDraftOperation(
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
      runtimeController.failActionDraftOperation(
        actionDraftId,
        ACTION_DRAFT_CONFIRM_ERROR_MESSAGE,
        "failed",
        { idempotencyKey },
      );
      return false;
    }
  }

  async function cancelActionDraft(actionDraftId: ActionDraftId): Promise<boolean> {
    const eligibility = runtimeController.prepareActionDraftCancellation(actionDraftId);
    if (!eligibility.allowed) {
      return false;
    }

    const idempotencyKey = eligibility.idempotencyKey;
    runtimeController.setActionDraftOperationStatus(actionDraftId, "cancelling", {
      idempotencyKey,
      safeMessage: undefined,
    });

    try {
      const identityHeaders = await getActionDraftIdentityHeaders();
      if (!identityHeaders) {
        runtimeController.failActionDraftOperation(
          actionDraftId,
          ACTION_DRAFT_CANCEL_ERROR_MESSAGE,
          "failed",
          { idempotencyKey },
        );
        return false;
      }

      const response = await assistantService.cancelActionDraft(
        actionDraftId,
        {
          identityHeaders,
        },
      );
      runtimeController.completeActionDraftOperation(
        actionDraftId,
        response.data.status,
        {
          idempotencyKey,
        },
      );
      return true;
    }
    catch {
      runtimeController.failActionDraftOperation(
        actionDraftId,
        ACTION_DRAFT_CANCEL_ERROR_MESSAGE,
        "failed",
        { idempotencyKey },
      );
      return false;
    }
  }

  async function submitFeedback(input: {
    messageId: AssistantMessageId;
    value: AssistantFeedbackValue;
    requestId?: AssistantRequestId | null;
  }): Promise<boolean> {
    const eligibility = runtimeController.prepareFeedbackSubmission(input);
    if (!eligibility.allowed) {
      return false;
    }

    const previousValue = eligibility.previousValue;
    const linkedRequestId = eligibility.linkedRequestId;

    runtimeController.startFeedbackSubmission(
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

      runtimeController.completeFeedbackSubmission(input.messageId, {
        requestId: linkedRequestId,
      });
      return true;
    }
    catch {
      runtimeController.failFeedbackSubmission(
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
    runtimeController.ensureApprovalRequestState(payload.approvalRequestId, {
      messageId: payload.messageId,
      requestId: payload.requestId,
      sessionId: payload.sessionId,
    });

    const eligibility = runtimeController.prepareApprovalRequestOpenDetail(
      payload.approvalRequestId,
    );
    if (!eligibility.allowed) {
      return;
    }

    const previousError = hostContext.lastError.value;
    runtimeController.startApprovalRequestOpenDetail(payload.approvalRequestId);
    const latest = await hostContext.getLatestSnapshot("approval_detail");

    if (!latest.onOpenApprovalDetail) {
      runtimeController.failApprovalRequestOpenDetail(
        payload.approvalRequestId,
        APPROVAL_REQUEST_OPEN_DETAIL_UNAVAILABLE_MESSAGE,
      );
      return;
    }

    await hostContext.openApprovalDetail(payload);

    const nextError = hostContext.lastError.value;
    if (nextError !== null && nextError !== previousError) {
      runtimeController.failApprovalRequestOpenDetail(
        payload.approvalRequestId,
        APPROVAL_REQUEST_OPEN_DETAIL_ERROR_MESSAGE,
      );
      return;
    }

    runtimeController.completeApprovalRequestOpenDetail(payload.approvalRequestId);
  }

  return {
    runtimeController,
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
    retryMessage,
    retryLastMessage,
    retryingMessageKey,
    cancelStream,
    loadActionDraftDetail,
    loadApprovalRequestDetail,
    confirmActionDraft,
    cancelActionDraft,
    submitFeedback,
    openApprovalDetail,
  };
}
