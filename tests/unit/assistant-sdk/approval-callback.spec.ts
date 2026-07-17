import { describe, expect, it, vi } from "vitest";
import {
  approvalCallbackAllowedFields,
  createLeakyApprovalDetailInput,
  createThrowingApprovalCallback,
  forbiddenApprovalCallbackFields,
} from "../../fixtures/assistant-sdk/approval-callback-fixtures";

type ApprovalDetailRequestedAdapter = {
  readonly requestApprovalDetail: (input: Readonly<Record<string, unknown>>) => unknown | Promise<unknown>;
};

type ApprovalDetailRequestedModule = {
  readonly createApprovalDetailRequestedAdapter: (input: {
    readonly onApprovalDetailRequested?: (payload: Readonly<Record<string, string>>) => unknown | Promise<unknown>;
  }) => ApprovalDetailRequestedAdapter;
};

async function loadApprovalDetailRequestedContract() {
  const contract = await import("../../../packages/assistant-sdk/src/events/approvalDetailRequested") as Partial<ApprovalDetailRequestedModule>;

  expect(
    typeof contract.createApprovalDetailRequestedAdapter,
    "approvalDetailRequested.ts must export createApprovalDetailRequestedAdapter.",
  ).toBe("function");

  return contract as ApprovalDetailRequestedModule;
}

describe("Frontend 002 approval detail callback IDs-only boundary", () => {
  it("requires an SDK-internal approval detail callback adapter", async () => {
    const contract = await loadApprovalDetailRequestedContract();

    expect(contract.createApprovalDetailRequestedAdapter).toBeTypeOf("function");
  });

  it("emits only approvalRequestId, sessionId, and messageId", async () => {
    const { createApprovalDetailRequestedAdapter } = await loadApprovalDetailRequestedContract();
    const onApprovalDetailRequested = vi.fn();
    const adapter = createApprovalDetailRequestedAdapter({
      onApprovalDetailRequested,
    });

    await adapter.requestApprovalDetail(createLeakyApprovalDetailInput());

    expect(onApprovalDetailRequested).toHaveBeenCalledTimes(1);
    expect(onApprovalDetailRequested).toHaveBeenCalledWith({
      approvalRequestId: "approval-001",
      messageId: "message-001",
      sessionId: "session-001",
    });
    expect(Object.keys(onApprovalDetailRequested.mock.calls[0]?.[0] ?? {}).sort()).toEqual([...approvalCallbackAllowedFields].sort());
  });

  it("does not leak URL, route, raw object, context, selectedRows, or credential fields", async () => {
    const { createApprovalDetailRequestedAdapter } = await loadApprovalDetailRequestedContract();
    const onApprovalDetailRequested = vi.fn();
    const adapter = createApprovalDetailRequestedAdapter({
      onApprovalDetailRequested,
    });

    await adapter.requestApprovalDetail(createLeakyApprovalDetailInput());

    const payload = onApprovalDetailRequested.mock.calls[0]?.[0] ?? {};
    const serialized = JSON.stringify(payload);

    for (const field of forbiddenApprovalCallbackFields) {
      expect(serialized, `Approval callback payload must not leak ${field}.`).not.toContain(field);
      expect(payload).not.toHaveProperty(field);
    }
  });

  it("does not let Host App callback throws escape the SDK boundary", async () => {
    const { createApprovalDetailRequestedAdapter } = await loadApprovalDetailRequestedContract();
    const adapter = createApprovalDetailRequestedAdapter({
      onApprovalDetailRequested: createThrowingApprovalCallback(),
    });

    await expect(adapter.requestApprovalDetail(createLeakyApprovalDetailInput())).resolves.not.toThrow();
  });
});
