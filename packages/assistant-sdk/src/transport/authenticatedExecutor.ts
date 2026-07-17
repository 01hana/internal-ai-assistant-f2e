import { findForbiddenRequestField } from "../request/requestSafety";
import { createTransportError, toTransportFailure } from "./transportErrors";
import type { SanitizedExecutionInput } from "./types";

type AuthenticatedExecutor = (input: SanitizedExecutionInput) => unknown | Promise<unknown>;

function isSanitizedExecutionInput(input: Readonly<Record<string, unknown>>): input is SanitizedExecutionInput {
  return (
    !!input.request
    && typeof input.request === "object"
    && !Array.isArray(input.request)
    && typeof input.requestId === "string"
    && typeof input.sessionId === "string"
  );
}

export function createAuthenticatedExecutorTransport(
  executor: unknown,
  _options: Readonly<Record<string, unknown>> = {},
) {
  async function execute(input: Readonly<Record<string, unknown>>): Promise<unknown> {
    const forbiddenMatch = findForbiddenRequestField(input);

    if (forbiddenMatch) {
      return createTransportError("forbidden_outgoing_request_field", {
        field: forbiddenMatch.field,
      });
    }

    if (typeof executor !== "function" || !isSanitizedExecutionInput(input)) {
      return toTransportFailure("transport_unavailable");
    }

    try {
      return await (executor as AuthenticatedExecutor)(input);
    }
    catch {
      return toTransportFailure("transport_execution_failed");
    }
  }

  return { execute } as const;
}
