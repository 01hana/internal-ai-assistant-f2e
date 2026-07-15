import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  forbiddenPackageExports,
  forbiddenRootEntryPatterns,
  forbiddenRuntimeBridgePublicExportPatterns,
  formalPublicExportNames,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const sdkRootPath = fileURLToPath(new URL("packages/assistant-sdk", projectRoot));
const sdkPackageJsonPath = join(sdkRootPath, "package.json");
const sdkRootEntryPath = join(sdkRootPath, "src/index.ts");

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
  const files = (await collectFiles(sdkRootPath))
    .filter(file => /\.(ts|vue|json)$/.test(file));

  return Promise.all(
    files.map(async file => ({
      file,
      relativePath: relative(projectRootPath, file),
      source: await readFile(file, "utf8"),
    })),
  );
}

describe("Frontend 002 SDK public boundary guardrails", () => {
  it("allows Phase 0 to run before the SDK package exists while keeping the future package path reserved", async () => {
    expect(await pathExists(fileURLToPath(new URL("app/features/assistant/components/ChatWidget.vue", projectRoot)))).toBe(true);
    expect(await pathExists(fileURLToPath(new URL("app/utils/assistant/assistantSseParser.ts", projectRoot)))).toBe(true);

    if (!(await pathExists(sdkRootPath))) {
      expect(await readSdkSources()).toEqual([]);
    }
  });

  it("keeps the package root entry limited to formal public API names when it exists", async () => {
    if (!(await pathExists(sdkRootEntryPath))) {
      expect(await pathExists(sdkRootPath)).toBe(false);
      return;
    }

    const source = await readFile(sdkRootEntryPath, "utf8");

    for (const publicName of formalPublicExportNames) {
      expect(source, publicName).toMatch(new RegExp(`\\b${publicName}\\b`));
    }

    for (const forbiddenPattern of forbiddenRootEntryPatterns) {
      expect(source).not.toMatch(forbiddenPattern);
    }

    for (const forbiddenPattern of forbiddenRuntimeBridgePublicExportPatterns) {
      expect(source).not.toMatch(forbiddenPattern);
    }
  });

  it("does not expose private source, runtime, stores, composables, transport, or component deep imports", async () => {
    if (!(await pathExists(sdkPackageJsonPath))) {
      expect(await pathExists(sdkRootPath)).toBe(false);
      return;
    }

    const packageJson = JSON.parse(await readFile(sdkPackageJsonPath, "utf8")) as {
      exports?: Record<string, unknown> | string[];
    };
    const exportsField = packageJson.exports ?? {};
    const exportKeys = Array.isArray(exportsField)
      ? exportsField
      : Object.keys(exportsField);

    expect(exportKeys).toContain(".");
    expect(exportKeys).toContain("./styles.css");

    for (const forbiddenExport of forbiddenPackageExports) {
      expect(exportKeys).not.toContain(forbiddenExport);
    }
  });
});
