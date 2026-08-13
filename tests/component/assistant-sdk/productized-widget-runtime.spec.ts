import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

import AssistantWidget from "../../../packages/assistant-sdk/src/components/AssistantWidget.vue";
import {
  forbiddenDuplicateRuntimeFilePatterns,
  forbiddenRuntimeFactories,
} from "../../fixtures/assistant-sdk/architecture-guardrails";
import {
  forbiddenPackagedRuntimeSourcePatterns,
  productizedClosedWidgetRequirements,
  productizedAssistantWidgetShellTexts,
  productizedOpenWidgetRequirements,
} from "../../fixtures/assistant-sdk/productized-sdk-fixtures";
import { createCanonicalSseOutcomeFixture } from "../../fixtures/assistant-sdk/canonical-sse-outcome-adapter";
import { createCompatibilityFetchRouter } from "../../fixtures/assistant-sdk/compatibility-fetch-router";

const projectRootPath = process.cwd();
const sdkSourcePath = join(projectRootPath, "packages/assistant-sdk/src");
const sdkComponentPath = join(sdkSourcePath, "components/AssistantWidget.vue");
const sdkDistPath = join(projectRootPath, "packages/assistant-sdk/dist");
const sdkStylesheetPath = join(projectRootPath, "packages/assistant-sdk/styles.css");

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

function expectStylesheetOwnsSelector(stylesheet: string, selector: string) {
  expect(stylesheet, `SDK styles.css must contain package-owned styling for ${selector}.`).toContain(selector);
}

function expectStylesheetUsesThemeToken(stylesheet: string, token: string) {
  expect(stylesheet, `SDK styles.css must consume theme token ${token} with an internal fallback.`).toContain(`var(${token}`);
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

  it("opens a productized canonical runtime panel with conversation, composer, and send controls", async () => {
    const stylesheet = await readFile(sdkStylesheetPath, "utf8");
    const wrapper = mount(AssistantWidget, {
      props: {
        provider: async () => ({
          hostApp: "phase-11-productized-widget",
          pageContext: {
            route: "/orders/42",
          },
        }),
      },
    });

    expect(wrapper.find("[data-testid='assistant-runtime-root']").exists()).toBe(false);

    await wrapper.get("[data-assistant-launcher]").trigger("click");
    await flushPromises();
    await nextTick();
    await vi.waitFor(() => {
      expect(wrapper.find("[data-assistant-panel]").exists()).toBe(true);
      expect(wrapper.find("[data-testid='assistant-product-runtime-panel']").exists()).toBe(true);
    });

    const root = wrapper.element;
    for (const requirement of productizedOpenWidgetRequirements) {
      expect(
        queryAny(root, requirement.selectors),
        `Open AssistantWidget must render ${requirement.name} from the shared canonical runtime UI.`,
      ).toBe(true);
    }
    expect(wrapper.find("[data-testid='assistant-runtime-root']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='assistant-message-area']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='assistant-panel-footer']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='assistant-chat-input']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='assistant-chat-submit']").exists()).toBe(true);
    expect(wrapper.get("[data-assistant-launcher]").attributes("aria-label")).toBe("Open assistant");
    expect(wrapper.get("[data-assistant-launcher]").find("svg.assistant-product-icon").exists()).toBe(true);
    expect(wrapper.get("[data-assistant-close]").attributes("aria-label")).toBe("Close assistant");
    expect(wrapper.get("[data-assistant-close]").find("svg.assistant-product-icon").exists()).toBe(true);

    expectStylesheetOwnsSelector(stylesheet, ".assistant-sdk-panel");
    expectStylesheetOwnsSelector(stylesheet, "[data-testid=\"assistant-product-runtime-panel\"]");
    expectStylesheetOwnsSelector(stylesheet, "[data-testid=\"assistant-message-area\"]");
    expectStylesheetOwnsSelector(stylesheet, "[data-testid=\"assistant-panel-footer\"]");
    expectStylesheetOwnsSelector(stylesheet, "[data-testid=\"assistant-chat-input\"]");
    expectStylesheetOwnsSelector(stylesheet, "[data-testid=\"assistant-chat-submit\"]");
    expectStylesheetOwnsSelector(stylesheet, ".assistant-message-frame");
    expectStylesheetOwnsSelector(stylesheet, ".assistant-message-avatar--assistant");
    expectStylesheetOwnsSelector(stylesheet, ".assistant-message-avatar--user");
    expectStylesheetOwnsSelector(stylesheet, ".assistant-message-timestamp");
    expectStylesheetOwnsSelector(stylesheet, ".assistant-typing-indicator");
    expectStylesheetOwnsSelector(stylesheet, ".assistant-safe-outcome--warning");
    expectStylesheetOwnsSelector(stylesheet, ".assistant-safe-outcome--error");
    expectStylesheetOwnsSelector(stylesheet, ".assistant-safe-outcome--neutral");
    expectStylesheetUsesThemeToken(stylesheet, "--assistant-sdk-panel-background");
    expectStylesheetUsesThemeToken(stylesheet, "--assistant-sdk-message-area-background");
    expectStylesheetUsesThemeToken(stylesheet, "--assistant-sdk-message-bubble-background");
    expectStylesheetUsesThemeToken(stylesheet, "--assistant-sdk-input-background");
    expectStylesheetUsesThemeToken(stylesheet, "--assistant-sdk-button-primary-background");
    expectStylesheetUsesThemeToken(stylesheet, "--assistant-sdk-focus-ring");
    expectStylesheetUsesThemeToken(stylesheet, "--assistant-sdk-user-avatar-background");
    expect(stylesheet).not.toMatch(/@tailwind|@import\s+["'][^"']*tailwind/i);
  });

  it("wires provider, configuration, and callbacks through safe SDK boundaries", async () => {
    const provider = vi.fn(async () => ({
      hostApp: "phase-11-productized-widget",
      pageContext: {
        route: "/orders/42",
      },
      sessionScope: "local-only-session-scope",
    }));
    const onOpened = vi.fn();
    const onError = vi.fn();
    const wrapper = mount(AssistantWidget, {
      props: {
        callbacks: {
          onError,
          onOpened,
        },
        configuration: {
          sessionScope: "orders-widget",
          theme: "dark",
        },
        provider,
      },
    });

    await wrapper.get("[data-assistant-launcher]").trigger("click");
    await flushPromises();
    await nextTick();
    await vi.waitFor(() => {
      expect(wrapper.find("[data-testid='assistant-chat-input']").exists()).toBe(true);
    });

    const input = wrapper.get("[data-testid='assistant-chat-input']");
    await input.setValue("  Summarize the order  ");
    await wrapper.get("[data-testid='assistant-chat-submit']").trigger("click");
    await flushPromises();
    await nextTick();

    expect(provider).toHaveBeenCalled();
    expect(onOpened).toHaveBeenCalledWith({});
    expect(onError).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: "session_bootstrap_failed",
      }),
    });

    const callbackPayload = JSON.stringify(onError.mock.calls);
    expect(callbackPayload).not.toMatch(/pageContext|selectedRows|entityType|entityId|sessionScope|sourceSystem|authority|connector|permission|token|credential|secret/i);
    expect(wrapper.attributes("data-theme")).toBe("dark");
    expect(wrapper.attributes("data-runtime-scope")).toContain("orders-widget");
    expect(wrapper.text()).not.toContain("Summarize the order");
  });

  it("keeps component usage isolated across two widget-local runtime scopes", async () => {
    const router = createCompatibilityFetchRouter({
      sseFixture: createCanonicalSseOutcomeFixture("completed-answer"),
    });
    vi.stubGlobal("fetch", vi.fn(router.fetch));

    try {
      const first = mount(AssistantWidget, {
        props: {
          provider: async () => ({ hostApp: "first-widget" }),
        },
      });
      const second = mount(AssistantWidget, {
        props: {
          provider: async () => ({ hostApp: "second-widget" }),
        },
      });

      expect(first.attributes("data-runtime-scope")).not.toBe(second.attributes("data-runtime-scope"));

      await first.get("[data-assistant-launcher]").trigger("click");
      await flushPromises();
      await nextTick();
      await vi.waitFor(() => {
        expect(first.get("[data-testid='assistant-chat-input']").attributes("disabled")).toBeUndefined();
      });
      await first.get("[data-testid='assistant-chat-input']").setValue("first widget only");
      await first.get("[data-testid='assistant-chat-submit']").trigger("click");
      await flushPromises();
      await nextTick();

      expect(first.text()).toContain("first widget only");
      expect(second.find("[data-testid='assistant-product-runtime-panel']").exists()).toBe(false);
      expect(second.text()).not.toContain("first widget only");
    }
    finally {
      vi.unstubAllGlobals();
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

      for (const forbiddenFactory of forbiddenRuntimeFactories) {
        expect(source, `${relativePath} must not implement a second runtime factory ${forbiddenFactory}.`).not.toContain(forbiddenFactory);
      }
    }
  });

  it("does not expose SDK runtime adapter internals through the public entry or package exports", async () => {
    const rootEntry = await readFile(join(sdkSourcePath, "index.ts"), "utf8");
    const packageJson = JSON.parse(await readFile(join(projectRootPath, "packages/assistant-sdk/package.json"), "utf8")) as {
      exports?: Record<string, unknown>;
    };

    expect(rootEntry).not.toMatch(/createSdkRuntimeAdapter|createDefaultTransport|createSdkSessionLifecycleAdapter|createHostEventEmitter/);
    expect(rootEntry).not.toMatch(/\.\/runtime|\.\/transport|\.\/session|\.\/lifecycle|\.\/context|\.\/events/);
    expect(Object.keys(packageJson.exports ?? {})).toEqual([".", "./styles.css"]);
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
