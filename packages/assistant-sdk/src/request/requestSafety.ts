export type PrimitiveValue = string | number | boolean | null;

export interface FieldMatch {
  readonly field: string;
}

const localOnlyFieldNames = [
  "hostContext",
  "sessionScope",
  "widgetConfiguration",
  "hostCallbacks",
  "hostEvents",
  "localUiState",
  "transportMetadata",
  "callback",
  "callbacks",
  "callbackPayload",
  "hiddenPrompt",
  "messageText",
  "onOpened",
  "onClosed",
  "onError",
  "onApprovalDetailRequested",
] as const;

const secretLikeFieldNames = [
  "token",
  "accessToken",
  "refreshToken",
  "credential",
  "secret",
  "apiKey",
  "connectionString",
] as const;

const backendAuthorityFieldNames = [
  "sourceSystem",
  "connector",
  "connectorId",
  "adapter",
  "adapterId",
  "dataSource",
  "candidateTool",
  "candidateTools",
  "toolName",
  "permissionResult",
  "fieldPermissionResult",
  "rowPermissionResult",
  "finalEvidenceSource",
  "rawEvidence",
  "rawConnectorPayload",
  "routingHint",
  "routingHints",
  "approvalNavigation",
  "approvalNavigationMetadata",
  "approvalUrl",
  "navigationUrl",
] as const;

export const forbiddenRequestFieldNames = [
  ...localOnlyFieldNames,
  ...secretLikeFieldNames,
  ...backendAuthorityFieldNames,
] as const;

export function isPrimitiveValue(value: unknown): value is PrimitiveValue {
  return (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value))
  );
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

export function isForbiddenRequestField(field: string): boolean {
  return (forbiddenRequestFieldNames as readonly string[]).includes(field);
}

function stringContainsForbiddenField(value: string, field: string): boolean {
  return new RegExp(`\\b${field}\\b`).test(value);
}

export function findForbiddenRequestField(
  value: unknown,
  visited = new WeakSet<object>(),
): FieldMatch | undefined {
  if (typeof value === "function") {
    return { field: "callback" };
  }

  if (typeof value === "string") {
    const field = forbiddenRequestFieldNames.find(candidate => stringContainsForbiddenField(value, candidate));

    return field ? { field } : undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (visited.has(value)) {
    return undefined;
  }
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findForbiddenRequestField(item, visited);
      if (match) {
        return match;
      }
    }

    return undefined;
  }

  for (const [field, nestedValue] of Object.entries(value)) {
    if (isForbiddenRequestField(field)) {
      return { field };
    }

    const match = findForbiddenRequestField(nestedValue, visited);
    if (match) {
      return match;
    }
  }

  return undefined;
}
