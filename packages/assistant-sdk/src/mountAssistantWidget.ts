import type { MountHandle, MountOptions } from "./types/public";

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

export function mountAssistantWidget(options: MountOptions): MountHandle {
  resolveTarget(options.target);

  let isOpen = false;
  let isDestroyed = false;

  return {
    open() {
      if (!isDestroyed && !isOpen) {
        isOpen = true;
      }
    },
    close() {
      if (!isDestroyed && isOpen) {
        isOpen = false;
      }
    },
    unmount() {
      if (!isDestroyed && isOpen) {
        isOpen = false;
      }
    },
    destroy() {
      if (isDestroyed) {
        return;
      }

      isOpen = false;
      isDestroyed = true;
    },
  };
}
