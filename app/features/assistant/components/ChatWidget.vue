<script setup lang="ts">
import AssistantRuntimeRoot from "../../../../packages/assistant-runtime/src/components/AssistantRuntimeRoot.vue";
import { FRONTEND001_RUNTIME_SCOPE } from "../../../stores/assistant/useSessionStore";
import type {
  AssistantHostContextProvider,
  AssistantPanelAvailability,
} from "../../../types/assistant";

const props = withDefaults(
  defineProps<{
    availability?: AssistantPanelAvailability;
    contextSummary?: string;
    hostContextProvider?: AssistantHostContextProvider;
    title?: string;
  }>(),
  {
    availability: undefined,
    contextSummary: undefined,
    hostContextProvider: undefined,
    title: "AI 助理",
  },
);

const widgetStore = useChatWidgetStore();
const chat = useChat({
  hostContextProvider: props.hostContextProvider,
});
const { runtimeController, isBootstrapping, recoveryState } = chat;
const { isOpen, availability: storeAvailability } = storeToRefs(widgetStore);
const contextReady = computed(() => runtimeController.stores.session.contextReady.value);
const launcherRef = ref<HTMLElement | null>(null);

const statusMessage = computed(() => {
  switch (storeAvailability.value) {
    case "degraded":
      return "助理服務暫時不穩定";
    case "unavailable":
      return "助理暫時無法使用";
    case "context_not_ready":
      return "目前頁面內容尚未就緒";
    default:
      return "AI 助理已就緒";
  }
});

watch(
  () => props.availability,
  (nextAvailability) => {
    if (nextAvailability) {
      widgetStore.setAvailability(nextAvailability);
    }
  },
  { immediate: true },
);

async function openPanel() {
  widgetStore.open();
  await nextTick();
  void chat.bootstrapOnPanelOpen();
}

async function closePanel() {
  widgetStore.close();
  await nextTick();
  launcherRef.value?.focus();
}

async function togglePanel() {
  if (isOpen.value) {
    await closePanel();
    return;
  }

  await openPanel();
}

onKeyStroke("Escape", () => {
  if (isOpen.value) {
    void closePanel();
  }
});
</script>

<template>
  <div
    class="fixed right-4 bottom-4 z-[9999] flex flex-col items-end gap-3 sm:right-6 sm:bottom-6"
    data-widget-placement="bottom-right"
    aria-label="AI 助理"
  >
    <Transition
      enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-2 opacity-0"
    >
      <section
        v-if="isOpen"
        id="assistant-chat-panel"
        class="fixed z-[9999] inset-0 md:inset-auto md:bottom-5 md:right-5 md:w-[400px] md:h-[calc(100dvh-48px)] lg:w-[380px] flex flex-col bg-white shadow-2xl overflow-hidden rounded-t-2xl md:rounded-2xl panel-enter"
        data-testid="assistant-panel"
        role="dialog"
        aria-labelledby="assistant-panel-title"
      >
        <div class="flex h-full flex-col overflow-hidden rounded-2xl bg-default shadow-2xl ring-1 ring-black/10">
          <header
            class="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-primary-800 to-primary-600 px-4 py-3 text-white"
            data-testid="assistant-panel-header"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div class="relative">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/15 text-xs font-semibold backdrop-blur"
                  aria-hidden="true"
                >
                  AI
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
              <button
                type="button"
                class="shrink-0 rounded-full px-3 py-2 text-sm text-white hover:bg-white/15"
                data-testid="assistant-panel-restart"
                aria-label="重新開始助理對話"
                @click="chat.restartSession"
              >
                重新開始
              </button>

              <button
                type="button"
                class="shrink-0 rounded-full px-3 py-2 text-sm text-white hover:bg-white/15"
                data-testid="assistant-panel-close"
                aria-label="關閉助理面板"
                @click="closePanel"
              >
                關閉
              </button>
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
            class="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-4"
            data-testid="assistant-panel-main"
          >
            <SessionRecoveryMessage
              v-if="contextReady && recoveryState"
              :reason="recoveryState.reason"
              :busy="isBootstrapping"
              @restart="chat.restartSession"
            />
            <AssistantRuntimeRoot
              v-else
              :controller="runtimeController"
              :runtime-scope="FRONTEND001_RUNTIME_SCOPE"
              :on-send-message="chat.sendMessage"
              :on-load-more-history="chat.loadMoreHistory"
              :on-cancel-streaming="chat.cancelStream"
              :on-submit-feedback="chat.submitFeedback"
              :on-confirm-action-draft="chat.confirmActionDraft"
              :on-cancel-action-draft="chat.cancelActionDraft"
              :on-open-approval-detail="chat.openApprovalDetail"
            />
          </div>
        </div>
      </section>
    </Transition>

    <button
      ref="launcherRef"
      data-testid="assistant-launcher"
      type="button"
      class="w-14 h-14 rounded-full shadow-2xl hover:scale-105 transition-transform flex items-center justify-center bg-gradient-to-r from-primary-800 to-primary-600 text-white"
      :aria-expanded="isOpen ? 'true' : 'false'"
      aria-controls="assistant-chat-panel"
      @click="togglePanel"
    >
      AI
    </button>
  </div>
</template>

<style scoped>
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
