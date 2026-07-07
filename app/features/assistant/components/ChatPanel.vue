<script setup lang="ts">
import type {
  AssistantPanelAvailability,
  AssistantUiMessage,
  HistoryMessageSummary,
} from "../../../types/assistant";
import type { AssistantSendDisabledReason } from "../composables/useChat";
import type { AssistantSessionRecoveryReason } from "../../../utils/assistant/sessionRecovery";

interface AssistantSessionRecoveryViewState {
  reason: AssistantSessionRecoveryReason;
}

const props = withDefaults(
  defineProps<{
    availability: AssistantPanelAvailability;
    title?: string;
    messages?: Array<AssistantUiMessage | HistoryMessageSummary>;
    nextCursor?: string | null;
    historyLoading?: boolean;
    historyLoadingMore?: boolean;
    sessionLoading?: boolean;
    recoveryState?: AssistantSessionRecoveryViewState | null;
    canSend?: boolean;
    sendDisabledReason?: AssistantSendDisabledReason | null;
    isSending?: boolean;
    isStreaming?: boolean;
  }>(),
  {
    title: "AI 助理",
    messages: () => [],
    nextCursor: null,
    historyLoading: false,
    historyLoadingMore: false,
    sessionLoading: false,
    recoveryState: null,
    canSend: false,
    sendDisabledReason: null,
    isSending: false,
    isStreaming: false,
  },
);

const emit = defineEmits<{
  close: [];
  loadMoreHistory: [];
  restartSession: [];
  sendMessage: [text: string];
  cancelStream: [];
}>();

const contextReady = computed(() => props.availability === "normal");
const statusMessage = computed(() =>
  contextReady.value ? "AI 助理已就緒" : "目前頁面內容尚未就緒",
);

onKeyStroke("Escape", () => {
  emit("close");
});
</script>

<template>
  <section
    id="assistant-chat-panel"
    class="fixed z-[9999] inset-0 md:inset-auto md:bottom-5 md:right-5 md:w-[400px] md:h-[calc(100dvh-48px)] lg:w-[380px] flex flex-col bg-white shadow-2xl overflow-hidden rounded-t-2xl md:rounded-2xl panel-enter"
    data-testid="assistant-panel"
  >
    <div
      class="flex h-full flex-col overflow-hidden rounded-2xl bg-default shadow-2xl ring-1 ring-black/10"
    >
      <header
        class="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-primary-800 to-primary-600 px-4 py-3 text-white"
        data-testid="assistant-panel-header"
      >
        <div class="flex min-w-0 items-center gap-3">
          <div class="relative">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/15 backdrop-blur"
            >
              <UIcon
                name="fluent:bot-24-regular"
                class="text-white"
                size="19"
              />
            </div>
            <div
              class="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white"
              :class="contextReady ? 'bg-emerald-400' : 'bg-amber-400'"
            />
          </div>

          <div class="min-w-0">
            <h2
              id="assistant-panel-title"
              class="truncate text-sm font-semibold tracking-wide"
            >
              {{ title }}
            </h2>

            <span class="text-sm text-white/70">{{ statusMessage }}</span>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <UButton
            icon="fluent:arrow-counterclockwise-24-regular"
            color="neutral"
            variant="ghost"
            size="sm"
            class="shrink-0 rounded-full text-white hover:bg-white/15"
            data-testid="assistant-panel-close"
            @click="emit('restartSession')"
          />

          <UButton
            icon="fluent:dismiss-24-regular"
            color="neutral"
            variant="ghost"
            size="sm"
            class="shrink-0 rounded-full text-white hover:bg-white/15"
            @click="emit('close')"
          />
        </div>
      </header>

      <div
        class="sr-only"
        data-testid="assistant-panel-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ statusMessage }}
      </div>

      <div
        class="min-h-0 flex-1 overflow-hidden overscroll-contain"
        data-testid="assistant-panel-main"
      >
        <slot name="content">
          <SessionRecoveryMessage
            v-if="contextReady && recoveryState"
            :reason="recoveryState.reason"
            :busy="sessionLoading"
            @restart="emit('restartSession')"
          />
          <ChatMessageArea
            v-else
            :messages="messages"
            :context-ready="contextReady"
            :next-cursor="nextCursor"
            :history-loading="sessionLoading || historyLoading"
            :history-loading-more="historyLoadingMore"
            @load-more="emit('loadMoreHistory')"
          />
        </slot>
      </div>

      <footer class="shrink-0 border-t border-default px-3 py-3">
        <ChatInputBar
          data-testid="assistant-panel-footer"
          :can-send="canSend"
          :disabled-reason="sendDisabledReason"
          :is-sending="isSending"
          :is-streaming="isStreaming"
          @send="emit('sendMessage', $event)"
          @cancel="emit('cancelStream')"
        />
      </footer>
    </div>
  </section>
</template>

<style scoped>
/* Mobile: slide-up entrance */
@media (max-width: 767px) {
  .panel-enter {
    animation: slide-up 0.3s ease forwards;
  }
  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
}
</style>
