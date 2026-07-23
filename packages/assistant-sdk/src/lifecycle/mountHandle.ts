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
  readonly sessionLifecycle?: {
    readonly cleanup?: (reason: string) => unknown | Promise<unknown>;
  };
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

async function safeCallAsync(callback: (() => unknown | Promise<unknown>) | undefined) {
  try {
    await callback?.();
  } catch {
    // Host/runtime cleanup is best-effort and must not escape the package boundary.
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
  let lifecycleVersion = 0;

  if (mountedTargets.has(options.target)) {
    diagnostics.push({ code: "duplicate_mount" });
  } else {
    mountedTargets.add(options.target);
  }

  async function deactivate(reason: "destroy" | "unmount") {
    isOpen = false;
    isUnmounted = true;
    if (!cleanupDone) {
      cleanupDone = true;
      lifecycleVersion += 1;
      cleanupResources(options.resources);
      await safeCallAsync(() => options.sessionLifecycle?.cleanup?.(reason));
    }
  }

  return {
    diagnostics,
    isActiveLifecycleVersion(version: number) {
      return !isUnmounted && !isDestroyed && version === lifecycleVersion;
    },
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
    runIfActive<T>(version: number, callback: () => T): T | undefined {
      if (!this.isActiveLifecycleVersion(version)) {
        return undefined;
      }

      return callback();
    },
    unmount() {
      if (isUnmounted) {
        return;
      }

      const cleanup = deactivate("unmount");
      mountedTargets.delete(options.target);

      return cleanup;
    },
    destroy() {
      if (isDestroyed) {
        return;
      }

      const cleanup = deactivate("destroy");
      isDestroyed = true;
      mountedTargets.delete(options.target);

      return cleanup;
    },
    version() {
      return lifecycleVersion;
    },
  };
}
