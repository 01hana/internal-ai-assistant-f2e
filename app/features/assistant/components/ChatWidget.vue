<script setup lang="ts">
import type {
  AssistantHostContextProvider,
  AssistantPanelAvailability,
} from "../../../types/assistant";

interface ChatPanelExposed {
  focus: () => void;
}

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
  isBootstrapping,
  recoveryState,
} = chat;
const { isOpen, availability: storeAvailability } = storeToRefs(widgetStore);
const widgetRoot = useTemplateRef<HTMLElement>("widgetRoot");
const panelRef = useTemplateRef<ChatPanelExposed>("panelRef");
const launcherElement = computed(
  () =>
    widgetRoot.value?.querySelector<HTMLElement>(
      '[data-testid="assistant-launcher"]',
    ) ?? null,
);
const { focused: launcherFocused } = useFocus(launcherElement);

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
  panelRef.value?.focus();
  void chat.bootstrapOnPanelOpen();
}

async function closePanel() {
  widgetStore.close();
  await nextTick();
  launcherFocused.value = true;
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
    ref="widgetRoot"
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
        ref="panelRef"
        :availability="storeAvailability"
        :title="title"
        :context-summary="contextSummary"
        :messages="messages"
        :next-cursor="nextCursor"
        :history-loading="historyLoading"
        :history-loading-more="historyLoadingMore"
        :session-loading="isBootstrapping"
        :recovery-state="recoveryState"
        @close="closePanel"
        @load-more-history="chat.loadMoreHistory"
        @restart-session="chat.restartSession"
      />
    </Transition>

    <UButton
      data-testid="assistant-launcher"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      class="w-14 h-14 rounded-full shadow-2xl hover:scale-105 transition-transform flex items-center justify-center bg-gradient-to-r from-primary-900 to-primary-500 text-white"
      @click="togglePanel"
    >
      <UIcon name="fluent:chat-24-regular" size="24" />
    </UButton>
  </div>
</template>
