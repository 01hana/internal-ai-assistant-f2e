<script setup lang="ts">
/**
 * ChatMessageArea (T-028)
 *
 * Renders the full message list by mapping each ChatMessageVM.type to its
 * component via a registry map — avoids a giant v-if chain.
 *
 * Auto-scrolls to the bottom whenever messages change.
 */

import type { ChatMessageVM } from '~/types/chat';
import type { LocaleKey } from '~/types/chat';
import UserMessageItem from './UserMessageItem.vue';
import AiMessageItem from './AiMessageItem.vue';
import AiStreamingItem from './AiStreamingItem.vue';
import SystemErrorItem from './SystemErrorItem.vue';
import SystemTimeoutItem from './SystemTimeoutItem.vue';
import SystemInterceptedItem from './SystemInterceptedItem.vue';
import SystemLowConfidenceItem from './SystemLowConfidenceItem.vue';
import SystemFallbackItem from './SystemFallbackItem.vue';
import LeadFormCard from './LeadFormCard.vue';
import HandoffStatusCard from './HandoffStatusCard.vue';
import { renderMarkdown } from '~/utils/markdown';

// ── Component registry ────────────────────────────────────────────────────

type MessageComponent = ReturnType<typeof defineComponent>;
const componentMap: Record<ChatMessageVM['type'], MessageComponent> = {
  user: UserMessageItem,
  ai: AiMessageItem,
  'ai-streaming': AiStreamingItem,
  'system-error': SystemErrorItem,
  'system-timeout': SystemTimeoutItem,
  'system-intercepted': SystemInterceptedItem,
  'system-low-confidence': SystemLowConfidenceItem,
  'system-fallback': SystemFallbackItem,
  // Phase 2 items
  'lead-form': LeadFormCard,
  'handoff-status': HandoffStatusCard,
};

// ── Props / emits ─────────────────────────────────────────────────────────

const props = defineProps<{
  messages: ChatMessageVM[];
}>();

const emit = defineEmits<{
  retry: [messageId: string];
  'quick-reply': [text: string];
}>();

// ── Auto-scroll ───────────────────────────────────────────────────────────

const bottomRef = ref<HTMLElement | null>(null);
const configStore = useWidgetConfigStore();
const { t, locale } = useI18n();

watch(
  [() => props.messages.length, () => props.messages.at(-1)?.content],
  async () => {
    await nextTick();
    bottomRef.value?.scrollIntoView({ behavior: 'smooth' });
  },
  { immediate: true },
);

function currentLocale() {
  return (locale.value === 'en' ? 'en' : 'zh-TW') satisfies LocaleKey;
}

function localeText(value?: Partial<Record<LocaleKey, string>>) {
  const lang = currentLocale();

  return value?.[lang] ?? value?.['zh-TW'] ?? value?.en;
}

const welcomeText = computed(() =>
  localeText(configStore.config?.welcomeMessage) ?? t('widget.welcome'),
);
const welcomeQuickReplies = computed(() => {
  const lang = currentLocale();

  return (
    configStore.config?.quickReplies?.[lang]
    ?? configStore.config?.quickReplies?.['zh-TW']
    ?? configStore.config?.quickReplies?.en
    ?? []
  ).filter(Boolean);
});
const welcomeHtml = computed(() => renderMarkdown(welcomeText.value));
</script>

<template>
  <div class="flex flex-col py-3 min-h-full">
    <!-- Empty state -->
    <div v-if="!messages.length" class="flex items-end gap-2 px-4 py-1 group">
      <div class="flex gap-3">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow bg-gradient-to-br from-primary-800 to-primary-500"
        >
          <UIcon name="fluent:bot-24-regular" class="text-white" size="16" />
        </div>

        <div class="flex flex-col items-start gap-1 max-w-[75%]">
          <div
            class="bg-white border border-gray-200 text-gray-800 px-3.5 py-2.5 rounded-[16px_16px_16px_4px] text-sm leading-relaxed shadow-sm prose prose-sm max-w-none"
            v-html="welcomeHtml"
          />

          <div v-if="welcomeQuickReplies.length" class="flex flex-wrap gap-2 mt-3">
            <UButton
              v-for="reply in welcomeQuickReplies"
              :key="reply"
              :label="reply"
              variant="outline"
              size="sm"
              class="rounded-full cursor-pointer"
              @click="emit('quick-reply', reply)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Message list -->
    <template v-else>
      <component
        :is="componentMap[message.type]"
        v-for="message in messages"
        :key="message.id"
        :message
        @retry="emit('retry', message.id)"
        @quick-reply="(text: string) => emit('quick-reply', text)"
      />
    </template>

    <!-- Scroll anchor -->
    <div ref="bottomRef" class="h-px shrink-0" aria-hidden="true" />
  </div>
</template>
