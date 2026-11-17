import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssistantWidget from "../../../packages/assistant-sdk/src/components/AssistantWidget.vue";

/** Frontend 003 Phase 3 (T020, T021): session list, restore, archive, archived view and delete through the mounted SDK widget. */
const opening = { configVersion: "1.0.0", greeting: "你好，我可以協助查詢訂單資訊。", quickReplies: [{ id: "overview", label: "你能查詢哪些資料？" }] };
const entry = (sessionId: string, title: string | null) =>
  ({ sessionId, title, createdAt: "2026-11-15T02:00:00.000Z", lastMessageAt: "2026-11-15T02:05:00.000Z" });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type ServerOptions = { firstPageCursor?: string | null; staleCursor?: boolean; failGet?: string[]; archiveStatus?: number;
  deleteStatus?: number; unarchiveStatus?: number };

function setup(options: ServerOptions = {}) {
  let created = 0;
  const calls: string[] = [];
  const archived = new Set<string>(["session-archived-1"]);
  const deleted = new Set<string>();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "https://host.test");
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/api\/v1/, "");
    calls.push(`${method} ${path}${url.search}`);

    if (method === "POST" && path === "/assistant/sessions") {
      created += 1;
      return json({ data: { sessionId: `session-new-${created}`, status: "active", opening } }, 201);
    }
    if (method === "GET" && path === "/assistant/sessions") {
      const cursor = url.searchParams.get("cursor");
      if (cursor === "stale") return json({ error: { code: "BAD_REQUEST" } }, 400);
      if (cursor === "page-2") return json({ data: { sessions: [entry("session-old-3", "第三段")], nextCursor: null } });
      if (url.searchParams.get("status") === "archived") {
        return json({ data: { sessions: [entry("session-archived-1", "已封存的對話"), entry("session-old-1", "查詢訂單 SO-10001 狀態"),
          entry("session-old-2", null)].filter(item => archived.has(item.sessionId) && !deleted.has(item.sessionId)), nextCursor: null } });
      }
      const current = `session-new-${created}`;
      return json({ data: {
        sessions: [entry(current, "目前的對話"), entry("session-old-1", "查詢訂單 SO-10001 狀態"), entry("session-old-2", null),
          entry("session-archived-1", "已封存的對話")]
          .filter(item => !archived.has(item.sessionId) && !deleted.has(item.sessionId)),
        nextCursor: options.staleCursor ? "stale" : options.firstPageCursor ?? null,
      } });
    }
    const unarchiveMatch = /^\/assistant\/sessions\/([^/]+)\/unarchive$/.exec(path);
    if (method === "POST" && unarchiveMatch) {
      if (options.unarchiveStatus && options.unarchiveStatus !== 200) return json({ error: { code: "X" } }, options.unarchiveStatus);
      archived.delete(decodeURIComponent(unarchiveMatch[1]));
      return json({ data: { sessionId: unarchiveMatch[1], status: "active" } });
    }
    const deleteMatch = /^\/assistant\/sessions\/([^/]+)$/.exec(path);
    if (method === "DELETE" && deleteMatch) {
      if (options.deleteStatus && options.deleteStatus !== 200) return json({ error: { code: "X" } }, options.deleteStatus);
      deleted.add(decodeURIComponent(deleteMatch[1]));
      return json({ data: { sessionId: deleteMatch[1], status: "deleted" } });
    }
    const archiveMatch = /^\/assistant\/sessions\/([^/]+)\/archive$/.exec(path);
    if (method === "POST" && archiveMatch) {
      if (options.archiveStatus && options.archiveStatus !== 200) return json({ error: { code: "X" } }, options.archiveStatus);
      archived.add(decodeURIComponent(archiveMatch[1]));
      return json({ data: { sessionId: archiveMatch[1], status: "closed" } });
    }
    const historyMatch = /^\/assistant\/sessions\/([^/]+)\/messages$/.exec(path);
    if (method === "GET" && historyMatch) {
      return json({ data: { sessionId: historyMatch[1], nextCursor: null, messages: [
        { messageId: `m-${historyMatch[1]}`, role: "user", content: `${historyMatch[1]} 的問題`, createdAt: "2026-11-15T02:00:00.000Z" }] } });
    }
    const sessionMatch = /^\/assistant\/sessions\/([^/]+)$/.exec(path);
    if (method === "GET" && sessionMatch) {
      const id = decodeURIComponent(sessionMatch[1]);
      if (options.failGet?.includes(id)) return json({ error: { code: "X" } }, 500);
      return json({ data: { sessionId: id, status: "active" } });
    }
    return json({ error: { code: "unexpected" } }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
  const wrapper = mount(AssistantWidget, { props: { provider: async () => ({ hostApp: "sdk-f003-history" }) }, attachTo: document.body });
  return { calls, wrapper };
}

async function openWidget(wrapper: ReturnType<typeof mount>) {
  await wrapper.get("[data-assistant-launcher]").trigger("click");
  await flushPromises();
}

async function openHistory(wrapper: ReturnType<typeof mount>) {
  await wrapper.get("[data-testid='assistant-panel-history']").trigger("click");
  await flushPromises();
}

const items = (wrapper: ReturnType<typeof mount>) => wrapper.findAll("[data-testid='assistant-session-list-item']");
const itemIds = (wrapper: ReturnType<typeof mount>) => items(wrapper).map(item => item.attributes("data-session-id"));
const item = (wrapper: ReturnType<typeof mount>, id: string) => items(wrapper).find(candidate => candidate.attributes("data-session-id") === id)!;

afterEach(() => vi.unstubAllGlobals());

describe("SDK widget session history (Frontend 003)", () => {
  it("opens the list from the header, marks the current session and returns to the conversation", async () => {
    const { calls, wrapper } = setup();
    await openWidget(wrapper);
    await openHistory(wrapper);

    expect(calls).toContain("GET /assistant/sessions?limit=20");
    expect(itemIds(wrapper)).toEqual(["session-new-1", "session-old-1", "session-old-2"]);
    expect(item(wrapper, "session-new-1").attributes("data-current")).toBe("true");
    expect(wrapper.find("[data-testid='assistant-chat-input']").isVisible()).toBe(false);

    await wrapper.get("[data-testid='assistant-panel-back']").trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-testid='assistant-session-list']").exists()).toBe(false);
    expect(wrapper.get("[data-testid='assistant-greeting-message']").text()).toContain(opening.greeting);
    wrapper.unmount();
  });

  it("loads the next page and restarts from the first page once on an expired cursor", async () => {
    const paged = setup({ firstPageCursor: "page-2" });
    await openWidget(paged.wrapper);
    await openHistory(paged.wrapper);
    await paged.wrapper.get("[data-testid='assistant-session-list-more']").trigger("click");
    await flushPromises();
    expect(itemIds(paged.wrapper)).toEqual(["session-new-1", "session-old-1", "session-old-2", "session-old-3"]);
    expect(paged.wrapper.find("[data-testid='assistant-session-list-more']").exists()).toBe(false);
    paged.wrapper.unmount();
    vi.unstubAllGlobals();

    const stale = setup({ staleCursor: true });
    await openWidget(stale.wrapper);
    await openHistory(stale.wrapper);
    await stale.wrapper.get("[data-testid='assistant-session-list-more']").trigger("click");
    await flushPromises();
    expect(stale.calls.filter(call => call.startsWith("GET /assistant/sessions?"))).toEqual([
      "GET /assistant/sessions?limit=20", "GET /assistant/sessions?limit=20&cursor=stale", "GET /assistant/sessions?limit=20"]);
    expect(stale.wrapper.find("[data-testid='assistant-session-list-error']").exists()).toBe(false);
    stale.wrapper.unmount();
  });

  it("opens another session, loads its history and returns to the conversation", async () => {
    const { calls, wrapper } = setup();
    await openWidget(wrapper);
    await openHistory(wrapper);

    await item(wrapper, "session-old-1").get("[data-testid='assistant-session-open']").trigger("click");
    await flushPromises();

    expect(calls).toEqual(expect.arrayContaining(["GET /assistant/sessions/session-old-1", "GET /assistant/sessions/session-old-1/messages"]));
    expect(wrapper.find("[data-testid='assistant-session-list']").exists()).toBe(false);
    expect(wrapper.text()).toContain("session-old-1 的問題");
    expect(wrapper.find("[data-testid='assistant-greeting-message']").exists()).toBe(false);
    wrapper.unmount();
  });

  it("stays in the list with an error and keeps the current conversation when a session cannot be opened", async () => {
    const { wrapper } = setup({ failGet: ["session-old-1"] });
    await openWidget(wrapper);
    await openHistory(wrapper);

    await item(wrapper, "session-old-1").get("[data-testid='assistant-session-open']").trigger("click");
    await flushPromises();

    expect(item(wrapper, "session-old-1").get("[data-testid='assistant-session-item-error']").text()).toBe("目前無法開啟這段對話，請稍後再試。");
    await wrapper.get("[data-testid='assistant-panel-back']").trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-testid='assistant-greeting-message']").text()).toContain(opening.greeting);
    wrapper.unmount();
  });

  it("archives another session after confirmation and removes it from the list", async () => {
    const { calls, wrapper } = setup();
    await openWidget(wrapper);
    await openHistory(wrapper);

    await item(wrapper, "session-old-2").get("[data-testid='assistant-session-archive']").trigger("click");
    await wrapper.get("[data-testid='assistant-session-archive-confirm']").trigger("click");
    await flushPromises();

    expect(calls).toContain("POST /assistant/sessions/session-old-2/archive");
    expect(itemIds(wrapper)).toEqual(["session-new-1", "session-old-1"]);
    expect(calls.filter(call => call === "POST /assistant/sessions")).toHaveLength(1);
    wrapper.unmount();
  });

  it("starts a new conversation with its opening after archiving the current one", async () => {
    const { calls, wrapper } = setup();
    await openWidget(wrapper);
    await openHistory(wrapper);

    await item(wrapper, "session-new-1").get("[data-testid='assistant-session-archive']").trigger("click");
    await wrapper.get("[data-testid='assistant-session-archive-confirm']").trigger("click");
    await flushPromises();

    expect(itemIds(wrapper)).toEqual(["session-old-1", "session-old-2"]);
    expect(calls.filter(call => call === "POST /assistant/sessions")).toHaveLength(2);
    await wrapper.get("[data-testid='assistant-panel-back']").trigger("click");
    await flushPromises();
    expect(wrapper.get("[data-testid='assistant-greeting-message']").text()).toContain(opening.greeting);
    wrapper.unmount();
  });

  it("deletes another session after confirmation and keeps the current conversation", async () => {
    const { calls, wrapper } = setup();
    await openWidget(wrapper);
    await openHistory(wrapper);

    await item(wrapper, "session-old-2").get("[data-testid='assistant-session-delete']").trigger("click");
    expect(wrapper.find("[data-testid='assistant-session-delete-confirm']").exists()).toBe(true);
    await wrapper.get("[data-testid='assistant-session-delete-confirm']").trigger("click");
    await flushPromises();

    expect(calls).toContain("DELETE /assistant/sessions/session-old-2");
    expect(itemIds(wrapper)).toEqual(["session-new-1", "session-old-1"]);
    expect(calls.filter(call => call === "POST /assistant/sessions")).toHaveLength(1);
    wrapper.unmount();
  });

  it("starts a new conversation after deleting the current one", async () => {
    const { calls, wrapper } = setup();
    await openWidget(wrapper);
    await openHistory(wrapper);

    await item(wrapper, "session-new-1").get("[data-testid='assistant-session-delete']").trigger("click");
    await wrapper.get("[data-testid='assistant-session-delete-confirm']").trigger("click");
    await flushPromises();

    expect(itemIds(wrapper)).toEqual(["session-old-1", "session-old-2"]);
    expect(calls.filter(call => call === "POST /assistant/sessions")).toHaveLength(2);
    wrapper.unmount();
  });

  it("shows a row error when delete fails and treats 404 as already deleted", async () => {
    const failing = setup({ deleteStatus: 500 });
    await openWidget(failing.wrapper);
    await openHistory(failing.wrapper);
    await item(failing.wrapper, "session-old-2").get("[data-testid='assistant-session-delete']").trigger("click");
    await failing.wrapper.get("[data-testid='assistant-session-delete-confirm']").trigger("click");
    await flushPromises();
    expect(itemIds(failing.wrapper)).toContain("session-old-2");
    expect(item(failing.wrapper, "session-old-2").get("[data-testid='assistant-session-item-error']").text()).toBe("目前無法刪除這段對話，請稍後再試。");
    failing.wrapper.unmount();
    vi.unstubAllGlobals();

    const gone = setup({ deleteStatus: 404 });
    await openWidget(gone.wrapper);
    await openHistory(gone.wrapper);
    await item(gone.wrapper, "session-old-2").get("[data-testid='assistant-session-delete']").trigger("click");
    await gone.wrapper.get("[data-testid='assistant-session-delete-confirm']").trigger("click");
    await flushPromises();
    expect(itemIds(gone.wrapper)).toEqual(["session-new-1", "session-old-1"]);
    gone.wrapper.unmount();
  });

  it("switches to the archived view, unarchives a session and finds it back in the conversation list", async () => {
    const { calls, wrapper } = setup();
    await openWidget(wrapper);
    await openHistory(wrapper);

    await wrapper.get("[data-testid='assistant-session-view-archived']").trigger("click");
    await flushPromises();
    expect(calls).toContain("GET /assistant/sessions?limit=20&status=archived");
    expect(itemIds(wrapper)).toEqual(["session-archived-1"]);
    // Archived rows cannot be opened directly.
    expect(item(wrapper, "session-archived-1").find("[data-testid='assistant-session-open']").exists()).toBe(false);

    await item(wrapper, "session-archived-1").get("[data-testid='assistant-session-unarchive']").trigger("click");
    await flushPromises();
    expect(calls).toContain("POST /assistant/sessions/session-archived-1/unarchive");
    expect(itemIds(wrapper)).toEqual([]);

    await wrapper.get("[data-testid='assistant-session-view-active']").trigger("click");
    await flushPromises();
    expect(itemIds(wrapper)).toEqual(["session-new-1", "session-old-1", "session-old-2", "session-archived-1"]);
    wrapper.unmount();
  });

  it("keeps the archived row with an error when unarchive fails", async () => {
    const { wrapper } = setup({ unarchiveStatus: 500 });
    await openWidget(wrapper);
    await openHistory(wrapper);
    await wrapper.get("[data-testid='assistant-session-view-archived']").trigger("click");
    await flushPromises();

    await item(wrapper, "session-archived-1").get("[data-testid='assistant-session-unarchive']").trigger("click");
    await flushPromises();
    expect(itemIds(wrapper)).toEqual(["session-archived-1"]);
    expect(item(wrapper, "session-archived-1").get("[data-testid='assistant-session-item-error']").text()).toBe("目前無法取消封存這段對話，請稍後再試。");
    wrapper.unmount();
  });

  it("returns to the conversation view each time the list is reopened", async () => {
    const { wrapper } = setup();
    await openWidget(wrapper);
    await openHistory(wrapper);
    await wrapper.get("[data-testid='assistant-session-view-archived']").trigger("click");
    await flushPromises();
    await wrapper.get("[data-testid='assistant-panel-back']").trigger("click");
    await openHistory(wrapper);
    expect(wrapper.get("[data-testid='assistant-session-view-active']").attributes("aria-pressed")).toBe("true");
    expect(itemIds(wrapper)).toEqual(["session-new-1", "session-old-1", "session-old-2"]);
    wrapper.unmount();
  });

  it("treats an already archived session (404) as archived and shows other failures on the row", async () => {
    const gone = setup({ archiveStatus: 404 });
    await openWidget(gone.wrapper);
    await openHistory(gone.wrapper);
    await item(gone.wrapper, "session-old-2").get("[data-testid='assistant-session-archive']").trigger("click");
    await gone.wrapper.get("[data-testid='assistant-session-archive-confirm']").trigger("click");
    await flushPromises();
    expect(itemIds(gone.wrapper)).toEqual(["session-new-1", "session-old-1"]);
    gone.wrapper.unmount();
    vi.unstubAllGlobals();

    const failing = setup({ archiveStatus: 500 });
    await openWidget(failing.wrapper);
    await openHistory(failing.wrapper);
    await item(failing.wrapper, "session-old-2").get("[data-testid='assistant-session-archive']").trigger("click");
    await failing.wrapper.get("[data-testid='assistant-session-archive-confirm']").trigger("click");
    await flushPromises();
    expect(item(failing.wrapper, "session-old-2").get("[data-testid='assistant-session-item-error']").text()).toBe("目前無法封存這段對話，請稍後再試。");
    failing.wrapper.unmount();
  });
});
