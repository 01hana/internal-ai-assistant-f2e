import { toTransportFailure } from "./transportErrors";
import type { PackageBuiltRequest } from "./types";

type Frontend001AssistantService = {
  readonly sendAssistantMessage?: (request: PackageBuiltRequest) => unknown | Promise<unknown>;
};

export function createDefaultTransport(options: {
  readonly frontend001Service?: Frontend001AssistantService;
} = {}) {
  async function send(request: PackageBuiltRequest): Promise<unknown> {
    const serviceDelegate = options.frontend001Service?.sendAssistantMessage;

    if (typeof serviceDelegate !== "function") {
      return toTransportFailure("transport_unavailable");
    }

    try {
      return await serviceDelegate(request);
    }
    catch {
      return toTransportFailure("transport_execution_failed");
    }
  }

  return { send } as const;
}
