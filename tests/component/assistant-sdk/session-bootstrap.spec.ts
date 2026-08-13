import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";

import AssistantWidget from "../../../packages/assistant-sdk/src/components/AssistantWidget.vue";
import { createSdkRuntimeAdapter } from "../../../packages/assistant-sdk/src/runtime/sdkRuntimeAdapter";
import { createSessionNamespace } from "../../../packages/assistant-sdk/src/session/sessionNamespace";
import { createDefaultTransport } from "../../../packages/assistant-sdk/src/transport/defaultTransport";
import { createCanonicalSseOutcomeFixture } from "../../fixtures/assistant-sdk/canonical-sse-outcome-adapter";
import { createCompatibilityFetchRouter } from "../../fixtures/assistant-sdk/compatibility-fetch-router";

async function openWidget(wrapper: ReturnType<typeof mount>) {
  await wrapper.get("[data-assistant-launcher]").trigger("click");
  await flushPromises();
}

async function sendMessage(wrapper: ReturnType<typeof mount>) {
  await wrapper.get("[data-testid='assistant-chat-input']").setValue("請摘要目前頁面");
  await wrapper.get("[data-testid='assistant-chat-submit']").trigger("click");
  await flushPromises();
}

describe("Frontend 002 AssistantWidget session bootstrap parity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.sessionStorage?.clear();
  });

  it("creates a real session when opened before the first message stream", async () => {
    const router = createCompatibilityFetchRouter({
      sessionId: "session-created-001",
      sseFixture: createCanonicalSseOutcomeFixture("completed-answer"),
    });
    vi.stubGlobal("fetch", vi.fn(router.fetch));
    const wrapper = mount(AssistantWidget, {
      props: { provider: async () => ({ hostApp: "sdk-bootstrap-create" }) },
    });

    await openWidget(wrapper);

    expect(router.calls.map(call => call.route)).toEqual(["create-session"]);
    expect(wrapper.get("[data-testid='assistant-chat-submit']").attributes("disabled")).toBeUndefined();

    await sendMessage(wrapper);

    expect(router.calls.map(call => call.route)).toEqual(["create-session", "message-stream"]);
    expect(router.calls[1]?.pathname).toBe("/assistant/sessions/session-created-001/messages");
    expect(router.calls.some(call => call.pathname.includes("/pending-"))).toBe(false);
  });

  it("bootstraps a launcher-less panel before enabling its composer", async () => {
    const router = createCompatibilityFetchRouter({
      sessionId: "session-auto-open-001",
      sseFixture: createCanonicalSseOutcomeFixture("completed-answer"),
    });
    vi.stubGlobal("fetch", vi.fn(router.fetch));
    const wrapper = mount(AssistantWidget, {
      props: {
        configuration: { launcher: { enabled: false } },
        provider: async () => ({ hostApp: "sdk-bootstrap-auto-open" }),
      },
    });

    await flushPromises();

    expect(router.calls.map(call => call.route)).toEqual(["create-session"]);
    expect(wrapper.get("[data-testid='assistant-chat-submit']").attributes("disabled")).toBeUndefined();
  });

  it("validates a host session and loads its history before sending", async () => {
    const router = createCompatibilityFetchRouter({
      sessionId: "session-host-001",
      sseFixture: createCanonicalSseOutcomeFixture("completed-answer"),
    });
    vi.stubGlobal("fetch", vi.fn(router.fetch));
    const wrapper = mount(AssistantWidget, {
      props: {
        provider: async () => ({
          hostApp: "sdk-bootstrap-restore",
          sessionId: "session-host-001",
        }),
      },
    });

    await openWidget(wrapper);

    expect(router.calls.map(call => call.route)).toEqual(["get-session", "load-history"]);
    expect(wrapper.get("[data-testid='assistant-chat-submit']").attributes("disabled")).toBeUndefined();
    await sendMessage(wrapper);
    await vi.waitFor(() => {
      expect(router.calls.map(call => call.route)).toEqual(["get-session", "load-history", "message-stream"]);
    });
    expect(router.calls.map(call => call.route)).toEqual(["get-session", "load-history", "message-stream"]);
    expect(router.calls[2]?.pathname).toBe("/assistant/sessions/session-host-001/messages");
  });

  it("keeps sending disabled when session creation fails and never starts a pending stream", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: "unavailable" } }), {
      headers: { "content-type": "application/json" },
      status: 503,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(AssistantWidget, {
      props: { provider: async () => ({ hostApp: "sdk-bootstrap-failure" }) },
    });

    await openWidget(wrapper);

    expect(wrapper.get("[data-testid='assistant-chat-submit']").attributes("disabled")).toBeDefined();
    await sendMessage(wrapper);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).not.toContain("請摘要目前頁面");
  });

  it("restarts with a fresh session instead of reusing the active session", async () => {
    let sessionCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && /\/assistant\/sessions\/?$/.test(url)) {
        sessionCount += 1;
        return new Response(JSON.stringify({ data: { sessionId: `session-${sessionCount}`, status: "active" } }), {
          headers: { "content-type": "application/json" },
          status: 201,
        });
      }
      return new Response(JSON.stringify({ error: { code: "unexpected_route" } }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(AssistantWidget, {
      props: { provider: async () => ({ hostApp: "sdk-bootstrap-restart" }) },
    });

    await openWidget(wrapper);
    await wrapper.get("[data-testid='assistant-panel-restart']").trigger("click");
    await flushPromises();

    expect(sessionCount).toBe(2);
  });

  it("keeps scoped sessionStorage restoration isolated by the Frontend 001-compatible namespace", async () => {
    const router = createCompatibilityFetchRouter({
      sessionId: "session-scoped-001",
      sseFixture: createCanonicalSseOutcomeFixture("completed-answer"),
    });
    vi.stubGlobal("fetch", vi.fn(router.fetch));
    const configuration = { sessionScope: "entity" as const };
    const first = mount(AssistantWidget, {
      props: {
        configuration,
        provider: async () => ({
          hostApp: "sdk-session-storage",
          organizationId: "org-001",
          pageContext: { entityId: "order-001", entityType: "order", route: "/orders/001" },
        }),
      },
    });
    await openWidget(first);
    first.unmount();

    const differentScope = mount(AssistantWidget, {
      props: {
        configuration,
        provider: async () => ({
          hostApp: "sdk-session-storage",
          organizationId: "org-001",
          pageContext: { entityId: "order-002", entityType: "order", route: "/orders/002" },
        }),
      },
    });
    await openWidget(differentScope);
    differentScope.unmount();

    const sameScope = mount(AssistantWidget, {
      props: {
        configuration,
        provider: async () => ({
          hostApp: "sdk-session-storage",
          organizationId: "org-001",
          pageContext: { entityId: "order-001", entityType: "order", route: "/orders/001" },
        }),
      },
    });
    await openWidget(sameScope);

    expect(router.calls.map(call => call.route)).toEqual([
      "create-session",
      "create-session",
      "get-session",
      "load-history",
    ]);
  });

  it("fails closed for a host session candidate when transport cannot restore remotely", async () => {
    const execute = vi.fn(async () => ({
      ok: true as const,
      value: { sessionId: "session-should-not-create", status: "active" },
    }));
    const adapter = createSdkRuntimeAdapter({
      pinia: createPinia(),
      provider: async () => ({ hostApp: "sdk-host-candidate", sessionId: "host-session-001" }),
      runtimeScope: "sdk-bootstrap:host-no-restore",
      transport: createDefaultTransport({ execute, integrationMode: "backend002" }),
    });

    await expect(adapter.bootstrapSession()).resolves.toEqual({
      error: {
        code: "session_restore_unavailable",
        safeMessage: "目前無法還原指定的助理對話，請稍後再試。",
      },
      ok: false,
    });
    expect(adapter.controller.stores.session.lastError.value?.code).toBe("session_restore_unavailable");
    expect(execute).not.toHaveBeenCalled();
    expect(adapter.transport.getSession).toBeUndefined();
  });

  it("projects bootstrap-specific failure codes without replacing controller ownership", async () => {
    const noRestoreError = vi.fn();
    const noRestore = mount(AssistantWidget, {
      props: {
        callbacks: { onError: noRestoreError },
        configuration: { integrationMode: "backend002" },
        provider: async () => ({
          actorId: "actor-001",
          hostApp: "sdk-error-projection",
          organizationId: "org-001",
          pageContext: { route: "/orders/001" },
          sessionId: "host-session-001",
        }),
      },
    });
    await openWidget(noRestore);
    expect(noRestoreError).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "session_restore_unavailable" }),
    });
    noRestore.unmount();

    const invalidRestoreError = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const invalidRestore = mount(AssistantWidget, {
      props: {
        callbacks: { onError: invalidRestoreError },
        provider: async () => ({ hostApp: "sdk-error-projection", sessionId: "host-session-002" }),
      },
    });
    await openWidget(invalidRestore);
    expect(invalidRestoreError).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "session_restore_failed" }),
    });
    invalidRestore.unmount();

    const createError = vi.fn();
    const createFailure = mount(AssistantWidget, {
      props: {
        callbacks: { onError: createError },
        provider: async () => ({ hostApp: "sdk-error-projection" }),
      },
    });
    await openWidget(createFailure);
    expect(createError).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "session_bootstrap_failed" }),
    });
  });

  it("replaces a storage candidate when transport cannot restore remotely without issuing GET", async () => {
    const namespace = createSessionNamespace({
      entityId: "order-001",
      entityType: "order",
      hostApp: "sdk-storage-candidate",
      organizationId: "org-001",
      packageMajor: "assistant-sdk-v1",
      pageIdentity: "/orders/001",
      sessionScope: "entity",
    });
    expect(namespace.ok).toBe(true);
    if (!namespace.ok) return;
    globalThis.sessionStorage.setItem(namespace.namespace, "stale-storage-session");

    const execute = vi.fn(async input => ({
      ok: true as const,
      value: { sessionId: input.operation === "createSession" ? "session-fresh-001" : "unexpected", status: "active" },
    }));
    const adapter = createSdkRuntimeAdapter({
      configuration: { integrationMode: "backend001-compatibility", sessionScope: "entity" },
      pinia: createPinia(),
      provider: async () => ({
        hostApp: "sdk-storage-candidate",
        organizationId: "org-001",
        pageContext: { entityId: "order-001", entityType: "order", route: "/orders/001" },
      }),
      runtimeScope: "sdk-bootstrap:storage-no-restore",
      transport: createDefaultTransport({ execute, integrationMode: "backend002" }),
    });

    await expect(adapter.bootstrapSession()).resolves.toEqual({ ok: true, sessionId: "session-fresh-001" });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ operation: "createSession" });
    expect(globalThis.sessionStorage.getItem(namespace.namespace)).toBe("session-fresh-001");
  });

  it("fails closed for an invalid host candidate, but replaces an invalid storage candidate", async () => {
    const getSession = vi.fn(async () => ({
      ok: false as const,
      error: { code: "transport_execution_failed", userMessage: "integration error" },
    }));
    const createSession = vi.fn(async () => ({
      ok: true as const,
      value: { sessionId: "session-replacement-001", status: "active" },
    }));
    const transport = {
      ...createDefaultTransport({ integrationMode: "backend001-compatibility" }),
      createSession,
      getSession,
    };
    const hostAdapter = createSdkRuntimeAdapter({
      pinia: createPinia(),
      provider: async () => ({ hostApp: "sdk-invalid-host", sessionId: "host-stale-001" }),
      runtimeScope: "sdk-bootstrap:invalid-host",
      transport,
    });

    await expect(hostAdapter.bootstrapSession()).resolves.toEqual({
      error: {
        code: "session_restore_failed",
        safeMessage: "目前無法還原指定的助理對話，請稍後再試。",
      },
      ok: false,
    });
    expect(hostAdapter.controller.stores.session.lastError.value?.code).toBe("session_restore_failed");
    expect(getSession).toHaveBeenCalledWith({ sessionId: "host-stale-001" });
    expect(createSession).not.toHaveBeenCalled();

    const namespace = createSessionNamespace({
      entityId: "order-001",
      entityType: "order",
      hostApp: "sdk-invalid-storage",
      organizationId: "org-001",
      packageMajor: "assistant-sdk-v1",
      pageIdentity: "/orders/001",
      sessionScope: "entity",
    });
    expect(namespace.ok).toBe(true);
    if (!namespace.ok) return;
    globalThis.sessionStorage.setItem(namespace.namespace, "storage-stale-001");
    const storageAdapter = createSdkRuntimeAdapter({
      configuration: { sessionScope: "entity" },
      pinia: createPinia(),
      provider: async () => ({
        hostApp: "sdk-invalid-storage",
        organizationId: "org-001",
        pageContext: { entityId: "order-001", entityType: "order", route: "/orders/001" },
      }),
      runtimeScope: "sdk-bootstrap:invalid-storage",
      transport,
    });

    await expect(storageAdapter.bootstrapSession()).resolves.toEqual({ ok: true, sessionId: "session-replacement-001" });
    expect(getSession).toHaveBeenLastCalledWith({ sessionId: "storage-stale-001" });
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(globalThis.sessionStorage.getItem(namespace.namespace)).toBe("session-replacement-001");
  });

  it("uses one provider snapshot for create request context", async () => {
    const provider = vi.fn()
      .mockResolvedValueOnce({
        actorId: "actor-a",
        hostApp: "snapshot-a",
        organizationId: "org-a",
        pageContext: { entityId: "order-a", entityType: "order", route: "/orders/a" },
        permissionScopes: ["orders:read"],
        role: "operator",
      })
      .mockResolvedValueOnce({
        actorId: "actor-b",
        hostApp: "snapshot-b",
        organizationId: "org-b",
        pageContext: { entityId: "order-b", entityType: "order", route: "/orders/b" },
        permissionScopes: ["orders:write"],
        role: "manager",
      });
    const createSession = vi.fn(async () => ({
      ok: true as const,
      value: { sessionId: "session-snapshot-create", status: "active" },
    }));
    const adapter = createSdkRuntimeAdapter({
      pinia: createPinia(),
      provider,
      runtimeScope: "sdk-bootstrap:snapshot-create",
      transport: { ...createDefaultTransport({ integrationMode: "backend002" }), createSession },
    });

    await expect(adapter.bootstrapSession()).resolves.toEqual({ ok: true, sessionId: "session-snapshot-create" });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith({
      pageContext: { entityId: "order-a", entityType: "order", route: "/orders/a" },
    }, expect.any(Object));
  });

  it("derives storage namespace and create context from the same provider snapshot", async () => {
    const snapshotANamespace = createSessionNamespace({
      entityId: "order-a",
      entityType: "order",
      hostApp: "snapshot-a",
      organizationId: "org-a",
      packageMajor: "assistant-sdk-v1",
      pageIdentity: "/orders/a",
      sessionScope: "entity",
    });
    expect(snapshotANamespace.ok).toBe(true);
    if (!snapshotANamespace.ok) return;
    globalThis.sessionStorage.setItem(snapshotANamespace.namespace, "stale-snapshot-a");
    const provider = vi.fn()
      .mockResolvedValueOnce({
        hostApp: "snapshot-a",
        organizationId: "org-a",
        pageContext: { entityId: "order-a", entityType: "order", route: "/orders/a" },
      })
      .mockResolvedValueOnce({
        hostApp: "snapshot-b",
        organizationId: "org-b",
        pageContext: { entityId: "order-b", entityType: "order", route: "/orders/b" },
      });
    const createSession = vi.fn(async () => ({
      ok: true as const,
      value: { sessionId: "session-snapshot-storage", status: "active" },
    }));
    const adapter = createSdkRuntimeAdapter({
      configuration: { sessionScope: "entity" },
      pinia: createPinia(),
      provider,
      runtimeScope: "sdk-bootstrap:snapshot-storage",
      transport: { ...createDefaultTransport({ integrationMode: "backend002" }), createSession },
    });

    await expect(adapter.bootstrapSession()).resolves.toEqual({ ok: true, sessionId: "session-snapshot-storage" });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith({
      pageContext: { entityId: "order-a", entityType: "order", route: "/orders/a" },
    }, expect.any(Object));
    expect(globalThis.sessionStorage.getItem(snapshotANamespace.namespace)).toBe("session-snapshot-storage");
  });

  it("shares one in-flight bootstrap across concurrent callers and coalesces force-new callers", async () => {
    let resolveCreate: ((value: { readonly ok: true; readonly value: { readonly sessionId: string; readonly status: string } }) => void) | undefined;
    const create = vi.fn(() => new Promise<{ readonly ok: true; readonly value: { readonly sessionId: string; readonly status: string } }>(resolve => {
      resolveCreate = resolve;
    }));
    const adapter = createSdkRuntimeAdapter({
      pinia: createPinia(),
      provider: async () => ({ hostApp: "sdk-bootstrap-concurrent" }),
      runtimeScope: "sdk-bootstrap:concurrent",
      transport: {
        ...createDefaultTransport({ integrationMode: "backend002" }),
        createSession: create,
      },
    });

    const first = adapter.bootstrapSession();
    const second = adapter.bootstrapSession();
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    resolveCreate?.({ ok: true, value: { sessionId: "session-concurrent-001", status: "active" } });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true, sessionId: "session-concurrent-001" },
      { ok: true, sessionId: "session-concurrent-001" },
    ]);

    const restartOne = adapter.bootstrapSession({ forceNew: true });
    const restartTwo = adapter.bootstrapSession({ forceNew: true });
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    resolveCreate?.({ ok: true, value: { sessionId: "session-concurrent-002", status: "active" } });
    await expect(Promise.all([restartOne, restartTwo])).resolves.toEqual([
      { ok: true, sessionId: "session-concurrent-002" },
      { ok: true, sessionId: "session-concurrent-002" },
    ]);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
