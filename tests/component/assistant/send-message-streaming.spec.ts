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
): AssistantHostContextProvider & {
  getSnapshot: ReturnType<typeof vi.fn>;
} {
  return {
    getSnapshot: vi.fn(({ purpose }) =>
      purpose === "send" ? sendSnapshot : restoreSnapshot,
    ),
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
    expect(wrapper.get('[data-testid="assistant-streaming-content"]').text()).toBe(
      "訂單狀態為已確認。",
    );
    expect(
      wrapper.get('[data-testid="assistant-streaming-finalized"]').text(),
    ).toContain("已完成");
    expect(wrapper.text()).toContain("正在查詢內部資料");
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
      wrapper.find('[data-testid="assistant-streaming-finalized"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="assistant-typing-indicator"]').exists()).toBe(false);
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
    vi.useRealTimers();
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
