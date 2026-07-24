<script setup lang="ts">
/// <reference types="vite/client" />
import { createPinia } from "pinia";
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef } from "vue";
import type {
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
    configuration?: WidgetConfiguration;
    callbacks?: HostCallbacks;
  }>(),
  {
    provider: undefined,
    configuration: undefined,
    callbacks: undefined,
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

type SdkRuntimeAdapter = {
  readonly cancelMessageStream: () => Promise<void>;
  readonly controller: any;
  readonly destroy: () => Promise<void>;
  readonly emitHostEvent: (eventName: string, payload?: Readonly<Record<string, unknown>>) => Promise<{ readonly ok: boolean }>;
  readonly resolveContext: (operation: "send" | "retry") => Promise<Readonly<Record<string, unknown>> | null>;
  readonly startMessageStream: (input: {
    message: string;
    pageContext?: Readonly<Record<string, unknown>>;
    sessionId?: string;
  }) => Promise<void>;
  readonly transport: any;
};

const runtimeRootModules = import.meta.glob("../../../assistant-runtime/src/components/AssistantRuntimeRoot.vue");
const runtimeModules = import.meta.glob("../../../assistant-runtime/src/runtime/index.ts");
const sdkRuntimeAdapterModules = import.meta.glob("../runtime/sdkRuntimeAdapter.ts");
const loadRuntimeRoot = runtimeRootModules["../../../assistant-runtime/src/components/AssistantRuntimeRoot.vue"] as (() => Promise<{ default: unknown }>) | undefined;
const loadRuntimeModule = runtimeModules["../../../assistant-runtime/src/runtime/index.ts"] as (() => Promise<Record<string, unknown>>) | undefined;
const loadSdkRuntimeAdapterModule = sdkRuntimeAdapterModules["../runtime/sdkRuntimeAdapter.ts"] as (() => Promise<{
  createSdkRuntimeAdapter: (options: Record<string, unknown>) => SdkRuntimeAdapter;
}>) | undefined;

if (!loadRuntimeRoot || !loadRuntimeModule || !loadSdkRuntimeAdapterModule) {
  throw new Error("assistant_sdk_runtime_modules_unavailable");
}

const AssistantRuntimeRoot = defineAsyncComponent(loadRuntimeRoot as () => Promise<any>);
const runtimeScope = createRuntimeScope(props.configuration);
const launcherEnabled = computed(() => props.configuration?.launcher?.enabled !== false);
const adapterRef = shallowRef<SdkRuntimeAdapter | null>(null);
const controller = computed(() => adapterRef.value?.controller ?? null);
const isOpen = computed(() => Boolean(adapterRef.value?.controller.stores.widget.isOpen.value));
const panelOpen = computed(() => isOpen.value || !launcherEnabled.value);

const adapterPromise = loadSdkRuntimeAdapterModule().then((module) => {
  const adapter = module.createSdkRuntimeAdapter({
    callbacks: props.callbacks,
    configuration: props.configuration,
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

  adapter.controller.setReady();
  adapter.controller.setContextReady(true);

  return context;
}

async function openWidget() {
  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;

  adapter.controller.stores.widget.isOpen.value = true;
  await adapter.emitHostEvent("opened", {
    sessionId: session.sessionId.value ?? undefined,
  });
  await prepareRuntimeForInteraction();
}

async function closeWidget() {
  const adapter = await getAdapter();
  const session = adapter.controller.stores.session;

  adapter.controller.stores.widget.isOpen.value = false;
  await adapter.emitHostEvent("closed", {
    sessionId: session.sessionId.value ?? undefined,
  });
}

async function sendMessage(message: string) {
  const text = message.trim();

  if (!text) {
    return;
  }

  const context = await prepareRuntimeForInteraction();

  if (!context) {
    return;
  }

  const adapter = await getAdapter();
  const helpers = await getRuntimeHelpers();
  const session = adapter.controller.stores.session;
  if (!session.sessionId.value) {
    try {
      await adapter.controller.createSession();
    }
    catch {
      await emitError("transport_execution_failed", "助理暫時無法建立對話，請稍後再試。");
    }
  }

  const sessionId = session.sessionId.value ?? undefined;
  const requestId = createRequestId("assistant-sdk-message");
  const createdAt = new Date().toISOString();
  const assistantMessageKey = `assistant-sdk-assistant:${requestId}`;

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
    pageContext: context,
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

  const sessionId = session.sessionId.value ?? "local-session";
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
  const sessionId = session.sessionId.value ?? "local-session";
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
  const sessionId = session.sessionId.value ?? "local-session";
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
      :aria-expanded="panelOpen"
      @click="openWidget"
    >
      Assistant
    </button>
    <aside
      v-if="panelOpen"
      class="assistant-sdk-panel"
      data-assistant-panel
      role="dialog"
      aria-label="Assistant panel"
      aria-live="polite"
      :style="{
        width: props.configuration?.size?.width ? `${props.configuration.size.width}px` : undefined,
        height: props.configuration?.size?.height ? `${props.configuration.size.height}px` : undefined,
        zIndex: props.configuration?.zIndex,
      }"
    >
      <header class="assistant-sdk-panel-header">
        <p>Assistant</p>
        <button
          v-if="launcherEnabled"
          type="button"
          aria-label="Close assistant"
          data-assistant-close
          @click="closeWidget"
        >
          Close
        </button>
      </header>
      <AssistantRuntimeRoot
        :controller="controller"
        :runtime-scope="runtimeScope"
        :on-send-message="sendMessage"
        :on-load-more-history="loadMoreHistory"
        :on-cancel-streaming="cancelStreaming"
        :on-submit-feedback="submitFeedback"
        :on-confirm-action-draft="confirmActionDraft"
        :on-cancel-action-draft="cancelActionDraft"
        :on-open-approval-detail="openApprovalDetail"
      />
    </aside>
  </section>
</template>
