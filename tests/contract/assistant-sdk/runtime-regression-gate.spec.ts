import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  requiredRuntimeRegressionCategories,
  runtimeRegressionGate,
} from "../../fixtures/assistant-sdk/runtime-regression-gate";
import {
  approvedRuntimeBridgeFilePatterns,
  forbiddenDuplicateRuntimeFilePatterns,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRootPath = fileURLToPath(new URL("../../../", import.meta.url));
const sdkSourceRoot = join(projectRootPath, "packages/assistant-sdk/src");

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
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  }));

  return files.flat();
}

function isApprovedRuntimeBridge(relativePath: string) {
  return approvedRuntimeBridgeFilePatterns.some(pattern => pattern.test(relativePath));
}

describe("Frontend 002 canonical assistant runtime regression gate manifest", () => {
  it("lists every critical canonical assistant runtime regression category required before SDK release", () => {
    const categories = runtimeRegressionGate.map(entry => entry.category);

    for (const category of requiredRuntimeRegressionCategories) {
      expect(categories, `Canonical assistant runtime regression gate must include ${category}.`).toContain(category);
    }
  });

  it("points present entries at real canonical assistant runtime test files and marks gaps honestly", async () => {
    for (const entry of runtimeRegressionGate) {
      expect(entry.paths.length, `${entry.category} must list at least one path or an explicit missing entry.`).toBeGreaterThan(0);

      if (entry.status === "present") {
        for (const path of entry.paths) {
          expect(await pathExists(join(projectRootPath, path)), `${entry.category} path ${path} must exist.`).toBe(true);
        }
      }
      else {
        expect(entry.required, `${entry.category} missing entries must not be marked required.`).toBe(false);
        expect(entry.missingReason, `${entry.category} missing entries need an explicit reason.`).toBeTruthy();
      }
    }
  });

  it("documents focused commands or patterns instead of executing the full canonical runtime suite by default", () => {
    for (const entry of runtimeRegressionGate) {
      expect(entry.command, `${entry.category} must define a focused command or pattern.`).toMatch(/^npm run test:(unit|component|contract) -- /);
      expect(entry.command).not.toBe("npm run test");
      expect(entry.command).not.toBe("npm run test:unit");
      expect(entry.command).not.toBe("npm run test:component");
      expect(entry.command).not.toBe("npm run test:contract");
    }
  });

  it("keeps canonical runtime regression coverage as references rather than copied SDK runtime tests", async () => {
    const files = await collectFiles(sdkSourceRoot);

    for (const file of files) {
      const relativePath = relative(projectRootPath, file);

      if (isApprovedRuntimeBridge(relativePath)) {
        continue;
      }

      for (const forbiddenPattern of forbiddenDuplicateRuntimeFilePatterns) {
        expect(
          basename(file),
          `${relativePath} must not copy canonical assistant runtime ownership into SDK source.`,
        ).not.toMatch(forbiddenPattern);
      }

      const source = await readFile(file, "utf8");
      expect(source, `${relativePath} must not embed canonical runtime test suite execution.`).not.toContain("npm run test");
    }
  });
});
