# Assistant API Fixtures

## Purpose

本目錄保留 assistant REST / envelope fixtures 的 scenarios 說明，供後續 Batch B 之後
建立 contract fixtures 與 component/integration tests 使用。

## Fixture Scenarios

- session create
- session restore
- history pagination
- feedback success
- feedback failure
- ActionDraft confirm
- ActionDraft cancel
- ApprovalRequest display-only
- safe error envelope
- session expired
- session invisible

## Guardrails

- fixtures 必須對齊 backend contract handoff
- 不得自行發明 `/history`
- 不得自行發明 `hasMore`
- history pagination 必須以 `nextCursor` 為準
- ApprovalRequest 只供 display-only / detail read scenarios
