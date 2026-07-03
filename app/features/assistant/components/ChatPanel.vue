<script setup lang="ts">
import type {
  AssistantPanelAvailability,
  AssistantUiMessage,
  HistoryMessageSummary,
} from "../../../types/assistant";
import type { AssistantSessionRecoveryReason } from "../../../utils/assistant/sessionRecovery";

interface AssistantSessionRecoveryViewState {
  reason: AssistantSessionRecoveryReason;
}

const props = withDefaults(
  defineProps<{
    availability: AssistantPanelAvailability;
    title?: string;
    contextSummary?: string;
    messages?: Array<AssistantUiMessage | HistoryMessageSummary>;
    nextCursor?: string | null;
    historyLoading?: boolean;
    historyLoadingMore?: boolean;
    sessionLoading?: boolean;
    recoveryState?: AssistantSessionRecoveryViewState | null;
  }>(),
  {
    title: "AI 助理",
    contextSummary: undefined,
    messages: () => [],
    nextCursor: null,
    historyLoading: false,
    historyLoadingMore: false,
    sessionLoading: false,
    recoveryState: null,
  },
);

const emit = defineEmits<{
  close: [];
  loadMoreHistory: [];
  restartSession: [];
}>();

const panelRoot = useTemplateRef<HTMLElement>("panelRoot");
const { focused } = useFocus(panelRoot);
const contextReady = computed(() => props.availability === "normal");
const statusMessage = computed(() =>
  contextReady.value ? "AI 助理已就緒" : "目前頁面內容尚未就緒",
);

function focus() {
  focused.value = true;
}

onKeyStroke("Escape", () => {
  emit("close");
});

defineExpose({
  focus,
});
</script>

<template>
  <section
    id="assistant-chat-panel"
    ref="panelRoot"
    class="absolute right-0 bottom-16 h-[min(42rem,calc(100dvh-6rem))] w-[min(26rem,calc(100vw-2rem))] outline-none"
    data-testid="assistant-panel"
    role="dialog"
    aria-modal="false"
    aria-labelledby="assistant-panel-title"
    tabindex="-1"
  >
    <UCard
      class="flex h-full flex-col overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10"
      :ui="{
        header: 'shrink-0 p-0 sm:p-0',
        body: 'min-h-0 flex-1 overflow-hidden p-0 sm:p-0',
        footer: 'shrink-0 p-3 sm:p-3',
      }"
    >
      <template #header>
        <header
          class="flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-950 to-emerald-700 px-4 py-3 text-white"
          data-testid="assistant-panel-header"
        >
          <div class="flex min-w-0 items-center gap-3">
            <UBadge
              label="AI"
              color="neutral"
              variant="subtle"
              class="shrink-0 bg-white/15 text-white ring-white/20"
            />

            <div class="min-w-0">
              <h2
                id="assistant-panel-title"
                class="truncate text-sm font-semibold tracking-wide"
              >
                {{ title }}
              </h2>
              <p
                v-if="contextSummary"
                class="mt-0.5 truncate text-xs text-white/70"
                data-testid="assistant-context-summary"
              >
                {{ contextSummary }}
              </p>
            </div>
          </div>

          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            class="shrink-0 rounded-full text-white hover:bg-white/15"
            type="button"
            data-testid="assistant-panel-close"
            aria-label="關閉 AI 助理"
            @click="emit('close')"
          />
        </header>

        <div
          class="flex items-center gap-2 border-b border-default px-4 py-2 text-xs"
          :class="
            contextReady
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-amber-50 text-amber-900'
          "
        >
          <span
            class="size-2 shrink-0 rounded-full bg-current"
            aria-hidden="true"
          />
          <span>{{ statusMessage }}</span>
        </div>

        <div
          class="sr-only"
          data-testid="assistant-panel-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ statusMessage }}
        </div>
      </template>

      <div class="h-full overflow-y-auto overscroll-contain">
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

      <template #footer>
        <slot name="footer">
          <div
            class="flex items-center gap-2"
            data-testid="assistant-panel-footer"
            aria-label="訊息輸入區"
            aria-disabled="true"
          >
            <UInput
              class="min-w-0 flex-1"
              placeholder="訊息輸入將於後續階段啟用"
              disabled
            />
            <UButton
              icon="fluent:send-24-regular"
              class="rounded-full w-10 h-10 flex items-center justify-center bg-gradient-to-r from-primary-900 to-primary-500 text-white hover:bg-white hover:scale-110 transition-transform"
              disabled
            />
          </div>
        </slot>
      </template>
    </UCard>
  </section>
</template>
