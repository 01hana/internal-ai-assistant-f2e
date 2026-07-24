import { type OpenApprovalDetailPayload } from "../approvals";
import type { AssistantFeedbackValue } from "../feedback";
import type { AssistantRuntimeController, AssistantRuntimeStreamingMessage } from "../runtime";
import type { HistoryMessageSummary } from "../types";
type RuntimeMessage = HistoryMessageSummary | AssistantRuntimeStreamingMessage | Record<string, unknown>;
interface FeedbackPayload {
    messageId: string;
    value: AssistantFeedbackValue;
}
type __VLS_Props = {
    controller: AssistantRuntimeController<RuntimeMessage>;
    runtimeScope: string;
    onSendMessage: (message: string) => void;
    onLoadMoreHistory: () => void;
    onCancelStreaming: () => void;
    onSubmitFeedback: (payload: FeedbackPayload) => void;
    onConfirmActionDraft: (actionDraftId: string) => void;
    onCancelActionDraft: (actionDraftId: string) => void;
    onOpenApprovalDetail: (payload: OpenApprovalDetailPayload) => void;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
