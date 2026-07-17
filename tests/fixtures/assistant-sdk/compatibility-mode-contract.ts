export const compatibilityMode = "backend001-compatibility";

export const requiredCompatibilityChatFlowSteps = [
  "session-created",
  "message-sent",
  "history-loaded",
  "sse-streamed",
] as const;

export const requiredCompatibilityRenderingOutcomes = [
  "answered",
  "evidence-rendered",
  "feedback-submitted",
  "no-answer",
  "clarification-required",
  "permission-denied",
  "tool-failure",
] as const;

export const requiredReferenceConsumerReadinessSignals = [
  "@internal-ai-assistant/assistant-sdk",
  "@internal-ai-assistant/assistant-sdk/styles.css",
  "AssistantWidget",
  "mountAssistantWidget",
  "provider",
  "configuration",
  "callbacks",
  "backend001-compatibility",
  "selectedRows",
  "pageContext",
] as const;

export const forbiddenCompatibilityModeFields = [
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

export const forbiddenReferenceConsumerReadinessImports = [
  "packages/assistant-sdk/src/",
  "packages/assistant-sdk/src/runtime/",
  "packages/assistant-sdk/src/transport/",
  "packages/assistant-sdk/src/session/",
  "packages/assistant-sdk/src/events/",
  "packages/assistant-sdk/src/request/",
  "app/features/assistant/",
  "app/services/api/assistant",
  "app/stores/",
  "app/utils/assistant/",
] as const;

export function containsForbiddenCompatibilityModeField(value: unknown): string | null {
  if (typeof value === "function") {
    return "function";
  }

  if (typeof value === "string") {
    return forbiddenCompatibilityModeFields.find(field => value.includes(field)) ?? null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = containsForbiddenCompatibilityModeField(item);
      if (found) {
        return found;
      }
    }

    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if ((forbiddenCompatibilityModeFields as readonly string[]).includes(key)) {
      return key;
    }

    const found = containsForbiddenCompatibilityModeField(nestedValue);
    if (found) {
      return found;
    }
  }

  return null;
}
