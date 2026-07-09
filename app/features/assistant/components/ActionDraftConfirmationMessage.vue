<script setup lang="ts">
import type {
  ActionDraftDetailState,
  AssistantStreamingUiMessage,
  AssistantSystemStateMessage,
  HistoryMessageSummary,
} from "../../../types/assistant";

type ActionDraftRenderableMessage =
  | AssistantStreamingUiMessage
  | AssistantSystemStateMessage
  | (HistoryMessageSummary & { role: "assistant" });

const props = defineProps<{
  message: ActionDraftRenderableMessage;
  actionDraftState?: ActionDraftDetailState | null;
}>();

const emit = defineEmits<{
  confirm: [payload: { actionDraftId: string }];
  cancel: [payload: { actionDraftId: string }];
}>();

const expiresAtFormatter = new Intl.DateTimeFormat("zh-TW", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: false,
  timeZone: "Asia/Taipei",
});

const actionDraftId = computed(() => {
  if (props.actionDraftState?.actionDraftId) {
    return props.actionDraftState.actionDraftId;
  }

  if ("finalDecisionState" in props.message) {
    return props.message.finalDecisionState?.kind === "confirmation_required"
      ? props.message.finalDecisionState.actionDraftId
      : undefined;
  }

  if ("actionDraftId" in props.message) {
    return props.message.actionDraftId;
  }

  return undefined;
});

const actionDraftDetail = computed(() => props.actionDraftState?.detail);
const operationStatus = computed(
  () => props.actionDraftState?.operationStatus ?? "idle",
);
const detailStatus = computed(
  () => props.actionDraftState?.detailStatus ?? "idle",
);
const detailUnavailableMessage = computed(
  () => props.actionDraftState?.safeMessage ?? "目前無法載入確認內容，請稍後再試。",
);

const previewRows = computed(() => {
  const preview = actionDraftDetail.value?.preview;
  if (!preview) {
    return [];
  }

  return Object.entries(preview)
    .filter(([, value]) =>
      value === null
      || typeof value === "string"
      || typeof value === "number"
      || typeof value === "boolean",
    )
    .map(([label, value]) => ({
      label,
      value: value === null ? "null" : String(value),
    }));
});

const riskLevel = computed(() => actionDraftDetail.value?.riskLevel ?? null);
const formattedExpiresAt = computed(() => {
  const expiresAt = actionDraftDetail.value?.expiresAt;
  if (!expiresAt) {
    return null;
  }

  const date = new Date(expiresAt);
  return Number.isNaN(date.getTime()) ? expiresAt : expiresAtFormatter.format(date);
});

const terminalStatus = computed(() => {
  const operationStatus = props.actionDraftState?.operationStatus;
  if (
    operationStatus === "cancelled"
    || operationStatus === "expired"
    || operationStatus === "executed"
  ) {
    return operationStatus;
  }

  const status =
    actionDraftDetail.value?.status ?? props.actionDraftState?.actionDraftStatus;

  return status === "expired"
    || status === "failed"
    || status === "cancelled"
    || status === "executed"
    ? status
    : null;
});

const terminalLabel = computed(() => {
  switch (terminalStatus.value) {
    case "expired":
      return "已逾期";
    case "failed":
      return "未完成";
    case "cancelled":
      return "已取消";
    case "executed":
      return "已完成";
    default:
      return null;
  }
});

const isConfirming = computed(() => operationStatus.value === "confirming");
const isCancelling = computed(() => operationStatus.value === "cancelling");
const isPreparingDetail = computed(() => detailStatus.value === "loading");
const isPendingGuard = computed(
  () => operationStatus.value === "pending_execution_guard",
);
const isSubmitted = computed(() => operationStatus.value === "submitted");
const isFailedRetryable = computed(
  () =>
    operationStatus.value === "failed"
    && props.actionDraftState?.actionDraftStatus !== "failed",
);
const isExecuted = computed(
  () =>
    operationStatus.value === "executed"
    || props.actionDraftState?.actionDraftStatus === "executed",
);

const isLoading = computed(
  () => isPreparingDetail.value || isConfirming.value || isCancelling.value,
);

const detailAvailable = computed(() => detailStatus.value === "available");
const confirmDisabled = computed(
  () =>
    !actionDraftId.value
    || isLoading.value
    || isPendingGuard.value
    || isSubmitted.value
    || terminalStatus.value !== null
    || detailStatus.value === "unavailable"
    || detailStatus.value === "idle"
    || props.actionDraftState?.actionDraftStatus === "failed",
);
const cancelDisabled = computed(
  () =>
    !actionDraftId.value
    || isLoading.value
    || isPendingGuard.value
    || isSubmitted.value
    || terminalStatus.value !== null
    || detailStatus.value === "unavailable"
    || detailStatus.value === "idle"
    || props.actionDraftState?.actionDraftStatus === "failed",
);
const messageContent = computed(() => {
  const content = props.message.content.trim();
  return content || "請確認以下動作後再繼續。";
});
const statusMessage = computed(() => {
  if (isConfirming.value) {
    return "正在送出確認";
  }

  if (isCancelling.value) {
    return "正在取消";
  }

  if (isPendingGuard.value) {
    return (
      props.actionDraftState?.safeMessage
      ?? "已送出確認，系統仍在處理，請勿重複操作。"
    );
  }

  if (isSubmitted.value) {
    return "確認已送出，系統會依既有保護機制繼續處理。";
  }

  if (isExecuted.value) {
    return "系統已回報這個操作完成。";
  }

  if (terminalStatus.value === "expired") {
    return "此確認已過期，請重新發起請求。";
  }

  if (terminalStatus.value === "cancelled") {
    return "已取消，此操作不會繼續。";
  }

  if (terminalStatus.value === "failed") {
    return "確認流程暫時無法完成，請稍後再試。";
  }

  if (isFailedRetryable.value) {
    return (
      props.actionDraftState?.safeMessage ?? "確認流程暫時無法完成，請稍後再試。"
    );
  }

  return "此操作尚未執行，請確認後再繼續。";
});

function emitConfirm() {
  if (!actionDraftId.value || confirmDisabled.value) {
    return;
  }

  emit("confirm", { actionDraftId: actionDraftId.value });
}

function emitCancel() {
  if (!actionDraftId.value || cancelDisabled.value) {
    return;
  }

  emit("cancel", { actionDraftId: actionDraftId.value });
}
</script>

<template>
  <div
    class="flex max-w-full min-w-0 flex-col gap-3 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-bl-md border border-warning/35 bg-warning/8 px-3.5 py-2.5 text-sm leading-relaxed text-highlighted shadow-sm"
    data-testid="assistant-action-draft-bubble"
  >
    <div class="flex items-center gap-2">
      <UBadge
        color="warning"
        variant="subtle"
        size="sm"
        data-testid="assistant-action-draft-title"
      >
        需要確認
      </UBadge>

      <UBadge
        v-if="terminalLabel"
        color="neutral"
        variant="soft"
        size="sm"
        data-testid="assistant-action-draft-terminal-status"
      >
        {{ terminalLabel }}
      </UBadge>
    </div>

    <p data-testid="assistant-action-draft-content">
      {{ messageContent }}
    </p>

    <div
      v-if="isLoading"
      class="flex items-center gap-2 text-xs text-muted"
      data-testid="assistant-action-draft-loading"
    >
      <UIcon name="i-lucide-loader-circle" class="animate-spin motion-reduce:animate-none" />
      <span>{{
        isPreparingDetail
          ? "正在整理確認內容"
          : isCancelling
            ? "正在取消"
            : "正在送出確認"
      }}</span>
    </div>

    <div
      v-else-if="detailAvailable"
      class="grid gap-3"
      data-testid="assistant-action-draft-preview"
    >
      <dl
        v-if="previewRows.length > 0"
        class="grid gap-2 rounded-xl border border-default bg-default/70 px-3 py-2"
      >
        <div
          v-for="row in previewRows"
          :key="row.label"
          class="grid gap-1 text-xs"
        >
          <dt class="font-medium text-muted">{{ row.label }}</dt>
          <dd class="text-highlighted">{{ row.value }}</dd>
        </div>
      </dl>

      <p
        v-else
        class="rounded-xl border border-default bg-default/70 px-3 py-2 text-xs text-muted"
        data-testid="assistant-action-draft-preview-unavailable"
      >
        已收到操作摘要，但目前沒有可顯示的欄位。
      </p>

      <div class="flex flex-wrap items-center gap-2 text-xs">
        <UBadge
          v-if="riskLevel"
          color="warning"
          variant="soft"
          data-testid="assistant-action-draft-risk"
        >
          風險等級：{{ riskLevel }}
        </UBadge>

        <UBadge
          v-if="formattedExpiresAt"
          color="neutral"
          variant="soft"
          data-testid="assistant-action-draft-expires-at"
        >
          有效期限：{{ formattedExpiresAt }}
        </UBadge>
      </div>

    </div>

    <UAlert
      v-else
      color="neutral"
      variant="subtle"
      icon="i-lucide-alert-circle"
      :description="detailUnavailableMessage"
      data-testid="assistant-action-draft-error"
    />

    <UAlert
      v-if="isPendingGuard"
      color="warning"
      variant="subtle"
      icon="i-lucide-shield-alert"
      :description="statusMessage"
      data-testid="assistant-action-draft-pending-guard"
    />

    <UAlert
      v-else-if="isSubmitted"
      color="neutral"
      variant="subtle"
      icon="i-lucide-hourglass"
      :description="statusMessage"
      data-testid="assistant-action-draft-submitted"
    />

    <UAlert
      v-else-if="isExecuted"
      color="success"
      variant="subtle"
      icon="i-lucide-badge-check"
      :description="statusMessage"
      data-testid="assistant-action-draft-executed"
    />

    <UAlert
      v-else-if="isFailedRetryable"
      color="error"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      :description="statusMessage"
      data-testid="assistant-action-draft-operation-error"
    />

    <div class="flex flex-wrap items-center gap-2">
      <UButton
        color="warning"
        variant="solid"
        size="sm"
        :disabled="confirmDisabled"
        :loading="operationStatus === 'confirming'"
        data-testid="assistant-action-draft-confirm"
        @click="emitConfirm"
      >
        確認執行
      </UButton>

      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        :disabled="cancelDisabled"
        :loading="operationStatus === 'cancelling'"
        data-testid="assistant-action-draft-cancel"
        @click="emitCancel"
      >
        取消
      </UButton>
    </div>

    <p
      class="text-xs text-muted"
      data-testid="assistant-action-draft-status-copy"
    >
      {{ statusMessage }}
    </p>
  </div>
</template>
