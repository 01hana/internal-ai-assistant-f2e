# Reference UI Boundary

## Purpose

本文件定義 `docs/reference/legacy-chatbot-widget/raw/` 在本 feature 中的角色與邊界。

## Role of `docs/reference/legacy-chatbot-widget/raw/`

`docs/reference/legacy-chatbot-widget/raw/` 是 UI reference implementation。

它的用途是協助對齊：

- widget shell
- panel layout
- message list rhythm
- input composer behavior
- streaming placeholder
- bubble layout
- feedback affordance
- open / close interaction

它不是：

- production source
- domain logic source
- backend contract source
- session model source
- streaming contract source

## Allowed Reference Use

前端實作 MAY mirror 以下 UI / interaction aspect：

- widget shell 視覺結構
- panel 區塊編排
- 訊息列表節奏
- composer 操作節奏
- partial streaming placeholder 呈現方式
- bubble / message item 視覺比例
- feedback affordance 的互動提示

## Forbidden Actions

以下行為 MUST NOT 發生：

- import reference UI files into production source
- copy reference UI files into production source
- move reference UI files into production source
- rename reference UI files 後當成正式 implementation

reference UI files 只能作為視覺與互動參考，正式實作必須在 production target 路徑中
重建。

## Forbidden Semantics

以下語意不得從 reference UI 帶入 internal assistant：

- public chatbot semantics
- anonymous visitor session model
- `sessionToken`
- `/history` endpoint
- token / done SSE finalization
- lead capture
- customer handoff
- customer service copy
- local-only feedback toggle
- public fallback mode

## Contract Priority

優先順序固定為：

```txt
backend API contract handoff > design.md > spec.md > Known Decisions > docs/reference/legacy-chatbot-widget/raw/
```

因此：

- reference UI MUST NOT 覆蓋 backend contract
- reference UI MUST NOT 覆蓋 `design.md` architecture
- 若 reference UI 與 backend contract 衝突，一律 backend contract wins
- 若 reference UI 與 `design.md` 衝突，一律以 `design.md` 為準

## Practical Interpretation

### Can mirror

- component layout
- spacing rhythm
- interaction choreography
- visual information density

### Must rebuild from contract

- session create / restore / history
- SSE parser
- `AnswerDecision`
- `EvidenceRef`
- feedback flow
- `ActionDraft`
- `ApprovalRequest`
- request / error envelope handling
- identity headers propagation

## Batch A Rule

本批之後的所有 implementation batch 都必須在開始前重申：

- reference UI 只作為參考
- 不可 import / copy / move
- 不可帶入 public chatbot、lead、handoff、customer-service semantics
