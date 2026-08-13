import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTION_DRAFT_PENDING_GUARD_MESSAGE,
  createAssistantRuntimeController,
  createAssistantRuntimeStores,
  createAssistantStreamingRuntimeMessage,
  createTerminalOutcome,
  createUserRuntimeMessage,
  type ActionDraftDetailState,
  type ActionDraftOperationStatus,
  type ActionDraftStatus,
  type AnswerDecisionUiState,
  type ApprovalRequestDetailState,
  type ApprovalRequestSummary,
  type AssistantFeedbackValue,
  type AssistantMessageId,
  type AssistantRequestId,
  type AssistantRuntimeController,
  type AssistantRuntimeSafeOutcomeKind,
  type AssistantRuntimeStoreScope,
  type AssistantRuntimeStreamingMessage,
  type AssistantRuntimeTransportPort,
  type EvidenceRefSummary,
  type HistoryMessageSummary,
  type OpenApprovalDetailPayload,
} from "../../../packages/assistant-runtime/src";

const repoRoot = process.cwd();
const sharedUiRootRelativePath = "packages/assistant-runtime/src/components";
const assistantRuntimeRootRelativePath = `${sharedUiRootRelativePath}/AssistantRuntimeRoot.vue`;
const sharedUiRootPath = path.join(repoRoot, sharedUiRootRelativePath);
const assistantRuntimeRootPath = path.join(repoRoot, assistantRuntimeRootRelativePath);

type CanonicalUserMessage = ReturnType<typeof createUserRuntimeMessage>;
type CanonicalTerminalOutcome = ReturnType<typeof createTerminalOutcome>;

interface CanonicalAssistantAnswerMessage extends HistoryMessageSummary {
  key: string;
  kind: "assistant_answer";
  role: "assistant";
  evidence?: EvidenceRefSummary[];
  finalDecisionState?: AnswerDecisionUiState | CanonicalTerminalOutcome;
}

interface CanonicalOutcomeMessage extends HistoryMessageSummary {
  key: string;
  kind: AssistantRuntimeSafeOutcomeKind;
  role: "assistant";
  finalDecisionState: AnswerDecisionUiState | CanonicalTerminalOutcome;
}

// Shared Runtime does not yet expose a formal display-message union.
// `AssistantRuntimeMessage` is a transport result shape, so T126 uses
// HistoryMessageSummary plus runtime-created messages and narrow UI fixtures.
// T127 must not rely on arbitrary property sniffing; replace this temporary
// union once a canonical display-message type exists.
type CanonicalRuntimeMessage =
  | HistoryMessageSummary
  | AssistantRuntimeStreamingMessage
  | CanonicalUserMessage
  | CanonicalAssistantAnswerMessage
  | CanonicalOutcomeMessage;

interface CanonicalFeedbackPayload {
  messageId: AssistantMessageId;
  value: AssistantFeedbackValue;
  requestId?: AssistantRequestId;
}

interface CanonicalUiHarness {
  pinia: Pinia;
  stores: AssistantRuntimeStoreScope<CanonicalRuntimeMessage>;
  controller: AssistantRuntimeController<CanonicalRuntimeMessage>;
  transport: AssistantRuntimeTransportPort;
  callbacks: {
    sendMessage: ReturnType<typeof vi.fn>;
    loadMoreHistory: ReturnType<typeof vi.fn>;
    cancelStreaming: ReturnType<typeof vi.fn>;
    submitFeedback: ReturnType<typeof vi.fn>;
    confirmActionDraft: ReturnType<typeof vi.fn>;
    cancelActionDraft: ReturnType<typeof vi.fn>;
    openApprovalDetail: ReturnType<typeof vi.fn>;
  };
}

const selectors = {
  root: '[data-testid="assistant-runtime-root"]',
  messageList: '[data-testid="assistant-message-list"]',
  empty: '[data-testid="assistant-message-empty"]',
  userMessage: '[data-testid="assistant-user-message"]',
  assistantMessage: '[data-testid="assistant-ai-message"]',
  loadMoreHistory: '[data-testid="assistant-load-more-history"]',
  composerInput: '[data-testid="assistant-composer-input"]',
  send: '[data-testid="assistant-send"]',
  disabledReason: '[data-testid="assistant-composer-disabled-reason"]',
  streamingContent: '[data-testid="assistant-streaming-content"]',
  streamingStatus: '[data-testid="assistant-streaming-status"]',
  cancelStream: '[data-testid="assistant-cancel-stream"]',
  safeOutcome: '[data-testid="assistant-safe-outcome"]',
  evidence: '[data-testid="assistant-evidence-ref"]',
  feedbackHelpful: '[data-testid="assistant-feedback-helpful"]',
  feedbackNotHelpful: '[data-testid="assistant-feedback-not-helpful"]',
  feedbackError: '[data-testid="assistant-feedback-error"]',
  actionConfirm: '[data-testid="assistant-action-draft-confirm"]',
  actionCancel: '[data-testid="assistant-action-draft-cancel"]',
  actionPendingGuard: '[data-testid="assistant-action-draft-pending-guard"]',
  actionTerminalStatus: '[data-testid="assistant-action-draft-terminal-status"]',
  approvalOpenDetail: '[data-testid="assistant-approval-request-open-detail"]',
  approvalOpenDetailError: '[data-testid="assistant-approval-request-open-detail-error"]',
} as const;

const safeForbiddenFixtureText = [
  "token",
  "credential",
  "secret",
  "rawConnectorPayload",
  "rawApprovalPayload",
  "navigationUrl",
  "window.location",
  "stack trace",
  "permissionSnapshot",
  "internalRequestEnvelope",
];

const forbiddenSharedUiSourcePatterns = [
  /(?:^|["'])app\//,
  /#app/,
  /#imports/,
  /useNuxtApp/,
  /useRuntimeConfig/,
  /navigateTo/,
  /useRouter/,
  /window\.location/,
  /@nuxt\/ui/,
  /\bUButton\b/,
  /\bUTextarea\b/,
  /\bUAlert\b/,
  /\bUBadge\b/,
  /\bUIcon\b/,
  /\bUEmpty\b/,
  /AssistantService/,
  /@internal-ai-assistant\/assistant-sdk/,
  /new\s+AbortController/,
  /ReadableStream/,
  /fetch\s*\(/,
];

async function importAssistantRuntimeRoot() {
  expect(
    existsSync(assistantRuntimeRootPath),
    "T127 must add packages/assistant-runtime/src/components/AssistantRuntimeRoot.vue before this contract can pass.",
  ).toBe(true);

  const importUrl = pathToFileURL(assistantRuntimeRootPath).href;

  return await import(/* @vite-ignore */ importUrl);
}

function listSharedUiSourceFiles(rootPath = sharedUiRootPath): string[] {
  expect(
    existsSync(rootPath),
    "T127 must add packages/assistant-runtime/src/components before this source graph guard can pass.",
  ).toBe(true);

  const entries = readdirSync(rootPath)
    .flatMap((entry) => {
      const absolutePath = path.join(rootPath, entry);
      const relativePath = path.relative(repoRoot, absolutePath);

      if (statSync(absolutePath).isDirectory()) {
        return listSharedUiSourceFiles(absolutePath);
      }

      return /\.(vue|ts|tsx)$/.test(entry) ? [relativePath] : [];
    });

  return entries.sort();
}

function readSharedUiSourceGraph(): Array<{ relativePath: string; source: string }> {
  return listSharedUiSourceFiles().map(relativePath => ({
    relativePath,
    source: readFileSync(path.join(repoRoot, relativePath), "utf8"),
  }));
}

function createTransport(): AssistantRuntimeTransportPort {
  return {
    createSession: vi.fn(async () => ({
      ok: true,
      value: {
        sessionId: "session-canonical-ui",
        status: "active",
      },
    })),
    getSession: vi.fn(async input => ({
      ok: true,
      value: {
        sessionId: input.sessionId,
        status: "active",
      },
    })),
    loadHistory: vi.fn(async () => ({
      ok: true,
      value: {
        sessionId: "session-canonical-ui",
        cursor: "cursor-next",
        messages: [
          createHistoryMessage({
            messageId: "history-001",
            content: "Earlier canonical answer",
          }),
        ],
      },
    })),
    sendMessage: vi.fn(async () => ({
      ok: true,
      value: {
        requestId: "request-send-001",
      },
    })),
    streamMessage: vi.fn(async () => ({
      ok: true,
      value: undefined,
    })),
    cancelMessage: vi.fn(async () => ({
      ok: true,
      value: { cancelled: true },
    })),
    abortMessage: vi.fn(async () => ({
      ok: true,
      value: { aborted: true },
    })),
    submitFeedback: vi.fn(async () => ({
      ok: true,
      value: { submitted: true },
    })),
    loadActionDraftDetail: vi.fn(async () => ({
      ok: true,
      value: createActionDraftDetail(),
    })),
    confirmActionDraft: vi.fn(async () => ({
      ok: true,
      value: { confirmed: true },
    })),
    cancelActionDraft: vi.fn(async () => ({
      ok: true,
      value: { cancelled: true },
    })),
    loadApprovalRequestDetail: vi.fn(async () => ({
      ok: true,
      value: createApprovalRequestSummary(),
    })),
    openApprovalRequestDetail: vi.fn(async () => ({
      ok: true,
      value: { opened: true },
    })),
  } satisfies AssistantRuntimeTransportPort;
}

function createCanonicalUiHarness(runtimeScope = "canonical-ui-test"): CanonicalUiHarness {
  const pinia = createPinia();
  const stores = createAssistantRuntimeStores<CanonicalRuntimeMessage>({
    pinia,
    runtimeScope,
  });
  const transport = createTransport();
  const controller = createAssistantRuntimeController<CanonicalRuntimeMessage>({
    runtimeScope,
    stores,
    transport,
  });

  return {
    pinia,
    stores,
    controller,
    transport,
    callbacks: {
      sendMessage: vi.fn((message: string) => {
        controller.appendUserMessage(createUserMessage(message));
      }),
      loadMoreHistory: vi.fn(() => undefined),
      cancelStreaming: vi.fn(() => controller.markStreamingCancelled()),
      submitFeedback: vi.fn((payload: CanonicalFeedbackPayload) => {
        controller.startFeedbackSubmission(
          payload.messageId,
          payload.value,
          payload.requestId ?? "request-feedback-001",
        );
      }),
      confirmActionDraft: vi.fn((actionDraftId: string) => {
        const prepared = controller.prepareActionDraftConfirmation(actionDraftId);

        if (prepared.allowed && prepared.idempotencyKey) {
          controller.setActionDraftOperationStatus(actionDraftId, "confirming", {
            idempotencyKey: prepared.idempotencyKey,
          });
        }
      }),
      cancelActionDraft: vi.fn((actionDraftId: string) => {
        const prepared = controller.prepareActionDraftCancellation(actionDraftId);

        if (prepared.allowed && prepared.idempotencyKey) {
          controller.setActionDraftOperationStatus(actionDraftId, "cancelling", {
            idempotencyKey: prepared.idempotencyKey,
          });
        }
      }),
      openApprovalDetail: vi.fn((payload: OpenApprovalDetailPayload) => {
        controller.startApprovalRequestOpenDetail(payload.approvalRequestId);
      }),
    },
  };
}

async function mountCanonicalUi(harness = createCanonicalUiHarness()): Promise<{
  errorHandler: ReturnType<typeof vi.fn>;
  harness: CanonicalUiHarness;
  warnHandler: ReturnType<typeof vi.fn>;
  wrapper: VueWrapper;
}> {
  const module = await importAssistantRuntimeRoot();
  const AssistantRuntimeRoot = module.default;
  const warnHandler = vi.fn();
  const errorHandler = vi.fn();

  const wrapper = mount(AssistantRuntimeRoot, {
    props: {
      controller: harness.controller,
      runtimeScope: harness.controller.runtimeScope,
      onSendMessage: harness.callbacks.sendMessage,
      onLoadMoreHistory: harness.callbacks.loadMoreHistory,
      onCancelStreaming: harness.callbacks.cancelStreaming,
      onSubmitFeedback: harness.callbacks.submitFeedback,
      onConfirmActionDraft: harness.callbacks.confirmActionDraft,
      onCancelActionDraft: harness.callbacks.cancelActionDraft,
      onOpenApprovalDetail: harness.callbacks.openApprovalDetail,
    },
    global: {
      plugins: [harness.pinia],
      config: {
        warnHandler,
        errorHandler,
      },
    },
  });

  mountedWrappers.push(wrapper);

  return { errorHandler, harness, warnHandler, wrapper };
}

const mountedWrappers: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount();
  }
  vi.restoreAllMocks();
});

function createHistoryMessage(
  overrides: Partial<HistoryMessageSummary> = {},
): HistoryMessageSummary {
  return {
    messageId: "message-history-001",
    role: "assistant",
    content: "Canonical answer",
    createdAt: "2026-07-22T00:00:00.000Z",
    answerDecision: "answered",
    evidenceRefs: [],
    ...overrides,
  };
}

function createUserMessage(content: string, requestId = "request-user-001"): CanonicalUserMessage {
  return createUserRuntimeMessage({
    requestId,
    content,
    createdAt: "2026-07-22T00:00:00.000Z",
  });
}

function createAssistantAnswerMessage(input: {
  key?: string;
  messageId?: string;
  content: string;
  evidence?: EvidenceRefSummary[];
  finalDecisionState?: AnswerDecisionUiState | CanonicalTerminalOutcome;
}): CanonicalAssistantAnswerMessage {
  return {
    key: input.key ?? input.messageId ?? "assistant-answer-001",
    kind: "assistant_answer",
    messageId: input.messageId ?? input.key ?? "assistant-answer-001",
    role: "assistant",
    content: input.content,
    createdAt: "2026-07-22T00:00:00.000Z",
    answerDecision: "answered",
    evidenceRefs: input.evidence?.map(evidence => evidence.id) ?? [],
    evidence: input.evidence,
    finalDecisionState: input.finalDecisionState ?? {
      kind: "answered",
      answerDecision: "answered",
    },
  };
}

function createOutcomeMessage(
  kind: AssistantRuntimeSafeOutcomeKind,
  content: string,
): CanonicalOutcomeMessage {
  const outcome = createTerminalOutcome(kind);

  return {
    key: `outcome:${kind}`,
    kind,
    messageId: `message-${kind}`,
    role: "assistant",
    content,
    createdAt: "2026-07-22T00:00:00.000Z",
    answerDecision: outcome.answerDecision ?? "no_answer",
    finalDecisionState: outcome,
  };
}

function createStreamingMessage(
  status: AssistantRuntimeStreamingMessage["status"],
): AssistantRuntimeStreamingMessage {
  const message = createAssistantStreamingRuntimeMessage({
    key: `stream:${status}`,
    requestId: "request-stream-001",
    createdAt: "2026-07-22T00:00:01.000Z",
  });

  return {
    ...message,
    messageId: "message-stream-001",
    content: status === "streaming" || status === "completed"
      ? "Delta one. Delta two."
      : "Partial answer",
    status,
    evidence: [
      {
        id: "evidence-001",
        sourceType: "document_chunk",
        title: "Order policy",
        snippet: "Orders over the limit need review.",
      } satisfies EvidenceRefSummary,
    ],
    lastSequence: 2,
    pendingContent: status === "streaming" ? "Delta one. Delta two." : undefined,
    finalAnswerDecision: status === "completed" ? "answered" : undefined,
    finalDecisionState: status === "completed"
      ? ({
          kind: "answered",
          answerDecision: "answered",
        } satisfies AnswerDecisionUiState)
      : undefined,
  };
}

function createActionDraftDetail() {
  return {
    actionDraftId: "action-draft-canonical-001",
    requestId: "request-action-001",
    messageId: "message-action-001",
    status: "waiting_confirmation",
    riskLevel: "medium",
    toolName: "orders.updateStatus",
    resource: "sales-order",
    operation: "update_status",
    preview: {
      targetEntityId: "SO-10001",
      nextStatus: "ready_for_review",
    },
    expiresAt: "2026-07-23T00:00:00.000Z",
  } as const;
}

function createActionDraftState(
  overrides: Partial<ActionDraftDetailState> = {},
): ActionDraftDetailState {
  return {
    actionDraftId: "action-draft-canonical-001",
    detailStatus: "available",
    operationStatus: "idle",
    actionDraftStatus: "waiting_confirmation",
    idempotencyKey: null,
    detail: createActionDraftDetail(),
    ...overrides,
  };
}

function createApprovalRequestSummary(): ApprovalRequestSummary {
  return {
    approvalRequestId: "approval-canonical-001",
    requestId: "request-approval-001",
    messageId: "message-approval-001",
    sessionId: "session-canonical-ui",
    status: "pending",
    riskLevel: "high",
    requesterActorId: "actor-requester-safe",
    actionSummary: {
      operation: "approve_discount",
      target: "SO-10001",
    },
    payloadSummary: {
      amount: "safe summary only",
    },
    expiresAt: "2026-07-23T00:00:00.000Z",
  };
}

function createApprovalRequestState(
  overrides: Partial<ApprovalRequestDetailState> = {},
): ApprovalRequestDetailState {
  return {
    approvalRequestId: "approval-canonical-001",
    detailStatus: "available",
    openDetailStatus: "idle",
    ...createApprovalRequestSummary(),
    ...overrides,
  };
}

function createApprovalOpenDetailPayload(
  overrides: Partial<OpenApprovalDetailPayload> = {},
): OpenApprovalDetailPayload {
  return {
    approvalRequestId: "approval-canonical-001",
    requestId: "request-approval-001",
    messageId: "message-approval-001",
    sessionId: "session-canonical-ui",
    ...overrides,
  };
}

function seedActionDraftMessage(harness: CanonicalUiHarness, state: ActionDraftDetailState) {
  harness.controller.setMessages([
    createAssistantAnswerMessage({
      key: "message-action-001",
      messageId: "message-action-001",
      content: "請確認操作。",
      finalDecisionState: {
        kind: "confirmation_required",
        answerDecision: "confirmation_required",
        actionDraftId: state.actionDraftId,
      },
    }),
  ], null);
  harness.controller.upsertActionDraftState(state.actionDraftId, state);
}

function seedApprovalRequestMessage(harness: CanonicalUiHarness, state: ApprovalRequestDetailState) {
  harness.controller.setMessages([
    createAssistantAnswerMessage({
      key: "message-approval-001",
      messageId: "message-approval-001",
      content: "此操作需要審核。",
      finalDecisionState: {
        kind: "approval_required",
        answerDecision: "approval_required",
        approvalRequestId: state.approvalRequestId,
      },
    }),
  ], null);
  harness.controller.upsertApprovalRequestState(state.approvalRequestId, state);
}

function assertNoForbiddenText(renderedText: string) {
  for (const forbidden of safeForbiddenFixtureText) {
    expect(renderedText).not.toContain(forbidden);
  }
}

function expectNoVueResolutionWarnings(
  warnHandler: ReturnType<typeof vi.fn>,
  errorHandler: ReturnType<typeof vi.fn>,
) {
  const diagnostics = JSON.stringify([
    warnHandler.mock.calls,
    errorHandler.mock.calls,
  ]);

  expect(diagnostics).not.toMatch(/Failed to resolve component|Unknown custom element|Failed to resolve directive/i);
}

function findByTestId(wrapper: VueWrapper, selector: string) {
  return wrapper.find(selector);
}

describe("Shared Canonical Assistant UI contract", () => {
  it("mounts in plain Vue with explicit Pinia and controller dependencies", async () => {
    const { errorHandler, warnHandler, wrapper } = await mountCanonicalUi();

    expect(findByTestId(wrapper, selectors.root).exists()).toBe(true);
    expect(wrapper.find('[role="region"], [role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toMatch(/assistant|助理|詢問|訊息/i);
    expectNoVueResolutionWarnings(warnHandler, errorHandler);
  });

  it("renders an empty conversation without fake assistant answers or controls", async () => {
    const { wrapper } = await mountCanonicalUi();
    const text = wrapper.text();

    expect(findByTestId(wrapper, selectors.messageList).exists()).toBe(true);
    expect(findByTestId(wrapper, selectors.empty).exists()).toBe(true);
    expect(text).toMatch(/尚無|開始|詢問|empty/i);
    expect(text).not.toContain("Canonical answer");
    expect(findByTestId(wrapper, selectors.feedbackHelpful).exists()).toBe(false);
    expect(findByTestId(wrapper, selectors.actionConfirm).exists()).toBe(false);
    expect(findByTestId(wrapper, selectors.approvalOpenDetail).exists()).toBe(false);
  });

  it("renders canonicalized unique user and assistant messages in order", async () => {
    const harness = createCanonicalUiHarness();
    harness.controller.setMessages([
      createUserMessage("請查詢訂單狀態", "request-user-order"),
      createAssistantAnswerMessage({
        key: "assistant-001",
        messageId: "assistant-001",
        content: "訂單目前等待審核。",
      }),
    ], null);

    const { wrapper } = await mountCanonicalUi(harness);
    const text = wrapper.text();

    expect(text.indexOf("請查詢訂單狀態")).toBeLessThan(text.indexOf("訂單目前等待審核。"));
    expect(text.match(/訂單目前等待審核。/g)).toHaveLength(1);
    expect(findByTestId(wrapper, selectors.userMessage).exists()).toBe(true);
    expect(findByTestId(wrapper, selectors.assistantMessage).exists()).toBe(true);
    expect(findByTestId(wrapper, selectors.feedbackHelpful).exists()).toBe(true);
    expect(wrapper.text()).not.toMatch(/assistant-only control for user/i);
  });

  it("uses injected runtime action for load-more history without direct HTTP ownership", async () => {
    const harness = createCanonicalUiHarness();
    harness.controller.setMessages([
      createHistoryMessage({ messageId: "history-visible", content: "歷史訊息" }),
    ], "cursor-next");

    const { wrapper } = await mountCanonicalUi(harness);
    const loadMore = findByTestId(wrapper, selectors.loadMoreHistory);

    expect(loadMore.exists()).toBe(true);
    await loadMore.trigger("click");

    expect(harness.callbacks.loadMoreHistory).toHaveBeenCalledTimes(1);
    expect(harness.transport.loadHistory).not.toHaveBeenCalled();
  });

  it("submits trimmed composer input and rejects empty input without backend authority fields", async () => {
    const harness = createCanonicalUiHarness("canonical-ui-composer-submit");
    harness.controller.setReady();
    harness.controller.setContextReady(true);

    const { wrapper } = await mountCanonicalUi(harness);
    const input = findByTestId(wrapper, selectors.composerInput);
    const sendButton = findByTestId(wrapper, selectors.send);

    expect(input.exists()).toBe(true);
    expect(sendButton.exists()).toBe(true);

    await input.setValue("   請整理這張訂單   ");
    await sendButton.trigger("click");
    await input.setValue("   ");
    await sendButton.trigger("click");

    expect(harness.callbacks.sendMessage).toHaveBeenCalledTimes(1);
    expect(harness.callbacks.sendMessage).toHaveBeenCalledWith("請整理這張訂單");
    expect(JSON.stringify(harness.callbacks.sendMessage.mock.calls)).not.toMatch(/hostContext|pageContext|selectedRows|sessionScope|sourceSystem|permission|connector/i);
  });

  it("supports Enter submit and Shift+Enter multiline composer behavior", async () => {
    // This mirrors the existing Frontend 001 ChatInputBar keyboard contract.
    const harness = createCanonicalUiHarness("canonical-ui-composer-keyboard");
    harness.controller.setReady();
    harness.controller.setContextReady(true);

    const { wrapper } = await mountCanonicalUi(harness);
    const input = findByTestId(wrapper, selectors.composerInput);

    expect(input.exists()).toBe(true);
    await input.setValue("用 Enter 送出");
    await input.trigger("keydown", { key: "Enter", shiftKey: true });
    expect(harness.callbacks.sendMessage).not.toHaveBeenCalled();

    await input.trigger("keydown", { key: "Enter", shiftKey: false });
    expect(harness.callbacks.sendMessage).toHaveBeenCalledWith("用 Enter 送出");
  });

  it.each([
    ["session_not_ready", "idle"],
    ["bootstrapping", "restoring"],
    ["streaming", "ready"],
    ["degraded", "ready"],
    ["unavailable", "ready"],
    ["scope_changed", "error"],
  ] as const)("disables composer safely while %s", async (reason, status) => {
    const harness = createCanonicalUiHarness(`canonical-ui-disabled-${reason}`);

    if (status === "restoring") {
      harness.controller.setRestoring();
    }
    if (status === "ready") {
      harness.controller.setReady();
    }
    if (status === "error") {
      harness.controller.setError({ code: "scope_changed", safeMessage: "請重新整理助理狀態。" }, "scope_changed");
    }
    if (reason === "streaming") {
      harness.controller.appendAssistantStreamingPlaceholder(createStreamingMessage("streaming"));
      harness.controller.setStreamingRequest("request-stream-001", "stream:streaming");
      harness.controller.updateActiveStreamingStatus("streaming");
    }
    if (reason === "degraded") {
      harness.stores.widget.availability.value = "degraded";
    }
    if (reason === "unavailable") {
      harness.stores.widget.availability.value = "unavailable";
    }

    const { wrapper } = await mountCanonicalUi(harness);
    const sendButton = findByTestId(wrapper, selectors.send);

    expect(sendButton.exists()).toBe(true);
    expect(sendButton.attributes("disabled") ?? sendButton.attributes("aria-disabled")).toBeTruthy();
    expect(findByTestId(wrapper, selectors.disabledReason).text()).toMatch(/尚未|準備|處理|不可用|稍後|重新/i);
    assertNoForbiddenText(wrapper.text());
  });

  it("renders degraded and unavailable projections from widget availability", async () => {
    const harness = createCanonicalUiHarness("canonical-ui-availability");
    harness.stores.widget.availability.value = "degraded";

    const degraded = await mountCanonicalUi(harness);
    expect(degraded.wrapper.text()).toMatch(/暫時|不穩定|degraded/i);
    assertNoForbiddenText(degraded.wrapper.text());
    degraded.wrapper.unmount();

    harness.stores.widget.availability.value = "unavailable";
    const unavailable = await mountCanonicalUi(harness);
    expect(unavailable.wrapper.text()).toMatch(/不可用|稍後|unavailable/i);
    assertNoForbiddenText(unavailable.wrapper.text());
  });

  it("renders loading and streaming states from canonical runtime state", async () => {
    const harness = createCanonicalUiHarness();
    harness.controller.setLoadingHistory("initial");
    harness.controller.appendAssistantStreamingPlaceholder(createStreamingMessage("streaming"));
    harness.controller.setStreamingRequest("request-stream-001", "stream:streaming");

    const { wrapper } = await mountCanonicalUi(harness);

    expect(wrapper.text()).toMatch(/載入|loading|處理|stream|Delta one/i);
    expect(wrapper.text()).not.toContain("完成回答");
    expect(findByTestId(wrapper, selectors.streamingContent).exists()).toBe(true);
    expect(findByTestId(wrapper, selectors.cancelStream).exists()).toBe(true);
  });

  it("delegates streaming cancel through runtime action only", async () => {
    const harness = createCanonicalUiHarness();
    harness.controller.appendAssistantStreamingPlaceholder(createStreamingMessage("streaming"));
    harness.controller.setStreamingRequest("request-stream-001", "stream:streaming");

    const { wrapper } = await mountCanonicalUi(harness);
    await findByTestId(wrapper, selectors.cancelStream).trigger("click");

    expect(harness.callbacks.cancelStreaming).toHaveBeenCalledTimes(1);
    expect(harness.transport.cancelMessage).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/取消|停止|cancel/i);
  });

  it("finalizes completed answers and removes the streaming indicator", async () => {
    const harness = createCanonicalUiHarness();
    harness.controller.setMessages([
      createStreamingMessage("completed"),
    ], null);

    const { wrapper } = await mountCanonicalUi(harness);

    expect(wrapper.text()).toContain("Delta one. Delta two.");
    expect(findByTestId(wrapper, selectors.streamingStatus).text()).not.toMatch(/streaming|正在輸入|產生中/i);
    expect(wrapper.text()).not.toMatch(/Delta one\. Delta two\..*Delta one\. Delta two\./s);
  });

  it.each([
    ["interrupted"],
    ["cancelled"],
    ["failed"],
  ] as const)("renders %s streaming terminal state safely", async (status) => {
    const harness = createCanonicalUiHarness(`canonical-ui-terminal-${status}`);
    harness.controller.setMessages([createStreamingMessage(status)], null);

    const { wrapper } = await mountCanonicalUi(harness);

    expect(wrapper.text()).toContain("Partial answer");
    expect(wrapper.text()).toMatch(/中斷|取消|失敗|稍後|安全|未完成/i);
    assertNoForbiddenText(wrapper.text());
  });

  it.each([
    ["no_answer", "沒有足夠資訊可以安全回答。"],
    ["clarification_required", "需要更多資訊才能繼續。"],
    ["permission_denied", "目前權限不足，無法顯示此結果。"],
    ["tool_failure", "工具暫時無法完成，請稍後再試。"],
    ["timeout", "回覆逾時，請稍後重試。"],
    ["interrupted", "回覆已中斷，尚未完成。"],
  ] as const)("renders safe outcome %s without raw backend details", async (kind, safeMessage) => {
    const harness = createCanonicalUiHarness(`canonical-ui-outcome-${kind}`);
    harness.controller.setMessages([
      createOutcomeMessage(kind, safeMessage),
    ], null);

    const { wrapper } = await mountCanonicalUi(harness);

    expect(findByTestId(wrapper, selectors.safeOutcome).exists()).toBe(true);
    expect(wrapper.text()).toContain(createTerminalOutcome(kind).safeTitle);
    expect(wrapper.text()).toContain(safeMessage);
    expect(wrapper.text()).not.toMatch(/new public AnswerDecision|degraded answerDecision|stack|connector|raw/i);
    assertNoForbiddenText(wrapper.text());
  });

  it("renders safe evidence references and suppresses unsafe raw evidence", async () => {
    const harness = createCanonicalUiHarness();
    const malformedEvidence = {
      malformed: true,
      rawConnectorPayload: {
        credential: "secret",
      },
    } as unknown as EvidenceRefSummary;

    harness.controller.setMessages([
      createAssistantAnswerMessage({
        key: "answer-with-evidence",
        content: "依據訂單政策，這筆訂單需要審核。",
        evidence: [
          {
            id: "evidence-001",
            sourceType: "document_chunk",
            title: "訂單審核政策",
            snippet: "超過折扣門檻需審核。",
          },
          {
            id: "evidence-002",
            sourceType: "structured_record",
            title: "SO-10001",
          },
          malformedEvidence,
        ],
      }),
    ], null);

    const { wrapper } = await mountCanonicalUi(harness);

    expect(wrapper.findAll(selectors.evidence)).toHaveLength(2);
    expect(wrapper.text()).toContain("訂單審核政策");
    expect(wrapper.text()).toContain("超過折扣門檻需審核。");
    expect(wrapper.text()).toContain("SO-10001");
    assertNoForbiddenText(wrapper.text());
  });

  it("emits safe feedback payloads after a failed pending operation", async () => {
    const harness = createCanonicalUiHarness();
    harness.controller.setMessages([
      createHistoryMessage({ messageId: "message-feedback-001", content: "可以提交回饋的回答。" }),
    ], null);
    harness.controller.startFeedbackSubmission("message-feedback-001", "helpful", "request-feedback-old");
    harness.controller.failFeedbackSubmission("message-feedback-001", null, "request-feedback-old", "暫時無法送出回饋。");

    const { wrapper } = await mountCanonicalUi(harness);
    const helpful = findByTestId(wrapper, selectors.feedbackHelpful);

    expect(helpful.exists()).toBe(true);
    expect(findByTestId(wrapper, selectors.feedbackError).text()).toContain("暫時無法送出回饋。");
    await helpful.trigger("click");

    expect(harness.callbacks.submitFeedback).toHaveBeenCalledWith({
      messageId: "message-feedback-001",
      value: "helpful",
    });
    expect(JSON.stringify(harness.callbacks.submitFeedback.mock.calls)).not.toMatch(/http|url|pageContext|selectedRows|permission|connector|token|secret/i);
  });

  it("emits safe not-helpful feedback payloads when feedback is allowed", async () => {
    const harness = createCanonicalUiHarness("canonical-ui-feedback-not-helpful");
    harness.controller.setMessages([
      createAssistantAnswerMessage({
        key: "message-feedback-not-helpful",
        messageId: "message-feedback-not-helpful",
        content: "這是一則可提交回饋的完成回答。",
      }),
    ], null);

    const { wrapper } = await mountCanonicalUi(harness);
    const notHelpful = findByTestId(wrapper, selectors.feedbackNotHelpful);

    expect(notHelpful.exists()).toBe(true);
    await notHelpful.trigger("click");

    expect(harness.callbacks.submitFeedback).toHaveBeenCalledWith({
      messageId: "message-feedback-not-helpful",
      value: "not_helpful",
    });
    expect(JSON.stringify(harness.callbacks.submitFeedback.mock.calls)).not.toMatch(/http|url|pageContext|selectedRows|permission|connector|token|secret/i);
  });

  it("blocks duplicate feedback submission while pending", async () => {
    const harness = createCanonicalUiHarness("canonical-ui-feedback-pending");
    harness.controller.setMessages([
      createHistoryMessage({ messageId: "message-feedback-pending", content: "等待回饋送出。" }),
    ], null);
    harness.controller.startFeedbackSubmission("message-feedback-pending", "not_helpful", "request-feedback-pending");

    const { wrapper } = await mountCanonicalUi(harness);
    await findByTestId(wrapper, selectors.feedbackHelpful).trigger("click");
    await findByTestId(wrapper, selectors.feedbackNotHelpful).trigger("click");

    expect(harness.callbacks.submitFeedback).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/送出中|處理|feedback/i);
  });

  it("does not resubmit unchanged feedback after success", async () => {
    const harness = createCanonicalUiHarness("canonical-ui-feedback-submitted");
    harness.controller.setMessages([
      createHistoryMessage({ messageId: "message-feedback-submitted", content: "已提交回饋。" }),
    ], null);
    harness.controller.startFeedbackSubmission("message-feedback-submitted", "helpful", "request-feedback-success");
    harness.controller.completeFeedbackSubmission("message-feedback-submitted", {
      requestId: "request-feedback-success",
    });

    const { wrapper } = await mountCanonicalUi(harness);
    await findByTestId(wrapper, selectors.feedbackHelpful).trigger("click");

    expect(harness.callbacks.submitFeedback).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/已送出|已提交|feedback/i);
  });

  it("delegates ActionDraft confirm through shared runtime eligibility", async () => {
    const harness = createCanonicalUiHarness();
    seedActionDraftMessage(harness, createActionDraftState());

    const { wrapper } = await mountCanonicalUi(harness);

    expect(wrapper.text()).toMatch(/orders\.updateStatus|sales-order|SO-10001|medium|審核|確認/i);
    await findByTestId(wrapper, selectors.actionConfirm).trigger("click");

    expect(harness.callbacks.confirmActionDraft).toHaveBeenCalledWith("action-draft-canonical-001");
    expect(harness.callbacks.cancelActionDraft).not.toHaveBeenCalled();
    expect(JSON.stringify(harness.callbacks.confirmActionDraft.mock.calls)).not.toMatch(/permission|connector|credential|raw|url/i);
    assertNoForbiddenText(wrapper.text());
  });

  it("delegates ActionDraft cancellation through shared runtime eligibility", async () => {
    const harness = createCanonicalUiHarness("canonical-ui-action-cancel");
    seedActionDraftMessage(harness, createActionDraftState());

    const { wrapper } = await mountCanonicalUi(harness);
    await findByTestId(wrapper, selectors.actionCancel).trigger("click");

    expect(harness.callbacks.cancelActionDraft).toHaveBeenCalledWith("action-draft-canonical-001");
    expect(harness.callbacks.confirmActionDraft).not.toHaveBeenCalled();
    expect(JSON.stringify(harness.callbacks.cancelActionDraft.mock.calls)).not.toMatch(/permission|connector|credential|raw|url/i);
  });

  it.each([
    ["confirming"],
    ["cancelling"],
  ] as const)("disables ActionDraft controls while operation is %s", async (operationStatus) => {
    const harness = createCanonicalUiHarness(`canonical-ui-action-${operationStatus}`);
    seedActionDraftMessage(harness, createActionDraftState({ operationStatus }));

    const { wrapper } = await mountCanonicalUi(harness);

    expect(findByTestId(wrapper, selectors.actionConfirm).attributes("disabled")).toBeTruthy();
    expect(findByTestId(wrapper, selectors.actionCancel).attributes("disabled")).toBeTruthy();
    await findByTestId(wrapper, selectors.actionConfirm).trigger("click");
    await findByTestId(wrapper, selectors.actionCancel).trigger("click");
    expect(harness.callbacks.confirmActionDraft).not.toHaveBeenCalled();
    expect(harness.callbacks.cancelActionDraft).not.toHaveBeenCalled();
  });

  it("renders ActionDraft pending execution guard without approving authority", async () => {
    const harness = createCanonicalUiHarness("canonical-ui-action-pending-guard");
    seedActionDraftMessage(harness, createActionDraftState({
      operationStatus: "pending_execution_guard",
      safeMessage: ACTION_DRAFT_PENDING_GUARD_MESSAGE,
    }));

    const { wrapper } = await mountCanonicalUi(harness);

    expect(findByTestId(wrapper, selectors.actionPendingGuard).text()).toContain(ACTION_DRAFT_PENDING_GUARD_MESSAGE);
    expect(wrapper.text()).not.toMatch(/permissionSnapshot|approvalAuthority|rawConnectorPayload/i);
  });

  it.each([
    ["submitted", "confirmed"],
    ["executed", "executed"],
    ["cancelled", "cancelled"],
    ["expired", "expired"],
    ["failed", "failed"],
  ] as const)("renders ActionDraft terminal %s/%s without active controls", async (operationStatus, actionDraftStatus) => {
    const harness = createCanonicalUiHarness(`canonical-ui-action-terminal-${operationStatus}`);
    seedActionDraftMessage(harness, createActionDraftState({
      operationStatus: operationStatus as ActionDraftOperationStatus,
      actionDraftStatus: actionDraftStatus as ActionDraftStatus,
    }));

    const { wrapper } = await mountCanonicalUi(harness);

    expect(findByTestId(wrapper, selectors.actionTerminalStatus).exists()).toBe(true);
    expect(findByTestId(wrapper, selectors.actionConfirm).exists()).toBe(false);
    expect(findByTestId(wrapper, selectors.actionCancel).exists()).toBe(false);
  });

  it.each([
    ["confirm", selectors.actionConfirm, "confirmActionDraft"],
    ["cancel", selectors.actionCancel, "cancelActionDraft"],
  ] as const)("allows retryable failed ActionDraft %s through Shared Runtime eligibility only", async (_operation, selector, callbackName) => {
    const harness = createCanonicalUiHarness(`canonical-ui-action-operation-failed-${callbackName}`);
    const actionDraft = createActionDraftState({
      operationStatus: "failed",
      actionDraftStatus: "waiting_confirmation",
      safeMessage: "目前無法送出確認，請稍後再試。",
    });
    seedActionDraftMessage(harness, actionDraft);

    const { wrapper } = await mountCanonicalUi(harness);
    const control = findByTestId(wrapper, selector);
    const callback = harness.callbacks[callbackName];

    expect(wrapper.text()).toContain("目前無法送出確認，請稍後再試。");
    expect(wrapper.text()).not.toMatch(/raw error|permissionSnapshot|approvalAuthority|rawConnectorPayload|credential|token|https?:\/\/|url/i);
    expect(control.exists()).toBe(true);
    expect(control.attributes("disabled")).toBeUndefined();

    await control.trigger("click");

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(actionDraft.actionDraftId);
    expect(JSON.stringify(callback.mock.calls)).not.toMatch(/permission|connector|credential|raw|https?:\/\/|url|token/i);
  });

  it("renders unavailable ActionDraft detail safely", async () => {
    const harness = createCanonicalUiHarness("canonical-ui-action-unavailable");
    seedActionDraftMessage(harness, createActionDraftState({
      detailStatus: "unavailable",
      detail: undefined,
      safeMessage: "操作詳情暫時無法顯示。",
    }));

    const { wrapper } = await mountCanonicalUi(harness);

    expect(wrapper.text()).toContain("操作詳情暫時無法顯示。");
    expect(findByTestId(wrapper, selectors.actionConfirm).exists()).toBe(false);
    assertNoForbiddenText(wrapper.text());
  });

  it("renders ApprovalRequest summary and opens details with IDs-only payload behavior", async () => {
    const harness = createCanonicalUiHarness();
    seedApprovalRequestMessage(harness, createApprovalRequestState());

    const { wrapper } = await mountCanonicalUi(harness);
    const openDetail = findByTestId(wrapper, selectors.approvalOpenDetail);

    expect(wrapper.text()).toMatch(/pending|high|approve_discount|SO-10001|審核|詳情/i);
    expect(openDetail.exists()).toBe(true);
    await openDetail.trigger("click");

    expect(harness.callbacks.openApprovalDetail).toHaveBeenCalledWith(createApprovalOpenDetailPayload());
    expect(JSON.stringify(harness.callbacks.openApprovalDetail.mock.calls)).not.toMatch(/navigationUrl|rawApprovalPayload|approve|reject|permission|router|location/i);
    assertNoForbiddenText(wrapper.html());
  });

  it("prevents duplicate ApprovalRequest opening while already opening", async () => {
    const harness = createCanonicalUiHarness("canonical-ui-approval-opening");
    seedApprovalRequestMessage(harness, createApprovalRequestState({
      openDetailStatus: "opening",
    }));

    const { wrapper } = await mountCanonicalUi(harness);
    const openDetail = findByTestId(wrapper, selectors.approvalOpenDetail);

    expect(openDetail.attributes("disabled")).toBeTruthy();
    await openDetail.trigger("click");
    expect(harness.callbacks.openApprovalDetail).not.toHaveBeenCalled();
  });

  it("renders approval unavailable safely without navigation or raw payload exposure", async () => {
    const harness = createCanonicalUiHarness();
    seedApprovalRequestMessage(harness, createApprovalRequestState({
      openDetailStatus: "failed",
      openDetailSafeMessage: "這個環境尚未提供審核詳情入口。",
    }));

    const { wrapper } = await mountCanonicalUi(harness);

    expect(findByTestId(wrapper, selectors.approvalOpenDetailError).text()).toContain("這個環境尚未提供審核詳情入口。");
    expect(wrapper.html()).not.toMatch(/href=|window\.location|rawApprovalPayload|approve|reject/i);
  });

  it("mounts without Nuxt UI plugin or auto-registered components", async () => {
    const { errorHandler, warnHandler, wrapper } = await mountCanonicalUi();

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.html()).not.toMatch(/<u-button|<u-textarea|<u-alert|<u-badge|<u-icon|<u-empty/i);
    expectNoVueResolutionWarnings(warnHandler, errorHandler);
  });
});

describe("Shared Canonical Assistant UI architecture guards", () => {
  it("uses only library-safe source dependencies across the shared UI source graph", () => {
    const sourceGraph = readSharedUiSourceGraph();

    expect(sourceGraph.map(entry => entry.relativePath)).toContain(assistantRuntimeRootRelativePath);

    for (const { relativePath, source } of sourceGraph) {
      for (const forbiddenPattern of forbiddenSharedUiSourcePatterns) {
        expect(source, `${relativePath} must not contain ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("keeps relative imports inside packages/assistant-runtime/src", () => {
    const sourceGraph = readSharedUiSourceGraph();
    const importPattern = /(?:from\s+["']([^"']+)["'])|(?:import\s*\(\s*["']([^"']+)["']\s*\))/g;

    for (const { relativePath, source } of sourceGraph) {
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1] ?? match[2];

        if (!specifier?.startsWith(".")) {
          continue;
        }

        const resolved = path.normalize(path.join(path.dirname(relativePath), specifier));
        expect(
          resolved.startsWith("packages/assistant-runtime/src/"),
          `${relativePath} must not import ${specifier} outside the shared runtime boundary.`,
        ).toBe(true);
      }
    }
  });

  it("uses explicit Vue and Pinia imports instead of Nuxt auto-imports", () => {
    const sourceGraph = readSharedUiSourceGraph();

    for (const { relativePath, source } of sourceGraph) {
      const usedVueRuntimeIdentifiers = [
        "ref",
        "computed",
        "watch",
        "onMounted",
        "onUnmounted",
        "onScopeDispose",
      ].filter(identifier => new RegExp(`\\b${identifier}\\s*\\(`).test(source));
      const usesStoreToRefs = /\bstoreToRefs\s*\(/.test(source);

      if (usedVueRuntimeIdentifiers.length > 0) {
        expect(source, `${relativePath} must explicitly import Vue runtime helpers.`).toMatch(/from\s+["']vue["']/);
        for (const identifier of usedVueRuntimeIdentifiers) {
          expect(source, `${identifier} must be explicitly imported from vue in ${relativePath}.`).toMatch(
            new RegExp(`import\\s*\\{[^}]*\\b${identifier}\\b[^}]*\\}\\s*from\\s*["']vue["']`, "s"),
          );
        }
      }

      if (usesStoreToRefs) {
        expect(source, `${relativePath} must explicitly import storeToRefs from pinia.`).toMatch(
          /import\s*\{[^}]*\bstoreToRefs\b[^}]*\}\s*from\s*["']pinia["']/s,
        );
      }

      expect(source).not.toMatch(/from\s+["']#imports["']|from\s+["']#app["']/);
    }
  });

  it("does not create a second canonical runtime implementation in shared UI components", () => {
    const sourceGraph = readSharedUiSourceGraph();
    const forbiddenTransitionOwnership = [
      /defineStore|createPinia|getActivePinia|setActivePinia/,
      /parseAssistantSse\s*\(|createAssistantSseStreamRunner\s*\(|createAssistantSessionHistoryOrchestrator\s*\(/,
      /mapAnswerDecisionState\s*\(|normalizeEvidenceReferences\s*\(|startFeedbackSubmissionState\s*\(/,
      /createDefaultActionDraftState\s*\(|createDefaultApprovalRequestState\s*\(/,
      /stores\.(messages|feedbackByMessageId|actionDraftById|approvalRequestById)\.value\s*=/,
      /new\s+Map\s*<.*(message|feedback|action|approval|session)/i,
    ];

    for (const { relativePath, source } of sourceGraph) {
      for (const forbiddenPattern of forbiddenTransitionOwnership) {
        expect(source, `${relativePath} must render or delegate, not own ${forbiddenPattern}.`).not.toMatch(forbiddenPattern);
      }
    }
  });
});
