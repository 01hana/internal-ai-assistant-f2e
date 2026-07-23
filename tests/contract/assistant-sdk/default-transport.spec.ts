import { describe, expect, it, vi } from "vitest";
import {
  canonicalSharedRuntimeBoundary,
  frontend002SdkAdapterBoundary,
  frontendIntegrationModes,
} from "../../fixtures/assistant-sdk/architecture-guardrails";
import {
  assistantRuntimeTransportOperationNames,
  assistantRuntimeTransportOwnership,
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
      pageContext: {
        pageType: "orders",
        selectedRows: [{ id: "order-001" }],
      },
      sessionId: "session-001",
    });
    expect(executionInput.request).not.toHaveProperty("hostContext");
    expect(executionInput.request).not.toHaveProperty("sessionScope");
    expect(executionInput.request).not.toHaveProperty("sourceSystem");
    expect(executionInput.request).not.toHaveProperty("connector");
    expect(executionInput.request).not.toHaveProperty("permissionResult");
    expect(JSON.stringify(executionInput.request)).not.toMatch(/token|credential|secret|hiddenPrompt/i);
  });

  it("fails safely when a port operation has no real SDK-side execution capability", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const transport = createDefaultTransport() as DefaultTransport;

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
    expect(assistantRuntimeTransportOwnership.forbiddenAdapterOwnership).toContain("session state machine");
  });

  it("preserves frontend mode values as request-builder inputs, not backend routes or transport-owned modes", () => {
    expect(frontendIntegrationModes).toContain("Backend 001 Compatibility Mode");
    expect(frontendIntegrationModes).toContain("Backend 002 Mode");
    expect(createPackageBuiltRequest().request).not.toHaveProperty("integrationMode");
    expect(createPackageBuiltRequest().request).not.toHaveProperty("backendRequestMode");
  });
});
