// @vitest-environment jsdom

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

import { mountAssistantWidget } from "../../../packages/assistant-sdk/src/mountAssistantWidget";
import {
  productizedClosedWidgetRequirements,
  productizedOpenWidgetRequirements,
} from "../../fixtures/assistant-sdk/productized-sdk-fixtures";

const projectRootPath = process.cwd();
const mountHelperPath = join(projectRootPath, "packages/assistant-sdk/src/mountAssistantWidget.ts");
const publicEntryPath = join(projectRootPath, "packages/assistant-sdk/src/index.ts");
const packageJsonPath = join(projectRootPath, "packages/assistant-sdk/package.json");

function createTarget() {
  const target = document.createElement("div");
  document.body.append(target);

  return target;
}

async function flushWidgetMount() {
  await nextTick();
  await flushPromises();
  await nextTick();
}

function queryAny(container: Element, selectors: readonly string[]) {
  return selectors.some(selector => container.matches(selector) || container.querySelector(selector));
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

async function expectMountedOpenWidget(target: Element) {
  await vi.waitFor(() => {
    for (const requirement of productizedOpenWidgetRequirements) {
      expect(
        queryVisible(target, requirement.selectors),
        `Mounted widget must render visible ${requirement.name}.`,
      ).toBe(true);
    }
  });
}

describe("Frontend 002 productized mountAssistantWidget helper", () => {
  it("creates an isolated Vue app, mounts the full productized AssistantWidget, and opens/closes through the handle", async () => {
    const target = createTarget();
    const callbacks = {
      onClosed: vi.fn(),
      onOpened: vi.fn(),
    };
    const handle = mountAssistantWidget({
      callbacks,
      configuration: {
        integrationMode: "backend001-compatibility",
        theme: "dark",
      },
      provider: async () => ({ hostApp: "phase-11-productized-mount" }),
      target,
    });

    await flushWidgetMount();

    expect(target.childElementCount).toBeGreaterThan(0);
    for (const requirement of productizedClosedWidgetRequirements) {
      expect(queryAny(target, requirement.selectors), `Closed mount must render ${requirement.name}.`).toBe(true);
    }
    expect(target.querySelector("[data-assistant-panel]")).toBeNull();

    handle.open();
    await flushWidgetMount();
    await expectMountedOpenWidget(target);
    expect(callbacks.onOpened).toHaveBeenCalledTimes(1);
    expect(target.querySelector("[data-testid='assistant-runtime-root']")).toBeTruthy();
    expect(target.querySelector("[data-testid='assistant-message-list']")).toBeTruthy();
    expect(target.querySelector("[data-testid='assistant-composer-input']")).toBeTruthy();
    expect(target.querySelector("[data-testid='assistant-send']")).toBeTruthy();

    handle.close();
    await flushWidgetMount();
    expect(callbacks.onClosed).toHaveBeenCalledTimes(1);
    expect(queryVisible(target, productizedOpenWidgetRequirements[0].selectors)).toBe(false);
    expect(queryAny(target, productizedClosedWidgetRequirements[1].selectors)).toBe(true);

    handle.destroy();
    await flushWidgetMount();
    target.remove();
  });

  it("unmounts and destroys idempotently while removing only the SDK-created root", async () => {
    const target = createTarget();
    const hostContent = document.createElement("span");
    hostContent.dataset.testid = "host-content";
    target.append(hostContent);
    const callbacks = {
      onClosed: vi.fn(),
      onOpened: vi.fn(),
    };
    const handle = mountAssistantWidget({
      callbacks,
      provider: async () => ({ hostApp: "phase-11-productized-mount" }),
      target,
    });

    await flushWidgetMount();
    expect(target.childElementCount).toBe(2);

    handle.open();
    await flushWidgetMount();
    expect(callbacks.onOpened).toHaveBeenCalledTimes(1);

    handle.unmount();
    handle.unmount();
    handle.destroy();
    handle.destroy();
    handle.open();
    handle.close();
    await flushWidgetMount();

    expect(target.childElementCount).toBe(1);
    expect(target.firstElementChild).toBe(hostContent);
    expect(callbacks.onOpened).toHaveBeenCalledTimes(1);
    expect(callbacks.onClosed).toHaveBeenCalledTimes(0);
    target.remove();
  });

  it("fails closed on duplicate mounts, leaves one widget DOM, and allows remount after destroy", async () => {
    const target = createTarget();
    const first = mountAssistantWidget({
      provider: async () => ({ hostApp: "phase-11-productized-mount" }),
      target,
    });

    await flushWidgetMount();
    const initialChildCount = target.childElementCount;

    expect(() => mountAssistantWidget({
      provider: async () => ({ hostApp: "phase-11-productized-mount" }),
      target,
    })).toThrow(/already mounted|duplicate mount/i);
    expect(target.childElementCount).toBe(initialChildCount);

    first.destroy();
    await flushWidgetMount();
    expect(target.childElementCount).toBe(0);

    const second = mountAssistantWidget({
      provider: async () => ({ hostApp: "phase-11-productized-remount" }),
      target,
    });
    await flushWidgetMount();
    expect(target.childElementCount).toBeGreaterThan(0);

    second.destroy();
    await flushWidgetMount();
    target.remove();
  });

  it("keeps two target mounts isolated by runtime scope and callbacks", async () => {
    const firstTarget = createTarget();
    const secondTarget = createTarget();
    const firstCallbacks = { onOpened: vi.fn() };
    const secondCallbacks = { onOpened: vi.fn() };
    const first = mountAssistantWidget({
      callbacks: firstCallbacks,
      configuration: { sessionScope: "same-host-scope" },
      provider: async () => ({ hostApp: "first-widget" }),
      target: firstTarget,
    });
    const second = mountAssistantWidget({
      callbacks: secondCallbacks,
      configuration: { sessionScope: "same-host-scope" },
      provider: async () => ({ hostApp: "second-widget" }),
      target: secondTarget,
    });

    await flushWidgetMount();

    const firstScope = firstTarget.querySelector("[data-runtime-scope]")?.getAttribute("data-runtime-scope");
    const secondScope = secondTarget.querySelector("[data-runtime-scope]")?.getAttribute("data-runtime-scope");
    expect(firstScope).toContain("same-host-scope");
    expect(secondScope).toContain("same-host-scope");
    expect(firstScope).not.toBe(secondScope);

    first.open();
    await flushWidgetMount();
    await expectMountedOpenWidget(firstTarget);
    expect(firstCallbacks.onOpened).toHaveBeenCalledTimes(1);
    expect(secondCallbacks.onOpened).toHaveBeenCalledTimes(0);
    expect(secondTarget.querySelector("[data-assistant-panel]")).toBeNull();

    first.destroy();
    second.destroy();
    await flushWidgetMount();
    firstTarget.remove();
    secondTarget.remove();
  });

  it("supports selector targets and reports invalid targets safely", async () => {
    const target = createTarget();
    target.id = "assistant-sdk-mount-target";
    const handle = mountAssistantWidget({
      provider: async () => ({ hostApp: "phase-11-selector-target" }),
      target: "#assistant-sdk-mount-target",
    });

    await flushWidgetMount();
    expect(target.childElementCount).toBeGreaterThan(0);
    expect(() => mountAssistantWidget({
      provider: async () => ({ hostApp: "missing-target" }),
      target: "#missing-assistant-sdk-mount-target",
    })).toThrow(/target selector did not match/i);

    handle.destroy();
    await flushWidgetMount();
    target.remove();
  });

  it("does not import app source, duplicate runtime ownership, or expose internal adapter exports", async () => {
    const source = await readFile(mountHelperPath, "utf8");
    const rootEntry = await readFile(publicEntryPath, "utf8");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      exports?: Record<string, unknown>;
    };

    expect(source).toContain("createApp");
    expect(source).toContain("createPinia");
    expect(source).toContain("app.use(pinia)");
    expect(source).toContain("new WeakMap");
    expect(source).toContain("AssistantWidget");
    expect(source).not.toMatch(/app\/(?:features|services|stores|utils)/);
    expect(source).not.toMatch(/parseAssistantSse|createAssistantSseStreamRunner|ReadableStream|getReader/);
    expect(source).not.toMatch(/createSessionHistoryRuntime|mapAnswerDecisionState|normalizeEvidenceReferences/);
    expect(source).not.toMatch(/createFeedbackState|createActionDraftState|createApprovalRequestState/);

    expect(rootEntry).not.toMatch(/createSdkRuntimeAdapter|createDefaultTransport|createSdkSessionLifecycleAdapter|createHostEventEmitter/);
    expect(rootEntry).not.toMatch(/\.\/runtime|\.\/transport|\.\/session|\.\/lifecycle|\.\/context|\.\/events/);
    expect(Object.keys(packageJson.exports ?? {})).toEqual([".", "./styles.css"]);
  });
});
