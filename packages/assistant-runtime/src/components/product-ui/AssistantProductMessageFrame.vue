<script setup lang="ts">
import { computed } from "vue";

import AssistantProductIcon from "./AssistantProductIcon.vue";

const props = withDefaults(defineProps<{
  role: "assistant" | "user";
  createdAt?: string | null;
  messageTestId: string;
}>(), {
  createdAt: null,
});

const messageTimeFormatter = new Intl.DateTimeFormat("zh-TW", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Taipei",
});

const formattedCreatedAt = computed(() => {
  if (!props.createdAt) {
    return null;
  }

  const date = new Date(props.createdAt);
  return Number.isNaN(date.getTime()) ? null : messageTimeFormatter.format(date);
});
</script>

<template>
  <article
    class="assistant-message-frame"
    :class="`assistant-message-frame--${role}`"
    :data-testid="messageTestId"
    :data-message-role="role"
  >
    <span
      v-if="role === 'assistant'"
      class="assistant-message-avatar assistant-message-avatar--assistant"
      data-testid="assistant-message-avatar-assistant"
      aria-hidden="true"
    >
      <AssistantProductIcon name="bot" />
    </span>

    <div class="assistant-message-frame-content">
      <slot />
      <time
        v-if="formattedCreatedAt && createdAt"
        class="assistant-message-timestamp"
        data-testid="assistant-message-timestamp"
        :datetime="createdAt"
      >
        {{ formattedCreatedAt }}
      </time>
    </div>

    <span
      v-if="role === 'user'"
      class="assistant-message-avatar assistant-message-avatar--user"
      data-testid="assistant-message-avatar-user"
      aria-hidden="true"
    >
      <AssistantProductIcon name="user" />
    </span>
  </article>
</template>
