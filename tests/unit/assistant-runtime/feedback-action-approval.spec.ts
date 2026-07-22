import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ACTION_DRAFT_PENDING_GUARD_MESSAGE,
  completeActionDraftDetailLoadState,
  completeActionDraftOperationState,
  createActionDraftOperationInput,
  createDefaultActionDraftState,
  failActionDraftOperationState,
  mapActionDraftOperationStatus,
  setActionDraftOperationState,
} from "../../../packages/assistant-runtime/src/actions";
import {
  completeApprovalRequestDetailLoadState,
  createDefaultApprovalRequestState,
  createOpenApprovalDetailPayload,
  failApprovalRequestOpenDetailState,
  getApprovalRequestStatusLabel,
  getApprovalRiskLabel,
  normalizeApprovalSummaryRows,
  startApprovalRequestOpenDetailState,
} from "../../../packages/assistant-runtime/src/approvals";
import {
  completeFeedbackSubmissionState,
  createDefaultFeedbackState,
  failFeedbackSubmissionState,
  mapFeedbackValueToRequest,
  startFeedbackSubmissionState,
} from "../../../packages/assistant-runtime/src/feedback";

describe("shared runtime feedback state", () => {
  it("maps existing helpful/not_helpful UI values to the backend feedback shape safely", () => {
    expect(mapFeedbackValueToRequest("helpful")).toEqual({
      rating: "positive",
      intent: "other",
    });
    expect(mapFeedbackValueToRequest("not_helpful")).toEqual({
      rating: "negative",
      intent: "not_helpful",
    });

    expect(mapFeedbackValueToRequest("helpful")).not.toHaveProperty("comment");
    expect(mapFeedbackValueToRequest("not_helpful")).not.toHaveProperty("reason");
  });

  it("owns default, submitting, submitted, failed, and retry-safe feedback UI state", () => {
    const submitting = startFeedbackSubmissionState("helpful", "request-001");

    expect(createDefaultFeedbackState()).toEqual({
      value: null,
      pending: false,
      error: null,
      requestId: null,
    });
    expect(submitting).toEqual({
      value: "helpful",
      pending: true,
      error: null,
      requestId: "request-001",
    });
    expect(completeFeedbackSubmissionState(submitting)).toEqual({
      value: "helpful",
      pending: false,
      error: null,
      requestId: "request-001",
    });
    expect(failFeedbackSubmissionState({
      previousValue: "not_helpful",
      requestId: "request-001",
      safeMessage: "回饋暫時無法送出，請稍後再試。",
    })).toEqual({
      value: "not_helpful",
      pending: false,
      error: "回饋暫時無法送出，請稍後再試。",
      requestId: "request-001",
    });
    expect(startFeedbackSubmissionState("helpful", "request-001")).toEqual(
      startFeedbackSubmissionState("helpful", "request-001"),
    );
  });
});

describe("shared runtime action draft state", () => {
  const detail = {
    actionDraftId: "action-draft-001",
    requestId: "request-action-001",
    messageId: "message-action-001",
    status: "waiting_confirmation",
    riskLevel: "medium",
    toolName: "mock.orders.status.update",
    resource: "orders",
    operation: "update",
    preview: {
      targetEntityId: "SO-10001",
    },
    expiresAt: "2026-07-09T10:15:00.000Z",
  } as const;

  it("owns ID-only action draft display and confirm/cancel operation transitions", () => {
    const loaded = completeActionDraftDetailLoadState(
      createDefaultActionDraftState("action-draft-001"),
      detail,
    );
    const confirming = setActionDraftOperationState(loaded, "confirming", {
      idempotencyKey: "confirm-001",
    });
    const completed = completeActionDraftOperationState(confirming, "confirmed", {
      idempotencyKey: "confirm-001",
      recheck: {
        organizationBoundary: "passed",
        draftStatus: "passed",
        freshness: "passed",
        permission: "pending_execution_guard",
        toolContract: "pending_execution_guard",
        idempotency: "reserved",
      },
    });

    expect(loaded).toMatchObject({
      actionDraftId: "action-draft-001",
      detailStatus: "available",
      actionDraftStatus: "waiting_confirmation",
    });
    expect(confirming).toMatchObject({
      operationStatus: "confirming",
      idempotencyKey: "confirm-001",
    });
    expect(completed).toMatchObject({
      operationStatus: "pending_execution_guard",
      actionDraftStatus: "confirmed",
      safeMessage: ACTION_DRAFT_PENDING_GUARD_MESSAGE,
    });
    expect(createActionDraftOperationInput({
      actionDraftId: "action-draft-001",
      idempotencyKey: "confirm-001",
    })).toEqual({
      actionDraftId: "action-draft-001",
      idempotencyKey: "confirm-001",
    });
  });

  it("keeps terminal states and failures safe without owning backend execution authority", () => {
    expect(mapActionDraftOperationStatus("executed")).toBe("executed");
    expect(mapActionDraftOperationStatus("cancelled")).toBe("cancelled");
    expect(mapActionDraftOperationStatus("expired")).toBe("expired");
    expect(mapActionDraftOperationStatus("failed")).toBe("failed");

    const failed = failActionDraftOperationState(
      completeActionDraftDetailLoadState(
        createDefaultActionDraftState("action-draft-001"),
        detail,
      ),
      "目前無法送出確認，請稍後再試。",
    );

    expect(failed).toMatchObject({
      operationStatus: "failed",
      safeMessage: "目前無法送出確認，請稍後再試。",
      detailStatus: "available",
    });
    expect(createActionDraftOperationInput({ actionDraftId: "" })).toBeNull();
  });
});

describe("shared runtime approval request state", () => {
  const summary = {
    approvalRequestId: "approval-request-001",
    requestId: "request-approval-001",
    sessionId: "session-001",
    messageId: "message-approval-001",
    status: "pending",
    riskLevel: "high",
    requesterActorId: "actor-requester",
    approverActorId: "actor-approver",
    actionSummary: {
      toolName: "mock.orders.cancel",
      nested: {
        hidden: true,
      },
      dryRun: false,
    },
    payloadSummary: {
      targetEntityId: "SO-10001",
      rawApprovalPayload: {
        hidden: true,
      },
    },
    expiresAt: "2026-07-09T10:30:00.000Z",
    evidenceRefIds: ["evidence-structured-001"],
  } as const;

  it("owns safe approval detail/open-detail states and summary row normalization", () => {
    const loaded = completeApprovalRequestDetailLoadState(
      createDefaultApprovalRequestState("approval-request-001"),
      summary,
    );
    const opening = startApprovalRequestOpenDetailState(loaded);
    const failed = failApprovalRequestOpenDetailState(
      opening,
      "目前無法開啟審核詳情，請稍後再試。",
    );

    expect(loaded).toMatchObject({
      detailStatus: "available",
      openDetailStatus: "idle",
      status: "pending",
      riskLevel: "high",
      actionSummary: {
        toolName: "mock.orders.cancel",
        dryRun: false,
      },
      payloadSummary: {
        targetEntityId: "SO-10001",
      },
    });
    expect(JSON.stringify(loaded)).not.toContain("rawApprovalPayload");
    expect(JSON.stringify(loaded)).not.toContain("hidden");
    expect(opening.openDetailStatus).toBe("opening");
    expect(failed).toMatchObject({
      openDetailStatus: "failed",
      openDetailSafeMessage: "目前無法開啟審核詳情，請稍後再試。",
    });
    expect(normalizeApprovalSummaryRows(loaded.actionSummary)).toEqual([
      {
        key: "toolName",
        label: "toolName",
        value: "mock.orders.cancel",
      },
      {
        key: "dryRun",
        label: "dryRun",
        value: "false",
      },
    ]);
  });

  it("keeps approval labels and callback payloads safe and ID-only", () => {
    const loaded = completeApprovalRequestDetailLoadState(
      createDefaultApprovalRequestState("approval-request-001"),
      summary,
    );

    expect(getApprovalRequestStatusLabel("pending")).toBe("待處理");
    expect(getApprovalRequestStatusLabel("approved")).toBe("已處理");
    expect(getApprovalRequestStatusLabel("rejected")).toBe("未通過");
    expect(getApprovalRequestStatusLabel("cancelled")).toBe("已停止");
    expect(getApprovalRiskLabel("critical")).toBe("重大");

    expect(createOpenApprovalDetailPayload(loaded)).toEqual({
      approvalRequestId: "approval-request-001",
      requestId: "request-approval-001",
      messageId: "message-approval-001",
      sessionId: "session-001",
    });
    expect(createOpenApprovalDetailPayload(loaded)).not.toHaveProperty("url");
    expect(createOpenApprovalDetailPayload(loaded)).not.toHaveProperty("rawApproval");
  });
});

describe("shared runtime feedback/action/approval source boundary", () => {
  it("keeps shared modules library-safe and free of navigation or frontend authority", async () => {
    const sources = await Promise.all([
      readFile("packages/assistant-runtime/src/feedback/index.ts", "utf8"),
      readFile("packages/assistant-runtime/src/actions/index.ts", "utf8"),
      readFile("packages/assistant-runtime/src/approvals/index.ts", "utf8"),
    ]);
    const source = sources.join("\n");

    for (const forbidden of [
      "app/",
      "#app",
      "#imports",
      "useRuntimeConfig",
      "packages/assistant-sdk",
      "router.",
      "window.location",
      "location.href",
      "navigationUrl",
      "deepLink",
      "sourceSystem",
      "connectorId",
      "token:",
      "secret:",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("thins Frontend 001 adapters into shared-runtime delegation points", async () => {
    const [storeSource, chatSource, approvalMessageSource] = await Promise.all([
      readFile("app/stores/assistant/useSessionStore.ts", "utf8"),
      readFile("app/features/assistant/composables/useChat.ts", "utf8"),
      readFile(
        "app/features/assistant/components/ApprovalRequestDisplayMessage.vue",
        "utf8",
      ),
    ]);

    expect(storeSource).toContain("packages/assistant-runtime/src");
    expect(storeSource).toContain("createAssistantRuntimeController");
    expect(storeSource).toContain("runtimeController.completeActionDraftOperation");
    expect(storeSource).toContain("runtimeController.completeApprovalRequestDetailLoad");
    expect(storeSource).toContain("runtimeController.completeFeedbackSubmission");
    expect(storeSource).not.toMatch(/completeActionDraftOperationState|completeApprovalRequestDetailLoadState|completeFeedbackSubmissionState/);
    expect(storeSource).not.toContain("function mapActionDraftOperationStatus");
    expect(storeSource).not.toContain("ACTION_DRAFT_PENDING_GUARD_MESSAGE");

    expect(chatSource).toContain("mapFeedbackValueToRequest");
    expect(chatSource).toContain("packages/assistant-runtime/src");
    expect(chatSource).not.toContain("function mapFeedbackValueToRequest");

    expect(approvalMessageSource).toContain("normalizeApprovalSummaryRows");
    expect(approvalMessageSource).toContain("getApprovalRequestStatusLabel");
    expect(approvalMessageSource).toContain("createOpenApprovalDetailPayload");
    expect(approvalMessageSource).not.toContain("function normalizeSummaryRows");
    expect(approvalMessageSource).not.toContain(
      "switch (props.approvalRequestState?.status)",
    );
  });
});
