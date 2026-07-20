import { describe } from "vitest";

export const hostIntegrationGatedEnvFlag = "RUN_HOST_INTEGRATION_GATED_TESTS";

export function isHostIntegrationGatedEnabled(): boolean {
  return process.env[hostIntegrationGatedEnvFlag] === "true";
}

export function describeHostIntegrationGated(title: string, suite: () => void): void {
  if (isHostIntegrationGatedEnabled()) {
    describe(title, suite);
    return;
  }

  describe.skip(
    `${title} [skipped: set ${hostIntegrationGatedEnvFlag}=true to run Host Integration gated smoke tests]`,
    suite,
  );
}
