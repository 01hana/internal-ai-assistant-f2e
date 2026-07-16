import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalFrontend001ServiceStoreHelperFiles,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const sdkSourcePath = fileURLToPath(new URL("packages/assistant-sdk/src", projectRoot));

const forbiddenDuplicateServiceStoreHelperFileNames = [
  "assistant.ts",
  "assistantApi.ts",
  "assistantClient.ts",
  "assistantService.ts",
  "useChatWidgetStore.ts",
  "useSessionStore.ts",
  "assistantSseParser.ts",
  "answerDecisionStateMapper.ts",
  "assistantMessageRendererResolver.ts",
  "evidenceNormalizationAdapter.ts",
] as const;

const forbiddenServiceRuntimeFunctionNames = [
  "fetchAssistant",
  "sendAssistantMessage",
  "parseAssistantSse",
  "parseAssistantSseEvent",
  "mapAnswerDecision",
  "normalizeEvidence",
  "renderEvidence",
  "createAssistantClient",
  "createChatClient",
  "createSseParser",
] as const;

const forbiddenServiceRuntimeImplementationPatterns = [
  ...forbiddenServiceRuntimeFunctionNames.flatMap(name => [
    new RegExp(`\\bfunction\\s+${name}\\b`),
    new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`),
  ]),
  /\bclass\s+AssistantClient\b/,
  /\bclass\s+AssistantService\b/,
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

describe("Frontend 002 service, store, and helper runtime reuse boundary", () => {
  it("keeps Frontend 001 services, stores, parser, mappers, renderer resolver, and evidence adapter as canonical owners", async () => {
    for (const runtimeFile of canonicalFrontend001ServiceStoreHelperFiles) {
      expect(
        await pathExists(fileURLToPath(new URL(runtimeFile, projectRoot))),
        runtimeFile,
      ).toBe(true);
    }
  });

  it("does not create duplicate service, store, parser, mapper, renderer, or evidence adapter files inside SDK source", async () => {
    const sourceFiles = await collectFiles(sdkSourcePath);

    for (const file of sourceFiles) {
      const relativePath = relative(projectRootPath, file);
      const fileName = basename(file);

      expect(forbiddenDuplicateServiceStoreHelperFileNames, `${relativePath} must not duplicate canonical Frontend 001 runtime files.`).not.toContain(fileName);
    }
  });

  it("does not implement assistant API client, SSE parser, AnswerDecision mapper, or evidence renderer behavior in SDK source", async () => {
    const sourceFiles = await readSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      for (const forbiddenPattern of forbiddenServiceRuntimeImplementationPatterns) {
        expect(source, `${relativePath} must reuse Frontend 001 service/helper behavior instead of implementing ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      }
    }
  });
});
