import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allowedPackageExportKeys,
  forbiddenPackageExportKeys,
  forbiddenPackageArtifactPathPatterns,
  sdkPackageManifest,
  sdkPackageName,
} from "../../fixtures/assistant-sdk/release-readiness-contract";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);

describe("Frontend 002 SDK package release exports", () => {
  it("exports only the documented public root and stylesheet entries", async () => {
    const manifest = JSON.parse(await readFile(join(projectRootPath, sdkPackageManifest), "utf8")) as {
      exports?: Record<string, unknown>;
      files?: string[];
      name?: string;
    };
    const exportKeys = Object.keys(manifest.exports ?? {});

    expect(manifest.name).toBe(sdkPackageName);
    expect(exportKeys.sort()).toEqual([...allowedPackageExportKeys].sort());

    for (const forbiddenExport of forbiddenPackageExportKeys) {
      expect(exportKeys, `Package must not expose ${forbiddenExport}.`).not.toContain(forbiddenExport);
    }

    expect(manifest.files?.sort()).toEqual(["dist", "README.md", "styles.css"].sort());
  });

  it("does not point public exports at private SDK source, fixtures, tests, specs, or canonical app paths", async () => {
    const manifest = JSON.parse(await readFile(join(projectRootPath, sdkPackageManifest), "utf8")) as {
      exports?: Record<string, unknown>;
    };
    const serializedExports = JSON.stringify(manifest.exports ?? {});

    for (const forbiddenPattern of forbiddenPackageArtifactPathPatterns) {
      expect(serializedExports, `Package exports must not reference ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
    }
  });
});
