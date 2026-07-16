import { useAssistantSseStream } from "../../../../app/features/assistant/composables/useAssistantSseStream";

export const frontend001SseStreamAdapter = {
  useAssistantSseStream,
} as const;

export type Frontend001SseStreamAdapter =
  typeof frontend001SseStreamAdapter;
