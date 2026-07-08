<script setup lang="ts">
import type {
  AssistantStreamingUiMessage,
  AssistantSystemStateMessage,
  HistoryMessageSummary,
} from "../../../types/assistant";

type EscalationRenderableMessage =
  | AssistantStreamingUiMessage
  | AssistantSystemStateMessage
  | (HistoryMessageSummary & { role: "assistant" });

const props = defineProps<{
  message: EscalationRenderableMessage;
}>();

const escalationContent = computed(() => {
  const content = props.message.content.trim();
  return content || "目前資訊不足以自動完成，請依內部流程接續處理。";
});
</script>

<template>
  <div
    class="flex max-w-full min-w-0 flex-col gap-3 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-bl-md border border-info/35 bg-info/8 px-3.5 py-2.5 text-sm leading-relaxed text-highlighted shadow-sm"
    data-testid="assistant-escalation-bubble"
  >
    <div class="flex items-center gap-2">
      <UBadge
        color="info"
        variant="subtle"
        size="sm"
        data-testid="assistant-escalation-label"
      >
        需要升級處理
      </UBadge>
    </div>

    <p data-testid="assistant-escalation-content">
      {{ escalationContent }}
    </p>
  </div>
</template>
