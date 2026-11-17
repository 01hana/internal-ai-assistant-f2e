<script setup lang="ts">
/// <reference types="vite/client" />
import { createPinia } from "pinia";
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Component } from "vue";
import { acquireMobileViewportLock, releaseMobileViewportLock } from "../runtime/mobileViewportLock";
import type {
  AssistantAccessTokenProvider,
  AssistantHostContextProvider,
  HostCallbacks,
  WidgetConfiguration,
} from "../types/public";

const DEFAULT_HOST_CONTEXT_PROVIDER: AssistantHostContextProvider = async () => ({
  hostApp: "assistant-sdk",
});

const props = withDefaults(
  defineProps<{
    provider?: AssistantHostContextProvider;
    getAccessToken?: AssistantAccessTokenProvider;
    configuration?: WidgetConfiguration;
    callbacks?: HostCallbacks;
  }>(),
  {
    provider: undefined,
    configuration: undefined,
    callbacks: undefined,
    getAccessToken: undefined,
  },
);

function createRuntimeScope(configuration: WidgetConfiguration | undefined): string {
  const configuredScope = configuration?.sessionScope?.trim();
  const uniqueId = globalThis.crypto?.randomUUID?.()
    ?? `scope-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return configuredScope
    ? `assistant-sdk:${configuredScope}:${uniqueId}`
    : `assistant-sdk:${uniqueId}`;
}

function createRequestId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeError(code: string, message: string) {
  return {
    code,
    message,
    userMessage: message,
  };
}

function readPageContext(context: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  const pageContext = context.pageContext;

  return pageContext && typeof pageContext === "object" && !Array.isArray(pageContext)
    ? pageContext as Readonly<Record<string, unknown>>
    : undefined;
}

type SdkRuntimeAdapter = {
  readonly bootstrapSession: (input?: { readonly forceNew?: boolean }) => Promise<{
    readonly error?: { readonly code: string; readonly safeMessage: string };
    readonly ok: boolean;
    readonly sessionId?: string;
  }>;
  readonly cancelMessageStream: () => Promise<void>;
  // The widget loads the private runtime module through an allowlisted Vite glob.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly controller: any;
  readonly destroy: () => Promise<void>;
  readonly emitHostEvent: (eventName: string, payload?: Readonly<Record<string, unknown>>) => Promise<{ readonly ok: boolean }>;
  readonly resolveContext: (operation: "send" | "retry") => Promise<Readonly<Record<string, unknown>> | null>;
  readonly startMessageStream: (input: {
    pageContext?: Readonly<Record<string, unknown>>;
    sessionId?: string;
  } & ({ message: string; choiceId?: never } | { choiceId: string; message?: never })) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly transport: any;
  /** Frontend 003: open a session picked from the session list. */
  readonly restoreSession: (sessionId: string, hooks?: { readonly beforeApply?: () => Promise<void> | void }) => Promise<{
    readonly error?: { readonly code: string; readonly safeMessage: string };
    readonly ok: boolean;
    readonly sessionId?: string;
  }>;
  readonly forgetStoredSession: () => Promise<void>;
};

const productRuntimePanelModules = import.meta.glob("../../../assistant-runtime/src/components/product-ui/AssistantProductRuntimePanel.vue", { eager: true }) as Record<string, { default: Component }>;
const productPanelShellModules = import.meta.glob("../../../assistant-runtime/src/components/product-ui/AssistantProductPanelShell.vue", { eager: true }) as Record<string, { default: Component }>;
const productSessionListModules = import.meta.glob("../../../assistant-runtime/src/components/product-ui/AssistantProductSessionList.vue", { eager: true }) as Record<string, { default: Component }>;
const productIconModules = import.meta.glob("../../../assistant-runtime/src/components/product-ui/AssistantProductIcon.vue", { eager: true }) as Record<string, { default: Component }>;
const runtimeModules = import.meta.glob("../../../assistant-runtime/src/runtime/index.ts", { eager: true }) as Record<string, Record<string, unknown>>;
const sdkRuntimeAdapterModules = import.meta.glob("../runtime/sdkRuntimeAdapter.ts", { eager: true }) as Record<string, {
  createSdkRuntimeAdapter: (options: Record<string, unknown>) => SdkRuntimeAdapter;
}>;
// Nuxt and the SDK build normalize glob keys differently; each allowlisted glob
// intentionally contains exactly one private module, so consume that module by value.
const productRuntimePanelModule = Object.values(productRuntimePanelModules)[0];
const productPanelShellModule = Object.values(productPanelShellModules)[0];
const productIconModule = Object.values(productIconModules)[0];
const productSessionListModule = Object.values(productSessionListModules)[0];
const runtimeModule = Object.values(runtimeModules)[0];
const sdkRuntimeAdapterModule = Object.values(sdkRuntimeAdapterModules)[0];
const loadRuntimeModule = async () => runtimeModule;
const loadSdkRuntimeAdapterModule = async () => sdkRuntimeAdapterModule;

if (!productRuntimePanelModule || !productPanelShellModule || !productIconModule || !productSessionListModule || !runtimeModule || !sdkRuntimeAdapterModule) {
  throw new Error("assistant_sdk_runtime_modules_unavailable");
}

const AssistantProductRuntimePanel = defineAsyncComponent(async () => productRuntimePanelModule);
const AssistantProductPanelShell = defineAsyncComponent(async () => productPanelShellModule);
const AssistantProductIcon = defineAsyncComponent(async () => productIconModule);
const AssistantProductSessionList = defineAsyncComponent(async () => productSessionListModule);
const runtimeScope = createRuntimeScope(props.configuration);
const launcherEnabled = computed(() => props.configuration?.launcher?.enabled !== false);
const adapterRef = shallowRef<SdkRuntimeAdapter | null>(null);
const controller = computed(() => adapterRef.value?.controller ?? null);
const isOpen = computed(() => Boolean(adapterRef.value?.controller.stores.widget.isOpen.value));
const panelOpen = computed(() => isOpen.value || !launcherEnabled.value);
const sdkRootRef = ref<HTMLElement | null>(null);
const mobileViewport = ref(false);
const panelEntering = ref(!launcherEnabled.value);
const panelLeaving = ref(false);
const panelEntered = ref(false);
const mobilePanelVisible = computed(() => mobileViewport.value && (panelOpen.value || panelLeaving.value));

// Frontend 003: session history view (Backend Feature 013). List data lives only in this widget instance.
type SessionListEntry = { sessionId: string; title: string | null; createdAt: string; lastMessageAt: string };
type SessionItemState = { pending?: boolean; error?: string | null };
const SESSION_PAGE_SIZE = 20;
const panelView = ref<"chat" | "history">("chat");
const sessionListState = ref<{
  sessions: SessionListEntry[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  itemStates: Record<string, SessionItemState>;
  view: "active" | "archived";
}>({ sessions: [], nextCursor: null, loading: false, loadingMore: false, error: null, itemStates: {}, view: "active" });
// The built-in transports always offer these routes; an older backend that lacks them is detected on first use.
const historyUnsupported = ref(false);
const archivedViewUnsupported = ref(false);
const archivedViewAvailable = computed(() =>
  !archivedViewUnsupported.value && typeof adapterRef.value?.transport?.unarchiveSession === "function");
const deleteAvailable = computed(() => typeof adapterRef.value?.transport?.deleteSession === "function");
const historyAvailable = computed(() => {
  const transport = adapterRef.value?.transport;
  return !historyUnsupported.value
    && Boolean(transport && typeof transport.listSessions === "function" && typeof transport.archiveSession === "function");
});
const currentSessionId = computed(() => adapterRef.value?.controller.stores.session.sessionId.value ?? null);
const sessionSwitchDisabled = computed(() => Boolean(adapterRef.value?.controller.stores.session.activeRequestId.value));

function updateVisualViewport() {
  const root = sdkRootRef.value;
  if (!root) return;
  const viewport = typeof window !== "undefined" ? window.visualViewport : null;
  if (mobilePanelVisible.value && viewport) {
    root.style.setProperty("--assistant-sdk-visual-viewport-height", `${viewport.height}px`);
    root.style.setProperty("--assistant-sdk-visual-viewport-top", `${viewport.offsetTop}px`);
  }
  else {
    root.style.removeProperty("--assistant-sdk-visual-viewport-height");
    root.style.removeProperty("--assistant-sdk-visual-viewport-top");
  }
}

function updateMobileViewport() {
  const nextMobile = window.matchMedia?.("(max-width: 576px)").matches ?? window.innerWidth <= 576;
  if (nextMobile !== mobileViewport.value && (panelOpen.value || panelLeaving.value)) {
    panelEntered.value = true;
    panelEntering.value = false;
    sdkRootRef.value?.querySelector<HTMLElement>("[data-assistant-panel]")?.getAnimations?.().forEach(animation => animation.cancel());
  }
  mobileViewport.value = nextMobile;
  updateVisualViewport();
}

watch(mobilePanelVisible, (openOnMobile) => {
  if (openOnMobile) acquireMobileViewportLock(runtimeScope);
  else releaseMobileViewportLock(runtimeScope);
  updateVisualViewport();
});

function afterPanelEnter() {
  panelEntering.value = false;
  panelEntered.value = true;
}

function beforePanelLeave(element: Element) {
  element.setAttribute("inert", "");
  element.setAttribute("aria-hidden", "true");
  if (document.activeElement instanceof HTMLElement && element.contains(document.activeElement)) {
    document.activeElement.blur();
  }
}

function cancelPanelLeave(element: Element) {
  element.removeAttribute("inert");
  element.removeAttribute("aria-hidden");
  if (panelOpen.value) {
    panelLeaving.value = false;
    panelEntering.value = false;
    panelEntered.value = true;
  }
}

function afterPanelLeave() {
  if (panelOpen.value) return;
  panelLeaving.value = false;
  panelEntering.value = false;
  panelEntered.value = false;
}

onMounted(() => {
  updateMobileViewport();
  window.addEventListener("resize", updateMobileViewport);
  window.visualViewport?.addEventListener("resize", updateVisualViewport);
  window.visualViewport?.addEventListener("scroll", updateVisualViewport);
});
const panelContextReady = computed(() => Boolean(adapterRef.value?.controller.stores.session.contextReady.value));
const panelCanSend = computed(() => {
  const adapter = adapterRef.value;

  if (!adapter || !panelContextReady.value) {
    return false;
  }

  const session = adapter.controller.stores.session;
  const availability = adapter.controller.stores.widget.availability.value;
  return (
    availability === "normal"
    && session.status.value === "ready"
    && typeof session.sessionId.value === "string"
    && session.sessionId.value.trim().length > 0
  );
});
const panelStatus = computed(() => {
  const adapter = adapterRef.value;

  if (!adapter) {
    return "目前頁面內容尚未就緒";
  }

  const availability = adapter.controller.stores.widget.availability.value;
  if (availability === "degraded") return "助理服務暫時不穩定";
  if (availability === "unavailable") return "助理暫時無法使用";
  return panelContextReady.value ? "AI 助理已就緒" : "目前頁面內容尚未就緒";
});

const adapterPromise = loadSdkRuntimeAdapterModule().then((module) => {
  if (!module) {
    throw new Error("assistant_sdk_runtime_modules_unavailable");
  }

  const adapter = module.createSdkRuntimeAdapter({
    callbacks: props.callbacks,
    configuration: props.configuration,
    getAccessToken: props.getAccessToken,
    pinia: createPinia(),
    provider: props.provider ?? DEFAULT_HOST_CONTEXT_PROVIDER,
    runtimeScope,
  });

  adapterRef.value = adapter;

  if (!launcherEnabled.value) {
    adapter.controller.stores.widget.isOpen.value = true;
  }

  return adapter;
});

async function getAdapter(): Promise<SdkRuntimeAdapter> {
  return adapterRef.value ?? await adapterPromise;
}

async function getRuntimeHelpers() {
  const runtimeModule = await loadRuntimeModule!();

  return runtimeModule as {
    createAssistantStreamingRuntimeMessage: (input: Record<string, unknown>) => unknown;
    createUserRuntimeMessage: (input: Record<string, unknown>) => unknown;
  };
}

async function emitError(code: string, message: string) {
  const adapter = await getAdapter();
  const error = safeError(code, message);

  adapter.controller.setError({
    code: error.code,
    safeMessage: error.userMessage,
  }, null);

  await adapter.emitHostEvent("error", { error });
}

async function prepareRuntimeForInteraction() {
  const adapter = await getAdapter();
  const context = await adapter.resolveContext("send");

  if (!context) {
    await emitError("context_unavailable", "目前頁面內容尚未就緒，請稍後再試。");
    return null;
  }

  return context;
}

async function bootstrapSession(forceNew = false): Promise<boolean> {
  const adapter = await getAdapter();
  const result = await adapter.bootstrapSession({ forceNew });

  if (!result.ok && result.error) {
    await adapter.emitHostEvent("error", {
      error: safeError(result.error.code, result.error.safeMessage),
    });
  }

  return result.ok;
}

async function openWidget() {
  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;

  if (!panelOpen.value) {
    panelEntering.value = !panelLeaving.value;
    panelEntered.value = panelLeaving.value;
  }
  panelLeaving.value = false;
  adapter.controller.stores.widget.isOpen.value = true;
  await adapter.emitHostEvent("opened", {
    sessionId: session.sessionId.value ?? undefined,
  });
  await bootstrapSession();
}

async function closeWidget() {
  panelView.value = "chat";
  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;

  if (panelOpen.value && mobileViewport.value) {
    panelLeaving.value = true;
  }
  panelEntering.value = false;
  adapter.controller.stores.widget.isOpen.value = false;
  await adapter.emitHostEvent("closed", {
    sessionId: session.sessionId.value ?? undefined,
  });
}

async function restartWidget() {
  const adapter = await getAdapter();

  await adapter.controller.cleanup();
  adapter.controller.reset();
  adapter.controller.stores.widget.isOpen.value = true;
  await bootstrapSession(true);
}

function setSessionItemState(sessionId: string, state: SessionItemState | null) {
  const next = Object.fromEntries(Object.entries(sessionListState.value.itemStates).filter(([id]) => id !== sessionId));
  sessionListState.value = { ...sessionListState.value, itemStates: state ? { ...next, [sessionId]: state } : next };
}

function removeSessionListEntry(sessionId: string) {
  setSessionItemState(sessionId, null);
  sessionListState.value = {
    ...sessionListState.value,
    sessions: sessionListState.value.sessions.filter(item => item.sessionId !== sessionId),
  };
}

let sessionListRequest = 0;

async function loadSessionPage(mode: "first" | "more", retriedFirstPage = false): Promise<void> {
  const adapter = await getAdapter();
  const cursor = mode === "more" ? sessionListState.value.nextCursor : null;
  if (mode === "more" && !cursor) return;

  sessionListState.value = {
    ...sessionListState.value,
    ...(mode === "first" ? { loading: true, error: null } : { loadingMore: true }),
  };
  const view = sessionListState.value.view;
  const request = ++sessionListRequest;
  const result = await adapter.transport.listSessions({ limit: SESSION_PAGE_SIZE, ...(cursor ? { cursor } : {}),
    ...(view === "archived" ? { status: "archived" } : {}) });
  // A later load (another view, or reopening the list) wins over this response.
  if (request !== sessionListRequest) return;

  if (result.ok) {
    sessionListState.value = {
      ...sessionListState.value,
      sessions: mode === "first" ? result.value.sessions : [...sessionListState.value.sessions, ...result.value.sessions],
      nextCursor: result.value.nextCursor,
      loading: false,
      loadingMore: false,
      error: null,
      ...(mode === "first" ? { itemStates: {} } : {}),
    };
    return;
  }

  // A backend without the session list (before Backend Feature 013) answers 404: hide history, as before.
  if (mode === "first" && view === "active" && result.error.code === "session_not_found") {
    historyUnsupported.value = true;
    sessionListState.value = { ...sessionListState.value, loading: false, loadingMore: false, error: null };
    backToChat();
    return;
  }

  // A backend without archived listing rejects `status=archived` (400): drop the switch and show the active list.
  if (mode === "first" && view === "archived" && result.error.code === "invalid_request") {
    archivedViewUnsupported.value = true;
    await switchSessionListView("active");
    return;
  }

  // An expired cursor (400) restarts from the first page once instead of showing an error.
  if (mode === "more" && result.error.code === "invalid_request" && !retriedFirstPage) {
    sessionListState.value = { ...sessionListState.value, loadingMore: false };
    await loadSessionPage("first", true);
    return;
  }

  sessionListState.value = {
    ...sessionListState.value,
    loading: false,
    loadingMore: false,
    error: "目前無法載入對話紀錄，請稍後再試。",
  };
}

async function openSessionHistory() {
  panelView.value = "history";
  sessionListState.value = { ...sessionListState.value, view: "active", sessions: [], nextCursor: null };
  await loadSessionPage("first");
}

async function switchSessionListView(view: "active" | "archived") {
  sessionListState.value = { ...sessionListState.value, view, sessions: [], nextCursor: null, itemStates: {} };
  await loadSessionPage("first");
}

async function unarchiveSessionFromList(sessionId: string) {
  const adapter = await getAdapter();
  setSessionItemState(sessionId, { pending: true });
  const result = await adapter.transport.unarchiveSession({ sessionId });

  // Already active or gone (404): either way it no longer belongs in the archived list.
  if (!result.ok && result.error.code !== "session_not_found") {
    setSessionItemState(sessionId, { error: "目前無法取消封存這段對話，請稍後再試。" });
    return;
  }

  removeSessionListEntry(sessionId);
}

function focusComposer() {
  void nextTick(() => {
    sdkRootRef.value?.querySelector<HTMLElement>("[data-testid='assistant-chat-input']")?.focus();
  });
}

function backToChat() {
  panelView.value = "chat";
  focusComposer();
}

async function openSessionFromList(sessionId: string) {
  if (sessionId === currentSessionId.value) {
    backToChat();
    return;
  }

  const adapter = await getAdapter();
  setSessionItemState(sessionId, { pending: true });
  const result = await adapter.restoreSession(sessionId, {
    beforeApply: async () => {
      await adapter.controller.cleanup();
      adapter.controller.reset();
      adapter.controller.stores.widget.isOpen.value = true;
    },
  });

  if (result.ok) {
    setSessionItemState(sessionId, null);
    backToChat();
    return;
  }

  if (result.error?.code === "session_not_found") {
    removeSessionListEntry(sessionId);
    return;
  }

  setSessionItemState(sessionId, { error: "目前無法開啟這段對話，請稍後再試。" });
}

async function archiveSessionFromList(sessionId: string) {
  const adapter = await getAdapter();
  setSessionItemState(sessionId, { pending: true });
  const result = await adapter.transport.archiveSession({ sessionId });

  // Already archived elsewhere (404) counts as done.
  if (!result.ok && result.error.code !== "session_not_found") {
    setSessionItemState(sessionId, { error: "目前無法封存這段對話，請稍後再試。" });
    return;
  }

  removeSessionListEntry(sessionId);
  if (sessionId === currentSessionId.value) {
    // The archived session can no longer be used: start a new one (with its opening) behind the list.
    await adapter.forgetStoredSession();
    await adapter.controller.cleanup();
    adapter.controller.reset();
    adapter.controller.stores.widget.isOpen.value = true;
    await bootstrapSession(true);
  }
}

/** Frontend 003: delete hides the session for good; the backend keeps it for audit. */
async function deleteSessionFromList(sessionId: string) {
  const adapter = await getAdapter();

  setSessionItemState(sessionId, { pending: true });
  const result = await adapter.transport.deleteSession({ sessionId });
  if (!result.ok && result.error.code !== "session_not_found") {
    setSessionItemState(sessionId, { error: "目前無法刪除這段對話，請稍後再試。" });
    return;
  }

  removeSessionListEntry(sessionId);
  if (sessionId === currentSessionId.value) {
    await adapter.forgetStoredSession();
    await adapter.controller.cleanup();
    adapter.controller.reset();
    adapter.controller.stores.widget.isOpen.value = true;
    await bootstrapSession(true);
  }
}

async function sendMessage(message: string) {
  const text = message.trim();

  if (!text) {
    return;
  }

  await startConversationTurn(text, { message: text });
}

/** Frontend 003: a clicked Quick Reply or suggestion shows its label and sends only its ID. */
async function sendChoice(choice: { id: string; label: string }) {
  await startConversationTurn(choice.label, { choiceId: choice.id });
}

async function startConversationTurn(
  displayText: string,
  content: { message: string } | { choiceId: string },
) {
  if (!await bootstrapSession()) {
    return;
  }

  const context = await prepareRuntimeForInteraction();
  if (!context) return;

  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;
  const sessionId = session.sessionId.value;

  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    await emitError("missing_session_id", "助理對話尚未就緒，請稍後再試。");
    return;
  }

  const requestId = createRequestId("assistant-sdk-message");
  const createdAt = new Date().toISOString();
  const assistantMessageKey = `assistant-sdk-assistant:${requestId}`;

  const helpers = await getRuntimeHelpers();
  adapter.controller.appendUserMessage(helpers.createUserRuntimeMessage({
    content: displayText,
    createdAt,
    requestId,
  }));
  adapter.controller.appendAssistantStreamingPlaceholder(helpers.createAssistantStreamingRuntimeMessage({
    createdAt,
    key: assistantMessageKey,
    requestId,
  }));
  adapter.controller.setStreamingRequest(requestId, assistantMessageKey);
  adapter.controller.markStreamingStarted();

  await adapter.startMessageStream({
    ...content,
    pageContext: readPageContext(context),
    sessionId,
  });
}

async function loadMoreHistory() {
  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;
  const sessionId = session.sessionId.value;
  const cursor = session.nextCursor.value;

  if (!sessionId || !cursor) {
    return;
  }

  await adapter.controller.loadHistory({ cursor, sessionId });
}

async function cancelStreaming(expectedRequestId: string) {
  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;
  if (session.activeRequestId.value !== expectedRequestId) return;
  const activeMessage = (session.messages.value as Array<Record<string, unknown>>).find(message =>
    message.kind === "assistant_streaming"
    && message.key === session.activeAssistantMessageKey.value,
  );
  if (!activeMessage || !["sending", "queued", "connecting", "streaming"].includes(String(activeMessage.status))) return;
  const sessionId = session.sessionId.value;
  const messageId = typeof activeMessage.messageId === "string" ? activeMessage.messageId : null;

  await adapter.cancelMessageStream();

  if (!sessionId || !messageId) {
    return;
  }

  const result = await adapter.transport.cancelMessage({ messageId, sessionId });

  if (!result.ok && result.error.code !== "transport_unavailable") {
    await adapter.emitHostEvent("error", {
      error: safeError(result.error.code, result.error.message || "目前無法取消助理回覆。"),
    });
  }
}

async function submitFeedback(payload: { messageId: string; value: "helpful" | "not_helpful" }) {
  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;
  const prepared = adapter.controller.prepareFeedbackSubmission(payload);

  if (!prepared.allowed) {
    return;
  }

  const sessionId = session.sessionId.value;
  if (!sessionId) return;
  const requestId = createRequestId("assistant-sdk-feedback");

  adapter.controller.startFeedbackSubmission(payload.messageId, payload.value, requestId);
  const result = await adapter.transport.submitFeedback({
    messageId: payload.messageId,
    sessionId,
    value: payload.value === "helpful" ? "positive" : "negative",
  });

  if (result.ok) {
    adapter.controller.completeFeedbackSubmission(payload.messageId, { requestId });
    return;
  }

  adapter.controller.failFeedbackSubmission(
    payload.messageId,
    prepared.previousValue,
    requestId,
    result.error.message || "目前無法送出回饋，請稍後再試。",
  );
  await emitError(result.error.code, result.error.message || "目前無法送出回饋，請稍後再試。");
}

async function confirmActionDraft(actionDraftId: string) {
  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;
  const prepared = adapter.controller.prepareActionDraftConfirmation(actionDraftId);

  if (!prepared.allowed) {
    return;
  }

  const actionState = adapter.controller.getActionDraftState(actionDraftId);
  const sessionId = session.sessionId.value;
  if (!sessionId) return;
  const messageId = actionState.messageId ?? actionDraftId;

  adapter.controller.setActionDraftOperationStatus(actionDraftId, "confirming", {
    idempotencyKey: prepared.idempotencyKey,
  });
  const result = await adapter.transport.confirmAction({
    actionId: actionDraftId,
    messageId,
    sessionId,
  });

  if (!result.ok) {
    adapter.controller.failActionDraftOperation(actionDraftId, result.error.message || "目前無法送出確認，請稍後再試。", "failed", {
      idempotencyKey: prepared.idempotencyKey,
    });
    await emitError(result.error.code, result.error.message || "目前無法送出確認，請稍後再試。");
  }
}

async function cancelActionDraft(actionDraftId: string) {
  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;
  const prepared = adapter.controller.prepareActionDraftCancellation(actionDraftId);

  if (!prepared.allowed) {
    return;
  }

  const actionState = adapter.controller.getActionDraftState(actionDraftId);
  const sessionId = session.sessionId.value;
  if (!sessionId) return;
  const messageId = actionState.messageId ?? actionDraftId;

  adapter.controller.setActionDraftOperationStatus(actionDraftId, "cancelling", {
    idempotencyKey: prepared.idempotencyKey,
  });
  const result = await adapter.transport.rejectAction({
    actionId: actionDraftId,
    messageId,
    sessionId,
  });

  if (!result.ok) {
    adapter.controller.failActionDraftOperation(actionDraftId, result.error.message || "目前無法取消動作，請稍後再試。", "failed", {
      idempotencyKey: prepared.idempotencyKey,
    });
    await emitError(result.error.code, result.error.message || "目前無法取消動作，請稍後再試。");
  }
}

async function openApprovalDetail(payload: {
  approvalRequestId: string;
  messageId?: string;
  sessionId?: string;
}) {
  const adapter = await getAdapter();
  const prepared = adapter.controller.prepareApprovalRequestOpenDetail(payload.approvalRequestId);

  if (!prepared.allowed) {
    return;
  }

  adapter.controller.startApprovalRequestOpenDetail(payload.approvalRequestId);
  await adapter.emitHostEvent("approval-detail-requested", {
    approvalRequestId: payload.approvalRequestId,
    messageId: payload.messageId,
    sessionId: payload.sessionId,
  });
  adapter.controller.completeApprovalRequestOpenDetail(payload.approvalRequestId);
}

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateMobileViewport);
  window.visualViewport?.removeEventListener("resize", updateVisualViewport);
  window.visualViewport?.removeEventListener("scroll", updateVisualViewport);
  releaseMobileViewportLock(runtimeScope);
  void adapterPromise.then(adapter => adapter.destroy());
});

defineExpose({
  close: closeWidget,
  open: openWidget,
});
</script>

<template>
  <section
    ref="sdkRootRef"
    class="assistant-sdk-root"
    data-assistant-sdk-root
    :data-mobile-open="mobilePanelVisible ? 'true' : undefined"
    :data-panel-transitioning="mobileViewport && (panelEntering || panelLeaving) ? 'true' : undefined"
    :data-runtime-scope="runtimeScope"
    :data-theme="props.configuration?.theme ?? 'system'"
    :data-position="props.configuration?.position ?? 'bottom-right'"
    aria-label="Internal assistant SDK"
  >
    <button
      v-if="launcherEnabled"
      class="assistant-sdk-launcher"
      data-assistant-launcher
      type="button"
      aria-label="Open assistant"
      title="Open assistant"
      :aria-expanded="panelOpen"
      @click="openWidget"
    >
      <AssistantProductIcon name="chat" />
    </button>
    <Transition
      name="assistant-sdk-panel"
      @after-enter="afterPanelEnter"
      @before-leave="beforePanelLeave"
      @after-leave="afterPanelLeave"
      @leave-cancelled="cancelPanelLeave"
    >
      <AssistantProductPanelShell
        v-if="panelOpen"
        class="assistant-sdk-panel"
        data-assistant-panel
        :data-panel-entered="panelEntered ? 'true' : undefined"
        :data-desktop-entering="panelEntering && !mobileViewport ? 'true' : undefined"
        :data-leaving="panelLeaving ? 'true' : undefined"
        :inert="panelLeaving"
        :aria-hidden="panelLeaving ? 'true' : undefined"
        :context-ready="panelContextReady"
        :status="panelStatus"
        title="AI 助理"
        restart-label="Restart assistant"
        close-label="Close assistant"
        :style="{
          width: props.configuration?.size?.width ? `${props.configuration.size.width}px` : undefined,
          height: props.configuration?.size?.height ? `${props.configuration.size.height}px` : undefined,
          zIndex: props.configuration?.zIndex,
        }"
        :show-history="historyAvailable"
        :history-open="panelView === 'history'"
        @close="closeWidget"
        @restart="restartWidget"
        @history="openSessionHistory"
        @back="backToChat"
      >
        <AssistantProductSessionList
          v-if="panelView === 'history'"
          :sessions="sessionListState.sessions"
          :current-session-id="currentSessionId"
          :loading="sessionListState.loading"
          :loading-more="sessionListState.loadingMore"
          :has-more="Boolean(sessionListState.nextCursor)"
          :error="sessionListState.error"
          :item-states="sessionListState.itemStates"
          :open-disabled="sessionSwitchDisabled"
          :show-delete="deleteAvailable"
          :view="sessionListState.view"
          :show-archived-view="archivedViewAvailable"
          @open="openSessionFromList"
          @archive="archiveSessionFromList"
          @delete="deleteSessionFromList"
          @unarchive="unarchiveSessionFromList"
          @switch-view="switchSessionListView"
          @load-more="loadSessionPage('more')"
          @retry="loadSessionPage('first')"
        />
        <AssistantProductRuntimePanel
          v-show="panelView === 'chat'"
          :controller="controller"
          :runtime-scope="runtimeScope"
          :composer-can-send="panelCanSend"
          :on-send-message="sendMessage"
          :on-choose-suggestion="sendChoice"
          :on-load-more-history="loadMoreHistory"
          :on-cancel-streaming="cancelStreaming"
          :on-submit-feedback="submitFeedback"
          :on-confirm-action-draft="confirmActionDraft"
          :on-cancel-action-draft="cancelActionDraft"
          :on-open-approval-detail="openApprovalDetail"
        />
      </AssistantProductPanelShell>
    </Transition>
  </section>
</template>
