import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import AssistantProductRuntimePanel from "../../../packages/assistant-runtime/src/components/product-ui/AssistantProductRuntimePanel.vue";
import {
  createAssistantGreetingMessage,
  createAssistantRuntimeController,
  createAssistantRuntimeStores,
  type AssistantRuntimeTransportPort,
} from "../../../packages/assistant-runtime/src";

/** Frontend 003 Phase 2 (T013): greeting, choice chips and the unavailable-choice notice in the product panel. */
const opening = {
  configVersion: "1.0.0",
  greeting: "你好，我可以協助查詢訂單資訊。",
  quickReplies: [{ id: "overview", label: "你能查詢哪些資料？" }, { id: "order-status-10001", label: "訂單 SO-10001 的狀態" }],
};

function mountPanel(messages: Array<Record<string, unknown>>, options: { withChoices?: boolean; composerCanSend?: boolean; streaming?: string } = {}) {
  const pinia = createPinia();
  const runtimeScope = `panel-suggestions:${Math.random()}`;
  const stores = createAssistantRuntimeStores<Record<string, unknown>>({ pinia, runtimeScope });
  const controller = createAssistantRuntimeController<Record<string, unknown>>({ runtimeScope, stores, transport: {} as AssistantRuntimeTransportPort });
  controller.setContextReady(true);
  controller.setReady();
  controller.setMessages(messages as never, null);
  if (options.streaming) controller.setStreamingRequest("r-active", options.streaming);
  const choose = vi.fn();
  const wrapper = mount(AssistantProductRuntimePanel, {
    props: {
      controller: controller as never,
      runtimeScope,
      composerCanSend: options.composerCanSend ?? true,
      onSendMessage: vi.fn(), onLoadMoreHistory: vi.fn(), onCancelStreaming: vi.fn(), onSubmitFeedback: vi.fn(),
      onConfirmActionDraft: vi.fn(), onCancelActionDraft: vi.fn(), onOpenApprovalDetail: vi.fn(),
      ...(options.withChoices === false ? {} : { onChooseSuggestion: choose }),
    },
    global: { plugins: [pinia] },
  });
  return { choose, wrapper };
}

const greeting = () => createAssistantGreetingMessage("s-1", opening, "2026-11-16T00:00:00.000Z") as unknown as Record<string, unknown>;
const completedAnswer = (suggestions?: unknown) => ({ key: "a-1", kind: "assistant_streaming", role: "assistant", status: "completed",
  content: "SO-10001 目前狀態為 picking。", createdAt: "2026-11-16T00:00:02.000Z", evidence: [], lastSequence: 3,
  finalAnswerDecision: "answered", messageId: "m-1", ...(suggestions ? { suggestions } : {}) });
const user = (extra: Record<string, unknown> = {}) => ({ key: "local-user:r-1", kind: "user", role: "user",
  content: "訂單 SO-10001 的狀態", createdAt: "2026-11-16T00:00:01.000Z", ...extra });

describe("product panel choices (Frontend 003)", () => {
  it("shows the greeting as an assistant message with its Quick Replies, without feedback controls", () => {
    const { wrapper } = mountPanel([greeting()]);
    const message = wrapper.get("[data-testid='assistant-greeting-message']");
    expect(message.text()).toContain(opening.greeting);
    expect(wrapper.find("[data-testid='assistant-feedback-controls']").exists()).toBe(false);
    const group = wrapper.get("[data-testid='assistant-suggestions']");
    expect(group.attributes("role")).toBe("group");
    expect(group.attributes("aria-label")).toBe("建議問題");
    expect(wrapper.findAll("[data-testid='assistant-suggestion']").map((chip) => chip.text())).toEqual(["你能查詢哪些資料？", "訂單 SO-10001 的狀態"]);
  });

  it("places the choices inside the message, after the reply and the time", () => {
    const { wrapper } = mountPanel([greeting()]);
    const frame = wrapper.get("[data-testid='assistant-greeting-message']").element;
    const choices = frame.querySelector("[data-testid='assistant-suggestions']");
    const time = frame.querySelector("[data-testid='assistant-message-timestamp']");
    const reply = frame.querySelector("p");
    expect(choices).not.toBeNull();
    expect(time).not.toBeNull();
    expect(reply!.compareDocumentPosition(choices!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(time!.compareDocumentPosition(choices!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reports the clicked choice", async () => {
    const { choose, wrapper } = mountPanel([greeting()]);
    await wrapper.findAll("[data-testid='assistant-suggestion']")[1].trigger("click");
    expect(choose).toHaveBeenCalledWith({ id: "order-status-10001", label: "訂單 SO-10001 的狀態" });
  });

  it("hides older choices once a newer message exists and shows suggestions under the latest answer", () => {
    const { wrapper } = mountPanel([greeting(), user(), completedAnswer([{ id: "follow-order-10002", label: "看 SO-10002" }])]);
    const chips = wrapper.findAll("[data-testid='assistant-suggestion']");
    expect(chips.map((chip) => chip.text())).toEqual(["看 SO-10002"]);
    expect(wrapper.findAll("[data-testid='assistant-suggestions']")).toHaveLength(1);
  });

  it("shows no choices when the latest message is the user's or an answer without suggestions", () => {
    expect(mountPanel([greeting(), user()]).wrapper.find("[data-testid='assistant-suggestions']").exists()).toBe(false);
    expect(mountPanel([greeting(), user(), completedAnswer()]).wrapper.find("[data-testid='assistant-suggestions']").exists()).toBe(false);
  });

  it("disables choices while the composer cannot send and does not report clicks", async () => {
    const { choose, wrapper } = mountPanel([greeting()], { composerCanSend: false });
    const chip = wrapper.get("[data-testid='assistant-suggestion']");
    expect(chip.attributes("disabled")).toBeDefined();
    await chip.trigger("click");
    expect(choose).not.toHaveBeenCalled();
  });

  it("shows no choices when the host passes no choice handler", () => {
    expect(mountPanel([greeting()], { withChoices: false }).wrapper.find("[data-testid='assistant-suggestions']").exists()).toBe(false);
  });

  it("shows the unavailable-choice notice under the user's message", () => {
    const { wrapper } = mountPanel([greeting(), user({ notice: "這個選項目前無法使用，請直接輸入問題。" })]);
    const notice = wrapper.get("[data-testid='assistant-choice-unavailable']");
    expect(notice.text()).toBe("這個選項目前無法使用，請直接輸入問題。");
    expect(notice.attributes("role")).toBe("status");
    expect(wrapper.get("[data-testid='assistant-user-message']").element.contains(notice.element)).toBe(true);
  });
});
