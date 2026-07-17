type HostEventName =
  | "opened"
  | "closed"
  | "session-created"
  | "session-changed"
  | "answer-completed"
  | "error"
  | "approval-detail-requested"
  | "escalation-requested"
  | "context-resolution-failed";

type CallbackName =
  | "onOpened"
  | "onClosed"
  | "onSessionCreated"
  | "onSessionChanged"
  | "onAnswerCompleted"
  | "onErrorOccurred"
  | "onApprovalDetailRequested"
  | "onEscalationRequested"
  | "onContextResolutionFailed";

type HostCallbacks = Readonly<Record<string, unknown>>;

export type HostEventEmitterContract = {
  readonly destroy: () => void;
  readonly emit: (eventName: string, payload?: Readonly<Record<string, unknown>>) => Promise<{ readonly ok: boolean }>;
};

const callbackByEvent: Readonly<Record<HostEventName, CallbackName>> = {
  opened: "onOpened",
  closed: "onClosed",
  "session-created": "onSessionCreated",
  "session-changed": "onSessionChanged",
  "answer-completed": "onAnswerCompleted",
  error: "onErrorOccurred",
  "approval-detail-requested": "onApprovalDetailRequested",
  "escalation-requested": "onEscalationRequested",
  "context-resolution-failed": "onContextResolutionFailed",
};

const allowedFieldsByEvent: Readonly<Record<HostEventName, readonly string[]>> = {
  opened: ["sessionId"],
  closed: ["sessionId"],
  "session-created": ["sessionId"],
  "session-changed": ["sessionId"],
  "answer-completed": ["messageId", "sessionId", "status"],
  error: ["error", "messageId", "requestId", "sessionId"],
  "approval-detail-requested": ["approvalRequestId", "messageId", "sessionId"],
  "escalation-requested": ["escalationRequestId", "messageId", "sessionId"],
  "context-resolution-failed": ["error", "requestId", "sessionId"],
};

const safeErrorFields = ["code", "field", "retryable", "surface"] as const;

function isHostEventName(eventName: string): eventName is HostEventName {
  return eventName in callbackByEvent;
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickSafeError(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const error: Record<string, unknown> = {};

  for (const field of safeErrorFields) {
    const fieldValue = value[field];

    if (typeof fieldValue === "string" || typeof fieldValue === "boolean") {
      error[field] = fieldValue;
    }
  }

  return Object.keys(error).length > 0 ? error : undefined;
}

function pickAllowedPayload(
  eventName: HostEventName,
  payload: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const safePayload: Record<string, unknown> = {};

  for (const field of allowedFieldsByEvent[eventName]) {
    const value = field === "error" ? pickSafeError(payload[field]) : payload[field];

    if (value !== undefined) {
      safePayload[field] = value;
    }
  }

  return safePayload;
}

async function invokeCallbackSafely(
  callback: unknown,
  payload: Readonly<Record<string, unknown>>,
): Promise<{ readonly ok: boolean }> {
  if (typeof callback !== "function") {
    return { ok: true };
  }

  try {
    await callback(payload);
    return { ok: true };
  }
  catch {
    return { ok: false };
  }
}

export function createHostEventEmitter(input: {
  readonly callbacks?: HostCallbacks;
}): HostEventEmitterContract {
  let destroyed = false;

  return {
    destroy: () => {
      destroyed = true;
    },

    emit: async (eventName, payload = {}) => {
      if (destroyed || !isHostEventName(eventName)) {
        return { ok: false };
      }

      const safePayload = pickAllowedPayload(eventName, payload);
      const callback = input.callbacks?.[callbackByEvent[eventName]];

      return await invokeCallbackSafely(callback, safePayload);
    },
  };
}
