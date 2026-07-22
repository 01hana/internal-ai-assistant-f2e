import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const sdkSourceRoot = path.join(repoRoot, "packages/assistant-sdk/src");
const sharedRuntimeSourceRoot = path.join(repoRoot, "packages/assistant-runtime/src");

const frontend001RuntimePath = "packages/assistant-sdk/src/runtime/frontend001Runtime.ts";
const sdkRuntimeAdapterPath = "packages/assistant-sdk/src/runtime/sdkRuntimeAdapter.ts";
const sseStreamAdapterPath = "packages/assistant-sdk/src/runtime/sseStreamAdapter.ts";

const documentedHistoricalBridgeFiles = new Set([
  "packages/assistant-sdk/src/runtime/assistantTypeAdapter.ts",
  "packages/assistant-sdk/src/runtime/chatWidgetAdapter.ts",
  "packages/assistant-sdk/src/runtime/composableAdapter.ts",
  frontend001RuntimePath,
  "packages/assistant-sdk/src/runtime/serviceAdapter.ts",
  "packages/assistant-sdk/src/runtime/sessionAdapter.ts",
  sseStreamAdapterPath,
]);

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
  return [...listSourceFiles(sdkSourceRoot), ...listSourceFiles(sharedRuntimeSourceRoot)].map((file) => ({
    path: relativeToRepo(file),
    exists: true,
    source: readFileSync(file, "utf8"),
  }));
}

function snapshotExists(snapshots: readonly SourceSnapshot[], relativePath: string): boolean {
  return snapshots.some((snapshot) => snapshot.exists && snapshot.path === relativePath);
}

function hasAppSourceImport(source: string): boolean {
  return /\bfrom\s+["'][^"']*app\//.test(source) || /\bimport\s*\([^)]*["'][^"']*app\//.test(source);
}

function referencesFrontend001Runtime(source: string): boolean {
  return (
    /\bfrontend001Runtime\b/.test(source) ||
    /frontend001Runtime\.ts/.test(source) ||
    /\bfrom\s+["'][^"']*frontend001Runtime["']/.test(source)
  );
}

function referencesFrontend001SseOwner(source: string): boolean {
  return (
    /app\/features\/assistant\/composables\/useAssistantSseStream/.test(source) ||
    /app\/utils\/assistant\/assistantSseParser/.test(source)
  );
}

function evaluateLegacyBridgeGraph(snapshots: readonly SourceSnapshot[]) {
  const targetState = !snapshotExists(snapshots, frontend001RuntimePath);

  const activeAppSourceImports = snapshots
    .filter((snapshot) => snapshot.exists && hasAppSourceImport(snapshot.source))
    .map((snapshot) => snapshot.path);

  const undocumentedAppSourceImports = activeAppSourceImports.filter(
    (sourcePath) => !documentedHistoricalBridgeFiles.has(sourcePath),
  );

  const frontend001RuntimeReferences = snapshots
    .filter((snapshot) => snapshot.exists && referencesFrontend001Runtime(snapshot.source))
    .map((snapshot) => snapshot.path);

  const newFrontend001RuntimeUsage = frontend001RuntimeReferences.filter(
    (sourcePath) => sourcePath !== frontend001RuntimePath,
  );

  const sseBridgeStillReferencesFrontend001 =
    snapshots.some(
      (snapshot) =>
        snapshot.path === sseStreamAdapterPath &&
        snapshot.exists &&
        referencesFrontend001SseOwner(snapshot.source),
    );

  const sdkRuntimeAdapterSnapshot = snapshots.find(
    (snapshot) => snapshot.exists && snapshot.path === sdkRuntimeAdapterPath,
  );
  const sdkRuntimeAdapterImportsAppSource = sdkRuntimeAdapterSnapshot
    ? hasAppSourceImport(sdkRuntimeAdapterSnapshot.source)
    : false;
  const sdkRuntimeAdapterReferencesFrontend001Runtime = sdkRuntimeAdapterSnapshot
    ? referencesFrontend001Runtime(sdkRuntimeAdapterSnapshot.source)
    : false;

  if (targetState) {
    const targetViolations = [
      snapshotExists(snapshots, frontend001RuntimePath) ? `${frontend001RuntimePath} still exists` : undefined,
      ...frontend001RuntimeReferences.map((sourcePath) => `${sourcePath} references frontend001Runtime`),
      ...activeAppSourceImports.map((sourcePath) => `${sourcePath} imports app/**`),
      sseBridgeStillReferencesFrontend001 ? `${sseStreamAdapterPath} still references Frontend 001 SSE owner` : undefined,
    ].filter((violation): violation is string => Boolean(violation));

    return {
      stage: "target" as const,
      ok: targetViolations.length === 0,
      violations: targetViolations,
    };
  }

  const transitionalViolations = [
    ...undocumentedAppSourceImports.map((sourcePath) => `${sourcePath} imports app/** outside the historical bridge allowlist`),
    ...newFrontend001RuntimeUsage.map((sourcePath) => `${sourcePath} adds frontend001Runtime usage outside the aggregate bridge`),
    sdkRuntimeAdapterImportsAppSource ? `${sdkRuntimeAdapterPath} imports app/** during SDK adapter migration` : undefined,
    sdkRuntimeAdapterReferencesFrontend001Runtime
      ? `${sdkRuntimeAdapterPath} references frontend001Runtime during SDK adapter migration`
      : undefined,
  ].filter((violation): violation is string => Boolean(violation));

  return {
    stage: "transitional" as const,
    ok: transitionalViolations.length === 0,
    violations: transitionalViolations,
  };
}

describe("legacy SDK bridge source graph", () => {
  it("validates the actual repository source graph for the current migration stage", () => {
    const result = evaluateLegacyBridgeGraph(readSourceGraph());

    expect(result).toMatchObject({
      ok: true,
    });
    expect(["transitional", "target"]).toContain(result.stage);
  });

  it("allows documented historical bridges during Batch 1 transitional state without requiring every bridge forever", () => {
    const result = evaluateLegacyBridgeGraph([
      {
        path: frontend001RuntimePath,
        exists: true,
        source: "export const frontend001Runtime = {};",
      },
      {
        path: "packages/assistant-sdk/src/runtime/chatWidgetAdapter.ts",
        exists: true,
        source: "import ChatWidget from '../../../../app/features/assistant/components/ChatWidget.vue'; export { ChatWidget };",
      },
    ]);

    expect(result).toEqual({
      stage: "transitional",
      ok: true,
      violations: [],
    });
  });

  it("rejects undocumented SDK app imports and new frontend001Runtime usage during transitional state", () => {
    const result = evaluateLegacyBridgeGraph([
      {
        path: frontend001RuntimePath,
        exists: true,
        source: "export const frontend001Runtime = {};",
      },
      {
        path: "packages/assistant-sdk/src/runtime/newBridge.ts",
        exists: true,
        source: "import legacy from '../../../../app/features/assistant/composables/useChat'; export const x = frontend001Runtime;",
      },
    ]);

    expect(result).toEqual({
      stage: "transitional",
      ok: false,
      violations: [
        "packages/assistant-sdk/src/runtime/newBridge.ts imports app/** outside the historical bridge allowlist",
        "packages/assistant-sdk/src/runtime/newBridge.ts adds frontend001Runtime usage outside the aggregate bridge",
      ],
    });
  });

  it("allows sdkRuntimeAdapter during migration transitional state before T137 removes frontend001Runtime", () => {
    const result = evaluateLegacyBridgeGraph([
      {
        path: frontend001RuntimePath,
        exists: true,
        source: "export const frontend001Runtime = {};",
      },
      {
        path: sdkRuntimeAdapterPath,
        exists: true,
        source: "export const sdkRuntimeAdapter = {};",
      },
      {
        path: "packages/assistant-sdk/src/runtime/chatWidgetAdapter.ts",
        exists: true,
        source: "import ChatWidget from '../../../../app/features/assistant/components/ChatWidget.vue'; export { ChatWidget };",
      },
    ]);

    expect(result).toEqual({
      stage: "transitional",
      ok: true,
      violations: [],
    });
  });

  it("rejects sdkRuntimeAdapter app imports and frontend001Runtime references during transitional state", () => {
    const result = evaluateLegacyBridgeGraph([
      {
        path: frontend001RuntimePath,
        exists: true,
        source: "export const frontend001Runtime = {};",
      },
      {
        path: sdkRuntimeAdapterPath,
        exists: true,
        source:
          "import ChatWidget from '../../../../app/features/assistant/components/ChatWidget.vue'; export const sdkRuntimeAdapter = frontend001Runtime;",
      },
    ]);

    expect(result).toEqual({
      stage: "transitional",
      ok: false,
      violations: [
        `${sdkRuntimeAdapterPath} imports app/** outside the historical bridge allowlist`,
        `${sdkRuntimeAdapterPath} adds frontend001Runtime usage outside the aggregate bridge`,
        `${sdkRuntimeAdapterPath} imports app/** during SDK adapter migration`,
        `${sdkRuntimeAdapterPath} references frontend001Runtime during SDK adapter migration`,
      ],
    });
  });

  it("switches to strict target-state assertions only once frontend001Runtime is removed", () => {
    const passingTarget = evaluateLegacyBridgeGraph([
      {
        path: sdkRuntimeAdapterPath,
        exists: true,
        source: "export const sdkRuntimeAdapter = {};",
      },
      {
        path: sseStreamAdapterPath,
        exists: true,
        source: "export const sseStreamAdapter = {};",
      },
    ]);
    const frontend001ReferenceTarget = evaluateLegacyBridgeGraph([
      {
        path: sdkRuntimeAdapterPath,
        exists: true,
        source: "export const sdkRuntimeAdapter = frontend001Runtime;",
      },
      {
        path: "packages/assistant-sdk/src/runtime/remainingAdapter.ts",
        exists: true,
        source: "import { frontend001Runtime } from './frontend001Runtime'; export { frontend001Runtime };",
      },
    ]);
    const sseOwnerReferenceTarget = evaluateLegacyBridgeGraph([
      {
        path: sdkRuntimeAdapterPath,
        exists: true,
        source: "export const sdkRuntimeAdapter = {};",
      },
      {
        path: sseStreamAdapterPath,
        exists: true,
        source: "import { useAssistantSseStream } from '../../../../app/features/assistant/composables/useAssistantSseStream';",
      },
    ]);
    const stillHasFrontend001Runtime = evaluateLegacyBridgeGraph([
      {
        path: frontend001RuntimePath,
        exists: true,
        source: "export const frontend001Runtime = {};",
      },
      {
        path: sdkRuntimeAdapterPath,
        exists: true,
        source: "export const sdkRuntimeAdapter = {};",
      },
    ]);

    expect(passingTarget).toEqual({
      stage: "target",
      ok: true,
      violations: [],
    });
    expect(frontend001ReferenceTarget).toEqual({
      stage: "target",
      ok: false,
      violations: [
        `${sdkRuntimeAdapterPath} references frontend001Runtime`,
        "packages/assistant-sdk/src/runtime/remainingAdapter.ts references frontend001Runtime",
      ],
    });
    expect(sseOwnerReferenceTarget).toEqual({
      stage: "target",
      ok: false,
      violations: [
        `${sseStreamAdapterPath} imports app/**`,
        `${sseStreamAdapterPath} still references Frontend 001 SSE owner`,
      ],
    });
    expect(stillHasFrontend001Runtime).toEqual({
      stage: "transitional",
      ok: true,
      violations: [],
    });
  });

  it("rejects target-state snapshots when frontend001Runtime deletion leaves path text behind", () => {
    const result = evaluateLegacyBridgeGraph([
      {
        path: sdkRuntimeAdapterPath,
        exists: true,
        source: "export const legacyPath = 'frontend001Runtime.ts';",
      },
    ]);

    expect(result).toEqual({
      stage: "target",
      ok: false,
      violations: [`${sdkRuntimeAdapterPath} references frontend001Runtime`],
    });
  });
});
