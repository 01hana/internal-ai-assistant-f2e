import {
  hostIntegrationMode,
  requiredHostIntegrationFailClosedCases,
  requiredHostIntegrationSafeOutcomes,
  requiredHostIntegrationSanitizedContextSignals,
} from "./host-integration-gated-contract";

const sanitizedPageContext = {
  route: "/admin/orders/ADMIN-SO-10001",
  screenId: "admin-orders-detail",
  entityType: "order",
  entityId: "ADMIN-SO-10001",
  selectedRows: [
    {
      id: "ADMIN-SO-10001",
      selected: true,
    },
  ],
} as const;

export function createHostIntegrationFailClosedFixture() {
  return {
    integrationMode: hostIntegrationMode,
    cases: requiredHostIntegrationFailClosedCases.map(name => ({
      name,
      requestSent: false,
      transportExecuted: false,
      safeOutcome: "context-resolution-failed",
      diagnostics: [
        {
          code: "context-resolution-failed",
          reason: `safe failure for ${name}`,
        },
      ],
    })),
    compatibilityFallbackUsed: false,
    outgoingSurfaces: [],
  } as const;
}

export function createHostIntegrationSanitizedContextFixture() {
  return {
    integrationMode: hostIntegrationMode,
    contextSignals: [...requiredHostIntegrationSanitizedContextSignals],
    sanitizedPageContext,
    outgoingRequest: {
      integrationMode: hostIntegrationMode,
      message: "Summarize this order status.",
      pageContext: sanitizedPageContext,
    },
    selectedRowsUsedAsIdentityProof: false,
    hiddenPrompt: undefined,
    messageText: "Summarize this order status.",
    localOnlySurfaces: [
      {
        surface: "provider",
        state: "resolved",
      },
      {
        surface: "callbacks",
        names: ["onContextResolved", "onSafeOutcome"],
      },
    ],
  } as const;
}

export function createHostIntegrationSafeOutcomesFixture() {
  return {
    integrationMode: hostIntegrationMode,
    outcomes: [...requiredHostIntegrationSafeOutcomes],
    renderedSurfaces: [
      {
        type: "clarification",
        messageId: "message-clarification-001",
        question: "Which order should I inspect?",
      },
      {
        type: "permission_denied",
        messageId: "message-denied-001",
        reason: "You do not have access to this order.",
      },
      {
        type: "tool_failure",
        messageId: "message-tool-failure-001",
        code: "tool_unavailable",
      },
      {
        type: "evidence",
        evidenceRefs: [
          {
            id: "safe-evidence-001",
            label: "Order status policy",
          },
        ],
      },
    ],
    safeMetadata: [
      {
        type: "backend-derived-source-metadata",
        label: "Order service",
        safe: true,
      },
    ],
    hiddenRawFields: [
      {
        hiddenField: "rawEvidence",
        reason: "raw evidence is backend-owned and must not be rendered",
        rawEvidence: "[hidden]",
      },
    ],
    approvalNavigationGeneratedByFrontend: false,
    frontendSourceInferenceUsed: false,
    reusesCanonicalRenderingRuntime: true,
    sseFinalOutcome: {
      event: "safe_outcome",
      data: {
        type: "permission_denied",
        messageId: "message-denied-001",
        safe: true,
      },
    },
  } as const;
}
