import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  approvedRuntimeBridgeFilePatterns,
  forbiddenDuplicateRuntimeFilePatterns,
  forbiddenRootEntryPatterns,
  forbiddenRuntimeBridgePublicExportPatterns,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRootPath = process.cwd();
const sdkRootPath = join(projectRootPath, "packages/assistant-sdk");
const sdkSourcePath = join(sdkRootPath, "src");
const sdkComponentPath = join(sdkSourcePath, "components/AssistantWidget.vue");
const sdkRootEntryPath = join(sdkSourcePath, "index.ts");
const sdkPackageJsonPath = join(sdkRootPath, "package.json");
const canonicalChatWidgetPath = join(projectRootPath, "app/features/assistant/components/ChatWidget.vue");

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

function isApprovedRuntimeBridgeFile(relativePath: string): boolean {
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
  it("keeps Frontend 001 ChatWidget as the canonical chat component owner", async () => {
    expect(await pathExists(canonicalChatWidgetPath), "Canonical Frontend 001 ChatWidget.vue must exist before SDK runtime reuse work.").toBe(true);
  });

  it("keeps the SDK AssistantWidget shell free of copied chat runtime behavior", async () => {
    expect(await pathExists(sdkComponentPath), "SDK AssistantWidget shell must exist before runtime reuse guard can inspect it.").toBe(true);

    const source = await readFile(sdkComponentPath, "utf8");

    for (const forbiddenSignal of forbiddenCopiedRuntimeSignals) {
      expect(source, `AssistantWidget shell must not copy runtime signal ${forbiddenSignal}.`).not.toContain(forbiddenSignal);
    }
  });

  it("does not duplicate chat runtime files anywhere in SDK source", async () => {
    const sourceFiles = await collectFiles(sdkSourcePath);

    for (const file of sourceFiles) {
      const relativePath = normalizeRelativePath(relative(projectRootPath, file));

      for (const forbiddenPattern of forbiddenDuplicateRuntimeFilePatterns) {
        expect(relativePath, `${relativePath} must not duplicate a Frontend 001 runtime file.`).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("does not locally implement chat runtime behavior outside canonical Frontend 001 runtime", async () => {
    const sourceFiles = await readSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      for (const forbiddenPattern of forbiddenChatRuntimeImplementationPatterns) {
        expect(
          source,
          `${relativePath} must delegate to canonical Frontend 001 runtime instead of implementing ${forbiddenPattern}.`,
        ).not.toMatch(forbiddenPattern);
      }

      if (isApprovedRuntimeBridgeFile(relativePath)) {
        continue;
      }

      expect(
        source,
        `${relativePath} must not use canonical runtime composables directly unless it is an approved internal bridge file.`,
      ).not.toMatch(/\b(?:useChat|useAssistantSession|useAssistantSseStream)\s*\(/);
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
  });
});
