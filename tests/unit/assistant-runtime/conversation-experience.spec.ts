import { describe, expect, it, vi } from "vitest";
import {
  isAssistantChoiceId,
  normalizeAssistantChoices,
  normalizeAssistantOpening,
  normalizeAssistantSessionListPage,
} from "../../../packages/assistant-runtime/src/experience";
import { parseAssistantSseText } from "../../../packages/assistant-runtime/src/sse";
import { createAssistantSessionHistoryOrchestrator } from "../../../packages/assistant-runtime/src/session";
import {
  supportsAssistantRuntimeSessionHistory,
  type AssistantRuntimeTransportPort,
} from "../../../packages/assistant-runtime/src/transport/ports";
import { finalAnsweredIdOnlyEvent } from "../../fixtures/assistant-sse/events";

/** Frontend 003 Phase 1 (T004, T005, T008): Backend Feature 013 data normalization in the shared runtime. */
describe("conversation experience data (Frontend 003)", () => {
  describe("choices", () => {
    it("accepts the backend choice ID pattern only", () => {
      expect(isAssistantChoiceId("order-status-10001")).toBe(true);
      expect(isAssistantChoiceId("overview")).toBe(true);
      for (const value of ["", "Overview", "-start", "has space", "a".repeat(65), 7, null]) {
        expect(isAssistantChoiceId(value)).toBe(false);
      }
    });

    it("keeps valid choices, trims labels, drops malformed and duplicate entries", () => {
      expect(normalizeAssistantChoices([
        { id: "overview", label: " 你能查詢哪些資料？ " },
        { id: "Bad Id", label: "x" },
        { id: "no-label" },
        { id: "blank", label: "   " },
        "not-an-object",
        { id: "overview", label: "duplicate" },
        { id: "order-status-10001", label: "訂單 SO-10001 的狀態", extra: "dropped" },
      ])).toEqual([
        { id: "overview", label: "你能查詢哪些資料？" },
        { id: "order-status-10001", label: "訂單 SO-10001 的狀態" },
      ]);
    });

    it("returns undefined when nothing valid remains", () => {
      expect(normalizeAssistantChoices([])).toBeUndefined();
      expect(normalizeAssistantChoices([{ id: "BAD", label: "x" }])).toBeUndefined();
      expect(normalizeAssistantChoices({ id: "overview", label: "x" })).toBeUndefined();
    });
  });

  describe("opening (T005)", () => {
    it("normalizes a configured opening", () => {
      expect(normalizeAssistantOpening({
        configVersion: "1.0.0",
        greeting: "你好，我可以協助查詢訂單資訊。",
        quickReplies: [{ id: "overview", label: "你能查詢哪些資料？" }, { id: "BAD", label: "x" }],
      })).toEqual({
        configVersion: "1.0.0",
        greeting: "你好，我可以協助查詢訂單資訊。",
        quickReplies: [{ id: "overview", label: "你能查詢哪些資料？" }],
      });
    });

    it("keeps the Core greeting without configuration", () => {
      expect(normalizeAssistantOpening({ configVersion: null, greeting: "你好", quickReplies: [] }))
        .toEqual({ configVersion: null, greeting: "你好", quickReplies: [] });
    });

    it("drops an opening without a usable greeting", () => {
      for (const value of [undefined, null, "text", { greeting: "" }, { greeting: 1, quickReplies: [] }]) {
        expect(normalizeAssistantOpening(value)).toBeUndefined();
      }
    });

    it("normalizes opening when the orchestrator creates a session and leaves other fields untouched", async () => {
      const createSession = vi.fn()
        .mockResolvedValueOnce({ ok: true, value: { sessionId: "s-1", status: "active",
          opening: { configVersion: "1.0.0", greeting: "你好", quickReplies: [{ id: "overview", label: "總覽" }, { id: "X", label: "y" }] } } })
        .mockResolvedValueOnce({ ok: true, value: { sessionId: "s-2", status: "active", opening: { greeting: "" } } })
        .mockResolvedValueOnce({ ok: true, value: { sessionId: "s-3", status: "active" } });
      const orchestrator = createAssistantSessionHistoryOrchestrator({
        transport: { createSession, cancelMessage: vi.fn(), abortMessage: vi.fn() } as never,
      });

      expect(await orchestrator.createSession({})).toEqual({ sessionId: "s-1", status: "active",
        opening: { configVersion: "1.0.0", greeting: "你好", quickReplies: [{ id: "overview", label: "總覽" }] } });
      expect(await orchestrator.createSession({})).toEqual({ sessionId: "s-2", status: "active" });
      expect(await orchestrator.createSession({})).toEqual({ sessionId: "s-3", status: "active" });
    });
  });

  describe("final suggestions (T004)", () => {
    const frame = (data: Record<string, unknown>) =>
      `event: final\ndata: ${JSON.stringify({ ...finalAnsweredIdOnlyEvent, data: { ...finalAnsweredIdOnlyEvent.data, ...data } })}\n\n`;
    const finalData = (text: string) => {
      const [result] = parseAssistantSseText(text);
      expect(result?.kind).toBe("event");
      return (result as { event: { data: Record<string, unknown> } }).event.data;
    };

    it("keeps valid suggestions", () => {
      expect(finalData(frame({ suggestions: [{ id: "follow-order-10002", label: "看 SO-10002" }] })).suggestions)
        .toEqual([{ id: "follow-order-10002", label: "看 SO-10002" }]);
    });

    it("drops malformed entries and removes a field with nothing valid, without failing the event", () => {
      expect(finalData(frame({ suggestions: [{ id: "BAD", label: "x" }, { id: "ok", label: "好" }] })).suggestions)
        .toEqual([{ id: "ok", label: "好" }]);
      for (const suggestions of ["text", [], [{ id: "BAD" }], null]) {
        const data = finalData(frame({ suggestions }));
        expect(data).not.toHaveProperty("suggestions");
        expect(data.answerDecision).toBe("answered");
      }
    });

    it("leaves a final without suggestions unchanged", () => {
      expect(finalData(frame({}))).toEqual(finalAnsweredIdOnlyEvent.data);
    });
  });

  describe("session list (T008)", () => {
    it("normalizes a page and drops malformed entries", () => {
      expect(normalizeAssistantSessionListPage({
        sessions: [
          { sessionId: "s-1", title: "查詢訂單 SO-10001 狀態", createdAt: "2026-11-16T02:00:00.000Z", lastMessageAt: "2026-11-16T02:05:00.000Z" },
          { sessionId: "s-2", title: null, createdAt: "2026-11-15T02:00:00.000Z", lastMessageAt: "2026-11-15T02:05:00.000Z" },
          { sessionId: "", createdAt: "2026-11-15T02:00:00.000Z", lastMessageAt: "2026-11-15T02:05:00.000Z" },
          { sessionId: "s-4", createdAt: "not-a-date", lastMessageAt: "2026-11-15T02:05:00.000Z" },
        ],
        nextCursor: "eyJ0Ijoi",
      })).toEqual({
        sessions: [
          { sessionId: "s-1", title: "查詢訂單 SO-10001 狀態", createdAt: "2026-11-16T02:00:00.000Z", lastMessageAt: "2026-11-16T02:05:00.000Z" },
          { sessionId: "s-2", title: null, createdAt: "2026-11-15T02:00:00.000Z", lastMessageAt: "2026-11-15T02:05:00.000Z" },
        ],
        nextCursor: "eyJ0Ijoi",
      });
    });

    it("treats an empty cursor as the last page and rejects non-page responses", () => {
      expect(normalizeAssistantSessionListPage({ sessions: [], nextCursor: "" })).toEqual({ sessions: [], nextCursor: null });
      expect(normalizeAssistantSessionListPage({ items: [] })).toBeNull();
      expect(normalizeAssistantSessionListPage(null)).toBeNull();
    });

    it("detects the optional session history capability", () => {
      const base = { createSession: vi.fn(), cancelMessage: vi.fn() } as unknown as AssistantRuntimeTransportPort;
      expect(supportsAssistantRuntimeSessionHistory(base)).toBe(false);
      expect(supportsAssistantRuntimeSessionHistory({ ...base, listSessions: vi.fn() } as never)).toBe(false);
      expect(supportsAssistantRuntimeSessionHistory({ ...base, listSessions: vi.fn(), archiveSession: vi.fn() } as never)).toBe(true);
    });
  });
});
