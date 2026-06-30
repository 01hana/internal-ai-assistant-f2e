# Implementation Plan: Internal Assistant Embedded Chat Panel

**Branch**: `001-internal-assistant-embedded-chat-panel` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md) | **Design**: [design.md](./design.md)

**Input**: Feature specification and design for `/specs/001-internal-assistant-embedded-chat-panel/`

## 1. Summary

本 plan 的目標是承接已通過的 `spec.md` 與 `design.md`，建立一份可直接支撐後續 `tasks.md` 產生的 implementation roadmap。

此 roadmap 採用：

- phase-based implementation
- reuse-first migration
- contract-driven refactor

其核心方向是：

- 以 legacy chatbot widget 作為 reference-only 概念來源
- 在正式 production source 中落地 internal assistant embedded panel
- 優先建立 contract-first 的 API / SSE / state foundation
- 以明確 phase、驗收條件、風險與驗證關卡，支撐下一步 `tasks.md` 的切分

## 2. Inputs and Source of Truth

本 plan 依據以下來源：

- `.specify/memory/constitution.md`
- `specs/001-internal-assistant-embedded-chat-panel/spec.md`
- `specs/001-internal-assistant-embedded-chat-panel/design.md`
- `docs/contracts/backend-assistant-core/openapi.yaml`
- `docs/contracts/backend-assistant-core/assistant-api-contract.md`
- `docs/contracts/backend-assistant-core/sse-events.md`
- `docs/contracts/backend-assistant-core/types-notes.md`
- `docs/contracts/backend-assistant-core/request-response-examples.md`
- `docs/reference/legacy-chatbot-widget/raw/`
- Known Decisions

優先順序固定為：

```txt
backend API contract handoff > spec.md / design.md > Known Decisions > legacy reference files
```

補充規則：

- backend assistant API contract handoff 是唯一 API surface source
- legacy reference files 只能用於 UI / interaction / orchestration concept reuse
- legacy reference 不能覆蓋 backend contract
- design 與 plan 若遇到 contract-sensitive 語意，必須回到 handoff 判定

## 3. Current Repository Assumptions

- repo 目前主要由 Spec Kit 初始化檔案、feature documents、backend handoff 與 legacy reference-only 檔案構成。
- `docs/reference/legacy-chatbot-widget/raw/` 內的舊檔案存在，但不是 production source code。
- `spec.md` 與 `design.md` 已存在。
- `plan.md` 已存在，本次僅做結構與治理資訊補強。
- 尚未發現正式 frontend production source root，例如 `src/`、`app/`、`components/`、`stores/`、`composables/` 或 `package.json` / `nuxt.config.*`。
- 若 repo 尚未有正式 frontend source structure，implementation phase 必須包含建立 Nuxt 4 / Vue 3 / TypeScript / Pinia production module structure。
- 若 implementation 前 repo 已初始化 frontend source structure，後續實作應依實際 structure 調整。
- source root / Nuxt app structure 仍需在 implementation 前確認。
- 不得自行假設 `docs/reference/legacy-chatbot-widget/raw/` 內檔案已可直接 import。

## 4. Technical Context

### 4.1 Intended Stack

在目前 repo 尚未出現正式 frontend source structure 的前提下，本 feature 的 intended frontend stack 採：

```txt
Nuxt 4 / Vue 3 / TypeScript / Pinia
```

但 source root / Nuxt structure 仍需依 repo 實際初始化結果確認。

### 4.2 Technical Context Summary

**Frontend Framework / Runtime**: `Nuxt 4`

**UI Framework**: `Vue 3`

**Language / Typing Strategy**: `TypeScript`，以 contract-first 型別與 UI normalized models 為核心

**State Management Strategy**: `Pinia`

**API Client Strategy**: centralized `assistantApiClient`

**SSE Streaming Strategy**: centralized `assistantSseParser` + `useAssistantSseStream`

**Testing Strategy Assumption**: 以 Nuxt / Vue 常見的單元測試、component 測試、contract-oriented 測試與 mock fixtures 為 intended baseline

**Project Type**: frontend embedded panel / widget

**Accessibility Baseline**:

- keyboard navigation
- focus management
- ARIA labels
- ARIA live region
- screen reader readable states

**Legacy Reference Migration Approach**:

- reuse-first
- reference-only
- concept migration into production modules
- 移除 public chatbot / lead / handoff semantics

**Production Naming Strategy**:

- UI components 優先沿用 legacy-compatible names：
  - `ChatWidget`
  - `ChatPanel`
  - `ChatMessageArea`
  - `ChatInputBar`
  - `UserMessageItem`
  - `AiStreamingItem`
  - `AiMessageItem`
- assistant-specific logic 使用 assistant-oriented names：
  - `AssistantHostContextProvider`
  - `assistantApiClient`
  - `assistantSseParser`
  - `useAssistantSession`
  - `useAssistantSseStream`
  - assistant contract types

**Storybook / Mock Preview Assumption**:

- 非本 feature 的必要交付物
- 但 plan 需包含 mock preview / fixture-ready UI validation capability

## 5. Known Decisions

### 5.1 Frontend intended stack

- intended stack 固定為 `Nuxt 4 / Vue 3 / TypeScript / Pinia`
- `source root / Nuxt structure` 仍需依 repo 實際初始化結果確認

### 5.2 Production naming strategy

- UI components 優先沿用 legacy-compatible names：
  - `ChatWidget`
  - `ChatPanel`
  - `ChatMessageArea`
  - `ChatInputBar`
  - `UserMessageItem`
  - `AiStreamingItem`
  - `AiMessageItem`
- assistant-specific logic 使用 assistant-oriented names：
  - `AssistantHostContextProvider`
  - `useAssistantSession`
  - `useAssistantSseStream`
  - `assistantApiClient`
  - `assistantSseParser`
  - assistant contract types
- UI shell / message / input 優先沿用 legacy-compatible component names；核心邏輯則使用 assistant-specific naming，避免 public chatbot 語意污染。

### 5.3 Default session scope strategy

1. 若 host adapter 提供 `entityType + entityId`，預設使用 `entity scope`
2. 否則若提供 `route / screenId`，預設使用 `page scope`
3. 否則 fallback 到 `global scope`
4. host app 可明確 override session scope

## 6. Implementation Strategy

本 feature 的總體實作策略為：

- Phase-based implementation
- Reuse-first migration
- Contract-first API/SSE foundation
- State machine before UI completion
- Safe UI before risky action controls
- Contract fixtures before full integration

### 6.1 為何不能直接沿用 legacy code

不能直接把 legacy code 視為 production source，原因如下：

- legacy session 使用 public chatbot 的 token / localStorage 模型
- legacy streaming 依賴 simple token / `onDone` 模型
- legacy feedback 是 local up/down toggle
- legacy handoff / lead / quick replies 帶有 public customer service 語意
- 新版 internal assistant 需要：
  - `PageContext`
  - `AssistantHostContextProvider`
  - `AnswerDecision`
  - evidence refs
  - ActionDraft
  - ApprovalRequest
  - feedback API
  - SSE event union

### 6.2 總體落地策略

- 先建立 production module structure 與 contract models，再進入 UI migration
- 先建立 host/session/SSE foundation，再做 shell / registry / card-level UI
- 先確保 safe states、contract correctness、data privacy，再做 risky interaction 與 polish
- 每個 phase 都需對齊 backend handoff，不允許以 legacy public chatbot 語意取代 internal assistant contract

## 7. User Story Coverage

| User Story | Primary Phases | Covered Capabilities | Validation Notes |
|---|---|---|---|
| US1：嵌入 host app 並開啟 chat panel | Phase 0, Phase 6, Phase 8 | embedded / launcher mode、`ChatWidget` / `ChatPanel` shell、layout、accessibility | 確認不假設 fixed bottom-right，不保留 public chatbot copy |
| US2：建立 / 還原 session 與載入 history | Phase 2, Phase 3 | `AssistantHostContextProvider`、session scope resolver、host-managed sessionId、`sessionStorage` fallback、history loading | history 必須使用 `GET /api/v1/assistant/sessions/:sessionId/messages`、`order=asc`、`nextCursor` |
| US3：送出 message + PageContext + SSE streaming | Phase 2, Phase 4, Phase 5 | latest `PageContext`、`requestId`、`assistantApiClient`、`assistantSseParser`、`answer_delta`、`final` | request body 是 JSON，response 是 SSE，final state 只看 `final.data.answerDecision` |
| US4：呈現 evidence / AnswerDecision | Phase 1, Phase 5, Phase 7 | AnswerDecision mapper、evidence normalization、`AiMessageItem`、evidence display | `string[] evidenceRefs` 只能顯示 safe chip / id |
| US5：處理 clarification / no-answer / permission denied / tool failure | Phase 1, Phase 5, Phase 7 | safe UI cards、`NoAnswerReason`、permission denied state、tool failure card | `tool_failure` 是 `noAnswerReason`，不得建立 `tool_failed` final state |
| US6：送出 message-level feedback | Phase 1, Phase 5, Phase 7 | feedback API integration、`feedbackStates`、`messageId` / `requestId` linkage | 前端不得自行建立 `ReviewItem` |
| US7：處理 confirmation_required / ActionDraft confirm / cancel | Phase 1, Phase 4, Phase 5, Phase 7 | `confirmation_required` event、ActionDraft card、confirm / cancel、`idempotencyKey` | `pending_execution_guard` 不代表 side-effect 已安全完成 |
| US8：處理 approval_required status display | Phase 1, Phase 4, Phase 5, Phase 7 | `approval_required` event、ApprovalRequest display-only card、`onOpenApprovalDetail` | 不得有 inline approve / reject / cancel |
| US9：處理 network / SSE interrupted / backend degraded | Phase 4, Phase 5, Phase 8 | stream interrupted、timeout、error after partial、degraded / unavailable state | partial answer 不得被當成 final answer |

## 8. Phases / Milestones

### Phase 0: Repository and Contract Preparation

**目標**：確認 repo 結構、保留 reference-only 邊界、建立 contract / fixture 基礎與命名約定。

**主要工作**：

- 確認 frontend stack 與 source root
- 若尚未初始化 frontend source，規劃 Nuxt 4 / Vue 3 / TypeScript / Pinia 的 production module structure
- 確認 `docs/reference/legacy-chatbot-widget/raw/` 只作為 reference
- 確認 backend contract handoff 路徑
- 建立或規劃 contract-aligned mock fixture 目錄
- 建立 production module naming convention
- 確認 UI components 優先沿用 legacy-compatible names
- 確認 assistant-specific logic 使用 assistant-oriented names
- 確認不直接 import reference/raw
- 建立 design.md 中提到的 module boundary 對應規劃

**依賴**：

- 已通過的 `spec.md`
- 已通過的 `design.md`

**驗收條件**：

- source modules 的未來位置已明確
- reference-only 邊界清楚
- contract handoff 已被納入後續實作依據
- 沒有把 legacy raw 規劃成 production source
- naming strategy 已清楚定義

### Phase 1: Core Types, Contract Models, and Fixtures

**目標**：先建立 typed contract foundation，避免 UI 先寫壞。

**主要工作**：

- assistant contract types
- UI normalized message model
- `AnswerDecisionStatus`
- `NoAnswerReason`
- SSE event union
- `EvidenceRefSummary`
- normalized `EvidenceReferenceDisplay`
- `ActionDraft` UI model
- `ApprovalRequest` display model
- feedback request / state model
- API envelope / error envelope model
- mock SSE fixtures
- mock API responses

**固定規則**：

- `tool_failure` 是 `NoAnswerReason`
- `evidenceRefs` 需支援 `string[] | EvidenceRefSummary[]`
- `ApprovalRequest` 是 display-only
- history 使用 `nextCursor`

**依賴**：

- Phase 0 的 source/module 邊界確認

**驗收條件**：

- contract types 與 backend handoff 對齊
- mock fixtures 覆蓋主要 flow
- 沒有新增不存在的 backend field / state

### Phase 2: Host Context Provider and Session Scope Foundation

**目標**：建立 host integration foundation。

**主要工作**：

- `AssistantHostContextProvider`
- demo / test props adapter
- context readiness
- identity headers
- actor / organization / hostApp boundary
- latest `PageContext` getter
- `PageContext` sanitizer
- session scope：`global` / `page` / `entity`
- default session scope resolver
- session scope key generator
- host-managed sessionId support
- `onOpenApprovalDetail` callback

**預設 session scope strategy**：

```txt
1. 若 host adapter 提供 entityType + entityId，預設使用 entity scope
2. 否則若提供 route / screenId，預設使用 page scope
3. 否則 fallback 到 global scope
4. host app 可明確 override session scope
```

**固定規則**：

- 每次 send message 前讀取 latest context
- 不使用過期 snapshot
- context 不足時不猜資料
- `selectedRows` / `activeFilters` / `userVisibleState` 必須 sanitized
- 前端不做權限判斷

**依賴**：

- Phase 1 contract types

**驗收條件**：

- 可取得 latest context
- 可解析預設 session scope
- 可生成 session scope key
- 可分辨 context ready / not ready
- 有測試覆蓋 sanitizer、scope resolver 與 scope key

### Phase 3: Session Manager and History Restore

**目標**：建立 session create / restore / history loading。

**主要工作**：

- host-managed sessionId priority
- `sessionStorage` fallback by `SessionScopeKey`
- create session
- get session
- load history
- `nextCursor` pagination
- session expired / closed / invisible fail-safe
- clear scoped fallback
- restart session controlled flow

**必須使用**：

```txt
GET /api/v1/assistant/sessions/:sessionId/messages
order=asc
nextCursor
```

**不得使用**：

```txt
/history
order=desc
hasMore
localStorage token primary strategy
full history cache
```

**依賴**：

- Phase 2 host context provider 與 scope foundation

**驗收條件**：

- host-managed sessionId 優先
- fallback 只用 `sessionStorage`
- history 從 backend 載入
- session fail-safe 正確
- pagination 只依 `nextCursor`
- default session scope strategy 已被套用

### Phase 4: Assistant API Client and SSE Parser Foundation

**目標**：建立集中 API client 與 SSE parser，不讓 API / stream logic 散落於 components。

**主要工作**：

- centralized `assistantApiClient`
- requestId generation / propagation
- response envelope handling
- error envelope handling
- send message SSE request
- `assistantSseParser`
- `sequence` ordering / de-dup
- known event types handling
- unknown event safe fallback
- stream interrupted / timeout / error-after-partial handling

**固定規則**：

- request body 仍是 JSON
- response 是 SSE
- 只有 `final.data.answerDecision` 可決定 final state
- `error` 不得當成 answered
- partial answer 不得當 final answer

**依賴**：

- Phase 1 contract models
- Phase 3 session manager

**驗收條件**：

- API client 不散落在 Vue components
- SSE parser 不散落在 Vue components
- `sequence` ordering / de-dup 明確可驗證
- unknown event safe fallback 可測
- parser 不會把 partial answer promotion 成 final

### Phase 5: Core Store and Orchestration Refactor

**目標**：將 legacy store / orchestration 模式重構為 internal assistant production state foundation。

**主要工作**：

- `useChatWidgetStore`
- `useAssistantSessionStore`
- `useAssistantSession`
- `useAssistantSseStream`
- `useChat`

**重點內容**：

- `useChatWidgetStore` 改成 internal assistant modes
- `useAssistantSessionStore` 納入：
  - `sessionId`
  - `sessionStatus`
  - `sessionScope`
  - `sessionScopeKey`
  - `messages`
  - `nextCursor`
  - `streamingState`
  - `activeRequestId`
  - `activeAssistantMessageId`
  - `pendingActionDraft`
  - `approvalStatus`
  - `degradedState`
  - `feedbackStates`
  - `contextReady`
  - `lastError`
- `useChat` send flow 固定：
  - validate text
  - get latest host context
  - ensure session
  - generate requestId
  - append user message
  - append assistant streaming placeholder
  - call assistant SSE stream
  - handle `answer_delta`
  - handle `evidence_attached`
  - handle `confirmation_required`
  - handle `approval_required`
  - handle `escalation_required`
  - handle `final`

**依賴**：

- Phase 2 host context provider
- Phase 3 session manager
- Phase 4 API client + SSE parser

**驗收條件**：

- core state 與 orchestration 與 design 對齊
- retry 會重新抓 latest `PageContext`
- cancel stream 不等於 cancel ActionDraft / ApprovalRequest
- feedback 不再只是 local rating toggle

### Phase 6: UI Shell and Message Registry Migration

**目標**：將 legacy shell / registry / message item 概念遷移為 internal assistant production UI。

**主要工作**：

- `ChatWidget`
- `ChatPanel`
- `ChatMessageArea`
- `ChatInputBar`
- `UserMessageItem`
- `AiStreamingItem`
- `AiMessageItem`

**遷移原則**：

- UI shell / message / input 優先沿用 legacy-compatible names
- public wording / lead / handoff / support semantics 全面移除
- `ChatMessageArea` registry 納入 internal assistant message/card types
- `AiStreamingItem` 最終化必須等 `final`
- `AiMessageItem` 加入 `AnswerDecision`、evidence、backend feedback contract

**依賴**：

- Phase 5 core store / orchestration foundation

**驗收條件**：

- UI shell names 與 naming strategy 對齊
- registry 不再含 lead / handoff / public chatbot types
- shell / message / input 不再依賴 public customer service copy 或 layout assumption

### Phase 7: Safe State, Feedback, ActionDraft, Approval Display

**目標**：完成 internal assistant 的安全狀態與風險互動 UI。

**主要工作**：

- clarification UI
- no-answer UI
- permission denied UI
- tool failure UI
- escalation UI
- feedback API integration
- ActionDraft confirm / cancel
- ApprovalRequest display-only card

**固定邊界**：

- tool failure 只能是 `no_answer + noAnswerReason=tool_failure`
- ActionDraft 只處理 medium-risk confirmation / cancel
- ApprovalRequest 只做 display-only
- 不做 inline approve / reject / cancel
- 前端不得建立 `ReviewItem`

**依賴**：

- Phase 4 parser
- Phase 5 orchestration
- Phase 6 UI shell / registry

**驗收條件**：

- safe states 都有明確 UI
- feedback 可成功 / 失敗 / 重試
- ActionDraft 支援 `idempotencyKey` 與 `pending_execution_guard`
- ApprovalRequest UI 無 action buttons

### Phase 8: Accessibility, Degraded UX, and Final Contract Validation

**目標**：完成嵌入式 layout、無障礙、degraded UX 與最終 contract-oriented regression validation。

**主要工作**：

- embedded layout / launcher mode / narrow container
- keyboard / focus / ARIA / live region
- degraded / unavailable / retry strategy
- contract-oriented regression validation
- sensitive payload logging / storage guard 驗證

**依賴**：

- 前 0-7 phases 全部完成

**驗收條件**：

- focus / keyboard / screen reader 基本檢查通過
- interrupted / timeout / degraded UX 可理解
- contract regression 覆蓋 history / SSE / tool failure / ApprovalRequest display-only
- sensitive payloads 不被持久化或寫入 logs

## 9. Validation Checkpoints

### Gate A: Repository and Structure

- source structure decision confirmed
- reference-only boundary confirmed
- production naming strategy confirmed
- Known Decisions compliance gate
- reference-only boundary gate
- production naming strategy gate

### Gate B: Contract Foundation

- contract types 不發明新 field / state
- `EvidenceRefSummary[] | string[]` 都有清楚 display model
- `tool_failure` 只存在於 `NoAnswerReason`
- no evidence fabrication gate

### Gate C: Host and Session

- latest context is read at send time
- default session scope strategy 正確套用
- session restore strictly follows priority order
- pagination only depends on `nextCursor`
- default session scope resolver gate
- no localStorage session token primary strategy gate

### Gate D: API and SSE

- parser never promotes partial answer to final
- unknown event safe fallback 存在
- request JSON / response SSE 語意清楚
- User Story Coverage gate

### Gate E: Risky / Safe UI

- ApprovalRequest UI has no action buttons
- ActionDraft confirm 不把 `pending_execution_guard` 當完成
- permission denied / no-answer / tool failure / escalation 均有 safe terminal behavior
- no inline approval gate

### Gate F: Privacy and Accessibility

- sensitive payloads are not persisted / logged
- keyboard / focus / ARIA / live region baseline passes
- Out of Scope compliance gate

### Cross-Section Governance Checklist

- Known Decisions 已集中整理，且未被重新列為 Open Questions
- User Story Coverage 已覆蓋 `spec.md` 的 9 個 user stories
- Out of Scope 條目未被 phases 或 task guidance 重新引入
- Open Questions reviewed gate：僅保留實作前需確認但不阻擋 plan 的議題

## 10. Risk Register / Dependencies

| Risk / Dependency | Impact | Mitigation |
|---|---|---|
| repo 尚無正式 frontend source root | 影響 source module 實際落點與 implementation kickoff | 在 Phase 0 先確認或建立 intended production module structure |
| constitution 與 handoff 對 `tool_failed / tool_failure` 有語意差異 | 可能導致 UI state 與 contract 不一致 | 以 handoff + 已通過 spec / design 為實作依據，並在實作前再次明確標記 |
| legacy reference 與 intended production stack 可能存在 module boundary mismatch | 可能導致錯誤 reuse 或過度重寫 | 採 reuse-first，但只遷移 concept，不直接 import raw reference |
| host adapter readiness / session scope quality 直接影響 implementation | 影響 session restore、PageContext、headers、Approval detail | 在 Phase 2 先定義 provider contract、readiness 與 sanitizer |
| unknown event / degraded flow 若先做 UI 後做 parser，容易返工 | 導致 message state 與 UX 邏輯重做 | 嚴格執行 parser / state machine 先於 UI completion |
| legacy public chatbot 語意被帶入 internal assistant | 導致 UI copy、互動流程與產品邊界污染 | 在 Phase 6 migration 時明確移除 lead / handoff / public support copy / phone / email / contact us / customer service disclaimer，並在 validation gate 加入 no public chatbot semantics check |
| Codex 直接 import reference/raw | 導致 reference-only 邊界失效，production 模組來源混亂 | Phase 0 必須確認 `docs/reference/legacy-chatbot-widget/raw/` 是 reference-only；production modules 必須在正式 source root 建立，不得從 reference/raw import |
| session localStorage token 策略被沿用 | 導致前端沿用 public chatbot session 模型並破壞資料最小化 | Phase 3 必須改用 host-managed sessionId priority + `sessionStorage` fallback by `SessionScopeKey`；Validation Gate 必須檢查 no localStorage session token primary strategy |
| simple token onDone streaming 被沿用 | 導致 streaming finalization 與 backend SSE contract 不一致 | Phase 4 必須建立 contract-driven SSE parser；message finalization 只能依 `final.data.answerDecision` |
| `tool_failed` 被誤當 final state | 導致 UI state 與 handoff / spec contract 偏離 | Phase 1 / Phase 7 / contract tests 必須確認 `tool_failure` 只存在於 `NoAnswerReason`，且 UI 條件是 `answerDecision=no_answer + noAnswerReason=tool_failure` |
| `hasMore` / `order=desc` 被誤加 | 導致 history pagination 實作偏離既有 contract | Phase 3 / contract tests 必須確認 history 只支援 `order=asc` 與 `nextCursor` |
| ApprovalRequest 被誤做成 inline approval | 導致 feature scope 擴張為 approval management UI | Phase 7 必須將 ApprovalRequest 限定為 display-only card；Validation Gate 檢查無 approve / reject / cancel buttons |
| evidence `string[]` 被前端補造 summary | 導致 UI 顯示未被 backend 保證的 evidence 內容 | evidence normalization adapter 必須區分 summary vs reference；`string[]` 只能顯示 safe chip / id |
| PageContext raw payload 被送出 | 造成敏感欄位外洩或超出前端可傳送邊界 | Phase 2 必須建立 `PageContext` sanitizer，`selectedRows` / `activeFilters` / `userVisibleState` 只允許 visible、non-secret summary |
| `approvalStatus` 做成單一全域狀態導致多則 approval 覆蓋 | 導致多則 approval card 狀態互相污染 | Phase 5 store 規劃應使用 `approvalRequestId` 或 message-level mapping 管理 ApprovalRequest state |
| production component naming 被重建成平行新 UI components | 造成 legacy reuse 策略失效與結構重工 | Phase 0 / Phase 6 必須確認 UI shell / message / input 優先沿用 legacy-compatible names，不重新規劃不必要的 `AssistantPanel` / `AssistantComposer` / `AssistantMessageList` 平行系統 |
| session scope 預設策略未被套用 | 導致 restore 與 send-message flow 脫離既定 session 邊界 | Phase 2 / Phase 3 / tests 必須覆蓋 `entity > page > global` resolver，且 host app override 需被納入 scope resolution |

## 11. Testing and Acceptance Strategy

### 11.1 Pure Logic / Unit

- session scope key generation
- default session scope strategy
- `sessionStorage` fallback logic
- requestId generation / propagation
- `PageContext` sanitization
- SSE parser
- `sequence` ordering / de-dup
- AnswerDecision mapping
- EvidenceRef normalization
- ActionDraft state transition
- ApprovalRequest display state
- feedback state transition

### 11.2 Component

- `ChatWidget` open / close
- `ChatPanel` embedded / launcher mode
- `ChatInputBar` send / cancel / disabled states
- `ChatMessageArea` registry
- `UserMessageItem`
- `AiStreamingItem`
- `AiMessageItem` answered state
- clarification / no-answer / permission denied / ActionDraft / ApprovalRequest / escalation cards
- error / interrupted / degraded state
- narrow container
- keyboard navigation / focus behavior

### 11.3 Contract-oriented

- history endpoint `/api/v1/assistant/sessions/:sessionId/messages`
- `order=asc`
- `nextCursor`
- no `hasMore`
- send message SSE event union
- `tool_failure = no_answer + noAnswerReason=tool_failure`
- `evidenceRefs = string[] | EvidenceRefSummary[]`
- `approval_required` display-only
- `pending_execution_guard` handling

### 11.4 Mock Fixtures

- answered structured lookup
- answered document retrieval
- clarification required
- no answer / no evidence
- no answer / tool failure
- permission denied
- confirmation required
- approval required
- escalation required
- stream interrupted
- error after partial answer
- unknown SSE event
- history pagination
- session expired / invisible

### 11.5 Acceptance by Phase

- 每個 phase 都必須同時通過：
  - contract correctness
  - scope boundary compliance
  - regression-safe fixture coverage
  - privacy / accessibility baseline（在適用 phase）

## 12. Out of Scope

- backend assistant core
- real ERP / MES / WMS / SCM / CRM connector
- OpenAI / LLM provider
- RAG pipeline
- tool execution engine
- approval backend implementation
- complete approval management UI
- approver pending list
- inline approve / reject / cancel
- admin review APIs
- internal observability endpoints
- public website chatbot
- anonymous visitor support
- lead capture
- customer service handoff
- production deployment / CI/CD / Kubernetes / Helm

## 13. Open Questions

- repo 實際 source root / Nuxt structure 是否已初始化？
- 是否要建立 Storybook / preview environment？
- host app 實際如何提供 identity headers？
- host app 實際如何提供 `onOpenApprovalDetail`？
- prompt suggestions 是否要保留 quick replies 的 UI 外觀？
- feedback reason / intent 的 UX 呈現方式要使用 chips、select 還是 modal？
- embedded mode 與 launcher mode 是否都要在第一版實作，或 launcher mode 作為後續增強？
- host theme / design token override 的最低第一版支援範圍是什麼？

## 14. Task Generation Guidance

後續 `tasks.md` 的切分原則如下：

- 以 phase 為主軸切大任務
- 以 user stories 與 contract surfaces 切子任務
- API client / parser / store / UI component / host adapter / fixtures / tests 分離成可獨立驗收的 work items
- 不把整個 panel 當成單一巨型 task

後續 `tasks.md` 應同時依 phase 與 user story coverage 拆分。每個 task group 應至少標註：

- 對應 phase
- 對應 user story
- 對應 contract surface
- 驗收條件

建議切分粒度：

- **foundation tasks**
  - source structure
  - contract types
  - fixtures
- **host/session tasks**
  - provider
  - sanitizer
  - session scope
  - session manager
- **integration tasks**
  - API client
  - SSE parser
  - requestId propagation
- **state/orchestration tasks**
  - widget store
  - assistant session store
  - `useChat`
  - `useAssistantSseStream`
- **UI migration tasks**
  - shell components
  - registry
  - user / assistant items
  - safe state cards
- **risk / feedback tasks**
  - feedback integration
  - ActionDraft
  - ApprovalRequest display-only
- **validation tasks**
  - unit
  - component
  - contract-oriented
  - accessibility / degraded UX regression

每個 task group 都應對齊至少一個 user story、至少一個 contract surface，並具有明確驗收條件。
不要把所有 UI migration 合成單一大型 task；`ChatWidget` / `ChatPanel` / `ChatMessageArea` / `ChatInputBar` / message items / safe cards 應拆成可獨立驗收的工作項。

## 15. Assumptions / Contract Boundaries

- intended stack 是 `Nuxt 4 / Vue 3 / TypeScript / Pinia`
- source root 需在 implementation 前確認
- legacy raw 不可直接 import
- backend handoff 是唯一 API surface source
- `EvidenceRefSummary[] | string[]` 都是合法 evidenceRefs 表現形式
- Approval operation endpoints 屬 future approval-management feature
- raw evidence / raw tool output / full document text 不在 frontend UI contract 中
- session / history contract 固定為：
  - `POST /api/v1/assistant/sessions`
  - `GET /api/v1/assistant/sessions/:sessionId`
  - `GET /api/v1/assistant/sessions/:sessionId/messages`
  - `POST /api/v1/assistant/sessions/:sessionId/messages`
- history 僅支援：
  - `limit`
  - `cursor`
  - `order=asc`
  - `nextCursor`
- 不存在：
  - `/history`
  - `order=desc`
  - `hasMore`
- send message request 是 JSON
- send message response 是 SSE
- SSE final state 只看 `final.data.answerDecision`
- SSE event 具有：
  - `requestId`
  - `sessionId`
  - `messageId`
  - `eventType`
  - `sequence`
- `tool_failure` 是 `NoAnswerReason`，不是 `AnswerDecisionStatus`
- ApprovalRequest 在本 feature 只做 display-only
- 不做 inline approve / reject / cancel
- default session scope strategy 固定為：
  - `entityType + entityId` → `entity`
  - 否則 `route / screenId` → `page`
  - 否則 → `global`
  - host app 可 override
