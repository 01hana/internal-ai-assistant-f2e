import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  canonicalSharedRuntimeBoundary,
  forbiddenPackageExports,
  legacyRuntimeBridgeClassification,
  legacyRuntimeBridgeFilePaths,
} from "../../fixtures/assistant-sdk/architecture-guardrails";
import { assistantRuntimeTransportOwnership } from "../../../packages/assistant-runtime/src/transport/ports";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const sdkRootPath = fileURLToPath(new URL("packages/assistant-sdk", projectRoot));
const sdkTransportPath = join(sdkRootPath, "src/transport");
const sdkRuntimePath = join(sdkRootPath, "src/runtime");
const sdkRootEntryPath = join(sdkRootPath, "src/index.ts");
const sdkPackageJsonPath = join(sdkRootPath, "package.json");
const sharedRuntimeSsePath = fileURLToPath(new URL("packages/assistant-runtime/src/sse/index.ts", projectRoot));

const frontend001SseAdapterFiles = [
  "app/utils/assistant/assistantSseParser.ts",
  "app/features/assistant/composables/useAssistantSseStream.ts",
] as const;

const forbiddenSseImplementationPatterns = [
  /\bfunction\s+parseSse\b/i,
  /\bfunction\s+parseAssistantSse\b/i,
  /\b(?:const|let|var)\s+parseSse\s*=/i,
  /\b(?:const|let|var)\s+parseAssistantSse\s*=/i,
  /\bcreateSseParser\b/i,
  /\bparseAssistantSseEvent\b/i,
  /\bmodeSpecificSseParser\b/i,
  /\bmodeSpecificSseSchema\b/i,
  /case\s+["']token["']/,
  /case\s+["']done["']/,
  /case\s+["']error["']/,
  /case\s+["']approval["']/,
] as const;

const forbiddenSsePublicExportPatterns = [
  /export\s+\*\s+from\s+["'][^"']*(sse|stream|runtime|transport)[^"']*["']/i,
  /export\s+\{[^}]*\b(?:assistantSseParser|useAssistantSseStream|parseSse|parseAssistantSse|createSseParser)\b[^}]*\}/i,
] as const;

type SseStreamBridgeModule = {
  readonly createSseStreamBridge: (options: {
    readonly frontend001SseStream: (...args: readonly unknown[]) => unknown;
    readonly frontend001SseParser?: unknown;
  }) => unknown;
};

type SseStreamBridge = {
  readonly stream?: (...args: readonly unknown[]) => unknown | Promise<unknown>;
  readonly createStream?: (...args: readonly unknown[]) => unknown | Promise<unknown>;
  readonly assistantSseParser?: unknown;
  readonly parseSse?: unknown;
  readonly parseAssistantSse?: unknown;
  readonly createSseParser?: unknown;
  readonly retry?: unknown;
  readonly cancel?: unknown;
  readonly timeout?: unknown;
  readonly interrupted?: unknown;
};

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

async function readFiles(paths: readonly string[]) {
  const files = paths.filter(file => /\.(ts|vue|json)$/.test(file));

  return Promise.all(
    files.map(async file => ({
      fileName: basename(file),
      relativePath: relative(projectRootPath, file).replaceAll("\\", "/"),
      source: await readFile(file, "utf8"),
    })),
  );
}

function isLegacyBridgePath(relativePath: string): boolean {
  return legacyRuntimeBridgeFilePaths.includes(relativePath as typeof legacyRuntimeBridgeFilePaths[number]);
}

async function loadSseStreamBridgeContract() {
  const contract = await import("../../../packages/assistant-sdk/src/transport/sseStreamBridge") as Partial<SseStreamBridgeModule>;

  expect(
    typeof contract.createSseStreamBridge,
    "sseStreamBridge.ts must export createSseStreamBridge while it remains a transitional bridge.",
  ).toBe("function");

  return contract as SseStreamBridgeModule;
}

describe("Frontend 002 SSE ownership boundary", () => {
  it("recognizes Shared Runtime as canonical SSE parser and stream lifecycle owner", async () => {
    expect(canonicalSharedRuntimeBoundary.sourceRoot).toBe("packages/assistant-runtime/src");
    expect(assistantRuntimeTransportOwnership.sharedRuntimeOwns).toContain("canonical SSE consumption");
    expect(assistantRuntimeTransportOwnership.sharedRuntimeOwns).toContain("retry/cancel/timeout/interrupted state");
    expect(await pathExists(sharedRuntimeSsePath), "Shared Runtime SSE module must exist as canonical parser/stream model owner.").toBe(true);

    for (const adapterPath of frontend001SseAdapterFiles) {
      expect(
        await pathExists(fileURLToPath(new URL(adapterPath, projectRoot))),
        `${adapterPath} remains FE001 adapter/product regression coverage, not SDK final SSE ownership.`,
      ).toBe(true);
    }
  });

  it("classifies the SDK SSE stream bridge as transitional T137 bridge, not final parser ownership", async () => {
    const { createSseStreamBridge } = await loadSseStreamBridgeContract();
    const transitionalStreamStub = vi.fn(async (input: Readonly<Record<string, unknown>>) => ({
      ok: true,
      input,
    }));
    const bridge = createSseStreamBridge({
      frontend001SseStream: transitionalStreamStub,
    }) as SseStreamBridge;
    const stream = bridge.stream ?? bridge.createStream;

    expect(legacyRuntimeBridgeClassification.status).toBe("legacy bridge pending T137 removal");
    expect(legacyRuntimeBridgeFilePaths).toContain("packages/assistant-sdk/src/runtime/sseStreamAdapter.ts");
    expect(stream, "Transitional SSE stream bridge must expose only a low-level stream/createStream method.").toBeTypeOf("function");

    await stream?.({
      requestId: "request-001",
      sessionId: "session-001",
    });

    expect(transitionalStreamStub).toHaveBeenCalledTimes(1);
    expect(bridge.assistantSseParser, "SSE bridge must not expose parser internals.").toBeUndefined();
    expect(bridge.parseSse, "SSE bridge must not own parseSse.").toBeUndefined();
    expect(bridge.parseAssistantSse, "SSE bridge must not own parseAssistantSse.").toBeUndefined();
    expect(bridge.createSseParser, "SSE bridge must not create a second parser.").toBeUndefined();
    expect(bridge.retry, "SSE bridge must not own retry lifecycle.").toBeUndefined();
    expect(bridge.cancel, "SSE bridge must not own cancel lifecycle.").toBeUndefined();
    expect(bridge.timeout, "SSE bridge must not own timeout lifecycle.").toBeUndefined();
    expect(bridge.interrupted, "SSE bridge must not own interrupted lifecycle.").toBeUndefined();
  });

  it("does not create a second SSE parser or mode-specific SSE schema in SDK transport/runtime source", async () => {
    const files = await readFiles([
      ...await collectFiles(sdkTransportPath),
      ...await collectFiles(sdkRuntimePath),
    ]);

    for (const { fileName, relativePath, source } of files) {
      if (!isLegacyBridgePath(relativePath)) {
        expect(source, `${relativePath} must not active-import FE001 SSE app sources as final SDK architecture.`)
          .not.toMatch(/app\/(?:utils\/assistant\/assistantSseParser|features\/assistant\/composables\/useAssistantSseStream)/);
      }

      expect(fileName, `${relativePath} must not duplicate canonical SSE parser file ownership.`).not.toMatch(/sse.*parser/i);

      for (const forbiddenPattern of forbiddenSseImplementationPatterns) {
        expect(source, `${relativePath} must leave SSE parsing and terminal lifecycle in Shared Runtime.`).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("does not expose SSE parser, stream, runtime, or transport internals as public API", async () => {
    const rootEntry = await readFile(sdkRootEntryPath, "utf8");

    for (const forbiddenPattern of forbiddenSsePublicExportPatterns) {
      expect(rootEntry).not.toMatch(forbiddenPattern);
    }

    const packageJson = JSON.parse(await readFile(sdkPackageJsonPath, "utf8")) as {
      exports?: Record<string, unknown> | string[];
    };
    const exportsField = packageJson.exports ?? {};
    const exportKeys = Array.isArray(exportsField)
      ? exportsField
      : Object.keys(exportsField);

    for (const forbiddenExport of [
      "./sse",
      "./sse/*",
      "./stream",
      "./stream/*",
      "./runtime",
      "./runtime/*",
      "./transport",
      "./transport/*",
      ...forbiddenPackageExports.filter(exportPath => exportPath.includes("runtime") || exportPath.includes("transport")),
    ]) {
      expect(exportKeys).not.toContain(forbiddenExport);
    }
  });
});
