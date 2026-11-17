import { createPinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import {
  createAssistantGreetingMessage,
  createAssistantRuntimeController,
  createAssistantRuntimeStores,
  createAssistantStreamingRuntimeMessage,
  createUserRuntimeMessage,
  resolveLatestAssistantChoices,
  withoutAssistantChoice,
  type AssistantRuntimeTransportPort,
} from "../../../packages/assistant-runtime/src";

/** Frontend 003 Phase 2 (T012): greeting, latest-choice rule and rejected choices in the runtime state. */
const opening = {
  configVersion: "1.0.0",
  greeting: "你好，我可以協助查詢訂單資訊。",
  quickReplies: [{ id: "overview", label: "你能查詢哪些資料？" }, { id: "order-status-10001", label: "訂單 SO-10001 的狀態" }],
};

function harness(createValue: Record<string, unknown>) {
  const pinia = createPinia();
  const runtimeScope = `experience-state:${Math.random()}`;
  const stores = createAssistantRuntimeStores<Record<string, unknown>>({ pinia, runtimeScope });
  const transport = {
    createSession: vi.fn(async () => ({ ok: true, value: createValue })),
    cancelMessage: vi.fn(),
    abortMessage: vi.fn(),
  } as unknown as AssistantRuntimeTransportPort;
  const controller = createAssistantRuntimeController<Record<string, unknown>>({ runtimeScope, stores, transport });
  return { controller, messages: () => stores.session.messages.value };
}

function finalEvent(requestId: string, data: Record<string, unknown>) {
  return { requestId, sessionId: "s-1", messageId: `m-${requestId}`, eventType: "final" as const, sequence: 3, data: {
    answerDecision: "answered" as const, answer: "SO-10001 目前狀態為 picking。", evidenceRefs: [], ...data } };
}

describe("conversation experience runtime state (Frontend 003)", () => {
  it("starts a created session with the greeting and its Quick Replies", async () => {
    const { controller, messages } = harness({ sessionId: "s-1", status: "active", opening });
    await controller.createSession({});

    expect(messages()).toEqual([expect.objectContaining({
      key: "local-greeting:s-1", kind: "assistant_greeting", role: "assistant", content: opening.greeting, choices: opening.quickReplies })]);
    expect(resolveLatestAssistantChoices(messages())).toEqual({ messageKey: "local-greeting:s-1", choices: opening.quickReplies });
  });

  it("leaves the message list unchanged without an opening (older backends)", async () => {
    const { controller, messages } = harness({ sessionId: "s-1", status: "active" });
    await controller.createSession({});
    expect(messages()).toEqual([]);
  });

  it("offers choices only under the latest greeting or completed answer", async () => {
    const { controller, messages } = harness({ sessionId: "s-1", status: "active", opening });
    await controller.createSession({});

    controller.appendUserMessage(createUserRuntimeMessage({ requestId: "r-1", content: "訂單 SO-10001 的狀態", createdAt: "2026-11-16T00:00:00.000Z" }));
    expect(resolveLatestAssistantChoices(messages())).toBeNull();

    controller.appendAssistantStreamingPlaceholder(createAssistantStreamingRuntimeMessage({ key: "a-1", requestId: "r-1", createdAt: "2026-11-16T00:00:01.000Z" }));
    controller.setStreamingRequest("r-1", "a-1");
    expect(resolveLatestAssistantChoices(messages())).toBeNull();

    controller.finalizeActiveStreamingMessage(finalEvent("r-1", { suggestions: [{ id: "follow-order-10002", label: "看 SO-10002" }] }) as never);
    expect(resolveLatestAssistantChoices(messages())).toEqual({ messageKey: "a-1", choices: [{ id: "follow-order-10002", label: "看 SO-10002" }] });
  });

  it("offers nothing after a completed answer without suggestions", async () => {
    const { controller, messages } = harness({ sessionId: "s-1", status: "active" });
    await controller.createSession({});
    controller.appendAssistantStreamingPlaceholder(createAssistantStreamingRuntimeMessage({ key: "a-1", requestId: "r-1", createdAt: "2026-11-16T00:00:01.000Z" }));
    controller.setStreamingRequest("r-1", "a-1");
    controller.finalizeActiveStreamingMessage(finalEvent("r-1", {}) as never);
    expect(resolveLatestAssistantChoices(messages())).toBeNull();
  });

  it("drops a rejected choice everywhere and adds a notice to the user's message", async () => {
    const { controller, messages } = harness({ sessionId: "s-1", status: "active", opening });
    await controller.createSession({});
    controller.appendUserMessage(createUserRuntimeMessage({ requestId: "r-1", content: "訂單 SO-10001 的狀態", createdAt: "2026-11-16T00:00:00.000Z" }));

    controller.markChoiceUnavailable("order-status-10001", "local-user:r-1", "這個選項目前無法使用，請直接輸入問題。");

    expect(messages()[0]).toEqual(expect.objectContaining({ choices: [{ id: "overview", label: "你能查詢哪些資料？" }] }));
    expect(messages()[1]).toEqual(expect.objectContaining({ key: "local-user:r-1", notice: "這個選項目前無法使用，請直接輸入問題。" }));
  });

  it("removes a choice from greetings and answers without touching other messages", () => {
    const greeting = createAssistantGreetingMessage("s-1", opening, "2026-11-16T00:00:00.000Z");
    const answer = { key: "a-1", kind: "assistant_streaming", status: "completed", suggestions: [{ id: "overview", label: "x" }] };
    const user = { key: "u-1", kind: "user", content: "hi" };
    const result = withoutAssistantChoice([greeting, answer, user], "overview");
    expect(result[0]).toEqual(expect.objectContaining({ choices: [{ id: "order-status-10001", label: "訂單 SO-10001 的狀態" }] }));
    expect(result[1]).toEqual(expect.objectContaining({ suggestions: [] }));
    expect(result[2]).toBe(user);
  });
});
