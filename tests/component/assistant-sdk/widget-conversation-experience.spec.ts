import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssistantWidget from "../../../packages/assistant-sdk/src/components/AssistantWidget.vue";
import { createCanonicalSseResponse } from "../../fixtures/assistant-sdk/canonical-sse-outcome-adapter";

/** Frontend 003 Phase 2 (T014, T015): opening, Quick Replies and suggestions through the mounted SDK widget. */
const opening = {
  configVersion: "1.0.0",
  greeting: "你好，我可以協助查詢訂單資訊。",
  quickReplies: [{ id: "overview", label: "你能查詢哪些資料？" }, { id: "order-status-10001", label: "訂單 SO-10001 的狀態" }],
};

function answerStream(requestId: string, suggestions?: unknown) {
  const base = { requestId, sessionId: "session-f003", messageId: `message-${requestId}` };
  return createCanonicalSseResponse({
    name: "completed-answer",
    terminationMode: "final",
    expectedText: /picking/,
    events: [
      { ...base, eventType: "answer_delta", sequence: 1, data: { delta: "SO-10001 目前狀態為 picking。" } },
      { ...base, eventType: "final", sequence: 2, data: { answerDecision: "answered", answer: "SO-10001 目前狀態為 picking。",
        evidenceRefs: [], ...(suggestions ? { suggestions } : {}) } },
    ],
  });
}

type Route = (body: Record<string, unknown>) => Response;

function setup(streams: Route[], createOpening: unknown = opening) {
  const bodies: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST" && /\/assistant\/sessions\/?$/.test(url)) {
      return new Response(JSON.stringify({ data: { sessionId: "session-f003", status: "active",
        ...(createOpening ? { opening: createOpening } : {}) } }), { status: 201, headers: { "content-type": "application/json" } });
    }
    if (init?.method === "POST" && url.endsWith("/messages")) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      bodies.push(body);
      const route = streams.shift();
      return route ? route(body) : new Response(null, { status: 500 });
    }
    return new Response(JSON.stringify({ error: { code: "unexpected" } }), { status: 500 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const wrapper = mount(AssistantWidget, { props: { provider: async () => ({ hostApp: "sdk-f003-experience" }) } });
  return { bodies, wrapper };
}

async function open(wrapper: ReturnType<typeof mount>) {
  await wrapper.get("[data-assistant-launcher]").trigger("click");
  await flushPromises();
}

const chips = (wrapper: ReturnType<typeof mount>) => wrapper.findAll("[data-testid='assistant-suggestion']").map((chip) => chip.text());

afterEach(() => vi.unstubAllGlobals());

describe("SDK widget conversation experience (Frontend 003)", () => {
  it("shows the greeting and Quick Replies when a session is created", async () => {
    const { wrapper } = setup([]);
    await open(wrapper);
    expect(wrapper.get("[data-testid='assistant-greeting-message']").text()).toContain(opening.greeting);
    expect(chips(wrapper)).toEqual(["你能查詢哪些資料？", "訂單 SO-10001 的狀態"]);
  });

  it("sends a clicked choice by ID, shows its label, then offers the answer's suggestions", async () => {
    const { bodies, wrapper } = setup([() => answerStream("r-choice", [{ id: "follow-order-10002", label: "看 SO-10002" }])]);
    await open(wrapper);

    await wrapper.findAll("[data-testid='assistant-suggestion']")[1].trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("SO-10001 目前狀態為 picking。"));
    await flushPromises();

    expect(bodies).toHaveLength(1);
    expect(bodies[0].choiceId).toBe("order-status-10001");
    expect(bodies[0]).not.toHaveProperty("message");
    expect(wrapper.findAll("[data-testid='assistant-user-bubble']").map((bubble) => bubble.text())).toEqual(["訂單 SO-10001 的狀態"]);
    expect(chips(wrapper)).toEqual(["看 SO-10002"]);
  });

  it("hides the suggestions once the user sends a typed message", async () => {
    const { bodies, wrapper } = setup([
      () => answerStream("r-1", [{ id: "follow-order-10002", label: "看 SO-10002" }]),
      () => answerStream("r-2"),
    ]);
    await open(wrapper);
    await wrapper.findAll("[data-testid='assistant-suggestion']")[1].trigger("click");
    await vi.waitFor(() => expect(chips(wrapper)).toEqual(["看 SO-10002"]));

    await wrapper.get("[data-testid='assistant-chat-input']").setValue("請再查一次");
    await wrapper.get("[data-testid='assistant-chat-submit']").trigger("click");
    await vi.waitFor(() => expect(bodies).toHaveLength(2));
    await flushPromises();

    expect(bodies[1]).toEqual(expect.objectContaining({ message: "請再查一次" }));
    expect(bodies[1]).not.toHaveProperty("choiceId");
    expect(wrapper.find("[data-testid='assistant-suggestions']").exists()).toBe(false);
  });

  it("removes a rejected choice and explains it without failing the conversation", async () => {
    const { wrapper } = setup([() => new Response(JSON.stringify({ error: { code: "EXPERIENCE_CHOICE_UNAVAILABLE" } }), { status: 409 })]);
    await open(wrapper);

    await wrapper.findAll("[data-testid='assistant-suggestion']")[1].trigger("click");
    await vi.waitFor(() => expect(wrapper.find("[data-testid='assistant-choice-unavailable']").exists()).toBe(true));

    expect(wrapper.get("[data-testid='assistant-choice-unavailable']").text()).toBe("這個選項目前無法使用，請直接輸入問題。");
    expect(chips(wrapper)).toEqual(["你能查詢哪些資料？"]);
    expect(wrapper.text()).not.toContain("回覆失敗");
    expect(wrapper.find("[data-testid='assistant-typing-indicator']").exists()).toBe(false);
    expect(wrapper.get("[data-testid='assistant-chat-submit']").attributes("disabled")).toBeUndefined();
  });

  it("keeps the previous empty state for a backend without an opening", async () => {
    const { wrapper } = setup([], null);
    await open(wrapper);
    expect(wrapper.find("[data-testid='assistant-greeting-message']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='assistant-suggestions']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='assistant-message-empty']").exists()).toBe(true);
  });
});
