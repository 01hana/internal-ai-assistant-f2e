import {
  forbiddenOutgoingFields,
  localOnlyFields,
  secretLikeFields,
} from "./forbidden-fields";

export const outgoingRequestSurfaces = [
  "body",
  "callbackPayload",
  "headers",
  "hiddenPrompt",
  "messageText",
  "pageContext",
  "transportMetadata",
] as const;

export type OutgoingRequestSurface = typeof outgoingRequestSurfaces[number];

export type OutgoingRequestSurfaceMap = Record<OutgoingRequestSurface, unknown>;

export const forbiddenOutgoingRequestFields = [
  ...localOnlyFields,
  ...secretLikeFields,
  ...forbiddenOutgoingFields,
  "apiKey",
  "connectionString",
  "onApprovalDetailRequested",
  "onClosed",
  "onError",
  "onOpened",
] as const;

export function createSafeOutgoingRequestSurface(): OutgoingRequestSurfaceMap {
  return {
    body: {
      message: "Summarize this order",
      pageContext: {
        entityId: "order-001",
        route: "/orders/001",
      },
    },
    callbackPayload: {
      messageId: "message-001",
      sessionId: "session-001",
    },
    headers: {
      "x-request-id": "request-001",
    },
    hiddenPrompt: undefined,
    messageText: "Summarize this order",
    pageContext: {
      route: "/orders/001",
    },
    transportMetadata: {
      requestId: "request-001",
    },
  };
}

export function createLeakyOutgoingRequestSurface(): OutgoingRequestSurfaceMap {
  return {
    body: {
      sessionScope: "page",
    },
    callbackPayload: {
      rawEvidence: [{ id: "evidence-001" }],
    },
    headers: {
      apiKey: "api-key",
    },
    hiddenPrompt: "Use token=secret-token",
    messageText: "Use connectorId=connector-001",
    pageContext: {
      sourceSystem: "frontend-selected-source",
    },
    transportMetadata: {
      callbacks: { onOpened: () => undefined },
    },
  };
}

export function createLeakyOutgoingRequestSurfaceFor(surface: OutgoingRequestSurface) {
  return {
    ...createSafeOutgoingRequestSurface(),
    [surface]: createLeakyOutgoingRequestSurface()[surface],
  };
}
