# Design: Internal Assistant Embedded Chat Panel

## 1. Overview

本文件描述 `001-internal-assistant-embedded-chat-panel` 的前端技術設計，用於支撐後續 `plan.md`、`tasks.md` 與實作批次。

本 feature 的 frontend architecture / module boundary / naming / reference UI boundary 已收斂於 Spec Kit 文件；`design.md`、`plan.md`、`tasks.md` 為正式規格來源，不再依賴第二套 `docs/architecture/internal-assistant/*` 架構文件。

本 feature 是企業內部後台 AI 助理的 embedded chat widget / chat panel，不是 public chatbot，不是客服 widget，不是 lead capture，不是 customer handoff flow，不是 backend assistant core，不是真實 connector layer，也不是 approval management UI。

本 design 採用：

- `contract-first + reference-guided UI implementation`

核心意思如下：

- backend assistant contract 是 API、SSE、session、history、AnswerDecision、evidence、feedback、ActionDraft、ApprovalRequest 行為的唯一依據。
- `docs/reference/legacy-chatbot-widget/raw/` 與需求文字中提到的 `docs/references/` 內 UI components，是本 feature 的 UI reference implementation，用於對齊 widget shell、panel layout、message list 節奏、input composer 行為、streaming placeholder、user / assistant bubble layout、feedback affordance 等視覺與互動體驗。
- 雖然資料夾名稱包含 `legacy`，但在本 feature 中它只代表 UI 參考實作來源，不代表本專案要進行舊專案 migration，也不代表可直接沿用其 domain logic、API contract、session model 或 streaming contract。
- reference UI files 不是 production source，不可直接 import，不可直接 copy / move 成正式程式碼。
- 正式實作必須依照本 design 的 Nuxt 4 feature-local 架構、backend assistant API contract handoff 與 internal-only product boundary 重新建立。
- 當 reference UI 與 internal assistant contract 衝突時，一律以 backend contract 與本 design 的 internal-only product boundary 為準。

本 design 的固定原則：

- Backend is source of truth
- SSE-first
- Contract-driven
- Secure-by-default
- Host-app agnostic
- Embeddable and accessible
- Reference-guided UI implementation without carrying over public chatbot semantics
- Testable with mock fixtures

## 2. Scope and Non-goals

本 feature 只做：

- internal assistant embedded chat widget / chat panel 核心功能
- host app 嵌入 chat panel
- right-bottom floating launcher / toggleable chat panel
- host context provider
- session create / restore / history
- message send
- SSE streaming
- AnswerDecision rendering
- evidence display
- clarification / no-answer / permission-denied / tool-failure safe states
- message-level feedback
- ActionDraft confirmation
- ApprovalRequest display-only
- degraded / interrupted / retry UX

本期不做：

- admin dashboard
- conversation management
- feedback management
- approval queue management
- knowledge management
- public chatbot
- lead form
- customer handoff
- anonymous visitor session
- backend connector / RAG / LLM / tool execution

## 3. 技術棧（Tech Stack）

| 類別 | 技術 |
|---|---|
| 框架 | Nuxt 4 |
| UI 元件庫 | Nuxt UI |
| 樣式系統 | Tailwind CSS v4 |
| 語言 | TypeScript |
| 狀態管理 | Pinia |
| 表單驗證 | vee-validate |
| 串流 | SSE（Server-Sent Events） |
| 測試 | Vitest + Vue Test Utils + Playwright |

## 4. 技術棧使用原則

- Nuxt UI：一般 UI 優先使用 Nuxt UI 元件。
- Tailwind CSS v4：負責 layout、spacing、responsive、狀態樣式與局部視覺調整。
- TypeScript：以 backend assistant contract-first types 為核心。
- Pinia：只用於跨元件共享狀態，例如 assistant widget state、session / message state。
- vee-validate：本期 chat widget 不主動建立複雜表單，但保留為後續表單標準。
- SSE：採 `fetch + ReadableStream`；不以 `EventSource` 為必要前提。
- Vitest：測 pure logic、parser、mapper、store、contract-sensitive functions。
- Vue Test Utils：測 component behavior，不以 pixel-perfect snapshot 作為主要策略。
- Playwright：用於關鍵 embedded flow、host playground、e2e smoke。

本期不引入以下技術使用方向：

- admin table 公版
- dashboard chart
- knowledge management UI
- conversation management UI
- public lead / handoff form standard

## 5. Project Initialization Baseline

此章節定義後續 implementation phase 的初始化基準，避免 plan / tasks 對 Nuxt 4 專案基線做不一致假設。

初始化基準至少包含：

- Nuxt 4 project initialization
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

建議 scripts 至少包含：

- `dev`
- `build`
- `preview`
- `typecheck`
- `test`
- `test:unit`
- `test:component`
- `test:contract`
- `test:e2e`
- `lint`

補充規則：

- `nuxt.config.ts` 應納入 Nuxt UI、Pinia、測試與 runtime config 基礎設定。
- `app.config.ts` 應提供 widget / theme / host integration 可用的最小前端設定基底。
- `layouts/default.vue` 為本期 embedded widget / panel 的最小掛載 layout。
- `error.vue` 為 Nuxt 全域錯誤頁基準。
- lint strategy 依 repo 既有設定；若尚未存在，後續 implementation phase 再確認是否新增或沿用。

## 6. 整體前端架構

本專案採 Nuxt 4 單一前端專案。

本 feature 只實作 internal assistant embedded chat widget / chat panel。

assistant widget 採 feature-local 組織方式，專屬 UI 與專屬 orchestration composables 放在 `app/features/assistant/`。

跨 domain 共用 UI / composables 不混入 assistant 專屬業務邏輯。

API 串接統一透過 `app/services/index.ts` 與 `app/services/api/assistant.ts`。

目前 repo 已確認使用 `app/` 作為正式 production source root，後續實作與文件收斂皆以此結構為準；不得透過額外 architecture memo 建立平行規格。

建議目錄結構如下：

```txt
app/
├── assets/
│   └── css/
├── composables/
├── features/
│   └── assistant/
│       ├── components/
│       └── composables/
├── layouts/
├── pages/
├── services/
│   ├── index.ts
│   └── api/
│       └── assistant.ts
├── stores/
│   └── assistant/
├── utils/
│   └── assistant/
├── types/
│   └── assistant/
└── error.vue
```

## 7. Project Structure and Layer Responsibilities

| 層級 | 職責 |
|---|---|
| `pages/` | 路由對應頁面，只做資料組裝與 layout 編排，不含商業邏輯 |
| `features/assistant/` | assistant chat widget 專屬 UI、message renderers、feature-local composables，只服務本 feature |
| `composables/` | 跨 domain 共用邏輯，例如 `useAppToast`、`useFormat`、`useModal`、`useAppState` |
| `services/index.ts` | 專案統一 HTTP client 公版，封裝 baseURL、headers、params/body、error handling、HTTP methods、raw/stream request 能力 |
| `services/api/assistant.ts` | assistant domain API 呼叫封裝，對應 backend assistant API，不含 UI 邏輯 |
| `stores/` | 跨元件共享的持久狀態，例如 assistant session / message / widget state |
| `utils/` | 純函數工具，例如 format、type guard、mapper、sanitizer、parser helper |
| `types/` | TypeScript type / interface 定義 |

固定規則：

- `pages/` 不放 assistant 子元件。
- `components/` 不放 assistant 專屬 UI。
- `composables/` 不放 assistant 專屬 orchestration。
- `features/assistant/` 才是 assistant widget 專屬 UI 與 feature-local composables 的位置。

## 8. Assistant Feature Architecture

assistant feature-local 架構固定使用：

```txt
app/features/assistant/components/
app/features/assistant/composables/
```

### 8.1 components

`app/features/assistant/components/` 放 assistant widget 專屬 UI：

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

固定規則：

- 本 feature 不建立獨立 card layer。
- 不使用 `app/components/assistant/cards/`。
- `ChatMessageArea` 保留 message registry / message renderer pattern。
- 這些 renderer 是 assistant widget 內部訊息狀態呈現，不是全域 Card component，也不是獨立 card layer。

### 8.2 composables

`app/features/assistant/composables/` 放 assistant feature-local orchestration：

- `useChat`
- `useAssistantSession`
- `useAssistantSseStream`
- `useAssistantHostContext`
- `useAssistantHostContextAdapter`

責任如下：

- `useChat`：send / retry / cancel / orchestration
- `useAssistantSession`：create / restore / history / restart
- `useAssistantSseStream`：SSE lifecycle、`AbortController`、timeout、interrupted
- `useAssistantHostContext`：取得 latest host context
- `useAssistantHostContextAdapter`：demo / test fallback

全域 `app/composables/` 只放跨 domain composables，例如：

- `useAppToast`
- `useModal`
- `useFormat`
- `useAppState`
- `useConfirm`

## 9. UI 參考實作指引

`docs/reference/legacy-chatbot-widget/raw/` 內的 UI components 視為本 feature 的視覺與互動參考來源，用於對齊 widget shell、panel layout、message list 節奏、input composer 行為、streaming placeholder、user / assistant bubble layout、feedback affordance 等體驗。

這些檔案不是 production source，不得直接 import、copy 或 move 到 `app/features/assistant/`。正式元件必須依照本 design 的 Nuxt 4 feature-local 架構重新建立。

reference UI 只負責指引排版、視覺與互動節奏；session、history、SSE、AnswerDecision、evidence、feedback、ActionDraft、ApprovalRequest 等行為一律以 backend assistant contract 為準。

| Reference file | UI / interaction aspect to mirror | Must adapt for internal assistant | Target module | Do not carry over | Implementation note |
|---|---|---|---|---|---|
| `ChatWidget.vue` | widget root、launcher / panel 切換、open / close transition、外層尺寸感 | 作為嵌入 host app 的右下角 floating launcher widget，預設關閉 panel，並使用 internal assistant wording | `app/features/assistant/components/ChatWidget.vue` | public copy、inline panel mode、客服語意、anonymous visitor assumptions | 以 reference shell 節奏對齊 UI；`embedded` 只表示 host integration，MVP presentation 固定為 floating launcher |
| `ChatPanel.vue` | panel header / body / footer 分層、scroll region、input 固定位置 | 建立由 launcher 控制的 floating dialog，header 顯示 context summary / degraded status / host theme token | `app/features/assistant/components/ChatPanel.vue` | inline region、phone / email / contact-us、客服 disclaimer、public customer service info bar | 對齊 panel 結構與空間節奏，不帶入對外客服資訊列 |
| `ChatMessageArea.vue` | message registry、auto-scroll、empty state layout、message list rhythm | message renderer 依 `AnswerDecision` / `noAnswerReason` / ActionDraft / ApprovalRequest / degraded state 決定 | `app/features/assistant/components/ChatMessageArea.vue` | lead / handoff / public fallback message types | 保留 registry pattern 與訊息節奏，行為映射一律依 internal assistant contract |
| `ChatInputBar.vue` | textarea、send / cancel、Enter / Shift+Enter、disabled / loading interaction | disabled state 由 context / session / streaming / degraded / confirmation state 決定 | `app/features/assistant/components/ChatInputBar.vue` | public fallback wording、customer support semantics | 對齊 composer 互動感，但 send / cancel 行為由 assistant orchestration 主導 |
| `UserMessageItem.vue` | user bubble、對齊方式、timestamp 呈現 | 對齊 `messageId` / `createdAt` / internal theme token | `app/features/assistant/components/UserMessageItem.vue` | public chatbot styling assumption | 可高度對齊視覺，但資料來源與型別依本 feature types |
| `AiStreamingItem.vue` | typing indicator、partial response bubble、cursor animation | content 由 `answer_delta` 驅動，finalization 必須等待 `final` event | `app/features/assistant/components/AiStreamingItem.vue` | token / done stream finalization、`onDone = final` | mirror streaming 體感，但 streaming terminal semantics 只能依 SSE contract |
| `AiMessageItem.vue` | assistant bubble、markdown rendering、feedback UI 外觀 | 加入 `AnswerDecision`、evidence display、backend feedback contract | `app/features/assistant/components/AiMessageItem.vue` | local-only up / down toggle、public quick replies / handoff semantics | 對齊已回答訊息的呈現外觀，feedback 與 evidence 行為需完全依 contract |
| `useChatWidgetStore.ts` | open / close / toggle 的狀態管理形態 | 只管理 `isOpen` 與 `normal / context_not_ready / degraded / unavailable` availability | `app/stores/assistant/useChatWidgetStore.ts` | embedded / launcher display mode、public fallback semantics | mirror 狀態管理形態，不把 host integration 誤建模成 UI mode |
| `useChatSessionStore.ts` | session / message / streaming state 的整理方式 | 改為 `sessionId`、history cursor、feedback、ActionDraft、ApprovalRequest display state | `app/stores/assistant/useAssistantSessionStore.ts` | lead / handoff / public quick replies / long-term local token assumptions | 只參考狀態分組方式，正式 state shape 依本 design 重建 |
| `useChatSession.ts` | create / restore / restart orchestration 節奏 | 改為 host-managed sessionId priority、`sessionStorage` scoped fallback、history asc restore | `app/features/assistant/composables/useAssistantSession.ts` | localStorage token model、`/history` assumptions、full local history restore | mirror 互動節奏；session / history 規則完全依 backend contract |
| `useStreaming.ts` | cancel、timeout、interrupted、streaming placeholder update 的使用者體驗 | SSE lifecycle 重建為 assistant event union；final state only from `final.data.answerDecision` | `app/features/assistant/composables/useAssistantSseStream.ts` + `app/utils/assistant/assistantSseParser.ts` | token / done event contract、`onDone` finalization | mirror streaming UX，邏輯則依 parser 與 stream controller 分層重建 |
| `useChat.ts` | send / retry / cancel orchestration 的互動順序 | send 前讀 latest `PageContext`、ensure session、generate `requestId`、用 backend feedback API | `app/features/assistant/composables/useChat.ts` | local-only feedback toggle、public quick replies guidance、stream close as terminal state | 只參考 orchestration 節奏，不沿用舊 domain logic |

## 10. Reference Alignment Summary

### 10.1 可對齊的 UI / interaction concepts

- widget open / close / toggle state
- panel shell layout
- message list 與 auto-scroll
- user bubble
- assistant bubble 的基本視覺結構
- streaming placeholder / typing indicator
- input composer
- send / cancel / retry interaction
- message registry pattern
- basic feedback UI appearance

### 10.2 必須依 internal assistant contract 重建的行為

- `sessionToken` → `sessionId`
- localStorage token restore → host-managed sessionId priority + `sessionStorage` scoped fallback
- simple token stream → contract-driven SSE event union
- `onDone` finalization → `final.data.answerDecision`
- local up / down feedback → backend message-level feedback contract
- quick replies → internal prompt suggestions，不再承擔 lead / customer-support guidance
- public fallback mode → internal assistant `context_not_ready / degraded / unavailable`

### 10.3 不得帶入的 semantics

- lead form
- public customer handoff
- customer support contact flow
- public chatbot fallback copywriting
- anonymous visitor assumptions
- lead capture quick replies
- public customer service disclaimer
- localStorage 長期敏感 session strategy
- inline panel presentation assumptions

## 11. API Service Architecture

本期採用：

```txt
app/services/index.ts
app/services/api/assistant.ts
```

不拆成：

```txt
sessions.ts
messages.ts
feedback.ts
actionDrafts.ts
approvalRequests.ts
```

原因如下：

- session、message、feedback、ActionDraft、ApprovalRequest 都屬於同一個 assistant domain。
- 本期使用單一 `assistant.ts` 更符合 domain service 的維護方式，也避免 API service 檔案過度拆分。

### 11.1 `app/services/index.ts`

`app/services/index.ts` 定義為唯一 HTTP client 公版。

設計原則：

- 統一 baseURL
- 統一 default headers
- 支援 extra headers merge
- 支援 GET params / non-GET body
- 支援一般 JSON request
- 支援 raw `Response` / SSE stream request
- 支援 `AbortSignal`
- 支援 silent / safe error mode，避免 chat widget 所有錯誤都被全域 toast 直接打斷
- 統一 error envelope handling

建議 HTTP methods：

- `get()`
- `post()`
- `put()`
- `patch()`
- `delete()`
- `request()`
- `rawRequest()`
- `stream()`

明確禁止：

- 新增 `createChatClient`
- 新增 `createAssistantClient`
- domain service 直接 import `$fetch`
- domain service 自行建立第二套 baseURL / error handler

### 11.2 `app/services/api/assistant.ts`

`app/services/api/assistant.ts` 定義為單一 assistant domain service。

建議 class：

- `AssistantService`

建議 methods：

- `createSession()`
- `getSession()`
- `getSessionMessages()`
- `sendMessageStream()`
- `submitFeedback()`
- `getActionDraft()`
- `confirmActionDraft()`
- `cancelActionDraft()`
- `getApprovalRequest()`

固定規則：

- `assistant.ts` 只負責 backend assistant API 呼叫。
- `assistant.ts` 不操作 UI state。
- `assistant.ts` 不做 permission decision。
- `assistant.ts` 不解析 final `AnswerDecision`。
- `assistant.ts` 不決定 message renderer。
- `assistant.ts` 不持久化 session。
- `assistant.ts` 不保存 raw evidence / raw tool output。

path 規則：

- Contract docs / tests 使用完整 backend endpoint：`/api/v1/assistant/sessions`
- service implementation 使用相對於 HTTP client baseURL 的 path：`assistant/sessions`
- 前提是 HTTP client baseURL 已設定為 `/api/v1`
- contract tests 必須驗證 resolved request URL / method / headers 與 backend contract 對齊

## 12. Host Integration Design

`AssistantHostContextProvider / HostAdapter` 是正式嵌入模式。

`props adapter` 只作 demo / test fallback。

每次 send / retry 前必須重新讀取 latest `PageContext`。

前端不使用 `PageContext` 做 permission decision。

`PageContext` 必須 sanitize，只能包含 visible、non-secret summary。

Host context 來源應支援：

- actor
- organization
- host app
- route
- `screenId`
- `entityType`
- `entityId`
- `selectedRows`
- `activeFilters`
- `visibleColumns`
- `userVisibleState`
- session scope
- host-managed sessionId
- `onOpenApprovalDetail`
- identity headers

identity headers 與 request metadata 應由 `useAssistantHostContext` / host provider 收集後交給 service request options，透過 `app/services/index.ts` 的 extra headers merge 傳遞。

## 13. Session and History Design

session restore priority 固定為：

```txt
1. host-managed sessionId
2. sessionStorage fallback by SessionScopeKey
3. create new session
```

history contract 固定為：

```txt
GET /api/v1/assistant/sessions/:sessionId/messages
limit
cursor
order=asc
nextCursor
```

明確禁止：

- `/history`
- localStorage token as primary session strategy
- `hasMore`
- `order=desc`
- full history local cache
- raw evidence / raw tool output persistence

session storage 規則：

- 只保存 `sessionId`
- 可保存最小 UI continuity state
- 不保存完整 message history
- 不保存 tool result
- 不保存 evidence payload
- 不保存 prompt
- 不使用 localStorage 長期保存敏感內容

## 14. Message Sending and SSE Streaming Design

### 14.1 Request

```txt
POST /api/v1/assistant/sessions/:sessionId/messages
Request Content-Type: application/json
Request Accept: text/event-stream
Response Content-Type: text/event-stream
```

request body 必須包含：

- `message`
- latest `pageContext`

headers 必須包含或由 host app 提供：

- `x-request-id`
- `x-actor-id`
- `x-organization-id`
- `x-host-app`
- `x-role`
- `x-permission-scopes`

### 14.2 SSE 分層

責任分界如下：

`app/services/api/assistant.ts`

- `sendMessageStream()`
- 建立 `POST assistant/sessions/:sessionId/messages` request
- request body 是 JSON
- request headers 包含 `Accept: text/event-stream`
- 回傳 raw `Response` 或 `ReadableStream`
- 不解析 SSE final state

`app/features/assistant/composables/useAssistantSseStream.ts`

- `AbortController`
- timeout
- interrupted
- error-after-partial
- stream lifecycle
- 呼叫 `AssistantService.sendMessageStream()`

`app/utils/assistant/assistantSseParser.ts`

- parse SSE event union
- `sequence` ordering / de-dup
- unknown event safe fallback
- final state only from `final.data.answerDecision`

`app/features/assistant/composables/useChat.ts` + `app/stores/assistant/`

- 根據 parsed events 更新 message state
- append `answer_delta`
- attach evidence
- handle `confirmation_required`
- handle `approval_required`
- handle `escalation_required`
- handle `final`

明確禁止：

- 在 `assistant.ts` 裡直接把 stream close 當 final
- 在 `assistant.ts` 裡解析 `AnswerDecision` UI state
- 用 `onDone` / stream close / answer presence 推測 final
- 建立 `tool_failed` final state
- 使用 token / done public chatbot SSE contract

assistant SSE event contract 必須保留：

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

## 15. Store Design

store 設計固定落在：

```txt
app/stores/assistant/
```

建議至少保留：

- `app/stores/assistant/useChatWidgetStore.ts`
- `app/stores/assistant/useAssistantSessionStore.ts`

責任如下：

`useChatWidgetStore`

- open / close / toggle
- panel availability

`useAssistantSessionStore`

- `sessionId`
- `messages`
- `nextCursor`
- `streamingState`
- `activeRequestId`
- `activeAssistantMessageId`
- `feedbackStates`
- ActionDraft state
- ApprovalRequest display state
- `degradedState`
- `contextReady`
- `lastError`

固定規則：

- Pinia store 可引入 `AssistantService`，但不直接操作 `$fetch`
- Pinia store 主要負責 state 與 mutation actions
- send / retry / cancel / ensure session / stream orchestration 優先放在 `app/features/assistant/composables/useChat.ts` 與 `useAssistantSession.ts`

明確禁止：

- store 直接拼 API path
- store 直接使用 `$fetch`
- store 做 permission decision
- store 保存 raw evidence / raw tool output / full prompt
- store 處理 SSE parser 細節

## 16. Utils / Types / Libs / Plugins Design

### 16.1 `app/utils/assistant/`

放 assistant pure logic：

- `pageContextSanitizer`
- `defaultSessionScopeResolver`
- `sessionScopeKeyGenerator`
- `requestIdGenerator`
- `assistantSseParser`
- `answerDecisionStateMapper`
- `evidenceNormalizationAdapter`

### 16.2 `app/types/assistant/`

放 assistant types：

- `contracts.ts`
- `ui.ts`
- `evidence.ts`
- `actions.ts`
- `host-context.ts`
- `identity-headers.ts`
- `envelopes.ts`

### 16.3 `app/plugins/`

放全域第三方 library 初始化，例如：

- Pinia / Nuxt module setup
- vee-validate global rule setup
- global toast plugin if needed

### 16.4 `app/libs/`

放非全域套件設定或局部 library wrapper，需要由使用處明確 import，例如：

- markdown renderer wrapper
- SSE `ReadableStream` helper if generic

明確禁止放入：

- `assistantApiClient`
- `useChat`
- `assistantSessionStore`

本專案不使用 `app/lib/assistant/`。

assistant API 串接放 `app/services/api/assistant.ts`。

assistant pure logic 放 `app/utils/assistant/`。

assistant types 放 `app/types/assistant/`。

assistant stores 放 `app/stores/assistant/`。

assistant feature UI / orchestration 放 `app/features/assistant/`。

## 17. Message Rendering and AnswerDecision Design

`ChatMessageArea` 保留 message registry / renderer pattern。

固定規則：

- `ChatMessageArea` 根據 message type、`answerDecision`、`noAnswerReason`、ActionDraft state、ApprovalRequest state 選擇對應 renderer。
- 本 feature 不建立獨立 card layer。
- UI 採 message renderers / message state components，而不是全域 card system。

必須支援：

- answered assistant message
- streaming message
- clarification message
- no-answer message
- permission denied message
- tool failure message
- evidence display
- ActionDraft confirmation message
- ApprovalRequest display-only message
- escalation message
- degraded / interrupted / timeout message
- session recovery message

AnswerDecision 固定規則：

- `tool_failure = answerDecision no_answer + noAnswerReason tool_failure`
- 不存在 `tool_failed` final state
- final state only from `final.data.answerDecision`

## 18. Evidence / Feedback / ActionDraft / ApprovalRequest Design

### 18.1 Evidence

- `evidenceRefs` 支援 `string[] | EvidenceRefSummary[]`
- `string[] evidenceRefs` 只能顯示 safe chip / id
- 不得補造 `title` / `snippet` / `sourceType` / document content
- 不得顯示 raw evidence / raw tool output / full document text

### 18.2 Feedback

feedback 使用 backend API：

```txt
POST /api/v1/assistant/messages/:messageId/feedback
```

feedback 必須關聯：

- `messageId`
- `requestId`
- `rating`
- `intent`
- `reason?`
- `comment?`

### 18.3 ActionDraft

- 支援 `confirmation_required`
- 支援 ActionDraft detail / confirm / cancel
- confirm 必須支援 `idempotencyKey`
- `pending_execution_guard` 不得顯示為 side-effect completed
- cancel stream 不等於 cancel ActionDraft

### 18.4 ApprovalRequest

- `approval_required` 只做 display-only
- 顯示 `approvalRequestId` / status / `riskLevel` / action summary / safe evidence
- 提供 `onOpenApprovalDetail` callback
- 不顯示 approve / reject / cancel controls
- 不實作 approval management UI
- cancel stream 不影響 ApprovalRequest display state

## 19. Layout Strategy

`layouts/default.vue`：

- 極簡 layout，提供 host-embedded floating assistant widget 掛載點，不含後台導覽

`layouts/admin.vue`：

- 後續後台資料管理 feature 預留，含左側導覽列、topbar、主內容區
- 本 feature 不實作 `admin.vue` 內容

`error.vue`：

- 全域錯誤頁，處理 `404 / 500`

固定規則：

- 本 feature 僅實作 `default` layout 下的 host-embedded floating chat widget
- `admin.vue` 僅作為後續 admin feature 的預留設計，不應被本期 plan / tasks 實作

## 20. Route / Entry Strategy

本期只規劃：

- `/` 或 `/chat`：assistant widget demo / local test entry
- `/playground/internal-assistant-host`：host integration playground，可先作為設計規劃；是否實作由後續 plan / tasks 決定

明確排除：

- `/admin/dashboard`
- `/admin/knowledge`
- `/admin/conversations`
- `/admin/leads`
- `/admin/tickets`
- `/admin/feedback`
- `/admin/approval-requests`
- `/admin/audit`
- `/admin/widget-settings`

理由如下：

- 這些是未來管理後台 features，不屬於本期 embedded chat panel

## 21. Error, Retry, and Degraded State Design

必須涵蓋：

- context provider not ready
- session create failed
- session restore failed
- session invisible / expired / closed
- history cursor invalid
- send message failed before stream
- stream interrupted before final
- timeout waiting for final
- error event after partial answer
- backend degraded
- feedback failed
- action draft confirm / cancel failed
- approval detail load failed
- unknown SSE event

處理策略：

- **可 retry**
  - send message failed before stream
  - stream interrupted before final
  - timeout waiting for final
  - error event after partial answer
  - feedback failed
  - approval detail load failed
- **需 start new session**
  - session invisible / expired / closed
  - restore target not found after fallback clear
- **只能停在 safe terminal state**
  - permission denied
  - `no_answer + no_evidence / evidence_conflict / tool_failure`
  - `escalation_required`
  - `approval_required` display-only
- **需顯示 not-ready / degraded**
  - context provider not ready
  - backend degraded
  - unknown SSE event 不可中斷整體 UI，但需記錄 safe fallback 狀態

## 22. Data Privacy and Storage Design

固定策略：

- `sessionStorage` fallback 只保存 `sessionId` 與最小 UI continuity state
- 不保存完整 history
- 不保存 tool result
- 不保存 raw evidence payload
- 不保存 full document text
- 不保存完整 prompt
- 不得使用 localStorage token 作為 primary session strategy
- 不保存 connector secret / OpenAI key / backend credential
- 不將 sensitive data 放入 URL query
- 不將 sensitive payload 寫入 console log / analytics
- mock fixtures 必須使用 synthetic 或 de-identified data
- `PageContext` 必須 sanitized
- `selectedRows` / `activeFilters` / `userVisibleState` 必須只包含 visible、non-secret summary

## 23. Testing Strategy

### 23.1 Vitest

Vitest 用於：

- `app/utils/assistant` pure logic
- `app/stores/assistant` state transition
- `assistantSseParser`
- `answerDecisionStateMapper`
- `evidenceNormalizationAdapter`
- session scope resolver
- requestId generator

### 23.2 Vue Test Utils

Vue Test Utils 用於：

- `app/features/assistant/components` behavior tests
- `ChatWidget` / `ChatPanel` / `ChatMessageArea` / `ChatInputBar`
- message renderers
- no forbidden controls

### 23.3 Contract tests

Contract tests 用於：

- `app/services/api/assistant.ts`
- history endpoint / `order=asc` / `nextCursor`
- send message request JSON + response SSE
- feedback / ActionDraft methods

### 23.4 Playwright

Playwright 用於：

- host-embedded floating launcher smoke
- open panel / send / stream / retry / degraded

固定規則：

- 不要求 pixel-perfect TDD
- contract-sensitive logic 必須 test-first 或同批完成 tests

## 24. Backend Assistant Core Contract Guardrails

後續實作不得偏離以下 backend assistant core contract guardrails：

- session create / get / history / send-message / feedback / ActionDraft / ApprovalRequest 的 API surface 只能以 backend handoff 為準。
- 不得自行發明 `sessions.ts`、`messages.ts`、`feedback.ts`、`actionDrafts.ts`、`approvalRequests.ts` 等額外 contract source。
- send message request body 是 JSON，response 是 SSE，不得把 `text/event-stream` 誤寫成 request body content type。
- final state 只看 `final.data.answerDecision`。
- `tool_failure` 只能作為 `NoAnswerReason`，不得建立 `tool_failed` final state。
- `evidenceRefs` 只能依 `string[] | EvidenceRefSummary[]` 處理，不得補造 raw evidence detail。
- history 只能使用 `GET /api/v1/assistant/sessions/:sessionId/messages`、`order=asc`、`nextCursor`。
- 不得新增 `/history`、`order=desc`、`hasMore`、raw evidence detail endpoint 假設、inline approval contract 假設。
- ApprovalRequest 在本期只能 display-only，不得把未來 approval-management feature 的 endpoint 或 action 語意帶入本期 UI。
- assistant frontend 不得直接呼叫 OpenAI / LLM provider / RAG / connector / tool execution engine。

如 reference UI 的視覺與互動節奏與 backend assistant contract 發生衝突，一律以 backend contract 與本 design 的 internal-only product boundary 為準。

## 25. Assumptions / Contract Boundaries

- backend contract handoff 是唯一 API surface source
- history endpoint 是 `GET /api/v1/assistant/sessions/:sessionId/messages`
- history 只支援 `order=asc`
- `nextCursor` 是 pagination indicator
- 沒有 `hasMore`
- send message request 是 JSON
- send message response 是 SSE
- SSE final state 只看 `final.data.answerDecision`
- SSE event 有 `requestId` / `sessionId` / `messageId` / `eventType` / `sequence`
- `tool_failure` 是 `NoAnswerReason`，不是 `AnswerDecisionStatus`
- `evidenceRefs` 可能是 `string[]` 或 `EvidenceRefSummary[]`
- ApprovalRequest operation endpoints 屬 future approval-management feature
- raw evidence / raw tool output / full document text 不在 frontend UI contract 中
- reference UI files 只能在其概念符合 internal assistant 行為時作為互動參考，不可直接作為 production source
- public chatbot / lead / handoff / customer support 概念不得被帶入本 feature
- repo 已確認使用 Nuxt 4 的 `app/` 作為正式 production source root；assistant module boundary 固定為 `app/features/assistant/`、`app/stores/assistant/`、`app/utils/assistant/`、`app/types/assistant/` 與 `app/services/api/assistant.ts`
- constitution 目前仍出現 `tool_failed` 文字，但 backend handoff 與已通過 spec 明確要求 internal assistant frontend 只能以 `no_answer + noAnswerReason = tool_failure` 呈現 tool failure；本 design 以 handoff + 已通過 spec 的 contract semantics 為實作依據

## 26. Follow-up Impact on plan.md and tasks.md

後續修改 `plan.md` / `tasks.md` 時必須同步本 design 的 architecture decisions：

- `plan.md` / `tasks.md` 必須改路徑為 `app/features/assistant/components/`
- `plan.md` / `tasks.md` 必須改路徑為 `app/features/assistant/composables/`
- `plan.md` / `tasks.md` 必須改 API service 為 `app/services/api/assistant.ts`
- `plan.md` / `tasks.md` 必須保留 `app/services/index.ts` 作為唯一 HTTP client
- `plan.md` / `tasks.md` 必須改 pure logic 為 `app/utils/assistant/`
- `plan.md` / `tasks.md` 必須改 types 為 `app/types/assistant/`
- `plan.md` / `tasks.md` 必須改 stores 為 `app/stores/assistant/`
- `plan.md` / `tasks.md` 必須移除 `app/lib/assistant/`
- `plan.md` / `tasks.md` 必須移除 `app/components/assistant/cards/`
- `plan.md` / `tasks.md` 必須新增 Nuxt 4 project initialization tasks
- `plan.md` / `tasks.md` 必須新增 `app/services/index.ts` setup / adaptation tasks
- `plan.md` / `tasks.md` 必須新增或保留 `app/services/api/assistant.ts` 單一 domain service tasks
- `plan.md` / `tasks.md` 必須保留 `sendMessageStream` raw `Response` / `ReadableStream` 設計
- `plan.md` / `tasks.md` 必須保留 SSE lifecycle / parser / UI state 分層
- `plan.md` / `tasks.md` 必須保留 backend contract guardrails
- `plan.md` / `tasks.md` 必須保留 ApprovalRequest display-only boundary
- `plan.md` / `tasks.md` 必須把 `docs/reference/legacy-chatbot-widget/raw/` 描述為 UI reference implementation，不得描述成 legacy migration source
- `plan.md` / `tasks.md` 必須明確禁止直接 import / copy / move reference UI files into production source

這個章節只是後續文件同步提醒，不代表本次要修改 `plan.md` 或 `tasks.md`。
