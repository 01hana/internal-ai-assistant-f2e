# Tasks: Assistant Conversation Experience（前端）

**Input**: `spec.md`, `design.md`, `plan.md`
**Status**: Phase 0 完成（Gate 0 PASS）；第一個未執行的 task 為 T004

## Phase 0 — 基線

- [x] T001 記錄 `main` @ `d4576cb` 的 `npm test`、`npm run typecheck`、`npm run lint` 結果（使用者於 Mac 執行），作為 baseline。
- [x] T002 更新 `docs/contracts/backend-assistant-core/`（`assistant-api-contract.md`、`openapi.yaml`、`sse-events.md`、`request-response-examples.md`）加入 opening、choiceId、suggestions、列表、封存；來源為後端 `docs/frontend-integration/assistant-conversation-experience.md`。
- [x] T003 **Gate 0**：baseline 記錄完成。`FRONTEND003_GATE_0=PASS`。

**Phase 0 執行證據（2026-11-16）**：

- T001 baseline（使用者於 Mac 執行，`main` @ `d4576cb`）：
  - `npm test` 會依序跑 unit → component → contract，前一組失敗就停止；第一次只跑到 unit（19 files）。改以 `npx vitest run tests/unit tests/component tests/contract` 一次跑完：734 tests 中 5 failed。
  - 其中 3 個 contract（`package-artifact-smoke`、`packaged-runtime-source-boundary`、`sdk-declaration-boundary`）是因 `packages/assistant-sdk/dist/` 為 11/11 的舊產物、缺 `index.d.ts`；執行 `npm run build:assistant-sdk` 後通過。**跑 contract 前須先 build SDK。**
  - 2 個 component 穩定失敗（重跑仍失敗），屬既有問題：
    - `tests/component/assistant-sdk/productized-widget-runtime.spec.ts`「stops a mounted SDK stream…」預期「回覆已取消」；`b700f2a`（2026-11-12 統一狀態卡）已把取消狀態改為「回覆已停止」，測試未同步。
    - `tests/component/assistant/send-message-streaming.spec.ts`「switches to the safe not-ready mode…」屬 Frontend 001 Nuxt adapter（`app/`，不在 003 範圍）。
  - `npm run typecheck` 通過。
  - `npm run lint`：35 errors，皆為既有問題 —— 18 個在 `packages/assistant-runtime/src/**/*.d.ts`（12 個過時的舊產生檔，`types/index.d.ts` 170 行對 `index.ts` 264 行）、8 個 `app/stores/assistant/useSessionStore.ts` unused vars、其餘 9 個分散於 `app/types`、`assistant-runtime/src/sse/index.ts` 與兩個測試檔。
- 經使用者同意，刪除 `packages/assistant-runtime/src/` 下 12 個過時 `*.d.ts`（沒有任何程式、設定或測試引用；`.ts` 本來就優先於同名 `.d.ts`）；`vue-tsc -p packages/assistant-runtime/tsconfig.json --noEmit` 通過。
- 經使用者同意，`productized-widget-runtime.spec.ts` 第 299、338 行預期文字由「回覆已取消」改為「回覆已停止」（同一測試，對應 `b700f2a` 的狀態卡文字；`degraded-states.spec.ts` 已用「回覆已停止」）。`send-message-streaming` 的 Frontend 001 失敗記為已知問題，不在 003 處理。
- T002：`docs/contracts/backend-assistant-core/` 加入 Feature 013：`openapi.yaml`（1.1.0：`GET /assistant/sessions`、`POST …/archive`、`opening`、`AssistantChoice`、`SendMessageRequest` 的 `message`／`choiceId` 二選一）、`assistant-api-contract.md`、`sse-events.md`（`final.suggestions`）、`request-response-examples.md`；YAML 可解析。
- T003 Gate 0：修正後 `productized-widget-runtime.spec.ts` 重跑通過（使用者於 Mac，2026-11-16）。基準：除 Frontend 001 `send-message-streaming` 1 個已知失敗外，unit／component／contract 全部通過（contract 需先 build SDK）；typecheck 通過；lint 剩 `app/` 與少數測試檔的既有錯誤。

```text
FRONTEND003_GATE_0=PASS
FRONTEND003_KNOWN_FAILURE=tests/component/assistant/send-message-streaming.spec.ts (Frontend 001, out of scope)
FRONTEND003_FIRST_UNEXECUTED_TASK=T004
```

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
