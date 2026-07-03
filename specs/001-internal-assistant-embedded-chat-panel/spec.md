# Feature Specification: Internal Assistant Embedded Chat Panel

**Feature Branch**: `001-internal-assistant-embedded-chat-panel`

**Created**: 2026-06-23

**Status**: Draft

**Input**: User description: "建立「內部後台 AI 助理」的嵌入式 chat panel / widget 前端規格，讓此面板可嵌入 ERP / MES / WMS / SCM / CRM / Admin 等企業內部系統，並串接已完成的 backend assistant core API。"

## Feature Summary

本 feature 定義一個可嵌入企業內部後台系統的 AI chat panel / widget，讓已登入的內部使用者可以直接在 ERP、MES、WMS、SCM、CRM、Admin 等 host app 畫面中提問並完成助理互動。

此 feature 必須支援：

- session create / restore / history
- `PageContext` 與 `AssistantHostContextProvider` 注入
- SSE streaming answer
- `AnswerDecision` 與 evidence refs 呈現
- clarification / no-answer / permission denied / tool failure safe UI
- message-level feedback
- ActionDraft confirmation
- ApprovalRequest status display
- network / SSE interrupted / backend degraded safe state

## Product Context

這是嵌入企業內部後台的 AI 助理 floating launcher widget，不是 public chatbot，也不是 backend assistant core。`embedded` 僅描述 host app integration / installation model，不代表 inline panel display mode；MVP UI 固定由右下角 launcher button 開啟或收合 floating chat panel。

此前端 feature 依賴 backend assistant API contract handoff，並以前端整合契約作為唯一 API surface 依據。前端只負責 host context 收集、對話 UI、session restore、SSE 消費、evidence / decision 狀態呈現與有限的人機確認流程。

此前端 feature 不負責：

- 資料權限判斷
- RAG
- LLM provider 串接
- tool execution
- 真實 ERP / MES / WMS / SCM / CRM connector
- approval 後台與完整 approval management UI

本 feature 的成功標準是：使用者能在 host app 中完成完整的助理互動閉環，包含開啟 panel、建立或還原 session、送出訊息、看到安全且可理解的回答狀態、必要時完成 feedback 或 confirmation 操作。

## User Personas

- **一般內部使用者**：在 ERP / MES / WMS / SCM / CRM / Admin 中提問、查詢狀態、閱讀回答與 evidence。
- **具 medium-risk 操作權限的內部使用者**：在 assistant 需要人類確認時，對 ActionDraft 執行 confirm / cancel。
- **Approval requester**：可查看 ApprovalRequest 的 pending / approved / rejected / expired / cancelled 等狀態，但不在本 feature 中進行 approval 管理。
- **Host app developer / integrator**：提供 `AssistantHostContextProvider`、identity headers、session scope、host-managed sessionId，以及 `onOpenApprovalDetail` callback。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 嵌入 host app 並開啟 chat panel (Priority: P1)

已登入的內部使用者可以在 ERP、MES、WMS、SCM、CRM、Admin 等宿主頁面中，透過右下角 floating launcher 開啟或收合 AI 助理面板，並在窄 viewport 與基本無障礙操作條件下正常使用。

**Why this priority**: 若 panel 無法在 host app 中穩定掛載與開啟，後續所有 session、message 與 SSE 互動都無法發生。

**Independent Test**: 可在一個已登入的 host app 頁面中掛載 `ChatWidget`，驗證預設只顯示右下角 launcher、點擊後開啟 dialog、再次點擊 / close / Escape 可關閉，以及 host context ready、provider not ready、窄 viewport 與鍵盤操作下的安全 fallback。

**Acceptance Scenarios**:

1. **Given** host app 已掛載 `ChatWidget`，**When** 頁面完成載入，**Then** 系統預設只顯示右下角 floating launcher，不直接顯示 chat panel。
2. **Given** floating launcher 已顯示，**When** 使用者點擊 launcher，**Then** 系統必須開啟可互動的 assistant dialog，並準備後續 session 與 send-message 流程。
3. **Given** assistant dialog 已開啟，**When** 使用者再次點擊 launcher、點擊 close button 或按下 Escape，**Then** dialog 必須關閉並維持可再次開啟的 launcher。
4. **Given** host app 尚未準備好 context provider 或必要 host context，**When** 使用者開啟 chat panel，**Then** 系統必須顯示安全的 not-ready 狀態，而不是用猜測資料進入可送訊息模式。
5. **Given** viewport 較窄或使用者以鍵盤與輔助技術操作，**When** 使用者開啟 panel，**Then** 系統必須維持基本可用性、可聚焦性與可理解的狀態提示。

---

### User Story 2 - 建立 / 還原 session 與載入 history (Priority: P1)

使用者重新打開 panel 時，可以根據 host app 提供的 sessionId 或 `sessionStorage` fallback 還原會話，並從 backend 載入符合邊界的歷史訊息。

**Why this priority**: session restore / history 是 constitution 明確要求的產品必要能力，也是讓使用者在實際工作流中延續對話脈絡的核心。

**Independent Test**: 可在相同 actor、organization、host app 與不同 session scope 下重開 panel，驗證 host-managed sessionId 優先、`sessionStorage` fallback、history endpoint、`order=asc`、`nextCursor` 與 fail-safe 行為。

**Acceptance Scenarios**:

1. **Given** host app 提供有效的 sessionId，**When** 使用者重新開啟 panel，**Then** 系統必須優先使用該 sessionId restore，而不是建立新 session。
2. **Given** host app 未提供 sessionId，但存在對應 `global`、`page` 或 `entity` scope 的 `sessionStorage` fallback，**When** 使用者重新開啟 panel，**Then** 系統必須使用該 fallback sessionId 呼叫 `GET /api/v1/assistant/sessions/{sessionId}/messages`，並以 `order=asc` 與 `nextCursor` 載入 history。
3. **Given** restore 目標 session 已過期、已關閉或對當前 actor / host app / organization 不可見，**When** backend 回傳 safe error envelope，**Then** 系統必須清除 fallback sessionId，並回到安全的新 session 建立流程或安全錯誤狀態。

---

### User Story 3 - 送出 message + PageContext + SSE streaming (Priority: P1)

使用者送出問題時，前端必須攜帶當下最新的 `PageContext`，並透過 SSE 即時接收與呈現回答流程。

**Why this priority**: 這是 panel 的主要價值交付流程，也是 host app context 與 backend assistant contract 對齊最直接的地方。

**Independent Test**: 可在同一畫面中變更 host context 後送出訊息，驗證 request 會攜帶最新 context，並確認 request / response header 語意、SSE event 消費、unknown event fallback 與 `sequence` ordering / de-dup。

**Acceptance Scenarios**:

1. **Given** 使用者準備送出訊息且 host app 畫面狀態可能已變更，**When** panel 發送 message request，**Then** 系統必須在送出前即時讀取最新 `pageContext`，不得使用過期 snapshot。
2. **Given** panel 要送出 assistant message，**When** request 發出，**Then** 系統必須使用 `POST`、request `Content-Type: application/json`、request `Accept: text/event-stream`，並接收 response `Content-Type: text/event-stream`。
3. **Given** backend 傳回 `answer_delta`、`final` 或 unknown SSE event，**When** panel 消費事件串流，**Then** 系統必須使用 `sequence` 做 ordering / de-dup、對 unknown event 做 safe fallback，且不得把 partial answer 當成 final answer。

---

### User Story 4 - 呈現 evidence / AnswerDecision (Priority: P1)

使用者必須能理解回答狀態與證據來源，且 UI 只能顯示 backend 已安全提供的 summary。

**Why this priority**: evidence-visible 與 answerDecision-visible 是產品信任感與安全性的重要基礎，若呈現不清或過度推測，後續設計與測試都會失真。

**Independent Test**: 可分別以 `EvidenceRefSummary[]` answered flow 與 `string[]` evidenceRefs answered flow 驗證 UI 顯示，並確認 `final.data.answerDecision` 是唯一 final state。

**Acceptance Scenarios**:

1. **Given** backend 的 `final` event 已到達，**When** panel 判定訊息最終狀態，**Then** 系統必須只以 `final.data.answerDecision` 作為唯一 final state，不得依中途事件或 `answer` 欄位自行反推。
2. **Given** backend 回傳 `EvidenceRefSummary[]`，**When** panel 呈現 evidence，**Then** 系統必須顯示 safe source summary，例如 `sourceType`、`title`、`snippet`，但不得延伸顯示 raw evidence 或 full document text。
3. **Given** backend 只回傳 `string[] evidenceRefs`，**When** panel 呈現 evidence，**Then** 系統只能顯示 safe evidence reference chip / id，不得自行補造 `sourceType`、`title`、`snippet`、document content 或 raw evidence。

---

### User Story 5 - 處理 clarification / no-answer / permission denied / tool failure (Priority: P1)

當 backend 無法安全回答時，前端必須呈現對應的安全狀態與下一步，而不是偽裝成成功回答。

**Why this priority**: safe fallback 是 internal assistant 與一般聊天機器人最大的產品差異之一，也是 constitution 與 backend handoff 的核心要求。

**Independent Test**: 可透過 contract-aligned mock 或 backend flow 觸發 `clarification_required`、`no_answer`、`permission_denied`、`tool_failure`、`missing_page_context`、`no_evidence`、`evidence_conflict` 等情境，驗證 UI 行為。

**Acceptance Scenarios**:

1. **Given** backend 回傳 `clarification_required`，**When** panel 收到 `final` event，**Then** 系統必須顯示 clarification question，並允許使用者補充資訊後繼續在同一 session 追問。
2. **Given** backend 回傳 `no_answer` 且 `noAnswerReason` 為 `tool_failure`、`missing_page_context`、`no_evidence` 或 `evidence_conflict`，**When** panel 呈現最終狀態，**Then** 系統必須顯示對應安全 UI，且不得建立 `tool_failed` 這種新的 final state。
3. **Given** backend 回傳 `permission_denied`，**When** panel 顯示結果，**Then** 系統必須明確顯示受限狀態，而不是回退成 answered 或自行建構替代答案。

---

### User Story 6 - 送出 message-level feedback (Priority: P2)

使用者可以針對 assistant answer 送出 thumbs up / down、reason 與 comment，並看到成功、失敗與重試狀態。

**Why this priority**: feedback loop 是產品必要能力，也是後續 review 與品質改善的重要輸入，但它不應與主對話流耦合過深。

**Independent Test**: 可針對一則 assistant message 送出不同 feedback 組合，驗證 request payload、`messageId` / `requestId` 關聯與 success / failed / retry UI。

**Acceptance Scenarios**:

1. **Given** 使用者要對 assistant answer 給回饋，**When** 送出 feedback request，**Then** request 必須包含 `rating`、`intent`，並可帶 `reason`、`comment`。
2. **Given** feedback 對應到一則 assistant answer，**When** panel 發送 feedback，**Then** 系統必須將 feedback 關聯到對應 `messageId` 與 `requestId`。
3. **Given** feedback API 成功或失敗，**When** panel 更新畫面，**Then** 系統必須顯示 success / failed / retry UI，且前端不得自行建立 `ReviewItem`。

---

### User Story 7 - 處理 confirmation_required / ActionDraft confirm / cancel (Priority: P2)

當 backend 要求人類確認 medium-risk action 時，前端顯示 `confirmation_required` 與 ActionDraft preview，並支援 confirm / cancel。

**Why this priority**: 這是人類控制風險動作的最小必要產品閉環，也是本 feature 與純問答面板的關鍵差異之一。

**Independent Test**: 可觸發 `confirmation_required` flow，驗證 card、preview、risk、expiresAt、confirm / cancel、`idempotencyKey`、`pending_execution_guard` 與 expired / failed / cancelled state。

**Acceptance Scenarios**:

1. **Given** backend 回傳 `confirmation_required`，**When** panel 顯示該卡片，**Then** 系統必須顯示 action preview、risk summary 與 `expiresAt`。
2. **Given** 使用者選擇 confirm 或 cancel，**When** panel 呼叫 ActionDraft API，**Then** confirm 必須支援 `idempotencyKey`，cancel 必須依 contract 發送，且 UI 必須反映對應狀態。
3. **Given** confirm response 帶有 `pending_execution_guard` 或 action draft 進入 expired / failed / cancelled 狀態，**When** panel 更新畫面，**Then** 系統不得把該動作誤顯示為 side-effect 已安全完成。

---

### User Story 8 - 處理 approval_required status display (Priority: P3)

當 backend 要求主管審核或升級處理時，前端顯示 approval 狀態卡與開啟明細的 extension point，但不實作完整 approval management UI。

**Why this priority**: approval gate 是 assistant core 公開 contract 的一部分，但本 feature 只承擔 display-only 角色，必須把邊界講清楚，避免後續 task 擴張。

**Independent Test**: 可觸發 `approval_required` flow，驗證 `approvalRequestId`、status、`riskLevel`、action summary、evidence chips 與 `onOpenApprovalDetail` callback，且不存在 inline approval controls。

**Acceptance Scenarios**:

1. **Given** backend 回傳 `approval_required`，**When** panel 顯示 approval 狀態卡，**Then** 系統必須顯示 `approvalRequestId`、status、`riskLevel`、action summary 與可見 evidence chips。
2. **Given** host app 提供 `onOpenApprovalDetail` callback，**When** 使用者在 approval 卡上選擇查看詳細資訊，**Then** panel 必須呼叫該 callback 讓 host app 開啟獨立 approval detail。
3. **Given** 本 feature 的 approval flow 為 display-only，**When** panel 呈現 approval 狀態卡，**Then** 系統不得顯示 approve / reject / cancel button，也不得實作 inline approval workflow。

---

### User Story 9 - 處理 network / SSE interrupted / backend degraded (Priority: P2)

前端必須在網路中斷、SSE timeout、partial 後 error、backend degraded 與 unknown event 情境下安全處理使用者體驗。

**Why this priority**: 真實企業環境中的嵌入式面板會長時間運行在不穩定網路與複雜容器裡，缺少 resilience 會直接破壞使用信任與後續實作穩定性。

**Independent Test**: 可模擬 SSE interrupted、final timeout、partial answer 後收到 error event、backend degraded 與 retry / resend，驗證系統維持安全 UX。

**Acceptance Scenarios**:

1. **Given** SSE stream 在收到 `final` 前中斷或超時，**When** panel 偵測到 interrupted 或 timeout，**Then** 系統必須顯示安全狀態與 retry / resend UX，且不得把 partial answer 當成 final answer。
2. **Given** panel 已收到 partial answer，**When** 後續到達 `error` event，**Then** 系統必須將該訊息標記為失敗或中斷狀態，而不是視為 answered。
3. **Given** backend degraded 或 panel 收到 unknown SSE event，**When** 使用者仍停留在對話介面，**Then** 系統必須維持可理解且不崩潰的安全 UI。

---

### Edge Cases

- 當 host app 無法提供完整 context，或使用者的問題包含「這筆」「目前」「這張單」但 current page context 不足以唯一識別實體時，系統必須允許 backend 回傳 clarification，而不是由前端猜測目標資料。
- 當 `selectedRows` 含多筆資料且 query 不足以鎖定單一目標時，系統必須顯示 clarification 問題，並保留原始對話脈絡。
- 當 SSE event 順序異常、重送或重複到達時，系統必須以 `sequence` 做排序與去重，但仍只以 `final.data.answerDecision` 作為最終結果。
- 當收到 unknown SSE event type 時，系統必須安全忽略或以不破壞主要對話流程的 fallback 方式處理，不得造成 UI 崩潰。
- 當 history API 回傳 `nextCursor = null` 時，系統必須將其視為沒有更多可載入訊息，不得自行假設存在 `hasMore`。
- 當 history cursor 無效、session 不可見或跨 actor / host app / organization boundary 讀取失敗時，系統必須依 safe error envelope 呈現，而不是回退到顯示本地快取的完整歷史內容。
- 當 final payload 的 `evidenceRefs` 為 `EvidenceRefSummary[]` 時，系統必須能顯示 safe source summary，例如 `sourceType`、`title`、`snippet`；若為 `string[]`，系統只能顯示 safe evidence reference chip / id。
- 系統不得自行補造 `sourceType`、`title`、`snippet`、document content、raw evidence payload 或 raw tool output。
- 當 `answerDecision = 'no_answer'` 且 `noAnswerReason = 'tool_failure'` 時，系統必須呈現 tool failure 類型的安全無答案 UI，但不得發明 `tool_failed` 這種新的 final state。
- 當使用者確認 medium-risk action 後收到 `pending_execution_guard` 類型的 recheck 結果時，系統不得宣稱該 side-effect 已安全完成。
- 當 panel 容器寬度受限或使用鍵盤 / 螢幕閱讀器操作時，串流狀態、錯誤狀態與 confirmation / approval 卡片仍必須可操作與可理解。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 提供可嵌入企業內部宿主系統的 floating launcher widget，供已登入的內部人員使用；`embedded` 僅代表 host integration，MVP presentation MUST 為右下角 launcher + toggleable dialog，且 panel 預設關閉。
- **FR-002**: 系統 MUST 將 `.specify/memory/constitution.md` 中定義的 internal-only、backend-source-of-truth、secure-by-default、SSE-first、evidence-visible 與 human-control-for-risky-actions 原則視為此 feature 的強制約束。
- **FR-003**: 系統 MUST 以 backend assistant API handoff 作為唯一 contract 依據，不得自行發明未被 handoff 保證的 endpoint、event type、response field 或 final state。
- **FR-004**: 系統 MUST 提供 `AssistantHostContextProvider` 或等效 host adapter 概念，作為 chat panel 取得 actor context、host app、organization boundary 與最新 `pageContext` 的標準整合介面。
- **FR-005**: `AssistantHostContextProvider` 或 host adapter MUST 支援提供或映射至少以下可送往 backend 的 `pageContext` 欄位：`module`、`route`、`screenId`、`entityType`、`entityId`、`selectedRows`、`activeFilters`、`visibleColumns`、`userVisibleState`。
- **FR-006**: 系統 MUST 在每次送出 message 前即時讀取最新 host context，不得重用過期快照作為 send-message request context。
- **FR-007**: 系統 MUST 僅將 sanitized、visible、non-secret 的 context summary 送往 backend，且 MUST NOT 把 raw row payload、hidden columns、secret fields、完整 table state 或未遮罩資料直接放入 request context。
- **FR-008**: 當 host context 不足以唯一識別使用者查詢目標時，系統 MUST NOT 自行猜測「這筆」「目前」「這張單」代表的資料；系統 MUST 允許 backend 回傳 clarification，且 SHOULD 提示使用者補足條件。
- **FR-009**: 系統 MUST NOT 根據 `pageContext`、host context 或 local state 自行做資料權限判斷、approval decision、retrieval 決策、prompt 組裝或 tool 選擇。
- **FR-010**: 系統 MUST 由宿主應用提供或協助提供 request 所需 identity headers：`x-request-id`、`x-actor-id`、`x-organization-id`、`x-host-app`、`x-role`、`x-permission-scopes`。
- **FR-011**: 系統 SHOULD 主動產生並傳遞 `x-request-id`，以支援 SSE correlation、support trace、feedback linkage 與 review linkage。
- **FR-012**: 系統 MUST 支援 session create、session get、session message history retrieval 與 send message 四條主要 assistant session 流程。
- **FR-013**: 系統 MUST 支援三種 session scope：`global`、`page`、`entity`。
- **FR-014**: `global` scope MUST 表示同一 actor / organization / hostApp 共用一個 assistant session。
- **FR-015**: `page` scope MUST 表示同一 route / screenId 共用一個 assistant session。
- **FR-016**: `entity` scope MUST 表示同一 `entityType + entityId` 共用一個 assistant session。
- **FR-017**: 系統 MUST 採 host-managed sessionId 優先的 restore 策略；當 host app 提供 sessionId 時，系統 MUST 優先使用該 sessionId restore。
- **FR-018**: 當 host app 未提供 sessionId 時，系統 MUST 允許以 `sessionStorage` 作為 fallback 暫存 sessionId，並依 `SessionScopeKey` 對應 scope 下的 session。
- **FR-019**: 系統 MUST NOT 以 `localStorage` 作為長期保存 sessionId、完整 history、tool result、evidence payload、prompt 或敏感對話內容的主要策略。
- **FR-020**: 當 host-provided sessionId 與 `sessionStorage` fallback 都不存在時，系統 MUST 呼叫 `POST /api/v1/assistant/sessions` 建立新 session。
- **FR-021**: 當 restore 的 session 不存在、已過期、已關閉或不可見時，系統 MUST 清除本地 fallback sessionId，並 fail safe 到安全的新建流程或安全錯誤狀態。
- **FR-022**: 系統 MUST 透過 `GET /api/v1/assistant/sessions/{sessionId}/messages` 從 backend 重新載入 history，而不是依賴本地保存的完整 message history。
- **FR-023**: history 載入 MUST 遵守 public contract：`limit`、`cursor`、`order=asc` 與 `nextCursor`。
- **FR-024**: 系統 MUST 以 `nextCursor !== null` 作為仍可載入更多 history 的唯一判斷，不得依賴 `hasMore` 或 `order=desc`。
- **FR-025**: history 呈現 MUST 只依賴 masked summary 欄位，例如 `messageId`、`role`、`content`、`createdAt`、可選的 `answerDecision`、`evidenceRefs` 與 `toolSummary`。
- **FR-026**: 系統 MUST 支援透過 `POST /api/v1/assistant/sessions/{sessionId}/messages` 送出 assistant message。
- **FR-027**: send message request MUST 使用 `POST`、request `Content-Type: application/json`、request `Accept: text/event-stream`，且 response `Content-Type` MUST 為 `text/event-stream`。
- **FR-028**: send message request MUST 包含使用者輸入的 `message`，以及當次最新 `pageContext`。
- **FR-029**: 系統 MUST 將 SSE 作為 AI 回答的主要即時互動模式，並顯示至少 sending、connecting、streaming、final、error 等使用者可理解狀態。
- **FR-030**: 系統 MUST 能處理目前 public contract 中已知的 SSE event types：`tool_call_started`、`tool_call_completed`、`tool_call_blocked`、`tool_call_failed`、`evidence_attached`、`answer_delta`、`confirmation_required`、`approval_required`、`escalation_required`、`final`、`error`。
- **FR-031**: 系統 MUST 對 unknown SSE event type 採安全 fallback，不得讓 UI 崩潰或錯把未知事件顯示為成功回答。
- **FR-032**: 系統 MUST 使用 `sequence` 進行事件排序、除錯與避免重複 append。
- **FR-033**: 系統 MUST 以 `final.data.answerDecision` 作為唯一可靠最終狀態來源，不得從中途 event 或 `answer` 是否存在反推最終決策。
- **FR-034**: 系統 MUST 支援並正確呈現以下最終 answerDecision：`answered`、`clarification_required`、`no_answer`、`confirmation_required`、`approval_required`、`escalation_required`、`permission_denied`。
- **FR-035**: 當 `answerDecision = 'no_answer'` 時，系統 MUST 進一步依 `noAnswerReason` 呈現對應的安全 UI，例如 `tool_failure`、`missing_page_context`、`no_evidence`、`evidence_conflict`、`ambiguous_query`、`low_confidence`、`unsupported_scope`。
- **FR-036**: 系統 MUST NOT 把 `tool_failure` 視為獨立的 final answerDecision state。
- **FR-037**: 當 answered flow 的 `evidenceRefs` 為 `EvidenceRefSummary[]` 時，系統 MUST 顯示 safe source summary，例如 `sourceType`、`title`、`snippet`。
- **FR-038**: 當 answered flow 的 `evidenceRefs` 為 `string[]` 時，系統 MUST 只顯示 safe evidence reference chip / id，不得自行補造 `sourceType`、`title`、`snippet`、document content 或 raw evidence。
- **FR-039**: evidence 呈現 MUST 遵守 backend 已遮罩的內容，且 MUST NOT 嘗試還原 raw evidence、raw tool output、full document text 或未授權欄位。
- **FR-040**: 當 `clarification_required` 發生時，系統 MUST 顯示 backend 回傳的 clarification question，並允許使用者在同一 session 內延續詢問。
- **FR-041**: 當 `permission_denied`、`no_answer` 或 `escalation_required` 發生時，系統 MUST 呈現清楚且安全的受限狀態，而不是回退成一般 answered UI。
- **FR-042**: 系統 MUST 支援 `confirmation_required` flow，並呈現 action draft preview、risk summary、expiresAt 與 confirm / cancel 控制。
- **FR-043**: 系統 MUST 透過 `GET /api/v1/assistant/action-drafts/{actionDraftId}` 載入 action draft detail，並透過 confirm / cancel API 完成使用者操作。
- **FR-044**: `confirmation_required` flow 中的 confirm 操作 MUST 對齊 `POST /api/v1/assistant/action-drafts/{actionDraftId}/confirm` contract，並支援傳送 `idempotencyKey`。
- **FR-045**: `confirmation_required` flow 中的 cancel 操作 MUST 對齊 `POST /api/v1/assistant/action-drafts/{actionDraftId}/cancel` contract。
- **FR-046**: 當 confirm response 含 `pending_execution_guard` 類型的 recheck 資訊時，系統 MUST NOT 將其呈現為 side-effect 已安全完成。
- **FR-047**: 系統 MUST 支援 `approval_required` flow，並將其限制為 display-only feature。
- **FR-048**: `approval_required` card MUST 顯示 `approvalRequestId`、approval status、`riskLevel`、action summary，以及可見的 evidence chips 或 safe evidence summary。
- **FR-049**: `approval_required` card MUST 提供 `onOpenApprovalDetail` callback，讓 host app 可開啟獨立 approval detail 頁面。
- **FR-050**: 本 feature MUST NOT 實作完整 approval management UI、approver 待審清單、inline approve / reject / cancel workflow UI。
- **FR-051**: 系統 MUST 支援 `POST /api/v1/assistant/messages/{messageId}/feedback` 送出 feedback。
- **FR-052**: feedback submission MUST 關聯當前 assistant `messageId` 與對應 `requestId`。
- **FR-053**: feedback UI SHOULD 支援 `positive`、`negative`、`neutral` rating，以及 handoff 允許的 `intent`、`reason` 與 `comment`。
- **FR-054**: feedback 送出後，系統 MUST 顯示成功、失敗與可重試狀態。
- **FR-055**: 系統 MUST NOT 由前端直接建立或管理 `ReviewItem`；review item 的建立或連結由 backend 決定。
- **FR-056**: 系統 MUST 提供嵌入不同宿主系統頁面的能力，且 MUST NOT 假設固定全頁 layout 或單一應用樣式。
- **FR-057**: 系統 MUST 支援鍵盤操作、焦點管理、ARIA label 與 screen reader 可理解的狀態更新，尤其是串流、錯誤、clarification、confirmation 與 approval 狀態。
- **FR-058**: 系統 MUST NOT 直接呼叫 OpenAI、其他 LLM provider、RAG pipeline、tool execution engine 或真實 ERP / MES / WMS / SCM / CRM connector。
- **FR-059**: 系統 MUST NOT 儲存或輸出 secret、完整 prompt、完整 tool payload、raw evidence payload、raw connector result、完整 audit metadata 或未遮罩資料到 console、analytics 或 browser storage。
- **FR-060**: 系統 MUST NOT 實作 public chatbot、anonymous visitor flow、lead capture 或 customer service handoff。
- **FR-061**: 系統 MUST 支援契約導向的 mock API / SSE fixture，以便在沒有真實 backend 或 connector 的情況下驗證核心流程。

### Key Entities *(include if feature involves data)*

- **EmbeddedChatPanel**: 可嵌入宿主系統的對話面板，負責顯示會話、回應狀態、evidence、confirmation、approval 與 feedback UI。
- **AssistantHostContextProvider / HostAdapter**: 宿主整合介面，提供 actor / host app / organization 與最新 page-level context，並可協助 host-managed sessionId 與 `onOpenApprovalDetail` callback。
- **PageContext**: 送往 backend 的 page-level sanitized context summary，包含 module、route、screenId、entity、selectedRows、filters、visibleColumns 與 userVisibleState。
- **SessionScope / SessionScopeKey**: 決定 session restore 與 fallback 映射策略的範圍模型，支援 `global`、`page`、`entity`。
- **AssistantSession**: 後端建立或還原的會話實體，具備 id、status、title、createdAt、updatedAt、latestMessageId 與可選 pageContext。
- **HistoryMessageSummary**: backend history retrieval 回傳的遮罩訊息摘要，用於呈現既有 user / assistant 對話。
- **AssistantMessageFinalState**: 由 `final` SSE event 決定的最終回答狀態，包含 `answerDecision`、可選 `answer`、`noAnswerReason`、`evidenceRefs` 與風險流程識別欄位。
- **EvidenceReferenceDisplay**: 根據 `EvidenceRefSummary[]` 或 `string[]` 轉換後的證據顯示模型，用於 safe source summary、reference chips 或連結提示。
- **ActionDraftConfirmationState**: medium-risk 動作的使用者確認狀態，包含 action draft detail、preview、risk、expiresAt、confirm / cancel 結果與 recheck 狀態。
- **ApprovalRequestStatusCard**: high / critical risk 動作的只讀顯示模型，包含 approval status、risk level、action summary、payload summary、evidenceRefIds 與 host callback extension point。
- **FeedbackSubmission**: 使用者對 assistant answer 的回饋資料，包含 rating、intent、可選 reason / comment，以及對應 messageId / requestId。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 已登入的內部使用者可在支援的 host app 頁面中透過右下角 floating launcher 開啟與關閉 chat panel，並在單一操作流程內完成送出第一則訊息與看到最終回應狀態。
- **SC-002**: 一般 send-message flow 必須向使用者清楚呈現 sending、connecting、streaming 與 final 或 error 狀態，且最終狀態以 `final.data.answerDecision` 對齊 backend contract。
- **SC-003**: 在存在可見 session 的情況下，使用者可成功 restore session 並看到從 backend 載入的 history；當 `nextCursor` 非空時，使用者可成功載入更多訊息。
- **SC-004**: `global`、`page`、`entity` 三種 session scope 的 context injection 與 restore 行為皆有自動化測試覆蓋，且 message send 能攜帶當次最新 `pageContext`。
- **SC-005**: SSE parser 可處理目前 handoff 定義的已知 event types，並在 unknown event type 下維持安全 fallback；重複或亂序事件不會造成重複 append 或錯誤最終狀態。
- **SC-006**: `clarification_required`、`no_answer`、`permission_denied`、`tool_failure`、`confirmation_required`、`approval_required`、`escalation_required` 都有明確且可驗證的 UI outcome。
- **SC-007**: `EvidenceRefSummary[]` answered flow 必須能顯示 safe source summary，例如 `sourceType`、`title`、`snippet`；若 backend 只回傳 `string[] evidenceRefs`，UI 只能顯示 safe evidence reference chip / id，不得自行補造 `title`、`snippet`、`sourceType`、document content 或 raw evidence。
- **SC-008**: `confirmation_required` flow 可完成 confirm / cancel，且 confirm 結果不會被誤顯示為 side-effect 已安全執行。
- **SC-009**: `approval_required` flow 可顯示 status、risk level、action summary 與 open detail extension point，且不包含 inline approve / reject / cancel。
- **SC-010**: feedback 可成功送出並正確顯示成功 / 失敗 / 重試狀態，同時保留 messageId 與 requestId 的關聯。
- **SC-011**: 關於 secret、完整 prompt、完整 tool payload、raw evidence payload、raw connector result 與未遮罩資料不寫入 console / browser storage 的測試皆通過。
- **SC-012**: 核心 UI flow 具備 automated tests，且基本 accessibility checks 可驗證鍵盤操作、焦點管理與 screen reader 狀態更新。

## Assumptions

- host app 會提供必要的身份與邊界資訊，至少能滿足 assistant contract 所需的 headers 與 `AssistantHostContextProvider` 整合需求。
- host app 可依實際嵌入方式選擇直接提供 sessionId、提供 session scope 所需識別資訊，或僅讓 panel 使用 `sessionStorage` fallback。
- `AssistantHostContextProvider` 是本 feature 的正式整合模式；簡化 props adapter 僅作為 demo、storybook、測試或低耦合驗證用途。
- `approval_required` 初始顯示資料以 SSE event 與 approval detail API 的可用欄位為準；更完整的 approval workflow 與授權欄位留待後續獨立 feature。
- history、session visibility、permission boundary、evidence masking 與 tool execution guard 的真實判斷皆由 backend 負責，前端只依 safe response / event contract 呈現。
- 為符合 Spec Kit 與本次任務決策，本規格檔輸出位置固定為 `specs/001-internal-assistant-embedded-chat-panel/spec.md`。
- 本 spec 採契約導向詳規，會保留必要的 contract 名詞、event 名稱與 public interface 概念，但不落到實作程式碼或具體框架選型。

### Open Questions / Contract Boundaries

- `tool_failure` 在 handoff 中是 `NoAnswerReason`，不是獨立 `AnswerDecisionStatus`；本 spec 已依此處理，後續設計與實作不得新增 `tool_failed` final state。
- history public contract 目前只保證 `order=asc` 與 `nextCursor`；`order=desc`、`hasMore` 或 reverse loading 若未來需要，必須先更新 backend contract 與 handoff。
- handoff 未保證 raw evidence payload、raw tool output、full document text、完整 connector result 或未遮罩欄位；本 spec 不將其視為 chat panel UI contract。
- approval request 的 approve / reject / cancel endpoint 雖在 handoff 中有文件，但明確屬於未來 approval-management feature；本 spec 不納入 inline approval workflow。
- `selectedRows` 的每列欄位內容在 public contract 上仍屬 `Record<string, unknown>` 型態；本 spec 因此只要求 sanitized、visible summary，不對 row payload schema 做更細假設。
