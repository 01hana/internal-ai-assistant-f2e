<script setup lang="ts">
interface AssistantMessagePresentation {
  content: string
  createdAt: string
}

const props = defineProps<{
  message: AssistantMessagePresentation
}>()

const { formatMessageTime } = useFormat()

const formattedCreatedAt = computed(() => {
  return formatMessageTime(props.message.createdAt)
})
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
      <UIcon
        name="fluent:bot-24-regular"
        class="size-4"
      />
    </div>

    <div class="flex max-w-[78%] min-w-0 flex-col items-start gap-1">
      <div
        class="max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-bl-md border border-default bg-default px-3.5 py-2.5 text-sm leading-relaxed text-highlighted shadow-sm"
        data-testid="assistant-ai-bubble"
      >
        {{ message.content }}
      </div>

      <time
        v-if="formattedCreatedAt"
        class="px-1 text-[0.6875rem] text-muted"
        :datetime="message.createdAt"
        data-testid="assistant-ai-message-time"
      >
        {{ formattedCreatedAt }}
      </time>
    </div>
  </article>
</template>
