import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  forbiddenLegacyRuntimeBridgeSymbols,
  forbiddenPackageExports,
  legacyRuntimeBridgeClassification,
  removedLegacyRuntimeBridgeFilePaths,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const sdkSourceRoot = path.join(repoRoot, "packages/assistant-sdk/src");
const sdkPackageJsonPath = path.join(repoRoot, "packages/assistant-sdk/package.json");
const sdkRootEntryPath = path.join(repoRoot, "packages/assistant-sdk/src/index.ts");

const validInternalAdapterPaths = [
  "packages/assistant-sdk/src/runtime/sdkRuntimeAdapter.ts",
  "packages/assistant-sdk/src/transport/defaultTransport.ts",
  "packages/assistant-sdk/src/session/sessionLifecycle.ts",
  "packages/assistant-sdk/src/lifecycle/mountHandle.ts",
  "packages/assistant-sdk/src/context/contextResolution.ts",
  "packages/assistant-sdk/src/events/hostEventEmitter.ts",
] as const;

type SourceSnapshot = {
  path: string;
  exists: boolean;
  source: string;
};

function relativeToRepo(file: string): string {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const absolute = path.join(dir, entry);
    const stats = statSync(absolute);

    if (stats.isDirectory()) {
      return listSourceFiles(absolute);
    }

    return /\.(ts|tsx|vue)$/.test(entry) ? [absolute] : [];
  });
}

function readSourceGraph(): SourceSnapshot[] {
  return listSourceFiles(sdkSourceRoot).map((file) => ({
    path: relativeToRepo(file),
    exists: true,
    source: readFileSync(file, "utf8"),
  }));
}

function hasAppSourceImport(source: string): boolean {
  return /\bfrom\s+["'][^"']*app\//.test(source) || /\bimport\s*\([^)]*["'][^"']*app\//.test(source);
}

function containsLegacyBridgeSymbol(source: string): boolean {
  return forbiddenLegacyRuntimeBridgeSymbols.some((symbol) => new RegExp(`\\b${symbol}\\b`).test(source));
}

function evaluateLegacyBridgeGraph(snapshots: readonly SourceSnapshot[]) {
  const existingLegacyFiles = removedLegacyRuntimeBridgeFilePaths.filter((relativePath) =>
    snapshots.some((snapshot) => snapshot.exists && snapshot.path === relativePath),
  );
  const appSourceImports = snapshots
    .filter((snapshot) => snapshot.exists && hasAppSourceImport(snapshot.source))
    .map((snapshot) => snapshot.path);
  const legacySymbolReferences = snapshots
    .filter((snapshot) => snapshot.exists && containsLegacyBridgeSymbol(snapshot.source))
    .map((snapshot) => snapshot.path);

  return {
    ok: existingLegacyFiles.length === 0 && appSourceImports.length === 0 && legacySymbolReferences.length === 0,
    violations: [
      ...existingLegacyFiles.map((sourcePath) => `${sourcePath} still exists`),
      ...legacySymbolReferences.map((sourcePath) => `${sourcePath} references removed legacy bridge symbol`),
      ...appSourceImports.map((sourcePath) => `${sourcePath} imports app/**`),
    ],
  };
}

describe("legacy SDK bridge source graph", () => {
  it("validates the actual repository target state after T137 removal", () => {
    expect(legacyRuntimeBridgeClassification).toEqual({
      status: "removed",
      terminalTask: "T137",
      terminalState: "legacy SDK app-source bridges must be absent; active SDK runtime imports must use SDK adapters over Shared Canonical Assistant Runtime",
    });

    const result = evaluateLegacyBridgeGraph(readSourceGraph());

    expect(result).toEqual({
      ok: true,
      violations: [],
    });
  });

  it("requires every legacy bridge file to be absent", () => {
    for (const bridgePath of removedLegacyRuntimeBridgeFilePaths) {
      expect(existsSync(path.join(repoRoot, bridgePath)), `${bridgePath} must be deleted in T137.`).toBe(false);
    }
  });

  it("keeps T134-T136 SDK adapter paths as the valid internal implementation route", () => {
    for (const adapterPath of validInternalAdapterPaths) {
      expect(existsSync(path.join(repoRoot, adapterPath)), `${adapterPath} must exist as the post-bridge SDK adapter path.`).toBe(true);
    }
  });

  it("rejects target snapshots that keep bridge files, bridge symbols, or app imports", () => {
    const result = evaluateLegacyBridgeGraph([
      {
        path: "packages/assistant-sdk/src/runtime/frontend001Runtime.ts",
        exists: true,
        source: "export const frontend001Runtime = {};",
      },
      {
        path: "packages/assistant-sdk/src/runtime/sdkRuntimeAdapter.ts",
        exists: true,
        source: "import ChatWidget from '../../../../app/features/assistant/components/ChatWidget.vue'; export const adapter = chatWidgetAdapter;",
      },
    ]);

    expect(result).toEqual({
      ok: false,
      violations: [
        "packages/assistant-sdk/src/runtime/frontend001Runtime.ts still exists",
        "packages/assistant-sdk/src/runtime/frontend001Runtime.ts references removed legacy bridge symbol",
        "packages/assistant-sdk/src/runtime/sdkRuntimeAdapter.ts references removed legacy bridge symbol",
        "packages/assistant-sdk/src/runtime/sdkRuntimeAdapter.ts imports app/**",
      ],
    });
  });

  it("keeps SDK public root and package exports free of runtime internals", () => {
    const rootEntry = readFileSync(sdkRootEntryPath, "utf8");
    const packageJson = JSON.parse(readFileSync(sdkPackageJsonPath, "utf8")) as {
      exports?: Record<string, unknown> | string[];
    };
    const exportsField = packageJson.exports ?? {};
    const exportKeys = Array.isArray(exportsField) ? exportsField : Object.keys(exportsField);

    for (const symbol of forbiddenLegacyRuntimeBridgeSymbols) {
      expect(rootEntry, `Root entry must not export removed bridge symbol ${symbol}.`).not.toMatch(new RegExp(`\\b${symbol}\\b`));
    }

    for (const forbiddenExport of forbiddenPackageExports) {
      expect(exportKeys, `Package exports must not expose ${forbiddenExport}.`).not.toContain(forbiddenExport);
    }
  });
});
