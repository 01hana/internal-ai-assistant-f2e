<!--
同步影響報告
- 版本變更：template -> v1.0.0
- 原則調整：以 10 項專案專用原則取代所有 placeholder
- 新增章節：產品定位；架構邊界；必要使用者流程；API 契約對齊；資料處理與隱私；非功能需求；不在範圍內；最後檢查
- 移除章節：僅移除模板 placeholder 章節
- 需要後續檢視的模板：⚠ 僅記錄、此次未修改：.specify/templates/plan-template.md、.specify/templates/spec-template.md、.specify/templates/tasks-template.md
- 後續 TODO：無
-->

# Constitution：內部助理嵌入式聊天面板

## 1. 產品定位

本專案是企業內部 AI 助理的前端嵌入式 chat panel / widget，供 ERP、MES、WMS、
SCM、CRM、Admin 與其他企業內部後台系統嵌入使用。

- 預期使用者 MUST 為已登入宿主系統的內部人員。
- 前端 MUST NOT 直接判斷業務資料權限，且 MUST NOT 直接存取 ERP、MES、WMS、
  SCM、CRM 等資料庫。
- 前端 MUST 專注於蒐集 host app context、呈現助理互動，以及串接後端
  assistant API contract。
- 本專案 MUST NOT 被視為 public chatbot、官網客服 widget、匿名訪客入口、
  留資工具或客服轉接介面。

## 2. 核心原則

### 原則 1：以嵌入式內部情境為優先

助理 UI MUST 以宿主系統當下的內部操作情境為基礎運作，而不是依賴前端自行推測。

- 每次送出 assistant message 時，MUST 攜帶必要的 host app context。
- request context MUST 支援 actor context、host app、organization boundary、
  current route 或 screen、`entityType`、`entityId`、`selectedRows`、
  `activeFilters`、`visibleColumns`，以及後端契約要求的其他 PageContext /
  ScreenContext 欄位。
- 當 context 不完整時，前端 MUST NOT 自行猜測「這筆」「目前」「那張單」或
  「這個頁面」等指涉對象。
- 若 context 不足，前端 MUST 允許後端回傳 clarification，且 SHOULD 引導使用者
  補足缺少條件。
- PageContext 與 ScreenContext MUST NOT 被視為權限來源；授權判斷仍由後端負責。

### 原則 2：後端是唯一真實來源

後端 assistant 平台是資料存取、決策邏輯、流程編排與助理結果狀態的唯一權威。

- 前端 MUST NOT 自行執行資料查詢、權限判斷、工具選擇、retrieval、prompt 組裝
  或 approval decision。
- 前端 MUST NOT 直接呼叫真實的 ERP、MES、WMS、SCM 或 CRM connector。
- 前端 MUST 以 backend API response、SSE event、`AnswerDecision`、
  `EvidenceRef`、`ApprovalRequest`、`ActionDraft` 與其他契約物件作為畫面狀態的
  真實來源。
- 前端 MUST NOT 在 local state 中模擬任何與安全性相關的決策，即使只是暫時性 UX
  行為也不允許。

### 原則 3：預設安全

前端 MUST 將敏感資訊暴露降到最低，並以最少保存、最少揭露作為預設行為。

- 前端 MUST NOT 儲存 OpenAI API key、connector secret、backend service
  credential 或 permission-mapping secret。
- 前端 MUST NOT 將敏感 payload、完整 tool result、未遮罩 evidence、完整
  prompt 或完整 audit metadata 寫入 console log、analytics event 或 browser
  storage。
- 錯誤呈現 MUST 使用後端提供的安全 error envelope，且 MUST NOT 顯示 stack
  trace 或內部 implementation detail。
- sessionId 與 UI state 的保存 MUST 最小化，且 MUST 避免長期保存敏感對話資料。

### 原則 4：SSE Streaming 為一級能力

串流回應是核心互動模式，不是可有可無的附加功能。

- 主要即時回答傳輸機制 MUST 為 SSE streaming。
- 前端 MUST 至少能處理 `answer_delta`、`evidence_attached`、
  `tool_call_started`、`tool_call_completed`、`final`、`error`、
  `confirmation_required`、`approval_required` 等事件。
- UI MUST 支援 sending、connecting、streaming、partial answer、final answer、
  timeout、interrupted、retry 或 resend 等狀態。
- 前端 MUST NOT 假設一次 HTTP response 就會帶回完整答案。

### 原則 5：Evidence 與 AnswerDecision 必須可見

UI MUST 讓使用者能理解回答狀態，以及證據不足或受限的原因。

- 若 final answer 包含 evidence refs，UI MUST 提供可理解的來源摘要或來源指示。
- UI MUST 呈現 `AnswerDecision` 狀態，例如 `answered`、
  `clarification_required`、`no_answer`、`permission_denied`、`tool_failed`、
  `approval_required`、`confirmation_required`。
- evidence 呈現 MUST 完整遵守後端 masking 結果，且 MUST NOT 嘗試還原或補齊被
  遮罩欄位。
- 若 evidence 不足或回答受到限制，UI MUST 清楚顯示其限制原因。

### 原則 6：高風險動作必須由人控制

具有風險的動作 MUST 依後端契約維持明確的人為控制機制。

- medium-risk action MUST 顯示為 `ActionDraft` 或 confirmation flow，且
  MUST NOT 被呈現為已經執行完成。
- high-risk 與 critical-risk action MUST 顯示為 `ApprovalRequest` 或等效的
  escalation 狀態，且 MUST NOT 提供繞過審核的路徑。
- `confirmation_required` event MUST 顯示 action preview、risk summary，以及
  confirm / cancel 控制。
- `approval_required` event MUST 顯示 approval status、risk level 與
  action summary，且 MUST NOT 讓一般使用者假冒 approver。
- confirm、cancel、approve、reject 等操作 MUST 完整遵守 backend API contract。

### 原則 7：Session Restore 與 History 是產品必要能力

對話延續性是必要的產品行為。

- 前端 MUST 支援 session create 與 session restore。
- 當有 `sessionId` 可用時，前端 SHOULD 呼叫 session get 與 message history
  endpoint 載入既有會話。
- 若 session 不存在、已過期、已關閉或不可見，UI MUST 顯示安全錯誤狀態，或提供
  受控的新 session 建立路徑。
- history 載入 MUST 遵守後端 pagination 與 cursor contract。
- 前端 MUST NOT 讀取或顯示超出當前 actor、host app 或 organization boundary 的
  history。

### 原則 8：Feedback 與 Review Loop 為必要需求

使用者回饋屬於產品契約的一部分，MUST 被安全地蒐集與送出。

- 每個可回饋的 assistant answer，在後端契約允許下，SHOULD 支援 thumbs up、
  thumbs down、reason 與 optional comment。
- feedback submission MUST 關聯 `messageId` 與 `requestId`。
- 前端 MUST NOT 直接建立 `ReviewItem`；review 建立屬於後端責任。
- UI SHOULD 呈現 feedback 已送出、送出失敗與可重試等狀態。

### 原則 9：可存取、可回應、可嵌入的 UI

聊天面板 MUST 能在多種企業後台版面中使用，並對輔助技術保持可理解性。

- chat panel MUST 支援嵌入式使用，且 MUST NOT 假設固定全頁或單一產品版面。
- UI MUST 能在 desktop admin layout 中正常運作，且 MUST 避免在窄寬度容器中破版。
- 介面 MUST 支援 keyboard navigation、focus management、ARIA label 與適合
  screen reader 的狀態更新。
- streaming 狀態、錯誤、clarification、confirmation 與 approval 狀態 MUST 能透過
  無障礙狀態模式被理解。
- 元件 SHOULD 可被主題化，或至少避免與 host app style 產生嚴重衝突。

### 原則 10：可測試性與契約驅動開發

核心助理行為 MUST 依後端契約驗證，而不能只靠手動檢查。

- 前端測試 MUST 以 backend API 與 SSE contract 為核心撰寫。
- 測試覆蓋 MUST 包含 session create / restore、message send、SSE event
  handling、history rendering、PageContext injection、feedback、
  `confirmation_required`、`approval_required` 與 error states。
- MUST 提供 mock API response 與 mock SSE fixture，讓 UI 在無真實 backend 或
  connector 的情況下也能測試。
- 核心互動流程 MUST NOT 只以手動測試作為唯一驗收方式。

## 3. 架構邊界

### Frontend MAY / SHOULD

- 管理 chat panel 的 UI state。
- 保存最小必要的 session identifier 與 UI continuity state。
- 組裝包含使用者訊息與 host app PageContext 的 request DTO。
- 透過集中化 client logic 串接 backend assistant API。
- 消費 SSE event 並轉換為 UI state。
- 呈現 answer、evidence、history、feedback、clarification、confirmation 與
  approval 狀態。
- 提供 API client module、composable、store、adapter 與 mock fixture 供 UI 與
  測試使用。

### Frontend MUST NOT

- 直接呼叫 OpenAI 或任何其他 LLM provider。
- 直接呼叫真實 ERP、MES、WMS、SCM 或 CRM connector。
- 做 client-side permission decision。
- 組裝 prompt 或隱藏式 retrieval query。
- 執行 RAG retrieval 或 tool execution。
- 將被遮罩或未授權欄位補回 UI。
- 將 secret 打包進 frontend bundle，或暴露到瀏覽器可存取的 storage。
- 在長期 browser storage 中保存敏感對話內容、tool result 或 evidence payload。
- 在此專案中實作 public customer-support chatbot、anonymous visitor、
  lead capture 或 handoff 功能。

## 4. 必要使用者流程

本 constitution 要求前端架構至少支援以下流程：

1. 開啟 chat panel。
2. 建立 session。
3. 還原 session。
4. 攜帶 PageContext 送出訊息。
5. 接收 SSE streaming answer。
6. 呈現 evidence refs。
7. 呈現 `AnswerDecision`。
8. 顯示 clarification request。
9. 顯示 `no_answer`、`permission_denied` 與 `tool_failed` 狀態。
10. 送出 feedback。
11. 接收 `confirmation_required`，並對 action draft 執行 confirm 或 cancel。
12. 接收 `approval_required`，並顯示 approval status。
13. 處理 timeout、interrupted 與 retry。
14. 處理 session expired、invisible 或 closed。
15. 處理 backend degraded 或 unavailable 狀態。

## 5. API 契約對齊

前端 MUST 以前端所串接的 backend assistant API contract 作為唯一權威介面。

- API client logic MUST 集中管理，且 MUST NOT 零散散落於各個 UI component 中。
- request MUST 包含 `requestId`，或遵循後端要求的 request ID propagation 機制。
- response envelope 與 error envelope MUST 在整個應用中一致處理。
- SSE event parser MUST 能容忍 unknown event type，且 MUST 以安全且不破壞畫面的
  fallback UI 行為處理。
- 前端 MUST NOT 假設後端永遠回傳 `answered`；它 MUST 支援 `no_answer`、
  clarification、permission denial、tool failure、confirmation 與 approval 等
  一級結果狀態。

## 6. 資料處理與隱私

- session 與 message state 的保存 MUST 最小化，只保留延續性所需的最少資料。
- 敏感資料 MUST NOT 被寫入 console output、analytics payload 或 browser storage。
- 完整 tool payload MUST NOT 被持久化於 client side。
- 完整 prompt MUST NOT 被持久化於 client side。
- secret MUST NOT 被儲存在前端 codebase、build output 或 browser state 中。
- 敏感資料 MUST NOT 被放進 URL query string。
- 任何 UI debug mode MUST 受到限制，避免在 production 使用情境下暴露敏感內部
  payload。
- 測試 fixture MUST 使用合成資料或已去識別資料，且 MUST NOT 包含真實客戶資料。

## 7. 非功能需求

- Streaming UX：使用者 MUST 能看到明確的 sending、connecting、streaming、
  final 與 error 狀態。
- Resilience：SSE disconnect、timeout、backend degradation 與 network failure
  MUST 有安全的 UI 處理路徑。
- Performance：UI SHOULD 避免一次載入完整 history，且 SHOULD 支援 pagination
  或 incremental rendering。
- Accessibility：keyboard support、focus behavior、ARIA 使用與 screen reader
  狀態溝通為必要要求。
- Compatibility：面板 MUST 能嵌入不同 host app，且不應硬依賴單一頁面 layout。
- Observability：前端 MAY 蒐集安全的 UI interaction telemetry，但其內容 MUST NOT
  包含敏感 payload。

## 8. 不在範圍內

以下內容明確不屬於此前端專案範圍：

- 真實 ERP、MES、WMS、SCM 或 CRM connector。
- Backend assistant core。
- LLM provider integration。
- RAG pipeline。
- Tool execution engine。
- Approval backend implementation。
- 完整的 admin CRUD 介面。
- taxonomy 或 settings management UI。
- analytics dashboard。
- public website chatbot。
- anonymous visitor support。
- lead capture flow。
- customer service handoff flow。
- production deployment、CI/CD、Kubernetes 或 Helm implementation。

## 9. 治理

- 本 constitution 是此專案後續所有 spec、design、plan、tasks 與 implementation
  work 的最高約束。
- 若未來需求與本 constitution 衝突，MUST 先修訂 constitution，並 MUST 記錄修訂
  原因。
- 每一項新功能提案在開始實作前，MUST 先依 internal-only、
  backend-source-of-truth、secure-by-default、SSE-first、
  evidence-visible 與 human-control-for-risky-actions 等原則進行檢查。
- Amendment policy：每次修訂 MUST 說明受影響原則、變更原因、相容性影響，以及
  下游 Spec Kit artifact 所需的後續工作。
- Review policy：constitution compliance MUST 在 spec 撰寫、design review、
  planning、task generation 與 code review 階段進行檢查。
- Versioning policy：治理更新採 semantic versioning。Major 代表不相容的原則變更，
  Minor 代表新增或實質擴充規則，Patch 代表不改變行為的澄清性修正。
- Deferred sync note：相關模板對齊可於後續再檢視，但本次任務刻意不修改
  `.specify/templates/plan-template.md`、
  `.specify/templates/spec-template.md` 與
  `.specify/templates/tasks-template.md`。

## 10. 最後檢查

- 本文件已清楚區分內部助理面板與對外客服 widget。
- 本文件已明確禁止前端直接串接 LLM provider、connector、RAG 與權限判斷邏輯。
- 本文件已要求 SSE-first 的 streaming 行為。
- 本文件已要求 session restore 與 history 支援。
- 本文件已要求 PageContext 與 ScreenContext 處理。
- 本文件已要求 evidence 與 `AnswerDecision` 可見性。
- 本文件已要求 feedback 與由後端主導的 review loop。
- 本文件已要求 `confirmation_required` 與 `approval_required` 的 UX。
- 本文件已要求 secure-by-default 與 data minimization。
- 本文件未新增 backend implementation work。
- 本次 constitution 更新未生成 spec、design、plan 或 tasks artifact。
- 本次 constitution 更新未實作任何 application code。

**Version**: v1.0.0 | **Ratified**: 2026-06-23 | **Last Amended**: 2026-06-23
