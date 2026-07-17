import { toTransportFailure } from "./transportErrors";

type Frontend001Stream = (...args: readonly unknown[]) => unknown | Promise<unknown>;

export function createSseStreamBridge(options: {
  readonly frontend001SseStream: Frontend001Stream;
  readonly frontend001SseParser?: unknown;
}) {
  async function stream(...args: readonly unknown[]): Promise<unknown> {
    if (typeof options.frontend001SseStream !== "function") {
      return toTransportFailure("sse_stream_unavailable");
    }

    try {
      return await options.frontend001SseStream(...args);
    }
    catch {
      return toTransportFailure("transport_execution_failed");
    }
  }

  return { stream } as const;
}
