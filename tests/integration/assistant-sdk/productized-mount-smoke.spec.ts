// @vitest-environment jsdom

import { access, readFile } from "node:fs/promises";
import { nextTick } from "vue";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

import {
  forbiddenProductizedConsumerImportPatterns,
  productizedClosedWidgetRequirements,
  productizedOpenWidgetRequirements,
} from "../../fixtures/assistant-sdk/productized-sdk-fixtures";
import { createTemporaryConsumingApp } from "../../fixtures/assistant-sdk/temporary-consuming-app";

type TemporaryConsumingApp = Awaited<ReturnType<typeof createTemporaryConsumingApp>>;
type MountHandleLike = {
  readonly open?: () => void;
  readonly close?: () => void;
  readonly unmount?: () => void;
  readonly destroy?: () => void;
};
type InstalledSdk = {
  readonly mountAssistantWidget: (options: Record<string, unknown>) => MountHandleLike;
};

function queryAny(container: Element, selectors: readonly string[]) {
  return selectors.some(selector => container.querySelector(selector));
}

function queryVisible(container: Element, selectors: readonly string[]) {
  return selectors.some((selector) => {
    const element = container.querySelector<HTMLElement>(selector);

    return Boolean(
      element
      && !element.hidden
      && element.getAttribute("aria-hidden") !== "true"
      && element.style.display !== "none"
      && element.style.visibility !== "hidden",
    );
  });
}

function isDuplicateMountDiagnostic(value: unknown) {
  return Boolean(
    value
    && typeof value === "object"
    && /duplicate|already.?mounted|mount/i.test(JSON.stringify(value)),
  );
}

async function expectPathExists(path: string, message: string) {
  await expect(access(path), message).resolves.toBeUndefined();
}

describe("Frontend 002 productized mountAssistantWidget smoke", () => {
  let app: TemporaryConsumingApp;
  let sdk: InstalledSdk;

  beforeAll(async () => {
    app = await createTemporaryConsumingApp();
    sdk = await app.importSdk() as InstalledSdk;
  }, 60_000);

  afterAll(async () => {
    await app?.cleanup();
  });

  it("installs and resolves only public SDK package entries from a temporary consuming app", async () => {
    const source = await readFile(app.sourceFile, "utf8");

    expect(app.root.startsWith("/private/tmp/assistant-sdk-productized-consumer-")).toBe(true);
    await expectPathExists(app.tarballPath, "Temporary consumer must use a local SDK tarball.");
    await expectPathExists(app.resolvedEntryPath, "Temporary consumer must resolve the SDK root public entry.");
    await expectPathExists(app.resolvedStylesPath, "Temporary consumer must resolve the SDK stylesheet public entry.");
    expect(source).toContain("@internal-ai-assistant/assistant-sdk");
    expect(source).toContain("@internal-ai-assistant/assistant-sdk/styles.css");

    for (const forbiddenPattern of forbiddenProductizedConsumerImportPatterns) {
      expect(source, `Temporary consuming app must not use ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      expect(app.resolvedEntryPath, `Resolved public entry must not point at ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      expect(app.resolvedStylesPath, `Resolved stylesheet entry must not point at ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
    }
  });

  it("mounts, opens, closes, and cleans up widget DOM from the installed package public entry", async () => {
    const target = document.createElement("div");
    const callbacks = {
      onClosed: vi.fn(),
      onOpened: vi.fn(),
    };
    const handle = sdk.mountAssistantWidget({
      callbacks,
      configuration: {
        integrationMode: "backend001-compatibility",
        theme: "system",
      },
      provider: async () => ({ hostApp: "phase-11-productized-mount" }),
      target,
    });

    expect(target.childElementCount, "Installed mountAssistantWidget must mount a closed widget DOM into the target.").toBeGreaterThan(0);

    for (const requirement of productizedClosedWidgetRequirements) {
      expect(
        queryAny(target, requirement.selectors),
        `Mounted productized widget must render ${requirement.name}.`,
      ).toBe(true);
    }

    expect(callbacks.onOpened).toHaveBeenCalledTimes(0);
    handle.open?.();
    await nextTick();
    await Promise.resolve();
    expect(callbacks.onOpened, "open() must notify onOpened before callback suppression can be trusted.").toHaveBeenCalledTimes(1);
    for (const requirement of productizedOpenWidgetRequirements) {
      expect(
        queryVisible(target, requirement.selectors),
        `Opened productized widget must visibly render ${requirement.name}.`,
      ).toBe(true);
    }

    handle.close?.();
    await nextTick();
    await Promise.resolve();
    expect(callbacks.onClosed, "close() must notify onClosed before callback suppression can be trusted.").toHaveBeenCalledTimes(1);
    expect(queryVisible(target, productizedOpenWidgetRequirements[0].selectors), "close() must remove or hide the widget panel.").toBe(false);
    expect(queryAny(target, productizedClosedWidgetRequirements[1].selectors), "close() must keep the launcher usable.").toBe(true);

    handle.unmount?.();
    await nextTick();
    await Promise.resolve();
    expect(target.childElementCount, "unmount() must remove the SDK widget DOM from its target.").toBe(0);
    handle.destroy?.();
    await nextTick();
    await Promise.resolve();
    handle.destroy?.();
    await nextTick();
    await Promise.resolve();
    handle.open?.();
    handle.close?.();
    await nextTick();
    await Promise.resolve();

    expect(callbacks.onOpened, "Callbacks must be suppressed after destroy.").toHaveBeenCalledTimes(1);
    expect(callbacks.onClosed, "Callbacks must be suppressed after destroy.").toHaveBeenCalledTimes(1);
    expect(target.childElementCount, "destroy() must leave no SDK mount root, panel, or launcher in the target.").toBe(0);
  });

  it("diagnoses duplicate mounts for the same target from the installed package", async () => {
    const target = document.createElement("div");

    const firstHandle = sdk.mountAssistantWidget({
      configuration: {
        integrationMode: "backend001-compatibility",
      },
      provider: async () => ({ hostApp: "phase-11-productized-mount" }),
      target,
    });
    let duplicateResult: MountHandleLike | unknown;

    try {
      let duplicateError: unknown;

      try {
        duplicateResult = sdk.mountAssistantWidget({
          configuration: {
            integrationMode: "backend001-compatibility",
          },
          provider: async () => ({ hostApp: "phase-11-productized-mount" }),
          target,
        });
      }
      catch (error) {
        duplicateError = error;
      }

      expect(
        duplicateError instanceof Error && /duplicate|already.?mounted|mount/i.test(duplicateError.message)
        || isDuplicateMountDiagnostic(duplicateResult),
        "Duplicate mount should throw or return a diagnosable safe error instead of silently creating a second mount.",
      ).toBe(true);
    }
    finally {
      if (duplicateResult && typeof duplicateResult === "object") {
        (duplicateResult as MountHandleLike).destroy?.();
      }
      firstHandle.destroy?.();
      await nextTick();
      await Promise.resolve();
      expect(target.childElementCount, "Duplicate-mount cleanup must remove the first widget DOM.").toBe(0);
    }
  });
});
