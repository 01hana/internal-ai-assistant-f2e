# Backend Contract Sources

## Purpose

本文件索引 Internal Assistant Embedded Chat Panel 前端整合時可依賴的 backend
contract handoff source-of-truth。

## Source Index

| Source | Status | Primary Use |
|---|---|---|
| `docs/contracts/backend-assistant-core/openapi.yaml` | Present | Endpoint surface、headers、schemas、OpenAPI route inventory |
| `docs/contracts/backend-assistant-core/assistant-api-contract.md` | Present | Assistant API behavior notes、session/history/feedback/action/approval boundary |
| `docs/contracts/backend-assistant-core/sse-events.md` | Present | SSE event types、sequence assumptions、forbidden frontend assumptions |
| `docs/contracts/backend-assistant-core/types-notes.md` | Present | Contract-first types、wire fields、enum semantics |
| `docs/contracts/backend-assistant-core/request-response-examples.md` | Present | Request / response / SSE examples、history pagination examples |

若未來 handoff 需要新增其他文件，但 repo 中尚未提供，請以以下標記記錄：

```txt
Expected handoff source, missing in current repo
```

本批不補造缺失 contract。

## API Surface Inventory

### Session endpoints

目前 assistant-facing session surface：

- `POST /api/v1/assistant/sessions`
- `GET /api/v1/assistant/sessions/{sessionId}`
- `GET /api/v1/assistant/sessions/{sessionId}/messages`
- `POST /api/v1/assistant/sessions/{sessionId}/messages`

### History endpoint

- 唯一 public history endpoint: `GET /api/v1/assistant/sessions/{sessionId}/messages`
- public query contract 只允許：
  - `limit`
  - `cursor`
  - `order=asc`
- history pagination 以 `nextCursor` 為準
- `hasMore` 不是目前 wire field
- `/history` 不是目前 public contract

### Send-message SSE endpoint

- `POST /api/v1/assistant/sessions/{sessionId}/messages`
- request content type: `application/json`
- request accept: `text/event-stream`
- response content type: `text/event-stream`

### Feedback endpoint

- `POST /api/v1/assistant/messages/{messageId}/feedback`

### ActionDraft endpoints

- `GET /api/v1/assistant/action-drafts/{actionDraftId}`
- `POST /api/v1/assistant/action-drafts/{actionDraftId}/confirm`
- `POST /api/v1/assistant/action-drafts/{actionDraftId}/cancel`

### ApprovalRequest boundary

Documented endpoints include:

- `GET /api/v1/assistant/approval-requests`
- `GET /api/v1/assistant/approval-requests/{approvalRequestId}`
- `POST /api/v1/assistant/approval-requests/{approvalRequestId}/approve`
- `POST /api/v1/assistant/approval-requests/{approvalRequestId}/reject`
- `POST /api/v1/assistant/approval-requests/{approvalRequestId}/cancel`

For this feature:

- only status/detail display is in scope
- open-detail callback is in scope
- inline approve / reject / cancel is out of scope

## SSE Contract Inventory

### Known public SSE events

- `tool_call_started`
- `tool_call_completed`
- `tool_call_blocked`
- `tool_call_failed`
- `evidence_attached`
- `answer_delta`
- `confirmation_required`
- `approval_required`
- `escalation_required`
- `final`
- `error`

### Common SSE envelope fields

- `requestId`
- `sessionId`
- `messageId`
- `eventType`
- `sequence`

## Contract Types and Enums

### AnswerDecisionStatus

Public behavior currently includes:

- `answered`
- `clarification_required`
- `no_answer`
- `confirmation_required`
- `approval_required`
- `escalation_required`
- `permission_denied`

### NoAnswerReason

Known reasons include:

- `no_evidence`
- `tool_failure`
- `permission_denied`
- `evidence_conflict`
- `ambiguous_query`
- `low_confidence`
- `missing_page_context`
- `unsupported_scope`

Important rule:

- `tool_failure` is `NoAnswerReason`
- `tool_failure` is NOT a standalone final state

### EvidenceRefSummary

Documented public evidence summary includes:

- `id`
- `sourceType`
- `sourceId?`
- `toolCallId?`
- `title?`
- `snippet?`

`evidenceRefs` may be either:

- `string[]`
- `EvidenceRefSummary[]`

## Envelopes and Correlation

### REST success envelope

```json
{
  "requestId": "req-001",
  "data": {}
}
```

### REST error envelope

```json
{
  "requestId": "req-001",
  "error": {
    "code": "forbidden",
    "message": "Access denied",
    "statusCode": 403
  }
}
```

### Identity headers

Current assistant-facing identity headers:

- `x-request-id`
- `x-actor-id`
- `x-organization-id`
- `x-host-app`
- `x-role`
- `x-permission-scopes`

## Frontend Guardrails Derived From Handoff

- backend contract is the only API behavior source of truth
- frontend must not invent missing endpoint / field / event semantics
- final state must only come from `final.data.answerDecision`
- frontend must not treat `tool_failure` as a top-level final state
- frontend must not depend on `/history`, `order=desc`, or `hasMore`
- frontend must keep ApprovalRequest display-only in this feature
