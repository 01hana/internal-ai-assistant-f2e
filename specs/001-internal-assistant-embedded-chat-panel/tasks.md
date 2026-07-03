# Tasks: Internal Assistant Embedded Chat Panel

**Input**: Design documents from `/specs/001-internal-assistant-embedded-chat-panel/`

**Prerequisites**: `spec.md`, `design.md`, `plan.md`

**Tests**: 必須包含。`spec.md` 與 `plan.md` 已要求 automated tests、contract-oriented tests、component tests、fixture validation。

**Organization**: Tasks 依 `phase + user story + contract surface` 拆分。`docs/reference/legacy-chatbot-widget/raw/` 是 UI reference implementation directory，用於對齊 widget shell、panel layout、message rhythm、input composer、streaming placeholder、bubble layout、feedback affordance 等視覺與互動體驗。它不是 production source，不得直接 import、copy 或 move；所有 API / SSE / session / history / AnswerDecision / evidence / feedback / ActionDraft / ApprovalRequest 行為以 backend contract、`design.md`、`plan.md` 為準。

## Overview

- 本 `tasks.md` 承接既有 `spec.md`、`design.md`、`plan.md`，採 `contract-first + reference-guided UI implementation`。
- tasks 同時對齊 `plan.md` 的 Phase 0～8、`spec.md` 的 US1～US9、以及 backend assistant API handoff。
- production source path 採 **暫定 Nuxt 4 慣例路徑**：
  - `app/features/assistant/components/`
  - `app/features/assistant/composables/`
  - `app/services/index.ts`
  - `app/services/api/assistant.ts`
  - `app/stores/assistant/`
  - `app/utils/assistant/`
  - `app/types/assistant/`
  - `tests/unit/assistant/`
  - `tests/component/assistant/`
  - `tests/contract/assistant/`
  - `tests/fixtures/assistant-api/`
  - `tests/fixtures/assistant-sse/`
- 若實際 source root 與上述不同，必須先在 Phase 0 完成 source-root reconciliation，之後再依同一命名與 module boundary 實作。
- 不在本 tasks 內實作 backend core、real connector、RAG、LLM、tool execution、approval management UI、public chatbot、anonymous visitor、lead capture 或 customer service handoff。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行，且不依賴尚未完成的同檔案修改
- **[Story]**: 僅 user story phase 任務需要，格式固定為 `[US1]`～`[US9]`
- **[Foundation]**: 代表跨 US1～US9 的前置基礎任務，例如 project initialization、source structure、contract types、fixtures、host context、session manager、HTTP service、SSE parser
- Foundation tasks 不需要硬塞單一 `[USx]`，但必須在 phase / contract surface / checkpoint 中可驗收
- 後續 implementation 時，Foundation tasks 必須先於對應 user story tasks 完成
- 每個 task 必須含具體檔案或目錄路徑

## Phase 0: Project Initialization, Source Structure, and Contract Preparation

**Purpose**: 建立或確認 Nuxt 4 project initialization、production source structure、UI reference implementation boundary、fixture 目錄策略與 naming convention。

**Contract Surface**: Nuxt 4 initialization baseline、source-root reconciliation、UI reference implementation boundary、backend handoff source of truth、reference-aligned component naming。

**Completion Criteria**: Nuxt 4 source structure 已確認或已建立；package scripts baseline 已確認；`app/features/assistant/` production target 已建立或明確；`app/services/index.ts` 已建立或明確作為唯一 HTTP client；`app/services/api/assistant.ts` 已建立或明確作為單一 assistant domain service；no `app/lib/assistant/`；no `app/components/assistant/cards/`；reference UI files 不得直接 import / copy / move。

- [x] T001 [Foundation] 定義暫定 Nuxt 4 production source 結構與 source-root reconciliation 規則於 `docs/architecture/internal-assistant/source-structure.md`
- [x] T002 [Foundation] 建立 UI reference implementation boundary 說明，明確禁止直接 import / copy / move `docs/reference/legacy-chatbot-widget/raw/` 於 `docs/architecture/internal-assistant/reference-ui-boundary.md`
- [x] T003 [Foundation] 建立 backend contract handoff source-of-truth 索引於 `docs/architecture/internal-assistant/backend-contract-sources.md`
- [x] T004 [Foundation] 規劃 production module boundary 與責任切分於 `docs/architecture/internal-assistant/module-boundaries.md`
- [x] T005 [Foundation] 規劃 assistant production naming convention，固定使用 reference-aligned component names 與 assistant-specific logic names 於 `docs/architecture/internal-assistant/naming-conventions.md`
- [x] T006 [Foundation] 規劃測試與 fixture 目錄結構於 `tests/fixtures/assistant-api/README.md`、`tests/fixtures/assistant-sse/README.md`、`tests/contract/assistant/README.md`
- [x] T007 [Foundation] 建立 implementation kickoff checklist，要求若實際 source root 與 `app/` 不同則先完成對齊於 `docs/architecture/internal-assistant/implementation-kickoff-checklist.md`
- [x] T008 [Foundation] 建立或確認 Nuxt 4 / package baseline，包含 `package.json`、必要 scripts、Nuxt 4 dependency 與 typecheck / test script strategy，並記錄於 `docs/architecture/internal-assistant/project-initialization.md`
- [x] T009 [Foundation] 建立或確認 Nuxt UI、Tailwind CSS v4、Pinia、vee-validate 基礎設定，並記錄實際初始化結果於 `docs/architecture/internal-assistant/project-initialization.md`
- [x] T010 [Foundation] 建立或確認 Vitest、Vue Test Utils、Playwright 測試基線與測試 scripts，並記錄於 `docs/architecture/internal-assistant/project-initialization.md`
- [x] T011 [Foundation] 建立或確認 `nuxt.config.ts`、`app.config.ts`、`layouts/default.vue`、`error.vue` baseline，並記錄於 `docs/architecture/internal-assistant/project-initialization.md`
- [x] T012 [Foundation] 建立或確認 `app/features/assistant/`、`app/features/assistant/components/`、`app/features/assistant/composables/`、`app/services/`、`app/stores/assistant/`、`app/utils/assistant/`、`app/types/assistant/` production source directories
- [x] T013 [Foundation] 建立或確認 `tests/unit/assistant/`、`tests/component/assistant/`、`tests/contract/assistant/`、`tests/fixtures/assistant-api/`、`tests/fixtures/assistant-sse/` test directories
- [x] T014 [Foundation] 更新 `docs/architecture/internal-assistant/project-initialization.md` 與 `docs/architecture/internal-assistant/module-boundaries.md`，記錄實際初始化結果、source root、scripts、`app/services/index.ts` / `app/services/api/assistant.ts` 角色，以及禁止 `app/lib/assistant/` 與 `app/components/assistant/cards/`

**Checkpoint**: project initialization、source-root、package scripts baseline、UI reference implementation boundary、fixture、naming strategy 已明確；後續任務可安全落地。

---

## Phase 1: Core Types, Contract Models, and Fixtures

**Purpose**: 先建立所有 contract-sensitive types、normalized models、mock API/SSE fixtures。

**Contract Surface**: `AnswerDecisionStatus`、`NoAnswerReason`、SSE event union、`EvidenceRefSummary`、`EvidenceReferenceDisplay`、API envelope / error envelope、ActionDraft、ApprovalRequest、feedback。

**Completion Criteria**: types 與 fixtures 能直接支撐 host / session / SSE / UI 任務，且不發明 handoff 未保證的新 final state 或 raw payload UI contract。

- [x] T015 [P] [Foundation] 建立 assistant contract types 與 public enum 定義於 `app/types/assistant/contracts.ts`
- [x] T016 [P] [Foundation] 建立 UI normalized message / session / streaming state types 於 `app/types/assistant/ui.ts`
- [x] T017 [P] [Foundation] 建立 evidence types，支援 `EvidenceRefSummary[] | string[]` 與 `EvidenceReferenceDisplay` 於 `app/types/assistant/evidence.ts`
- [x] T018 [P] [Foundation] 建立 ActionDraft、ApprovalRequest display-only、Feedback request / state types 於 `app/types/assistant/actions.ts`
- [x] T019 [P] [Foundation] 建立 response envelope / error envelope / request metadata types 於 `app/types/assistant/envelopes.ts`
- [x] T020 [Foundation] 建立 contract-aligned mock API responses，涵蓋 session、history、feedback、ActionDraft、ApprovalRequest 於 `tests/fixtures/assistant-api/responses.ts`
- [x] T021 [Foundation] 建立 contract-aligned mock SSE fixtures，涵蓋 `tool_call_started`、`tool_call_completed`、`tool_call_blocked`、`tool_call_failed`、`evidence_attached`、`answer_delta`、`confirmation_required`、`approval_required`、`escalation_required`、`final`、`error` 於 `tests/fixtures/assistant-sse/events.ts`
- [x] T022 [Foundation] 建立 fixture scenario matrix，覆蓋 answered structured lookup、answered document retrieval、clarification required、no answer / no evidence、no answer / tool failure、permission denied、confirmation required、approval required、escalation required、stream interrupted、error after partial answer、unknown SSE event、history pagination、session expired / invisible 於 `tests/fixtures/assistant-api/README.md` 與 `tests/fixtures/assistant-sse/README.md`
- [x] T023 [Foundation] 建立 unit tests，驗證 `tool_failure` 僅作為 `NoAnswerReason`、`ApprovalRequest` 僅為 display-only、`string[] evidenceRefs` 不可被補造 summary / title / snippet / sourceType 於 `tests/unit/assistant/contracts.spec.ts`

**Checkpoint**: foundation types 與 fixtures 已可作為後續 contract tests、parser、message renderers 的唯一型別與 scenario 基礎。

---

## Phase 2: Host Context Provider and Session Scope Foundation

**Purpose**: 建立 `AssistantHostContextProvider`、PageContext sanitizer、default session scope resolver、host-managed session integration 基礎。

**Contract Surface**: actor / organization / host app boundary、identity headers、latest `pageContext`、`entity > page > global` scope resolution、`onOpenApprovalDetail`。

**Completion Criteria**: send-message 與 session-restore 可在不猜測資料、不暴露 raw context 的前提下取得 latest host context。

- [x] T024 [P] [Foundation] 定義 `AssistantHostContextProvider`、`HostAdapter`、context readiness、`onOpenApprovalDetail` contract 於 `app/types/assistant/host-context.ts`
- [x] T025 [P] [Foundation] 定義 identity headers 與 actor / organization / host app boundary model 於 `app/types/assistant/identity-headers.ts`
- [x] T026 [P] [Foundation] 建立 demo / test props adapter，僅作為 demo / test fallback，不取代正式 provider 於 `app/features/assistant/composables/useAssistantHostContextAdapter.ts`
- [x] T027 [Foundation] 建立 latest `PageContext` getter 與 readiness façade 於 `app/features/assistant/composables/useAssistantHostContext.ts`
- [x] T028 [Foundation] 建立 `pageContextSanitizer`，限制 `selectedRows`、`activeFilters`、`visibleColumns`、`userVisibleState` 只輸出 visible、non-secret summary 於 `app/utils/assistant/pageContextSanitizer.ts`
- [x] T029 [Foundation] 建立 `defaultSessionScopeResolver`，固定套用 `entityType + entityId -> entity`、`route / screenId -> page`、fallback -> `global`、host override wins 於 `app/utils/assistant/defaultSessionScopeResolver.ts`
- [x] T030 [Foundation] 建立 `sessionScopeKeyGenerator` 於 `app/utils/assistant/sessionScopeKeyGenerator.ts`
- [x] T031 [Foundation] 建立 host context fixtures，覆蓋 `global` / `page` / `entity` / host override / context not ready 於 `tests/fixtures/assistant-api/host-context.ts`
- [x] T032 [Foundation] 建立 unit tests，驗證 sanitizer、default session scope resolver、scope key generator、host-managed sessionId 與 `onOpenApprovalDetail` contract 於 `tests/unit/assistant/host-context.spec.ts`

**Checkpoint**: host context、sanitizer、scope resolver 已完成，且可透過 `app/services/index.ts` 的 extra headers merge 傳入 `AssistantService` request options。

---

## Phase 3: Session Manager and History Restore

**Purpose**: 建立 session/history service skeleton、session create / get / restore、history loading、`sessionStorage` fallback、session fail-safe。

**Contract Surface**: `POST /api/v1/assistant/sessions`、`GET /api/v1/assistant/sessions/:sessionId`、`GET /api/v1/assistant/sessions/:sessionId/messages`、history query `limit` / `cursor` / `order=asc`、pagination `nextCursor`。

**Completion Criteria**: restore 優先順序與 pagination contract 明確落地；`AssistantService` 的 session/history skeleton 已先於 stream foundation 建立；且不使用 `/history`、`order=desc`、`hasMore` 或 localStorage token primary strategy。

- [x] T033 [Foundation] 建立 `app/services/index.ts` shared HTTP client 的 session/history 基礎能力，支援 baseURL、default headers、extra headers merge、GET params / non-GET body、JSON request 與 error envelope handling
- [x] T034 [Foundation] 建立 `AssistantService` session/history skeleton 於 `app/services/api/assistant.ts`，包含 `createSession()`、`getSession()`、`getSessionMessages()`，並使用相對於 `/api/v1` baseURL 的 path，例如 `assistant/sessions`
- [x] T035 [Foundation] 建立 `sessionStorageSessionMap` 與 `sessionRecovery` helpers，處理 `SessionScopeKey -> sessionId` 最小必要保存、expired / closed / invisible session 與 scoped fallback 清除，落點為 `app/utils/assistant/sessionStorageSessionMap.ts` 與 `app/utils/assistant/sessionRecovery.ts`
- [x] T036 [Foundation] 建立 `useAssistantSessionStore` 的 session / history / nextCursor / contextReady / lastError 基礎 state，並在 `app/features/assistant/composables/useAssistantSession.ts` 透過 `AssistantService.createSession()`、`getSession()`、`getSessionMessages()` 落地 restore / create / restart flow
- [x] T037 [Foundation] 建立 unit tests，驗證 host-managed sessionId restore priority、`sessionStorage` fallback、scoped fallback 清除、no localStorage token primary strategy 與 `sessionStorage` 只保存最小 continuity state，落點於 `tests/unit/assistant/session-restore.spec.ts`
- [x] T038 [Foundation] 建立 contract tests，驗證 history endpoint 只能是 `/api/v1/assistant/sessions/:sessionId/messages`、只支援 `order=asc` / `nextCursor`、不使用 `/history` / `order=desc` / `hasMore`，落點於 `tests/contract/assistant/session-history.contract.spec.ts`

**Checkpoint**: session/history service skeleton、session create / restore / history loading 已可獨立驗證，且完全遵守 handoff contract。

---

## Phase 4: HTTP Service, Assistant Domain Service, and SSE Parser Foundation

**Purpose**: 在既有 session/history service skeleton 之上，擴充 shared HTTP client 的 stream 能力、`sendMessageStream()`、requestId propagation、SSE parser、stream controller。

**Contract Surface**: JSON request + SSE response、known event union、`requestId` / `sessionId` / `messageId` / `eventType` / `sequence`、final state only from `final.data.answerDecision`。

**Completion Criteria**: API / SSE 邏輯不散落於 components；`AssistantService` 的 stream 方法在 Phase 3 skeleton 之上擴充完成；partial answer 不會被提升為 final；unknown event 有 safe fallback。

- [x] T039 [Foundation] 擴充 `app/services/index.ts` shared HTTP client，加入 `rawRequest()`、`stream()`、`AbortSignal`、silent / safe error mode，並維持其為唯一 HTTP client，禁止 `createChatClient` / `createAssistantClient`
- [x] T040 [Foundation] 擴充 `app/services/api/assistant.ts` 的 `AssistantService`，新增 `sendMessageStream()`，並維持 domain service 不直接 import `$fetch`、不拆 `sessions.ts` / `messages.ts` / `feedback.ts` / `actionDrafts.ts` / `approvalRequests.ts`
- [x] T041 [Foundation] 建立 `requestIdGenerator` 於 `app/utils/assistant/requestIdGenerator.ts`
- [x] T042 [Foundation] 建立 `assistantSseParser`，支援 known event union、`sequence` ordering / de-dup、unknown event safe fallback，且 final state 只看 `final.data.answerDecision` 於 `app/utils/assistant/assistantSseParser.ts`
- [x] T043 [Foundation] 建立 `useAssistantSseStream`，處理 connect / stream / interrupt / timeout / error-after-partial lifecycle，並呼叫 `AssistantService.sendMessageStream()` 於 `app/features/assistant/composables/useAssistantSseStream.ts`
- [x] T044 [Foundation] 建立 contract tests，驗證 `POST /api/v1/assistant/sessions/:sessionId/messages` 使用 request `Content-Type: application/json`、request `Accept: text/event-stream`、response `Content-Type: text/event-stream`，且 `sendMessageStream()` 回傳 raw `Response` 或 `ReadableStream` 於 `tests/contract/assistant/send-message.contract.spec.ts`
- [x] T045 [Foundation] 建立 unit tests，驗證 parser 的 `sequence` ordering / de-dup、unknown event fallback、`error` 不當 answered、不能從 `onDone` / stream close / answer presence 推測 final state 於 `tests/unit/assistant/sse-parser.spec.ts`
- [x] T046 [Foundation] 建立 contract / unit tests，驗證 stream foundation 不會覆蓋 Phase 3 的 session/history skeleton 行為，且 `sendMessageStream()` 只負責 stream，不重複定義 feedback / action / approval methods 於 `tests/contract/assistant/send-message.contract.spec.ts` 與 `tests/unit/assistant/sse-parser.spec.ts`

**Checkpoint**: `app/services/index.ts` stream extension、`AssistantService.sendMessageStream()`、SSE parser、stream controller 已可供後續 orchestration 與 UI 安全使用。

---

## Host Integration Deliverables: Internal System Embedding

這一組任務屬於 integration foundation，應在 US1 panel shell 進入正式整合前完成。

- 這些任務不是 ERP / MES / WMS / SCM / CRM connector。
- 這些任務不是 backend。
- 這些任務不是 approval management UI。
- 這些任務只定義 host app 如何 mount panel、provide context、provide identity、handle approval detail callback、provide theme / layout constraints、validate embedded behavior。
- `docs/reference/legacy-chatbot-widget/raw/` 只作為 UI reference implementation。
- Host integration docs 不得要求 host app import / copy / move reference UI files。
- Host integration docs 必須對齊 `app/features/assistant/`、`app/services/index.ts`、`app/services/api/assistant.ts`。

- [ ] T087 [Foundation] [US1,US2,US3,US8] 建立 host integration public API 文件，定義 host app 如何掛載 panel、提供 `AssistantHostContextProvider`、identity headers、latest `PageContext`、session scope override、host-managed sessionId、`onOpenApprovalDetail`、theme / layout hooks，輸出於 `docs/integration/internal-assistant-host-integration.md`
- [ ] T088 [Foundation] [US1] 建立 host app embedding guide，說明其他內部系統如何 import / mount / configure internal assistant panel，包含 embedded container、launcher mode、context ready / not ready、narrow container、focus / z-index / layout 注意事項，輸出於 `docs/integration/internal-assistant-embedding-guide.md`
- [ ] T089 [Foundation] [US2,US3] 建立 PageContext integration examples，覆蓋 list page、detail page、selected rows、active filters、visible columns、entity scope、page scope、global scope、context not ready、sanitized userVisibleState，輸出於 `docs/integration/page-context-examples.md`
- [ ] T090 [Foundation] [US2,US3] 建立 identity headers handoff guide，說明 host app 如何提供 `x-request-id`、`x-actor-id`、`x-organization-id`、`x-host-app`、`x-role`、`x-permission-scopes`，以及前端如何只轉交 identity context、不自行判斷權限，輸出於 `docs/integration/identity-headers-handoff.md`
- [ ] T091 [Foundation] [US8] 建立 ApprovalRequest detail callback integration guide，說明 host app 如何實作 `onOpenApprovalDetail`、如何開啟既有 approval detail route / modal / drawer、如何處理 `approvalRequestId`、如何維持 display-only boundary，輸出於 `docs/integration/approval-detail-callback.md`
- [ ] T092 [Foundation] [US1,US9] 建立 host theme / layout integration checklist，涵蓋 design token、container width、height、overflow、z-index、focus trap / focus management、keyboard navigation、ARIA live region、reduced motion、high contrast、degraded state readability，輸出於 `docs/integration/host-theme-layout-checklist.md`
- [ ] T093 [Foundation] [US1,US2,US3,US8,US9] 規劃 demo host / playground fixture，用於驗證 host integration public API、embedded mode、launcher mode、context ready / not ready、entity / page / global scope、latest `PageContext`、`onOpenApprovalDetail` callback、degraded state，輸出於 `docs/integration/demo-host-playground-plan.md`
- [ ] T094 [Foundation] [US1,US2,US3,US8,US9] 建立 host integration acceptance checklist，驗證 host app 可 mount panel、provider 可提供 context、send / retry 取得 latest `PageContext`、session scope resolver 正確、identity headers 可傳遞、`onOpenApprovalDetail` 可觸發、theme / layout 不破壞 host app，輸出於 `docs/integration/host-integration-acceptance-checklist.md`

---

## Phase 5: User Story 1 - 嵌入 host app 並開啟 chat panel (Priority: P1) 🎯

**Goal**: 在 host app 中提供可嵌入的 assistant shell，支援 embedded / launcher mode、basic accessibility、context not-ready fallback。

**Independent Test**: 在 host app fixture 中掛載 panel，驗證 context ready / not ready、窄容器、鍵盤操作與無 public chatbot copy。

**Contract Surface**: embedded shell、context readiness、reference-aligned component naming、no public chatbot semantics。

- [ ] T047 [P] [US1] 建立 component tests，覆蓋 panel open、context not ready、narrow container、keyboard focus 與 no fixed bottom-right assumption 於 `tests/component/assistant/ChatWidget.shell.spec.ts`
- [ ] T048 [US1] 建立 `useChatWidgetStore`，管理 panel open / close / toggle 與 internal assistant display modes 於 `app/stores/assistant/useChatWidgetStore.ts`
- [ ] T049 [US1] 參考 `docs/reference/legacy-chatbot-widget/raw/` 的 widget shell 節奏，在 production source 建立 reference-guided `ChatWidget` 於 `app/features/assistant/components/ChatWidget.vue`
- [ ] T050 [US1] 建立 `ChatPanel` layout，支援 embedded / launcher mode、header context summary、ARIA live region 與 focus management 於 `app/features/assistant/components/ChatPanel.vue`
- [ ] T051 [US1] 建立 base `ChatMessageArea` registry skeleton，預留 user / streaming / answered / safe state message renderer slots 於 `app/features/assistant/components/ChatMessageArea.vue`
- [ ] T052 [US1] 移除或禁止 public chatbot copy、lead / handoff / support disclaimer semantics 於 `app/features/assistant/components/ChatWidget.vue` 與 `app/features/assistant/components/ChatPanel.vue`

**Checkpoint**: panel shell 可在 host app 中獨立掛載與開啟，且不帶 public chatbot semantics。

---

## Phase 6: User Story 2 - 建立 / 還原 session 與載入 history (Priority: P1)

**Goal**: 讓 panel 可依 host-provided sessionId 或 `sessionStorage` fallback 還原 session，並從 backend 載入 asc history 與 `nextCursor`。

**Independent Test**: 在 `global` / `page` / `entity` 三種 scope 下驗證 restore priority、history asc load、`nextCursor` load-more、expired / invisible fail-safe。

**Contract Surface**: session restore priority、history endpoint、`order=asc`、`nextCursor`、session fail-safe。

- [ ] T053 [P] [US2] 建立 component / integration tests，覆蓋 host-managed sessionId restore、`sessionStorage` fallback、`nextCursor` load-more、expired / invisible fail-safe 於 `tests/component/assistant/session-history.spec.ts`
- [ ] T054 [US2] 在 `useChat` bootstrap flow 中整合 `useAssistantSession`，於 panel 開啟時執行 controlled restore / create 於 `app/features/assistant/composables/useChat.ts`
- [ ] T055 [US2] 在 `ChatMessageArea` 實作 history rendering 與 `nextCursor` 載入更多 UX，且只依 asc messages / `nextCursor` 判斷是否續載 於 `app/features/assistant/components/ChatMessageArea.vue`
- [ ] T056 [US2] 建立 `SessionRecoveryMessage`，處理 session expired / invisible / closed 與 restart path 於 `app/features/assistant/components/SessionRecoveryMessage.vue`

**Checkpoint**: session restore / history 可獨立驗收，且不使用 local cached full history 作回退。

---

## Phase 7: User Story 3 - 送出 message + PageContext + SSE streaming (Priority: P1)

**Goal**: 讓使用者送出 message 時攜帶 latest `pageContext`，並以 SSE streaming 收到 partial 與 final answer。

**Independent Test**: 變更 host context 後送出訊息，驗證 request 取得 latest `pageContext`、request / response content type 正確、`answer_delta` append、`final` 決定最後狀態。

**Contract Surface**: `POST /api/v1/assistant/sessions/:sessionId/messages`、JSON request、SSE response、latest `pageContext`、`requestId`、`answer_delta`、`final`。

- [ ] T057 [P] [US3] 建立 component tests，覆蓋 send / cancel / streaming / final flow 與 unknown event safe fallback 於 `tests/component/assistant/send-message-streaming.spec.ts`
- [ ] T058 [US3] 建立 `useChat` send orchestration，固定執行 validate text、get latest host context、ensure session、generate requestId、append user message、append assistant placeholder、call SSE stream 於 `app/features/assistant/composables/useChat.ts`
- [ ] T059 [US3] 參考 reference UI composer 互動節奏，在 production source 建立 `ChatInputBar`，支援 textarea、send、cancel stream、Enter / Shift+Enter 與 context / session / degraded-aware disabled rule 於 `app/features/assistant/components/ChatInputBar.vue`
- [ ] T060 [US3] 在 `ChatMessageArea` 實作 `answer_delta` append、streaming placeholder、tool call status event registry wiring 於 `app/features/assistant/components/ChatMessageArea.vue`
- [ ] T061 [US3] 建立 `AiStreamingItem`，只在收到 `final` 後完成最終化，不以 stream close 或 `onDone` 推測完成 於 `app/features/assistant/components/AiStreamingItem.vue`
- [ ] T062 [US3] 建立 unit tests，驗證 retry / resend 會重新呼叫 HostContextProvider 取得 latest `PageContext` 並重新解析 default session scope，不沿用 stale snapshot 於 `tests/unit/assistant/retry-context.spec.ts`

**Checkpoint**: send-message streaming flow 已可獨立驗收，並完全遵守 JSON request + SSE response contract。

---

## Phase 8: User Story 4 - 呈現 evidence / AnswerDecision (Priority: P1)

**Goal**: 讓 final answer 可依 `final.data.answerDecision` 顯示正確狀態，並安全呈現 `EvidenceRefSummary[] | string[]`。

**Independent Test**: 分別以 `EvidenceRefSummary[]` 與 `string[] evidenceRefs` answered flow 驗證 UI，確認不補造任何 raw evidence summary。

**Contract Surface**: `final.data.answerDecision`、`EvidenceRefSummary[] | string[]`、`answerDecisionStateMapper`、evidence normalization。

- [ ] T063 [P] [US4] 建立 unit tests，驗證 `answerDecisionStateMapper`、`string[]` safe chip rendering、`EvidenceRefSummary[]` safe summary rendering 於 `tests/unit/assistant/answer-evidence.spec.ts`
- [ ] T064 [US4] 建立 `answerDecisionStateMapper`，禁止從中途 event 或 `answer` presence 推測最終狀態 於 `app/utils/assistant/answerDecisionStateMapper.ts`
- [ ] T065 [US4] 建立 `evidenceNormalizationAdapter`，區分 summary evidence 與 reference-only evidence，禁止補造 `title` / `snippet` / `sourceType` / raw content 於 `app/utils/assistant/evidenceNormalizationAdapter.ts`
- [ ] T066 [US4] 建立 `AiMessageItem` answered-state UI 與 `EvidenceDisplay`，顯示 `AnswerDecision`、evidence chips / summary、以及安全 feedback entry point 於 `app/features/assistant/components/AiMessageItem.vue` 與 `app/features/assistant/components/EvidenceDisplay.vue`

**Checkpoint**: AnswerDecision 與 evidence rendering 已獨立可驗收，且嚴格遵守 evidence-safe UI 邊界。

---

## Phase 9: User Story 5 - clarification / no-answer / permission denied / tool failure (Priority: P1)

**Goal**: 將 backend 的安全最終狀態轉成明確且可理解的 safe UI，而不是偽裝為 answered。

**Independent Test**: 使用 fixtures 觸發 `clarification_required`、`no_answer`、`permission_denied`、`tool_failure`、`escalation_required`，驗證對應 message renderers 與 safe terminal behavior。

**Contract Surface**: `clarification_required`、`no_answer`、`permission_denied`、`tool_failure = no_answer + noAnswerReason`、`escalation_required`。

- [ ] T067 [P] [US5] 建立 component tests，覆蓋 clarification、no-answer、permission denied、tool failure、escalation safe state message renderers 與 terminal behavior 於 `tests/component/assistant/safe-states.spec.ts`
- [ ] T068 [US5] 建立 `ClarificationMessage` 並將補問流程接入 `ChatMessageArea` registry 於 `app/features/assistant/components/ClarificationMessage.vue` 與 `app/features/assistant/components/ChatMessageArea.vue`
- [ ] T069 [US5] 建立 `NoAnswerMessage`，顯示 missing context / no evidence / evidence conflict 等安全無答案狀態 於 `app/features/assistant/components/NoAnswerMessage.vue`
- [ ] T070 [US5] 建立 `PermissionDeniedMessage` 與 `ToolFailureMessage`，其中 tool failure 僅能由 `answerDecision=no_answer + noAnswerReason=tool_failure` 觸發 於 `app/features/assistant/components/PermissionDeniedMessage.vue` 與 `app/features/assistant/components/ToolFailureMessage.vue`
- [ ] T071 [US5] 建立 `EscalationMessage` 並將 safe-state mapping 接入 message registry，避免誤顯示為 answered 於 `app/features/assistant/components/EscalationMessage.vue` 與 `app/features/assistant/components/ChatMessageArea.vue`

**Checkpoint**: 所有 safe state message renderers 均可獨立驗收，且不存在 `tool_failed` final state。

---

## Phase 10: User Story 6 - message-level feedback (Priority: P2)

**Goal**: 將 feedback 從舊式 local toggle 改為後端契約導向的 message-level feedback flow。

**Independent Test**: 對 assistant answer 送出不同 feedback payload，驗證 `messageId` / `requestId` linkage、success / failed / retry UI、且不建立 `ReviewItem`。

**Contract Surface**: `POST /api/v1/assistant/messages/:messageId/feedback`、`messageId`、`requestId`、`rating`、`intent`、`reason?`、`comment?`。

- [ ] T072 [P] [US6] 建立 unit / component tests，覆蓋 feedback success、failed、retry、duplicate submission guard 與 `messageId` / `requestId` linkage 於 `tests/unit/assistant/feedback.spec.ts`
- [ ] T073 [US6] 在 `AssistantService.submitFeedback()` 落地 `POST /api/v1/assistant/messages/:messageId/feedback`，request 需支援 `rating`、`intent`、`reason?`、`comment?` 於 `app/services/api/assistant.ts`
- [ ] T074 [US6] 建立 `FeedbackControls`，只在 final assistant message 顯示 feedback UI，並避免 comment 寫入 console / analytics 於 `app/features/assistant/components/FeedbackControls.vue`
- [ ] T075 [US6] 在 `useAssistantSessionStore` 與 `AiMessageItem` 實作 `feedbackStates`、`messageId` / `requestId` mapping、success / failed / retry UI，且不得自行建立 `ReviewItem` 於 `app/stores/assistant/useAssistantSessionStore.ts` 與 `app/features/assistant/components/AiMessageItem.vue`

**Checkpoint**: feedback flow 已獨立可驗收，且不再是 local-only toggle。

---

## Phase 11: User Story 7 - confirmation_required / ActionDraft (Priority: P2)

**Goal**: 讓 medium-risk action 透過 `confirmation_required` 與 ActionDraft preview / confirm / cancel 完成最小人為確認閉環。

**Independent Test**: 觸發 `confirmation_required`，驗證 preview、risk summary、`expiresAt`、confirm / cancel、`idempotencyKey`、`pending_execution_guard`、expired / failed / cancelled 狀態。

**Contract Surface**: `confirmation_required`、ActionDraft detail / confirm / cancel、`idempotencyKey`、`pending_execution_guard`。

- [ ] T076 [P] [US7] 建立 contract / component tests，覆蓋 `confirmation_required`、ActionDraft detail、confirm / cancel、`pending_execution_guard`、expired / failed / cancelled flows 於 `tests/component/assistant/action-draft.spec.ts`
- [ ] T077 [US7] 在 `AssistantService` 實作 `getActionDraft()`、`confirmActionDraft()`、`cancelActionDraft()`，且 confirm 必須支援 `idempotencyKey` 於 `app/services/api/assistant.ts`
- [ ] T078 [US7] 建立 `ActionDraftConfirmationMessage`，顯示 preview、risk、`expiresAt`、confirm / cancel / loading / terminal states 於 `app/features/assistant/components/ActionDraftConfirmationMessage.vue`
- [ ] T079 [US7] 在 `useChat` 與 `useAssistantSessionStore` 實作 `confirmation_required` event handling 與 message-level pending action mapping，避免被單一全域狀態覆蓋 於 `app/features/assistant/composables/useChat.ts` 與 `app/stores/assistant/useAssistantSessionStore.ts`
- [ ] T080 [US7] 在 `ActionDraftConfirmationMessage` 補上 `pending_execution_guard`、expired、failed、cancelled UI guard，禁止將 confirm 結果誤顯示為 side-effect 已安全完成 於 `app/features/assistant/components/ActionDraftConfirmationMessage.vue`

**Checkpoint**: ActionDraft confirm / cancel 已獨立可驗收，且不會誤宣告動作已完成。

---

## Phase 12: User Story 8 - approval_required status display (Priority: P3)

**Goal**: 讓 ApprovalRequest 以 display-only message renderer 呈現，並提供 host app 的 detail extension point。

**Independent Test**: 觸發 `approval_required`，驗證 `approvalRequestId`、status、`riskLevel`、action summary、safe evidence chips、`onOpenApprovalDetail` callback，且無 inline approval controls。

**Contract Surface**: `approval_required`、ApprovalRequest display-only message renderer、message-level approval mapping、`onOpenApprovalDetail`。

- [ ] T081 [P] [US8] 建立 component tests，覆蓋 approval message renderer display-only 行為、`approvalRequestId` / `status` / `riskLevel` 呈現與 `onOpenApprovalDetail` callback 於 `tests/component/assistant/approval-request.spec.ts`
- [ ] T082 [US8] 建立 `ApprovalRequestDisplayMessage`，顯示 `approvalRequestId`、status、`riskLevel`、action summary、safe evidence chips / summary，且不渲染 approve / reject / cancel buttons 於 `app/features/assistant/components/ApprovalRequestDisplayMessage.vue`
- [ ] T083 [US8] 在 `useAssistantSessionStore` 與 `useChat` 以 `approvalRequestId` 或 message-level mapping 管理 ApprovalRequest state，避免單一全域 `approvalStatus` 覆蓋多則訊息 於 `app/stores/assistant/useAssistantSessionStore.ts` 與 `app/features/assistant/composables/useChat.ts`
- [ ] T084 [US8] 在 `app/services/api/assistant.ts` 落地 `AssistantService.getApprovalRequest()`，並將 `approval_required` event 接入 `ChatMessageArea` registry、綁定 `onOpenApprovalDetail` callback，維持 display-only boundary 於 `app/services/api/assistant.ts`、`app/features/assistant/components/ChatMessageArea.vue` 與 `app/features/assistant/components/ApprovalRequestDisplayMessage.vue`
- [ ] T085 [US8] 建立 contract tests，驗證 `AssistantService.getApprovalRequest()` 使用 read-only detail/status surface，且不引入 inline approve / reject / cancel controls，落點於 `tests/contract/assistant/approval-request.contract.spec.ts`
- [ ] T086 [US8] 在 `ApprovalRequestDisplayMessage` 補上 `onOpenApprovalDetail` callback 缺失或失敗時的 safe disabled / unavailable UI，且不得將 callback failure 視為 approval failure，落點於 `app/features/assistant/components/ApprovalRequestDisplayMessage.vue`

**Checkpoint**: approval flow 已以 display-only 方式獨立可驗收，且未擴張為 approval management UI。

---

## Phase 13: User Story 9 - network / SSE interrupted / backend degraded (Priority: P2)

**Goal**: 在 interrupted、timeout、error-after-partial、backend degraded 情境下維持安全且可理解的 UI。

**Independent Test**: 模擬 interrupted、final timeout、partial 後 error、backend degraded、retry / resend，驗證 partial answer 不會被當成 final，且 retry 會重新取得 latest context。

**Contract Surface**: stream interrupted、timeout、error-after-partial、degraded / unavailable、retry / resend、cancel stream != cancel action。

- [ ] T095 [P] [US9] 建立 unit / component tests，覆蓋 stream interrupted、final timeout、error-after-partial、backend degraded、retry / resend、unknown event fallback 於 `tests/component/assistant/degraded-states.spec.ts`
- [ ] T096 [US9] 建立 `DegradedMessage` 與 `InterruptedMessage`，顯示 retry / resend / safe fallback 說明 於 `app/features/assistant/components/DegradedMessage.vue` 與 `app/features/assistant/components/InterruptedMessage.vue`
- [ ] T097 [US9] 在 `useAssistantSessionStore` 建立 degraded / unavailable / interrupted / failed message state，並保留 safe terminal behavior 於 `app/stores/assistant/useAssistantSessionStore.ts`
- [ ] T098 [US9] 在 `ChatInputBar` 與 `useChat` 實作 retry / resend UX，要求重新呼叫 HostContextProvider 取得 latest `PageContext` 並重新解析 default session scope 於 `app/features/assistant/components/ChatInputBar.vue` 與 `app/features/assistant/composables/useChat.ts`
- [ ] T099 [US9] 在 `useAssistantSseStream` 與 `useAssistantSessionStore` 隔離 cancel stream、cancel ActionDraft、ApprovalRequest display-only 狀態，避免 cancel stream 誤取消 ActionDraft 或 ApprovalRequest 於 `app/features/assistant/composables/useAssistantSseStream.ts` 與 `app/stores/assistant/useAssistantSessionStore.ts`

**Checkpoint**: degraded / interrupted / retry UX 已獨立可驗收，且不會把 partial answer 當成 final。

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: 補強跨 story 的 regression、防護與最終契約驗證。

**Contract Surface**: no public chatbot semantics、privacy / storage guard、accessibility baseline、UI reference implementation boundary。

**Completion Criteria**: 主要 user stories 完成後，cross-cutting regression 與治理條件都能被自動化驗證。

- [ ] T100 [P] 建立 no-public-chatbot-semantics regression tests，驗證 UI 中不存在 lead / handoff / phone / email / contact-us / customer-service copy 於 `tests/component/assistant/no-public-chatbot-semantics.spec.ts`
- [ ] T101 [P] 建立 privacy guard tests，驗證不持久化 raw evidence、raw tool output、full prompt、sensitive payload、localStorage token primary strategy 於 `tests/unit/assistant/privacy-guards.spec.ts`
- [ ] T102 [P] 建立 accessibility regression tests，覆蓋 keyboard navigation、focus management、ARIA labels、live region、confirmation / approval message renderers 可操作性 於 `tests/component/assistant/accessibility.spec.ts`
- [ ] T103 [P] 建立 UI reference implementation boundary regression tests，驗證 production modules 不直接 import / copy / move `docs/reference/legacy-chatbot-widget/raw/` 於 `tests/unit/assistant/reference-boundary.spec.ts`
- [ ] T104 對齊最終 source-root、module-boundary、fixture coverage 與 story completion notes，更新 `docs/architecture/internal-assistant/source-structure.md`、`docs/architecture/internal-assistant/module-boundaries.md`、`tests/fixtures/assistant-api/README.md`

**Checkpoint**: cross-cutting concerns 已完成，整體功能可依 constitution / spec / design / plan 驗證。

---

## Plan Phase Mapping

| Plan Phase                                                                       | Tasks Coverage                                           | Notes                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan Phase 0: Project Initialization, Source Structure, and Contract Preparation | T001-T014                                                | actual Nuxt 4 project initialization、package scripts baseline、Nuxt UI、Tailwind CSS v4、Pinia、TypeScript strict、vee-validate、Vitest、Vue Test Utils、Playwright、`nuxt.config.ts`、`app.config.ts`、`layouts/default.vue`、`error.vue`、source-root reconciliation、UI reference implementation boundary、naming、fixture directories |
| Plan Phase 1: Core Types, Contract Models, and Fixtures                          | T015-T023                                                | contract types、UI models、SSE event union、evidence models、ActionDraft / ApprovalRequest / feedback models、fixtures、contract type tests                                                                                                                                                                                                |
| Plan Phase 2: Host Context Provider and Session Scope Foundation                 | T024-T032                                                | HostContextProvider、identity headers、latest PageContext、sanitizer、default session scope resolver、scope key、host-managed sessionId、`onOpenApprovalDetail`                                                                                                                                                                            |
| Plan Phase 3: Session Manager and History Restore                                | T033-T038, T053-T056                                     | `app/services/index.ts` session/history JSON foundation、`AssistantService` session/history skeleton、`sessionStorage` scoped fallback、session recovery、`useAssistantSessionStore`、`useAssistantSession`、history restore / history UI                                                                                                  |
| Plan Phase 4: HTTP Service, Assistant Domain Service, and SSE Parser Foundation  | T039-T046, T057-T062                                     | HTTP stream extension、`AssistantService.sendMessageStream()`、requestId、assistantSseParser、useAssistantSseStream、send-message SSE flow、partial / final handling                                                                                                                                                                       |
| Plan Phase 5: Core Store and Orchestration Foundation                            | T035-T036, T048, T054, T058, T075, T079, T083, T097-T099 | stores、useChatWidgetStore、useAssistantSessionStore、useAssistantSession、useChat orchestration、feedback state、ActionDraft / ApprovalRequest state、degraded state、retry / cancel separation                                                                                                                                           |
| Plan Phase 6: Reference-guided UI Shell and Message Registry Implementation      | T047-T052, T055, T059-T071, T076-T086                    | ChatWidget、ChatPanel、ChatMessageArea、ChatInputBar、AiStreamingItem、AiMessageItem、safe state message renderers、ActionDraftConfirmationMessage、ApprovalRequestDisplayMessage、reference-guided UI implementation                                                                                                                      |
| Plan Phase 7: Safe State, Feedback, ActionDraft, Approval Display                | T063-T086                                                | AnswerDecision、EvidenceDisplay、safe state message renderers、feedback API integration、ActionDraftConfirmationMessage、ApprovalRequestDisplayMessage                                                                                                                                                                                     |
| Plan Phase 8: Accessibility, Degraded UX, and Final Contract Validation          | T095-T104                                                | degraded / interrupted / retry UX、privacy guard、accessibility regression、UI reference implementation boundary regression、final fixture coverage review                                                                                                                                                                                 |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0**: 可立即開始，先建立 project initialization、source structure、UI reference implementation boundary
- **Phase 1**: 依賴 Phase 0；建立 contract types 與 fixtures
- **Phase 2**: 依賴 Phase 1；建立 host context 與 session scope foundation
- **Phase 3**: 依賴 Phase 2；建立 session/history service skeleton、session manager、history restore
- **Phase 4**: 依賴 Phase 1 與 Phase 3；擴充 HTTP stream support、`sendMessageStream()`、SSE parser、`useAssistantSseStream`
- **Host Integration Deliverables**: 依賴 Phase 0～2 的 source structure、host context types、scope resolver foundation；可與 Phase 3 / Phase 4 的 session / API / SSE foundation 部分平行，但在 US1～US3 驗收前必須完成
- **US1～US9**: 全部依賴 Phase 0～4 完成後才能開始
- **Final Phase**: 依賴所有目標 user stories 完成

### User Story Dependencies

- **US1**: 依賴 shared foundation；不依賴其他 user story
- **US2**: 依賴 US1 shell 與 Phase 3 session foundation
- **US3**: 依賴 US1 shell、US2 session foundation 與 Phase 4 SSE foundation
- **US4**: 依賴 US3 answered / final message flow
- **US5**: 依賴 US3 message registry 與 US4 state mapping
- **US6**: 依賴 US4 final assistant message rendering
- **US7**: 依賴 US3 orchestration、US4 message rendering
- **US8**: 依賴 US3 orchestration、US4 message rendering，且 T091 approval detail callback guide 必須在驗收前完成
- **US9**: 依賴 US3 stream lifecycle、US7 / US8 state isolation guard，且不得依賴 Phase 4 之外的新增 service 首次建立
- **Host Integration Readiness**: Host Integration Deliverables 必須在 US1 shell 正式 integration 前完成
- **Theme / Layout Validation**: T092 必須在 US1 / US9 / accessibility regression 前完成
- **Final Acceptance**: T094 必須在 Final Phase 前完成

### Recommended Delivery Order

1. Phase 0～4 shared foundation
2. Host integration deliverables
3. US1 shell
4. US2 restore / history
5. US3 send-message streaming
6. US4 evidence / AnswerDecision
7. US5 safe states
8. US6 feedback
9. US7 ActionDraft confirmation
10. US8 ApprovalRequest display-only
11. US9 degraded / interrupted / retry
12. Final cross-cutting polish

Recommended integration preparation:

After Phase 0～2, complete Host Integration Deliverables before or alongside Phase 3～4 foundation work, and use those integration deliverables to guide US1～US3 implementation. Host integration deliverables 必須對齊 `app/features/assistant/`、`app/services/index.ts`、`app/services/api/assistant.ts`、`AssistantHostContextProvider`。Phase 3 不得依賴 Phase 4 才首次建立的 `AssistantService`。

## Parallel Execution Examples

### Foundation Parallel Work

```bash
T015 app/types/assistant/contracts.ts
T016 app/types/assistant/ui.ts
T017 app/types/assistant/evidence.ts
T018 app/types/assistant/actions.ts
T019 app/types/assistant/envelopes.ts
```

### Host / Session Parallel Work

```bash
T024 app/types/assistant/host-context.ts
T025 app/types/assistant/identity-headers.ts
T026 app/features/assistant/composables/useAssistantHostContextAdapter.ts
T031 tests/fixtures/assistant-api/host-context.ts
```

### UI Story Parallel Work

```bash
T049 app/features/assistant/components/ChatWidget.vue
T050 app/features/assistant/components/ChatPanel.vue
T051 app/features/assistant/components/ChatMessageArea.vue
```

## Task Execution Contract

後續每一批 task execution prompt 都必須補足足夠上下文，不能只貼 task ID 要 Codex 自行推測。

每一批 task execution prompt 必須包含：

1. Batch scope
2. Target task IDs
3. Source of truth
4. Target files / directories
5. Implementation details
6. Expected outputs
7. Acceptance criteria
8. Required tests / validation
9. Forbidden changes
10. Completion report format

執行規範：

- 不應只貼 task id 讓 Codex 自行推測
- 每一批 batch prompt 都必須明確說明本批採用哪一種測試策略：test-first、same-batch tests、behavior-focused component tests、contract tests、state transition tests，或 docs-only acceptance checklist
- 若本批包含 contract-sensitive logic，Codex 必須先建立或更新測試，再完成實作；至少必須在同一批完成 tests before marking done
- 每批都要重申 contract-sensitive guardrails
- 每批都要限制修改範圍
- 每批都要明確要求回報 modified files、completed task IDs、tests run、validation result、blocked items
- 每批都要再次確認是否違反 no backend、no connector、no raw evidence、no inline approval、no public chatbot semantics
- use `app/services/index.ts` as the only HTTP client
- use `app/services/api/assistant.ts` as the single assistant domain service
- no `createChatClient` / `createAssistantClient`
- no direct `$fetch` in `services/api/assistant.ts`
- no `sessions.ts` / `messages.ts` / `feedback.ts` / `actionDrafts.ts` / `approvalRequests.ts` split
- no `app/lib/assistant/`
- no `app/components/assistant/cards/`
- no card layer
- use `app/features/assistant/components/`
- use `app/features/assistant/composables/`
- `docs/reference/legacy-chatbot-widget/raw/` is UI reference implementation only
- no direct import / copy / move from `docs/reference/legacy-chatbot-widget/raw/`

## Testing Policy: Pragmatic TDD

本專案不要求所有前端 UI 都採 pixel-perfect TDD，但 contract-sensitive logic、pure logic、API / SSE / history、store / orchestration 與重要 UI behavior 必須有對應測試。docs-only integration tasks 則以 acceptance checklist 驗收，不要求 unit / component TDD。

### 規則 1：Contract-sensitive logic 必須 test-first 或同批完成 tests

Contract-sensitive logic 必須採 test-first，或至少在同一批 batch 內完成 tests before marking done。

Contract-sensitive logic 包含：

- backend API path / method / headers
- history pagination
- SSE event parser
- AnswerDecision finalization
- NoAnswerReason mapping
- tool_failure handling
- evidence normalization
- ApprovalRequest display-only boundary
- ActionDraft confirmation / cancel behavior
- PageContext sanitizer
- session scope resolver
- retry / resend latest context behavior

若本批修改 contract-sensitive logic，但沒有新增或更新對應測試，該 task 不得標記為完成。

### 規則 2：Core pure functions 必須先有 unit tests

Core pure functions 必須先有 unit tests，再完成 implementation。

Core pure functions 至少包含：

- `pageContextSanitizer`
- `defaultSessionScopeResolver`
- `sessionScopeKeyGenerator`
- `sessionStorageSessionMap`
- `requestIdGenerator`
- `assistantSseParser` pure parsing helpers
- `answerDecisionStateMapper`
- `evidenceNormalizationAdapter`

這些 function 的測試應覆蓋 happy path、edge cases、invalid / missing input、forbidden behavior，且路徑固定落在 `app/utils/assistant/`。

### 規則 3：API / SSE / history 必須有 contract tests

API / SSE / history 相關實作必須有 contract-oriented tests。

Contract tests 至少要覆蓋：

- `app/services/index.ts`
- `app/services/api/assistant.ts`
- `AssistantService`
- no direct `$fetch`
- no `createChatClient` / `createAssistantClient`
- no split `sessions.ts` / `messages.ts` / `feedback.ts` / `actionDrafts.ts` / `approvalRequests.ts`
- `POST /api/v1/assistant/sessions`
- `GET /api/v1/assistant/sessions/:sessionId`
- `GET /api/v1/assistant/sessions/:sessionId/messages`
- `POST /api/v1/assistant/sessions/:sessionId/messages`
- `POST /api/v1/assistant/messages/:messageId/feedback`
- ActionDraft detail / confirm / cancel
- send message request `Content-Type: application/json`
- send message request `Accept: text/event-stream`
- send message response `Content-Type: text/event-stream`
- `sendMessageStream` raw `Response` / `ReadableStream`
- history `order=asc`
- history `nextCursor`
- no `/history`
- no `order=desc`
- no `hasMore`
- final state only from `final.data.answerDecision`

### 規則 4：Store / orchestration 必須有 state transition tests

Store / orchestration tasks 必須搭配 state transition tests。

至少覆蓋：

- session restore priority
- host-managed sessionId
- `sessionStorage` fallback by `SessionScopeKey`
- send message lifecycle
- streaming placeholder lifecycle
- `answer_delta` accumulation
- `evidence_attached` handling
- `confirmation_required` handling
- `approval_required` handling
- `final` event handling
- `error` / interrupted / timeout handling
- retry / resend re-reads latest `PageContext`
- cancel stream does not cancel ActionDraft
- cancel stream does not affect ApprovalRequest
- feedback success / failed / retry
- ActionDraft pending / confirmed / cancelled / expired / failed
- ApprovalRequest state keyed by `approvalRequestId` or message-level mapping

不得只用 manual testing 驗證 store / orchestration behavior。

### 規則 5：UI components 必須有 behavior-focused component tests

UI components 必須有 behavior-focused component tests，但不要求 pixel-perfect TDD。

Behavior-focused tests 至少要驗證：

- component renders correct state
- loading / disabled / error / empty states
- keyboard interaction
- focus behavior
- ARIA labels / live region where applicable
- no forbidden controls
- no public chatbot copy
- `string[] evidenceRefs` only renders safe chips
- ApprovalRequest message renderer has no approve / reject / cancel buttons
- ActionDraft `pending_execution_guard` is not shown as completed side-effect
- interrupted / degraded state is understandable and retryable
- no card layer
- `app/features/assistant/components/`
- reference UI visual parity where compatible

不要求 pixel-perfect snapshot tests。
不要求每個 CSS class 都有測試。
不要求所有 UI 樣式都採 strict TDD。

### 規則 6：Docs-only integration tasks 使用 acceptance checklist 驗收

Docs-only integration tasks 使用 acceptance checklist 驗收，不需要 unit / component TDD。

Docs-only integration tasks 包含：

- T087 host integration public API document
- T088 host app embedding guide
- T089 PageContext integration examples
- T090 identity headers handoff guide
- T091 ApprovalRequest detail callback integration guide
- T092 host theme / layout integration checklist
- T093 demo host / playground fixture plan
- T094 host integration acceptance checklist

這些 task 完成條件是文件內容完整、涵蓋指定 scenarios、符合 contract guardrails，並可被 Final Validation Checklist 對應項目驗收。

## Implementation Strategy

### Foundation First

1. 完成 Phase 0～4，先建立 project initialization、source-root、contract models、host / session foundation、HTTP service / AssistantService / SSE foundation
2. 完成 Host Integration Deliverables，補齊 host integration public API、embedding guide、PageContext / identity handoff、approval detail callback、theme / layout checklist、demo host / playground plan、host integration acceptance checklist
3. 確認 contract tests、fixture matrix、scope resolver、parser 行為通過後，再進入 story UI

### MVP Interaction Slice

1. 完成 US1～US5
2. 驗證使用者可開啟 panel、restore / create session、送出 message、接收 SSE、看見 evidence / AnswerDecision、並處理 clarification / no-answer / permission denied / tool failure

### Risk / Quality Slice

1. 完成 US6～US9
2. 補齊 feedback、ActionDraft、ApprovalRequest display-only、retry / degraded UX
3. 最後完成 cross-cutting privacy / accessibility / UI reference boundary regression

## Batch Prompt Template

```txt
# Batch 目標
請執行 tasks.md 中的 TXXX-TYYY，目標是 ...

# 必讀文件
- .specify/memory/constitution.md
- specs/001-internal-assistant-embedded-chat-panel/spec.md
- specs/001-internal-assistant-embedded-chat-panel/design.md
- specs/001-internal-assistant-embedded-chat-panel/plan.md
- specs/001-internal-assistant-embedded-chat-panel/tasks.md
- docs/contracts/backend-assistant-core/ 下的 backend contract handoff
- 若本批涉及 host integration，請一併閱讀 relevant integration docs / fixtures if applicable

# 本批任務
- TXXX ...
- TXYY ...

# 修改範圍
允許修改：
- ...
禁止修改：
- spec.md
- design.md
- plan.md
- constitution
- backend contract handoff
- docs/reference/legacy-chatbot-widget/raw/

# 實作要求
- use app/services/index.ts as the only HTTP client
- use app/services/api/assistant.ts as the single assistant domain service
- use app/features/assistant/components/
- use app/features/assistant/composables/
- ...

# Contract guardrails
- no /history
- no order=desc
- no hasMore
- final state only from final.data.answerDecision
- tool_failure = no_answer + noAnswerReason=tool_failure
- evidence string[] no fabrication
- ApprovalRequest display-only
- no createChatClient / createAssistantClient
- no direct $fetch in services/api/assistant.ts
- no sessions.ts / messages.ts / feedback.ts / actionDrafts.ts / approvalRequests.ts split
- no app/lib/assistant/
- no app/components/assistant/cards/
- no card layer
- docs/reference/legacy-chatbot-widget/raw/ is UI reference implementation only
- no direct import / copy / move from docs/reference/legacy-chatbot-widget/raw/
- no public chatbot / lead / handoff semantics

# 測試與驗證
# 測試策略
本批採用：
- [ ] test-first
- [ ] same-batch tests before marking done
- [ ] contract tests
- [ ] state transition tests
- [ ] behavior-focused component tests
- [ ] docs-only acceptance checklist

請依 tasks.md 的 `Testing Policy: Pragmatic TDD` 執行。

請執行或補充：
- ...

# 完成回報格式
請回報：
1. completed task IDs
2. modified files
3. created files
4. tests added
5. tests run
6. validation result
7. blocked / deferred items
8. contract guardrail confirmation
9. testing policy confirmation
10. whether tests were written before or in the same batch as implementation
```

此 template 不應暗示一次執行整份 `tasks.md`，而應限定在單一 batch 範圍。

## Batch Detail Guidance

### Foundation batch guidance

適用 T001-T046 / T087-T094：

- 必須先建立或確認 Nuxt 4 project initialization
- 必須建立 `app/features/assistant/`
- 必須建立 `app/services/index.ts` 與 `app/services/api/assistant.ts`
- 必須先完成 Phase 3 的 session/history service skeleton，再進入 Phase 4 的 stream / SSE extension
- 不得產生 `app/lib/assistant/`
- 不得產生 `app/components/assistant/cards/`
- reference UI files 只能作 UI reference implementation
- 不要實作 UI 細節
- 不要直接 import reference UI files
- 必須先寫 type / fixture / parser / sanitizer tests
- Contract-sensitive foundation logic 必須 test-first 或同批完成測試
- Pure functions 必須先有 unit tests
- API / SSE / history 必須有 contract tests

### UI batch guidance

適用 US1-US5：

- 每批只做少數 UI components
- 不要把 `ChatWidget` / `ChatPanel` / `ChatMessageArea` / `ChatInputBar` / all message renderers 合成單一大任務
- 每個 component 必須有 props / states / empty / error / accessibility expectations
- 每個 UI batch 必須搭配 component tests
- UI visual / interaction 可以參考 `docs/reference/legacy-chatbot-widget/raw/`
- 不得直接 import / copy / move reference UI files
- 不得帶入 public chatbot copy / lead / handoff / customer-service semantics
- UI components 不要求 pixel-perfect TDD
- UI components 必須有 behavior-focused component tests
- component tests 應驗證 state、interaction、accessibility、forbidden controls / forbidden copy

### Risk interaction batch guidance

適用 US6-US8：

- feedback、ActionDraft、ApprovalRequest 分批做
- `ApprovalRequestDisplayMessage` 保持 display-only
- `ActionDraftConfirmationMessage` 不宣告 side-effect 已完成，除非 contract 明確提供
- feedback 不自行建立 `ReviewItem`
- feedback / ActionDraft / ApprovalRequest 必須有 state transition 或 behavior tests
- ApprovalRequest display-only 必須有禁止 inline approval controls 的測試
- ActionDraft `pending_execution_guard` 必須有不顯示 side-effect completed 的測試

### Degraded / final validation batch guidance

適用 US9（T095-T099）/ Final Phase（T100-T104）：

- interrupted / timeout / partial-after-error / unknown event 必須分別測
- partial answer 不得 final
- retry 必須 re-read latest PageContext
- privacy / accessibility / reference boundary regression 必須補齊
- interrupted / timeout / error-after-partial / unknown event 必須有測試
- retry / resend latest `PageContext` 必須有測試
- privacy / accessibility / reference boundary regression 必須在 Final Phase 驗證

## Final Validation Checklist

- [ ] constitution compliance confirmed
- [ ] spec.md coverage confirmed
- [ ] design.md coverage confirmed
- [ ] plan.md Phase 0～8 coverage confirmed
- [ ] User Story Coverage US1～US9 confirmed
- [ ] backend contract compliance confirmed
- [ ] UI reference implementation boundary confirmed
- [ ] production modules do not directly import / copy / move `docs/reference/legacy-chatbot-widget/raw/`
- [ ] no public chatbot semantics
- [ ] no lead / handoff
- [ ] no phone / email / contact-us / customer-service copy
- [ ] no localStorage session token primary strategy
- [ ] no `/history` endpoint
- [ ] no `order=desc`
- [ ] no `hasMore`
- [ ] no `tool_failed` final state
- [ ] `tool_failure` only appears as `NoAnswerReason` with `answerDecision=no_answer`
- [ ] no inline approval
- [ ] ApprovalRequest remains display-only
- [ ] ApprovalRequest state is `approvalRequestId`-keyed or message-level, not single global `approvalStatus`
- [ ] no raw evidence / raw tool output / full document text displayed
- [ ] no evidence fabrication for `string[] evidenceRefs`
- [ ] latest PageContext is read on send
- [ ] latest PageContext is re-read on retry / resend
- [ ] default session scope strategy `entity > page > global` is implemented
- [ ] host app override for session scope is respected
- [ ] `sessionStorage` fallback stores only minimal sessionId continuity
- [ ] history uses `GET /api/v1/assistant/sessions/:sessionId/messages`
- [ ] history pagination uses `nextCursor`
- [ ] send message request is JSON
- [ ] send message response is SSE
- [ ] SSE final state only comes from `final.data.answerDecision`
- [ ] partial answer is never promoted to final
- [ ] error event is never treated as answered
- [ ] unknown SSE event has safe fallback
- [ ] cancel stream does not cancel ActionDraft
- [ ] cancel stream does not affect ApprovalRequest display-only state
- [ ] feedback uses backend API and links `messageId` / `requestId`
- [ ] frontend does not create `ReviewItem`
- [ ] ActionDraft confirm supports `idempotencyKey`
- [ ] `pending_execution_guard` is not shown as side-effect completed
- [ ] contract fixtures cover answered / clarification / no_answer / tool_failure / permission_denied / confirmation_required / approval_required / escalation_required / interrupted / unknown event / history pagination
- [ ] component tests cover `ChatWidget` / `ChatPanel` / `ChatMessageArea` / `ChatInputBar` / message items / safe state message renderers
- [ ] accessibility baseline covers keyboard / focus / ARIA / live region
- [ ] privacy guards prevent sensitive payload persistence or logging
- [ ] host integration public API is documented
- [ ] host app embedding guide is documented
- [ ] PageContext examples cover list / detail / selectedRows / filters / visibleColumns / entity / page / global
- [ ] identity headers handoff is documented
- [ ] onOpenApprovalDetail integration is documented
- [ ] host theme / layout integration checklist is documented
- [ ] demo host / playground plan is documented
- [ ] host integration acceptance checklist is documented
- [ ] host app can mount panel in embedded mode
- [ ] host app can mount panel in launcher mode
- [ ] host app can provide context ready / not ready state
- [ ] host app can provide latest PageContext at send time
- [ ] host app can provide identity headers without frontend permission decisions
- [ ] host app can override session scope
- [ ] host-managed sessionId flow is documented
- [ ] onOpenApprovalDetail missing / failed state is safe
- [ ] theme / layout constraints are validated for narrow container and focus behavior
- [ ] Testing Policy: Pragmatic TDD followed
- [ ] task IDs are unique
- [ ] no duplicated Txxx task IDs
- [ ] contract-sensitive logic has test-first or same-batch tests
- [ ] core pure functions have unit tests
- [ ] API / SSE / history have contract tests
- [ ] UI components have behavior-focused component tests
- [ ] store / orchestration flows have state transition tests
- [ ] docs-only integration tasks are validated by acceptance checklist
- [ ] no pixel-perfect TDD requirement was introduced
- [ ] Nuxt 4 project initialization covered
- [ ] Phase 0 contains executable project initialization tasks, not only planning docs
- [ ] Nuxt UI setup covered
- [ ] Tailwind CSS v4 setup covered
- [ ] Pinia setup covered
- [ ] vee-validate setup covered
- [ ] Vitest setup covered
- [ ] Vue Test Utils setup covered
- [ ] Playwright setup covered
- [ ] `app/features/assistant/components/` used
- [ ] `app/features/assistant/composables/` used
- [ ] `app/services/index.ts` is the only HTTP client
- [ ] `app/services/api/assistant.ts` is the single assistant domain service
- [ ] `AssistantService` methods covered
- [ ] Phase 3 does not depend on `AssistantService` being first created in Phase 4
- [ ] no `createChatClient` / `createAssistantClient`
- [ ] no direct `$fetch` in `services/api/assistant.ts`
- [ ] no `sessions.ts` / `messages.ts` / `feedback.ts` / `actionDrafts.ts` / `approvalRequests.ts` split
- [ ] no `app/lib/assistant/`
- [ ] no `app/components/assistant/cards/`
- [ ] no card layer
- [ ] safe states use message renderers
- [ ] `ActionDraftConfirmationMessage` used
- [ ] `ApprovalRequestDisplayMessage` used
- [ ] `DegradedMessage` / `InterruptedMessage` used
- [ ] `docs/reference/legacy-chatbot-widget/raw/` treated as UI reference implementation
- [ ] reference UI files are not directly imported / copied / moved
- [ ] reference UI visual parity checked where compatible

## Notes

- 所有 tasks 皆以暫定 Nuxt 4 路徑撰寫；若實際 source root 不同，必須先完成 Phase 0 的 source-root reconciliation。
- `docs/reference/legacy-chatbot-widget/raw/` 是 UI reference implementation。
- 可參考視覺、排版、互動節奏。
- 不可直接 import、copy、move。
- 不可沿用 public chatbot domain logic / API / session / streaming contract。
- 所有 assistant feature UI 必須落在 `app/features/assistant/components/`
- 所有 assistant feature composables 必須落在 `app/features/assistant/composables/`
- 所有 assistant API methods 必須集中在 `app/services/api/assistant.ts`
- shared HTTP client 必須是 `app/services/index.ts`
- pure logic 必須落在 `app/utils/assistant/`
- types 必須落在 `app/types/assistant/`
- `tool_failure` 只能以 `answerDecision=no_answer + noAnswerReason=tool_failure` 落地，不得建立 `tool_failed` final state。
- ApprovalRequest 僅能 display-only；不得在任何 task 中引入 inline approve / reject / cancel。
- `string[] evidenceRefs` 只能顯示 safe chip / id，不得補造 `title`、`snippet`、`sourceType`、document content、raw evidence、raw tool output、full document text。
- cancel stream 不等於 cancel ActionDraft；ApprovalRequest 也不可被 stream cancel 影響。
