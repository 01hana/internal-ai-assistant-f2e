import { createSessionNamespaceInput } from "./session-fallback-fixtures";

export const identityProofForbiddenFields = [
  "connectorId",
  "permissionResult",
  "rawEvidence",
  "sourceSystem",
  "token",
] as const;

export function createOrganizationIsolationInputs() {
  return {
    orgA: createSessionNamespaceInput({
      organizationId: "org-a",
    }),
    orgB: createSessionNamespaceInput({
      organizationId: "org-b",
    }),
  };
}

export function createHostIsolationInputs() {
  return {
    erp: createSessionNamespaceInput({
      hostApp: "erp",
    }),
    mes: createSessionNamespaceInput({
      hostApp: "mes",
    }),
  };
}

export function createEntityIsolationInputs() {
  return {
    entityA: createSessionNamespaceInput({
      entityId: "order-001",
      entityType: "order",
    }),
    entityB: createSessionNamespaceInput({
      entityId: "invoice-001",
      entityType: "invoice",
    }),
  };
}

export function createSessionScopeIsolationInputs() {
  return {
    entityScope: createSessionNamespaceInput({
      sessionScope: "entity",
    }),
    pageScope: createSessionNamespaceInput({
      sessionScope: "page",
    }),
  };
}

export function createSessionScopeLeakSurfaces() {
  return {
    body: { sessionScope: "entity" },
    callbackPayload: { sessionScope: "entity" },
    headers: { sessionScope: "entity" },
    hiddenPrompt: "sessionScope=entity",
    messageText: "Use sessionScope=entity",
    pageContext: { sessionScope: "entity" },
    transportMetadata: { sessionScope: "entity" },
  };
}
