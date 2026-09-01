import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allowedFrontendModeTerms,
  forbiddenModeBoundaryPatterns,
  frontendIntegrationModes,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const sdkSourcePath = fileURLToPath(new URL("packages/assistant-sdk/src", projectRoot));

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  }
  catch {
    return false;
  }
}

async function collectFiles(directory: string): Promise<string[]> {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }

      return [entryPath];
    }),
  );

  return files.flat();
}

async function readSdkSources() {
  const files = (await collectFiles(sdkSourcePath))
    // sessionBootstrap owns SDK-local namespace policy; sessionScope is not a wire field.
    .filter(file => /\.(ts|vue)$/.test(file) && !file.endsWith("/session/sessionBootstrap.ts"));

  return Promise.all(
    files.map(async file => ({
      file,
      relativePath: relative(projectRootPath, file),
      source: await readFile(file, "utf8"),
    })),
  );
}

describe("Frontend 002 mode boundary guardrails", () => {
  it("treats formal modes as frontend integration, request-builder, and provider-validation modes only", () => {
    expect(frontendIntegrationModes).toEqual([
      "Backend 001 Compatibility Mode",
      "Backend 002 Mode",
      "Gateway-v1 Mode",
    ]);
    expect(allowedFrontendModeTerms).toEqual([
      "integrationMode",
      "requestBuilderMode",
      "providerValidationMode",
    ]);
  });

  it("does not create backend request modes, nested hostContext, backend sessionScope, mode-specific endpoints, SSE parsers, envelopes, or package backend proxy", async () => {
    const sourceFiles = await readSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      for (const forbiddenPattern of forbiddenModeBoundaryPatterns) {
        expect(source, relativePath).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("keeps Backend 001 public assistant routes as the existing backend route surface", async () => {
    const contract = await readFile(
      new URL(
        "docs/contracts/backend-assistant-core/assistant-api-contract.md",
        projectRoot,
      ),
      "utf8",
    );

    expect(contract).toContain("POST /api/v1/assistant/sessions/:sessionId/messages");
    expect(contract).not.toContain("backend request mode");
    expect(contract).not.toContain("nested `hostContext`");
    expect(contract).not.toContain("backend `sessionScope`");
  });
});
