<script setup lang="ts">
import {
  AssistantWidget,
  mountAssistantWidget,
} from "@internal-ai-assistant/assistant-sdk";
import type {
  AssistantHostContextProvider,
  HostCallbacks,
  WidgetConfiguration,
} from "@internal-ai-assistant/assistant-sdk";

import "@internal-ai-assistant/assistant-sdk/styles.css";

const route = useRoute();
const entity = ref(String(route.query.entityId ?? "order-001"));
const selectedRows = ref([
  {
    id: "row-001",
    selected: true,
  },
]);

const provider: AssistantHostContextProvider = () => ({
  hostApp: "reference-admin",
  organizationId: "org-reference",
  pageContext: {
    entityId: entity.value,
    entityType: "order",
    route: route.fullPath,
    screenId: String(route.name ?? "assistant-sdk-preview"),
    selectedRows: selectedRows.value,
  },
});

const configuration: WidgetConfiguration = {
  integrationMode: "backend001-compatibility",
  position: "bottom-right",
  sessionScope: "page",
  theme: "system",
};

const callbacks: HostCallbacks = {
  onClosed: () => undefined,
  onOpened: () => undefined,
};

const defaultTransportInitializationPath = "default transport initialization path";
const injectedTransportInitializationPath = "injected transport initialization path";

onMounted(() => {
  // Reference-only smoke path: prove the public helper is available without
  // creating a second runtime before the T073 integration boundary is complete.
  void mountAssistantWidget;
});

function toggleReferenceSelection() {
  selectedRows.value = selectedRows.value.length > 0
    ? []
    : [{ id: "row-001", selected: true }];
}
</script>

<template>
  <main class="assistant-sdk-preview">
    <h1>Assistant SDK Reference Consumer</h1>
    <p>
      Transport signals:
      <code>{{ defaultTransportInitializationPath }}</code>
      /
      <code>{{ injectedTransportInitializationPath }}</code>
    </p>
    <p>
      route: <code>{{ route.fullPath }}</code>,
      entity: <code>{{ entity }}</code>,
      selectedRows: <code>{{ selectedRows.length }}</code>
    </p>
    <button type="button" @click="toggleReferenceSelection">
      Toggle selectedRows
    </button>
    <AssistantWidget
      :callbacks="callbacks"
      :configuration="configuration"
      :provider="provider"
    />
  </main>
</template>
