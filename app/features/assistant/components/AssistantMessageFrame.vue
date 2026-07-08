<script setup lang="ts">
import type { AssistantMessageFrameRole, IsoDateTime } from '../../../types/assistant'

const props = withDefaults(
  defineProps<{
    role: AssistantMessageFrameRole
    createdAt?: IsoDateTime
    messageTestId?: string
    timestampTestId?: string
    showTimestamp?: boolean
  }>(),
  {
    createdAt: undefined,
    messageTestId: 'assistant-message-frame',
    timestampTestId: undefined,
    showTimestamp: false,
  },
)

const { formatMessageTime } = useFormat()

const formattedCreatedAt = computed(() => {
  return props.createdAt ? formatMessageTime(props.createdAt) : null
})

const isAssistant = computed(() => props.role === 'assistant')
const alignmentClass = computed(() => {
  return isAssistant.value ? 'justify-start' : 'justify-end'
})
const contentAlignmentClass = computed(() => {
  return isAssistant.value ? 'items-start' : 'items-end'
})
</script>

<template>
  <article
    class="flex w-full items-end gap-2"
    :class="alignmentClass"
    :data-testid="messageTestId"
    data-frame-testid="assistant-message-frame"
    :data-message-role="role"
  >
    <AssistantAvatar v-if="isAssistant" role="assistant" />

    <div class="flex max-w-[78%] min-w-0 flex-col gap-1.5" :class="contentAlignmentClass">
      <slot />

      <div
        v-if="$slots['metadata-leading'] || (showTimestamp && formattedCreatedAt && createdAt)"
        class="flex items-center gap-2 px-1 text-[0.6875rem] text-muted"
        :class="isAssistant ? 'justify-start' : 'justify-end'"
        data-testid="assistant-message-metadata"
      >
        <slot name="metadata-leading" />

        <time
          v-if="showTimestamp && formattedCreatedAt && createdAt"
          :datetime="createdAt"
          :data-testid="timestampTestId"
        >
          {{ formattedCreatedAt }}
        </time>
      </div>
    </div>

    <AssistantAvatar v-if="!isAssistant" role="user" />
  </article>
</template>
