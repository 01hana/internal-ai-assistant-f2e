import { describe, expect, it } from "vitest";
import {
  createAnswerCompletedEventInput,
  createApprovalDetailEventInput,
  createLeakyCallbackPayloadInput,
  forbiddenCallbackPayloadFields,
  rejectingHostCallback,
  throwingHostCallback,
} from "../../fixtures/assistant-sdk/host-callbacks-fixtures";

type CallbackRunnerContractResult =
  | {
      readonly ok: true;
      readonly emittedErrors: readonly unknown[];
    }
  | {
      readonly ok: false;
      readonly emittedErrors: readonly {
        readonly code: string;
        readonly userMessage?: string;
        readonly retryable?: boolean;
      }[];
    };

type CallbackRunnerContractModule = {
  readonly runHostCallbackSafely: (input: {
    readonly callback: () => unknown | Promise<unknown>;
    readonly eventName: string;
  }) => Promise<CallbackRunnerContractResult>;
};

type HostEventsContractModule = {
  readonly assertHostCallbackPayloadSafe: (payload: unknown) => {
    readonly ok: boolean;
    readonly error?: { readonly code: string; readonly field?: string };
  };
  readonly createHostEventPayload: (input: {
    readonly eventName: string;
    readonly payload: Readonly<Record<string, unknown>>;
  }) => Readonly<Record<string, unknown>>;
};

async function loadCallbackRunnerContract() {
  return await import("../../../packages/assistant-sdk/src/events/callbackRunner") as CallbackRunnerContractModule;
}

async function loadHostEventsContract() {
  return await import("../../../packages/assistant-sdk/src/events/hostEvents") as HostEventsContractModule;
}

describe("Frontend 002 host callback isolation", () => {
  it("isolates synchronous callback throws and emits a safe diagnostic error", async () => {
    const { runHostCallbackSafely } = await loadCallbackRunnerContract();

    const result = await runHostCallbackSafely({
      callback: throwingHostCallback,
      eventName: "opened",
    });

    expect(result.ok).toBe(false);
    expect(result.emittedErrors).toContainEqual(expect.objectContaining({
        code: "host_callback_failed",
        retryable: false,
        userMessage: "integration error",
    }));
  });

  it("isolates async callback rejections without crashing the assistant runtime", async () => {
    const { runHostCallbackSafely } = await loadCallbackRunnerContract();

    const result = await runHostCallbackSafely({
      callback: rejectingHostCallback,
      eventName: "answer-completed",
    });

    expect(result.ok).toBe(false);
    expect(result.emittedErrors).toHaveLength(1);
    expect(result.emittedErrors[0]?.code).toBe("host_callback_failed");
  });

  it("keeps callback event payloads minimal and free of raw business data", () => {
    return loadHostEventsContract().then(({ assertHostCallbackPayloadSafe, createHostEventPayload }) => {
      const payload = createHostEventPayload({
        eventName: "answer-completed",
        payload: createAnswerCompletedEventInput(),
      });

      expect(Object.keys(payload).sort()).toEqual([
        "messageId",
        "sessionId",
        "status",
      ]);
      expect(assertHostCallbackPayloadSafe(payload)).toEqual({ ok: true });
    });
  });

  it("uses IDs-only approval detail callback payloads", () => {
    return loadHostEventsContract().then(({ assertHostCallbackPayloadSafe, createHostEventPayload }) => {
      const payload = createHostEventPayload({
        eventName: "approval-detail-requested",
        payload: createApprovalDetailEventInput(),
      });

      expect(Object.keys(payload).sort()).toEqual([
        "approvalRequestId",
        "messageId",
        "sessionId",
      ]);
      expect(assertHostCallbackPayloadSafe(payload)).toEqual({ ok: true });
    });
  });

  it("does not infer Host App navigation URLs for approval detail events", () => {
    return loadHostEventsContract().then(({ createHostEventPayload }) => {
      const payload = createHostEventPayload({
        eventName: "approval-detail-requested",
        payload: createApprovalDetailEventInput(),
      });

      expect(payload).not.toHaveProperty("displayUrl");
      expect(payload).not.toHaveProperty("navigationUrl");
      expect(payload).not.toHaveProperty("routeName");
      expect(payload).not.toHaveProperty("url");
    });
  });

  it("rejects raw payload, token, credential, secret, URL, and raw row leakage", async () => {
    const { assertHostCallbackPayloadSafe } = await loadHostEventsContract();

    for (const field of forbiddenCallbackPayloadFields) {
      const result = assertHostCallbackPayloadSafe({
        ...createLeakyCallbackPayloadInput(),
        [field]: "leaky-value",
      });

      expect(result).toEqual({
        error: {
          code: "forbidden_host_callback_payload_field",
          field,
        },
        ok: false,
      });
    }
  });
});
