<script setup lang="ts">
/**
 * ChatPanel
 *
 * 聊天面板容器，包含完整的布局與所有區塊邏輯：
 *   - Header（品牌標題 + 關閉按鈕）
 *   - Info Bar（服務說明）
 *   - Message Area（委派給 ChatMessageArea，含 Quick Replies）
 *   - Input Bar（委派給 ChatInputBar）
 *   - Disclaimer（底部免責聲明，降級時隱藏）
 *
 * 斷點寬度：
 *   Mobile (< 768px)    : 全螢幕 slide-up
 *   Tablet (768–1023px) : 右側 panel 340px
 *   Desktop (≥ 1024px)  : 右側 panel 380px
 */

import type { ChatMessageVM } from '~/types/chat';
import ChatMessageArea from './ChatMessageArea.vue';
import ChatInputBar from './ChatInputBar.vue';
import { en, zh_tw } from '@nuxt/ui/locale';

// ── Props / Emits ─────────────────────────────────────────────────────────

const props = defineProps<{
  messages: ChatMessageVM[];
}>();

const emit = defineEmits<{
  send: [text: string];
  cancel: [];
  'quick-reply': [text: string];
  retry: [messageId: string];
  reset: [];
}>();

// ── Stores / i18n ─────────────────────────────────────────────────────────

const { setOpen } = useChatWidgetStore();
const widgetStore = useChatWidgetStore();
const configStore = useWidgetConfigStore();
const { t, locale, setLocale } = useI18n();

const isFallback = computed(() => widgetStore.mode === 'fallback');

// Disclaimer text（降級時不顯示）
const disclaimer = computed(() => {
  if (isFallback.value) return null;
  return configStore.config?.disclaimer?.[locale.value] ?? t('widget.disclaimer');
});

function close() {
  widgetStore.setOpen(false);
}

onMounted(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  window.addEventListener('keydown', onKey);
  onUnmounted(() => window.removeEventListener('keydown', onKey));
});
</script>

<template>
  <div
    data-testid="chat-panel"
    class="fixed z-[9999] inset-0 md:inset-auto md:bottom-0 md:right-0 md:w-[340px] md:h-[calc(100dvh-48px)] lg:w-[380px] flex flex-col bg-white shadow-2xl overflow-hidden rounded-t-2xl md:rounded-2xl panel-enter"
    role="dialog"
    aria-label="AI 客服聊天面板"
    aria-modal="true"
  >
    <!-- ── Header ──────────────────────────────────────────────────── -->
    <div
      class="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-gradient-to-r from-primary-800 to-primary-600"
    >
      <div class="flex items-center gap-3">
        <div class="relative">
          <div
            class="w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center border border-white/20"
          >
            <UIcon name="fluent:bot-24-regular" class="text-white" size="19" />
          </div>
          <div
            class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white"
          />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-white font-semibold text-sm">智能客服</span>
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
              class="!bg-white/15 !text-white/80 !text-[10px]"
            >
              AI
            </UBadge>
          </div>
          <div class="flex items-center gap-1 mt-0.5">
            <div class="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            <span class="text-white/70 text-[11px]">{{ t('widget.description') }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-1">
        <UButton
          data-testid="btn-reset"
          color="neutral"
          variant="ghost"
          size="xs"
          class="rounded-full w-7 h-7 hover:bg-white/20 text-white"
          title="重新開始"
          @click="emit('reset')"
        >
          <UIcon name="fluent:arrow-counterclockwise-24-regular" size="13" />
        </UButton>

        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          class="rounded-full w-7 h-7 hover:bg-white/20 text-white"
          title="關閉"
          @click="setOpen(false)"
        >
          <UIcon name="fluent:dismiss-24-regular" size="13" />
        </UButton>
      </div>
    </div>

    <!-- ── Info Bar ────────────────────────────────────────────────── -->
    <div
      class="flex items-center justify-between gap-3 px-4 py-2 flex-shrink-0 border-b border-primary-100 bg-primary-50"
    >
      <div class="flex items-center gap-3">
        <UButton :to="`tel:`" variant="link" class="!p-0 !text-[11px] gap-1" label="聯絡我們">
          <template #leading>
            <UIcon name="fluent:call-24-regular" size="11" />
          </template>
        </UButton>

        <span class="text-gray-300">|</span>

        <UButton :to="`mailto:`" variant="link" class="!p-0 !text-[11px] gap-1" label="Email">
          <template #leading>
            <UIcon name="fluent:mail-24-regular" size="11" />
          </template>
        </UButton>
      </div>

      <ULocaleSelect
        :model-value="locale"
        :locales="[en, zh_tw]"
        size="xs"
        :ui="{
          base: 'ring-0 hover:bg-white/20',
        }"
        @update:model-value="setLocale($event as 'en' | 'zh-TW')"
      />
    </div>

    <!-- ── Message Area ────────────────────────────────────────────── -->
    <main class="flex-1 overflow-y-auto overscroll-contain">
      <ChatMessageArea
        :messages
        @retry="emit('retry', $event)"
        @quick-reply="emit('quick-reply', $event)"
      />
    </main>

    <!-- ── Input Bar + Disclaimer ──────────────────────────────────── -->
    <footer class="shrink-0 border-t border-gray-100">
      <ChatInputBar @send="emit('send', $event)" @cancel="emit('cancel')" />

      <p
        v-if="disclaimer"
        class="px-4 pb-3 pt-1 text-[10px] leading-relaxed text-gray-400 text-center"
      >
        {{ disclaimer }}
      </p>
    </footer>
  </div>
</template>

<style scoped>
/* Mobile: slide-up entrance */
@media (max-width: 767px) {
  .panel-enter {
    animation: slide-up 0.3s ease forwards;
  }
  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
}

/* Tablet + Desktop: slide-in from right */
@media (min-width: 768px) {
  .panel-enter {
    animation: slide-in-right 0.25s ease forwards;
  }
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
}
</style>
