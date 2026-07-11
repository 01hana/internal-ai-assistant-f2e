<script setup lang="ts">
import type {
  ActionDraftDetailState,
  ApprovalRequestDetailState,
  AssistantFeedbackValue,
  AssistantMessageFeedbackUiState,
  AssistantRenderableMessage,
  OpenApprovalDetailPayload,
  ResolvedAssistantMessageRenderer,
} from "../../../types/assistant";
import {
  resolveAssistantMessageRenderers,
} from "../../../utils/assistant/assistantMessageRendererResolver";
import ActionDraftConfirmationMessage from "./ActionDraftConfirmationMessage.vue";
import ApprovalRequestDisplayMessage from "./ApprovalRequestDisplayMessage.vue";
import AiMessageItem from "./AiMessageItem.vue";
import AiStreamingItem from "./AiStreamingItem.vue";
import ClarificationMessage from "./ClarificationMessage.vue";
import DegradedMessage from "./DegradedMessage.vue";
import EscalationMessage from "./EscalationMessage.vue";
import FeedbackControls from "./FeedbackControls.vue";
import InterruptedMessage from "./InterruptedMessage.vue";
import NoAnswerMessage from "./NoAnswerMessage.vue";
import PermissionDeniedMessage from "./PermissionDeniedMessage.vue";
import ToolFailureMessage from "./ToolFailureMessage.vue";
import UserMessageItem from "./UserMessageItem.vue";

const rendererComponents = {
  user: UserMessageItem,
  assistant_answer: AiMessageItem,
  assistant_streaming: AiStreamingItem,
  degraded: DegradedMessage,
  interrupted: InterruptedMessage,
  confirmation: ActionDraftConfirmationMessage,
  approval: ApprovalRequestDisplayMessage,
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
    feedbackStates?: Record<string, AssistantMessageFeedbackUiState>;
    actionDraftStates?: Record<string, ActionDraftDetailState>;
    approvalRequestStates?: Record<string, ApprovalRequestDetailState>;
    canOpenApprovalDetail?: boolean;
    retryingMessageKey?: string | null;
  }>(),
  {
    messages: () => [],
    contextReady: true,
    nextCursor: null,
    historyLoading: false,
    historyLoadingMore: false,
    feedbackStates: () => ({}),
    actionDraftStates: () => ({}),
    approvalRequestStates: () => ({}),
    canOpenApprovalDetail: false,
    retryingMessageKey: null,
  },
);

const emit = defineEmits<{
  loadMore: [];
  feedback: [
    payload: {
      messageId: string;
      value: AssistantFeedbackValue;
      requestId?: string | null;
    },
  ];
  confirmActionDraft: [payload: { actionDraftId: string }];
  cancelActionDraft: [payload: { actionDraftId: string }];
  openApprovalDetail: [payload: OpenApprovalDetailPayload];
  retryRequested: [payload: { key: string; requestId?: string | null }];
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

function shouldShowFeedbackControls(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): boolean {
  return resolvedMessage.rendererKind === "assistant_answer";
}

function getActionDraftId(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): string | null {
  if ("finalDecisionState" in resolvedMessage.message) {
    return resolvedMessage.message.finalDecisionState?.kind === "confirmation_required"
      ? (resolvedMessage.message.finalDecisionState.actionDraftId ?? null)
      : null;
  }

  if ("actionDraftId" in resolvedMessage.message) {
    return resolvedMessage.message.actionDraftId ?? null;
  }

  return null;
}

function getActionDraftState(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): ActionDraftDetailState | null {
  const actionDraftId = getActionDraftId(resolvedMessage);
  return actionDraftId ? (props.actionDraftStates[actionDraftId] ?? null) : null;
}

function getApprovalRequestId(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): string | null {
  if ("finalDecisionState" in resolvedMessage.message) {
    return resolvedMessage.message.finalDecisionState?.kind === "approval_required"
      ? (resolvedMessage.message.finalDecisionState.approvalRequestId ?? null)
      : null;
  }

  if ("approvalRequestId" in resolvedMessage.message) {
    return resolvedMessage.message.approvalRequestId ?? null;
  }

  return null;
}

function getApprovalRequestState(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): ApprovalRequestDetailState | null {
  const approvalRequestId = getApprovalRequestId(resolvedMessage);
  return approvalRequestId
    ? (props.approvalRequestStates[approvalRequestId] ?? null)
    : null;
}

function getFeedbackState(messageId: string | undefined) {
  if (!messageId) {
    return {
      value: null,
      pending: false,
      error: null,
    };
  }

  return (
    props.feedbackStates[messageId] ?? {
      value: null,
      pending: false,
      error: null,
      requestId: null,
    }
  );
}

function getFeedbackValue(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): AssistantFeedbackValue | null {
  return getFeedbackState(resolvedMessage.message.messageId).value;
}

function isFeedbackPending(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): boolean {
  return getFeedbackState(resolvedMessage.message.messageId).pending;
}

function isFeedbackDisabled(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): boolean {
  return !resolvedMessage.message.messageId;
}

function getFeedbackError(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): string | null {
  return getFeedbackState(resolvedMessage.message.messageId).error;
}

function getMessageRequestId(
  resolvedMessage: ResolvedAssistantMessageRenderer,
): string | null {
  return "requestId" in resolvedMessage.message
    ? (resolvedMessage.message.requestId ?? null)
    : null;
}

function handleFeedbackSubmit(
  resolvedMessage: ResolvedAssistantMessageRenderer,
  value: AssistantFeedbackValue,
) {
  const { messageId } = resolvedMessage.message;

  if (!messageId) {
    return;
  }

  emit("feedback", {
    messageId,
    value,
    requestId: getMessageRequestId(resolvedMessage),
  });
}

function handleConfirmActionDraft(
  actionDraftId: string,
) {
  emit("confirmActionDraft", { actionDraftId });
}

function handleCancelActionDraft(
  actionDraftId: string,
) {
  emit("cancelActionDraft", { actionDraftId });
}

function handleOpenApprovalDetail(
  resolvedMessage: ResolvedAssistantMessageRenderer,
  approvalRequestId: string,
) {
  const approvalRequestState = getApprovalRequestState(resolvedMessage);

  emit("openApprovalDetail", {
    approvalRequestId,
    requestId: approvalRequestState?.requestId,
    messageId:
      approvalRequestState?.messageId
      ?? resolvedMessage.message.messageId
      ?? undefined,
    sessionId: approvalRequestState?.sessionId ?? undefined,
  });
}

function handleRetryRequested(
  resolvedMessage: ResolvedAssistantMessageRenderer,
) {
  emit("retryRequested", {
    key: resolvedMessage.key,
    requestId:
      "requestId" in resolvedMessage.message
        ? (resolvedMessage.message.requestId ?? null)
        : null,
  });
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
            <template v-if="shouldShowFeedbackControls(resolvedMessage)" #metadata-leading>
              <FeedbackControls
                :model-value="getFeedbackValue(resolvedMessage)"
                :pending="isFeedbackPending(resolvedMessage)"
                :disabled="isFeedbackDisabled(resolvedMessage)"
                :error="getFeedbackError(resolvedMessage)"
                @submit="value => handleFeedbackSubmit(resolvedMessage, value)"
              />
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
                    : {
                        message: resolvedMessage.message,
                        ...(resolvedMessage.rendererKind === 'confirmation'
                          ? {
                              actionDraftState: getActionDraftState(resolvedMessage),
                              onConfirm: ({ actionDraftId }: { actionDraftId: string }) => handleConfirmActionDraft(actionDraftId),
                              onCancel: ({ actionDraftId }: { actionDraftId: string }) => handleCancelActionDraft(actionDraftId),
                            }
                            : resolvedMessage.rendererKind === 'approval'
                            ? {
                                approvalRequestState: getApprovalRequestState(resolvedMessage),
                                canOpenDetail: canOpenApprovalDetail,
                                onOpenDetail: ({ approvalRequestId }: { approvalRequestId: string }) => handleOpenApprovalDetail(
                                  resolvedMessage,
                                  approvalRequestId,
                                ),
                              }
                            : resolvedMessage.rendererKind === 'interrupted'
                              || resolvedMessage.rendererKind === 'degraded'
                              ? {
                                  isRetrying: retryingMessageKey === resolvedMessage.key,
                                  onRetryRequested: () => handleRetryRequested(
                                    resolvedMessage,
                                  ),
                                }
                          : {}),
                      }
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
