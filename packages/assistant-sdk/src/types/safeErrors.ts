export type RequestBuildErrorCode =
  | "forbidden_outgoing_request_field"
  | "forbidden_page_context_field"
  | "forbidden_request_field"
  | "integration_error"
  | "invalid_integration_mode"
  | "invalid_message"
  | "invalid_page_context"
  | "invalid_selected_rows"
  | "missing_required_context"
  | "selected_rows_limit_exceeded";

export interface RequestBuildError {
  readonly code: RequestBuildErrorCode | string;
  readonly field?: string;
  readonly surface?: string;
  readonly userMessage?: "context unavailable" | "integration error";
}

export function createRequestBuildError(
  code: RequestBuildError["code"],
  options: {
    readonly field?: string;
    readonly surface?: string;
    readonly userMessage?: RequestBuildError["userMessage"];
  } = {},
): RequestBuildError {
  return {
    code,
    field: options.field,
    surface: options.surface,
    userMessage: options.userMessage,
  };
}
