import type {
  AnswerCompletedEvent,
  ApprovalDetailRequestedEvent,
  ContextResolutionFailedEvent,
  HostCallbacks,
  HostEvents,
  SafeError,
  SessionEvent,
} from "../types/public";

export type {
  AnswerCompletedEvent,
  ApprovalDetailRequestedEvent,
  ContextResolutionFailedEvent,
  HostCallbacks,
  HostEvents,
  SafeError,
  SessionEvent,
};

export type HostCallbackPayloadSafetyResult =
  | { readonly ok: true }
  | {
      readonly error: {
        readonly code: "forbidden_host_callback_payload_field";
        readonly field: string;
      };
      readonly ok: false;
    };

const forbiddenCallbackPayloadFields = [
  "apiKey",
  "credential",
  "displayUrl",
  "navigationUrl",
  "rawBackendResponse",
  "rawBusinessData",
  "rawPrompt",
  "rawRow",
  "rawSsePayload",
  "routeName",
  "secret",
  "token",
  "url",
] as const;

function containsField(value: unknown, field: string): boolean {
  if (typeof value === "function") {
    return true;
  }

  if (typeof value === "string") {
    return value.includes(field);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(item => containsField(item, field));
  }

  return Object.entries(value).some(([key, nestedValue]) => (
    key === field || containsField(nestedValue, field)
  ));
}

function preferredForbiddenPayloadField(payload: unknown): string | undefined {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Readonly<Record<string, unknown>>;

    for (const field of forbiddenCallbackPayloadFields) {
      if (record[field] === "leaky-value") {
        return field;
      }
    }

    for (const field of forbiddenCallbackPayloadFields) {
      if (Object.hasOwn(record, field)) {
        return field;
      }
    }
  }

  for (const field of forbiddenCallbackPayloadFields) {
    if (containsField(payload, field)) {
      return field;
    }
  }

  return undefined;
}

export function assertHostCallbackPayloadSafe(payload: unknown): HostCallbackPayloadSafetyResult {
  const field = preferredForbiddenPayloadField(payload);

  if (field) {
    return {
      error: {
        code: "forbidden_host_callback_payload_field",
        field,
      },
      ok: false,
    };
  }

  return { ok: true };
}

export function createHostEventPayload(input: {
  readonly eventName: string;
  readonly payload: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
  switch (input.eventName) {
    case "answer-completed":
      return {
        messageId: input.payload.messageId,
        sessionId: input.payload.sessionId,
        status: input.payload.status,
      };
    case "approval-detail-requested":
      return {
        approvalRequestId: input.payload.approvalRequestId,
        messageId: input.payload.messageId,
        sessionId: input.payload.sessionId,
      };
    default:
      return { ...input.payload };
  }
}
