import { describe, expect, it } from "vitest";
import {
  assistantRuntimeTransportOperationNames,
  assistantRuntimeTransportOwnership,
  type AssistantRuntimeTransportPort
} from "../../../packages/assistant-runtime/src/transport/ports";

function createTestTransportPort(): AssistantRuntimeTransportPort {
  return {
    async createSession() {
      return { ok: true, value: { sessionId: "session-1" } };
    },
    async getSession(input) {
      return { ok: true, value: { sessionId: input.sessionId } };
    },
    async loadHistory(input) {
      return { ok: true, value: { sessionId: input.sessionId, messages: [] } };
    },
    async sendMessage(input) {
      return {
        ok: true,
        value: {
          messageId: "message-1",
          sessionId: input.sessionId ?? "session-1",
          status: "queued"
        }
      };
    },
    async streamMessage() {
      return { ok: true, value: new ReadableStream<Uint8Array>() };
    },
    async cancelMessage() {
      return { ok: true, value: { cancelled: true } };
    },
    async abortMessage() {
      return { ok: true, value: { aborted: true } };
    },
    async submitFeedback() {
      return { ok: true, value: { accepted: true } };
    },
    async confirmAction() {
      return { ok: true, value: { confirmed: true } };
    },
    async rejectAction() {
      return { ok: true, value: { rejected: true } };
    },
    async loadApprovalRequest(input) {
      return { ok: true, value: { approvalRequestId: input.approvalRequestId } };
    }
  };
}

describe("assistant runtime transport port foundation", () => {
  it("keeps create/message/cancel operations universal while remote restoration is optional", () => {
    expect(assistantRuntimeTransportOperationNames).toEqual([
      "createSession",
      "sendMessage",
      "streamMessage",
      "cancelMessage",
      "abortMessage",
      "submitFeedback",
      "confirmAction",
      "rejectAction",
      "loadApprovalRequest"
    ]);
  });

  it("keeps adapter ownership separate from canonical runtime behavior ownership", () => {
    expect(assistantRuntimeTransportOwnership.sharedRuntimeOwns).toContain("canonical SSE consumption");
    expect(assistantRuntimeTransportOwnership.frontend001AdapterOwns).toContain("Nuxt HTTP/auth/headers");
    expect(assistantRuntimeTransportOwnership.frontend002AdapterOwns).toContain("request builder");
    expect(assistantRuntimeTransportOwnership.forbiddenAdapterOwnership).toContain("SSE parser");
    expect(assistantRuntimeTransportOwnership.forbiddenAdapterOwnership).toContain("canonical session state machine");
  });

  it("is implementable without endpoint, envelope, route, or parser ownership", async () => {
    const port = createTestTransportPort();

    await expect(port.createSession({})).resolves.toEqual({
      ok: true,
      value: { sessionId: "session-1" }
    });
    await expect(port.getSession?.({ sessionId: "session-1" })).resolves.toEqual({
      ok: true,
      value: { sessionId: "session-1" },
    });
    await expect(port.streamMessage({ message: "hello" })).resolves.toMatchObject({
      ok: true
    });
    await expect(
      port.loadApprovalRequest({
        sessionId: "session-1",
        messageId: "message-1",
        approvalRequestId: "approval-1"
      })
    ).resolves.toEqual({
      ok: true,
      value: { approvalRequestId: "approval-1" }
    });

    expect(assistantRuntimeTransportOperationNames.join(" ")).not.toMatch(
      /endpoint|route|requestEnvelope|parseSse|parseAssistantSse|createSseParser/i
    );
  });
});
