<script setup lang="ts">
import type {
  AssistantRenderableMessage,
  ResolvedAssistantMessageRenderer,
} from "../../../types/assistant";
import {
  resolveAssistantMessageRenderers,
} from "../../../utils/assistant/assistantMessageRendererResolver";
import AiMessageItem from "./AiMessageItem.vue";
import AiStreamingItem from "./AiStreamingItem.vue";
import ClarificationMessage from "./ClarificationMessage.vue";
import EscalationMessage from "./EscalationMessage.vue";
import NoAnswerMessage from "./NoAnswerMessage.vue";
import PermissionDeniedMessage from "./PermissionDeniedMessage.vue";
import ToolFailureMessage from "./ToolFailureMessage.vue";
import UserMessageItem from "./UserMessageItem.vue";

const rendererComponents = {
  user: UserMessageItem,
  assistant_answer: AiMessageItem,
  assistant_streaming: AiStreamingItem,
  clarification: ClarificationMessage,
  no_answer: NoAnswerMessage,
  permission_denied: PermissionDeniedMessage,
  tool_failure: ToolFailureMessage,
  escalation: EscalationMessage,
} as const;

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

const resolvedMessages = computed<ResolvedAssistantMessageRenderer[]>(() =>
  resolveAssistantMessageRenderers(props.messages),
);

function getRendererSlotName(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): "user" | "streaming" | "answered" | "safe-state" {
  switch (resolvedMessage.rendererKind) {
    case "user":
      return "user";
    case "assistant_streaming":
      return "streaming";
    case "assistant_answer":
      return "answered";
    default:
      return "safe-state";
  }
}

function shouldShowFeedbackPlaceholder(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): boolean {
  return resolvedMessage.rendererKind === "assistant_answer";
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
          v-for="(resolvedMessage, index) in resolvedMessages"
          :key="resolvedMessage.key"
          class="min-w-0"
          :data-message-kind="
            'kind' in resolvedMessage.message
              ? resolvedMessage.message.kind
              : `history_${resolvedMessage.message.role}`
          "
        >
          <AssistantMessageFrame
            v-if="resolvedMessage.frameRole"
            :role="resolvedMessage.frameRole"
            :created-at="resolvedMessage.message.createdAt"
            :message-test-id="resolvedMessage.messageTestId"
            :timestamp-test-id="resolvedMessage.timestampTestId"
            :show-timestamp="resolvedMessage.showTimestamp"
          >
            <template
              v-if="shouldShowFeedbackPlaceholder(resolvedMessage)"
              #metadata-leading
            >
              <div
                class="flex items-center gap-1"
                data-testid="assistant-feedback-placeholder"
              >
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="fluent:thumb-like-24-regular"
                  disabled
                  aria-label="回饋此回答有幫助"
                  data-testid="assistant-feedback-positive"
                  class="!p-0.5 transition-colors"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="fluent:thumb-dislike-24-regular"
                  disabled
                  aria-label="回饋此回答沒有幫助"
                  data-testid="assistant-feedback-negative"
                  class="!p-0.5 transition-colors"
                />
              </div>
            </template>

            <slot
              :name="getRendererSlotName(resolvedMessage)"
              :message="resolvedMessage.message"
              :index="index"
            >
              <component
                :is="
                  resolvedMessage.rendererKind === 'unsupported_safe_state'
                    ? 'div'
                    : rendererComponents[resolvedMessage.rendererKind]
                "
                v-bind="
                  resolvedMessage.rendererKind === 'unsupported_safe_state'
                    ? {
                        class:
                          'rounded-2xl rounded-bl-md border border-default bg-default px-4 py-3 text-sm text-highlighted shadow-sm',
                        'data-testid': 'assistant-unsupported-safe-state-body',
                      }
                    : { message: resolvedMessage.message }
                "
              >
                <template
                  v-if="resolvedMessage.rendererKind === 'unsupported_safe_state'"
                >
                  {{ resolvedMessage.message.content }}
                </template>
              </component>
            </slot>
          </AssistantMessageFrame>

          <div
            v-else
            class="rounded-2xl rounded-bl-md border border-default bg-default px-4 py-3 text-sm text-highlighted shadow-sm"
            :data-testid="resolvedMessage.messageTestId"
          >
            {{ resolvedMessage.message.content }}
          </div>
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
