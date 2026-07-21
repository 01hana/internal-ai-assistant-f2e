// @vitest-environment jsdom

import { access, readFile } from "node:fs/promises";
import { nextTick } from "vue";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  compatibilityMode,
  containsForbiddenCompatibilityModeField,
} from "../../fixtures/assistant-sdk/compatibility-mode-contract";
import { createCompatibilityChatFlowFixture } from "../../fixtures/assistant-sdk/compatibility-mode-fixtures";
import {
  createCanonicalSseResponse,
  createCanonicalSseOutcomeFixture,
  type CanonicalSseOutcomeName,
} from "../../fixtures/assistant-sdk/canonical-sse-outcome-adapter";
import {
  forbiddenProductizedConsumerImportPatterns,
  productizedClosedWidgetRequirements,
  productizedOpenWidgetRequirements,
} from "../../fixtures/assistant-sdk/productized-sdk-fixtures";
import { createTemporaryConsumingApp } from "../../fixtures/assistant-sdk/temporary-consuming-app";

type TemporaryConsumingApp = Awaited<ReturnType<typeof createTemporaryConsumingApp>>;
type MountHandle = {
  readonly destroy: () => void;
  readonly open: () => void;
};
type InstalledSdk = {
  readonly mountAssistantWidget: (options: Record<string, unknown>) => MountHandle;
};

function queryAny(container: Element, selectors: readonly string[]) {
  return selectors.some(selector => container.querySelector(selector));
}

function findFirst(container: Element, selectors: readonly string[]) {
  for (const selector of selectors) {
    const found = container.querySelector(selector);
    if (found) {
      return found;
    }
  }

  return null;
}

async function expectPathExists(path: string, message: string) {
  await expect(access(path), message).resolves.toBeUndefined();
}

describe("Frontend 002 packaged Compatibility Mode chat flow smoke", () => {
  let app: TemporaryConsumingApp;
  let sdk: InstalledSdk;

  beforeAll(async () => {
    app = await createTemporaryConsumingApp();
    sdk = await app.importSdk() as InstalledSdk;
  }, 60_000);

  afterAll(async () => {
    await app?.cleanup();
  });

  it("installs and resolves only public package entries from temporary consuming app source", async () => {
    const source = await readFile(app.sourceFile, "utf8");

    expect(app.root.startsWith("/private/tmp/assistant-sdk-productized-consumer-")).toBe(true);
    await expectPathExists(app.tarballPath, "Packaged Compatibility Mode smoke must use a local SDK tarball.");
    await expectPathExists(app.resolvedEntryPath, "Packaged Compatibility Mode smoke must resolve the SDK root public entry.");
    await expectPathExists(app.resolvedStylesPath, "Packaged Compatibility Mode smoke must resolve the SDK stylesheet public entry.");
    expect(source).toContain("AssistantWidget");
    expect(source).toContain("mountAssistantWidget");
    expect(source).toContain("@internal-ai-assistant/assistant-sdk");
    expect(source).toContain("@internal-ai-assistant/assistant-sdk/styles.css");

    for (const forbiddenPattern of forbiddenProductizedConsumerImportPatterns) {
      expect(source, `Packaged compatibility smoke must not use ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
    }
  });

  it("keeps Compatibility Mode request fixtures free of host context and authority fields", () => {
    const fixture = createCompatibilityChatFlowFixture();

    expect(fixture.integrationMode).toBe(compatibilityMode);
    expect(containsForbiddenCompatibilityModeField(fixture.requests)).toBeNull();
    expect(fixture.requests.some(request => "pageContext" in request || "selectedRows" in request)).toBe(false);
  });

  async function runOutcome(name: CanonicalSseOutcomeName) {
    const sseFixture = createCanonicalSseOutcomeFixture(name);
    const target = document.createElement("div");
    const mockFetch = vi.fn(async () => createCanonicalSseResponse(sseFixture));
    const callbacks = {
      onAnswerCompleted: vi.fn(),
      onError: vi.fn(),
    };
    let handle: MountHandle | undefined;

    try {
      vi.stubGlobal("fetch", mockFetch);
      if (sseFixture.terminationMode === "inactivity") {
        vi.useFakeTimers();
      }

      handle = sdk.mountAssistantWidget({
        callbacks,
        configuration: {
          integrationMode: compatibilityMode,
        },
        provider: async () => ({ hostApp: "phase-11-packaged-compatibility" }),
        target,
      });
      handle.open();
      await nextTick();
      await Promise.resolve();

      expect(target.childElementCount, "Packaged Compatibility Mode must mount a widget DOM before chat flow can run.").toBeGreaterThan(0);
      for (const requirement of productizedClosedWidgetRequirements) {
        expect(queryAny(target, requirement.selectors), `Packaged widget must render ${requirement.name}.`).toBe(true);
      }
      for (const requirement of productizedOpenWidgetRequirements) {
        expect(queryAny(target, requirement.selectors), `Opened packaged widget must render ${requirement.name}.`).toBe(true);
      }

      const composer = findFirst(target, productizedOpenWidgetRequirements[2].selectors);
      const sendAction = findFirst(target, productizedOpenWidgetRequirements[3].selectors);
      expect(composer, "Packaged widget must expose a semantic composer.").toBeTruthy();
      expect(sendAction, "Packaged widget must expose a semantic send action.").toBeTruthy();

      if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
        composer.value = "Summarize this order";
        composer.dispatchEvent(new Event("input", { bubbles: true }));
      }
      else {
        composer!.textContent = "Summarize this order";
        composer!.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
      sendAction!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
      const executedRequest = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body ?? "{}"));
      expect(containsForbiddenCompatibilityModeField(executedRequest)).toBeNull();
      expect(JSON.stringify(executedRequest)).not.toMatch(/pageContext|selectedRows|entityType|entityId/);

      if (sseFixture.terminationMode === "inactivity") {
        await vi.advanceTimersByTimeAsync(60_000);
      }

      await vi.waitFor(() => expect(target.textContent).toMatch(sseFixture.expectedText));
      expect(target.textContent).not.toMatch(/sourceSystem|connectorId|rawEvidence|rawConnectorPayload|sessionScope/);
      if (sseFixture.terminationMode !== "final") {
        expect(target.querySelector("[aria-busy='true'], [data-assistant-streaming], [data-assistant-loading]")).toBeNull();
      }
      return { callbacks, target };
    }
    finally {
      handle?.destroy();
      await nextTick();
      await Promise.resolve();
      vi.useRealTimers();
      vi.unstubAllGlobals();
      expect(target.childElementCount, "Each outcome must clean up its packaged widget DOM.").toBe(0);
    }
  }

  it("renders a completed answer from the canonical answer_delta/final stream", async () => {
    const { callbacks } = await runOutcome("completed-answer");
    expect(callbacks.onAnswerCompleted).toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("renders canonical no-answer state without raw payload", async () => {
    await runOutcome("no-answer");
  });

  it("renders canonical clarification state without raw payload", async () => {
    await runOutcome("clarification");
  });

  it("renders canonical permission-denied state without raw authority", async () => {
    await runOutcome("permission-denied");
  });

  it("renders canonical tool-failure state without raw payload", async () => {
    await runOutcome("tool-failure");
  });

  it("ends timeout through canonical inactivity lifecycle rather than an SSE event", async () => {
    const { callbacks } = await runOutcome("timeout");
    expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({ code: "stream_timeout" }));
  });

  it("ends interrupted streams at EOF before final rather than an SSE event", async () => {
    const { callbacks } = await runOutcome("interrupted");
    expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({ code: "stream_interrupted" }));
  });
});
