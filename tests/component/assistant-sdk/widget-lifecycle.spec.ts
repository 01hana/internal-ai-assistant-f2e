import { describe, expect, it, vi } from "vitest";
import {
  createLifecycleResources,
  createLifecycleTransition,
  createMountTarget,
} from "../../fixtures/assistant-sdk/widget-lifecycle-fixtures";

type MountHandle = {
  readonly close: () => unknown;
  readonly destroy: () => unknown;
  readonly open: () => unknown;
  readonly unmount: () => unknown;
};

type MountHandleModule = {
  readonly createMountHandle: (options: Readonly<Record<string, unknown>>) => MountHandle;
};

type SessionLifecycleModule = {
  readonly createSessionLifecycleCoordinator: (options?: Readonly<Record<string, unknown>>) => {
    readonly cleanup: (reason: string) => unknown;
    readonly requiresCleanup: (input: Readonly<Record<string, unknown>>) => boolean;
  };
};

const mountHandleModulePath = "../../../packages/assistant-sdk/src/lifecycle/mountHandle";
const sessionLifecycleModulePath = "../../../packages/assistant-sdk/src/session/sessionLifecycle";

async function loadMountHandleContract() {
  const contract = await import(mountHandleModulePath) as Partial<MountHandleModule>;

  expect(typeof contract.createMountHandle, "mountHandle.ts must export createMountHandle.").toBe("function");

  return contract as MountHandleModule;
}

async function loadSessionLifecycleContract() {
  const contract = await import(sessionLifecycleModulePath) as Partial<SessionLifecycleModule>;

  expect(
    typeof contract.createSessionLifecycleCoordinator,
    "sessionLifecycle.ts must export createSessionLifecycleCoordinator.",
  ).toBe("function");

  return contract as SessionLifecycleModule;
}

describe("Frontend 002 widget lifecycle cleanup", () => {
  it("createMountHandle exposes open, close, unmount, and destroy", async () => {
    const { createMountHandle } = await loadMountHandleContract();
    const handle = createMountHandle({ target: createMountTarget() });

    expect(handle.open).toBeTypeOf("function");
    expect(handle.close).toBeTypeOf("function");
    expect(handle.unmount).toBeTypeOf("function");
    expect(handle.destroy).toBeTypeOf("function");
  });

  it("open, close, unmount, and destroy are idempotent", async () => {
    const { createMountHandle } = await loadMountHandleContract();
    const handle = createMountHandle({ target: createMountTarget() });

    expect(() => {
      handle.open();
      handle.open();
      handle.close();
      handle.close();
      handle.unmount();
      handle.unmount();
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });

  it("duplicate mount returns a diagnosable safe error or diagnostic state", async () => {
    const { createMountHandle } = await loadMountHandleContract();
    const target = createMountTarget();
    const first = createMountHandle({ target });
    const second = createMountHandle({ target });

    first.open();

    expect(second).toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: expect.stringMatching(/duplicate_mount|already_mounted/),
        }),
      ]),
    });
  });

  it("unmount and destroy clean listeners, timers, observers, SSE, and history loading", async () => {
    const { createMountHandle } = await loadMountHandleContract();
    const resources = {
      cancelHistoryLoading: vi.fn(),
      cleanupSse: vi.fn(),
      disconnectObserver: vi.fn(),
      removeListener: vi.fn(),
      suppressCallback: vi.fn(),
      timerId: 1,
    };
    const handle = createMountHandle({
      resources: {
        ...createLifecycleResources(),
        ...resources,
      },
      target: createMountTarget(),
    });

    handle.unmount();
    handle.destroy();

    expect(resources.cleanupSse).toHaveBeenCalled();
    expect(resources.cancelHistoryLoading).toHaveBeenCalled();
    expect(resources.removeListener).toHaveBeenCalled();
    expect(resources.disconnectObserver).toHaveBeenCalled();
    expect(resources.suppressCallback).toHaveBeenCalled();
  });

  it("does not clean lifecycle resources twice when unmount is followed by destroy", async () => {
    const { createMountHandle } = await loadMountHandleContract();
    const resources = {
      cancelHistoryLoading: vi.fn(),
      cleanupSse: vi.fn(),
      disconnectObserver: vi.fn(),
      removeListener: vi.fn(),
      suppressCallback: vi.fn(),
      timerId: 1,
    };
    const handle = createMountHandle({
      resources,
      target: createMountTarget(),
    });

    handle.unmount();
    handle.destroy();
    handle.destroy();

    expect(resources.cleanupSse).toHaveBeenCalledTimes(1);
    expect(resources.cancelHistoryLoading).toHaveBeenCalledTimes(1);
    expect(resources.removeListener).toHaveBeenCalledTimes(1);
    expect(resources.disconnectObserver).toHaveBeenCalledTimes(1);
    expect(resources.suppressCallback).toHaveBeenCalledTimes(1);
  });

  it("suppresses post-unmount and post-destroy host callbacks", async () => {
    const { createMountHandle } = await loadMountHandleContract();
    const onClosed = vi.fn();
    const handle = createMountHandle({
      callbacks: { onClosed },
      target: createMountTarget(),
    });

    handle.unmount();
    handle.close();
    handle.destroy();
    handle.close();

    expect(onClosed).not.toHaveBeenCalled();
  });

  it("cleans stale lifecycle resources when organization, entity, or sessionScope changes", async () => {
    const { createSessionLifecycleCoordinator } = await loadSessionLifecycleContract();
    const coordinator = createSessionLifecycleCoordinator();

    for (const transition of [
      createLifecycleTransition({ organizationId: "org-a" }, { organizationId: "org-b" }),
      createLifecycleTransition({ entityId: "order-001" }, { entityId: "order-002" }),
      createLifecycleTransition({ sessionScope: "entity" }, { sessionScope: "page" }),
    ]) {
      expect(coordinator.requiresCleanup(transition)).toBe(true);
      expect(() => coordinator.cleanup("context_changed")).not.toThrow();
    }
  });

  it("runs session lifecycle cleanup once and keeps repeated cleanup no-throw", async () => {
    const { createSessionLifecycleCoordinator } = await loadSessionLifecycleContract();
    const resources = {
      cancelHistoryLoading: vi.fn(),
      cleanupSse: vi.fn(() => {
        throw new Error("cleanup failure");
      }),
      disconnectObserver: vi.fn(),
      removeListener: vi.fn(),
      suppressCallback: vi.fn(),
      timerId: 1,
    };
    const coordinator = createSessionLifecycleCoordinator({ resources });

    expect(() => {
      coordinator.cleanup("context_changed");
      coordinator.cleanup("context_changed");
    }).not.toThrow();

    expect(resources.cleanupSse).toHaveBeenCalledTimes(1);
    expect(resources.cancelHistoryLoading).toHaveBeenCalledTimes(1);
    expect(resources.removeListener).toHaveBeenCalledTimes(1);
    expect(resources.disconnectObserver).toHaveBeenCalledTimes(1);
    expect(resources.suppressCallback).toHaveBeenCalledTimes(1);
  });
});
