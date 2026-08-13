import { findForbiddenRequestField } from "../request/requestSafety";

type FallbackResult =
  | {
      readonly ok: true;
      readonly persistence: "sessionStorage";
      readonly sessionId?: string;
    }
  | {
      readonly error: {
        readonly code: string;
        readonly field?: string;
      };
      readonly ok: false;
    };

type SessionStorageLike = {
  readonly getItem: (key: string) => string | null;
  readonly removeItem?: (key: string) => unknown;
  readonly setItem: (key: string, value: string) => unknown;
};

type FallbackInput = Readonly<Record<string, unknown>>;

function failure(code: string, field?: string): FallbackResult {
  return {
    error: {
      code,
      field,
    },
    ok: false,
  };
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function unsafeStringField(value: string) {
  return findForbiddenRequestField(value)?.field;
}

function safeString(value: unknown, field: string): string | FallbackResult {
  const stringValue = nonEmptyString(value);
  if (!stringValue) {
    return failure(field === "sessionId" ? "missing_session_id" : "missing_session_namespace", field);
  }

  const unsafeField = unsafeStringField(stringValue);
  if (unsafeField) {
    return failure("forbidden_session_fallback_field", unsafeField);
  }

  return stringValue;
}

export function createSessionStorageFallback(options: { readonly storage?: SessionStorageLike }) {
  const storage = options.storage;

  return {
    resolve(input: FallbackInput): FallbackResult {
      const hostSessionId = nonEmptyString(input.hostSessionId);
      if (hostSessionId) {
        const unsafeField = unsafeStringField(hostSessionId);
        if (unsafeField) {
          return failure("forbidden_session_fallback_field", unsafeField);
        }

        return {
          ok: true,
          persistence: "sessionStorage",
          sessionId: hostSessionId,
        };
      }

      const namespace = safeString(input.namespace, "namespace");
      if (typeof namespace !== "string") {
        return namespace;
      }

      if (!storage) {
        return failure("session_storage_unavailable");
      }

      try {
        const sessionId = storage.getItem(namespace);

        if (!sessionId) {
          return failure("session_fallback_not_found", "namespace");
        }

        return {
          ok: true,
          persistence: "sessionStorage",
          sessionId,
        };
      } catch {
        return failure("session_storage_unavailable");
      }
    },
    set(input: FallbackInput): FallbackResult {
      const namespace = safeString(input.namespace, "namespace");
      if (typeof namespace !== "string") {
        return namespace;
      }
      const sessionId = safeString(input.sessionId, "sessionId");
      if (typeof sessionId !== "string") {
        return sessionId;
      }
      if (!storage) {
        return failure("session_storage_unavailable");
      }

      try {
        storage.setItem(namespace, sessionId);

        return {
          ok: true,
          persistence: "sessionStorage",
          sessionId,
        };
      } catch {
        return failure("session_storage_unavailable");
      }
    },
    clear(input: FallbackInput): FallbackResult {
      const namespace = safeString(input.namespace, "namespace");
      if (typeof namespace !== "string") {
        return namespace;
      }
      if (!storage?.removeItem) {
        return failure("session_storage_unavailable");
      }

      try {
        storage.removeItem(namespace);
        return {
          ok: true,
          persistence: "sessionStorage",
        };
      } catch {
        return failure("session_storage_unavailable");
      }
    },
  };
}
