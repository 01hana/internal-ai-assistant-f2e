import { describe, expect, it, vi } from "vitest";
import {
  createHostEventCallbacks,
  createLeakyHostEventPayload,
  createThrowingHostEventCallbacks,
  forbiddenHostEventPayloadFields,
  hostEventAllowedFields,
  hostEventCallbackMap,
  hostEventNames,
} from "../../fixtures/assistant-sdk/host-events-fixtures";

type HostEventEmitterContract = {
  readonly destroy?: () => void;
  readonly emit: (eventName: string, payload?: Readonly<Record<string, unknown>>) => unknown | Promise<unknown>;
};

type HostEventEmitterModule = {
  readonly createHostEventEmitter: (input: {
    readonly callbacks?: Readonly<Record<string, unknown>>;
  }) => HostEventEmitterContract;
};

async function loadHostEventEmitterContract() {
  const contract = await import("../../../packages/assistant-sdk/src/events/hostEventEmitter") as Partial<HostEventEmitterModule>;

  expect(
    typeof contract.createHostEventEmitter,
    "hostEventEmitter.ts must export createHostEventEmitter.",
  ).toBe("function");

  return contract as HostEventEmitterModule;
}

describe("Frontend 002 host event emitter payload boundary", () => {
  it("requires an SDK-internal host event emitter factory", async () => {
    const contract = await loadHostEventEmitterContract();

    expect(contract.createHostEventEmitter).toBeTypeOf("function");
  });

  it("emits every supported host event with minimal safe payloads", async () => {
    const { createHostEventEmitter } = await loadHostEventEmitterContract();
    const callbacks = {
      onAnswerCompleted: vi.fn(),
      onApprovalDetailRequested: vi.fn(),
      onClosed: vi.fn(),
      onContextResolutionFailed: vi.fn(),
      onErrorOccurred: vi.fn(),
      onEscalationRequested: vi.fn(),
      onOpened: vi.fn(),
      onSessionChanged: vi.fn(),
      onSessionCreated: vi.fn(),
    };
    const emitter = createHostEventEmitter({ callbacks });
    const leakyPayload = createLeakyHostEventPayload();

    for (const eventName of hostEventNames) {
      const callbackName = hostEventCallbackMap[eventName];

      await emitter.emit(eventName, leakyPayload);

      const callback = callbacks[callbackName];
      expect(callback, `${eventName} must map to ${callbackName}.`).toHaveBeenCalledTimes(1);

      const payload = callback.mock.calls[0]?.[0] ?? {};
      const serialized = JSON.stringify(payload);

      expect(Object.keys(payload).sort()).toEqual([...hostEventAllowedFields[eventName]].sort());
      for (const field of forbiddenHostEventPayloadFields) {
        expect(serialized, `Host event payload must not leak ${field}.`).not.toContain(field);
        expect(payload).not.toHaveProperty(field);
      }
    }
  });

  it("keeps approval detail requested host event IDs-only", async () => {
    const { createHostEventEmitter } = await loadHostEventEmitterContract();
    const onApprovalDetailRequested = vi.fn();
    const emitter = createHostEventEmitter({
      callbacks: {
        ...createHostEventCallbacks(),
        onApprovalDetailRequested,
      },
    });

    await emitter.emit("approval-detail-requested", createLeakyHostEventPayload());

    expect(onApprovalDetailRequested).toHaveBeenCalledWith({
      approvalRequestId: "approval-001",
      messageId: "message-001",
      sessionId: "session-001",
    });
  });

  it("isolates host callback throws inside the SDK boundary", async () => {
    const { createHostEventEmitter } = await loadHostEventEmitterContract();
    const emitter = createHostEventEmitter({
      callbacks: createThrowingHostEventCallbacks(),
    });

    await expect(emitter.emit("opened", createLeakyHostEventPayload())).resolves.not.toThrow();
  });

  it("suppresses callbacks after the emitter is destroyed", async () => {
    const { createHostEventEmitter } = await loadHostEventEmitterContract();
    const onOpened = vi.fn();
    const emitter = createHostEventEmitter({
      callbacks: {
        ...createHostEventCallbacks(),
        onOpened,
      },
    });

    emitter.destroy?.();
    await emitter.emit("opened", createLeakyHostEventPayload());

    expect(onOpened).not.toHaveBeenCalled();
  });
});
