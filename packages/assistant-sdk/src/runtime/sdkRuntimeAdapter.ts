import type { Pinia } from "pinia";
import {
  createAssistantRuntimeController,
} from "../../../assistant-runtime/src/runtime";
import {
  createAssistantRuntimeStores,
} from "../../../assistant-runtime/src/stores";
import type {
  AssistantRuntimeTransportPort,
} from "../../../assistant-runtime/src/transport/ports";
import { createHostContextResolver } from "../context/hostContextProvider";
import type { HostContextOperation } from "../context/contextResolution";
import { createHostEventEmitter } from "../events/hostEventEmitter";
import { createMountHandle } from "../lifecycle/mountHandle";
import { createSdkSessionLifecycleAdapter } from "../session/sessionLifecycle";
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
    capabilities: options.capabilities,
    execute: options.execute,
    integrationMode,
  });
  const stores = createAssistantRuntimeStores({
    pinia: options.pinia,
    runtimeScope: options.runtimeScope,
  });
  const controller = createAssistantRuntimeController({
    runtimeScope: options.runtimeScope,
    stores,
    transport,
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
    transport,
  };
}
