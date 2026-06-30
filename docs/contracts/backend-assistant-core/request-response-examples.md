# Request / Response Examples

所有 examples 都使用 deterministic mock ids，並刻意省略 secret、raw payload、raw connector output 與 full document text。

## Common headers

```http
x-request-id: req-frontend-001
x-actor-id: actor-001
x-organization-id: org-001
x-host-app: erp-web
x-role: operator
x-permission-scopes: orders:read,inventory:read
```

## Create session

```http
POST /api/v1/assistant/sessions
Content-Type: application/json
```

```json
{
  "pageContext": {
    "module": "orders",
    "route": "/orders/SO-10001",
    "screenId": "order-detail",
    "entityType": "order",
    "entityId": "SO-10001",
    "activeFilters": [
      { "field": "status", "value": "confirmed" }
    ],
    "visibleColumns": ["status", "customerName"]
  }
}
```

```json
{
  "requestId": "req-frontend-001",
  "data": {
    "id": "session-001",
    "title": "Order status follow-up",
    "status": "open",
    "createdAt": "2026-06-23T09:00:00.000Z",
    "updatedAt": "2026-06-23T09:00:00.000Z",
    "pageContext": {
      "module": "orders",
      "route": "/orders/SO-10001",
      "screenId": "order-detail",
      "entityType": "order",
      "entityId": "SO-10001",
      "activeFilters": [
        { "field": "status", "value": "confirmed" }
      ],
      "visibleColumns": ["status", "customerName"]
    }
  }
}
```

## Get session

```http
GET /api/v1/assistant/sessions/session-001
```

```json
{
  "requestId": "req-frontend-002",
  "data": {
    "id": "session-001",
    "title": "Order status follow-up",
    "status": "open",
    "createdAt": "2026-06-23T09:00:00.000Z",
    "updatedAt": "2026-06-23T09:02:00.000Z",
    "latestMessageId": "msg-assistant-001"
  }
}
```

## Get paginated session messages

```http
GET /api/v1/assistant/sessions/session-001/messages?limit=1&order=asc
```

```json
{
  "requestId": "req-frontend-003",
  "data": {
    "sessionId": "session-001",
    "messages": [
      {
        "messageId": "msg-user-001",
        "role": "user",
        "content": "請查 SO-10001 訂單狀態",
        "createdAt": "2026-06-23T09:00:30.000Z"
      }
    ],
    "nextCursor": "msg-user-001"
  }
}
```

## Get next history page

```http
GET /api/v1/assistant/sessions/session-001/messages?limit=1&order=asc&cursor=msg-user-001
```

```json
{
  "requestId": "req-frontend-004",
  "data": {
    "sessionId": "session-001",
    "messages": [
      {
        "messageId": "msg-assistant-001",
        "role": "assistant",
        "content": "SO-10001 目前狀態為 confirmed。",
        "createdAt": "2026-06-23T09:00:31.000Z",
        "answerDecision": "answered",
        "evidenceRefs": ["evidence-structured-001"],
        "toolSummary": {
          "status": "completed",
          "toolCallIds": ["tool-call-001"]
        }
      }
    ],
    "nextCursor": null
  }
}
```

## Invisible session / unusable history cursor

```http
GET /api/v1/assistant/sessions/session-hidden-001/messages?limit=20&order=asc
```

```json
{
  "requestId": "req-frontend-005",
  "error": {
    "code": "not_found",
    "message": "Assistant session not found.",
    "statusCode": 404
  }
}
```

## Structured lookup SSE

```http
POST /api/v1/assistant/sessions/session-001/messages
Accept: text/event-stream
Content-Type: application/json
```

```json
{
  "message": "請查 SO-10001 訂單狀態",
  "pageContext": {
    "module": "orders",
    "entityType": "order",
    "entityId": "SO-10001",
    "activeFilters": [
      { "field": "status", "value": "confirmed" }
    ],
    "visibleColumns": ["status", "customerName"]
  }
}
```

Example `final` payload:

```json
{
  "requestId": "req-frontend-006",
  "sessionId": "session-001",
  "messageId": "msg-assistant-001",
  "eventType": "final",
  "sequence": 5,
  "data": {
    "answerDecision": "answered",
    "answer": "SO-10001 目前狀態為 confirmed。",
    "evidenceRefs": ["evidence-structured-001"]
  }
}
```

## SOP / retrieval SSE

```json
{
  "message": "退貨流程 SOP 怎麼說？",
  "pageContext": {
    "module": "orders",
    "screenId": "return-policy"
  }
}
```

Example `final` payload:

```json
{
  "requestId": "req-frontend-007",
  "sessionId": "session-001",
  "messageId": "msg-assistant-002",
  "eventType": "final",
  "sequence": 2,
  "data": {
    "answerDecision": "answered",
    "answer": "依目前作業規範，退貨需先建立退貨申請，再由倉儲確認入庫。",
    "evidenceRefs": ["evidence-doc-001"]
  }
}
```

## Clarification required

```json
{
  "message": "幫我查這筆的狀態",
  "pageContext": {
    "module": "orders",
    "selectedRows": [
      { "id": "SO-10001" },
      { "id": "SO-10002" }
    ]
  }
}
```

Example `final` payload:

```json
{
  "requestId": "req-frontend-008",
  "sessionId": "session-001",
  "messageId": "msg-assistant-003",
  "eventType": "final",
  "sequence": 2,
  "data": {
    "answerDecision": "clarification_required",
    "clarificationQuestionId": "clarification-001",
    "answer": "你選取了多筆資料，請指定要查詢哪一筆。",
    "evidenceRefs": []
  }
}
```

## Tool failure safe no-answer

```json
{
  "message": "請查 SO-99999 訂單狀態"
}
```

Example `final` payload:

```json
{
  "requestId": "req-frontend-009",
  "sessionId": "session-001",
  "messageId": "msg-assistant-004",
  "eventType": "final",
  "sequence": 4,
  "data": {
    "answerDecision": "no_answer",
    "noAnswerReason": "tool_failure",
    "answer": "目前無法安全產生確定答案，請稍後再試或提供更多可驗證資訊。",
    "evidenceRefs": []
  }
}
```

## Submit feedback

```http
POST /api/v1/assistant/messages/msg-assistant-001/feedback
Content-Type: application/json
```

```json
{
  "rating": "negative",
  "intent": "not_helpful",
  "reason": "summary_too_short",
  "comment": "希望能多解釋一點下一步。"
}
```

```json
{
  "requestId": "req-frontend-010",
  "data": {
    "feedbackEventId": "feedback-001",
    "messageId": "msg-assistant-001",
    "rating": "negative",
    "intent": "not_helpful",
    "reviewItemId": "review-001"
  }
}
```

## ActionDraft confirm

```http
POST /api/v1/assistant/action-drafts/action-draft-001/confirm
Content-Type: application/json
```

```json
{
  "idempotencyKey": "confirm-so-10001-001"
}
```

```json
{
  "requestId": "req-frontend-011",
  "data": {
    "actionDraftId": "action-draft-001",
    "status": "confirmed",
    "duplicateSafe": true,
    "recheck": {
      "organizationBoundary": "passed",
      "draftStatus": "passed",
      "freshness": "passed",
      "permission": "pending_execution_guard",
      "toolContract": "pending_execution_guard",
      "idempotency": "reserved"
    }
  }
}
```

## ActionDraft cancel

```http
POST /api/v1/assistant/action-drafts/action-draft-001/cancel
```

```json
{
  "reason": "user_cancelled"
}
```

```json
{
  "requestId": "req-frontend-012",
  "data": {
    "actionDraftId": "action-draft-001",
    "status": "cancelled"
  }
}
```

## ApprovalRequest detail

For `001-internal-assistant-embedded-chat-panel`, this is display-only. The panel should show status / action summary / risk level and let the host app open a dedicated approval detail page if needed.

```http
GET /api/v1/assistant/approval-requests/approval-request-001
```

```json
{
  "requestId": "req-frontend-013",
  "data": {
    "id": "approval-request-001",
    "requestId": "req-approval-001",
    "sessionId": "session-001",
    "messageId": "msg-assistant-005",
    "status": "pending",
    "riskLevel": "high",
    "requesterActorId": "actor-001",
    "approverActorId": null,
    "actionSummary": {
      "toolName": "mock.orders.cancel",
      "resource": "orders",
      "operation": "update"
    },
    "payloadSummary": {
      "targetEntityId": "SO-10001"
    },
    "evidenceRefIds": []
  }
}
```

## ApprovalRequest approve

Future approval-management feature only. This is documented for backend completeness and is not part of `001-internal-assistant-embedded-chat-panel` UI.

```http
POST /api/v1/assistant/approval-requests/approval-request-001/approve
Content-Type: application/json
```

```json
{
  "idempotencyKey": "approve-so-10001-001"
}
```

```json
{
  "requestId": "req-frontend-014",
  "data": {
    "approvalRequestId": "approval-request-001",
    "status": "approved"
  }
}
```
