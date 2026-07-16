import type {
  ActionDraftId,
  AnswerDecisionStatus,
  AnswerDecisionUiState,
  ApprovalRequestId,
  AssistantMessageFinalData,
  AssistantRenderableMessage,
  EvidenceReferenceDisplay,
  EvidenceRefId,
  EvidenceRefSummary,
  FeedbackRequest,
  OpenApprovalDetailPayload,
  ResolvedAssistantMessageRenderer,
} from "../../../../app/types/assistant";

export type Frontend001AssistantTypeAdapter = {
  readonly actionDraftId: ActionDraftId;
  readonly answerDecisionStatus: AnswerDecisionStatus;
  readonly answerDecisionUiState: AnswerDecisionUiState;
  readonly approvalRequestId: ApprovalRequestId;
  readonly assistantMessageFinalData: AssistantMessageFinalData;
  readonly assistantRenderableMessage: AssistantRenderableMessage;
  readonly evidenceReferenceDisplay: EvidenceReferenceDisplay;
  readonly evidenceRefId: EvidenceRefId;
  readonly evidenceRefSummary: EvidenceRefSummary;
  readonly feedbackRequest: FeedbackRequest;
  readonly openApprovalDetailPayload: OpenApprovalDetailPayload;
  readonly resolvedAssistantMessageRenderer: ResolvedAssistantMessageRenderer;
};
