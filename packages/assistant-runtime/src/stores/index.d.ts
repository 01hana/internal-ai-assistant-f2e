import { type ComputedRef, type Ref } from "vue";
import { type Pinia } from "pinia";
import type { ActionDraftDetailState } from "../actions";
import type { ApprovalRequestDetailState } from "../approvals";
import type { AssistantMessageFeedbackUiState } from "../feedback";
import type { AssistantMessageId, AssistantRequestId, AssistantSession, HistoryMessageSummary } from "../types";
export type AssistantRuntimePanelAvailability = "normal" | "context_not_ready" | "degraded" | "unavailable";
export type AssistantRuntimeSessionLifecycleState = "idle" | "restoring" | "creating" | "loading_history" | "ready" | "error";
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
export declare function createAssistantRuntimeSessionState<TMessage = HistoryMessageSummary>(): AssistantRuntimeSessionState<TMessage>;
export declare function createAssistantRuntimeWidgetState(): AssistantRuntimeWidgetState;
export declare function createAssistantRuntimeStoreDefinitions<TMessage = HistoryMessageSummary>(runtimeScope: string): {
    useSessionStore: import("pinia").StoreDefinition<`assistant-runtime:${string}:session`, Pick<AssistantRuntimeSessionState<TMessage>, "status" | "session" | "sessionScope" | "messages" | "nextCursor" | "historyLoading" | "historyLoadingMore" | "contextReady" | "activeRequestId" | "activeAssistantMessageKey" | "feedbackByMessageId" | "actionDraftById" | "approvalRequestById" | "approvalRequestMessageLinks" | "lastError" | "recoveryReason">, Pick<AssistantRuntimeSessionState<TMessage>, "sessionId">, Pick<AssistantRuntimeSessionState<TMessage>, never>>;
    useWidgetStore: import("pinia").StoreDefinition<`assistant-runtime:${string}:widget`, Pick<AssistantRuntimeWidgetState, keyof AssistantRuntimeWidgetState>, Pick<AssistantRuntimeWidgetState, never>, Pick<AssistantRuntimeWidgetState, never>>;
};
export declare function resetAssistantRuntimeSessionState<TMessage>(state: AssistantRuntimeSessionState<TMessage>): void;
export declare function resetAssistantRuntimeWidgetState(state: AssistantRuntimeWidgetState): void;
export declare function createAssistantRuntimeStores<TMessage = HistoryMessageSummary>(input: {
    pinia: Pinia;
    runtimeScope: string;
}): AssistantRuntimeStoreScope<TMessage>;
