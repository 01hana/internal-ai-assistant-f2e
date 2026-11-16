import { sanitizePageContextForRequest } from "./pageContext";
import type { AssistantRequestBuildInput, AssistantRequestBuildResult } from "./types";
import { createRequestBuildError } from "../types/safeErrors";
import { isPlainObject } from "./requestSafety";
import { isAssistantChoiceId } from "../../../assistant-runtime/src/experience";

function readPageContext(input: AssistantRequestBuildInput): unknown {
  if (isPlainObject(input.hostContext) && "pageContext" in input.hostContext) {
    return input.hostContext.pageContext;
  }

  return undefined;
}

/**
 * Exactly one of typed `message` or a server-declared `choiceId` (Backend Feature 013).
 * Both, neither, or a malformed choice ID is rejected before any request is built.
 */
function readMessageOrChoice(
  input: AssistantRequestBuildInput,
): { message: string } | { choiceId: string } | null {
  const hasMessage = input.message !== undefined;
  const hasChoice = input.choiceId !== undefined;

  if (hasMessage === hasChoice) {
    return null;
  }

  if (hasMessage) {
    return typeof input.message === "string" ? { message: input.message } : null;
  }

  return isAssistantChoiceId(input.choiceId) ? { choiceId: input.choiceId } : null;
}

export function buildCoreAssistantRequest(
  input: AssistantRequestBuildInput,
): AssistantRequestBuildResult {
  const content = readMessageOrChoice(input);

  if (!content) {
    return {
      error: createRequestBuildError("invalid_message", {
        userMessage: "integration error",
      }),
      ok: false,
    };
  }

  const request: Record<string, unknown> = { ...content };

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

/** Gateway-v1 accepts only the message or choice ID and the already-sanitized page context. */
export function buildGatewayAssistantRequest(
  input: AssistantRequestBuildInput,
): AssistantRequestBuildResult {
  const content = readMessageOrChoice(input);

  if (!content) {
    return {
      error: createRequestBuildError("invalid_message", {
        userMessage: "integration error",
      }),
      ok: false,
    };
  }

  const request: Record<string, unknown> = { ...content };
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
