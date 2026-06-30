<script setup lang="ts">
/**
 * ChatInputBar (T-020)
 *
 * Bottom input area of the chat panel.
 *  - UTextarea with auto-resize, 500-char limit + red over-limit hint
 *  - Send button: disabled + spinner when streaming/sending
 *  - Cancel button: visible only while streaming
 *  - Enter to send (Shift+Enter = newline)
 *  - Whole bar disabled + message in fallback mode
 *
 * Emits:
 *  - send(text: string)   — parent / T-027 useChat will consume this
 *  - cancel               — parent will call useStreaming.cancelStream()
 */

const emit = defineEmits<{
  send: [text: string];
  cancel: [];
}>();

const { t } = useI18n();
const sessionStore = useChatSessionStore();
const widgetStore = useChatWidgetStore();

const text = ref('');
const MAX_CHARS = 500;

const isFallback = computed(() => widgetStore.mode === 'fallback');
const isStreaming = computed(
  () => sessionStore.streamingState === 'streaming' || sessionStore.streamingState === 'sending',
);
const isDisabled = computed(() => isFallback.value || isStreaming.value);
const isOverLimit = computed(() => text.value.length > MAX_CHARS);
const canSend = computed(
  () => !isDisabled.value && !isOverLimit.value && text.value.trim().length > 0,
);

function send() {
  if (!canSend.value) return;
  emit('send', text.value.trim());
  text.value = '';
}

function onKeydown(e: KeyboardEvent) {
  if ((e as any).isComposing) return;

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}
</script>

<template>
  <div class="px-3 pt-2 pb-1">
    <!-- Fallback mode overlay message -->
    <div
      v-if="isFallback"
      class="mb-2 px-3 py-2 rounded-lg bg-gray-100 text-xs text-gray-500 text-center"
    >
      {{ t('widget.fallback.description') }}
    </div>

    <div class="flex items-end gap-2">
      <div class="flex-1">
        <UTextarea
          v-model="text"
          data-testid="chat-input"
          :placeholder="t('widget.inputPlaceholder')"
          :disabled="isFallback"
          :maxlength="MAX_CHARS + 1"
          :rows="1"
          :class="{ 'ring-2 ring-red-400': isOverLimit }"
          class="w-full"
          autoresize
          @keydown="onKeydown"
        />
        <!-- Character counter (shown only when approaching limit) -->
        <span
          v-if="text.length > MAX_CHARS * 0.8"
          class="absolute bottom-1 right-2 text-[10px] pointer-events-none"
          :class="isOverLimit ? 'text-red-500 font-semibold' : 'text-gray-400'"
        >
          {{ text.length }}/{{ MAX_CHARS }}
        </span>
      </div>

      <!-- Cancel button (streaming only) -->
      <UButton
        v-if="isStreaming"
        variant="ghost"
        icon="i-heroicons-stop-circle"
        :aria-label="t('widget.cancel')"
        class="rounded-full w-10 h-10 flex items-center justify-center bg-gradient-to-r from-primary-600 to-primary-400 text-white hover:bg-white hover:scale-110 transition-transform"
        @click="emit('cancel')"
      />

      <!-- Send button -->
      <UButton
        v-else
        data-testid="btn-send"
        icon="fluent:send-24-regular"
        :disabled="!canSend"
        :loading="isStreaming"
        :aria-label="t('widget.send')"
        class="rounded-full w-10 h-10 flex items-center justify-center bg-gradient-to-r from-primary-600 to-primary-400 text-white hover:bg-white hover:scale-110 transition-transform"
        @click="send"
      />
    </div>

    <!-- Over-limit warning -->
    <p v-if="isOverLimit" class="mt-1 text-[10px] text-red-500 px-1">
      {{ t('widget.charLimit') }}
    </p>
  </div>
</template>
