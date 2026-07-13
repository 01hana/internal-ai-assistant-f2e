import { mountSuspended } from "@nuxt/test-utils/runtime";
import type { VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import ChatInputBar from "../../../app/features/assistant/components/ChatInputBar.vue";
import ChatMessageArea from "../../../app/features/assistant/components/ChatMessageArea.vue";
import ChatPanel from "../../../app/features/assistant/components/ChatPanel.vue";
import ChatWidget from "../../../app/features/assistant/components/ChatWidget.vue";
import SessionRecoveryMessage from "../../../app/features/assistant/components/SessionRecoveryMessage.vue";
import type {
  ActionDraftDetailState,
  ApprovalRequestDetailState,
  AssistantRenderableMessage,
} from "../../../app/types/assistant";

const mountedWrappers: VueWrapper[] = [];
const createdAt = "2026-07-11T09:00:00.000Z";

const forbiddenCopy = [
  "public chatbot",
  "customer service",
  "customer support",
  "contact us",
  "lead capture",
  "handoff",
  "phone",
  "email",
  "anonymous visitor",
  "call us",
  "support agent",
  "人工客服",
  "轉人工客服",
  "聯絡客服",
  "聯絡我們",
  "留下資料",
  "表單留資",
] as const;

function assertNoForbiddenCopy(text: string) {
  const normalized = text.toLowerCase();

  for (const forbiddenText of forbiddenCopy) {
    expect(normalized).not.toContain(forbiddenText.toLowerCase());
  }
}

function createRenderableMessages(): AssistantRenderableMessage[] {
  return [
    {
      key: "user-001",
      messageId: "message-user-001",
      kind: "user",
      role: "user",
      content: "幫我查詢訂單狀態",
      createdAt,
    },
    {
      key: "answer-001",
      messageId: "message-answer-001",
      kind: "assistant_answer",
      role: "assistant",
      content: "這張訂單目前已確認。",
      createdAt,
      answerDecision: "answered",
      evidence: [],
    },
    {
      key: "clarification-001",
      kind: "assistant_streaming",
      role: "assistant",
      content: "請提供要查詢的訂單編號。",
      createdAt,
      status: "completed",
      lastSequence: 1,
      evidence: [],
      finalAnswerDecision: "clarification_required",
      finalDecisionState: {
        kind: "clarification_required",
        answerDecision: "clarification_required",
        clarificationQuestionId: "clarification-001",
      },
    },
    {
      key: "no-answer-001",
      kind: "assistant_streaming",
      role: "assistant",
      content: "目前找不到足夠可信的內部資料來回答。",
      createdAt,
      status: "completed",
      lastSequence: 1,
      evidence: [],
      finalAnswerDecision: "no_answer",
      finalDecisionState: {
        kind: "no_answer",
        answerDecision: "no_answer",
        noAnswerReason: "no_evidence",
      },
    },
    {
      key: "permission-denied-001",
      kind: "assistant_streaming",
      role: "assistant",
      content: "你目前沒有足夠權限查看這項資訊。",
      createdAt,
      status: "completed",
      lastSequence: 1,
      evidence: [],
      finalAnswerDecision: "permission_denied",
      finalDecisionState: {
        kind: "permission_denied",
        answerDecision: "permission_denied",
      },
    },
    {
      key: "tool-failure-001",
      kind: "assistant_streaming",
      role: "assistant",
      content: "目前無法安全取得所需資料，請稍後再試或調整查詢條件。",
      createdAt,
      status: "completed",
      lastSequence: 1,
      evidence: [],
      finalAnswerDecision: "no_answer",
      finalDecisionState: {
        kind: "no_answer",
        answerDecision: "no_answer",
        noAnswerReason: "tool_failure",
      },
    },
    {
      key: "escalation-001",
      kind: "assistant_streaming",
      role: "assistant",
      content: "目前資訊不足以自動完成，請依內部流程接續處理。",
      createdAt,
      status: "completed",
      lastSequence: 1,
      evidence: [],
      finalAnswerDecision: "escalation_required",
      finalDecisionState: {
        kind: "escalation_required",
        answerDecision: "escalation_required",
        escalationRequestId: "escalation-001",
      },
    },
    {
      key: "interrupted-001",
      messageId: "message-interrupted-001",
      requestId: "req-interrupted-001",
      kind: "assistant_streaming",
      role: "assistant",
      content: "這是一段尚未完成的內容。",
      createdAt,
      status: "failed",
      lastSequence: 1,
      evidence: [],
    },
    {
      key: "degraded-001",
      kind: "degraded",
      role: "assistant",
      safeTitle: "助理服務暫時不穩定",
      degradedKind: "degraded",
      content: "目前無法完成這次回覆，請稍後再試。",
      createdAt,
    },
    {
      key: "action-draft-001",
      messageId: "message-action-draft-001",
      requestId: "req-action-draft-001",
      kind: "assistant_streaming",
      role: "assistant",
      content: "請確認是否送出此操作。",
      createdAt,
      status: "completed",
      lastSequence: 1,
      evidence: [],
      finalAnswerDecision: "confirmation_required",
      finalDecisionState: {
        kind: "confirmation_required",
        answerDecision: "confirmation_required",
        actionDraftId: "action-draft-001",
      },
    },
    {
      key: "approval-001",
      messageId: "message-approval-001",
      requestId: "req-approval-001",
      kind: "assistant_streaming",
      role: "assistant",
      content: "此操作需要額外審核。",
      createdAt,
      status: "completed",
      lastSequence: 1,
      evidence: [],
      finalAnswerDecision: "approval_required",
      finalDecisionState: {
        kind: "approval_required",
        answerDecision: "approval_required",
        approvalRequestId: "approval-request-001",
      },
    },
  ];
}

function createActionDraftState(): Record<string, ActionDraftDetailState> {
  return {
    "action-draft-001": {
      actionDraftId: "action-draft-001",
      operationStatus: "idle",
      detailStatus: "available",
      actionDraftStatus: "waiting_confirmation",
      idempotencyKey: null,
      detail: {
        actionDraftId: "action-draft-001",
        requestId: "req-action-draft-001",
        messageId: "message-action-draft-001",
        status: "waiting_confirmation",
        riskLevel: "medium",
        toolName: "mock.orders.update",
        resource: "orders",
        operation: "update",
        preview: {
          targetEntityId: "SO-20002",
        },
        expiresAt: "2026-07-11T10:00:00.000Z",
      },
    },
  };
}

function createApprovalState(): Record<string, ApprovalRequestDetailState> {
  return {
    "approval-request-001": {
      approvalRequestId: "approval-request-001",
      detailStatus: "available",
      openDetailStatus: "idle",
      requestId: "req-approval-001",
      messageId: "message-approval-001",
      sessionId: "session-approval-001",
      status: "pending",
      riskLevel: "high",
      actionSummary: {
        operation: "cancel",
      },
      payloadSummary: {
        targetEntityId: "SO-20002",
      },
      evidenceRefIds: ["evidence-001"],
    },
  };
}

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount();
  }
  document.body.innerHTML = "";
});

describe("Final Phase no-public-chatbot semantics regression", () => {
  it("keeps widget shell and panel copy within internal assistant semantics", async () => {
    const widget = await mountSuspended(ChatWidget, {
      attachTo: document.body,
    });
    mountedWrappers.push(widget);

    await widget.get('[data-testid="assistant-launcher"]').trigger("click");

    assertNoForbiddenCopy(widget.text());

    const panel = await mountSuspended(ChatPanel, {
      props: {
        availability: "normal",
        title: "AI 助理",
        canSend: false,
        sendDisabledReason: "context_not_ready",
      },
    });
    mountedWrappers.push(panel);

    assertNoForbiddenCopy(panel.text());
  });

  it("keeps input states free of public chatbot, handoff, and lead-capture semantics", async () => {
    for (const props of [
      {
        canSend: true,
      },
      {
        canSend: false,
        disabledReason: "context_not_ready" as const,
      },
      {
        canSend: false,
        disabledReason: "streaming" as const,
        isStreaming: true,
      },
    ]) {
      const wrapper = await mountSuspended(ChatInputBar, {
        props,
      });
      mountedWrappers.push(wrapper);

      assertNoForbiddenCopy(wrapper.text());
    }
  });

  it("keeps answered, safe-state, action-draft, approval, degraded, and interrupted renderers within internal-safe copy", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        contextReady: true,
        canOpenApprovalDetail: true,
        messages: createRenderableMessages(),
        actionDraftStates: createActionDraftState(),
        approvalRequestStates: createApprovalState(),
      },
    });
    mountedWrappers.push(wrapper);

    assertNoForbiddenCopy(wrapper.text());
  });

  it("keeps session recovery copy within internal assistant semantics", async () => {
    const wrapper = await mountSuspended(SessionRecoveryMessage, {
      props: {
        reason: "not_found",
      },
    });
    mountedWrappers.push(wrapper);

    assertNoForbiddenCopy(wrapper.text());
  });
});
