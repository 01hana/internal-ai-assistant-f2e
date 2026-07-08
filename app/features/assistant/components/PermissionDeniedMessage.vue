<script setup lang="ts">
import type {
  AssistantStreamingUiMessage,
  AssistantSystemStateMessage,
  HistoryMessageSummary,
} from "../../../types/assistant";

type PermissionDeniedRenderableMessage =
  | AssistantStreamingUiMessage
  | AssistantSystemStateMessage
  | (HistoryMessageSummary & { role: "assistant" });

const props = defineProps<{
  message: PermissionDeniedRenderableMessage;
}>();

const permissionDeniedContent = computed(() => {
  const content = props.message.content.trim();
  return content || "你目前沒有足夠權限查看這項資訊。";
});
</script>

<template>
  <div
    class="flex max-w-full min-w-0 flex-col gap-3 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-bl-md border border-error/35 bg-error/8 px-3.5 py-2.5 text-sm leading-relaxed text-highlighted shadow-sm"
    data-testid="assistant-permission-denied-bubble"
  >
    <div class="flex items-center gap-2">
      <UBadge
        color="error"
        variant="subtle"
        size="sm"
        data-testid="assistant-permission-denied-label"
      >
        權限受限
      </UBadge>
    </div>

    <p data-testid="assistant-permission-denied-content">
      {{ permissionDeniedContent }}
    </p>
  </div>
</template>
