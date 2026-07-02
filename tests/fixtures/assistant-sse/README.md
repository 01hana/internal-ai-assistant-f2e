# Assistant SSE Fixtures

## Purpose

本目錄保留 assistant SSE fixture scenarios 說明，供後續 parser、component、contract
tests 建立使用。

## SSE Fixture Scenarios

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
- unknown event
- stream interrupted
- error after partial answer

## Guardrails

- final state 只能由 `final.data.answerDecision` 決定
- 不得由 stream close / onDone / answer presence 推測 final
- interrupted / error-after-partial scenario 必須與 answered flow 分開建模
