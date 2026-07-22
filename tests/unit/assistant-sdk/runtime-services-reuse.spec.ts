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

const frontend001AdapterServiceStoreHelperFiles = [
  "app/services/api/assistant.ts",
  "app/stores/assistant/useChatWidgetStore.ts",
  "app/stores/assistant/useSessionStore.ts",
  "app/utils/assistant/assistantSseParser.ts",
  "app/utils/assistant/answerDecisionStateMapper.ts",
  "app/utils/assistant/assistantMessageRendererResolver.ts",
  "app/utils/assistant/evidenceNormalizationAdapter.ts",
] as const;

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

describe("Frontend 002 service, store, and helper adapter boundary", () => {
  it("classifies Frontend 001 services, stores, parser, mappers, renderer resolver, and evidence adapter as app adapter/baseline files", async () => {
    expect(canonicalSharedRuntimeBoundary.role).toBe("reusable canonical runtime owner");
    expect(frontend001NuxtAdapterBoundary.role).toContain("Nuxt Adapter");
    expect(frontend002SdkAdapterBoundary.role).toContain("SDK Adapter");
    expect(assistantRuntimeTransportOwnership.frontend001AdapterOwns).toContain("Nuxt HTTP/auth/headers");

    for (const runtimeFile of frontend001AdapterServiceStoreHelperFiles) {
      expect(
        await pathExists(fileURLToPath(new URL(runtimeFile, projectRoot))),
        `${runtimeFile} remains FE001 adapter/product coverage, not final SDK runtime source.`,
      ).toBe(true);
    }
  });

  it("does not create duplicate service, store, parser, mapper, renderer, or evidence adapter files inside SDK source", async () => {
    const sourceFiles = await collectFiles(sdkSourcePath);

    for (const file of sourceFiles) {
      const relativePath = normalizeRelativePath(relative(projectRootPath, file));
      const fileName = basename(file);

      expect(forbiddenDuplicateServiceStoreHelperFileNames, `${relativePath} must not duplicate FE001 adapter/runtime helper files.`).not.toContain(fileName);
    }
  });

  it("does not implement assistant API client, SSE parser, AnswerDecision mapper, or evidence renderer behavior in SDK source", async () => {
    const sourceFiles = await readSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      for (const forbiddenPattern of forbiddenServiceRuntimeImplementationPatterns) {
        expect(source, `${relativePath} must remain SDK adapter code instead of implementing ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("does not active-import Frontend 001 services, stores, or utils outside documented legacy bridges", async () => {
    const sourceFiles = await readSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      const hasFrontend001ServiceStoreOrUtilImport = /app\/(?:services|stores|utils)\//.test(source)
        || forbiddenActiveSdkAppImportPatterns.some(pattern => pattern.test(source));

      if (isLegacyBridgePath(relativePath)) {
        expect(legacyRuntimeBridgeClassification.terminalTask).toBe("T137");
        continue;
      }

      expect(
        hasFrontend001ServiceStoreOrUtilImport,
        `${relativePath} must not active-import FE001 services/stores/utils as final SDK architecture.`,
      ).toBe(false);
    }
  });
});
