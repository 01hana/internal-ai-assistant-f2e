# Tasks: Assistant Conversation Experience（前端）

**Input**: `spec.md`, `design.md`, `plan.md`
**Status**: Phase 0–3 完成（Gate 3 PASS；T016 併入 T031）；下一步 Phase 4

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

- [x] T004 [P] unit：SSE `final` 接受選用 `suggestions`，不合法項目捨棄、全部不合法省略欄位、舊 final 不變（`tests/unit/assistant-runtime/`）。RED 後修改 `packages/assistant-runtime/src/types/index.ts`、`sse/index.ts`。
- [x] T005 [P] unit：`AssistantSession.opening` 正規化（缺欄位、型別錯誤時省略）。RED 後新增型別與正規化函式。
- [x] T006 unit：送訊息輸入 `message` / `choiceId` 二選一；`choiceId` 格式；兩者皆有或皆無被拒（`requestBuilder`、`requestSafety`、`outgoingRequestBoundary`）。RED 後實作。
- [x] T007 contract：`defaultTransport` 兩種模式 —— `createSession` 保留 `opening`；`streamMessage` body 只有 `choiceId` 與 `pageContext`；`listSessions` GET 路徑與 query；`archiveSession` POST 無 body；gateway-v1 只帶 `Authorization`。RED 後實作，路由白名單加入兩者。
- [x] T008 unit：transport port 選用 capability `listSessions` / `archiveSession` 與 `supportsAssistantRuntimeSessionHistory()`。
- [x] T009 component：`sessionBootstrap.restoreSession(sessionId)` 的成功與失敗路徑（失敗時目前對話不變）。（原「空 session 改建新 session」已撤回，見 spec Decision 4。）
- [x] T010 **Gate 1**：typecheck、lint、Phase 1 focused；使用者全套通過（舊回應相容）。`FRONTEND003_GATE_1=PASS`。

**Phase 1 執行證據（2026-11-16）**：

- T004／T005／T008：`packages/assistant-runtime/src/experience/index.ts`（`ASSISTANT_CHOICE_ID_PATTERN` 與後端相同、`normalizeAssistantChoices`、`normalizeAssistantOpening`、`normalizeAssistantSessionListPage`）；型別 `AssistantChoice`、`AssistantOpening`、`AssistantSession.opening?`、`AssistantMessageFinalData.suggestions?`、`AssistantSessionListItem`／`Page`。SSE parser 對 `final.suggestions` 正規化（不合法項目捨棄、全部不合法則移除欄位，不讓事件失敗）；session orchestrator 建立 session 時正規化 `opening`。transport port 新增選用 `listSessions`／`archiveSession` 與 `supportsAssistantRuntimeSessionHistory()`。測試 `tests/unit/assistant-runtime/conversation-experience.spec.ts`。
- T006：`AssistantRuntimeSendMessageInput` 改為 `message`／`choiceId` 二選一；`coreAssistantRequestAdapter` 的 compatibility 與 gateway 兩個 builder 共用 `readMessageOrChoice`，兩者皆有、皆無、`choiceId` 格式錯誤都拒絕；backend002 不支援 choice。測試 `tests/unit/assistant-sdk/choice-request.spec.ts`。
- T007：`defaultTransport` 兩種內建模式新增 `listSessions`（GET，只帶 `limit`、`cursor`）與 `archiveSession`（POST，無 body）；只有這兩條路由把 400 回報為新的 `invalid_request`、404 回報為 `session_not_found`，既有路由的錯誤對應不變；列表回應不合法時安全失敗；`streamMessage` 支援 `choiceId`。backend002 不提供這兩個 capability（比照 remote restoration）。測試 `tests/contract/assistant-sdk/default-transport-conversation-experience.spec.ts`。
- T009：`sessionBootstrap.restoreSession`、`forgetStoredSession`，adapter 對外提供。測試 `tests/component/assistant-sdk/session-restore-from-list.spec.ts`。原規劃的「空 session 改建新 session」撤回（spec Decision 4）。
- 型別檢查：在 VM 以 strict 設定對 `packages/assistant-sdk/src`、`packages/assistant-runtime/src` 與新測試做 `vue-tsc`，錯誤清單與未修改的 `HEAD` 完全相同（皆為既有、只在 strict 設定出現的錯誤），新測試無錯誤。vitest、eslint 與 `nuxt typecheck` 需 Mac 原生套件，由使用者執行。
- T010 Gate 1（使用者於 Mac 執行，2026-11-16，`ff7e64b` + Phase 1 未 commit 變更）：先 `npm run build:assistant-sdk`，再跑 unit／component／contract：766 tests 中 765 passed、1 failed（僅 Frontend 001 已知失敗 `send-message-streaming`）；新增 32 個測試全數通過。lint 由 35 降為 16，無新增錯誤（`sse/index.ts` 兩個 unused vars 為既有）。`npm run typecheck` 由使用者確認。

```text
FRONTEND003_GATE_1=PASS
FRONTEND003_FIRST_UNEXECUTED_TASK=T011
```

## Phase 2 — 開場與建議（US1、US2）

- [x] T011 後端 repo：準備本機體驗設定並寫入本機資料庫（不改客戶正式設定），讓本機能看到開場。
  - 2026-11-16：後端新增 `npm run assistant-experience:local:provision -- --file customers/shinmone/assistant-experience/1.0.0.json`：以正式設定為唯一來源，從本機 Capability Pack（`backend.env`）取得本機客戶範圍，複製到 `.local-state/`（不進版控）後，以 `local:start` 相同環境先 `--check` 再寫入。不另存本機設定檔（使用者決定，避免重複資料）。結果：`VALIDATED` → `ACTIVATED`（`customer-shinmone-scm-local` / `shinmone-scm-assistant-local`，`1.0.0`）。
- [x] T012 unit：runtime 狀態 —— `createSession` 成功時加入 `assistant_greeting` 本地訊息；還原時不加入；「最新選項」推導（最後一則助理訊息、串流中不顯示）；`finalize` 保存 `suggestions`；`markChoiceUnavailable`。RED 後修改 `stores`、`runtime`、`session`。
- [x] T013 component：`AssistantProductRuntimePanel` 顯示 greeting（無回饋、無資料來源）、選項 group 與 chip、送出下一則後隱藏、串流中停用、使用者訊息 notice。RED 後實作。
- [x] T014 unit：`sdkRuntimeAdapter` choice 請求的 `session_not_found` 回報為 `choice_unavailable`。
- [x] T015 component／integration：`AssistantWidget.sendChoice` —— 顯示 label、送 `choiceId`、404 移除選項並提示、對話不重置；「重新開始」後再次顯示開場。
- [ ] T016 本機手動驗證：開啟助理看到問候與 Quick Reply，點擊得到回答與建議（截圖記錄）。**移到 T031 一起做**：本 repo 的預覽頁（`/assistant-sdk-preview`）使用 compatibility mode 且未設定 proxy，無法連到需要 Shinmone 身分的本機 Gateway；實際畫面要在 Shinmone 前端換上新版 SDK 後驗證。
- [x] T017 **Gate 2**：typecheck、lint、Phase 2 focused、使用者全套通過。`FRONTEND003_GATE_2=PASS`。

**Phase 2 執行證據（2026-11-16）**：

- T012：runtime `experience` 模組新增 `createAssistantGreetingMessage`、`resolveLatestAssistantChoices`、`withoutAssistantChoice`；`createSession` 成功且有 `opening` 時在訊息列表最前面加入 `assistant_greeting` 本地訊息（沒有 `opening` 時訊息列表完全不動）；`finalizeActiveStreamingMessage` 保存 `suggestions`；controller 新增 `markChoiceUnavailable`。「最新選項」規則：只看最後一則訊息，必須是問候或已完成的回答；被拒絕的選項那一輪（帶 notice 的使用者訊息）會略過，讓其餘選項仍可點。測試 `tests/unit/assistant-runtime/conversation-experience-state.spec.ts`。
- T013：`AssistantProductRuntimePanel` 新增選用 prop `onChooseSuggestion`（沒提供就不顯示選項）；問候以助理訊息顯示（`assistant-greeting-message`，無回饋按鈕）；選項列 `role="group" aria-label="建議問題"`，串流中或不能送出時停用；選項失效提示顯示在使用者訊息下方（`role="status"`）。樣式只使用既有 `--assistant-sdk-*` token。測試 `tests/component/assistant-runtime/product-runtime-panel-suggestions.spec.ts`。
- T014：stream runner 會把開啟串流的錯誤統一成 `stream_transport_error`，因此 `sdkRuntimeAdapter` 在 `openStream` 記住「choice 請求得到 `session_not_found`」，於 `onTransportError` 改走選項失效處理：移除等待中的助理訊息、清除串流狀態、標記選項失效，不設 lastError、不顯示失敗狀態。
- T015：`AssistantWidget` 新增 `sendChoice`，與 `sendMessage` 共用 `startConversationTurn`（顯示文字與送出內容分開）。測試 `tests/component/assistant-sdk/widget-conversation-experience.spec.ts`：開場、點擊送 `choiceId` 並顯示 label、回答後的建議、手打訊息後隱藏、404 移除選項並提示（其餘選項仍在）、沒有 `opening` 的舊後端維持原空白狀態。
- 型別檢查：VM strict 設定錯誤清單與 `HEAD` 相同，新測試無錯誤。
- Gate 2 首輪（使用者於 Mac，2026-11-16）：784 tests 中 2 failed —— Frontend 001 已知失敗，以及「選項 404」測試。原因：兩種內建 transport 對任何非 2xx 的串流回應都回 `transport_execution_failed`，選項被拒絕時不會是 `session_not_found`。修正：`defaultTransport` 只在帶 `choiceId` 的請求把 404 回報為 `session_not_found`，手打訊息的錯誤對應不變；contract 測試補兩種模式的案例。typecheck 通過；lint 16 個與 Gate 1 相同，無新增。
- 修正後兩個相關檔案重跑通過（使用者於 Mac，2026-11-16）。

```text
FRONTEND003_GATE_2=PASS
FRONTEND003_DEFERRED=T016→T031
FRONTEND003_FIRST_UNEXECUTED_TASK=T018
```

**Phase 2 手動檢視後調整（2026-11-16，使用者以 Shinmone 前端 + 本機後端檢視）**：

- 版面：選項原本放在訊息框外、時間下方，且按鈕過大。改為在 `AssistantProductMessageFrame` 新增 `after` slot（位於回覆與時間之間），選項與「選項失效」提示都放入其中；選項按鈕改用 helper 字級、較小的上下內距與間距。元件測試新增「回覆 → 選項 → 時間」順序與提示位於使用者訊息內的斷言。
- 版面再調整（使用者於 Phase 3 檢視，2026-11-16）：選項改放在時間下方（`AssistantProductMessageFrame` 新增 `footer` slot；`after` slot 只留給「選項失效」提示），順序為「回覆 → 時間 → 選項」；選項按鈕可用 `--assistant-sdk-suggestion-*` 覆寫。
- 視覺層級調整（2026-11-17）：助理頭像對齊訊息框頂端（不再貼齊下方的選項）；訊息與時間間距 4px、時間與選項 10px，形成「訊息＋時間」與「選項」兩組；時間取消左右內距，與訊息框、選項左緣對齊；選項改為無陰影的外框按鈕（主色 35% 邊框、4% 底色、深主色一般字重、13px 字、6px／14px 內距），hover 底色 9%，陰影只留給訊息框。
- 列表狀態（2026-11-17）：載入中、空白、錯誤三種狀態佔滿列表區塊並水平、垂直置中；錯誤訊息用主要文字色，「重試」改為實心主色按鈕。
- T023（使用者以 Shinmone 前端 + 本機後端檢視，2026-11-16～17）：列表、還原、封存、已封存分類與取消封存、刪除、問候與選項版面、狀態畫面皆確認；過程中的版面回饋已依上列各項調整。
- Gate 3 首輪（使用者於 Mac，2026-11-17）：816 tests 中 6 failed —— Frontend 001 已知失敗 1 個；另 5 個為 SDK stylesheet 字串合約測試（`productized-mount-helper`、`productized-widget-runtime`、`package-artifact-smoke`、`theme-token-contract` ×2）。原因：`styles.css` 被編輯器整檔重新格式化，`var(...)` 被拆成多行。修正：以既有版本為基準，內容相同的規則沿用原文字，只有本 Phase 變更的規則重寫為單行宣告（以腳本確認除空白外內容不變）。lint 16 個與 Gate 2 相同，無新增；typecheck 通過。
- 修正後受影響的 5 個測試檔重跑：37 tests 全數通過。
- 點選「你能查詢哪些資料？」得到「回覆未能完成」：不是 Core 的問題。本機 Gateway 程序自 2026-10-23 起未重啟（仍是不支援 `choiceId` 的舊版）；`dev/local-assistant/local-start.mjs` 判斷 Gateway 是否需要重啟時只看 `apps/gateway/dist/main.js`，重新 build 後 `main.js` 內容未變，因此沿用舊程序。後端 repo 已修正為與 backend 相同，納入整個 `apps/gateway/dist` 的編譯檔。
- 使用者重啟本機 Gateway、以 `npm run sdk:update` 更新 Shinmone 前端後確認：版面正確，點選「你能查詢哪些資料？」可正常得到能力總覽。

## Phase 3 — 對話紀錄與封存（US3、US4）

- [x] T018 component：`AssistantProductPanelShell` 「對話紀錄」按鈕只在 `historyAvailable` 時顯示；列表畫面改為「返回」。
- [x] T019 component：新增 `AssistantProductSessionList.vue` —— 列表項目（標題、未命名、時間、目前對話標示）、載入更多、載入中／空白／錯誤＋重試、兩段式封存與單列錯誤。RED 後實作。
- [x] T020 integration：widget 列表 —— 進入時重新載入、分頁、cursor 400 時重載第一頁一次、點擊還原（`session-changed` 事件、指標更新）、還原失敗留在列表。
- [x] T021 integration：封存 —— 非目前對話移除；目前對話清除指標、返回時建立新對話並顯示開場；404 視為成功。
- [x] T022 a11y：按鈕 `aria-label`、列表鍵盤操作、焦點在切換畫面後移到標題（沿用既有 a11y 測試方式）。
- [x] T023 本機手動驗證：列表、還原、封存（桌面與手機寬度）。
- [x] T024 **Gate 3**：typecheck、lint、Phase 3 focused、使用者全套通過。`FRONTEND003_GATE_3=PASS`。

**Phase 3 執行證據（2026-11-16）**：

- T018：`AssistantProductPanelShell` 新增 `showHistory`、`historyOpen`、`history`／`back` 事件；列表畫面時以「返回對話」取代「對話紀錄」與「重新開始」。新增圖示 `list`、`back`、`archive`。
- T019：新增 `AssistantProductSessionList.vue`（純顯示）：標題或「未命名對話」、目前對話標示（`aria-current`）、時間（今天顯示時:分，其他顯示月/日）、載入中／空白／錯誤＋重試、載入更多、單列兩段式封存與單列錯誤；開啟中或封存中的那一列停用；串流中停用開啟。
- T020：`AssistantWidget`：transport 有 `listSessions`／`archiveSession` 才顯示入口；每次進入列表重新載入第一頁；載入更多遇到 400（cursor 失效）改重載第一頁一次；點選其他對話用 `restoreSession`，驗證成功才清空目前對話並切回對話畫面，失敗則留在列表並在該列顯示錯誤（`session_not_found` 直接移除該列）；點選目前對話直接返回。對話畫面以 `v-show` 保留，切換不會清掉輸入框內容；關閉面板回到對話畫面。列表元件透過與其他私有元件相同的 glob 允許清單載入。
- T021：封存成功或 404 都從列表移除；封存的是目前對話時，立即清除本機指標、重設並建立新對話（返回時看到開場）；其他錯誤在該列顯示。
- T022：列表出現時焦點移到列表標題（`tabindex="-1"`），返回時焦點移到輸入框；封存按鈕的 `aria-label` 含對話標題；錯誤以 `role="alert"`。
- 測試：`tests/component/assistant-runtime/product-session-list.spec.ts`、`tests/component/assistant-sdk/widget-session-history.spec.ts`。型別檢查：VM strict 設定錯誤清單與 `HEAD` 相同，新測試無錯誤。
- 使用者檢視列表畫面後調整（2026-11-16）：封存與刪除改為無外框的圖示按鈕（封存／刪除 icon 為主色／危險色各混 30% 灰；hover 才出現淡灰底，兩顆按鈕間距縮小；封存的確認按鈕為實心主色，刪除的確認按鈕沿用危險按鈕色；顏色皆來自 `--assistant-sdk-*` 主題變數）；封存右側新增刪除（`trash` 圖示，獨立的兩段式確認「確定刪除？刪除後無法復原。」）。
- 封存可找回（做法 A，搭配後端 Feature 013 Phase 8）：列表上方「對話／已封存」切換（transport 有 `unarchiveSession` 才顯示）；已封存列不能直接開啟，只能「取消封存」（成功或 404 從已封存列表移除，失敗在該列顯示「目前無法取消封存這段對話，請稍後再試。」）或刪除；每次進入列表回到「對話」分類。刪除（`DELETE /sessions/:id`）對使用者是永久移除，後端保留資料供稽核；成功或 404 移除該列，刪除目前對話時與封存相同改開新對話；transport 沒有 `deleteSession` 時不顯示刪除按鈕。

## Phase 4 — 驗收與交付

- [ ] T025 integration：完整流程 開場 → 點 Quick Reply → 建議 → 手打問題 → 列表 → 還原 → 封存目前對話 → 新對話開場。
- [ ] T026 相容性：以舊後端 fixture（無 opening、無 suggestions、列表 404）跑 SDK 主要流程，行為與 baseline 相同。
- [ ] T027 SDK `0.2.0`：`packages/assistant-sdk/package.json`、CHANGELOG（若有）、`README.md`／`INSTALL.md`、`templates/nuxt-gateway/README.md` 說明新功能與後端版本需求（Core 013 以上）。
- [ ] T028 `docs/integration-status.md` 更新稽核日期與 Feature 013 對應狀態。
- [ ] T029 package 驗證：build、pack、既有 package 驗證流程通過。
- [ ] T030 **Gate 4**：使用者全套、typecheck、lint、package 驗證通過；SC-001～SC-005 對照表記錄於本檔。`FRONTEND003_GATE_4=PASS`。
- [ ] T031 交付 Shinmone 前端：使用者連接 Shinmone 前端 repo 後，替換 vendor SDK 與 composables，於本機與測試環境驗證（另行記錄）。
