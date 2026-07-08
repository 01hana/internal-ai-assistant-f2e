<script setup lang="ts">
import type {
  AssistantStreamingUiMessage,
  AssistantSystemStateMessage,
  HistoryMessageSummary,
  NoAnswerReason,
} from "../../../types/assistant";

type NoAnswerRenderableMessage =
  | AssistantStreamingUiMessage
  | AssistantSystemStateMessage
  | (HistoryMessageSummary & { role: "assistant" });

const props = defineProps<{
  message: NoAnswerRenderableMessage;
}>();

const noAnswerReasonLabels: Record<string, string> = {
  missing_page_context: "頁面脈絡不足",
  no_evidence: "缺少可信資料",
  evidence_conflict: "資料存在衝突",
  ambiguous_query: "問題條件不夠明確",
  low_confidence: "目前信心不足",
  unsupported_scope: "查詢範圍不支援",
};

const noAnswerReasonMessages: Record<string, string> = {
  missing_page_context:
    "目前頁面脈絡不足，請補充條件或切換到相關頁面後再試一次。",
  no_evidence: "目前找不到足夠可信的內部資料來回答。",
  evidence_conflict: "找到的資料存在衝突，需要人工確認或提供更多條件。",
  ambiguous_query: "問題條件不夠明確，請補充查詢對象或範圍。",
  low_confidence: "目前信心不足，為避免誤導暫不提供結論。",
  unsupported_scope: "目前頁面或資料範圍不支援這項查詢。",
  default: "目前無法安全回答這個問題。",
};

const noAnswerReason = computed<NoAnswerReason | undefined>(() => {
  if ("finalDecisionState" in props.message) {
    return props.message.finalDecisionState?.kind === "no_answer"
      ? props.message.finalDecisionState.noAnswerReason
      : undefined;
  }

  if ("noAnswerReason" in props.message) {
    return props.message.noAnswerReason;
  }

  return undefined;
});

const noAnswerLabel = computed(() => {
  if (!noAnswerReason.value) {
    return "安全無答案";
  }

  return noAnswerReasonLabels[noAnswerReason.value] ?? "安全無答案";
});

const noAnswerMessage = computed(() => {
  if (!noAnswerReason.value) {
    return noAnswerReasonMessages.default;
  }

  return noAnswerReasonMessages[noAnswerReason.value] ?? noAnswerReasonMessages.default;
});

const backendAnswer = computed(() => {
  const content = props.message.content.trim();
  return content.length > 0 && content !== noAnswerMessage.value ? content : null;
});
</script>

<template>
  <div
    class="flex max-w-full min-w-0 flex-col gap-3 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-bl-md border border-default bg-elevated/70 px-3.5 py-2.5 text-sm leading-relaxed text-highlighted shadow-sm"
    data-testid="assistant-no-answer-bubble"
  >
    <div class="flex items-center gap-2">
      <UBadge
        color="neutral"
        variant="subtle"
        size="sm"
        data-testid="assistant-no-answer-label"
      >
        {{ noAnswerLabel }}
      </UBadge>
    </div>

    <p data-testid="assistant-no-answer-content">
      {{ noAnswerMessage }}
    </p>

    <p
      v-if="backendAnswer"
      class="text-xs leading-relaxed text-muted"
      data-testid="assistant-no-answer-detail"
    >
      {{ backendAnswer }}
    </p>
  </div>
</template>
