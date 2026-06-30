# Types Notes

這份文件是給 frontend 整合者的型別速記，不是 backend internal model dump。重點是哪些欄位可以依賴、哪些欄位要當 optional，以及哪些 enum 值目前已經是 public behavior。

## Envelope

```ts
type ApiEnvelope<T> = {
  requestId: string;
  data: T;
};

type ApiErrorEnvelope = {
  requestId: string;
  error: {
    code: string;
    message: string;
    statusCode?: number;
  };
};
```

前端應把 `requestId` 保存下來，串 log、support trace、SSE final correlation 都很有用。

## Identity headers

```ts
type AssistantIdentityHeaders = {
  'x-request-id'?: string;
  'x-actor-id': string;
  'x-organization-id': string;
  'x-host-app': string;
  'x-role': string;
  'x-permission-scopes'?: string;
};
```

`x-permission-scopes` 建議用 comma-separated string 傳遞。

## PageContext

```ts
type PageContext = {
  module?: string;
  route?: string;
  screenId?: string;
  entityType?: string;
  entityId?: string;
  selectedRows?: Array<Record<string, unknown>>;
  activeFilters?: unknown[];
  visibleColumns?: string[];
  userVisibleState?: Record<string, unknown>;
};
```

注意：

- 這是目前 session create / message send request 的 public context type
- frontend host adapters 可以蒐集 richer host-state filters，但只應把 sanitized summary 放進 `pageContext.activeFilters`
- 不要把 raw row payload、hidden columns、secret fields 或完整 table state 直接丟進 context
- `screenContext.filtersSummary` 若存在於前端內部 abstraction，並不是目前 session/message request 的 public wire contract

## History response

```ts
type ToolSummary = {
  status: string;
  toolCallIds: string[];
};

type HistoryMessageSummary = {
  messageId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: string;
  answerDecision?: AnswerDecisionStatus;
  evidenceRefs?: string[];
  toolSummary?: ToolSummary;
};

type SessionMessagesResponse = {
  sessionId: string;
  messages: HistoryMessageSummary[];
  nextCursor: string | null;
};
```

補充：

- history item 目前用 `messageId`，不是 `id`
- `nextCursor` 是目前 wire field；前端可用 `nextCursor !== null` 推導是否可繼續載入
- `hasMore` 不是目前 wire field，若前端需要可自行從 `nextCursor` 推導
- history 只保證回傳 masked summary，不保證 raw tool output、raw evidence payload、full document text 或未授權欄位

## Assistant final payload

```ts
type AnswerDecisionStatus =
  | 'answered'
  | 'clarification_required'
  | 'no_answer'
  | 'confirmation_required'
  | 'approval_required'
  | 'escalation_required'
  | 'permission_denied';

type NoAnswerReason =
  | 'no_evidence'
  | 'tool_failure'
  | 'permission_denied'
  | 'evidence_conflict'
  | 'ambiguous_query'
  | 'low_confidence'
  | 'missing_page_context'
  | 'unsupported_scope';

type EvidenceRefSummary = {
  id: string;
  sourceType: 'structured_record' | 'document_chunk';
  sourceId?: string | null;
  toolCallId?: string | null;
  title?: string | null;
  snippet?: string | null;
};

type AssistantMessageFinalData = {
  answerDecision: AnswerDecisionStatus;
  answer?: string;
  noAnswerReason?: NoAnswerReason;
  evidenceRefs: string[] | EvidenceRefSummary[];
  clarificationQuestionId?: string;
  actionDraftId?: string;
  approvalRequestId?: string;
  escalationRequestId?: string;
};
```

前端應把 `answerDecision` 當 discriminant 使用，而不是從 `answer` 是否存在反推狀態。

`tool_failure` 是 `NoAnswerReason`，不是 `AnswerDecisionStatus`。若要顯示 tool failure UI，應判斷：

```ts
answerDecision === 'no_answer' && noAnswerReason === 'tool_failure'
```

## Clarification summary

```ts
type ClarificationQuestionSummary = {
  clarificationQuestionId: string;
  reason?: string;
  question: string;
  candidateRefs?: unknown[];
  blocking?: boolean;
};
```

目前 `final` payload 對前端最重要的是：

- `clarificationQuestionId`
- `answer` 作為可直接顯示的 clarification question

## ActionDraft summary

```ts
type ActionDraftStatus =
  | 'draft'
  | 'waiting_confirmation'
  | 'confirmed'
  | 'executed'
  | 'cancelled'
  | 'expired'
  | 'failed';

type ActionDraftSummary = {
  id: string;
  requestId: string;
  messageId: string;
  status: ActionDraftStatus;
  riskLevel: 'medium';
  toolName: string;
  resource: string;
  operation: string;
  preview?: Record<string, unknown>;
  expiresAt?: string | null;
};
```

`confirm` response 裡的 `recheck` 要特別注意：

```ts
type ActionDraftRecheck = {
  organizationBoundary: 'passed';
  draftStatus: 'passed';
  freshness: 'passed';
  permission: 'pending_execution_guard';
  toolContract: 'pending_execution_guard';
  idempotency: 'reserved' | 'duplicate';
};
```

這表示目前不是所有 execution guard 都已完成，前端不要顯示成「已安全執行」。

## ApprovalRequest summary

```ts
type ApprovalRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired';

type ApprovalRequestSummary = {
  id: string;
  requestId: string;
  sessionId?: string | null;
  messageId: string;
  status: ApprovalRequestStatus;
  riskLevel: 'high' | 'critical';
  requesterActorId: string;
  approverActorId?: string | null;
  actionSummary?: Record<string, unknown>;
  payloadSummary?: Record<string, unknown>;
  expiresAt?: string | null;
  evidenceRefIds?: string[];
};
```

For `001-internal-assistant-embedded-chat-panel`：

- 只需依賴 status/detail 做 display
- 不要在這個 feature 內實作 inline approve/reject/cancel
- 若要進 approval detail，應交由 host app callback 或 future approval-management feature

## Feedback request

```ts
type FeedbackRating = 'positive' | 'negative' | 'neutral';

type FeedbackIntent =
  | 'correction'
  | 'unsafe'
  | 'not_helpful'
  | 'missing_evidence'
  | 'other';

type FeedbackRequest = {
  rating: FeedbackRating;
  intent: FeedbackIntent;
  reason?: string;
  comment?: string;
};
```

`comment` 可以送，但 frontend 不應期待 comment 內容會被原樣反映到 audit/review metadata。

## SSE event union

```ts
type SseBaseEventData = {
  requestId: string;
  sessionId: string;
  messageId: string;
  eventType:
    | 'tool_call_started'
    | 'tool_call_completed'
    | 'tool_call_blocked'
    | 'tool_call_failed'
    | 'evidence_attached'
    | 'approval_required'
    | 'confirmation_required'
    | 'escalation_required'
    | 'answer_delta'
    | 'final'
    | 'error';
  sequence: number;
};

type AssistantSseEvent =
  | (SseBaseEventData & { eventType: 'tool_call_started'; data: { toolCallId: string; toolName: string } })
  | (SseBaseEventData & { eventType: 'tool_call_completed'; data: { toolCallId: string; toolName: string; status: string; executionStatus: string } })
  | (SseBaseEventData & { eventType: 'tool_call_blocked'; data: { toolCallId: string; toolName: string; status: string; executionStatus: string; deniedReason?: string } })
  | (SseBaseEventData & { eventType: 'tool_call_failed'; data: { toolCallId: string; toolName: string; status: string; executionStatus: string; errorCode?: string } })
  | (SseBaseEventData & { eventType: 'evidence_attached'; data: { evidenceRefs: string[] } })
  | (SseBaseEventData & { eventType: 'answer_delta'; data: { delta: string } })
  | (SseBaseEventData & { eventType: 'confirmation_required'; data: { actionDraftId: string; requestId: string; messageId: string; riskLevel: string; preview?: unknown; expiresAt?: string | null } })
  | (SseBaseEventData & { eventType: 'approval_required'; data: { approvalRequestId: string; requestId: string; messageId: string; riskLevel: string; actionSummary?: unknown; expiresAt?: string | null } })
  | (SseBaseEventData & { eventType: 'escalation_required'; data: { escalationRequestId: string; requestId: string; messageId: string; riskLevel: string; reasonCode?: string; reasonSummary?: string; actionSummary?: unknown; expiresAt?: string | null } })
  | (SseBaseEventData & { eventType: 'final'; data: AssistantMessageFinalData })
  | (SseBaseEventData & { eventType: 'error'; data: { code: string; message: string } });
```

實務上前端最穩的做法是：

1. 用中途 event 驅動 loading/progress UI
2. 用 `sequence` 做 ordering / de-dup / debug
3. 只用 `final.data` 決定 message bubble 的最終 state
4. 對未知 event 保持 forward-compatible，不要直接崩潰
