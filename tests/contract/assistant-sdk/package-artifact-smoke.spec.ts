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
});
