import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultTransport } from "../../../packages/assistant-sdk/src/transport/defaultTransport";
import {
  supportsAssistantRuntimeSessionHistory,
  type AssistantRuntimeSessionHistoryCapability,
} from "../../../packages/assistant-runtime/src/transport/ports";

function withHistory<T extends object>(transport: T): T & AssistantRuntimeSessionHistoryCapability {
  if (!supportsAssistantRuntimeSessionHistory(transport as never)) throw new Error("session history capability missing");
  return transport as T & AssistantRuntimeSessionHistoryCapability;
}

/** Frontend 003 Phase 1 (T007): Backend Feature 013 routes in the built-in transports. */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status,
});
const page = {
  sessions: [{ sessionId: "s-1", title: "查詢訂單 SO-10001 狀態", createdAt: "2026-11-16T02:00:00.000Z", lastMessageAt: "2026-11-16T02:05:00.000Z" }],
  nextCursor: "eyJ0IjoiMjAyNiJ9",
};

afterEach(() => vi.unstubAllGlobals());

describe("default transport conversation experience (Frontend 003)", () => {
  it("exposes session history only for Compatibility Mode and Gateway-v1", () => {
    expect(supportsAssistantRuntimeSessionHistory(createDefaultTransport() as never)).toBe(true);
    expect(supportsAssistantRuntimeSessionHistory(createDefaultTransport({ integrationMode: "gateway-v1" }) as never)).toBe(true);
    expect(supportsAssistantRuntimeSessionHistory(createDefaultTransport({ integrationMode: "backend002" }) as never)).toBe(false);
  });

  describe("Gateway-v1", () => {
    function setup(responses: Response[]) {
      const fetchMock = vi.fn(async () => responses.shift() ?? json({}, 500));
      vi.stubGlobal("fetch", fetchMock);
      const getAccessToken = vi.fn(async () => "token-A");
      const transport = withHistory(createDefaultTransport({ apiBaseUrl: "http://localhost:4000/api/v1/", getAccessToken, integrationMode: "gateway-v1" }));
      return { fetchMock, getAccessToken, transport };
    }

    it("lists sessions with only limit and cursor and a request-scoped credential", async () => {
      const { fetchMock, transport } = setup([json({ requestId: "r", data: page })]);
      const result = await transport.listSessions({ limit: 20, cursor: page.nextCursor });

      expect(result).toEqual({ ok: true, value: page });
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe(`http://localhost:4000/api/v1/assistant/sessions?limit=20&cursor=${page.nextCursor}`);
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
      const headers = new Headers(init.headers);
      expect(headers.get("authorization")).toBe("Bearer token-A");
      for (const name of ["x-actor-id", "x-organization-id", "x-host-app", "x-customer-id", "content-type"]) {
        expect(headers.get(name)).toBeNull();
      }
    });

    it("lists the first page without a query string", async () => {
      const { fetchMock, transport } = setup([json({ data: { sessions: [], nextCursor: null } })]);
      expect(await transport.listSessions({})).toEqual({ ok: true, value: { sessions: [], nextCursor: null } });
      expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toBe("http://localhost:4000/api/v1/assistant/sessions");
    });

    it("archives with POST, an encoded session ID and no body", async () => {
      const { fetchMock, transport } = setup([json({ data: { sessionId: "s/1", status: "closed" } })]);
      expect(await transport.archiveSession({ sessionId: "s/1" })).toEqual({ ok: true, value: { sessionId: "s/1", status: "closed" } });
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("http://localhost:4000/api/v1/assistant/sessions/s%2F1/archive");
      expect(init.method).toBe("POST");
      expect(init.body).toBeUndefined();
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer token-A");
    });

    it("lists archived sessions with status=archived", async () => {
      const { fetchMock, transport } = setup([json({ data: { sessions: [], nextCursor: null } })]);
      expect(await transport.listSessions({ limit: 20, status: "archived" })).toEqual({ ok: true, value: { sessions: [], nextCursor: null } });
      expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toBe("http://localhost:4000/api/v1/assistant/sessions?limit=20&status=archived");
    });

    it("unarchives with POST and deletes with DELETE, both without a body", async () => {
      const { fetchMock, transport } = setup([
        json({ data: { sessionId: "s/1", status: "active" } }),
        json({ data: { sessionId: "s/1", status: "deleted" } }),
        json({ error: { code: "NOT_FOUND" } }, 404),
        json({ error: { code: "NOT_FOUND" } }, 404),
      ]);
      expect(await transport.unarchiveSession!({ sessionId: "s/1" })).toEqual({ ok: true, value: { sessionId: "s/1", status: "active" } });
      expect(await transport.deleteSession!({ sessionId: "s/1" })).toEqual({ ok: true, value: { sessionId: "s/1", status: "deleted" } });
      expect(await transport.unarchiveSession!({ sessionId: "gone" })).toMatchObject({ ok: false, error: { code: "session_not_found" } });
      expect(await transport.deleteSession!({ sessionId: "gone" })).toMatchObject({ ok: false, error: { code: "session_not_found" } });

      const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
      expect(calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
        "POST http://localhost:4000/api/v1/assistant/sessions/s%2F1/unarchive",
        "DELETE http://localhost:4000/api/v1/assistant/sessions/s%2F1",
        "POST http://localhost:4000/api/v1/assistant/sessions/gone/unarchive",
        "DELETE http://localhost:4000/api/v1/assistant/sessions/gone",
      ]);
      for (const [, init] of calls) {
        expect(init.body).toBeUndefined();
        expect(new Headers(init.headers).get("authorization")).toBe("Bearer token-A");
      }
    });

    it("reports 400 and 404 distinctly and fails safely on a malformed page", async () => {
      const { transport } = setup([
        json({ error: { code: "BAD_REQUEST" } }, 400),
        json({ error: { code: "NOT_FOUND" } }, 404),
        json({ data: { items: [] } }),
        json({ error: {} }, 503),
      ]);
      expect(await transport.listSessions({ cursor: "stale" })).toMatchObject({ ok: false, error: { code: "invalid_request" } });
      expect(await transport.archiveSession({ sessionId: "gone" })).toMatchObject({ ok: false, error: { code: "session_not_found" } });
      expect(await transport.listSessions({})).toMatchObject({ ok: false, error: { code: "transport_execution_failed" } });
      expect(await transport.listSessions({})).toMatchObject({ ok: false, error: { code: "transport_execution_failed" } });
    });

    it("requires a session ID to archive and never fetches without one", async () => {
      const { fetchMock, transport } = setup([]);
      expect(await transport.archiveSession({ sessionId: " " })).toMatchObject({ ok: false });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("streams a choice with only choiceId and pageContext in the body", async () => {
      const stream = new ReadableStream<Uint8Array>();
      const { fetchMock, transport } = setup([new Response(stream, { headers: { "content-type": "text/event-stream" }, status: 200 })]);
      const result = await transport.streamMessage({ choiceId: "order-status-10001", pageContext: { module: "orders" }, sessionId: "s-1" });

      expect(result).toEqual({ ok: true, value: stream });
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(String(init.body))).toEqual({ choiceId: "order-status-10001", pageContext: { module: "orders" } });
    });

    it("reports a rejected choice (404) as session_not_found but keeps typed messages unchanged", async () => {
      const { transport } = setup([json({}, 404), json({}, 404)]);
      expect(await transport.streamMessage({ choiceId: "order-status-10001", sessionId: "s-1" }))
        .toMatchObject({ ok: false, error: { code: "session_not_found" } });
      expect(await transport.streamMessage({ message: "查詢訂單", sessionId: "s-1" }))
        .toMatchObject({ ok: false, error: { code: "transport_execution_failed" } });
    });

    it("passes the created session's opening through to the runtime", async () => {
      const opening = { configVersion: "1.0.0", greeting: "你好", quickReplies: [{ id: "overview", label: "總覽" }] };
      const { transport } = setup([json({ data: { sessionId: "s-1", status: "active", opening } }, 201)]);
      expect(await transport.createSession({})).toEqual({ ok: true, value: { sessionId: "s-1", status: "active", opening } });
    });
  });

  describe("Compatibility Mode", () => {
    it("uses the same archived list, unarchive and delete routes", async () => {
      const responses = [json({ data: { sessions: [], nextCursor: null } }), json({ data: { sessionId: "s-1", status: "active" } }),
        json({ data: { sessionId: "s-1", status: "deleted" } })];
      const fetchMock = vi.fn(async () => responses.shift() ?? json({}, 500));
      vi.stubGlobal("fetch", fetchMock);
      const transport = withHistory(createDefaultTransport());

      await transport.listSessions({ status: "archived" });
      expect(await transport.unarchiveSession!({ sessionId: "s-1" })).toMatchObject({ ok: true });
      expect(await transport.deleteSession!({ sessionId: "s-1" })).toMatchObject({ ok: true });
      const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
      expect(calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
        "GET /api/v1/assistant/sessions?status=archived",
        "POST /api/v1/assistant/sessions/s-1/unarchive",
        "DELETE /api/v1/assistant/sessions/s-1",
      ]);
    });

    it("uses the same list and archive routes and keeps the message body free of page context", async () => {
      const stream = new ReadableStream<Uint8Array>();
      const responses = [json({ data: page }), json({ data: { sessionId: "s-1", status: "closed" } }),
        new Response(stream, { status: 200 }), json({}, 404), json({}, 404)];
      const fetchMock = vi.fn(async () => responses.shift() ?? json({}, 500));
      vi.stubGlobal("fetch", fetchMock);
      const transport = withHistory(createDefaultTransport());

      expect(await transport.listSessions({ limit: 5 })).toEqual({ ok: true, value: page });
      expect(await transport.archiveSession({ sessionId: "s-1" })).toEqual({ ok: true, value: { sessionId: "s-1", status: "closed" } });
      await transport.streamMessage({ choiceId: "overview", pageContext: { module: "orders" }, sessionId: "s-1" });
      expect(await transport.archiveSession({ sessionId: "gone" })).toMatchObject({ ok: false, error: { code: "session_not_found" } });

      const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
      expect(calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
        "GET /api/v1/assistant/sessions?limit=5",
        "POST /api/v1/assistant/sessions/s-1/archive",
        "POST /api/v1/assistant/sessions/s-1/messages",
        "POST /api/v1/assistant/sessions/gone/archive",
      ]);
      expect(calls[1][1].body).toBeUndefined();
      expect(await transport.streamMessage({ choiceId: "overview", sessionId: "s-1" }))
        .toMatchObject({ ok: false, error: { code: "session_not_found" } });
      const body = JSON.parse(String(calls[2][1].body)) as Record<string, unknown>;
      expect(body.choiceId).toBe("overview");
      expect(body).not.toHaveProperty("message");
      expect(body).not.toHaveProperty("pageContext");
    });
  });
});
