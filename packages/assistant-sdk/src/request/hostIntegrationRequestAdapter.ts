import { sanitizePageContextForRequest } from "./pageContext";
import {
  findForbiddenRequestField,
  isPlainObject,
} from "./requestSafety";
import type { AssistantRequestBuildInput, AssistantRequestBuildResult } from "./types";
import { createRequestBuildError } from "../types/safeErrors";

function failMissingRequiredContext(field?: string): AssistantRequestBuildResult {
  return {
    error: createRequestBuildError("missing_required_context", {
      field,
      userMessage: "context unavailable",
    }),
    ok: false,
  };
}

export function buildHostIntegrationRequest(
  input: AssistantRequestBuildInput,
): AssistantRequestBuildResult {
  if (typeof input.message !== "string") {
    return {
      error: createRequestBuildError("invalid_message", {
        userMessage: "integration error",
      }),
      ok: false,
    };
  }

  if (!isPlainObject(input.hostContext)) {
    return failMissingRequiredContext("hostContext");
  }

  const forbiddenMatch = findForbiddenRequestField(input.hostContext);
  if (forbiddenMatch) {
    return {
      error: createRequestBuildError("forbidden_request_field", {
        field: forbiddenMatch.field,
        userMessage: "integration error",
      }),
      ok: false,
    };
  }

  const { actorId, hostApp, organizationId, pageContext, requestId, sessionId } = input.hostContext;

  if (typeof hostApp !== "string" || hostApp.length === 0) {
    return failMissingRequiredContext("hostApp");
  }

  if (typeof actorId !== "string" || actorId.length === 0) {
    return failMissingRequiredContext("actorId");
  }

  if (typeof organizationId !== "string" || organizationId.length === 0) {
    return failMissingRequiredContext("organizationId");
  }

  if (pageContext === undefined) {
    return failMissingRequiredContext("pageContext");
  }

  const sanitizedPageContext = sanitizePageContextForRequest(pageContext);
  if (!sanitizedPageContext.ok) {
    return {
      error: createRequestBuildError(sanitizedPageContext.error.code, {
        field: sanitizedPageContext.error.field,
        userMessage: "context unavailable",
      }),
      ok: false,
    };
  }

  const request: Record<string, unknown> = {
    actorId,
    hostApp,
    message: input.message,
    organizationId,
    pageContext: sanitizedPageContext.pageContext,
  };

  if (typeof sessionId === "string" && sessionId.length > 0) {
    request.sessionId = sessionId;
  }

  if (typeof requestId === "string" && requestId.length > 0) {
    request.requestId = requestId;
  }

  return {
    ok: true,
    request,
  };
}
