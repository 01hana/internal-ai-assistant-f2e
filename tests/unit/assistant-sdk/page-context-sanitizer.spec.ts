import { describe, expect, it } from "vitest";
import {
  createCircularPageContext,
  createClassInstancePageContext,
  createForbiddenFieldPageContext,
  createFunctionPageContext,
  createRawBusinessPageContext,
  createSafePageContext,
  pageContextForbiddenFields,
} from "../../fixtures/assistant-sdk/page-context-fixtures";
import {
  createArraySelectedRows,
  createForbiddenSelectedRows,
  createFunctionSelectedRows,
  createMixedValidInvalidSelectedRows,
  createNestedSelectedRows,
  createSelectedRows,
  selectedRowsForbiddenFields,
} from "../../fixtures/assistant-sdk/selected-rows-fixtures";

type PageContextSanitizationResult =
  | {
      readonly ok: true;
      readonly pageContext: Readonly<Record<string, unknown>>;
    }
  | {
      readonly error: {
        readonly code: string;
        readonly field?: string;
      };
      readonly ok: false;
    };

type PageContextContractModule = {
  readonly sanitizePageContextForRequest: (
    input: unknown,
  ) => PageContextSanitizationResult | Promise<PageContextSanitizationResult>;
  readonly sanitizeSelectedRowsForRequest?: (
    input: unknown,
  ) => PageContextSanitizationResult | Promise<PageContextSanitizationResult>;
};

async function loadPageContextContract() {
  const contract = await import("../../../packages/assistant-sdk/src/request/pageContext") as Partial<PageContextContractModule>;

  expect(
    typeof contract.sanitizePageContextForRequest,
    "pageContext.ts must export sanitizePageContextForRequest.",
  ).toBe("function");

  return contract as PageContextContractModule;
}

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

function expectSuccess(result: PageContextSanitizationResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected PageContext sanitization success, got ${result.error.code}`);
  }

  return result.pageContext;
}

function expectFailure(result: PageContextSanitizationResult) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected PageContext sanitization failure");
  }

  return result.error;
}

describe("Frontend 002 PageContext request sanitizer", () => {
  it("accepts safe primitive PageContext metadata and selectedRows", async () => {
    const { sanitizePageContextForRequest } = await loadPageContextContract();

    const pageContext = expectSuccess(await sanitizePageContextForRequest(createSafePageContext()));

    expect(pageContext).toMatchObject({
      entityId: "order-001",
      entityType: "order",
      route: "/orders/001",
      screenId: "order-detail",
    });
    expect(Array.isArray(pageContext.selectedRows)).toBe(true);
  });

  it("rejects functions, class instances, circular values, and raw business objects", async () => {
    const { sanitizePageContextForRequest } = await loadPageContextContract();

    for (const input of [
      createFunctionPageContext(),
      createClassInstancePageContext(),
      createCircularPageContext(),
      createRawBusinessPageContext(),
    ]) {
      const error = expectFailure(await sanitizePageContextForRequest(input));
      expect(error.code).toMatch(/invalid_page_context|forbidden_page_context_field/);
    }
  });

  it("fails closed for local-only, callback, transport, secret-like, and backend-owned fields", async () => {
    const { sanitizePageContextForRequest } = await loadPageContextContract();

    for (const field of pageContextForbiddenFields) {
      const error = expectFailure(await sanitizePageContextForRequest(createForbiddenFieldPageContext(field)));

      expect(error.code).toMatch(/forbidden_page_context_field|invalid_page_context/);
      expect(error.field ?? field).toBe(field);
    }
  });

  it("accepts up to 20 selected rows with primitive-only records", async () => {
    const { sanitizePageContextForRequest } = await loadPageContextContract();

    const pageContext = expectSuccess(await sanitizePageContextForRequest({
      route: "/orders",
      selectedRows: createSelectedRows(20),
    }));

    expect(pageContext.selectedRows).toHaveLength(20);
  });

  it("rejects selectedRows over 20 without truncating", async () => {
    const { sanitizePageContextForRequest } = await loadPageContextContract();

    const error = expectFailure(await sanitizePageContextForRequest({
      route: "/orders",
      selectedRows: createSelectedRows(21),
    }));

    expect(error.code).toMatch(/selected_rows_limit_exceeded|invalid_page_context/);
  });

  it("rejects nested objects, arrays, functions, and mixed valid/invalid selectedRows as a whole", async () => {
    const { sanitizePageContextForRequest } = await loadPageContextContract();

    for (const selectedRows of [
      createNestedSelectedRows(),
      createArraySelectedRows(),
      createFunctionSelectedRows(),
      createMixedValidInvalidSelectedRows(),
    ]) {
      const error = expectFailure(await sanitizePageContextForRequest({
        route: "/orders",
        selectedRows,
      }));

      expect(error.code).toMatch(/invalid_selected_rows|invalid_page_context|forbidden_page_context_field/);
    }
  });

  it("rejects secret-like and backend authority fields in selectedRows", async () => {
    const { sanitizePageContextForRequest } = await loadPageContextContract();

    for (const field of selectedRowsForbiddenFields) {
      const error = expectFailure(await sanitizePageContextForRequest({
        route: "/orders",
        selectedRows: createForbiddenSelectedRows(field),
      }));

      expect(error.code).toMatch(/forbidden_page_context_field|invalid_selected_rows|invalid_page_context/);
      expect(error.field ?? field).toBe(field);
    }
  });

  it("does not treat selectedRows as session identity", async () => {
    const { sanitizePageContextForRequest } = await loadPageContextContract();

    const pageContext = expectSuccess(await sanitizePageContextForRequest({
      route: "/orders",
      selectedRows: createSelectedRows(1),
    }));

    expect(containsField(pageContext, "sessionId")).toBe(false);
    expect(containsField(pageContext, "sessionScope")).toBe(false);
  });
});
