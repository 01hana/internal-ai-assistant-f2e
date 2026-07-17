import { describe, expect, it } from "vitest";
import {
  createHostManagedSessionInput,
  createMemoryOnlyRuntimeState,
  createSessionNamespaceInput,
  createSpySessionStorage,
  createUnavailableSessionStorage,
  safeSessionNamespaceInput,
} from "../../fixtures/assistant-sdk/session-fallback-fixtures";

type SessionNamespaceResult =
  | {
      readonly namespace: string;
      readonly ok: true;
    }
  | {
      readonly error: {
        readonly code: string;
        readonly field?: string;
      };
      readonly ok: false;
    };

type SessionNamespaceModule = {
  readonly createSessionNamespace: (input: Readonly<Record<string, unknown>>) => SessionNamespaceResult;
};

type FallbackResolutionResult =
  | {
      readonly ok: true;
      readonly persistence: "memory" | "sessionStorage";
      readonly sessionId?: string;
    }
  | {
      readonly error: {
        readonly code: string;
        readonly field?: string;
      };
      readonly ok: false;
    };

type SessionStorageFallback = {
  readonly resolve: (input: Readonly<Record<string, unknown>>) => FallbackResolutionResult;
  readonly set: (input: Readonly<Record<string, unknown>>) => FallbackResolutionResult;
};

type SessionStorageFallbackModule = {
  readonly createSessionStorageFallback: (options: Readonly<Record<string, unknown>>) => SessionStorageFallback;
};

type MemorySessionFallback = {
  readonly get: (namespace: string) => FallbackResolutionResult;
  readonly set: (namespace: string, sessionId: string) => FallbackResolutionResult;
};

type MemorySessionFallbackModule = {
  readonly createMemorySessionFallback: () => MemorySessionFallback;
};

async function loadSessionNamespaceContract() {
  const contract = await import("../../../packages/assistant-sdk/src/session/sessionNamespace") as Partial<SessionNamespaceModule>;

  expect(
    typeof contract.createSessionNamespace,
    "sessionNamespace.ts must export createSessionNamespace.",
  ).toBe("function");

  return contract as SessionNamespaceModule;
}

async function loadSessionStorageFallbackContract() {
  const contract = await import("../../../packages/assistant-sdk/src/session/sessionStorageFallback") as Partial<SessionStorageFallbackModule>;

  expect(
    typeof contract.createSessionStorageFallback,
    "sessionStorageFallback.ts must export createSessionStorageFallback.",
  ).toBe("function");

  return contract as SessionStorageFallbackModule;
}

async function loadMemorySessionFallbackContract() {
  const contract = await import("../../../packages/assistant-sdk/src/session/memorySessionFallback") as Partial<MemorySessionFallbackModule>;

  expect(
    typeof contract.createMemorySessionFallback,
    "memorySessionFallback.ts must export createMemorySessionFallback.",
  ).toBe("function");

  return contract as MemorySessionFallbackModule;
}

function expectNamespace(result: SessionNamespaceResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected namespace success, got ${result.error.code}`);
  }

  return result.namespace;
}

function expectFailure(result: SessionNamespaceResult | FallbackResolutionResult) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected fallback/session namespace failure");
  }

  return result.error;
}

describe("Frontend 002 session fallback namespace", () => {
  it("creates deterministic namespace from package major, hostApp, organization, scope, page, and entity identity", async () => {
    const { createSessionNamespace } = await loadSessionNamespaceContract();

    const namespace = expectNamespace(createSessionNamespace(safeSessionNamespaceInput));

    for (const expectedPart of Object.values(safeSessionNamespaceInput)) {
      expect(namespace).toContain(expectedPart);
    }
  });

  it("changes namespace when organization changes", async () => {
    const { createSessionNamespace } = await loadSessionNamespaceContract();

    const orgA = expectNamespace(createSessionNamespace(createSessionNamespaceInput({ organizationId: "org-a" })));
    const orgB = expectNamespace(createSessionNamespace(createSessionNamespaceInput({ organizationId: "org-b" })));

    expect(orgA).not.toBe(orgB);
  });

  it("changes namespace when page identity changes", async () => {
    const { createSessionNamespace } = await loadSessionNamespaceContract();

    const pageA = expectNamespace(createSessionNamespace(createSessionNamespaceInput({ pageIdentity: "/orders/001" })));
    const pageB = expectNamespace(createSessionNamespace(createSessionNamespaceInput({ pageIdentity: "/orders/002" })));

    expect(pageA).not.toBe(pageB);
  });

  it("changes namespace when entity type or entity ID changes", async () => {
    const { createSessionNamespace } = await loadSessionNamespaceContract();

    const order = expectNamespace(createSessionNamespace(createSessionNamespaceInput({ entityId: "order-001", entityType: "order" })));
    const invoice = expectNamespace(createSessionNamespace(createSessionNamespaceInput({ entityId: "invoice-001", entityType: "invoice" })));

    expect(order).not.toBe(invoice);
  });

  it("rejects persistent fallback when hostApp or organization is missing", async () => {
    const { createSessionNamespace } = await loadSessionNamespaceContract();

    expectFailure(createSessionNamespace(createSessionNamespaceInput({ hostApp: "" })));
    expectFailure(createSessionNamespace(createSessionNamespaceInput({ organizationId: "" })));
  });

  it("rejects invalid sessionScope values", async () => {
    const { createSessionNamespace } = await loadSessionNamespaceContract();

    for (const sessionScope of ["global", "organization", "screen", "admin", "", undefined]) {
      const error = expectFailure(createSessionNamespace(createSessionNamespaceInput({
        sessionScope: sessionScope as "entity" | "page",
      })));

      expect(error.field).toBe("sessionScope");
    }
  });

  it("uses host sessionId when provided and does not read fallback pointer", async () => {
    const { createSessionStorageFallback } = await loadSessionStorageFallbackContract();
    const storage = createSpySessionStorage();
    let readCount = 0;
    const fallback = createSessionStorageFallback({
      storage: {
        ...storage,
        getItem: (key: string) => {
          readCount += 1;

          return storage.getItem(key);
        },
      },
    });
    const result = fallback.resolve(createHostManagedSessionInput());

    expect(result).toMatchObject({
      ok: true,
      sessionId: "host-session-001",
    });
    expect(readCount).toBe(0);
  });

  it("uses sessionStorage fallback only when host sessionId is missing and namespace is safe", async () => {
    const { createSessionStorageFallback } = await loadSessionStorageFallbackContract();
    const storage = createSpySessionStorage();
    const fallback = createSessionStorageFallback({ storage });
    const namespace = "assistant-sdk-v1:erp:org-001:entity:/orders/001:order:order-001";

    expect(fallback.set({ namespace, sessionId: "fallback-session-001" })).toMatchObject({
      ok: true,
      persistence: "sessionStorage",
    });
    expect(fallback.resolve({ namespace })).toMatchObject({
      ok: true,
      persistence: "sessionStorage",
      sessionId: "fallback-session-001",
    });
  });

  it("falls back to same-runtime memory continuity when sessionStorage is unavailable", async () => {
    const { createSessionStorageFallback } = await loadSessionStorageFallbackContract();
    const { createMemorySessionFallback } = await loadMemorySessionFallbackContract();
    const storageFallback = createSessionStorageFallback({ storage: createUnavailableSessionStorage() });
    const memoryFallback = createMemorySessionFallback();
    const state = createMemoryOnlyRuntimeState();

    expect(storageFallback.resolve({ namespace: state.namespace })).toMatchObject({
      ok: false,
    });
    expect(memoryFallback.set(state.namespace, state.sessionId)).toMatchObject({
      ok: true,
      persistence: "memory",
    });
    expect(memoryFallback.get(state.namespace)).toMatchObject({
      ok: true,
      persistence: "memory",
      sessionId: state.sessionId,
    });
  });

  it("rejects unsafe sessionStorage namespace, sessionId, and host sessionId strings", async () => {
    const { createSessionStorageFallback } = await loadSessionStorageFallbackContract();
    const fallback = createSessionStorageFallback({ storage: createSpySessionStorage() });

    for (const unsafeValue of ["token=abc", "sourceSystem:erp", "sessionScope=entity"]) {
      expectFailure(fallback.resolve({ hostSessionId: unsafeValue }));
      expectFailure(fallback.resolve({ namespace: unsafeValue }));
      expectFailure(fallback.set({ namespace: "assistant-sdk-v1:erp:org-001:entity:/orders/001:order:order-001", sessionId: unsafeValue }));
    }
  });

  it("rejects unsafe memory fallback namespace and sessionId strings", async () => {
    const { createMemorySessionFallback } = await loadMemorySessionFallbackContract();
    const memoryFallback = createMemorySessionFallback();

    for (const unsafeValue of ["token=abc", "sourceSystem:erp", "sessionScope=entity"]) {
      expectFailure(memoryFallback.get(unsafeValue));
      expectFailure(memoryFallback.set(unsafeValue, "memory-session-001"));
      expectFailure(memoryFallback.set("assistant-sdk-v1:erp:org-001:entity:/orders/001:order:order-001", unsafeValue));
    }
  });

  it("never reads or writes localStorage or cookie", async () => {
    const { createSessionStorageFallback } = await loadSessionStorageFallbackContract();
    const storage = createSpySessionStorage();
    const fallback = createSessionStorageFallback({ storage });

    fallback.resolve({ namespace: "assistant-sdk-v1:erp:org-001:page:/orders" });

    expect("localStorage" in fallback).toBe(false);
    expect("cookie" in fallback).toBe(false);
    expect("document" in fallback).toBe(false);
  });
});
