import {
  findForbiddenRequestField,
  isForbiddenRequestField,
  isPlainObject,
  isPrimitiveValue,
  type PrimitiveValue,
} from "./requestSafety";

export type PageContextSanitizationResult =
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

function fail(code: string, field?: string): PageContextSanitizationResult {
  return {
    error: {
      code,
      field,
    },
    ok: false,
  };
}

function isForbiddenSelectedRowField(field: string): boolean {
  return field === "sessionId" || isForbiddenRequestField(field);
}

function sanitizePrimitiveObject(
  input: Record<string, unknown>,
  visited: WeakSet<object>,
): PageContextSanitizationResult {
  const sanitized: Record<string, PrimitiveValue> = {};

  if (visited.has(input)) {
    return fail("invalid_page_context");
  }
  visited.add(input);

  for (const [field, value] of Object.entries(input)) {
    if (isForbiddenRequestField(field)) {
      return fail("forbidden_page_context_field", field);
    }

    if (!isPrimitiveValue(value)) {
      return fail("invalid_page_context", field);
    }

    sanitized[field] = value;
  }

  return {
    ok: true,
    pageContext: sanitized,
  };
}

export function sanitizeSelectedRowsForRequest(input: unknown): PageContextSanitizationResult {
  if (!Array.isArray(input)) {
    return fail("invalid_selected_rows", "selectedRows");
  }

  if (input.length > 20) {
    return fail("selected_rows_limit_exceeded", "selectedRows");
  }

  const sanitizedRows: Record<string, PrimitiveValue>[] = [];

  for (const row of input) {
    if (!isPlainObject(row)) {
      return fail("invalid_page_context", "selectedRows");
    }

    const sanitizedRow: Record<string, PrimitiveValue> = {};

    for (const [field, value] of Object.entries(row)) {
      if (isForbiddenSelectedRowField(field)) {
        return fail("forbidden_page_context_field", field);
      }

      if (!isPrimitiveValue(value)) {
        return fail("invalid_page_context", field);
      }

      sanitizedRow[field] = value;
    }

    sanitizedRows.push(sanitizedRow);
  }

  return {
    ok: true,
    pageContext: sanitizedRows as unknown as Readonly<Record<string, unknown>>,
  };
}

export function sanitizePageContextForRequest(input: unknown): PageContextSanitizationResult {
  if (!isPlainObject(input)) {
    return fail("invalid_page_context");
  }

  const sanitized: Record<string, unknown> = {};
  const visited = new WeakSet<object>();
  visited.add(input);

  for (const [field, value] of Object.entries(input)) {
    if (isForbiddenRequestField(field)) {
      return fail("forbidden_page_context_field", field);
    }

    if (field === "selectedRows") {
      const selectedRowsResult = sanitizeSelectedRowsForRequest(value);

      if (!selectedRowsResult.ok) {
        return selectedRowsResult;
      }

      sanitized.selectedRows = selectedRowsResult.pageContext;
      continue;
    }

    if (isPrimitiveValue(value)) {
      sanitized[field] = value;
      continue;
    }

    if (isPlainObject(value)) {
      const forbiddenMatch = findForbiddenRequestField(value);
      if (forbiddenMatch) {
        return fail("forbidden_page_context_field", forbiddenMatch.field);
      }

      const nestedResult = sanitizePrimitiveObject(value, visited);
      if (!nestedResult.ok) {
        return nestedResult;
      }

      sanitized[field] = nestedResult.pageContext;
      continue;
    }

    return fail("invalid_page_context", field);
  }

  return {
    ok: true,
    pageContext: sanitized,
  };
}
