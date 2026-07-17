export type SessionNamespaceInput = {
  readonly entityId: string;
  readonly entityType: string;
  readonly hostApp: string;
  readonly organizationId: string;
  readonly packageMajor: string;
  readonly pageIdentity: string;
  readonly sessionScope: "entity" | "page";
};

export const safeSessionNamespaceInput: SessionNamespaceInput = {
  entityId: "order-001",
  entityType: "order",
  hostApp: "erp",
  organizationId: "org-001",
  packageMajor: "assistant-sdk-v1",
  pageIdentity: "/orders/001",
  sessionScope: "entity",
};

export function createSessionNamespaceInput(
  overrides: Partial<SessionNamespaceInput> = {},
): SessionNamespaceInput {
  return {
    ...safeSessionNamespaceInput,
    ...overrides,
  };
}

export function createHostManagedSessionInput() {
  return {
    hostSessionId: "host-session-001",
    namespace: "assistant-sdk-v1:erp:org-001:entity:/orders/001:order:order-001",
  };
}

export function createMemoryOnlyRuntimeState() {
  return {
    namespace: "assistant-sdk-v1:erp:org-001:entity:/orders/001:order:order-001",
    sessionId: "memory-session-001",
  };
}

export function createUnavailableSessionStorage() {
  return {
    getItem: () => {
      throw new Error("sessionStorage unavailable");
    },
    removeItem: () => {
      throw new Error("sessionStorage unavailable");
    },
    setItem: () => {
      throw new Error("sessionStorage unavailable");
    },
  };
}

export function createSpySessionStorage() {
  const values = new Map<string, string>();

  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}
