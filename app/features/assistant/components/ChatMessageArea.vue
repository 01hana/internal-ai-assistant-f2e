<script setup lang="ts">
import type {
  AssistantMessageRendererKind,
  AssistantUiMessage,
  HistoryMessageSummary,
} from "../../../types/assistant";

type AssistantRenderableMessage = AssistantUiMessage | HistoryMessageSummary;

type AssistantRendererSlot = "user" | "streaming" | "answered" | "safe-state";

const props = withDefaults(
  defineProps<{
    messages?: AssistantRenderableMessage[];
    contextReady?: boolean;
    nextCursor?: string | null;
    historyLoading?: boolean;
    historyLoadingMore?: boolean;
  }>(),
  {
    messages: () => [],
    contextReady: true,
    nextCursor: null,
    historyLoading: false,
    historyLoadingMore: false,
  },
);

defineEmits<{
  loadMore: [];
}>();

const messageAreaRef = ref<HTMLElement | null>(null);

async function scrollToBottom(behavior: ScrollBehavior = "smooth") {
  await nextTick();

  const container = messageAreaRef.value;
  if (!container || props.messages.length === 0) {
    return;
  }

  if (typeof container.scrollTo === "function") {
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    return;
  }

  container.scrollTop = container.scrollHeight;
}

watch(
  [() => props.messages.length, () => props.messages.at(-1)?.content],
  () => {
    void scrollToBottom("smooth");
  },
  { flush: "post" },
);

function isUiMessage(
  message: AssistantRenderableMessage,
): message is AssistantUiMessage {
  return "kind" in message;
}

function isCompletedStreamingMessage(
  message: AssistantRenderableMessage,
): message is Extract<AssistantUiMessage, { kind: "assistant_streaming" }> {
  return (
    isUiMessage(message) &&
    message.kind === "assistant_streaming" &&
    message.status === "completed" &&
    !!message.finalAnswerDecision
  );
}

function isAssistantHistoryMessage(
  message: AssistantRenderableMessage,
): message is HistoryMessageSummary & { role: "assistant" } {
  return !isUiMessage(message) && message.role === "assistant";
}

function isAiMessageRenderable(
  message: AssistantRenderableMessage,
): message is Extract<AssistantUiMessage, { kind: "assistant_answer" }>
  | Extract<AssistantUiMessage, { kind: "assistant_streaming" }>
  | (HistoryMessageSummary & { role: "assistant" }) {
  return (
    isCompletedStreamingMessage(message) ||
    isAssistantHistoryMessage(message) ||
    (isUiMessage(message) && message.kind === "assistant_answer")
  );
}

function getRendererSlot(
  message: AssistantRenderableMessage,
): AssistantRendererSlot {
  if (!isUiMessage(message)) {
    if (message.role === "user") {
      return "user";
    }

    return isAssistantHistoryMessage(message) ? "answered" : "safe-state";
  }

  const kind: AssistantMessageRendererKind = message.kind;

  switch (kind) {
    case "user":
      return "user";
    case "assistant_streaming":
      return isCompletedStreamingMessage(message) ? "answered" : "streaming";
    case "assistant_answer":
      return "answered";
    default:
      return "safe-state";
  }
}

function getMessageKey(message: AssistantRenderableMessage): string {
  return isUiMessage(message) ? message.key : message.messageId;
}

function getMessageKind(message: AssistantRenderableMessage): string {
  return isUiMessage(message) ? message.kind : `history_${message.role}`;
}
</script>

<template>
  <section
    ref="messageAreaRef"
    class="h-full min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5"
    data-testid="assistant-message-area"
    aria-label="助理訊息"
  >
    <slot v-if="!contextReady" name="context-not-ready">
      <UAlert
        icon="i-lucide-panel-top-inactive"
        color="warning"
        variant="subtle"
        title="目前頁面內容尚未就緒"
        description="AI 助理不會猜測尚未提供的頁面脈絡，請稍後再試。"
        data-testid="assistant-message-context-not-ready"
      />
    </slot>

    <UAlert
      v-else-if="historyLoading && messages.length === 0"
      icon="i-lucide-loader-circle"
      color="neutral"
      variant="subtle"
      title="正在還原對話"
      description="助理正在安全地載入這個 session 的訊息摘要。"
      data-testid="assistant-history-loading"
    />

    <slot v-else-if="messages.length === 0" name="empty">
      <UEmpty
        icon="i-lucide-message-circle"
        title="AI 助理已準備好"
        description="你可以在這裡開始內部工作查詢。"
        class="min-h-56"
        data-testid="assistant-message-empty"
      />
    </slot>

    <div v-else class="grid gap-3">
      <ol class="grid list-none gap-3 p-0" aria-label="對話訊息">
        <li
          v-for="(message, index) in props.messages"
          :key="getMessageKey(message)"
          class="min-w-0"
          :data-message-kind="getMessageKind(message)"
        >
          <slot
            :name="getRendererSlot(message)"
            :message="message"
            :index="index"
          >
            <UserMessageItem
              v-if="getRendererSlot(message) === 'user'"
              :message="message"
            />
            <AiStreamingItem
              v-else-if="
                isUiMessage(message) &&
                message.kind === 'assistant_streaming' &&
                getRendererSlot(message) === 'streaming'
              "
              :message="message"
            />
            <AiMessageItem
              v-else-if="isAiMessageRenderable(message)"
              :message="message"
            />
            <div
              v-else
              class="rounded-2xl rounded-bl-md border border-default bg-default px-4 py-3 text-sm text-highlighted shadow-sm"
            >
              {{ message.content }}
            </div>
          </slot>
        </li>
      </ol>

      <UButton
        v-if="nextCursor"
        class="justify-self-center"
        color="neutral"
        variant="soft"
        icon="i-lucide-history"
        :loading="historyLoadingMore"
        :disabled="historyLoadingMore"
        data-testid="assistant-history-load-more"
        @click="$emit('loadMore')"
      >
        載入更多訊息
      </UButton>
    </div>
  </section>
</template>
