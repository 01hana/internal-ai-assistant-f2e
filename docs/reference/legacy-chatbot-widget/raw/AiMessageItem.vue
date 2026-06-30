<script setup lang="ts">
/**
 * AiMessageItem (T-028 / T-040)
 * Left-aligned AI bubble with avatar, markdown rendering, relative timestamp,
 * inline feedback (thumb up/down + reason chips) and per-message quick-reply chips.
 *
 * T-040 changes:
 *   - Uses useFeedback for API call (fire-and-forget).
 *   - Optimistic local toggle on ChatMessageVM.rating (direct store mutation).
 *   - 'down' expands reason chips; selecting a reason re-fires the API with reason.
 *   - Re-clicking the same value cancels the rating (no API call on cancel).
 * Also handles ai-streaming state: shows TypingIndicator when
 * message.type === 'ai-streaming' and content is empty.
 */
import type { ChatMessageVM } from '~/types/chat';
import { formatDateTime } from '~/utils/format';
import { renderMarkdown } from '~/utils/markdown';
import { useFeedback } from '~/features/chat/composables/useFeedback';

const props = defineProps<{ message: ChatMessageVM }>();

const emit = defineEmits<{
  'quick-reply': [text: string];
}>();

const { t } = useI18n();
const { submitFeedback } = useFeedback();

const html = computed(() => renderMarkdown(props.message.content));
const timeStr = computed(() => formatDateTime(props.message.timestamp));

// Typing indicator: ai-streaming with no tokens yet
const isStreaming = computed(() => props.message.type === 'ai-streaming');

// ── Feedback ─────────────────────────────────────────────────────────────────

/** Show reason chips after a 'down' vote. */
const [showReasonChips, setShowReasonChips] = useAppState(false);

const REASON_KEYS = ['inaccurate', 'incomplete', 'notRelevant', 'other'] as const;
type ReasonKey = typeof REASON_KEYS[number];

function handleRateUp() {
  const wasCancelled = props.message.rating === 'up';
  // Optimistic toggle
  props.message.rating = wasCancelled ? null : 'up';
  setShowReasonChips(false);
  if (!wasCancelled) {
    submitFeedback(props.message.id, 'up');
  }
}

function handleRateDown() {
  const wasCancelled = props.message.rating === 'down';
  // Optimistic toggle
  props.message.rating = wasCancelled ? null : 'down';
  if (wasCancelled) {
    setShowReasonChips(false);
  } else {
    setShowReasonChips(true);
    submitFeedback(props.message.id, 'down');
  }
}

function handleReason(key: ReasonKey) {
  submitFeedback(props.message.id, 'down', key);
  setShowReasonChips(false);
}
</script>

<template>
  <div data-testid="ai-message" class="flex items-end gap-2 px-4 py-1 group">
    <!-- Bot avatar -->
    <div
      class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow bg-gradient-to-br from-primary-800 to-primary-500"
    >
      <UIcon name="fluent:bot-24-regular" class="text-white" size="16" />
    </div>

    <div class="flex flex-col items-start gap-1 max-w-[75%]">
      <!-- Typing indicator (ai-streaming, no tokens) -->
      <div
        v-if="isStreaming"
        data-testid="typing-indicator"
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

      <!-- AI message bubble -->
      <div
        v-else
        data-testid="ai-bubble"
        class="bg-white border border-gray-200 text-gray-800 px-3.5 py-2.5 rounded-[16px_16px_16px_4px] text-sm leading-relaxed shadow-sm prose prose-sm max-w-none"
        v-html="html"
      />

      <!-- Timestamp + feedback row (always visible for ai messages) -->
      <div v-if="!isStreaming" class="flex items-center gap-2 px-1">
        <time data-testid="message-time" class="text-[10px] text-gray-400">{{ timeStr }}</time>

        <!-- Thumb buttons -->
        <div class="flex gap-1">
          <UButton
            data-testid="btn-rate-up"
            color="neutral"
            variant="ghost"
            size="xs"
            class="!p-0.5 transition-colors"
            :class="
              message.rating === 'up' ? 'text-emerald-500' : 'text-gray-300 hover:text-gray-500'
            "
            @click="handleRateUp"
          >
            <UIcon name="fluent:thumb-like-24-regular" size="13" />
          </UButton>

          <UButton
            data-testid="btn-rate-down"
            color="neutral"
            variant="ghost"
            size="xs"
            class="!p-0.5 transition-colors"
            :class="
              message.rating === 'down' ? 'text-red-400' : 'text-gray-300 hover:text-gray-500'
            "
            @click="handleRateDown"
          >
            <UIcon name="fluent:thumb-dislike-24-regular" size="13" />
          </UButton>
        </div>
      </div>

      <!-- Reason chips (shown after 'down' vote) -->
      <div
        v-if="showReasonChips"
        data-testid="feedback-reason-chips"
        class="flex flex-wrap gap-1.5 px-1 mt-0.5"
      >
        <UButton
          v-for="key in REASON_KEYS"
          :key="key"
          :data-testid="`reason-${key}`"
          size="xs"
          color="neutral"
          variant="outline"
          class="rounded-full text-xs"
          @click="handleReason(key)"
        >
          {{ t(`feedback.reasons.${key}`) }}
        </UButton>
      </div>

      <!-- Per-message quick-reply chips -->
      <div v-if="!isStreaming && message.quickReplies?.length" data-testid="quick-reply-chips" class="flex flex-wrap gap-2 mt-1">
        <UButton
          v-for="reply in message.quickReplies"
          :key="reply"
          :label="reply"
          class="shrink-0 px-3 py-1.5 rounded-full border border-primary-300 text-xs text-primary-600 font-medium bg-white hover:bg-primary-50 active:bg-primary-100 transition-colors whitespace-nowrap"
          @click="emit('quick-reply', reply)"
        />
      </div>
    </div>
  </div>
</template>
