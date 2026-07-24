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
  createCanonicalSseOutcomeFixture,
  type CanonicalSseOutcomeName,
  type CanonicalSseOutcomeFixture,
} from "../../fixtures/assistant-sdk/canonical-sse-outcome-adapter";
import { createCompatibilityFetchRouter } from "../../fixtures/assistant-sdk/compatibility-fetch-router";
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

const canonicalOutcomeNames = [
  "completed-answer",
  "no-answer",
  "clarification",
  "permission-denied",
  "tool-failure",
  "interrupted",
  "timeout",
] as const satisfies readonly CanonicalSseOutcomeName[];

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

function expectCompatibilityRequestBodySafe(body: unknown) {
  expect(containsForbiddenCompatibilityModeField(body)).toBeNull();
  expect(JSON.stringify(body)).not.toMatch(/pageContext|selectedRows|entityType|entityId|sessionScope|sourceSystem|authority|connector|permission|token|credential|secret/i);
}

function expectFinalSseFixture(fixture: CanonicalSseOutcomeFixture) {
  expect(fixture.terminationMode).toBe("final");
  expect(fixture.events.some(event => event.eventType === "final")).toBe(true);
}

async function readResponseText(response: Response): Promise<string> {
  return await response.text();
}

describe("Frontend 002 packaged Compatibility Mode T143 fixture/router contract", () => {
  let app: TemporaryConsumingApp;

  beforeAll(async () => {
    app = await createTemporaryConsumingApp();
    await app.importSdk();
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

  it("routes packaged Compatibility Mode mock fetch by Backend 001 method and path", async () => {
    const router = createCompatibilityFetchRouter({
      sessionId: "session-001",
      sseFixture: createCanonicalSseOutcomeFixture("completed-answer"),
    });
    const messageBody = {
      message: "Summarize this order",
      requestId: "request-message-001",
      sessionId: "session-001",
    };

    const createSessionResponse = await router.fetch("https://example.test/assistant/sessions", {
      body: JSON.stringify({ requestId: "request-create-001" }),
      method: "POST",
    });
    const historyResponse = await router.fetch("https://example.test/assistant/sessions/session-001/messages?cursor=cursor-001", {
      method: "GET",
    });
    const streamResponse = await router.fetch("https://example.test/assistant/sessions/session-001/messages", {
      body: JSON.stringify(messageBody),
      method: "POST",
    });

    await expect(createSessionResponse.json()).resolves.toEqual(expect.objectContaining({
      data: expect.objectContaining({ sessionId: "session-001" }),
    }));
    await expect(historyResponse.json()).resolves.toEqual(expect.objectContaining({
      data: expect.objectContaining({
        messages: [],
        nextCursor: null,
        sessionId: "session-001",
      }),
    }));
    expect(streamResponse.headers.get("content-type")).toContain("text/event-stream");
    expect(router.calls.map(call => call.route)).toEqual(["create-session", "load-history", "message-stream"]);

    const executedRequest = JSON.parse(router.getCallsByRoute("message-stream")[0]?.bodyText ?? "{}");
    expect(executedRequest).toEqual(messageBody);
    expectCompatibilityRequestBodySafe(executedRequest);
  });

  it.each(canonicalOutcomeNames)("keeps %s canonical SSE outcome fixture contract independent of productized DOM", async (name) => {
    const sseFixture = createCanonicalSseOutcomeFixture(name);
    const router = createCompatibilityFetchRouter({ sseFixture });
    const response = await router.fetch("https://example.test/api/v1/assistant/sessions/session-001/messages", {
      body: JSON.stringify({
        message: "Summarize this order",
        requestId: "request-message-001",
        sessionId: "session-001",
      }),
      method: "POST",
    });

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(router.calls.map(call => call.route)).toEqual(["message-stream"]);
    expectCompatibilityRequestBodySafe(JSON.parse(router.calls[0]?.bodyText ?? "{}"));

    if (name === "timeout") {
      expect(sseFixture.terminationMode).toBe("inactivity");
      expect(sseFixture.events).toHaveLength(0);
      return;
    }

    const responseText = await readResponseText(response);

    if (name === "interrupted") {
      expect(sseFixture.terminationMode).toBe("eof-before-final");
      expect(sseFixture.events.some(event => event.eventType === "answer_delta")).toBe(true);
      expect(sseFixture.events.some(event => event.eventType === "final")).toBe(false);
      expect(responseText).toContain("event: answer_delta");
      expect(responseText).not.toContain("event: final");
      expect(responseText).not.toContain("event: done");
      return;
    }

    expectFinalSseFixture(sseFixture);
    expect(responseText).toContain("event: final");
    expect(responseText).not.toContain("event: done");
  });
});

describe("Frontend 002 packaged Compatibility Mode T146 productized chat-flow gate", () => {
  let app: TemporaryConsumingApp;
  let sdk: InstalledSdk;

  beforeAll(async () => {
    app = await createTemporaryConsumingApp();
    sdk = await app.importSdk() as InstalledSdk;
  }, 60_000);

  afterAll(async () => {
    await app?.cleanup();
  });

  async function runOutcome(name: CanonicalSseOutcomeName) {
    const sseFixture = createCanonicalSseOutcomeFixture(name);
    const target = document.createElement("div");
    const fetchRouter = createCompatibilityFetchRouter({ sseFixture });
    const mockFetch = vi.fn(fetchRouter.fetch);
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
      await vi.waitFor(() => {
        expect(queryAny(target, productizedOpenWidgetRequirements[0].selectors)).toBe(true);
      });

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

      await vi.waitFor(() => expect(fetchRouter.getCallsByRoute("message-stream").length).toBeGreaterThan(0));
      const streamCall = fetchRouter.getCallsByRoute("message-stream").at(-1);
      const executedRequest = JSON.parse(streamCall?.bodyText || "{}");
      expectCompatibilityRequestBodySafe(executedRequest);

      if (sseFixture.terminationMode === "inactivity") {
        await vi.advanceTimersByTimeAsync(60_000);
      }

      await vi.waitFor(() => expect(target.textContent).toMatch(sseFixture.expectedText), {
        timeout: 3_000,
      });
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

  it("mounts and opens the productized widget DOM from the packaged public helper", async () => {
    const target = document.createElement("div");
    let handle: MountHandle | undefined;

    try {
      handle = sdk.mountAssistantWidget({
        configuration: {
          integrationMode: compatibilityMode,
        },
        provider: async () => ({ hostApp: "phase-11-packaged-mount" }),
        target,
      });
      await nextTick();
      await Promise.resolve();

      expect(target.childElementCount, "Packaged mountAssistantWidget must mount a closed widget DOM.").toBeGreaterThan(0);
      for (const requirement of productizedClosedWidgetRequirements) {
        expect(queryAny(target, requirement.selectors), `Packaged widget must render ${requirement.name}.`).toBe(true);
      }

      handle.open();
      await nextTick();
      await Promise.resolve();

      await vi.waitFor(() => {
        for (const requirement of productizedOpenWidgetRequirements) {
          expect(queryAny(target, requirement.selectors), `Opened packaged widget must render ${requirement.name}.`).toBe(true);
        }
      });
    }
    finally {
      handle?.destroy();
      await nextTick();
      await Promise.resolve();
      expect(target.childElementCount, "Packaged mount helper must clean up its widget DOM.").toBe(0);
    }
  });

  it("runs the full packaged DOM chat flow for all seven outcomes", async () => {
    // T146 closure: full packaged DOM chat flow verifies all seven canonical outcomes through the packaged public helper.
    for (const outcomeName of canonicalOutcomeNames) {
      await runOutcome(outcomeName);
    }
  });
});
