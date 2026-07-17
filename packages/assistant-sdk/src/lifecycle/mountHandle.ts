type MountResources = {
  readonly cancelHistoryLoading?: () => unknown;
  readonly cleanupSse?: () => unknown;
  readonly disconnectObserver?: () => unknown;
  readonly removeListener?: () => unknown;
  readonly suppressCallback?: () => unknown;
  readonly timerId?: ReturnType<typeof setTimeout> | number;
};

type MountOptions = {
  readonly callbacks?: {
    readonly onClosed?: () => unknown;
    readonly [key: string]: unknown;
  };
  readonly resources?: MountResources;
  readonly target: object;
};

type MountDiagnostic = {
  readonly code: string;
};

const mountedTargets = new WeakSet<object>();

function safeCall(callback: (() => unknown) | undefined) {
  try {
    callback?.();
  } catch {
    // Host lifecycle callbacks must not escape the package boundary.
  }
}

function cleanupResources(resources: MountResources | undefined) {
  safeCall(resources?.cleanupSse);
  safeCall(resources?.cancelHistoryLoading);
  safeCall(resources?.removeListener);
  safeCall(resources?.disconnectObserver);
  safeCall(resources?.suppressCallback);

  if (resources?.timerId !== undefined) {
    try {
      clearTimeout(resources.timerId);
    } catch {
      // Ignore fake timer handles from tests or non-browser hosts.
    }
  }
}

export function createMountHandle(options: MountOptions) {
  const diagnostics: MountDiagnostic[] = [];
  let isOpen = false;
  let cleanupDone = false;
  let isUnmounted = false;
  let isDestroyed = false;

  if (mountedTargets.has(options.target)) {
    diagnostics.push({ code: "duplicate_mount" });
  } else {
    mountedTargets.add(options.target);
  }

  function deactivate() {
    isOpen = false;
    isUnmounted = true;
    if (!cleanupDone) {
      cleanupDone = true;
      cleanupResources(options.resources);
    }
  }

  return {
    diagnostics,
    open() {
      if (!isUnmounted && !isDestroyed) {
        isOpen = true;
      }
    },
    close() {
      if (isUnmounted || isDestroyed) {
        return;
      }

      if (isOpen) {
        isOpen = false;
        safeCall(options.callbacks?.onClosed);
      }
    },
    unmount() {
      if (isUnmounted) {
        return;
      }

      deactivate();
      mountedTargets.delete(options.target);
    },
    destroy() {
      if (isDestroyed) {
        return;
      }

      deactivate();
      isDestroyed = true;
      mountedTargets.delete(options.target);
    },
  };
}
