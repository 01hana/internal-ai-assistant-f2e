import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  forbiddenNuxtConfigBoundaryPatterns,
  forbiddenReferenceConsumerImports,
  forbiddenStringSignalDeclarations,
  hasPublicSdkPackageResolutionSignal,
  hasPublicSdkNamedImport,
  hasSdkStylesheetImport,
  hasPublicSdkStylesheetResolutionSignal,
  importSpecifiers,
  nuxtConfigFile,
  pluginTypeImportNames,
  previewValueImportNames,
  referenceConsumerFiles,
  requiredReferenceConsumerImports,
} from "../../fixtures/assistant-sdk/reference-consumer-fixtures";

async function readReferenceConsumerFiles() {
  const files = await Promise.all(referenceConsumerFiles.map(async path => ({
    path,
    source: await readFile(path, "utf8"),
  })));

  return Object.fromEntries(files.map(file => [file.path, file.source]));
}

function combinedSource(files: Record<string, string>) {
  return Object.entries(files)
    .map(([path, source]) => `/* ${path} */\n${source}`)
    .join("\n");
}

describe("Frontend 002 Nuxt reference consumer public-entry smoke", () => {
  it("requires the Nuxt reference consumer plugin and preview page", async () => {
    const files = await readReferenceConsumerFiles();
    const source = combinedSource(files);

    for (const file of referenceConsumerFiles) {
      expect(source).toContain(file);
    }
  });

  it("imports plugin public SDK types and stylesheet from actual public entries", async () => {
    const files = await readReferenceConsumerFiles();
    const pluginSource = files["app/plugins/assistant-sdk.client.ts"];

    expect(pluginSource).toBeDefined();
    expect(
      hasPublicSdkNamedImport(pluginSource, pluginTypeImportNames, "type"),
      "Reference plugin must import SDK public types from the public package entry.",
    ).toBe(true);
    expect(
      hasSdkStylesheetImport(pluginSource),
      "Reference plugin must import the SDK stylesheet public entry.",
    ).toBe(true);
  });

  it("imports preview component/helper and stylesheet from actual public entries", async () => {
    const files = await readReferenceConsumerFiles();
    const previewSource = files["app/pages/assistant-sdk-preview.vue"];

    expect(previewSource).toBeDefined();
    expect(
      hasPublicSdkNamedImport(previewSource, previewValueImportNames, "value"),
      "Reference preview must import AssistantWidget and mountAssistantWidget from the public package entry.",
    ).toBe(true);
    expect(
      hasSdkStylesheetImport(previewSource),
      "Reference preview must import the SDK stylesheet public entry.",
    ).toBe(true);
  });

  it("does not rely on string constants to fake public SDK usage", async () => {
    const files = await readReferenceConsumerFiles();
    const source = combinedSource(files);

    for (const forbiddenPattern of forbiddenStringSignalDeclarations) {
      expect(source, "Reference consumer must use actual imports, not string signal declarations.").not.toMatch(forbiddenPattern);
    }
  });

  it("does not import SDK internals or Frontend 001 app internals", async () => {
    const files = await readReferenceConsumerFiles();
    const imports = Object.values(files).flatMap(source => importSpecifiers(source));

    for (const forbiddenImport of forbiddenReferenceConsumerImports) {
      expect(imports, `Reference consumer must not import ${forbiddenImport}.`).not.toContain(forbiddenImport);
      expect(
        imports.some(importPath => importPath.startsWith(forbiddenImport)),
        `Reference consumer must not deep import ${forbiddenImport}.`,
      ).toBe(false);
    }
  });

  it("configures Nuxt to resolve the public SDK package entries", async () => {
    const source = await readFile(nuxtConfigFile, "utf8");

    expect(
      hasPublicSdkPackageResolutionSignal(source),
      "Nuxt config must include package-level resolution for the public SDK entry.",
    ).toBe(true);
    expect(
      hasPublicSdkStylesheetResolutionSignal(source),
      "Nuxt config must include package-level resolution for the public SDK stylesheet entry.",
    ).toBe(true);
  });

  it("does not expose SDK internals or Frontend 001 internals through Nuxt config", async () => {
    const source = await readFile(nuxtConfigFile, "utf8");

    for (const forbiddenPattern of forbiddenNuxtConfigBoundaryPatterns) {
      expect(source, "Nuxt config must not expose SDK internals or Frontend 001 internals.").not.toMatch(forbiddenPattern);
    }
  });

  it("covers provider, configuration, callbacks, route context, selectedRows updates, and public symbols", async () => {
    const files = await readReferenceConsumerFiles();
    const source = combinedSource(files);

    for (const signal of [
      "provider",
      "configuration",
      "callbacks",
      "route",
      "entity",
      "selectedRows",
      ...requiredReferenceConsumerImports,
    ]) {
      expect(source, `Reference consumer smoke must cover ${signal}.`).toContain(signal);
    }
  });
});
