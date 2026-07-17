import { findForbiddenRequestField } from "../request/requestSafety";

type SessionNamespaceInput = Readonly<Record<string, unknown>>;

type SessionNamespaceResult =
  | {
      readonly namespace: string;
      readonly ok: true;
    }
  | {
      readonly error: {
        readonly code: string;
        readonly field?: string;
      };
      readonly ok: false;
    };

const requiredNamespaceFields = [
  "packageMajor",
  "hostApp",
  "organizationId",
  "sessionScope",
  "pageIdentity",
  "entityType",
  "entityId",
] as const;

const allowedNamespaceFields = new Set<string>(requiredNamespaceFields);
const allowedSessionScopes = new Set(["entity", "page"]);

function namespaceError(code: string, field?: string): SessionNamespaceResult {
  return {
    error: {
      code,
      field,
    },
    ok: false,
  };
}

function getRequiredString(input: SessionNamespaceInput, field: typeof requiredNamespaceFields[number]) {
  const value = input[field];

  return typeof value === "string" && value.trim() ? value : undefined;
}

function findForbiddenExtraField(input: SessionNamespaceInput) {
  for (const [field, value] of Object.entries(input)) {
    if (allowedNamespaceFields.has(field)) {
      continue;
    }

    const match = findForbiddenRequestField({ [field]: value });
    if (match) {
      return match.field;
    }
  }

  return undefined;
}

export function createSessionNamespace(input: SessionNamespaceInput): SessionNamespaceResult {
  const forbiddenField = findForbiddenExtraField(input);
  if (forbiddenField) {
    return namespaceError("forbidden_session_namespace_field", forbiddenField);
  }

  const values = requiredNamespaceFields.map(field => [field, getRequiredString(input, field)] as const);
  const missing = values.find(([, value]) => !value);

  if (missing) {
    return namespaceError("missing_session_namespace_field", missing[0]);
  }

  const scopeValue = values.find(([field]) => field === "sessionScope")?.[1];
  if (!scopeValue || !allowedSessionScopes.has(scopeValue)) {
    return namespaceError("invalid_session_scope", "sessionScope");
  }

  const parts = values.map(([, value]) => value as string);

  return {
    namespace: parts.join(":"),
    ok: true,
  };
}
