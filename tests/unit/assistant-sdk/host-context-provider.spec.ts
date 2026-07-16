import { describe, expect, it } from "vitest";
import {
  createCompleteBackend002Context,
  createDeferredProviderContext,
  createLeakyProviderContext,
  createMissingBackend002Context,
  createProviderSnapshots,
  providerBackendAuthorityFields,
  providerSecretLikeFields,
  type HostContextContractInput,
  type HostContextResolutionContractResult,
  type HostContextResolverContract,
} from "../../fixtures/assistant-sdk/host-context-provider-fixtures";

type ContextResolutionContractModule = {
  readonly resolveHostContextForRequest: (
    input: HostContextContractInput,
  ) => Promise<HostContextResolutionContractResult>;
};

type HostContextProviderContractModule = {
  readonly createHostContextResolver: (input: {
    readonly provider: HostContextContractInput["provider"];
    readonly integrationMode: HostContextContractInput["integrationMode"];
  }) => HostContextResolverContract;
};

async function loadContextResolutionContract() {
  return await import("../../../packages/assistant-sdk/src/context/contextResolution") as ContextResolutionContractModule;
}

async function loadHostContextProviderContract() {
  return await import("../../../packages/assistant-sdk/src/context/hostContextProvider") as HostContextProviderContractModule;
}

function expectOk(result: HostContextResolutionContractResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected ok host context resolution, received ${result.error.code}`);
  }

  return result;
}

function expectFailure(result: HostContextResolutionContractResult) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected failed host context resolution");
  }

  return result;
}

describe("Frontend 002 host context provider contract", () => {
  it("supports async request-scoped provider resolution", async () => {
    const { resolveHostContextForRequest } = await loadContextResolutionContract();

    const result = await resolveHostContextForRequest({
      integrationMode: "backend001-compatibility",
      operation: "send",
      provider: async () => ({
        hostApp: "erp",
        pageContext: { route: "/orders" },
      }),
    });

    expectOk(result);
    expect(result.context).toMatchObject({
      hostApp: "erp",
      pageContext: { route: "/orders" },
    });
  });

  it("re-resolves before each send instead of reusing a mount-time snapshot", async () => {
    const { createHostContextResolver } = await loadHostContextProviderContract();
    const resolver = createHostContextResolver({
      integrationMode: "backend001-compatibility",
      provider: createProviderSnapshots([
        { hostApp: "erp", pageContext: { route: "/orders/1" } },
        { hostApp: "erp", pageContext: { route: "/orders/2" } },
      ]),
    });

    const first = expectOk(await resolver.resolveForRequest({ operation: "send" }));
    const second = expectOk(await resolver.resolveForRequest({ operation: "send" }));

    expect(first.context.pageContext).toEqual({ route: "/orders/1" });
    expect(second.context.pageContext).toEqual({ route: "/orders/2" });
  });

  it("re-resolves before retry and uses the latest provider output", async () => {
    const { createHostContextResolver } = await loadHostContextProviderContract();
    const resolver = createHostContextResolver({
      integrationMode: "backend001-compatibility",
      provider: createProviderSnapshots([
        { hostApp: "erp", pageContext: { revision: 1 } },
        { hostApp: "erp", pageContext: { revision: 2 } },
      ]),
    });

    const send = expectOk(await resolver.resolveForRequest({ operation: "send" }));
    const retry = expectOk(await resolver.resolveForRequest({ operation: "retry" }));

    expect(send.context.pageContext).toEqual({ revision: 1 });
    expect(retry.context.pageContext).toEqual({ revision: 2 });
  });

  it("fails closed with a safe context error when provider resolution fails", async () => {
    const { resolveHostContextForRequest } = await loadContextResolutionContract();

    const result = await resolveHostContextForRequest({
      integrationMode: "backend001-compatibility",
      operation: "send",
      provider: async () => {
        throw new Error("host app context unavailable");
      },
    });

    expectFailure(result);
    expect(result.error).toMatchObject({
      code: "context_unavailable",
      userMessage: "context unavailable",
    });
  });

  it("rejects stale older resolutions when provider calls finish out of order", async () => {
    const { createHostContextResolver } = await loadHostContextProviderContract();
    const oldContext = createDeferredProviderContext();
    const latestContext = createDeferredProviderContext();
    const providerResults = [oldContext.promise, latestContext.promise] as const;
    let providerCall = 0;
    const resolver = createHostContextResolver({
      integrationMode: "backend001-compatibility",
      provider: async () => providerResults[providerCall++] ?? {},
    });

    const oldResolution = resolver.resolveForRequest({ operation: "send" });
    const latestResolution = resolver.resolveForRequest({ operation: "send" });

    latestContext.resolve({ hostApp: "erp", pageContext: { revision: "latest" } });
    oldContext.resolve({ hostApp: "erp", pageContext: { revision: "old" } });

    expectOk(await latestResolution);
    const stale = expectFailure(await oldResolution);
    expect(stale.error).toMatchObject({
      code: "stale_context",
      userMessage: "integration error",
    });
  });

  it("omits local-only callbacks, configuration, session scope, and local UI state from backend context", async () => {
    const { resolveHostContextForRequest } = await loadContextResolutionContract();

    const result = await resolveHostContextForRequest({
      integrationMode: "backend001-compatibility",
      operation: "send",
      provider: async () => createLeakyProviderContext(),
    });

    const resolved = expectOk(result);
    expect(resolved.context).not.toHaveProperty("callbacks");
    expect(resolved.context).not.toHaveProperty("localUiState");
    expect(resolved.context).not.toHaveProperty("sessionScope");
    expect(resolved.context).not.toHaveProperty("widgetConfiguration");
  });

  it("fails closed when provider output contains secret-like fields", async () => {
    const { resolveHostContextForRequest } = await loadContextResolutionContract();

    for (const field of providerSecretLikeFields) {
      const result = await resolveHostContextForRequest({
        integrationMode: "backend001-compatibility",
        operation: "send",
        provider: async () => ({
          hostApp: "erp",
          pageContext: { route: "/orders" },
          [field]: "secret-value",
        }),
      });

      const failure = expectFailure(result);
      expect(failure.error).toMatchObject({
        code: "forbidden_host_context_field",
        field,
      });
    }
  });

  it("fails closed when provider output contains backend-owned authority fields", async () => {
    const { resolveHostContextForRequest } = await loadContextResolutionContract();

    for (const field of providerBackendAuthorityFields) {
      const result = await resolveHostContextForRequest({
        integrationMode: "backend001-compatibility",
        operation: "send",
        provider: async () => ({
          hostApp: "erp",
          pageContext: { route: "/orders" },
          [field]: "frontend-owned-value",
        }),
      });

      const failure = expectFailure(result);
      expect(failure.error).toMatchObject({
        code: "forbidden_host_context_field",
        field,
      });
    }
  });

  it("fails closed in Backend 002 Mode when required identity or organization context is missing", async () => {
    const { resolveHostContextForRequest } = await loadContextResolutionContract();

    const result = await resolveHostContextForRequest({
      integrationMode: "backend002",
      operation: "send",
      provider: async () => createMissingBackend002Context(),
    });

    const failure = expectFailure(result);
    expect(failure.error).toMatchObject({
      code: "missing_required_context",
      userMessage: "context unavailable",
      retryable: false,
    });
  });

  it("accepts complete Backend 002 context without inventing frontend authority fields", async () => {
    const { resolveHostContextForRequest } = await loadContextResolutionContract();

    const result = await resolveHostContextForRequest({
      integrationMode: "backend002",
      operation: "send",
      provider: async () => createCompleteBackend002Context(),
    });

    const resolved = expectOk(result);
    expect(resolved.context).toMatchObject(createCompleteBackend002Context());
    expect(resolved.context).not.toHaveProperty("sourceSystem");
    expect(resolved.context).not.toHaveProperty("connectorId");
    expect(resolved.context).not.toHaveProperty("permissionResult");
  });
});
