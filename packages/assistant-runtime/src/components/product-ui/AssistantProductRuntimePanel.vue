<script setup lang="ts">
import { computed, isRef, nextTick, ref, watch } from "vue";
import {
  ACTION_DRAFT_PENDING_GUARD_MESSAGE,
  type ActionDraftDetailState,
} from "../../actions";
import {
  createOpenApprovalDetailPayload,
  getApprovalRequestStatusLabel,
  getApprovalRiskLabel,
  normalizeApprovalSummaryRows,
  type ApprovalRequestDetailState,
  type OpenApprovalDetailPayload,
} from "../../approvals";
import type { AssistantFeedbackValue } from "../../feedback";
import type { AssistantRuntimeSafeOutcomeKind } from "../../outcomes";
import type {
  AssistantRuntimeController,
  AssistantRuntimeStreamingMessage,
} from "../../runtime";
import type {
  EvidenceRefSummary,
  HistoryMessageSummary,
} from "../../types";
import AssistantProductIcon from "./AssistantProductIcon.vue";
import AssistantProductMessageFrame from "./AssistantProductMessageFrame.vue";

type RuntimeMessage = HistoryMessageSummary | AssistantRuntimeStreamingMessage | Record<string, unknown>;

interface FeedbackPayload {
  messageId: string;
  value: AssistantFeedbackValue;
  requestId?: string | null;
}

const props = defineProps<{
  controller: AssistantRuntimeController<RuntimeMessage>;
  runtimeScope: string;
  onSendMessage: (message: string) => void;
  onLoadMoreHistory: () => void;
  onCancelStreaming: () => void;
  onSubmitFeedback: (payload: FeedbackPayload) => void;
  onConfirmActionDraft: (actionDraftId: string) => void;
  onCancelActionDraft: (actionDraftId: string) => void;
  onOpenApprovalDetail: (payload: OpenApprovalDetailPayload) => void;
  onRetryMessage?: (key: string) => void;
  composerCanSend?: boolean;
  composerDisabledReason?: string | null;
}>();

const composerValue = ref("");
const messageAreaRef = ref<HTMLElement | null>(null);
const session = props.controller.stores.session;
const widget = props.controller.stores.widget;

function readStoreValue<T>(source: unknown, fallback: T): T {
  if (isRef(source)) {
    return source.value as T;
  }

  return source === undefined ? fallback : (source as T);
}

const messages = computed(() => readStoreValue<RuntimeMessage[]>(session.messages, []));
const nextCursor = computed(() => readStoreValue<string | null>(session.nextCursor, null));
const activeRequestId = computed(() => readStoreValue<string | null>(session.activeRequestId, null));
const sessionStatus = computed(() => readStoreValue(session.status, "idle"));
const sessionContextReady = computed(() => readStoreValue(session.contextReady, false));
const sessionLastError = computed(() => readStoreValue<{ safeMessage?: string } | null>(session.lastError, null));
const widgetAvailability = computed(() => readStoreValue(widget.availability, "normal"));
const isStreaming = computed(() => Boolean(activeRequestId.value));

const externalDisabledMessages: Record<string, string> = {
  bootstrapping: "正在準備助理 session",
  context_not_ready: "目前頁面內容尚未就緒",
  degraded: "助理目前處於降級狀態",
  scope_changed: "頁面脈絡已變更，請重新開始此對話。",
  session_not_ready: "助理 session 尚未就緒",
  unavailable: "助理目前無法使用",
};

const panelStatus = computed(() => {
  if (widgetAvailability.value === "degraded") {
    return "助理服務暫時不穩定";
  }
  if (widgetAvailability.value === "unavailable") {
    return "助理暫時無法使用";
  }
  if (!sessionContextReady.value) {
    return "目前頁面內容尚未就緒";
  }
  return "AI 助理已就緒";
});

const disabledReason = computed(() => {
  if (props.composerDisabledReason) {
    return externalDisabledMessages[props.composerDisabledReason] ?? props.composerDisabledReason;
  }
  if (props.composerCanSend === false) {
    return "助理 session 尚未就緒";
  }
  if (widgetAvailability.value === "degraded") {
    return "助理目前處於降級狀態";
  }
  if (widgetAvailability.value === "unavailable") {
    return "助理目前無法使用";
  }
  if (sessionStatus.value === "restoring" || sessionStatus.value === "creating") {
    return "正在準備助理 session";
  }
  if (sessionStatus.value === "loading_history") {
    return "正在載入歷史訊息，請稍候。";
  }
  if (sessionStatus.value === "error") {
    return sessionLastError.value?.safeMessage ?? "助理狀態已變更，請重新整理後再試。";
  }
  if (isStreaming.value) {
    return "streaming";
  }
  if (sessionStatus.value !== "ready" || !sessionContextReady.value) {
    return "目前頁面內容尚未就緒";
  }
  return null;
});

const canSend = computed(() => props.composerCanSend ?? (disabledReason.value === null));
const inputDisabled = computed(() => disabledReason.value !== null && disabledReason.value !== "streaming");
const disabledMessage = computed(() => disabledReason.value === "streaming" ? null : disabledReason.value);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function record(message: RuntimeMessage): Record<string, unknown> {
  return message as unknown as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function messageKey(message: RuntimeMessage, index: number): string {
  return readString(record(message).key) ?? readString(record(message).messageId) ?? `message:${index}`;
}

function messageId(message: RuntimeMessage): string {
  return readString(record(message).messageId) ?? readString(record(message).key) ?? "assistant-message";
}

function messageContent(message: RuntimeMessage): string {
  return readString(record(message).content) ?? "";
}

function messageCreatedAt(message: RuntimeMessage): string | null {
  return readString(record(message).createdAt);
}

function isUserMessage(message: RuntimeMessage): boolean {
  const source = record(message);
  return source.role === "user" || source.kind === "user";
}

function isStreamingMessage(message: RuntimeMessage): message is AssistantRuntimeStreamingMessage {
  return record(message).kind === "assistant_streaming";
}

function isActiveStreamingMessage(message: RuntimeMessage): boolean {
  return isStreamingMessage(message)
    && ["sending", "queued", "connecting", "streaming", "finalizing"].includes(message.status);
}

function isCompletedStreamingMessage(message: RuntimeMessage): boolean {
  return isStreamingMessage(message) && message.status === "completed";
}

function finalDecisionKind(message: RuntimeMessage): string | null {
  const source = record(message);
  const finalDecisionState = isRecord(source.finalDecisionState) ? source.finalDecisionState : null;
  return readString(finalDecisionState?.kind)
    ?? readString(source.finalAnswerDecision)
    ?? readString(source.answerDecision)
    ?? readString(source.kind);
}

function safeOutcomeKind(message: RuntimeMessage): AssistantRuntimeSafeOutcomeKind | null {
  const kind = finalDecisionKind(message);
  const source = record(message);
  const finalDecisionState = isRecord(source.finalDecisionState) ? source.finalDecisionState : null;
  const noAnswerReason = source.noAnswerReason ?? finalDecisionState?.noAnswerReason;

  if (kind === "no_answer" && noAnswerReason === "tool_failure") {
    return "tool_failure";
  }
  if (
    kind === "no_answer"
    || kind === "clarification_required"
    || kind === "permission_denied"
    || kind === "tool_failure"
    || kind === "timeout"
    || kind === "interrupted"
  ) {
    return kind;
  }
  return null;
}

function isEscalationMessage(message: RuntimeMessage): boolean {
  const source = record(message);
  return finalDecisionKind(message) === "escalation_required"
    || source.finalAnswerDecision === "escalation_required";
}

function isInterruptedMessage(message: RuntimeMessage): boolean {
  return isStreamingMessage(message)
    && ["interrupted", "cancelled", "failed"].includes(message.status);
}

function presentationTestId(message: RuntimeMessage): string {
  if (isUserMessage(message)) return "assistant-user-message";
  if (isActiveStreamingMessage(message)) return "assistant-streaming-message";
  if (isInterruptedMessage(message)) return "assistant-interrupted-message";

  switch (finalDecisionKind(message)) {
    case "clarification_required":
      return "assistant-clarification-message";
    case "confirmation_required":
      return "assistant-action-draft-message";
    case "approval_required":
      return "assistant-approval-request-message";
    case "permission_denied":
      return "assistant-permission-denied-message";
    case "escalation_required":
      return "assistant-escalation-message";
    default:
      return safeOutcomeKind(message) === "tool_failure"
        ? "assistant-tool-failure-message"
        : safeOutcomeKind(message) === "no_answer"
          ? "assistant-no-answer-message"
          : "assistant-ai-message";
  }
}

function noAnswerReason(message: RuntimeMessage): string | null {
  const source = record(message);
  const finalDecisionState = isRecord(source.finalDecisionState) ? source.finalDecisionState : null;
  return readString(source.noAnswerReason) ?? readString(finalDecisionState?.noAnswerReason);
}

function noAnswerLabel(message: RuntimeMessage): string {
  const labels: Record<string, string> = {
    ambiguous_query: "問題條件不夠明確",
    evidence_conflict: "資料存在衝突",
    low_confidence: "目前信心不足",
    missing_page_context: "頁面脈絡不足",
    no_evidence: "缺少可信資料",
    unsupported_scope: "查詢範圍不支援",
  };
  return labels[noAnswerReason(message) ?? ""] ?? "安全無答案";
}

function noAnswerContent(message: RuntimeMessage): string {
  const messages: Record<string, string> = {
    ambiguous_query: "問題條件不夠明確，請補充查詢對象或範圍。",
    evidence_conflict: "找到的資料存在衝突，需要人工確認或提供更多條件。",
    low_confidence: "目前信心不足，為避免誤導暫不提供結論。",
    missing_page_context: "目前頁面脈絡不足，請補充條件或切換到相關頁面後再試一次。",
    no_evidence: "目前找不到足夠可信的內部資料來回答。",
    unsupported_scope: "目前頁面或資料範圍不支援這項查詢。",
  };
  return messages[noAnswerReason(message) ?? ""] ?? "目前無法安全回答這個問題。";
}

function safeStateContent(message: RuntimeMessage, fallback: string): string {
  return messageContent(message) || fallback;
}

function interruptedTitle(message: RuntimeMessage): string {
  switch (record(message).status) {
    case "cancelled": return "回覆已停止";
    case "failed": return "回覆未能完成";
    default: return "回覆已中斷";
  }
}

function interruptedDescription(message: RuntimeMessage): string {
  switch (record(message).status) {
    case "cancelled": return "這次回覆已停止，如需繼續請重新送出。";
    case "failed": return "目前無法完成這次回覆，請重新送出。";
    default: return "這次回覆尚未完成，請重新送出。";
  }
}

function actionTerminalLabel(state: ActionDraftDetailState | null): string | null {
  const status = state?.operationStatus ?? state?.actionDraftStatus;
  switch (status) {
    case "cancelled": return "已取消";
    case "expired": return "已逾期";
    case "executed": return "已完成";
    case "failed": return "未完成";
    default: return null;
  }
}

function actionStatusCopy(state: ActionDraftDetailState | null): string {
  if (state?.operationStatus === "pending_execution_guard") {
    return state.safeMessage ?? ACTION_DRAFT_PENDING_GUARD_MESSAGE;
  }
  if (state?.operationStatus === "cancelled") {
    return "已取消，此操作不會繼續。";
  }
  if (state?.operationStatus === "failed") {
    return state.safeMessage ?? "確認流程暫時無法完成，請稍後再試。";
  }
  return "此操作尚未執行，請確認後再繼續。";
}

function isAnsweredMessage(message: RuntimeMessage): boolean {
  if (isUserMessage(message) || isActiveStreamingMessage(message) || isEscalationMessage(message)) {
    return false;
  }

  const kind = finalDecisionKind(message);
  if (kind === "confirmation_required" || kind === "approval_required" || safeOutcomeKind(message)) {
    return false;
  }

  return kind === "answered" || isCompletedStreamingMessage(message);
}

function streamingStatusLabel(message: RuntimeMessage): string {
  if (!isStreamingMessage(message)) {
    return "";
  }

  switch (message.status) {
    case "completed":
      return "回答完成";
    case "interrupted":
      return "回覆已中斷，尚未完成。";
    case "cancelled":
      return "回覆已取消。";
    case "failed":
      return "回覆失敗，請稍後再試。";
    case "finalizing":
      return "正在整理回答。";
    default:
      return "AI 助理正在輸入";
  }
}

function evidenceRefs(message: RuntimeMessage): EvidenceRefSummary[] {
  const source = record(message);
  const evidence = Array.isArray(source.evidence)
    ? source.evidence
    : Array.isArray(source.evidenceRefs)
      ? source.evidenceRefs
      : [];

  return evidence.filter((entry): entry is EvidenceRefSummary =>
    isRecord(entry)
    && Boolean(readString(entry.id))
    && (entry.sourceType === "structured_record" || entry.sourceType === "document_chunk"),
  );
}

function feedbackState(message: RuntimeMessage) {
  return props.controller.getFeedbackState(messageId(message));
}

function submitFeedback(message: RuntimeMessage, value: AssistantFeedbackValue) {
  const id = messageId(message);
  const requestId = readString(record(message).requestId);
  if (!props.controller.prepareFeedbackSubmission({ messageId: id, value, requestId }).allowed) {
    return;
  }
  props.onSubmitFeedback({ messageId: id, value, requestId });
}

function actionDraftId(message: RuntimeMessage): string | null {
  const source = record(message);
  const finalDecisionState = isRecord(source.finalDecisionState) ? source.finalDecisionState : null;
  return readString(finalDecisionState?.actionDraftId) ?? readString(source.actionDraftId);
}

function actionDraftState(message: RuntimeMessage): ActionDraftDetailState | null {
  const id = actionDraftId(message);
  return id ? props.controller.getActionDraftState(id) : null;
}

function canConfirmAction(state: ActionDraftDetailState | null): boolean {
  return Boolean(state && props.controller.prepareActionDraftConfirmation(state.actionDraftId).allowed);
}

function canCancelAction(state: ActionDraftDetailState | null): boolean {
  return Boolean(state && props.controller.prepareActionDraftCancellation(state.actionDraftId).allowed);
}

function actionRows(state: ActionDraftDetailState | null) {
  const detail = state?.detail;
  if (!detail) {
    return [];
  }

  return [
    ["toolName", "工具", detail.toolName],
    ["resource", "資源", detail.resource],
    ["operation", "操作", detail.operation],
    ["riskLevel", "風險", detail.riskLevel],
  ]
    .filter((row): row is [string, string, string] => Boolean(row[2]))
    .map(([key, label, value]) => ({ key, label, value }));
}

function actionPreviewRows(state: ActionDraftDetailState | null) {
  const preview = state?.detail?.preview;
  if (!isRecord(preview)) {
    return [];
  }

  return Object.entries(preview)
    .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => ({ key, value: value === null ? "null" : String(value) }));
}

function approvalRequestId(message: RuntimeMessage): string | null {
  const source = record(message);
  const finalDecisionState = isRecord(source.finalDecisionState) ? source.finalDecisionState : null;
  return readString(finalDecisionState?.approvalRequestId) ?? readString(source.approvalRequestId);
}

function approvalRequestState(message: RuntimeMessage): ApprovalRequestDetailState | null {
  const id = approvalRequestId(message);
  return id ? props.controller.getApprovalRequestState(id) : null;
}

function canOpenApprovalDetail(state: ApprovalRequestDetailState | null): boolean {
  return Boolean(state && props.controller.prepareApprovalRequestOpenDetail(state.approvalRequestId).allowed);
}

function actionSummaryRows(state: ApprovalRequestDetailState | null) {
  return safeApprovalSummaryRows(state?.actionSummary);
}

function payloadSummaryRows(state: ApprovalRequestDetailState | null) {
  return safeApprovalSummaryRows(state?.payloadSummary);
}

function safeApprovalSummaryRows(summary: Record<string, unknown> | undefined) {
  return normalizeApprovalSummaryRows(summary).filter(row =>
    !/url|uri|href|link/i.test(row.key)
    && !/https?:\/\//i.test(row.value),
  );
}

function streamingActivities(message: RuntimeMessage) {
  if (!isStreamingMessage(message) || !Array.isArray(message.activities)) {
    return [];
  }

  return message.activities;
}

watch(
  () => messages.value.map(message => `${messageKey(message, 0)}:${messageContent(message)}`).join("|"),
  async () => {
    await nextTick();
    const messageArea = messageAreaRef.value;

    if (messageArea && typeof messageArea.scrollTo === "function") {
      messageArea.scrollTo({
        top: messageArea.scrollHeight,
        behavior: "smooth",
      });
    }
  },
);

function submitComposer() {
  const trimmed = composerValue.value.trim();
  if (!canSend.value || !trimmed) {
    return;
  }
  props.onSendMessage(trimmed);
  composerValue.value = "";
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitComposer();
  }
}
</script>

<template>
  <section
    class="assistant-product-runtime-panel"
    data-testid="assistant-product-runtime-panel"
    :aria-label="`Assistant product runtime ${runtimeScope}`"
  >
    <div
      class="assistant-panel-status"
      data-testid="assistant-panel-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ panelStatus }}
    </div>

    <section
      ref="messageAreaRef"
      class="assistant-message-area"
      data-testid="assistant-message-area"
      aria-label="助理訊息"
    >
      <button
        v-if="nextCursor"
        type="button"
        class="assistant-product-icon-button assistant-history-load-more"
        data-testid="assistant-history-load-more"
        aria-label="載入更多訊息"
        title="載入更多訊息"
        @click="onLoadMoreHistory"
      >
        <AssistantProductIcon name="history" />
      </button>

      <div
        v-if="!sessionContextReady"
        class="assistant-product-alert assistant-product-alert--warning"
        data-testid="assistant-message-context-not-ready"
      >
        <strong>目前頁面內容尚未就緒</strong>
        <p>AI 助理不會猜測尚未提供的頁面脈絡，請稍後再試。</p>
      </div>

      <div
        v-else-if="messages.length === 0"
        class="assistant-message-empty"
        data-testid="assistant-message-empty"
      >
        <strong>AI 助理已準備好</strong>
        <p>你可以在這裡開始內部工作查詢。</p>
      </div>

      <ol
        v-else
        class="assistant-message-list"
        data-assistant-message-list
        aria-label="對話訊息"
      >
        <li
          v-for="(message, index) in messages"
          :key="messageKey(message, index)"
          class="assistant-message-item"
        >
          <AssistantProductMessageFrame
            :role="isUserMessage(message) ? 'user' : 'assistant'"
            :created-at="messageCreatedAt(message)"
            :message-test-id="presentationTestId(message)"
          >
            <div
              v-if="isUserMessage(message)"
              class="assistant-message-bubble assistant-message-bubble--user"
              data-testid="assistant-user-bubble"
            >
              <p>{{ messageContent(message) }}</p>
            </div>

            <div v-else class="assistant-message-bubble assistant-message-bubble--assistant">
              <div
                v-if="isStreamingMessage(message) && messageContent(message)"
                :data-testid="message.status === 'completed' ? 'assistant-ai-bubble' : undefined"
              >
                <p data-testid="assistant-streaming-content">
                  {{ messageContent(message) }}<span
                    v-if="isActiveStreamingMessage(message)"
                    class="assistant-streaming-cursor"
                    data-testid="assistant-streaming-cursor"
                    aria-hidden="true"
                  />
                </p>
              </div>
              <div
                v-else-if="!safeOutcomeKind(message)"
                :data-testid="isAnsweredMessage(message) ? 'assistant-ai-bubble' : undefined"
              >
                <p>{{ messageContent(message) }}</p>
              </div>

              <div
                v-if="isActiveStreamingMessage(message) && !messageContent(message)"
                class="assistant-typing-indicator"
                data-testid="assistant-typing-indicator"
                aria-label="AI 助理正在輸入"
              >
                <span data-testid="assistant-typing-dot" />
                <span data-testid="assistant-typing-dot" />
                <span data-testid="assistant-typing-dot" />
              </div>

              <p
                v-if="isStreamingMessage(message)"
                class="assistant-streaming-status"
                data-testid="assistant-streaming-status"
              >
                {{ streamingStatusLabel(message) }}
              </p>
              <p
                v-for="activity in streamingActivities(message)"
                :key="activity.key"
                class="assistant-streaming-status"
                data-testid="assistant-streaming-activity"
              >
                {{ activity.label }}
              </p>
              <p
                v-if="isStreamingMessage(message) && message.status === 'finalizing'"
                data-testid="assistant-streaming-finalized"
              >
                正在整理最終回答。
              </p>
              <button
                v-if="isActiveStreamingMessage(message)"
                type="button"
                class="assistant-product-icon-button assistant-product-icon-button--danger"
                data-testid="assistant-chat-cancel"
                aria-label="停止回覆"
                title="停止回覆"
                @click="onCancelStreaming"
              >
                <AssistantProductIcon name="stop" />
              </button>

              <section
                v-if="safeOutcomeKind(message) === 'clarification_required'"
                class="assistant-safe-outcome assistant-safe-outcome--warning assistant-product-state-bubble"
                data-testid="assistant-safe-outcome"
              >
                <span class="assistant-product-state-badge assistant-product-state-badge--warning" data-testid="assistant-clarification-label">需要補充資訊</span>
                <p data-testid="assistant-clarification-content">{{ safeStateContent(message, "我需要再確認一些資訊。") }}</p>
                <p class="assistant-product-state-hint" data-testid="assistant-clarification-hint">請直接在下方補充資訊，我會在同一個對話中繼續協助。</p>
              </section>

              <section
                v-else-if="safeOutcomeKind(message) === 'permission_denied'"
                class="assistant-safe-outcome assistant-safe-outcome--error assistant-product-state-bubble"
                data-testid="assistant-safe-outcome"
              >
                <span class="assistant-product-state-badge assistant-product-state-badge--error" data-testid="assistant-permission-denied-label">權限受限</span>
                <p data-testid="assistant-permission-denied-content">{{ safeStateContent(message, "你目前沒有足夠權限查看這項資訊。") }}</p>
              </section>

              <section
                v-else-if="safeOutcomeKind(message) === 'tool_failure'"
                class="assistant-safe-outcome assistant-safe-outcome--error assistant-product-state-bubble"
                data-testid="assistant-safe-outcome"
              >
                <span class="assistant-product-state-badge assistant-product-state-badge--error" data-testid="assistant-tool-failure-label">內部資料查詢未完成</span>
                <p data-testid="assistant-tool-failure-content">{{ safeStateContent(message, "目前無法安全取得所需資料，請稍後再試或調整查詢條件。") }}</p>
              </section>

              <section
                v-else-if="safeOutcomeKind(message) === 'no_answer'"
                class="assistant-safe-outcome assistant-safe-outcome--neutral assistant-product-state-bubble"
                data-testid="assistant-safe-outcome"
              >
                <span class="assistant-product-state-badge assistant-product-state-badge--neutral" data-testid="assistant-no-answer-label">{{ noAnswerLabel(message) }}</span>
                <p data-testid="assistant-no-answer-content">{{ noAnswerContent(message) }}</p>
                <p v-if="messageContent(message) && messageContent(message) !== noAnswerContent(message)" class="assistant-product-state-hint" data-testid="assistant-no-answer-detail">{{ messageContent(message) }}</p>
              </section>

              <section
                v-else-if="safeOutcomeKind(message) === 'timeout'"
                class="assistant-safe-outcome assistant-safe-outcome--warning assistant-product-state-bubble"
                data-testid="assistant-safe-outcome"
              >
                <span class="assistant-product-state-badge assistant-product-state-badge--warning">回覆逾時</span>
                <p>{{ safeStateContent(message, "目前無法完成這次回覆，請稍後再試。") }}</p>
              </section>

              <section
                v-if="isEscalationMessage(message)"
                class="assistant-safe-outcome assistant-safe-outcome--info assistant-product-state-bubble"
                data-testid="assistant-safe-outcome"
              >
                <span class="assistant-product-state-badge assistant-product-state-badge--info" data-testid="assistant-escalation-label">需要升級處理</span>
                <p data-testid="assistant-escalation-content">{{ safeStateContent(message, "目前資訊不足以自動完成，請依內部流程接續處理。") }}</p>
              </section>

              <section
                v-if="isInterruptedMessage(message)"
                class="assistant-safe-outcome assistant-safe-outcome--warning assistant-product-state-bubble"
                data-testid="assistant-safe-outcome"
              >
                <span class="assistant-product-state-badge assistant-product-state-badge--warning" data-testid="assistant-interrupted-title">{{ interruptedTitle(message) }}</span>
                <p data-testid="assistant-interrupted-description">{{ interruptedDescription(message) }}</p>
                <div v-if="messageContent(message)" class="assistant-product-state-detail" data-testid="assistant-interrupted-partial">{{ messageContent(message) }}</div>
                <button
                  v-if="props.onRetryMessage"
                  type="button"
                  class="assistant-product-button assistant-product-button--secondary"
                  data-testid="assistant-interrupted-retry"
                  @click="props.onRetryMessage?.(messageKey(message, index))"
                >
                  重新送出
                </button>
              </section>

              <p
                v-if="isAnsweredMessage(message)"
                data-testid="assistant-ai-answer-decision"
              >
                已回答
              </p>

              <ul
                v-if="evidenceRefs(message).length > 0"
                class="assistant-evidence-list"
                aria-label="參考依據"
              >
                <li
                  v-for="evidence in evidenceRefs(message)"
                  :key="evidence.id"
                  class="assistant-evidence-ref"
                  data-testid="assistant-evidence-ref"
                >
                  <strong data-testid="assistant-evidence-title">{{ evidence.title ?? evidence.id }}</strong>
                  <span v-if="evidence.snippet">{{ evidence.snippet }}</span>
                </li>
              </ul>

              <section
                v-if="isAnsweredMessage(message)"
                class="assistant-feedback-controls"
                data-testid="assistant-feedback-controls"
                aria-label="回答回饋"
                :aria-busy="feedbackState(message).pending ? 'true' : 'false'"
              >
                <button
                  type="button"
                  class="assistant-product-icon-button"
                  data-testid="assistant-feedback-helpful"
                  aria-label="這個回答有幫助"
                  title="這個回答有幫助"
                  :aria-pressed="feedbackState(message).value === 'helpful' ? 'true' : 'false'"
                  :disabled="!props.controller.prepareFeedbackSubmission({ messageId: messageId(message), value: 'helpful' }).allowed"
                  @click="submitFeedback(message, 'helpful')"
                >
                  <AssistantProductIcon name="thumb-up" />
                </button>
                <button
                  type="button"
                  class="assistant-product-icon-button"
                  data-testid="assistant-feedback-not-helpful"
                  aria-label="這個回答沒有幫助"
                  title="這個回答沒有幫助"
                  :aria-pressed="feedbackState(message).value === 'not_helpful' ? 'true' : 'false'"
                  :disabled="!props.controller.prepareFeedbackSubmission({ messageId: messageId(message), value: 'not_helpful' }).allowed"
                  @click="submitFeedback(message, 'not_helpful')"
                >
                  <AssistantProductIcon name="thumb-down" />
                </button>
                <p
                  v-if="feedbackState(message).error"
                  class="assistant-feedback-error"
                  data-testid="assistant-feedback-error"
                >
                  {{ feedbackState(message).error }}
                </p>
              </section>

              <section
                v-if="actionDraftState(message)"
                class="assistant-action-draft-bubble"
                data-testid="assistant-action-draft-message"
                data-assistant-action-draft-bubble
              >
                <strong data-testid="assistant-action-draft-title">需要確認</strong>
                <p>{{ actionDraftState(message)?.safeMessage ?? messageContent(message) }}</p>
                <dl
                  v-if="actionRows(actionDraftState(message)).length > 0 || actionPreviewRows(actionDraftState(message)).length > 0"
                  data-testid="assistant-action-draft-preview"
                >
                  <template
                    v-for="row in actionRows(actionDraftState(message))"
                    :key="row.key"
                  >
                    <dt>{{ row.label }}</dt>
                    <dd>{{ row.value }}</dd>
                  </template>
                  <template
                    v-for="row in actionPreviewRows(actionDraftState(message))"
                    :key="row.key"
                  >
                    <dt>{{ row.key }}</dt>
                    <dd>{{ row.value }}</dd>
                  </template>
                </dl>
                <p
                  v-if="actionDraftState(message)?.detail?.expiresAt"
                  data-testid="assistant-action-draft-time"
                >
                  有效期限：{{ actionDraftState(message)?.detail?.expiresAt }}
                </p>
                <p
                  v-if="actionDraftState(message)?.operationStatus === 'pending_execution_guard'"
                  data-testid="assistant-action-draft-pending-guard"
                >
                  {{ actionDraftState(message)?.safeMessage ?? ACTION_DRAFT_PENDING_GUARD_MESSAGE }}
                </p>
                <p
                  v-if="actionDraftState(message)?.operationStatus === 'failed'"
                  data-testid="assistant-action-draft-operation-error"
                >
                  {{ actionStatusCopy(actionDraftState(message)) }}
                </p>
                <p
                  v-if="actionTerminalLabel(actionDraftState(message))"
                  data-testid="assistant-action-draft-terminal-status"
                >
                  {{ actionTerminalLabel(actionDraftState(message)) }}
                </p>
                <p data-testid="assistant-action-draft-status-copy">
                  {{ actionStatusCopy(actionDraftState(message)) }}
                </p>
                <button
                  type="button"
                  class="assistant-product-button"
                  data-testid="assistant-action-draft-confirm"
                  :disabled="!canConfirmAction(actionDraftState(message))"
                  @click="actionDraftState(message) && onConfirmActionDraft(actionDraftState(message)!.actionDraftId)"
                >
                  確認操作
                </button>
                <button
                  type="button"
                  class="assistant-product-button assistant-product-button--secondary"
                  data-testid="assistant-action-draft-cancel"
                  :disabled="!canCancelAction(actionDraftState(message))"
                  @click="actionDraftState(message) && onCancelActionDraft(actionDraftState(message)!.actionDraftId)"
                >
                  取消操作
                </button>
              </section>

              <section
                v-if="approvalRequestState(message)"
                class="assistant-approval-request-bubble"
                data-testid="assistant-approval-request-message"
              >
                <strong data-testid="assistant-approval-request-title">需要審核</strong>
                <p>{{ messageContent(message) || "這個操作需要額外審核後才能繼續。" }}</p>
                <p
                  v-if="approvalRequestState(message)?.status"
                  data-testid="assistant-approval-request-status"
                >
                  {{ getApprovalRequestStatusLabel(approvalRequestState(message)?.status) ?? approvalRequestState(message)?.status }}
                </p>
                <p
                  v-if="approvalRequestState(message)?.riskLevel"
                  data-testid="assistant-approval-request-risk"
                >
                  風險等級：{{ getApprovalRiskLabel(approvalRequestState(message)?.riskLevel) ?? approvalRequestState(message)?.riskLevel }}
                </p>
                <dl
                  v-if="actionSummaryRows(approvalRequestState(message)).length > 0"
                  data-testid="assistant-approval-request-action-summary"
                >
                  <template
                    v-for="row in actionSummaryRows(approvalRequestState(message))"
                    :key="row.key"
                  >
                    <dt>{{ row.label }}</dt>
                    <dd>{{ row.value }}</dd>
                  </template>
                </dl>
                <dl
                  v-if="payloadSummaryRows(approvalRequestState(message)).length > 0"
                  data-testid="assistant-approval-request-payload-summary"
                >
                  <template
                    v-for="row in payloadSummaryRows(approvalRequestState(message))"
                    :key="row.key"
                  >
                    <dt>{{ row.label }}</dt>
                    <dd>{{ row.value }}</dd>
                  </template>
                </dl>
                <p
                  v-if="approvalRequestState(message)?.expiresAt"
                  data-testid="assistant-approval-request-time"
                >
                  有效期限：{{ approvalRequestState(message)?.expiresAt }}
                </p>
                <p
                  v-if="approvalRequestState(message)?.openDetailSafeMessage"
                  data-testid="assistant-approval-request-open-detail-error"
                >
                  <span data-testid="assistant-approval-request-open-detail-unavailable">
                    {{ approvalRequestState(message)?.openDetailSafeMessage }}
                  </span>
                </p>
                <button
                  type="button"
                  class="assistant-product-button"
                  data-testid="assistant-approval-request-open-detail"
                  :disabled="!canOpenApprovalDetail(approvalRequestState(message))"
                  @click="approvalRequestState(message) && onOpenApprovalDetail(createOpenApprovalDetailPayload(approvalRequestState(message)!))"
                >
                  開啟審核詳情
                </button>
              </section>
            </div>
          </AssistantProductMessageFrame>
        </li>
      </ol>
    </section>

    <footer
      class="assistant-panel-footer"
      data-testid="assistant-panel-footer"
    >
      <div
        class="assistant-chat-input-bar"
        data-testid="assistant-chat-input-bar"
      >
        <textarea
          v-model="composerValue"
          class="assistant-chat-input"
          data-testid="assistant-chat-input"
          :disabled="inputDisabled"
          rows="1"
          placeholder="輸入訊息..."
          aria-label="輸入訊息"
          @keydown="onComposerKeydown"
        />
        <button
          v-if="isStreaming"
          type="button"
          class="assistant-chat-submit assistant-chat-submit--cancel assistant-product-icon-button"
          data-testid="assistant-chat-cancel"
          aria-label="停止回覆"
          title="停止回覆"
          @click="onCancelStreaming"
        >
          <AssistantProductIcon name="stop" />
        </button>
        <button
          v-else
          type="button"
          class="assistant-chat-submit"
          data-testid="assistant-chat-submit"
          aria-label="送出訊息"
          title="送出訊息"
          :disabled="!canSend"
          @click="submitComposer"
        >
          <AssistantProductIcon name="send" />
        </button>
      </div>
      <p
        v-if="disabledMessage"
        class="assistant-chat-disabled-reason"
        data-testid="assistant-chat-disabled-reason"
        role="status"
      >
        {{ disabledMessage }}
      </p>
    </footer>
  </section>
</template>
