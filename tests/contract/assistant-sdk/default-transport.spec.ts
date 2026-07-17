import { describe, expect, it, vi } from "vitest";
import { frontendIntegrationModes } from "../../fixtures/assistant-sdk/architecture-guardrails";

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
  readonly buildAssistantRequest?: unknown;
  readonly buildRequestEnvelope?: unknown;
  readonly sanitizePageContextForRequest?: unknown;
  readonly assertOutgoingRequestSafe?: unknown;
  readonly endpoint?: unknown;
  readonly route?: unknown;
  readonly requestEnvelope?: unknown;
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

describe("Frontend 002 default transport reuse boundary", () => {
  it("requires an SDK-internal default transport factory", async () => {
    const contract = await loadDefaultTransportContract();

    expect(contract.createDefaultTransport).toBeTypeOf("function");
  });

  it("accepts package-built requests instead of rebuilding request envelopes", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const frontend001Service = {
      sendAssistantMessage: vi.fn(async (request: PackageBuiltRequest) => ({
        ok: true,
        request,
      })),
    };
    const transport = createDefaultTransport({
      frontend001Service,
    }) as Partial<DefaultTransport>;
    const packageBuiltRequest = createPackageBuiltRequest();

    expect(transport, "Default transport must expose a send-like low-level boundary.").toHaveProperty("send");
    expect(transport.buildAssistantRequest, "Default transport must not own Phase 4 request building.").toBeUndefined();
    expect(transport.buildRequestEnvelope, "Default transport must not create a second request envelope.").toBeUndefined();
    expect(transport.sanitizePageContextForRequest, "Default transport must not own PageContext sanitization.").toBeUndefined();
    expect(transport.assertOutgoingRequestSafe, "Default transport must not own outgoing request safety gating.").toBeUndefined();
    expect(packageBuiltRequest.request).toHaveProperty("message");

    await transport.send?.(packageBuiltRequest);

    expect(frontend001Service.sendAssistantMessage).toHaveBeenCalledTimes(1);
    expect(frontend001Service.sendAssistantMessage).toHaveBeenCalledWith(expect.objectContaining({
      request: packageBuiltRequest.request,
      requestId: packageBuiltRequest.requestId,
      sessionId: packageBuiltRequest.sessionId,
    }));
  });

  it("delegates through Frontend 001 assistant service ownership without creating a second API client", async () => {
    const { createDefaultTransport } = await loadDefaultTransportContract();
    const frontend001Service = {
      sendAssistantMessage: vi.fn(async (request: PackageBuiltRequest) => ({
        ok: true,
        request,
      })),
    };
    const transport = createDefaultTransport({
      frontend001Service,
    }) as DefaultTransport;
    const packageBuiltRequest = createPackageBuiltRequest();

    await transport.send(packageBuiltRequest);

    const delegatedRequest = frontend001Service.sendAssistantMessage.mock.calls[0]?.[0] as Readonly<Record<string, unknown>>;

    expect(JSON.stringify(transport)).not.toMatch(/createAssistantClient|new AssistantService|packageBackendProxy/);
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

  it("preserves frontend mode values as request-builder inputs, not backend routes or transport-owned modes", () => {
    expect(frontendIntegrationModes).toContain("Backend 001 Compatibility Mode");
    expect(frontendIntegrationModes).toContain("Backend 002 Mode");
    expect(createPackageBuiltRequest().request).not.toHaveProperty("integrationMode");
    expect(createPackageBuiltRequest().request).not.toHaveProperty("backendRequestMode");
  });
});
