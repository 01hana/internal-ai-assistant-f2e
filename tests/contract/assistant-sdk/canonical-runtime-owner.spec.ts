import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { forbiddenDuplicateRuntimeFilePatterns } from "../../fixtures/assistant-sdk/architecture-guardrails";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const sharedRuntimeRoot = path.join(repoRoot, "packages/assistant-runtime");
const sdkSourceRoot = path.join(repoRoot, "packages/assistant-sdk/src");

const allowedHistoricalSdkBridgeFiles = new Set([
  "packages/assistant-sdk/src/runtime/assistantTypeAdapter.ts",
  "packages/assistant-sdk/src/runtime/chatWidgetAdapter.ts",
  "packages/assistant-sdk/src/runtime/composableAdapter.ts",
  "packages/assistant-sdk/src/runtime/frontend001Runtime.ts",
  "packages/assistant-sdk/src/runtime/serviceAdapter.ts",
  "packages/assistant-sdk/src/runtime/sessionAdapter.ts",
  "packages/assistant-sdk/src/runtime/sseStreamAdapter.ts"
]);

const forbiddenSharedRuntimePatterns = [
  /\bfrom\s+["'][^"']*app\//,
  /\bimport\s*\([^)]*["'][^"']*app\//,
  /\buseRuntimeConfig\b/,
  /\buseNuxtApp\b/,
  /\bdefineNuxtPlugin\b/,
  /\buseRoute\b/,
  /\buseRouter\b/,
  /\b#imports\b/,
  /\b#app\b/,
  /\bgetActivePinia\b/,
  /\bsetActivePinia\b/,
  /\buseChatWidgetStore\b/,
  /\buseAssistantSessionStore\b/
];

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

function relativeToRepo(file: string): string {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

describe("canonical shared runtime owner boundary", () => {
  it("registers packages/assistant-runtime as the only reusable canonical runtime workspace", () => {
    const rootManifest = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    const runtimeManifest = JSON.parse(readFileSync(path.join(sharedRuntimeRoot, "package.json"), "utf8"));

    expect(rootManifest.workspaces).toContain("packages/assistant-runtime");
    expect(runtimeManifest.name).toBe("@internal-ai-assistant/assistant-runtime");
    expect(runtimeManifest.private).toBe(true);
    expect(runtimeManifest.exports).toBeUndefined();
    expect(runtimeManifest.publishConfig).toBeUndefined();
  });

  it("keeps shared runtime source free of Frontend 001 app imports, Nuxt globals, and active app Pinia", () => {
    const violations = listSourceFiles(path.join(sharedRuntimeRoot, "src")).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return forbiddenSharedRuntimePatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${relativeToRepo(file)} matched ${pattern}`);
    });

    expect(violations).toEqual([]);
  });

  it("allows only documented historical SDK runtime bridges to reference app source before T137", () => {
    const violations = listSourceFiles(sdkSourceRoot).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const hasAppImport = /\bfrom\s+["'][^"']*app\//.test(source) || /\bimport\s*\([^)]*["'][^"']*app\//.test(source);
      const relative = relativeToRepo(file);

      return hasAppImport && !allowedHistoricalSdkBridgeFiles.has(relative) ? [relative] : [];
    });

    expect(violations).toEqual([]);
  });

  it("does not create duplicate ChatWidget or runtime owner files inside the SDK adapter source", () => {
    const violations = listSourceFiles(sdkSourceRoot).flatMap((file) => {
      const relative = relativeToRepo(file);
      return forbiddenDuplicateRuntimeFilePatterns
        .filter((pattern) => pattern.test(relative))
        .map((pattern) => `${relative} matched ${pattern}`);
    });

    expect(violations).toEqual([]);
  });
});
