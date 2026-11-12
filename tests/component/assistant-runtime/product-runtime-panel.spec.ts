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
    expect(wrapper.findAll('[data-testid="assistant-message-avatar-user"]')).toHaveLength(0);
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

  it("keeps only the assistant avatar and places feedback beside the timestamp", async () => {
    const harness = createPanelHarness();
    const longMessage = "很長的訊息".repeat(120);
    harness.controller.setMessages([
      {
        content: longMessage,
        createdAt: "2026-07-27T00:00:00.000Z",
        messageId: "user-layout-001",
        role: "user",
      },
      {
        answerDecision: "answered",
        content: "可評價的回答",
        createdAt: "2026-07-27T00:01:00.000Z",
        evidenceRefs: [],
        messageId: "assistant-layout-001",
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

    const frames = wrapper.findAll(".assistant-message-frame");
    expect(frames).toHaveLength(2);
    expect(frames.map(frame => frame.attributes("data-message-role"))).toEqual(["user", "assistant"]);
    const user = frames[0]!;
    const assistant = frames[1]!;
    expect(user.element.firstElementChild?.classList.contains("assistant-message-frame-content")).toBe(true);
    expect(user.element.children).toHaveLength(1);
    expect(user.find(".assistant-message-avatar").exists()).toBe(false);
    expect(assistant.element.firstElementChild?.classList.contains("assistant-message-avatar--assistant")).toBe(true);
    expect(assistant.element.lastElementChild?.classList.contains("assistant-message-frame-content")).toBe(true);
    expect(user.get(".assistant-message-bubble--user").text()).toBe(longMessage);

    for (const frame of frames) {
      const content = frame.get(".assistant-message-frame-content");
      expect(content.element.firstElementChild?.classList.contains("assistant-message-bubble")).toBe(true);
      expect(content.element.lastElementChild?.classList.contains("assistant-message-metadata")).toBe(true);
      expect(content.get(".assistant-message-metadata time").exists()).toBe(true);
    }
    expect(user.find(".assistant-feedback-controls").exists()).toBe(false);
    expect(assistant.find(".assistant-message-bubble .assistant-feedback-controls").exists()).toBe(false);
    expect(assistant.get(".assistant-message-metadata .assistant-feedback-controls").exists()).toBe(true);
    expect(assistant.findAll(".assistant-feedback-button")).toHaveLength(2);

    await assistant.get('[data-testid="assistant-feedback-helpful"]').trigger("click");
    await assistant.get('[data-testid="assistant-feedback-not-helpful"]').trigger("click");
    expect(harness.callbacks.submitFeedback).toHaveBeenNthCalledWith(1, {
      messageId: "assistant-layout-001",
      requestId: null,
      value: "helpful",
    });
    expect(harness.callbacks.submitFeedback).toHaveBeenNthCalledWith(2, {
      messageId: "assistant-layout-001",
      requestId: null,
      value: "not_helpful",
    });

    harness.controller.startFeedbackSubmission("assistant-layout-001", "helpful", "feedback-request-001");
    await wrapper.vm.$nextTick();
    expect(assistant.get(".assistant-feedback-controls").attributes("aria-busy")).toBe("true");
    expect(assistant.get('[data-testid="assistant-feedback-helpful"]').attributes("aria-pressed")).toBe("true");
    expect(assistant.findAll(".assistant-feedback-button:disabled")).toHaveLength(2);
    harness.controller.completeFeedbackSubmission("assistant-layout-001", { requestId: "feedback-request-001" });
    await wrapper.vm.$nextTick();
    expect(assistant.get(".assistant-feedback-controls").attributes("aria-busy")).toBe("false");
    expect(assistant.get('[data-testid="assistant-feedback-helpful"]').attributes("aria-pressed")).toBe("true");
    expect(assistant.get('[data-testid="assistant-feedback-not-helpful"]').attributes("disabled")).toBeUndefined();
  });

  it("shows a completed answer and source metadata without internal completion labels", () => {
    const harness = createPanelHarness();
    const completed = {
      key: "stream:answered",
      kind: "assistant_streaming",
      role: "assistant",
      requestId: "request:answered",
      messageId: "message:answered",
      content: "正式回答內容",
      createdAt: "2026-07-27T00:00:00.000Z",
      status: "completed",
      finalAnswerDecision: "answered",
      lastSequence: 3,
      evidence: [{ id: "evidence:one", sourceType: "structured_record", title: "資料來源：內部資料查詢" }],
      activities: [{ key: "tool:one", kind: "tool_completed", label: "內部資料查詢完成", sequence: 2, toolCallId: "one" }],
    };
    harness.controller.setMessages([
      completed,
      {
        content: "沒有來源的回答",
        createdAt: "2026-07-27T00:01:00.000Z",
        messageId: "message:no-source",
        answerDecision: "answered",
        role: "assistant",
      },
    ] as ProductPanelMessage[], null);
    const wrapper = mountPanel(harness);
    const messages = wrapper.findAll('.assistant-message-frame--assistant');
    const answered = messages[0]!;
    const noSource = messages[1]!;

    expect(answered.get('[data-testid="assistant-streaming-content"]').text()).toBe("正式回答內容");
    expect(answered.get('[data-testid="assistant-evidence-ref"]').text()).toBe("資料來源：內部資料查詢");
    expect(answered.get('.assistant-evidence-list').element.previousElementSibling?.textContent).toContain("正式回答內容");
    expect(answered.find('[data-testid="assistant-streaming-status"]').exists()).toBe(false);
    expect(answered.find('[data-testid="assistant-streaming-activity"]').exists()).toBe(false);
    expect(answered.find('[data-testid="assistant-ai-answer-decision"]').exists()).toBe(false);
    expect(completed.activities[0]?.label).toBe("內部資料查詢完成");
    expect(answered.get('[data-testid="assistant-message-timestamp"]').exists()).toBe(true);
    expect(answered.findAll('.assistant-feedback-controls button')).toHaveLength(2);
    expect(noSource.find('.assistant-evidence-list').exists()).toBe(false);
    expect(noSource.find('[data-testid="assistant-message-timestamp"]').exists()).toBe(true);
  });

  it("renders safe outcomes as one card with one primary message", () => {
    const harness = createPanelHarness();
    harness.controller.setMessages([
      {
        answerDecision: "no_answer",
        noAnswerReason: "no_evidence",
        content: "目前沒有足夠證據可以安全回答。",
        createdAt: "2026-07-27T00:00:00.000Z",
        messageId: "no-answer-card",
        role: "assistant",
      },
      {
        answerDecision: "clarification_required",
        content: "請指定要查詢哪一筆資料。",
        createdAt: "2026-07-27T00:01:00.000Z",
        messageId: "clarification-card",
        role: "assistant",
      },
      {
        answerDecision: "permission_denied",
        content: "你目前沒有權限取得此資訊。",
        createdAt: "2026-07-27T00:02:00.000Z",
        messageId: "permission-card",
        role: "assistant",
      },
      {
        key: "stream:no-answer",
        kind: "assistant_streaming",
        role: "assistant",
        content: "目前無法安全回答這個問題。",
        status: "completed",
        finalAnswerDecision: "no_answer",
        finalDecisionState: { kind: "no_answer", noAnswerReason: "no_evidence" },
        createdAt: "2026-07-27T00:03:00.000Z",
        lastSequence: 1,
        evidence: [],
      },
      {
        answerDecision: "answered",
        content: "正式回答內容",
        createdAt: "2026-07-27T00:04:00.000Z",
        messageId: "answered-card",
        role: "assistant",
        evidenceRefs: [{ id: "source:one", sourceType: "structured_record", title: "資料來源" }],
      },
    ] as ProductPanelMessage[], null);
    const wrapper = mountPanel(harness);

    for (const [testId, label, primary] of [
      ["assistant-no-answer-message", "缺少可信資料", "目前沒有足夠證據可以安全回答。"],
      ["assistant-clarification-message", "需要補充資訊", "請指定要查詢哪一筆資料。"],
      ["assistant-permission-denied-message", "權限受限", "你目前沒有權限取得此資訊。"],
    ]) {
      const frame = wrapper.get(`[data-testid="${testId}"]`);
      expect(frame.findAll(".assistant-product-state-bubble")).toHaveLength(1);
      expect(frame.find(".assistant-message-bubble").exists()).toBe(false);
      expect(frame.get(".assistant-product-state-badge").text()).toBe(label);
      expect(frame.get(".assistant-product-state-bubble > p").text()).toBe(primary);
      expect(frame.text().split(primary).length - 1).toBe(1);
      expect(frame.get(".assistant-message-metadata time").exists()).toBe(true);
    }

    const clarification = wrapper.get('[data-testid="assistant-clarification-message"]');
    expect(clarification.findAll(".assistant-product-state-hint")).toHaveLength(1);
    expect(clarification.text().split("請直接在下方補充資訊").length - 1).toBe(1);
    expect(wrapper.get('[data-testid="assistant-no-answer-message"] [data-testid="assistant-no-answer-hint"]').text()).toBe("可補充資料名稱、時間或範圍後重新查詢。");
    expect(wrapper.get('[data-testid="assistant-permission-denied-hint"]').text()).toBe("請確認目前帳號的存取範圍。");
    const streaming = wrapper.findAll('[data-testid="assistant-no-answer-message"]')[1]!;
    expect(streaming.find('[data-testid="assistant-streaming-content"]').exists()).toBe(false);
    expect(streaming.get('[data-testid="assistant-no-answer-content"]').text()).toBe("目前無法安全回答這個問題。");
    expect(streaming.text().split("目前無法安全回答這個問題。").length - 1).toBe(1);
    expect(wrapper.findAll('[data-testid="assistant-no-answer-detail"]')).toHaveLength(0);
    const answered = wrapper.get('[data-testid="assistant-ai-message"]');
    expect(answered.get(".assistant-message-bubble--assistant").text()).toContain("正式回答內容");
    expect(answered.get('[data-testid="assistant-evidence-ref"]').text()).toContain("資料來源");
    expect(answered.get('[data-testid="assistant-feedback-controls"]').exists()).toBe(true);
  });

  it("shows one Stop in the composer only while the active reply can be cancelled", async () => {
    const harness = createPanelHarness();
    harness.callbacks.cancelStreaming = vi.fn(async () => {
      harness.controller.markStreamingCancelled();
      harness.controller.clearStreamingState();
    });
    const wrapper = mountPanel(harness);
    expect(wrapper.find('[data-testid="assistant-chat-submit"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="assistant-chat-cancel"]').exists()).toBe(false);

    harness.controller.appendAssistantStreamingPlaceholder({
      key: "stream:stop",
      kind: "assistant_streaming",
      requestId: "request:stop",
      messageId: null,
      role: "assistant",
      content: "",
      createdAt: "2026-07-27T00:00:00.000Z",
      status: "sending",
      lastSequence: null,
      evidence: [],
      activities: [],
    });
    harness.controller.setStreamingRequest("request:stop", "stream:stop");
    harness.controller.markStreamingStarted();
    await wrapper.vm.$nextTick();

    const stop = wrapper.get('[data-testid="assistant-chat-input-bar"] [data-testid="assistant-chat-cancel"]');
    expect(wrapper.findAll('[data-testid="assistant-chat-cancel"]')).toHaveLength(1);
    expect(wrapper.find('.assistant-message-bubble [data-testid="assistant-chat-cancel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-typing-indicator"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="assistant-chat-submit"]').exists()).toBe(false);
    await stop.trigger("click");
    await wrapper.vm.$nextTick();

    expect(harness.callbacks.cancelStreaming).toHaveBeenCalledOnce();
    expect(harness.callbacks.cancelStreaming).toHaveBeenCalledWith("request:stop");
    expect(wrapper.find('[data-testid="assistant-typing-indicator"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-chat-cancel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-chat-submit"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="assistant-interrupted-message"]').exists()).toBe(true);

    harness.controller.appendAssistantStreamingPlaceholder({
      key: "stream:failed",
      kind: "assistant_streaming",
      requestId: "request:failed",
      messageId: null,
      role: "assistant",
      content: "",
      createdAt: "2026-07-27T00:01:00.000Z",
      status: "sending",
      lastSequence: null,
      evidence: [],
      activities: [],
    });
    harness.controller.setStreamingRequest("request:failed", "stream:failed");
    harness.controller.markStreamingStarted();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="assistant-chat-cancel"]').exists()).toBe(true);
    harness.controller.markStreamingFailed();
    harness.controller.clearStreamingState();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="assistant-chat-cancel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-chat-submit"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="assistant-typing-indicator"]').exists()).toBe(false);
  });

  it("ignores repeated Stop clicks and shows Send once the reply is finalizing", async () => {
    const harness = createPanelHarness();
    const finishStops: Array<() => void> = [];
    harness.callbacks.cancelStreaming = vi.fn(() => new Promise<void>((resolve) => {
      finishStops.push(resolve);
    }));
    harness.controller.appendAssistantStreamingPlaceholder({
      key: "stream:race",
      kind: "assistant_streaming",
      requestId: "request:race",
      messageId: null,
      role: "assistant",
      content: "partial",
      createdAt: "2026-07-27T00:00:00.000Z",
      status: "sending",
      lastSequence: null,
      evidence: [],
      activities: [],
    });
    harness.controller.setStreamingRequest("request:race", "stream:race");
    harness.controller.markStreamingStarted();
    const wrapper = mountPanel(harness);

    const stop = wrapper.get('[data-testid="assistant-chat-cancel"]');
    await stop.trigger("click");
    await stop.trigger("click");
    expect(harness.callbacks.cancelStreaming).toHaveBeenCalledOnce();
    expect(stop.attributes("disabled")).toBeDefined();
    harness.controller.markStreamingFinalizing();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="assistant-chat-cancel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-chat-submit"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="assistant-chat-submit"]').attributes("disabled")).toBeDefined();
    harness.controller.clearStreamingState();
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="assistant-chat-submit"]').attributes("disabled")).toBeUndefined();

    harness.controller.appendAssistantStreamingPlaceholder({
      key: "stream:next",
      kind: "assistant_streaming",
      requestId: "request:next",
      messageId: null,
      role: "assistant",
      content: "",
      createdAt: "2026-07-27T00:01:00.000Z",
      status: "sending",
      lastSequence: null,
      evidence: [],
      activities: [],
    });
    harness.controller.setStreamingRequest("request:next", "stream:next");
    harness.controller.markStreamingStarted();
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="assistant-chat-cancel"]').attributes("disabled")).toBeUndefined();
    await wrapper.get('[data-testid="assistant-chat-cancel"]').trigger("click");
    expect(harness.callbacks.cancelStreaming).toHaveBeenNthCalledWith(2, "request:next");
    finishStops.forEach(resolve => resolve());
  });

  it("does not submit IME confirmation Enter and preserves normal composer submission", async () => {
    const harness = createPanelHarness();
    const wrapper = mountPanel(harness);
    const input = wrapper.get('[data-testid="assistant-chat-input"]');

    for (const text of ["這週", "這週新增多少工單"]) {
      await input.trigger("compositionstart");
      await input.setValue(text);
      await input.trigger("keydown", { key: "Enter", isComposing: true, keyCode: 229 });
      await input.trigger("compositionend");
      await input.trigger("keydown", { key: "Enter" });
      expect(harness.callbacks.sendMessage).not.toHaveBeenCalled();
      expect((input.element as HTMLTextAreaElement).value).toBe(text);
      await input.trigger("keyup", { key: "Enter" });
    }

    await input.trigger("keydown", { key: "Enter" });
    expect(harness.callbacks.sendMessage).toHaveBeenCalledExactlyOnceWith("這週新增多少工單");

    await input.setValue("English message");
    await input.trigger("keydown", { key: "Enter", shiftKey: true });
    expect(harness.callbacks.sendMessage).toHaveBeenCalledTimes(1);
    await input.trigger("keydown", { key: "Enter" });
    expect(harness.callbacks.sendMessage).toHaveBeenNthCalledWith(2, "English message");

    await input.setValue("   ");
    await input.trigger("keydown", { key: "Enter" });
    expect(harness.callbacks.sendMessage).toHaveBeenCalledTimes(2);
    await input.setValue("點擊送出");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    expect(harness.callbacks.sendMessage).toHaveBeenNthCalledWith(3, "點擊送出");
  });
});

function mountPanel(harness: ReturnType<typeof createPanelHarness>) {
  return mount(AssistantProductRuntimePanel, {
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
    global: { plugins: [harness.pinia] },
  });
}

function wrapperSource(): string {
  return readFileSync(
    join(process.cwd(), "packages/assistant-runtime/src/components/product-ui/AssistantProductRuntimePanel.vue"),
    "utf8",
  );
}
