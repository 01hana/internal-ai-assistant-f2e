import type {
  AssistantRuntimeActionConfirmationInput,
  AssistantRuntimeApprovalInput,
  AssistantRuntimeCancelMessageInput,
  AssistantRuntimeCreateSessionInput,
  AssistantRuntimeFeedbackInput,
  AssistantRuntimeLoadHistoryInput,
  AssistantRuntimeRequestOptions,
  AssistantRuntimeSendMessageInput,
  AssistantRuntimeStreamMessageInput,
  AssistantRuntimeTransportResult,
} from "../../../assistant-runtime/src/transport/ports";

export type PackageBuiltRequest = {
  readonly request: Readonly<Record<string, unknown>>;
  readonly requestId: string;
  readonly sessionId: string;
};

export type SanitizedExecutionInput = PackageBuiltRequest;

export type TransportSuccess<T = unknown> = {
  readonly ok: true;
  readonly value?: T;
};

export type TransportFailure = {
  readonly error: {
    readonly code: string;
    readonly field?: string;
    readonly surface?: string;
    readonly userMessage: "integration error";
  };
  readonly ok: false;
};

export type TransportResult<T = unknown> = TransportSuccess<T> | TransportFailure;

export type SdkTransportOperationInputMap = {
  readonly createSession: AssistantRuntimeCreateSessionInput;
  readonly loadHistory: AssistantRuntimeLoadHistoryInput;
  readonly sendMessage: AssistantRuntimeSendMessageInput;
  readonly streamMessage: AssistantRuntimeStreamMessageInput;
  readonly cancelMessage: AssistantRuntimeCancelMessageInput;
  readonly abortMessage: AssistantRuntimeCancelMessageInput;
  readonly submitFeedback: AssistantRuntimeFeedbackInput;
  readonly confirmAction: AssistantRuntimeActionConfirmationInput;
  readonly rejectAction: AssistantRuntimeActionConfirmationInput;
  readonly loadApprovalRequest: AssistantRuntimeApprovalInput;
};

export type SdkTransportOperationName = keyof SdkTransportOperationInputMap;

export type SdkTransportExecutionInput = PackageBuiltRequest & {
  readonly operation: SdkTransportOperationName | "send";
};

export type SdkTransportExecutor<T = unknown> = (
  input: SdkTransportExecutionInput,
  options?: AssistantRuntimeRequestOptions,
) => AssistantRuntimeTransportResult<T> | Promise<AssistantRuntimeTransportResult<T>>;

export type SdkTransportCapabilityMap = Partial<{
  readonly [Operation in SdkTransportOperationName]: SdkTransportExecutor;
}>;
