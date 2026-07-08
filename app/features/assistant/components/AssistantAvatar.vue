<script setup lang="ts">
type AssistantAvatarRole = 'assistant' | 'user'

const props = withDefaults(
  defineProps<{
    role: AssistantAvatarRole
    ariaHidden?: boolean
    label?: string
  }>(),
  {
    ariaHidden: true,
    label: undefined,
  },
)

const avatarClasses = computed(() => {
  return props.role === 'assistant'
    ? 'bg-gradient-to-br from-primary-800 to-primary-500 text-white'
    : 'bg-gradient-to-br from-slate-500 to-slate-700 text-white'
})

const iconName = computed(() => {
  return props.role === 'assistant'
    ? 'fluent:bot-24-regular'
    : 'i-lucide-user-round'
})

const accessibleLabel = computed(() => {
  if (props.ariaHidden) {
    return undefined
  }

  return props.label ?? (props.role === 'assistant' ? 'AI 助理頭像' : '使用者頭像')
})
</script>

<template>
  <div
    class="flex size-8 shrink-0 items-center justify-center rounded-full shadow-sm"
    :class="avatarClasses"
    :aria-hidden="ariaHidden ? 'true' : undefined"
    :aria-label="accessibleLabel"
    data-testid="assistant-message-avatar"
    :data-avatar-role="role"
  >
    <UIcon
      :name="iconName"
      class="size-4"
      aria-hidden="true"
      :data-testid="
        role === 'assistant'
          ? 'assistant-message-avatar-assistant'
          : 'assistant-message-avatar-user'
      "
    />
  </div>
</template>
