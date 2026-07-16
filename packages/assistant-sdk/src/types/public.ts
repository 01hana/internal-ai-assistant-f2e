export type IntegrationMode = "backend001-compatibility" | "backend002";

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

export type AssistantHostContextProvider =
  () => SanitizedPageContext | Promise<SanitizedPageContext>;

export interface WidgetConfiguration {
  readonly integrationMode?: IntegrationMode;
  readonly locale?: "zh-TW" | "en";
  readonly theme?: "light" | "dark" | "system";
  readonly position?: "bottom-right" | "bottom-left";
  readonly zIndex?: number;
  readonly sessionScope?: string;
}

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
  readonly configuration?: WidgetConfiguration;
  readonly callbacks?: HostCallbacks;
}

export interface MountHandle {
  readonly open: () => void;
  readonly close: () => void;
  readonly unmount: () => void;
  readonly destroy: () => void;
}
