import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPinia } from "pinia";
import { describe, expect, it, vi } from "vitest";

import AssistantProductRuntimePanel from "../../../packages/assistant-runtime/src/components/product-ui/AssistantProductRuntimePanel.vue";
import AssistantProductPanelShell from "../../../packages/assistant-runtime/src/components/product-ui/AssistantProductPanelShell.vue";
import {
  createAssistantRuntimeController,
  createAssistantRuntimeStores,
  type AssistantRuntimeTransportPort,
  type HistoryMessageSummary,
} from "../../../packages/assistant-runtime/src";

type ProductPanelMessage = HistoryMessageSummary & Record<string, unknown>;

function createPanelHarness() {
  const pinia = createPinia();
  const stores = createAssistantRuntimeStores<ProductPanelMessage>({
    pinia,
    runtimeScope: "product-panel-icon-test",
  });
  const controller = createAssistantRuntimeController<ProductPanelMessage>({
    runtimeScope: "product-panel-icon-test",
    stores,
    transport: {} as AssistantRuntimeTransportPort,
  });
  const callbacks = {
    cancelStreaming: vi.fn(),
    confirmActionDraft: vi.fn(),
    cancelActionDraft: vi.fn(),
    loadMoreHistory: vi.fn(),
    openApprovalDetail: vi.fn(),
    sendMessage: vi.fn(),
    submitFeedback: vi.fn(),
  };

  controller.setContextReady(true);
  controller.setReady();
  controller.setMessages([
    {
      answerDecision: "answered",
      content: "可評價的回答",
      createdAt: "2026-07-27T00:00:00.000Z",
      evidenceRefs: [],
      messageId: "message-icon-001",
      role: "assistant",
    },
  ], "cursor-next");

  return { callbacks, controller, pinia };
}

describe("AssistantProductRuntimePanel CTA presentation", () => {
  it("uses accessible inline SVG icons for low-risk CTAs without changing their callbacks", async () => {
    const harness = createPanelHarness();
    const wrapper = mount(AssistantProductRuntimePanel, {
      props: {
        controller: harness.controller,
        runtimeScope: harness.controller.runtimeScope,
        composerCanSend: true,
        onCancelStreaming: harness.callbacks.cancelStreaming,
        onCancelActionDraft: harness.callbacks.cancelActionDraft,
        onConfirmActionDraft: harness.callbacks.confirmActionDraft,
        onLoadMoreHistory: harness.callbacks.loadMoreHistory,
        onOpenApprovalDetail: harness.callbacks.openApprovalDetail,
        onSendMessage: harness.callbacks.sendMessage,
        onSubmitFeedback: harness.callbacks.submitFeedback,
      },
      global: {
        plugins: [harness.pinia],
      },
    });

    const iconOnlyControls = [
      ["assistant-history-load-more", "載入更多訊息"],
      ["assistant-feedback-helpful", "這個回答有幫助"],
      ["assistant-feedback-not-helpful", "這個回答沒有幫助"],
      ["assistant-chat-submit", "送出訊息"],
    ] as const;

    for (const [testId, accessibleName] of iconOnlyControls) {
      const control = wrapper.get(`[data-testid="${testId}"]`);

      expect(control.text()).toBe("");
      expect(control.attributes("aria-label")).toBe(accessibleName);
      expect(control.attributes("title")).toBe(accessibleName);
      expect(control.find("svg.assistant-product-icon").exists()).toBe(true);
      expect(control.find("svg").attributes("aria-hidden")).toBe("true");
    }

    await wrapper.get('[data-testid="assistant-history-load-more"]').trigger("click");
    await wrapper.get('[data-testid="assistant-feedback-helpful"]').trigger("click");
    await wrapper.get('[data-testid="assistant-feedback-not-helpful"]').trigger("click");
    await wrapper.get('[data-testid="assistant-chat-input"]').setValue("  需要送出的訊息  ");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");

    expect(harness.callbacks.loadMoreHistory).toHaveBeenCalledTimes(1);
    expect(harness.callbacks.submitFeedback).toHaveBeenNthCalledWith(1, {
      messageId: "message-icon-001",
      requestId: null,
      value: "helpful",
    });
    expect(harness.callbacks.submitFeedback).toHaveBeenNthCalledWith(2, {
      messageId: "message-icon-001",
      requestId: null,
      value: "not_helpful",
    });
    expect(harness.callbacks.sendMessage).toHaveBeenCalledWith("需要送出的訊息");
  });

  it("keeps ActionDraft and ApprovalRequest controls as visible high-context text actions", () => {
    const source = wrapperSource();

    expect(source).toContain('data-testid="assistant-action-draft-confirm"');
    expect(source).toContain("確認操作");
    expect(source).toContain('data-testid="assistant-action-draft-cancel"');
    expect(source).toContain("取消操作");
    expect(source).toContain('data-testid="assistant-approval-request-open-detail"');
    expect(source).toContain("開啟審核詳情");
  });

  it("keeps the shared product shell's restart and close affordances as labeled SVG controls", async () => {
    const onClose = vi.fn();
    const onRestart = vi.fn();
    const wrapper = mount(AssistantProductPanelShell, {
      props: {
        contextReady: true,
        status: "AI 助理已就緒",
        title: "AI 助理",
        onClose,
        onRestart,
      },
    });

    for (const testId of ["assistant-panel-restart", "assistant-panel-close"]) {
      const control = wrapper.get(`[data-testid="${testId}"]`);

      expect(control.text()).toBe("");
      expect(control.find("svg.assistant-product-icon").exists()).toBe(true);
      expect(control.find("svg").attributes("aria-hidden")).toBe("true");
    }

    await wrapper.get('[data-testid="assistant-panel-restart"]').trigger("click");
    await wrapper.get('[data-testid="assistant-panel-close"]').trigger("click");

    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders FE001-equivalent avatars, timestamps, typing dots, and semantic safe-state variants", () => {
    const harness = createPanelHarness();
    harness.controller.setMessages([
      {
        content: "使用者訊息",
        createdAt: "2026-07-27T00:00:00.000Z",
        messageId: "user-message-001",
        role: "user",
      },
      {
        content: "",
        createdAt: "2026-07-27T00:01:00.000Z",
        evidence: [],
        key: "stream-message-001",
        kind: "assistant_streaming",
        lastSequence: null,
        role: "assistant",
        status: "streaming",
      },
      {
        answerDecision: "clarification_required",
        content: "請補充查詢條件。",
        createdAt: "2026-07-27T00:02:00.000Z",
        messageId: "clarification-message-001",
        role: "assistant",
      },
      {
        answerDecision: "permission_denied",
        content: "你目前沒有存取權限。",
        createdAt: "2026-07-27T00:03:00.000Z",
        messageId: "permission-message-001",
        role: "assistant",
      },
      {
        answerDecision: "no_answer",
        content: "目前沒有足夠資料。",
        createdAt: "2026-07-27T00:04:00.000Z",
        messageId: "no-answer-message-001",
        role: "assistant",
      },
      {
        answerDecision: "tool_failure",
        content: "工具暫時沒有回應。",
        createdAt: "2026-07-27T00:05:00.000Z",
        messageId: "tool-failure-message-001",
        role: "assistant",
      },
      {
        content: "尚未完成的部分回覆",
        createdAt: "2026-07-27T00:06:00.000Z",
        evidence: [],
        key: "interrupted-message-001",
        kind: "assistant_streaming",
        lastSequence: null,
        role: "assistant",
        status: "interrupted",
      },
      {
        answerDecision: "escalation_required",
        content: "請交由內部流程接續處理。",
        createdAt: "2026-07-27T00:07:00.000Z",
        messageId: "escalation-message-001",
        role: "assistant",
      },
    ] as ProductPanelMessage[], null);

    const wrapper = mount(AssistantProductRuntimePanel, {
      props: {
        controller: harness.controller,
        runtimeScope: harness.controller.runtimeScope,
        onCancelStreaming: harness.callbacks.cancelStreaming,
        onCancelActionDraft: harness.callbacks.cancelActionDraft,
        onConfirmActionDraft: harness.callbacks.confirmActionDraft,
        onLoadMoreHistory: harness.callbacks.loadMoreHistory,
        onOpenApprovalDetail: harness.callbacks.openApprovalDetail,
        onSendMessage: harness.callbacks.sendMessage,
        onSubmitFeedback: harness.callbacks.submitFeedback,
      },
      global: { plugins: [harness.pinia] },
    });

    expect(wrapper.findAll('[data-testid="assistant-message-avatar-assistant"]')).toHaveLength(7);
    expect(wrapper.findAll('[data-testid="assistant-message-avatar-user"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-testid="assistant-message-timestamp"]')).toHaveLength(8);
    expect(wrapper.get('[data-testid="assistant-message-timestamp"]').text()).toBe("08:00");
    expect(wrapper.get('[data-testid="assistant-typing-indicator"]')).toBeTruthy();
    expect(wrapper.findAll('[data-testid="assistant-typing-dot"]')).toHaveLength(3);
    expect(wrapper.get('[data-testid="assistant-clarification-message"] .assistant-safe-outcome').classes()).toContain("assistant-safe-outcome--warning");
    expect(wrapper.get('[data-testid="assistant-permission-denied-message"] .assistant-safe-outcome').classes()).toContain("assistant-safe-outcome--error");
    expect(wrapper.get('[data-testid="assistant-no-answer-message"] .assistant-safe-outcome').classes()).toContain("assistant-safe-outcome--neutral");
    expect(wrapper.get('[data-testid="assistant-clarification-label"]').text()).toBe("需要補充資訊");
    expect(wrapper.get('[data-testid="assistant-clarification-hint"]').text()).toContain("同一個對話中繼續協助");
    expect(wrapper.get('[data-testid="assistant-permission-denied-label"]').text()).toBe("權限受限");
    expect(wrapper.get('[data-testid="assistant-tool-failure-label"]').text()).toBe("內部資料查詢未完成");
    expect(wrapper.get('[data-testid="assistant-interrupted-title"]').text()).toBe("回覆已中斷");
    expect(wrapper.get('[data-testid="assistant-interrupted-partial"]').text()).toBe("尚未完成的部分回覆");
    expect(wrapper.get('[data-testid="assistant-escalation-label"]').text()).toBe("需要升級處理");
  });
});

function wrapperSource(): string {
  return readFileSync(
    join(process.cwd(), "packages/assistant-runtime/src/components/product-ui/AssistantProductRuntimePanel.vue"),
    "utf8",
  );
}
