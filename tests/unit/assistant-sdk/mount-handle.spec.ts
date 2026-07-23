import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createMountTarget } from "../../fixtures/assistant-sdk/widget-lifecycle-fixtures";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const mountHandleSourcePath = path.join(repoRoot, "packages/assistant-sdk/src/lifecycle/mountHandle.ts");

type MountHandle = {
  readonly close: () => unknown;
  readonly destroy: () => unknown | Promise<unknown>;
  readonly diagnostics: readonly { readonly code: string }[];
  readonly isActiveLifecycleVersion: (version: number) => boolean;
  readonly open: () => unknown;
  readonly runIfActive: <T>(version: number, callback: () => T) => T | undefined;
  readonly unmount: () => unknown | Promise<unknown>;
  readonly version: () => number;
};

type MountHandleModule = {
  readonly createMountHandle: (options: Readonly<Record<string, unknown>>) => MountHandle;
};

async function loadMountHandleModule() {
  const mod = await import("../../../packages/assistant-sdk/src/lifecycle/mountHandle") as Partial<MountHandleModule>;

  expect(mod.createMountHandle).toBeTypeOf("function");

  return mod as MountHandleModule;
}

describe("SDK mount handle lifecycle adapter", () => {
  it("delegates cleanup to SDK resources and Shared Runtime session lifecycle exactly once", async () => {
    const { createMountHandle } = await loadMountHandleModule();
    const resources = {
      cancelHistoryLoading: vi.fn(),
      cleanupSse: vi.fn(),
      disconnectObserver: vi.fn(),
      removeListener: vi.fn(),
      suppressCallback: vi.fn(),
      timerId: 1,
    };
    const sessionLifecycle = {
      cleanup: vi.fn(async () => undefined),
    };
    const handle = createMountHandle({
      resources,
      sessionLifecycle,
      target: createMountTarget(),
    });

    await handle.unmount();
    await handle.destroy();
    await handle.destroy();

    expect(resources.cleanupSse).toHaveBeenCalledTimes(1);
    expect(resources.cancelHistoryLoading).toHaveBeenCalledTimes(1);
    expect(resources.removeListener).toHaveBeenCalledTimes(1);
    expect(resources.disconnectObserver).toHaveBeenCalledTimes(1);
    expect(resources.suppressCallback).toHaveBeenCalledTimes(1);
    expect(sessionLifecycle.cleanup).toHaveBeenCalledTimes(1);
    expect(sessionLifecycle.cleanup).toHaveBeenCalledWith("unmount");
  });

  it("keeps duplicate mount diagnostics without sharing lifecycle state between instances", async () => {
    const { createMountHandle } = await loadMountHandleModule();
    const target = createMountTarget();
    const first = createMountHandle({ target });
    const second = createMountHandle({ target });
    const other = createMountHandle({ target: createMountTarget() });

    expect(second.diagnostics).toEqual([
      expect.objectContaining({
        code: expect.stringMatching(/duplicate_mount|already_mounted/),
      }),
    ]);
    expect(first.version()).toBe(0);
    expect(second.version()).toBe(0);
    expect(other.diagnostics).toEqual([]);
  });

  it("suppresses stale async callbacks captured before destroy", async () => {
    const { createMountHandle } = await loadMountHandleModule();
    const callback = vi.fn();
    const handle = createMountHandle({ target: createMountTarget() });
    const capturedVersion = handle.version();

    await handle.destroy();
    const result = handle.runIfActive(capturedVersion, callback);

    expect(result).toBeUndefined();
    expect(callback).not.toHaveBeenCalled();
    expect(handle.isActiveLifecycleVersion(capturedVersion)).toBe(false);
  });

  it("keeps close callback behavior while suppressing callbacks after unmount or destroy", async () => {
    const { createMountHandle } = await loadMountHandleModule();
    const onClosed = vi.fn();
    const handle = createMountHandle({
      callbacks: {
        onClosed,
      },
      target: createMountTarget(),
    });

    handle.open();
    handle.close();
    await handle.unmount();
    handle.close();
    await handle.destroy();
    handle.close();

    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("does not create runtime controllers, Pinia stores, SSE parsing, app imports, or public mount behavior", () => {
    const source = readFileSync(mountHandleSourcePath, "utf8");

    expect(source).not.toMatch(/createAssistantRuntimeController|createAssistantRuntimeStores/);
    expect(source).not.toMatch(/defineStore|createPinia|getActivePinia|setActivePinia/);
    expect(source).not.toMatch(/parseAssistantSse|createAssistantSseStreamRunner|ReadableStream|getReader/);
    expect(source).not.toMatch(/app\/(?:features|services|stores|utils)/);
    expect(source).not.toMatch(/mountAssistantWidget|AssistantWidget/);
  });
});
