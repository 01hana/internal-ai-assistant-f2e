import { describe, expect, it } from "vitest";
import {
  compatibilityMode,
  containsForbiddenCompatibilityModeField,
  requiredCompatibilityRenderingOutcomes,
} from "../../fixtures/assistant-sdk/compatibility-mode-contract";

type CompatibilityRenderingFlowFixture = {
  readonly integrationMode: string;
  readonly renderedOutcomes: readonly string[];
  readonly reusedRuntimeOwners: readonly string[];
  readonly renderingSurfaces: readonly unknown[];
};

type CompatibilityModeFixtureModule = {
  readonly createCompatibilityRenderingFlowFixture: () => CompatibilityRenderingFlowFixture;
};

async function loadCompatibilityModeFixture() {
  const fixture = await import("../../fixtures/assistant-sdk/compatibility-mode-fixtures") as Partial<CompatibilityModeFixtureModule>;

  expect(
    typeof fixture.createCompatibilityRenderingFlowFixture,
    "T078 must export createCompatibilityRenderingFlowFixture for Compatibility Mode rendering smoke tests.",
  ).toBe("function");

  return fixture as CompatibilityModeFixtureModule;
}

describe("Frontend 002 Compatibility Mode rendering smoke", () => {
  it("renders compatibility answers, evidence, feedback, and safe outcomes through reused canonical assistant runtime", async () => {
    const { createCompatibilityRenderingFlowFixture } = await loadCompatibilityModeFixture();
    const fixture = createCompatibilityRenderingFlowFixture();

    expect(fixture.integrationMode).toBe(compatibilityMode);

    for (const outcome of requiredCompatibilityRenderingOutcomes) {
      expect(fixture.renderedOutcomes, `Compatibility Mode rendering smoke must cover ${outcome}.`).toContain(outcome);
    }
  });

  it("does not introduce SDK-owned AnswerDecision, EvidenceRef, feedback, action, or approval rendering runtime", async () => {
    const { createCompatibilityRenderingFlowFixture } = await loadCompatibilityModeFixture();
    const fixture = createCompatibilityRenderingFlowFixture();

    expect(fixture.reusedRuntimeOwners).toContain("app/utils/assistant/answerDecisionStateMapper.ts");
    expect(fixture.reusedRuntimeOwners).toContain("app/utils/assistant/assistantMessageRendererResolver.ts");
    expect(fixture.reusedRuntimeOwners).toContain("app/utils/assistant/evidenceNormalizationAdapter.ts");
    expect(fixture.reusedRuntimeOwners).not.toContain("packages/assistant-sdk/src/runtime/answerDecisionMapper.ts");
    expect(fixture.reusedRuntimeOwners).not.toContain("packages/assistant-sdk/src/runtime/evidenceRenderer.ts");
    expect(fixture.reusedRuntimeOwners).not.toContain("packages/assistant-sdk/src/runtime/feedbackRuntime.ts");
  });

  it("keeps rendering smoke surfaces free of host integration authority and secret fields", async () => {
    const { createCompatibilityRenderingFlowFixture } = await loadCompatibilityModeFixture();
    const fixture = createCompatibilityRenderingFlowFixture();

    expect(fixture.renderingSurfaces.length, "Compatibility Mode rendering smoke must include representative rendering surfaces.").toBeGreaterThan(0);
    expect(containsForbiddenCompatibilityModeField(fixture.renderingSurfaces)).toBeNull();
  });
});
