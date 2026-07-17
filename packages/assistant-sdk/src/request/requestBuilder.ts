import { buildCoreAssistantRequest } from "./coreAssistantRequestAdapter";
import { buildHostIntegrationRequest } from "./hostIntegrationRequestAdapter";
import { assertOutgoingRequestSafe } from "./outgoingRequestBoundary";
import type { AssistantRequestBuildInput, AssistantRequestBuildResult } from "./types";
import { createRequestBuildError } from "../types/safeErrors";

function toBuildInput(input: Readonly<Record<string, unknown>>): AssistantRequestBuildInput {
  return input;
}

function ensureOutgoingRequestSafe(
  result: AssistantRequestBuildResult,
): AssistantRequestBuildResult {
  if (!result.ok) {
    return result;
  }

  const safety = assertOutgoingRequestSafe({
    body: result.request,
    callbackPayload: {},
    headers: {},
    hiddenPrompt: undefined,
    messageText: typeof result.request.message === "string" ? result.request.message : undefined,
    pageContext: result.request.pageContext,
    transportMetadata: {},
  });

  if (!safety.ok) {
    return {
      error: createRequestBuildError(safety.error.code, {
        field: safety.error.field,
        surface: safety.error.surface,
        userMessage: "integration error",
      }),
      ok: false,
    };
  }

  return result;
}

export function buildAssistantRequest(
  input: Readonly<Record<string, unknown>>,
): AssistantRequestBuildResult {
  const buildInput = toBuildInput(input);

  // Current public mode values map to internal request contract profiles.
  if (buildInput.integrationMode === "backend001-compatibility") {
    return ensureOutgoingRequestSafe(buildCoreAssistantRequest(buildInput));
  }

  if (buildInput.integrationMode === "backend002") {
    return ensureOutgoingRequestSafe(buildHostIntegrationRequest(buildInput));
  }

  return {
    error: createRequestBuildError("invalid_integration_mode", {
      userMessage: "integration error",
    }),
    ok: false,
  };
}
