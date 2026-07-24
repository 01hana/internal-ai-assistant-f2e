import {
  compatibilityMode,
  requiredCompatibilityChatFlowSteps,
  requiredCompatibilityRenderingOutcomes,
  requiredReferenceConsumerReadinessSignals,
} from "./compatibility-mode-contract";

export function createCompatibilityChatFlowFixture() {
  return {
    flowSteps: [...requiredCompatibilityChatFlowSteps],
    integrationMode: compatibilityMode,
    requests: [
      {
        operation: "create-session",
        requestId: "request-001",
      },
      {
        message: "Show the latest assistant status for this order.",
        operation: "send-message",
        sessionId: "session-001",
      },
      {
        operation: "load-history",
        sessionId: "session-001",
      },
    ],
    sseEvents: [
      {
        data: {
          text: "Hello",
        },
        event: "message-delta",
      },
      {
        data: {
          messageId: "message-001",
        },
        event: "message-complete",
      },
      {
        data: {
          reason: "insufficient_context",
        },
        event: "no_answer",
      },
      {
        data: {
          approvalRequestId: "approval-001",
          messageId: "message-001",
        },
        event: "approval_required",
      },
      {
        data: {
          code: "tool_unavailable",
        },
        event: "tool_failure",
      },
      {
        data: {
          code: "timeout",
        },
        event: "timeout",
      },
      {
        data: {
          reason: "cancelled",
        },
        event: "interrupted",
      },
    ],
  } as const;
}

export function createCompatibilityRenderingFlowFixture() {
  return {
    integrationMode: compatibilityMode,
    renderedOutcomes: [...requiredCompatibilityRenderingOutcomes],
    renderingSurfaces: [
      {
        answerDecision: "answered",
        evidenceRefs: [
          {
            id: "evidence-001",
            label: "Order policy",
          },
        ],
        messageId: "message-001",
        type: "answer",
      },
      {
        messageId: "message-001",
        type: "feedback",
        value: "helpful",
      },
      {
        messageId: "message-002",
        question: "Which order should I inspect?",
        type: "clarification",
      },
      {
        code: "tool_unavailable",
        type: "failure",
      },
    ],
    reusedRuntimeOwners: [
      "app/utils/assistant/answerDecisionStateMapper.ts",
      "app/utils/assistant/assistantMessageRendererResolver.ts",
      "app/utils/assistant/evidenceNormalizationAdapter.ts",
    ],
  } as const;
}

export function createCompatibilityReferenceConsumerReadinessFixture() {
  return {
    backend002Required: false,
    imports: [
      "@ideaxpress/assistant-sdk",
      "@ideaxpress/assistant-sdk/styles.css",
    ],
    integrationMode: compatibilityMode,
    localOnlySurfaces: [
      {
        integrationMode: compatibilityMode,
        position: "bottom-right",
        surface: "configuration",
        theme: "system",
      },
      {
        names: ["onOpened", "onClosed", "onAnswerCompleted"],
        surface: "callbacks",
      },
    ],
    publicSignals: [...requiredReferenceConsumerReadinessSignals],
    sanitizedPageContext: {
      entityId: "order-001",
      entityType: "order",
      route: "/assistant-sdk-preview?entityId=order-001",
      screenId: "assistant-sdk-preview",
      selectedRows: [
        {
          id: "row-001",
          selected: true,
        },
      ],
    },
    sessionLifecycle: {
      cleanedUp: true,
      initialized: true,
    },
  } as const;
}
