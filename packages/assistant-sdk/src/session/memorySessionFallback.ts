import { findForbiddenRequestField } from "../request/requestSafety";

type MemoryFallbackResult =
  | {
      readonly ok: true;
      readonly persistence: "memory";
      readonly sessionId?: string;
    }
  | {
      readonly error: {
        readonly code: string;
        readonly field?: string;
      };
      readonly ok: false;
    };

function failure(code: string, field?: string): MemoryFallbackResult {
  return {
    error: {
      code,
      field,
    },
    ok: false,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function safeString(value: unknown, field: "namespace" | "sessionId"): MemoryFallbackResult | string {
  if (!isNonEmptyString(value)) {
    return failure(field === "sessionId" ? "missing_session_id" : "missing_session_namespace", field);
  }

  const forbidden = findForbiddenRequestField(value);
  if (forbidden) {
    return failure("forbidden_memory_session_field", forbidden.field);
  }

  return value;
}

export function createMemorySessionFallback() {
  const sessions = new Map<string, string>();

  return {
    get(namespace: string): MemoryFallbackResult {
      const safeNamespace = safeString(namespace, "namespace");
      if (typeof safeNamespace !== "string") {
        return safeNamespace;
      }

      const sessionId = sessions.get(safeNamespace);
      if (!sessionId) {
        return failure("memory_session_not_found", "namespace");
      }

      return {
        ok: true,
        persistence: "memory",
        sessionId,
      };
    },
    set(namespace: string, sessionId: string): MemoryFallbackResult {
      const safeNamespace = safeString(namespace, "namespace");
      if (typeof safeNamespace !== "string") {
        return safeNamespace;
      }
      const safeSessionId = safeString(sessionId, "sessionId");
      if (typeof safeSessionId !== "string") {
        return safeSessionId;
      }

      sessions.set(safeNamespace, safeSessionId);

      return {
        ok: true,
        persistence: "memory",
        sessionId: safeSessionId,
      };
    },
  };
}
