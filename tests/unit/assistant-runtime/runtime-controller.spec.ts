import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAssistantRuntimeController,
  createAssistantRuntimeStores,
} from "../../../packages/assistant-runtime/src";
import { useChatWidgetStore } from "../../../app/stores/assistant/useChatWidgetStore";
import { useAssistantSessionStore } from "../../../app/stores/assistant/useSessionStore";
import type {
  AssistantRuntimeTransportPort,
} from "../../../packages/assistant-runtime/src";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const absolute = path.join(dir, entry);
    const stats = statSync(absolute);

    if (stats.isDirectory()) {
      return listSourceFiles(absolute);
    }

    return /\.(ts|vue)$/.test(entry) ? [absolute] : [];
  });
}

function createTransport(sessionId: string): Pick<
  AssistantRuntimeTransportPort,
  "createSession" | "loadHistory" | "cancelMessage" | "abortMessage"
> {
  return {
    createSession: vi.fn(async () => ({
      ok: true,
      value: {
        sessionId,
        status: "active",
      },
    })),
    loadHistory: vi.fn(async () => ({
      ok: true,
      value: {
        sessionId,
        cursor: null,
        messages: [
          {
            messageId: `message-${sessionId}`,
            role: "assistant",
            content: `history for ${sessionId}`,
            createdAt: "2026-07-22T00:00:00.000Z",
          },
        ],
      },
    })),
    cancelMessage: vi.fn(async () => ({
      ok: true,
      value: { cancelled: true },
    })),
    abortMessage: vi.fn(async () => ({
      ok: true,
      value: { aborted: true },
    })),
  };
}

describe("assistant runtime stores and controller", () => {
  afterEach(() => {
    vi.useRealTimers();
    setActivePinia(undefined);
  });

  it("creates scoped store instances through the caller-provided Pinia", async () => {
    const explicitPinia = createPinia();
    const ignoredActivePinia = createPinia();
    setActivePinia(ignoredActivePinia);

    const first = createAssistantRuntimeStores({
      pinia: explicitPinia,
      runtimeScope: "runtime-a",
    });
    const second = createAssistantRuntimeStores({
      pinia: explicitPinia,
      runtimeScope: "runtime-a",
    });
    const controller = createAssistantRuntimeController({
      runtimeScope: "runtime-a",
      stores: first,
      transport: createTransport("session-a"),
    });

    await controller.createSession();

    expect(first.pinia).toBe(explicitPinia);
    expect(second.session.sessionId.value).toBe("session-a");
    expect(ignoredActivePinia.state.value).toEqual({});
  });

  it("isolates same-scope state across different Pinia instances and different scopes", () => {
    const firstPinia = createPinia();
    const secondPinia = createPinia();
    const firstScope = createAssistantRuntimeStores({
      pinia: firstPinia,
      runtimeScope: "runtime-shared",
    });
    const secondPiniaSameScope = createAssistantRuntimeStores({
      pinia: secondPinia,
      runtimeScope: "runtime-shared",
    });
    const samePiniaDifferentScope = createAssistantRuntimeStores({
      pinia: firstPinia,
      runtimeScope: "runtime-other",
    });

    firstScope.session.messages.value.push({
      messageId: "local-first",
      role: "assistant",
      content: "first local message",
      createdAt: "2026-07-22T00:00:01.000Z",
    });

    expect(secondPiniaSameScope.session.messages.value).toEqual([]);
    expect(samePiniaDifferentScope.session.messages.value).toEqual([]);
  });

  it("uses the same shared widget state for the Frontend 001 widget facade and runtime controller", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const widgetStore = useChatWidgetStore();
    const runtimeStores = createAssistantRuntimeStores({
      pinia,
      runtimeScope: "frontend001:assistant-session",
    });
    const sessionStore = useAssistantSessionStore();

    widgetStore.open();
    widgetStore.setAvailability("degraded");
    expect(runtimeStores.widget.isOpen.value).toBe(true);
    expect(runtimeStores.widget.availability.value).toBe("degraded");

    runtimeStores.widget.isOpen.value = false;
    runtimeStores.widget.availability.value = "unavailable";
    expect(widgetStore.isOpen).toBe(false);
    expect(widgetStore.availability).toBe("unavailable");

    sessionStore.runtimeController.reset();
    expect(widgetStore.isOpen).toBe(false);
    expect(widgetStore.availability).toBe("normal");
  });

  it("keeps controller-owned capability state isolated even when backend session id is shared", async () => {
    const firstStores = createAssistantRuntimeStores({
      pinia: createPinia(),
      runtimeScope: "runtime-first",
    });
    const secondStores = createAssistantRuntimeStores({
      pinia: createPinia(),
      runtimeScope: "runtime-second",
    });
    const first = createAssistantRuntimeController({
      runtimeScope: "runtime-first",
      stores: firstStores,
      transport: createTransport("shared-backend-session"),
    });
    const second = createAssistantRuntimeController({
      runtimeScope: "runtime-second",
      stores: secondStores,
      transport: createTransport("shared-backend-session"),
    });

    await first.createSession();
    await second.createSession();
    first.appendAssistantStreamingPlaceholder({
      key: "stream:first",
      kind: "assistant_streaming",
      requestId: "request-first",
      messageId: null,
      role: "assistant",
      content: "",
      createdAt: "2026-07-22T00:00:02.000Z",
      status: "sending",
      evidence: [],
      lastSequence: null,
    });
    first.setStreamingRequest("request-first", "stream:first");
    first.applyStreamingEvent({
      requestId: "request-first",
      sessionId: "shared-backend-session",
      messageId: "message-first",
      eventType: "answer_delta",
      sequence: 1,
      data: { delta: "first answer" },
    });
    first.startFeedbackSubmission("message-first", "helpful", "request-first");
    first.startActionDraftDetailLoad("action-first", {
      requestId: "request-first",
      messageId: "message-first",
    });
    first.startApprovalRequestDetailLoad("approval-first", {
      requestId: "request-first",
      messageId: "message-first",
      sessionId: "shared-backend-session",
    });

    expect(firstStores.session.sessionId.value).toBe(secondStores.session.sessionId.value);
    expect(firstStores.session.messages.value).toHaveLength(1);
    expect(secondStores.session.messages.value).toEqual([]);
    expect(firstStores.session.feedbackByMessageId.value["message-first"]?.pending).toBe(true);
    expect(secondStores.session.feedbackByMessageId.value).toEqual({});
    expect(firstStores.session.actionDraftById.value["action-first"]?.detailStatus).toBe("loading");
    expect(secondStores.session.actionDraftById.value).toEqual({});
    expect(firstStores.session.approvalRequestById.value["approval-first"]?.detailStatus).toBe("loading");
    expect(secondStores.session.approvalRequestById.value).toEqual({});
  });

  it("cleans timers and pending session operations, suppresses late mutation, and can reset for reuse", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | null = null;
    let resolveCreateSession: ((value: Awaited<ReturnType<AssistantRuntimeTransportPort["createSession"]>>) => void) | null = null;
    const transport = createTransport("session-cleanup");
    transport.createSession = vi.fn((_input, options) => {
      capturedSignal = options?.signal ?? null;
      return new Promise((resolve) => {
        resolveCreateSession = resolve;
      });
    });
    const stores = createAssistantRuntimeStores({
      pinia: createPinia(),
      runtimeScope: "runtime-cleanup",
    });
    const sseRunner = {
      reset: vi.fn(async () => {}),
    };
    const controller = createAssistantRuntimeController({
      runtimeScope: "runtime-cleanup",
      stores,
      transport,
      sseRunner,
    });

    const pendingCreate = controller.createSession();
    controller.appendAssistantStreamingPlaceholder({
      key: "stream:cleanup",
      kind: "assistant_streaming",
      requestId: "request-cleanup",
      messageId: null,
      role: "assistant",
      content: "",
      createdAt: "2026-07-22T00:00:03.000Z",
      status: "sending",
      typingVisibleUntil: Date.now() + 600,
      pendingContent: "",
      evidence: [],
      lastSequence: null,
    });
    controller.setStreamingRequest("request-cleanup", "stream:cleanup");
    controller.applyStreamingEvent({
      requestId: "request-cleanup",
      sessionId: "session-cleanup",
      messageId: "message-cleanup",
      eventType: "answer_delta",
      sequence: 1,
      data: { delta: "late answer" },
    });

    await controller.cleanup();
    await controller.cleanup();
    resolveCreateSession?.({
      ok: true,
      value: { sessionId: "late-session", status: "active" },
    });
    await pendingCreate;

    expect(capturedSignal?.aborted).toBe(true);
    expect(stores.session.session.value).toBeNull();
    expect(stores.session.messages.value).toEqual([]);
    expect(sseRunner.reset).toHaveBeenCalledTimes(1);

    transport.createSession = vi.fn(async (_input, options) => {
      capturedSignal = options?.signal ?? null;
      return {
        ok: true,
        value: { sessionId: "session-cleanup", status: "active" },
      };
    });
    controller.reset();
    await controller.createSession();
    expect(stores.session.sessionId.value).toBe("session-cleanup");
  });

  it("guards feedback, action, and approval mutations after cleanup and stale lifecycle completion", async () => {
    const stores = createAssistantRuntimeStores({
      pinia: createPinia(),
      runtimeScope: "runtime-capability-cleanup",
    });
    const controller = createAssistantRuntimeController({
      runtimeScope: "runtime-capability-cleanup",
      stores,
      transport: createTransport("session-capability-cleanup"),
      idGenerator: () => "operation-001",
    });

    controller.startFeedbackSubmission("message-feedback", "helpful", "request-feedback");
    controller.startActionDraftDetailLoad("action-cleanup", {
      requestId: "request-action",
      messageId: "message-action",
    });
    controller.startApprovalRequestDetailLoad("approval-cleanup", {
      requestId: "request-approval",
      messageId: "message-approval",
    });
    controller.startApprovalRequestOpenDetail("approval-open-cleanup");

    await controller.cleanup();
    controller.completeFeedbackSubmission("message-feedback", {
      requestId: "request-feedback",
    });
    controller.failFeedbackSubmission("message-feedback", null, "request-feedback", "late feedback");
    controller.completeActionDraftDetailLoad({
      actionDraftId: "action-cleanup",
      requestId: "request-action",
      messageId: "message-action",
      status: "waiting_confirmation",
      riskLevel: "medium",
      toolName: "tool",
      resource: "resource",
      operation: "operation",
    });
    controller.failActionDraftDetailLoad("action-cleanup", "late action");
    controller.completeApprovalRequestDetailLoad({
      approvalRequestId: "approval-cleanup",
      requestId: "request-approval",
      messageId: "message-approval",
      status: "pending",
      riskLevel: "high",
      requesterActorId: "actor-001",
    });
    controller.failApprovalRequestOpenDetail("approval-open-cleanup", "late approval");

    expect(stores.session.feedbackByMessageId.value).toEqual({});
    expect(stores.session.actionDraftById.value).toEqual({});
    expect(stores.session.approvalRequestById.value).toEqual({});

    controller.reset();
    controller.startFeedbackSubmission("message-feedback", "not_helpful", "request-new");
    controller.completeFeedbackSubmission("message-feedback", {
      requestId: "request-feedback",
    });
    expect(stores.session.feedbackByMessageId.value["message-feedback"]).toMatchObject({
      value: "not_helpful",
      pending: true,
      requestId: "request-new",
    });
  });

  it("rejects stale and untracked action detail and operation completions", async () => {
    const stores = createAssistantRuntimeStores({
      pinia: createPinia(),
      runtimeScope: "runtime-action-stale",
    });
    const controller = createAssistantRuntimeController({
      runtimeScope: "runtime-action-stale",
      stores,
      transport: createTransport("session-action-stale"),
      idGenerator: (() => {
        const keys = ["confirm-old", "confirm-new"];
        return () => keys.shift() ?? "confirm-extra";
      })(),
    });

    controller.startActionDraftDetailLoad("action-detail", {
      requestId: "request-old",
      messageId: "message-old",
    });
    await controller.cleanup();
    controller.reset();
    controller.startActionDraftDetailLoad("action-detail", {
      requestId: "request-new",
      messageId: "message-new",
    });

    controller.completeActionDraftDetailLoad({
      actionDraftId: "action-detail",
      requestId: "request-old",
      messageId: "message-old",
      status: "waiting_confirmation",
      riskLevel: "medium",
      toolName: "tool",
      resource: "resource",
      operation: "old operation",
    });
    controller.failActionDraftDetailLoad("action-detail", "old failure", {
      requestId: "request-old",
    });

    expect(controller.getActionDraftState("action-detail")).toMatchObject({
      detailStatus: "loading",
      requestId: "request-new",
      messageId: "message-new",
    });

    controller.completeActionDraftDetailLoad({
      actionDraftId: "action-detail",
      requestId: "request-new",
      messageId: "message-new",
      status: "waiting_confirmation",
      riskLevel: "medium",
      toolName: "tool",
      resource: "resource",
      operation: "new operation",
    });
    expect(controller.getActionDraftState("action-detail")).toMatchObject({
      detailStatus: "available",
      requestId: "request-new",
      detail: { operation: "new operation" },
    });

    const oldConfirmation = controller.prepareActionDraftConfirmation("action-detail");
    expect(oldConfirmation).toMatchObject({ allowed: true, idempotencyKey: "confirm-old" });
    controller.setActionDraftOperationStatus("action-detail", "confirming", {
      idempotencyKey: oldConfirmation.idempotencyKey,
    });
    await controller.cleanup();
    controller.reset();
    controller.startActionDraftDetailLoad("action-detail", {
      requestId: "request-fresh",
      messageId: "message-fresh",
    });
    controller.completeActionDraftDetailLoad({
      actionDraftId: "action-detail",
      requestId: "request-fresh",
      messageId: "message-fresh",
      status: "waiting_confirmation",
      riskLevel: "medium",
      toolName: "tool",
      resource: "resource",
      operation: "fresh operation",
    });

    const newConfirmation = controller.prepareActionDraftConfirmation("action-detail");
    expect(newConfirmation).toMatchObject({ allowed: true, idempotencyKey: "confirm-new" });
    controller.setActionDraftOperationStatus("action-detail", "confirming", {
      idempotencyKey: newConfirmation.idempotencyKey,
    });
    controller.completeActionDraftOperation("action-detail", "executed", {
      idempotencyKey: oldConfirmation.idempotencyKey,
    });
    controller.failActionDraftOperation("action-detail", "old failure", "failed", {
      idempotencyKey: oldConfirmation.idempotencyKey,
    });

    expect(controller.getActionDraftState("action-detail")).toMatchObject({
      operationStatus: "confirming",
      idempotencyKey: "confirm-new",
    });

    controller.completeActionDraftOperation("action-detail", "executed", {
      idempotencyKey: newConfirmation.idempotencyKey,
    });
    expect(controller.getActionDraftState("action-detail")).toMatchObject({
      operationStatus: "executed",
      idempotencyKey: "confirm-new",
    });

    const beforeUntracked = controller.getActionDraftState("action-untracked");
    controller.completeActionDraftDetailLoad({
      actionDraftId: "action-untracked",
      requestId: "request-untracked",
      messageId: "message-untracked",
      status: "waiting_confirmation",
      riskLevel: "medium",
      toolName: "tool",
      resource: "resource",
      operation: "untracked",
    });
    controller.failActionDraftDetailLoad("action-untracked", "untracked failure", {
      requestId: "request-untracked",
    });
    controller.completeActionDraftOperation("action-untracked", "executed", {
      idempotencyKey: "untracked-key",
    });
    controller.failActionDraftOperation("action-untracked", "untracked failure", "failed", {
      idempotencyKey: "untracked-key",
    });
    expect(controller.getActionDraftState("action-untracked")).toEqual(beforeUntracked);
  });

  it("centralizes feedback, action, and approval eligibility in the shared controller", () => {
    const stores = createAssistantRuntimeStores({
      pinia: createPinia(),
      runtimeScope: "runtime-eligibility",
    });
    const controller = createAssistantRuntimeController({
      runtimeScope: "runtime-eligibility",
      stores,
      transport: createTransport("session-eligibility"),
      idGenerator: () => "operation-eligibility",
    });

    expect(controller.prepareFeedbackSubmission({
      messageId: "message-feedback",
      value: "helpful",
      requestId: "request-feedback",
    })).toMatchObject({ allowed: true, previousValue: null, linkedRequestId: "request-feedback" });
    controller.startFeedbackSubmission("message-feedback", "helpful", "request-feedback");
    expect(controller.prepareFeedbackSubmission({
      messageId: "message-feedback",
      value: "not_helpful",
    })).toMatchObject({ allowed: false, reason: "pending" });
    controller.failFeedbackSubmission("message-feedback", null, "request-feedback", "failed");
    expect(controller.prepareFeedbackSubmission({
      messageId: "message-feedback",
      value: "helpful",
    })).toMatchObject({ allowed: true });
    controller.startFeedbackSubmission("message-feedback", "helpful", "request-feedback-2");
    controller.completeFeedbackSubmission("message-feedback", { requestId: "request-feedback-2" });
    expect(controller.prepareFeedbackSubmission({
      messageId: "message-feedback",
      value: "helpful",
    })).toMatchObject({ allowed: false, reason: "unchanged" });

    expect(controller.prepareActionDraftConfirmation("action-eligibility"))
      .toMatchObject({ allowed: false, reason: "detail_unavailable" });
    controller.startActionDraftDetailLoad("action-eligibility", {
      requestId: "request-action",
      messageId: "message-action",
    });
    controller.completeActionDraftDetailLoad({
      actionDraftId: "action-eligibility",
      requestId: "request-action",
      messageId: "message-action",
      status: "waiting_confirmation",
      riskLevel: "medium",
      toolName: "tool",
      resource: "resource",
      operation: "operation",
    });
    expect(controller.prepareActionDraftConfirmation("action-eligibility"))
      .toMatchObject({ allowed: true, idempotencyKey: "operation-eligibility" });
    controller.setActionDraftOperationStatus("action-eligibility", "confirming", {
      idempotencyKey: "operation-eligibility",
    });
    expect(controller.prepareActionDraftCancellation("action-eligibility"))
      .toMatchObject({ allowed: false, reason: "pending" });
    controller.completeActionDraftOperation("action-eligibility", "executed", {
      idempotencyKey: "operation-eligibility",
    });
    expect(controller.prepareActionDraftConfirmation("action-eligibility"))
      .toMatchObject({ allowed: false, reason: "terminal" });

    expect(controller.prepareApprovalRequestDetailLoad("approval-eligibility"))
      .toMatchObject({ allowed: true });
    controller.startApprovalRequestDetailLoad("approval-eligibility", {
      requestId: "request-approval",
      messageId: "message-approval",
    });
    expect(controller.prepareApprovalRequestDetailLoad("approval-eligibility"))
      .toMatchObject({ allowed: false, reason: "loading" });
    controller.completeApprovalRequestDetailLoad({
      approvalRequestId: "approval-eligibility",
      requestId: "request-approval",
      messageId: "message-approval",
      status: "pending",
      riskLevel: "high",
      requesterActorId: "actor-001",
    });
    expect(controller.prepareApprovalRequestDetailLoad("approval-eligibility"))
      .toMatchObject({ allowed: false, reason: "available" });
    expect(controller.prepareApprovalRequestOpenDetail("approval-eligibility"))
      .toMatchObject({ allowed: true });
    controller.startApprovalRequestOpenDetail("approval-eligibility");
    expect(controller.prepareApprovalRequestOpenDetail("approval-eligibility"))
      .toMatchObject({ allowed: false, reason: "opening" });
  });

  it("keeps shared runtime library-safe and out of productized widget ownership", () => {
    const sourceFiles = listSourceFiles(path.join(repoRoot, "packages/assistant-runtime/src"));
    const combinedSource = sourceFiles
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(sourceFiles.some(file => file.endsWith("stores/index.ts"))).toBe(true);
    expect(sourceFiles.some(file => file.endsWith("runtime/index.ts"))).toBe(true);
    expect(combinedSource).toContain("defineStore");
    expect(combinedSource).not.toMatch(/from\s+["'][^"']*app\//);
    expect(combinedSource).not.toMatch(/useRuntimeConfig|useNuxtApp|#app|#imports|getActivePinia|setActivePinia/);
    expect(combinedSource).not.toMatch(/mountAssistantWidget|AssistantWidget\.vue|AssistantRuntimeRoot\.vue/);
    expect(combinedSource).not.toMatch(/packages\/assistant-sdk/);
  });

  it("proves Frontend 001 production code delegates runtime ownership instead of retaining canonical owners", () => {
    const sessionStoreSource = readFileSync(
      path.join(repoRoot, "app/stores/assistant/useSessionStore.ts"),
      "utf8",
    );
    const chatSource = readFileSync(
      path.join(repoRoot, "app/features/assistant/composables/useChat.ts"),
      "utf8",
    );

    expect(sessionStoreSource).toContain("createAssistantRuntimeStores");
    expect(sessionStoreSource).toContain("createAssistantRuntimeController");
    expect(chatSource).toContain("prepareFeedbackSubmission");
    expect(chatSource).toContain("prepareActionDraftConfirmation");
    expect(chatSource).toContain("prepareApprovalRequestDetailLoad");
    expect(chatSource).toContain("runtimeController");
    expect(sessionStoreSource).not.toMatch(/startFeedbackSubmissionState|completeFeedbackSubmissionState|failFeedbackSubmissionState/);
    expect(sessionStoreSource).not.toMatch(/startActionDraftDetailLoadState|completeActionDraftOperationState|failActionDraftOperationState/);
    expect(sessionStoreSource).not.toMatch(/startApprovalRequestDetailLoadState|completeApprovalRequestOpenDetailState|failApprovalRequestOpenDetailState/);
    expect(sessionStoreSource).not.toMatch(/function applyStreamingEvent|function finalizeActiveStreamingMessage|pendingRevealTimers/);
    expect(chatSource).not.toMatch(/startFeedbackSubmissionState|setActionDraftOperationState|startApprovalRequestOpenDetailState/);
    expect(chatSource).not.toMatch(/operationStatus === "confirming"|operationStatus === "cancelling"|actionDraftStatus === "expired"/);
    expect(chatSource).not.toMatch(/currentState\.pending|currentState\.value === input\.value/);
  });
});
