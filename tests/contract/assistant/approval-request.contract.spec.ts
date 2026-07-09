import { describe, expect, it, vi } from "vitest";
import { createHttpClient, HttpClientError } from "../../../app/services";
import { AssistantService } from "../../../app/services/api/assistant";
import {
  approvalRequestDetailResponse,
  backendErrorWithoutStatusCodeResponse,
} from "../../fixtures/assistant-api/responses";
import type { AssistantIdentityHeaders } from "../../../app/types/assistant";

const identityHeaders = {
  "x-request-id": "request-approval-001",
  "x-actor-id": "actor-001",
  "x-organization-id": "org-001",
  "x-host-app": "erp-web",
  "x-role": "supervisor",
  "x-permission-scopes": "orders:approve",
} satisfies AssistantIdentityHeaders;

describe("AssistantService approval request contract", () => {
  it("loads approval request detail from the encoded GET endpoint without a body", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(approvalRequestDetailResponse), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const service = new AssistantService({
      httpClient: createHttpClient({ fetcher }),
    });

    const result = await service.getApprovalRequest("approval request/001", {
      identityHeaders,
    });

    const [requestUrl, init] = fetcher.mock.calls[0]!;
    const headers = new Headers(init?.headers);

    expect(requestUrl).toBe(
      "/api/v1/assistant/approval-requests/approval%20request%2F001",
    );
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(headers.get("x-request-id")).toBe("request-approval-001");
    expect(result.data.approvalRequestId).toBe("approval-request-001");
    expect(result.data.status).toBe("pending");
    expect(result.data.riskLevel).toBe("high");
    expect(result).toEqual(approvalRequestDetailResponse);
  });

  it("does not expose inline approval management service methods in Batch A", () => {
    const service = new AssistantService({
      httpClient: createHttpClient({
        fetcher: vi.fn<typeof fetch>(),
      }),
    }) as AssistantService & Record<string, unknown>;

    expect(service.approveApprovalRequest).toBeUndefined();
    expect(service.rejectApprovalRequest).toBeUndefined();
    expect(service.cancelApprovalRequest).toBeUndefined();
  });

  it("surfaces backend approval detail errors as safe HttpClientError instances", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(backendErrorWithoutStatusCodeResponse), {
        status: 503,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const service = new AssistantService({
      httpClient: createHttpClient({ fetcher }),
    });

    await expect(
      service.getApprovalRequest("approval-request-001", { identityHeaders }),
    ).rejects.toBeInstanceOf(HttpClientError);

    await expect(
      service.getApprovalRequest("approval-request-001", { identityHeaders }),
    ).rejects.toMatchObject({
      requestId: "req-backend-safe-error-001",
      code: "assistant_unavailable",
      message: "Assistant service is temporarily unavailable.",
    });
  });
});
