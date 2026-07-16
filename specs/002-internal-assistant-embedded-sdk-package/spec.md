# Feature Specification: Internal Assistant Embedded SDK Package

**Feature Branch**: `002-internal-assistant-embedded-sdk-package`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "將 Frontend 001 已存在的 Internal Assistant Embedded Chat Panel 封裝為可由不同 Vue 3／Nuxt 4 Host App 安裝、初始化、掛載、卸載與提供最新 Host Context 的 npm package／SDK。"

## Feature Summary

本 feature 定義一個可安裝的 Frontend SDK / package，目的是把 Frontend 001 已存在的 Internal Assistant Embedded Chat Panel 與 chat runtime 封裝為可重用的 host integration 能力，讓不同 Vue 3／Nuxt 4 Host App 能以一致方式完成安裝、初始化、掛載、卸載、提供最新 request-scoped Host Context、管理 session 邊界、接收必要 host events，並驗證 package compatibility。

本 feature 不是新的聊天產品，也不是 Frontend 001 的重寫。它不重新定義 chat runtime、assistant API client、SSE parser、session/history pipeline、AnswerDecision mapping、EvidenceRef rendering、feedback flow、ActionDraft confirmation 或 ApprovalRequest display behavior，而是把這些既有能力封裝為可安裝、可整合、可驗證的 package surface。

Frontend 002 的發布產物必須是其他 Vue 3／Nuxt 4 Host App 可安裝並使用的 SDK package。Consuming app 只能依賴 `@internal-ai-assistant/assistant-sdk` root public entry 與 `@internal-ai-assistant/assistant-sdk/styles.css` stylesheet entry；不得需要 Frontend 001 repo layout、不得 deep-import `app/features`、`app/services`、`app/stores` 或 `app/utils` 等 Frontend 001 internal path。

Frontend 002 的 public responsibility 必須拆分為三個彼此獨立的概念：

- **AssistantHostContextProvider**：只負責每次 assistant request 前重新提供最新、request-scoped 的 host context。
- **WidgetConfiguration**：只負責較穩定的 widget / package 設定，不進入 backend request payload。
- **HostCallbacks / HostEvents**：只負責 host integration callbacks 與 event payload，不進入 PageContext 或 backend transport。

Frontend 002 也必須清楚區分三個資料層次：

- **AssistantHostContextProvider**：提供 request-scoped host context，例如 `hostApp`、organization identifier、sanitized `PageContext`、host-managed `sessionId`、actor handoff metadata、permission-context handoff metadata 與 request correlation metadata；若提供 `sessionScope`，也只可作為 Frontend 002 local session ownership / namespace input，而不是 backend public request contract。
- **Frontend 002 local-only state**：例如 `sessionScope`、fallback session namespace、memory-only session pointer、widget lifecycle state、`WidgetConfiguration`、`HostCallbacks`、callback functions、UI state 與 internal retry / loading state；這些資料不得進入最終送往 backend 的 outgoing request。
- **最終送往 backend 的 outgoing request**：由 provider 提供且符合 contract 的 request-scoped context、package request builder、預設或注入的 authenticated transport，以及 Backend 001 / Backend 002 現有 public contract 所要求的 identity、permission 與 request metadata 共同形成。

Provider 中不存在某欄位，不必然代表最終送往 backend 的 outgoing request 不存在該欄位，因為可信的 authenticated transport 可能補入 backend contract 要求的 identity / permission metadata。相對地，Frontend 002 local-only state 中存在某資料，也不代表該資料可以進入最終 outgoing request。

本 feature 必須清楚區分兩種完成層級：

- **Independent Package Readiness**：Host App 已可安裝 package、提供 provider / configuration / callbacks、掛載 widget、驗證 session 與 lifecycle，且此層不依賴 Backend 002 完成。
- **Backend 002 Integration-dependent Acceptance**：Backend 完成 host-aware capability governance、PageContext policy、permission boundary、source consistency 與 Admin reference integration 後，Frontend 002 才能驗證 package 可送出符合 contract 的 sanitized context，並正確消費 backend 回傳的 clarification、permission_denied、tool_failure、permission-safe evidence、backend-derived source metadata 與 SSE final safe outcomes。

## Product Context

本專案目前已有 Frontend 001，作為內部 AI 助理聊天面板本體與 chat runtime 的來源，包含 chat widget UI、session / history、message sending、SSE parsing、AnswerDecision rendering、EvidenceRef rendering、feedback、ActionDraft confirmation、ApprovalRequest display、error / retry / interrupted behavior。

Frontend 002 的定位必須明確如下：

```text
Frontend 001
= AI 助理聊天面板本體與 chat runtime

Frontend 002
= npm package / SDK、Host App integration contract、
  package lifecycle、context provider、session isolation、
  consumer integration 與 package compatibility
```

因此 Frontend 002 的產品價值不在於新增聊天能力，而在於讓既有聊天能力可被不同內部 Host App 一致、可控且安全地安裝與使用。Frontend 002 必須承接現有 internal-only、backend-source-of-truth、secure-by-default 與 SSE-first 原則，不得把 backend permission responsibility、connector / adapter authority 或 backend-owned `sourceSystem` authority 帶到 frontend，也不得把 provider、authenticated transport 與 local-only state 的責任混為同一層。

Frontend 002 的 Backend 001 Compatibility Mode 與 Backend 002 Mode 只是 package request builder、provider validation 與 integration strictness mode。它們不是 backend request mode，也不得改變 Backend 001 / Backend 002 既有 public API、route、SSE event contract、request envelope 或 AnswerDecision contract。兩種 mode 都必須沿用同一套 assistant session / message / SSE transport ownership；Backend 001 Compatibility Mode 中，Frontend 002 專屬 Host Context 欄位必須由 package request builder / transport adapter 明確省略，不得塞入未知 backend request 欄位、hidden prompt、message text 或 metadata。

本 feature 同時受以下固定產品決策約束：

- v1 只支援 Vue 3 與 Nuxt 4。
- v1 不做 framework-agnostic SDK。
- v1 主要交付形式為 npm-compatible package、Vue component exports 與有限的 imperative mount helper。
- Web Component、iframe mode 與 Shadow DOM 不在本 feature。
- package 必須 SSR import-safe，但 widget 實際只在 client side mount。
- `AssistantHostContextProvider` 必須能在每次 request 前提供最新 context，且支援 async resolution。
- v1 預設一個 Host App page 只啟用一個 assistant widget instance。
- fallback session persistence 使用 package-scoped、host-scoped 的 `sessionStorage`，不得跨 Host App 或跨 organization 共用。
- Frontend 002 以目前 repo 內的 workspace package 交付，Frontend 001 runtime 以可重用 runtime 單元被 Frontend 002 引用；consumer 對外只安裝 Frontend 002 public package，不得 deep-import Frontend 001 internal path。
- Frontend 002 MAY 在 monorepo source-time 與 package build 階段重用 Frontend 001 canonical source；但 published / installed SDK package artifact MUST 只透過 SDK public entries 對 consumer 暴露能力，不得留下 unresolved `app/features`、`app/services`、`app/stores` 或 `app/utils` import 給 consuming app 解析，也不得為了可攜性而手寫第二套 runtime。
- theme v1 僅提供有限 CSS variables、design tokens、light / dark / system mode 與基本 panel position / size 設定；正式 stylesheet entry 為 `@internal-ai-assistant/assistant-sdk/styles.css`，由 consumer 主動 import。
- Backend 002 未完成時，Frontend 002 仍必須可 build、install、mount、提供 Host Context，並透過 Backend 001 Compatibility Mode 驗證一般聊天流程；測試可使用對齊正式 contract 的 deterministic test doubles，但這不是正式 integration mode。
- 本 feature 不定義新的 frontend authentication system；package 提供 Frontend 001 相容的預設 transport，Host App 也可注入符合固定 contract 的 low-level authenticated transport executor，但兩者都必須維持同一套最終送出的 Backend 001 / Backend 002 request 與 SSE contract，且不得形成第二套 assistant API client。Injected executor 不得改寫 assistant API route、建立第二套 SSE parser、改變 public request envelope，或繞過 package sanitization / mode validation。
- v1 package 名稱固定為 `@internal-ai-assistant/assistant-sdk`，主要 component export 為 `AssistantWidget`，imperative helper 為 `mountAssistantWidget`，v1 正式保證 locale 為 `zh-TW`。

## Clarifications

### Session 2026-07-13

- Q: 當 `sessionStorage` 不可用時，v1 的 fallback session 行為應採哪一種？ → A: 採 `memory-only fallback`，不改用 `localStorage` 或 cookie。
- Q: 在 Backend 001 Compatibility Mode 中，Frontend 002 專屬 Host Context 應如何處理？ → A: 由 transport adapter 明確省略，不進 request transport。
- Q: 當 `selectedRows` 超過 v1 上限時，package 應採哪種行為？ → A: 整體拒絕此次 context，並提示縮小選取範圍。
- Q: Frontend 002 v1 正式保證的 `selectedRows` 最大數量是多少？ → A: 20 筆。
- Q: package 與 Frontend 001 runtime contract 的相容策略應採哪一種？ → A: 採 same-version track。

### Session 2026-07-14

- Q: authenticated transport ownership 應採哪種模式？ → A: 採 Hybrid，由 package 提供 Frontend 001 相容的預設 transport，同時允許 Host App 注入符合固定 contract 的 authenticated transport executor。
- Q: 正式 integration mode 的 provider strictness 應如何區分？ → A: 採 mode-tiered strictness，正式只保留 Backend 001 Compatibility Mode 與 Backend 002 Mode；測試 doubles 不得形成第三套 provider contract。
- Q: organization identifier 缺失時的安全行為應如何定義？ → A: 採 Allow B001, strict B002；Backend 001 Compatibility Mode 中，provider 缺少 organization identifier 時不得建立 organization-scoped persistent fallback，可使用 host-managed sessionId 或 same-runtime-only memory continuity 作為 frontend continuity，但最終 outgoing request 仍必須由可信 authenticated transport 滿足 Backend 001 required identity contract；Backend 002 缺 required organization / identity context 一律 fail closed。
- Q: Frontend 001 runtime 與 Frontend 002 package 的交付關係應如何定義？ → A: 採 repo workspace package；Frontend 002 在目前 repo 內以獨立 workspace package 交付，與 Frontend 001 runtime 維持同一 release train。
- Q: Frontend 002 v1 的 approval detail callback 應包含哪些欄位？ → A: 只包含 `approvalRequestId`、`sessionId`、`messageId`。Frontend 002 不提供任何 approval detail 導航目標，Host App 依自己的 routing 與 navigation 規則處理 approval detail。
- Q: memory-only fallback 的生命週期應保證到哪個範圍？ → A: 採 same runtime only，只保證同一頁面 JS runtime 內的 continuity。
- Q: injected authenticated transport executor 的 public contract 應停在哪一層？ → A: 採 low-level executor，由 package 保有 endpoint、request shape、SSE parser、retry / cancel / error flow ownership。
- Q: v1 package delivery profile 應採哪一組決策？ → A: 採 lean mono-profile，使用 repo 內 workspace package、專用 library build、explicit stylesheet entry、現有 Nuxt app 作為 reference consumer / preview harness，並正式保證 `zh-TW`。
- Q: v1 public naming 應採哪一組名稱？ → A: 採 Assistant SDK naming，package 為 `@internal-ai-assistant/assistant-sdk`、component export 為 `AssistantWidget`、imperative helper 為 `mountAssistantWidget`。

## User Scenarios & Testing *(mandatory)*

> 以下 User Story 編號保留既有產品流程排序；`Priority` 代表商業 criticality，不代表文件必須依優先級重新編號。

### User Story 1 - 安裝並初始化 Assistant Package (Priority: P1)

Host App 工程師可以把 Frontend 002 package 安裝進 Vue 3／Nuxt 4 專案，載入 public exports、註冊必要設定並掛載 assistant widget。

**Why this priority**: 若 Host App 無法完成安裝、import、初始化與基本 mount，Frontend 002 就無法交付任何可重用價值，也無法進入後續 context、session 與 runtime 驗證。

**Independent Test**: 可在一個 Nuxt 4 reference consumer 中安裝 package，驗證 import public exports、樣式載入、SSR build、client-only mount、預設 transport 與 Host App 注入 transport 的初始化錯誤 handling，而不需要 Backend 002 已完成。

**Acceptance Scenarios**:

1. **Given** Host App 已安裝 package，**When** 工程師 import package 的 public exports，**Then** 系統必須提供穩定且最小化的 public integration surface，而不是要求複製 Frontend 001 原始碼。
2. **Given** package 被用於 SSR build，**When** Host App 執行 build 或 server-side import，**Then** package 不得因直接存取 browser globals 而失敗。
3. **Given** Host App 進入 client runtime，**When** 工程師掛載 widget，**Then** assistant widget 必須可在 client side 正常 mount，且不要求 server side render 真正的互動 widget。
4. **Given** Host App 傳入無效或不完整的初始化設定，**When** 工程師初始化 package，**Then** 系統必須回到可理解的整合錯誤狀態，而不是產生未定義行為。
5. **Given** Host App 需要以既有 authenticated request layer 送出 assistant request，**When** 工程師注入 authenticated transport executor，**Then** package 必須仍維持與預設 transport 相同的 request / SSE contract 與既有 error / retry flow，而不得形成第二套 assistant API client。

---

### User Story 2 - 提供最新 Host Context (Priority: P1)

Host App 能透過 `AssistantHostContextProvider` 提供最新的 request-scoped host context，且 widget 每次送出訊息前都會重新取得當下最新值。

**Why this priority**: Frontend 002 的核心責任不是重做聊天，而是把 Frontend 001 的 runtime 正確放進 host-aware integration contract；若 context 不是最新值，整合就會在最關鍵的邊界失真。

**Independent Test**: 可在 Host App 中分別以 Backend 001 Compatibility Mode 與 Backend 002 Mode 變更 route、entity、selectedRows、session scope 或 host-managed sessionId，驗證 provider 會在 send 前回傳符合該 mode 的最新 context，並支援 async resolution 與 provider failure；同時驗證最終送出的 Backend 001 / Backend 002 request 可由可信 authenticated transport 補入 contract-required identity / permission metadata。

**Acceptance Scenarios**:

1. **Given** Host App 已註冊 `AssistantHostContextProvider`，**When** 使用者在 route 或 entity 切換後送出新訊息，**Then** widget 必須在送出前重新取得最新 context，而不是沿用初次 mount snapshot。
2. **Given** provider 以 async 方式解析 context，**When** widget 準備送出 request，**Then** 系統必須等待最新 context 完成解析後再送出。
3. **Given** provider 解析失敗或回傳缺少必要欄位，**When** widget 要送出 request，**Then** 系統必須停止送出 request、顯示 `context unavailable` 或 `integration error`、允許使用者或 Host App 重試，且不得用過期 context 猜測後續 request。
4. **Given** package 處於不同 integration mode，**When** provider 回傳超出該 mode contract 的欄位或缺少 required 欄位，**Then** 系統必須依 mode 規則省略、拒絕或 fail closed，而不得把 WidgetConfiguration、HostCallbacks、token 或 credential 混入 provider payload；但 provider 未提供某些 authenticated identity / permission metadata 時，仍可由可信 authenticated transport 補入 Backend contract 要求的欄位。

---

### User Story 3 - 安全地處理 PageContext (Priority: P1)

Package 只接受並傳送 sanitized PageContext，不把 raw business data、token、credential 或不必要敏感資訊傳給 assistant request，也不在 frontend 複製 Backend 002 的 HostApp-specific allowlist。

**Why this priority**: Frontend 002 是 host integration boundary；若這個邊界沒有最小化與 sanitization，會直接破壞 constitution 的 secure-by-default 原則與 Backend contract 預期。

**Independent Test**: 可用包含 raw row object、敏感欄位、未允許形狀資料、route query / hash、visibleColumns hints 與超過 20 筆的 `selectedRows` 輸入，驗證 package 的 generic sanitization boundary 與 safe rejection 行為。

**Acceptance Scenarios**:

1. **Given** Host App 傳入 `selectedRows` 含 raw row payload，**When** package 準備送出 request context，**Then** 系統必須只接受 ID 或 safe summary，並拒絕傳遞 raw row object。
2. **Given** Host App 嘗試把 token、credential、secret 或 connection detail 放入 context，**When** package 驗證 PageContext，**Then** 系統必須拒絕將這些資料帶進 request、log、host event payload 或 storage。
3. **Given** Host App 提供 route query、hash、visibleColumns 或 activeFilters，**When** package 產生 sanitized context，**Then** 這些值只能以 generic、最小化、contract-allowed shape 存在，不得被當成 permission、host-specific allowlist 或 backend evidence authority。
4. **Given** Host App 提供超過 20 筆的 `selectedRows` 參照，**When** package 驗證 request context，**Then** 系統必須整體拒絕此次 context、提示縮小選取範圍，且不得靜默截斷。

---

### User Story 4 - 管理 Widget 與 Session Lifecycle (Priority: P1)

Host App 能安全管理 widget 的 initialize、mount、open、close、unmount、route/entity change、organization change、session scope change 與 session isolation。

**Why this priority**: Frontend 002 的 package 價值高度依賴 lifecycle 與 session ownership 的可預期性；若 mount/unmount、session 切換或 cleanup 不可靠，就無法被企業內部 Host App 安心採用。

**Independent Test**: 可在同一 Host App page 驗證 host-managed sessionId、fallback session、global / page / entity scope、organization isolation、session reset、duplicate mount、teardown cleanup 與 cross-host isolation。

**Acceptance Scenarios**:

1. **Given** Host App 已經提供 host-managed sessionId，**When** widget 初始化或 sessionId 被替換，**Then** 系統必須以 host-managed sessionId 為優先並切換到對應 session。
2. **Given** Host App 沒有提供 sessionId、當前 mode 允許 frontend fallback、provider 提供建立安全 namespace 所需欄位，且 `sessionStorage` 可用，**When** widget 在 browser runtime 中啟動，**Then** 系統必須使用含 package、hostApp、organization、scope 與 page/entity identity 的 `sessionStorage` fallback namespace，而不是跨 Host App 或跨 organization 共用的全域 key。
3. **Given** widget 已經 unmount、consumer app teardown 或 organization 已切換，**When** 尚有 listener、SSE、timer、observer 或 history loading 存在，**Then** 系統必須完成 cleanup，且不再更新舊 Host App state 或舊 organization state。
4. **Given** `sessionStorage` 在當前環境不可用，**When** package 需要 fallback session continuity，**Then** 系統只可在同一頁面 JS runtime 生命週期內使用 memory-only fallback，且 full reload、新 tab 或新 runtime 不得延續舊 continuity。
5. **Given** package 處於 Backend 001 Compatibility Mode 且 provider 無法提供 organization identifier，**When** Host App 也沒有提供 sessionId，**Then** 系統不得建立 organization-scoped persistent fallback，而只能使用 same-runtime-only memory fallback；但這只影響 frontend continuity，不得被視為可取代 Backend 001 既有 identity requirement。
6. **Given** package 處於 Backend 001 Compatibility Mode 且 provider 無法提供 organization identifier，**When** 可信 authenticated transport 仍能提供 Backend 001 既有 required organization identity，**Then** Backend 001 request 可以依既有 contract 繼續送出；但 transport 提供的 organization 不得被反向推導成 provider authority。
7. **Given** package 處於 Backend 001 Compatibility Mode 且最終送出的 Backend 001 request 也缺少既有 required organization identity，**When** package 準備送出 request，**Then** 系統不得送出或不得繞過既有 validation，而必須呈現既有 integration / identity error；memory-only session 與 host-managed sessionId 都不得被視為 organization proof。
8. **Given** package 處於 Backend 002 Mode 且 provider 無法提供 required organization identifier，**When** widget 準備建立或還原 session，**Then** 系統必須 fail closed、顯示 `context unavailable` 或 `integration error`、發出 `context resolution failed` event，且不得把 host-managed sessionId 視為 organization proof。

---

### User Story 5 - 重用 Frontend 001 Chat Runtime (Priority: P1)

Package 內的 assistant widget 直接重用 Frontend 001 已存在的 chat runtime，並在 Backend 001 Compatibility Mode 與 Backend 002 Mode 下維持一致的 frontend runtime 邊界。

**Why this priority**: 這是 Frontend 002 與「重做一套聊天功能」的根本差異；若無法證明 reuse boundary，Frontend 002 的產品定位就會偏離。

**Independent Test**: 可分別在 Backend 001 Compatibility Mode 與 Backend 002 Mode 驗證 session / message / SSE / history / evidence / feedback / error / retry 行為、provider strictness 與 transport ownership，並確認不存在第二套 runtime；unit / component / integration tests MAY 使用對齊正式 contract 的 fake provider、stub transport、deterministic SSE fixture 與 backend response fixture。

**Acceptance Scenarios**:

1. **Given** package 使用 Backend 001 Compatibility Mode，**When** 使用者完成一般對話流程，**Then** widget 必須沿用 Frontend 001 與 Backend 001 的既有 request shape 與 runtime 行為，且不得要求 Backend 001 接受新的 Host Integration request 欄位。
2. **Given** package 進入 Backend 001 Compatibility Mode，**When** provider 產出 Frontend 002 專屬 Host Context，**Then** 系統不得把這些欄位塞進未知 public request 欄位、使用者 message text 或 hidden prompt；在 Backend 001 Compatibility Mode 中，這些欄位必須由 transport adapter 明確省略。
3. **Given** 測試需要驗證 runtime 行為，**When** 工程師使用 fake provider、stub transport、deterministic SSE fixture 或 backend response fixture，**Then** 這些 test doubles 必須對齊正式 contract，且不得形成第三套 provider contract 或 mock-only SSE / AnswerDecision / EvidenceRef semantics。
4. **Given** Frontend 002 作為目前 repo 內的 workspace package 交付，**When** consumer 整合 assistant widget，**Then** consumer 只能安裝與使用 Frontend 002 的公開 package entry，不得 deep-import Frontend 001 internal path，且 Frontend 001 regression 會成為 Frontend 002 release gate。

---

### User Story 6 - 暴露安全的 Host Events 與 Callbacks (Priority: P2)

Host App 能接收最小必要的 host events，並透過 callbacks 開啟既有 approval detail 或處理 escalation navigation，而不暴露 raw business data、raw SSE payload 或內部 implementation object。

**Why this priority**: Host App integration 需要有限但穩定的 callback surface；若 event payload 過大、過深或帶有敏感資料，會讓 package 邊界失控。

**Independent Test**: 可驗證 open / close、session changed、answer completed、error、approval detail requested、escalation requested、context resolution failed 等事件，以及 callback exception isolation 與 approval detail 最小 payload。

**Acceptance Scenarios**:

1. **Given** widget 開啟、關閉或切換 session，**When** package 發出 host event，**Then** 事件 payload 必須最小化且不包含 raw business data、token、credential、raw prompt 或 raw SSE payload。
2. **Given** 使用者在 approval 狀態卡要求查看明細，**When** package 觸發 callback，**Then** Host App 必須能只以 `approvalRequestId`、`sessionId`、`messageId` 接手開啟既有 approval detail 頁面，而不需要 package 內建 approval management UI；package 不得自行推導、硬編碼或組裝 Host App navigation URL。
3. **Given** Host App callback 自身拋出例外，**When** package 執行 callback，**Then** widget 必須隔離該例外，不得讓整體 assistant runtime 崩潰，且 callback payload 不得被序列化進 PageContext 或 backend request。

---

### User Story 7 - 安裝到 Nuxt 4 Reference Host App (Priority: P2)

Reference consumer 可以安裝 package 並完成可執行的 package integration smoke test，用以驗證 package readiness，並清楚區分 Backend 001 Compatibility Mode 與 Backend 002 Mode。

**Why this priority**: Frontend 002 的交付物是可整合的 package；若沒有 reference consumer acceptance，就難以驗證 package 對 Host App 的真實可用性。

**Independent Test**: 可在目前 repo 的 Nuxt 4 app 作為 reference consumer / preview harness，驗證 `@internal-ai-assistant/assistant-sdk` install、`AssistantWidget` 或 `mountAssistantWidget` integration、provider registration、WidgetConfiguration、HostCallbacks、預設 transport 或注入 transport、mount / unmount、route context update、selectedRows update 與 Backend 001 Compatibility Mode flow。

**Acceptance Scenarios**:

1. **Given** Nuxt 4 reference consumer 已安裝 package，**When** 工程師完成 plugin 或 component integration，**Then** package 必須可被 reference app 載入並完成基本 mount，且 reference consumer 只能使用 package 的公開 entry。
2. **Given** reference consumer 在 SSR build 與 client hydration 階段執行，**When** package 被 import 與 hydrate，**Then** package 必須維持 SSR import safety 與 client-only widget mount 行為。
3. **Given** Backend 002 尚未完成，**When** reference consumer 執行 Backend 001 Compatibility Mode smoke flow，**Then** 仍必須能完成 Independent Package Readiness 的前端驗收，且不得宣稱 backend 已理解 host-aware semantics。

---

### User Story 8 - 保護隱私、隔離與 Host Boundaries (Priority: P1)

Package 不得造成敏感 context、session、listener、SSE 或 CSS 在不同 Host、不同 organization 或 unmounted widget 之間洩漏，也不得把 authenticated integration context 誤描述為 frontend 自有授權權限。

**Why this priority**: Frontend 002 會被嵌入企業內部系統；如果隔離、隱私或 cleanup 邊界出錯，風險高於一般 UI 元件錯誤。

**Independent Test**: 可驗證 raw context leakage、cross-host session contamination、cross-organization session contamination、stale entity context、dangling SSE、duplicate listeners、post-unmount updates、`sourceSystem` / connector / adapter injection attempts 與 CSS/global side effects。

**Acceptance Scenarios**:

1. **Given** 不同 Host App 或不同 organization 在同一 browser session 中使用 package，**When** 系統管理 fallback session 或 widget state，**Then** 不得意外共用 session、history pointer、context 或 namespace。
2. **Given** widget 已經 unmount、destroy 或 organization 已切換，**When** 舊的 SSE、timer、listener 或 callback 回來，**Then** 系統不得再更新 widget 或 Host App state。
3. **Given** Host App 提供 authenticated permission-context handoff metadata，**When** package 轉送這些資料，**Then** frontend 只能把它視為 backend-revalidated input，而不得自行生成、提升、降低、合併或推導 role、permission scopes、organization authorization、`sourceSystem`、connector 或 adapter authority。
4. **Given** Backend 001 Compatibility Mode 缺少 provider-level organization identifier，**When** package 需要 session continuity，**Then** 系統只能使用 host-managed sessionId 或 same-runtime-only memory fallback，而不得建立可能跨 organization 的 persistent fallback；但這不代表最終 outgoing request 可以缺少 Backend 001 required organization identity。

---

### User Story 9 - 驗證 Backend 002 Contract Compatibility (Priority: P3)

當 Backend 002 可用後，package 能把符合 contract 的 Host Context 傳給既有 assistant API，並完成 host-aware integration smoke；但此 story 不阻塞 Frontend 002 的 Independent Package Readiness。

**Why this priority**: Backend 002 是完整 host-aware integration 的必要依賴，但不該把 Frontend 002 package 自身 readiness 綁死在外部 backend 里程碑上。

**Independent Test**: 此 story 可獨立於其他 Frontend 002 stories 驗證，但需要 Backend 002 integration environment，並驗證 package 能送出符合 contract 的 sanitized context，且能正確消費 backend 回傳的 host-aware clarification、permission_denied、tool_failure、permission-safe evidence、backend-derived source metadata 與 safe outcomes。

**Acceptance Scenarios**:

1. **Given** Backend 002 已支援 Host Integration contract，**When** package 傳送符合 Frontend 002 provider contract 的 Host Context，**Then** backend 必須能接受並 normalize 這些輸入，且若缺少 Backend 002 Mode required 欄位，frontend 必須先 fail closed 而不是嘗試送出 request。
2. **Given** backend 依 Host Context 做 capability governance、permission boundary、source consistency 與 evidence/source handling，**When** package 呈現結果，**Then** frontend 只能消費 backend 回傳的 host-aware outcome，不得自行推導 `sourceSystem`、connector、tool eligibility、permission result 或 evidence source；若最終送往 Backend 002 的 outgoing request 缺少 required identity / permission context，frontend 不得宣稱完成 host-aware integration。
3. **Given** Backend 002 尚未完成，**When** Frontend 002 驗證 package build、install、mount 或 Backend 001 Compatibility Mode，**Then** 此 story 的未完成不得阻塞 package readiness 宣告。

> 此 story 的 end-to-end execution 依賴 Backend 002，但不阻塞 Frontend 002 的 Independent Package Readiness。

### Edge Cases

- package 在 SSR build 階段被 import，但不應直接存取 browser globals。
- widget 被錯誤地在 server side 呼叫 mount。
- Host App 重複 initialize 或重複 mount。
- mount container 不存在或已被 teardown。
- provider 回傳 Promise rejection，或回傳缺少必要欄位的 context。
- provider 解析失敗時，package 必須停止送出 request、顯示 `context unavailable` 或 `integration error`、允許使用者或 Host App 重試，且不得使用 stale context。
- provider 在 message send 前後 context 改變，retry / resend 必須重新讀取最新 context。
- route change 後 widget 仍持有舊 entity，或 entityId 與 selectedRows 衝突。
- `selectedRows` 超過 20 筆、含 raw row payload、含 class instance / DOM node / function / circular structure，或 activeFilters / visibleColumns 含敏感欄位。
- Host App 嘗試傳入 connector、adapter、`sourceSystem`、access token、refresh token，或把 callback / WidgetConfiguration 序列化進 request context。
- Host App 注入 authenticated transport executor，但其 request / SSE 處理與 package 預設 transport contract 不一致，或嘗試透過 executor 改寫 assistant API route、建立第二套 SSE parser、改變 public request envelope、繞過 package sanitization / mode validation。
- `sessionScope` 被序列化進 backend request body、headers、PageContext、hidden prompt、message text、transport metadata 或 HostCallbacks payload。
- provider、WidgetConfiguration、HostCallbacks 或 local-only state 嘗試把 `sourceSystem`、connector / adapter / data source、candidate tool、permission result、final evidence source、raw evidence、raw connector payload、routing hints 或 approval navigation metadata 放入最終 outgoing request。
- Host App 提供新的 sessionId 或切換 organization 時，舊 SSE、history loading、listeners 或 session pointer 尚未結束。
- entity scope 或 organization scope 切換時，舊 session 的 history 尚未完成。
- 在符合 fallback 前提時卻未使用 `sessionStorage` fallback、或不符合前提時卻建立 persistent fallback。
- `sessionStorage` 不可用、兩個 Host App 共用同一 browser storage，或不同 organization 使用相同 session key；此時 package 只可採 same-runtime memory-only fallback，不得靜默改用 `localStorage` 或 cookie。
- Backend 001 Compatibility Mode 缺少 provider-level organization identifier 時仍嘗試建立 persistent fallback，或把 memory-only session 誤當作可滿足 Backend 001 identity contract。
- Backend 001 Compatibility Mode 的最終 outgoing request 缺少 Backend 001 required organization identity，卻仍嘗試送 request。
- Backend 002 Mode 缺少 required identity / permission context 時仍嘗試送 request，或仍宣稱完成 host-aware integration。
- Backend 001 Compatibility Mode 意外送出 Backend 002 專屬欄位，或把 Host Context 拼進使用者 message text / hidden prompt；正確行為是由 transport adapter 明確省略這些欄位。
- 測試使用的 fake provider、stub transport、SSE fixture 或 backend response fixture 與正式 public contract 不一致。
- Backend 002 尚未完成，或回傳 host-aware clarification。
- package 嘗試從 `hostApp`、`screenId`、entity、approval request ID 或 message ID 推導、硬編碼或組裝 Host App navigation URL；正確行為是只觸發含穩定識別 ID 的 approval detail callback，並由 Host App 自行處理 routing / navigation。
- package styles 與 Host App styles 衝突，或 consumer 未匯入 `@internal-ai-assistant/assistant-sdk/styles.css`。
- package 版本與 Frontend 001 runtime contract 不相容。
- destroy 後 Host App callback 仍被觸發。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 提供一個可安裝的 Frontend package / SDK，用於封裝 Frontend 001 已存在的 Internal Assistant Embedded Chat Panel 與 chat runtime。
- **FR-002**: 系統 MUST 明確把 Frontend 002 定位為 package / SDK、host integration contract、lifecycle、context provider、session isolation 與 compatibility feature，而不是新的聊天產品或 Frontend 001 的重寫。
- **FR-003**: 系統 MUST 重用 Frontend 001 已存在的 UI components、assistant API client、SSE parser、session / history runtime、AnswerDecision mapping、EvidenceRef rendering、feedback flow、ActionDraft display behavior 與 ApprovalRequest display behavior。
- **FR-004**: 系統 MUST NOT 建立第二套 ChatWidget、assistant API client、SSE parser、session state、history pipeline、AnswerDecision mapping、evidence mapping 或 feedback implementation。
- **FR-005**: package MUST 支援 Vue 3 與 Nuxt 4 consumer integration，且 v1 MUST NOT 宣稱支援 framework-agnostic integration。
- **FR-006**: package MUST 以 npm-compatible artifact 形式供 Host App 安裝，並支援至少一種可驗證安裝方式：workspace dependency、local tarball 或 private-registry-compatible artifact。
- **FR-007**: package root MUST 只暴露穩定且最小化的正式 public exports，供 Host App 完成安裝、初始化、掛載、卸載與 context integration；undocumented deep import 不屬於穩定 public contract。
- **FR-008**: package MUST 提供 `AssistantWidget` component export 與必要 public types，讓 Host App 能以 declarative integration 方式使用 assistant widget，且 consumer 必須能從正式公開 entry 取得這些型別。
- **FR-009**: package MUST 提供 `mountAssistantWidget` 作為有限的 imperative mount / unmount integration 能力，以支援需要程式化控制掛載點的 Host App。
- **FR-010**: internal stores、internal composables、private transport implementation、SSE parser internals、private Vue components 與其他 undocumented internals MUST NOT 被意外 export 為公開 API。
- **FR-011**: consumer MUST 使用自己的 Vue runtime；package MUST NOT 在 bundle 中建立第二套彼此隔離的 Vue instance。
- **FR-012**: Nuxt integration MUST NOT 要求 consumer 啟用第二套 Vue app。
- **FR-013**: peer dependency 缺失或不相容時，consumer build / install MUST 得到可診斷的錯誤或 warning；具體 peer dependency 範圍留待後續 design / plan 定義。
- **FR-014**: package MUST 避免因不必要 bundled dependencies 造成重複 runtime；Frontend 002 與 Frontend 001 runtime contract MUST 採 same-version track，代表同一 release train 與同一版本號軌道，且 Frontend 001 regression MUST 成為 Frontend 002 release gate；peer dependency 的具體範圍可留待後續 design / plan 定義。
- **FR-015**: package MUST SSR import-safe，且在 SSR build 階段不得直接存取 `window`、`document`、`sessionStorage` 或其他 browser-only globals。
- **FR-016**: widget MUST 只在 client side mount 與執行互動行為。
- **FR-017**: package MUST NOT 要求 consumer 複製或修改 Frontend 001 production source 來完成整合。
- **FR-018**: 系統 MUST 提供 `AssistantHostContextProvider` 作為 request-scoped public contract，讓 Host App 在每次 assistant request 前提供最新 host context。
- **FR-019**: `AssistantHostContextProvider` MUST 支援 async resolution，且每次 request 前都必須重新讀取；provider resolution 失敗時，系統 MUST 停止 request、顯示 `context unavailable` 或 `integration error`、允許使用者或 Host App 重試，且不得使用 stale context。
- **FR-020**: `AssistantHostContextProvider` MUST 只包含 request-scoped 資訊：`hostApp`、authenticated actor handoff metadata、organization identifier、backend contract 允許轉送且需由 backend 重新驗證的 authenticated permission-context handoff metadata、sanitized `PageContext`、host-managed `sessionId` 與必要 request correlation metadata；但 provider MUST NOT 被宣稱為所有 authenticated identity / permission metadata 的唯一來源。若 provider 提供 `sessionScope`，它只可作為 Frontend 002 local session ownership / namespace input，不屬於 backend public request contract。
- **FR-021**: provider MUST NOT 包含 locale、theme、panel position、z-index、launcher enabled、transport executor、navigation callback 或其他 WidgetConfiguration / HostCallbacks 資訊；token、credential、secret 與 callback 物件也不得混入 provider。Frontend 002 local-only state 中的 `sessionScope`、fallback namespace、memory-only pointer、WidgetConfiguration、HostCallbacks、callback functions、UI state 與 internal retry / loading state 也 MUST NOT 進入最終送往 backend 的 outgoing request。
- **FR-022**: package MUST 另行提供 `WidgetConfiguration` 概念，用於承載 endpoint 或 transport mode、預設 transport 與 Host App 注入 low-level authenticated transport executor 的 ownership boundary、locale、light / dark / system、panel position、panel size boundary、launcher enabled、z-index、session behavior options、integration mode 與允許的 package feature flags；這些設定 MUST NOT 被序列化成 backend request payload，且注入 transport MUST NOT 讓 Host App 接手 assistant API client、SSE parser、endpoint selection、request shape construction、retry / cancel / error flow 或 request envelope ownership。Host App 不得透過 injected executor 改寫 assistant API route、建立第二套 SSE parser、改變 public request envelope，或繞過 package sanitization / mode validation。最終送往 backend 的 outgoing request MUST 由 provider 合法輸入、package request builder、預設或注入的 authenticated transport，以及 Backend 001 / Backend 002 public contract 要求的 request metadata 共同形成。
- **FR-023**: package MUST 另行提供 `HostCallbacks` / `HostEvents` 概念，用於承載 widget opened / closed、session created / changed、answer completed、error、approval detail requested、escalation requested 與 context resolution failed；callbacks MUST NOT 放進 `PageContext`、backend request 或序列化 request body。
- **FR-024**: package MUST 提供 frontend-side generic PageContext validation / sanitization boundary，只負責 schema 驗證、primitive / plain-object shape 驗證、大小限制與最小化，不負責 HostApp-specific allowlist 或權限策略。
- **FR-025**: sanitized PageContext MAY 包含 route path、screenId、hostModule、entityType、entityId、selected row references、generic active filter summary、visible column hints 與 user-visible state hints，但這些欄位 MUST 是 contract-allowed 的 generic shape。
- **FR-026**: package MUST 將 `selectedRows` 最小化為 ID 或 safe summary，MUST 移除 raw row object、function、DOM node、class instance、circular structure 與 contract-disallowed secret / token / credential data；v1 正式保證的 `selectedRows` 上限為 20 筆，超過上限時 MUST 整體拒絕此次 context 並提示縮小選取範圍，且 MUST NOT 靜默截斷。
- **FR-027**: package MUST NOT 傳送完整 entity payload、完整 customer / order / inventory record、access token、refresh token、secret 或 connection detail；若最終 outgoing request 需要 authenticated identity / permission metadata，應由既有 Host App transport / request layer 或預設 transport 依 Backend contract 處理，而不是由 Frontend 002 自行發明新的認證來源。Frontend validation of `selectedRows` 不得取代 backend validation、organization boundary、row-level permission 或 authorization enforcement，且 selectedRows 不得作為 authorization proof。
- **FR-028**: Frontend 002 MUST NOT 根據 visibleColumns、route、selectedRows、PageContext、UI state 或 frontend safe summary 推導 role、permission scopes、organization authorization、field permission、connector / tool eligibility、backend-owned source metadata 或 backend evidence authority，也 MUST NOT 自行生成、提升、降低、合併或推導 permission scopes。
- **FR-029**: frontend sanitization 與 permission-context handoff MUST NOT 被視為 backend permission enforcement、HostApp Registry、screen capability registry、host-specific allowlist、row-level permission、field-level permission、operation-level permission、connector / tool eligibility 或 source / evidence handling 的替代品；這些責任屬於 Backend 002。
- **FR-030**: package MUST 支援 initialize、mount、open、close、unmount / destroy、route change、entity change、selectedRows change、organization change、session scope change、host-managed sessionId change 與 session reset 等 widget lifecycle。
- **FR-031**: package MUST 避免 duplicate mount、duplicate listener、dangling SSE、未清理 timer / observer，以及 destroy 後的 state mutation。
- **FR-032**: route change、entity change、organization change 或 session scope change 後，系統 MUST 避免把舊 PageContext 或舊 session context 用於新 request。
- **FR-033**: session ownership MUST 以 host-managed sessionId 為優先；organization identifier MUST NOT 由 route、selectedRows 或 browser storage 自行猜測。Host-managed `sessionId` 只可作為既有 assistant session ownership / resume hint 的一部分，不得成為 backend identity、permission、organization 或 capability authority。
- **FR-034**: 當以下條件同時成立時，package MUST 使用 `sessionStorage` fallback session pointer：Host App 未提供 host-managed sessionId、當前 integration mode 允許 frontend fallback session、安全 namespace 所需欄位均存在，且 `sessionStorage` 可用；fallback namespace 至少 MUST 區分 package namespace 或 package major compatibility namespace、hostApp、organization identifier、session scope，以及 page identity 或 entity type / entity ID。
- **FR-035**: 不同 Host App、不同 organization、不同 entity 或不同 session scope MUST NOT 共用同一 fallback session；organization 切換時，系統 MUST 終止舊 session context、SSE 與 history loading，再進入新 namespace。
- **FR-036**: 若 `sessionStorage` 在當前環境不可用，package MUST NOT 建立 persistent browser fallback；v1 必須改採 same-runtime-only memory-only fallback，且不得靜默改用 `localStorage` 或 cookie。若 provider 無法提供建立安全 fallback 所需的 organization identifier，則 Frontend 002 只可退回 host-managed sessionId 或 memory-only continuity；這只影響 frontend session continuity，不代表 Backend 001 / Backend 002 identity requirement 已被滿足。Backend 002 Mode 仍 MUST fail closed，且 host-managed sessionId 不得被視為 organization proof。
- **FR-037**: package MUST 重用 Frontend 001 的 session API、message API、history loading、cursor pagination、SSE parsing、sequence handling、cancel / timeout / retry、AnswerDecision rendering、EvidenceRef rendering、feedback API、ActionDraft confirmation、ApprovalRequest display 與 interrupted / no-answer / clarification / permission-denied / tool-failure UI。Source-time adapter imports MAY reference canonical Frontend 001 source inside this monorepo, but built / installed package artifacts MUST NOT require consuming apps to resolve Frontend 001 internal app paths.
- **FR-038**: package MUST 只支援兩種正式 Frontend 002 integration / request-builder / provider validation mode，且這些 mode 不是 backend request mode，也不得改變 Backend 001 / Backend 002 既有 public API、route、SSE event contract、request envelope 或 AnswerDecision contract：
  - Backend 001 Compatibility Mode：沿用 Frontend 001 / Backend 001 既有 request shape 與 public contract，並由 transport adapter 明確省略 Backend 002 專屬 Host Integration 欄位。
  - Backend 002 Mode：驗證 package 可送出符合 contract 的 sanitized context，並正確消費 backend 回傳的 host-aware clarification、permission_denied、tool_failure、backend-derived source metadata、permission-safe evidence 與 safe outcomes。
- **FR-039**: Backend 001 Compatibility Mode 的 provider / outgoing request contract 分類 MUST 以 Backend 001 現有 public contract 為唯一來源：`x-actor-id`、`x-organization-id`、`x-host-app` 與 `x-role` 為 required by Backend 001；`x-permission-scopes`、`pageContext` 與 frontend-generated `x-request-id` 為 optional by Backend 001；`WidgetConfiguration`、`HostCallbacks`、fallback session namespace data 與 memory-only continuity state 為 Frontend 002 local-only；Backend 002 專屬 host-aware 欄位必須 omission；token、credential、secret、callback object、WidgetConfiguration data 與 raw business payload 為 invalid。Provider 中缺少某欄位，不必然代表最終 outgoing request 缺少該欄位，因為可信 authenticated transport 可能補入 Backend 001 contract 要求的 metadata。
- **FR-040**: Backend 001 Compatibility Mode 中，Frontend 002 MUST NOT 把 Backend 001 既有 required identity context 降級成 optional、不得新增 Backend 001 不認得的 required 欄位、不得繞過既有 identity validation，也不得讓 host-managed sessionId 或 memory-only session 取代 Backend 001 的 identity requirement。若 provider 缺少 organization identifier，Frontend 002 只可停止 organization-scoped persistent fallback；若最終 outgoing request 也缺少 Backend 001 required organization identity，package MUST 不送出或 MUST 依既有 integration / identity error flow 失敗。
- **FR-041**: Backend 002 Mode 中，authenticated permission-context handoff metadata 不一定必須由 `AssistantHostContextProvider` 提供；它可以由符合 Backend 002 public contract 的可信 authenticated transport 提供。Frontend 002 不得自行生成、修改或降級 permission context。最終送往 Backend 002 的 outgoing request MUST 符合 Backend 002 既有 required identity / permission contract；缺少必要資料時，package 不得假裝完成 host-aware request，並 MUST 依既有 safe error / fail-closed flow 處理。backend 仍 MUST 是 identity、organization boundary、role / permission、connector / tool eligibility、backend-owned `sourceSystem`、source metadata 與 permission-safe evidence 的唯一 authority。
- **FR-042**: package MUST 暴露最小必要的 host event 集合，至少涵蓋 widget opened、widget closed、session created、session changed、answer completed、error occurred、approval detail requested、escalation requested 與 context resolution failed。
- **FR-043**: host event payload MUST 最小化，且 MUST NOT 包含 raw business data、token、credential、raw prompt、raw SSE payload 或內部 implementation object；approval detail callback 的最小 public payload MUST 只包含 `approvalRequestId`、`sessionId`、`messageId`。package MUST NOT 提供、推導、硬編碼或組裝 approval detail 導航目標或 Host App navigation URL，也不得把 backend route 或 Host App route 變成 Frontend 002 public contract。
- **FR-044**: Host App callback 失敗時，package MUST 隔離 callback 例外，避免影響 assistant widget 整體運作。
- **FR-045**: package MUST 提供有限且可控的 theme / UI integration surface，至少涵蓋 light / dark / system、`zh-TW` locale、panel position、panel size boundary、launcher enable / disable、有限 CSS variables / tokens 與 z-index compatibility。
- **FR-046**: package MUST NOT 提供完整 theme builder、arbitrary CSS injection、Host App 專屬硬編碼樣式、Shadow DOM 或 iframe styling system。
- **FR-047**: package MUST 維持基本 accessibility 要求，包括鍵盤操作、focus 行為與可理解的狀態呈現。
- **FR-048**: 系統 MUST 提供至少一個 Nuxt 4 reference consumer integration acceptance，用於驗證 `@internal-ai-assistant/assistant-sdk` install、`AssistantWidget` 或 `mountAssistantWidget` integration、provider registration、WidgetConfiguration、HostCallbacks、widget mount / unmount、route / entity / selectedRows update、sessionId handoff、approval detail callback，以及 Backend 001 Compatibility Mode flow；目前 repo 的 Nuxt app 為 v1 reference consumer / preview harness。
- **FR-049**: 這個 reference consumer acceptance MUST 能在 Backend 002 未完成時獨立通過，且 reference consumer MUST 只使用 package 的正式公開 entry，不得 import package 內部 source path、`./runtime` deep import 或 Frontend 001 internal app path。
- **FR-050**: package MUST 避免 raw、unsanitized、contract-disallowed business payload 以及 token、credential、secret、raw PageContext 出現在最終送往 backend 的 outgoing request、browser storage、一般 log、telemetry、`sessionStorage` 或 host event payload 中。Forbidden outgoing request fields 包含但不限於 frontend-provided `sourceSystem`、`connector`、`connectorId`、`adapter`、`adapterId`、`dataSource`、`candidateTool`、`candidateTools`、`toolName`、`permissionResult`、`fieldPermissionResult`、`rowPermissionResult`、`finalEvidenceSource`、`rawEvidence`、`rawConnectorPayload`、routing hints、approval navigation metadata、token、credential、secret 與 connection detail。
- **FR-051**: frontend MUST NOT 擁有 `sourceSystem`、connector、adapter、organization authorization、row / field / operation permission decision authority，也 MUST NOT 自行生成、提升、降低、合併或推導 role / permission scopes；Frontend 002 只可轉送符合 contract 的 sanitized PageContext 與 handoff metadata，Backend 002 仍是 permission enforcement、connector / tool selection、source metadata 與 evidence/source handling 的唯一 source of truth。
- **FR-052**: Frontend 002 Independent Package Readiness MUST 可在 Backend 002 未完成時完成 build、install、mount、provider / configuration / callbacks integration、session / lifecycle 驗證與 Backend 001 Compatibility Mode flow 驗證；unit / component / integration tests MAY 使用 deterministic test doubles，但 test doubles MUST 對齊被模擬的正式 contract，且 MUST NOT 成為正式 public API。
- **FR-053**: Backend 002 integration tests MUST 被視為 integration-dependent acceptance，而不是 Frontend 002 package readiness 的阻塞條件；只有 Backend 002 Mode 可宣告 host-aware integration validation。
- **FR-054**: 當 Backend 002 可用時，package MUST 能把符合 provider contract 的 generic Host Context 傳給既有 assistant API，並正確消費 backend-side normalization 後回傳的 host-aware clarification、permission_denied、tool_failure、permission-safe evidence、backend-derived source metadata 與 SSE final safe outcomes；Frontend 002 不得驗證或控制 backend internal connector / tool selection。
- **FR-055**: package readiness 與 full host-aware integration MUST 在規格與驗收上被清楚區分，不得混為同一完成宣告。
- **FR-056**: package v1 MUST 預設一個 Host App page 只啟用一個 active assistant widget instance。
- **FR-057**: package MUST 支援 package stylesheet / theme token integration surface，且其正式 stylesheet entry 為 `@internal-ai-assistant/assistant-sdk/styles.css`，由 consumer 主動 import。
- **FR-058**: package 的正式 npm package name / scope 為 `@internal-ai-assistant/assistant-sdk`。
- **FR-059**: 現有 repo 的 Nuxt app MUST 作為 v1 Nuxt 4 reference consumer / preview harness 交付形態。
- **FR-060**: package artifact MUST be installable and usable by a consuming Vue 3 / Nuxt 4 Host App without requiring that app to contain Frontend 001 internal source paths such as `app/features`, `app/services`, `app/stores`, or `app/utils`.
- **FR-061**: package public exports MUST NOT expose `./runtime`, `./runtime/*`, adapter internals, Frontend 001 internal paths, unresolved monorepo-relative `app/**` imports, or any private runtime bridge; package consumers MUST use only documented SDK public entries.

### Key Entities *(include if feature involves data)*

- **Assistant Package**: 可安裝的 Frontend 002 package artifact，正式對外名稱為 `@internal-ai-assistant/assistant-sdk`，封裝 Frontend 001 的 widget 與 runtime 能力，供 Host App 只透過 SDK public entries 整合使用；published / installed artifact 不得要求 consumer 擁有 Frontend 001 repo layout。
- **AssistantHostContextProvider**: 由 Host App 提供最新 request-scoped host context 的 public contract，只包含 request 需要的 authenticated integration input，且每次 request 前必須重新解析；但它不必然是所有 authenticated identity / permission metadata 的唯一來源。
- **WidgetConfiguration**: 控制 endpoint、transport mode、預設 transport 或 Host App 注入 low-level transport executor 的 ownership boundary、locale、theme、position、size、launcher、z-index、session behavior 與 integration mode 的穩定設定集合，不進入 backend request payload。
- **HostCallbacks / HostEvents**: 供 Host App 接收 widget 狀態、session 狀態、completion、error、approval detail 與 escalation 請求的 callback / event surface，不進入 PageContext 或 backend transport。
- **Sanitized PageContext**: 經過 frontend generic validation 與最小化後，可安全送往 backend 的頁面上下文摘要；不承擔 host-specific allowlist 或權限判斷責任。
- **Session Scope**: 用於區分 `global`、`page`、`entity` 三種 session ownership 與 fallback namespace 行為的 Frontend 002 local-only 範圍模型；`sessionScope` 不得序列化進 backend request body、headers、PageContext、hidden prompt、message text、transport metadata 或 HostCallbacks payload。
- **Host-managed Session**: 由 Host App 明確提供與切換的 sessionId，優先於 package fallback session；它只可作為既有 assistant session ownership / resume hint，不是 backend identity、permission、organization 或 capability authority。
- **Package Fallback Session**: 當 Host App 沒有提供 sessionId，且 mode / namespace / storage 條件符合時，由 package 在 `sessionStorage` 中以 package namespace、host、organization、scope 與 page/entity identity 隔離保存的 session pointer；若 provider 缺少 organization identifier，package 不得建立 organization-scoped persistent fallback；若 `sessionStorage` 不可用，僅允許 same-runtime memory-only continuity。這些都只屬於 frontend continuity，不得被當作 Backend 001 / 002 identity proof。
- **Mode-tiered Provider Matrix**: Frontend 002 依 Backend 001 Compatibility Mode 與 Backend 002 Mode 定義不同 required / optional / local-only / omitted / invalid 欄位的模式矩陣；測試 doubles 不得形成第三套 provider contract。
- **Backend 001 Compatibility Mode**: Frontend 002 integration / request-builder / provider validation mode，不要求 backend 新增 Host Integration 欄位，用於 package readiness 與既有聊天流程驗證；它不是 backend request mode。
- **Backend 002 Mode**: Frontend 002 integration / request-builder / provider validation mode，用於 integration-dependent 驗證 package 可送出符合 contract 的 sanitized context，並消費 backend 回傳的 host-aware clarification、permission-safe evidence、backend-derived source metadata 與 safe outcomes；它不是 backend request mode。
- **Package Readiness**: 不依賴 Backend 002 也能完成的前端 package 層級整合狀態，包含 build、install、mount、provider / configuration / callbacks、session、Backend 001 Compatibility Mode smoke 與 cleanup 驗證。
- **Full Host-aware Integration**: 依賴 Backend 002 的 host-aware end-to-end 整合狀態，包含 context normalization、capability governance、PageContext policy、permission boundary、permission-safe evidence、backend-derived source metadata 與 safe outcomes。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 一個 Nuxt 4 reference Host App 可完成 package install、public export import、provider registration、WidgetConfiguration、HostCallbacks 與 widget mount，並能在同一驗收流程內開啟與關閉 widget。
- **SC-002**: package 可在 SSR build 階段被 import 而不因 browser global access 失敗，且 widget 只在 client runtime 實際掛載。
- **SC-003**: Host Context 在每次 request 前都能取得最新值；當 route、entity、selectedRows、`sessionScope` 或 organization 改變時，不會沿用過期 context 發送新 request，且 `sessionScope` 不會進入 backend request body、headers、PageContext、hidden prompt、message text、transport metadata 或 HostCallbacks payload。
- **SC-004**: 在 Host App 提供 host-managed sessionId 與未提供 sessionId 兩種模式下，widget 都能以可預期方式建立、切換或還原 session；若 provider 缺少安全 fallback 所需的 organization identifier，package 會停止建立不安全的 persistent fallback，但這只影響 frontend continuity，不代表 Backend 001 required identity context 已被滿足。
- **SC-005**: package fallback session 在不同 Host App、不同 organization、不同 scope 與不同 entity 間不會交叉污染，且 organization 切換不會恢復舊 organization 的 session pointer；符合 fallback 前提時會使用 `sessionStorage` fallback，不符合前提時不會建立 persistent fallback；Backend 001 Compatibility Mode 缺少 provider-level organization identifier 時不會建立 persistent fallback，但若最終 outgoing request 缺少 Backend 001 required organization identity，request 也不會被送出；Backend 002 Mode 缺少 required identity / permission context 時會直接 fail closed。
- **SC-006**: widget unmount、destroy 或 organization 切換後，不會留下可觀察的 SSE、listener、timer、observer 或 post-unmount state update。
- **SC-007**: raw、unsanitized、contract-disallowed business payload，以及 token、credential、secret、raw PageContext，不會出現在最終送往 backend 的 outgoing request、browser storage、一般 log 或 host event payload 中；Frontend 002 也不會由 route、visibleColumns、selectedRows 或 PageContext 自行生成或推導 permission scopes。
- **SC-008**: 透過 Backend 001 Compatibility Mode，Host App 可獨立驗證 session、message、history、SSE、AnswerDecision、EvidenceRef、feedback 與 error / retry / interrupted flow，而不需 Backend 002 已完成；若使用 test doubles，仍必須對齊正式 contract。
- **SC-009**: Frontend 001 的 session、SSE、history、EvidenceRef、feedback 與 risk-state runtime 行為沒有被 Frontend 002 package 化重新發明或破壞。
- **SC-010**: package readiness 與 full host-aware integration 的完成狀態可被明確區分，且 Backend 002 未完成時仍能宣告 package 層級的整合 readiness。
- **SC-011**: Backend 002 完成後，可執行至少一條 host-aware integration smoke，驗證 package 送出符合 contract 的 sanitized context，並正確消費 backend 回傳的 clarification、permission_denied、tool_failure、permission-safe evidence、backend-derived source metadata 與 SSE final safe outcomes。
- **SC-012**: package stylesheet 不得包含影響 package root 外一般 Host App 元素的非必要 global selector、不得插入未命名 global reset、除 documented CSS variables 外不得修改 Host App root theme tokens，且 reference consumer 既有 controls 的 computed styles 不得因 package stylesheet import 而非預期改變；若 consumer 未匯入必要 stylesheet，結果必須是可辨識、可診斷的整合缺口或文件化的退化外觀，而不是不透明的 runtime failure。
- **SC-013**: `AssistantHostContextProvider`、`WidgetConfiguration` 與 `HostCallbacks` 不會被彼此誤序列化或送入錯誤 transport；provider、Frontend 002 local-only state 與最終 outgoing request 的責任邊界可被清楚區分，且 provider 缺少某欄位不會被誤解為 transport 必然無法補入 backend contract required metadata；Frontend 002 mode 不會被誤解為 backend request mode。
- **SC-014**: Backend 001 Compatibility Mode 只會送出 Backend 001 既有 public request shape；Frontend 002 專屬 Host Context 欄位會由 transport adapter omission 排除，且不會被拼入使用者 prompt 或 hidden message；無論使用預設 transport 或 Host App 注入 transport executor，都必須維持相同結果，且 injected executor 不能改寫 route、request envelope、SSE parser 或繞過 sanitization / mode validation。
- **SC-015**: `selectedRows` 超過 20 筆時，不會被靜默截斷；系統會整體拒絕此次 context，並向使用者或 Host App 提示縮小選取範圍。
- **SC-016**: `sessionStorage` 不可用時，package 會改採 same-runtime-only memory-only fallback，不會靜默改用 `localStorage` 或 cookie；full reload、新 tab 或新 runtime 不會延續舊 continuity。
- **SC-017**: approval detail callback 只會暴露 `approvalRequestId`、`sessionId`、`messageId`；不會暴露完整 ApprovalRequest internal object、raw business data、token、credential、raw SSE payload、approval detail 導航目標或 package 推導的 Host App navigation data。
- **SC-018**: Frontend 002 以 repo workspace package 交付時，reference consumer 仍只會透過 Frontend 002 public entry 整合 assistant widget，不需要也不能依賴 Frontend 001 internal path。

## Open Clarifications

- 無阻塞 `design.md` 的高影響規格模糊點；若後續需要補充 library build 的工具選型細節，可在 `design.md` 記錄，但不影響本 spec 的產品邊界與驗收。

## Assumptions

- Frontend 001 的 ChatWidget 與 chat runtime 已存在，且可被封裝與重用。
- Backend 001 public assistant API、history API、SSE contract、`final.data.answerDecision`、`EvidenceRefSummary`、feedback 與 risk-state contract 已存在。
- Backend 002 Host Integration contract 已在目前 repo 中以 `specs/002-host-integration-gateway-and-data-adapter-contract/` 的 spec / design / plan / tasks 文件定義；Frontend 002 以該文件中的 public assistant contract、Frontend Integration Dependency、sanitized PageContext、selectedRows、backend-owned `sourceSystem` 與 safe outcome 邊界作為 fixed input，但不實作 Backend 002 runtime，也不複製 Backend 002 HostApp capability、permission、source、connector、EvidenceRef 或 AnswerDecision runtime。
- Host App 可提供 authenticated actor handoff metadata、organization identifier、backend contract 允許轉送且需由 backend 重新驗證的 authenticated permission-context handoff metadata，以及 sanitized PageContext；但最終 outgoing request 所需的 authenticated identity / permission metadata 不一定全部來自 provider，也可由可信 authenticated transport 依既有 Backend contract 補入。
- package consumer 為 Vue 3／Nuxt 4 專案。
- widget 在 browser client runtime 中執行，且 v1 預設只有單一 active widget instance。
- Frontend 002 採 same-version track 與 Frontend 001 runtime contract 對齊，並在目前 repo 內以 workspace package 交付；package 名稱固定為 `@internal-ai-assistant/assistant-sdk`、主要 component export 為 `AssistantWidget`、imperative helper 為 `mountAssistantWidget`、stylesheet entry 為 `@internal-ai-assistant/assistant-sdk/styles.css`，現有 Nuxt app 為 v1 reference consumer / preview harness。
- Frontend 002 package build / release 必須把 source-time canonical runtime reuse 轉換為 consumer 可安裝的 artifact boundary；consumer 不被假設擁有 Frontend 001 app source tree。

## Dependencies

- Frontend 001 UI 與 chat runtime。
- Backend 001 public assistant API、history API、SSE contract 與相關 public behavior handoff。
- Backend 001 Compatibility Mode，供 Frontend 002 Independent Package Readiness 驗證。
- Backend 002 Host Integration contract，僅作為完整 host-aware end-to-end acceptance dependency；Frontend 002 只驗證 sanitized context submission 與 backend 回傳的 clarification、permission-safe evidence、backend-derived source metadata 與 safe outcomes consumption，不驗證或控制 backend internal connector / tool selection。
- 目前 repo 內的 workspace package build 與 artifact 產出能力。
- 至少一個 Nuxt 4 reference consumer，用於驗證 Independent Package Readiness。
- package artifact validation 能力，用於確認 built SDK 不含 unresolved Frontend 001 internal app path import，且 consuming app 僅使用 public package entries。

> Backend 002 是完整 host-aware end-to-end integration dependency，但不是 Frontend 002 Independent Package Readiness 的阻塞依賴。

## In Scope

- npm-compatible package artifact。
- installable package artifact boundary。
- package public exports 與 public types。
- public / internal export boundary。
- Vue 3 component exports。
- Nuxt 4 consumer compatibility。
- limited imperative mount helper。
- package stylesheet / theme token entry。
- peer dependency boundary。
- SSR import-safe behavior。
- client-only widget mount。
- `AssistantHostContextProvider`。
- `WidgetConfiguration`。
- `HostCallbacks` / `HostEvents`。
- PageContext generic validation / sanitization boundary。
- widget lifecycle 與 cleanup。
- session ownership、fallback session 與 organization isolation。
- Frontend 001 runtime reuse boundary。
- Backend 001 Compatibility Mode。
- Backend 002 integration-dependent mode。
- limited theme / host UI integration。
- Nuxt 4 reference consumer smoke。
- privacy、security 與 isolation requirements。
- Independent Package Readiness 與 Backend 002 integration-dependent acceptance 的明確區分。

## Out of Scope

- 不重做 Frontend 001 ChatWidget。
- 不建立第二套 assistant API client。
- 不建立第二套 SSE parser。
- 不建立第二套 session / history runtime。
- 不建立第二套 AnswerDecision mapping。
- 不實作 Backend 002。
- 不實作 HostApp Registry。
- 不複製 Backend 002 HostApp Registry。
- 不實作 DataAdapter。
- 不推導 `sourceSystem`。
- 不決定 connector / adapter。
- 不執行 organization boundary authorization。
- 不執行 row-level / field-level / operation-level backend permission。
- 不維護 host-specific field / filter permission policy。
- 不把 raw entity data 傳給 LLM。
- 不把 Host Context 拼入使用者 prompt 或 hidden message。
- 不修改 Backend 001 public request shape。
- 不建立新的 frontend authentication system。
- 不由 package 保存 access token 或 refresh token。
- 不建立 package 專用 backend proxy。
- 不做 Web Component。
- 不做 iframe mode。
- 不做 React / Angular / Svelte integration。
- 不做 framework-agnostic SDK。
- 不做 Shadow DOM。
- 不做完整 theme builder。
- 不做 admin UI / CRUD。
- 不做 approval management UI。
- 不要求公開發布到 public npm registry。
- 不做 production connector。
- 不要求 consuming app 擁有 Frontend 001 `app/features`、`app/services`、`app/stores` 或 `app/utils` source layout。
- 不把 SDK package 降級為只能在原 repo source mode 運作的 wrapper。
- 不在本 feature 解決真實 production connector integration。
- 不做 MES / WMS / SCM / CRM Host App implementation。
- 不做 production deployment、Kubernetes 或 Helm。
