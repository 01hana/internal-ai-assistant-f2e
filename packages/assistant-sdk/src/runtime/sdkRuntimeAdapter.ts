import type { Pinia } from "pinia";
import {
  createAssistantRuntimeController,
} from "../../../assistant-runtime/src/runtime";
import {
  createAssistantSseStreamRunner,
  type AssistantFinalSseEvent,
  type AssistantSseStreamSafeError,
} from "../../../assistant-runtime/src/sse";
import {
  createAssistantRuntimeStores,
} from "../../../assistant-runtime/src/stores";
import type {
  AssistantSseEvent,
} from "../../../assistant-runtime/src/types";
import type {
  AssistantRuntimeStreamMessageInput,
  AssistantRuntimeTransportPort,
} from "../../../assistant-runtime/src/transport/ports";
import { createHostContextResolver } from "../context/hostContextProvider";
import type { HostContextOperation } from "../context/contextResolution";
import { createHostEventEmitter } from "../events/hostEventEmitter";
import { createMountHandle } from "../lifecycle/mountHandle";
import { createSdkSessionLifecycleAdapter } from "../session/sessionLifecycle";
import { createSdkSessionBootstrap } from "../session/sessionBootstrap";
import type {
  AssistantHostContextProvider,
  HostCallbacks,
  IntegrationMode,
  WidgetConfiguration,
} from "../types/public";
import {
  createDefaultTransport,
  type DefaultTransportOptions,
} from "../transport/defaultTransport";

type SdkRuntimeAdapterOptions = {
  readonly callbacks?: HostCallbacks;
  readonly configuration?: WidgetConfiguration;
  readonly pinia: Pinia;
  readonly provider: AssistantHostContextProvider;
  readonly runtimeScope: string;
  readonly transport?: AssistantRuntimeTransportPort;
} & Pick<DefaultTransportOptions, "capabilities" | "execute">;

function resolveIntegrationMode(configuration: WidgetConfiguration | undefined): IntegrationMode {
  return configuration?.integrationMode ?? "backend001-compatibility";
}

export function createSdkRuntimeAdapter(options: SdkRuntimeAdapterOptions) {
  const integrationMode = resolveIntegrationMode(options.configuration);
  const transport = options.transport ?? createDefaultTransport({
    apiBaseUrl: options.configuration?.apiBaseUrl,
    capabilities: options.capabilities,
    execute: options.execute,
    integrationMode,
  });
  const stores = createAssistantRuntimeStores({
    pinia: options.pinia,
    runtimeScope: options.runtimeScope,
  });
  const sessionLifecycle = createSdkSessionLifecycleAdapter({
    namespace: options.configuration?.sessionScope,
    transport,
  });
  const hostContextResolver = createHostContextResolver({
    integrationMode,
    provider: options.provider,
  });
  const hostEvents = createHostEventEmitter({
    callbacks: options.callbacks,
  });
  const mountHandle = createMountHandle({
    sessionLifecycle,
    target: {},
  });
  let destroyed = false;
  let lifecycleVersion = 0;

  function toSafeStreamError(error: AssistantSseStreamSafeError) {
    return {
      code: error.code,
      message: error.safeMessage,
      userMessage: error.safeMessage,
    };
  }

  async function emitStreamError(error: AssistantSseStreamSafeError): Promise<void> {
    controller.markStreamingFailed();
    controller.clearStreamingState();
    controller.setLastError({
      code: error.code,
      safeMessage: error.safeMessage,
    }, null);
    await hostEvents.emit("error", {
      error: toSafeStreamError(error),
    });
  }

  function isFinalEvent(event: AssistantSseEvent): event is AssistantFinalSseEvent {
    return event.eventType === "final";
  }

  function alignActiveStreamingRequest(event: AssistantSseEvent): void {
    const session = controller.stores.session;
    const activeMessageKey = session.activeAssistantMessageKey.value;

    if (
      activeMessageKey
      && session.activeRequestId.value !== event.requestId
    ) {
      controller.setStreamingRequest(event.requestId, activeMessageKey);
    }
  }

  function forceActiveStreamingTerminal(status: "failed" | "interrupted"): void {
    const session = controller.stores.session;
    const activeMessageKey = session.activeAssistantMessageKey.value;
    const messages = session.messages.value as Array<Record<string, unknown>>;
    const message = messages.find(candidate =>
      candidate.kind === "assistant_streaming"
      && candidate.key === activeMessageKey,
    ) ?? [...messages].reverse().find(candidate =>
      candidate.kind === "assistant_streaming"
      && candidate.status !== "completed",
    );

    if (!message || message.status === "completed") {
      return;
    }

    if (typeof message.pendingContent === "string" && message.pendingContent.length > 0) {
      message.content = `${typeof message.content === "string" ? message.content : ""}${message.pendingContent}`;
    }

    message.pendingContent = "";
    message.typingVisibleUntil = null;
    message.status = status;
  }

  const sseRunner = createAssistantSseStreamRunner<AssistantRuntimeStreamMessageInput>({
    callbacks: {
      onAbort: () => {
        controller.markStreamingCancelled();
        controller.clearStreamingState();
      },
      onEvent: (event) => {
        alignActiveStreamingRequest(event);
        if (!isFinalEvent(event)) {
          controller.applyStreamingEvent(event);
        }
      },
      onFinal: (event) => {
        alignActiveStreamingRequest(event);
        controller.markStreamingFinalizing();
        controller.finalizeActiveStreamingMessage(event);
        void hostEvents.emit("answer-completed", {
          messageId: event.messageId,
          sessionId: event.sessionId,
          status: event.data.answerDecision,
        });
      },
      onComplete: () => {
        controller.clearStreamingState();
      },
      onInterrupted: (error) => {
        controller.markStreamingInterrupted();
        forceActiveStreamingTerminal("interrupted");
        controller.clearStreamingState();
        void emitStreamError(error);
      },
      onTimeout: (error) => {
        void emitStreamError(error);
      },
      onTransportError: (error) => {
        void emitStreamError(error);
      },
    },
    openStream: async (input, runtimeOptions) => {
      const result = await transport.streamMessage(input, runtimeOptions);

      if (!result.ok) {
        throw new Error(result.error.code);
      }

      return result.value;
    },
  });

  const controller = createAssistantRuntimeController({
    runtimeScope: options.runtimeScope,
    sseRunner,
    stores,
    transport,
  });

  const sessionBootstrap = createSdkSessionBootstrap({
    configuration: options.configuration,
    controller,
    emitHostEvent: hostEvents.emit,
    resolveSnapshot: resolveBootstrapSnapshot,
    transport,
  });

  // A launcher-less widget renders its panel immediately, so it needs the same
  // session bootstrap that the launcher click starts for the default shell.
  if (options.configuration?.launcher?.enabled === false) {
    void sessionBootstrap.bootstrap();
  }

  function getLifecycleVersion(): number {
    return lifecycleVersion;
  }

  function isActiveLifecycleVersion(version: number): boolean {
    return !destroyed && version === lifecycleVersion;
  }

  async function resolveContext(operation: HostContextOperation): Promise<Readonly<Record<string, unknown>> | null> {
    if (destroyed) {
      return null;
    }

    const result = await hostContextResolver.resolveForRequest({ operation });

    if (!result.ok) {
      controller.setContextReady(false);
      await hostEvents.emit("context-resolution-failed", {
        error: result.error,
      });
      return null;
    }

    controller.setContextReady(true);
    return result.context;
  }

  async function resolveBootstrapSnapshot() {
    if (destroyed) {
      return {
        error: {
          code: "context_unavailable",
          message: "context_unavailable",
          retryable: true,
          userMessage: "context unavailable",
        },
        ok: false as const,
      };
    }

    const result = await hostContextResolver.resolveBootstrapSnapshot();
    if (!result.ok) {
      controller.setContextReady(false);
      await hostEvents.emit("context-resolution-failed", { error: result.error });
      return result;
    }

    controller.setContextReady(true);
    return result;
  }

  async function destroy(): Promise<void> {
    if (destroyed) {
      return;
    }

    destroyed = true;
    lifecycleVersion += 1;
    hostEvents.destroy();
    await sessionLifecycle.cleanup("destroy");
    await controller.cleanup();
    await mountHandle.destroy();
  }

  return {
    controller,
    destroy,
    emitHostEvent: hostEvents.emit,
    getLifecycleVersion,
    hostEvents,
    isActiveLifecycleVersion,
    mountHandle,
    resolveContext,
    runIfActive<T>(version: number, callback: () => T): T | undefined {
      if (!isActiveLifecycleVersion(version)) {
        return undefined;
      }

      return callback();
    },
    sessionLifecycle,
    bootstrapSession: sessionBootstrap.bootstrap,
    sseRunner,
    startMessageStream(input: AssistantRuntimeStreamMessageInput): Promise<void> {
      if (destroyed) {
        return Promise.resolve();
      }

      return sseRunner.start(input);
    },
    cancelMessageStream(): Promise<void> {
      return sseRunner.cancel();
    },
    transport,
  };
}
