import { expect, it } from "vitest";
import {
  containsForbiddenHostIntegrationFrontendField,
  hostIntegrationMode,
  requiredHostIntegrationSanitizedContextSignals,
} from "../../fixtures/assistant-sdk/host-integration-gated-contract";
import { describeHostIntegrationGated } from "../../fixtures/assistant-sdk/host-integration-gated-env";
import { createHostIntegrationSanitizedContextFixture } from "../../fixtures/assistant-sdk/host-integration-contract-fixtures";

describeHostIntegrationGated("Frontend 002 Host Integration sanitized context smoke", () => {
  it("submits sanitized context signals without frontend-owned authority fields", () => {
    const fixture = createHostIntegrationSanitizedContextFixture();

    expect(fixture.integrationMode).toBe(hostIntegrationMode);

    for (const requiredSignal of requiredHostIntegrationSanitizedContextSignals) {
      expect(fixture.contextSignals, `Host Integration sanitized context smoke must cover ${requiredSignal}.`).toContain(requiredSignal);
    }

    expect(containsForbiddenHostIntegrationFrontendField(fixture.sanitizedPageContext)).toBeNull();
    expect(containsForbiddenHostIntegrationFrontendField(fixture.outgoingRequest)).toBeNull();
  });

  it("keeps selectedRows bounded and non-authoritative", () => {
    const fixture = createHostIntegrationSanitizedContextFixture();

    expect(Array.isArray(fixture.sanitizedPageContext.selectedRows)).toBe(true);
    expect(fixture.sanitizedPageContext.selectedRows.length).toBeLessThanOrEqual(20);
    expect(fixture.selectedRowsUsedAsIdentityProof).toBe(false);
  });

  it("does not inject host context into hidden prompts or message text", () => {
    const fixture = createHostIntegrationSanitizedContextFixture();

    expect(fixture.hiddenPrompt).toBeUndefined();
    expect(containsForbiddenHostIntegrationFrontendField(fixture.messageText)).toBeNull();
    expect(containsForbiddenHostIntegrationFrontendField(fixture.localOnlySurfaces)).toBeNull();
  });
});
