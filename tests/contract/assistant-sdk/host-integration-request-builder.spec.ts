import { describe, expect, it } from "vitest";
import {
  createBackend002ForbiddenAuthorityInput as createHostIntegrationForbiddenAuthorityInput,
  createBackend002MissingContextInput as createHostIntegrationMissingContextInput,
  createBackend002RequestBuilderInput as createHostIntegrationRequestBuilderInput,
  forbiddenRequestBuilderFields,
} from "../../fixtures/assistant-sdk/request-builder-fixtures";
import { forbiddenOutgoingFields } from "../../fixtures/assistant-sdk/forbidden-fields";

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
    throw new Error(`Expected host integration contract request build success, got ${result.error.code}`);
  }

  return result.request;
}

function expectFailure(result: AssistantRequestBuildResult) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected host integration contract request build failure");
  }

  return result.error;
}

describe("Frontend 002 host integration contract profile request builder boundary", () => {
  it("fails closed when required host integration context is missing", async () => {
    const { buildAssistantRequest } = await loadRequestBuilderContract();

    const error = expectFailure(await buildAssistantRequest(createHostIntegrationMissingContextInput()));

    expect(error.code).toMatch(/missing_required_context|context_unavailable|integration_error/);
    expect(error.userMessage ?? "context unavailable").toMatch(/context unavailable|integration error/);
  });

  it("builds a safe request from complete sanitized context", async () => {
    const { buildAssistantRequest } = await loadRequestBuilderContract();

    // "backend002" maps to the host integration contract profile.
    const request = expectSuccess(await buildAssistantRequest(createHostIntegrationRequestBuilderInput()));

    expect(containsField(request, "hostApp")).toBe(true);
    expect(containsField(request, "actorId")).toBe(true);
    expect(containsField(request, "organizationId")).toBe(true);
    expect(containsField(request, "pageContext")).toBe(true);

    for (const field of forbiddenRequestBuilderFields) {
      expect(
        containsField(request, field),
        `Host integration contract request must not contain frontend-owned or local-only ${field}`,
      ).toBe(false);
    }
  });

  it("does not invent source, connector, permission, routing, or evidence authority", async () => {
    const { buildAssistantRequest } = await loadRequestBuilderContract();

    const request = expectSuccess(await buildAssistantRequest(createHostIntegrationRequestBuilderInput()));

    for (const field of forbiddenOutgoingFields) {
      expect(containsField(request, field), `Host integration contract request must not invent ${field}`).toBe(false);
    }
  });

  it("fails closed when provider context contains frontend-provided backend authority fields", async () => {
    const { buildAssistantRequest } = await loadRequestBuilderContract();

    for (const field of [
      "sourceSystem",
      "connectorId",
      "adapterId",
      "permissionResult",
      "rawEvidence",
      "rawConnectorPayload",
      "approvalNavigationMetadata",
    ]) {
      const error = expectFailure(await buildAssistantRequest(createHostIntegrationForbiddenAuthorityInput(field)));

      expect(error.code).toMatch(/forbidden|invalid|context/);
      expect(error.field ?? field).toBe(field);
    }
  });
});
