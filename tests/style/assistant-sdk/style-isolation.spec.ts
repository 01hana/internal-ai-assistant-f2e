import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  forbiddenGlobalStyleSelectors,
  requiredStyleSignals,
  selectorPattern,
} from "../../fixtures/assistant-sdk/style-isolation-fixtures";

const stylesheetPath = "packages/assistant-sdk/styles.css";

async function readSdkStylesheet() {
  return await readFile(stylesheetPath, "utf8");
}

describe("Frontend 002 SDK style isolation", () => {
  it("keeps SDK styles scoped to the package root", async () => {
    const source = await readSdkStylesheet();

    expect(source).toMatch(/\.assistant-sdk-root|\[data-assistant-sdk-root\]/);
    for (const signal of requiredStyleSignals) {
      expect(source, `SDK stylesheet must include ${signal}.`).toContain(signal);
    }
  });

  it("does not insert global resets or host-wide element selectors", async () => {
    const source = await readSdkStylesheet();

    for (const selector of forbiddenGlobalStyleSelectors) {
      expect(source, `SDK stylesheet must not style global selector ${selector}.`).not.toMatch(selectorPattern(selector));
    }
  });

  it("does not mutate host root tokens outside documented SDK variables", async () => {
    const source = await readSdkStylesheet();
    const rootBlocks = source.match(/:root\s*\{[\s\S]*?\}/g) ?? [];

    for (const block of rootBlocks) {
      expect(block, "Any :root token must be documented as an SDK CSS variable.").not.toMatch(/--(?!assistant-sdk-)[\w-]+\s*:/);
    }
  });

  it("exposes a diagnosable stylesheet integration hook", async () => {
    const source = await readSdkStylesheet();

    expect(source).toMatch(/assistant-sdk-root|data-assistant-sdk-root/);
    expect(source).toContain("--assistant-sdk-");
  });
});

