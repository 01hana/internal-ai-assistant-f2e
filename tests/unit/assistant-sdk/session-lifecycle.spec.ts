import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { AssistantRuntimeTransportPort } from "../../../packages/assistant-runtime/src/transport/ports";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const sessionLifecycleSourcePath = path.join(repoRoot, "packages/assistant-sdk/src/session/sessionLifecycle.ts");

type SessionLifecycleAdapter = {
  readonly instanceId: string;
  readonly namespace?: string;
  readonly abortMessage: AssistantRuntimeTransportPort["abortMessage"];
  readonly cancelMessage: AssistantRuntimeTransportPort["cancelMessage"];
  readonly captureLifecycleVersion: () => number;
  readonly cleanup: (reason?: string) => unknown | Promise<unknown>;
  readonly createSession: AssistantRuntimeTransportPort["createSession"];
  readonly getPendingOperationCount: () => number;
  readonly isCurrentLifecycleVersion: (version: number) => boolean;
  readonly loadHistory: AssistantRuntimeTransportPort["loadHistory"];
  readonly requiresCleanup: (input: Readonly<Record<string, unknown>>) => boolean;
};

type SessionLifecycleModule = {
  readonly createSdkSessionLifecycleAdapter: (options?: Readonly<Record<string, unknown>>) => SessionLifecycleAdapter;
  readonly createSessionLifecycleCoordinator: (options?: Readonly<Record<string, unknown>>) => {
    readonly cleanup: (reason: string) => unknown;
    readonly requiresCleanup: (input: Readonly<Record<string, unknown>>) => boolean;
  };
};

async function loadSessionLifecycleModule() {
  const mod = await import("../../../packages/assistant-sdk/src/session/sessionLifecycle") as Partial<SessionLifecycleModule>;

  expect(mod.createSessionLifecycleCoordinator).toBeTypeOf("function");
  expect(mod.createSdkSessionLifecycleAdapter).toBeTypeOf("function");

  return mod as SessionLifecycleModule;
}

function createTransport(overrides: Partial<AssistantRuntimeTransportPort> = {}): AssistantRuntimeTransportPort {
  return {
    abortMessage: vi.fn(async () => ({ ok: true, value: { aborted: true } })),
    cancelMessage: vi.fn(async () => ({ ok: true, value: { cancelled: true } })),
    confirmAction: vi.fn(async () => ({ ok: true, value: { confirmed: true } })),
    createSession: vi.fn(async () => ({
      ok: true,
      value: {
        sessionId: "session-created",
        status: "active",
      },
    })),
    loadApprovalRequest: vi.fn(async input => ({
      ok: true,
      value: {
        approvalRequestId: input.approvalRequestId,
      },
    })),
    loadHistory: vi.fn(async input => ({
      ok: true,
      value: {
        messages: [],
        sessionId: input.sessionId,
      },
    })),
    rejectAction: vi.fn(async () => ({ ok: true, value: { rejected: true } })),
    sendMessage: vi.fn(async input => ({
      ok: true,
      value: {
        messageId: "message-created",
        sessionId: input.sessionId ?? "session-created",
        status: "queued",
      },
    })),
    streamMessage: vi.fn(async () => ({
      ok: true,
      value: new ReadableStream<Uint8Array>(),
    })),
    submitFeedback: vi.fn(async () => ({ ok: true, value: { accepted: true } })),
    ...overrides,
  };
}

describe("SDK session lifecycle adapter", () => {
  it("delegates create, history, cancel, and abort to Shared Runtime session orchestration over transport ports", async () => {
    const { createSdkSessionLifecycleAdapter } = await loadSessionLifecycleModule();
    const transport = createTransport();
    const adapter = createSdkSessionLifecycleAdapter({
      instanceId: "sdk-instance-001",
      namespace: "assistant-sdk-v1:erp:org-001:entity:/orders/001:order:order-001",
      transport,
    });

    await expect(adapter.createSession({
      pageContext: {
        pageType: "orders",
      },
    })).resolves.toMatchObject({
      ok: true,
      value: {
        sessionId: "session-created",
      },
    });
    await expect(adapter.loadHistory({
      cursor: "cursor-001",
      sessionId: "session-created",
    })).resolves.toMatchObject({
      ok: true,
      value: {
        sessionId: "session-created",
      },
    });
    await expect(adapter.cancelMessage({
      messageId: "message-001",
      sessionId: "session-created",
    })).resolves.toMatchObject({
      ok: true,
      value: {
        cancelled: true,
      },
    });
    await expect(adapter.abortMessage({
      messageId: "message-001",
      sessionId: "session-created",
    })).resolves.toMatchObject({
      ok: true,
      value: {
        aborted: true,
      },
    });

    expect(adapter.instanceId).toBe("sdk-instance-001");
    expect(adapter.namespace).toBe("assistant-sdk-v1:erp:org-001:entity:/orders/001:order:order-001");
    expect(transport.createSession).toHaveBeenCalledOnce();
    expect(transport.loadHistory).toHaveBeenCalledOnce();
    expect(transport.cancelMessage).toHaveBeenCalledOnce();
    expect(transport.abortMessage).toHaveBeenCalledOnce();
    expect(adapter.getPendingOperationCount()).toBe(0);
  });

  it("preserves safe unsupported transport failures instead of fake success", async () => {
    const { createSdkSessionLifecycleAdapter } = await loadSessionLifecycleModule();
    const adapter = createSdkSessionLifecycleAdapter();

    await expect(adapter.createSession()).resolves.toMatchObject({
      error: {
        code: "transport_unavailable",
      },
      ok: false,
    });
    await expect(adapter.loadHistory({
      sessionId: "session-missing",
    })).resolves.toMatchObject({
      error: {
        code: "transport_unavailable",
      },
      ok: false,
    });
    await expect(adapter.cancelMessage({
      messageId: "message-001",
      sessionId: "session-missing",
    })).resolves.toMatchObject({
      error: {
        code: "transport_unavailable",
      },
      ok: false,
    });
  });

  it("bridges AbortSignal into tracked Shared Runtime operations and cleanup aborts pending work", async () => {
    const { createSdkSessionLifecycleAdapter } = await loadSessionLifecycleModule();
    let observedSignal!: AbortSignal;
    const transport = createTransport({
      loadHistory: vi.fn(async (_input, options) => {
        observedSignal = options!.signal!;
        return new Promise<never>(() => {});
      }),
    });
    const adapter = createSdkSessionLifecycleAdapter({ transport });

    void adapter.loadHistory({ sessionId: "session-pending" });
    await Promise.resolve();

    expect(adapter.getPendingOperationCount()).toBe(1);
    await adapter.cleanup("destroyed");

    expect(observedSignal.aborted).toBe(true);
    expect(adapter.getPendingOperationCount()).toBe(0);
  });

  it("keeps SDK instances isolated and marks stale lifecycle versions after cleanup", async () => {
    const { createSdkSessionLifecycleAdapter } = await loadSessionLifecycleModule();
    const first = createSdkSessionLifecycleAdapter({
      instanceId: "instance-a",
      namespace: "namespace-a",
      transport: createTransport(),
    });
    const second = createSdkSessionLifecycleAdapter({
      instanceId: "instance-b",
      namespace: "namespace-b",
      transport: createTransport(),
    });
    const firstVersion = first.captureLifecycleVersion();
    const secondVersion = second.captureLifecycleVersion();

    await first.cleanup("context_changed");

    expect(first.instanceId).not.toBe(second.instanceId);
    expect(first.namespace).not.toBe(second.namespace);
    expect(first.isCurrentLifecycleVersion(firstVersion)).toBe(false);
    expect(second.isCurrentLifecycleVersion(secondVersion)).toBe(true);
  });

  it("does not own SDK session/history runtime, SSE parsing, Pinia, app source, or outcome state", () => {
    const source = readFileSync(sessionLifecycleSourcePath, "utf8");

    expect(source).toContain("createAssistantSessionHistoryOrchestrator");
    expect(source).not.toMatch(/app\/(?:features|services|stores|utils)/);
    expect(source).not.toMatch(/parseAssistantSse|createAssistantSseStreamRunner|ReadableStream|getReader/);
    expect(source).not.toMatch(/defineStore|createPinia|getActivePinia|setActivePinia/);
    expect(source).not.toMatch(/messages\s*=\s*\[|historyCursor|nextCursor\s*=\s*ref|answerDecisionState|normalizeEvidence/);
    expect(source).not.toMatch(/frontend001Runtime|AssistantService|useAssistantSession|useAssistantSseStream/);
  });
});
