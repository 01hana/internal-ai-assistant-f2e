import { describe, expect, it } from "vitest";
import {
  compatibilityMode,
  containsForbiddenCompatibilityModeField,
  forbiddenReferenceConsumerReadinessImports,
  requiredReferenceConsumerReadinessSignals,
} from "../../fixtures/assistant-sdk/compatibility-mode-contract";

type ReferenceConsumerReadinessFixture = {
  readonly backend002Required: boolean;
  readonly imports: readonly string[];
  readonly integrationMode: string;
  readonly localOnlySurfaces: readonly unknown[];
  readonly publicSignals: readonly string[];
  readonly sanitizedPageContext: unknown;
  readonly sessionLifecycle: {
    readonly initialized: boolean;
    readonly cleanedUp: boolean;
  };
};

type CompatibilityModeFixtureModule = {
  readonly createCompatibilityReferenceConsumerReadinessFixture: () => ReferenceConsumerReadinessFixture;
};

async function loadCompatibilityModeFixture() {
  const fixture = await import("../../fixtures/assistant-sdk/compatibility-mode-fixtures") as Partial<CompatibilityModeFixtureModule>;

  expect(
    typeof fixture.createCompatibilityReferenceConsumerReadinessFixture,
    "T078 must export createCompatibilityReferenceConsumerReadinessFixture for reference consumer readiness smoke tests.",
  ).toBe("function");

  return fixture as CompatibilityModeFixtureModule;
}

describe("Frontend 002 reference consumer Compatibility Mode readiness smoke", () => {
  it("uses public SDK entries only and does not deep-import SDK or canonical runtime internals", async () => {
    const { createCompatibilityReferenceConsumerReadinessFixture } = await loadCompatibilityModeFixture();
    const fixture = createCompatibilityReferenceConsumerReadinessFixture();

    expect(fixture.imports).toContain("@internal-ai-assistant/assistant-sdk");
    expect(fixture.imports).toContain("@internal-ai-assistant/assistant-sdk/styles.css");

    for (const forbiddenImport of forbiddenReferenceConsumerReadinessImports) {
      expect(fixture.imports.some(importPath => importPath.startsWith(forbiddenImport))).toBe(false);
    }
  });

  it("covers provider, configuration, callbacks, session lifecycle, and Compatibility Mode without host integration", async () => {
    const { createCompatibilityReferenceConsumerReadinessFixture } = await loadCompatibilityModeFixture();
    const fixture = createCompatibilityReferenceConsumerReadinessFixture();

    expect(fixture.integrationMode).toBe(compatibilityMode);
    expect(fixture.backend002Required).toBe(false);
    expect(fixture.sessionLifecycle).toEqual({
      cleanedUp: true,
      initialized: true,
    });

    for (const signal of requiredReferenceConsumerReadinessSignals) {
      expect(fixture.publicSignals, `Reference consumer readiness smoke must cover ${signal}.`).toContain(signal);
    }
  });

  it("keeps PageContext sanitized and local-only configuration/callbacks out of compatibility request surfaces", async () => {
    const { createCompatibilityReferenceConsumerReadinessFixture } = await loadCompatibilityModeFixture();
    const fixture = createCompatibilityReferenceConsumerReadinessFixture();

    expect(containsForbiddenCompatibilityModeField(fixture.sanitizedPageContext)).toBeNull();
    expect(containsForbiddenCompatibilityModeField(fixture.localOnlySurfaces)).toBeNull();
  });
});
