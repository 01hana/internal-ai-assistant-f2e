import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import AssistantWidget from "../../../packages/assistant-sdk/src/components/AssistantWidget.vue";
import {
  approvedRuntimeBridgeFilePatterns,
  forbiddenDuplicateRuntimeFilePatterns,
  forbiddenRuntimeFactories,
} from "../../fixtures/assistant-sdk/architecture-guardrails";
import {
  forbiddenPackagedRuntimeSourcePatterns,
  productizedClosedWidgetRequirements,
  productizedAssistantWidgetShellTexts,
} from "../../fixtures/assistant-sdk/productized-sdk-fixtures";

const projectRootPath = process.cwd();
const sdkSourcePath = join(projectRootPath, "packages/assistant-sdk/src");
const sdkComponentPath = join(sdkSourcePath, "components/AssistantWidget.vue");
const sdkDistPath = join(projectRootPath, "packages/assistant-sdk/dist");

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

function queryAny(container: Element, selectors: readonly string[]) {
  return selectors.some(selector => container.matches(selector) || container.querySelector(selector));
}

function isApprovedRuntimeBridge(relativePath: string) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  return approvedRuntimeBridgeFilePatterns.some(pattern => pattern.test(normalizedPath));
}

describe("Frontend 002 productized AssistantWidget runtime completeness", () => {
  it("does not render or ship shell placeholder copy", async () => {
    const source = await readFile(sdkComponentPath, "utf8");
    const wrapper = mount(AssistantWidget, {
      props: {
        provider: async () => ({ hostApp: "phase-11-productized-widget" }),
      },
    });
    const renderedText = wrapper.text();

    for (const forbiddenText of productizedAssistantWidgetShellTexts) {
      expect(source, `AssistantWidget source must not contain shell placeholder text: ${forbiddenText}.`).not.toContain(forbiddenText);
      expect(renderedText, `AssistantWidget render output must not contain shell placeholder text: ${forbiddenText}.`).not.toContain(forbiddenText);
    }
  });

  it("renders the closed widget launcher and root without requiring an open panel", () => {
    const wrapper = mount(AssistantWidget, {
      props: {
        provider: async () => ({ hostApp: "phase-11-productized-widget" }),
      },
    });
    const root = wrapper.element;

    for (const requirement of productizedClosedWidgetRequirements) {
      expect(
        queryAny(root, requirement.selectors),
        `Productized AssistantWidget must render ${requirement.name} using semantic selectors or accessible roles.`,
      ).toBe(true);
    }
  });

  it("keeps canonical runtime reuse guardrails while becoming productized", async () => {
    const sourceFiles = await collectFiles(sdkSourcePath);

    for (const file of sourceFiles) {
      const relativePath = relative(projectRootPath, file).replaceAll("\\", "/");
      const source = await readFile(file, "utf8");

      for (const forbiddenPattern of forbiddenDuplicateRuntimeFilePatterns) {
        expect(relativePath, `${relativePath} must not duplicate canonical runtime files.`).not.toMatch(forbiddenPattern);
      }

      if (isApprovedRuntimeBridge(relativePath)) {
        continue;
      }

      for (const forbiddenFactory of forbiddenRuntimeFactories) {
        expect(source, `${relativePath} must not implement a second runtime factory ${forbiddenFactory}.`).not.toContain(forbiddenFactory);
      }
    }
  });

  it("does not leave unresolved source-time runtime paths in built artifact output", async () => {
    expect(await pathExists(sdkDistPath), "Phase 11 productized widget tests require an inspectable built SDK dist.").toBe(true);
    const distFiles = await collectFiles(sdkDistPath);

    for (const file of distFiles) {
      const source = await readFile(file, "utf8");
      const relativePath = relative(projectRootPath, file);

      for (const forbiddenPattern of forbiddenPackagedRuntimeSourcePatterns) {
        expect(source, `${relativePath} must not retain unresolved source path ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      }
    }
  });
});
