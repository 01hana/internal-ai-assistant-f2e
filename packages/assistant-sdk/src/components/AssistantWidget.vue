<script setup lang="ts">
/// <reference types="vite/client" />
import { createPinia } from "pinia";
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef, type Component } from "vue";
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
    message: string;
    pageContext?: Readonly<Record<string, unknown>>;
    sessionId?: string;
  }) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly transport: any;
};

const productRuntimePanelModules = import.meta.glob("../../../assistant-runtime/src/components/product-ui/AssistantProductRuntimePanel.vue", { eager: true }) as Record<string, { default: Component }>;
const productPanelShellModules = import.meta.glob("../../../assistant-runtime/src/components/product-ui/AssistantProductPanelShell.vue", { eager: true }) as Record<string, { default: Component }>;
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
const runtimeModule = Object.values(runtimeModules)[0];
const sdkRuntimeAdapterModule = Object.values(sdkRuntimeAdapterModules)[0];
const loadRuntimeModule = async () => runtimeModule;
const loadSdkRuntimeAdapterModule = async () => sdkRuntimeAdapterModule;

if (!productRuntimePanelModule || !productPanelShellModule || !productIconModule || !runtimeModule || !sdkRuntimeAdapterModule) {
  throw new Error("assistant_sdk_runtime_modules_unavailable");
}

const AssistantProductRuntimePanel = defineAsyncComponent(async () => productRuntimePanelModule);
const AssistantProductPanelShell = defineAsyncComponent(async () => productPanelShellModule);
const AssistantProductIcon = defineAsyncComponent(async () => productIconModule);
const runtimeScope = createRuntimeScope(props.configuration);
const launcherEnabled = computed(() => props.configuration?.launcher?.enabled !== false);
const adapterRef = shallowRef<SdkRuntimeAdapter | null>(null);
const controller = computed(() => adapterRef.value?.controller ?? null);
const isOpen = computed(() => Boolean(adapterRef.value?.controller.stores.widget.isOpen.value));
const panelOpen = computed(() => isOpen.value || !launcherEnabled.value);
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

  adapter.controller.stores.widget.isOpen.value = true;
  await adapter.emitHostEvent("opened", {
    sessionId: session.sessionId.value ?? undefined,
  });
  await bootstrapSession();
}

async function closeWidget() {
  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;

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

async function sendMessage(message: string) {
  const text = message.trim();

  if (!text) {
    return;
  }

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
    content: text,
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
    message: text,
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

async function cancelStreaming() {
  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;
  const sessionId = session.sessionId.value;
  const messageId = session.activeAssistantMessageKey.value ?? session.activeRequestId.value;

  await adapter.cancelMessageStream();

  if (!sessionId || !messageId) {
    return;
  }

  const result = await adapter.transport.cancelMessage({ messageId, sessionId });

  if (!result.ok) {
    await emitError(result.error.code, result.error.message || "目前無法取消助理回覆。");
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
  void adapterPromise.then(adapter => adapter.destroy());
});

defineExpose({
  close: closeWidget,
  open: openWidget,
});
</script>

<template>
  <section
    class="assistant-sdk-root"
    data-assistant-sdk-root
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
    <AssistantProductPanelShell
      v-if="panelOpen"
      class="assistant-sdk-panel"
      data-assistant-panel
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
      @close="closeWidget"
      @restart="restartWidget"
    >
      <AssistantProductRuntimePanel
        :controller="controller"
        :runtime-scope="runtimeScope"
        :composer-can-send="panelCanSend"
        :on-send-message="sendMessage"
        :on-load-more-history="loadMoreHistory"
        :on-cancel-streaming="cancelStreaming"
        :on-submit-feedback="submitFeedback"
        :on-confirm-action-draft="confirmActionDraft"
        :on-cancel-action-draft="cancelActionDraft"
        :on-open-approval-detail="openApprovalDetail"
      />
    </AssistantProductPanelShell>
  </section>
</template>
