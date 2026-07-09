import { describe, expect, it, vi } from "vitest";
import { createHttpClient, HttpClientError } from "../../../app/services";
import { AssistantService } from "../../../app/services/api/assistant";
import {
  actionDraftCancelSuccessResponse,
  actionDraftConfirmExecutedResponse,
  actionDraftConfirmExpiredResponse,
  actionDraftConfirmFailedResponse,
  actionDraftConfirmSuccessResponse,
  actionDraftDetailResponse,
} from "../../fixtures/assistant-api/responses";
import type { AssistantIdentityHeaders } from "../../../app/types/assistant";

const identityHeaders = {
  "x-request-id": "request-action-draft-001",
  "x-actor-id": "actor-001",
  "x-organization-id": "org-001",
  "x-host-app": "erp-web",
  "x-role": "operator",
  "x-permission-scopes": "orders:write",
} satisfies AssistantIdentityHeaders;

describe("AssistantService action draft contract", () => {
  it("loads action draft detail from the encoded GET endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(actionDraftDetailResponse), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const service = new AssistantService({
      httpClient: createHttpClient({ fetcher }),
    });

    const result = await service.getActionDraft("action draft/001", {
      identityHeaders,
    });

    const [requestUrl, init] = fetcher.mock.calls[0]!;
    const headers = new Headers(init?.headers);

    expect(requestUrl).toBe(
      "/api/v1/assistant/action-drafts/action%20draft%2F001",
    );
    expect(init?.method).toBe("GET");
    expect(headers.get("x-request-id")).toBe("request-action-draft-001");
    expect(result.data.actionDraftId).toBe("action-draft-001");
    expect(result).toEqual(actionDraftDetailResponse);
  });

  it("submits confirm with idempotencyKey to the encoded POST endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(actionDraftConfirmSuccessResponse), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const service = new AssistantService({
      httpClient: createHttpClient({ fetcher }),
    });

    const result = await service.confirmActionDraft(
      "action draft/001",
      {
        idempotencyKey: "confirm-so-10001-001",
      },
      {
        identityHeaders,
      },
    );

    const [requestUrl, init] = fetcher.mock.calls[0]!;
    const headers = new Headers(init?.headers);

    expect(requestUrl).toBe(
      "/api/v1/assistant/action-drafts/action%20draft%2F001/confirm",
    );
    expect(init?.method).toBe("POST");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-request-id")).toBe("request-action-draft-001");
    expect(JSON.parse(String(init?.body))).toEqual({
      idempotencyKey: "confirm-so-10001-001",
    });
    expect(result).toEqual(actionDraftConfirmSuccessResponse);
  });

  it("submits cancel without a request body to the encoded POST endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(actionDraftCancelSuccessResponse), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const service = new AssistantService({
      httpClient: createHttpClient({ fetcher }),
    });

    const result = await service.cancelActionDraft(
      "action draft/001",
      {
        identityHeaders,
      },
    );

    const [requestUrl, init] = fetcher.mock.calls[0]!;

    expect(requestUrl).toBe(
      "/api/v1/assistant/action-drafts/action%20draft%2F001/cancel",
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
    expect(result).toEqual(actionDraftCancelSuccessResponse);
  });

  it("parses pending_execution_guard confirm responses safely", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(actionDraftConfirmSuccessResponse), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const service = new AssistantService({
      httpClient: createHttpClient({ fetcher }),
    });

    const result = await service.confirmActionDraft(
      "action-draft-001",
      { idempotencyKey: "confirm-so-10001-001" },
      { identityHeaders },
    );

    expect(result.data.status).toBe("confirmed");
    expect(result.data.recheck.permission).toBe("pending_execution_guard");
    expect(result.data.recheck.toolContract).toBe("pending_execution_guard");
  });

  it("parses expired and failed confirm responses safely", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify(actionDraftConfirmExpiredResponse), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      )
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify(actionDraftConfirmFailedResponse), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      );
    const service = new AssistantService({
      httpClient: createHttpClient({ fetcher }),
    });

    const expiredResult = await service.confirmActionDraft(
      "action-draft-001",
      { idempotencyKey: "confirm-expired-001" },
      { identityHeaders },
    );
    const failedResult = await service.confirmActionDraft(
      "action-draft-001",
      { idempotencyKey: "confirm-failed-001" },
      { identityHeaders },
    );

    expect(expiredResult.data.status).toBe("expired");
    expect(failedResult.data.status).toBe("failed");
  });

  it("parses executed confirm responses without changing request semantics", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(actionDraftConfirmExecutedResponse), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const service = new AssistantService({
      httpClient: createHttpClient({ fetcher }),
    });

    const result = await service.confirmActionDraft(
      "action-draft-001",
      { idempotencyKey: "confirm-executed-001" },
      { identityHeaders },
    );

    expect(result.data.status).toBe("executed");
    expect(result.data.actionDraftId).toBe("action-draft-001");
  });

  it("surfaces backend action draft errors as safe HttpClientError instances", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          requestId: "request-action-draft-error-001",
          error: {
            code: "action_draft_unavailable",
            message: "Action draft is temporarily unavailable.",
          },
        }),
        {
          status: 503,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const service = new AssistantService({
      httpClient: createHttpClient({ fetcher }),
    });

    await expect(
      service.getActionDraft("action-draft-001", { identityHeaders }),
    ).rejects.toBeInstanceOf(HttpClientError);

    await expect(
      service.confirmActionDraft(
        "action-draft-001",
        {
          idempotencyKey: "confirm-so-10001-001",
        },
        { identityHeaders },
      ),
    ).rejects.toMatchObject({
      requestId: "request-action-draft-error-001",
      code: "action_draft_unavailable",
      message: "Action draft is temporarily unavailable.",
    });
  });
});
