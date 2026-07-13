import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises, type VueWrapper } from "@vue/test-utils";
import { setActivePinia, type Pinia } from "pinia";
import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import ChatInputBar from "../../../app/features/assistant/components/ChatInputBar.vue";
import ChatMessageArea from "../../../app/features/assistant/components/ChatMessageArea.vue";
import ChatWidget from "../../../app/features/assistant/components/ChatWidget.vue";
import type {
  ActionDraftDetailState,
  ApprovalRequestDetailState,
  AssistantHostContextProvider,
  AssistantHostContextSnapshot,
  AssistantRenderableMessage,
} from "../../../app/types/assistant";
import { useAssistantSessionStore } from "../../../app/stores/assistant/useSessionStore";
import { useChatWidgetStore } from "../../../app/stores/assistant/useChatWidgetStore";

const mountedWrappers: VueWrapper[] = [];
const createdAt = "2026-07-11T09:00:00.000Z";

function createProvider(): AssistantHostContextProvider {
  const snapshot: AssistantHostContextSnapshot = {
    readiness: { status: "not_ready", reason: "page_context_loading" },
    identityHeaders: null,
    pageContext: null,
  };

  return {
    getSnapshot: () => snapshot,
  };
}

async function mountWidget(): Promise<VueWrapper> {
  const wrapper = await mountSuspended(ChatWidget, {
    attachTo: document.body,
    props: {
      hostContextProvider: createProvider(),
    },
  });
  const nuxtPinia = (wrapper.vm as unknown as { $pinia: Pinia }).$pinia;
  setActivePinia(nuxtPinia);
  useChatWidgetStore().reset();
  useAssistantSessionStore().resetSessionState();
  await nextTick();
  mountedWrappers.push(wrapper);
  return wrapper;
}

function createMessages(): AssistantRenderableMessage[] {
  return [
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
  ];
}

function createActionDraftStates(): Record<string, ActionDraftDetailState> {
  return {
    "action-draft-001": {
      actionDraftId: "action-draft-001",
      operationStatus: "confirming",
      detailStatus: "available",
      actionDraftStatus: "waiting_confirmation",
      idempotencyKey: "idem-001",
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
      },
    },
  };
}

function createApprovalStates(): Record<string, ApprovalRequestDetailState> {
  return {
    "approval-request-001": {
      approvalRequestId: "approval-request-001",
      detailStatus: "available",
      openDetailStatus: "opening",
      requestId: "req-approval-001",
      messageId: "message-approval-001",
      sessionId: "session-approval-001",
      status: "pending",
      riskLevel: "critical",
      actionSummary: {
        operation: "cancel",
      },
      payloadSummary: {
        targetEntityId: "SO-20002",
      },
    },
  };
}

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount();
  }
  document.body.innerHTML = "";
});

describe("Final Phase accessibility regression", () => {
  it("keeps launcher, dialog shell, close button, live region, textarea, and send/cancel labels accessible", async () => {
    const wrapper = await mountWidget();
    const launcher = wrapper.get('[data-testid="assistant-launcher"]');

    expect(launcher.attributes("aria-expanded")).toBe("false");
    expect(launcher.attributes("aria-controls")).toBe("assistant-chat-panel");

    await launcher.trigger("click");
    await flushPromises();

    expect(launcher.attributes("aria-expanded")).toBe("true");
    expect(wrapper.get('[data-testid="assistant-panel"]').attributes("role")).toBe("dialog");
    expect(
      wrapper.get('[data-testid="assistant-panel-close"]').attributes("aria-label")
      ?? wrapper.get('[data-testid="assistant-panel-close"]').attributes("title"),
    ).toBeTruthy();

    const liveRegion = wrapper.get('[data-testid="assistant-panel-status"]');
    expect(liveRegion.attributes("role")).toBe("status");
    expect(liveRegion.attributes("aria-live")).toBe("polite");

    const input = wrapper.get('[data-testid="assistant-chat-input"]');
    expect(input.attributes("aria-label") ?? input.attributes("placeholder")).toBeTruthy();

    const sendButton = wrapper.get('[data-testid="assistant-chat-submit"]');
    expect(sendButton.attributes("aria-label")).toBe("送出訊息");

    await wrapper.trigger("keydown", { key: "Escape" });
    await flushPromises();

    expect(wrapper.find('[data-testid="assistant-panel"]').exists()).toBe(false);
    expect(document.activeElement).not.toBe(document.body);
  });

  it("keeps action draft, approval, interrupted, and degraded controls accessible and stateful", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        contextReady: true,
        canOpenApprovalDetail: true,
        retryingMessageKey: "interrupted-001",
        messages: createMessages(),
        actionDraftStates: createActionDraftStates(),
        approvalRequestStates: createApprovalStates(),
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-action-draft-confirm"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get('[data-testid="assistant-action-draft-cancel"]').attributes("disabled"),
    ).toBeDefined();

    const approvalButton = wrapper.get(
      '[data-testid="assistant-approval-request-open-detail"]',
    );
    expect(approvalButton.attributes("disabled")).toBeDefined();
    expect(approvalButton.text()).toContain("正在開啟審核詳情");

    const interruptedRetry = wrapper.get(
      '[data-testid="assistant-interrupted-retry"]',
    );
    expect(interruptedRetry.attributes("disabled")).toBeDefined();
    expect(interruptedRetry.text()).toContain("正在重新送出");

    const degradedRetry = wrapper.get(
      '[data-testid="assistant-degraded-retry"]',
    );
    expect(degradedRetry.text()).toContain("重新送出");
    expect(degradedRetry.attributes("disabled")).toBeUndefined();

    const streamingInput = await mountSuspended(ChatInputBar, {
      props: {
        canSend: false,
        isStreaming: true,
        disabledReason: "streaming",
      },
    });
    mountedWrappers.push(streamingInput);

    expect(
      streamingInput.get('[data-testid="assistant-chat-cancel"]').attributes("aria-label"),
    ).toBe("停止回覆");
  });
});
