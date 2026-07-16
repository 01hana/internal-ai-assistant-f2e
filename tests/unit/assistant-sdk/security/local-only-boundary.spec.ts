import { describe, expect, it } from "vitest";
import {
  forbiddenOutgoingFields,
  localOnlyFields,
  secretLikeFields,
} from "../../../fixtures/assistant-sdk/forbidden-fields";
import {
  createLeakyHostCallbacksInput,
  createLeakyHostContextInput,
  createLeakySurfaceInput,
  createLeakyWidgetConfigurationInput,
  serializationSurfaces,
  type SerializationSurfaceMap,
} from "../../../fixtures/assistant-sdk/local-only-boundary-fixtures";

type BoundarySanitizationResult =
  | {
      readonly ok: true;
      readonly context: Readonly<Record<string, unknown>>;
      readonly diagnostics: readonly { readonly field: string; readonly action: string }[];
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly field?: string;
        readonly userMessage?: string;
      };
      readonly diagnostics?: readonly { readonly field: string; readonly action: string }[];
    };

type ContextResolutionContractModule = {
  readonly sanitizeHostContextForRequest: (
    input: Readonly<Record<string, unknown>>,
  ) => BoundarySanitizationResult | Promise<BoundarySanitizationResult>;
  readonly assertLocalOnlyFieldsAbsent: (
    surfaces: SerializationSurfaceMap,
  ) => BoundarySanitizationResult | Promise<BoundarySanitizationResult>;
};

async function loadContextResolutionContract() {
  return await import("../../../../packages/assistant-sdk/src/context/contextResolution") as ContextResolutionContractModule;
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

function expectFailure(result: BoundarySanitizationResult) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected local-only boundary failure");
  }

  return result;
}

describe("Frontend 002 local-only serialization boundary", () => {
  it("omits WidgetConfiguration fields from sanitized host context and reports diagnostics", async () => {
    const { sanitizeHostContextForRequest } = await loadContextResolutionContract();

    const result = await sanitizeHostContextForRequest(createLeakyWidgetConfigurationInput());

    for (const field of [
      "theme",
      "locale",
      "position",
      "size",
      "zIndex",
      "launcher",
      "featureFlags",
      "widgetConfiguration",
    ]) {
      if (result.ok) {
        expect(containsField(result.context, field), `${field} must be omitted`).toBe(false);
        expect(result.diagnostics.some(diagnostic => diagnostic.field === field)).toBe(true);
      }
      else {
        expect(result.diagnostics?.some(diagnostic => diagnostic.field === field)).toBe(true);
      }
    }
  });

  it("omits HostCallbacks and callback functions from sanitized host context", async () => {
    const { sanitizeHostContextForRequest } = await loadContextResolutionContract();

    const result = await sanitizeHostContextForRequest(createLeakyHostCallbacksInput());

    for (const field of [
      "hostCallbacks",
      "callbacks",
      "callback",
      "onOpened",
      "onClosed",
      "onError",
      "onApprovalDetailRequested",
    ]) {
      if (result.ok) {
        expect(containsField(result.context, field), `${field} must be omitted`).toBe(false);
      }
      else {
        expect(result.diagnostics?.some(diagnostic => diagnostic.field === field)).toBe(true);
      }
    }
  });

  it("fails closed for credential-like fields in provider context", async () => {
    const { sanitizeHostContextForRequest } = await loadContextResolutionContract();

    for (const field of [
      ...secretLikeFields,
      "apiKey",
      "connectionString",
    ]) {
      const result = await sanitizeHostContextForRequest({
        hostApp: "erp",
        pageContext: { route: "/orders" },
        [field]: "secret-value",
      });

      const failure = expectFailure(result);
      expect(failure.error).toMatchObject({ code: "forbidden_host_context_field" });
      expect(failure.error.field).toBe(field);
    }
  });

  it("fails closed for backend-owned authority fields in provider context", async () => {
    const { sanitizeHostContextForRequest } = await loadContextResolutionContract();

    for (const field of forbiddenOutgoingFields) {
      const result = await sanitizeHostContextForRequest({
        hostApp: "erp",
        pageContext: { route: "/orders" },
        [field]: "frontend-owned-value",
      });

      const failure = expectFailure(result);
      expect(failure.error).toMatchObject({ code: "forbidden_host_context_field" });
      expect(failure.error.field).toBe(field);
    }
  });

  it("omits or rejects declared local-only fields before any outgoing surface exists", async () => {
    const { sanitizeHostContextForRequest } = await loadContextResolutionContract();
    const result = await sanitizeHostContextForRequest(createLeakyHostContextInput());

    if (result.ok) {
      for (const field of localOnlyFields) {
        expect(containsField(result.context, field), `${field} must not survive sanitization`).toBe(false);
      }
    }
    else {
      expect(result.error.code).toBe("forbidden_host_context_field");
    }
  });

  it("rejects forbidden fields across backend body, headers, PageContext, prompt, message, metadata, and callback payload", async () => {
    const { assertLocalOnlyFieldsAbsent } = await loadContextResolutionContract();

    const result = await assertLocalOnlyFieldsAbsent(createLeakySurfaceInput());

    const failure = expectFailure(result);
    expect(failure.error).toMatchObject({ code: "forbidden_serialization_field" });
  });

  it("reports the exact outgoing surface that contains a forbidden field", async () => {
    const { assertLocalOnlyFieldsAbsent } = await loadContextResolutionContract();
    const surfaces = createLeakySurfaceInput();

    for (const surface of serializationSurfaces) {
      const result = await assertLocalOnlyFieldsAbsent({
        ...Object.fromEntries(serializationSurfaces.map(name => [name, {}])),
        [surface]: surfaces[surface],
      } as SerializationSurfaceMap);

      const failure = expectFailure(result);
      expect(failure.error).toMatchObject({ code: "forbidden_serialization_field" });
    }
  });
});
