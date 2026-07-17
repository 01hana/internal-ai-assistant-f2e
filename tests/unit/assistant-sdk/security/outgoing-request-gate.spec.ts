import { describe, expect, it } from "vitest";
import {
  createLeakyOutgoingRequestSurface,
  createLeakyOutgoingRequestSurfaceFor,
  createSafeOutgoingRequestSurface,
  forbiddenOutgoingRequestFields,
  outgoingRequestSurfaces,
  type OutgoingRequestSurfaceMap,
} from "../../../fixtures/assistant-sdk/outgoing-request-boundary-fixtures";

type OutgoingRequestSafetyResult =
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

type OutgoingRequestBoundaryContractModule = {
  readonly assertOutgoingRequestSafe: (
    surfaces: OutgoingRequestSurfaceMap,
  ) => OutgoingRequestSafetyResult | Promise<OutgoingRequestSafetyResult>;
};

async function loadOutgoingRequestBoundaryContract() {
  const contract = await import("../../../../packages/assistant-sdk/src/request/outgoingRequestBoundary") as Partial<OutgoingRequestBoundaryContractModule>;

  expect(
    typeof contract.assertOutgoingRequestSafe,
    "outgoingRequestBoundary.ts must export assertOutgoingRequestSafe.",
  ).toBe("function");

  return contract as OutgoingRequestBoundaryContractModule;
}

function expectFailure(result: OutgoingRequestSafetyResult) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected outgoing request safety failure");
  }

  return result.error;
}

describe("Frontend 002 outgoing request safety gate", () => {
  it("accepts safe outgoing request surfaces", async () => {
    const { assertOutgoingRequestSafe } = await loadOutgoingRequestBoundaryContract();

    expect(await assertOutgoingRequestSafe(createSafeOutgoingRequestSurface())).toMatchObject({
      ok: true,
    });
  });

  it("rejects leaky fields across all outgoing request surfaces", async () => {
    const { assertOutgoingRequestSafe } = await loadOutgoingRequestBoundaryContract();

    const error = expectFailure(await assertOutgoingRequestSafe(createLeakyOutgoingRequestSurface()));

    expect(error.code).toBe("forbidden_outgoing_request_field");
    expect(error.field).toBeDefined();
    expect(error.surface).toBeDefined();
  });

  it("reports each outgoing surface that contains forbidden data", async () => {
    const { assertOutgoingRequestSafe } = await loadOutgoingRequestBoundaryContract();

    for (const surface of outgoingRequestSurfaces) {
      const error = expectFailure(await assertOutgoingRequestSafe(createLeakyOutgoingRequestSurfaceFor(surface)));

      expect(error.code).toBe("forbidden_outgoing_request_field");
      expect(error.surface).toBe(surface);
    }
  });

  it("blocks every local-only, secret-like, backend-owned authority, callback, and navigation field", async () => {
    const { assertOutgoingRequestSafe } = await loadOutgoingRequestBoundaryContract();

    for (const field of forbiddenOutgoingRequestFields) {
      const error = expectFailure(await assertOutgoingRequestSafe({
        ...createSafeOutgoingRequestSurface(),
        body: {
          [field]: "forbidden-value",
        },
      }));

      expect(error.code).toBe("forbidden_outgoing_request_field");
      expect(error.field ?? field).toBe(field);
      expect(error.surface ?? "body").toBe("body");
    }
  });
});
