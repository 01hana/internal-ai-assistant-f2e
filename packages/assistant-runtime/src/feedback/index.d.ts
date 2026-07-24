import type { AssistantMessageId, AssistantRequestId } from "../types";
export type AssistantFeedbackValue = "helpful" | "not_helpful";
export interface AssistantMessageFeedbackUiState {
    value: AssistantFeedbackValue | null;
    pending: boolean;
    error: string | null;
    requestId: AssistantRequestId | null;
}
export type FeedbackRating = "positive" | "negative" | "neutral";
export type FeedbackIntent = "correction" | "unsafe" | "not_helpful" | "missing_evidence" | "other";
export interface FeedbackRequest {
    rating: FeedbackRating;
    intent: FeedbackIntent;
    reason?: string;
    comment?: string;
}
export type FeedbackSubmissionStatus = "idle" | "submitting" | "succeeded" | "failed";
export interface FeedbackSubmissionState {
    messageId: AssistantMessageId;
    requestId: AssistantRequestId;
    status: FeedbackSubmissionStatus;
    retryable: boolean;
    feedback?: FeedbackRequest;
    safeMessage?: string;
}
export declare function mapFeedbackValueToRequest(value: AssistantFeedbackValue): FeedbackRequest;
export declare function createDefaultFeedbackState(): AssistantMessageFeedbackUiState;
export declare function startFeedbackSubmissionState(value: AssistantFeedbackValue, requestId: AssistantRequestId | null): AssistantMessageFeedbackUiState;
export declare function completeFeedbackSubmissionState(currentState: AssistantMessageFeedbackUiState): AssistantMessageFeedbackUiState;
export declare function failFeedbackSubmissionState(input: {
    previousValue: AssistantFeedbackValue | null;
    requestId: AssistantRequestId | null;
    safeMessage: string;
}): AssistantMessageFeedbackUiState;
