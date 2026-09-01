import { sanitizePageContextForRequest } from "./pageContext";
import type { AssistantRequestBuildInput, AssistantRequestBuildResult } from "./types";
import { createRequestBuildError } from "../types/safeErrors";
import { isPlainObject } from "./requestSafety";

function readPageContext(input: AssistantRequestBuildInput): unknown {
  if (isPlainObject(input.hostContext) && "pageContext" in input.hostContext) {
    return input.hostContext.pageContext;
  }

  return undefined;
}

export function buildCoreAssistantRequest(
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

  const request: Record<string, unknown> = {
    message: input.message,
  };

  if (typeof input.sessionId === "string" && input.sessionId.length > 0) {
    request.sessionId = input.sessionId;
  }

  const pageContext = readPageContext(input);

  if (pageContext !== undefined) {
    const sanitizedPageContext = sanitizePageContextForRequest(pageContext);

    if (!sanitizedPageContext.ok) {
      return {
        error: createRequestBuildError(sanitizedPageContext.error.code, {
          field: sanitizedPageContext.error.field,
          userMessage: "integration error",
        }),
        ok: false,
      };
    }

    request.pageContext = sanitizedPageContext.pageContext;
  }

  return {
    ok: true,
    request,
  };
}

/** Gateway-v1 accepts only the message and the already-sanitized page context. */
export function buildGatewayAssistantRequest(
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

  const request: Record<string, unknown> = {
    message: input.message,
  };
  const pageContext = readPageContext(input);

  if (pageContext !== undefined) {
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

    request.pageContext = sanitizedPageContext.pageContext;
  }

  return {
    ok: true,
    request,
  };
}
