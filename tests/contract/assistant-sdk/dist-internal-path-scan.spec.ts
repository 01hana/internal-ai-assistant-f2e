import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  forbiddenDistSourcePathPatterns,
  sdkDistDirectory,
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

async function collectDistFiles(): Promise<string[]> {
  const absoluteDistDirectory = join(projectRootPath, sdkDistDirectory);
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
        files.push(absolutePath);
      }
    }
  }

  await walk(absoluteDistDirectory);

  return files;
}

describe("Frontend 002 SDK dist internal path scan", () => {
  it("requires SDK dist output before unresolved source-path release validation can pass", async () => {
    expect(await pathExists(sdkDistDirectory), "SDK dist directory must exist before unresolved source-path release validation can pass.").toBe(true);
  });

  it("does not retain unresolved canonical app or SDK private source paths in built output", async () => {
    expect(await pathExists(sdkDistDirectory), "SDK dist directory must exist for unresolved source-path scan.").toBe(true);
    const files = await collectDistFiles();
    for (const file of files) {
      const source = await readFile(file, "utf8");
      const displayPath = relative(projectRootPath, file);

      for (const forbiddenPattern of forbiddenDistSourcePathPatterns) {
        expect(source, `${displayPath} must not retain ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      }
    }
  });
});
