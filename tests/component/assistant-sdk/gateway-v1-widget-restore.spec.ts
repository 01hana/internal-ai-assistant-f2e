import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import AssistantWidget from "../../../packages/assistant-sdk/src/components/AssistantWidget.vue";
import { createSessionNamespace } from "../../../packages/assistant-sdk/src/session/sessionNamespace";
import { createGatewayFetchRouter } from "../../fixtures/assistant-sdk/gateway-fetch-router";

const historyMessages = [
  {
    content: "之前的問題",
    createdAt: "2026-08-01T09:00:00.000Z",
    messageId: "history-user-001",
    role: "user" as const,
  },
  {
    answerDecision: "answered" as const,
    content: "之前的回答",
    createdAt: "2026-08-01T09:00:01.000Z",
    messageId: "history-assistant-001",
    role: "assistant" as const,
  },
] as const;

const gatewayConfiguration = {
  apiBaseUrl: "/api/v1",
  integrationMode: "gateway-v1" as const,
};

async function openWidget(wrapper: ReturnType<typeof mount>) {
  await wrapper.get("[data-assistant-launcher]").trigger("click");
  await flushPromises();
}

async function sendMessage(wrapper: ReturnType<typeof mount>, message: string) {
  await wrapper.get("[data-testid='assistant-chat-input']").setValue(message);
  await wrapper.get("[data-testid='assistant-chat-submit']").trigger("click");
  await flushPromises();
}

function createStorageRestoreSetup() {
  const configuration = { ...gatewayConfiguration, sessionScope: "entity" as const };
  const provider = async () => ({
    actorId: "actor-restore-failure",
    hostApp: "gateway-restore-failure",
    organizationId: "organization-restore-failure",
    pageContext: { entityId: "order-restore-001", entityType: "order", route: "/orders/restore-001" },
  });
  const namespace = createSessionNamespace({
    entityId: "order-restore-001",
    entityType: "order",
    hostApp: "gateway-restore-failure",
    organizationId: "organization-restore-failure",
    packageMajor: "assistant-sdk-v1",
    pageIdentity: "/orders/restore-001",
    sessionScope: "entity",
  });
  if (!namespace.ok) throw new Error("expected a valid session namespace");

  return { configuration, namespace: namespace.namespace, provider };
}

describe("Frontend 002 Gateway-v1 AssistantWidget restore and continue-chat happy path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.sessionStorage?.clear();
  });

  it("restores a host session, renders its history, and continues it through authenticated SSE", async () => {
    const router = createGatewayFetchRouter({
      expectedTokens: ["token-A", "token-B", "token-C"],
      historyMessages,
      sessionId: "session-existing-001",
    });
    const getAccessToken = vi.fn()
      .mockResolvedValueOnce("token-A")
      .mockResolvedValueOnce("token-B")
      .mockResolvedValueOnce("token-C");
    vi.stubGlobal("fetch", vi.fn(router.fetch));
    const wrapper = mount(AssistantWidget, {
      props: {
        configuration: gatewayConfiguration,
        getAccessToken,
        provider: async () => ({
          actorId: "actor-local-001",
          hostApp: "gateway-widget-test",
          organizationId: "organization-local-001",
          pageContext: { entityId: "order-001", entityType: "order", route: "/orders/001" },
          sessionId: "session-existing-001",
        }),
      },
    });

    await openWidget(wrapper);

    expect(router.calls.map(call => call.route)).toEqual(["get-session", "load-history"]);
    expect(wrapper.text()).toContain("之前的問題");
    expect(wrapper.text()).toContain("之前的回答");
    expect(router.calls.some(call => call.route === "create-session")).toBe(false);

    await sendMessage(wrapper, "這是新的問題");
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("新的 AI 回答");
    });

    expect(router.calls.map(call => call.route)).toEqual(["get-session", "load-history", "message-stream"]);
    expect(router.calls[2]).toMatchObject({
      method: "POST",
      pathname: "/api/v1/assistant/sessions/session-existing-001/messages",
    });
    expect(JSON.parse(router.calls[2]?.bodyText ?? "{}")).toEqual({
      message: "這是新的問題",
      pageContext: { entityId: "order-001", entityType: "order", route: "/orders/001" },
    });
    expect(getAccessToken).toHaveBeenCalledTimes(3);
    expect(wrapper.text()).toContain("之前的問題");
    expect(wrapper.text()).toContain("之前的回答");
    expect(wrapper.text()).toContain("這是新的問題");
    expect(wrapper.text()).toContain("新的 AI 回答");
  });

  it("persists a newly created scoped session and restores it on the next same-namespace mount", async () => {
    const configuration = { ...gatewayConfiguration, sessionScope: "entity" as const };
    const provider = async () => ({
      actorId: "actor-local-002",
      hostApp: "gateway-storage-test",
      organizationId: "organization-local-002",
      pageContext: { entityId: "order-storage-001", entityType: "order", route: "/orders/storage-001" },
    });
    const namespace = createSessionNamespace({
      entityId: "order-storage-001",
      entityType: "order",
      hostApp: "gateway-storage-test",
      organizationId: "organization-local-002",
      packageMajor: "assistant-sdk-v1",
      pageIdentity: "/orders/storage-001",
      sessionScope: "entity",
    });
    expect(namespace.ok).toBe(true);
    if (!namespace.ok) throw new Error("expected a valid session namespace");

    const createRouter = createGatewayFetchRouter({
      expectedTokens: ["token-create"],
      historyMessages,
      sessionId: "session-storage-001",
    });
    vi.stubGlobal("fetch", vi.fn(createRouter.fetch));
    const first = mount(AssistantWidget, {
      props: {
        configuration,
        getAccessToken: () => "token-create",
        provider,
      },
    });

    await openWidget(first);
    expect(createRouter.calls.map(call => call.route)).toEqual(["create-session"]);
    expect(globalThis.sessionStorage.getItem(namespace.namespace)).toBe("session-storage-001");
    first.unmount();

    const restoreRouter = createGatewayFetchRouter({
      expectedTokens: ["token-restore", "token-history"],
      historyMessages,
      sessionId: "session-storage-001",
    });
    vi.stubGlobal("fetch", vi.fn(restoreRouter.fetch));
    const second = mount(AssistantWidget, {
      props: {
        configuration,
        getAccessToken: vi.fn()
          .mockResolvedValueOnce("token-restore")
          .mockResolvedValueOnce("token-history"),
        provider,
      },
    });

    await openWidget(second);

    expect(restoreRouter.calls.map(call => call.route)).toEqual(["get-session", "load-history"]);
    expect(restoreRouter.calls.some(call => call.route === "create-session")).toBe(false);
    expect(second.text()).toContain("之前的問題");
    expect(second.text()).toContain("之前的回答");
  });

  it("replaces only a storage candidate conclusively reported as missing", async () => {
    const { configuration, namespace, provider } = createStorageRestoreSetup();
    globalThis.sessionStorage.setItem(namespace, "session-old-001");
    const router = createGatewayFetchRouter({
      expectedTokens: ["token-old", "token-create"],
      sessionId: "session-new-001",
      sessionResponse: {
        body: { diagnostics: "raw gateway customer diagnostic" },
        status: 404,
      },
    });
    vi.stubGlobal("fetch", vi.fn(router.fetch));
    const wrapper = mount(AssistantWidget, {
      props: { configuration, getAccessToken: vi.fn().mockResolvedValueOnce("token-old").mockResolvedValueOnce("token-create"), provider },
    });

    await openWidget(wrapper);

    expect(router.calls.map(call => call.route)).toEqual(["get-session", "create-session"]);
    expect(globalThis.sessionStorage.getItem(namespace)).toBe("session-new-001");
    expect(wrapper.get("[data-testid='assistant-chat-submit']").attributes("disabled")).toBeUndefined();
    expect(wrapper.text()).not.toContain("raw gateway customer diagnostic");
  });

  it.each([401, 403, 503])("preserves a storage candidate and fails closed for Gateway status %i", async (status) => {
    const { configuration, namespace, provider } = createStorageRestoreSetup();
    globalThis.sessionStorage.setItem(namespace, "session-old-001");
    const onError = vi.fn();
    const router = createGatewayFetchRouter({
      expectedTokens: ["token-temporary"],
      sessionId: "session-old-001",
      sessionResponse: {
        body: { diagnostics: "raw gateway diagnostic", upstreamJwt: "do-not-leak" },
        status,
      },
    });
    vi.stubGlobal("fetch", vi.fn(router.fetch));
    const wrapper = mount(AssistantWidget, {
      props: { callbacks: { onError }, configuration, getAccessToken: () => "token-temporary", provider },
    });

    await openWidget(wrapper);

    expect(router.calls.map(call => call.route)).toEqual(["get-session"]);
    expect(globalThis.sessionStorage.getItem(namespace)).toBe("session-old-001");
    expect(wrapper.get("[data-testid='assistant-chat-submit']").attributes("disabled")).toBeDefined();
    expect(onError).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "session_restore_failed" }) });
    expect(wrapper.text()).not.toMatch(/raw gateway diagnostic|do-not-leak/);
  });

  it.each([
    ["missing", undefined],
    ["blank", () => "  "],
    ["throws", () => { throw new Error("raw access-token failure"); }],
    ["rejects", async () => await Promise.reject(new Error("raw access-token rejection"))],
  ])("treats a %s storage token resolution failure as temporary and preserves its pointer", async (_kind, getAccessToken) => {
    const { configuration, namespace, provider } = createStorageRestoreSetup();
    globalThis.sessionStorage.setItem(namespace, "session-old-001");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(AssistantWidget, {
      props: { configuration, getAccessToken, provider },
    });

    await openWidget(wrapper);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(globalThis.sessionStorage.getItem(namespace)).toBe("session-old-001");
    expect(wrapper.get("[data-testid='assistant-chat-submit']").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).not.toMatch(/raw access-token failure|raw access-token rejection/);
  });

  it.each([404, 503])("never replaces a host-provided session after Gateway status %i", async (status) => {
    const router = createGatewayFetchRouter({
      expectedTokens: ["token-host"],
      sessionId: "host-session-001",
      sessionResponse: { body: { diagnostics: "raw-host-failure" }, status },
    });
    const onError = vi.fn();
    vi.stubGlobal("fetch", vi.fn(router.fetch));
    const wrapper = mount(AssistantWidget, {
      props: {
        callbacks: { onError },
        configuration: gatewayConfiguration,
        getAccessToken: () => "token-host",
        provider: async () => ({ hostApp: "gateway-host-failure", sessionId: "host-session-001" }),
      },
    });

    await openWidget(wrapper);

    expect(router.calls.map(call => call.route)).toEqual(["get-session"]);
    expect(onError).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "session_restore_failed" }) });
    expect(wrapper.get("[data-testid='assistant-chat-submit']").attributes("disabled")).toBeDefined();
  });

  it("keeps a valid restored session and pointer when history is temporarily unavailable", async () => {
    const { configuration, namespace, provider } = createStorageRestoreSetup();
    globalThis.sessionStorage.setItem(namespace, "session-history-valid-001");
    const router = createGatewayFetchRouter({
      expectedTokens: ["token-session", "token-history"],
      sessionId: "session-history-valid-001",
      historyResponse: { body: { diagnostics: "raw history diagnostic" }, status: 503 },
    });
    vi.stubGlobal("fetch", vi.fn(router.fetch));
    const wrapper = mount(AssistantWidget, {
      props: { configuration, getAccessToken: vi.fn().mockResolvedValueOnce("token-session").mockResolvedValueOnce("token-history"), provider },
    });

    await openWidget(wrapper);

    expect(router.calls.map(call => call.route)).toEqual(["get-session", "load-history"]);
    expect(globalThis.sessionStorage.getItem(namespace)).toBe("session-history-valid-001");
    expect(wrapper.get("[data-testid='assistant-chat-submit']").attributes("disabled")).toBeUndefined();
    expect(wrapper.text()).not.toContain("raw history diagnostic");
  });

  it("restores the original storage session after a temporary outage on a later mount", async () => {
    const { configuration, namespace, provider } = createStorageRestoreSetup();
    globalThis.sessionStorage.setItem(namespace, "session-retry-001");
    const unavailableRouter = createGatewayFetchRouter({
      expectedTokens: ["token-unavailable"],
      sessionId: "session-retry-001",
      sessionResponse: { status: 503 },
    });
    vi.stubGlobal("fetch", vi.fn(unavailableRouter.fetch));
    const first = mount(AssistantWidget, {
      props: { configuration, getAccessToken: () => "token-unavailable", provider },
    });
    await openWidget(first);
    expect(globalThis.sessionStorage.getItem(namespace)).toBe("session-retry-001");
    first.unmount();

    const recoveredRouter = createGatewayFetchRouter({
      expectedTokens: ["token-recovered", "token-history"],
      historyMessages,
      sessionId: "session-retry-001",
    });
    vi.stubGlobal("fetch", vi.fn(recoveredRouter.fetch));
    const second = mount(AssistantWidget, {
      props: {
        configuration,
        getAccessToken: vi.fn().mockResolvedValueOnce("token-recovered").mockResolvedValueOnce("token-history"),
        provider,
      },
    });
    await openWidget(second);

    expect(recoveredRouter.calls.map(call => call.route)).toEqual(["get-session", "load-history"]);
    expect(globalThis.sessionStorage.getItem(namespace)).toBe("session-retry-001");
    expect(second.text()).toContain("之前的問題");
  });
});
