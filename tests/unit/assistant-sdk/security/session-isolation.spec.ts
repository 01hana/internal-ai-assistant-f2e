import { describe, expect, it } from "vitest";
import {
  createEntityIsolationInputs,
  createHostIsolationInputs,
  createOrganizationIsolationInputs,
  createSessionScopeIsolationInputs,
  createSessionScopeLeakSurfaces,
  identityProofForbiddenFields,
} from "../../../fixtures/assistant-sdk/session-isolation-fixtures";
import { createSessionNamespaceInput } from "../../../fixtures/assistant-sdk/session-fallback-fixtures";

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

type SessionLifecycleModule = {
  readonly createSessionLifecycleCoordinator: (options?: Readonly<Record<string, unknown>>) => {
    readonly requiresCleanup: (input: Readonly<Record<string, unknown>>) => boolean;
  };
};

type SessionScopeGuardModule = {
  readonly assertSessionScopeLocalOnly: (
    surfaces: Readonly<Record<string, unknown>>,
  ) => {
    readonly error?: {
      readonly code: string;
      readonly field?: string;
      readonly surface?: string;
    };
    readonly ok: boolean;
  };
};

async function loadSessionNamespaceContract() {
  const contract = await import("../../../../packages/assistant-sdk/src/session/sessionNamespace") as Partial<SessionNamespaceModule>;

  expect(typeof contract.createSessionNamespace, "sessionNamespace.ts must export createSessionNamespace.").toBe("function");

  return contract as SessionNamespaceModule;
}

async function loadSessionLifecycleContract() {
  const contract = await import("../../../../packages/assistant-sdk/src/session/sessionLifecycle") as Partial<SessionLifecycleModule>;

  expect(
    typeof contract.createSessionLifecycleCoordinator,
    "sessionLifecycle.ts must export createSessionLifecycleCoordinator.",
  ).toBe("function");

  return contract as SessionLifecycleModule;
}

async function loadSessionScopeGuardContract() {
  const contract = await import("../../../../packages/assistant-sdk/src/session/sessionScopeGuard") as Partial<SessionScopeGuardModule>;

  expect(
    typeof contract.assertSessionScopeLocalOnly,
    "sessionScopeGuard.ts must export assertSessionScopeLocalOnly.",
  ).toBe("function");

  return contract as SessionScopeGuardModule;
}

function expectNamespace(result: SessionNamespaceResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected namespace success, got ${result.error.code}`);
  }

  return result.namespace;
}

function expectFailure(result: SessionNamespaceResult) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected namespace failure");
  }

  return result.error;
}

describe("Frontend 002 session organization isolation and identity proof", () => {
  it("prevents persistent fallback when organization or hostApp is missing", async () => {
    const { createSessionNamespace } = await loadSessionNamespaceContract();

    expectFailure(createSessionNamespace(createSessionNamespaceInput({ organizationId: "" })));
    expectFailure(createSessionNamespace(createSessionNamespaceInput({ hostApp: "" })));
  });

  it("does not treat memory, fallback pointer, or host sessionId as identity proof", async () => {
    for (const identityCandidate of [
      { memorySessionId: "memory-session-001" },
      { fallbackPointer: "fallback-session-001" },
      { sessionId: "host-session-001" },
    ]) {
      for (const forbiddenAuthority of identityProofForbiddenFields) {
        expect(identityCandidate).not.toHaveProperty(forbiddenAuthority);
      }
    }
  });

  it("does not share fallback pointers across organization, host, entity, or scope namespaces", async () => {
    const { createSessionNamespace } = await loadSessionNamespaceContract();
    const { orgA, orgB } = createOrganizationIsolationInputs();
    const { erp, mes } = createHostIsolationInputs();
    const { entityA, entityB } = createEntityIsolationInputs();
    const { entityScope, pageScope } = createSessionScopeIsolationInputs();

    expect(expectNamespace(createSessionNamespace(orgA))).not.toBe(expectNamespace(createSessionNamespace(orgB)));
    expect(expectNamespace(createSessionNamespace(erp))).not.toBe(expectNamespace(createSessionNamespace(mes)));
    expect(expectNamespace(createSessionNamespace(entityA))).not.toBe(expectNamespace(createSessionNamespace(entityB)));
    expect(expectNamespace(createSessionNamespace(entityScope))).not.toBe(expectNamespace(createSessionNamespace(pageScope)));
  });

  it("requires lifecycle cleanup when organization, entity, or sessionScope changes", async () => {
    const { createSessionLifecycleCoordinator } = await loadSessionLifecycleContract();
    const coordinator = createSessionLifecycleCoordinator();

    for (const transition of [
      { from: { organizationId: "org-a" }, to: { organizationId: "org-b" } },
      { from: { entityId: "order-001" }, to: { entityId: "order-002" } },
      { from: { sessionScope: "entity" }, to: { sessionScope: "page" } },
    ]) {
      expect(coordinator.requiresCleanup(transition)).toBe(true);
    }
  });

  it("requires lifecycle cleanup when from/to or important fields are missing", async () => {
    const { createSessionLifecycleCoordinator } = await loadSessionLifecycleContract();
    const coordinator = createSessionLifecycleCoordinator();
    const complete = createSessionNamespaceInput();

    expect(coordinator.requiresCleanup({})).toBe(true);
    expect(coordinator.requiresCleanup({ from: complete })).toBe(true);
    expect(coordinator.requiresCleanup({ to: complete })).toBe(true);
    expect(coordinator.requiresCleanup({
      from: complete,
      to: { ...complete, organizationId: undefined },
    })).toBe(true);
    expect(coordinator.requiresCleanup({
      from: complete,
      to: complete,
    })).toBe(false);
  });

  it("prevents fallback state from carrying permission, source, connector, evidence, or credential authority", async () => {
    const { createSessionNamespace } = await loadSessionNamespaceContract();

    for (const field of identityProofForbiddenFields) {
      const error = expectFailure(createSessionNamespace({
        ...createSessionNamespaceInput(),
        [field]: "frontend-owned-authority",
      }));

      expect(error.field ?? field).toBe(field);
    }
  });

  it("keeps sessionScope out of backend body, headers, PageContext, hidden prompt, message text, transport metadata, and HostCallbacks payload", async () => {
    const { assertSessionScopeLocalOnly } = await loadSessionScopeGuardContract();

    for (const [surface, value] of Object.entries(createSessionScopeLeakSurfaces())) {
      const result = assertSessionScopeLocalOnly({ [surface]: value });

      expect(result.ok).toBe(false);
      expect(result.error).toMatchObject({
        field: "sessionScope",
        surface,
      });
    }
  });

  it("detects sessionScope even when another forbidden field appears first", async () => {
    const { assertSessionScopeLocalOnly } = await loadSessionScopeGuardContract();
    const result = assertSessionScopeLocalOnly({
      body: {
        token: "secret",
        nested: {
          sessionScope: "entity",
        },
      },
    });

    expect(result).toMatchObject({
      error: {
        field: "sessionScope",
        surface: "body",
      },
      ok: false,
    });
  });

  it("detects nested, array, and string sessionScope leakage", async () => {
    const { assertSessionScopeLocalOnly } = await loadSessionScopeGuardContract();

    for (const [surface, value] of Object.entries({
      body: { nested: { sessionScope: "page" } },
      headers: [{ sessionScope: "entity" }],
      messageText: "Use sessionScope=page",
    })) {
      expect(assertSessionScopeLocalOnly({ [surface]: value })).toMatchObject({
        error: {
          field: "sessionScope",
          surface,
        },
        ok: false,
      });
    }
  });
});
