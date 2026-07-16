import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { forbiddenPackageExports } from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRoot = new URL("../../../", import.meta.url);
const sdkRootPath = fileURLToPath(new URL("packages/assistant-sdk", projectRoot));
const sdkPackageJsonPath = join(sdkRootPath, "package.json");
const sdkStylesheetPath = join(sdkRootPath, "styles.css");

const forbiddenStyleWorkaroundExports = [
  "./src/styles",
  "./src/styles.css",
  "./src/style",
  "./src/style.css",
  "./components/styles",
  "./components/styles.css",
] as const;

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  }
  catch {
    return false;
  }
}

function collectExportKeys(exportsField: unknown): string[] {
  if (Array.isArray(exportsField)) {
    return exportsField.filter((entry): entry is string => typeof entry === "string");
  }

  if (exportsField && typeof exportsField === "object") {
    return Object.keys(exportsField);
  }

  if (typeof exportsField === "string") {
    return ["."];
  }

  return [];
}

describe("Frontend 002 SDK stylesheet public entry", () => {
  it("allows Phase 1 contract checks to run before the SDK package skeleton exists", async () => {
    if (!(await pathExists(sdkRootPath))) {
      expect(await pathExists(sdkPackageJsonPath), "SDK package manifest is not created yet; stylesheet export becomes required once package skeleton exists.").toBe(false);
      expect(await pathExists(sdkStylesheetPath), "SDK stylesheet is not created yet; styles.css becomes required once package skeleton exists.").toBe(false);
    }
  });

  it("exports the explicit public stylesheet entry once the SDK package exists", async () => {
    if (!(await pathExists(sdkPackageJsonPath))) {
      expect(await pathExists(sdkRootPath), "SDK package manifest is not created yet; skipping stylesheet export enforcement until package skeleton work.").toBe(false);
      return;
    }

    const packageJson = JSON.parse(await readFile(sdkPackageJsonPath, "utf8")) as {
      exports?: unknown;
    };
    const exportKeys = collectExportKeys(packageJson.exports);

    expect(exportKeys, "Package exports must expose @internal-ai-assistant/assistant-sdk/styles.css via ./styles.css.").toContain("./styles.css");
    expect(await pathExists(sdkStylesheetPath), "The public stylesheet entry packages/assistant-sdk/styles.css must exist.").toBe(true);
  });

  it("does not expose private source, component, runtime, transport, store, or style workaround deep imports", async () => {
    if (!(await pathExists(sdkPackageJsonPath))) {
      expect(await pathExists(sdkRootPath), "SDK package manifest is not created yet; skipping private export enforcement until package skeleton work.").toBe(false);
      return;
    }

    const packageJson = JSON.parse(await readFile(sdkPackageJsonPath, "utf8")) as {
      exports?: unknown;
    };
    const exportKeys = collectExportKeys(packageJson.exports);

    for (const forbiddenExport of forbiddenPackageExports) {
      expect(exportKeys, `Package exports must not expose private deep import ${forbiddenExport}.`).not.toContain(forbiddenExport);
    }

    for (const forbiddenExport of forbiddenStyleWorkaroundExports) {
      expect(exportKeys, `Package exports must use ./styles.css instead of private style workaround ${forbiddenExport}.`).not.toContain(forbiddenExport);
    }
  });
});
