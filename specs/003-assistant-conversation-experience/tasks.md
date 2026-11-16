# Tasks: Assistant Conversation Experience（前端）

**Input**: `spec.md`, `design.md`, `plan.md`
**Status**: Draft；第一個未執行的 task 為 T001

## Phase 0 — 基線

- [ ] T001 記錄 `main` @ `d4576cb` 的 `npm test`、`npm run typecheck`、`npm run lint` 結果（使用者於 Mac 執行），作為 baseline。
- [ ] T002 更新 `docs/contracts/backend-assistant-core/`（`assistant-api-contract.md`、`openapi.yaml`、`sse-events.md`、`request-response-examples.md`）加入 opening、choiceId、suggestions、列表、封存；來源為後端 `docs/frontend-integration/assistant-conversation-experience.md`。
- [ ] T003 **Gate 0**：baseline 記錄完成。`FRONTEND003_GATE_0=PASS`。

## Phase 1 — 契約與資料層

- [ ] T004 [P] unit：SSE `final` 接受選用 `suggestions`，不合法項目捨棄、全部不合法省略欄位、舊 final 不變（`tests/unit/assistant-runtime/`）。RED 後修改 `packages/assistant-runtime/src/types/index.ts`、`sse/index.ts`。
- [ ] T005 [P] unit：`AssistantSession.opening` 正規化（缺欄位、型別錯誤時省略）。RED 後新增型別與正規化函式。
- [ ] T006 unit：送訊息輸入 `message` / `choiceId` 二選一；`choiceId` 格式；兩者皆有或皆無被拒（`requestBuilder`、`requestSafety`、`outgoingRequestBoundary`）。RED 後實作。
- [ ] T007 contract：`defaultTransport` 兩種模式 —— `createSession` 保留 `opening`；`streamMessage` body 只有 `choiceId` 與 `pageContext`；`listSessions` GET 路徑與 query；`archiveSession` POST 無 body；gateway-v1 只帶 `Authorization`。RED 後實作，路由白名單加入兩者。
- [ ] T008 unit：transport port 選用 capability `listSessions` / `archiveSession` 與 `supportsAssistantRuntimeSessionHistory()`。
- [ ] T009 unit：`sessionBootstrap` 還原到沒有訊息的 session 時清除指標並建立新 session；新增 `restore(sessionId)` 的成功與失敗路徑。
- [ ] T010 **Gate 1**：typecheck、lint、Phase 1 focused；使用者全套通過（舊回應相容）。`FRONTEND003_GATE_1=PASS`。

## Phase 2 — 開場與建議（US1、US2）

- [ ] T011 後端 repo：準備本機體驗設定並寫入本機資料庫（不改客戶正式設定），讓本機能看到開場。
- [ ] T012 unit：runtime 狀態 —— `createSession` 成功時加入 `assistant_greeting` 本地訊息；還原時不加入；「最新選項」推導（最後一則助理訊息、串流中不顯示）；`finalize` 保存 `suggestions`；`markChoiceUnavailable`。RED 後修改 `stores`、`runtime`、`session`。
- [ ] T013 component：`AssistantProductRuntimePanel` 顯示 greeting（無回饋、無資料來源）、選項 group 與 chip、送出下一則後隱藏、串流中停用、使用者訊息 notice。RED 後實作。
- [ ] T014 unit：`sdkRuntimeAdapter` choice 請求的 `session_not_found` 回報為 `choice_unavailable`。
- [ ] T015 component／integration：`AssistantWidget.sendChoice` —— 顯示 label、送 `choiceId`、404 移除選項並提示、對話不重置；「重新開始」後再次顯示開場。
- [ ] T016 本機手動驗證：開啟助理看到問候與 Quick Reply，點擊得到回答與建議（截圖記錄）。
- [ ] T017 **Gate 2**：typecheck、lint、Phase 2 focused、使用者全套通過。`FRONTEND003_GATE_2=PASS`。

## Phase 3 — 對話紀錄與封存（US3、US4）

- [ ] T018 component：`AssistantProductPanelShell` 「對話紀錄」按鈕只在 `historyAvailable` 時顯示；列表畫面改為「返回」。
- [ ] T019 component：新增 `AssistantProductSessionList.vue` —— 列表項目（標題、未命名、時間、目前對話標示）、載入更多、載入中／空白／錯誤＋重試、兩段式封存與單列錯誤。RED 後實作。
- [ ] T020 integration：widget 列表 —— 進入時重新載入、分頁、cursor 400 時重載第一頁一次、點擊還原（`session-changed` 事件、指標更新）、還原失敗留在列表。
- [ ] T021 integration：封存 —— 非目前對話移除；目前對話清除指標、返回時建立新對話並顯示開場；404 視為成功。
- [ ] T022 a11y：按鈕 `aria-label`、列表鍵盤操作、焦點在切換畫面後移到標題（沿用既有 a11y 測試方式）。
- [ ] T023 本機手動驗證：列表、還原、封存（桌面與手機寬度）。
- [ ] T024 **Gate 3**：typecheck、lint、Phase 3 focused、使用者全套通過。`FRONTEND003_GATE_3=PASS`。

## Phase 4 — 驗收與交付

- [ ] T025 integration：完整流程 開場 → 點 Quick Reply → 建議 → 手打問題 → 列表 → 還原 → 封存目前對話 → 新對話開場。
- [ ] T026 相容性：以舊後端 fixture（無 opening、無 suggestions、列表 404）跑 SDK 主要流程，行為與 baseline 相同。
- [ ] T027 SDK `0.2.0`：`packages/assistant-sdk/package.json`、CHANGELOG（若有）、`README.md`／`INSTALL.md`、`templates/nuxt-gateway/README.md` 說明新功能與後端版本需求（Core 013 以上）。
- [ ] T028 `docs/integration-status.md` 更新稽核日期與 Feature 013 對應狀態。
- [ ] T029 package 驗證：build、pack、既有 package 驗證流程通過。
- [ ] T030 **Gate 4**：使用者全套、typecheck、lint、package 驗證通過；SC-001～SC-005 對照表記錄於本檔。`FRONTEND003_GATE_4=PASS`。
- [ ] T031 交付 Shinmone 前端：使用者連接 Shinmone 前端 repo 後，替換 vendor SDK 與 composables，於本機與測試環境驗證（另行記錄）。
