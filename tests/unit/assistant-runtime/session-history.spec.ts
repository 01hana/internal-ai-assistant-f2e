import { describe, expect, it, vi } from "vitest";
import { answerDeltaEvent } from "../../fixtures/assistant-sse/events";
import {
  appendAssistantHistoryPage,
  createAssistantSessionHistoryOrchestrator,
  isReusableAssistantSession,
  resolveSessionRecoveryReason,
  resolveSessionRestoreCandidates,
  shouldClearScopedSessionFallback,
} from "../../../packages/assistant-runtime/src/session";
import type { AssistantRuntimeTransportPort } from "../../../packages/assistant-runtime/src/transport/ports";
import type { HistoryMessageSummary } from "../../../packages/assistant-runtime/src/types";

const firstMessage = {
  messageId: "message-001",
  role: "user",
  content: "First",
  createdAt: "2026-07-02T00:00:01.000Z",
} satisfies HistoryMessageSummary;

const secondMessage = {
  messageId: "message-002",
  role: "assistant",
  content: "Second",
  createdAt: "2026-07-02T00:00:02.000Z",
  answerDecision: "answered",
} satisfies HistoryMessageSummary;

function createTransport(): Pick<
  AssistantRuntimeTransportPort,
  "createSession" | "loadHistory" | "cancelMessage" | "abortMessage"
> {
  return {
    createSession: vi.fn(async () => ({
      ok: true,
      value: { sessionId: "session-created", status: "active" },
    })),
    loadHistory: vi.fn(async input => ({
      ok: true,
      value: {
        sessionId: input.sessionId,
        messages: [firstMessage],
        cursor: "message-001",
      },
    })),
    cancelMessage: vi.fn(async () => ({ ok: true, value: { cancelled: true } })),
    abortMessage: vi.fn(async () => ({ ok: true, value: { aborted: true } })),
  };
}

describe("assistant-runtime session and history orchestration", () => {
  it("prioritizes host-managed restore candidates and classifies recovery safely", () => {
    expect(resolveSessionRestoreCandidates({
      scopeKey: "scope-001",
      hostManagedSessionId: "session-host",
      storedSessionId: "session-storage",
    }).map(candidate => candidate.source)).toEqual(["host_managed", "session_storage"]);

    expect(isReusableAssistantSession({ sessionId: "session-001", status: "active" })).toBe(true);
    expect(resolveSessionRecoveryReason({ statusCode: 404 })).toBe("not_found");
    expect(shouldClearScopedSessionFallback("expired")).toBe(true);
  });

  it("appends ascending history pages without duplicate messages and preserves nextCursor", () => {
    expect(appendAssistantHistoryPage({
      messages: [firstMessage],
      nextCursor: "message-001",
    }, {
      messages: [firstMessage, secondMessage],
      nextCursor: "message-002",
    })).toEqual({
      messages: [firstMessage, secondMessage],
      nextCursor: "message-002",
    });
  });

  it("uses only adapter transport ports for create/resume/history/cancel", async () => {
    const transport = createTransport();
    const orchestrator = createAssistantSessionHistoryOrchestrator({ transport });

    await expect(orchestrator.createSession()).resolves.toEqual({ sessionId: "session-created", status: "active" });
    await expect(orchestrator.resumeSession("session-existing")).resolves.toEqual({
      sessionId: "session-existing",
      status: "active",
    });
    await expect(orchestrator.loadHistory({ sessionId: "session-existing", cursor: "message-001" })).resolves.toMatchObject({
      sessionId: "session-existing",
      cursor: "message-001",
    });
    await expect(orchestrator.cancel({
      sessionId: "session-existing",
      messageId: "message-001",
    })).resolves.toEqual({ cancelled: true });
    await expect(orchestrator.abort({
      sessionId: "session-existing",
      messageId: "message-001",
    })).resolves.toEqual({ aborted: true });

    expect(transport.createSession).toHaveBeenCalledOnce();
    expect(transport.loadHistory).toHaveBeenCalledOnce();
    expect(transport.cancelMessage).toHaveBeenCalledOnce();
    expect(transport.abortMessage).toHaveBeenCalledOnce();
    expect(orchestrator.getPendingOperationCount()).toBe(0);
  });

  it("keeps backend sessionId separate from local runtime identity and cleans pending operations", async () => {
    const transport = createTransport();
    const first = createAssistantSessionHistoryOrchestrator({ transport });
    const second = createAssistantSessionHistoryOrchestrator({ transport });

    await first.loadHistory({ sessionId: "shared-backend-session" });
    await second.loadHistory({ sessionId: "shared-backend-session" });
    await first.cleanup();
    await second.cleanup();

    expect(first).not.toBe(second);
    expect(transport.loadHistory).toHaveBeenCalledTimes(2);
    expect(first.accumulateDelta("", answerDeltaEvent)).toBe(answerDeltaEvent.data.delta);
  });

  it("returns safe transport failures without raw endpoint ownership", async () => {
    const transport = {
      ...createTransport(),
      createSession: vi.fn(async () => ({
        ok: false,
        error: {
          code: "transport_unavailable",
          safeMessage: "The assistant session is unavailable.",
        },
      })),
    };
    const orchestrator = createAssistantSessionHistoryOrchestrator({ transport });

    await expect(orchestrator.createSession()).rejects.toMatchObject({
      code: "transport_unavailable",
    });
    expect(orchestrator.getPendingOperationCount()).toBe(0);
  });

  it("removes completed operation controllers and external abort listeners immediately", async () => {
    const externalController = new AbortController();
    const addListener = vi.spyOn(externalController.signal, "addEventListener");
    const removeListener = vi.spyOn(externalController.signal, "removeEventListener");
    const transport = createTransport();
    const orchestrator = createAssistantSessionHistoryOrchestrator({ transport });

    await orchestrator.loadHistory({
      sessionId: "session-existing",
    }, {
      signal: externalController.signal,
    });

    expect(orchestrator.getPendingOperationCount()).toBe(0);
    expect(addListener).toHaveBeenCalledWith("abort", expect.any(Function), { once: true });
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("aborts pending operations during cleanup without waiting for transport completion", async () => {
    let observedSignal!: AbortSignal;
    const transport = {
      ...createTransport(),
      loadHistory: vi.fn(async (_input, options) => {
        observedSignal = options!.signal!;
        return new Promise<never>(() => {});
      }),
    };
    const orchestrator = createAssistantSessionHistoryOrchestrator({ transport });

    void orchestrator.loadHistory({ sessionId: "session-pending" }).catch(() => {});
    await Promise.resolve();

    expect(orchestrator.getPendingOperationCount()).toBe(1);
    await orchestrator.cleanup();

    expect(observedSignal.aborted).toBe(true);
    expect(orchestrator.getPendingOperationCount()).toBe(0);
  });

  it("gives retry a fresh tracked lifecycle and clears pending state after failure", async () => {
    const transport = createTransport();
    const orchestrator = createAssistantSessionHistoryOrchestrator({ transport });
    const seenSignals: AbortSignal[] = [];

    await expect(orchestrator.retry(async ({ signal }) => {
      seenSignals.push(signal);
      return "first";
    })).resolves.toBe("first");

    await expect(orchestrator.retry(async ({ signal }) => {
      seenSignals.push(signal);
      throw { code: "transport_unavailable" };
    })).rejects.toMatchObject({
      code: "transport_unavailable",
    });

    expect(seenSignals).toHaveLength(2);
    expect(seenSignals[0]).not.toBe(seenSignals[1]);
    expect(orchestrator.getPendingOperationCount()).toBe(0);
  });

  it("bridges external abort signals into tracked operations", async () => {
    const externalController = new AbortController();
    let observedSignal!: AbortSignal;
    const transport = {
      ...createTransport(),
      loadHistory: vi.fn(async (_input, options) => {
        observedSignal = options!.signal!;
        externalController.abort();
        return {
          ok: true,
          value: {
            sessionId: "session-existing",
            messages: [],
            cursor: undefined,
          },
        };
      }),
    };
    const orchestrator = createAssistantSessionHistoryOrchestrator({ transport });

    await orchestrator.loadHistory(
      { sessionId: "session-existing" },
      { signal: externalController.signal },
    );

    expect(observedSignal.aborted).toBe(true);
    expect(orchestrator.getPendingOperationCount()).toBe(0);
  });
});
