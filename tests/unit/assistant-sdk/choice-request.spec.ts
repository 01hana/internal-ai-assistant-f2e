import { describe, expect, it } from "vitest";
import { buildAssistantRequest } from "../../../packages/assistant-sdk/src/request/requestBuilder";

/** Frontend 003 Phase 1 (T006): message and choiceId are mutually exclusive in every built-in request profile. */
describe("message or choice request (Frontend 003)", () => {
  const modes = ["backend001-compatibility", "gateway-v1"] as const;

  it.each(modes)("%s: builds a choice request without a message", (integrationMode) => {
    const result = buildAssistantRequest({
      choiceId: "order-status-10001",
      hostContext: { pageContext: { module: "orders" } },
      integrationMode,
      sessionId: "session-001",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.choiceId).toBe("order-status-10001");
    expect(result.request).not.toHaveProperty("message");
  });

  it.each(modes)("%s: still builds a typed message request", (integrationMode) => {
    const result = buildAssistantRequest({ integrationMode, message: "查詢訂單", sessionId: "session-001" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.message).toBe("查詢訂單");
    expect(result.request).not.toHaveProperty("choiceId");
  });

  it.each(modes)("%s: rejects both, neither, or a malformed choice ID", (integrationMode) => {
    for (const input of [
      { message: "查詢訂單", choiceId: "overview" },
      {},
      { choiceId: "Not Valid!" },
      { choiceId: 7 },
      { message: 7 },
    ]) {
      const result = buildAssistantRequest({ ...input, integrationMode, sessionId: "session-001" });
      expect(result.ok, JSON.stringify(input)).toBe(false);
    }
  });

  it("does not support choices in backend002", () => {
    expect(buildAssistantRequest({ choiceId: "overview", integrationMode: "backend002" }).ok).toBe(false);
  });
});
