import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  forbiddenPackageArtifactPathPatterns,
  sdkDistDirectory,
  sdkDistEntry,
  sdkDistTypes,
  sdkPackageManifest,
  sdkPackageName,
  sdkPackageRoot,
  sdkStylesheet,
} from "../../fixtures/assistant-sdk/release-readiness-contract";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(join(projectRootPath, path), fsConstants.F_OK);
    return true;
  }
  catch {
    return false;
  }
}

async function collectRelativeFiles(directory: string): Promise<string[]> {
  const absoluteDirectory = join(projectRootPath, directory);
  const files: string[] = [];

  async function walk(currentDirectory: string): Promise<void> {
    const entries = await readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        files.push(relative(projectRootPath, absolutePath));
      }
    }
  }

  await walk(absoluteDirectory);

  return files;
}

describe("Frontend 002 SDK package artifact smoke", () => {
  it("keeps source package metadata pointed at future dist and stylesheet public entries", async () => {
    const manifest = JSON.parse(await readFile(join(projectRootPath, sdkPackageManifest), "utf8")) as {
      exports?: Record<string, unknown>;
      name?: string;
    };

    expect(manifest.name).toBe(sdkPackageName);
    expect(manifest.exports?.["."]).toEqual({
      types: "./dist/index.d.ts",
      import: "./dist/index.mjs",
    });
    expect(manifest.exports?.["./styles.css"]).toBe("./styles.css");
    expect(await pathExists(sdkStylesheet)).toBe(true);
    expect(await pathExists(`${sdkPackageRoot}/README.md`)).toBe(true);
  });

  it("requires a built SDK artifact before release readiness can close", async () => {
    expect(await pathExists(sdkDistDirectory), "SDK dist directory must exist before release readiness can close.").toBe(true);
    expect(await pathExists(sdkDistEntry), "SDK artifact must include dist/index.mjs.").toBe(true);
    expect(await pathExists(sdkDistTypes), "SDK artifact must include dist/index.d.ts.").toBe(true);
  });

  it("keeps package artifact contents free of tests, fixtures, specs, app source, and private SDK source surfaces", async () => {
    expect(await pathExists(sdkDistDirectory), "SDK dist directory must exist for package artifact content inspection.").toBe(true);
    const files = await collectRelativeFiles(sdkDistDirectory);
    for (const file of files) {
      for (const forbiddenPattern of forbiddenPackageArtifactPathPatterns) {
        expect(file, `Package artifact must not include ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("ships a self-contained stylesheet for shell and shared product UI selectors", async () => {
    const stylesheet = await readFile(join(projectRootPath, sdkStylesheet), "utf8");
    const requiredRuntimeStyleMarkers = [
      ".assistant-sdk-root",
      ".assistant-sdk-panel",
      "[data-testid=\"assistant-product-runtime-panel\"]",
      "[data-testid=\"assistant-message-area\"]",
      "[data-testid=\"assistant-panel-footer\"]",
      "[data-testid=\"assistant-user-message\"]",
      "[data-testid=\"assistant-ai-message\"]",
      ".assistant-message-bubble--user",
      ".assistant-message-bubble--assistant",
      ".assistant-message-frame",
      ".assistant-message-avatar--assistant",
      ".assistant-message-avatar--user",
      ".assistant-message-timestamp",
      ".assistant-typing-indicator",
      ".assistant-streaming-cursor",
      ".assistant-safe-outcome--warning",
      ".assistant-safe-outcome--error",
      ".assistant-safe-outcome--neutral",
      "[data-testid=\"assistant-chat-input\"]",
      "[data-testid=\"assistant-chat-submit\"]",
      "[data-testid=\"assistant-safe-outcome\"]",
      "[data-testid=\"assistant-evidence-ref\"]",
      "[data-testid=\"assistant-feedback-helpful\"]",
      "[data-testid=\"assistant-action-draft-confirm\"]",
      "[data-testid=\"assistant-approval-request-open-detail\"]",
    ];
    const requiredThemeTokenMarkers = [
      "--assistant-sdk-default-accent",
      "--assistant-sdk-default-surface",
      "--assistant-sdk-default-radius-md",
      "--assistant-sdk-default-bubble-shadow",
      "--assistant-sdk-default-user-avatar-background",
      "var(--assistant-sdk-accent, var(--assistant-sdk-default-accent))",
      "var(--assistant-sdk-panel-background, var(--assistant-sdk-default-panel-background))",
      "var(--assistant-sdk-message-area-background, var(--assistant-sdk-default-message-area-background))",
      "var(--assistant-sdk-input-background, var(--assistant-sdk-default-input-background))",
      "var(--assistant-sdk-button-primary-background, var(--assistant-sdk-default-button-primary-background))",
      "var(--assistant-sdk-focus-ring, var(--assistant-sdk-default-focus-ring))",
    ];

    for (const marker of requiredRuntimeStyleMarkers) {
      expect(stylesheet, `SDK styles.css must include runtime UI marker ${marker}.`).toContain(marker);
    }

    for (const marker of requiredThemeTokenMarkers) {
      expect(stylesheet, `SDK styles.css must include theme token marker ${marker}.`).toContain(marker);
    }

    expect(stylesheet, "SDK package stylesheet must not delegate runtime UI styling to Tailwind imports.").not.toMatch(/@tailwind|@import\s+["'][^"']*tailwind/i);
    expect(stylesheet, "SDK package stylesheet must not depend on host UI framework selectors.").not.toMatch(/\b(?:UButton|UIcon|UTextarea|UAlert|UEmpty|UBadge|q-btn|q-card|q-input|q-field)\b/);
  });
});
