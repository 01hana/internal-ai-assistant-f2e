import { createPinia } from "pinia";
import { createApp, h, ref, type App, type ComponentPublicInstance } from "vue";

import AssistantWidget from "./components/AssistantWidget.vue";
import type { MountHandle, MountOptions } from "./types/public";

type AssistantWidgetExpose = ComponentPublicInstance & {
  readonly close?: () => unknown | Promise<unknown>;
  readonly open?: () => unknown | Promise<unknown>;
};

type MountRecord = {
  readonly app: App<Element>;
  readonly mountRoot: HTMLDivElement;
  readonly target: Element;
  readonly widgetRef: ReturnType<typeof ref<AssistantWidgetExpose | null>>;
  destroyed: boolean;
};

const mountedTargets = new WeakMap<Element, MountRecord>();

function createMountError(code: string, message: string): Error {
  return Object.assign(new Error(message), {
    code,
    diagnostic: {
      code,
      message,
    },
  });
}

function resolveTarget(target: MountOptions["target"]): Element {
  if (typeof target === "string") {
    if (typeof document === "undefined") {
      throw new Error("mountAssistantWidget requires a browser document when target is a selector.");
    }

    const element = document.querySelector(target);

    if (!element) {
      throw new Error(`mountAssistantWidget target selector did not match an element: ${target}`);
    }

    return element;
  }

  if (typeof Element !== "undefined" && target instanceof Element) {
    return target;
  }

  throw new Error("mountAssistantWidget target must be an Element or selector string.");
}

function callWidgetMethod(
  record: MountRecord,
  methodName: "close" | "open",
) {
  if (record.destroyed) {
    return;
  }

  void record.widgetRef.value?.[methodName]?.();
}

function deactivate(record: MountRecord) {
  if (record.destroyed) {
    return;
  }

  record.destroyed = true;

  try {
    record.app.unmount();
  }
  finally {
    record.mountRoot.remove();
    mountedTargets.delete(record.target);
  }
}

export function mountAssistantWidget(options: MountOptions): MountHandle {
  const target = resolveTarget(options.target);

  if (mountedTargets.has(target)) {
    throw createMountError(
      "assistant_widget_duplicate_mount",
      "mountAssistantWidget target is already mounted with an active assistant widget.",
    );
  }

  const mountRoot = document.createElement("div");
  mountRoot.dataset.assistantSdkMountRoot = "";
  const pinia = createPinia();
  const widgetRef = ref<AssistantWidgetExpose | null>(null);
  const app = createApp({
    name: "AssistantSdkMountRoot",
    render: () => h(AssistantWidget, {
      callbacks: options.callbacks,
      configuration: options.configuration,
      provider: options.provider,
      ref: widgetRef,
    }),
  });
  const record: MountRecord = {
    app,
    destroyed: false,
    mountRoot,
    target,
    widgetRef,
  };

  app.use(pinia);
  target.append(mountRoot);
  mountedTargets.set(target, record);

  try {
    app.mount(mountRoot);
  }
  catch (error) {
    deactivate(record);
    throw error;
  }

  const handle: MountHandle = {
    open() {
      callWidgetMethod(record, "open");
    },
    close() {
      callWidgetMethod(record, "close");
    },
    unmount() {
      deactivate(record);
    },
    destroy() {
      deactivate(record);
    },
  };

  return handle;
}
