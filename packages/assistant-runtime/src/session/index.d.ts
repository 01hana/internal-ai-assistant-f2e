import type { AssistantRuntimeCancelMessageInput, AssistantRuntimeCreateSessionInput, AssistantRuntimeHistory, AssistantRuntimeLoadHistoryInput, AssistantRuntimeRemoteRestorationCapability, AssistantRuntimeSession, AssistantRuntimeTransportPort } from "../transport/ports";
import type { AssistantSession, AssistantSessionId, AssistantSseEvent, HistoryMessageSummary } from "../types";
export type AssistantSessionRecoveryReason = "expired" | "closed" | "invisible" | "not_found" | "unavailable" | "unknown";
export type AssistantSessionCandidateSource = "host_managed" | "session_storage";
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
    createSession(input?: AssistantRuntimeCreateSessionInput, options?: {
        signal?: AbortSignal;
    }): Promise<AssistantRuntimeSession>;
    /** Adopt a session only after the caller has already remotely validated it. */
    adoptValidatedSession(sessionId: string, options?: {
        signal?: AbortSignal;
    }): Promise<AssistantRuntimeSession>;
    loadHistory(input: AssistantRuntimeLoadHistoryInput, options?: {
        signal?: AbortSignal;
    }): Promise<AssistantRuntimeHistory>;
    appendHistoryPage(current: AssistantHistoryPageState, page: AssistantHistoryPageState): AssistantHistoryPageState;
    accumulateDelta(current: string, event: AssistantSseEvent): string;
    retry<T>(operation: (options: {
        signal: AbortSignal;
    }) => Promise<T>, options?: {
        signal?: AbortSignal;
    }): Promise<T>;
    cancel(input: AssistantRuntimeCancelMessageInput, options?: {
        signal?: AbortSignal;
    }): Promise<{
        cancelled: true;
    }>;
    abort(input: AssistantRuntimeCancelMessageInput, options?: {
        signal?: AbortSignal;
    }): Promise<{
        aborted: true;
    }>;
    cleanup(): Promise<void>;
    getPendingOperationCount(): number;
}
export declare function resolveSessionRestoreCandidates(input: ResolveSessionRestoreCandidatesInput): AssistantSessionRestoreCandidate[];
export declare function isReusableAssistantSession(session: AssistantSession | null | undefined): boolean;
export declare function resolveSessionRecoveryReason(input: unknown): AssistantSessionRecoveryReason | null;
export declare function shouldClearScopedSessionFallback(reason: AssistantSessionRecoveryReason | null): boolean;
export declare function appendAssistantHistoryPage(current: AssistantHistoryPageState, page: AssistantHistoryPageState): AssistantHistoryPageState;
export declare function createAssistantSessionHistoryOrchestrator(input: {
    transport: Pick<AssistantRuntimeTransportPort, "createSession" | "cancelMessage" | "abortMessage"> & Partial<AssistantRuntimeRemoteRestorationCapability>;
}): AssistantSessionHistoryOrchestrator;
