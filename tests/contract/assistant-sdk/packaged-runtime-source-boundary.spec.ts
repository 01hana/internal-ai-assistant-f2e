import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import {
  forbiddenPhase11PackageExportKeys,
  forbiddenPackagedRuntimeSourcePatterns,
  forbiddenSourcemapSignals,
} from "../../fixtures/assistant-sdk/productized-sdk-fixtures";
import {
  sdkDistDirectory,
  sdkPackageManifest,
  sdkPackageRoot,
} from "../../fixtures/assistant-sdk/release-readiness-contract";

const projectRootPath = process.cwd();
const execFileAsync = promisify(execFile);
const temporaryPackCachePath = "/private/tmp/assistant-sdk-productized-pack-cache";

type NpmPackDryRunResult = {
  readonly filename?: string;
  readonly files?: readonly {
    readonly path: string;
  }[];
};

async function pathExists(path: string) {
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
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(entryPath);
    }
    return entry.isFile() ? [entryPath] : [];
  }));

  return files.flat();
}

describe("Frontend 002 packaged runtime source boundary", () => {
  it("does not expose runtime, transport, session, context, request, fixtures, tests, or nuxt deep exports", async () => {
    const manifest = JSON.parse(await readFile(join(projectRootPath, sdkPackageManifest), "utf8")) as {
      exports?: Record<string, unknown>;
    };
    const exportKeys = Object.keys(manifest.exports ?? {});

    expect(exportKeys.sort()).toEqual([".", "./styles.css"].sort());
    for (const forbiddenExport of forbiddenPhase11PackageExportKeys) {
      expect(exportKeys, `Productized package must not expose ${forbiddenExport}.`).not.toContain(forbiddenExport);
    }
  });

  it("allows compiled dist code but rejects unresolved app/source/test/spec paths", async () => {
    const distPath = join(projectRootPath, sdkDistDirectory);
    expect(await pathExists(distPath), "Packaged runtime source boundary requires built SDK dist output.").toBe(true);

    const files = await collectFiles(distPath);
    expect(files, "SDK dist must include inspectable compiled output.").toContain(join(projectRootPath, sdkDistDirectory, "index.mjs"));

    for (const file of files) {
      const source = await readFile(file, "utf8");
      const displayPath = relative(projectRootPath, file);

      for (const forbiddenPattern of forbiddenPackagedRuntimeSourcePatterns) {
        expect(source, `${displayPath} must not retain unresolved source path ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("does not emit sourcemaps or sourcemap source content into dist", async () => {
    const files = await collectFiles(join(projectRootPath, sdkDistDirectory));

    for (const file of files) {
      const source = await readFile(file, "utf8");
      const displayPath = relative(projectRootPath, file);

      for (const forbiddenSignal of forbiddenSourcemapSignals) {
        expect(displayPath, `SDK package must not include sourcemap file ${forbiddenSignal}.`).not.toMatch(forbiddenSignal);
        expect(source, `${displayPath} must not include sourcemap signal ${forbiddenSignal}.`).not.toMatch(forbiddenSignal);
      }
    }
  });

  it("keeps npm pack dry-run output free of private source, fixtures, tests, specs, and sourcemaps", async () => {
    await mkdir(temporaryPackCachePath, { recursive: true });
    try {
      const { stdout } = await execFileAsync("npm", ["pack", "--dry-run", "--json"], {
        cwd: join(projectRootPath, sdkPackageRoot),
        env: {
          ...process.env,
          npm_config_cache: temporaryPackCachePath,
        },
      });
      const [packResult] = JSON.parse(stdout) as NpmPackDryRunResult[];
      const packFiles = packResult.files?.map(file => file.path.replaceAll("\\", "/")) ?? [];

      expect(packResult.filename, "npm pack dry-run must report a package filename.").toMatch(/\.tgz$/);
      expect(packFiles, "npm pack dry-run must include package metadata.").toContain("package.json");
      expect(packFiles, "npm pack dry-run must include the public ESM entry.").toContain("dist/index.mjs");
      expect(packFiles, "npm pack dry-run must include the public type entry.").toContain("dist/index.d.ts");
      expect(packFiles, "npm pack dry-run must include the public stylesheet entry.").toContain("styles.css");

      for (const forbiddenPattern of forbiddenPackagedRuntimeSourcePatterns) {
        expect(packFiles.join("\n"), `npm pack file list must not include ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      }
      for (const forbiddenSignal of forbiddenSourcemapSignals) {
        expect(packFiles.join("\n"), `npm pack file list must not include sourcemap signal ${forbiddenSignal}.`).not.toMatch(forbiddenSignal);
      }

      for (const forbiddenPathPattern of [
        /^src\//,
        /^tests?\//,
        /^fixtures?\//,
        /^specs?\//,
        /^app\//,
        /\.map$/,
      ]) {
        expect(packFiles.join("\n"), `npm pack file list must not include ${forbiddenPathPattern}.`).not.toMatch(forbiddenPathPattern);
      }
    }
    finally {
      await rm(temporaryPackCachePath, { recursive: true, force: true });
    }
  });
});
