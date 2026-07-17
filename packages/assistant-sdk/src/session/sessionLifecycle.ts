type LifecycleState = Readonly<Record<string, unknown>>;

type LifecycleTransition = {
  readonly from?: LifecycleState;
  readonly to?: LifecycleState;
};

type LifecycleResources = {
  readonly cancelHistoryLoading?: () => unknown;
  readonly cleanupSse?: () => unknown;
  readonly disconnectObserver?: () => unknown;
  readonly removeListener?: () => unknown;
  readonly suppressCallback?: () => unknown;
  readonly timerId?: ReturnType<typeof setTimeout> | number;
};

const cleanupFields = [
  "hostApp",
  "organizationId",
  "entityType",
  "entityId",
  "pageIdentity",
  "sessionScope",
] as const;

function safeCall(callback: (() => unknown) | undefined) {
  try {
    callback?.();
  } catch {
    // Cleanup is best-effort and must not leak host/runtime errors.
  }
}

function clearTimer(timerId: LifecycleResources["timerId"]) {
  if (timerId === undefined) {
    return;
  }

  try {
    clearTimeout(timerId);
  } catch {
    // Non-browser fake timer IDs used by tests should remain harmless.
  }
}

export function createSessionLifecycleCoordinator(options: {
  readonly resources?: LifecycleResources;
} = {}) {
  const resources = options.resources;
  let cleanupDone = false;

  return {
    cleanup(_reason: string) {
      if (cleanupDone) {
        return;
      }

      cleanupDone = true;
      safeCall(resources?.cleanupSse);
      safeCall(resources?.cancelHistoryLoading);
      safeCall(resources?.removeListener);
      safeCall(resources?.disconnectObserver);
      safeCall(resources?.suppressCallback);
      clearTimer(resources?.timerId);
    },
    requiresCleanup(input: LifecycleTransition) {
      if (!input.from || !input.to) {
        return true;
      }

      const from = input.from;
      const to = input.to;

      return cleanupFields.some(field => from[field] === undefined || to[field] === undefined || from[field] !== to[field]);
    },
  };
}
