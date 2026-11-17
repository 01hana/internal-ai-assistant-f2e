import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssistantWidget from "../../../packages/assistant-sdk/src/components/AssistantWidget.vue";
import { createCanonicalSseResponse } from "../../fixtures/assistant-sdk/canonical-sse-outcome-adapter";

/**
 * Frontend 003 Phase 4: the whole conversation experience through the mounted SDK widget (T025), and the same
 * widget against a backend from before Backend Feature 013 (T026).
 */
const opening = {
  configVersion: "1.0.0",
  greeting: "你好，我可以協助查詢訂單資訊。",
  quickReplies: [{ id: "overview", label: "你能查詢哪些資料？" }, { id: "order-status-10001", label: "訂單 SO-10001 的狀態" }],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function answer(sessionId: string, requestId: string, text: string, suggestions?: unknown) {
  const base = { requestId, sessionId, messageId: `message-${requestId}` };
  return createCanonicalSseResponse({
    name: "completed-answer",
    terminationMode: "final",
    expectedText: new RegExp(text),
    events: [
      { ...base, eventType: "answer_delta", sequence: 1, data: { delta: text } },
      { ...base, eventType: "final", sequence: 2, data: { answerDecision: "answered", answer: text, evidenceRefs: [],
        ...(suggestions ? { suggestions } : {}) } },
    ],
  });
}

type Backend = { feature013: boolean };

function setup({ feature013 }: Backend) {
  let created = 0;
  let sent = 0;
  const calls: string[] = [];
  const bodies: Array<Record<string, unknown>> = [];
  const archived = new Set<string>();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "https://host.test");
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/api\/v1/, "");
    calls.push(`${method} ${path}${url.search}`);

    if (method === "POST" && path === "/assistant/sessions") {
      created += 1;
      return json({ data: { sessionId: `session-${created}`, status: "active", ...(feature013 ? { opening } : {}) } }, 201);
    }
    const messages = /^\/assistant\/sessions\/([^/]+)\/messages$/.exec(path);
    if (method === "POST" && messages) {
      const sessionId = decodeURIComponent(messages[1]);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(body);
      sent += 1;
      const requestId = `r-${sent}`;
      if (body.choiceId === "order-status-10001") {
        return answer(sessionId, requestId, "SO-10001 目前狀態為 picking。", [{ id: "follow-order-10002", label: "看 SO-10002" }]);
      }
      if (body.choiceId === "follow-order-10002") return answer(sessionId, requestId, "SO-10002 目前狀態為 delayed。");
      return answer(sessionId, requestId, "目前沒有延遲的訂單。");
    }
    if (!feature013) return json({ error: { code: "NOT_FOUND", message: "Cannot GET" } }, 404);

    if (method === "GET" && path === "/assistant/sessions") {
      return json({ data: { nextCursor: null, sessions: [
        { sessionId: "session-1", title: "訂單 SO-10001 的狀態", createdAt: "2026-11-17T02:00:00.000Z", lastMessageAt: "2026-11-17T02:05:00.000Z" },
        { sessionId: "session-earlier", title: "查詢工單進度", createdAt: "2026-11-16T02:00:00.000Z", lastMessageAt: "2026-11-16T02:05:00.000Z" },
      ].filter((entry) => !archived.has(entry.sessionId)) } });
    }
    if (method === "GET" && messages) {
      return json({ data: { sessionId: messages[1], nextCursor: null, messages: [
        { messageId: "m-earlier-1", role: "user", content: "查詢工單進度", createdAt: "2026-11-16T02:00:00.000Z" },
        { messageId: "m-earlier-2", role: "assistant", content: "工單 WO-001 已完成 80%。", createdAt: "2026-11-16T02:00:05.000Z" },
      ] } });
    }
    const archive = /^\/assistant\/sessions\/([^/]+)\/archive$/.exec(path);
    if (method === "POST" && archive) {
      archived.add(decodeURIComponent(archive[1]));
      return json({ data: { sessionId: archive[1], status: "closed" } });
    }
    const session = /^\/assistant\/sessions\/([^/]+)$/.exec(path);
    if (method === "GET" && session) return json({ data: { sessionId: decodeURIComponent(session[1]), status: "active" } });
    return json({ error: { code: "unexpected" } }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
  const wrapper = mount(AssistantWidget, { props: { provider: async () => ({ hostApp: "sdk-f003-acceptance" }) }, attachTo: document.body });
  return { bodies, calls, wrapper };
}

type Wrapper = ReturnType<typeof mount>;
const chips = (wrapper: Wrapper) => wrapper.findAll("[data-testid='assistant-suggestion']").map((chip) => chip.text());
const userBubbles = (wrapper: Wrapper) => wrapper.findAll("[data-testid='assistant-user-bubble']").map((bubble) => bubble.text());
const listIds = (wrapper: Wrapper) => wrapper.findAll("[data-testid='assistant-session-list-item']").map((item) => item.attributes("data-session-id"));
const listItem = (wrapper: Wrapper, id: string) =>
  wrapper.findAll("[data-testid='assistant-session-list-item']").find((item) => item.attributes("data-session-id") === id)!;

async function click(wrapper: Wrapper, selector: string) {
  await wrapper.get(selector).trigger("click");
  await flushPromises();
}

async function choose(wrapper: Wrapper, label: string, expectedText: string) {
  const chip = wrapper.findAll("[data-testid='assistant-suggestion']").find((candidate) => candidate.text() === label);
  expect(chip, `choice ${label}`).toBeDefined();
  await chip!.trigger("click");
  await vi.waitFor(() => expect(wrapper.text()).toContain(expectedText));
  await flushPromises();
}

async function type(wrapper: Wrapper, message: string, expectedText: string) {
  await wrapper.get("[data-testid='assistant-chat-input']").setValue(message);
  await wrapper.get("[data-testid='assistant-chat-submit']").trigger("click");
  await vi.waitFor(() => expect(wrapper.text()).toContain(expectedText));
  await flushPromises();
}

afterEach(() => vi.unstubAllGlobals());

describe("SDK widget conversation experience acceptance (Frontend 003 Phase 4)", () => {
  it("T025: opening → Quick Reply → suggestion → typed question → list → restore → archive → new opening", async () => {
    const { bodies, calls, wrapper } = setup({ feature013: true });
    await click(wrapper, "[data-assistant-launcher]");

    // Opening
    expect(wrapper.get("[data-testid='assistant-greeting-message']").text()).toContain(opening.greeting);
    expect(chips(wrapper)).toEqual(["你能查詢哪些資料？", "訂單 SO-10001 的狀態"]);

    // Quick Reply → answer with a suggestion; suggestion → answer; typed question → answer
    await choose(wrapper, "訂單 SO-10001 的狀態", "SO-10001 目前狀態為 picking。");
    expect(chips(wrapper)).toEqual(["看 SO-10002"]);
    await choose(wrapper, "看 SO-10002", "SO-10002 目前狀態為 delayed。");
    expect(chips(wrapper)).toEqual([]);
    await type(wrapper, "有延遲的訂單嗎？", "目前沒有延遲的訂單。");

    expect(bodies.map(({ choiceId, message }) => choiceId ?? message)).toEqual(["order-status-10001", "follow-order-10002", "有延遲的訂單嗎？"]);
    expect(userBubbles(wrapper)).toEqual(["訂單 SO-10001 的狀態", "看 SO-10002", "有延遲的訂單嗎？"]);

    // List → restore an earlier conversation
    await click(wrapper, "[data-testid='assistant-panel-history']");
    expect(listIds(wrapper)).toEqual(["session-1", "session-earlier"]);
    expect(listItem(wrapper, "session-1").text()).toContain("目前對話");
    await listItem(wrapper, "session-earlier").get("[data-testid='assistant-session-open']").trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-testid='assistant-session-list']").exists()).toBe(false);
    expect(wrapper.text()).toContain("工單 WO-001 已完成 80%。");
    expect(userBubbles(wrapper)).toEqual(["查詢工單進度"]);
    expect(wrapper.find("[data-testid='assistant-greeting-message']").exists()).toBe(false);

    // Archive the restored (current) conversation → a new conversation with its opening
    await click(wrapper, "[data-testid='assistant-panel-history']");
    await listItem(wrapper, "session-earlier").get("[data-testid='assistant-session-archive']").trigger("click");
    await click(wrapper, "[data-testid='assistant-session-archive-confirm']");
    expect(calls).toContain("POST /assistant/sessions/session-earlier/archive");
    expect(listIds(wrapper)).toEqual(["session-1"]);

    await click(wrapper, "[data-testid='assistant-panel-back']");
    expect(calls.filter((call) => call === "POST /assistant/sessions")).toHaveLength(2);
    expect(wrapper.get("[data-testid='assistant-greeting-message']").text()).toContain(opening.greeting);
    expect(chips(wrapper)).toEqual(["你能查詢哪些資料？", "訂單 SO-10001 的狀態"]);
    expect(userBubbles(wrapper)).toEqual([]);
    wrapper.unmount();
  });

  it("T026: against a backend before Feature 013 the conversation is unchanged and history hides itself", async () => {
    const { bodies, wrapper } = setup({ feature013: false });
    await click(wrapper, "[data-assistant-launcher]");

    // No opening: the previous empty state, no greeting, no choices
    expect(wrapper.find("[data-testid='assistant-greeting-message']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='assistant-suggestions']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='assistant-message-empty']").exists()).toBe(true);

    // Typed questions work as before, with no suggestions
    await type(wrapper, "有延遲的訂單嗎？", "目前沒有延遲的訂單。");
    expect(bodies).toEqual([expect.objectContaining({ message: "有延遲的訂單嗎？" })]);
    expect(bodies[0]).not.toHaveProperty("choiceId");
    expect(wrapper.find("[data-testid='assistant-suggestions']").exists()).toBe(false);

    // The list answers 404: back to the same conversation, and the history entry is gone
    await click(wrapper, "[data-testid='assistant-panel-history']");
    expect(wrapper.find("[data-testid='assistant-session-list-error']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='assistant-panel-history']").exists()).toBe(false);
    expect(wrapper.text()).toContain("目前沒有延遲的訂單。");
    expect(userBubbles(wrapper)).toEqual(["有延遲的訂單嗎？"]);
    wrapper.unmount();
  });
});
