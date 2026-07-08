<script setup lang="ts">
import type { AssistantFeedbackValue } from '../../../types/assistant'

const props = withDefaults(
  defineProps<{
    modelValue?: AssistantFeedbackValue | null
    pending?: boolean
    disabled?: boolean
    error?: string | null
  }>(),
  {
    modelValue: null,
    pending: false,
    disabled: false,
    error: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: AssistantFeedbackValue]
  submit: [value: AssistantFeedbackValue]
}>()

const isDisabled = computed(() => props.pending || props.disabled)

function isSelected(value: AssistantFeedbackValue): boolean {
  return props.modelValue === value
}

function getButtonVariant(value: AssistantFeedbackValue): 'soft' | 'ghost' {
  return isSelected(value) ? 'soft' : 'ghost'
}

function handleSelect(value: AssistantFeedbackValue) {
  if (isDisabled.value) {
    return
  }

  emit('update:modelValue', value)
  emit('submit', value)
}
</script>

<template>
  <div
    class="flex flex-col items-start gap-1"
    data-testid="assistant-feedback-controls"
    :aria-busy="pending ? 'true' : 'false'"
  >
    <div class="flex items-center gap-1">
      <UButton
        :color="isSelected('helpful') ? 'primary' : 'neutral'"
        :variant="getButtonVariant('helpful')"
        size="xs"
        icon="fluent:thumb-like-24-regular"
        :disabled="isDisabled"
        :loading="pending && modelValue === 'helpful'"
        :aria-pressed="isSelected('helpful') ? 'true' : 'false'"
        aria-label="這個回答有幫助"
        data-testid="assistant-feedback-helpful"
        class="!p-0.5 transition-colors"
        :ui="{ leadingIcon: 'size-4' }"
        @click="handleSelect('helpful')"
      />
      <UButton
        :color="isSelected('not_helpful') ? 'primary' : 'neutral'"
        :variant="getButtonVariant('not_helpful')"
        size="xs"
        icon="fluent:thumb-dislike-24-regular"
        :disabled="isDisabled"
        :loading="pending && modelValue === 'not_helpful'"
        :aria-pressed="isSelected('not_helpful') ? 'true' : 'false'"
        aria-label="這個回答沒有幫助"
        data-testid="assistant-feedback-not-helpful"
        class="!p-0.5 transition-colors"
        :ui="{ leadingIcon: 'size-4' }"
        @click="handleSelect('not_helpful')"
      />
    </div>

    <p
      v-if="error"
      class="text-[0.6875rem] text-error"
      data-testid="assistant-feedback-error"
    >
      {{ error }}
    </p>
  </div>
</template>
