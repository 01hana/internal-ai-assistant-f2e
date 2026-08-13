import type { AssistantHostContextProvider, IntegrationMode } from "../types/public";
import {
  resolveHostContextForRequest,
  resolveProvidedHostContextForRequest,
  type HostContextOperation,
  type HostContextBootstrapSnapshotResolutionResult,
  type HostContextResolutionResult,
} from "./contextResolution";

export interface HostContextResolver {
  readonly resolveForRequest: (input: {
    readonly operation: HostContextOperation;
  }) => Promise<HostContextResolutionResult>;
  readonly resolveBootstrapSnapshot: () => Promise<HostContextBootstrapSnapshotResolutionResult>;
}

export function createHostContextResolver(input: {
  readonly integrationMode: IntegrationMode;
  readonly provider: AssistantHostContextProvider;
}): HostContextResolver {
  let latestStartedSequence = 0;

  return {
    async resolveForRequest(resolveInput) {
      const sequence = ++latestStartedSequence;
      const result = await resolveHostContextForRequest({
        integrationMode: input.integrationMode,
        operation: resolveInput.operation,
        provider: input.provider,
      });

      if (sequence < latestStartedSequence) {
        return {
          error: {
            code: "stale_context",
            message: "stale_context",
            retryable: true,
            userMessage: "integration error",
          },
          ok: false,
        };
      }

      return result;
    },
    async resolveBootstrapSnapshot() {
      const sequence = ++latestStartedSequence;
      let localContext: unknown;

      try {
        localContext = await input.provider();
      }
      catch {
        return {
          error: {
            code: "context_unavailable",
            message: "context_unavailable",
            retryable: true,
            userMessage: "context unavailable",
          },
          ok: false,
        };
      }

      const requestResolution = resolveProvidedHostContextForRequest({
        context: localContext,
        integrationMode: input.integrationMode,
      });

      if (sequence < latestStartedSequence) {
        return {
          error: {
            code: "stale_context",
            message: "stale_context",
            retryable: true,
            userMessage: "integration error",
          },
          ok: false,
        };
      }

      if (!requestResolution.ok) {
        return requestResolution;
      }

      return {
        localContext: localContext as Readonly<Record<string, unknown>>,
        ok: true,
        requestContext: requestResolution.context,
        resolutionId: requestResolution.resolutionId,
      };
    },
  };
}
