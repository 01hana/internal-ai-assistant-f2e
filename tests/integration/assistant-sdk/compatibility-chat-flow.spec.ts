import { describe, expect, it } from "vitest";
import {
  compatibilityMode,
  containsForbiddenCompatibilityModeField,
  requiredCompatibilityChatFlowSteps,
} from "../../fixtures/assistant-sdk/compatibility-mode-contract";

type CompatibilityChatFlowFixture = {
  readonly flowSteps: readonly string[];
  readonly integrationMode: string;
  readonly requests: readonly unknown[];
  readonly sseEvents: readonly unknown[];
};

type CompatibilityModeFixtureModule = {
  readonly createCompatibilityChatFlowFixture: () => CompatibilityChatFlowFixture;
};

const forbiddenChatFlowRequestContextKeys = [
  "pageContext",
  "selectedRows",
  "entityType",
  "entityId",
] as const;

function containsChatFlowRequestContextKey(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = containsChatFlowRequestContextKey(item);
      if (found) {
        return found;
      }
    }

    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if ((forbiddenChatFlowRequestContextKeys as readonly string[]).includes(key)) {
      return key;
    }

    const found = containsChatFlowRequestContextKey(nestedValue);
    if (found) {
      return found;
    }
  }

  return null;
}

async function loadCompatibilityModeFixture() {
  const fixture = await import("../../fixtures/assistant-sdk/compatibility-mode-fixtures") as Partial<CompatibilityModeFixtureModule>;

  expect(
    typeof fixture.createCompatibilityChatFlowFixture,
    "T078 must export createCompatibilityChatFlowFixture for Compatibility Mode chat-flow smoke tests.",
  ).toBe("function");

  return fixture as CompatibilityModeFixtureModule;
}

describe("Frontend 002 Compatibility Mode chat flow smoke", () => {
  it("covers session creation, message send, history load, and SSE streaming through the SDK path", async () => {
    const { createCompatibilityChatFlowFixture } = await loadCompatibilityModeFixture();
    const fixture = createCompatibilityChatFlowFixture();

    expect(fixture.integrationMode).toBe(compatibilityMode);

    for (const requiredStep of requiredCompatibilityChatFlowSteps) {
      expect(fixture.flowSteps, `Compatibility Mode chat flow must cover ${requiredStep}.`).toContain(requiredStep);
    }
  });

  it("keeps compatibility request shape free of Frontend 002-only and host integration authority fields", async () => {
    const { createCompatibilityChatFlowFixture } = await loadCompatibilityModeFixture();
    const fixture = createCompatibilityChatFlowFixture();

    expect(fixture.requests.length, "Compatibility Mode chat-flow smoke must include representative request surfaces.").toBeGreaterThan(0);

    for (const request of fixture.requests) {
      expect(containsForbiddenCompatibilityModeField(request)).toBeNull();
      expect(
        containsChatFlowRequestContextKey(request),
        "Compatibility Mode chat-flow request fixtures must not carry Host PageContext readiness fields.",
      ).toBeNull();
    }
  });

  it("uses the reused canonical assistant SSE stream contract without mode-specific SSE semantics", async () => {
    const { createCompatibilityChatFlowFixture } = await loadCompatibilityModeFixture();
    const fixture = createCompatibilityChatFlowFixture();

    expect(fixture.sseEvents.length, "Compatibility Mode chat-flow smoke must include SSE event surfaces.").toBeGreaterThan(0);
    expect(containsForbiddenCompatibilityModeField(fixture.sseEvents)).toBeNull();
  });
});
