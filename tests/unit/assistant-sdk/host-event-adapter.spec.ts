import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  createLeakyHostEventPayload,
  forbiddenHostEventPayloadFields,
} from "../../fixtures/assistant-sdk/host-events-fixtures";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const hostEventEmitterSourcePath = path.join(repoRoot, "packages/assistant-sdk/src/events/hostEventEmitter.ts");

type HostEventEmitterModule = {
  readonly createHostEventEmitter: (input: {
    readonly callbacks?: Readonly<Record<string, unknown>>;
  }) => {
    readonly destroy: () => void;
    readonly emit: (eventName: string, payload?: Readonly<Record<string, unknown>>) => Promise<{ readonly ok: boolean }>;
  };
};

async function loadHostEventEmitterModule() {
  return await import("../../../packages/assistant-sdk/src/events/hostEventEmitter") as HostEventEmitterModule;
}

describe("SDK host event adapter", () => {
  it("supports the public onError callback while keeping error payload safe", async () => {
    const { createHostEventEmitter } = await loadHostEventEmitterModule();
    const onError = vi.fn();
    const emitter = createHostEventEmitter({
      callbacks: {
        onError,
      },
    });

    await emitter.emit("error", createLeakyHostEventPayload());

    expect(onError).toHaveBeenCalledWith({
      error: {
        code: "backend_error",
      },
      messageId: "message-001",
      requestId: "request-001",
      sessionId: "session-001",
    });
  });

  it("projects answer, approval, escalation, and context events through allowlisted IDs-only payloads", async () => {
    const { createHostEventEmitter } = await loadHostEventEmitterModule();
    const callbacks = {
      onAnswerCompleted: vi.fn(),
      onApprovalDetailRequested: vi.fn(),
      onContextResolutionFailed: vi.fn(),
      onEscalationRequested: vi.fn(),
    };
    const emitter = createHostEventEmitter({ callbacks });
    const leakyPayload = createLeakyHostEventPayload();

    await emitter.emit("answer-completed", leakyPayload);
    await emitter.emit("approval-detail-requested", leakyPayload);
    await emitter.emit("escalation-requested", leakyPayload);
    await emitter.emit("context-resolution-failed", leakyPayload);

    expect(callbacks.onAnswerCompleted).toHaveBeenCalledWith({
      messageId: "message-001",
      sessionId: "session-001",
      status: "completed",
    });
    expect(callbacks.onApprovalDetailRequested).toHaveBeenCalledWith({
      approvalRequestId: "approval-001",
      messageId: "message-001",
      sessionId: "session-001",
    });
    expect(callbacks.onEscalationRequested).toHaveBeenCalledWith({
      escalationRequestId: "escalation-001",
      messageId: "message-001",
      sessionId: "session-001",
    });
    expect(callbacks.onContextResolutionFailed).toHaveBeenCalledWith({
      error: {
        code: "backend_error",
      },
      requestId: "request-001",
      sessionId: "session-001",
    });

    for (const callback of Object.values(callbacks)) {
      const serialized = JSON.stringify(callback.mock.calls[0]?.[0] ?? {});
      for (const field of forbiddenHostEventPayloadFields) {
        expect(serialized).not.toContain(field);
      }
    }
  });

  it("swallows host callback failures and suppresses all callbacks after destroy", async () => {
    const { createHostEventEmitter } = await loadHostEventEmitterModule();
    const onOpened = vi.fn(() => {
      throw new Error("host callback failed");
    });
    const onClosed = vi.fn();
    const emitter = createHostEventEmitter({
      callbacks: {
        onClosed,
        onOpened,
      },
    });

    await expect(emitter.emit("opened", { sessionId: "session-001" })).resolves.toEqual({ ok: false });

    emitter.destroy();
    await expect(emitter.emit("closed", { sessionId: "session-001" })).resolves.toEqual({ ok: false });
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("does not own runtime state, requests, SSE parsing, navigation, app source, or secrets", () => {
    const source = readFileSync(hostEventEmitterSourcePath, "utf8");

    expect(source).not.toMatch(/createAssistantRuntimeController|createAssistantRuntimeStores|defineStore|createPinia/);
    expect(source).not.toMatch(/buildAssistantRequest|assertOutgoingRequestSafe|requestEnvelope/);
    expect(source).not.toMatch(/parseAssistantSse|createAssistantSseStreamRunner|getReader|ReadableStream/);
    expect(source).not.toMatch(/app\/(?:features|services|stores|utils)/);
    expect(source).not.toMatch(/navigationUrl\s*[:=]|displayUrl\s*[:=]|rawBackendResponse\s*[:=]|token\s*[:=]|secret\s*[:=]/);
  });
});
