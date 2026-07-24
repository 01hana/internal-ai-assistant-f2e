import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { createPublicOnlyConsumerSource } from "./productized-sdk-fixtures";

const execFileAsync = promisify(execFile);
const projectRootPath = process.cwd();
const temporaryRootPath = "/private/tmp";
const sdkPackageRootPath = join(projectRootPath, "packages/assistant-sdk");
const sdkPackageName = "@ideaxpress/assistant-sdk";
const sdkStylesSpecifier = "@ideaxpress/assistant-sdk/styles.css";

type NpmPackResult = {
  readonly filename: string;
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

async function createSdkTarball(packDestination: string) {
  const { stdout } = await execFileAsync("npm", ["pack", "--json", "--pack-destination", packDestination], {
    cwd: sdkPackageRootPath,
    env: {
      ...process.env,
      npm_config_cache: join(temporaryRootPath, "assistant-sdk-productized-pack-cache"),
    },
  });
  const [packResult] = JSON.parse(stdout) as NpmPackResult[];
  const filename = packResult.filename;

  return {
    packResult,
    tarballPath: isAbsolute(filename) ? filename : join(packDestination, basename(filename)),
  } as const;
}

async function symlinkProjectDependency(consumerRoot: string, dependencyName: string) {
  const projectDependencyPath = join(projectRootPath, "node_modules", dependencyName);
  const consumerDependencyPath = join(consumerRoot, "node_modules", dependencyName);

  if (!(await pathExists(projectDependencyPath)) || await pathExists(consumerDependencyPath)) {
    return;
  }

  await symlink(projectDependencyPath, consumerDependencyPath, "dir");
}

async function stagePackedSdkIntoConsumer(consumerRoot: string, tarballPath: string) {
  const installedPackageRoot = join(consumerRoot, "node_modules/@ideaxpress/assistant-sdk");

  await mkdir(installedPackageRoot, { recursive: true });
  await execFileAsync("tar", ["-xzf", tarballPath, "-C", installedPackageRoot, "--strip-components=1"], {
    timeout: 20_000,
  });

  return installedPackageRoot;
}

export async function createTemporaryConsumingApp(
  options: {
    readonly source?: string;
  } = {},
) {
  await mkdir(temporaryRootPath, { recursive: true });

  const root = await mkdtemp(join(temporaryRootPath, "assistant-sdk-productized-consumer-"));
  const sourceFile = join(root, "consumer-entry.ts");
  const runtimeBridgeFile = join(root, "consumer-runtime.mjs");
  const { packResult, tarballPath } = await createSdkTarball(root);
  const packageJsonPath = join(root, "package.json");

  await writeFile(
    packageJsonPath,
    JSON.stringify({
      dependencies: {
        [sdkPackageName]: `file:${tarballPath}`,
      },
      private: true,
      type: "module",
    }, null, 2),
    "utf8",
  );
  await writeFile(sourceFile, options.source ?? createPublicOnlyConsumerSource(), "utf8");
  await writeFile(runtimeBridgeFile, `export * from ${JSON.stringify(sdkPackageName)};\n`, "utf8");

  const installedPackageRoot = await stagePackedSdkIntoConsumer(root, tarballPath);
  await symlinkProjectDependency(root, "vue");
  await symlinkProjectDependency(root, "pinia");

  const installedManifest = JSON.parse(await readFile(join(installedPackageRoot, "package.json"), "utf8")) as {
    readonly exports?: {
      readonly "."?: {
        readonly import?: string;
      };
      readonly "./styles.css"?: string;
    };
  };
  const resolvedEntryPath = join(installedPackageRoot, installedManifest.exports?.["."]?.import ?? "dist/index.mjs");
  const resolvedStylesPath = join(installedPackageRoot, installedManifest.exports?.["./styles.css"] ?? "styles.css");

  return {
    cleanup: () => rm(root, { recursive: true, force: true }),
    importSdk: () => import(pathToFileURL(runtimeBridgeFile).href),
    inspectInstalledRuntime: async () => {
      await symlinkProjectDependency(root, "jsdom");

      const runtimeInspectionFile = join(root, "runtime-inspection.mjs");

      await writeFile(runtimeInspectionFile, [
        "import { JSDOM } from 'jsdom';",
        "",
        "const dom = new JSDOM('<!doctype html><html><body><div id=\"target\"></div></body></html>');",
        "globalThis.window = dom.window;",
        "globalThis.document = dom.window.document;",
        "globalThis.Element = dom.window.Element;",
        "globalThis.HTMLElement = dom.window.HTMLElement;",
        "globalThis.Node = dom.window.Node;",
        "globalThis.SVGElement = dom.window.SVGElement;",
        "globalThis.Event = dom.window.Event;",
        "globalThis.InputEvent = dom.window.InputEvent;",
        "globalThis.MouseEvent = dom.window.MouseEvent;",
        "globalThis.CustomEvent = dom.window.CustomEvent;",
        "globalThis.MutationObserver = dom.window.MutationObserver;",
        "globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);",
        "Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });",
        "globalThis.requestAnimationFrame = dom.window.requestAnimationFrame ?? (callback => setTimeout(callback, 0));",
        "globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame ?? clearTimeout;",
        `const sdk = await import(${JSON.stringify(sdkPackageName)});`,
        "const { nextTick } = await import('vue');",
        "const settleRuntime = async () => {",
        "  for (let index = 0; index < 5; index += 1) {",
        "    await nextTick();",
        "    await new Promise(resolve => setTimeout(resolve, 0));",
        "  }",
        "};",
        "const target = dom.window.document.getElementById('target');",
        "let mountError = null;",
        "let closed = { childElementCount: 0, html: '' };",
        "let opened = { childElementCount: 0, html: '' };",
        "let destroyed = { childElementCount: 0, html: '' };",
        "try {",
        "  const handle = sdk.mountAssistantWidget?.({",
        "    configuration: { integrationMode: 'backend001-compatibility' },",
        "    provider: async () => ({ hostApp: 'phase-11-runtime-inspection' }),",
        "    target,",
        "  });",
        "  await settleRuntime();",
        "  closed = { childElementCount: target?.childElementCount ?? 0, html: target?.innerHTML ?? '' };",
        "  handle?.open?.();",
        "  await settleRuntime();",
        "  opened = { childElementCount: target?.childElementCount ?? 0, html: target?.innerHTML ?? '' };",
        "  handle?.destroy?.();",
        "  await settleRuntime();",
        "  destroyed = { childElementCount: target?.childElementCount ?? 0, html: target?.innerHTML ?? '' };",
        "}",
        "catch (caught) {",
        "  mountError = caught instanceof Error ? caught.message : String(caught);",
        "}",
        "console.log(JSON.stringify({",
        "  exportNames: Object.keys(sdk),",
        "  mountError,",
        "  closed,",
        "  opened,",
        "  destroyed,",
        "}));",
      ].join("\n"), "utf8");

      const { stdout } = await execFileAsync("node", [runtimeInspectionFile], {
        cwd: root,
      });

      return JSON.parse(stdout) as {
        readonly exportNames: readonly string[];
        readonly mountError: string | null;
        readonly closed: {
          readonly childElementCount: number;
          readonly html: string;
        };
        readonly opened: {
          readonly childElementCount: number;
          readonly html: string;
        };
        readonly destroyed: {
          readonly childElementCount: number;
          readonly html: string;
        };
      };
    },
    installedPackageRoot,
    packageJsonPath,
    packResult,
    resolvedEntryPath,
    resolvedStylesPath,
    root,
    runtimeBridgeFile,
    sourceFile,
    tarballPath,
  } as const;
}
