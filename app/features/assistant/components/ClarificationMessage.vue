<script setup lang="ts">
import type {
  AssistantStreamingUiMessage,
  AssistantSystemStateMessage,
  HistoryMessageSummary,
} from "../../../types/assistant";

type ClarificationRenderableMessage =
  | AssistantStreamingUiMessage
  | AssistantSystemStateMessage
  | (HistoryMessageSummary & { role: "assistant" });

const props = defineProps<{
  message: ClarificationRenderableMessage;
}>();

const clarificationContent = computed(() => {
  const content = props.message.content.trim();
  return content || "我需要再確認一些資訊。";
});
</script>

<template>
  <div
    class="flex max-w-full min-w-0 flex-col gap-3 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-bl-md border border-warning/40 bg-warning/8 px-3.5 py-2.5 text-sm leading-relaxed text-highlighted shadow-sm"
    data-testid="assistant-clarification-bubble"
  >
    <div class="flex items-center gap-2">
      <UBadge
        color="warning"
        variant="subtle"
        size="sm"
        data-testid="assistant-clarification-label"
    >
        需要補充資訊
      </UBadge>
    </div>

    <p data-testid="assistant-clarification-content">
      {{ clarificationContent }}
    </p>

    <p
      class="text-xs leading-relaxed text-muted"
      data-testid="assistant-clarification-hint"
    >
      請直接在下方補充資訊，我會在同一個對話中繼續協助。
    </p>
  </div>
</template>
