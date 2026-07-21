// @vitest-environment jsdom

import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  expectedPublishReadinessMetadata,
  evaluateInstalledRuntimeCompleteness,
  evaluatePrivateFlagSequencing,
  requiredPublishPackageFiles,
} from "../../fixtures/assistant-sdk/publish-readiness-fixtures";
import {
  productizedAssistantWidgetShellTexts,
  productizedClosedWidgetRequirements,
  productizedOpenWidgetRequirements,
  requiredReadmeSections,
} from "../../fixtures/assistant-sdk/productized-sdk-fixtures";
import {
  sdkPackageManifest,
  sdkPackageRoot,
} from "../../fixtures/assistant-sdk/release-readiness-contract";
import { createTemporaryConsumingApp } from "../../fixtures/assistant-sdk/temporary-consuming-app";

const projectRootPath = process.cwd();
const readmePath = join(projectRootPath, sdkPackageRoot, "README.md");

async function pathExists(path: string) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  }
  catch {
    return false;
  }
}

async function readManifest() {
  return JSON.parse(await readFile(join(projectRootPath, sdkPackageManifest), "utf8")) as {
    files?: string[];
    license?: string;
    name?: string;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    private?: boolean;
    publishConfig?: {
      access?: string;
      registry?: string;
    };
    version?: string;
  };
}

function queryAny(container: Element, selectors: readonly string[]) {
  return selectors.some(selector => container.querySelector(selector));
}

function markdownHeadingPattern(heading: string) {
  return new RegExp(`^#{1,6}\\s+.*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "im");
}

describe("Frontend 002 GitHub Packages publish readiness", () => {
  it("declares final productized package identity and GitHub Packages metadata", async () => {
    const manifest = await readManifest();

    expect(manifest.name).toBe(expectedPublishReadinessMetadata.name);
    expect(manifest.version).toBe(expectedPublishReadinessMetadata.version);
    expect(manifest.license).toBe(expectedPublishReadinessMetadata.license);
    expect(manifest.publishConfig?.registry).toBe(expectedPublishReadinessMetadata.registry);
    expect(manifest.publishConfig?.access).toBe(expectedPublishReadinessMetadata.access);
  });

  it("keeps Vue as peer dependency and makes Nuxt an optional peer dependency", async () => {
    const manifest = await readManifest();

    expect(manifest.peerDependencies?.vue, "Vue must remain a consumer-provided peer dependency.").toBeTruthy();
    expect(manifest.peerDependencies?.nuxt, "Nuxt peer boundary must remain declared for Nuxt 4 consumers.").toBeTruthy();
    expect(manifest.peerDependenciesMeta?.nuxt?.optional, "Nuxt must be optional peer dependency for productized SDK publish readiness.").toBe(true);
  });

  it("keeps actual private flag sequencing tied to installed runtime completeness evidence", async () => {
    const manifest = await readManifest();
    const app = await createTemporaryConsumingApp();

    try {
      const entrySource = await readFile(app.resolvedEntryPath, "utf8");
      const inspection = await app.inspectInstalledRuntime();

      const closedTarget = document.createElement("div");
      const openedTarget = document.createElement("div");
      closedTarget.innerHTML = inspection.closed.html;
      openedTarget.innerHTML = inspection.opened.html;

      const runtimeEvidence = evaluateInstalledRuntimeCompleteness({
        closedWidgetDom: productizedClosedWidgetRequirements.every(requirement => queryAny(closedTarget, requirement.selectors)),
        openedWidgetDom: productizedOpenWidgetRequirements.every(requirement => queryAny(openedTarget, requirement.selectors)),
        mountError: inspection.mountError,
        publicEntryResolved: await pathExists(app.resolvedEntryPath),
        shellTextFound: productizedAssistantWidgetShellTexts.some(text =>
          entrySource.includes(text)
          || closedTarget.textContent?.includes(text)
          || openedTarget.textContent?.includes(text)),
        stylesheetEntryResolved: await pathExists(app.resolvedStylesPath),
      });
      const result = evaluatePrivateFlagSequencing({
        packagePrivate: manifest.private,
        runtimeComplete: runtimeEvidence.complete,
      });

      expect(result, `private flag sequencing must match installed runtime evidence: ${runtimeEvidence.missing.join(", ")}`).toEqual({ ok: true });
      expect(inspection.exportNames, "Installed runtime evidence must inspect the public package entry.").toEqual(expect.arrayContaining(["AssistantWidget", "mountAssistantWidget"]));
      expect(inspection.destroyed.childElementCount, "Destroyed runtime evidence must be captured separately from mounted completeness evidence.").toBe(0);
    }
    finally {
      await app.cleanup();
    }
  });

  it("includes public package files needed for publish readiness", async () => {
    const manifest = await readManifest();

    for (const requiredFile of requiredPublishPackageFiles) {
      expect(manifest.files, `Package files must include ${requiredFile}.`).toContain(requiredFile);
    }
  });

  it("includes README with productized SDK usage, security, compatibility, and release notes sections", async () => {
    expect(await pathExists(readmePath), "Productized SDK README must exist before publish readiness can close.").toBe(true);
    const readme = await readFile(readmePath, "utf8");

    for (const requiredSection of requiredReadmeSections) {
      expect(readme, `README must include a Markdown heading for ${requiredSection}.`).toMatch(markdownHeadingPattern(requiredSection));
    }
  });

  it("does not execute or encode real npm publish as part of readiness tests", async () => {
    const testSource = await readFile(join(projectRootPath, "tests/contract/assistant-sdk/publish-readiness.spec.ts"), "utf8");

    expect(testSource).not.toMatch(/exec(?:File)?Async\(["']npm["'],\s*\[[^\]]*["']publish["']/);
    expect(testSource).not.toMatch(/spawn\(["']npm["'],\s*\[[^\]]*["']publish["']/);
  });
});
