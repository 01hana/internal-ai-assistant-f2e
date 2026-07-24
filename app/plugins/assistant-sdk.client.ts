import type {
  AssistantHostContextProvider,
  HostCallbacks,
  WidgetConfiguration,
} from "@ideaxpress/assistant-sdk";

import "@ideaxpress/assistant-sdk/styles.css";

export default defineNuxtPlugin(() => {
  const route = useRoute();

  const provider: AssistantHostContextProvider = () => {
    const entity = String(route.query.entityId ?? "order-001");
    const selectedRows = [
      {
        entity,
        id: "row-001",
      },
    ] as const;

    return {
      actorId: "reference-user",
      hostApp: "reference-admin",
      organizationId: "org-reference",
      pageContext: {
        entityId: entity,
        entityType: "order",
        route: route.fullPath,
        screenId: String(route.name ?? "assistant-sdk-preview"),
        selectedRows,
      },
    };
  };

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

  return {
    provide: {
      assistantSdkReference: {
        callbacks,
        configuration,
        provider,
      },
    },
  };
});
