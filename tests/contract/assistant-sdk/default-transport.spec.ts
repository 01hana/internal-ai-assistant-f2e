import { describe, expect, it, vi } from "vitest";
import {
  canonicalSharedRuntimeBoundary,
  frontend002SdkAdapterBoundary,
  frontendIntegrationModes,
} from "../../fixtures/assistant-sdk/architecture-guardrails";
import {
  assistantRuntimeTransportOperationNames,
  assistantRuntimeTransportOwnership,
  supportsAssistantRuntimeRemoteRestoration,
  type AssistantRuntimeTransportPort,
} from "../../../packages/assistant-runtime/src/transport/ports";

type DefaultTransportModule = {
  readonly createDefaultTransport: (options?: Readonly<Record<string, unknown>>) => unknown;
};

type PackageBuiltRequest = {
  readonly request: Readonly<Record<string, unknown>>;
  readonly requestId: string;
  readonly sessionId: string;
};

type DefaultTransport = {
  readonly send: (request: PackageBuiltRequest) => unknown | Promise<unknown>;
  readonly execute?: unknown;
  readonly createSession: AssistantRuntimeTransportPort["createSession"];
  readonly getSession: AssistantRuntimeTransportPort["getSession"];
  readonly loadHistory: AssistantRuntimeTransportPort["loadHistory"];
  readonly sendMessage: AssistantRuntimeTransportPort["sendMessage"];
  readonly streamMessage: AssistantRuntimeTransportPort["streamMessage"];
  readonly cancelMessage: AssistantRuntimeTransportPort["cancelMessage"];
  readonly abortMessage: AssistantRuntimeTransportPort["abortMessage"];
  readonly submitFeedback: AssistantRuntimeTransportPort["submitFeedback"];
  readonly confirmAction: AssistantRuntimeTransportPort["confirmAction"];
  readonly rejectAction: AssistantRuntimeTransportPort["rejectAction"];
  readonly loadApprovalRequest: AssistantRuntimeTransportPort["loadApprovalRequest"];
  readonly buildAssistantRequest?: unknown;
  readonly buildRequestEnvelope?: unknown;
  readonly sanitizePageContextForRequest?: unknown;
  readonly assertOutgoingRequestSafe?: unknown;
  readonly endpoint?: unknown;
  readonly route?: unknown;
  readonly requestEnvelope?: unknown;
  readonly parseSse?: unknown;
  readonly parseAssistantSse?: unknown;
  readonly createSseParser?: unknown;
  readonly retry?: unknown;
  readonly cancel?: unknown;
  readonly timeout?: unknown;
  readonly interrupted?: unknown;
  readonly errorFlow?: unknown;
  readonly outcomeState?: unknown;
};

async function loadDefaultTransportContract() {
  const contract = await import("../../../packages/assistant-sdk/src/transport/defaultTransport") as Partial<DefaultTransportModule>;

  expect(
    typeof contract.createDefaultTransport,
    "defaultTransport.ts must export createDefaultTransport.",
  ).toBe("function");

  return contract as DefaultTransportModule;
}

function createPackageBuiltRequest(): PackageBuiltRequest {
  return {
    request: {
      message: "請摘要目前頁面的訂單風險",
      pageContext: {
        pageType: "orders",
        selectedRows: [
          {
            id: "order-001",
            label: "Order 001",
          },
        ],
      },
    },
    requestId: "request-001",
    sessionId: "session-001",
  };
}

describe("Frontend 002 default transport adapter boundary", () => {
  it("requires an SDK-internal default transport factory that exposes Shared Runtime port operations", async () => {
    const contract = await loadDefaultTransportContract();
    const transport = contract.createDefaultTransport() as Partial<DefaultTransport>;

    expect(contract.createDefaultTransport).toBeTypeOf("function");
    expect(canonicalSharedRuntimeBoundary.role).toBe("reusable canonical runtime owner");
    expect(frontend002SdkAdapterBoundary.allowedResponsibilities).toContain("default/injected transport execution");
    expect(assistantRuntimeTransportOwnership.sharedRuntimeOwns).toContain("canonical SSE consumption");

    for (const operation of assistantRuntimeTransportOperationNames) {
      expect(transport[operation], `Default transport must implement Shared Runtime transport port operation ${operation}.`).toBeTypeOf("function");
    }
  });

  it("keeps send as a compatibility alias over the SDK execution capability without rebuilding envelopes", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const execute = vi.fn(async (request: PackageBuiltRequest) => ({
      ok: true,
      request,
    }));
    const transport = createDefaultTransport({
      execute,
    }) as Partial<DefaultTransport>;
    const packageBuiltRequest = createPackageBuiltRequest();

    expect(transport, "Default transport must expose a send-like low-level boundary.").toHaveProperty("send");
    expect(transport.execute, "Default transport must not expose executor internals as a public method.").toBeUndefined();
    expect(transport.buildAssistantRequest, "Default transport must not own Phase 4 request building.").toBeUndefined();
    expect(transport.buildRequestEnvelope, "Default transport must not create a second request envelope.").toBeUndefined();
    expect(transport.sanitizePageContextForRequest, "Default transport must not own PageContext sanitization.").toBeUndefined();
    expect(transport.assertOutgoingRequestSafe, "Default transport must not own outgoing request safety gating.").toBeUndefined();
    expect(packageBuiltRequest.request).toHaveProperty("message");

    await transport.send?.(packageBuiltRequest);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      request: packageBuiltRequest.request,
      requestId: packageBuiltRequest.requestId,
      sessionId: packageBuiltRequest.sessionId,
    }), undefined);
  });

  it("builds message transport requests through the SDK request builder and preserves Compatibility Mode omission", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const execute = vi.fn(async () => ({
      ok: true,
      value: {
        messageId: "message-001",
        sessionId: "session-001",
        status: "queued",
      },
    }));
    const transport = createDefaultTransport({ execute }) as DefaultTransport;

    const result = await transport.sendMessage({
      message: " 請摘要目前頁面 ",
      pageContext: {
        pageType: "orders",
        selectedRows: [{ id: "order-001" }],
      },
      sessionId: "session-001",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        messageId: "message-001",
        sessionId: "session-001",
        status: "queued",
      },
    });
    expect(execute).toHaveBeenCalledTimes(1);

    const executionInput = execute.mock.calls[0]?.[0] as PackageBuiltRequest;
    expect(executionInput).toEqual(expect.objectContaining({
      requestId: expect.any(String),
      sessionId: "session-001",
    }));
    expect(executionInput.request).toMatchObject({
      message: " 請摘要目前頁面 ",
      sessionId: "session-001",
    });
    expect(executionInput.request).not.toHaveProperty("pageContext");
    expect(executionInput.request).not.toHaveProperty("hostContext");
    expect(executionInput.request).not.toHaveProperty("selectedRows");
    expect(executionInput.request).not.toHaveProperty("entityType");
    expect(executionInput.request).not.toHaveProperty("entityId");
    expect(executionInput.request).not.toHaveProperty("sessionScope");
    expect(executionInput.request).not.toHaveProperty("sourceSystem");
    expect(executionInput.request).not.toHaveProperty("connector");
    expect(executionInput.request).not.toHaveProperty("permissionResult");
    expect(JSON.stringify(executionInput.request)).not.toMatch(/token|credential|secret|hiddenPrompt/i);
  });

  it("fails safely when a port operation has no real SDK-side execution capability", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const transport = createDefaultTransport({
      integrationMode: "backend002",
    }) as DefaultTransport;

    await expect(transport.createSession({})).resolves.toMatchObject({
      error: {
        code: "transport_unavailable",
        userMessage: "integration error",
      },
      ok: false,
    });

    await expect(transport.cancelMessage({
      messageId: "message-001",
      sessionId: "session-001",
    })).resolves.toMatchObject({
      error: {
        code: "transport_unavailable",
      },
      ok: false,
    });

    expect(transport.getSession).toBeUndefined();
    expect(transport.loadHistory).toBeUndefined();
  });

  it("uses an explicitly configured Compatibility Mode API base for session, history, and SSE requests", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/messages") && init?.method === "POST") {
        return new Response(new ReadableStream<Uint8Array>(), {
          headers: { "content-type": "text/event-stream" },
          status: 200,
        });
      }

      return new Response(JSON.stringify({ data: { sessionId: "session-001" } }), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const transport = createDefaultTransport({
        apiBaseUrl: "http://localhost:3000/api/v1/",
      }) as DefaultTransport;

      await transport.createSession({});
      await transport.loadHistory({ sessionId: "session-001" });
      await transport.streamMessage({
        message: "請摘要目前頁面",
        sessionId: "session-001",
      });

      expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
        "http://localhost:3000/api/v1/assistant/sessions",
        "http://localhost:3000/api/v1/assistant/sessions/session-001/messages",
        "http://localhost:3000/api/v1/assistant/sessions/session-001/messages",
      ]);
    }
    finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps same-origin /api/v1 as the Compatibility Mode fallback", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { sessionId: "session-001" } }), {
      headers: { "content-type": "application/json" },
      status: 200,
    }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const transport = createDefaultTransport() as DefaultTransport;

      await transport.createSession({});

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/assistant/sessions",
        expect.objectContaining({ method: "POST" }),
      );
    }
    finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses Gateway-v1 JSON routes, opaque request-scoped authorization, and a create-only pageContext payload", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const getAccessToken = vi.fn()
      .mockResolvedValueOnce("token-A")
      .mockResolvedValueOnce(" token-B ")
      .mockResolvedValueOnce("token-C");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: { sessionId: "session-001", status: "active" },
      requestId: "gateway-request-001",
    }), {
      headers: { "content-type": "application/json" },
      status: 200,
    }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const transport = createDefaultTransport({
        apiBaseUrl: "http://localhost:4000/api/v1/",
        getAccessToken,
        integrationMode: "gateway-v1",
      }) as DefaultTransport;

      await transport.createSession({
        pageContext: {
          entityId: "order-001",
          entityType: "order",
          selectedRows: [{ id: "order-001", label: "SO-001" }],
        },
      });
      await transport.getSession?.({ sessionId: " session/001 " });
      await transport.loadHistory?.({ sessionId: "session-001", cursor: "next cursor" });

      expect(getAccessToken).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
        "http://localhost:4000/api/v1/assistant/sessions",
        "http://localhost:4000/api/v1/assistant/sessions/session%2F001",
        "http://localhost:4000/api/v1/assistant/sessions/session-001/messages?cursor=next%20cursor",
      ]);

      const [createInit, getInit, historyInit] = fetchMock.mock.calls.map(([, init]) => init as RequestInit);
      const createHeaders = new Headers(createInit?.headers);
      const getHeaders = new Headers(getInit?.headers);
      const historyHeaders = new Headers(historyInit?.headers);

      expect(createInit).toMatchObject({ method: "POST" });
      expect(JSON.parse(String(createInit?.body))).toEqual({
        pageContext: {
          entityId: "order-001",
          entityType: "order",
          selectedRows: [{ id: "order-001", label: "SO-001" }],
        },
      });
      expect(createHeaders.get("authorization")).toBe("Bearer token-A");
      expect(createHeaders.get("accept")).toBe("application/json");
      expect(createHeaders.get("content-type")).toBe("application/json");
      expect(createHeaders.get("x-request-id")).toEqual(expect.any(String));

      for (const headerName of [
        "x-actor-id",
        "x-organization-id",
        "x-host-app",
        "x-role",
        "x-permission-scopes",
        "x-customer-id",
        "x-integration-id",
      ]) {
        expect(createHeaders.get(headerName)).toBeNull();
      }

      expect(getInit).toMatchObject({ method: "GET" });
      expect(getInit?.body).toBeUndefined();
      expect(getHeaders.get("authorization")).toBe("Bearer token-B");
      expect(getHeaders.get("accept")).toBe("application/json");
      expect(getHeaders.get("content-type")).toBeNull();

      expect(historyInit).toMatchObject({ method: "GET" });
      expect(historyInit?.body).toBeUndefined();
      expect(historyHeaders.get("authorization")).toBe("Bearer token-C");
      expect(historyHeaders.get("accept")).toBe("application/json");
      expect(historyHeaders.get("content-type")).toBeNull();
    }
    finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails closed before Gateway-v1 JSON fetch when the access token is unavailable", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      const missingTokenTransport = createDefaultTransport({ integrationMode: "gateway-v1" }) as DefaultTransport;
      const throwingTokenTransport = createDefaultTransport({
        getAccessToken: () => {
          throw new Error("raw-token-error");
        },
        integrationMode: "gateway-v1",
      }) as DefaultTransport;

      await expect(missingTokenTransport.createSession({})).resolves.toMatchObject({
        error: { code: "authentication_unavailable", userMessage: "integration error" },
        ok: false,
      });
      await expect(throwingTokenTransport.getSession?.({ sessionId: "session-001" })).resolves.toMatchObject({
        error: { code: "authentication_unavailable", userMessage: "integration error" },
        ok: false,
      });

      expect(fetchMock).not.toHaveBeenCalled();
    }
    finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    ["get", 404, "session_not_found"],
    ["history", 404, "session_not_found"],
    ["get", 401, "authentication_unavailable"],
    ["history", 401, "authentication_unavailable"],
    ["get", 403, "transport_forbidden"],
    ["history", 403, "transport_forbidden"],
    ["get", 503, "transport_execution_failed"],
    ["history", 503, "transport_execution_failed"],
  ] as const)("classifies Gateway-v1 %s JSON status %i without exposing its raw body", async (operation, status, code) => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      diagnostics: "internal gateway stack",
      customerData: "customer-secret",
    }), {
      headers: { "content-type": "application/json" },
      status,
    }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const transport = createDefaultTransport({
        getAccessToken: () => "token-gateway",
        integrationMode: "gateway-v1",
      }) as DefaultTransport;
      const result = operation === "get"
        ? await transport.getSession?.({ sessionId: "session-001" })
        : await transport.loadHistory?.({ sessionId: "session-001" });

      expect(result).toMatchObject({ error: { code, userMessage: "integration error" }, ok: false });
      expect(JSON.stringify(result)).not.toMatch(/internal gateway stack|customer-secret/);
    }
    finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps malformed Gateway-v1 JSON and network errors in the generic safe failure class", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const malformedFetch = vi.fn(async () => new Response("not-json", { status: 200 }));
    vi.stubGlobal("fetch", malformedFetch);

    try {
      const transport = createDefaultTransport({
        getAccessToken: () => "token-gateway",
        integrationMode: "gateway-v1",
      }) as DefaultTransport;
      await expect(transport.getSession?.({ sessionId: "session-001" })).resolves.toMatchObject({
        error: { code: "transport_execution_failed" },
        ok: false,
      });

      vi.stubGlobal("fetch", vi.fn(async () => {
        throw new Error("network diagnostic");
      }));
      await expect(transport.getSession?.({ sessionId: "session-001" })).resolves.toMatchObject({
        error: { code: "transport_execution_failed" },
        ok: false,
      });
    }
    finally {
      vi.unstubAllGlobals();
    }
  });

  it("exposes remote restoration only for Compatibility Mode and Gateway-v1", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const compatibility = createDefaultTransport() as AssistantRuntimeTransportPort;
    const gateway = createDefaultTransport({ integrationMode: "gateway-v1" }) as AssistantRuntimeTransportPort;
    const backend002 = createDefaultTransport({ integrationMode: "backend002" }) as AssistantRuntimeTransportPort;

    expect(supportsAssistantRuntimeRemoteRestoration(compatibility)).toBe(true);
    expect(supportsAssistantRuntimeRemoteRestoration(gateway)).toBe(true);
    expect(supportsAssistantRuntimeRemoteRestoration(backend002)).toBe(false);
  });

  it("opens Gateway-v1 SSE with a fresh token, a sanitized message body, and the runtime abort signal", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const getAccessToken = vi.fn()
      .mockResolvedValueOnce("token-A")
      .mockResolvedValueOnce("token-B")
      .mockResolvedValueOnce("token-C")
      .mockResolvedValueOnce("token-D");
    const stream = new ReadableStream<Uint8Array>();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => (
      init?.headers && new Headers(init.headers).get("accept") === "text/event-stream"
        ? new Response(stream, {
            headers: { "content-type": "text/event-stream" },
            status: 200,
          })
        : new Response(JSON.stringify({ data: { sessionId: "session-001", status: "active" } }), {
            headers: { "content-type": "application/json" },
            status: 200,
          })
    ));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const transport = createDefaultTransport({
        getAccessToken,
        integrationMode: "gateway-v1",
      }) as DefaultTransport;
      const controller = new AbortController();

      await transport.createSession({});
      await transport.getSession?.({ sessionId: "session-001" });
      await transport.loadHistory?.({ sessionId: "session-001" });
      const result = await transport.streamMessage({
        message: "請摘要目前頁面",
        pageContext: {
          entityId: "order-001",
          selectedRows: [{ id: "order-001", label: "SO-001" }],
        },
        sessionId: "session/001",
      }, { signal: controller.signal });

      expect(result).toEqual({ ok: true, value: stream });
      expect(getAccessToken).toHaveBeenCalledTimes(4);
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/v1/assistant/sessions/session%2F001/messages",
        expect.objectContaining({
          method: "POST",
          signal: controller.signal,
        }),
      );

      const streamInit = fetchMock.mock.calls[3]?.[1] as RequestInit;
      const headers = new Headers(streamInit.headers);
      const body = JSON.parse(String(streamInit.body));

      expect(headers.get("authorization")).toBe("Bearer token-D");
      expect(headers.get("accept")).toBe("text/event-stream");
      expect(headers.get("content-type")).toBe("application/json");
      expect(headers.get("x-request-id")).toEqual(expect.any(String));
      expect(body).toEqual({
        message: "請摘要目前頁面",
        pageContext: {
          entityId: "order-001",
          selectedRows: [{ id: "order-001", label: "SO-001" }],
        },
      });
      expect(JSON.stringify(body)).not.toMatch(/sessionId|actorId|organizationId|hostApp|customerId|integrationId|role|roles|permissionScopes|token|credential|authorization/i);
    }
    finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    undefined,
    () => "   ",
    () => {
      throw new Error("raw-token-error");
    },
    async () => Promise.reject(new Error("raw-token-error")),
  ] as const)("fails closed before Gateway-v1 SSE fetch when its token is unavailable", async (getAccessToken) => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      const transport = createDefaultTransport({ getAccessToken, integrationMode: "gateway-v1" }) as DefaultTransport;

      await expect(transport.streamMessage({
        message: "請摘要目前頁面",
        sessionId: "session-001",
      })).resolves.toMatchObject({
        error: { code: "authentication_unavailable", userMessage: "integration error" },
        ok: false,
      });

      expect(fetchMock).not.toHaveBeenCalled();
    }
    finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps gateway-v1 sendMessage unavailable without an injected executor", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      const transport = createDefaultTransport({
        getAccessToken: () => "token-unused",
        integrationMode: "gateway-v1",
      }) as DefaultTransport;

      await expect(transport.sendMessage({
        message: "請摘要目前頁面",
        sessionId: "session-001",
      })).resolves.toMatchObject({
        error: { code: "transport_unavailable" },
        ok: false,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    }
    finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails closed without a real session ID and never creates a pending session route", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      const transport = createDefaultTransport() as DefaultTransport;

      await expect(transport.loadHistory({ sessionId: "" })).resolves.toMatchObject({
        error: { code: "missing_session_id" },
        ok: false,
      });
      await expect(transport.streamMessage({ message: "請摘要目前頁面" })).resolves.toMatchObject({
        error: { code: "missing_session_id" },
        ok: false,
      });

      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("stays a low-level SDK adapter without creating a second API client or runtime owner", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const execute = vi.fn(async (request: PackageBuiltRequest) => ({
      ok: true,
      request,
    }));
    const transport = createDefaultTransport({
      execute,
    }) as DefaultTransport;
    const packageBuiltRequest = createPackageBuiltRequest();

    await transport.send(packageBuiltRequest);

    const delegatedRequest = execute.mock.calls[0]?.[0] as Readonly<Record<string, unknown>>;

    expect(JSON.stringify(transport)).not.toMatch(/createAssistantClient|new AssistantService|AssistantService|packageBackendProxy/);
    expect(JSON.stringify(transport)).not.toMatch(/\/api\/v1\/assistant\/host-integration|modeSpecificEndpoint/);
    expect(delegatedRequest).toEqual(expect.objectContaining({
      request: packageBuiltRequest.request,
      requestId: packageBuiltRequest.requestId,
      sessionId: packageBuiltRequest.sessionId,
    }));

    for (const forbiddenField of [
      "integrationMode",
      "backendRequestMode",
      "hostContext",
      "widgetConfiguration",
      "hiddenPrompt",
      "requestEnvelope",
      "modeSpecificRoute",
    ]) {
      expect(delegatedRequest, `Default transport must not add ${forbiddenField}.`).not.toHaveProperty(forbiddenField);
      expect(packageBuiltRequest.request, `Default transport must not rewrite request with ${forbiddenField}.`).not.toHaveProperty(forbiddenField);
    }
  });

  it("does not own SSE parsing, session lifecycle, retry/cancel/timeout/interrupted, or safe outcome state", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const transport = createDefaultTransport({
      execute: vi.fn(async () => ({ ok: true })),
    }) as DefaultTransport;
    const serializedTransport = JSON.stringify(transport);

    for (const forbiddenProperty of [
      "parseSse",
      "parseAssistantSse",
      "createSseParser",
      "retry",
      "cancel",
      "timeout",
      "interrupted",
      "errorFlow",
      "outcomeState",
    ] as const) {
      expect(transport[forbiddenProperty], `Default transport must not expose ${forbiddenProperty}; Shared Runtime owns runtime lifecycle.`).toBeUndefined();
    }

    expect(serializedTransport).not.toMatch(/parseSse|parseAssistantSse|createSseParser|retry|cancel|timeout|interrupted|errorFlow|outcomeState/);
    expect(assistantRuntimeTransportOwnership.forbiddenAdapterOwnership).toContain("SSE parser");
    expect(assistantRuntimeTransportOwnership.forbiddenAdapterOwnership).toContain("canonical session state machine");
  });

  it("preserves frontend mode values as request-builder inputs, not backend routes or transport-owned modes", () => {
    expect(frontendIntegrationModes).toContain("Backend 001 Compatibility Mode");
    expect(frontendIntegrationModes).toContain("Backend 002 Mode");
    expect(frontendIntegrationModes).toContain("Gateway-v1 Mode");
    expect(createPackageBuiltRequest().request).not.toHaveProperty("integrationMode");
    expect(createPackageBuiltRequest().request).not.toHaveProperty("backendRequestMode");
  });
});
