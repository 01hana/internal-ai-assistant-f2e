import type {
  AssistantMessageId,
  AssistantRequestId,
} from "../types";

export type AssistantFeedbackValue = "helpful" | "not_helpful";

export interface AssistantMessageFeedbackUiState {
  value: AssistantFeedbackValue | null;
  pending: boolean;
  error: string | null;
  requestId: AssistantRequestId | null;
}

export type FeedbackRating = "positive" | "negative" | "neutral";

export type FeedbackIntent =
  | "correction"
  | "unsafe"
  | "not_helpful"
  | "missing_evidence"
  | "other";

export interface FeedbackRequest {
  rating: FeedbackRating;
  intent: FeedbackIntent;
  reason?: string;
  comment?: string;
}

export type FeedbackSubmissionStatus =
  | "idle"
  | "submitting"
  | "succeeded"
  | "failed";

export interface FeedbackSubmissionState {
  messageId: AssistantMessageId;
  requestId: AssistantRequestId;
  status: FeedbackSubmissionStatus;
  retryable: boolean;
  feedback?: FeedbackRequest;
  safeMessage?: string;
}

export function mapFeedbackValueToRequest(
  value: AssistantFeedbackValue,
): FeedbackRequest {
  return value === "helpful"
    ? {
        rating: "positive",
        intent: "other",
      }
    : {
        rating: "negative",
        intent: "not_helpful",
      };
}

export function createDefaultFeedbackState(): AssistantMessageFeedbackUiState {
  return {
    value: null,
    pending: false,
    error: null,
    requestId: null,
  };
}

export function startFeedbackSubmissionState(
  value: AssistantFeedbackValue,
  requestId: AssistantRequestId | null,
): AssistantMessageFeedbackUiState {
  return {
    value,
    pending: true,
    error: null,
    requestId,
  };
}

export function completeFeedbackSubmissionState(
  currentState: AssistantMessageFeedbackUiState,
): AssistantMessageFeedbackUiState {
  return {
    ...currentState,
    pending: false,
    error: null,
  };
}

export function failFeedbackSubmissionState(input: {
  previousValue: AssistantFeedbackValue | null;
  requestId: AssistantRequestId | null;
  safeMessage: string;
}): AssistantMessageFeedbackUiState {
  return {
    value: input.previousValue,
    pending: false,
    error: input.safeMessage,
    requestId: input.requestId,
  };
}
