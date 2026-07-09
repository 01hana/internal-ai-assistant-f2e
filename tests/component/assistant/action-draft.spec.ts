import { mountSuspended } from "@nuxt/test-utils/runtime";
import type { VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import ChatMessageArea from "../../../app/features/assistant/components/ChatMessageArea.vue";
import type {
  ActionDraftDetailState,
  AssistantStreamingUiMessage,
  AnswerDecisionUiState,
  HistoryMessageSummary,
} from "../../../app/types/assistant";

const mountedWrappers: VueWrapper[] = [];
const createdAt = "2026-07-08T09:00:00.000Z";

function createConfirmationStreamingMessage(
  overrides: Partial<AssistantStreamingUiMessage> = {},
): AssistantStreamingUiMessage {
  return {
    key: "stream:action-draft-001",
    messageId: "message-action-draft-001",
    requestId: "req-action-draft-001",
    kind: "assistant_streaming",
    role: "assistant",
    content: "請確認是否送出此操作。",
    createdAt,
    status: "completed",
    lastSequence: 2,
    evidence: [],
    finalAnswerDecision: "confirmation_required",
    finalDecisionState: {
      kind: "confirmation_required",
      answerDecision: "confirmation_required",
      actionDraftId: "action-draft-001",
    } satisfies AnswerDecisionUiState,
    ...overrides,
  };
}

function createActionDraftState(
  overrides: Partial<ActionDraftDetailState> = {},
): ActionDraftDetailState {
  return {
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
      toolName: "mock.orders.status.update",
      resource: "orders",
      operation: "update",
      preview: {
        targetEntityId: "SO-10001",
        status: "cancelled",
      },
      expiresAt: "2026-07-08T10:15:00.000Z",
    },
    ...overrides,
  };
}

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount();
  }
  document.body.innerHTML = "";
});

describe("ChatMessageArea action draft confirmation foundation", () => {
  it("renders ActionDraftConfirmationMessage for live confirmation_required", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createConfirmationStreamingMessage()],
        actionDraftStates: {
          "action-draft-001": createActionDraftState(),
        },
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-action-draft-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-action-draft-time"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-action-draft-preview"]').text(),
    ).toContain("SO-10001");
    expect(
      wrapper.get('[data-testid="assistant-action-draft-risk"]').text(),
    ).toContain("medium");
    expect(
      wrapper.get('[data-testid="assistant-action-draft-expires-at"]').text(),
    ).toContain("有效期限");
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
  });

  it("renders history confirmation_required on the same confirmation renderer with safe unavailable detail state", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          {
            messageId: "message-history-confirmation-001",
            role: "assistant",
            content: "請確認是否送出此操作。",
            createdAt,
            answerDecision: "confirmation_required",
          } satisfies HistoryMessageSummary,
        ],
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-action-draft-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-action-draft-error"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(
      false,
    );
  });

  it("emits confirm and cancel with the actionDraftId", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createConfirmationStreamingMessage()],
        actionDraftStates: {
          "action-draft-001": createActionDraftState(),
        },
      },
    });
    mountedWrappers.push(wrapper);

    await wrapper.get('[data-testid="assistant-action-draft-confirm"]').trigger("click");
    await wrapper.get('[data-testid="assistant-action-draft-cancel"]').trigger("click");

    expect(wrapper.emitted("confirmActionDraft")).toEqual([
      [{ actionDraftId: "action-draft-001" }],
    ]);
    expect(wrapper.emitted("cancelActionDraft")).toEqual([
      [{ actionDraftId: "action-draft-001" }],
    ]);
  });

  it("disables confirm and cancel while confirming or cancelling", async () => {
    for (const operationStatus of ["confirming", "cancelling"] as const) {
      const wrapper = await mountSuspended(ChatMessageArea, {
        props: {
          messages: [createConfirmationStreamingMessage({ key: `stream:${operationStatus}` })],
          actionDraftStates: {
            "action-draft-001": createActionDraftState({
              operationStatus,
            }),
          },
        },
      });
      mountedWrappers.push(wrapper);

      expect(
        wrapper.get('[data-testid="assistant-action-draft-loading"]').text(),
      ).toContain(operationStatus === "cancelling" ? "正在取消" : "正在送出確認");
      expect(
        wrapper.get('[data-testid="assistant-action-draft-confirm"]').attributes("disabled"),
      ).toBeDefined();
      expect(
        wrapper.get('[data-testid="assistant-action-draft-cancel"]').attributes("disabled"),
      ).toBeDefined();
    }
  });

  it("shows pending_execution_guard as a safe processing state and keeps actions disabled", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createConfirmationStreamingMessage()],
        actionDraftStates: {
          "action-draft-001": createActionDraftState({
            operationStatus: "pending_execution_guard",
            actionDraftStatus: "confirmed",
            safeMessage: "已送出確認，系統仍在處理，請勿重複操作。",
          }),
        },
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-action-draft-pending-guard"]').text(),
    ).toContain("系統仍在處理");
    expect(
      wrapper.get('[data-testid="assistant-action-draft-confirm"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get('[data-testid="assistant-action-draft-cancel"]').attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.text()).not.toContain("已安全執行");
  });

  it("shows submitted-safe copy for confirmed results without claiming side effects completed", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createConfirmationStreamingMessage()],
        actionDraftStates: {
          "action-draft-001": createActionDraftState({
            operationStatus: "submitted",
            actionDraftStatus: "confirmed",
          }),
        },
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-action-draft-submitted"]').text(),
    ).toContain("確認已送出");
    expect(wrapper.text()).not.toContain("已成功執行");
  });

  it("shows loading state while action draft detail is being prepared", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createConfirmationStreamingMessage()],
        actionDraftStates: {
          "action-draft-001": createActionDraftState({
            detailStatus: "loading",
            detail: undefined,
          }),
        },
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-action-draft-loading"]').exists(),
    ).toBe(true);
  });

  it("shows terminal foundation UI for expired, failed, and cancelled states without claiming execution completed", async () => {
    for (const status of ["expired", "failed", "cancelled"] as const) {
      const wrapper = await mountSuspended(ChatMessageArea, {
        props: {
          messages: [createConfirmationStreamingMessage({ key: `stream:${status}` })],
          actionDraftStates: {
            "action-draft-001": createActionDraftState({
              actionDraftStatus: status,
              detail: {
                ...createActionDraftState().detail!,
                status,
              },
            }),
          },
        },
      });
      mountedWrappers.push(wrapper);

      expect(
        wrapper.get('[data-testid="assistant-action-draft-terminal-status"]').exists(),
      ).toBe(true);
      expect(
        wrapper.get('[data-testid="assistant-action-draft-status-copy"]').text(),
      ).toBeTruthy();
      expect(wrapper.text()).not.toContain("已成功執行");
    }
  });

  it("disables confirm when the action draft is expired", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createConfirmationStreamingMessage()],
        actionDraftStates: {
          "action-draft-001": createActionDraftState({
            actionDraftStatus: "expired",
            operationStatus: "expired",
            detail: {
              ...createActionDraftState().detail!,
              status: "expired",
            },
          }),
        },
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-action-draft-confirm"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("shows a retryable safe error when the confirm flow fails before a terminal backend status", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createConfirmationStreamingMessage()],
        actionDraftStates: {
          "action-draft-001": createActionDraftState({
            operationStatus: "failed",
            actionDraftStatus: "waiting_confirmation",
            safeMessage: "確認流程暫時無法完成，請稍後再試。",
          }),
        },
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-action-draft-operation-error"]').text(),
    ).toContain("請稍後再試");
    expect(
      wrapper.get('[data-testid="assistant-action-draft-confirm"]').attributes("disabled"),
    ).toBeUndefined();
  });

  it("does not expose raw payload or public-chatbot semantics", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [createConfirmationStreamingMessage()],
        actionDraftStates: {
          "action-draft-001": createActionDraftState({
            detail: {
              ...createActionDraftState().detail!,
              preview: {
                rawToolOutput: { secret: "blocked" },
                targetEntityId: "SO-10001",
              },
            },
          }),
        },
      },
    });
    mountedWrappers.push(wrapper);

    const text = wrapper.text().toLowerCase();

    expect(text).toContain("so-10001");
    expect(text).not.toContain("rawtooloutput");
    expect(text).not.toContain("stack trace");
    expect(text).not.toContain("public chatbot");
    expect(text).not.toContain("customer service");
    expect(text).not.toContain("handoff");
    expect(text).not.toContain("lead");
  });
});
