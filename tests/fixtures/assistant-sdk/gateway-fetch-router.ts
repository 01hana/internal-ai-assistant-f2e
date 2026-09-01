import type { HistoryMessageSummary } from "../../../packages/assistant-runtime/src/types";

export type GatewayFetchRoute = "create-session" | "get-session" | "load-history" | "message-stream";

export type GatewayFetchCall = {
  readonly bodyText: string;
  readonly headers: Headers;
  readonly method: string;
  readonly pathname: string;
  readonly route: GatewayFetchRoute;
};

export type GatewayFetchRouterOptions = {
  readonly createResponse?: GatewayJsonResponseOverride;
  readonly expectedTokens: readonly string[];
  readonly historyMessages?: readonly HistoryMessageSummary[];
  readonly historyResponse?: GatewayJsonResponseOverride;
  readonly sessionResponse?: GatewayJsonResponseOverride;
  readonly sessionId: string;
};

export type GatewayJsonResponseOverride = {
  readonly body?: unknown;
  readonly status: number;
};

const forbiddenWireFields = [
  "actorId",
  "organizationId",
  "hostApp",
  "customerId",
  "integrationId",
  "roles",
  "permissionScopes",
] as const;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data, requestId: "gateway-request-001" }), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function jsonResponseWithOverride(
  data: unknown,
  defaultStatus: number,
  override: GatewayJsonResponseOverride | undefined,
): Response {
  if (!override) {
    return jsonResponse(data, defaultStatus);
  }

  return new Response(JSON.stringify(override.body ?? { data }), {
    headers: { "content-type": "application/json" },
    status: override.status,
  });
}

function createSseResponse(sessionId: string): Response {
  const events = [
    {
      data: { delta: "新的 AI 回答" },
      eventType: "answer_delta",
      messageId: "message-new-assistant-001",
      requestId: "request-new-001",
      sequence: 1,
      sessionId,
    },
    {
      data: { answer: "新的 AI 回答", answerDecision: "answered", evidenceRefs: [] },
      eventType: "final",
      messageId: "message-new-assistant-001",
      requestId: "request-new-001",
      sequence: 2,
      sessionId,
    },
  ];
  const body = new TextEncoder().encode(events.map(event => `event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`).join(""));

  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  }), {
    headers: { "content-type": "text/event-stream" },
    status: 200,
  });
}

function routeFor(method: string, pathname: string): GatewayFetchRoute | null {
  if (method === "POST" && pathname === "/api/v1/assistant/sessions") return "create-session";
  if (method === "GET" && /^\/api\/v1\/assistant\/sessions\/[^/]+$/.test(pathname)) return "get-session";
  if (method === "GET" && /^\/api\/v1\/assistant\/sessions\/[^/]+\/messages$/.test(pathname)) return "load-history";
  if (method === "POST" && /^\/api\/v1\/assistant\/sessions\/[^/]+\/messages$/.test(pathname)) return "message-stream";
  return null;
}

export function createGatewayFetchRouter(options: GatewayFetchRouterOptions) {
  const calls: GatewayFetchCall[] = [];

  async function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(typeof input === "string" ? input : input.toString(), "https://gateway-widget.test");
    const method = init?.method?.toUpperCase() ?? "GET";
    const route = routeFor(method, url.pathname);
    const headers = new Headers(init?.headers);
    const bodyText = typeof init?.body === "string" ? init.body : "";

    if (!route) {
      return jsonResponse({ code: "unexpected_route" }, 404);
    }

    const expectedToken = options.expectedTokens[calls.length];
    if (headers.get("authorization") !== `Bearer ${expectedToken}`) {
      return jsonResponse({ code: "authentication_required" }, 401);
    }

    if (!headers.get("x-request-id")) {
      return jsonResponse({ code: "missing_request_id" }, 400);
    }

    const expectsSse = route === "message-stream";
    if (headers.get("accept") !== (expectsSse ? "text/event-stream" : "application/json")) {
      return jsonResponse({ code: "invalid_accept" }, 400);
    }
    if ((route === "create-session" || expectsSse) && headers.get("content-type") !== "application/json") {
      return jsonResponse({ code: "invalid_content_type" }, 400);
    }
    if (forbiddenWireFields.some(field => headers.has(`x-${field.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`))) {
      return jsonResponse({ code: "forbidden_identity_header" }, 400);
    }

    if (bodyText && forbiddenWireFields.some(field => bodyText.includes(field))) {
      return jsonResponse({ code: "forbidden_identity_wire_field" }, 400);
    }

    calls.push({ bodyText, headers, method, pathname: url.pathname, route });

    if (route === "create-session" || route === "get-session") {
      return jsonResponseWithOverride(
        { sessionId: options.sessionId, status: "active" },
        route === "create-session" ? 201 : 200,
        route === "create-session" ? options.createResponse : options.sessionResponse,
      );
    }

    if (route === "load-history") {
      return jsonResponseWithOverride({
        messages: [...(options.historyMessages ?? [])],
        nextCursor: null,
        sessionId: options.sessionId,
      }, 200, options.historyResponse);
    }

    return createSseResponse(options.sessionId);
  }

  return { calls, fetch } as const;
}
