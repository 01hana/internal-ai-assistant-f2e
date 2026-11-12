import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPinia, type Pinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import { createAssistantStreamingRuntimeMessage } from "../../../packages/assistant-runtime/src/runtime";
import { createSdkRuntimeAdapter as createActualSdkRuntimeAdapter } from "../../../packages/assistant-sdk/src/runtime/sdkRuntimeAdapter";
import type { AssistantRuntimeTransportPort } from "../../../packages/assistant-runtime/src/transport/ports";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const runtimeAdapterSourcePath = path.join(repoRoot, "packages/assistant-sdk/src/runtime/sdkRuntimeAdapter.ts");
const sdkRootEntryPath = path.join(repoRoot, "packages/assistant-sdk/src/index.ts");

type SdkRuntimeAdapter = {
  readonly controller: {
    readonly runtimeScope: string;
    readonly stores: {
      readonly runtimeScope: string;
      readonly pinia: Pinia;
      readonly session: {
        readonly contextReady: { value: boolean };
      };
    };
    readonly cleanup: () => Promise<void>;
  };
  readonly destroy: () => Promise<void>;
  readonly emitHostEvent: (eventName: string, payload?: Readonly<Record<string, unknown>>) => Promise<{ readonly ok: boolean }>;
  readonly getLifecycleVersion: () => number;
  readonly isActiveLifecycleVersion: (version: number) => boolean;
  readonly resolveContext: (operation: "send" | "retry") => Promise<Readonly<Record<string, unknown>> | null>;
  readonly runIfActive: <T>(version: number, callback: () => T) => T | undefined;
  readonly sessionLifecycle: {
    readonly cleanup: (reason?: string) => Promise<void>;
    readonly createSession: AssistantRuntimeTransportPort["createSession"];
  };
  readonly transport: AssistantRuntimeTransportPort;
};

type SdkRuntimeAdapterModule = {
  readonly createSdkRuntimeAdapter: (input: Readonly<Record<string, unknown>>) => SdkRuntimeAdapter;
};

async function loadRuntimeAdapterModule() {
  const mod = await import("../../../packages/assistant-sdk/src/runtime/sdkRuntimeAdapter") as Partial<SdkRuntimeAdapterModule>;

  expect(mod.createSdkRuntimeAdapter).toBeTypeOf("function");

  return mod as SdkRuntimeAdapterModule;
}

describe("SDK runtime adapter composer", () => {
  it("aborts the matching SSE stream, terminates its typing message, and keeps a later reply isolated", async () => {
    const streams: Array<ReadableStreamDefaultController<Uint8Array>> = [];
    const signals: AbortSignal[] = [];
    const execute = vi.fn(async (input: { operation: string }, runtimeOptions?: { signal?: AbortSignal }) => {
      if (input.operation !== "streamMessage") throw new Error("unexpected operation");
      signals.push(runtimeOptions?.signal as AbortSignal);
      return new ReadableStream<Uint8Array>({
        start(controller) { streams.push(controller); },
      });
    });
    const adapter = createActualSdkRuntimeAdapter({
      execute,
      pinia: createPinia(),
      provider: async () => ({ hostApp: "test" }),
      runtimeScope: "sdk-runtime:sse-cancel",
    });
    const session = adapter.controller.stores.session;
    const encoder = new TextEncoder();
    const first = createAssistantStreamingRuntimeMessage({
      createdAt: "2026-07-27T00:00:00.000Z",
      key: "stream:first",
      requestId: "local:first",
    });
    adapter.controller.appendAssistantStreamingPlaceholder(first);
    adapter.controller.setStreamingRequest("local:first", first.key);
    adapter.controller.markStreamingStarted();

    const firstRun = adapter.startMessageStream({ message: "first", sessionId: "session-001" });
    await vi.waitFor(() => expect(streams).toHaveLength(1));
    const firstEvent = {
      requestId: "server:first",
      sessionId: "session-001",
      messageId: "message:first",
      eventType: "answer_delta",
      sequence: 1,
      data: { delta: "old content" },
    };
    streams[0]!.enqueue(encoder.encode(`event: answer_delta\ndata: ${JSON.stringify(firstEvent)}\n\n`));
    await vi.waitFor(() => expect(first.lastSequence).toBe(1));
    expect(session.activeRequestId.value).toBe("server:first");
    expect(first.requestId).toBe("server:first");

    await adapter.cancelMessageStream();
    await firstRun;
    expect(signals[0]?.aborted).toBe(true);
    expect(first.status).toBe("cancelled");
    expect(first.typingVisibleUntil).toBeNull();
    expect(first.content).toBe("old content");
    expect(session.activeRequestId.value).toBeNull();

    const second = createAssistantStreamingRuntimeMessage({
      createdAt: "2026-07-27T00:01:00.000Z",
      key: "stream:second",
      requestId: "local:second",
    });
    adapter.controller.appendAssistantStreamingPlaceholder(second);
    adapter.controller.setStreamingRequest("local:second", second.key);
    adapter.controller.markStreamingStarted();
    const secondRun = adapter.startMessageStream({ message: "second", sessionId: "session-001" });
    await vi.waitFor(() => expect(streams).toHaveLength(2));
    adapter.controller.applyStreamingEvent({ ...firstEvent, sequence: 2, data: { delta: "late old event" } });
    expect(first.content).toBe("old content");
    expect(second.content).toBe("");

    const finalEvent = {
      requestId: "server:second",
      sessionId: "session-001",
      messageId: "message:second",
      eventType: "final",
      sequence: 1,
      data: { answerDecision: "answered", answer: "new answer", evidenceRefs: [] },
    };
    streams[1]!.enqueue(encoder.encode(`event: final\ndata: ${JSON.stringify(finalEvent)}\n\n`));
    await secondRun;
    await adapter.cancelMessageStream();
    expect(second.status).toBe("completed");
    expect(second.content).toBe("new answer");
    expect(first.status).toBe("cancelled");
    expect(session.activeRequestId.value).toBeNull();
    await adapter.destroy();
  });

  it("composes Shared Runtime stores/controller, T134 transport, T135 session lifecycle, context resolver, and host events", async () => {
    const { createSdkRuntimeAdapter } = await loadRuntimeAdapterModule();
    const pinia = createPinia();
    const onOpened = vi.fn();
    const execute = vi.fn(async () => ({
      ok: true,
      value: {
        sessionId: "session-from-sdk-adapter",
        status: "active",
      },
    }));
    const adapter = createSdkRuntimeAdapter({
      callbacks: {
        onOpened,
      },
      configuration: {
        integrationMode: "backend001-compatibility",
      },
      execute,
      pinia,
      provider: async () => ({
        hostApp: "erp",
        pageContext: {
          route: "/orders",
        },
        sessionScope: "local-only",
      }),
      runtimeScope: "sdk-runtime:test",
    });

    expect(adapter.controller.runtimeScope).toBe("sdk-runtime:test");
    expect(adapter.controller.stores.runtimeScope).toBe("sdk-runtime:test");
    expect(adapter.controller.stores.pinia).toBe(pinia);

    const context = await adapter.resolveContext("send");
    expect(context).toEqual({
      hostApp: "erp",
      pageContext: {
        route: "/orders",
      },
    });
    expect(adapter.controller.stores.session.contextReady.value).toBe(true);

    await expect(adapter.sessionLifecycle.createSession()).resolves.toMatchObject({
      ok: true,
      value: {
        sessionId: "session-from-sdk-adapter",
      },
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "createSession",
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    await adapter.emitHostEvent("opened", {
      hostContext: {
        secret: "must-not-leak",
      },
      sessionId: "session-from-sdk-adapter",
    });
    expect(onOpened).toHaveBeenCalledWith({
      sessionId: "session-from-sdk-adapter",
    });
  });

  it("fails context closed, emits safe host event payloads, and does not expose backend authority fields", async () => {
    const { createSdkRuntimeAdapter } = await loadRuntimeAdapterModule();
    const onContextResolutionFailed = vi.fn();
    const adapter = createSdkRuntimeAdapter({
      callbacks: {
        onContextResolutionFailed,
      },
      pinia: createPinia(),
      provider: async () => ({
        connector: "frontend-owned-connector",
        hostApp: "erp",
      }),
      runtimeScope: "sdk-runtime:context-failure",
    });

    await expect(adapter.resolveContext("send")).resolves.toBeNull();

    expect(onContextResolutionFailed).toHaveBeenCalledWith({
      error: {
        code: "forbidden_host_context_field",
        field: "connector",
      },
    });
  });

  it("cleans up runtime/session/event resources idempotently and suppresses stale async callbacks", async () => {
    const { createSdkRuntimeAdapter } = await loadRuntimeAdapterModule();
    const onOpened = vi.fn();
    const adapter = createSdkRuntimeAdapter({
      callbacks: {
        onOpened,
      },
      pinia: createPinia(),
      provider: async () => ({ hostApp: "erp" }),
      runtimeScope: "sdk-runtime:cleanup",
    });
    const version = adapter.getLifecycleVersion();
    const staleCallback = vi.fn();

    await adapter.destroy();
    await adapter.destroy();

    expect(adapter.isActiveLifecycleVersion(version)).toBe(false);
    expect(adapter.runIfActive(version, staleCallback)).toBeUndefined();
    expect(staleCallback).not.toHaveBeenCalled();
    await adapter.emitHostEvent("opened", { sessionId: "session-after-destroy" });
    expect(onOpened).not.toHaveBeenCalled();
  });

  it("does not add runtime/context/event internals to the public SDK root entry", () => {
    const rootEntry = readFileSync(sdkRootEntryPath, "utf8");

    expect(rootEntry).not.toMatch(/sdkRuntimeAdapter|contextResolution|hostEventEmitter|createSdkRuntimeAdapter/);
    expect(rootEntry).not.toMatch(/\.\/runtime|\.\/context|\.\/events/);
  });

  it("does not own a second runtime, app source, SSE parser, session state, outcome state, or Pinia instance", () => {
    const source = readFileSync(runtimeAdapterSourcePath, "utf8");

    expect(source).toContain("createAssistantRuntimeController");
    expect(source).toContain("createAssistantRuntimeStores");
    expect(source).toContain("createAssistantSseStreamRunner");
    expect(source).not.toMatch(/app\/(?:features|services|stores|utils)/);
    expect(source).not.toMatch(/parseAssistantSse|getReader|new\s+ReadableStream/);
    expect(source).not.toMatch(/messages\s*=\s*\[|historyCursor|nextCursor\s*=\s*ref|answerDecisionState|normalizeEvidence/);
    expect(source).not.toMatch(/createPinia\s*\(|defineStore|getActivePinia|setActivePinia/);
    expect(source).not.toMatch(/frontend001Runtime|AssistantService|useChat|useAssistantSession|useAssistantSseStream/);
  });
});
