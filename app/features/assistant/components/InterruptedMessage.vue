<script setup lang="ts">
import type { AssistantStreamingUiMessage } from "../../../types/assistant";

const props = defineProps<{
  message: AssistantStreamingUiMessage;
  isRetrying?: boolean;
}>();

const emit = defineEmits<{
  retryRequested: [];
}>();

const statusTitle = computed(() => {
  switch (props.message.status) {
    case "cancelled":
      return "回覆已停止";
    case "failed":
      return "回覆未能完成";
    default:
      return "回覆已中斷";
  }
});

const statusDescription = computed(() => {
  switch (props.message.status) {
    case "cancelled":
      return "這次回覆已停止，如需繼續請重新送出。";
    case "failed":
      return "目前無法完成這次回覆，請重新送出。";
    default:
      return "這次回覆尚未完成，請重新送出。";
  }
});

const partialContent = computed(() => {
  const content = props.message.content.trim();
  return content.length > 0 ? content : null;
});
</script>

<template>
  <div
    class="flex max-w-full min-w-0 flex-col gap-3 rounded-2xl rounded-bl-md border border-warning/35 bg-warning/8 px-3.5 py-2.5 text-sm text-highlighted shadow-sm"
    data-testid="assistant-interrupted-bubble"
  >
    <div class="flex items-center gap-2">
      <UBadge
        color="warning"
        variant="subtle"
        size="sm"
        data-testid="assistant-interrupted-title"
      >
        {{ statusTitle }}
      </UBadge>
    </div>

    <p
      class="whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]"
      data-testid="assistant-interrupted-description"
    >
      {{ statusDescription }}
    </p>

    <div
      v-if="partialContent"
      class="rounded-xl border border-default/70 bg-default/80 px-3 py-2 text-xs leading-relaxed text-muted"
      data-testid="assistant-interrupted-partial"
    >
      {{ partialContent }}
    </div>

    <div>
      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-lucide-rotate-cw"
        :loading="isRetrying"
        :disabled="isRetrying"
        data-testid="assistant-interrupted-retry"
        @click="emit('retryRequested')"
      >
        {{ isRetrying ? "正在重新送出" : "重新送出" }}
      </UButton>
    </div>
  </div>
</template>
