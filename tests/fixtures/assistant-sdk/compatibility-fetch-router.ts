import type { HistoryMessageSummary } from "../../../packages/assistant-runtime/src/types";
import type {
  CanonicalSseOutcomeFixture,
} from "./canonical-sse-outcome-adapter";
import {
  createCanonicalSseResponse,
} from "./canonical-sse-outcome-adapter";

export type CompatibilityFetchRoute =
  | "create-session"
  | "load-history"
  | "message-stream"
  | "unmatched";

export type CompatibilityFetchRouterCall = {
  readonly bodyText: string;
  readonly method: string;
  readonly pathname: string;
  readonly route: CompatibilityFetchRoute;
  readonly url: string;
};

export type CompatibilityFetchRouterOptions = {
  readonly cursor?: string | null;
  readonly historyMessages?: readonly HistoryMessageSummary[];
  readonly sessionId?: string;
  readonly sseFixture: CanonicalSseOutcomeFixture;
};

function readRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

function readRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (typeof input === "object" && "method" in input && typeof input.method === "string") {
    return input.method.toUpperCase();
  }

  return "GET";
}

async function readRequestBody(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  if (typeof init?.body === "string") {
    return init.body;
  }

  if (init?.body instanceof URLSearchParams) {
    return init.body.toString();
  }

  if (typeof input === "object" && "clone" in input && typeof input.clone === "function") {
    try {
      return await input.clone().text();
    }
    catch {
      return "";
    }
  }

  return "";
}

function normalizeAssistantPath(pathname: string): string {
  return pathname.replace(/^\/api\/v1(?=\/assistant\/)/, "");
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function classifyRoute(method: string, pathname: string): CompatibilityFetchRoute {
  const assistantPath = normalizeAssistantPath(pathname);

  if (method === "POST" && /^\/assistant\/sessions\/?$/.test(assistantPath)) {
    return "create-session";
  }

  if (method === "GET" && /^\/assistant\/sessions\/[^/]+\/messages\/?$/.test(assistantPath)) {
    return "load-history";
  }

  if (method === "POST" && /^\/assistant\/sessions\/[^/]+\/messages\/?$/.test(assistantPath)) {
    return "message-stream";
  }

  return "unmatched";
}

export function createCompatibilityFetchRouter(options: CompatibilityFetchRouterOptions) {
  const sessionId = options.sessionId ?? "session-001";
  const calls: CompatibilityFetchRouterCall[] = [];

  async function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = readRequestUrl(input);
    const method = readRequestMethod(input, init);
    const parsedUrl = new URL(url, "https://assistant-sdk-compatibility.test");
    const pathname = normalizeAssistantPath(parsedUrl.pathname);
    const route = classifyRoute(method, pathname);
    const bodyText = await readRequestBody(input, init);

    calls.push({
      bodyText,
      method,
      pathname,
      route,
      url,
    });

    if (route === "create-session") {
      return jsonResponse({
        requestId: "request-create-session-001",
        data: {
          sessionId,
          status: "active",
        },
      }, { status: 201 });
    }

    if (route === "load-history") {
      return jsonResponse({
        requestId: "request-history-001",
        data: {
          messages: [...(options.historyMessages ?? [])],
          nextCursor: options.cursor ?? null,
          sessionId,
        },
      });
    }

    if (route === "message-stream") {
      return createCanonicalSseResponse(options.sseFixture);
    }

    return jsonResponse({
      error: {
        code: "unexpected_test_route",
        message: `Unexpected Compatibility Mode fixture route: ${method} ${pathname}`,
      },
    }, { status: 404 });
  }

  return {
    calls,
    fetch,
    getCallsByRoute(route: CompatibilityFetchRoute) {
      return calls.filter(call => call.route === route);
    },
  } as const;
}
