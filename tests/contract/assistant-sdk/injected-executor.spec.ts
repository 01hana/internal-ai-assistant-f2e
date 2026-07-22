import { describe, expect, it, vi } from "vitest";
import {
  canonicalSharedRuntimeBoundary,
  frontend002SdkAdapterBoundary,
} from "../../fixtures/assistant-sdk/architecture-guardrails";
import {
  forbiddenOutgoingFields,
  localOnlyFields,
  secretLikeFields,
} from "../../fixtures/assistant-sdk/forbidden-fields";
import { assistantRuntimeTransportOwnership } from "../../../packages/assistant-runtime/src/transport/ports";

type AuthenticatedExecutorModule = {
  readonly createAuthenticatedExecutorTransport: (
    executor: unknown,
    options?: Readonly<Record<string, unknown>>,
  ) => unknown;
};

type SanitizedExecutionInput = {
  readonly request: Readonly<Record<string, unknown>>;
  readonly requestId: string;
  readonly sessionId: string;
};

type ExecutorResult = {
  readonly ok: boolean;
  readonly error?: {
    readonly code?: string;
    readonly field?: string;
  };
};

type AuthenticatedExecutorTransport = {
  readonly execute: (input: Readonly<Record<string, unknown>>) => ExecutorResult | Promise<ExecutorResult>;
  readonly buildAssistantRequest?: unknown;
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

async function loadAuthenticatedExecutorContract() {
  const contract = await import("../../../packages/assistant-sdk/src/transport/authenticatedExecutor") as Partial<AuthenticatedExecutorModule>;

  expect(
    typeof contract.createAuthenticatedExecutorTransport,
    "authenticatedExecutor.ts must export createAuthenticatedExecutorTransport.",
  ).toBe("function");

  return contract as AuthenticatedExecutorModule;
}

function createSanitizedExecutionInput(): SanitizedExecutionInput {
  return {
    request: {
      message: "請檢查目前頁面",
      pageContext: {
        pageType: "orders",
      },
    },
    requestId: "request-001",
    sessionId: "session-001",
  };
}

function createBypassAttempt(field: string): Readonly<Record<string, unknown>> {
  return {
    request: {
      message: "請檢查目前頁面",
      [field]: "leak",
    },
    requestId: "request-001",
    sessionId: "session-001",
  };
}

function createTopLevelBypassAttempt(field: string): Readonly<Record<string, unknown>> {
  return {
    ...createSanitizedExecutionInput(),
    [field]: "leak",
  };
}

describe("Frontend 002 injected authenticated executor boundary", () => {
  it("requires an SDK-internal low-level authenticated executor transport factory", async () => {
    const contract = await loadAuthenticatedExecutorContract();

    expect(contract.createAuthenticatedExecutorTransport).toBeTypeOf("function");
    expect(canonicalSharedRuntimeBoundary.role).toBe("reusable canonical runtime owner");
    expect(frontend002SdkAdapterBoundary.allowedResponsibilities).toContain("default/injected transport execution");
    expect(assistantRuntimeTransportOwnership.sharedRuntimeOwns).toContain("retry/cancel/timeout/interrupted state");
  });

  it("accepts only SDK-built sanitized request execution inputs", async () => {
    const { createAuthenticatedExecutorTransport } = await loadAuthenticatedExecutorContract();
    const executor = vi.fn(async (input: SanitizedExecutionInput) => ({
      ok: true,
      input,
    }));
    const transport = createAuthenticatedExecutorTransport(executor) as AuthenticatedExecutorTransport;
    const sanitizedInput = createSanitizedExecutionInput();

    expect(transport, "Injected executor transport must expose a low-level execute boundary.").toHaveProperty("execute");
    expect(transport.buildAssistantRequest, "Injected executor must not own request building.").toBeUndefined();
    expect(transport.sanitizePageContextForRequest, "Injected executor must not own PageContext sanitization.").toBeUndefined();
    expect(transport.assertOutgoingRequestSafe, "Injected executor must not own outgoing request safety gate.").toBeUndefined();
    expect(sanitizedInput.request).toHaveProperty("message");

    await transport.execute(sanitizedInput);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith(expect.objectContaining({
      request: sanitizedInput.request,
      requestId: sanitizedInput.requestId,
      sessionId: sanitizedInput.sessionId,
    }));
  });

  it("rejects raw provider, configuration, callback, local-only, secret, and backend authority bypass attempts", async () => {
    const { createAuthenticatedExecutorTransport } = await loadAuthenticatedExecutorContract();
    const executor = vi.fn(async () => ({ ok: true }));
    const transport = createAuthenticatedExecutorTransport(executor) as AuthenticatedExecutorTransport;

    for (const field of [
      "hostContext",
      "widgetConfiguration",
      "hostCallbacks",
      "callbackPayload",
      "transportMetadata",
      "hiddenPrompt",
      "messageText",
      ...localOnlyFields,
      ...secretLikeFields,
      ...forbiddenOutgoingFields,
    ]) {
      const nestedResult = await transport.execute(createBypassAttempt(field));
      const topLevelResult = await transport.execute(createTopLevelBypassAttempt(field));

      expect(nestedResult.ok, `Injected executor must fail closed for nested ${field}.`).toBe(false);
      expect(nestedResult.error?.field ?? field).toBe(field);
      expect(topLevelResult.ok, `Injected executor must fail closed for top-level ${field}.`).toBe(false);
      expect(topLevelResult.error?.field ?? field).toBe(field);
    }

    expect(executor, "Injected executor must not be called for bypass attempts.").not.toHaveBeenCalled();
  });

  it("does not own endpoint selection, SSE parsing, retry, cancel, timeout, interrupted, outcome, or error flow", async () => {
    const { createAuthenticatedExecutorTransport } = await loadAuthenticatedExecutorContract();
    const transport = createAuthenticatedExecutorTransport(async () => ({ ok: true })) as AuthenticatedExecutorTransport;
    const serializedTransport = JSON.stringify(transport);

    expect(transport.endpoint, "Injected executor must not own endpoint selection.").toBeUndefined();
    expect(transport.route, "Injected executor must not own route selection.").toBeUndefined();
    expect(transport.requestEnvelope, "Injected executor must not own request envelope construction.").toBeUndefined();
    expect(transport.parseSse, "Injected executor must not expose SSE parser ownership.").toBeUndefined();
    expect(transport.parseAssistantSse, "Injected executor must not expose assistant SSE parser ownership.").toBeUndefined();
    expect(transport.createSseParser, "Injected executor must not create a second SSE parser.").toBeUndefined();
    expect(transport.retry, "Injected executor must not own retry flow.").toBeUndefined();
    expect(transport.cancel, "Injected executor must not own cancel flow.").toBeUndefined();
    expect(transport.timeout, "Injected executor must not own timeout lifecycle.").toBeUndefined();
    expect(transport.interrupted, "Injected executor must not own interrupted lifecycle.").toBeUndefined();
    expect(transport.errorFlow, "Injected executor must not own error flow.").toBeUndefined();
    expect(transport.outcomeState, "Injected executor must not own safe outcome state.").toBeUndefined();
    expect(serializedTransport).not.toMatch(/endpoint|route|requestEnvelope|parseSse|parseAssistantSse|createSseParser/);
    expect(serializedTransport).not.toMatch(/retry|cancel|timeout|interrupted|errorFlow|outcomeState|modeSpecificSseParser/);
    expect(assistantRuntimeTransportOwnership.forbiddenAdapterOwnership).toContain("SSE parser");
    expect(assistantRuntimeTransportOwnership.forbiddenAdapterOwnership).toContain("retry state machine");
  });
});
