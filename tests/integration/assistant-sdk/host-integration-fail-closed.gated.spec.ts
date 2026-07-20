import { describe, expect, it } from "vitest";
import {
  containsForbiddenHostIntegrationFrontendField,
  hostIntegrationMode,
  requiredHostIntegrationFailClosedCases,
} from "../../fixtures/assistant-sdk/host-integration-gated-contract";
import { describeHostIntegrationGated } from "../../fixtures/assistant-sdk/host-integration-gated-env";
import { createHostIntegrationFailClosedFixture } from "../../fixtures/assistant-sdk/host-integration-contract-fixtures";

type HostIntegrationFailClosedCase = {
  readonly diagnostics?: readonly unknown[];
  readonly name: string;
  readonly requestSent: boolean;
  readonly safeOutcome: string;
  readonly transportExecuted: boolean;
};

describeHostIntegrationGated("Frontend 002 Host Integration fail-closed smoke", () => {
  it("covers all required missing-context and invalid selectedRows cases", () => {
    const fixture = createHostIntegrationFailClosedFixture();

    expect(fixture.integrationMode).toBe(hostIntegrationMode);

    const caseNames = fixture.cases.map((testCase: HostIntegrationFailClosedCase) => testCase.name);
    for (const requiredCase of requiredHostIntegrationFailClosedCases) {
      expect(caseNames, `Host Integration fail-closed smoke must cover ${requiredCase}.`).toContain(requiredCase);
    }
  });

  it("fails closed without sending requests or executing transport for invalid context", () => {
    const fixture = createHostIntegrationFailClosedFixture();

    for (const testCase of fixture.cases as readonly HostIntegrationFailClosedCase[]) {
      expect(testCase.requestSent, `${testCase.name} must not send a request.`).toBe(false);
      expect(testCase.transportExecuted, `${testCase.name} must not execute transport.`).toBe(false);
      expect(testCase.safeOutcome, `${testCase.name} must expose a safe context-resolution failure.`).toBe("context-resolution-failed");
      expect(containsForbiddenHostIntegrationFrontendField(testCase.diagnostics ?? [])).toBeNull();
    }
  });

  it("does not use Compatibility Mode fallback for Host Integration mode", () => {
    const fixture = createHostIntegrationFailClosedFixture();

    expect(fixture.compatibilityFallbackUsed).toBe(false);
    expect(containsForbiddenHostIntegrationFrontendField(fixture.outgoingSurfaces ?? [])).toBeNull();
  });
});
