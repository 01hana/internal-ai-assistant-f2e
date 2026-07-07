<script setup lang="ts">
interface UserMessagePresentation {
  content: string
  createdAt: string
}

const props = defineProps<{
  message: UserMessagePresentation
}>()

const { formatMessageTime } = useFormat()

const formattedCreatedAt = computed(() => {
  return formatMessageTime(props.message.createdAt)
})
</script>

<template>
  <article
    class="flex w-full items-end justify-end gap-2"
    data-testid="assistant-user-message"
  >
    <div class="flex max-w-[78%] min-w-0 flex-col items-end gap-1">
      <div
        class="max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-br-md bg-gradient-to-br from-primary-700 to-primary-500 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm"
        data-testid="assistant-user-bubble"
      >
        {{ message.content }}
      </div>

      <time
        v-if="formattedCreatedAt"
        class="px-1 text-[0.6875rem] text-muted"
        :datetime="message.createdAt"
        data-testid="assistant-user-message-time"
      >
        {{ formattedCreatedAt }}
      </time>
    </div>

    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-sm"
      aria-hidden="true"
    >
      <UIcon
        name="i-lucide-user-round"
        class="size-4"
      />
    </div>
  </article>
</template>
