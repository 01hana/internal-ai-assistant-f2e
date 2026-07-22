<script setup lang="ts">
import type {
  ApprovalRequestDetailState,
  AssistantStreamingUiMessage,
  AssistantSystemStateMessage,
  HistoryMessageSummary,
  OpenApprovalDetailPayload,
} from "../../../types/assistant";
import {
  createOpenApprovalDetailPayload,
  getApprovalRequestStatusLabel,
  getApprovalRiskLabel,
  normalizeApprovalSummaryRows,
} from "../../../../packages/assistant-runtime/src";

type ApprovalRenderableMessage =
  | AssistantStreamingUiMessage
  | AssistantSystemStateMessage
  | (HistoryMessageSummary & { role: "assistant" });

const props = withDefaults(
  defineProps<{
    message: ApprovalRenderableMessage;
    approvalRequestState?: ApprovalRequestDetailState | null;
    canOpenDetail?: boolean;
  }>(),
  {
    approvalRequestState: null,
    canOpenDetail: false,
  },
);

const emit = defineEmits<{
  openDetail: [payload: OpenApprovalDetailPayload];
}>();

const expiresAtFormatter = new Intl.DateTimeFormat("zh-TW", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: false,
  timeZone: "Asia/Taipei",
});

const approvalRequestId = computed(() => {
  if (props.approvalRequestState?.approvalRequestId) {
    return props.approvalRequestState.approvalRequestId;
  }

  if ("finalDecisionState" in props.message) {
    return props.message.finalDecisionState?.kind === "approval_required"
      ? (props.message.finalDecisionState.approvalRequestId ?? null)
      : null;
  }

  if ("approvalRequestId" in props.message) {
    return props.message.approvalRequestId ?? null;
  }

  return null;
});

const detailStatus = computed(
  () => props.approvalRequestState?.detailStatus ?? "idle",
);
const detailAvailable = computed(() => detailStatus.value === "available");
const detailUnavailable = computed(() => detailStatus.value === "unavailable");
const isLoading = computed(
  () => detailStatus.value === "loading" || detailStatus.value === "idle",
);
const safeMessage = computed(
  () => props.approvalRequestState?.safeMessage ?? "目前無法載入審核摘要，請稍後再試。",
);
const openDetailStatus = computed(
  () => props.approvalRequestState?.openDetailStatus ?? "idle",
);
const isOpeningDetail = computed(() => openDetailStatus.value === "opening");
const openDetailFailed = computed(() => openDetailStatus.value === "failed");
const openDetailUnavailableMessage = computed(() =>
  props.canOpenDetail ? null : "這個環境尚未提供審核詳情入口。",
);
const openDetailFailedMessage = computed(
  () =>
    props.approvalRequestState?.openDetailSafeMessage
    ?? "目前無法開啟審核詳情，請稍後再試。",
);

const statusLabel = computed(() =>
  getApprovalRequestStatusLabel(props.approvalRequestState?.status),
);

const riskLabel = computed(() =>
  getApprovalRiskLabel(props.approvalRequestState?.riskLevel),
);

const actionSummaryRows = computed(() =>
  normalizeApprovalSummaryRows(props.approvalRequestState?.actionSummary),
);
const payloadSummaryRows = computed(() =>
  normalizeApprovalSummaryRows(props.approvalRequestState?.payloadSummary),
);
const evidenceRefIds = computed(
  () => props.approvalRequestState?.evidenceRefIds ?? [],
);
const formattedExpiresAt = computed(() => {
  const expiresAt = props.approvalRequestState?.expiresAt;
  if (!expiresAt) {
    return null;
  }

  const date = new Date(expiresAt);
  return Number.isNaN(date.getTime())
    ? expiresAt
    : expiresAtFormatter.format(date);
});
const messageContent = computed(() => {
  const content = props.message.content.trim();
  return content || "這個操作需要額外審核後才能繼續。";
});

function emitOpenDetail() {
  if (!approvalRequestId.value || !props.canOpenDetail) {
    return;
  }

  emit(
    "openDetail",
    createOpenApprovalDetailPayload({
      approvalRequestId: approvalRequestId.value,
      requestId: props.approvalRequestState?.requestId,
      messageId: props.approvalRequestState?.messageId,
      sessionId: props.approvalRequestState?.sessionId,
    }),
  );
}
</script>

<template>
  <div
    class="flex max-w-full min-w-0 flex-col gap-3 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl rounded-bl-md border border-error/25 bg-error/5 px-3.5 py-2.5 text-sm leading-relaxed text-highlighted shadow-sm"
    data-testid="assistant-approval-request-bubble"
  >
    <div class="flex items-center gap-2">
      <UBadge
        color="error"
        variant="subtle"
        size="sm"
        data-testid="assistant-approval-request-title"
      >
        需要審核
      </UBadge>

      <UBadge
        v-if="statusLabel"
        color="neutral"
        variant="soft"
        size="sm"
        data-testid="assistant-approval-request-status"
      >
        {{ statusLabel }}
      </UBadge>

      <UBadge
        v-if="riskLabel"
        color="error"
        variant="soft"
        size="sm"
        data-testid="assistant-approval-request-risk"
      >
        風險等級：{{ riskLabel }}
      </UBadge>
    </div>

    <p data-testid="assistant-approval-request-content">
      {{ messageContent }}
    </p>

    <p
      v-if="approvalRequestId"
      class="text-xs text-muted"
      data-testid="assistant-approval-request-id"
    >
      審核請求：{{ approvalRequestId }}
    </p>

    <div
      v-if="isLoading"
      class="flex items-center gap-2 text-xs text-muted"
      data-testid="assistant-approval-request-loading"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="animate-spin motion-reduce:animate-none"
      />
      <span>正在整理審核摘要</span>
    </div>

    <div
      v-else-if="detailUnavailable"
      class="rounded-xl border border-default bg-default/70 px-3 py-2 text-xs text-muted"
      data-testid="assistant-approval-request-error"
    >
      {{ safeMessage }}
    </div>

    <div
      v-else-if="detailAvailable"
      class="grid gap-3"
      data-testid="assistant-approval-request-summary"
    >
      <dl
        v-if="actionSummaryRows.length > 0"
        class="grid gap-2 rounded-xl border border-default bg-default/70 px-3 py-2"
        data-testid="assistant-approval-request-action-summary"
      >
        <div
          v-for="row in actionSummaryRows"
          :key="`action:${row.key}`"
          class="grid gap-1 text-xs"
        >
          <dt class="font-medium text-muted">{{ row.label }}</dt>
          <dd class="text-highlighted">{{ row.value }}</dd>
        </div>
      </dl>

      <dl
        v-if="payloadSummaryRows.length > 0"
        class="grid gap-2 rounded-xl border border-default bg-default/70 px-3 py-2"
        data-testid="assistant-approval-request-payload-summary"
      >
        <div
          v-for="row in payloadSummaryRows"
          :key="`payload:${row.key}`"
          class="grid gap-1 text-xs"
        >
          <dt class="font-medium text-muted">{{ row.label }}</dt>
          <dd class="text-highlighted">{{ row.value }}</dd>
        </div>
      </dl>

      <div
        v-if="evidenceRefIds.length > 0"
        class="flex flex-wrap gap-2"
        data-testid="assistant-approval-request-evidence"
      >
        <UBadge
          v-for="evidenceRefId in evidenceRefIds"
          :key="evidenceRefId"
          color="neutral"
          variant="soft"
          size="sm"
        >
          {{ evidenceRefId }}
        </UBadge>
      </div>

      <p
        v-if="formattedExpiresAt"
        class="text-xs text-muted"
        data-testid="assistant-approval-request-expires-at"
      >
        有效期限：{{ formattedExpiresAt }}
      </p>
    </div>

    <div class="grid gap-2">
      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        :disabled="!canOpenDetail || !approvalRequestId || isOpeningDetail"
        data-testid="assistant-approval-request-open-detail"
        @click="emitOpenDetail"
      >
        {{ isOpeningDetail ? "正在開啟審核詳情" : "查看審核詳情" }}
      </UButton>

      <p
        v-if="openDetailUnavailableMessage"
        class="text-xs text-muted"
        data-testid="assistant-approval-request-open-detail-unavailable"
      >
        {{ openDetailUnavailableMessage }}
      </p>

      <p
        v-else-if="openDetailFailed"
        class="text-xs text-muted"
        data-testid="assistant-approval-request-open-detail-error"
      >
        {{ openDetailFailedMessage }}
      </p>
    </div>
  </div>
</template>
