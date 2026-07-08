<script setup lang="ts">
interface UserMessagePresentation {
  content: string
}

defineProps<{
  message: UserMessagePresentation
}>()
</script>

<template>
  <div
    class="max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-br-md bg-gradient-to-br from-primary-700 to-primary-500 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm"
    data-testid="assistant-user-bubble"
  >
    {{ message.content }}
  </div>
</template>
