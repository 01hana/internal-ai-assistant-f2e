# Implementation Plan: Internal Assistant Embedded Chat Panel

**Branch**: `001-internal-assistant-embedded-chat-panel` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md) | **Design**: [design.md](./design.md)

**Input**: Feature specification and design for `/specs/001-internal-assistant-embedded-chat-panel/`

## 1. Summary

本 plan 的目標是承接已通過的 `spec.md` 與 `design.md`，建立一份可直接支撐後續 `tasks.md` 產生的 implementation roadmap。

此 roadmap 採用：

- phase-based implementation
- contract-first implementation
- reference-guided UI implementation

其核心方向是：

- 以 backend assistant contract 作為 API / SSE / session / history / AnswerDecision / evidence / feedback / ActionDraft / ApprovalRequest 的唯一行為依據
- 以 `docs/reference/legacy-chatbot-widget/raw/` 作為 UI reference implementation，用於對齊 widget shell、panel layout、message list 節奏、input composer 行為、streaming placeholder、bubble layout、feedback affordance
- reference UI files 不是 production source，不得直接 import、copy 或 move
- production implementation 必須落在新版 Nuxt 4 feature-local 架構下
- 優先建立 project initialization、contract-first types、HTTP service、SSE parser、state foundation，再做 UI

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
backend API contract handoff > design.md > spec.md > Known Decisions > docs/reference/legacy-chatbot-widget/raw/ UI reference files
```

補充規則：

- backend assistant API contract handoff 是唯一 API surface source
- `design.md` 是本 plan 的 frontend architecture source of truth
- `spec.md`、`design.md`、`plan.md`、`tasks.md` 共同構成本 feature 的 frontend Spec Kit source of truth
- `docs/reference/legacy-chatbot-widget/raw/` 只作為 UI reference implementation，用於視覺、排版、互動節奏與 component behavior 參考
- reference UI files 不能覆蓋 backend contract
- reference UI files 不能覆蓋 `design.md` 的 Nuxt 4 architecture decisions
- reference UI files 不可直接 import、copy 或 move 成 production source
- 若 reference UI 與 internal assistant contract 衝突，一律以 backend contract 與 `design.md` 為準

## 3. Current Repository Assumptions

- repo 目前主要由 Spec Kit 初始化檔案、feature documents、backend handoff 與 UI reference files 構成。
- `docs/reference/legacy-chatbot-widget/raw/` 是 UI reference implementation directory，不是 production source。
- `spec.md`、`design.md`、`plan.md` 已存在。
- 尚未發現正式 frontend production source root，例如 `app/`、`pages/`、`layouts/`、`services/`、`stores/`、`types/` 或 `nuxt.config.*`。
- 若 repo 尚未有正式 frontend source structure，Phase 0 必須包含 Nuxt 4 project initialization。
- Nuxt 4 source structure 應依 `design.md` 建立在 `app/` 底下。
- production assistant feature 應使用 `app/features/assistant/`。
- API service 應使用 `app/services/index.ts` 與 `app/services/api/assistant.ts`。
- reference UI files 不得直接 import、copy 或 move。
- source root / Nuxt app structure 仍需在 implementation 前確認。
- Phase 0 architecture notes 已收斂於 `spec.md`、`design.md`、`plan.md`、`tasks.md`，不再維護平行 `docs/architecture/internal-assistant/*` source-of-truth 文件。

## 4. Technical Context

### 4.1 Intended Stack

在目前 repo 尚未出現正式 frontend source structure 的前提下，本 feature 的 intended frontend stack 採：

```txt
Nuxt 4 / Vue 3 / TypeScript / Nuxt UI / Tailwind CSS v4 / Pinia / vee-validate / SSE / Vitest + Vue Test Utils + Playwright
```

但 source root / Nuxt structure 仍需依 repo 實際初始化結果確認。

### 4.2 Technical Context Summary

**Frontend Framework / Runtime**: `Nuxt 4`

**UI Library**: `Nuxt UI`

**Styling**: `Tailwind CSS v4`

**Language / Typing Strategy**: `TypeScript`, contract-first types + UI normalized models

**State Management Strategy**: `Pinia`

**Form Validation**: `vee-validate`, retained as project form standard; no complex form required for first chat widget scope

**HTTP Client Strategy**: `app/services/index.ts` as the only shared HTTP client

**Assistant API Service Strategy**: `app/services/api/assistant.ts` as a single assistant domain service

**SSE Streaming Strategy**: `fetch + ReadableStream`, `AssistantService.sendMessageStream()`, `useAssistantSseStream`, `assistantSseParser`

**Testing Strategy**: `Vitest + Vue Test Utils + Playwright + contract-oriented tests`

**Project Type**: `internal assistant embedded chat widget / chat panel`

**Accessibility Baseline**:

- keyboard navigation
- focus management
- ARIA labels
- ARIA live region
- screen reader readable states

**Reference UI Implementation Approach**:

- reference-guided UI implementation
- visual and interaction parity where compatible
- no direct import / copy / move
- no public chatbot semantics
- backend contract always wins over reference UI behavior

**Production Naming Strategy**:

- UI components 優先採用 reference-aligned component names：
  - `ChatWidget`
  - `ChatPanel`
  - `ChatMessageArea`
  - `ChatInputBar`
  - `UserMessageItem`
  - `AiStreamingItem`
  - `AiMessageItem`
  - `ClarificationMessage`
  - `NoAnswerMessage`
  - `PermissionDeniedMessage`
  - `ToolFailureMessage`
  - `EscalationMessage`
  - `ActionDraftConfirmationMessage`
  - `ApprovalRequestDisplayMessage`
  - `SessionRecoveryMessage`
  - `DegradedMessage`
  - `InterruptedMessage`
- assistant-specific logic 使用 assistant-oriented names：
  - `AssistantHostContextProvider`
  - `useAssistantSession`
  - `useAssistantSseStream`
  - `useAssistantHostContext`
  - `useAssistantHostContextAdapter`
  - `useChat`
  - `assistantSseParser`
  - `AssistantService`
  - assistant contract types

**Storybook / Mock Preview Assumption**:

- 非本 feature 的必要交付物
- 但 plan 需包含 mock preview / fixture-ready UI validation capability

## 5. Known Decisions

### 5.1 Frontend intended stack

- `Nuxt 4`
- `Vue 3`
- `TypeScript`
- `Nuxt UI`
- `Tailwind CSS v4`
- `Pinia`
- `vee-validate`
- `SSE`
- `Vitest`
- `Vue Test Utils`
- `Playwright`
- `source root / Nuxt structure` 仍需依 repo 實際初始化結果確認

### 5.2 Production naming strategy

- UI components 優先沿用 reference-aligned component names：
  - `ChatWidget`
  - `ChatPanel`
  - `ChatMessageArea`
  - `ChatInputBar`
  - `UserMessageItem`
  - `AiStreamingItem`
  - `AiMessageItem`
  - `ClarificationMessage`
  - `NoAnswerMessage`
  - `PermissionDeniedMessage`
  - `ToolFailureMessage`
  - `EscalationMessage`
  - `ActionDraftConfirmationMessage`
  - `ApprovalRequestDisplayMessage`
  - `SessionRecoveryMessage`
  - `DegradedMessage`
  - `InterruptedMessage`
- assistant-specific logic 使用 assistant-oriented names：
  - `AssistantHostContextProvider`
  - `useAssistantSession`
  - `useAssistantSseStream`
  - `useAssistantHostContext`
  - `useAssistantHostContextAdapter`
  - `useChat`
  - `assistantSseParser`
  - `AssistantService`
  - assistant contract types
- API service architecture name 應為：
  - `app/services/api/assistant.ts`
  - `AssistantService`
- UI shell / message / input 優先沿用 reference-aligned component names；核心邏輯則使用 assistant-specific naming，避免 public chatbot 語意污染。

### 5.3 Default session scope strategy

1. 若 host adapter 提供 `entityType + entityId`，預設使用 `entity scope`
2. 否則若提供 `route / screenId`，預設使用 `page scope`
3. 否則 fallback 到 `global scope`
4. host app 可明確 override session scope

## 6. Implementation Strategy

本 feature 的總體實作策略為：

- Phase-based implementation
- Reference-guided UI implementation
- Contract-first API / SSE foundation
- State machine before UI completion
- Safe UI before risky action controls
- Contract fixtures before full integration

### 6.1 Reference UI boundary

`docs/reference/legacy-chatbot-widget/raw/` 內檔案只作為 UI reference implementation。

它們可用於參考：

- widget shell
- panel layout
- message list rhythm
- input composer behavior
- streaming placeholder
- user / assistant bubble layout
- feedback affordance
- open / close interaction

但不得帶入：

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

### 6.2 總體落地策略

- Phase 0 先建立 Nuxt 4 project initialization 與 production source structure
- 先建立 `app/services/index.ts` 與 `app/services/api/assistant.ts` 的 API foundation
- 先建立 contract types、fixtures、host context、session、SSE parser，再做 UI
- UI 以 reference-guided 方式重建，不直接 import / copy / move reference files
- UI special states 使用 message renderers，不使用 card layer
- 每個 phase 都需對齊 backend handoff，不允許以 reference UI 的 public chatbot 行為取代 internal assistant contract

## 7. User Story Coverage

| User Story | Primary Phases | Covered Capabilities | Validation Notes |
|---|---|---|---|
| US1：嵌入 host app 並開啟 chat panel | Phase 0, Phase 6, Phase 8 | embedded / launcher mode、`ChatWidget` / `ChatPanel` shell、layout、accessibility | 確認不假設 fixed bottom-right，reference UI 不得帶入 public chatbot semantics |
| US2：建立 / 還原 session 與載入 history | Phase 2, Phase 3 | `AssistantHostContextProvider`、session scope resolver、host-managed sessionId、`sessionStorage` fallback、history loading | history 必須使用 `GET /api/v1/assistant/sessions/:sessionId/messages`、`order=asc`、`nextCursor` |
| US3：送出 message + PageContext + SSE streaming | Phase 2, Phase 4, Phase 5 | latest `PageContext`、`requestId`、`AssistantService.sendMessageStream`、`assistantSseParser`、`answer_delta`、`final` | request body 是 JSON，response 是 SSE，final state 只看 `final.data.answerDecision` |
| US4：呈現 evidence / AnswerDecision | Phase 1, Phase 5, Phase 7 | AnswerDecision mapper、evidence normalization、`AiMessageItem`、evidence display | `string[] evidenceRefs` 只能顯示 safe chip / id |
| US5：處理 clarification / no-answer / permission denied / tool failure | Phase 1, Phase 5, Phase 7 | safe state message renderers、`NoAnswerReason`、permission denied state、tool failure message renderer | `tool_failure` 是 `noAnswerReason`，不得建立 `tool_failed` final state |
| US6：送出 message-level feedback | Phase 1, Phase 5, Phase 7 | `AssistantService.submitFeedback()`、message-level feedback request / state、feedback success / failed / retry UI、`messageId` / `requestId` linkage | 前端不得自行建立 `ReviewItem` |
| US7：處理 confirmation_required / ActionDraft confirm / cancel | Phase 1, Phase 5, Phase 7 | `AssistantService.getActionDraft()`、`AssistantService.confirmActionDraft()`、`AssistantService.cancelActionDraft()`、`confirmation_required` event、`ActionDraftConfirmationMessage`、confirm / cancel、`idempotencyKey` | `pending_execution_guard` 不代表 side-effect 已安全完成，且需涵蓋 expired / failed / cancelled state |
| US8：處理 approval_required status display | Phase 1, Phase 5, Phase 7 | `AssistantService.getApprovalRequest()`、`approval_required` event、`ApprovalRequestDisplayMessage`、`onOpenApprovalDetail` | 不得有 inline approve / reject / cancel，且不得實作 approval management UI |
| US9：處理 network / SSE interrupted / backend degraded | Phase 4, Phase 5, Phase 8 | stream interrupted、timeout、error after partial、degraded / unavailable state | partial answer 不得被當成 final answer |

## 8. Phases / Milestones

### Phase 0: Project Initialization, Source Structure, and Contract Preparation

**目標**：確認或建立 Nuxt 4 project initialization、production source structure、UI reference implementation boundary 與 contract foundation 規劃。

**主要工作**：

- 確認或建立 Nuxt 4 project initialization
- Nuxt UI installation / configuration
- Tailwind CSS v4 setup
- Pinia setup
- TypeScript strict baseline
- vee-validate setup
- Vitest setup
- Vue Test Utils setup
- Playwright setup
- `nuxt.config.ts` baseline
- `app.config.ts` baseline
- `layouts/default.vue` baseline
- `error.vue` baseline
- package scripts baseline
- 建立 `app/features/assistant/`
- 建立 `app/services/index.ts` 規劃
- 建立 `app/services/api/assistant.ts` 規劃
- 建立 `app/stores/assistant/`
- 建立 `app/utils/assistant/`
- 建立 `app/types/assistant/`
- 確認 `docs/reference/legacy-chatbot-widget/raw/` 是 UI reference implementation
- 確認不得直接 import / copy / move reference UI files

**依賴**：

- 已通過的 `spec.md`
- 已通過的 `design.md`

**驗收條件**：

- Nuxt 4 source structure 已確認或有明確初始化任務
- `app/features/assistant/` production target 已明確
- `app/services/index.ts` 與 `app/services/api/assistant.ts` 已明確
- no `app/lib/assistant/`
- no `app/components/assistant/cards/`
- source modules 的未來位置已明確
- UI reference implementation boundary 清楚
- contract handoff 已被納入後續實作依據

### Phase 1: Core Types, Contract Models, and Fixtures

**目標**：先建立 typed contract foundation，避免 UI 先寫壞。

**主要工作**：

- `app/types/assistant/` contract types
- `app/types/assistant/` UI normalized models
- `AnswerDecisionStatus`
- `NoAnswerReason`
- SSE event union
- `EvidenceRefSummary`
- normalized `EvidenceReferenceDisplay`
- `ActionDraft` UI model
- `ApprovalRequest` display model
- feedback request / state model
- API envelope / error envelope model
- `app/utils/assistant/` pure logic contracts
- `tests/fixtures/assistant-api/`
- `tests/fixtures/assistant-sse/`

**固定規則**：

- `tool_failure` 是 `NoAnswerReason`
- `evidenceRefs` 需支援 `string[] | EvidenceRefSummary[]`
- `ApprovalRequest` 是 display-only
- history 使用 `nextCursor`

**依賴**：

- Phase 0 的 source / module 邊界確認

**驗收條件**：

- contract types 與 backend handoff 對齊
- mock fixtures 覆蓋主要 flow
- 沒有新增不存在的 backend field / state
- paths 與 `app/types/assistant/`、`app/utils/assistant/`、`tests/fixtures/...` 對齊

### Phase 2: Host Context Provider and Session Scope Foundation

**目標**：建立 host integration foundation。

**主要工作**：

- `AssistantHostContextProvider`
- `useAssistantHostContext`
- `useAssistantHostContextAdapter`
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
- identity headers via `app/services/index.ts` extra headers merge

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
- identity headers merge 策略清楚
- 有測試覆蓋 sanitizer、scope resolver 與 scope key

### Phase 3: Session Manager and History Restore

**目標**：建立 session create / restore / history loading。

**主要工作**：

- `useAssistantSession`
- `app/stores/assistant/useAssistantSessionStore.ts`
- host-managed sessionId priority
- `sessionStorage` fallback by `SessionScopeKey`
- create session
- get session
- load history
- `nextCursor` pagination
- session expired / closed / invisible fail-safe
- clear scoped fallback
- restart session controlled flow
- `sessionStorage` fallback only stores `sessionId + minimal UI continuity state`

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

### Phase 4: HTTP Service, Assistant Domain Service, and SSE Parser Foundation

**目標**：建立統一 HTTP service、單一 assistant domain service 與 SSE parser，不讓 API / stream logic 散落於 components。

**主要工作**：

- `app/services/index.ts` shared HTTP client
- `rawRequest` / `stream` support
- extra headers merge
- `AbortSignal` support
- silent / safe error mode
- `app/services/api/assistant.ts` single assistant domain service
- `AssistantService.createSession()`
- `AssistantService.getSession()`
- `AssistantService.getSessionMessages()`
- `AssistantService.sendMessageStream()`
- requestId generation / propagation
- `assistantSseParser`
- `sequence` ordering / de-dup
- known event types handling
- unknown event safe fallback
- `useAssistantSseStream`
- stream interrupted / timeout / error-after-partial handling

**固定規則**：

- request body 仍是 JSON
- response 是 SSE
- service implementation 使用相對於 `/api/v1` baseURL 的 path，例如 `assistant/sessions`
- contract docs / tests 使用完整 `/api/v1/assistant/...` endpoint
- domain service 不直接 import `$fetch`
- 不新增 `createChatClient` / `createAssistantClient`
- 只有 `final.data.answerDecision` 可決定 final state
- `error` 不得當成 answered
- partial answer 不得當 final answer

**依賴**：

- Phase 1 contract models
- Phase 3 session manager

**驗收條件**：

- `app/services/index.ts` 是唯一 shared HTTP client
- `app/services/api/assistant.ts` 是單一 assistant domain service
- API client 不散落在 Vue components
- SSE parser 不散落在 Vue components
- `sequence` ordering / de-dup 明確可驗證
- unknown event safe fallback 可測
- parser 不會把 partial answer promotion 成 final

### Phase 5: Core Store and Orchestration Foundation

**目標**：建立 internal assistant production state foundation 與 orchestration。

**主要工作**：

- `app/stores/assistant/useChatWidgetStore.ts`
- `app/stores/assistant/useAssistantSessionStore.ts`
- `app/features/assistant/composables/useAssistantSession.ts`
- `app/features/assistant/composables/useAssistantSseStream.ts`
- `app/features/assistant/composables/useChat.ts`

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
- Phase 4 HTTP service + assistant domain service + SSE parser

**驗收條件**：

- core state 與 orchestration 與 design 對齊
- retry 會重新抓 latest `PageContext`
- cancel stream 不等於 cancel ActionDraft / ApprovalRequest
- feedback 不再只是 local rating toggle

### Phase 6: Reference-guided UI Shell and Message Registry Implementation

**目標**：以 reference-guided 方式建立 internal assistant production UI。

**主要工作**：

- `ChatWidget`
- `ChatPanel`
- `ChatMessageArea`
- `ChatInputBar`
- `UserMessageItem`
- `AiStreamingItem`
- `AiMessageItem`

**實作原則**：

- UI shell / message / input 使用 reference-aligned component names
- 視覺與互動節奏參考 `docs/reference/legacy-chatbot-widget/raw/`
- 不直接 import / copy / move reference files
- public wording / lead / handoff / support semantics 全面移除
- `ChatMessageArea` registry 納入 internal assistant message renderers / message state components
- `AiStreamingItem` 最終化必須等 `final`
- `AiMessageItem` 加入 `AnswerDecision`、evidence、backend feedback contract

**依賴**：

- Phase 5 core store / orchestration foundation

**驗收條件**：

- UI shell names 與 naming strategy 對齊
- registry 不再含 lead / handoff / public chatbot types
- shell / message / input 不再依賴 public customer service copy 或 layout assumption
- reference UI visual parity 在相容範圍內達成

### Phase 7: Safe State, Feedback, ActionDraft, Approval Display

**目標**：完成 internal assistant 的安全狀態與風險互動 UI。

**主要工作**：

- `ClarificationMessage`
- `NoAnswerMessage`
- `PermissionDeniedMessage`
- `ToolFailureMessage`
- `EscalationMessage`
- feedback API integration
- `ActionDraftConfirmationMessage`
- `ApprovalRequestDisplayMessage`

**固定邊界**：

- no card layer
- no `app/components/assistant/cards/`
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
- reference UI visual parity check where compatible
- no direct import / copy / move reference UI files
- no public chatbot copy / semantics

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
- UI reference implementation boundary confirmed
- reference-aligned component naming confirmed
- Known Decisions compliance gate
- Nuxt 4 initialization baseline gate
- `app/features/assistant` structure gate
- `app/services/index.ts` as only HTTP client gate
- `app/services/api/assistant.ts` single domain service gate
- no direct import / copy / move reference UI files gate
- no `app/lib/assistant` gate
- no `app/components/assistant/cards` gate

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
- no `createChatClient` / `createAssistantClient` gate
- no direct `$fetch` in domain service gate
- User Story Coverage gate

### Gate E: Risky / Safe UI

- ApprovalRequest UI has no action buttons
- ActionDraft confirm 不把 `pending_execution_guard` 當完成
- permission denied / no-answer / tool failure / escalation 均有 safe terminal behavior
- no inline approval gate
- no card layer gate

### Gate F: Privacy and Accessibility

- sensitive payloads are not persisted / logged
- keyboard / focus / ARIA / live region baseline passes
- reference UI visual parity where compatible gate
- no public chatbot semantics gate
- Out of Scope compliance gate

### Cross-Section Governance Checklist

- Known Decisions 已集中整理，且未被重新列為 Open Questions
- User Story Coverage 已覆蓋 `spec.md` 的 9 個 user stories
- Out of Scope 條目未被 phases 或 task guidance 重新引入
- Open Questions reviewed gate：僅保留實作前需確認但不阻擋 plan 的議題

## 10. Risk Register / Dependencies

| Risk / Dependency | Impact | Mitigation |
|---|---|---|
| repo 尚無正式 Nuxt 4 source root | 影響 implementation kickoff | Phase 0 建立 Nuxt 4 project initialization 與 `app/` source structure |
| constitution 與 handoff 對 `tool_failed / tool_failure` 有語意差異 | 可能導致 UI state 與 contract 不一致 | 以 handoff + 已通過 spec / design 為實作依據，並在實作前再次明確標記 |
| reference UI files 被誤認為 production source | 造成直接 import / copy / move | 明確定義 `docs/reference/legacy-chatbot-widget/raw/` 僅為 UI reference implementation |
| reference UI 行為覆蓋 backend contract | 導致 session / SSE / AnswerDecision 偏離 contract | backend contract always wins；reference 只指引視覺與互動節奏 |
| API client 被拆成多套 | 導致 baseURL / headers / error handling 分裂 | `app/services/index.ts` 是唯一 HTTP client；禁止 `createChatClient` / `createAssistantClient` |
| assistant API 被過度拆檔 | 增加維護成本 | 本期使用 `app/services/api/assistant.ts` 單一 domain service |
| `app/lib/assistant/` 被重新引入 | 破壞分層 | pure logic 放 `app/utils/assistant/`；API 放 `app/services/api/assistant.ts` |
| card layer 被重新引入 | 破壞 message renderer 設計 | 不使用 `app/components/assistant/cards/`；safe states 使用 message renderers |
| public chatbot semantics 被帶入 | 污染 internal assistant product boundary | Phase 6 / 7 / 8 驗證 no public chatbot / lead / handoff / customer service copy |
| direct `$fetch` 被放進 domain service | 破壞統一 HTTP client | domain service 必須透過 `app/services/index.ts` |
| token / done stream 被沿用 | SSE finalization 錯誤 | `assistantSseParser` 只以 `final.data.answerDecision` 決定 final |
| host adapter readiness / session scope quality 直接影響 implementation | 影響 session restore、PageContext、headers、Approval detail | 在 Phase 2 先定義 provider contract、readiness 與 sanitizer |
| unknown event / degraded flow 若先做 UI 後做 parser，容易返工 | 導致 message state 與 UX 邏輯重做 | 嚴格執行 parser / state machine 先於 UI completion |
| session localStorage token 策略被沿用 | 導致前端沿用不符 design 的 session 模型並破壞資料最小化 | Phase 3 必須改用 host-managed sessionId priority + `sessionStorage` fallback by `SessionScopeKey`；Validation Gate 必須檢查 no localStorage session token primary strategy |
| `tool_failed` 被誤當 final state | 導致 UI state 與 handoff / spec contract 偏離 | Phase 1 / Phase 7 / contract tests 必須確認 `tool_failure` 只存在於 `NoAnswerReason`，且 UI 條件是 `answerDecision=no_answer + noAnswerReason=tool_failure` |
| `hasMore` / `order=desc` 被誤加 | 導致 history pagination 實作偏離既有 contract | Phase 3 / contract tests 必須確認 history 只支援 `order=asc` 與 `nextCursor` |
| ApprovalRequest 被誤做成 inline approval | 導致 feature scope 擴張為 approval management UI | Phase 7 必須將 ApprovalRequest 限定為 display-only；Validation Gate 檢查無 approve / reject / cancel buttons |
| evidence `string[]` 被前端補造 summary | 導致 UI 顯示未被 backend 保證的 evidence 內容 | evidence normalization adapter 必須區分 summary vs reference；`string[]` 只能顯示 safe chip / id |
| PageContext raw payload 被送出 | 造成敏感欄位外洩或超出前端可傳送邊界 | Phase 2 必須建立 `PageContext` sanitizer，`selectedRows` / `activeFilters` / `userVisibleState` 只允許 visible、non-secret summary |
| `approvalStatus` 做成單一全域狀態導致多則 approval 覆蓋 | 導致多則 approval message 狀態互相污染 | Phase 5 store 規劃應使用 `approvalRequestId` 或 message-level mapping 管理 ApprovalRequest state |
| production component naming 被重建成平行新 UI components | 造成 reference alignment 策略失效與結構重工 | Phase 0 / Phase 6 必須確認 UI shell / message / input 優先沿用 reference-aligned component names，不重新規劃不必要的 `AssistantPanel` / `AssistantComposer` / `AssistantMessageList` 平行系統 |
| session scope 預設策略未被套用 | 導致 restore 與 send-message flow 脫離既定 session 邊界 | Phase 2 / Phase 3 / tests 必須覆蓋 `entity > page > global` resolver，且 host app override 需被納入 scope resolution |

## 11. Testing and Acceptance Strategy

### 11.1 Pure Logic / Unit

- `app/utils/assistant/`
- `app/stores/assistant/`
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

- `app/features/assistant/components/`
- `ChatWidget` open / close
- `ChatPanel` embedded / launcher mode
- `ChatInputBar` send / cancel / disabled states
- `ChatMessageArea` registry
- `UserMessageItem`
- `AiStreamingItem`
- `AiMessageItem` answered state
- `ClarificationMessage`
- `NoAnswerMessage`
- `PermissionDeniedMessage`
- `ToolFailureMessage`
- `ActionDraftConfirmationMessage`
- `ApprovalRequestDisplayMessage`
- `EscalationMessage`
- error / interrupted / degraded state
- narrow container
- keyboard navigation / focus behavior
- no card layer
- no public chatbot copy / semantics
- reference UI visual parity where compatible

### 11.3 Contract-oriented

- `app/services/index.ts`
- `app/services/api/assistant.ts`
- single assistant domain service
- no direct `$fetch`
- no `createChatClient` / `createAssistantClient`
- `sendMessageStream` raw `Response` / `ReadableStream`
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

- repo 實際 Nuxt 4 source root 是否已初始化？
- 是否要建立 Storybook / preview environment？
- host app 實際如何提供 identity headers？
- host app 實際如何提供 `onOpenApprovalDetail`？
- docs/reference/legacy-chatbot-widget/raw/ 的 UI visual parity 要到什麼程度？
- reference UI 的哪些 spacing / animation / shell behavior 是 must-have，哪些可由 Nuxt UI / Tailwind 重建時調整？
- prompt suggestions 是否要保留 quick replies 的 UI 外觀？
- feedback reason / intent 的 UX 呈現方式要使用 chips、select 還是 modal？
- embedded mode 與 launcher mode 是否都要在第一版實作，或 launcher mode 作為後續增強？
- host theme / design token override 的最低第一版支援範圍是什麼？

## 14. Task Generation Guidance

後續 `tasks.md` 的切分原則如下：

- 以 phase 為主軸切大任務
- 以 user stories 與 contract surfaces 切子任務
- HTTP service / assistant domain service / parser / store / UI component / host adapter / fixtures / tests 分離成可獨立驗收的 work items
- 不把整個 panel 當成單一巨型 task

後續 `tasks.md` 應同時依 phase 與 user story coverage 拆分。每個 task group 應至少標註：

- 對應 phase
- 對應 user story
- 對應 contract surface
- 驗收條件

建議切分粒度：

- **foundation tasks**
  - Nuxt 4 project initialization
  - Nuxt UI setup
  - Tailwind CSS v4 setup
  - Pinia setup
  - vee-validate setup
  - Vitest setup
  - Vue Test Utils setup
  - Playwright setup
  - package scripts baseline
  - `app/` source structure
  - contract types
  - fixtures
- **host/session tasks**
  - provider
  - sanitizer
  - session scope
  - session manager
- **architecture tasks**
  - `app/features/assistant/components/`
  - `app/features/assistant/composables/`
  - `app/services/index.ts`
  - `app/services/api/assistant.ts`
  - `app/stores/assistant/`
  - `app/utils/assistant/`
  - `app/types/assistant/`
- **integration tasks**
  - `app/services/index.ts` shared HTTP client
  - `app/services/api/assistant.ts` `AssistantService`
  - `sendMessageStream`
  - `assistantSseParser`
  - requestId propagation
- **state/orchestration tasks**
  - widget store
  - assistant session store
  - `useChat`
  - `useAssistantSseStream`
- **UI tasks**
  - reference-guided `ChatWidget`
  - reference-guided `ChatPanel`
  - reference-guided `ChatMessageArea`
  - reference-guided `ChatInputBar`
  - `UserMessageItem`
  - `AiStreamingItem`
  - `AiMessageItem`
  - message renderers
  - safe state message renderers
- **risk / feedback tasks**
  - feedback integration
  - ActionDraft
  - ApprovalRequest display-only
- **validation tasks**
  - unit
  - component
  - contract-oriented
  - accessibility / degraded UX regression

明確禁止：

- 不得產生 `app/components/assistant/cards/`
- 不得產生 `app/lib/assistant/`
- 不得直接 import / copy / move `docs/reference/legacy-chatbot-widget/raw/`
- 不得新增 `createChatClient` / `createAssistantClient`
- 不得在 `services/api/assistant.ts` 直接 import `$fetch`
- 不得拆出 `sessions.ts` / `messages.ts` / `feedback.ts` / `actionDrafts.ts` / `approvalRequests.ts`

每個 task group 都應對齊至少一個 user story、至少一個 contract surface，並具有明確驗收條件。
不要把所有 reference-guided UI implementation 合成單一大型 task；`ChatWidget` / `ChatPanel` / `ChatMessageArea` / `ChatInputBar` / message items / safe state message renderers 應拆成可獨立驗收的工作項。

## 15. Assumptions / Contract Boundaries

- intended stack 是 `Nuxt 4 / Vue 3 / TypeScript / Nuxt UI / Tailwind CSS v4 / Pinia / vee-validate / SSE / Vitest + Vue Test Utils + Playwright`
- source root 需在 implementation 前確認
- `docs/reference/legacy-chatbot-widget/raw/` 是 UI reference implementation，不可直接 import、copy 或 move
- backend handoff 是唯一 API surface source
- production source structure 以 `app/features/assistant/` 為 assistant feature root
- `app/services/index.ts` 是唯一 HTTP client
- `app/services/api/assistant.ts` 是單一 assistant domain service
- 不拆 `sessions.ts` / `messages.ts` / `feedback.ts` / `actionDrafts.ts` / `approvalRequests.ts`
- no `app/lib/assistant/`
- no `app/components/assistant/cards/`
- no card layer
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
- cancel stream does not cancel ActionDraft
- cancel stream does not affect ApprovalRequest
- default session scope strategy 固定為：
  - `entityType + entityId` → `entity`
  - 否則 `route / screenId` → `page`
  - 否則 → `global`
  - host app 可 override
