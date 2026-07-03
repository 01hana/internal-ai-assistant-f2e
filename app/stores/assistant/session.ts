import type {
  AssistantSession,
  AssistantSessionScope,
  HistoryMessageSummary,
} from "../../types/assistant";
import type { AssistantSessionRecoveryReason } from "../../utils/assistant/sessionRecovery";

export type AssistantSessionLifecycleState =
  | "idle"
  | "restoring"
  | "creating"
  | "loading_history"
  | "ready"
  | "error";

export interface AssistantSessionSafeError {
  code: string;
  safeMessage: string;
}

export interface AssistantSessionStoreState {
  status: AssistantSessionLifecycleState;
  session: AssistantSession | null;
  sessionScope: AssistantSessionScope | null;
  messages: HistoryMessageSummary[];
  nextCursor: string | null;
  historyLoading: boolean;
  historyLoadingMore: boolean;
  contextReady: boolean;
  lastError: AssistantSessionSafeError | null;
  recoveryReason: AssistantSessionRecoveryReason | null;
}

function createInitialState(): AssistantSessionStoreState {
  return {
    status: "idle",
    session: null,
    sessionScope: null,
    messages: [],
    nextCursor: null,
    historyLoading: false,
    historyLoadingMore: false,
    contextReady: false,
    lastError: null,
    recoveryReason: null,
  };
}

export const useAssistantSessionStore = defineStore("assistant-session", {
  state: createInitialState,

  getters: {
    sessionId: (state) => state.session?.id ?? null,
  },

  actions: {
    setRestoring() {
      Object.assign(this, createInitialState(), {
        status: "restoring" as const,
      });
    },

    setCreating() {
      this.status = "creating";
      this.historyLoading = false;
      this.historyLoadingMore = false;
    },

    setLoadingHistory(mode: "initial" | "more" = "initial") {
      this.status = "loading_history";
      this.historyLoading = mode === "initial";
      this.historyLoadingMore = mode === "more";
    },

    setReady() {
      this.status = "ready";
      this.historyLoading = false;
      this.historyLoadingMore = false;
    },

    setError(
      error: AssistantSessionSafeError,
      recoveryReason: AssistantSessionRecoveryReason | null,
    ) {
      this.status = "error";
      this.historyLoading = false;
      this.historyLoadingMore = false;
      this.lastError = error;
      this.recoveryReason = recoveryReason;
    },

    setLastError(
      error: AssistantSessionSafeError,
      recoveryReason: AssistantSessionRecoveryReason | null,
    ) {
      this.lastError = error;
      this.recoveryReason = recoveryReason;
    },

    clearError() {
      this.lastError = null;
      this.recoveryReason = null;
    },

    setSession(session: AssistantSession | null) {
      this.session = session;
    },

    setSessionScope(sessionScope: AssistantSessionScope | null) {
      this.sessionScope = sessionScope;
    },

    setContextReady(contextReady: boolean) {
      this.contextReady = contextReady;
    },

    setMessages(messages: HistoryMessageSummary[], nextCursor: string | null) {
      this.messages = [...messages];
      this.nextCursor = nextCursor;
    },

    appendHistoryPage(
      messages: HistoryMessageSummary[],
      nextCursor: string | null,
    ) {
      const knownMessageIds = new Set(
        this.messages.map((message) => message.messageId),
      );
      this.messages.push(
        ...messages.filter((message) => {
          if (knownMessageIds.has(message.messageId)) {
            return false;
          }

          knownMessageIds.add(message.messageId);
          return true;
        }),
      );
      this.nextCursor = nextCursor;
    },

    appendMessages(
      messages: HistoryMessageSummary[],
      nextCursor: string | null,
    ) {
      this.appendHistoryPage(messages, nextCursor);
    },

    resetSessionState() {
      Object.assign(this, createInitialState());
    },
  },
});
