import { createPinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSdkRuntimeAdapter } from "../../../packages/assistant-sdk/src/runtime/sdkRuntimeAdapter";

/** Frontend 003 Phase 1 (T009): open a session picked from the session list. */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status,
});
const history = {
  sessionId: "session-old",
  messages: [{ messageId: "m-1", role: "user", content: "查詢訂單 SO-10001 狀態", createdAt: "2026-11-16T02:00:00.000Z" }],
  nextCursor: null,
};

function setup(routes: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => routes(String(input), init));
  vi.stubGlobal("fetch", fetchMock);
  const onSessionChanged = vi.fn();
  const adapter = createSdkRuntimeAdapter({
    callbacks: { onSessionChanged },
    pinia: createPinia(),
    provider: async () => ({ hostApp: "sdk-restore-from-list" }),
    runtimeScope: `sdk-restore-from-list:${Math.random()}`,
  });
  return { adapter, fetchMock, onSessionChanged };
}

afterEach(() => vi.unstubAllGlobals());

describe("restore a session from the session list (Frontend 003)", () => {
  it("validates, clears through the hook, loads history and reports the change", async () => {
    const { adapter, fetchMock, onSessionChanged } = setup((url, init) => {
      if (init?.method === "POST") return json({ data: { sessionId: "session-current", status: "active" } }, 201);
      if (url.endsWith("/sessions/session-old")) return json({ data: { sessionId: "session-old", status: "active" } });
      if (url.endsWith("/sessions/session-old/messages")) return json({ data: history });
      return json({}, 500);
    });
    await adapter.bootstrapSession();
    const beforeApply = vi.fn();

    await expect(adapter.restoreSession("session-old", { beforeApply })).resolves.toEqual({ ok: true, sessionId: "session-old" });

    expect(beforeApply).toHaveBeenCalledTimes(1);
    expect(adapter.controller.stores.session.sessionId.value).toBe("session-old");
    expect(adapter.controller.stores.session.messages.value).toEqual([expect.objectContaining({ messageId: "m-1" })]);
    expect(onSessionChanged).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "session-old" }));
    expect(fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url)}`)).toEqual([
      "POST /api/v1/assistant/sessions",
      "GET /api/v1/assistant/sessions/session-old",
      "GET /api/v1/assistant/sessions/session-old/messages",
    ]);
  });

  it("leaves the current conversation untouched when the session cannot be opened", async () => {
    const { adapter } = setup((url, init) => {
      if (init?.method === "POST") return json({ data: { sessionId: "session-current", status: "active" } }, 201);
      return json({ error: { code: "NOT_FOUND" } }, 404);
    });
    await adapter.bootstrapSession();
    const beforeApply = vi.fn();

    const result = await adapter.restoreSession("session-gone", { beforeApply });

    expect(result.ok).toBe(false);
    expect(beforeApply).not.toHaveBeenCalled();
    expect(adapter.controller.stores.session.sessionId.value).toBe("session-current");
  });

  it("rejects a blank session ID without any request", async () => {
    const { adapter, fetchMock } = setup(() => json({}, 500));
    expect((await adapter.restoreSession("  ")).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
