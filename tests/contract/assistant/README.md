# Assistant Contract Tests

## Purpose

本目錄保留 assistant contract-oriented tests 的原則說明，供後續 Batch B 之後建立測試
時遵循。

## Contract Test Principles

1. final state 只能來自 `final.data.answerDecision`
2. 不得從 stream close / answer presence / onDone 推測 final
3. `string[] evidenceRefs` 不可被前端補造 summary / title / snippet
4. `tool_failure` 是 `NoAnswerReason`，不是 final state
5. `ApprovalRequest` 僅 display-only
6. 前端不得自行建立 `ReviewItem`
7. history endpoint 不得使用 `/history`
8. history order 必須是 `asc`
9. pagination 使用 `nextCursor`，不使用 `hasMore`

## Expected Coverage Direction

- session / history contract
- send-message JSON request + SSE response
- SSE event union and finalization rules
- evidence normalization guardrails
- ApprovalRequest display-only boundary
