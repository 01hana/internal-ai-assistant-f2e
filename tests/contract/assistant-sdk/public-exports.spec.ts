import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  forbiddenRootEntryPatterns,
  forbiddenRuntimeBridgePublicExportPatterns,
  formalPublicExportNames,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRoot = new URL("../../../", import.meta.url);
const sdkRootPath = fileURLToPath(new URL("packages/assistant-sdk", projectRoot));
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

describe("Frontend 002 SDK public exports", () => {
  it("allows Phase 1 contract checks to run before the SDK package skeleton exists", async () => {
    if (!(await pathExists(sdkRootPath))) {
      expect(await pathExists(sdkRootEntryPath), "SDK skeleton is not created yet; public exports become required once packages/assistant-sdk/src/index.ts exists.").toBe(false);
    }
  });

  it("exports every formal public SDK API name from the root entry once it exists", async () => {
    if (!(await pathExists(sdkRootEntryPath))) {
      expect(await pathExists(sdkRootPath), "SDK root entry is not created yet; skipping public export enforcement until package skeleton work.").toBe(false);
      return;
    }

    const source = await readFile(sdkRootEntryPath, "utf8");

    for (const publicName of formalPublicExportNames) {
      expect(source, `${publicName} must be reachable from the documented root public entry.`).toMatch(new RegExp(`\\b${publicName}\\b`));
    }
  });

  it("does not expose Frontend 001 internals, private runtime paths, SSE parser internals, or runtime bridge exports from the root entry", async () => {
    if (!(await pathExists(sdkRootEntryPath))) {
      expect(await pathExists(sdkRootPath), "SDK root entry is not created yet; skipping private export enforcement until package skeleton work.").toBe(false);
      return;
    }

    const source = await readFile(sdkRootEntryPath, "utf8");

    for (const forbiddenPattern of forbiddenRootEntryPatterns) {
      expect(source, `Root public entry must not expose ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
    }

    for (const forbiddenPattern of forbiddenRuntimeBridgePublicExportPatterns) {
      expect(source, "Removed legacy runtime bridges must not be public-exported.").not.toMatch(forbiddenPattern);
    }
  });
});
