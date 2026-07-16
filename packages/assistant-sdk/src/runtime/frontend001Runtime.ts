import { frontend001ChatWidgetAdapter } from "./chatWidgetAdapter";
import { frontend001ComposableAdapter } from "./composableAdapter";
import { frontend001ServiceAdapter } from "./serviceAdapter";
import { frontend001SessionLifecycleAdapter } from "./sessionAdapter";
import { frontend001SseStreamAdapter } from "./sseStreamAdapter";

export const frontend001Runtime = {
  chatWidget: frontend001ChatWidgetAdapter,
  composables: frontend001ComposableAdapter,
  session: frontend001SessionLifecycleAdapter,
  sseStream: frontend001SseStreamAdapter,
  service: frontend001ServiceAdapter,
} as const;

export type Frontend001Runtime = typeof frontend001Runtime;
