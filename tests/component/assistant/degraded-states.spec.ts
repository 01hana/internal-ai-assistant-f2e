import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it, beforeEach, vi } from "vitest";
import ChatMessageArea from "../../../app/features/assistant/components/ChatMessageArea.vue";
import type {
  AssistantStreamingUiMessage,
  AssistantSystemStateMessage,
} from "../../../app/types/assistant";

const createdAt = "2026-07-09T10:00:00.000Z";

function createInterruptedMessage(
  overrides: Partial<AssistantStreamingUiMessage> = {},
): AssistantStreamingUiMessage {
  return {
    key: "stream:interrupted-001",
    requestId: "req-interrupted-001",
    messageId: "message-interrupted-001",
    kind: "assistant_streaming",
    role: "assistant",
    content: "這是一段尚未完成的內容。",
    createdAt,
    status: "interrupted",
    lastSequence: 1,
    evidence: [],
    ...overrides,
  };
}

function createDegradedMessage(
  overrides: Partial<AssistantSystemStateMessage> = {},
): AssistantSystemStateMessage {
  return {
    key: "system:degraded-state",
    kind: "degraded",
    role: "assistant",
    safeTitle: "助理服務暫時不穩定",
    degradedKind: "degraded",
    content: "目前無法完成這次回覆，請稍後再試。",
    createdAt,
    ...overrides,
  };
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("degraded and interrupted assistant states", () => {
  it("renders interrupted terminal messages with assistant avatar, timestamp, and retry foundation", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        contextReady: true,
        messages: [createInterruptedMessage()],
      },
    });

    expect(wrapper.get('[data-testid="assistant-interrupted-message"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="assistant-interrupted-title"]').text()).toContain("回覆已中斷");
    expect(wrapper.get('[data-testid="assistant-interrupted-description"]').text()).toContain("尚未完成");
    expect(wrapper.get('[data-testid="assistant-interrupted-partial"]').text()).toContain("尚未完成的內容");
    expect(wrapper.get('[data-testid="assistant-interrupted-time"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-feedback-controls"]').exists()).toBe(false);

    await wrapper.get('[data-testid="assistant-interrupted-retry"]').trigger("click");

    expect(wrapper.emitted("retryRequested")).toEqual([
      [{ key: "stream:interrupted-001", requestId: "req-interrupted-001" }],
    ]);
  });

  it("shows retrying state for interrupted and degraded retry actions", async () => {
    const interruptedWrapper = await mountSuspended(ChatMessageArea, {
      props: {
        contextReady: true,
        retryingMessageKey: "stream:interrupted-001",
        messages: [createInterruptedMessage()],
      },
    });

    const interruptedRetry = interruptedWrapper.get(
      '[data-testid="assistant-interrupted-retry"]',
    );
    expect(interruptedRetry.attributes("disabled")).toBeDefined();
    expect(interruptedRetry.text()).toContain("正在重新送出");

    const degradedWrapper = await mountSuspended(ChatMessageArea, {
      props: {
        contextReady: true,
        retryingMessageKey: "system:degraded-state",
        messages: [createDegradedMessage()],
      },
    });

    const degradedRetry = degradedWrapper.get(
      '[data-testid="assistant-degraded-retry"]',
    );
    expect(degradedRetry.attributes("disabled")).toBeDefined();
    expect(degradedRetry.text()).toContain("正在重新送出");
  });

  it("renders cancelled streams as an interrupted safe copy", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        contextReady: true,
        messages: [
          createInterruptedMessage({
            key: "stream:cancelled-001",
            requestId: "req-cancelled-001",
            status: "cancelled",
            content: "",
          }),
        ],
      },
    });

    expect(wrapper.get('[data-testid="assistant-interrupted-title"]').text()).toContain("回覆已停止");
    expect(wrapper.find('[data-testid="assistant-interrupted-partial"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false);
  });

  it("renders failed partial streams as interrupted instead of answered", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        contextReady: true,
        messages: [
          createInterruptedMessage({
            key: "stream:failed-001",
            requestId: "req-failed-001",
            status: "failed",
          }),
        ],
      },
    });

    expect(wrapper.get('[data-testid="assistant-interrupted-title"]').text()).toContain("回覆未能完成");
    expect(wrapper.get('[data-testid="assistant-interrupted-partial"]').text()).toContain("尚未完成的內容");
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-feedback-controls"]').exists()).toBe(false);
  });

  it("renders degraded and unavailable system safe states without raw errors", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        contextReady: true,
        messages: [
          createDegradedMessage(),
          createDegradedMessage({
            key: "system:degraded-unavailable",
            degradedKind: "unavailable",
            safeTitle: "助理暫時無法使用",
          }),
        ],
      },
    });

    const titles = wrapper.findAll('[data-testid="assistant-degraded-title"]').map(node => node.text());
    expect(titles).toEqual([
      "助理服務暫時不穩定",
      "助理暫時無法使用",
    ]);
    expect(wrapper.text()).not.toContain("stack");
    expect(wrapper.text()).not.toContain("rawError");
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-feedback-controls"]').exists()).toBe(false);
  });

  it("keeps unknown event fallback non-final and out of answered rendering", async () => {
    const wrapper = await mountSuspended(ChatMessageArea, {
      props: {
        contextReady: true,
        messages: [
          {
            key: "stream:unknown-001",
            requestId: "req-unknown-001",
            messageId: "message-unknown-001",
            kind: "assistant_streaming",
            role: "assistant",
            content: "",
            createdAt,
            status: "streaming",
            lastSequence: 2,
            evidence: [],
            activities: [
              {
                key: "unknown:2",
                kind: "unknown_event",
                sequence: 2,
                label: "收到未識別的進度更新，已安全略過",
              },
            ],
          } satisfies AssistantStreamingUiMessage,
        ],
      },
    });

    expect(wrapper.text()).toContain("收到未識別的進度更新，已安全略過");
    expect(wrapper.find('[data-testid="assistant-streaming-finalized"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false);
  });
});
