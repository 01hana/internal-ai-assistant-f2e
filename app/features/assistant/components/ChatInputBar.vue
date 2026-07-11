<script setup lang="ts">
import type { AssistantSendDisabledReason } from "../composables/useChat";

const props = withDefaults(
  defineProps<{
    canSend?: boolean;
    disabledReason?: AssistantSendDisabledReason | null;
    isSending?: boolean;
    isStreaming?: boolean;
  }>(),
  {
    canSend: false,
    disabledReason: null,
    isSending: false,
    isStreaming: false,
  },
);

const emit = defineEmits<{
  send: [text: string];
  cancel: [];
}>();

const disabledMessages: Partial<Record<AssistantSendDisabledReason, string>> = {
  context_not_ready: "目前頁面內容尚未就緒",
  session_not_ready: "助理 session 尚未就緒",
  bootstrapping: "正在準備助理 session",
  streaming: "助理正在回應中",
  degraded: "助理目前處於降級狀態",
  unavailable: "助理目前無法使用",
  scope_changed: "頁面脈絡已變更，請重新開始此對話。",
};

const text = ref("");

const inputDisabled = computed(
  () =>
    props.disabledReason !== null && props.disabledReason !== "empty_message",
);
const disabledMessage = computed(() =>
  props.disabledReason && props.disabledReason !== "streaming"
    ? (disabledMessages[props.disabledReason] ?? null)
    : null,
);

function submit() {
  const normalizedText = text.value.trim();
  if (!props.canSend || !normalizedText) {
    return;
  }

  emit("send", normalizedText);
  text.value = "";
}

function handleKeydown(event: KeyboardEvent) {
  const composingEvent = event as KeyboardEvent & { isComposing?: boolean };
  if (composingEvent.isComposing) return;

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submit();
  }
}
</script>

<template>
  <div class="grid gap-2" data-testid="assistant-chat-input-bar">
    <div class="flex items-end gap-2">
      <UTextarea
        v-model="text"
        class="w-full"
        :rows="1"
        :disabled="inputDisabled"
        autoresize
        placeholder="輸入訊息..."
        data-testid="assistant-chat-input"
        @keydown="handleKeydown"
      />

      <UButton
        v-if="isStreaming"
        icon="i-lucide-square"
        color="error"
        variant="soft"
        class="w-10 h-10 justify-center rounded-full"
        data-testid="assistant-chat-cancel"
        aria-label="停止回覆"
        @click="emit('cancel')"
      />
      <UButton
        v-else
        icon="i-lucide-send"
        class="rounded-full w-10 h-10 flex items-center justify-center bg-gradient-to-r from-primary-600 to-primary-400 text-white hover:bg-white hover:scale-110 transition-transform"
        :loading="isSending"
        :disabled="!canSend"
        data-testid="assistant-chat-submit"
        aria-label="送出訊息"
        @click="submit"
      />
    </div>

    <p
      v-if="disabledMessage"
      id="assistant-chat-disabled-reason"
      class="text-xs text-muted"
      data-testid="assistant-chat-disabled-reason"
      role="status"
    >
      {{ disabledMessage }}
    </p>
  </div>
</template>
