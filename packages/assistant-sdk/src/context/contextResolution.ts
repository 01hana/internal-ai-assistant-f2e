import type {
  AssistantHostContextProvider,
  IntegrationMode,
  SafeError,
} from "../types/public";

export type HostContextOperation = "send" | "retry";

export interface HostContextResolutionInput {
  readonly integrationMode: IntegrationMode;
  readonly operation: HostContextOperation;
  readonly previousResolutionId?: string;
  readonly provider: AssistantHostContextProvider;
}

export interface HostContextDiagnostic {
  readonly action: "omitted";
  readonly field: string;
}

export type HostContextResolutionResult =
  | {
      readonly context: Readonly<Record<string, unknown>>;
      readonly ok: true;
      readonly resolutionId: string;
    }
  | {
      readonly error: SafeError;
      readonly ok: false;
    };

export type HostContextSanitizationResult =
  | {
      readonly context: Readonly<Record<string, unknown>>;
      readonly diagnostics: readonly HostContextDiagnostic[];
      readonly ok: true;
    }
  | {
      readonly diagnostics?: readonly HostContextDiagnostic[];
      readonly error: SafeError & { readonly field?: string };
      readonly ok: false;
    };

const localOnlyHostContextFields = new Set([
  "callback",
  "callbackPayload",
  "callbacks",
  "featureFlags",
  "hostCallbacks",
  "hostEvents",
  "launcher",
  "localUiState",
  "locale",
  "onApprovalDetailRequested",
  "onClosed",
  "onError",
  "onOpened",
  "position",
  "sessionScope",
  "size",
  "theme",
  "transportMetadata",
  "widgetConfiguration",
  "zIndex",
]);

const forbiddenHostContextFields = new Set([
  "accessToken",
  "adapter",
  "adapterId",
  "apiKey",
  "approvalNavigation",
  "approvalNavigationMetadata",
  "approvalUrl",
  "candidateTool",
  "candidateTools",
  "connectionString",
  "connector",
  "connectorId",
  "credential",
  "dataSource",
  "fieldPermissionResult",
  "finalEvidenceSource",
  "navigationUrl",
  "permissionResult",
  "rawConnectorPayload",
  "rawEvidence",
  "refreshToken",
  "routingHint",
  "routingHints",
  "rowPermissionResult",
  "secret",
  "sourceSystem",
  "token",
  "toolName",
]);

let resolutionCounter = 0;

function nextResolutionId(): string {
  resolutionCounter += 1;
  return `context-resolution-${resolutionCounter}`;
}

function createSafeError(
  code: string,
  options: {
    readonly field?: string;
    readonly retryable?: boolean;
    readonly userMessage?: string;
  } = {},
): SafeError & { readonly field?: string } {
  return {
    code,
    field: options.field,
    message: code,
    retryable: options.retryable,
    userMessage: options.userMessage,
  };
}

function hasRequiredBackend002Context(context: Readonly<Record<string, unknown>>): boolean {
  return (
    typeof context.hostApp === "string"
    && typeof context.actorId === "string"
    && typeof context.organizationId === "string"
    && typeof context.pageContext === "object"
    && context.pageContext !== null
  );
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

function findForbiddenSerializationField(value: unknown): string | undefined {
  for (const field of [...forbiddenHostContextFields, ...localOnlyHostContextFields]) {
    if (containsField(value, field)) {
      return field;
    }
  }

  return undefined;
}

export function sanitizeHostContextForRequest(
  input: Readonly<Record<string, unknown>>,
): HostContextSanitizationResult {
  const sanitized: Record<string, unknown> = {};
  const diagnostics: HostContextDiagnostic[] = [];

  for (const [field, value] of Object.entries(input)) {
    if (forbiddenHostContextFields.has(field)) {
      return {
        diagnostics,
        error: createSafeError("forbidden_host_context_field", { field }),
        ok: false,
      };
    }

    if (localOnlyHostContextFields.has(field) || typeof value === "function") {
      diagnostics.push({ action: "omitted", field });
      continue;
    }

    sanitized[field] = value;
  }

  return {
    context: sanitized,
    diagnostics,
    ok: true,
  };
}

export function assertLocalOnlyFieldsAbsent(
  surfaces: Readonly<Record<string, unknown>>,
): HostContextSanitizationResult {
  for (const value of Object.values(surfaces)) {
    const field = findForbiddenSerializationField(value);

    if (field) {
      return {
        error: createSafeError("forbidden_serialization_field", { field }),
        ok: false,
      };
    }
  }

  return {
    context: {},
    diagnostics: [],
    ok: true,
  };
}

export async function resolveHostContextForRequest(
  input: HostContextResolutionInput,
): Promise<HostContextResolutionResult> {
  let providerContext: unknown;

  try {
    providerContext = await input.provider();
  }
  catch {
    return {
      error: createSafeError("context_unavailable", {
        retryable: true,
        userMessage: "context unavailable",
      }),
      ok: false,
    };
  }

  if (!providerContext || typeof providerContext !== "object" || Array.isArray(providerContext)) {
    return {
      error: createSafeError("context_unavailable", {
        retryable: true,
        userMessage: "context unavailable",
      }),
      ok: false,
    };
  }

  const sanitized = sanitizeHostContextForRequest(providerContext as Readonly<Record<string, unknown>>);

  if (!sanitized.ok) {
    return {
      error: sanitized.error,
      ok: false,
    };
  }

  if (input.integrationMode === "backend002" && !hasRequiredBackend002Context(sanitized.context)) {
    return {
      error: createSafeError("missing_required_context", {
        retryable: false,
        userMessage: "context unavailable",
      }),
      ok: false,
    };
  }

  return {
    context: sanitized.context,
    ok: true,
    resolutionId: nextResolutionId(),
  };
}
