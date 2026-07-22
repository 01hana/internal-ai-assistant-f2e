import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function readSource(relativePath: string): Promise<string> {
  return readFile(new URL(`../../../${relativePath}`, import.meta.url), "utf8");
}

describe("Frontend 001 runtime integration adapter boundary", () => {
  it("keeps useChat as Nuxt/app glue over Shared Runtime and AssistantService", async () => {
    const source = await readSource("app/features/assistant/composables/useChat.ts");

    expect(source).toContain("useRuntimeConfig");
    expect(source).toContain("AssistantService");
    expect(source).toContain("useAssistantHostContext");
    expect(source).toContain("useAssistantSession");
    expect(source).toContain("useAssistantSseStream");
    expect(source).toContain("runtimeController");

    expect(source).toContain("prepareFeedbackSubmission");
    expect(source).toContain("prepareActionDraftConfirmation");
    expect(source).toContain("prepareActionDraftCancellation");
    expect(source).toContain("prepareApprovalRequestOpenDetail");
    expect(source).toContain("applyStreamingEvent");
    expect(source).toContain("finalizeActiveStreamingMessage");

    const forbiddenOwnerPatterns = [
      /\bparseAssistantSse\b/,
      /\bcreateAssistantSseStreamRunner\b/,
      /\bmapAnswerDecisionState\b/,
      /\bnormalizeEvidenceReferences\b/,
      /\bcreateTerminalOutcome\b/,
      /\bstartFeedbackSubmissionState\b/,
      /\bcreateDefaultActionDraftState\b/,
      /\bcreateDefaultApprovalRequestState\b/,
      /\bdefineStore\b/,
      /\bcreatePinia\b/,
      /\bChatPanel\b/,
      /\bChatMessageArea\b/,
      /\bChatInputBar\b/,
    ];

    const violations = forbiddenOwnerPatterns
      .filter((pattern) => pattern.test(source))
      .map(String);

    expect(violations).toEqual([]);
  });

  it("keeps useChat action surfaces as Shared Runtime delegation plus transport calls", async () => {
    const source = await readSource("app/features/assistant/composables/useChat.ts");
    const feedbackSection = source.slice(
      source.indexOf("async function submitFeedback"),
      source.indexOf("async function openApprovalDetail"),
    );
    const actionSection = source.slice(
      source.indexOf("async function loadActionDraftDetail"),
      source.indexOf("async function submitFeedback"),
    );
    const approvalSection = source.slice(
      source.indexOf("async function loadApprovalRequestDetail"),
      source.lastIndexOf("return {"),
    );

    expect(feedbackSection).toContain("runtimeController.prepareFeedbackSubmission");
    expect(feedbackSection).toContain("runtimeController.startFeedbackSubmission");
    expect(feedbackSection).toContain("assistantService.submitFeedback");

    expect(actionSection).toContain("runtimeController.prepareActionDraftConfirmation");
    expect(actionSection).toContain("runtimeController.prepareActionDraftCancellation");
    expect(actionSection).toContain("assistantService.getActionDraft");
    expect(actionSection).toContain("assistantService.confirmActionDraft");
    expect(actionSection).toContain("assistantService.cancelActionDraft");
    expect(actionSection).not.toMatch(/actionDraftStatus\s*===|operationStatus\s*===/);

    expect(approvalSection).toContain("runtimeController.prepareApprovalRequestDetailLoad");
    expect(approvalSection).toContain("runtimeController.prepareApprovalRequestOpenDetail");
    expect(approvalSection).toContain("assistantService.getApprovalRequest");
    expect(approvalSection).toContain("hostContext.openApprovalDetail");
    expect(approvalSection).not.toMatch(/window\.location|useRouter|router\.push|href\s*:/);
  });

  it("keeps useAssistantHostContext as a sanitized host snapshot adapter", async () => {
    const source = await readSource("app/features/assistant/composables/useAssistantHostContext.ts");

    expect(source).toContain("provider.getSnapshot");
    expect(source).toContain("sanitizePageContext");
    expect(source).toContain("resolveDefaultSessionScope");
    expect(source).toContain("onOpenApprovalDetail");

    const forbiddenAuthorityPatterns = [
      /\bAssistantService\b/,
      /\bcreateHttpClient\b/,
      /\bfetch\s*\(/,
      /\bsourceSystem\b/,
      /\bconnector(?:Id)?\b/,
      /\badapter(?:Id)?\b/,
      /\bpermissionResult\b/,
      /\brawEvidence\b/,
      /\brawConnectorPayload\b/,
      /\bhiddenPrompt\b/,
      /\bmessageText\b/,
      /\bwindow\.location\b/,
      /\buseRouter\b/,
      /\brouter\.push\b/,
      /\bhref\s*:/,
      /\burl\s*:/,
    ];

    const violations = forbiddenAuthorityPatterns
      .filter((pattern) => pattern.test(source))
      .map(String);

    expect(violations).toEqual([]);
  });
});
