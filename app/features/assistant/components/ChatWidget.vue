<script setup lang="ts">
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
const {
  messages,
  nextCursor,
  historyLoading,
  historyLoadingMore,
  feedbackByMessageId,
  isBootstrapping,
  recoveryState,
  canSend,
  sendDisabledReason,
  isSending,
  isStreaming,
} = chat;
const { isOpen, availability: storeAvailability } = storeToRefs(widgetStore);

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
}

async function togglePanel() {
  if (isOpen.value) {
    await closePanel();
    return;
  }

  await openPanel();
}
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
      <ChatPanel
        v-if="isOpen"
        :availability="storeAvailability"
        :title="title"
        :messages="messages"
        :next-cursor="nextCursor"
        :history-loading="historyLoading"
        :history-loading-more="historyLoadingMore"
        :feedback-states="feedbackByMessageId"
        :session-loading="isBootstrapping"
        :recovery-state="recoveryState"
        :can-send="canSend"
        :send-disabled-reason="sendDisabledReason"
        :is-sending="isSending"
        :is-streaming="isStreaming"
        @close="closePanel"
        @load-more-history="chat.loadMoreHistory"
        @restart-session="chat.restartSession"
        @send-message="chat.sendMessage"
        @cancel-stream="chat.cancelStream"
        @feedback="chat.submitFeedback"
      />
    </Transition>

    <UButton
      data-testid="assistant-launcher"
      class="w-14 h-14 rounded-full shadow-2xl hover:scale-105 transition-transform flex items-center justify-center bg-gradient-to-r from-primary-800 to-primary-600 text-white"
      :aria-expanded="isOpen ? 'true' : 'false'"
      aria-controls="assistant-chat-panel"
      @click="togglePanel"
    >
      <UIcon name="fluent:chat-24-regular" size="24" />
    </UButton>
  </div>
</template>
