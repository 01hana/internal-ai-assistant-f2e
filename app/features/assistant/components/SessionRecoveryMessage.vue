<script setup lang="ts">
import type { AssistantSessionRecoveryReason } from '../../../utils/assistant/sessionRecovery'

const props = withDefaults(defineProps<{
  reason: AssistantSessionRecoveryReason
  busy?: boolean
}>(), {
  busy: false,
})

const recoveryCopy = computed(() => {
  if (props.reason === 'expired' || props.reason === 'closed') {
    return {
      title: '原有對話已結束',
      description: '你可以重新開始一個新的助理對話。',
    }
  }

  if (props.reason === 'invisible' || props.reason === 'not_found') {
    return {
      title: '原有對話目前無法存取',
      description: '請重新開始，助理不會沿用無法確認的對話內容。',
    }
  }

  return {
    title: '目前無法還原對話',
    description: '請稍後再試，或重新開始一個新的助理對話。',
  }
})

defineEmits<{
  restart: []
}>()
</script>

<template>
  <section
    class="flex min-h-full items-center justify-center p-4 sm:p-5"
    data-testid="assistant-session-recovery"
    aria-label="對話還原狀態"
  >
    <div class="grid w-full max-w-sm gap-4">
      <UAlert
        icon="i-lucide-history"
        color="warning"
        variant="subtle"
        :title="recoveryCopy.title"
        :description="recoveryCopy.description"
      />

      <UButton
        class="justify-center"
        color="primary"
        icon="i-lucide-rotate-ccw"
        :loading="busy"
        :disabled="busy"
        data-testid="assistant-session-restart"
        @click="$emit('restart')"
      >
        重新開始
      </UButton>
    </div>
  </section>
</template>
