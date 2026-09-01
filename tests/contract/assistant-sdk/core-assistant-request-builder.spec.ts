import { describe, expect, it } from "vitest";
import {
  createBackend001RequestBuilderInput as createCoreAssistantRequestBuilderInput,
  createBackend002RequestBuilderInput,
  forbiddenRequestBuilderFields,
} from "../../fixtures/assistant-sdk/request-builder-fixtures";

type AssistantRequestBuildResult =
  | {
      readonly ok: true;
      readonly request: Readonly<Record<string, unknown>>;
    }
  | {
      readonly error: {
        readonly code: string;
        readonly field?: string;
        readonly userMessage?: string;
      };
      readonly ok: false;
    };

type RequestBuilderContractModule = {
  readonly buildAssistantRequest: (
    input: Readonly<Record<string, unknown>>,
  ) => AssistantRequestBuildResult | Promise<AssistantRequestBuildResult>;
};

async function loadRequestBuilderContract() {
  const contract = await import("../../../packages/assistant-sdk/src/request/requestBuilder") as Partial<RequestBuilderContractModule>;

  expect(
    typeof contract.buildAssistantRequest,
    "requestBuilder.ts must export buildAssistantRequest.",
  ).toBe("function");

  return contract as RequestBuilderContractModule;
}

function containsField(value: unknown, field: string): boolean {
  if (typeof value === "function") {
    return true;
  }

  if (typeof value === "string") {
    return value.includes(field);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(item => containsField(item, field));
  }

  return Object.entries(value).some(([key, nestedValue]) => (
    key === field || containsField(nestedValue, field)
  ));
}

function expectSuccess(result: AssistantRequestBuildResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected core assistant contract request build success, got ${result.error.code}`);
  }

  return result.request;
}

describe("Frontend 002 core assistant contract compatibility profile request builder boundary", () => {
  it("builds a core assistant contract-compatible request without Frontend 002-only fields", async () => {
    const { buildAssistantRequest } = await loadRequestBuilderContract();

    // "backend001-compatibility" maps to the core assistant contract compatibility profile.
    const request = expectSuccess(await buildAssistantRequest(createCoreAssistantRequestBuilderInput()));

    expect(containsField(request, "message"), "Core assistant contract request must keep message text as a public contract field.").toBe(true);

    for (const field of forbiddenRequestBuilderFields) {
      expect(
        containsField(request, field),
        `Core assistant contract request must not contain ${field}`,
      ).toBe(false);
    }
  });

  it("does not serialize integration mode as a backend request mode", async () => {
    const { buildAssistantRequest } = await loadRequestBuilderContract();

    const request = expectSuccess(await buildAssistantRequest(createCoreAssistantRequestBuilderInput()));

    expect(containsField(request, "backend001-compatibility")).toBe(false);
    expect(containsField(request, "backend002")).toBe(false);
    expect(containsField(request, "backend request mode")).toBe(false);
  });

  it("does not inject local-only context into hidden prompt or message text", async () => {
    const { buildAssistantRequest } = await loadRequestBuilderContract();

    const request = expectSuccess(await buildAssistantRequest(createCoreAssistantRequestBuilderInput()));

    expect(containsField(request, "hiddenPrompt")).toBe(false);
    expect(containsField(request, "Use sourceSystem")).toBe(false);
    expect(containsField(request, "Use connectorId")).toBe(false);
    expect(containsField(request, "Use token")).toBe(false);
  });

  it("builds a Gateway-v1 message request without a session or Backend002 authority fields", async () => {
    const { buildAssistantRequest } = await loadRequestBuilderContract();
    const input = createBackend002RequestBuilderInput();
    const request = expectSuccess(await buildAssistantRequest({
      ...input,
      integrationMode: "gateway-v1",
    }));

    expect(request).toEqual({
      message: "Summarize this order",
      pageContext: input.hostContext.pageContext,
    });
    expect(JSON.stringify(request)).not.toMatch(/sessionId|actorId|organizationId|hostApp|customerId|integrationId|role|permissionScopes|token|credential|authorization/i);
  });
});
