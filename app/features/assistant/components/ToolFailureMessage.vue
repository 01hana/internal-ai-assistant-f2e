<script setup lang="ts">
import type {
  AssistantStreamingUiMessage,
  AssistantSystemStateMessage,
  HistoryMessageSummary,
} from "../../../types/assistant";

type ToolFailureRenderableMessage =
  | AssistantStreamingUiMessage
  | AssistantSystemStateMessage
  | (HistoryMessageSummary & { role: "assistant" });

const props = defineProps<{
  message: ToolFailureRenderableMessage;
}>();

const toolFailureContent = computed(() => {
  const content = props.message.content.trim();
  return (
    content || "目前無法安全取得所需資料，請稍後再試或調整查詢條件。"
  );
});
</script>

<template>
  <div
    class="flex max-w-full min-w-0 flex-col gap-3 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-bl-md border border-error/35 bg-error/8 px-3.5 py-2.5 text-sm leading-relaxed text-highlighted shadow-sm"
    data-testid="assistant-tool-failure-bubble"
  >
    <div class="flex items-center gap-2">
      <UBadge
        color="error"
        variant="subtle"
        size="sm"
        data-testid="assistant-tool-failure-label"
      >
        內部資料查詢未完成
      </UBadge>
    </div>

    <p data-testid="assistant-tool-failure-content">
      {{ toolFailureContent }}
    </p>
  </div>
</template>
