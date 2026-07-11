import {
  mockNuxtImport,
  mountSuspended,
} from "@nuxt/test-utils/runtime";
import { flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import ChatInputBar from "../../../app/features/assistant/components/ChatInputBar.vue";
import ChatWidget from "../../../app/features/assistant/components/ChatWidget.vue";
import PreviewPage from "../../../app/pages/index.vue";
import { useAssistantSessionStore } from "../../../app/stores/assistant/useSessionStore";
import { useChatWidgetStore } from "../../../app/stores/assistant/useChatWidgetStore";
import type {
  ActionDraftDetailState,
  ApprovalRequestDetailState,
  AssistantHostContextProvider,
  AssistantHostContextSnapshot,
  AssistantSession,
  AssistantSseEvent,
  AssistantSuccessEnvelope,
} from "../../../app/types/assistant";
import {
  contextNotReadySnapshot,
  entityHostContextSnapshot,
  pageHostContextSnapshot,
} from "../../fixtures/assistant-api/host-context";

const mountedWrappers: VueWrapper[] = [];
const runtimeConfigMock = vi.hoisted(() => ({
  apiBase: "",
}));
let scrollToMock: ReturnType<typeof vi.fn>;
let scrollIntoViewMock: ReturnType<typeof vi.fn>;

mockNuxtImport("useRuntimeConfig", original => () => {
  const config = original();

  return {
    ...config,
    public: {
      ...config.public,
      apiBase: runtimeConfigMock.apiBase,
    },
  };
});

const createdSession = {
  sessionId: "session-send-001",
  title: "Send session",
  status: "active",
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
} satisfies AssistantSession;

const MIN_TYPING_VISIBILITY_MS = 600;

const latestPageSnapshot = {
  ...pageHostContextSnapshot,
  pageContext: {
    ...pageHostContextSnapshot.pageContext,
    route: "/orders?status=pending#queue",
    activeFilters: [{ field: "status", value: "pending" }],
    selectedRows: [{ id: "SO-20002" }],
  },
} satisfies AssistantHostContextSnapshot;

function createJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function createCreatedJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 201,
    headers: {
      "content-type": "application/json",
    },
  });
}

function createSessionEnvelope() {
  return {
    requestId: "request-session-create-001",
    data: createdSession,
  } satisfies AssistantSuccessEnvelope<AssistantSession>;
}

function createPendingSseResponse(onCancel = vi.fn()): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel: onCancel,
    }),
    {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
      },
    },
  );
}

function serializeSseEvent(event: AssistantSseEvent | Record<string, unknown>) {
  return `event: ${String(event.eventType)}\ndata: ${JSON.stringify(event)}\n\n`;
}

function createSseResponse(
  events: Array<AssistantSseEvent | Record<string, unknown>>,
  options: {
    keepOpen?: boolean;
    onCancel?: ReturnType<typeof vi.fn>;
  } = {},
): Response {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(serializeSseEvent(event)));
        }

        if (!options.keepOpen) {
          controller.close();
        }
      },
      cancel: options.onCancel,
    }),
    {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
      },
    },
  );
}

function createProvider(
  sendSnapshot: AssistantHostContextSnapshot = latestPageSnapshot,
  restoreSnapshot: AssistantHostContextSnapshot = pageHostContextSnapshot,
  options: {
    onOpenApprovalDetail?: (
      payload: {
        approvalRequestId: string;
        requestId?: string;
        messageId?: string;
        sessionId?: string;
      },
    ) => void | Promise<void>;
  } = {},
): AssistantHostContextProvider & {
  getSnapshot: ReturnType<typeof vi.fn>;
} {
  return {
    getSnapshot: vi.fn(({ purpose }) => {
      if (purpose === "send") {
        return sendSnapshot;
      }

      if (purpose === "approval_detail") {
        return {
          ...restoreSnapshot,
          onOpenApprovalDetail: options.onOpenApprovalDetail,
        } satisfies AssistantHostContextSnapshot;
      }

      return restoreSnapshot;
    }),
  };
}

function installSendFetch(
  onCancel = vi.fn(),
  baseURL = "/api/v1",
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url === `${baseURL}/assistant/sessions`) {
      return createJsonResponse(createSessionEnvelope());
    }

    if (
      url
      === `${baseURL}/assistant/sessions/${createdSession.sessionId}/messages`
    ) {
      return createPendingSseResponse(onCancel);
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function installEventStreamFetch(
  createEvents: (
    requestId: string,
  ) => Array<AssistantSseEvent | Record<string, unknown>>,
  options: {
    keepOpen?: boolean;
    onCancel?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, requestOptions?: RequestInit) => {
      const url = String(input);

      if (url === "/api/v1/assistant/sessions") {
        return createJsonResponse(createSessionEnvelope());
      }

      if (url === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`) {
        const requestId = new Headers(requestOptions?.headers).get(
          "x-request-id",
        );
        if (!requestId) {
          throw new Error("Missing request ID");
        }

        return createSseResponse(createEvents(requestId), options);
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function mountWidget(
  provider: AssistantHostContextProvider,
): Promise<VueWrapper> {
  const wrapper = await mountSuspended(ChatWidget, {
    attachTo: document.body,
    props: {
      hostContextProvider: provider,
    },
  });
  const nuxtPinia = (wrapper.vm as unknown as { $pinia: Pinia }).$pinia;
  setActivePinia(nuxtPinia);
  useChatWidgetStore().reset();
  useAssistantSessionStore().resetSessionState();
  await nextTick();
  mountedWrappers.push(wrapper);
  return wrapper;
}

async function mountPreviewPage(): Promise<VueWrapper> {
  const wrapper = await mountSuspended(PreviewPage, {
    attachTo: document.body,
  });
  const nuxtPinia = (wrapper.vm as unknown as { $pinia: Pinia }).$pinia;
  setActivePinia(nuxtPinia);
  useChatWidgetStore().reset();
  useAssistantSessionStore().resetSessionState();
  await nextTick();
  mountedWrappers.push(wrapper);
  return wrapper;
}

async function openReadyPanel(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('[data-testid="assistant-launcher"]').trigger("click");
  await flushPromises();
}

async function waitFor(
  predicate: () => boolean,
  message = "condition was not reached",
): Promise<void> {
  for (let index = 0; index < 30; index += 1) {
    if (predicate()) {
      return;
    }
    await Promise.resolve();
  }

  throw new Error(message);
}

describe("ChatInputBar behavior", () => {
  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount();
    }
  });

  it("supports enabled, disabled, Enter, Shift+Enter, and blank guards", async () => {
    const wrapper = await mountSuspended(ChatInputBar, {
      props: {
        modelValue: "",
        canSend: false,
        disabledReason: "context_not_ready",
        isSending: false,
        isStreaming: false,
      },
    });
    mountedWrappers.push(wrapper);

    const textarea = wrapper.get('[data-testid="assistant-chat-input"]');
    expect(textarea.attributes("disabled")).toBeDefined();
    expect(
      wrapper.get('[data-testid="assistant-chat-disabled-reason"]').text(),
    ).toContain("頁面內容尚未就緒");
    expect(
      wrapper.get('[data-testid="assistant-chat-submit"]').attributes(
        "disabled",
      ),
    ).toBeDefined();

    await wrapper.setProps({
      canSend: true,
      disabledReason: null,
    });
    expect(textarea.attributes("disabled")).toBeUndefined();

    await textarea.setValue("   ");
    await wrapper.setProps({ modelValue: "   " });
    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("send")).toBeUndefined();

    await textarea.setValue("查詢目前訂單");
    await wrapper.setProps({ modelValue: "查詢目前訂單" });
    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("send")).toEqual([["查詢目前訂單"]]);

    await textarea.setValue("第一行");
    await wrapper.setProps({ modelValue: "第一行" });
    await textarea.trigger("keydown", {
      key: "Enter",
      shiftKey: true,
    });
    expect(wrapper.emitted("send")).toHaveLength(1);
  });

  it("switches the primary action to cancel while streaming", async () => {
    const wrapper = await mountSuspended(ChatInputBar, {
      props: {
        modelValue: "查詢目前訂單",
        canSend: false,
        disabledReason: "streaming",
        isSending: true,
        isStreaming: true,
      },
    });
    mountedWrappers.push(wrapper);

    expect(
      wrapper.find('[data-testid="assistant-chat-submit"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-chat-disabled-reason"]').exists(),
    ).toBe(false);
    expect(
      wrapper.get('[data-testid="assistant-chat-cancel"]').attributes("aria-label"),
    ).toBe("停止回覆");
    expect(
      wrapper.get('[data-testid="assistant-chat-input"]').attributes("disabled"),
    ).toBeDefined();
    await wrapper.get('[data-testid="assistant-chat-cancel"]').trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });
});

describe("send message orchestration", () => {
beforeEach(() => {
  setActivePinia(createPinia());
  scrollToMock = vi.fn();
  scrollIntoViewMock = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollToMock,
  });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoViewMock,
  });
  window.sessionStorage.clear();
  window.localStorage.clear();
});

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount();
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  it("keeps the composer disabled when context is not ready", async () => {
    const fetchMock = installSendFetch();
    const wrapper = await mountWidget(
      createProvider(contextNotReadySnapshot, contextNotReadySnapshot),
    );

    await wrapper.get('[data-testid="assistant-launcher"]').trigger("click");
    await flushPromises();

    expect(
      wrapper.get('[data-testid="assistant-chat-input"]').attributes(
        "disabled",
      ),
    ).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the composer disabled while session bootstrap is pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // The unresolved create request keeps bootstrap in progress.
          }),
      ),
    );
    const wrapper = await mountWidget(createProvider());

    await wrapper.get('[data-testid="assistant-launcher"]').trigger("click");
    await waitFor(() => useAssistantSessionStore().status === "creating");

    expect(
      wrapper.get('[data-testid="assistant-chat-input"]').attributes(
        "disabled",
      ),
    ).toBeDefined();
  });

  it("sends with latest context, request correlation, and local placeholders", async () => {
    const fetchMock = installSendFetch();
    const provider = createProvider();
    const wrapper = await mountWidget(provider);

    await openReadyPanel(wrapper);

    expect(useAssistantSessionStore().sessionId).toBe(createdSession.sessionId);
    const textarea = wrapper.get('[data-testid="assistant-chat-input"]');
    expect(textarea.attributes("disabled")).toBeUndefined();
    expect(
      wrapper.find('[data-testid="assistant-chat-disabled-reason"]').exists(),
    ).toBe(false);
    await textarea.setValue("  查詢待處理訂單  ");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await waitFor(() => fetchMock.mock.calls.length === 2);
    await nextTick();

    const sendCall = fetchMock.mock.calls[1]!;
    const sendOptions = sendCall[1] as RequestInit;
    const sendHeaders = new Headers(sendOptions.headers);
    const sendBody = JSON.parse(String(sendOptions.body));
    const requestId = sendHeaders.get("x-request-id");

    expect(provider.getSnapshot).toHaveBeenCalledWith({ purpose: "send" });
    expect(requestId).toMatch(/^req-/);
    expect(requestId).not.toBe("req-host-context-001");
    expect(sendHeaders.get("accept")).toBe("text/event-stream");
    expect(sendHeaders.get("content-type")).toBe("application/json");
    expect(sendBody).toEqual({
      message: "查詢待處理訂單",
      pageContext: {
        ...latestPageSnapshot.pageContext,
        route: "/orders",
      },
    });

    const sessionStore = useAssistantSessionStore();
    expect(sessionStore.messages).toHaveLength(2);
    expect(sessionStore.messages[0]).toMatchObject({
      key: `local-user:${requestId}`,
      kind: "user",
      content: "查詢待處理訂單",
      requestId,
    });
    expect(sessionStore.messages[1]).toMatchObject({
      key: `stream:${requestId}`,
      kind: "assistant_streaming",
      status: "streaming",
      requestId,
    });
    expect(
      wrapper
        .get('[data-testid="assistant-user-message"]')
        .classes(),
    ).toContain("justify-end");
    expect(
      wrapper
        .get('[data-testid="assistant-streaming-message"]')
        .classes(),
    ).toContain("justify-start");
    expect(
      wrapper.findAll('[data-testid="assistant-typing-dot"]'),
    ).toHaveLength(3);
    expect(
      wrapper.find('[data-testid="assistant-streaming-content"]').exists(),
    ).toBe(false);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(scrollToMock).toHaveBeenCalled();

    await wrapper.get('[data-testid="assistant-chat-cancel"]').trigger("click");
    await waitFor(() => sessionStore.activeRequestId === null);
    expect(sessionStore.messages[1]).toMatchObject({
      status: "cancelled",
    });
  });

  it("blocks send when the latest context resolves to a different scope", async () => {
    const fetchMock = installSendFetch();
    const wrapper = await mountWidget(
      createProvider(entityHostContextSnapshot),
    );

    await openReadyPanel(wrapper);
    const textarea = wrapper.get('[data-testid="assistant-chat-input"]');
    await textarea.setValue("查詢另一個 scope");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAssistantSessionStore().messages).toHaveLength(0);
    expect(
      wrapper.get('[data-testid="assistant-chat-disabled-reason"]').text(),
    ).toContain("頁面脈絡已變更");
  });

  it("accumulates answer deltas and finalizes only from the final event", async () => {
    vi.useFakeTimers();
    installEventStreamFetch((requestId) => [
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-stream-001",
        eventType: "tool_call_started",
        sequence: 1,
        data: {
          toolCallId: "tool-call-001",
          toolName: "mock.orders.status.read",
        },
      },
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-stream-001",
        eventType: "answer_delta",
        sequence: 2,
        data: {
          delta: "訂單狀態",
        },
      },
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-stream-001",
        eventType: "answer_delta",
        sequence: 3,
        data: {
          delta: "為已確認。",
        },
      },
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-stream-001",
        eventType: "final",
        sequence: 4,
        data: {
          answerDecision: "answered",
          answer: "訂單狀態為已確認。",
          evidenceRefs: [],
        },
      },
    ]);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("查詢訂單狀態");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();

    expect(wrapper.findAll('[data-testid="assistant-typing-dot"]')).toHaveLength(3);
    expect(
      wrapper.find('[data-testid="assistant-streaming-content"]').exists(),
    ).toBe(false);

    await vi.advanceTimersByTimeAsync(MIN_TYPING_VISIBILITY_MS - 100);
    expect(wrapper.findAll('[data-testid="assistant-typing-dot"]')).toHaveLength(3);

    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();
    await nextTick();

    const streamingMessage = useAssistantSessionStore().messages[1];
    expect(streamingMessage).toMatchObject({
      kind: "assistant_streaming",
      messageId: "message-stream-001",
      content: "訂單狀態為已確認。",
      status: "completed",
      finalAnswerDecision: "answered",
      lastSequence: 4,
    });
    expect(wrapper.get('[data-testid="assistant-ai-bubble"]').text()).toContain(
      "訂單狀態為已確認。",
    );
    expect(
      wrapper.get('[data-testid="assistant-ai-answer-decision"]').text(),
    ).toContain("已回答");
    expect(
      wrapper.find('[data-testid="assistant-streaming-finalized"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="assistant-streaming-activity"]').exists()).toBe(false);
    vi.useRealTimers();
  });

  it("uses final payload evidence as the completed answer evidence source", async () => {
    vi.useFakeTimers();
    installEventStreamFetch((requestId) => [
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-evidence-final-001",
        eventType: "evidence_attached",
        sequence: 1,
        data: {
          evidenceRefs: ["evidence-interim-001"],
        },
      },
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-evidence-final-001",
        eventType: "final",
        sequence: 2,
        data: {
          answerDecision: "answered",
          answer: "退貨需先建立退貨申請，再由倉儲確認入庫。",
          evidenceRefs: [
            {
              id: "evidence-document-001",
              sourceType: "document_chunk",
              title: "退貨流程 SOP",
              snippet: "建立退貨申請後，由倉儲確認入庫。",
            },
          ],
        },
      },
    ]);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("退貨流程是什麼？");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    const streamingMessage = useAssistantSessionStore().messages[1];
    expect(streamingMessage).toMatchObject({
      kind: "assistant_streaming",
      finalAnswerDecision: "answered",
      evidence: [
        {
          kind: "summary",
          id: "evidence-document-001",
          sourceType: "document_chunk",
          title: "退貨流程 SOP",
          snippet: "建立退貨申請後，由倉儲確認入庫。",
        },
      ],
    });
    expect(wrapper.find('[data-testid="assistant-evidence-reference"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="assistant-evidence-title"]').text()).toContain(
      "退貨流程 SOP",
    );
    vi.useRealTimers();
  });

  it("submits helpful feedback with optimistic selected state and keeps it after success", async () => {
    vi.useFakeTimers();
    let resolveFeedback: ((response: Response) => void) | null = null;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, requestOptions?: RequestInit) => {
        const url = String(input);

        if (url === "/api/v1/assistant/sessions") {
          return createJsonResponse(createSessionEnvelope());
        }

        if (url === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`) {
          const requestId = new Headers(requestOptions?.headers).get(
            "x-request-id",
          );
          if (!requestId) {
            throw new Error("Missing request ID");
          }

          return createSseResponse([
            {
              requestId,
              sessionId: createdSession.sessionId,
              messageId: "message-feedback-final-001",
              eventType: "final",
              sequence: 1,
              data: {
                answerDecision: "answered",
                answer: "這是可回饋的已回答訊息。",
                evidenceRefs: [],
              },
            },
          ]);
        }

        if (url === "/api/v1/assistant/messages/message-feedback-final-001/feedback") {
          return new Promise<Response>((resolve) => {
            resolveFeedback = resolve;
          });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("請回答並允許回饋");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    const helpfulButton = wrapper.get('[data-testid="assistant-feedback-helpful"]');
    const notHelpfulButton = wrapper.get(
      '[data-testid="assistant-feedback-not-helpful"]',
    );

    await helpfulButton.trigger("click");
    await flushPromises();

    const feedbackCalls = fetchMock.mock.calls.filter(([requestUrl]) =>
      String(requestUrl).includes("/feedback"),
    );
    expect(feedbackCalls).toHaveLength(1);
    expect(String(feedbackCalls[0]?.[0])).toBe(
      "/api/v1/assistant/messages/message-feedback-final-001/feedback",
    );
    expect(
      JSON.parse(String(feedbackCalls[0]?.[1]?.body)),
    ).toEqual({
      rating: "positive",
      intent: "other",
    });
    expect(
      wrapper.get('[data-testid="assistant-feedback-controls"]').attributes("aria-busy"),
    ).toBe("true");
    expect(helpfulButton.attributes("aria-pressed")).toBe("true");
    expect(helpfulButton.attributes("disabled")).toBeDefined();
    expect(notHelpfulButton.attributes("disabled")).toBeDefined();

    resolveFeedback?.(
      createCreatedJsonResponse({
        requestId: "req-feedback-submit-001",
        data: {
          feedbackEventId: "feedback-001",
          messageId: "message-feedback-final-001",
          rating: "positive",
          intent: "other",
          reviewItemId: null,
        },
      }),
    );
    await flushPromises();
    await nextTick();

    const linkedRequestId = useAssistantSessionStore().messages[1]?.requestId;
    expect(
      wrapper.get('[data-testid="assistant-feedback-controls"]').attributes("aria-busy"),
    ).toBe("false");
    expect(
      wrapper.get('[data-testid="assistant-feedback-helpful"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(
      useAssistantSessionStore().feedbackByMessageId["message-feedback-final-001"],
    ).toEqual({
      value: "helpful",
      pending: false,
      error: null,
      requestId: linkedRequestId ?? null,
    });

    await wrapper.get('[data-testid="assistant-feedback-helpful"]').trigger("click");
    expect(
      fetchMock.mock.calls.filter(([requestUrl]) =>
        String(requestUrl).includes("/feedback"),
      ),
    ).toHaveLength(1);
    vi.useRealTimers();
  });

  it("rolls back optimistic feedback on failure and allows retry", async () => {
    vi.useFakeTimers();
    let feedbackAttempt = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, requestOptions?: RequestInit) => {
        const url = String(input);

        if (url === "/api/v1/assistant/sessions") {
          return createJsonResponse(createSessionEnvelope());
        }

        if (url === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`) {
          const requestId = new Headers(requestOptions?.headers).get(
            "x-request-id",
          );
          if (!requestId) {
            throw new Error("Missing request ID");
          }

          return createSseResponse([
            {
              requestId,
              sessionId: createdSession.sessionId,
              messageId: "message-feedback-retry-001",
              eventType: "final",
              sequence: 1,
              data: {
                answerDecision: "answered",
                answer: "這則回答可以測試重試。",
                evidenceRefs: [],
              },
            },
          ]);
        }

        if (url === "/api/v1/assistant/messages/message-feedback-retry-001/feedback") {
          feedbackAttempt += 1;

          if (feedbackAttempt === 1) {
            return new Response(
              JSON.stringify({
                requestId: "req-feedback-error-001",
                error: {
                  code: "assistant_unavailable",
                  message: "Assistant service is temporarily unavailable.",
                },
              }),
              {
                status: 503,
                headers: {
                  "content-type": "application/json",
                },
              },
            );
          }

          return createCreatedJsonResponse({
            requestId: "req-feedback-success-002",
            data: {
              feedbackEventId: "feedback-002",
              messageId: "message-feedback-retry-001",
              rating: "negative",
              intent: "not_helpful",
              reviewItemId: "review-001",
            },
          });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("回答後我要送負向回饋");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    const notHelpfulButton = wrapper.get(
      '[data-testid="assistant-feedback-not-helpful"]',
    );

    await notHelpfulButton.trigger("click");
    await flushPromises();
    await nextTick();

    expect(
      wrapper.get('[data-testid="assistant-feedback-not-helpful"]').attributes("aria-pressed"),
    ).toBe("false");
    expect(
      wrapper.get('[data-testid="assistant-feedback-error"]').text(),
    ).toContain("回饋暫時無法送出");
    expect(
      useAssistantSessionStore().feedbackByMessageId["message-feedback-retry-001"],
    ).toMatchObject({
      value: null,
      pending: false,
      error: "回饋暫時無法送出，請稍後再試。",
    });

    await notHelpfulButton.trigger("click");
    await flushPromises();
    await nextTick();

    expect(
      wrapper.find('[data-testid="assistant-feedback-error"]').exists(),
    ).toBe(false);
    expect(
      wrapper.get('[data-testid="assistant-feedback-not-helpful"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(
      useAssistantSessionStore().feedbackByMessageId["message-feedback-retry-001"],
    ).toMatchObject({
      value: "not_helpful",
      pending: false,
      error: null,
    });
    expect(feedbackAttempt).toBe(2);
    vi.useRealTimers();
  });

  it("renders clarification_required as a clarification safe state instead of an answered bubble", async () => {
    vi.useFakeTimers();
    installEventStreamFetch((requestId) => [
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-clarification-final-001",
        eventType: "final",
        sequence: 1,
        data: {
          answerDecision: "clarification_required",
          clarificationQuestionId: "clarification-001",
          answer: "你選取了多筆資料，請指定要查詢哪一筆。",
          evidenceRefs: [],
        },
      },
    ]);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("幫我查這筆的狀態");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    expect(
      wrapper.get('[data-testid="assistant-clarification-message"]').text(),
    ).toContain("你選取了多筆資料");
    expect(
      wrapper.find('[data-testid="assistant-clarification-question-id"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-ai-message"]').exists(),
    ).toBe(false);
    vi.useRealTimers();
  });

  it("renders confirmation_required as ActionDraftConfirmationMessage instead of an answered bubble", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, requestOptions?: RequestInit) => {
        const url = String(input);

        if (url === "/api/v1/assistant/sessions") {
          return createJsonResponse(createSessionEnvelope());
        }

        if (url === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`) {
          const requestId = new Headers(requestOptions?.headers).get(
            "x-request-id",
          );
          if (!requestId) {
            throw new Error("Missing request ID");
          }

          return createSseResponse([
            {
              requestId,
              sessionId: createdSession.sessionId,
              messageId: "message-confirmation-final-001",
              eventType: "final",
              sequence: 1,
              data: {
                answerDecision: "confirmation_required",
                actionDraftId: "action-draft-001",
                answer: "請確認是否送出此操作。",
                evidenceRefs: [],
              },
            },
          ]);
        }

        if (url === "/api/v1/assistant/action-drafts/action-draft-001") {
          return createJsonResponse({
            requestId: "request-action-draft-detail-001",
            data: {
              actionDraftId: "action-draft-001",
              requestId: "req-action-draft-001",
              messageId: "message-confirmation-final-001",
              status: "waiting_confirmation",
              riskLevel: "medium",
              toolName: "mock.orders.status.update",
              resource: "orders",
              operation: "update",
              preview: {
                targetEntityId: "SO-10001",
                status: "cancelled",
              },
              expiresAt: "2026-07-08T10:15:00.000Z",
            },
          });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("幫我取消這張單");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();
    await waitFor(() =>
      wrapper.find('[data-testid="assistant-action-draft-message"]').exists(),
    );

    expect(
      wrapper.get('[data-testid="assistant-action-draft-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-action-draft-preview"]').text(),
    ).toContain("SO-10001");
    expect(
      wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-action-draft-time"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="assistant-ai-message"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
    vi.useRealTimers();
  });

  it("submits confirm with an idempotencyKey, prevents duplicate pending submits, and shows pending_execution_guard safely", async () => {
    vi.useFakeTimers();
    const confirmRequests: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, requestOptions?: RequestInit) => {
        const url = String(input);
        const method = requestOptions?.method ?? "GET";

        if (url === "/api/v1/assistant/sessions") {
          return createJsonResponse(createSessionEnvelope());
        }

        if (url === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`) {
          const requestId = new Headers(requestOptions?.headers).get(
            "x-request-id",
          );
          if (!requestId) {
            throw new Error("Missing request ID");
          }

          return createSseResponse([
            {
              requestId,
              sessionId: createdSession.sessionId,
              messageId: "message-confirmation-final-001",
              eventType: "final",
              sequence: 1,
              data: {
                answerDecision: "confirmation_required",
                actionDraftId: "action-draft-001",
                answer: "請確認是否送出此操作。",
                evidenceRefs: [],
              },
            },
          ]);
        }

        if (url === "/api/v1/assistant/action-drafts/action-draft-001") {
          return createJsonResponse({
            requestId: "request-action-draft-detail-001",
            data: {
              actionDraftId: "action-draft-001",
              requestId: "req-action-draft-001",
              messageId: "message-confirmation-final-001",
              status: "waiting_confirmation",
              riskLevel: "medium",
              toolName: "mock.orders.status.update",
              resource: "orders",
              operation: "update",
              preview: {
                targetEntityId: "SO-10001",
                status: "cancelled",
              },
              expiresAt: "2026-07-08T10:15:00.000Z",
            },
          });
        }

        if (
          url === "/api/v1/assistant/action-drafts/action-draft-001/confirm"
          && method === "POST"
        ) {
          confirmRequests.push(
            JSON.parse(String(requestOptions?.body ?? "{}")) as Record<string, unknown>,
          );

          return createJsonResponse({
            requestId: "request-action-draft-confirm-001",
            data: {
              actionDraftId: "action-draft-001",
              status: "confirmed",
              duplicateSafe: true,
              recheck: {
                organizationBoundary: "passed",
                draftStatus: "passed",
                freshness: "passed",
                permission: "pending_execution_guard",
                toolContract: "pending_execution_guard",
                idempotency: "reserved",
              },
            },
          });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("幫我取消這張單");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();
    await waitFor(() =>
      wrapper.find('[data-testid="assistant-action-draft-confirm"]').exists(),
    );

    await wrapper.get('[data-testid="assistant-action-draft-confirm"]').trigger("click");
    await nextTick();
    await wrapper.get('[data-testid="assistant-action-draft-confirm"]').trigger("click");
    await flushPromises();
    await nextTick();

    expect(confirmRequests).toHaveLength(1);
    expect(confirmRequests[0]?.idempotencyKey).toEqual(expect.any(String));
    expect(
      wrapper.get('[data-testid="assistant-action-draft-pending-guard"]').text(),
    ).toContain("系統仍在處理");
    expect(
      wrapper.get('[data-testid="assistant-action-draft-confirm"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get('[data-testid="assistant-action-draft-cancel"]').attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.text()).not.toContain("已成功執行");
    vi.useRealTimers();
  });

  it("shows a safe error when confirm fails and keeps the action draft out of answered UI", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, requestOptions?: RequestInit) => {
        const url = String(input);
        const method = requestOptions?.method ?? "GET";

        if (url === "/api/v1/assistant/sessions") {
          return createJsonResponse(createSessionEnvelope());
        }

        if (url === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`) {
          const requestId = new Headers(requestOptions?.headers).get(
            "x-request-id",
          );
          if (!requestId) {
            throw new Error("Missing request ID");
          }

          return createSseResponse([
            {
              requestId,
              sessionId: createdSession.sessionId,
              messageId: "message-confirmation-final-001",
              eventType: "final",
              sequence: 1,
              data: {
                answerDecision: "confirmation_required",
                actionDraftId: "action-draft-001",
                answer: "請確認是否送出此操作。",
                evidenceRefs: [],
              },
            },
          ]);
        }

        if (url === "/api/v1/assistant/action-drafts/action-draft-001") {
          return createJsonResponse({
            requestId: "request-action-draft-detail-001",
            data: {
              actionDraftId: "action-draft-001",
              requestId: "req-action-draft-001",
              messageId: "message-confirmation-final-001",
              status: "waiting_confirmation",
              riskLevel: "medium",
              toolName: "mock.orders.status.update",
              resource: "orders",
              operation: "update",
              preview: {
                targetEntityId: "SO-10001",
              },
              expiresAt: "2026-07-08T10:15:00.000Z",
            },
          });
        }

        if (
          url === "/api/v1/assistant/action-drafts/action-draft-001/confirm"
          && method === "POST"
        ) {
          return new Response(
            JSON.stringify({
              requestId: "request-action-draft-confirm-error-001",
              error: {
                code: "action_draft_unavailable",
                message: "Action draft is temporarily unavailable.",
              },
            }),
            {
              status: 503,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("幫我取消這張單");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();
    await waitFor(() =>
      wrapper.find('[data-testid="assistant-action-draft-confirm"]').exists(),
    );

    await wrapper.get('[data-testid="assistant-action-draft-confirm"]').trigger("click");
    await flushPromises();
    await nextTick();

    expect(
      wrapper.get('[data-testid="assistant-action-draft-operation-error"]').text(),
    ).toContain("請稍後再試");
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false);
    vi.useRealTimers();
  });

  it("submits cancel and shows the cancelled terminal state safely", async () => {
    vi.useFakeTimers();
    const cancelRequests: Array<string> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, requestOptions?: RequestInit) => {
        const url = String(input);
        const method = requestOptions?.method ?? "GET";

        if (url === "/api/v1/assistant/sessions") {
          return createJsonResponse(createSessionEnvelope());
        }

        if (url === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`) {
          const requestId = new Headers(requestOptions?.headers).get(
            "x-request-id",
          );
          if (!requestId) {
            throw new Error("Missing request ID");
          }

          return createSseResponse([
            {
              requestId,
              sessionId: createdSession.sessionId,
              messageId: "message-confirmation-final-001",
              eventType: "final",
              sequence: 1,
              data: {
                answerDecision: "confirmation_required",
                actionDraftId: "action-draft-001",
                answer: "請確認是否送出此操作。",
                evidenceRefs: [],
              },
            },
          ]);
        }

        if (url === "/api/v1/assistant/action-drafts/action-draft-001") {
          return createJsonResponse({
            requestId: "request-action-draft-detail-001",
            data: {
              actionDraftId: "action-draft-001",
              requestId: "req-action-draft-001",
              messageId: "message-confirmation-final-001",
              status: "waiting_confirmation",
              riskLevel: "medium",
              toolName: "mock.orders.status.update",
              resource: "orders",
              operation: "update",
              preview: {
                targetEntityId: "SO-10001",
              },
              expiresAt: "2026-07-08T10:15:00.000Z",
            },
          });
        }

        if (
          url === "/api/v1/assistant/action-drafts/action-draft-001/cancel"
          && method === "POST"
        ) {
          cancelRequests.push(url);
          return createJsonResponse({
            requestId: "request-action-draft-cancel-001",
            data: {
              actionDraftId: "action-draft-001",
              status: "cancelled",
            },
          });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("幫我取消這張單");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();
    await waitFor(() =>
      wrapper.find('[data-testid="assistant-action-draft-cancel"]').exists(),
    );

    await wrapper.get('[data-testid="assistant-action-draft-cancel"]').trigger("click");
    await nextTick();
    await wrapper.get('[data-testid="assistant-action-draft-cancel"]').trigger("click");
    await flushPromises();
    await nextTick();

    expect(cancelRequests).toHaveLength(1);
    expect(
      wrapper.get('[data-testid="assistant-action-draft-terminal-status"]').text(),
    ).toContain("已取消");
    expect(
      wrapper.get('[data-testid="assistant-action-draft-status-copy"]').text(),
    ).toContain("不會繼續");
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false);
    vi.useRealTimers();
  });

  it("renders no_answer as a safe no-answer state instead of an answered bubble", async () => {
    vi.useFakeTimers();
    installEventStreamFetch((requestId) => [
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-no-answer-final-001",
        eventType: "final",
        sequence: 1,
        data: {
          answerDecision: "no_answer",
          noAnswerReason: "evidence_conflict",
          answer: "找到的資料存在衝突，需要人工確認或提供更多條件。",
          evidenceRefs: [],
        },
      },
    ]);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("整理這筆資料的最終狀態");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    expect(
      wrapper.get('[data-testid="assistant-no-answer-message"]').text(),
    ).toContain("資料存在衝突");
    expect(
      wrapper.find('[data-testid="assistant-ai-message"]').exists(),
    ).toBe(false);
    vi.useRealTimers();
  });

  it("renders permission_denied as PermissionDeniedMessage instead of an answered bubble", async () => {
    vi.useFakeTimers();
    installEventStreamFetch((requestId) => [
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-permission-denied-final-001",
        eventType: "final",
        sequence: 1,
        data: {
          answerDecision: "permission_denied",
          answer: "你目前沒有足夠權限查看這項資訊。",
          evidenceRefs: [],
        },
      },
    ]);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("查看這筆敏感資料");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    expect(
      wrapper.get('[data-testid="assistant-permission-denied-message"]').text(),
    ).toContain("權限");
    expect(
      wrapper.find('[data-testid="assistant-ai-message"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
    vi.useRealTimers();
  });

  it("renders no_answer + tool_failure as ToolFailureMessage instead of a generic answered bubble", async () => {
    vi.useFakeTimers();
    installEventStreamFetch((requestId) => [
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-tool-failure-final-001",
        eventType: "final",
        sequence: 1,
        data: {
          answerDecision: "no_answer",
          noAnswerReason: "tool_failure",
          answer: "目前無法安全取得所需資料，請稍後再試或調整查詢條件。",
          evidenceRefs: [],
        },
      },
    ]);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("幫我查外部同步結果");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    expect(
      wrapper.get('[data-testid="assistant-tool-failure-message"]').text(),
    ).toContain("稍後再試");
    expect(
      wrapper.find('[data-testid="assistant-ai-message"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
    vi.useRealTimers();
  });

  it("renders escalation_required as EscalationMessage instead of an answered bubble", async () => {
    vi.useFakeTimers();
    installEventStreamFetch((requestId) => [
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-escalation-final-001",
        eventType: "final",
        sequence: 1,
        data: {
          answerDecision: "escalation_required",
          answer: "目前資訊不足以自動完成，請依內部流程接續處理。",
          evidenceRefs: [],
        },
      },
    ]);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("直接幫我執行高風險流程");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    expect(
      wrapper.get('[data-testid="assistant-escalation-message"]').text(),
    ).toContain("升級處理");
    expect(
      wrapper.find('[data-testid="assistant-ai-message"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
    vi.useRealTimers();
  });

  it("renders approval_required as ApprovalRequestDisplayMessage and loads detail safely", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, requestOptions?: RequestInit) => {
        const url = String(input);

        if (url === "/api/v1/assistant/sessions") {
          return createJsonResponse(createSessionEnvelope());
        }

        if (url === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`) {
          const requestId = new Headers(requestOptions?.headers).get(
            "x-request-id",
          );
          if (!requestId) {
            throw new Error("Missing request ID");
          }

          return createSseResponse([
            {
              requestId,
              sessionId: createdSession.sessionId,
              messageId: "message-approval-final-001",
              eventType: "final",
              sequence: 1,
              data: {
                answerDecision: "approval_required",
                answer: "此操作需要額外審核。",
                evidenceRefs: ["evidence-structured-001"],
                approvalRequestId: "approval-request-001",
              },
            },
          ]);
        }

        if (url === "/api/v1/assistant/approval-requests/approval-request-001") {
          return createJsonResponse({
            requestId: "req-approval-detail-001",
            data: {
              approvalRequestId: "approval-request-001",
              requestId: "req-approval-001",
              sessionId: createdSession.sessionId,
              messageId: "message-approval-final-001",
              status: "pending",
              riskLevel: "high",
              requesterActorId: "actor-001",
              approverActorId: null,
              actionSummary: {
                operation: "cancel",
              },
              payloadSummary: {
                targetEntityId: "SO-10001",
                nested: {
                  shouldHide: true,
                },
              },
              expiresAt: "2026-07-09T10:30:00.000Z",
              evidenceRefIds: ["evidence-structured-001"],
            },
          });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("幫我送出需要審核的操作");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    expect(
      wrapper.get('[data-testid="assistant-approval-request-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-approval-request-status"]').text(),
    ).toContain("待處理");
    expect(
      wrapper.get('[data-testid="assistant-approval-request-risk"]').text(),
    ).toContain("高");
    expect(
      wrapper.get('[data-testid="assistant-approval-request-action-summary"]').text(),
    ).toContain("cancel");
    expect(
      wrapper.get('[data-testid="assistant-approval-request-payload-summary"]').text(),
    ).toContain("SO-10001");
    expect(wrapper.text()).not.toContain("shouldHide");
    expect(
      wrapper.get('[data-testid="assistant-approval-request-time"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="assistant-message-avatar-assistant"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="assistant-ai-message"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
    vi.useRealTimers();
  });

  it("keeps partial content non-final when the stream closes without final", async () => {
    vi.useFakeTimers();
    installEventStreamFetch((requestId) => [
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-interrupted-001",
        eventType: "answer_delta",
        sequence: 1,
        data: {
          delta: "這是一段尚未完成的內容。",
        },
      },
    ]);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("測試中斷");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    expect(useAssistantSessionStore().messages[1]).toMatchObject({
      kind: "assistant_streaming",
      content: "這是一段尚未完成的內容。",
      status: "interrupted",
    });
    expect(
      wrapper.get('[data-testid="assistant-interrupted-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="assistant-streaming-finalized"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="assistant-typing-indicator"]').exists()).toBe(false);
    vi.useRealTimers();
  });

  it("renders a safe interrupted state when the stream times out before any final event", async () => {
    vi.useFakeTimers();
    installEventStreamFetch(() => [], {
      keepOpen: true,
    });
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("測試 timeout");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await nextTick();

    expect(useAssistantSessionStore().messages[1]).toMatchObject({
      kind: "assistant_streaming",
      status: "streaming",
    });

    await vi.advanceTimersByTimeAsync(60_000);
    await flushPromises();
    await nextTick();

    const sessionStore = useAssistantSessionStore();

    expect(sessionStore.messages[1]).toMatchObject({
      kind: "assistant_streaming",
      status: "failed",
    });
    expect(sessionStore.activeRequestId).toBeNull();
    expect(sessionStore.activeAssistantMessageKey).toBeNull();
    expect(
      wrapper.get('[data-testid="assistant-interrupted-message"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="assistant-ai-message"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
    expect(wrapper.text()).not.toContain("rawError");
    expect(wrapper.text()).not.toContain("stack");
    vi.useRealTimers();
  });

  it("does not promote an error after partial content to answered", async () => {
    vi.useFakeTimers();
    installEventStreamFetch((requestId) => [
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-error-001",
        eventType: "answer_delta",
        sequence: 1,
        data: {
          delta: "這是一段尚未完成的內容。",
        },
      },
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-error-001",
        eventType: "error",
        sequence: 2,
        data: {
          code: "stream_interrupted",
          message: "The stream ended before final.",
        },
      },
    ]);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("測試錯誤");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    expect(useAssistantSessionStore().messages[1]).toMatchObject({
      kind: "assistant_streaming",
      content: "這是一段尚未完成的內容。",
      status: "failed",
    });
    expect(useAssistantSessionStore().messages[1]).not.toHaveProperty(
      "finalAnswerDecision",
    );
    expect(
      wrapper.get('[data-testid="assistant-interrupted-message"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
    vi.useRealTimers();
  });

  it("renders a safe interrupted state when the streaming request fails before any final event", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/v1/assistant/sessions") {
        return createJsonResponse(createSessionEnvelope());
      }

      if (
        url
        === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`
      ) {
        return new Response(
          JSON.stringify({
            requestId: "req-stream-error-001",
            error: {
              code: "assistant_unavailable",
              message: "must-not-render",
            },
          }),
          {
            status: 503,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("測試服務不可用");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await nextTick();

    expect(useAssistantSessionStore().messages[1]).toMatchObject({
      kind: "assistant_streaming",
      status: "failed",
    });
    expect(
      wrapper.get('[data-testid="assistant-interrupted-message"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).not.toContain("must-not-render");
    expect(wrapper.find('[data-testid="assistant-ai-message"]').exists()).toBe(false);
    expect(
      wrapper.find('[data-testid="assistant-feedback-controls"]').exists(),
    ).toBe(false);
  });

  it("retries an interrupted message with a fresh requestId and a new placeholder", async () => {
    let messageRequestCount = 0;
    let firstRequestId: string | null = null;
    let secondRequestId: string | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, requestOptions?: RequestInit) => {
      const url = String(input);

      if (url === "/api/v1/assistant/sessions") {
        return createJsonResponse(createSessionEnvelope());
      }

      if (
        url
        === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`
      ) {
        const requestId = new Headers(requestOptions?.headers).get(
          "x-request-id",
        );

        if (messageRequestCount === 0) {
          firstRequestId = requestId;
          messageRequestCount += 1;
          return new Response(
            JSON.stringify({
              requestId: "req-stream-error-002",
              error: {
                code: "assistant_unavailable",
                message: "must-not-render",
              },
            }),
            {
              status: 503,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        secondRequestId = requestId;
        messageRequestCount += 1;
        return createPendingSseResponse();
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const provider = createProvider();
    const wrapper = await mountWidget(provider);

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("重新送出這則訊息");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await nextTick();

    expect(
      wrapper.get('[data-testid="assistant-interrupted-message"]').exists(),
    ).toBe(true);

    await wrapper
      .get('[data-testid="assistant-interrupted-retry"]')
      .trigger("click");
    await waitFor(() => fetchMock.mock.calls.length === 3);
    await nextTick();

    const sessionStore = useAssistantSessionStore();
    expect(provider.getSnapshot).toHaveBeenCalledWith({ purpose: "retry" });
    expect(firstRequestId).toMatch(/^req-/);
    expect(secondRequestId).toMatch(/^req-/);
    expect(secondRequestId).not.toBe(firstRequestId);
    expect(sessionStore.messages).toHaveLength(4);
    expect(sessionStore.messages[1]).toMatchObject({
      kind: "assistant_streaming",
      status: "failed",
      requestId: firstRequestId,
    });
    expect(sessionStore.messages[2]).toMatchObject({
      kind: "user",
      content: "重新送出這則訊息",
      requestId: secondRequestId,
    });
    expect(sessionStore.messages[3]).toMatchObject({
      kind: "assistant_streaming",
      status: "streaming",
      requestId: secondRequestId,
    });

    await wrapper.get('[data-testid="assistant-chat-cancel"]').trigger("click");
    await waitFor(() => sessionStore.activeRequestId === null);
    expect(sessionStore.messages[3]).toMatchObject({
      kind: "assistant_streaming",
      status: "cancelled",
      requestId: secondRequestId,
    });
  });

  it("blocks retry when the latest retry snapshot resolves to a different scope", async () => {
    let messageRequestCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _requestOptions?: RequestInit) => {
      const url = String(input);

      if (url === "/api/v1/assistant/sessions") {
        return createJsonResponse(createSessionEnvelope());
      }

      if (
        url
        === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`
      ) {
        messageRequestCount += 1;

        if (messageRequestCount === 1) {
          return new Response(
            JSON.stringify({
              requestId: "req-stream-error-scope-001",
              error: {
                code: "assistant_unavailable",
                message: "must-not-render",
              },
            }),
            {
              status: 503,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        throw new Error("Retry should be blocked before sending a new request.");
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const provider = {
      getSnapshot: vi.fn(({ purpose }: { purpose: string }) => {
        if (purpose === "send") {
          return pageHostContextSnapshot;
        }

        if (purpose === "retry") {
          return entityHostContextSnapshot;
        }

        return pageHostContextSnapshot;
      }),
    } satisfies AssistantHostContextProvider & {
      getSnapshot: ReturnType<typeof vi.fn>;
    };
    const wrapper = await mountWidget(provider);

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("重新送出 scope 變更測試");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await nextTick();

    expect(
      wrapper.get('[data-testid="assistant-interrupted-message"]').exists(),
    ).toBe(true);

    const sessionStore = useAssistantSessionStore();
    const originalMessageCount = sessionStore.messages.length;

    await wrapper
      .get('[data-testid="assistant-interrupted-retry"]')
      .trigger("click");
    await flushPromises();
    await nextTick();

    expect(provider.getSnapshot).toHaveBeenCalledWith({ purpose: "retry" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sessionStore.messages).toHaveLength(originalMessageCount);
    expect(
      wrapper.get('[data-testid="assistant-chat-disabled-reason"]').text(),
    ).toContain("頁面脈絡已變更，請重新開始此對話。");
    expect(
      sessionStore.messages.filter(message => message.kind === "user"),
    ).toHaveLength(1);
    expect(
      sessionStore.messages.filter(
        message =>
          message.kind === "assistant_streaming"
          && message.status === "streaming",
      ),
    ).toHaveLength(0);
  });

  it("keeps existing action-draft and approval state when a stream is interrupted", async () => {
    vi.useFakeTimers();
    installEventStreamFetch((requestId) => [
      {
        requestId,
        sessionId: createdSession.sessionId,
        messageId: "message-keep-state-001",
        eventType: "answer_delta",
        sequence: 1,
        data: {
          delta: "這是一段尚未完成的內容。",
        },
      },
    ]);
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    const sessionStore = useAssistantSessionStore();
    sessionStore.actionDraftById["action-draft-keep-001"] = {
      actionDraftId: "action-draft-keep-001",
      detailStatus: "available",
      operationStatus: "idle",
    } satisfies ActionDraftDetailState;
    sessionStore.approvalRequestById["approval-request-keep-001"] = {
      approvalRequestId: "approval-request-keep-001",
      detailStatus: "available",
      openDetailStatus: "idle",
    } satisfies ApprovalRequestDetailState;
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("測試保留既有狀態");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await nextTick();

    expect(sessionStore.actionDraftById["action-draft-keep-001"]).toMatchObject({
      actionDraftId: "action-draft-keep-001",
      detailStatus: "available",
    });
    expect(
      sessionStore.approvalRequestById["approval-request-keep-001"],
    ).toMatchObject({
      approvalRequestId: "approval-request-keep-001",
      detailStatus: "available",
    });
    vi.useRealTimers();
  });

  it("cancels only the active SSE stream and keeps action-draft and approval state isolated", async () => {
    installEventStreamFetch(
      (requestId) => [
        {
          requestId,
          sessionId: createdSession.sessionId,
          messageId: "message-cancel-isolation-001",
          eventType: "answer_delta",
          sequence: 1,
          data: {
            delta: "這是一段進行中的回覆。",
          },
        },
      ],
      {
        keepOpen: true,
      },
    );

    const wrapper = await mountWidget(createProvider());
    await openReadyPanel(wrapper);

    const sessionStore = useAssistantSessionStore();
    sessionStore.actionDraftById["action-draft-isolation-001"] = {
      actionDraftId: "action-draft-isolation-001",
      detailStatus: "available",
      operationStatus: "idle",
    } satisfies ActionDraftDetailState;
    sessionStore.approvalRequestById["approval-request-isolation-001"] = {
      approvalRequestId: "approval-request-isolation-001",
      detailStatus: "available",
      openDetailStatus: "idle",
      status: "pending",
    } satisfies ApprovalRequestDetailState;

    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("只停止這次回覆");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await waitFor(() => wrapper.find('[data-testid="assistant-chat-cancel"]').exists());

    await wrapper.get('[data-testid="assistant-chat-cancel"]').trigger("click");
    await waitFor(() => sessionStore.activeRequestId === null);

    expect(sessionStore.messages[1]).toMatchObject({
      kind: "assistant_streaming",
      status: "cancelled",
    });
    expect(sessionStore.actionDraftById["action-draft-isolation-001"]).toMatchObject({
      actionDraftId: "action-draft-isolation-001",
      operationStatus: "idle",
      detailStatus: "available",
    });
    expect(
      sessionStore.approvalRequestById["approval-request-isolation-001"],
    ).toMatchObject({
      approvalRequestId: "approval-request-isolation-001",
      detailStatus: "available",
      openDetailStatus: "idle",
      status: "pending",
    });
  });

  it("renders an unknown event as a safe non-final activity", async () => {
    const onCancel = vi.fn();
    installEventStreamFetch(
      (requestId) => [
        {
          requestId,
          sessionId: createdSession.sessionId,
          messageId: "message-unknown-001",
          eventType: "progress_hint",
          sequence: 1,
          data: {
            internalDetail: "must-not-render",
          },
        },
      ],
      {
        keepOpen: true,
        onCancel,
      },
    );
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("測試未知事件");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await waitFor(() =>
      wrapper.text().includes("收到未識別的進度更新，已安全略過"),
    );

    expect(wrapper.text()).not.toContain("must-not-render");
    expect(
      wrapper.find('[data-testid="assistant-streaming-finalized"]').exists(),
    ).toBe(false);

    await wrapper.get('[data-testid="assistant-chat-cancel"]').trigger("click");
    await waitFor(() => useAssistantSessionStore().activeRequestId === null);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("does not render external-service semantics", async () => {
    installSendFetch();
    const wrapper = await mountWidget(createProvider());

    await openReadyPanel(wrapper);
    const renderedText = wrapper.text().toLowerCase();

    for (const copy of [
      "public chatbot",
      "customer service",
      "lead capture",
      "handoff",
      "轉人工客服",
      "表單留資",
    ]) {
      expect(renderedText).not.toContain(copy);
    }
  });
});

describe("manual preview host context", () => {
  beforeEach(() => {
    runtimeConfigMock.apiBase = "";
    setActivePinia(createPinia());
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount();
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  it("defaults to a ready dev provider and sends its safe PageContext", async () => {
    const fetchMock = installSendFetch();
    const wrapper = await mountPreviewPage();

    expect(
      wrapper.get('[data-testid="preview-host-context-ready"]').attributes(
        "aria-pressed",
      ),
    ).toBe("true");

    await wrapper.get('[data-testid="assistant-launcher"]').trigger("click");
    await waitFor(() => fetchMock.mock.calls.length === 1);
    await waitFor(
      () =>
        wrapper
          .get('[data-testid="assistant-chat-input"]')
          .attributes("disabled") === undefined,
    );

    expect(wrapper.text()).not.toContain("目前頁面內容尚未就緒");
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("查詢待處理訂單");
    await wrapper.get('[data-testid="assistant-chat-submit"]').trigger("click");
    await waitFor(() => fetchMock.mock.calls.length === 2);
    await nextTick();

    const createOptions = fetchMock.mock.calls[0]![1] as RequestInit;
    const sendOptions = fetchMock.mock.calls[1]![1] as RequestInit;
    const createBody = JSON.parse(String(createOptions.body));
    const sendBody = JSON.parse(String(sendOptions.body));

    expect(createBody.pageContext.selectedRows).toEqual([
      { id: "SO-20002" },
    ]);
    expect(Object.keys(createBody.pageContext.selectedRows[0])).toEqual([
      "id",
    ]);
    expect(sendBody).toEqual({
      message: "查詢待處理訂單",
      pageContext: {
        route: "/orders",
        screenId: "orders-overview",
        entityType: "order",
        selectedRows: [
          {
            id: "SO-20002",
          },
        ],
        activeFilters: [
          {
            field: "status",
            value: "pending",
          },
        ],
        visibleColumns: [
          "orderNumber",
          "customerName",
          "status",
          "updatedAt",
        ],
      },
    });
    expect(Object.keys(sendBody.pageContext.selectedRows[0])).toEqual(["id"]);
    expect(wrapper.text()).toContain("查詢待處理訂單");
    expect(
      wrapper.find('[data-testid="assistant-streaming-message"]').exists(),
    ).toBe(true);

    await wrapper.get('[data-testid="assistant-chat-cancel"]').trigger("click");
    await waitFor(() => useAssistantSessionStore().activeRequestId === null);
  });

  it("uses runtimeConfig.public.apiBase for session and message requests", async () => {
    const assistantApiBase = "http://localhost:3000/api/v1";
    runtimeConfigMock.apiBase = assistantApiBase;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://frontend.test");

      if (url.pathname === "/api/v1/assistant/sessions") {
        return createJsonResponse(createSessionEnvelope());
      }

      if (
        url.pathname
        === `/api/v1/assistant/sessions/${createdSession.sessionId}/messages`
      ) {
        return createPendingSseResponse();
      }

      throw new Error(`Unexpected fetch URL: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = await mountPreviewPage();

    await wrapper.get('[data-testid="assistant-launcher"]').trigger("click");
    await flushPromises();
    await waitFor(() => fetchMock.mock.calls.length === 1);
    await wrapper
      .get('[data-testid="assistant-chat-input"]')
      .setValue("查詢 runtime config");
    await wrapper
      .get('[data-testid="assistant-chat-submit"]')
      .trigger("click");
    await waitFor(() => fetchMock.mock.calls.length === 2);

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      `${assistantApiBase}/assistant/sessions`,
      `${assistantApiBase}/assistant/sessions/${createdSession.sessionId}/messages`,
    ]);

    await wrapper
      .get('[data-testid="assistant-chat-cancel"]')
      .trigger("click");
    await waitFor(() => useAssistantSessionStore().activeRequestId === null);
  });

  it("switches to the safe not-ready mode and can return to ready", async () => {
    const fetchMock = installSendFetch();
    const wrapper = await mountPreviewPage();

    await wrapper
      .get('[data-testid="preview-host-context-not-ready"]')
      .trigger("click");
    expect(
      wrapper.find('[data-testid="assistant-panel"]').exists(),
    ).toBe(false);

    await wrapper.get('[data-testid="assistant-launcher"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("目前頁面內容尚未就緒");
    expect(
      wrapper.get('[data-testid="assistant-chat-input"]').attributes(
        "disabled",
      ),
    ).toBeDefined();
    expect(
      wrapper.find('[data-testid="assistant-session-recovery"]').exists(),
    ).toBe(false);
    expect(wrapper.text()).not.toContain("重新開始");
    expect(fetchMock).not.toHaveBeenCalled();

    await wrapper
      .get('[data-testid="preview-host-context-ready"]')
      .trigger("click");
    expect(
      wrapper.find('[data-testid="assistant-panel"]').exists(),
    ).toBe(false);
    await wrapper.get('[data-testid="assistant-launcher"]').trigger("click");
    await waitFor(() => fetchMock.mock.calls.length === 1);
    await waitFor(
      () =>
        wrapper
          .get('[data-testid="assistant-chat-input"]')
          .attributes("disabled") === undefined,
    );

    expect(wrapper.text()).not.toContain("目前頁面內容尚未就緒");
  });
});
