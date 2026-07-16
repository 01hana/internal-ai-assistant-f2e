import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = new URL("../../../", import.meta.url);
const sdkRootPath = fileURLToPath(new URL("packages/assistant-sdk", projectRoot));
const sdkPackageJsonPath = join(sdkRootPath, "package.json");
const sdkViteConfigPath = join(sdkRootPath, "vite.config.ts");

const forbiddenBundledNuxtRuntimeDependencies = [
  "nuxt",
  "@nuxt/schema",
  "@nuxt/kit",
  "@nuxt/ui",
  "@nuxt/icon",
  "@pinia/nuxt",
  "@vueuse/nuxt",
] as const;

const allowedNuxtPeerDependencyKeys = [
  "nuxt",
  "@nuxt/schema",
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

describe("Frontend 002 SDK peer dependency boundary", () => {
  it("allows Phase 1 unit checks to run before the SDK package skeleton exists", async () => {
    if (!(await pathExists(sdkRootPath))) {
      expect(await pathExists(sdkPackageJsonPath), "SDK package manifest is not created yet; peer dependency boundary becomes required once package skeleton exists.").toBe(false);
    }
  });

  it("uses the consumer Vue runtime and does not bundle Vue or Nuxt runtime dependencies", async () => {
    if (!(await pathExists(sdkPackageJsonPath))) {
      expect(await pathExists(sdkRootPath), "SDK package manifest is not created yet; skipping peer dependency enforcement until package skeleton work.").toBe(false);
      return;
    }

    const packageJson = JSON.parse(await readFile(sdkPackageJsonPath, "utf8")) as {
      dependencies?: Record<string, unknown>;
      peerDependencies?: Record<string, unknown>;
    };
    const dependencies = packageJson.dependencies ?? {};
    const peerDependencies = packageJson.peerDependencies ?? {};

    expect(dependencies, "SDK package must use the consumer Vue runtime; vue belongs in peerDependencies, not dependencies.").not.toHaveProperty("vue");
    expect(peerDependencies, "SDK package must declare vue as a peer dependency.").toHaveProperty("vue");

    for (const dependencyName of forbiddenBundledNuxtRuntimeDependencies) {
      expect(dependencies, `SDK package must not bundle Nuxt runtime dependency ${dependencyName}; Nuxt integration stays at the consumer boundary.`).not.toHaveProperty(dependencyName);
    }

    expect(
      allowedNuxtPeerDependencyKeys.some(peerDependencyName => Object.hasOwn(peerDependencies, peerDependencyName)),
      "SDK package must declare a Nuxt peer boundary, for example nuxt or @nuxt/schema, instead of bundling a private Nuxt runtime.",
    ).toBe(true);
  });

  it("externalizes Vue in the SDK library build when a Vite config exists", async () => {
    if (!(await pathExists(sdkViteConfigPath))) {
      expect(
        await pathExists(sdkViteConfigPath),
        "SDK Vite config is not created yet; Vue externalization will be enforced once T013 creates packages/assistant-sdk/vite.config.ts.",
      ).toBe(false);
      return;
    }

    const source = await readFile(sdkViteConfigPath, "utf8");

    expect(source, "SDK Vite library config must define Rollup externalization.").toMatch(/\bexternal\b/);
    expect(source, "SDK Vite library config must externalize vue so consumers provide their own Vue runtime.").toMatch(/\bexternal\b[\s\S]*["']vue["']/);
    expect(source, "SDK Vite config must not force vue into a bundled/noExternal runtime.").not.toMatch(/\bnoExternal\b[\s\S]*["']vue["']/);
  });
});
