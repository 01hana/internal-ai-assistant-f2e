export function createLifecycleResources() {
  return {
    cancelHistoryLoading: () => undefined,
    cleanupSse: () => undefined,
    disconnectObserver: () => undefined,
    removeListener: () => undefined,
    suppressCallback: () => undefined,
    timerId: 1,
  };
}

export function createLifecycleTransition(from: Partial<Record<string, string>>, to: Partial<Record<string, string>>) {
  return {
    from: {
      entityId: "order-001",
      organizationId: "org-001",
      sessionScope: "entity",
      ...from,
    },
    to: {
      entityId: "order-001",
      organizationId: "org-001",
      sessionScope: "entity",
      ...to,
    },
  };
}

export function createMountTarget() {
  return {
    dataset: {},
    isConnected: true,
  };
}
