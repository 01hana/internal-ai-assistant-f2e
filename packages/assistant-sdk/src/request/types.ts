import type { IntegrationMode } from "../types/integrationMode";
import type { RequestBuildError } from "../types/safeErrors";

export interface AssistantRequestBuildInput {
  readonly hostContext?: unknown;
  readonly integrationMode?: IntegrationMode;
  readonly message?: unknown;
  readonly operation?: unknown;
  readonly sessionId?: unknown;
  readonly widgetConfiguration?: unknown;
}

export type AssistantRequestBuildResult =
  | {
      readonly ok: true;
      readonly request: Readonly<Record<string, unknown>>;
    }
  | {
      readonly error: RequestBuildError;
      readonly ok: false;
    };

export type AssistantRequestBuildSuccess = Extract<AssistantRequestBuildResult, { readonly ok: true }>;
export type AssistantRequestBuildFailure = Extract<AssistantRequestBuildResult, { readonly ok: false }>;
