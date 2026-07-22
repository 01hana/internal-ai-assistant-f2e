import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  approvedRuntimeBridgeFilePatterns,
  canonicalSharedRuntimeBoundary,
  forbiddenActiveSdkAppImportPatterns,
  forbiddenDuplicateRuntimeFilePatterns,
  forbiddenRootEntryPatterns,
  forbiddenRuntimeBridgePublicExportPatterns,
  frontend001NuxtAdapterBoundary,
  frontend002SdkAdapterBoundary,
  legacyRuntimeBridgeClassification,
  legacyRuntimeBridgeFilePaths,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRootPath = process.cwd();
const sdkRootPath = join(projectRootPath, "packages/assistant-sdk");
const sdkSourcePath = join(sdkRootPath, "src");
const sdkComponentPath = join(sdkSourcePath, "components/AssistantWidget.vue");
const sdkRootEntryPath = join(sdkSourcePath, "index.ts");
const sdkPackageJsonPath = join(sdkRootPath, "package.json");
const sharedRuntimeComponentPath = join(projectRootPath, "packages/assistant-runtime/src/components/AssistantRuntimeRoot.vue");
const frontend001ChatWidgetPath = join(projectRootPath, "app/features/assistant/components/ChatWidget.vue");

const forbiddenCopiedRuntimeSignals = [
  "useChat(",
  "useAssistantSession(",
  "useAssistantSseStream(",
  "assistantSseParser",
  "createAssistantClient",
  "createChatClient",
  "parseAssistantSse",
  "parseAssistantSseEvent",
  "ActionDraftConfirmationMessage",
  "ApprovalRequestDisplayMessage",
  "ChatMessageArea",
  "ChatInputBar",
  "AiMessageItem",
  "AiStreamingItem",
] as const;

const forbiddenChatRuntimeImplementationPatterns = [
  /\bfunction\s+createAssistantClient\b/,
  /\b(?:const|let|var)\s+createAssistantClient\s*=/,
  /\bfunction\s+createChatClient\b/,
  /\b(?:const|let|var)\s+createChatClient\s*=/,
  /\bclass\s+(?:AssistantClient|ChatClient)\b/,
  /\bfunction\s+parseAssistantSse(?:Event)?\b/,
  /\b(?:const|let|var)\s+parseAssistantSse(?:Event)?\s*=/,
  /\bfunction\s+(?:renderChatMessage|createChatMessageRenderer)\b/,
  /\b(?:const|let|var)\s+(?:renderChatMessage|createChatMessageRenderer)\s*=/,
  /\bfunction\s+(?:confirmActionDraft|getApprovalRequest|submitFeedback)\b/,
  /\b(?:const|let|var)\s+(?:confirmActionDraft|getApprovalRequest|submitFeedback)\s*=/,
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

function isLegacyRuntimeBridgeFile(relativePath: string): boolean {
  const normalizedPath = normalizeRelativePath(relativePath);

  return approvedRuntimeBridgeFilePatterns.some(pattern => pattern.test(normalizedPath));
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

describe("Frontend 002 AssistantWidget runtime reuse boundary", () => {
  it("recognizes Shared Runtime as reusable canonical owner and Frontend 001 as adapter baseline", async () => {
    expect(canonicalSharedRuntimeBoundary.sourceRoot).toBe("packages/assistant-runtime/src");
    expect(canonicalSharedRuntimeBoundary.role).toBe("reusable canonical runtime owner");
    expect(frontend001NuxtAdapterBoundary.role).toContain("Nuxt Adapter");
    expect(frontend002SdkAdapterBoundary.role).toContain("SDK Adapter");
    expect(await pathExists(sharedRuntimeComponentPath), "Shared canonical AssistantRuntimeRoot.vue must exist before SDK runtime adapter work.").toBe(true);
    expect(await pathExists(frontend001ChatWidgetPath), "Frontend 001 ChatWidget.vue remains product shell regression baseline, not final SDK runtime source.").toBe(true);
  });

  it("keeps the SDK AssistantWidget shell free of copied chat runtime behavior before T144 productization", async () => {
    expect(await pathExists(sdkComponentPath), "SDK AssistantWidget shell must exist before runtime reuse guard can inspect it.").toBe(true);

    const source = await readFile(sdkComponentPath, "utf8");

    for (const forbiddenSignal of forbiddenCopiedRuntimeSignals) {
      expect(source, `AssistantWidget must not copy runtime signal ${forbiddenSignal}; T144 will wire the SDK adapter to shared runtime.`).not.toContain(forbiddenSignal);
    }
  });

  it("does not duplicate chat runtime files anywhere in SDK source", async () => {
    const sourceFiles = await collectFiles(sdkSourcePath);

    for (const file of sourceFiles) {
      const relativePath = normalizeRelativePath(relative(projectRootPath, file));

      for (const forbiddenPattern of forbiddenDuplicateRuntimeFilePatterns) {
        expect(relativePath, `${relativePath} must not duplicate shared or Frontend 001 runtime files.`).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("does not locally implement chat runtime behavior outside the Shared Runtime boundary", async () => {
    const sourceFiles = await readSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      for (const forbiddenPattern of forbiddenChatRuntimeImplementationPatterns) {
        expect(
          source,
          `${relativePath} must remain SDK adapter code instead of implementing ${forbiddenPattern}.`,
        ).not.toMatch(forbiddenPattern);
      }

      if (isLegacyRuntimeBridgeFile(relativePath)) {
        expect(legacyRuntimeBridgeFilePaths).toContain(relativePath);
        continue;
      }

      expect(
        forbiddenActiveSdkAppImportPatterns.some(pattern => pattern.test(source)),
        `${relativePath} must not active-import Frontend 001 app runtime paths as final architecture.`,
      ).toBe(false);
      expect(
        source,
        `${relativePath} must not call Frontend 001 runtime composables directly; T134-T136 must use SDK adapters over Shared Runtime.`,
      ).not.toMatch(/\b(?:useChat|useAssistantSession|useAssistantSseStream)\s*\(/);
    }
  });

  it("classifies legacy app-source bridges as pending T137 removal rather than final runtime reuse", async () => {
    expect(legacyRuntimeBridgeClassification).toEqual({
      status: "legacy bridge pending T137 removal",
      terminalTask: "T137",
      terminalState: "removed or replaced by SDK adapters over Shared Canonical Assistant Runtime",
    });

    const bridgeFiles = (await readSdkSources()).filter(({ relativePath }) => isLegacyRuntimeBridgeFile(relativePath));

    for (const { relativePath } of bridgeFiles) {
      expect(legacyRuntimeBridgeFilePaths, `${relativePath} must be documented as a temporary bridge before it may import app/**.`).toContain(relativePath);
    }
  });

  it("does not expose Frontend 001 runtime paths or bridge internals through public entries", async () => {
    const rootEntry = await readFile(sdkRootEntryPath, "utf8");
    const packageJson = JSON.parse(await readFile(sdkPackageJsonPath, "utf8")) as {
      exports?: Record<string, unknown> | string[];
    };
    const exportsField = packageJson.exports ?? {};
    const exportKeys = Array.isArray(exportsField)
      ? exportsField
      : Object.keys(exportsField);

    for (const forbiddenPattern of forbiddenRootEntryPatterns) {
      expect(rootEntry, `Root entry must not expose Frontend 001 internal path ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
    }

    for (const forbiddenPattern of forbiddenRuntimeBridgePublicExportPatterns) {
      expect(rootEntry, "Runtime bridge internals must not be public exports.").not.toMatch(forbiddenPattern);
    }

    expect(exportKeys).not.toContain("./runtime");
    expect(exportKeys).not.toContain("./runtime/*");
    expect(exportKeys).not.toContain("./components/*");
  });
});
