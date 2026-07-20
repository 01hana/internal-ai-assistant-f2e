export const hostIntegrationMode = "backend002";

export const requiredHostIntegrationFailClosedCases = [
  "missing-organization",
  "missing-identity",
  "missing-permission-context",
  "stale-provider-context",
  "selected-rows-over-limit",
  "mixed-authorized-selected-rows",
] as const;

export const requiredHostIntegrationSanitizedContextSignals = [
  "sanitized-page-context",
  "selected-rows-within-limit",
  "route-context",
  "screen-context",
  "entity-context",
  "no-hidden-prompt-injection",
  "no-message-text-injection",
] as const;

export const requiredHostIntegrationSafeOutcomes = [
  "clarification",
  "permission_denied",
  "tool_failure",
  "permission_safe_evidence",
  "backend_derived_source_metadata",
  "sse_final_safe_outcome",
] as const;

export const forbiddenHostIntegrationFrontendFields = [
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
  "displayUrl",
  "token",
  "accessToken",
  "refreshToken",
  "credential",
  "secret",
  "hostContext",
  "sessionScope",
] as const;

export function containsForbiddenHostIntegrationFrontendField(value: unknown): string | null {
  if (typeof value === "function") {
    return "function";
  }

  if (typeof value === "string") {
    return forbiddenHostIntegrationFrontendFields.find(field => value.includes(field)) ?? null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = containsForbiddenHostIntegrationFrontendField(item);
      if (found) {
        return found;
      }
    }

    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if ((forbiddenHostIntegrationFrontendFields as readonly string[]).includes(key)) {
      return key;
    }

    const found = containsForbiddenHostIntegrationFrontendField(nestedValue);
    if (found) {
      return found;
    }
  }

  return null;
}
