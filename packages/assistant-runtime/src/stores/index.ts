import { computed, ref, type ComputedRef, type Ref } from "vue";
import { defineStore, storeToRefs, type Pinia } from "pinia";
import type {
  ActionDraftDetailState,
} from "../actions";
import type {
  ApprovalRequestDetailState,
} from "../approvals";
import type {
  AssistantMessageFeedbackUiState,
} from "../feedback";
import type {
  AssistantMessageId,
  AssistantRequestId,
  AssistantSession,
  HistoryMessageSummary,
} from "../types";

export type AssistantRuntimePanelAvailability =
  | "normal"
  | "context_not_ready"
  | "degraded"
  | "unavailable";

export type AssistantRuntimeSessionLifecycleState =
  | "idle"
  | "restoring"
  | "creating"
  | "loading_history"
  | "ready"
  | "error";

export interface AssistantRuntimeSafeErrorState {
  code: string;
  safeMessage: string;
}

export interface AssistantRuntimeSessionState<TMessage = HistoryMessageSummary> {
  status: Ref<AssistantRuntimeSessionLifecycleState>;
  session: Ref<AssistantSession | null>;
  sessionScope: Ref<unknown | null>;
  messages: Ref<TMessage[]>;
  nextCursor: Ref<string | null>;
  historyLoading: Ref<boolean>;
  historyLoadingMore: Ref<boolean>;
  contextReady: Ref<boolean>;
  activeRequestId: Ref<AssistantRequestId | null>;
  activeAssistantMessageKey: Ref<string | null>;
  feedbackByMessageId: Ref<Record<AssistantMessageId, AssistantMessageFeedbackUiState>>;
  actionDraftById: Ref<Record<string, ActionDraftDetailState>>;
  approvalRequestById: Ref<Record<string, ApprovalRequestDetailState>>;
  approvalRequestMessageLinks: Ref<Record<AssistantMessageId, string>>;
  lastError: Ref<AssistantRuntimeSafeErrorState | null>;
  recoveryReason: Ref<string | null>;
  sessionId: ComputedRef<string | null>;
}

export interface AssistantRuntimeWidgetState {
  isOpen: Ref<boolean>;
  availability: Ref<AssistantRuntimePanelAvailability>;
}

export interface AssistantRuntimeStoreScope<TMessage = HistoryMessageSummary> {
  runtimeScope: string;
  pinia: Pinia;
  session: AssistantRuntimeSessionState<TMessage>;
  widget: AssistantRuntimeWidgetState;
}

export function createAssistantRuntimeSessionState<TMessage = HistoryMessageSummary>(): AssistantRuntimeSessionState<TMessage> {
  const session = ref<AssistantSession | null>(null);

  return {
    status: ref("idle"),
    session,
    sessionScope: ref(null),
    messages: ref<TMessage[]>([]) as Ref<TMessage[]>,
    nextCursor: ref(null),
    historyLoading: ref(false),
    historyLoadingMore: ref(false),
    contextReady: ref(false),
    activeRequestId: ref(null),
    activeAssistantMessageKey: ref(null),
    feedbackByMessageId: ref({}),
    actionDraftById: ref({}),
    approvalRequestById: ref({}),
    approvalRequestMessageLinks: ref({}),
    lastError: ref(null),
    recoveryReason: ref(null),
    sessionId: computed(() => session.value?.sessionId ?? null),
  };
}

export function createAssistantRuntimeWidgetState(): AssistantRuntimeWidgetState {
  return {
    isOpen: ref(false),
    availability: ref("normal"),
  };
}

export function createAssistantRuntimeStoreDefinitions<TMessage = HistoryMessageSummary>(
  runtimeScope: string,
) {
  const normalizedScope = runtimeScope.trim();

  if (!normalizedScope) {
    throw new Error("assistant_runtime_scope_required");
  }

  const scopedStoreId = normalizedScope.replace(/[^a-zA-Z0-9:_-]/g, "_");
  const useSessionStore = defineStore(
    `assistant-runtime:${scopedStoreId}:session`,
    () => createAssistantRuntimeSessionState<TMessage>(),
  );
  const useWidgetStore = defineStore(
    `assistant-runtime:${scopedStoreId}:widget`,
    () => createAssistantRuntimeWidgetState(),
  );

  return {
    useSessionStore,
    useWidgetStore,
  };
}

export function resetAssistantRuntimeSessionState<TMessage>(
  state: AssistantRuntimeSessionState<TMessage>,
): void {
  state.status.value = "idle";
  state.session.value = null;
  state.sessionScope.value = null;
  state.messages.value = [];
  state.nextCursor.value = null;
  state.historyLoading.value = false;
  state.historyLoadingMore.value = false;
  state.contextReady.value = false;
  state.activeRequestId.value = null;
  state.activeAssistantMessageKey.value = null;
  state.feedbackByMessageId.value = {};
  state.actionDraftById.value = {};
  state.approvalRequestById.value = {};
  state.approvalRequestMessageLinks.value = {};
  state.lastError.value = null;
  state.recoveryReason.value = null;
}

export function resetAssistantRuntimeWidgetState(
  state: AssistantRuntimeWidgetState,
): void {
  state.isOpen.value = false;
  state.availability.value = "normal";
}

export function createAssistantRuntimeStores<TMessage = HistoryMessageSummary>(
  input: {
    pinia: Pinia;
    runtimeScope: string;
  },
): AssistantRuntimeStoreScope<TMessage> {
  if (!input.pinia) {
    throw new Error("assistant_runtime_pinia_required");
  }

  const runtimeScope = input.runtimeScope.trim();

  if (!runtimeScope) {
    throw new Error("assistant_runtime_scope_required");
  }

  const definitions = createAssistantRuntimeStoreDefinitions<TMessage>(runtimeScope);
  const sessionStore = definitions.useSessionStore(input.pinia);
  const widgetStore = definitions.useWidgetStore(input.pinia);
  const sessionRefs = storeToRefs(sessionStore);
  const widgetRefs = storeToRefs(widgetStore);

  return {
    runtimeScope,
    pinia: input.pinia,
    session: sessionRefs as AssistantRuntimeSessionState<TMessage>,
    widget: widgetRefs as AssistantRuntimeWidgetState,
  };
}
