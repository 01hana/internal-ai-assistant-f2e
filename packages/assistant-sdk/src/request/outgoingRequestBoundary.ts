import { findForbiddenRequestField } from "./requestSafety";

export type OutgoingRequestSurface =
  | "body"
  | "callbackPayload"
  | "headers"
  | "hiddenPrompt"
  | "messageText"
  | "pageContext"
  | "transportMetadata";

export type OutgoingRequestSafetyResult =
  | {
      readonly ok: true;
    }
  | {
      readonly error: {
        readonly code: string;
        readonly field?: string;
        readonly surface?: string;
      };
      readonly ok: false;
    };

const outgoingRequestSurfaces = [
  "body",
  "callbackPayload",
  "headers",
  "hiddenPrompt",
  "messageText",
  "pageContext",
  "transportMetadata",
] as const;

export function assertOutgoingRequestSafe(
  surfaces: Readonly<Record<OutgoingRequestSurface, unknown>>,
): OutgoingRequestSafetyResult {
  for (const surface of outgoingRequestSurfaces) {
    const match = findForbiddenRequestField(surfaces[surface]);

    if (match) {
      return {
        error: {
          code: "forbidden_outgoing_request_field",
          field: match.field,
          surface,
        },
        ok: false,
      };
    }
  }

  return { ok: true };
}
