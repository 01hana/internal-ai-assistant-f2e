import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalSharedRuntimeBoundary,
  forbiddenActiveSdkAppImportPatterns,
  frontend001NuxtAdapterBoundary,
  frontend002SdkAdapterBoundary,
  legacyRuntimeBridgeClassification,
  legacyRuntimeBridgeFilePaths,
} from "../../fixtures/assistant-sdk/architecture-guardrails";
import { assistantRuntimeTransportOwnership } from "../../../packages/assistant-runtime/src/transport/ports";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const sdkSourcePath = fileURLToPath(new URL("packages/assistant-sdk/src", projectRoot));

const frontend001AdapterComposableFiles = [
  "app/features/assistant/composables/useChat.ts",
  "app/features/assistant/composables/useAssistantSession.ts",
  "app/features/assistant/composables/useAssistantSseStream.ts",
] as const;

const forbiddenDuplicateComposableFileNames = [
  "useChat.ts",
  "useAssistantSession.ts",
  "useAssistantSseStream.ts",
] as const;

const forbiddenComposableFilePatterns = [
  /useAssistantSse.*\.ts$/,
  /useSessionHistory.*\.ts$/,
  /useChatRuntime.*\.ts$/,
] as const;

const forbiddenLocalRuntimeFunctionNames = [
  "retryAssistantMessage",
  "cancelAssistantMessage",
  "interruptAssistantMessage",
  "createSessionHistoryRuntime",
  "useSessionHistory",
  "useChatRuntime",
] as const;

const forbiddenLocalRuntimeImplementationPatterns = forbiddenLocalRuntimeFunctionNames.flatMap(name => [
  new RegExp(`\\bfunction\\s+${name}\\b`),
  new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`),
]);

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

function normalizeRelativePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function isLegacyBridgePath(relativePath: string): boolean {
  return legacyRuntimeBridgeFilePaths.includes(normalizeRelativePath(relativePath) as typeof legacyRuntimeBridgeFilePaths[number]);
}

async function readSdkSources() {
  const files = (await collectFiles(sdkSourcePath))
    .filter(file => /\.(ts|vue)$/.test(file));

  return Promise.all(
    files.map(async file => ({
      relativePath: normalizeRelativePath(relative(projectRootPath, file)),
      source: await readFile(file, "utf8"),
    })),
  );
}

describe("Frontend 002 composable runtime adapter boundary", () => {
  it("classifies Frontend 001 composables as Nuxt adapter glue over Shared Runtime", async () => {
    expect(canonicalSharedRuntimeBoundary.sourceRoot).toBe("packages/assistant-runtime/src");
    expect(frontend001NuxtAdapterBoundary.allowedResponsibilities).toContain("Nuxt runtime config");
    expect(frontend002SdkAdapterBoundary.allowedResponsibilities).toContain("provider/context resolution");
    expect(assistantRuntimeTransportOwnership.sharedRuntimeOwns).toContain("retry/cancel/timeout/interrupted state");

    for (const composableFile of frontend001AdapterComposableFiles) {
      expect(
        await pathExists(fileURLToPath(new URL(composableFile, projectRoot))),
        `${composableFile} remains FE001 adapter/product coverage, not reusable SDK runtime ownership.`,
      ).toBe(true);
    }
  });

  it("does not create duplicate chat, session, SSE, session-history, or chat-runtime composable files inside SDK source", async () => {
    const sourceFiles = await collectFiles(sdkSourcePath);

    for (const file of sourceFiles) {
      const relativePath = normalizeRelativePath(relative(projectRootPath, file));
      const fileName = basename(file);

      expect(forbiddenDuplicateComposableFileNames, `${relativePath} must not duplicate Frontend 001 adapter composables.`).not.toContain(fileName);

      for (const forbiddenPattern of forbiddenComposableFilePatterns) {
        expect(relativePath, relativePath).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("does not implement local retry, cancel, interrupted, session-history, or chat runtime behavior in SDK source", async () => {
    const sourceFiles = await readSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      for (const forbiddenPattern of forbiddenLocalRuntimeImplementationPatterns) {
        expect(source, `${relativePath} must remain SDK adapter code and leave lifecycle ownership in Shared Runtime.`).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("does not active-import Frontend 001 composables outside documented legacy bridges", async () => {
    const sourceFiles = await readSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      const hasFrontend001ComposableImport = /app\/features\/assistant\/composables\//.test(source)
        || forbiddenActiveSdkAppImportPatterns.some(pattern => pattern.test(source));

      if (isLegacyBridgePath(relativePath)) {
        expect(legacyRuntimeBridgeClassification.status).toBe("legacy bridge pending T137 removal");
        continue;
      }

      expect(hasFrontend001ComposableImport, `${relativePath} must not active-import Frontend 001 composables as final SDK architecture.`).toBe(false);
    }
  });
});
