<script setup lang="ts">
import type {
  AssistantMessageRendererKind,
  AssistantUiMessage,
} from '../../../types/assistant'

type AssistantRendererSlot =
  | 'user'
  | 'streaming'
  | 'answered'
  | 'safe-state'

withDefaults(defineProps<{
  messages?: AssistantUiMessage[]
  contextReady?: boolean
}>(), {
  messages: () => [],
  contextReady: true,
})

function getRendererSlot(
  kind: AssistantMessageRendererKind,
): AssistantRendererSlot {
  switch (kind) {
    case 'user':
      return 'user'
    case 'assistant_streaming':
      return 'streaming'
    case 'assistant_answer':
      return 'answered'
    default:
      return 'safe-state'
  }
}
</script>

<template>
  <section
    class="h-full min-h-0 p-4 sm:p-5"
    data-testid="assistant-message-area"
    aria-label="助理訊息"
  >
    <slot
      v-if="!contextReady"
      name="context-not-ready"
    >
      <UAlert
        icon="i-lucide-panel-top-inactive"
        color="warning"
        variant="subtle"
        title="目前頁面內容尚未就緒"
        description="AI 助理不會猜測尚未提供的頁面脈絡，請稍後再試。"
        data-testid="assistant-message-context-not-ready"
      />
    </slot>

    <slot
      v-else-if="messages.length === 0"
      name="empty"
    >
      <UEmpty
        icon="i-lucide-message-circle"
        title="AI 助理已準備好"
        description="你可以在這裡開始內部工作查詢。"
        class="min-h-56"
        data-testid="assistant-message-empty"
      />
    </slot>

    <ol
      v-else
      class="grid list-none gap-3 p-0"
      aria-label="對話訊息"
    >
      <li
        v-for="(message, index) in messages"
        :key="message.key"
        class="min-w-0"
        :data-message-kind="message.kind"
      >
        <slot
          :name="getRendererSlot(message.kind)"
          :message="message"
          :index="index"
        >
          <article class="max-w-[85%] [overflow-wrap:anywhere] rounded-2xl border border-default bg-default px-4 py-3 text-sm text-highlighted shadow-sm">
            {{ message.content }}
          </article>
        </slot>
      </li>
    </ol>
  </section>
</template>
