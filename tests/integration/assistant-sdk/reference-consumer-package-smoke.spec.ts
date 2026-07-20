import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  forbiddenInstalledImportPatterns,
  requiredReleaseReadinessChecks,
  sdkPackageName,
  sdkPackageRoot,
  sdkStylesheetEntry,
} from "../../fixtures/assistant-sdk/release-readiness-contract";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const execFileAsync = promisify(execFile);

const referenceConsumerFiles = [
  "app/plugins/assistant-sdk.client.ts",
  "app/pages/assistant-sdk-preview.vue",
] as const;

async function readReferenceConsumerSources() {
  return Promise.all(
    referenceConsumerFiles.map(async file => ({
      file,
      source: await readFile(join(projectRootPath, file), "utf8"),
    })),
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  }
  catch {
    return false;
  }
}

async function stagePackedSdkPackage(): Promise<{
  cleanup: () => Promise<void>;
  consumerRoot: string;
  installedPackageRoot: string;
  packOutput: unknown;
}> {
  const tempRoot = await mkdtemp(join(tmpdir(), "assistant-sdk-package-smoke-"));
  const packDirectory = join(tempRoot, "pack");
  const cacheDirectory = join(tempRoot, "npm-cache");
  const extractDirectory = join(tempRoot, "extract");
  const consumerRoot = join(tempRoot, "consumer");
  const scopedPackageRoot = join(consumerRoot, "node_modules", "@internal-ai-assistant");
  const installedPackageRoot = join(scopedPackageRoot, "assistant-sdk");

  await mkdir(packDirectory, { recursive: true });
  await mkdir(extractDirectory, { recursive: true });
  await mkdir(scopedPackageRoot, { recursive: true });

  const { stdout } = await execFileAsync("npm", ["pack", "--json", "--pack-destination", packDirectory], {
    cwd: join(projectRootPath, sdkPackageRoot),
    env: {
      ...process.env,
      npm_config_cache: cacheDirectory,
    },
  });
  const packOutput = JSON.parse(stdout) as Array<{ filename?: string }>;
  const tarball = packOutput[0]?.filename;

  expect(tarball, "npm pack must produce a local tarball for package smoke validation.").toBeTruthy();

  await execFileAsync("tar", ["-xzf", join(packDirectory, tarball as string), "-C", extractDirectory]);
  await cp(join(extractDirectory, "package"), installedPackageRoot, { recursive: true });

  return {
    cleanup: () => rm(tempRoot, { recursive: true, force: true }),
    consumerRoot,
    installedPackageRoot,
    packOutput,
  };
}

describe("Frontend 002 reference consumer package install readiness", () => {
  it("uses only public SDK package and stylesheet entries from Host App source", async () => {
    const sources = await readReferenceConsumerSources();
    const combinedSource = sources.map(({ source }) => source).join("\n");

    expect(combinedSource).toContain(sdkPackageName);
    expect(combinedSource).toContain(sdkStylesheetEntry);

    for (const { file, source } of sources) {
      for (const forbiddenPattern of forbiddenInstalledImportPatterns) {
        expect(source, `${file} must not use ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("keeps provider, configuration, callbacks, session lifecycle, and gated Host Integration readiness expressible through public package usage", async () => {
    const combinedSource = (await readReferenceConsumerSources()).map(({ source }) => source).join("\n");

    for (const signal of [
      "provider",
      "configuration",
      "callbacks",
      "selectedRows",
      "backend001-compatibility",
      "mountAssistantWidget",
      "AssistantWidget",
    ]) {
      expect(combinedSource, `Reference consumer package smoke must include ${signal}.`).toContain(signal);
    }

    expect(requiredReleaseReadinessChecks).toContain("host-integration-gated-disabled");
    expect(requiredReleaseReadinessChecks).toContain("host-integration-gated-enabled");
  });

  it("resolves a locally packed SDK artifact through public package entries only", async () => {
    const staged = await stagePackedSdkPackage();

    try {
      const packageJsonPath = join(staged.consumerRoot, "package.json");
      const resolveScriptPath = join(staged.consumerRoot, "resolve-sdk-package.mjs");
      await mkdir(dirname(packageJsonPath), { recursive: true });
      await writeFile(packageJsonPath, JSON.stringify({ type: "module" }), "utf8");
      await writeFile(
        resolveScriptPath,
        [
          `const root = import.meta.resolve(${JSON.stringify(sdkPackageName)});`,
          `const stylesheet = import.meta.resolve(${JSON.stringify(sdkStylesheetEntry)});`,
          "console.log(JSON.stringify({ root, stylesheet }));",
        ].join("\n"),
        "utf8",
      );

      const { stdout } = await execFileAsync("node", [resolveScriptPath], {
        cwd: staged.consumerRoot,
      });
      const resolved = JSON.parse(stdout) as {
        root: string;
        stylesheet: string;
      };
      const rootResolution = fileURLToPath(resolved.root);
      const stylesheetResolution = fileURLToPath(resolved.stylesheet);

      expect(await realpath(rootResolution), "Root public package entry must resolve to built dist output.").toBe(await realpath(join(staged.installedPackageRoot, "dist", "index.mjs")));
      expect(await realpath(stylesheetResolution), "Stylesheet public package entry must resolve to package stylesheet.").toBe(await realpath(join(staged.installedPackageRoot, "styles.css")));
      expect(await pathExists(rootResolution), "Resolved root package entry must exist.").toBe(true);
      expect(await pathExists(stylesheetResolution), "Resolved stylesheet entry must exist.").toBe(true);

      for (const resolvedPath of [rootResolution, stylesheetResolution]) {
        const relativeResolvedPath = relative(staged.consumerRoot, resolvedPath);
        for (const forbiddenPattern of forbiddenInstalledImportPatterns) {
          expect(relativeResolvedPath, `Packed consumer resolution must not use ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
        }
      }

      expect(JSON.stringify(staged.packOutput), "Pack output must not list private SDK internals or app source.").not.toMatch(/src\/(?:runtime|transport|session|events|context|request)|app\/(?:features|services|stores|utils)|tests\/|fixtures\//);
    }
    finally {
      await staged.cleanup();
    }
  });
});
