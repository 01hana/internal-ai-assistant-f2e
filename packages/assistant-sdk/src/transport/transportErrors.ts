import type { TransportFailure } from "./types";

export type TransportErrorCode =
  | "authentication_unavailable"
  | "forbidden_outgoing_request_field"
  | "session_not_found"
  | "sse_stream_unavailable"
  | "transport_forbidden"
  | "transport_execution_failed"
  | "transport_unavailable";

export function createTransportError(
  code: TransportErrorCode,
  details: {
    readonly field?: string;
    readonly surface?: string;
  } = {},
): TransportFailure {
  return {
    error: {
      code,
      ...(details.field ? { field: details.field } : {}),
      ...(details.surface ? { surface: details.surface } : {}),
      userMessage: "integration error",
    },
    ok: false,
  };
}

export function toTransportFailure(
  code: TransportErrorCode = "transport_execution_failed",
): TransportFailure {
  return createTransportError(code);
}
