import { mountSuspended } from "@nuxt/test-utils/runtime";
import type { VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import ChatMessageArea from "../../../app/features/assistant/components/ChatMessageArea.vue";
import type {
  AssistantStreamingUiMessage,
  AnswerDecisionUiState,
  HistoryMessageSummary,
} from "../../../app/types/assistant";

const mountedWrappers: VueWrapper[] = [];
const createdAt = "2026-07-07T09:00:00.000Z";

function createCompletedStreamingMessage(
  overrides: Partial<AssistantStreamingUiMessage> = {},
): AssistantStreamingUiMessage {
  return {
    key: "stream:safe-state-001",
    messageId: "message-safe-state-001",
    requestId: "req-safe-state-001",
    kind: "assistant_streaming",
    role: "assistant",
    content: "預設的 assistant 回應內容。",
    createdAt,
    status: "completed",
    lastSequence: 2,
    evidence: [],
    finalAnswerDecision: "answered",
    finalDecisionState: {
      kind: "answered",
      answerDecision: "answered",
    } satisfies AnswerDecisionUiState,
    ...overrides,
  };
}

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount();
  }
  document.body.innerHTML = "";
});

describe("ChatMessageArea clarification and no-answer safe states", () => {
  it("renders ClarificationMessage for clarification_required without falling back to answered UI", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          createCompletedStreamingMessage({
            content: "你選取了多筆資料，請指定要查詢哪一筆。",
            finalAnswerDecision: "clarification_required",
            finalDecisionState: {
              kind: "clarification_required",
              answerDecision: "clarification_required",
              clarificationQuestionId: "clarification-001",
            },
          }),
        ],
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-clarification-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-clarification-content"]').text(),
    ).toContain("你選取了多筆資料");
    expect(
      wrapper.get('[data-testid="assistant-clarification-hint"]').text(),
    ).toContain("請直接在下方補充資訊");
    expect(
      wrapper.find('[data-testid="assistant-clarification-question-id"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
  });

  it("renders a safe no-answer state for missing_page_context", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          createCompletedStreamingMessage({
            content: "目前頁面脈絡不足，請補充條件或切換到相關頁面後再試一次。",
            finalAnswerDecision: "no_answer",
            finalDecisionState: {
              kind: "no_answer",
              answerDecision: "no_answer",
              noAnswerReason: "missing_page_context",
            },
          }),
        ],
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-no-answer-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-no-answer-label"]').text(),
    ).toContain("頁面脈絡不足");
    expect(
      wrapper.get('[data-testid="assistant-no-answer-content"]').text(),
    ).toContain("目前頁面脈絡不足");
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
  });

  it("renders a safe no-answer state for no_evidence", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          createCompletedStreamingMessage({
            content: "目前沒有足夠證據可以安全回答。",
            finalAnswerDecision: "no_answer",
            finalDecisionState: {
              kind: "no_answer",
              answerDecision: "no_answer",
              noAnswerReason: "no_evidence",
            },
          }),
        ],
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-no-answer-content"]').text(),
    ).toContain("足夠可信的內部資料");
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(
      false,
    );
  });

  it("renders a safe no-answer state for evidence_conflict without exposing raw payloads", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          createCompletedStreamingMessage({
            content: "找到的資料存在衝突，需要人工確認或提供更多條件。",
            finalAnswerDecision: "no_answer",
            finalDecisionState: {
              kind: "no_answer",
              answerDecision: "no_answer",
              noAnswerReason: "evidence_conflict",
            },
          }),
        ],
      },
    });
    mountedWrappers.push(wrapper);

    const text = wrapper.text().toLowerCase();

    expect(
      wrapper.get('[data-testid="assistant-no-answer-content"]').text(),
    ).toContain("資料存在衝突");
    expect(text).not.toContain("rawevidence");
    expect(text).not.toContain("rawtooloutput");
    expect(text).not.toContain("fulldocumenttext");
    expect(text).not.toContain("public chatbot");
    expect(text).not.toContain("lead");
    expect(text).not.toContain("handoff");
    expect(text).not.toContain("customer service");
  });

  it("routes assistant history clarification and no-answer summaries through the same safe-state registry", async () => {
    const messages = [
      {
        messageId: "message-history-clarification-001",
        role: "assistant",
        content: "請先指定你要查詢哪一筆資料。",
        createdAt,
        answerDecision: "clarification_required",
        evidenceRefs: [],
      },
      {
        messageId: "message-history-no-answer-001",
        role: "assistant",
        content: "目前無法安全回答這個問題。",
        createdAt,
        answerDecision: "no_answer",
        evidenceRefs: [],
      },
    ] satisfies HistoryMessageSummary[];

    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages,
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.findAll('[data-testid="assistant-clarification-message"]'),
    ).toHaveLength(1);
    expect(
      wrapper.findAll('[data-testid="assistant-no-answer-message"]'),
    ).toHaveLength(1);
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(
      false,
    );
  });

  it("renders PermissionDeniedMessage for live permission_denied while keeping assistant avatar and timestamp", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          createCompletedStreamingMessage({
            content: "你目前沒有權限查看這筆資料。",
            finalAnswerDecision: "permission_denied",
            finalDecisionState: {
              kind: "permission_denied",
              answerDecision: "permission_denied",
            },
          }),
        ],
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-permission-denied-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-permission-denied-time"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="assistant-ai-message"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-clarification-message"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-no-answer-message"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
  });

  it("renders PermissionDeniedMessage for history permission_denied", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          {
            messageId: "message-history-permission-denied-001",
            role: "assistant",
            content: "你目前沒有權限查看這筆資料。",
            createdAt,
            answerDecision: "permission_denied",
          } satisfies HistoryMessageSummary,
        ],
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.get('[data-testid="assistant-permission-denied-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-permission-denied-time"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
  });

  it("renders EscalationMessage and ToolFailureMessage on dedicated assistant frames", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        messages: [
          createCompletedStreamingMessage({
            key: "stream:safe-state-escalation-001",
            messageId: "message-safe-state-escalation-001",
            content: "這個請求已升級處理。",
            finalAnswerDecision: "escalation_required",
            finalDecisionState: {
              kind: "escalation_required",
              answerDecision: "escalation_required",
              escalationRequestId: "escalation-001",
            },
          }),
          {
            messageId: "message-history-tool-failure-001",
            role: "assistant",
            content: "目前工具執行失敗，無法安全回答。",
            createdAt,
            answerDecision: "no_answer",
            noAnswerReason: "tool_failure",
          } as HistoryMessageSummary & { noAnswerReason: "tool_failure" },
        ],
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.findAll('[data-testid="assistant-escalation-message"]'),
    ).toHaveLength(1);
    expect(
      wrapper.findAll('[data-testid="assistant-tool-failure-message"]'),
    ).toHaveLength(1);
    expect(
      wrapper.findAll('[data-testid="assistant-message-avatar-assistant"]'),
    ).toHaveLength(2);
    expect(
      wrapper.get('[data-testid="assistant-escalation-time"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-tool-failure-time"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
  });
});
