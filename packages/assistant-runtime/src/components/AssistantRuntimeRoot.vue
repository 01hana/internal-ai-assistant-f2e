<script setup lang="ts">
import { computed, isRef, ref } from "vue";
import {
  ACTION_DRAFT_PENDING_GUARD_MESSAGE,
  type ActionDraftDetailState,
} from "../actions";
import {
  createOpenApprovalDetailPayload,
  getApprovalRequestStatusLabel,
  getApprovalRiskLabel,
  normalizeApprovalSummaryRows,
  type ApprovalRequestDetailState,
  type OpenApprovalDetailPayload,
} from "../approvals";
import type {
  AssistantFeedbackValue,
} from "../feedback";
import {
  createTerminalOutcome,
  type AssistantRuntimeSafeOutcomeKind,
} from "../outcomes";
import type {
  AssistantRuntimeController,
  AssistantRuntimeStreamingMessage,
} from "../runtime";
import type {
  EvidenceRefSummary,
  HistoryMessageSummary,
} from "../types";

type RuntimeMessage = HistoryMessageSummary | AssistantRuntimeStreamingMessage | Record<string, unknown>;

interface FeedbackPayload {
  messageId: string;
  value: AssistantFeedbackValue;
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
}>();

const composerValue = ref("");

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

const composerDisabledReason = computed(() => {
  if (widgetAvailability.value === "degraded") {
    return "助理暫時不穩定，請稍後再試。";
  }

  if (widgetAvailability.value === "unavailable") {
    return "助理目前不可用，請稍後再試。";
  }

  if (sessionStatus.value === "restoring" || sessionStatus.value === "creating") {
    return "助理正在準備中，請稍候。";
  }

  if (sessionStatus.value === "loading_history") {
    return "正在載入歷史訊息，請稍候。";
  }

  if (sessionStatus.value === "error") {
    return sessionLastError.value?.safeMessage ?? "助理狀態已變更，請重新整理後再試。";
  }

  if (isStreaming.value) {
    return "助理正在處理上一則訊息。";
  }

  if (sessionStatus.value !== "ready" || !sessionContextReady.value) {
    return "目前頁面內容尚未就緒，請稍後再試。";
  }

  return null;
});

const composerDisabled = computed(() => composerDisabledReason.value !== null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function messageRecord(message: RuntimeMessage): Record<string, unknown> {
  return message as unknown as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readMessageId(message: RuntimeMessage): string {
  const record = messageRecord(message);
  return readString(record.messageId) ?? readString(record.key) ?? "assistant-message";
}

function messageKey(message: RuntimeMessage, index: number): string {
  const record = messageRecord(message);
  return readString(record.key) ?? readString(record.messageId) ?? `message:${index}`;
}

function messageContent(message: RuntimeMessage): string {
  return readString(messageRecord(message).content) ?? "";
}

function isUserMessage(message: RuntimeMessage): boolean {
  const record = messageRecord(message);
  return record.role === "user" || record.kind === "user";
}

function isStreamingMessage(message: RuntimeMessage): message is AssistantRuntimeStreamingMessage {
  return messageRecord(message).kind === "assistant_streaming";
}

function isActiveStreamingMessage(message: RuntimeMessage): boolean {
  return isStreamingMessage(message)
    && ["sending", "queued", "connecting", "streaming", "finalizing"].includes(message.status);
}

function isCompletedStreamingMessage(message: RuntimeMessage): boolean {
  return isStreamingMessage(message) && message.status === "completed";
}

function isTerminalStreamingMessage(message: RuntimeMessage): boolean {
  return isStreamingMessage(message)
    && ["interrupted", "cancelled", "failed"].includes(message.status);
}

function finalDecisionKind(message: RuntimeMessage): string | null {
  const record = messageRecord(message);
  const finalDecisionState = isRecord(record.finalDecisionState) ? record.finalDecisionState : null;
  return readString(finalDecisionState?.kind)
    ?? readString(record.finalAnswerDecision)
    ?? readString(record.answerDecision)
    ?? readString(record.kind);
}

function safeOutcomeKind(message: RuntimeMessage): AssistantRuntimeSafeOutcomeKind | null {
  const kind = finalDecisionKind(message);

  if (kind === "tool_failure") {
    return "tool_failure";
  }

  if (kind === "no_answer" && readString(messageRecord(message).noAnswerReason) === "tool_failure") {
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

function messageTestId(message: RuntimeMessage): string {
  return isUserMessage(message) ? "assistant-user-message" : "assistant-ai-message";
}

function messageClass(message: RuntimeMessage): string {
  return isUserMessage(message) ? "assistant-message--user" : "assistant-message--assistant";
}

function isAnsweredMessage(message: RuntimeMessage): boolean {
  if (isUserMessage(message) || isActiveStreamingMessage(message)) {
    return false;
  }

  const kind = finalDecisionKind(message);
  if (
    kind === "confirmation_required"
    || kind === "approval_required"
    || kind === "escalation_required"
    || safeOutcomeKind(message)
  ) {
    return false;
  }

  return finalDecisionKind(message) === "answered"
    || readString(messageRecord(message).answerDecision) === "answered"
    || isCompletedStreamingMessage(message);
}

function normalizedEvidence(message: RuntimeMessage): EvidenceRefSummary[] {
  const record = messageRecord(message);
  const evidence = Array.isArray(record.evidence)
    ? record.evidence
    : Array.isArray(record.evidenceRefs)
      ? record.evidenceRefs
      : [];

  return evidence.filter((entry): entry is EvidenceRefSummary => {
    if (!isRecord(entry)) {
      return false;
    }

    return Boolean(readString(entry.id))
      && (entry.sourceType === "structured_record" || entry.sourceType === "document_chunk");
  });
}

function streamingStatusLabel(status: AssistantRuntimeStreamingMessage["status"]): string {
  switch (status) {
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
      return "正在處理訊息。";
  }
}

function terminalStreamingStatusLabel(message: RuntimeMessage): string {
  return isStreamingMessage(message) ? streamingStatusLabel(message.status) : "";
}

function safeOutcomeMessage(message: RuntimeMessage): string {
  return messageContent(message) || "目前無法安全顯示完整結果。";
}

function feedbackState(message: RuntimeMessage) {
  return props.controller.getFeedbackState(readMessageId(message));
}

function canSubmitFeedback(message: RuntimeMessage, value: AssistantFeedbackValue): boolean {
  return props.controller.prepareFeedbackSubmission({
    messageId: readMessageId(message),
    value,
  }).allowed;
}

function submitFeedback(message: RuntimeMessage, value: AssistantFeedbackValue) {
  if (!canSubmitFeedback(message, value)) {
    return;
  }

  props.onSubmitFeedback({
    messageId: readMessageId(message),
    value,
  });
}

function actionDraftId(message: RuntimeMessage): string | null {
  const record = messageRecord(message);
  const finalDecisionState = isRecord(record.finalDecisionState) ? record.finalDecisionState : null;
  return readString(finalDecisionState?.actionDraftId) ?? readString(record.actionDraftId);
}

function approvalRequestId(message: RuntimeMessage): string | null {
  const record = messageRecord(message);
  const finalDecisionState = isRecord(record.finalDecisionState) ? record.finalDecisionState : null;
  return readString(finalDecisionState?.approvalRequestId) ?? readString(record.approvalRequestId);
}

function actionDraftState(message: RuntimeMessage): ActionDraftDetailState | null {
  const id = actionDraftId(message);
  return id ? props.controller.getActionDraftState(id) : null;
}

function actionOperationAllowed(state: ActionDraftDetailState | null, operation: "confirm" | "cancel"): boolean {
  if (!state) {
    return false;
  }

  return operation === "confirm"
    ? props.controller.prepareActionDraftConfirmation(state.actionDraftId).allowed
    : props.controller.prepareActionDraftCancellation(state.actionDraftId).allowed;
}

function isActionPending(state: ActionDraftDetailState | null): boolean {
  if (!state) {
    return false;
  }

  return state.operationStatus === "confirming" || state.operationStatus === "cancelling";
}

function isActionPendingGuard(state: ActionDraftDetailState | null): boolean {
  if (!state) {
    return false;
  }

  return state.operationStatus === "pending_execution_guard";
}

function isActionTerminal(state: ActionDraftDetailState | null): boolean {
  if (!state) {
    return false;
  }

  return state.operationStatus === "submitted"
    || state.operationStatus === "executed"
    || state.operationStatus === "cancelled"
    || state.operationStatus === "expired"
    || state.actionDraftStatus === "cancelled"
    || state.actionDraftStatus === "expired"
    || state.actionDraftStatus === "executed"
    || state.actionDraftStatus === "failed";
}

function canShowActionControls(state: ActionDraftDetailState | null): boolean {
  if (!state) {
    return false;
  }

  return state.detailStatus === "available" && !isActionPendingGuard(state) && !isActionTerminal(state);
}

function confirmActionDraft(state: ActionDraftDetailState | null) {
  if (!state) {
    return;
  }

  if (actionOperationAllowed(state, "confirm")) {
    props.onConfirmActionDraft(state.actionDraftId);
  }
}

function cancelActionDraft(state: ActionDraftDetailState | null) {
  if (!state) {
    return;
  }

  if (actionOperationAllowed(state, "cancel")) {
    props.onCancelActionDraft(state.actionDraftId);
  }
}

function actionTerminalText(state: ActionDraftDetailState | null): string {
  if (!state) {
    return "操作已結束。";
  }

  return state.safeMessage
    ?? state.operationStatus
    ?? state.actionDraftStatus
    ?? "操作已結束。";
}

function actionDetailRows(state: ActionDraftDetailState | null): Array<{ key: string; label: string; value: string }> {
  const detail = state?.detail;

  if (!detail) {
    return [];
  }

  const rows = [
    ["toolName", "工具", detail.toolName],
    ["resource", "資源", detail.resource],
    ["operation", "操作", detail.operation],
    ["riskLevel", "風險", detail.riskLevel],
  ];

  return rows
    .filter((row): row is [string, string, string] => Boolean(row[2]))
    .map(([key, label, value]) => ({ key, label, value }));
}

function approvalRequestState(message: RuntimeMessage): ApprovalRequestDetailState | null {
  const id = approvalRequestId(message);
  return id ? props.controller.getApprovalRequestState(id) : null;
}

function canOpenApprovalDetail(state: ApprovalRequestDetailState | null): boolean {
  if (!state) {
    return false;
  }

  return props.controller.prepareApprovalRequestOpenDetail(state.approvalRequestId).allowed;
}

function openApprovalDetail(state: ApprovalRequestDetailState | null) {
  if (!state) {
    return;
  }

  if (!canOpenApprovalDetail(state)) {
    return;
  }

  props.onOpenApprovalDetail(createOpenApprovalDetailPayload(state));
}

function approvalRows(state: ApprovalRequestDetailState | null) {
  if (!state) {
    return [];
  }

  if (state.openDetailStatus === "failed") {
    return [];
  }

  return [
    ...normalizeApprovalSummaryRows(state.actionSummary),
    ...normalizeApprovalSummaryRows(state.payloadSummary),
  ];
}

function submitComposer() {
  if (composerDisabled.value) {
    return;
  }

  const trimmed = composerValue.value.trim();
  if (!trimmed) {
    return;
  }

  props.onSendMessage(trimmed);
  composerValue.value = "";
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  event.preventDefault();
  submitComposer();
}
</script>

<template>
  <section
    data-testid="assistant-runtime-root"
    role="region"
    :aria-label="`Assistant runtime ${runtimeScope}`"
  >
    <header>
      <p>AI 助理訊息</p>
      <p v-if="widgetAvailability === 'degraded'">助理暫時不穩定，部分功能可能稍後恢復。</p>
      <p v-else-if="widgetAvailability === 'unavailable'">助理目前不可用，請稍後再試。</p>
    </header>

    <button
      v-if="nextCursor"
      type="button"
      data-testid="assistant-load-more-history"
      @click="onLoadMoreHistory"
    >
      載入更多歷史訊息
    </button>

    <section data-testid="assistant-message-list" aria-live="polite">
      <p v-if="messages.length === 0" data-testid="assistant-message-empty">
        尚無訊息，開始詢問助理。
      </p>

      <article
        v-for="(message, index) in messages"
        :key="messageKey(message, index)"
        :class="messageClass(message)"
        :data-testid="messageTestId(message)"
      >
        <p v-if="isUserMessage(message)">{{ messageContent(message) }}</p>

        <template v-else>
          <p v-if="isActiveStreamingMessage(message) && !messageContent(message)">
            AI 助理正在輸入
          </p>
          <p
            v-if="isStreamingMessage(message) && !isCompletedStreamingMessage(message) && messageContent(message)"
            data-testid="assistant-streaming-content"
          >
            {{ messageContent(message) }}
          </p>
          <p v-else-if="!safeOutcomeKind(message) && !isAnsweredMessage(message)">
            {{ messageContent(message) }}
          </p>
          <p
            v-if="isAnsweredMessage(message) && messageContent(message)"
          >
            {{ messageContent(message) }}
          </p>

          <p v-if="isStreamingMessage(message)" data-testid="assistant-streaming-status">
            {{ streamingStatusLabel(message.status) }}
          </p>
          <button
            v-if="isActiveStreamingMessage(message)"
            type="button"
            data-testid="assistant-cancel-stream"
            @click="onCancelStreaming"
          >
            停止產生回答
          </button>
          <p v-if="isTerminalStreamingMessage(message)">
            {{ terminalStreamingStatusLabel(message) }}
          </p>

          <section v-if="safeOutcomeKind(message)" data-testid="assistant-safe-outcome">
            <strong>{{ createTerminalOutcome(safeOutcomeKind(message)!).safeTitle }}</strong>
            <p>{{ safeOutcomeMessage(message) }}</p>
          </section>

          <ul v-if="normalizedEvidence(message).length > 0" aria-label="參考依據">
            <li
              v-for="evidence in normalizedEvidence(message)"
              :key="evidence.id"
              data-testid="assistant-evidence-ref"
            >
              <strong>{{ evidence.title ?? evidence.id }}</strong>
              <span v-if="evidence.snippet"> {{ evidence.snippet }}</span>
            </li>
          </ul>

          <section
            v-if="isAnsweredMessage(message)"
            aria-label="回答回饋"
            :aria-busy="feedbackState(message).pending ? 'true' : 'false'"
          >
            <p v-if="feedbackState(message).error" data-testid="assistant-feedback-error">
              {{ feedbackState(message).error }}
            </p>
            <button
              type="button"
              data-testid="assistant-feedback-helpful"
              :disabled="!canSubmitFeedback(message, 'helpful')"
              @click="submitFeedback(message, 'helpful')"
            >
              有幫助
            </button>
            <button
              type="button"
              data-testid="assistant-feedback-not-helpful"
              :disabled="!canSubmitFeedback(message, 'not_helpful')"
              @click="submitFeedback(message, 'not_helpful')"
            >
              沒有幫助
            </button>
            <small v-if="feedbackState(message).pending">回饋送出中</small>
            <small v-else-if="feedbackState(message).value && !feedbackState(message).error">已提交 feedback</small>
          </section>

          <section v-if="actionDraftState(message)" aria-label="操作確認">
              <p v-if="actionDraftState(message)?.safeMessage">{{ actionDraftState(message)?.safeMessage }}</p>
              <p v-if="actionDraftState(message)?.detailStatus === 'unavailable'">
                {{ actionDraftState(message)?.safeMessage ?? '操作詳情暫時無法顯示。' }}
              </p>
              <dl v-if="actionDraftState(message)?.detailStatus === 'available'">
                <template v-for="row in actionDetailRows(actionDraftState(message))" :key="row.key">
                  <dt>{{ row.label }}</dt>
                  <dd>{{ row.value }}</dd>
                </template>
                <template v-if="actionDraftState(message)?.detail?.preview">
                  <p>操作預覽已安全載入。</p>
                  <template v-for="row in normalizeApprovalSummaryRows(actionDraftState(message)?.detail?.preview)" :key="`preview:${row.key}`">
                    <dt>{{ row.label }}</dt>
                    <dd>{{ row.value }}</dd>
                  </template>
                </template>
              </dl>
              <time
                v-if="actionDraftState(message)?.detail?.expiresAt"
              >
                {{ actionDraftState(message)?.detail?.expiresAt }}
              </time>

              <p v-if="isActionPendingGuard(actionDraftState(message))" data-testid="assistant-action-draft-pending-guard">
                {{ actionDraftState(message)?.safeMessage ?? ACTION_DRAFT_PENDING_GUARD_MESSAGE }}
              </p>

              <p v-if="isActionTerminal(actionDraftState(message))" data-testid="assistant-action-draft-terminal-status">
                {{ actionTerminalText(actionDraftState(message)) }}
              </p>
              <p
                v-if="actionDraftState(message)?.operationStatus === 'failed'"
              >
                {{ actionDraftState(message)?.safeMessage ?? '目前無法送出確認，請稍後再試。' }}
              </p>
              <p
                v-if="isActionTerminal(actionDraftState(message))"
              >
                {{ actionTerminalText(actionDraftState(message)) }}
              </p>

              <template v-if="canShowActionControls(actionDraftState(message))">
                <span
                  v-if="isActionPending(actionDraftState(message))"
                  role="button"
                  tabindex="-1"
                  data-testid="assistant-action-draft-confirm"
                  disabled="true"
                  aria-disabled="true"
                >
                  確認操作
                </span>
                <span
                  v-if="isActionPending(actionDraftState(message))"
                  role="button"
                  tabindex="-1"
                  data-testid="assistant-action-draft-cancel"
                  disabled="true"
                  aria-disabled="true"
                >
                  取消操作
                </span>
                <button
                  v-if="!isActionPending(actionDraftState(message))"
                  type="button"
                  data-testid="assistant-action-draft-confirm"
                  :aria-disabled="!actionOperationAllowed(actionDraftState(message), 'confirm') ? 'true' : undefined"
                  @click="confirmActionDraft(actionDraftState(message))"
                >
                  確認操作
                </button>
                <button
                  v-if="!isActionPending(actionDraftState(message))"
                  type="button"
                  data-testid="assistant-action-draft-cancel"
                  :aria-disabled="!actionOperationAllowed(actionDraftState(message), 'cancel') ? 'true' : undefined"
                  @click="cancelActionDraft(actionDraftState(message))"
                >
                  取消操作
                </button>
              </template>
          </section>

          <section v-if="approvalRequestState(message)" aria-label="審核請求">
              <p>審核詳情</p>
              <p v-if="approvalRequestState(message)?.status">{{ getApprovalRequestStatusLabel(approvalRequestState(message)?.status) ?? approvalRequestState(message)?.status }}</p>
              <p v-if="approvalRequestState(message)?.riskLevel">{{ getApprovalRiskLabel(approvalRequestState(message)?.riskLevel) ?? approvalRequestState(message)?.riskLevel }}</p>
              <p v-if="approvalRequestState(message)?.actionSummary">
                審核動作摘要已安全載入。
              </p>
              <p v-if="approvalRequestState(message)?.payloadSummary">
                審核資料摘要已安全載入。
              </p>
              <time
                v-if="approvalRequestState(message)?.requestId"
              >
                {{ approvalRequestState(message)?.requestId }}
              </time>
              <dl v-if="approvalRows(approvalRequestState(message)).length > 0">
                <template v-for="row in approvalRows(approvalRequestState(message))" :key="row.key">
                  <dt>{{ row.label }}</dt>
                  <dd>{{ row.value }}</dd>
                </template>
              </dl>
              <p v-if="approvalRequestState(message)?.openDetailSafeMessage" data-testid="assistant-approval-request-open-detail-error">
                {{ approvalRequestState(message)?.openDetailSafeMessage }}
              </p>
              <span
                v-if="!canOpenApprovalDetail(approvalRequestState(message))"
                role="button"
                tabindex="-1"
                data-testid="assistant-approval-request-open-detail"
                disabled="true"
                aria-disabled="true"
              >
                開啟審核詳情
              </span>
              <button
                v-else
                type="button"
                data-testid="assistant-approval-request-open-detail"
                @click="openApprovalDetail(approvalRequestState(message))"
              >
                開啟審核詳情
              </button>
          </section>
        </template>
      </article>
    </section>

    <form @submit.prevent="submitComposer">
      <p v-if="composerDisabledReason" data-testid="assistant-composer-disabled-reason">
        {{ composerDisabledReason }}
      </p>
      <textarea
        v-model="composerValue"
        data-testid="assistant-composer-input"
        :disabled="composerDisabled"
        aria-label="輸入訊息"
        @keydown="onComposerKeydown"
      />
      <button
        type="submit"
        data-testid="assistant-send"
        :aria-disabled="composerDisabled ? 'true' : undefined"
        @click.prevent="submitComposer"
      >
        送出
      </button>
    </form>
  </section>
</template>
