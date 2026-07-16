import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalFrontend001ComposableFiles,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const sdkSourcePath = fileURLToPath(new URL("packages/assistant-sdk/src", projectRoot));

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

async function readSdkSources() {
  const files = (await collectFiles(sdkSourcePath))
    .filter(file => /\.(ts|vue)$/.test(file));

  return Promise.all(
    files.map(async file => ({
      relativePath: relative(projectRootPath, file),
      source: await readFile(file, "utf8"),
    })),
  );
}

describe("Frontend 002 composable runtime reuse boundary", () => {
  it("keeps Frontend 001 composables as canonical runtime owners", async () => {
    for (const composableFile of canonicalFrontend001ComposableFiles) {
      expect(
        await pathExists(fileURLToPath(new URL(composableFile, projectRoot))),
        composableFile,
      ).toBe(true);
    }
  });

  it("does not create duplicate chat, session, SSE, session-history, or chat-runtime composable files inside SDK source", async () => {
    const sourceFiles = await collectFiles(sdkSourcePath);

    for (const file of sourceFiles) {
      const relativePath = relative(projectRootPath, file);
      const fileName = basename(file);

      expect(forbiddenDuplicateComposableFileNames, `${relativePath} must not duplicate canonical Frontend 001 composables.`).not.toContain(fileName);

      for (const forbiddenPattern of forbiddenComposableFilePatterns) {
        expect(relativePath, relativePath).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("does not implement local retry, cancel, interrupted, session-history, or chat runtime behavior in SDK source", async () => {
    const sourceFiles = await readSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      for (const forbiddenPattern of forbiddenLocalRuntimeImplementationPatterns) {
        expect(source, `${relativePath} must reuse Frontend 001 composable behavior instead of implementing ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      }
    }
  });
});
