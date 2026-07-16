export { default as AssistantWidget } from "./components/AssistantWidget.vue";
export { mountAssistantWidget } from "./mountAssistantWidget";

export type {
  AssistantHostContextProvider,
  HostCallbacks,
  HostEvents,
  IntegrationMode,
  MountHandle,
  MountOptions,
  SafeError,
  SanitizedPageContext,
  WidgetConfiguration,
} from "./types/public";
