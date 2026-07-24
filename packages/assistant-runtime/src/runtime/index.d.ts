import { type ActionDraftDetail, type ActionDraftDetailState, type ActionDraftOperationStatus, type ActionDraftRecheck, type ActionDraftStatus } from "../actions";
import { type ApprovalRequestDetailState, type ApprovalRequestSummary } from "../approvals";
import { type AssistantMessageFeedbackUiState, type AssistantFeedbackValue } from "../feedback";
import { accumulateAssistantAnswerDelta, type AssistantSseStreamRunner } from "../sse";
import type { AssistantRuntimeSessionState, AssistantRuntimeStoreScope } from "../stores";
import type { ActionDraftId, ApprovalRequestId, AssistantMessageFinalData, AssistantMessageId, AssistantRequestId, AssistantSession, AssistantSseEvent, HistoryMessageSummary } from "../types";
import type { AssistantRuntimeLoadHistoryInput, AssistantRuntimeTransportPort } from "../transport/ports";
export type AssistantRuntimeStreamingTerminalStatus = "completed" | "interrupted" | "failed" | "cancelled";
export type AssistantRuntimeStreamingStatus = "idle" | "connecting" | "sending" | "queued" | "streaming" | "finalizing" | AssistantRuntimeStreamingTerminalStatus;
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
type AssistantNonFinalSseEvent = Exclude<AssistantSseEvent, {
    eventType: "final";
}>;
type AssistantFinalSseEvent = Extract<AssistantSseEvent, {
    eventType: "final";
}>;
type AssistantRuntimeClock = {
    setTimeout: (handler: Parameters<typeof globalThis.setTimeout>[0], timeout?: Parameters<typeof globalThis.setTimeout>[1]) => ReturnType<typeof globalThis.setTimeout>;
    clearTimeout: (timer: ReturnType<typeof globalThis.setTimeout>) => void;
    Date: Pick<DateConstructor, "now">;
};
export interface AssistantRuntimeController<TMessage = RuntimeMessage> {
    runtimeScope: string;
    stores: AssistantRuntimeStoreScope<TMessage>;
    createSession(options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    loadHistory(input: AssistantRuntimeLoadHistoryInput, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    appendHistoryPage(page: {
        messages: readonly HistoryMessageSummary[];
        nextCursor: string | null;
    }): void;
    accumulateDelta(current: string, event: AssistantSseEvent): string;
    setRestoring(): void;
    setCreating(): void;
    setLoadingHistory(mode?: "initial" | "more"): void;
    setReady(): void;
    setError(error: {
        code: string;
        safeMessage: string;
    }, recoveryReason: string | null): void;
    setLastError(error: {
        code: string;
        safeMessage: string;
    }, recoveryReason: string | null): void;
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
    completeFeedbackSubmission(messageId: AssistantMessageId, options?: {
        requestId?: AssistantRequestId | null;
    }): void;
    failFeedbackSubmission(messageId: AssistantMessageId, previousValue: AssistantFeedbackValue | null, requestId: AssistantRequestId | null, safeMessage: string): void;
    getActionDraftState(actionDraftId: ActionDraftId): ActionDraftDetailState;
    prepareActionDraftDetailLoad(actionDraftId: ActionDraftId): {
        allowed: boolean;
        reason?: "disposed" | "loading" | "available";
    };
    prepareActionDraftConfirmation(actionDraftId: ActionDraftId): {
        allowed: boolean;
        reason?: "disposed" | "detail_unavailable" | "pending" | "terminal";
        idempotencyKey: string | null;
    };
    prepareActionDraftCancellation(actionDraftId: ActionDraftId): {
        allowed: boolean;
        reason?: "disposed" | "detail_unavailable" | "pending" | "terminal";
        idempotencyKey: string | null;
    };
    upsertActionDraftState(actionDraftId: ActionDraftId, nextState: Partial<ActionDraftDetailState>): void;
    startActionDraftDetailLoad(actionDraftId: ActionDraftId, options?: {
        messageId?: AssistantMessageId | null;
        requestId?: AssistantRequestId;
    }): void;
    completeActionDraftDetailLoad(detail: ActionDraftDetail, options?: {
        requestId?: AssistantRequestId;
    }): void;
    failActionDraftDetailLoad(actionDraftId: ActionDraftId, safeMessage: string, options?: {
        requestId?: AssistantRequestId;
    }): void;
    setActionDraftOperationStatus(actionDraftId: ActionDraftId, operationStatus: ActionDraftOperationStatus, options?: {
        idempotencyKey?: string | null;
        safeMessage?: string;
    }): void;
    completeActionDraftOperation(actionDraftId: ActionDraftId, nextStatus: ActionDraftStatus, options?: {
        recheck?: ActionDraftRecheck;
        idempotencyKey?: string | null;
    }): void;
    failActionDraftOperation(actionDraftId: ActionDraftId, safeMessage: string, operationStatus?: Extract<ActionDraftOperationStatus, "failed">, options?: {
        idempotencyKey?: string | null;
    }): void;
    getApprovalRequestState(approvalRequestId: ApprovalRequestId): ApprovalRequestDetailState;
    prepareApprovalRequestDetailLoad(approvalRequestId: ApprovalRequestId): {
        allowed: boolean;
        reason?: "disposed" | "loading" | "available";
    };
    prepareApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId): {
        allowed: boolean;
        reason?: "disposed" | "opening";
    };
    upsertApprovalRequestState(approvalRequestId: ApprovalRequestId, nextState: Partial<ApprovalRequestDetailState>): void;
    linkApprovalRequestMessage(messageId: AssistantMessageId, approvalRequestId: ApprovalRequestId): void;
    ensureApprovalRequestState(approvalRequestId: ApprovalRequestId, options?: {
        messageId?: AssistantMessageId;
        requestId?: AssistantRequestId;
        sessionId?: string | null;
    }): void;
    startApprovalRequestDetailLoad(approvalRequestId: ApprovalRequestId, options?: {
        messageId?: AssistantMessageId;
        requestId?: AssistantRequestId;
        sessionId?: string | null;
    }): void;
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
export declare function createUserRuntimeMessage(input: {
    requestId: AssistantRequestId;
    content: string;
    createdAt: string;
}): {
    key: string;
    messageId: string;
    requestId: string;
    kind: "user";
    role: "user";
    content: string;
    createdAt: string;
};
export declare function createAssistantStreamingRuntimeMessage(input: {
    key: string;
    requestId: AssistantRequestId;
    createdAt: string;
    typingVisibleUntil?: number | null;
}): AssistantRuntimeStreamingMessage;
export declare function resolveRetrySourceText(messages: readonly {
    role: string;
    content: string;
    key?: string;
    kind?: string;
    status?: string;
}[], messageKey: string): string | null;
export declare function createSessionController<TMessage>(state: AssistantRuntimeSessionState<TMessage>, transport: Pick<AssistantRuntimeTransportPort, "createSession" | "loadHistory" | "cancelMessage" | "abortMessage">, lifecycle: {
    canMutate: () => boolean;
    captureVersion: () => number;
    isCurrentVersion: (version: number) => boolean;
}): {
    createSession(options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    loadHistory(input: AssistantRuntimeLoadHistoryInput, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    appendHistoryPage(page: {
        messages: readonly HistoryMessageSummary[];
        nextCursor: string | null;
    }): void;
    cleanup: () => Promise<void>;
};
export declare function createStreamingController<TMessage>(state: AssistantRuntimeSessionState<TMessage>, input: {
    clock: AssistantRuntimeClock;
    canMutate: () => boolean;
}): {
    accumulateDelta: typeof accumulateAssistantAnswerDelta;
    getActiveStreamingMessage: (requestId?: AssistantRequestId | null) => AssistantRuntimeStreamingMessage | null;
    appendAssistantStreamingPlaceholder(message: AssistantRuntimeStreamingMessage): void;
    setStreamingRequest(requestId: AssistantRequestId, assistantMessageKey: string): void;
    updateActiveStreamingStatus: (nextStatus: AssistantRuntimeStreamingStatus) => void;
    applyStreamingEvent(event: AssistantNonFinalSseEvent): void;
    recordUnknownStreamingEvent(requestId: AssistantRequestId, messageId: string, sequence: number): void;
    finalizeActiveStreamingMessage(event: AssistantFinalSseEvent): void;
    markStreamingStarted(): void;
    markStreamingCancelled(): void;
    markStreamingInterrupted(): void;
    markStreamingFailed(): void;
    markStreamingFinalizing(): void;
    clearStreamingState(): void;
    clearTimers: () => void;
    getPendingTimerCount: () => number;
};
export declare function createFeedbackController<TMessage>(state: AssistantRuntimeSessionState<TMessage>, lifecycle: {
    canMutate: () => boolean;
    captureVersion: () => number;
    isCurrentVersion: (version: number) => boolean;
}): {
    prepareFeedbackSubmission(input: {
        messageId: AssistantMessageId;
        value: AssistantFeedbackValue;
        requestId?: AssistantRequestId | null;
    }): {
        allowed: boolean;
        reason: "disposed";
        previousValue: AssistantFeedbackValue | null;
        linkedRequestId: string | null;
    } | {
        allowed: boolean;
        reason: "pending";
        previousValue: AssistantFeedbackValue | null;
        linkedRequestId: string | null;
    } | {
        allowed: boolean;
        reason: "unchanged";
        previousValue: AssistantFeedbackValue;
        linkedRequestId: string | null;
    } | {
        allowed: boolean;
        previousValue: AssistantFeedbackValue | null;
        linkedRequestId: string | null;
        reason?: undefined;
    };
    getFeedbackState(messageId: AssistantMessageId): AssistantMessageFeedbackUiState;
    startFeedbackSubmission(messageId: AssistantMessageId, value: AssistantFeedbackValue, requestId: AssistantRequestId | null): void;
    completeFeedbackSubmission(messageId: AssistantMessageId, options?: {
        requestId?: AssistantRequestId | null;
    }): void;
    failFeedbackSubmission(messageId: AssistantMessageId, previousValue: AssistantFeedbackValue | null, requestId: AssistantRequestId | null, safeMessage: string): void;
    clearPending: () => void;
};
export declare function createActionController<TMessage>(state: AssistantRuntimeSessionState<TMessage>, lifecycle: {
    canMutate: () => boolean;
    captureVersion: () => number;
    isCurrentVersion: (version: number) => boolean;
}, idGenerator: () => AssistantRequestId): {
    getActionDraftState: (actionDraftId: ActionDraftId) => ActionDraftDetailState;
    prepareActionDraftDetailLoad(actionDraftId: ActionDraftId): {
        allowed: boolean;
        reason: "disposed";
    } | {
        allowed: boolean;
        reason: "loading";
    } | {
        allowed: boolean;
        reason: "available";
    } | {
        allowed: boolean;
        reason?: undefined;
    };
    prepareActionDraftConfirmation: (actionDraftId: ActionDraftId) => {
        allowed: boolean;
        reason: "disposed";
        idempotencyKey: null;
    } | {
        allowed: boolean;
        reason: "detail_unavailable";
        idempotencyKey: null;
    } | {
        allowed: boolean;
        reason: "pending";
        idempotencyKey: string | null;
    } | {
        allowed: boolean;
        reason: "terminal";
        idempotencyKey: string | null;
    } | {
        allowed: boolean;
        idempotencyKey: string;
        reason?: undefined;
    };
    prepareActionDraftCancellation: (actionDraftId: ActionDraftId) => {
        allowed: boolean;
        reason: "disposed";
        idempotencyKey: null;
    } | {
        allowed: boolean;
        reason: "detail_unavailable";
        idempotencyKey: null;
    } | {
        allowed: boolean;
        reason: "pending";
        idempotencyKey: string | null;
    } | {
        allowed: boolean;
        reason: "terminal";
        idempotencyKey: string | null;
    } | {
        allowed: boolean;
        idempotencyKey: string;
        reason?: undefined;
    };
    upsertActionDraftState(actionDraftId: ActionDraftId, nextState: Partial<ActionDraftDetailState>): void;
    startActionDraftDetailLoad(actionDraftId: ActionDraftId, options?: {
        messageId?: AssistantMessageId | null;
        requestId?: AssistantRequestId;
    }): void;
    completeActionDraftDetailLoad(detail: ActionDraftDetail, options?: {
        requestId?: AssistantRequestId;
    }): void;
    failActionDraftDetailLoad(actionDraftId: ActionDraftId, safeMessage: string, options?: {
        requestId?: AssistantRequestId;
    }): void;
    setActionDraftOperationStatus(actionDraftId: ActionDraftId, operationStatus: ActionDraftOperationStatus, options?: {
        idempotencyKey?: string | null;
        safeMessage?: string;
    }): void;
    completeActionDraftOperation(actionDraftId: ActionDraftId, nextStatus: ActionDraftStatus, options?: {
        recheck?: ActionDraftRecheck;
        idempotencyKey?: string | null;
    }): void;
    failActionDraftOperation(actionDraftId: ActionDraftId, safeMessage: string, operationStatus?: Extract<ActionDraftOperationStatus, "failed">, options?: {
        idempotencyKey?: string | null;
    }): void;
    clearPending(): void;
};
export declare function createApprovalController<TMessage>(state: AssistantRuntimeSessionState<TMessage>, lifecycle: {
    canMutate: () => boolean;
    captureVersion: () => number;
    isCurrentVersion: (version: number) => boolean;
}): {
    getApprovalRequestState: (approvalRequestId: ApprovalRequestId) => ApprovalRequestDetailState;
    prepareApprovalRequestDetailLoad(approvalRequestId: ApprovalRequestId): {
        allowed: boolean;
        reason: "disposed";
    } | {
        allowed: boolean;
        reason: "loading";
    } | {
        allowed: boolean;
        reason: "available";
    } | {
        allowed: boolean;
        reason?: undefined;
    };
    prepareApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId): {
        allowed: boolean;
        reason: "disposed";
    } | {
        allowed: boolean;
        reason: "opening";
    } | {
        allowed: boolean;
        reason?: undefined;
    };
    upsertApprovalRequestState(approvalRequestId: ApprovalRequestId, nextState: Partial<ApprovalRequestDetailState>): void;
    linkApprovalRequestMessage: (messageId: AssistantMessageId, approvalRequestId: ApprovalRequestId) => void;
    ensureApprovalRequestState: (approvalRequestId: ApprovalRequestId, options?: {
        messageId?: AssistantMessageId;
        requestId?: AssistantRequestId;
        sessionId?: string | null;
    }) => void;
    startApprovalRequestDetailLoad(approvalRequestId: ApprovalRequestId, options?: {
        messageId?: AssistantMessageId;
        requestId?: AssistantRequestId;
        sessionId?: string | null;
    }): void;
    completeApprovalRequestDetailLoad(detail: ApprovalRequestSummary): void;
    failApprovalRequestDetailLoad(approvalRequestId: ApprovalRequestId, safeMessage: string): void;
    startApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId): void;
    completeApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId): void;
    failApprovalRequestOpenDetail(approvalRequestId: ApprovalRequestId, safeMessage: string): void;
    clearPending(): void;
};
export declare function createAssistantRuntimeController<TMessage = RuntimeMessage>(input: {
    runtimeScope: string;
    stores: AssistantRuntimeStoreScope<TMessage>;
    transport: Pick<AssistantRuntimeTransportPort, "createSession" | "loadHistory" | "cancelMessage" | "abortMessage">;
    sseRunner?: AssistantSseStreamRunner<unknown>;
    clock?: Partial<Omit<AssistantRuntimeClock, "Date">> & {
        Date?: Pick<DateConstructor, "now">;
    };
    idGenerator?: () => AssistantRequestId;
}): AssistantRuntimeController<TMessage>;
export {};
