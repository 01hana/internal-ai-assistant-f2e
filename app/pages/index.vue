<script setup lang="ts">
/**
 * Dev preview host page.
 *
 * This page is only a local/manual validation harness for the internal
 * assistant ChatWidget. It provides mock HostContextProvider snapshots so
 * ChatWidget host context, session bootstrap, send, and SSE flows can be
 * verified without a real ERP/MES/WMS host shell.
 *
 * Do not treat these identity headers, organization identifiers, permission
 * scopes, or pageContext values as production integration examples.
 */
import type {
  AssistantHostContextProvider,
  AssistantHostContextReadPurpose,
  AssistantHostContextSnapshot,
} from "../types/assistant";

type PreviewHostContextMode = "ready" | "context_not_ready";

const previewEnabled = import.meta.dev || process.env.NODE_ENV === "test";
const hostContextMode = ref<PreviewHostContextMode>(
  previewEnabled ? "ready" : "context_not_ready",
);
const widgetStore = useChatWidgetStore();
const sessionStore = useAssistantSessionStore();

function createReadySnapshot(
  purpose: AssistantHostContextReadPurpose,
): AssistantHostContextSnapshot {
  return {
    readiness: {
      status: "ready",
    },
    identityHeaders: {
      "x-actor-id": "preview-actor-001",
      "x-organization-id": "preview-organization-001",
      "x-host-app": "internal-admin-preview",
      "x-role": "operations-user",
      "x-permission-scopes": "orders:read",
    },
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
      visibleColumns: ["orderNumber", "customerName", "status", "updatedAt"],
    },
    metadataSummary: {
      hostApp: "internal-admin-preview",
      previewMode: "ready",
      readPurpose: purpose,
    },
  };
}

function createNotReadySnapshot(
  purpose: AssistantHostContextReadPurpose,
): AssistantHostContextSnapshot {
  return {
    readiness: {
      status: "not_ready",
      reason: "page_context_loading",
    },
    identityHeaders: null,
    pageContext: null,
    metadataSummary: {
      hostApp: "internal-admin-preview",
      previewMode: "context_not_ready",
      readPurpose: purpose,
    },
  };
}

const readyProvider: AssistantHostContextProvider = {
  getSnapshot: ({ purpose }) => createReadySnapshot(purpose),
};
const notReadyProvider: AssistantHostContextProvider = {
  getSnapshot: ({ purpose }) => createNotReadySnapshot(purpose),
};
const activeHostContextProvider = computed(() =>
  previewEnabled && hostContextMode.value === "ready"
    ? readyProvider
    : notReadyProvider,
);

function setHostContextMode(mode: PreviewHostContextMode) {
  if (!previewEnabled || hostContextMode.value === mode) {
    return;
  }

  widgetStore.reset();
  sessionStore.resetSessionState();
  hostContextMode.value = mode;
}
</script>

<template>
  <main class="min-h-screen bg-neutral-100 px-4 py-8 sm:px-8">
    <UContainer>
      <div class="mb-8">
        <UBadge
          label="Dev Preview / Demo Host"
          color="neutral"
          variant="subtle"
        />
        <h1 class="mt-3 text-2xl font-semibold text-highlighted">
          訂單作業總覽
        </h1>
        <p class="mt-2 max-w-2xl text-sm text-muted">
          此頁為本機開發用 demo host，用於驗證 AI 助理 widget 的 host
          context、session 與 SSE 流程。
        </p>
        <p class="mt-2 max-w-2xl text-xs text-muted">
          這裡顯示的 identity headers、organization、permission scopes 與
          pageContext 都是 preview-only mock data，不代表正式 production host
          integration。
        </p>
      </div>

      <UCard
        v-if="previewEnabled"
        class="mb-6"
        data-testid="preview-host-context-controls"
      >
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-highlighted">
              Host Context Mode
            </p>
            <p class="mt-1 text-xs text-muted">
              切換模式會關閉並重置助理；請重新開啟 launcher 驗證狀態。
            </p>
            <p class="mt-2 text-xs text-muted">
              這些 mode 只代表 preview harness 的 host context snapshots，不是
              正式宿主系統的整合範例。
            </p>
          </div>

          <div
            class="flex items-center gap-2"
            role="group"
            aria-label="Host context mode"
          >
            <UButton
              type="button"
              :variant="hostContextMode === 'ready' ? 'solid' : 'soft'"
              :aria-pressed="hostContextMode === 'ready'"
              data-testid="preview-host-context-ready"
              @click="setHostContextMode('ready')"
            >
              Ready
            </UButton>
            <UButton
              type="button"
              color="warning"
              :variant="
                hostContextMode === 'context_not_ready' ? 'solid' : 'soft'
              "
              :aria-pressed="hostContextMode === 'context_not_ready'"
              data-testid="preview-host-context-not-ready"
              @click="setHostContextMode('context_not_ready')"
            >
              Context Not Ready
            </UButton>
          </div>
        </div>

        <p class="mt-3 text-xs text-muted">
          Ready mode 仍需由同源
          <code>/api/v1</code>
          提供 assistant backend，才能完成這個 dev preview 的 session 與 SSE
          驗證。
        </p>
      </UCard>

      <div class="grid gap-4 md:grid-cols-3">
        <UCard
          v-for="item in [
            ['待確認訂單', '18'],
            ['今日出貨', '42'],
            ['異常待處理', '3'],
          ]"
          :key="item[0]"
        >
          <p class="text-sm text-muted">
            {{ item[0] }}
          </p>
          <p class="mt-2 text-3xl font-semibold text-highlighted">
            {{ item[1] }}
          </p>
        </UCard>
      </div>
    </UContainer>

    <ChatWidget
      :key="hostContextMode"
      :host-context-provider="activeHostContextProvider"
    />
  </main>
</template>
