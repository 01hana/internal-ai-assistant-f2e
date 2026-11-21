<script setup lang="ts">
import { computed, ref } from "vue";
import {
  FEEDBACK_COMMENT_MAX,
  FEEDBACK_REASON_OPTIONS,
  type AssistantFeedbackDetails,
  type AssistantFeedbackIntent,
} from "../../feedback/feedbackReasons";

/** Shown after 👎: pick what was wrong and optionally say more, or skip (the negative rating is already sent). */
const props = defineProps<{ pending?: boolean }>();
const emit = defineEmits<{ submit: [details: AssistantFeedbackDetails]; skip: [] }>();

const intent = ref<AssistantFeedbackIntent | null>(null);
const comment = ref("");
const reason = computed(() => FEEDBACK_REASON_OPTIONS.find((option) => option.intent === intent.value)?.label);
const canSubmit = computed(() => !props.pending && (intent.value !== null || comment.value.trim() !== ""));

function submit() {
  if (!canSubmit.value) return;
  const text = comment.value.trim();
  emit("submit", { intent: intent.value ?? "other", ...(reason.value ? { reason: reason.value } : {}), ...(text ? { comment: text } : {}) });
}
</script>

<template>
  <form class="assistant-feedback-reason" data-testid="assistant-feedback-reason" @submit.prevent="submit">
    <p class="assistant-feedback-reason__title">哪裡不夠好？（選填）</p>
    <div class="assistant-feedback-reason__options" role="radiogroup" aria-label="回饋原因">
      <button
        v-for="option in FEEDBACK_REASON_OPTIONS"
        :key="option.intent"
        type="button"
        role="radio"
        class="assistant-feedback-reason__option"
        :aria-checked="intent === option.intent ? 'true' : 'false'"
        :data-testid="`assistant-feedback-reason-${option.intent}`"
        @click="intent = intent === option.intent ? null : option.intent"
      >
        {{ option.label }}
      </button>
    </div>
    <textarea
      v-model="comment"
      class="assistant-feedback-reason__comment"
      data-testid="assistant-feedback-reason-comment"
      rows="2"
      :maxlength="FEEDBACK_COMMENT_MAX"
      placeholder="想補充的說明（選填）"
      aria-label="補充說明"
    />
    <div class="assistant-feedback-reason__actions">
      <button type="button" class="assistant-feedback-reason__skip" data-testid="assistant-feedback-reason-skip" @click="emit('skip')">略過</button>
      <button type="submit" class="assistant-feedback-reason__submit" data-testid="assistant-feedback-reason-submit" :disabled="!canSubmit">送出</button>
    </div>
  </form>
</template>
