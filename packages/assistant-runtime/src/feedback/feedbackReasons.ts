/** Why an answer was not helpful: what the user picks after 👎, sent with the negative rating. */
export type AssistantFeedbackIntent = "correction" | "not_helpful" | "missing_evidence" | "other";
export type AssistantFeedbackDetails = { intent: AssistantFeedbackIntent; reason?: string; comment?: string };

/** The choices offered after 👎 (`reason` is the label the back office shows). */
export const FEEDBACK_REASON_OPTIONS: ReadonlyArray<{ intent: AssistantFeedbackIntent; label: string }> = [
  { intent: "correction", label: "答案不正確" },
  { intent: "not_helpful", label: "沒有回答到問題" },
  { intent: "missing_evidence", label: "資料不完整或過時" },
  { intent: "other", label: "其他" },
];

/** Core's limits for the free text. */
export const FEEDBACK_REASON_MAX = 160;
export const FEEDBACK_COMMENT_MAX = 1000;
