<script setup lang="ts">
import type { AssistantSystemStateMessage } from "../../../types/assistant";

const props = defineProps<{
  message: AssistantSystemStateMessage;
  isRetrying?: boolean;
}>();

const emit = defineEmits<{
  retryRequested: [];
}>();

const safeTitle = computed(() => {
  if (props.message.safeTitle) {
    return props.message.safeTitle;
  }

  return props.message.degradedKind === "unavailable"
    ? "助理暫時無法使用"
    : "助理服務暫時不穩定";
});

const safeDescription = computed(() => {
  const content = props.message.content.trim();
  return content || "目前無法完成這次回覆，請稍後再試。";
});
</script>

<template>
  <div
    class="flex max-w-full min-w-0 flex-col gap-3 rounded-2xl rounded-bl-md border border-warning/35 bg-warning/8 px-3.5 py-2.5 text-sm text-highlighted shadow-sm"
    data-testid="assistant-degraded-bubble"
  >
    <div class="flex items-center gap-2">
      <UBadge
        color="warning"
        variant="subtle"
        size="sm"
        data-testid="assistant-degraded-title"
      >
        {{ safeTitle }}
      </UBadge>
    </div>

    <p
      class="whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]"
      data-testid="assistant-degraded-description"
    >
      {{ safeDescription }}
    </p>

    <div>
      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-lucide-rotate-cw"
        :loading="isRetrying"
        :disabled="isRetrying"
        data-testid="assistant-degraded-retry"
        @click="emit('retryRequested')"
      >
        {{ isRetrying ? "正在重新送出" : "重新送出" }}
      </UButton>
    </div>
  </div>
</template>
