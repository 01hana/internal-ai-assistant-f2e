type SessionScopeGuardResult =
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

function containsSessionScope(value: unknown, visited = new WeakSet<object>()): boolean {
  if (typeof value === "string") {
    return /\bsessionScope\b/.test(value);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  if (visited.has(value)) {
    return false;
  }
  visited.add(value);

  if (Array.isArray(value)) {
    return value.some(item => containsSessionScope(item, visited));
  }

  return Object.entries(value).some(([field, nestedValue]) => {
    return field === "sessionScope" || containsSessionScope(nestedValue, visited);
  });
}

export function assertSessionScopeLocalOnly(
  surfaces: Readonly<Record<string, unknown>>,
): SessionScopeGuardResult {
  for (const [surface, value] of Object.entries(surfaces)) {
    if (containsSessionScope(value)) {
      return {
        error: {
          code: "forbidden_session_scope_surface",
          field: "sessionScope",
          surface,
        },
        ok: false,
      };
    }
  }

  return { ok: true };
}
