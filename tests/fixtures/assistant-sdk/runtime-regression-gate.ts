export type RuntimeRegressionGateEntry = {
  readonly category: string;
  readonly command: string;
  readonly paths: readonly string[];
  readonly required: boolean;
  readonly status: "present" | "missing";
  readonly missingReason?: string;
};

export const requiredRuntimeRegressionCategories = [
  "ChatWidget mount/render behavior",
  "assistant session creation",
  "assistant message send",
  "assistant history load",
  "SSE token/done/no_answer/approval_required/tool_failure/timeout/interrupted parsing",
  "AnswerDecision rendering",
  "EvidenceRef rendering",
  "feedback flow",
  "ActionDraft confirmation display",
  "ApprovalRequest display behavior",
  "retry / cancel / interrupted behavior",
  "session lifecycle cleanup",
] as const;

export const runtimeRegressionGate: readonly RuntimeRegressionGateEntry[] = [
  {
    category: "ChatWidget mount/render behavior",
    command: "npm run test:component -- ChatWidget.shell",
    paths: ["tests/component/assistant/ChatWidget.shell.spec.ts"],
    required: true,
    status: "present",
  },
  {
    category: "assistant session creation",
    command: "npm run test:contract -- assistant-service",
    paths: ["tests/contract/assistant/assistant-service.spec.ts"],
    required: true,
    status: "present",
  },
  {
    category: "assistant message send",
    command: "npm run test:contract -- send-message",
    paths: [
      "tests/contract/assistant/send-message.contract.spec.ts",
      "tests/component/assistant/send-message-streaming.spec.ts",
    ],
    required: true,
    status: "present",
  },
  {
    category: "assistant history load",
    command: "npm run test:contract -- session-history",
    paths: [
      "tests/contract/assistant/session-history.contract.spec.ts",
      "tests/component/assistant/session-history.spec.ts",
    ],
    required: true,
    status: "present",
  },
  {
    category: "SSE token/done/no_answer/approval_required/tool_failure/timeout/interrupted parsing",
    command: "npm run test:unit -- sse-parser",
    paths: [
      "tests/unit/assistant/sse-parser.spec.ts",
      "tests/unit/assistant/sse-stream.spec.ts",
    ],
    required: true,
    status: "present",
  },
  {
    category: "AnswerDecision rendering",
    command: "npm run test:unit -- message-renderer-resolver",
    paths: [
      "tests/unit/assistant/message-renderer-resolver.spec.ts",
      "tests/component/assistant/answer-evidence.spec.ts",
    ],
    required: true,
    status: "present",
  },
  {
    category: "EvidenceRef rendering",
    command: "npm run test:component -- answer-evidence",
    paths: [
      "tests/component/assistant/answer-evidence.spec.ts",
      "tests/unit/assistant/answer-evidence.spec.ts",
    ],
    required: true,
    status: "present",
  },
  {
    category: "feedback flow",
    command: "npm run test:unit -- feedback",
    paths: [
      "tests/unit/assistant/feedback.spec.ts",
      "tests/component/assistant/feedback-controls.spec.ts",
    ],
    required: true,
    status: "present",
  },
  {
    category: "ActionDraft confirmation display",
    command: "npm run test:component -- action-draft",
    paths: [
      "tests/component/assistant/action-draft.spec.ts",
      "tests/unit/assistant/action-draft-state.spec.ts",
    ],
    required: true,
    status: "present",
  },
  {
    category: "ApprovalRequest display behavior",
    command: "npm run test:component -- approval-request",
    paths: [
      "tests/component/assistant/approval-request.spec.ts",
      "tests/contract/assistant/approval-request.contract.spec.ts",
    ],
    required: true,
    status: "present",
  },
  {
    category: "retry / cancel / interrupted behavior",
    command: "npm run test:unit -- retry-context",
    paths: [
      "tests/unit/assistant/retry-context.spec.ts",
      "tests/component/assistant/send-message-streaming.spec.ts",
    ],
    required: true,
    status: "present",
  },
  {
    category: "session lifecycle cleanup",
    command: "npm run test:unit -- session-restore",
    paths: [
      "tests/unit/assistant/session-restore.spec.ts",
      "tests/component/assistant/session-history.spec.ts",
    ],
    required: true,
    status: "present",
  },
] as const;
