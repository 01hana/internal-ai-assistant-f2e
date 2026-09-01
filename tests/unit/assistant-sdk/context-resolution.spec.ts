import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const contextResolutionSourcePath = path.join(repoRoot, "packages/assistant-sdk/src/context/contextResolution.ts");

type ContextResolutionModule = {
  readonly assertLocalOnlyFieldsAbsent: (surfaces: Readonly<Record<string, unknown>>) => {
    readonly error?: { readonly code: string; readonly field?: string };
    readonly ok: boolean;
  };
  readonly resolveHostContextForRequest: (input: {
    readonly integrationMode: "backend001-compatibility" | "backend002" | "gateway-v1";
    readonly operation: "send" | "retry";
    readonly provider: () => unknown | Promise<unknown>;
  }) => Promise<{
    readonly context?: Readonly<Record<string, unknown>>;
    readonly error?: { readonly code: string; readonly field?: string };
    readonly ok: boolean;
  }>;
  readonly sanitizeHostContextForRequest: (input: Readonly<Record<string, unknown>>) => {
    readonly context?: Readonly<Record<string, unknown>>;
    readonly diagnostics?: readonly { readonly action: string; readonly field: string }[];
    readonly error?: { readonly code: string; readonly field?: string };
    readonly ok: boolean;
  };
};

async function loadContextResolutionModule() {
  return await import("../../../packages/assistant-sdk/src/context/contextResolution") as ContextResolutionModule;
}

describe("SDK context resolution adapter boundary", () => {
  it("omits local-only provider fields while preserving sanitized request context", async () => {
    const { resolveHostContextForRequest } = await loadContextResolutionModule();
    const result = await resolveHostContextForRequest({
      integrationMode: "backend001-compatibility",
      operation: "send",
      provider: async () => ({
        callbacks: {
          onOpened: () => undefined,
        },
        hostApp: "erp",
        pageContext: {
          route: "/orders",
        },
        sessionScope: "entity:orders",
        widgetConfiguration: {
          theme: "dark",
        },
      }),
    });

    expect(result).toMatchObject({
      context: {
        hostApp: "erp",
        pageContext: {
          route: "/orders",
        },
      },
      ok: true,
    });
    expect(result.context).not.toHaveProperty("callbacks");
    expect(result.context).not.toHaveProperty("sessionScope");
    expect(result.context).not.toHaveProperty("widgetConfiguration");
  });

  it("fails closed when provider context contains backend authority, raw payload, URL, token, or secret fields", async () => {
    const { resolveHostContextForRequest } = await loadContextResolutionModule();
    const forbiddenFields = [
      "sourceSystem",
      "connector",
      "permissionResult",
      "rawEvidence",
      "rawConnectorPayload",
      "hiddenPrompt",
      "navigationUrl",
      "token",
      "credential",
      "secret",
    ];

    for (const field of forbiddenFields) {
      await expect(resolveHostContextForRequest({
        integrationMode: "backend001-compatibility",
        operation: "send",
        provider: async () => ({
          hostApp: "erp",
          pageContext: {
            route: "/orders",
          },
          [field]: "unsafe",
        }),
      })).resolves.toMatchObject({
        error: {
          code: "forbidden_host_context_field",
          field,
        },
        ok: false,
      });
    }
  });

  it("guards against local-only fields leaking through callback payloads or transport surfaces", async () => {
    const { assertLocalOnlyFieldsAbsent } = await loadContextResolutionModule();

    expect(assertLocalOnlyFieldsAbsent({
      callbackPayload: {
        approvalNavigation: "/approval/approval-001",
      },
    })).toMatchObject({
      error: {
        code: "forbidden_serialization_field",
        field: "approvalNavigation",
      },
      ok: false,
    });
  });

  it("does not own backend request building, public request envelopes, app source, or runtime behavior", () => {
    const source = readFileSync(contextResolutionSourcePath, "utf8");

    expect(source).not.toMatch(/buildAssistantRequest|assertOutgoingRequestSafe|requestEnvelope|backendRoute/);
    expect(source).not.toMatch(/app\/(?:features|services|stores|utils)/);
    expect(source).not.toMatch(/parseAssistantSse|createAssistantSseStreamRunner|getReader|ReadableStream/);
    expect(source).not.toMatch(/createAssistantRuntimeController|createAssistantRuntimeStores|defineStore|createPinia/);
    expect(source).not.toMatch(/sourceSystem\s*[:=]|connectorId\s*[:=]|permissionResult\s*[:=]|rawEvidence\s*[:=]|hiddenPrompt\s*[:=]/);
  });
});
