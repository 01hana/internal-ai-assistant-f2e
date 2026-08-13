import type { AssistantRuntimeController } from "../../../assistant-runtime/src/runtime";
import { supportsAssistantRuntimeRemoteRestoration } from "../../../assistant-runtime/src/transport/ports";
import type {
  AssistantRuntimeSession,
  AssistantRuntimeTransportPort,
} from "../../../assistant-runtime/src/transport/ports";
import type {
  WidgetConfiguration,
} from "../types/public";
import type { HostContextBootstrapSnapshotResolutionResult } from "../context/contextResolution";
import { createSessionNamespace } from "./sessionNamespace";
import { createSessionStorageFallback } from "./sessionStorageFallback";

type BootstrapResult = {
  readonly error?: { readonly code: string; readonly safeMessage: string };
  readonly ok: boolean;
  readonly sessionId?: string;
};

type LocalSessionContext = Readonly<Record<string, unknown>>;

type SessionBootstrapOptions = {
  readonly configuration?: WidgetConfiguration;
  readonly controller: AssistantRuntimeController;
  readonly emitHostEvent: (eventName: string, payload?: Readonly<Record<string, unknown>>) => Promise<{ readonly ok: boolean }>;
  readonly resolveSnapshot: () => Promise<HostContextBootstrapSnapshotResolutionResult>;
  readonly transport: AssistantRuntimeTransportPort;
};

type StoredSession = {
  readonly namespace: string;
  readonly storage: ReturnType<typeof createSessionStorageFallback>;
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function record(value: unknown): LocalSessionContext {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as LocalSessionContext
    : {};
}

function readPageValue(pageContext: LocalSessionContext, field: string): string | null {
  return nonEmptyString(pageContext[field]);
}

function getSessionStorage(): Storage | undefined {
  try {
    return typeof globalThis.sessionStorage === "undefined"
      ? undefined
      : globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function isUsableSession(value: AssistantRuntimeSession): value is AssistantRuntimeSession & { readonly sessionId: string } {
  return nonEmptyString(value?.sessionId) !== null;
}

function resolveStoredSession(
  context: LocalSessionContext,
  configuration: WidgetConfiguration | undefined,
): StoredSession | null {
  const sessionScope = configuration?.sessionScope?.trim();
  const pageContext = record(context.pageContext);

  if (sessionScope !== "entity" && sessionScope !== "page") {
    return null;
  }

  const namespace = createSessionNamespace({
    entityId: readPageValue(pageContext, "entityId") ?? "",
    entityType: readPageValue(pageContext, "entityType") ?? "",
    hostApp: nonEmptyString(context.hostApp) ?? "",
    organizationId: nonEmptyString(context.organizationId) ?? "",
    packageMajor: "assistant-sdk-v1",
    pageIdentity: readPageValue(pageContext, "route") ?? readPageValue(pageContext, "screenId") ?? "",
    sessionScope,
  });

  if (!namespace.ok) {
    return null;
  }

  return {
    namespace: namespace.namespace,
    storage: createSessionStorageFallback({ storage: getSessionStorage() }),
  };
}

function readSessionId(session: AssistantRuntimeSession | null | undefined): string | null {
  return session ? nonEmptyString(session.sessionId) : null;
}

export function createSdkSessionBootstrap(options: SessionBootstrapOptions) {
  let bootstrapTask: Promise<BootstrapResult> | null = null;
  let bootstrapTaskIsForceNew = false;

  async function failBootstrap(code: string, safeMessage: string): Promise<BootstrapResult> {
    options.controller.setError({ code, safeMessage }, null);
    return { error: { code, safeMessage }, ok: false };
  }

  async function restoreOrCreate(forceNew = false): Promise<BootstrapResult> {
    const existingSessionId = readSessionId(options.controller.stores.session.session.value);
    if (!forceNew && options.controller.stores.session.status.value === "ready" && existingSessionId) {
      return { ok: true, sessionId: existingSessionId };
    }

    const snapshot = await options.resolveSnapshot();
    if (!snapshot.ok) {
      return await failBootstrap(
        snapshot.error.code,
        snapshot.error.userMessage ?? "目前頁面內容尚未就緒，請稍後再試。",
      );
    }

    const requestContext = snapshot.requestContext;
    const localContext = record(snapshot.localContext);
    const storedSession = resolveStoredSession(localContext, options.configuration);
    const hostSessionId = nonEmptyString(localContext.sessionId);

    if (forceNew) {
      storedSession?.storage.clear({ namespace: storedSession.namespace });
    } else {
      const candidates = [
        ...(hostSessionId ? [{ source: "host" as const, sessionId: hostSessionId }] : []),
        ...(storedSession
          ? (() => {
              const resolved = storedSession.storage.resolve({ namespace: storedSession.namespace });
              return resolved.ok && resolved.sessionId
                ? [{ source: "storage" as const, sessionId: resolved.sessionId }]
                : [];
            })()
          : []),
      ];

      const supportsRestore = supportsAssistantRuntimeRemoteRestoration(options.transport);

      for (const candidate of candidates) {
        if (!supportsRestore) {
          if (candidate.source === "host") {
            return await failBootstrap(
              "session_restore_unavailable",
              "目前無法還原指定的助理對話，請稍後再試。",
            );
          }

          storedSession?.storage.clear({ namespace: storedSession.namespace });
          continue;
        }

        options.controller.setRestoring();
        options.controller.setContextReady(true);
        const response = await options.transport.getSession({ sessionId: candidate.sessionId });

        if (!response.ok || !isUsableSession(response.value)) {
          if (candidate.source === "storage") {
            storedSession?.storage.clear({ namespace: storedSession.namespace });
            continue;
          }

          return await failBootstrap(
            "session_restore_failed",
            "目前無法還原指定的助理對話，請稍後再試。",
          );
        }

        options.controller.setSession(response.value);

        try {
          await options.controller.loadHistory({ sessionId: response.value.sessionId });
          options.controller.clearError();
        } catch {
          // Keep a valid restored session usable even when its history is temporarily unavailable.
          options.controller.setLastError({
            code: "history_unavailable",
            safeMessage: "對話紀錄暫時無法載入。",
          }, null);
          options.controller.setReady();
        }

        storedSession?.storage.set({
          namespace: storedSession.namespace,
          sessionId: response.value.sessionId,
        });
        await options.emitHostEvent("session-changed", { sessionId: response.value.sessionId });
        return { ok: true, sessionId: response.value.sessionId };
      }
    }

    try {
      const pageContext = record(requestContext.pageContext);
      await options.controller.createSession(
        Object.keys(pageContext).length > 0 ? { pageContext } : {},
      );
      const sessionId = readSessionId(options.controller.stores.session.session.value);

      if (!sessionId) {
        throw new Error("missing_session_id");
      }

      storedSession?.storage.set({ namespace: storedSession.namespace, sessionId });
      await options.emitHostEvent("session-created", { sessionId });
      return { ok: true, sessionId };
    } catch {
      return await failBootstrap(
        "session_bootstrap_failed",
        "助理暫時無法建立對話，請稍後再試。",
      );
    }
  }

  async function bootstrap(input: { readonly forceNew?: boolean } = {}): Promise<BootstrapResult> {
      if (bootstrapTask) {
        if (input.forceNew === true && !bootstrapTaskIsForceNew) {
          return await bootstrapTask.then(async () => await bootstrap({ forceNew: true }));
        }

        return bootstrapTask;
      }

      bootstrapTaskIsForceNew = input.forceNew === true;
      bootstrapTask = restoreOrCreate(bootstrapTaskIsForceNew);

      try {
        return await bootstrapTask;
      } finally {
        bootstrapTask = null;
        bootstrapTaskIsForceNew = false;
      }
  }

  return {
    bootstrap,
  };
}
