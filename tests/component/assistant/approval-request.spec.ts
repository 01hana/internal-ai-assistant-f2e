import { mountSuspended } from "@nuxt/test-utils/runtime";
import type { VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import ChatMessageArea from "../../../app/features/assistant/components/ChatMessageArea.vue";
import type {
  ApprovalRequestDetailState,
  AssistantStreamingUiMessage,
  AnswerDecisionUiState,
  HistoryMessageSummary,
} from "../../../app/types/assistant";

const mountedWrappers: VueWrapper[] = [];
const createdAt = "2026-07-09T09:00:00.000Z";

function createApprovalStreamingMessage(
  overrides: Partial<AssistantStreamingUiMessage> = {},
): AssistantStreamingUiMessage {
  return {
    key: "stream:approval-001",
    messageId: "message-approval-001",
    requestId: "req-approval-001",
    kind: "assistant_streaming",
    role: "assistant",
    content: "這個操作需要額外審核。",
    createdAt,
    status: "completed",
    lastSequence: 2,
    evidence: [],
    finalAnswerDecision: "approval_required",
    finalDecisionState: {
      kind: "approval_required",
      answerDecision: "approval_required",
      approvalRequestId: "approval-request-001",
    } satisfies AnswerDecisionUiState,
    ...overrides,
  };
}

function createApprovalState(
  overrides: Partial<ApprovalRequestDetailState> = {},
): ApprovalRequestDetailState {
  return {
    approvalRequestId: "approval-request-001",
    detailStatus: "available",
    openDetailStatus: "idle",
    requestId: "req-approval-001",
    messageId: "message-approval-001",
    sessionId: "session-001",
    status: "pending",
    riskLevel: "high",
    actionSummary: {
      toolName: "mock.orders.cancel",
      resource: "orders",
      unsafeNested: {
        shouldHide: true,
      },
    },
    payloadSummary: {
      targetEntityId: "SO-10001",
      dryRun: false,
    },
    expiresAt: "2026-07-09T10:30:00.000Z",
    evidenceRefIds: ["evidence-structured-001"],
    ...overrides,
  };
}

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount();
  }
  document.body.innerHTML = "";
});

describe("ChatMessageArea approval request display-only foundation", () => {
  it("renders the approval renderer for live approval_required messages", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createApprovalStreamingMessage()],
        approvalRequestStates: {
          "approval-request-001": createApprovalState(),
        },
        canOpenApprovalDetail: true,
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-approval-request-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-approval-request-status"]').text(),
    ).toContain("待處理");
    expect(
      wrapper.get('[data-testid="assistant-approval-request-risk"]').text(),
    ).toContain("高");
    expect(
      wrapper.get('[data-testid="assistant-approval-request-id"]').text(),
    ).toContain("approval-request-001");
    expect(
      wrapper.get('[data-testid="assistant-approval-request-action-summary"]').text(),
    ).toContain("mock.orders.cancel");
    expect(
      wrapper.get('[data-testid="assistant-approval-request-payload-summary"]').text(),
    ).toContain("SO-10001");
    expect(
      wrapper.get('[data-testid="assistant-approval-request-evidence"]').text(),
    ).toContain("evidence-structured-001");
    expect(wrapper.text()).not.toContain("unsafeNested");
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
    expect(wrapper.find("button").text()).not.toContain("核准");
  });

  it("renders loading and unavailable states safely", async () => {
    const loadingWrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createApprovalStreamingMessage()],
        approvalRequestStates: {
          "approval-request-001": createApprovalState({
            detailStatus: "loading",
          }),
        },
      },
    });
    mountedWrappers.push(loadingWrapper);

    expect(
      loadingWrapper.get('[data-testid="assistant-approval-request-loading"]').exists(),
    ).toBe(true);

    const unavailableWrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createApprovalStreamingMessage({ key: "stream:approval-unavailable" })],
        approvalRequestStates: {
          "approval-request-001": createApprovalState({
            detailStatus: "unavailable",
            safeMessage: "目前無法載入審核摘要，請稍後再試。",
          }),
        },
      },
    });
    mountedWrappers.push(unavailableWrapper);

    expect(
      unavailableWrapper.get('[data-testid="assistant-approval-request-error"]').text(),
    ).toContain("目前無法載入審核摘要");
  });

  it("renders open-detail opening and failed states separately from detail loading", async () => {
    const openingWrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createApprovalStreamingMessage()],
        approvalRequestStates: {
          "approval-request-001": createApprovalState({
            openDetailStatus: "opening",
          }),
        },
        canOpenApprovalDetail: true,
      },
    });
    mountedWrappers.push(openingWrapper);

    expect(
      openingWrapper.get('[data-testid="assistant-approval-request-open-detail"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      openingWrapper.get('[data-testid="assistant-approval-request-open-detail"]').text(),
    ).toContain("正在開啟審核詳情");

    const failedWrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createApprovalStreamingMessage({ key: "stream:approval-open-failed" })],
        approvalRequestStates: {
          "approval-request-001": createApprovalState({
            openDetailStatus: "failed",
            openDetailSafeMessage: "目前無法開啟審核詳情，請稍後再試。",
          }),
        },
        canOpenApprovalDetail: true,
      },
    });
    mountedWrappers.push(failedWrapper);

    expect(
      failedWrapper.get('[data-testid="assistant-approval-request-open-detail-error"]').text(),
    ).toContain("目前無法開啟審核詳情");
    expect(
      failedWrapper.get('[data-testid="assistant-approval-request-open-detail"]').attributes("disabled"),
    ).toBeUndefined();
  });

  it("renders history approval_required messages with the same approval renderer", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          {
            messageId: "message-history-approval-001",
            role: "assistant",
            content: "此操作需要額外審核。",
            createdAt,
            answerDecision: "approval_required",
            approvalRequestId: "approval-request-001",
          } satisfies HistoryMessageSummary,
        ],
        approvalRequestStates: {
          "approval-request-001": createApprovalState({
            messageId: "message-history-approval-001",
          }),
        },
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-approval-request-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-approval-request-time"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists(),
    ).toBe(true);
  });

  it("emits openApprovalDetail with the approvalRequestId linkage", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createApprovalStreamingMessage()],
        approvalRequestStates: {
          "approval-request-001": createApprovalState(),
        },
        canOpenApprovalDetail: true,
      },
    });
    mountedWrappers.push(wrapper);

    await wrapper
      .get('[data-testid="assistant-approval-request-open-detail"]')
      .trigger("click");

    expect(wrapper.emitted("openApprovalDetail")).toEqual([
      [{
        approvalRequestId: "approval-request-001",
        requestId: "req-approval-001",
        messageId: "message-approval-001",
        sessionId: "session-001",
      }],
    ]);
  });

  it("keeps the open-detail button disabled when the host callback is unavailable", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createApprovalStreamingMessage()],
        approvalRequestStates: {
          "approval-request-001": createApprovalState(),
        },
        canOpenApprovalDetail: false,
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-approval-request-open-detail"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get('[data-testid="assistant-approval-request-open-detail-unavailable"]').text(),
    ).toContain("尚未提供審核詳情入口");
  });

  it("keeps multiple approval request states isolated per approvalRequestId", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          createApprovalStreamingMessage(),
          createApprovalStreamingMessage({
            key: "stream:approval-002",
            messageId: "message-approval-002",
            requestId: "req-approval-002",
            finalDecisionState: {
              kind: "approval_required",
              answerDecision: "approval_required",
              approvalRequestId: "approval-request-002",
            } satisfies AnswerDecisionUiState,
          }),
        ],
        approvalRequestStates: {
          "approval-request-001": createApprovalState(),
          "approval-request-002": createApprovalState({
            approvalRequestId: "approval-request-002",
            requestId: "req-approval-002",
            messageId: "message-approval-002",
            detailStatus: "unavailable",
            safeMessage: "第二筆審核摘要暫時無法使用。",
          }),
        },
      },
    });
    mountedWrappers.push(wrapper);

    const approvalCards = wrapper.findAll(
      '[data-testid="assistant-approval-request-message"]',
    );

    expect(approvalCards).toHaveLength(2);
    expect(wrapper.text()).toContain("approval-request-001");
    expect(wrapper.text()).toContain("approval-request-002");
    expect(wrapper.text()).toContain("第二筆審核摘要暫時無法使用。");
  });
});
