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

const answerDecisionStateLabels: Record<"answered", string> = {
  answered: "已回答",
};

const answerDecisionStateColors: Record<"answered", "success"> = {
  answered: "success",
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
  if (!answerDecisionState.value || answerDecisionState.value.kind !== "answered") {
    return null;
  }

  return answerDecisionStateLabels.answered;
});

const answerDecisionColor = computed(() => {
  if (!answerDecisionState.value || answerDecisionState.value.kind !== "answered") {
    return "neutral";
  }

  return answerDecisionStateColors.answered;
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
</template>
