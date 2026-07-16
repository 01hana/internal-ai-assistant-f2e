import type { AssistantHostContextProvider, IntegrationMode } from "../types/public";
import {
  resolveHostContextForRequest,
  type HostContextOperation,
  type HostContextResolutionResult,
} from "./contextResolution";

export interface HostContextResolver {
  readonly resolveForRequest: (input: {
    readonly operation: HostContextOperation;
  }) => Promise<HostContextResolutionResult>;
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
  };
}

