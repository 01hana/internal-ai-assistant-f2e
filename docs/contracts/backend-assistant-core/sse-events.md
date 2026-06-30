# SSE Events

這份文件整理目前 assistant message endpoint 的 SSE event sequence 基準：

- endpoint: `POST /api/v1/assistant/sessions/:sessionId/messages`
- content type: `text/event-stream`
- 最終可靠狀態：`event: final`
- 最終判斷欄位：`final.data.answerDecision`

前端不要把中途 event 視為最終結果，也不要假設每條 flow 都會有相同 sequence。

## Common event envelope

目前 public SSE contract 對每個 event 都保證：

- `requestId`
- `sessionId`
- `messageId`
- `eventType`
- `sequence`

前端可把 `sequence` 用於 event ordering、debug 與避免重複 append；但最終 state 仍只能以 `final.data.answerDecision` 為準。

## Event types currently in public contract

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

## Structured lookup answered

典型 sequence：

1. `tool_call_started`
2. `tool_call_completed`
3. `evidence_attached`
4. `answer_delta`
5. `final`

`final.data.answerDecision = answered`

`final.data.evidenceRefs` 應非空，且 source type 通常為 `structured_record`。

## Document retrieval answered

典型 sequence：

1. `answer_delta`
2. `final`

`final.data.answerDecision = answered`

`final.data.evidenceRefs` 應非空，且 source type 為 `document_chunk`。

前端不要對 retrieval answered flow 期待：

- `tool_call_started`
- `tool_call_completed`

## Clarification required

典型 sequence：

1. `answer_delta`
2. `final`

`final.data.answerDecision = clarification_required`

常見欄位：

- `clarificationQuestionId`
- `answer`
- `evidenceRefs: []`

前端可把 `answer` 當作直接可顯示的 clarification question。

## No-answer / safe failure

涵蓋：

- no evidence
- tool failure
- permission denied
- evidence conflict

可能 sequence：

1. `tool_call_started`
2. `tool_call_failed`
3. `answer_delta`
4. `final`

或：

1. `tool_call_blocked`
2. `answer_delta`
3. `final`

或：

1. `answer_delta`
2. `final`

可能的 `answerDecision`：

- `no_answer`
- `permission_denied`

`tool_failure` 是 `noAnswerReason`，不是獨立的 `answerDecision`。前端若要顯示 tool failure UI，應判斷：

```ts
final.data.answerDecision === 'no_answer' &&
final.data.noAnswerReason === 'tool_failure'
```

前端不要在這類 flow 額外渲染 stale evidence summary，也不要自行把它 fallback 成一般 answered state。

## Medium risk confirmation gate

典型 sequence：

1. `confirmation_required`
2. `final`

`final.data.answerDecision = confirmation_required`

常見欄位：

- `actionDraftId`
- `riskLevel`
- `preview`
- `expiresAt`

前端不要把這條 flow 呈現成 side-effect 已成功執行。confirm 前不應期待 executed side-effect。

## High risk approval gate

典型 sequence：

1. `approval_required`
2. `final`

`final.data.answerDecision = approval_required`

常見欄位：

- `approvalRequestId`
- `riskLevel`
- `expiresAt`
- `actionSummary`

對 `001-internal-assistant-embedded-chat-panel`，這條 flow 只需要支援 approval status card / action summary / risk level / open detail callback，不代表 inline approval。

## Critical risk escalation gate

典型 sequence：

1. `escalation_required`
2. `final`

`final.data.answerDecision = escalation_required`

常見欄位：

- `escalationRequestId`
- `riskLevel`
- `reasonCode`
- `reasonSummary`

## Error event

在 runtime exception 或 stream fallback 情境下，backend 可能回：

1. `error`

`error` event 仍帶完整 envelope 欄位。它可用於 stream-level failure correlation，但不應被前端當作一般 answered message。

## Forbidden frontend assumptions

- 不要假設每次都會有 `answer_delta`
- 不要假設每次都會有 `tool_call_*`
- 不要假設 `approval_required` / `confirmation_required` / `escalation_required` 之後 side-effect 已執行
- 不要假設 `evidenceRefs` 一定存在或一定非空
- 不要從 event 順序反推 authorization 結果；請以 `final.data.answerDecision` 和 `noAnswerReason` 為準
- 不要把 raw tool output、raw payload、full document text 當成 SSE contract 的一部分
