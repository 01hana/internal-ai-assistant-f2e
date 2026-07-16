import { useAssistantSession } from "../../../../app/features/assistant/composables/useAssistantSession";
import { useAssistantSseStream } from "../../../../app/features/assistant/composables/useAssistantSseStream";
import { useChat } from "../../../../app/features/assistant/composables/useChat";

export const frontend001ComposableAdapter = {
  useChat,
  useAssistantSession,
  useAssistantSseStream,
} as const;

export type Frontend001ComposableAdapter =
  typeof frontend001ComposableAdapter;
