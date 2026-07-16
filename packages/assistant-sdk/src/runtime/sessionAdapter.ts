import { useAssistantSession } from "../../../../app/features/assistant/composables/useAssistantSession";
import { useAssistantSessionStore } from "../../../../app/stores/assistant/useSessionStore";

export const frontend001SessionLifecycleAdapter = {
  useAssistantSession,
  useAssistantSessionStore,
} as const;

export type Frontend001SessionLifecycleAdapter =
  typeof frontend001SessionLifecycleAdapter;
