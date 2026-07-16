import type {
  AssistantHostContextProvider,
  IntegrationMode,
} from "../../../packages/assistant-sdk/src/types/public";

export type HostContextOperation = "send" | "retry";

export interface HostContextContractInput {
  readonly provider: AssistantHostContextProvider;
  readonly operation: HostContextOperation;
  readonly integrationMode: IntegrationMode;
  readonly previousResolutionId?: string;
}

export interface HostContextResolverContract {
  readonly resolveForRequest: (input: {
    readonly operation: HostContextOperation;
  }) => Promise<HostContextResolutionContractResult>;
}

export type HostContextResolutionContractResult =
  | {
      readonly ok: true;
      readonly context: Readonly<Record<string, unknown>>;
      readonly resolutionId: string;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly field?: string;
        readonly userMessage?: string;
        readonly retryable?: boolean;
      };
    };

export function createDeferredProviderContext() {
  let resolve!: (context: Record<string, unknown>) => void;
  const promise = new Promise<Record<string, unknown>>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

export function createProviderSnapshots(
  snapshots: readonly Record<string, unknown>[],
): AssistantHostContextProvider {
  const queue = [...snapshots];

  return async () => queue.shift() ?? {};
}

export function createCompleteBackend002Context(): Record<string, unknown> {
  return {
    actorId: "actor-1",
    hostApp: "erp",
    organizationId: "org-1",
    pageContext: {
      entityId: "order-1",
      entityType: "order",
      route: "/orders/1",
    },
  };
}

export function createMissingBackend002Context(): Record<string, unknown> {
  return {
    hostApp: "erp",
    pageContext: {
      route: "/orders",
    },
  };
}

export function createLeakyProviderContext(): Record<string, unknown> {
  return {
    ...createCompleteBackend002Context(),
    callbacks: { onOpened: () => undefined },
    localUiState: { open: true },
    sessionScope: "page",
    widgetConfiguration: { theme: "dark" },
  };
}

export const providerSecretLikeFields = [
  "token",
  "credential",
  "secret",
  "apiKey",
  "connectionString",
] as const;

export const providerBackendAuthorityFields = [
  "sourceSystem",
  "connectorId",
  "permissionResult",
  "rawEvidence",
  "rawConnectorPayload",
] as const;
