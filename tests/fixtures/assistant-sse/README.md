# Assistant SSE Fixtures

## Purpose

本目錄保留 assistant SSE fixture scenario matrix，供 parser、component、contract 與
streaming regression tests 使用。README 以 `tests/fixtures/assistant-sse/events.ts`
與既有 regression suites 為準，不建立第二套 SSE semantics。

## SSE Fixture Scenarios

- answered structured lookup (`string[] evidenceRefs`)
- answered document retrieval (`EvidenceRefSummary[] evidenceRefs`)
- `tool_call_started`
- `tool_call_completed`
- `tool_call_blocked`
- `tool_call_failed`
- `evidence_attached`
- `answer_delta`
- `clarification_required`
- `no_answer / no_evidence`
- `no_answer / evidence_conflict` regression coverage
- `no_answer / tool_failure`
- `permission_denied`
- `confirmation_required`
- `approval_required`
- `escalation_required`
- `final`
- `error`
- unknown event fallback
- stream interrupted
- final timeout regression coverage
- error after partial answer

## Guardrails

- final state 只能由 `final.data.answerDecision` 決定
- 不得由 stream close / onDone / answer presence 推測 final
- interrupted / error-after-partial scenario 必須與 answered flow 分開建模
- `tool_failure` 只能作為 `no_answer + noAnswerReason=tool_failure`
- ApprovalRequest 只供 display-only renderer 與 host callback integration 驗證
