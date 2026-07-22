import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalSharedRuntimeBoundary,
  frontend001BehaviorBaselineFiles,
  forbiddenDuplicateRuntimeFilePatterns,
  forbiddenRuntimeFactories,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const sdkSourcePath = fileURLToPath(new URL("packages/assistant-sdk/src", projectRoot));

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
      file,
      relativePath: relative(projectRootPath, file),
      source: await readFile(file, "utf8"),
    })),
  );
}

describe("Frontend 002 no-second-runtime guardrails", () => {
  it("recognizes the shared runtime boundary as the approved future canonical owner, not an SDK fork", async () => {
    const sharedRuntimeManifestPath = fileURLToPath(
      new URL(`${canonicalSharedRuntimeBoundary.root}/package.json`, projectRoot),
    );
    const sharedRuntimeSourcePath = fileURLToPath(
      new URL(canonicalSharedRuntimeBoundary.sourceRoot, projectRoot),
    );
    const sharedRuntimeManifest = JSON.parse(await readFile(sharedRuntimeManifestPath, "utf8"));

    expect(sharedRuntimeManifest.name).toBe(canonicalSharedRuntimeBoundary.packageName);
    expect(sharedRuntimeManifest.private).toBe(true);
    expect(await pathExists(sharedRuntimeSourcePath)).toBe(true);
    expect(canonicalSharedRuntimeBoundary.root.startsWith("packages/assistant-sdk")).toBe(false);
  });

  it("records Frontend 001 app files as the current product behavior baseline, not permanent reusable owners", async () => {
    expect(frontend001BehaviorBaselineFiles.length).toBeGreaterThan(0);

    for (const runtimeFile of frontend001BehaviorBaselineFiles) {
      expect(runtimeFile, runtimeFile).not.toBe("");
      expect(runtimeFile, runtimeFile).not.toMatch(/^\/|^[A-Za-z]:[\\/]/);
      expect(runtimeFile, runtimeFile).toMatch(/^app\//);
      expect(runtimeFile, runtimeFile).not.toMatch(/^packages\/assistant-sdk\//);
      expect(runtimeFile, runtimeFile).not.toMatch(/^packages\/assistant-runtime\//);
    }
  });

  it("does not create duplicate runtime owner files inside the SDK package", async () => {
    const sourceFiles = await readSdkSources();

    for (const { relativePath } of sourceFiles) {
      for (const forbiddenPattern of forbiddenDuplicateRuntimeFilePatterns) {
        expect(relativePath, relativePath).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("does not implement a second API client, SSE parser, session runtime, mapper, renderer, feedback, action, or approval runtime", async () => {
    const sourceFiles = await readSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      for (const forbiddenFactory of forbiddenRuntimeFactories) {
        expect(
          source,
          `${relativePath} must consume Shared Canonical Assistant Runtime instead of creating duplicate runtime behavior via ${forbiddenFactory}`,
        ).not.toContain(forbiddenFactory);
      }
    }
  });
});
