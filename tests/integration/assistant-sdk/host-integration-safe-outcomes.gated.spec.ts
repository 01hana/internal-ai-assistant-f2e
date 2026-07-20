import { expect, it } from "vitest";
import {
  containsForbiddenHostIntegrationFrontendField,
  hostIntegrationMode,
  requiredHostIntegrationSafeOutcomes,
} from "../../fixtures/assistant-sdk/host-integration-gated-contract";
import { describeHostIntegrationGated } from "../../fixtures/assistant-sdk/host-integration-gated-env";
import { createHostIntegrationSafeOutcomesFixture } from "../../fixtures/assistant-sdk/host-integration-contract-fixtures";

describeHostIntegrationGated("Frontend 002 Host Integration safe outcome smoke", () => {
  it("consumes all required host-aware safe outcomes through the SDK rendering path", () => {
    const fixture = createHostIntegrationSafeOutcomesFixture();

    expect(fixture.integrationMode).toBe(hostIntegrationMode);

    for (const requiredOutcome of requiredHostIntegrationSafeOutcomes) {
      expect(fixture.outcomes, `Host Integration safe outcome smoke must cover ${requiredOutcome}.`).toContain(requiredOutcome);
    }
  });

  it("renders only permission-safe evidence and backend-derived safe metadata", () => {
    const fixture = createHostIntegrationSafeOutcomesFixture();

    expect(containsForbiddenHostIntegrationFrontendField(fixture.renderedSurfaces)).toBeNull();
    expect(containsForbiddenHostIntegrationFrontendField(fixture.safeMetadata)).toBeNull();
    expect(containsForbiddenHostIntegrationFrontendField(fixture.hiddenRawFields)).not.toBeNull();
  });

  it("does not generate approval navigation URLs or infer frontend-owned source metadata", () => {
    const fixture = createHostIntegrationSafeOutcomesFixture();

    expect(fixture.approvalNavigationGeneratedByFrontend).toBe(false);
    expect(fixture.frontendSourceInferenceUsed).toBe(false);
    expect(fixture.reusesCanonicalRenderingRuntime).toBe(true);
    expect(containsForbiddenHostIntegrationFrontendField(fixture.sseFinalOutcome)).toBeNull();
  });
});
