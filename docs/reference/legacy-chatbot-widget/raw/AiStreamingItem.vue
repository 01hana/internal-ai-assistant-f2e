<script setup lang="ts">
/**
 * AiStreamingItem (T-028)
 *
 * Left-aligned AI streaming component with two states:
 *   - content is empty → shows TypingIndicator ("..." bounce animation)
 *   - content has tokens → shows bubble with blinking cursor
 *
 * Once streaming ends, useChat/useStreaming flips the type to 'ai' and
 * this component is replaced by AiMessageItem.
 */
import type { ChatMessageVM } from '~/types/chat';

const props = defineProps<{ message: ChatMessageVM }>();

const hasContent = computed(() => props.message.content.length > 0)
</script>

<template>
  <div class="flex items-end gap-2 px-4 py-1">
    <!-- Bot avatar -->
    <div
      class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow bg-gradient-to-br from-primary-800 to-primary-500"
    >
      <UIcon name="fluent:bot-24-regular" class="text-white" size="16" />
    </div>

    <!-- Typing indicator (no tokens yet) -->
    <div
      v-if="!hasContent"
      class="rounded-[16px_16px_16px_4px] px-4 py-3 shadow-sm bg-white border border-gray-200"
    >
      <div class="flex gap-1.5 items-center h-4">
        <span
          v-for="delay in [0, 150, 300]"
          :key="delay"
          class="w-2 h-2 rounded-full animate-bounce bg-primary-600 opacity-60"
          :style="{ animationDelay: `${delay}ms` }"
        />
      </div>
    </div>

    <!-- Streaming bubble (tokens arriving) -->
    <div
      v-else
      class="bg-white border border-gray-200 text-gray-800 px-3.5 py-2.5 rounded-[16px_16px_16px_4px] text-sm leading-relaxed shadow-sm min-h-[36px] max-w-[75%]"
    >
      <span class="whitespace-pre-wrap break-words">{{ props.message.content }}</span>
      <!-- Blinking cursor -->
      <span
        class="inline-block w-0.5 h-[1em] ml-0.5 bg-gray-500 align-text-bottom cursor-blink"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<style scoped>
.cursor-blink {
  animation: blink 0.8s step-end infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
</style>
