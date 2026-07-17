import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  forbiddenPackageExports,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const sdkRootPath = fileURLToPath(new URL("packages/assistant-sdk", projectRoot));
const sdkTransportPath = join(sdkRootPath, "src/transport");
const sdkRuntimePath = join(sdkRootPath, "src/runtime");
const sdkRootEntryPath = join(sdkRootPath, "src/index.ts");
const sdkPackageJsonPath = join(sdkRootPath, "package.json");

const canonicalSseOwners = [
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
      relativePath: relative(projectRootPath, file),
      source: await readFile(file, "utf8"),
    })),
  );
}

async function loadSseStreamBridgeContract() {
  const contract = await import("../../../packages/assistant-sdk/src/transport/sseStreamBridge") as Partial<SseStreamBridgeModule>;

  expect(
    typeof contract.createSseStreamBridge,
    "sseStreamBridge.ts must export createSseStreamBridge.",
  ).toBe("function");

  return contract as SseStreamBridgeModule;
}

describe("Frontend 002 SSE ownership boundary", () => {
  it("requires an SDK-internal SSE stream bridge factory", async () => {
    const contract = await loadSseStreamBridgeContract();

    expect(contract.createSseStreamBridge).toBeTypeOf("function");
  });

  it("delegates SSE streaming to canonical Frontend 001 stream ownership", async () => {
    const { createSseStreamBridge } = await loadSseStreamBridgeContract();
    const canonicalStreamStub = vi.fn(async (input: Readonly<Record<string, unknown>>) => ({
      ok: true,
      input,
    }));
    const canonicalParserStub = vi.fn();
    const bridge = createSseStreamBridge({
      frontend001SseStream: canonicalStreamStub,
      frontend001SseParser: canonicalParserStub,
    }) as SseStreamBridge;
    const stream = bridge.stream ?? bridge.createStream;

    expect(stream, "SSE stream bridge must expose a low-level stream/createStream method.").toBeTypeOf("function");

    await stream?.({
      requestId: "request-001",
      sessionId: "session-001",
    });

    expect(canonicalStreamStub).toHaveBeenCalledTimes(1);
    expect(bridge.assistantSseParser, "SSE stream bridge must not expose parser internals.").toBeUndefined();
    expect(bridge.parseSse, "SSE stream bridge must not own parseSse.").toBeUndefined();
    expect(bridge.parseAssistantSse, "SSE stream bridge must not own parseAssistantSse.").toBeUndefined();
    expect(bridge.createSseParser, "SSE stream bridge must not create a second parser.").toBeUndefined();
  });

  it("keeps Frontend 001 SSE parser and stream composable as canonical owners", async () => {
    for (const ownerPath of canonicalSseOwners) {
      expect(
        await pathExists(fileURLToPath(new URL(ownerPath, projectRoot))),
        ownerPath,
      ).toBe(true);
    }
  });

  it("does not create a second SSE parser or mode-specific SSE schema in SDK transport/runtime source", async () => {
    const files = await readFiles([
      ...await collectFiles(sdkTransportPath),
      ...await collectFiles(sdkRuntimePath),
    ]);

    for (const { fileName, relativePath, source } of files) {
      expect(fileName, `${relativePath} must not duplicate canonical SSE parser file ownership.`).not.toMatch(/sse.*parser/i);

      for (const forbiddenPattern of forbiddenSseImplementationPatterns) {
        expect(source, `${relativePath} must delegate SSE parsing instead of implementing ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
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
