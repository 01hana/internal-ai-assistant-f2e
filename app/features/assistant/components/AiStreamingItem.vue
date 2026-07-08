<script setup lang="ts">
import type {
  AssistantStreamingActivity,
  AssistantStreamingUiMessage,
} from "../../../types/assistant";

const props = defineProps<{
  message: AssistantStreamingUiMessage;
}>();

const activities = computed<AssistantStreamingActivity[]>(
  () => props.message.activities ?? [],
);
const isFinalized = computed(
  () =>
    props.message.status === "completed" &&
    props.message.finalAnswerDecision !== undefined,
);
const isActive = computed(() =>
  ["sending", "connecting", "streaming", "finalizing"].includes(
    props.message.status,
  ),
);
const isTyping = computed(
  () => isActive.value && props.message.content.length === 0,
);
const statusLabel = computed(() => {
  if (isFinalized.value) {
    return "回應已完成";
  }

  switch (props.message.status) {
    case "cancelled":
      return "回應已停止";
    case "failed":
      return "回應未能完成";
    case "interrupted":
      return "回應在完成前中斷";
    default:
      return props.message.content ? "等待最終結果" : "正在準備回應";
  }
});
const hasContent = computed(() => props.message.content.length > 0);
</script>

<template>
  <div class="flex max-w-full min-w-0 flex-col items-start gap-1.5" aria-live="polite">
    <div
      v-if="isTyping"
      class="rounded-2xl rounded-bl-md border border-default bg-default px-4 py-3 shadow-sm"
      data-testid="assistant-typing-indicator"
      role="status"
    >
      <span class="sr-only">AI 助理正在輸入</span>
      <span class="flex h-4 items-center gap-1.5" aria-hidden="true">
        <span
          v-for="delay in [0, 150, 300]"
          :key="delay"
          class="size-2 animate-bounce rounded-full bg-primary-600 opacity-60 motion-reduce:animate-none"
          :style="{ animationDelay: `${delay}ms` }"
          data-testid="assistant-typing-dot"
        />
      </span>
    </div>

    <div
      v-else-if="hasContent"
      class="max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-bl-md border border-default bg-default px-3.5 py-2.5 text-sm leading-relaxed text-highlighted shadow-sm"
      data-testid="assistant-streaming-content"
    >
      {{ message.content
      }}<span
        v-if="isActive"
        class="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-muted align-text-bottom motion-reduce:animate-none"
        data-testid="assistant-streaming-cursor"
        aria-hidden="true"
      />
    </div>

    <ul
      v-if="activities.length"
      class="grid list-none gap-1.5 px-1 py-0 text-xs text-muted"
      aria-label="助理處理進度"
    >
      <li
        v-for="activity in activities"
        :key="activity.key"
        class="flex items-center gap-2"
        data-testid="assistant-streaming-activity"
      >
        <UIcon
          :name="
            activity.kind === 'tool_completed'
              ? 'i-lucide-circle-check'
              : activity.kind === 'tool_blocked' ||
                  activity.kind === 'tool_failed' ||
                  activity.kind === 'stream_error'
                ? 'i-lucide-triangle-alert'
                : 'i-lucide-loader-circle'
          "
          class="size-3.5 shrink-0"
          aria-hidden="true"
        />
        <span>{{ activity.label }}</span>
      </li>
    </ul>

    <div class="flex items-center gap-2 px-1 text-xs text-muted">
      <UIcon
        v-if="isActive && !isTyping"
        name="i-lucide-loader-circle"
        class="size-3.5 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <UIcon
        v-else-if="isFinalized"
        name="i-lucide-circle-check"
        class="size-3.5 text-success"
        aria-hidden="true"
      />
      <span
        :data-testid="
          isFinalized
            ? 'assistant-streaming-finalized'
            : 'assistant-streaming-status'
        "
      >
        {{ statusLabel }}
      </span>
    </div>
  </div>
</template>
