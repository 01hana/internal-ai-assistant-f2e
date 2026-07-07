<script setup lang="ts">
import type {
  AssistantAnswerUiMessage,
  AssistantMessageFinalData,
  AssistantStreamingUiMessage,
  AnswerDecisionStatus,
  AnswerDecisionUiState,
  EvidenceReferenceDisplay,
  EvidenceRefsWireValue,
  HistoryMessageSummary,
} from "../../../types/assistant";
import { mapAnswerDecisionState } from "../../../utils/assistant/answerDecisionStateMapper";
import { normalizeEvidenceReferences } from "../../../utils/assistant/evidenceNormalizationAdapter";

type AssistantCompletedMessage =
  | AssistantAnswerUiMessage
  | AssistantStreamingUiMessage
  | HistoryMessageSummary;

const props = defineProps<{
  message: AssistantCompletedMessage;
}>();

const { formatMessageTime } = useFormat();

const formattedCreatedAt = computed(() => {
  return formatMessageTime(props.message.createdAt);
});

const answerDecisionStateLabels: Record<AnswerDecisionUiState["kind"], string> =
  {
    answered: "已回答",
    clarification_required: "需要補充資訊",
    no_answer: "無法安全回答",
    permission_denied: "權限受限",
    confirmation_required: "等待確認",
    approval_required: "等待核准",
    escalation_required: "已升級處理",
  };

const answerDecisionStateColors: Record<
  AnswerDecisionUiState["kind"],
  "success" | "warning" | "neutral" | "error"
> = {
  answered: "success",
  clarification_required: "warning",
  no_answer: "neutral",
  permission_denied: "error",
  confirmation_required: "warning",
  approval_required: "warning",
  escalation_required: "neutral",
};

function isStreamingCompletedMessage(
  message: AssistantCompletedMessage,
): message is AssistantStreamingUiMessage & {
  finalAnswerDecision: AnswerDecisionStatus;
} {
  return (
    "kind" in message &&
    message.kind === "assistant_streaming" &&
    message.status === "completed" &&
    !!message.finalAnswerDecision
  );
}

function isAnswerUiMessage(
  message: AssistantCompletedMessage,
): message is AssistantAnswerUiMessage {
  return "kind" in message && message.kind === "assistant_answer";
}

function isHistoryAssistantMessage(
  message: AssistantCompletedMessage,
): message is HistoryMessageSummary & { role: "assistant" } {
  return !("kind" in message);
}

function createHistoryDecisionInput(
  answerDecision: AnswerDecisionStatus | null | undefined,
  evidenceRefs?: EvidenceRefsWireValue,
): AssistantMessageFinalData | null {
  if (!answerDecision) {
    return null;
  }

  return {
    answerDecision,
    evidenceRefs: evidenceRefs ?? [],
  };
}

const answerDecisionState = computed<AnswerDecisionUiState | null>(() => {
  if (isStreamingCompletedMessage(props.message)) {
    return (
      props.message.finalDecisionState ??
      mapAnswerDecisionState({
        answerDecision: props.message.finalAnswerDecision,
        evidenceRefs: [],
      })
    );
  }

  if (isAnswerUiMessage(props.message)) {
    return mapAnswerDecisionState({
      answerDecision: props.message.answerDecision,
      evidenceRefs: [],
    });
  }

  if (!isHistoryAssistantMessage(props.message)) {
    return null;
  }

  const finalData = createHistoryDecisionInput(
    props.message.answerDecision ?? undefined,
    props.message.evidenceRefs,
  );

  return finalData ? mapAnswerDecisionState(finalData) : null;
});

const answerDecisionLabel = computed(() => {
  if (!answerDecisionState.value) {
    return null;
  }

  return answerDecisionStateLabels[answerDecisionState.value.kind];
});

const answerDecisionColor = computed(() => {
  if (!answerDecisionState.value) {
    return "neutral";
  }

  return answerDecisionStateColors[answerDecisionState.value.kind];
});

const evidence = computed<EvidenceReferenceDisplay[]>(() => {
  if ("evidence" in props.message && Array.isArray(props.message.evidence)) {
    return props.message.evidence;
  }

  if (isHistoryAssistantMessage(props.message)) {
    return normalizeEvidenceReferences(props.message.evidenceRefs);
  }

  return [];
});
</script>

<template>
  <article
    class="flex w-full items-end justify-start gap-2"
    data-testid="assistant-ai-message"
  >
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-800 to-primary-500 text-white shadow-sm"
      aria-hidden="true"
    >
      <UIcon name="fluent:bot-24-regular" class="size-4" />
    </div>

    <div class="flex max-w-[78%] min-w-0 flex-col items-start gap-1">
      <div
        class="flex max-w-full min-w-0 flex-col gap-3 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-bl-md border border-default bg-default px-3.5 py-2.5 text-sm leading-relaxed text-highlighted shadow-sm"
        data-testid="assistant-ai-bubble"
      >
        <div
          v-if="answerDecisionLabel"
          class="flex items-center gap-2"
          data-testid="assistant-ai-answer-decision"
        >
          <UBadge :color="answerDecisionColor" variant="subtle" size="sm">
            {{ answerDecisionLabel }}
          </UBadge>
        </div>

        <div>{{ message.content }}</div>

        <EvidenceDisplay v-if="evidence.length > 0" :evidence="evidence" />
      </div>

      <div class="flex items-center gap-2">
        <time
          v-if="formattedCreatedAt"
          class="text-[0.6875rem] text-muted"
          :datetime="message.createdAt"
          data-testid="assistant-ai-message-time"
        >
          {{ formattedCreatedAt }}
        </time>

        <div
          class="flex items-center gap-1"
          data-testid="assistant-feedback-placeholder"
        >
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="fluent:thumb-like-24-regular"
            disabled
            aria-label="回饋此回答有幫助"
            data-testid="assistant-feedback-positive"
            class="!p-0.5 transition-colors"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="fluent:thumb-dislike-24-regular"
            disabled
            aria-label="回饋此回答沒有幫助"
            data-testid="assistant-feedback-negative"
            class="!p-0.5 transition-colors"
          />
        </div>
      </div>
    </div>
  </article>
</template>
