# Assistant API Fixtures

## Purpose

本目錄保留 assistant REST / envelope fixtures 的 scenario matrix，供 contract、unit、
component 與 integration tests 共用。README 只描述已存在的 fixture / regression
coverage，不建立第二套平行 contract 說法。

## Fixture Scenarios

- session create / restore (`sessionId`, `status: active`)
- history `order=asc` / `nextCursor` / empty history
- feedback success / failure / neutral envelope
- ActionDraft detail load
- ActionDraft confirm
- ActionDraft cancel
- ActionDraft `pending_execution_guard`
- ApprovalRequest display-only detail load
- session expired / closed / invisible safe recovery coverage
- unavailable safe recovery envelope
- degraded / unavailable safe error envelope
- answered / clarification / no-answer / permission / confirmation / approval / escalation fixture routing is coordinated through `tests/fixtures/assistant-api/scenarios.ts`

## Guardrails

- fixtures 必須對齊 backend contract handoff
- 不得自行發明 `/history`
- 不得自行發明 `hasMore`
- history pagination 必須以 `nextCursor` 為準
- ApprovalRequest 只供 display-only / detail read scenarios
- 不得新增 inline approval、approval action endpoint 或第二套 assistant service contract
