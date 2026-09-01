import type { WidgetConfiguration } from "./widgetConfiguration";

export type { IntegrationMode } from "./integrationMode";

/** Opaque Host credential provider for Gateway-v1 built-in requests. */
export type AssistantAccessTokenProvider =
  () => string | null | undefined | Promise<string | null | undefined>;

export type SanitizedPrimitive = string | number | boolean | null;

export type SanitizedRecord = Readonly<Record<string, SanitizedPrimitive>>;

export interface SanitizedPageContext {
  readonly hostApp?: string;
  readonly route?: string;
  readonly screenId?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly selectedRows?: readonly SanitizedRecord[];
}

export interface AssistantHostContext {
  readonly actor?: Readonly<Record<string, unknown>>;
  readonly actorId?: string;
  readonly correlation?: Readonly<Record<string, unknown>>;
  readonly hostApp?: string;
  readonly organizationId?: string;
  readonly pageContext?: SanitizedPageContext | Readonly<Record<string, unknown>>;
  readonly permissionContext?: Readonly<Record<string, unknown>>;
  readonly requestId?: string;
  readonly sessionId?: string;
  readonly [key: string]: unknown;
}

export type AssistantHostContextProvider =
  () => AssistantHostContext | Promise<AssistantHostContext>;

export type { WidgetConfiguration } from "./widgetConfiguration";

export interface ApprovalDetailRequestedEvent {
  readonly approvalRequestId: string;
  readonly sessionId: string;
  readonly messageId: string;
}

export interface SessionEvent {
  readonly sessionId: string;
}

export interface AnswerCompletedEvent {
  readonly sessionId: string;
  readonly messageId: string;
}

export interface SafeError {
  readonly code: string;
  readonly message: string;
  readonly userMessage?: string;
  readonly diagnostic?: string;
  readonly retryable?: boolean;
}

export interface ContextResolutionFailedEvent {
  readonly error: SafeError;
}

export interface HostCallbacks {
  readonly onOpened?: () => void;
  readonly onClosed?: () => void;
  readonly onSessionCreated?: (event: SessionEvent) => void;
  readonly onSessionChanged?: (event: SessionEvent) => void;
  readonly onAnswerCompleted?: (event: AnswerCompletedEvent) => void;
  readonly onError?: (error: SafeError) => void;
  readonly onApprovalDetailRequested?: (event: ApprovalDetailRequestedEvent) => void;
  readonly onEscalationRequested?: (event: SessionEvent) => void;
  readonly onContextResolutionFailed?: (event: ContextResolutionFailedEvent) => void;
}

export type HostEvents =
  | "opened"
  | "closed"
  | "session-created"
  | "session-changed"
  | "answer-completed"
  | "error"
  | "approval-detail-requested"
  | "escalation-requested"
  | "context-resolution-failed";

export interface MountOptions {
  readonly target: Element | string;
  readonly provider: AssistantHostContextProvider;
  readonly getAccessToken?: AssistantAccessTokenProvider;
  readonly configuration?: WidgetConfiguration;
  readonly callbacks?: HostCallbacks;
}

export interface MountHandle {
  readonly open: () => void;
  readonly close: () => void;
  readonly unmount: () => void;
  readonly destroy: () => void;
}
